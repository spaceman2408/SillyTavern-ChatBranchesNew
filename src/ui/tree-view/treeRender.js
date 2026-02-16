import { getLayoutClass } from './treeLayout.js';

function normalizeMsgCount(value) {
    if (value === null || value === undefined || value === '') return null;
    if (Array.isArray(value)) return value.length;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

export function buildTreeMarkup(controller) {
    if (controller.treeRoots.length === 0) {
        return '<div class="chat-tree-empty">No connected chat history found.</div>';
    }

    return `
        <div class="family-tree-wrapper ${getLayoutClass(controller.layoutVariant)}">
            <svg id="chat_tree_lines"></svg>
            <div class="family-tree-inner">
                ${controller.treeRoots.map((root) => renderNodeRecursive(controller, root, 0)).join('')}
            </div>
        </div>
    `;
}

export function renderNodeRecursive(controller, node, level) {
    const isActiveByUUID = controller.currentChatUUID && node.id === controller.currentChatUUID;
    const isActiveByName = node.name === controller.currentChatFile;
    const isActive = isActiveByUUID || isActiveByName;

    const isExpanded = controller.expandedUUIDs.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isRenaming = controller.isRenaming && controller.renameNode?.id === node.id;

    const displayLabel = node.name.length > 15 ? `${node.name.substring(0, 15)}...` : node.name;
    const msgCount = normalizeMsgCount(node.data.branch_point)
        ?? normalizeMsgCount(node.data.message_count)
        ?? normalizeMsgCount(node.data.chat_items);
    const hasMsgCount = msgCount !== null && msgCount !== undefined;

    return `
        <div class="tree-branch">
            <div class="tree-entry">
                <div class="tree-node ${isActive ? 'active-node' : ''} ${isRenaming ? 'renaming' : ''}"
                    data-uuid="${node.id}"
                    data-name="${node.name}"
                    title="${node.name}${hasMsgCount ? ` (Branch at msg ${msgCount})` : ''}">

                    <div class="node-content">
                        <span class="node-icon"><i class="fa-solid fa-message"></i></span>
                        ${isRenaming ? renderRenameInput(node) : `
                            <span class="node-label">${displayLabel}</span>
                            <span class="rename-icon" data-uuid="${node.id}" title="Rename chat">
                                <i class="fa-solid fa-pencil"></i>
                            </span>
                        `}
                    </div>

                    ${hasChildren ? `
                        <div class="expand-toggle ${isExpanded ? 'open' : ''}">
                            <i class="fa-solid ${isExpanded ? 'fa-minus' : 'fa-plus'}"></i>
                        </div>
                    ` : ''}
                </div>
            </div>

            ${(hasChildren && isExpanded) ? `
                <div class="tree-children">
                    ${node.children.map((child) => renderNodeRecursive(controller, child, level + 1)).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

export function renderRenameInput(node) {
    return `
        <div class="rename-input-container">
            <input type="text"
                class="rename-input"
                value="${node.name}"
                data-uuid="${node.id}"
                maxlength="255"
                placeholder="Enter new name"
                autocomplete="off"
                spellcheck="false">
            <div class="rename-actions">
                <button class="rename-confirm" data-uuid="${node.id}" title="Confirm">
                    <i class="fa-solid fa-check"></i>
                </button>
                <button class="rename-cancel" data-uuid="${node.id}" title="Cancel">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        </div>
    `;
}

export function loadingMarkup() {
    return `
        <div class="chat-tree-loading">
            <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
            <div style="margin-top:10px">Loading chat branches...</div>
            <div class="chat-tree-loading-text" style="font-size:0.8em; opacity:0.7"></div>
        </div>
    `;
}
