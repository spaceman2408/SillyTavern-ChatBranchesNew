const DEFAULT_METRICS = Object.freeze({
    nodeWidth: 120,
    nodeHeight: 44,
});

const DEFAULT_SPACING = Object.freeze({
    siblingGap: 12,
    rootGap: 24,
    levelGap: 68,
    padding: 36,
});

function toFiniteNumber(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
}

function normalizeMetrics(metrics = {}) {
    return {
        nodeWidth: Math.max(1, toFiniteNumber(metrics.nodeWidth, DEFAULT_METRICS.nodeWidth)),
        nodeHeight: Math.max(1, toFiniteNumber(metrics.nodeHeight, DEFAULT_METRICS.nodeHeight)),
    };
}

function normalizeSpacing(spacing = {}) {
    const siblingGap = Math.max(0, toFiniteNumber(spacing.siblingGap, DEFAULT_SPACING.siblingGap));
    return {
        siblingGap,
        rootGap: Math.max(siblingGap, toFiniteNumber(spacing.rootGap, DEFAULT_SPACING.rootGap)),
        levelGap: Math.max(1, toFiniteNumber(spacing.levelGap, DEFAULT_SPACING.levelGap)),
        padding: Math.max(0, toFiniteNumber(spacing.padding, DEFAULT_SPACING.padding)),
    };
}

function toExpandedSet(expandedUUIDs) {
    if (expandedUUIDs instanceof Set) return expandedUUIDs;
    if (Array.isArray(expandedUUIDs)) return new Set(expandedUUIDs);
    return new Set();
}

function nodeName(node) {
    if (typeof node?.name === 'string') return node.name;
    if (node?.name === null || node?.name === undefined) return '';
    return String(node.name);
}

function nodeId(node) {
    return node?.id ?? null;
}

function isNodeActive(node, activeNodeId, activeNodeName) {
    const id = nodeId(node);
    if (activeNodeId && id && activeNodeId === id) return true;
    const name = nodeName(node);
    return Boolean(activeNodeName && name && activeNodeName === name);
}

function getContourValue(contour, depth) {
    const value = contour[depth];
    return Number.isFinite(value) ? value : null;
}

function cloneContour(contour) {
    return Array.isArray(contour) ? contour.slice() : [];
}

function mergeContours(targetLeft, targetRight, sourceLeft, sourceRight, offset) {
    const maxDepth = Math.max(
        targetLeft.length,
        targetRight.length,
        sourceLeft.length,
        sourceRight.length,
    );

    for (let depth = 0; depth < maxDepth; depth += 1) {
        const srcLeft = getContourValue(sourceLeft, depth);
        const srcRight = getContourValue(sourceRight, depth);
        if (srcLeft === null || srcRight === null) continue;

        const shiftedLeft = srcLeft + offset;
        const shiftedRight = srcRight + offset;
        const currentLeft = getContourValue(targetLeft, depth);
        const currentRight = getContourValue(targetRight, depth);

        targetLeft[depth] = currentLeft === null
            ? shiftedLeft
            : Math.min(currentLeft, shiftedLeft);
        targetRight[depth] = currentRight === null
            ? shiftedRight
            : Math.max(currentRight, shiftedRight);
    }
}

function shiftContour(contour, delta) {
    const shifted = [];
    for (let depth = 0; depth < contour.length; depth += 1) {
        const value = getContourValue(contour, depth);
        if (value === null) continue;
        shifted[depth] = value + delta;
    }
    return shifted;
}

function computeRequiredShift(placedRightContour, nextLeftContour, gap) {
    let requiredShift = 0;
    const maxDepth = Math.max(placedRightContour.length, nextLeftContour.length);

    for (let depth = 0; depth < maxDepth; depth += 1) {
        const placedRight = getContourValue(placedRightContour, depth);
        const nextLeft = getContourValue(nextLeftContour, depth);
        if (placedRight === null || nextLeft === null) continue;

        const overlap = (placedRight + gap) - nextLeft;
        if (overlap > requiredShift) {
            requiredShift = overlap;
        }
    }

    return requiredShift;
}

/**
 * @typedef {Object} TopDownLayoutMetrics
 * @property {number} [nodeWidth]
 * @property {number} [nodeHeight]
 */

/**
 * @typedef {Object} TopDownLayoutSpacing
 * @property {number} [siblingGap]
 * @property {number} [rootGap]
 * @property {number} [levelGap]
 * @property {number} [padding]
 */

/**
 * @typedef {Object} TopDownLayoutOptions
 * @property {any[]} [roots]
 * @property {Set<string>|string[]} [expandedUUIDs]
 * @property {TopDownLayoutMetrics} [metrics]
 * @property {TopDownLayoutSpacing} [spacing]
 * @property {string|null} [activeNodeId]
 * @property {string|null} [activeNodeName]
 */

/**
 * @param {TopDownLayoutOptions} [options]
 */
export function computeTopDownLayout({
    roots = [],
    expandedUUIDs,
    metrics = {},
    spacing = {},
    activeNodeId = null,
    activeNodeName = null,
} = {}) {
    const normalizedRoots = Array.isArray(roots) ? roots.filter(Boolean) : [];
    const expandedSet = toExpandedSet(expandedUUIDs);
    const normalizedMetrics = normalizeMetrics(metrics);
    const normalizedSpacing = normalizeSpacing(spacing);

    const { nodeWidth, nodeHeight } = normalizedMetrics;
    const { siblingGap, rootGap, levelGap, padding } = normalizedSpacing;

    if (normalizedRoots.length === 0) {
        return {
            nodes: [],
            edges: [],
            bounds: {
                width: Math.ceil(nodeWidth + (padding * 2)),
                height: Math.ceil(nodeHeight + (padding * 2)),
                minX: padding,
                minY: padding,
            },
        };
    }

    const visibleChildrenByNode = new WeakMap();

    function getAllChildren(node) {
        return Array.isArray(node?.children) ? node.children.filter(Boolean) : [];
    }

    function getVisibleChildren(node) {
        const cached = visibleChildrenByNode.get(node);
        if (cached) return cached;

        const allChildren = getAllChildren(node);
        if (allChildren.length === 0 || !expandedSet.has(nodeId(node))) {
            visibleChildrenByNode.set(node, []);
            return [];
        }

        visibleChildrenByNode.set(node, allChildren);
        return allChildren;
    }

    const halfNodeWidth = nodeWidth / 2;

    function buildLayoutTree(node) {
        const visibleChildren = getVisibleChildren(node);
        const childLayouts = visibleChildren.map((child) => buildLayoutTree(child));
        const childOffsets = [];

        let mergedChildLeft = [];
        let mergedChildRight = [];

        childLayouts.forEach((childLayout, index) => {
            if (index === 0) {
                childOffsets.push(0);
                mergedChildLeft = cloneContour(childLayout.leftContour);
                mergedChildRight = cloneContour(childLayout.rightContour);
                return;
            }

            const shift = computeRequiredShift(mergedChildRight, childLayout.leftContour, siblingGap);
            childOffsets.push(shift);
            mergeContours(
                mergedChildLeft,
                mergedChildRight,
                childLayout.leftContour,
                childLayout.rightContour,
                shift,
            );
        });

        if (childOffsets.length > 0) {
            const center = (childOffsets[0] + childOffsets[childOffsets.length - 1]) / 2;
            for (let i = 0; i < childOffsets.length; i += 1) {
                childOffsets[i] -= center;
            }
            mergedChildLeft = shiftContour(mergedChildLeft, -center);
            mergedChildRight = shiftContour(mergedChildRight, -center);
        }

        const leftContour = [];
        const rightContour = [];
        leftContour[0] = -halfNodeWidth;
        rightContour[0] = halfNodeWidth;

        for (let depth = 0; depth < mergedChildLeft.length; depth += 1) {
            const childLeft = getContourValue(mergedChildLeft, depth);
            const childRight = getContourValue(mergedChildRight, depth);
            if (childLeft === null || childRight === null) continue;

            const parentDepth = depth + 1;
            leftContour[parentDepth] = childLeft;
            rightContour[parentDepth] = childRight;
        }

        return {
            sourceNode: node,
            childLayouts,
            childOffsets,
            leftContour,
            rightContour,
        };
    }

    const rootLayouts = normalizedRoots.map((root) => buildLayoutTree(root));
    const rootOffsets = [];

    let mergedForestLeft = [];
    let mergedForestRight = [];

    rootLayouts.forEach((rootLayout, index) => {
        if (index === 0) {
            rootOffsets.push(0);
            mergedForestLeft = cloneContour(rootLayout.leftContour);
            mergedForestRight = cloneContour(rootLayout.rightContour);
            return;
        }

        const shift = computeRequiredShift(mergedForestRight, rootLayout.leftContour, rootGap);
        rootOffsets.push(shift);
        mergeContours(
            mergedForestLeft,
            mergedForestRight,
            rootLayout.leftContour,
            rootLayout.rightContour,
            shift,
        );
    });

    const nodes = [];
    const edges = [];

    function placeNode(layoutNode, depth, centerX) {
        const sourceNode = layoutNode.sourceNode;
        const topY = padding + (depth * levelGap);
        const allChildren = getAllChildren(sourceNode);
        const visibleChildren = getVisibleChildren(sourceNode);

        nodes.push({
            id: nodeId(sourceNode),
            name: nodeName(sourceNode),
            depth,
            x: centerX,
            y: topY,
            hasChildren: allChildren.length > 0,
            isExpanded: visibleChildren.length > 0,
            isActive: isNodeActive(sourceNode, activeNodeId, activeNodeName),
        });

        if (layoutNode.childLayouts.length === 0) return;

        layoutNode.childLayouts.forEach((childLayout, index) => {
            const childSource = childLayout.sourceNode;
            if (nodeId(sourceNode) && nodeId(childSource)) {
                edges.push({ parentId: nodeId(sourceNode), childId: nodeId(childSource) });
            }
            placeNode(childLayout, depth + 1, centerX + layoutNode.childOffsets[index]);
        });
    }

    rootLayouts.forEach((rootLayout, index) => {
        placeNode(rootLayout, 0, rootOffsets[index]);
    });

    let minLeft = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;

    nodes.forEach((node) => {
        const left = node.x - (nodeWidth / 2);
        const right = left + nodeWidth;
        const top = node.y;
        const bottom = top + nodeHeight;

        if (left < minLeft) minLeft = left;
        if (right > maxRight) maxRight = right;
        if (top < minTop) minTop = top;
        if (bottom > maxBottom) maxBottom = bottom;
    });

    const shiftX = padding - minLeft;
    const shiftY = padding - minTop;

    nodes.forEach((node) => {
        node.x = Math.round((node.x + shiftX) * 100) / 100;
        node.y = Math.round((node.y + shiftY) * 100) / 100;
    });

    minLeft += shiftX;
    maxRight += shiftX;
    minTop += shiftY;
    maxBottom += shiftY;

    return {
        nodes,
        edges,
        bounds: {
            width: Math.max(
                Math.ceil(nodeWidth + (padding * 2)),
                Math.ceil(maxRight + padding),
            ),
            height: Math.max(
                Math.ceil(nodeHeight + (padding * 2)),
                Math.ceil(maxBottom + padding),
            ),
            minX: minLeft,
            minY: minTop,
        },
    };
}
