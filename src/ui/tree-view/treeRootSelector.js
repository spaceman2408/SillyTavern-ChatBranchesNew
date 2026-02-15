export function populateRootDropdown(controller) {
    const $dropdown = $('#chat_tree_root_dropdown');
    $dropdown.empty();

    if (controller.allTreeRoots.length <= 1) {
        $dropdown.parent().hide();
        return;
    }

    $dropdown.parent().show();

    controller.allTreeRoots.forEach((root) => {
        const displayName = root.name.length > 30 ? `${root.name.substring(0, 30)}...` : root.name;
        const $option = $('<option>')
            .val(root.id)
            .text(displayName)
            .attr('title', root.name);

        if (controller.currentRootNode && root.id === controller.currentRootNode.id) {
            $option.prop('selected', true);
        }

        $dropdown.append($option);
    });
}

export async function handleRootChange(controller, rootUUID) {
    const selectedRoot = controller.allTreeRoots.find((root) => root.id === rootUUID);

    if (!selectedRoot) {
        console.error('[Chat Branches] Root not found:', rootUUID);
        return;
    }

    if (controller.currentRootNode && selectedRoot.id === controller.currentRootNode.id) {
        return;
    }

    controller.currentRootNode = selectedRoot;
    await controller.swapChat(selectedRoot.name);
}
