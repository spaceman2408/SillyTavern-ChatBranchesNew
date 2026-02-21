export class BranchGraphService {
    constructor({ store, chatService, ttlMs = 30000 }) {
        this.store = store;
        this.chatService = chatService;
        this.ttlMs = ttlMs;
    }

    async getGraphForCharacter({ avatarUrl = null, characterName = '', force = false, signal = null } = {}) {
        const characterId = String(avatarUrl || '').trim();
        if (!characterId) {
            return this.emptyGraph(characterId);
        }

        if (!force) {
            const cached = this.getCachedGraph(characterId);
            if (cached) return cached;
        }

        const startedAt = performance.now();
        const fetchStartedAt = performance.now();
        const chats = await this.chatService.listCharacterChats(characterId, false, true, signal);
        const fetchMs = Math.round((performance.now() - fetchStartedAt) * 10) / 10;
        const buildStartedAt = performance.now();
        const graph = this.buildGraph(characterId, characterName, chats);
        const buildMs = Math.round((performance.now() - buildStartedAt) * 10) / 10;
        this.setCachedGraph(characterId, graph);
        const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;

        console.info('[Chat Branches] Branch graph cache built successfully', {
            characterId,
            characterName: characterName || null,
            nodes: graph.nodesById.size,
            roots: graph.roots.length,
            chatsIndexed: Array.isArray(chats) ? chats.length : 0,
            forced: Boolean(force),
            fetchMs,
            buildMs,
            durationMs,
        });

        return graph;
    }

    async getTreeForCharacter(params = {}) {
        const graph = await this.getGraphForCharacter(params);
        return graph.roots;
    }

    async getNodeByUuid({ avatarUrl = null, characterName = '', uuid = null, force = false } = {}) {
        if (!uuid) return null;
        const graph = await this.getGraphForCharacter({ avatarUrl, characterName, force });
        return graph.nodesByUuid.get(String(uuid)) || null;
    }

    invalidateCharacter(avatarUrl) {
        const key = String(avatarUrl || '').trim();
        if (!key) return;
        this.store.graphCache.delete(key);
    }

    invalidateAll() {
        this.store.graphCache.clear();
    }

    getCachedGraph(characterId) {
        const cached = this.store.graphCache.get(characterId);
        if (!cached || cached.expires < Date.now()) return null;
        return cached.value;
    }

    setCachedGraph(characterId, graph) {
        this.store.graphCache.set(characterId, {
            value: graph,
            expires: Date.now() + this.ttlMs,
        });
    }

    emptyGraph(characterId) {
        return {
            character_id: characterId,
            built_at: Date.now(),
            nodesById: new Map(),
            nodesByUuid: new Map(),
            roots: [],
        };
    }

    normalizeRecord(entry) {
        const chatName = String(entry?.file_id || entry?.file_name || '').replace(/\.jsonl$/i, '');
        if (!chatName) return null;

        const meta = entry?.chat_metadata || {};
        const uuid = meta?.uuid ? String(meta.uuid) : null;
        if (!uuid) return null;
        const id = uuid;

        return {
            id,
            uuid,
            chat_name: chatName,
            parent_id: null,
            parent_uuid: meta?.parent_uuid ? String(meta.parent_uuid) : null,
            root_id: id,
            root_uuid: meta?.root_uuid ? String(meta.root_uuid) : (uuid || null),
            branch_point: Number.isFinite(Number(meta?.branch_point)) ? Number(meta.branch_point) : null,
            message_count: Number.isFinite(Number(entry?.chat_items)) ? Number(entry.chat_items) : null,
            last_mes: entry?.last_mes ?? null,
            created_at: Number.isFinite(Number(entry?.create_date)) ? Number(entry.create_date) : null,
            source: 'metadata',
        };
    }

    buildGraph(characterId, _characterName, chats) {
        const nodesById = new Map();
        const nodesByUuid = new Map();

        for (const entry of chats || []) {
            const record = this.normalizeRecord(entry);
            if (!record) continue;
            nodesById.set(record.id, record);
            if (record.uuid) {
                nodesByUuid.set(record.uuid, record);
            }
        }

        for (const record of nodesById.values()) {
            if (!record.uuid || !record.parent_uuid) {
                record.parent_id = null;
                continue;
            }

            const parent = nodesByUuid.get(record.parent_uuid);
            if (parent && parent.id !== record.id) {
                record.parent_id = parent.id;
            } else {
                record.parent_id = null;
            }
        }

        this.breakCycles(nodesById);

        for (const record of nodesById.values()) {
            record.root_id = this.resolveRootId(record, nodesById, nodesByUuid);
        }

        const childrenByParent = new Map();
        for (const record of nodesById.values()) {
            if (!record.parent_id) continue;
            if (!childrenByParent.has(record.parent_id)) {
                childrenByParent.set(record.parent_id, []);
            }
            childrenByParent.get(record.parent_id).push(record);
        }

        const sortRecords = (a, b) => {
            const aScore = this.sortScore(a);
            const bScore = this.sortScore(b);
            if (aScore !== bScore) return bScore - aScore;
            return a.chat_name.localeCompare(b.chat_name);
        };

        for (const children of childrenByParent.values()) {
            children.sort(sortRecords);
        }

        const roots = [...nodesById.values()]
            .filter((node) => !node.parent_id)
            .sort(sortRecords)
            .map((node) => this.toTreeNode(node, childrenByParent));

        return {
            character_id: characterId,
            built_at: Date.now(),
            nodesById,
            nodesByUuid,
            roots,
        };
    }

    breakCycles(nodesById) {
        const visited = new Set();

        for (const node of nodesById.values()) {
            if (visited.has(node.id)) continue;

            const stackSet = new Set();
            let cursor = node;

            while (cursor) {
                if (stackSet.has(cursor.id)) {
                    cursor.parent_id = null;
                    break;
                }
                if (visited.has(cursor.id)) break;

                stackSet.add(cursor.id);
                if (!cursor.parent_id) break;
                cursor = nodesById.get(cursor.parent_id) || null;
            }

            stackSet.forEach((id) => visited.add(id));
        }
    }

    resolveRootId(record, nodesById, nodesByUuid) {
        if (record.root_uuid) {
            const byRoot = nodesByUuid.get(record.root_uuid);
            if (byRoot) return byRoot.id;
        }

        let cursor = record;
        const seen = new Set([record.id]);

        while (cursor.parent_id) {
            const parent = nodesById.get(cursor.parent_id);
            if (!parent || seen.has(parent.id)) break;
            seen.add(parent.id);
            cursor = parent;
        }

        return cursor?.id || record.id;
    }

    sortScore(record) {
        const created = Number(record.created_at);
        if (Number.isFinite(created) && created > 0) return created;

        const last = record.last_mes;
        if (typeof last === 'number' && Number.isFinite(last)) return last;

        if (typeof last === 'string') {
            const parsed = Date.parse(last);
            if (Number.isFinite(parsed)) return parsed;
            const asNum = Number(last);
            if (Number.isFinite(asNum)) return asNum;
        }

        return 0;
    }

    toTreeNode(record, childrenByParent) {
        const children = (childrenByParent.get(record.id) || []).map((child) => this.toTreeNode(child, childrenByParent));

        return {
            uuid: record.id,
            chat_name: record.chat_name,
            parent_uuid: record.parent_id,
            root_uuid: record.root_id,
            branch_point: record.branch_point,
            message_count: record.message_count,
            children,
        };
    }
}
