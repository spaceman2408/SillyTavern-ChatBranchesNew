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

function getBranchPointLabel(node) {
    const raw = normalizeMsgCount(node?.data?.branch_point);
    if (raw === null || raw === undefined) return null;

    // Show exactly what metadata stores; avoid synthetic fallbacks that create false positives on roots.
    return Math.max(0, raw);
}

function getNodeState(controller, node) {
    const isActiveByUUID = controller.currentChatUUID && node.id === controller.currentChatUUID;
    const isActiveByName = node.name === controller.currentChatFile;
    return {
        isActive: isActiveByUUID || isActiveByName,
        isExpanded: controller.expandedUUIDs.has(node.id),
        hasChildren: node.children && node.children.length > 0,
        isRenaming: controller.isRenaming && controller.renameNode?.id === node.id,
    };
}

function renderNodeCard(node, state) {
    const displayLabel = node.name.length > 15 ? `${node.name.substring(0, 15)}...` : node.name;
    const branchPointLabel = getBranchPointLabel(node);
    const hasBranchPoint = branchPointLabel !== null && branchPointLabel !== undefined;
    const branchPointTitle = hasBranchPoint ? ` (Branch at msg ${branchPointLabel})` : '';

    return `
        <div class="tree-node ${state.isActive ? 'active-node' : ''} ${state.isRenaming ? 'renaming' : ''}"
            data-uuid="${node.id}"
            data-name="${node.name}"
            title="${node.name}${branchPointTitle}">
            <div class="node-content">
                <span class="node-icon"><i class="fa-solid fa-message"></i></span>
                ${state.isRenaming ? renderRenameInput(node) : `
                    <span class="node-label">${displayLabel}</span>
                    <span class="rename-icon" data-uuid="${node.id}" title="Rename chat">
                        <i class="fa-solid fa-pencil"></i>
                    </span>
                `}
            </div>

            ${state.hasChildren ? `
                <div class="expand-toggle ${state.isExpanded ? 'open' : ''}">
                    <i class="fa-solid ${state.isExpanded ? 'fa-minus' : 'fa-plus'}"></i>
                </div>
            ` : ''}
        </div>
    `;
}

export function buildTreeMarkup(controller) {
    if (controller.treeRoots.length === 0) {
        return '<div class="chat-tree-empty">No connected chat history found.</div>';
    }
    const wrapperClass = controller.isRenaming
        ? `${getLayoutClass(controller.layoutVariant)} renaming-active`
        : getLayoutClass(controller.layoutVariant);

    return `
        <div class="family-tree-wrapper ${wrapperClass}">
            <svg id="chat_tree_lines"></svg>
            <div class="family-tree-inner">
                ${controller.treeRoots.map((root) => renderNodeRecursive(controller, root, 0)).join('')}
            </div>
        </div>
    `;
}

function renderTopDownNodeShell(controller, layoutNode) {
    const sourceNode = controller.nodeMap.get(layoutNode.id);
    if (!sourceNode) return '';

    const state = getNodeState(controller, sourceNode);
    const left = Number.isFinite(layoutNode.x) ? layoutNode.x : 0;
    const top = Number.isFinite(layoutNode.y) ? layoutNode.y : 0;
    const shellClass = state.isRenaming ? 'tree-node-shell renaming-shell' : 'tree-node-shell';

    return `
        <div class="${shellClass}" data-uuid="${sourceNode.id}" style="left:${left}px;top:${top}px;">
            <div class="tree-entry">
                ${renderNodeCard(sourceNode, state)}
            </div>
        </div>
    `;
}

export function buildTopDownMarkup(controller, layoutResult) {
    if (controller.treeRoots.length === 0) {
        return '<div class="chat-tree-empty">No connected chat history found.</div>';
    }

    const canvasWidth = Math.max(1, Math.ceil(layoutResult?.bounds?.width || 0));
    const canvasHeight = Math.max(1, Math.ceil(layoutResult?.bounds?.height || 0));
    const nodes = Array.isArray(layoutResult?.nodes) ? layoutResult.nodes : [];
    const wrapperClass = controller.isRenaming
        ? `${getLayoutClass(controller.layoutVariant)} renaming-active`
        : getLayoutClass(controller.layoutVariant);

    return `
        <div class="family-tree-wrapper ${wrapperClass}"
            style="--tree-topdown-canvas-w:${canvasWidth}px;--tree-topdown-canvas-h:${canvasHeight}px;">
            <svg id="chat_tree_lines"></svg>
            <div class="family-tree-inner">
                <div class="tree-node-layer" style="width:${canvasWidth}px;height:${canvasHeight}px;">
                    ${nodes.map((node) => renderTopDownNodeShell(controller, node)).join('')}
                </div>
            </div>
        </div>
    `;
}

export function renderNodeRecursive(controller, node, level) {
    const state = getNodeState(controller, node);

    return `
        <div class="tree-branch">
            <div class="tree-entry">
                ${renderNodeCard(node, state)}
            </div>

            ${(state.hasChildren && state.isExpanded) ? `
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
