function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function startRenameFlow(controller, uuid) {
    const node = controller.nodeMap.get(uuid);
    if (!node) return;

    controller.isRenaming = true;
    controller.renameNode = node;
    controller.render();

    setTimeout(() => {
        const $input = $(`.rename-input[data-uuid="${uuid}"]`);
        $input.focus();
        $input.select();
    }, 50);
}

export async function confirmRenameFlow(controller, uuid, newName) {
    if (!controller.isRenaming || !controller.renameNode) return;

    const node = controller.nodeMap.get(uuid);
    if (!node) return;

    if (newName === node.name) {
        toastr.info('Chat name unchanged');
        cancelRenameFlow(controller);
        return;
    }

    const validation = controller.renameHandler.validateName(newName, controller.treeRoots, uuid);
    if (!validation.valid) {
        toastr.error(validation.error, 'Rename Failed');
        return;
    }

    const $input = $(`.rename-input[data-uuid="${uuid}"]`);
    $input.prop('disabled', true);

    try {
        const oldName = node.name;
        const wasActiveChat = controller.currentChatUUID === uuid;

        await controller.renameHandler.performRename(uuid, oldName, newName);

        controller.isRenaming = false;
        controller.renameNode = null;

        if (wasActiveChat) {
            try {
                await controller.openCharacterChat(newName);
            } catch (error) {
                console.error('[Chat Branches] openCharacterChat failed:', error);
            }

            await wait(300);
            controller.currentChatFile = String(controller.characters[controller.this_chid]?.chat || newName);
            controller.currentChatUUID = controller.chat_metadata?.uuid || uuid;
            await wait(200);
        }

        await controller.loadAndBuildTree();
        toastr.success('Chat renamed successfully');
    } catch (error) {
        console.error('[Chat Branches] Rename failed:', error);
        toastr.error(error.message || 'Failed to rename chat', 'Rename Failed');
        $input.prop('disabled', false);
        $input.focus();

        if (error.message?.includes('Network error') ||
            error.message?.includes('Failed to fetch')) {
            controller.isRenaming = false;
            controller.renameNode = null;
            controller.render();
        }
    }
}

export function cancelRenameFlow(controller) {
    if (!controller.isRenaming) return;

    controller.isRenaming = false;
    controller.renameNode = null;
    controller.render();
}
