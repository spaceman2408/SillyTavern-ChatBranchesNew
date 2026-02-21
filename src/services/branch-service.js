import { ctxSnapshot } from '../context.js';
import { isCheckpointChat } from '../utils/checkpoints.js';

export class BranchService {
    constructor({ pluginClient, settingsProvider }) {
        this.pluginClient = pluginClient;
        this.getSettings = settingsProvider;
        this.lastMissingPluginToastAt = 0;
    }

    isExtensionActive() {
        return Boolean(this.getSettings()?.enabled) && this.pluginClient.store.pluginRunning;
    }

    isCharacterChatContext(snapshot) {
        return !snapshot.groupId && snapshot.characterId !== undefined && snapshot.character;
    }

    maybeNotifyMissingPlugin() {
        if (!this.getSettings()?.enabled || this.pluginClient.store.pluginRunning) return;
        const now = Date.now();
        const cooldownMs = 10000;
        if (now - this.lastMissingPluginToastAt < cooldownMs) return;
        this.lastMissingPluginToastAt = now;
        const message = "Chat Branches can't find the plugin, did you install it? Install and try again.";
        console.warn(`[ChatBranches] ${message}`);
        toastr.warning(
            message,
            'Plugin Not Found',
        );
    }

    getContextKey(snapshot) {
        return {
            groupId: snapshot.groupId ?? null,
            characterId: snapshot.characterId ?? null,
            chatId: snapshot.chatId ?? null,
        };
    }

    isSameContext(key) {
        const current = ctxSnapshot();
        return (
            (current.groupId ?? null) === key.groupId &&
            (current.characterId ?? null) === key.characterId &&
            (current.chatId ?? null) === key.chatId
        );
    }

    async ensureChatUUID() {
        const snapshot = ctxSnapshot();
        if (!this.isCharacterChatContext(snapshot)) return;
        if (!snapshot.chatMetadata) return;
        if (!this.isExtensionActive()) {
            this.maybeNotifyMissingPlugin();
            return;
        }
        if (isCheckpointChat(snapshot.chatName)) return;
        const contextKey = this.getContextKey(snapshot);
        const characterId = snapshot.character?.avatar || null;
        const chatName = snapshot.chatName || 'Unknown';

        let isNewChat = false;
        if (!snapshot.chatMetadata.uuid) {
            const candidates = await this.pluginClient.queryByChatName(chatName).catch(() => []);
            if (!this.isSameContext(contextKey)) return;

            const current = ctxSnapshot();
            if (!this.isCharacterChatContext(current) || !current.chatMetadata) return;
            const existing = candidates.find((branch) => branch.character_id === characterId && branch.chat_name === chatName);
            if (existing) {
                current.chatMetadata.uuid = existing.uuid;
                current.chatMetadata.root_uuid = existing.root_uuid;
                current.chatMetadata.parent_uuid = existing.parent_uuid;
                await current.ctx.saveMetadata();
                return;
            }

            current.chatMetadata.uuid = current.ctx.uuidv4();
            isNewChat = true;
        }

        if (!this.isSameContext(contextKey)) return;
        const current = ctxSnapshot();
        if (!this.isCharacterChatContext(current) || !current.chatMetadata) return;

        if (!current.chatMetadata.root_uuid) {
            current.chatMetadata.root_uuid = current.chatMetadata.uuid;
        }

        await current.ctx.saveMetadata();

        if (isNewChat) {
            await this.pluginClient.registerBranch({
                uuid: current.chatMetadata.uuid,
                parent_uuid: current.chatMetadata.parent_uuid || null,
                root_uuid: current.chatMetadata.root_uuid,
                character_id: current.character?.avatar || null,
                chat_name: String(current.chatName || 'Unknown'),
                branch_point: null,
                created_at: Date.now(),
            });
        }
    }

    async syncRename(newName) {
        const snapshot = ctxSnapshot();
        if (!this.isCharacterChatContext(snapshot) || !this.isExtensionActive()) return;
        const uuid = snapshot.chatMetadata?.uuid;
        if (!uuid) return;
        await this.pluginClient.updateBranch(uuid, { chat_name: newName });
    }

    async syncChangedChatName() {
        const snapshot = ctxSnapshot();
        if (!this.isCharacterChatContext(snapshot) || !this.isExtensionActive()) return;
        if (isCheckpointChat(snapshot.chatName)) return;
        const uuid = snapshot.chatMetadata?.uuid;
        if (!uuid || !snapshot.chatName) return;
        await this.pluginClient.updateBranch(uuid, { chat_name: snapshot.chatName });
    }

    async handleChatDeleted(chatName) {
        const snapshot = ctxSnapshot();
        if (!this.isCharacterChatContext(snapshot) || !this.isExtensionActive()) return;
        const characterId = snapshot.character?.avatar;
        if (!characterId || !chatName) return;

        const tree = await this.pluginClient.getTree(characterId, { force: true }).catch(() => []);
        const stack = [...tree];
        while (stack.length) {
            const node = stack.pop();
            if (node.chat_name === chatName) {
                await this.pluginClient.deleteBranch(node.uuid, true);
                return;
            }
            if (Array.isArray(node.children)) stack.push(...node.children);
        }
    }

    async handleCharacterDeleted(eventData) {
        const characterId = eventData?.character?.avatar;
        if (!characterId) return;
        await this.pluginClient.deleteCharacter(characterId);
    }

    async handleCharacterRenamed(oldAvatar, newAvatar) {
        if (!oldAvatar || !newAvatar || oldAvatar === newAvatar) return;
        if (!this.isExtensionActive()) {
            this.maybeNotifyMissingPlugin();
            return;
        }

        const tree = await this.pluginClient.getTree(oldAvatar, { force: true }).catch(() => []);
        if (!Array.isArray(tree) || tree.length === 0) return;

        const stack = [...tree];
        while (stack.length) {
            const node = stack.pop();
            const uuid = node?.uuid;
            if (uuid) {
                await this.pluginClient.updateBranch(uuid, { character_id: newAvatar }).catch((error) => {
                    console.warn('[ChatBranches] Failed to sync character rename for branch', uuid, error);
                });
            }

            if (Array.isArray(node?.children) && node.children.length > 0) {
                stack.push(...node.children);
            }
        }
    }

    async createBranchWithUUID(mesId) {
        const snapshot = ctxSnapshot();
        if (!this.isCharacterChatContext(snapshot) || !this.isExtensionActive()) return null;
        const contextKey = this.getContextKey(snapshot);
        const characterName = snapshot.character?.name;
        const avatarUrl = snapshot.character?.avatar;
        const parentUUID = snapshot.chatMetadata?.uuid || null;
        const rootUUID = snapshot.chatMetadata?.root_uuid || parentUUID;

        const chat = snapshot.chat || [];
        if (!chat.length || mesId < 0 || mesId >= chat.length) {
            toastr.warning('Invalid message ID.', 'Branch creation failed');
            return null;
        }

        if (isCheckpointChat(snapshot.chatName)) {
            toastr.info('Cannot create branches from checkpoint chats.', 'Chat Branches');
            return null;
        }

        const { createBranch } = await import('../../../../../bookmarks.js');
        const branchName = await createBranch(mesId);
        if (!branchName) return null;

        const newUUID = snapshot.ctx.uuidv4();
        if (!this.isSameContext(contextKey)) return branchName;

        const fullChat = await fetch('/api/chats/get', {
            method: 'POST',
            headers: {
                ...snapshot.ctx.getRequestHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ch_name: characterName,
                file_name: branchName,
                avatar_url: avatarUrl,
            }),
        }).then((res) => res.ok ? res.json() : null).catch(() => null);

        if (Array.isArray(fullChat) && fullChat.length > 0) {
            if (!fullChat[0].chat_metadata) fullChat[0].chat_metadata = {};
            fullChat[0].chat_metadata.uuid = newUUID;
            fullChat[0].chat_metadata.parent_uuid = parentUUID;
            fullChat[0].chat_metadata.root_uuid = rootUUID;
            fullChat[0].chat_metadata.branch_point = mesId;

            await fetch('/api/chats/save', {
                method: 'POST',
                headers: {
                    ...snapshot.ctx.getRequestHeaders(),
                'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ch_name: characterName,
                    file_name: branchName,
                    avatar_url: avatarUrl,
                    chat: fullChat,
                }),
            });
        }

        await this.pluginClient.registerBranch({
            uuid: newUUID,
            parent_uuid: parentUUID,
            root_uuid: rootUUID,
            character_id: avatarUrl || null,
            chat_name: String(branchName),
            branch_point: mesId,
            created_at: Date.now(),
        });

        return branchName;
    }
}
