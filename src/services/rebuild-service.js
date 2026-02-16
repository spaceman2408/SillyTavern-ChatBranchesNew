import { ctxSnapshot } from '../context.js';
import { isCheckpointChat } from '../utils/checkpoints.js';

export class RebuildService {
    constructor({ pluginClient, chatService, getSettings }) {
        this.pluginClient = pluginClient;
        this.chatService = chatService;
        this.getSettings = getSettings;
        this.isRebuilding = false;
    }

    async showRebuildDialog() {
        if (this.isRebuilding) {
            toastr.warning('Rebuild already in progress', 'Storage Rebuild');
            return;
        }

        const { ctx, groupId, character } = ctxSnapshot();
        if (groupId) {
            toastr.error('Group chats are not supported by this extension', 'Storage Rebuild');
            return;
        }
        if (!character) {
            toastr.error('No character selected', 'Storage Rebuild');
            return;
        }

        const confirmed = await ctx.Popup.show.confirm(
            'Rebuild Storage',
            '<p>This rebuilds plugin storage from chats that already contain metadata UUIDs.</p>'
            + '<p>It does not modify chat files and does not generate missing UUIDs.</p>'
        );

        if (!confirmed) return;

        this.isRebuilding = true;
        try {
            const result = await this.rebuildForCharacter(character);
            await ctx.Popup.show.text(
                'Rebuild Complete',
                `<p>${result.processed} branches rebuilt.</p>`
                + `<p>Skipped: ${result.skippedNoUuid} without UUID metadata, `
                + `${result.skippedCheckpoint} checkpoints, `
                + `${result.skippedInvalidChat} invalid chat files.</p>`
                + '<p>Rebuild uses existing metadata only; chats missing UUID metadata were skipped.</p>',
            );
        } catch (error) {
            await ctx.Popup.show.text('Rebuild Failed', `<p>${error.message}</p>`);
        } finally {
            this.isRebuilding = false;
        }
    }

    async rebuildForCharacter(character) {
        const chats = await this.chatService.listCharacterChats(character.avatar);
        let processed = 0;
        let skippedNoUuid = 0;
        let skippedCheckpoint = 0;
        let skippedInvalidChat = 0;

        for (const entry of chats) {
            const chatName = String(entry.file_name || entry.file || '').replace(/\.jsonl$/i, '');
            if (!chatName || isCheckpointChat(chatName)) {
                skippedCheckpoint++;
                continue;
            }

            const fullChat = await this.chatService.fetchChat(character.name, character.avatar, chatName).catch(() => null);
            const header = Array.isArray(fullChat) && fullChat.length > 0 ? fullChat[0] : null;
            if (!header || typeof header !== 'object') {
                skippedInvalidChat++;
                continue;
            }
            const metadata = header?.chat_metadata;

            // Strict metadata-only rebuild:
            // - never inject missing UUIDs
            // - never mutate chat metadata during rebuild
            if (!metadata?.uuid) {
                skippedNoUuid++;
                continue;
            }

            await this.pluginClient.registerBranch({
                uuid: metadata.uuid,
                parent_uuid: metadata.parent_uuid || null,
                root_uuid: metadata.root_uuid || metadata.uuid,
                character_id: character.avatar,
                chat_name: chatName,
                branch_point: metadata.branch_point ?? null,
                created_at: entry.create_date || Date.now(),
            });
            processed++;
        }

        return { processed, skippedNoUuid, skippedCheckpoint, skippedInvalidChat };
    }
}
