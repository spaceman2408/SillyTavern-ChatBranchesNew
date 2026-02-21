import { EXTENSION_NAME } from '../constants.js';

export class SettingsPanel {
    constructor({ getSettings, onToggleEnabled, onRebuild, onLayoutChange }) {
        this.getSettings = getSettings;
        this.onToggleEnabled = onToggleEnabled;
        this.onRebuild = onRebuild;
        this.onLayoutChange = onLayoutChange;
    }

    async mount() {
        const response = await fetch(`/scripts/extensions/third-party/${EXTENSION_NAME}New/index.html`);
        if (!response.ok) return;
        const html = await response.text();
        if (!$('#chat_branches_enabled').length) {
            $('#extensions_settings').append(html);
        }

        const settings = this.getSettings();
        $('#chat_branches_enabled').prop('checked', Boolean(settings.enabled));
        $('#chat_branches_tree_layout').val(settings.ui?.treeLayout || 'top-down');

        $(document).off('input.chatBranchesSettings', '#chat_branches_enabled');
        $(document).on('input.chatBranchesSettings', '#chat_branches_enabled', async (event) => {
            const enabled = Boolean($(event.currentTarget).prop('checked'));
            await this.onToggleEnabled(enabled);
            this.refresh();
        });

        $(document).off('click.chatBranchesRebuild', '#chat_branches_rebuild');
        $(document).on('click.chatBranchesRebuild', '#chat_branches_rebuild', () => {
            if (!this.getSettings()?.enabled) {
                toastr.info('Enable Chat Branches to reindex cache.', 'Extension Disabled');
                return;
            }
            this.onRebuild();
        });

        $(document).off('change.chatBranchesLayout', '#chat_branches_tree_layout');
        $(document).on('change.chatBranchesLayout', '#chat_branches_tree_layout', async (event) => {
            if (!this.getSettings()?.enabled) return;
            const layout = String($(event.currentTarget).val() || 'top-down');
            await this.onLayoutChange(layout);
        });

        this.refresh();
    }

    refresh() {
        const settings = this.getSettings();
        const isEnabled = Boolean(settings.enabled);
        $('#chat_branches_enabled').prop('checked', isEnabled);
        $('#chat_branches_tree_layout').val(settings.ui?.treeLayout || 'top-down');

        const rebuildButton = $('#chat_branches_rebuild');
        const layoutSelect = $('#chat_branches_tree_layout');

        if (!isEnabled) {
            layoutSelect
                .prop('disabled', true)
                .attr('title', 'Enable Chat Branches to change tree layout');
            rebuildButton
                .addClass('disabled')
                .attr('aria-disabled', 'true')
                .attr('title', 'Enable Chat Branches to reindex cache')
                .attr('data-disabled-title', 'Extension disabled');
        } else {
            layoutSelect
                .prop('disabled', false)
                .attr('title', 'Select how branch nodes are arranged in the tree viewer.');
            rebuildButton
                .removeClass('disabled')
                .attr('aria-disabled', 'false')
                .attr('title', 'Reindex cache from chat metadata')
                .removeAttr('data-disabled-title');
        }
    }
}
