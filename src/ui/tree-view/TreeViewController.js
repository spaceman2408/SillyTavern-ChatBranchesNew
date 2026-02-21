import { ContextMenu } from './ContextMenu.js';
import { MessageViewerPopup } from './MessageViewerPopup.js';
import { ChatRenameHandler } from './ChatRenameHandler.js';
import { drawTreeLines } from './treeLineDrawer.js';
import { collectExpandedPathIds, buildTreeModel, findCurrentNode, isolateTreeForNode } from './treeModel.js';
import { ensureTreeStylesLoaded } from './treeLayout.js';
import { bindTreeEvents, bindTreePanning, unbindTreeEvents } from './treeEvents.js';
import { buildTreeMarkup, loadingMarkup, renderNodeRecursive, renderRenameInput } from './treeRender.js';
import { cancelRenameFlow, confirmRenameFlow, startRenameFlow } from './treeRenameFlow.js';
import { handleRootChange as handleRootChangeSelection, populateRootDropdown as populateRoots } from './treeRootSelector.js';

function isCheckpointChat(chatName) {
    return chatName && chatName.includes('Checkpoint #');
}

function normalizeChatName(name) {
    return String(name || '').replace(/\.jsonl$/i, '').trim().toLowerCase();
}

export class TreeViewController {
    constructor(dependencies) {
        this.characters = dependencies.characters;
        this.this_chid = dependencies.this_chid;
        this.token = dependencies.token;
        this.openCharacterChat = dependencies.openCharacterChat;
        this.extensionName = dependencies.extensionName;
        this.branchGraphService = dependencies.branchGraphService;
        this.selected_group = dependencies.selected_group;
        this.chat_metadata = dependencies.chat_metadata;
        this.layoutVariant = dependencies.layoutVariant || 'top-down';

        this.treeRoots = [];
        this.allTreeRoots = [];
        this.nodeMap = new Map();
        this.currentChatFile = null;
        this.currentChatUUID = null;
        this.currentRootNode = null;
        this.expandedUUIDs = new Set();

        this.resizeTimer = null;
        this.lineRedrawTimer = null;
        this.lineRedrawRaf = null;
        this.isPanning = false;
        this.wasPanning = false;
        this.panStart = { x: 0, y: 0, scrollX: 0, scrollY: 0 };
        this.isSwappingChat = false;
        this.isRenaming = false;
        this.renameNode = null;

        this.contextMenu = new ContextMenu();
        this.messageViewerPopup = null;
        this.contextMenuNode = null;
        this.renameHandler = new ChatRenameHandler({
            token: this.token,
            characters: this.characters,
            this_chid: this.this_chid,
            branchGraphService: this.branchGraphService,
        });

        this.setupContextMenu();
    }

    setupContextMenu() {
        this.contextMenu.onOptionSelect((optionId) => {
            if (optionId === 'view-messages' && this.contextMenuNode) {
                this.openMessageViewer(this.contextMenuNode);
            } else if (optionId === 'expand-all') {
                this.expandAllNodes();
            } else if (optionId === 'collapse-all') {
                this.collapseAllNodes();
            } else if (optionId === 'find-current') {
                this.centerOnActive();
            }
            this.contextMenuNode = null;
        });
    }

    updateDependencies(dependencies) {
        this.characters = dependencies.characters;
        this.this_chid = dependencies.this_chid;
        this.token = dependencies.token;
        if (dependencies.branchGraphService) {
            this.branchGraphService = dependencies.branchGraphService;
        }
        if (dependencies.selected_group !== undefined) {
            this.selected_group = dependencies.selected_group;
        }
        if (dependencies.chat_metadata !== undefined) {
            this.chat_metadata = dependencies.chat_metadata;
        }
        if (dependencies.layoutVariant !== undefined) {
            this.layoutVariant = dependencies.layoutVariant || 'top-down';
        }
        this.renameHandler.updateDependencies(dependencies);
    }

    applyLayoutVariant() {
        ensureTreeStylesLoaded(this.extensionName, this.layoutVariant);
        if ($('#chat_tree_overlay').length) {
            if (this.treeRoots.length > 0) {
                this.render();
            } else {
                this.drawLines();
            }
        }
    }

    async show() {
        if (this.selected_group) {
            toastr.warning('Group chats are not supported by this extension.');
            return;
        }

        if (!this.this_chid && this.this_chid !== 0) {
            toastr.warning('No character selected.');
            return;
        }

        this.currentChatFile = String(this.characters[this.this_chid]?.chat || '');
        if (!this.currentChatFile) {
            toastr.info('No active chat found.');
            return;
        }

        if (isCheckpointChat(this.currentChatFile)) {
            toastr.info('You are viewing a checkpoint (bookmark) chat. Checkpoints are not tracked in the branch tree.', 'Chat Branches');
            return;
        }

        this.currentChatUUID = this.chat_metadata?.uuid || null;

        await this.renderModalSkeleton();
        await this.loadAndBuildTree();
    }

    async loadAndBuildTree(force = false) {
        this.setLoading(true);

        try {
            const character = this.characters[this.this_chid];
            const characterId = character?.avatar;
            if (!characterId) {
                throw new Error('Character ID not found');
            }

            const treeData = await this.fetchTreeFromGraph(characterId, character?.name || '', force);
            this.applyTreeModel(treeData);
            this.populateRootDropdown();
            this.render();
            this.centerOnActive();
        } catch (err) {
            console.error('[Chat Branches] Error loading tree:', err);
        } finally {
            this.setLoading(false);
        }
    }

    async fetchTreeFromGraph(characterId, characterName, force) {
        if (!this.branchGraphService) {
            throw new Error('Branch graph service is not available');
        }
        return this.branchGraphService.getTreeForCharacter({
            avatarUrl: characterId,
            characterName,
            force,
        });
    }

    applyTreeModel(treeData) {
        const { nodeMap, allTreeRoots } = buildTreeModel(treeData);
        this.nodeMap = nodeMap;
        this.allTreeRoots = allTreeRoots;

        this.currentNode = findCurrentNode(this.nodeMap, this.currentChatUUID, this.currentChatFile);
        if (!this.currentNode && this.nodeMap.size > 0) {
            this.currentNode = this.nodeMap.values().next().value;
        }

        const { currentRootNode, treeRoots } = isolateTreeForNode(this.currentNode, this.allTreeRoots);
        this.currentRootNode = currentRootNode;
        this.treeRoots = treeRoots;

        const activePath = collectExpandedPathIds(this.currentNode);
        activePath.forEach((id) => this.expandedUUIDs.add(id));
    }

    render() {
        const $container = $('#chat_tree_content');
        $container.html(buildTreeMarkup(this));
        if (this.treeRoots.length === 0) {
            return;
        }
        this.refreshLines();
        this.bindEvents();
    }

    renderNodeRecursive(node, level) {
        return renderNodeRecursive(this, node, level);
    }

    drawLines() {
        drawTreeLines(this.layoutVariant);
    }

    refreshLines() {
        this.drawLines();

        if (this.lineRedrawRaf) {
            cancelAnimationFrame(this.lineRedrawRaf);
        }
        if (this.lineRedrawTimer) {
            clearTimeout(this.lineRedrawTimer);
        }

        this.lineRedrawRaf = requestAnimationFrame(() => {
            this.drawLines();
            this.lineRedrawTimer = setTimeout(() => this.drawLines(), 60);
        });
    }

    renderRenameInput(node) {
        return renderRenameInput(node);
    }

    bindEvents() {
        bindTreeEvents(this);
    }

    async waitForActiveChat(chatName, timeoutMs = 3000) {
        const target = normalizeChatName(chatName);
        if (!target) return;

        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
            const active = normalizeChatName(this.characters?.[this.this_chid]?.chat);
            if (active === target) return;
            await new Promise((resolve) => requestAnimationFrame(resolve));
        }
    }

    async swapChat(chatName) {
        this.isSwappingChat = true;

        try {
            await this.openCharacterChat(chatName);
            await this.waitForActiveChat(chatName);

            this.currentChatFile = String(this.characters[this.this_chid]?.chat || chatName);
            this.currentChatUUID = this.chat_metadata?.uuid || null;

            await this.loadAndBuildTree();
            toastr.success('Chat switched successfully');
        } catch (err) {
            console.error('[Chat Branches] Error swapping chat:', err);
            toastr.error('Failed to swap chat');
        } finally {
            this.isSwappingChat = false;
        }
    }

    centerOnActive() {
        const $active = $('.active-node');
        const $container = $('#chat_tree_content');

        if ($active.length && $container.length) {
            const activeOffset = $active.offset();
            const containerOffset = $container.offset();

            $container.scrollTop(
                $container.scrollTop() + (activeOffset.top - containerOffset.top) - ($container.height() / 2) + ($active.height() / 2),
            );
            $container.scrollLeft(
                $container.scrollLeft() + (activeOffset.left - containerOffset.left) - ($container.width() / 2) + ($active.width() / 2),
            );
        }
    }

    expandAllNodes() {
        for (const node of this.nodeMap.values()) {
            if (node.children && node.children.length > 0) {
                this.expandedUUIDs.add(node.id);
            }
        }
        this.render();
        this.refreshLines();
    }

    collapseAllNodes() {
        this.expandedUUIDs.clear();
        this.render();
        this.refreshLines();
    }

    startRename(uuid) {
        startRenameFlow(this, uuid);
    }

    async confirmRename(uuid, newName) {
        await confirmRenameFlow(this, uuid, newName);
    }

    cancelRename() {
        cancelRenameFlow(this);
    }

    populateRootDropdown() {
        populateRoots(this);
    }

    async handleRootChange(rootUUID) {
        await handleRootChangeSelection(this, rootUUID);
    }

    async verifyChatExists(chatName) {
        if (!this.characters[this.this_chid]) {
            return false;
        }

        const character = this.characters[this.this_chid];
        if (character.chat_items && Array.isArray(character.chat_items)) {
            const chatExists = character.chat_items.some((chat) => {
                const chatFile = typeof chat === 'object' ? chat.file : chat;
                return chatFile === chatName;
            });
            if (chatExists) return true;
        }

        try {
            if (this.branchGraphService) {
                const graph = await this.branchGraphService.getGraphForCharacter({
                    avatarUrl: character.avatar,
                    characterName: character.name || '',
                });

                for (const node of graph.nodesById.values()) {
                    if (node.chat_name === chatName) {
                        return true;
                    }
                }
            }
        } catch (error) {
            console.error('[Chat Branches] Error verifying chat existence:', error);
        }

        return false;
    }

    async renderModalSkeleton() {
        $('#chat_tree_overlay').remove();
        ensureTreeStylesLoaded(this.extensionName, this.layoutVariant);

        const html = `
            <div id="chat_tree_overlay">
                <div id="chat_tree_modal">
                    <div id="chat_tree_header">
                        <div class="chat-tree-header-left">
                            <div class="chat-tree-root-selector">
                                <select id="chat_tree_root_dropdown" class="chat-tree-dropdown">
                                    <option value="">Select Root...</option>
                                </select>
                            </div>
                        </div>
                        <div id="chat_tree_close" class="menu_button fa-solid fa-xmark"></div>
                    </div>
                    <div id="chat_tree_content"></div>
                </div>
            </div>
        `;

        $('body').append(html);

        $('#chat_tree_close').on('click', () => this.hide());

        $('#chat_tree_root_dropdown').on('change', (e) => {
            const rootUUID = $(e.target).val();
            if (rootUUID) {
                this.handleRootChange(rootUUID);
            }
        });

        $('#chat_tree_overlay').on('click', (e) => {
            if (e.target.id === 'chat_tree_overlay' && !this.isPanning && !this.wasPanning) {
                this.hide();
            }
            this.wasPanning = false;
        });

        $(window).on('resize.chatTree', () => {
            clearTimeout(this.resizeTimer);
            this.resizeTimer = setTimeout(() => this.refreshLines(), 100);
        });
    }

    setLoading(isLoading) {
        if (isLoading) {
            $('#chat_tree_content').html(loadingMarkup());
        }
    }

    openMessageViewer(node) {
        if (!this.messageViewerPopup) {
            this.messageViewerPopup = new MessageViewerPopup({
                characters: this.characters,
                this_chid: this.this_chid,
                token: this.token,
                openCharacterChat: this.openCharacterChat,
                extensionName: this.extensionName,
                branchGraphService: this.branchGraphService,
                onNavigate: () => this.hide(),
            });
        } else {
            this.messageViewerPopup.updateDependencies({
                characters: this.characters,
                this_chid: this.this_chid,
                token: this.token,
                branchGraphService: this.branchGraphService,
            });
        }

        this.messageViewerPopup.show({
            uuid: node.id || node.uuid,
            name: node.name || node.chat_name,
        }, { anchorElement: document.body });
    }

    hide() {
        $('#chat_tree_overlay').fadeOut(200, function () { $(this).remove(); });
        unbindTreeEvents(this);
        if (this.lineRedrawRaf) {
            cancelAnimationFrame(this.lineRedrawRaf);
            this.lineRedrawRaf = null;
        }
        if (this.lineRedrawTimer) {
            clearTimeout(this.lineRedrawTimer);
            this.lineRedrawTimer = null;
        }
        this.cancelRename();
    }

    bindPanning() {
        bindTreePanning(this);
    }
}

export { TreeViewController as ChatTreeView };
