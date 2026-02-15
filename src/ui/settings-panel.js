import { EXTENSION_NAME, PLUGIN_REPO_URL } from '../constants.js';
import { ctxSnapshot } from '../context.js';

export class SettingsPanel {
    constructor({ getSettings, onToggleEnabled, onRebuild, pluginClient, store }) {
        this.getSettings = getSettings;
        this.onToggleEnabled = onToggleEnabled;
        this.onRebuild = onRebuild;
        this.pluginClient = pluginClient;
        this.store = store;
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

        $(document).off('input.chatBranchesSettings', '#chat_branches_enabled');
        $(document).on('input.chatBranchesSettings', '#chat_branches_enabled', async (event) => {
            const enabled = Boolean($(event.currentTarget).prop('checked'));
            if (enabled && !this.store.pluginRunning) {
                toastr.error('Cannot enable extension: plugin is not running.', 'Plugin Error');
                $(event.currentTarget).prop('checked', false);
                return;
            }
            await this.onToggleEnabled(enabled);
            this.refresh();
        });

        $(document).off('click.chatBranchesRebuild', '#chat_branches_rebuild');
        $(document).on('click.chatBranchesRebuild', '#chat_branches_rebuild', () => this.onRebuild());

        $(document).off('click.chatBranchesInstall', '#chat_branches_install_plugin');
        $(document).on('click.chatBranchesInstall', '#chat_branches_install_plugin', () => this.showInstallPopup());

        this.refresh();
    }

    refresh() {
        const settings = this.getSettings();
        $('#chat_branches_enabled').prop('checked', Boolean(settings.enabled));

        if (!this.store.pluginRunning) {
            $('#chat_branches_enabled').prop('disabled', true);
            $('#chat_branches_plugin_missing_section').show();
        } else {
            $('#chat_branches_enabled').prop('disabled', false);
            $('#chat_branches_plugin_missing_section').hide();
        }
    }

    async showInstallPopup() {
        const { ctx } = ctxSnapshot();
        const dom = document.createElement('div');
        dom.classList.add('chat-branches--askInstall');
        dom.innerHTML = `<h3>Chat Branches - Missing Plugin</h3>
            <div>You need to install the Chat Branches server plugin and restart your server:</div>
            <ul><li><a target="_blank" href="${PLUGIN_REPO_URL}">${PLUGIN_REPO_URL}</a></li></ul>`;
        const popup = new ctx.Popup(dom, ctx.POPUP_TYPE.TEXT, null, { okButton: 'Close' });
        await popup.show();
    }
}