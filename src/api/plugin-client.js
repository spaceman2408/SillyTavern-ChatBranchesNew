import { ctxSnapshot } from '../context.js';
import { getBranchCache, getTreeCache, setBranchCache, setTreeCache } from '../state/store.js';
import { withTimeout } from '../utils/async.js';

function hasValidUpdates(updates) {
    return Object.values(updates).some((value) => value !== undefined && value !== null && value !== '');
}

async function fetchJson(url, init = {}, timeoutMs = 6000) {
    const res = await withTimeout(fetch(url, init), timeoutMs);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const reason = data?.error || data?.message || `HTTP ${res.status}`;
        throw new Error(reason);
    }
    return data;
}

export class PluginClient {
    constructor({ baseUrl, store, settingsProvider }) {
        this.baseUrl = baseUrl;
        this.store = store;
        this.getSettings = settingsProvider;
    }

    get enabled() {
        return Boolean(this.getSettings()?.enabled);
    }

    async healthCheck() {
        try {
            const response = await withTimeout(fetch(this.baseUrl, { method: 'HEAD' }), 4000);
            this.store.pluginRunning = response.ok;
            this.store.pluginCheckedAt = Date.now();
            return response.ok;
        } catch {
            this.store.pluginRunning = false;
            this.store.pluginCheckedAt = Date.now();
            return false;
        }
    }

    async registerBranch(payload) {
        if (!this.enabled || !this.store.pluginRunning) return;
        const { ctx } = ctxSnapshot();
        await fetchJson(`${this.baseUrl}/branch`, {
            method: 'POST',
            headers: {
                ...ctx.getRequestHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (payload?.uuid) {
            setBranchCache(this.store, payload.uuid, payload);
        }
    }

    async updateBranch(uuid, updates) {
        if (!this.enabled || !this.store.pluginRunning || !uuid || !hasValidUpdates(updates)) return;
        const { ctx } = ctxSnapshot();
        await fetchJson(`${this.baseUrl}/branch/${uuid}`, {
            method: 'PATCH',
            headers: {
                ...ctx.getRequestHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
        });
    }

    async deleteBranch(uuid, cascade = false) {
        if (!this.enabled || !this.store.pluginRunning || !uuid) return;
        const { ctx } = ctxSnapshot();
        await fetchJson(`${this.baseUrl}/branch/${uuid}?cascade=${Boolean(cascade)}`, {
            method: 'DELETE',
            headers: {
                ...ctx.getRequestHeaders(),
                'Content-Type': 'application/json',
            },
        });
    }

    async deleteCharacter(characterId) {
        if (!characterId || !this.store.pluginRunning) return;
        const { ctx } = ctxSnapshot();
        await fetchJson(`${this.baseUrl}/character/${characterId}`, {
            method: 'DELETE',
            headers: {
                ...ctx.getRequestHeaders(),
                'Content-Type': 'application/json',
            },
        });
    }

    async getTree(characterId, { force = false } = {}) {
        if (!characterId) return [];
        if (!force) {
            const cached = getTreeCache(this.store, characterId);
            if (cached) return cached;
        }

        const { ctx } = ctxSnapshot();
        const data = await fetchJson(`${this.baseUrl}/tree/${characterId}`, {
            headers: ctx.getRequestHeaders(),
        });
        const tree = data?.tree || [];
        setTreeCache(this.store, characterId, tree);
        return tree;
    }

    async getBranch(uuid, { force = false } = {}) {
        if (!uuid) return null;
        if (!force) {
            const cached = getBranchCache(this.store, uuid);
            if (cached) return cached;
        }

        const { ctx } = ctxSnapshot();
        const data = await fetchJson(`${this.baseUrl}/branch/${uuid}`, {
            headers: ctx.getRequestHeaders(),
        });
        const branch = data?.branch || null;
        if (branch) setBranchCache(this.store, uuid, branch);
        return branch;
    }

    async queryByChatName(chatName) {
        if (!chatName) return [];
        const { ctx } = ctxSnapshot();
        const data = await fetchJson(`${this.baseUrl}/branches?chat_name=${encodeURIComponent(chatName)}`, {
            headers: ctx.getRequestHeaders(),
        });
        return data?.branches || [];
    }
}