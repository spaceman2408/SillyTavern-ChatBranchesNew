import { ctxSnapshot } from '../context.js';

export class RebuildService {
    constructor({ branchGraphService, getSettings }) {
        this.branchGraphService = branchGraphService;
        this.getSettings = getSettings;
        this.isRebuilding = false;
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
        try {
            this.branchGraphService.invalidateCharacter(character.avatar);
            const graph = await this.branchGraphService.getGraphForCharacter({
                avatarUrl: character.avatar,
                characterName: character.name,
                force: true,
            });

            await ctx.Popup.show.text(
                'Reindex Complete',
                `<p>Indexed ${graph.nodesById.size} chats for ${character.name}.</p>`,
            );
        } catch (error) {
            await ctx.Popup.show.text('Reindex Failed', `<p>${error.message}</p>`);
        } finally {
            this.isRebuilding = false;
        }
    }
}
