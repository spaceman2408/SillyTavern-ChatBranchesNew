export function bindTreePanning(controller) {
    const $c = $('#chat_tree_content');

    $c.off('mousedown.chatTree');
    $(document).off('mousemove.chatTree mouseup.chatTree mouseleave.chatTree');

    $c.on('mousedown.chatTree', (e) => {
        if ($(e.target).closest('.tree-node, .expand-toggle, .context-menu-option').length || e.button !== 0) return;
        e.preventDefault();
        controller.isPanning = true;
        controller.panStart = {
            x: e.clientX,
            y: e.clientY,
            scrollX: $c.scrollLeft(),
            scrollY: $c.scrollTop()
        };
        $c.addClass('panning');
    });

    $(document).on('mousemove.chatTree', (e) => {
        if (!controller.isPanning) return;
        $c.scrollLeft(controller.panStart.scrollX - (e.clientX - controller.panStart.x));
        $c.scrollTop(controller.panStart.scrollY - (e.clientY - controller.panStart.y));
    });

    $(document).on('mouseup.chatTree mouseleave.chatTree', () => {
        if (controller.isPanning) {
            controller.isPanning = false;
            controller.wasPanning = true;
            $('#chat_tree_content').removeClass('panning');
        }
    });
}

export function bindTreeEvents(controller) {
    bindTreePanning(controller);

    $('#chat_tree_content').off('click.expandToggle', '.expand-toggle')
        .off('touchend.expandToggleTouch', '.expand-toggle')
        .off('dblclick.treeNodeDblclick', '.tree-node')
        .off('contextmenu.chatTree')
        .off('click.renameIcon', '.rename-icon')
        .off('keydown.renameInput', '.rename-input')
        .off('click.renameConfirm', '.rename-confirm')
        .off('click.renameCancel', '.rename-cancel')
        .off('touchstart.chatTree', '.tree-node')
        .off('touchstart.chatTreeBlank')
        .off('touchend.chatTree', '.tree-node')
        .off('touchmove.chatTree touchcancel.chatTree', '.tree-node')
        .off('touchmove.chatTreeBlank touchend.chatTreeBlank touchcancel.chatTreeBlank');
    $(document).off('click.renameOutside');

    const isRenameInteraction = (target) => {
        return $(target).closest('.rename-input-container, .rename-input, .rename-actions, .rename-confirm, .rename-cancel').length > 0;
    };

    $('#chat_tree_content').on('dblclick.treeNodeDblclick', '.tree-node', async function(e) {
        if (isRenameInteraction(e.target)) return;
        e.stopPropagation();
        if (controller.isSwappingChat) return;

        const name = $(this).data('name');
        if (name === controller.currentChatFile) return;

        $(this).addClass('loading-node');
        await controller.swapChat(name);
    });

    $('#chat_tree_content').on('click.renameInputFocus', '.rename-input', function(e) {
        e.stopPropagation();
        this.focus();
    });

    $('#chat_tree_content').on('mousedown.renameInputFocus', '.rename-input-container', function(e) {
        e.stopPropagation();
    });

    $('#chat_tree_content').on('click.renameIcon', '.rename-icon', function(e) {
        e.stopPropagation();
        controller.startRename($(this).data('uuid'));
    });

    $('#chat_tree_content').on('keydown.renameInput', '.rename-input', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const uuid = $(this).data('uuid');
            controller.confirmRename(uuid, $(this).val().trim());
        } else if (e.key === 'Escape') {
            e.preventDefault();
            controller.cancelRename();
        }
    });

    $('#chat_tree_content').on('click.renameConfirm', '.rename-confirm', function(e) {
        e.stopPropagation();
        const uuid = $(this).data('uuid');
        const $input = $(`.rename-input[data-uuid="${uuid}"]`);
        controller.confirmRename(uuid, String($input.val()).trim());
    });

    $('#chat_tree_content').on('click.renameCancel', '.rename-cancel', function(e) {
        e.stopPropagation();
        controller.cancelRename();
    });

    $(document).on('click.renameOutside', function(e) {
        if (controller.isRenaming && !$(e.target).closest('.rename-input-container').length) {
            controller.cancelRename();
        }
    });

    let longPressTimer = null;
    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let lastTapTime = 0;
    let lastTapTarget = null;
    const LONG_PRESS_DURATION = 500;
    const TAP_THRESHOLD = 10;
    const TAP_DURATION = 300;
    const DOUBLE_TAP_DELAY = 300;

    $('#chat_tree_content').on('touchstart.chatTree', '.tree-node', function(e) {
        if (isRenameInteraction(e.target)) return;
        if ($(e.target).closest('.expand-toggle').length) return;

        if (e.touches.length === 1) {
            const $node = $(this);
            const touch = e.originalEvent.touches[0];

            touchStartTime = Date.now();
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;

            longPressTimer = setTimeout(() => {
                const uuid = $node.data('uuid');
                const name = $node.data('name');
                controller.contextMenuNode = controller.nodeMap.get(uuid) || { uuid, name };
                controller.contextMenu.show(touch.clientX, touch.clientY, [
                    { id: 'view-messages', label: 'View Messages', icon: 'fa-solid fa-comments' }
                ]);
            }, LONG_PRESS_DURATION);
        }
    });

    $('#chat_tree_content').on('touchstart.chatTreeBlank', function(e) {
        if (e.touches.length === 1 && $(e.target).closest('.tree-node, .expand-toggle, .context-menu-option').length === 0) {
            const touch = e.originalEvent.touches[0];
            longPressTimer = setTimeout(() => {
                controller.contextMenuNode = null;
                controller.contextMenu.show(touch.clientX, touch.clientY, [
                    { id: 'expand-all', label: 'Expand All Nodes', icon: 'fa-solid fa-expand' },
                    { id: 'collapse-all', label: 'Collapse All Nodes', icon: 'fa-solid fa-compress' },
                    { id: 'find-current', label: 'Find Current Node', icon: 'fa-solid fa-crosshairs' }
                ]);
            }, LONG_PRESS_DURATION);
        }
    });

    $('#chat_tree_content').on('touchend.chatTree', '.tree-node', async function(e) {
        if (isRenameInteraction(e.target)) return;
        if ($(e.target).closest('.expand-toggle').length) return;

        const touchDuration = Date.now() - touchStartTime;
        const touch = e.originalEvent.changedTouches[0];
        const touchDistance = Math.sqrt(
            Math.pow(touch.clientX - touchStartX, 2) +
            Math.pow(touch.clientY - touchStartY, 2)
        );

        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        if (touchDuration >= TAP_DURATION || touchDistance >= TAP_THRESHOLD) return;

        e.preventDefault();
        e.stopPropagation();

        const currentTime = Date.now();
        const timeSinceLastTap = currentTime - lastTapTime;
        const $currentTarget = $(this);

        if (timeSinceLastTap < DOUBLE_TAP_DELAY && lastTapTarget &&
            $currentTarget.data('uuid') === $(lastTapTarget).data('uuid')) {
            lastTapTime = 0;
            lastTapTarget = null;

            if (controller.isSwappingChat) return;

            const name = $currentTarget.data('name');
            if (name === controller.currentChatFile) return;

            $currentTarget.addClass('loading-node');
            await controller.swapChat(name);
        } else {
            lastTapTime = currentTime;
            lastTapTarget = this;
        }
    });

    $('#chat_tree_content').on('touchmove.chatTree touchcancel.chatTree', '.tree-node', function() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });

    $('#chat_tree_content').on('touchmove.chatTreeBlank touchend.chatTreeBlank touchcancel.chatTreeBlank', function() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });

    $('#chat_tree_content').on('touchend.expandToggleTouch', '.expand-toggle', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const uuid = $(this).closest('.tree-node').data('uuid');
        if (controller.expandedUUIDs.has(uuid)) {
            controller.expandedUUIDs.delete(uuid);
        } else {
            controller.expandedUUIDs.add(uuid);
        }
        controller.render();
    });

    $('#chat_tree_content').on('click.expandToggle', '.expand-toggle', function(e) {
        e.stopPropagation();
        const uuid = $(this).closest('.tree-node').data('uuid');
        if (controller.expandedUUIDs.has(uuid)) {
            controller.expandedUUIDs.delete(uuid);
        } else {
            controller.expandedUUIDs.add(uuid);
        }
        controller.render();
    });

    controller.clearLongPressTimer = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };

    $('#chat_tree_content').on('contextmenu.chatTree', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const $treeNode = $(e.target).closest('.tree-node');
        if ($treeNode.length > 0) {
            const uuid = $treeNode.data('uuid');
            const name = $treeNode.data('name');
            controller.contextMenuNode = controller.nodeMap.get(uuid) || { uuid, name };
            controller.contextMenu.show(e.clientX, e.clientY, [
                { id: 'view-messages', label: 'View Messages', icon: 'fa-solid fa-comments' }
            ]);
            return;
        }

        if ($(e.target).closest('.tree-node, .expand-toggle').length === 0) {
            controller.contextMenu.show(e.clientX, e.clientY, [
                { id: 'expand-all', label: 'Expand All Nodes', icon: 'fa-solid fa-expand' },
                { id: 'collapse-all', label: 'Collapse All Nodes', icon: 'fa-solid fa-compress' },
                { id: 'find-current', label: 'Find Current Node', icon: 'fa-solid fa-crosshairs' }
            ]);
        }
    });
}

export function unbindTreeEvents(controller) {
    if (controller.clearLongPressTimer) {
        controller.clearLongPressTimer();
    }

    $(window).off('resize.chatTree');
    $(document).off('mousemove.chatTree mouseup.chatTree mouseleave.chatTree');
    $(document).off('click.renameOutside');

    $('#chat_tree_content').off('mousedown.chatTree touchstart.chatTree touchmove.chatTree touchend.chatTree touchcancel.chatTree touchstart.chatTreeBlank touchmove.chatTreeBlank touchend.chatTreeBlank touchcancel.chatTreeBlank touchend.expandToggleTouch');
    $('#chat_tree_content').off('click.expandToggle');
    $('#chat_tree_content').off('dblclick.treeNodeDblclick');
    $('#chat_tree_content').off('contextmenu.chatTree');
    $('#chat_tree_content').off('click.renameIcon');
    $('#chat_tree_content').off('click.renameInputFocus');
    $('#chat_tree_content').off('mousedown.renameInputFocus');
    $('#chat_tree_content').off('keydown.renameInput');
    $('#chat_tree_content').off('click.renameConfirm');
    $('#chat_tree_content').off('click.renameCancel');
}
