import { ctxSnapshot } from '../context.js';

export class RebuildService {
    constructor({ branchGraphService, getSettings }) {
        this.branchGraphService = branchGraphService;
        this.getSettings = getSettings;
        this.isRebuilding = false;
    }

    static escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    async showRebuildDialog() {
        if (this.isRebuilding) {
            toastr.warning('Reindex already in progress', 'Chat Branches');
            return;
        }

        const { ctx, groupId, character } = ctxSnapshot();
        if (groupId) {
            toastr.error('Group chats are not supported by this extension', 'Chat Branches');
            return;
        }

        if (!character?.avatar) {
            toastr.error('No character selected', 'Chat Branches');
            return;
        }

        if (!this.getSettings()?.enabled) {
            toastr.info('Enable Chat Branches to reindex cache.', 'Extension Disabled');
            return;
        }

        const confirmed = await ctx.Popup.show.confirm(
            'Reindex Chat Branches Cache',
            '<p>This refreshes in-memory branch relationships from chat file metadata.</p>'
            + '<p>No chat files are modified.</p>'
        );

        if (!confirmed) return;

        this.isRebuilding = true;
        const abortController = new AbortController();
        const rebuildState = {
            running: true,
            finished: false,
            cancelled: false,
        };

        const rebuildPopup = new ctx.Popup(
            `
                <h3>Reindex Chat Branches Cache</h3>
                <p>Reindexing chats for ${RebuildService.escapeHtml(character.name)}...</p>
                <p>Please wait. Press Cancel to close this dialog.</p>
            `,
            ctx.POPUP_TYPE.TEXT,
            null,
            {
                okButton: false,
                cancelButton: 'Cancel',
                onClosing: () => {
                    if (rebuildState.running) {
                        if (rebuildPopup.result === ctx.POPUP_RESULT.CANCELLED) {
                            rebuildState.cancelled = true;
                            abortController.abort();
                            return true;
                        }
                        return false;
                    }

                    if (!rebuildState.finished) {
                        return false;
                    }

                    return rebuildPopup.result === ctx.POPUP_RESULT.AFFIRMATIVE;
                },
            },
        );

        const popupPromise = rebuildPopup.show();

        try {
            this.branchGraphService.invalidateCharacter(character.avatar);
            const graph = await this.branchGraphService.getGraphForCharacter({
                avatarUrl: character.avatar,
                characterName: character.name,
                force: true,
                signal: abortController.signal,
            });

            rebuildState.running = false;
            rebuildState.finished = true;

            if (!rebuildState.cancelled && rebuildPopup.dlg?.isConnected) {
                rebuildPopup.content.innerHTML = `
                    <h3>Reindex Complete</h3>
                    <p>Indexed ${graph.nodesById.size} chats for ${RebuildService.escapeHtml(character.name)}.</p>
                    <p>Press OK to close this dialog.</p>
                `;
                rebuildPopup.okButton.style.display = '';
                rebuildPopup.cancelButton.style.display = 'none';
            }
        } catch (error) {
            rebuildState.running = false;
            rebuildState.finished = true;

            if (rebuildState.cancelled || error?.name === 'AbortError') {
                return;
            }

            if (!rebuildState.cancelled && rebuildPopup.dlg?.isConnected) {
                rebuildPopup.content.innerHTML = `
                    <h3>Reindex Failed</h3>
                    <p>${RebuildService.escapeHtml(error?.message || String(error))}</p>
                    <p>Press OK to close this dialog.</p>
                `;
                rebuildPopup.okButton.style.display = '';
                rebuildPopup.cancelButton.style.display = 'none';
            }
        } finally {
            await popupPromise;
            this.isRebuilding = false;
        }
    }
}
