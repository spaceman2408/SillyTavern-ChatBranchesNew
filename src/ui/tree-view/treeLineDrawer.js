import { shouldDrawLines } from './treeLayout.js';

function drawTopDownLines($svg, $wrapper, layout) {
    const edges = Array.isArray(layout?.edges) ? layout.edges : [];
    if (edges.length === 0) return;

    const wrapperRect = $wrapper[0].getBoundingClientRect();
    const nodeRectById = new Map();

    $wrapper.find('.tree-node[data-uuid]').each((_, nodeEl) => {
        const uuid = String($(nodeEl).data('uuid') || '');
        if (!uuid) return;
        nodeRectById.set(uuid, nodeEl.getBoundingClientRect());
    });

    edges.forEach((edge) => {
        const parentRect = nodeRectById.get(String(edge.parentId || ''));
        const childRect = nodeRectById.get(String(edge.childId || ''));
        if (!parentRect || !childRect) return;

        const x1 = (parentRect.left - wrapperRect.left) + (parentRect.width / 2);
        const y1 = (parentRect.top - wrapperRect.top) + parentRect.height;
        const x2 = (childRect.left - wrapperRect.left) + (childRect.width / 2);
        const y2 = (childRect.top - wrapperRect.top);

        const verticalGap = Math.max(1, y2 - y1);
        const stem = Math.max(18, Math.min(64, verticalGap * 0.42));
        const controlY1 = y1 + stem;
        const controlY2 = y2 - stem;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${x1},${y1} C${x1},${controlY1} ${x2},${controlY2} ${x2},${y2}`);
        path.setAttribute('stroke', '#666');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-width', '2');

        $svg.append(path);
    });
}

export function drawTreeLines(layoutVariant, options = {}) {
    const $svg = $('#chat_tree_lines');
    const $wrapper = $('.family-tree-wrapper');

    if (!$svg.length || !$wrapper.length) return;

    if (!shouldDrawLines(layoutVariant)) {
        $svg.empty();
        $svg.hide();
        return;
    }

    $svg.show();
    $svg.attr('width', $wrapper[0].scrollWidth);
    $svg.attr('height', $wrapper[0].scrollHeight);
    $svg.empty();

    const layout = options?.layout || null;
    if ((layoutVariant || 'top-down') === 'top-down') {
        drawTopDownLines($svg, $wrapper, layout);
        return;
    }

    const wrapperRect = $wrapper[0].getBoundingClientRect();
    const isHorizontal = (layoutVariant || 'top-down') === 'horizontal';

    $('.tree-node').each((_, el) => {
        const $node = $(el);
        const $parentBranch = $node.closest('.tree-branch');
        const $childrenContainer = $parentBranch.children('.tree-children');

        if ($childrenContainer.length > 0 && $childrenContainer.is(':visible')) {
            const startRect = $node[0].getBoundingClientRect();
            const x1 = isHorizontal
                ? (startRect.right - wrapperRect.left)
                : (startRect.left - wrapperRect.left) + (startRect.width / 2);
            const y1 = isHorizontal
                ? (startRect.top - wrapperRect.top) + (startRect.height / 2)
                : (startRect.top - wrapperRect.top) + startRect.height;

            $childrenContainer.children('.tree-branch').each((_, childBranch) => {
                const $childNode = $(childBranch).children('.tree-entry').children('.tree-node');
                if (!$childNode.length) return;
                const childRect = $childNode[0].getBoundingClientRect();

                const x2 = isHorizontal
                    ? (childRect.left - wrapperRect.left)
                    : (childRect.left - wrapperRect.left) + (childRect.width / 2);
                const y2 = isHorizontal
                    ? (childRect.top - wrapperRect.top) + (childRect.height / 2)
                    : (childRect.top - wrapperRect.top);

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                if (isHorizontal) {
                    const cX = (x1 + x2) / 2;
                    path.setAttribute('d', `M${x1},${y1} C${cX},${y1} ${cX},${y2} ${x2},${y2}`);
                } else {
                    const cY = (y1 + y2) / 2;
                    path.setAttribute('d', `M${x1},${y1} C${x1},${cY} ${x2},${cY} ${x2},${y2}`);
                }
                path.setAttribute('stroke', '#666');
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke-width', '2');

                $svg.append(path);
            });
        }
    });
}
