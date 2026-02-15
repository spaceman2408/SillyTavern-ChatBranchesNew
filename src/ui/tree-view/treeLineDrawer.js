import { shouldDrawLines } from './treeLayout.js';

export function drawTreeLines(layoutVariant) {
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

    const wrapperRect = $wrapper[0].getBoundingClientRect();
    const $content = $('#chat_tree_content');
    const scrollLeft = $content.scrollLeft();
    const scrollTop = $content.scrollTop();
    const isHorizontal = (layoutVariant || 'top-down') === 'horizontal';

    $('.tree-node').each((_, el) => {
        const $node = $(el);
        const $parentBranch = $node.closest('.tree-branch');
        const $childrenContainer = $parentBranch.children('.tree-children');

        if ($childrenContainer.length > 0 && $childrenContainer.is(':visible')) {
            const startRect = $node[0].getBoundingClientRect();
            const x1 = isHorizontal
                ? (startRect.right - wrapperRect.left) + scrollLeft
                : (startRect.left - wrapperRect.left) + (startRect.width / 2) + scrollLeft;
            const y1 = isHorizontal
                ? (startRect.top - wrapperRect.top) + (startRect.height / 2) + scrollTop
                : (startRect.top - wrapperRect.top) + startRect.height + scrollTop;

            $childrenContainer.children('.tree-branch').each((_, childBranch) => {
                const $childNode = $(childBranch).children('.tree-entry').children('.tree-node');
                if (!$childNode.length) return;
                const childRect = $childNode[0].getBoundingClientRect();

                const x2 = isHorizontal
                    ? (childRect.left - wrapperRect.left) + scrollLeft
                    : (childRect.left - wrapperRect.left) + (childRect.width / 2) + scrollLeft;
                const y2 = isHorizontal
                    ? (childRect.top - wrapperRect.top) + (childRect.height / 2) + scrollTop
                    : (childRect.top - wrapperRect.top) + scrollTop;

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
