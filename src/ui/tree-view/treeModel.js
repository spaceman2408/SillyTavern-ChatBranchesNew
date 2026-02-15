export function buildTreeModel(treeArray) {
    const nodeMap = new Map();

    const processNode = (node, parent = null) => {
        const internalNode = {
            id: node.uuid,
            name: node.chat_name,
            parentId: node.parent_uuid,
            children: [],
            data: node,
            parent,
        };

        nodeMap.set(node.uuid, internalNode);

        if (node.children && node.children.length > 0) {
            node.children.forEach((child) => {
                const childNode = processNode(child, internalNode);
                internalNode.children.push(childNode);
            });
        }

        return internalNode;
    };

    let allTreeRoots = treeArray.map((root) => processNode(root));
    allTreeRoots = allTreeRoots.filter((root, index, self) =>
        self.findIndex((candidate) => candidate.id === root.id) === index,
    );

    return { nodeMap, allTreeRoots };
}

export function findCurrentNode(nodeMap, currentChatUUID, currentChatFile) {
    if (currentChatUUID) {
        const byUUID = nodeMap.get(currentChatUUID);
        if (byUUID) return byUUID;
    }

    for (const [, node] of nodeMap) {
        if (node.name === currentChatFile) {
            return node;
        }
    }

    if (currentChatFile) {
        const currentLower = String(currentChatFile).toLowerCase().trim();
        for (const [, node] of nodeMap) {
            const nodeLower = String(node.name).toLowerCase().trim();
            if (nodeLower === currentLower) {
                return node;
            }
        }
    }

    if (currentChatFile) {
        const currentLower = String(currentChatFile).toLowerCase().trim();
        for (const [, node] of nodeMap) {
            const nodeLower = String(node.name).toLowerCase().trim();
            if (nodeLower.includes(currentLower) || currentLower.includes(nodeLower)) {
                return node;
            }
        }
    }

    return null;
}

export function isolateTreeForNode(currentNode, allTreeRoots) {
    if (!currentNode) {
        return { currentRootNode: null, treeRoots: [...allTreeRoots] };
    }

    let root = currentNode;
    while (root.parent) {
        root = root.parent;
    }

    return { currentRootNode: root, treeRoots: [root] };
}

export function collectExpandedPathIds(currentNode) {
    const expandedIds = new Set();
    if (!currentNode) return expandedIds;

    let cursor = currentNode;
    while (cursor) {
        if (cursor.parent) {
            expandedIds.add(cursor.parent.id);
        }
        cursor = cursor.parent;
    }

    return expandedIds;
}
