import { ctxSnapshot } from '../context.js';
import { isCheckpointChat } from '../utils/checkpoints.js';

export class BranchService {
    constructor({ pluginClient, settingsProvider }) {
        this.pluginClient = pluginClient;
        this.getSettings = settingsProvider;
    }

    isExtensionActive() {
        return Boolean(this.getSettings()?.enabled) && this.pluginClient.store.pluginRunning;
    }

    isCharacterChatContext(snapshot) {
        return !snapshot.groupId && snapshot.characterId !== undefined && snapshot.character;
    }

    async ensureChatUUID() {
        const snapshot = ctxSnapshot();
        if (!this.isCharacterChatContext(snapshot)) return;
        if (!this.getSettings()?.enabled || !snapshot.chatMetadata) return;
        if (isCheckpointChat(snapshot.chatName)) return;

        let isNewChat = false;
        if (!snapshot.chatMetadata.uuid) {
            const characterId = snapshot.character?.avatar || null;
            const chatName = snapshot.chatName || 'Unknown';

            const candidates = await this.pluginClient.queryByChatName(chatName).catch(() => []);
            const existing = candidates.find((branch) => branch.character_id === characterId && branch.chat_name === chatName);
            if (existing) {
                snapshot.chatMetadata.uuid = existing.uuid;
                snapshot.chatMetadata.root_uuid = existing.root_uuid;
                snapshot.chatMetadata.parent_uuid = existing.parent_uuid;
                await snapshot.ctx.saveMetadata();
                return;
            }

            snapshot.chatMetadata.uuid = snapshot.ctx.uuidv4();
            isNewChat = true;
        }

        if (!snapshot.chatMetadata.root_uuid) {
            snapshot.chatMetadata.root_uuid = snapshot.chatMetadata.uuid;
        }

        await snapshot.ctx.saveMetadata();

        if (isNewChat) {
            await this.pluginClient.registerBranch({
                uuid: snapshot.chatMetadata.uuid,
                parent_uuid: snapshot.chatMetadata.parent_uuid || null,
                root_uuid: snapshot.chatMetadata.root_uuid,
                character_id: snapshot.character?.avatar || null,
                chat_name: String(snapshot.chatName || 'Unknown'),
                branch_point: null,
                created_at: Date.now(),
            });
        }
    }

    async syncRename(newName) {
        const snapshot = ctxSnapshot();
        if (!this.isCharacterChatContext(snapshot) || !this.getSettings()?.enabled) return;
        const uuid = snapshot.chatMetadata?.uuid;
        if (!uuid) return;
        await this.pluginClient.updateBranch(uuid, { chat_name: newName });
    }

    async syncChangedChatName() {
        const snapshot = ctxSnapshot();
        if (!this.isCharacterChatContext(snapshot) || !this.getSettings()?.enabled) return;
        if (isCheckpointChat(snapshot.chatName)) return;
        const uuid = snapshot.chatMetadata?.uuid;
        if (!uuid || !snapshot.chatName) return;
        await this.pluginClient.updateBranch(uuid, { chat_name: snapshot.chatName });
    }

    async handleChatDeleted(chatName) {
        const snapshot = ctxSnapshot();
        if (!this.isCharacterChatContext(snapshot) || !this.getSettings()?.enabled) return;
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

    async createBranchWithUUID(mesId) {
        const snapshot = ctxSnapshot();
        if (!this.isCharacterChatContext(snapshot)) return null;

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
        const rootUUID = snapshot.chatMetadata?.root_uuid || snapshot.chatMetadata?.uuid;

        const fullChat = await fetch('/api/chats/get', {
            method: 'POST',
            headers: {
                ...snapshot.ctx.getRequestHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ch_name: snapshot.character?.name,
                file_name: branchName,
                avatar_url: snapshot.character?.avatar,
            }),
        }).then((res) => res.ok ? res.json() : null).catch(() => null);

        if (Array.isArray(fullChat) && fullChat.length > 0) {
            if (!fullChat[0].chat_metadata) fullChat[0].chat_metadata = {};
            fullChat[0].chat_metadata.uuid = newUUID;
            fullChat[0].chat_metadata.parent_uuid = snapshot.chatMetadata?.uuid || null;
            fullChat[0].chat_metadata.root_uuid = rootUUID;
            fullChat[0].chat_metadata.branch_point = mesId;

            await fetch('/api/chats/save', {
                method: 'POST',
                headers: {
                    ...snapshot.ctx.getRequestHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ch_name: snapshot.character?.name,
                    file_name: branchName,
                    avatar_url: snapshot.character?.avatar,
                    chat: fullChat,
                }),
            });
        }

        await this.pluginClient.registerBranch({
            uuid: newUUID,
            parent_uuid: snapshot.chatMetadata?.uuid || null,
            root_uuid: rootUUID,
            character_id: snapshot.character?.avatar || null,
            chat_name: String(branchName),
            branch_point: mesId,
            created_at: Date.now(),
        });

        return branchName;
    }
}
