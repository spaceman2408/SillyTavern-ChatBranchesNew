import { ctxSnapshot } from '../context.js';
import { isCheckpointChat } from '../utils/checkpoints.js';

export class BranchService {
    constructor({ settingsProvider, branchGraphService }) {
        this.getSettings = settingsProvider;
        this.branchGraphService = branchGraphService;
    }

    isExtensionActive() {
        return Boolean(this.getSettings()?.enabled);
    }

    isCharacterChatContext(snapshot) {
        return !snapshot.groupId && snapshot.characterId !== undefined && snapshot.character;
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

    invalidateCharacterGraph(avatar) {
        if (!avatar || !this.branchGraphService) return;
        this.branchGraphService.invalidateCharacter(avatar);
    }

    hasBranchIdentity(metadata) {
        if (!metadata || typeof metadata !== 'object') return false;
        const branchPoint = Number(metadata.branch_point);
        return Boolean(
            metadata.uuid
            || metadata.parent_uuid
            || metadata.root_uuid
            || Number.isFinite(branchPoint),
        );
    }

    async clearCheckpointBranchIdentity(snapshot) {
        if (!snapshot?.chatMetadata || typeof snapshot.chatMetadata !== 'object') return false;
        if (!this.hasBranchIdentity(snapshot.chatMetadata)) return false;

        const contextKey = this.getContextKey(snapshot);
        const avatar = snapshot.character?.avatar || null;

        delete snapshot.chatMetadata.uuid;
        delete snapshot.chatMetadata.parent_uuid;
        delete snapshot.chatMetadata.root_uuid;
        delete snapshot.chatMetadata.branch_point;

        if (!this.isSameContext(contextKey)) return false;
        const current = ctxSnapshot();
        if (!this.isCharacterChatContext(current) || !current.chatMetadata) return false;

        await current.ctx.saveMetadata();
        this.invalidateCharacterGraph(avatar);
        return true;
    }

    async ensureChatUUID() {
        const snapshot = ctxSnapshot();
        if (!this.isCharacterChatContext(snapshot)) return false;
        if (!snapshot.chatMetadata) return false;
        if (!this.isExtensionActive()) return false;
        if (isCheckpointChat(snapshot.chatName, snapshot.chatMetadata)) {
            return this.clearCheckpointBranchIdentity(snapshot);
        }

        const contextKey = this.getContextKey(snapshot);
        const avatar = snapshot.character?.avatar || null;
        let changed = false;

        if (!snapshot.chatMetadata.uuid) {
            snapshot.chatMetadata.uuid = snapshot.ctx.uuidv4();
            changed = true;
        }

        if (!this.isSameContext(contextKey)) return false;
        const current = ctxSnapshot();
        if (!this.isCharacterChatContext(current) || !current.chatMetadata) return false;

        if (!current.chatMetadata.root_uuid) {
            current.chatMetadata.root_uuid = current.chatMetadata.uuid;
            changed = true;
        }

        if (!changed) return false;

        await current.ctx.saveMetadata();
        this.invalidateCharacterGraph(avatar);
        return true;
    }

    async syncRename(_newName) {
        return;
    }

    async syncChangedChatName() {
        return;
    }

    async handleChatDeleted(_chatName) {
        const snapshot = ctxSnapshot();
        if (!this.isCharacterChatContext(snapshot)) return;
        this.invalidateCharacterGraph(snapshot.character?.avatar);
    }

    async handleCharacterDeleted(eventData) {
        const characterId = eventData?.character?.avatar;
        this.invalidateCharacterGraph(characterId);
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

        if (isCheckpointChat(snapshot.chatName, snapshot.chatMetadata)) {
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
            fullChat[0].chat_metadata.root_uuid = rootUUID || newUUID;
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

        this.invalidateCharacterGraph(avatarUrl);
        return branchName;
    }
}
