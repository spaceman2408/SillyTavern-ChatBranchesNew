/** @typedef {{ value:any, expires:number }} TimedCache */

export function createStore() {
    return {
        activeChatUuid: null,
        activeRootUuid: null,
        graphCache: new Map(),
    };
}

export function getGraphCache(store, characterId) {
    const key = String(characterId || '').trim();
    const cached = store.graphCache.get(key);
    if (!cached || cached.expires < Date.now()) return null;
    return cached.value;
}

export function setGraphCache(store, characterId, value, ttlMs) {
    const key = String(characterId || '').trim();
    store.graphCache.set(key, {
        value,
        expires: Date.now() + Number(ttlMs || 0),
    });
}

export function clearCharacterCache(store, characterId) {
    store.graphCache.delete(String(characterId || '').trim());
}
