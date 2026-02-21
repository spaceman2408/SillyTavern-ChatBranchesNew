import { ctxSnapshot } from '../context.js';
import { debounce } from '../utils/async.js';

export class ButtonManager {
    constructor({ getSettings, onOpenTreeView, onCreateBranch }) {
        this.getSettings = getSettings;
        this.onOpenTreeView = onOpenTreeView;
        this.onCreateBranch = onCreateBranch;
        this.refreshMessageButtonsDebounced = debounce(() => this.injectMessageButtons(), 100);
    }

    bind() {
        $(document).off('click.chatBranchesTreeMenu', '#option_chat_tree_view');
        $(document).on('click.chatBranchesTreeMenu', '#option_chat_tree_view', async () => {
            $('#options').hide();
            $('#options_button').removeClass('active');
            await this.onOpenTreeView();
        });

        $(document).off('click.chatBranchesTreeButton', '.mes_chat_tree_view');
        $(document).on('click.chatBranchesTreeButton', '.mes_chat_tree_view', async () => {
            await this.onOpenTreeView();
        });

        $(document).off('click.chatBranchesCreateBranch', '.mes_create_branch');
        $(document).on('click.chatBranchesCreateBranch', '.mes_create_branch', async (event) => {
            const mesId = Number($(event.currentTarget).closest('.mes').attr('mesid'));
            if (Number.isNaN(mesId)) return;

            const { ctx, groupId } = ctxSnapshot();
            if (groupId || !this.getSettings().enabled) {
                const { branchChat } = await import('../../../../../bookmarks.js');
                await branchChat(mesId);
                return;
            }

            const name = await this.onCreateBranch(mesId);
            if (name) await ctx.openCharacterChat(name);
        });

        $(document).off('click.chatBranchesOptionsButton', '#options_button');
        $(document).on('click.chatBranchesOptionsButton', '#options_button', () => {
            this.injectOptionsButton();
        });

        this.injectOptionsButton();
        this.injectMessageButtons();
    }

    isActive() {
        return Boolean(this.getSettings().enabled);
    }

    injectOptionsButton() {
        if (!this.isActive()) {
            $('#option_chat_tree_view').remove();
            return;
        }

        if ($('#option_chat_tree_view').length > 0) return;
        const html = '<a id="option_chat_tree_view"><i class="fa-lg fa-solid fa-sitemap"></i><span>Chat Branches</span></a>';
        const anchor = $('#option_select_chat');
        if (anchor.length > 0) anchor.after(html);
    }

    injectMessageButtons() {
        if (!this.isActive()) {
            $('.mes_chat_tree_view').remove();
            return;
        }

        $('.mes_buttons').each((_, el) => {
            const container = $(el);
            if (container.find('.mes_chat_tree_view').length > 0) return;
            const createBranch = container.find('.mes_create_branch');
            if (!createBranch.length) return;
            createBranch.before('<div title="Chat Branches" class="mes_button mes_chat_tree_view fa-solid fa-sitemap interactable" data-i18n="[title]Chat Branches" tabindex="0" role="button"></div>');
        });
    }

    onMessageEvent() {
        this.refreshMessageButtonsDebounced();
    }
}
