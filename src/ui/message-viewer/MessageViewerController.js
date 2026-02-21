/**
 * MessageViewerPopup - Displays chat messages from a selected branch
 */
export class MessageViewerController {
    constructor(dependencies) {
        this.deps = dependencies;
        this.token = dependencies.token;

        this.state = {
            chatName: null,
            chatUUID: null,
            messages: [],
            isLoading: false,
            isDestroyed: false,
            swipeIndices: new Map(),
            expandedMessages: new Set(),
        };

        this.$element = null;
        this.$overlay = null;

        this._handleGlobalEvents = this._handleGlobalEvents.bind(this);
    }

    updateDependencies(newDeps) {
        if (this.state.isDestroyed) return;
        this.deps = { ...this.deps, ...newDeps };
        if (newDeps.token) this.token = newDeps.token;
    }

    async show(chatData, options = {}) {
        if (this.state.isDestroyed) return;

        this.state.chatUUID = chatData?.uuid || null;
        this.state.chatName = chatData?.name || chatData?.chat_name || null;
        this.state.messages = [];
        this.state.swipeIndices.clear();
        this.state.expandedMessages.clear();

        try {
            await this._ensureDom();
            this._bindEvents();
            await this._loadMessages();
        } catch (error) {
            console.error('[Chat Branches][Message Viewer] Show error:', error);
            this._renderError(error.message);
        }
    }

    hide() {
        this._unbindEvents();
        if (this.$overlay) {
            this.$overlay.removeClass('visible');
            setTimeout(() => {
                this.$overlay?.remove();
                this.$overlay = null;
            });
        }

        this.state.messages = [];
        this.state.swipeIndices.clear();
        this.state.expandedMessages.clear();
        this.state.chatName = null;
        this.state.chatUUID = null;
    }

    destroy() {
        this.state.isDestroyed = true;
        this.hide();
        this.deps = null;
    }

    async _loadMessages() {
        this.state.isLoading = true;
        this._renderLoading();

        try {
            const character = this.deps.characters[this.deps.this_chid];
            if (!character) throw new Error('Character not loaded');

            const resolvedChatName = await this._resolveChatName(character);
            if (!resolvedChatName) {
                throw new Error('Unable to resolve chat name for this node');
            }

            this.state.chatName = resolvedChatName;
            this._updateTitle();

            const rawData = await this._fetchChatData(character, this.state.chatName);
            this.state.messages = this._processRawMessages(rawData);
            this._renderList();
        } catch (error) {
            console.error('[Chat Branches][Message Viewer] Load failed:', error);
            this._renderError(error.message);
        } finally {
            this.state.isLoading = false;
        }
    }

    async _resolveChatName(character) {
        if (this.state.chatName) {
            return this.state.chatName;
        }

        if (!this.state.chatUUID || !this.deps.branchGraphService) {
            return null;
        }

        const node = await this.deps.branchGraphService.getNodeByUuid({
            avatarUrl: character.avatar,
            characterName: character.name,
            uuid: this.state.chatUUID,
        });

        return node?.chat_name || null;
    }

    async _fetchChatData(character, chatName) {
        const payload = {
            ch_name: character.name,
            file_name: chatName,
            avatar_url: character.avatar,
        };

        let data = await this._fetchApi('/api/chats/get', payload);
        if (!data || (Array.isArray(data) && data.length === 0)) {
            payload.file_name = `${chatName}.jsonl`;
            data = await this._fetchApi('/api/chats/get', payload);
        }

        if (!data) throw new Error('Could not load chat data');
        return data;
    }

    async _fetchApi(url, body) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': this.token },
                body: JSON.stringify(body),
            });
            if (!res.ok) return null;
            return await res.json();
        } catch {
            return null;
        }
    }

    _processRawMessages(data) {
        if (!data) return [];
        const list = Array.isArray(data) ? data : (data.messages || Object.values(data));

        return list
            .filter((entry) => entry && (entry.mes !== undefined || entry.name || entry.is_user))
            .map((entry, idx) => {
                const swipes = Array.isArray(entry.swipes) ? entry.swipes : [entry.mes];
                const swipeId = entry.swipe_id || 0;

                this.state.swipeIndices.set(idx, swipeId);

                return {
                    id: idx,
                    sender: entry.name || 'Unknown',
                    content: entry.mes || '',
                    timestamp: MessageViewerController.formatTimestamp(entry.send_date),
                    isUser: !!entry.is_user,
                    isSystem: !!entry.is_system,
                    swipes,
                    swipeCount: swipes.length,
                };
            });
    }

    async _ensureDom() {
        $('#message_viewer_overlay').remove();

        if (!$('#message-viewer-styles').length) {
            const cssPath = `/scripts/extensions/third-party/${this.deps.extensionName}/src/css/message-viewer-popup.css`;
            $('head').append(`<link id="message-viewer-styles" rel="stylesheet" href="${cssPath}">`);
        }

        const html = `
            <div id="message_viewer_overlay" class="message-viewer-overlay">
                <div class="message-viewer-popup">
                    <div class="message-viewer-header">
                        <h3 id="message_viewer_title"><i class="fa-solid fa-comments"></i> <span>Loading...</span></h3>
                        <button id="message_viewer_close" class="message-viewer-btn"><i class="fa-solid fa-times"></i></button>
                    </div>
                    <div id="message_viewer_content" class="message-viewer-content"></div>
                </div>
            </div>`;

        $('body').append(html);
        this.$overlay = $('#message_viewer_overlay');
        setTimeout(() => this.$overlay.addClass('visible'), 10);
    }

    _renderLoading() {
        $('#message_viewer_content').html(`
            <div class="message-viewer-loading">
                <i class="fa-solid fa-spinner fa-spin"></i> <div>Loading messages...</div>
            </div>`);
    }

    _renderError(msg) {
        $('#message_viewer_content').html(`
            <div class="message-viewer-error">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <div>${MessageViewerController.escapeHtml(msg)}</div>
                <button id="message_viewer_retry" class="message-viewer-btn">Retry</button>
            </div>`);
        $('#message_viewer_retry').on('click', () => this._loadMessages());
    }

    _renderList() {
        if (!this.state.messages.length) {
            $('#message_viewer_content').html('<div class="message-viewer-empty"><i class="fa-solid fa-inbox"></i> No messages</div>');
            return;
        }

        const html = this.state.messages.map((msg) => this._buildMessageHtml(msg)).join('');
        $('#message_viewer_content').html(`<div class="message-viewer-list">${html}</div>`);
    }

    _buildMessageHtml(msg) {
        const currentIndex = this.state.swipeIndices.get(msg.id) || 0;
        const currentContent = String(msg.swipes[currentIndex] || msg.content);

        const isExpanded = this.state.expandedMessages.has(msg.id);
        const shouldTruncate = !isExpanded && currentContent.length > 500;
        const displayContent = shouldTruncate ? currentContent.substring(0, 500) + '...' : currentContent;

        const typeClass = msg.isUser ? 'user-message' : (msg.isSystem ? 'system-message' : 'assistant-message');

        const expandBtn = shouldTruncate
            ? `<button class="expand-message-btn" data-id="${msg.id}"><i class="fa-solid fa-expand"></i> Expand</button>`
            : '';

        const swipeControls = (msg.swipeCount > 1 && !msg.isUser)
            ? `
            <div class="swipe-controls">
                <button class="swipe-arrow prev" data-id="${msg.id}" ${currentIndex === 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>
                <span class="swipe-counter">${currentIndex + 1}/${msg.swipeCount}</span>
                <button class="swipe-arrow next" data-id="${msg.id}" ${currentIndex === msg.swipeCount - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>
            </div>`
            : '';

        return `
            <div class="message-viewer-item ${typeClass}" data-id="${msg.id}">
                <div class="message-header">
                    <span class="message-sender">${MessageViewerController.escapeHtml(msg.sender)}</span>
                    <span class="message-timestamp">${msg.timestamp}</span>
                </div>
                <div class="message-content ${shouldTruncate ? 'truncated' : ''}">${MessageViewerController.escapeHtml(displayContent)}</div>
                ${expandBtn} ${swipeControls}
            </div>`;
    }

    _updateTitle() {
        const name = this.state.chatName || 'Messages';
        $('#message_viewer_title span').text(name.length > 40 ? name.substring(0, 40) + '...' : name);
    }

    _bindEvents() {
        $('#message_viewer_close').on('click', () => this.hide());

        const $content = $('#message_viewer_content');
        $content.on('click', (e) => {
            const target = $(e.target);

            const swipeBtn = target.closest('.swipe-arrow');
            if (swipeBtn.length) {
                e.stopPropagation();
                this._handleSwipe(parseInt(swipeBtn.data('id')), swipeBtn.hasClass('prev') ? -1 : 1);
                return;
            }

            const expandBtn = target.closest('.expand-message-btn');
            if (expandBtn.length) {
                e.stopPropagation();
                this._handleExpand(parseInt(expandBtn.data('id')));
                return;
            }

            const item = target.closest('.message-viewer-item');
            if (item.length && !target.closest('.swipe-controls').length) {
                this._navigateToMessage(parseInt(item.data('id')));
            }
        });

        $(document).on('keydown.mv', this._handleGlobalEvents);

        setTimeout(() => {
            if (!this.state.isDestroyed && this.$overlay) {
                $(document).on('click.mv', this._handleGlobalEvents);
            }
        }, 100);
    }

    _unbindEvents() {
        $('#message_viewer_close, #message_viewer_content').off();
        $(document).off('.mv');
        $(window).off('.mv');
    }

    _handleGlobalEvents(e) {
        if (e.type === 'keydown' && e.key === 'Escape') this.hide();
        if (e.type === 'click' && !$(e.target).closest('.message-viewer-popup, #chat_tree_modal').length) this.hide();
    }

    _handleSwipe(id, dir) {
        const msg = this.state.messages[id];
        if (!msg) return;

        const current = this.state.swipeIndices.get(id) || 0;
        const next = current + dir;

        if (next >= 0 && next < msg.swipes.length) {
            this.state.swipeIndices.set(id, next);
            $(`.message-viewer-item[data-id="${id}"]`).replaceWith(this._buildMessageHtml(msg));
        }
    }

    _handleExpand(id) {
        this.state.expandedMessages.add(id);
        const msg = this.state.messages[id];
        if (msg) {
            $(`.message-viewer-item[data-id="${id}"]`).replaceWith(this._buildMessageHtml(msg));
        }
    }

    async _navigateToMessage(messageIndex) {
        const msg = this.state.messages[messageIndex];
        if (!msg) return;

        const currentChat = String(this.deps?.characters?.[this.deps?.this_chid]?.chat || '');
        const targetChat = String(this.state.chatName || '');
        const normalizedCurrent = currentChat.replace(/\.jsonl$/i, '');
        const normalizedTarget = targetChat.replace(/\.jsonl$/i, '');

        if (this.deps.onNavigate) this.deps.onNavigate();
        this.hide();

        // Let UI transition close overlays before scrolling chat.
        await new Promise((resolve) => setTimeout(resolve, 60));

        if (normalizedTarget && normalizedCurrent !== normalizedTarget && typeof this.deps?.openCharacterChat === 'function') {
            await this.deps.openCharacterChat(normalizedTarget);
            // Give ST a moment to render loaded messages before jumping.
            await new Promise((resolve) => setTimeout(resolve, 120));
        }

        const { executeSlashCommandsOnChatInput } = await import('../../../../../../slash-commands.js');
        await executeSlashCommandsOnChatInput(`/chat-jump ${messageIndex}`, {
            source: 'Chat Branches',
        });
    }

    static escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/\n/g, '<br>');
    }

    static formatTimestamp(dateStr) {
        if (!dateStr) return 'Unknown time';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString();
        } catch {
            return dateStr;
        }
    }
}

export { MessageViewerController as MessageViewerPopup };
