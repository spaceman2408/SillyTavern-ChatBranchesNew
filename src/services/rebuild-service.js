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

        const progressContent = document.createElement('div');
        progressContent.innerHTML = `
            <h3>Rebuilding Storage</h3>
            <p class="chat-branches-rebuild-progress">Rebuilding plugin storage... 0 chats scanned.</p>
            <p>This popup will close automatically when rebuild is complete.</p>
        `;

        let allowProgressClose = false;
        const progressPopup = new ctx.Popup(
            progressContent,
            ctx.POPUP_TYPE.TEXT,
            null,
            {
                okButton: false,
                cancelButton: false,
                onClosing: () => allowProgressClose,
            },
        );
        const progressPopupPromise = progressPopup.show();

        const updateProgressPopup = ({ scanned, total }) => {
            const progressNode = progressContent.querySelector('.chat-branches-rebuild-progress');
            if (progressNode) {
                progressNode.textContent = `Rebuilding plugin storage... ${scanned}/${total} chats scanned.`;
            }
        };

        this.isRebuilding = true;
        try {
            const result = await this.rebuildForCharacter(character, { onProgress: updateProgressPopup });
            allowProgressClose = true;
            await progressPopup.completeAffirmative();
            await progressPopupPromise;
            await ctx.Popup.show.text(
                'Rebuild Complete',
                `<p>${result.processed} branches rebuilt.</p>`
                + `<p>Skipped: ${result.skippedNoUuid} without UUID metadata, `
                + `${result.skippedCheckpoint} checkpoints, `
                + `${result.skippedInvalidChat} invalid chat files.</p>`
                + '<p>Rebuild uses existing metadata only; chats missing UUID metadata were skipped.</p>',
            );
        } catch (error) {
            allowProgressClose = true;
            await progressPopup.completeAffirmative();
            await progressPopupPromise;
            await ctx.Popup.show.text('Rebuild Failed', `<p>${error.message}</p>`);
        } finally {
            this.isRebuilding = false;
        }
    }

    async rebuildForCharacter(character, options = {}) {
        const onProgress = options?.onProgress;
        const chats = await this.chatService.listCharacterChats(character.avatar);
        let processed = 0;
        let skippedNoUuid = 0;
        let skippedCheckpoint = 0;
        let skippedInvalidChat = 0;
        let scanned = 0;
        const total = chats.length;

        if (typeof onProgress === 'function') {
            onProgress({ scanned, total, processed, skippedNoUuid, skippedCheckpoint, skippedInvalidChat });
        }

        for (const entry of chats) {
            scanned++;
            const chatName = String(entry.file_name || entry.file || '').replace(/\.jsonl$/i, '');
            if (!chatName || isCheckpointChat(chatName)) {
                skippedCheckpoint++;
                if (typeof onProgress === 'function' && (scanned % 25 === 0 || scanned === total)) {
                    onProgress({ scanned, total, processed, skippedNoUuid, skippedCheckpoint, skippedInvalidChat });
                }
                continue;
            }

            const fullChat = await this.chatService.fetchChat(character.name, character.avatar, chatName).catch(() => null);
            const header = Array.isArray(fullChat) && fullChat.length > 0 ? fullChat[0] : null;
            if (!header || typeof header !== 'object') {
                skippedInvalidChat++;
                if (typeof onProgress === 'function' && (scanned % 25 === 0 || scanned === total)) {
                    onProgress({ scanned, total, processed, skippedNoUuid, skippedCheckpoint, skippedInvalidChat });
                }
                continue;
            }
            const metadata = header?.chat_metadata;

            // Strict metadata-only rebuild:
            // - never inject missing UUIDs
            // - never mutate chat metadata during rebuild
            if (!metadata?.uuid) {
                skippedNoUuid++;
                if (typeof onProgress === 'function' && (scanned % 25 === 0 || scanned === total)) {
                    onProgress({ scanned, total, processed, skippedNoUuid, skippedCheckpoint, skippedInvalidChat });
                }
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
            if (typeof onProgress === 'function' && (scanned % 25 === 0 || scanned === total)) {
                onProgress({ scanned, total, processed, skippedNoUuid, skippedCheckpoint, skippedInvalidChat });
            }
        }

        return { processed, skippedNoUuid, skippedCheckpoint, skippedInvalidChat };
    }
}
