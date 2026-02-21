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
import { userLog } from '../../utils/user-log.js';

/**
 * Check if a chat is a checkpoint (bookmark)
 * Checkpoints are identified by the pattern 'Checkpoint #' in the chat name
 * @param {string} chatName - The chat name to check
 * @returns {boolean} - True if chat is a checkpoint
 */
function isCheckpointChat(chatName) {
    return chatName && chatName.includes('Checkpoint #');
}

export class TreeViewController {
    constructor(dependencies) {
        this.characters = dependencies.characters;
        this.this_chid = dependencies.this_chid;
        this.token = dependencies.token;
        this.openCharacterChat = dependencies.openCharacterChat;
        this.extensionName = dependencies.extensionName;
        this.pluginBaseUrl = dependencies.pluginBaseUrl;
        this.pluginClient = dependencies.pluginClient;
        this.selected_group = dependencies.selected_group;
        this.chat_metadata = dependencies.chat_metadata;  // Add chat_metadata reference
        this.layoutVariant = dependencies.layoutVariant || 'top-down';

        // State
        this.treeRoots = [];
        this.allTreeRoots = []; // Store all root nodes for dropdown
        this.nodeMap = new Map();
        this.currentChatFile = null;
        this.currentChatUUID = null;
        this.currentRootNode = null; // Track currently selected root
        this.expandedUUIDs = new Set();
        
        // UI State
        this.resizeTimer = null;
        this.lineRedrawTimer = null;
        this.lineRedrawRaf = null;
        this.isPanning = false;
        this.wasPanning = false; // Track if we just finished panning
        this.panStart = { x: 0, y: 0, scrollX: 0, scrollY: 0 };
        this.isSwappingChat = false; // Prevent multiple simultaneous chat swaps
        this.isRenaming = false; // Track rename state
        this.renameNode = null; // Track node being renamed

        // Sub-components
        this.contextMenu = new ContextMenu();
        this.messageViewerPopup = null;
        this.contextMenuNode = null;
        this.renameHandler = new ChatRenameHandler({
            token: this.token,
            pluginBaseUrl: this.pluginBaseUrl,
            characters: this.characters,
            this_chid: this.this_chid
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
        if (dependencies.pluginBaseUrl) {
            this.pluginBaseUrl = dependencies.pluginBaseUrl;
        }
        if (dependencies.pluginClient) {
            this.pluginClient = dependencies.pluginClient;
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

    // =========================================================================
    // DATA LOGIC - NOW USING PLUGIN
    // =========================================================================

    async show() {
        // Skip group chats - this extension only works with character chats
        if (this.selected_group) {
            toastr.warning('Group chats are not supported by this extension.');
            return;
        }

        if (!this.this_chid && this.this_chid !== 0) {
            toastr.warning('No character selected.');
            return;
        }

        // Ensure currentChatFile is always a string
        this.currentChatFile = String(this.characters[this.this_chid]?.chat || '');
        if (!this.currentChatFile) {
            toastr.info('No active chat found.');
            return;
        }

        // Check if current chat is a checkpoint
        if (isCheckpointChat(this.currentChatFile)) {
            toastr.info('You are viewing a checkpoint (bookmark) chat. Checkpoints are not tracked in the branch tree.', 'Chat Branches');
            return;
        }

        // Get current chat UUID from metadata (use global chat_metadata, not character.chat_metadata)
        this.currentChatUUID = this.chat_metadata?.uuid || null;

        await this.renderModalSkeleton();
        await this.loadAndBuildTree();
    }

    async loadAndBuildTree() {
        this.setLoading(true);

        try {
            // Get character ID for plugin query
            const characterId = this.characters[this.this_chid]?.avatar;
            
            if (!characterId) {
                throw new Error('Character ID not found');
            }

            const treeData = await this.fetchTreeFromPlugin(characterId);
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

    async fetchTreeFromPlugin(characterId) {
        if (!this.pluginClient) {
            throw new Error('Plugin client is not available');
        }
        return this.pluginClient.getTree(characterId, { force: true });
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

    // =========================================================================
    // RENDERING LOGIC
    // =========================================================================

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

        // Mobile browsers may settle layout one frame later on incremental expand/collapse.
        this.lineRedrawRaf = requestAnimationFrame(() => {
            this.drawLines();
            this.lineRedrawTimer = setTimeout(() => this.drawLines(), 60);
        });
    }

    renderRenameInput(node) {
        return renderRenameInput(node);
    }

    // =========================================================================
    // INTERACTION & EVENTS
    // =========================================================================

    bindEvents() {
        bindTreeEvents(this);
    }

    async swapChat(chatName) {
        this.isSwappingChat = true;
        
        try {
            await this.openCharacterChat(chatName);
            
            // Wait a moment for SillyTavern to fully load the chat and update chat_metadata
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Update our state from the newly loaded chat
            this.currentChatFile = String(this.characters[this.this_chid]?.chat || chatName);
            this.currentChatUUID = this.chat_metadata?.uuid || null;
            
            userLog.info(
                `Switched to chat "${this.currentChatFile}" (UUID: ${this.currentChatUUID || 'missing'}).`,
                { dedupeKey: `tree-swap:${this.currentChatUUID || this.currentChatFile}`, dedupeMs: 10000 },
            );
            
            await this.loadAndBuildTree();
            
            toastr.success('Chat switched successfully');
        } catch (err) {
            console.error('[Chat Branches] Error swapping chat:', err);
            userLog.error(`Failed to switch chat "${chatName}".`, { toast: true });
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
                $container.scrollTop() + (activeOffset.top - containerOffset.top) - ($container.height() / 2) + ($active.height() / 2)
            );
            $container.scrollLeft(
                $container.scrollLeft() + (activeOffset.left - containerOffset.left) - ($container.width() / 2) + ($active.width() / 2)
            );
        }
    }

    expandAllNodes() {
        // Add all node IDs with children to expanded set
        for (const node of this.nodeMap.values()) {
            if (node.children && node.children.length > 0) {
                this.expandedUUIDs.add(node.id);
            }
        }
        this.render();
        this.refreshLines();
    }

    collapseAllNodes() {
        // Clear all expanded nodes
        this.expandedUUIDs.clear();
        this.render();
        this.refreshLines();
    }

    // =========================================================================
    // RENAME FUNCTIONALITY
    // =========================================================================

    startRename(uuid) {
        startRenameFlow(this, uuid);
    }

    async confirmRename(uuid, newName) {
        await confirmRenameFlow(this, uuid, newName);
    }

    cancelRename() {
        cancelRenameFlow(this);
    }

    // =========================================================================
    // ROOT DROPDOWN FUNCTIONALITY
    // =========================================================================

    populateRootDropdown() {
        populateRoots(this);
    }

    async handleRootChange(rootUUID) {
        await handleRootChangeSelection(this, rootUUID);
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================

    /**
     * Verify if a chat exists for the current character
     * @param {string} chatName - The chat name to verify
     * @returns {Promise<boolean>} - True if the chat exists
     */
    async verifyChatExists(chatName) {
        if (!this.characters[this.this_chid]) {
            return false;
        }

        // Check the character's chat list
        const character = this.characters[this.this_chid];
        
        // Method 1: Check if chat is in the character's chat_items array
        if (character.chat_items && Array.isArray(character.chat_items)) {
            const chatExists = character.chat_items.some(chat => {
                // Chat items can be strings or objects with a file property
                const chatFile = typeof chat === 'object' ? chat.file : chat;
                return chatFile === chatName;
            });
            if (chatExists) return true;
        }

        // Method 2: Check via plugin tree service (more reliable)
        try {
            if (this.pluginClient) {
                const characterId = character.avatar;
                const tree = await this.pluginClient.getTree(characterId, { force: true });
                const findChatInTree = (nodes) => {
                    for (const node of nodes) {
                        if (node.chat_name === chatName) {
                            return true;
                        }
                        if (node.children && node.children.length > 0) {
                            if (findChatInTree(node.children)) {
                                return true;
                            }
                        }
                    }
                    return false;
                };
                return findChatInTree(tree || []);
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
        
        // Bind dropdown change event
        $('#chat_tree_root_dropdown').on('change', (e) => {
            const rootUUID = $(e.target).val();
            if (rootUUID) {
                this.handleRootChange(rootUUID);
            }
        });
        
        $('#chat_tree_overlay').on('click', (e) => {
            // Only close if clicking directly on overlay (not when panning or just finished panning)
            if(e.target.id === 'chat_tree_overlay' && !this.isPanning && !this.wasPanning) {
                this.hide();
            }
            // Reset the wasPanning flag after checking
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
                pluginBaseUrl: this.pluginBaseUrl,
                onNavigate: () => this.hide()
            });
        } else {
            // Update dependencies with fresh character data
            this.messageViewerPopup.updateDependencies({
                characters: this.characters,
                this_chid: this.this_chid,
                token: this.token,
                pluginBaseUrl: this.pluginBaseUrl
            });
        }
        // FIX: Attach to document.body so it floats above the tree modal
        // instead of being trapped inside it.
        this.messageViewerPopup.show({
            uuid: node.id || node.uuid,
            name: node.name || node.chat_name
        }, { anchorElement: document.body });
    }

    hide() {
        $('#chat_tree_overlay').fadeOut(200, function() { $(this).remove(); });
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

    // =========================================================================
    // PANNING FUNCTIONALITY
    // =========================================================================

    bindPanning() {
        bindTreePanning(this);
    }
}

export { TreeViewController as ChatTreeView };
