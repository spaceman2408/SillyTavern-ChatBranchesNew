import { BRANCH_CACHE_TTL_MS, TREE_CACHE_TTL_MS } from '../constants.js';

/** @typedef {{ value:any, expires:number }} TimedCache */

export function createStore() {
    return {
        pluginRunning: false,
        pluginCheckedAt: 0,
        notifiedPluginMissing: false,
        activeChatUuid: null,
        activeRootUuid: null,
        treeCache: new Map(),
        branchCache: new Map(),
    };
}

export function getTreeCache(store, characterId) {
    const key = String(characterId || '');
    const cached = store.treeCache.get(key);
    if (!cached || cached.expires < Date.now()) return null;
    return cached.value;
}

export function setTreeCache(store, characterId, value) {
    const key = String(characterId || '');
    store.treeCache.set(key, { value, expires: Date.now() + TREE_CACHE_TTL_MS });
}

export function getBranchCache(store, uuid) {
    const key = String(uuid || '');
    const cached = store.branchCache.get(key);
    if (!cached || cached.expires < Date.now()) return null;
    return cached.value;
}

export function setBranchCache(store, uuid, value) {
    const key = String(uuid || '');
    store.branchCache.set(key, { value, expires: Date.now() + BRANCH_CACHE_TTL_MS });
}

export function clearCharacterCache(store, characterId) {
    store.treeCache.delete(String(characterId || ''));
}