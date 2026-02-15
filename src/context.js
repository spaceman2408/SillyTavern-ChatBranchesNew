import { getContext, extension_settings } from '../../../../extensions.js';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from './constants.js';

function mergeDefaults(target, defaults) {
    const next = { ...target };
    for (const [key, value] of Object.entries(defaults)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            next[key] = mergeDefaults(next[key] || {}, value);
        } else if (next[key] === undefined) {
            next[key] = value;
        }
    }
    return next;
}

export function getCtx() {
    return getContext();
}

export function ensureSettings() {
    const current = extension_settings[SETTINGS_KEY] || {};
    extension_settings[SETTINGS_KEY] = mergeDefaults(current, DEFAULT_SETTINGS);
    return extension_settings[SETTINGS_KEY];
}

export function ctxSnapshot() {
    const ctx = getCtx();
    const characterId = ctx.characterId;
    const character = characterId === undefined || characterId === null ? null : ctx.characters?.[characterId] || null;
    return {
        ctx,
        characterId,
        groupId: ctx.groupId,
        character,
        chatId: ctx.chatId,
        chatName: character?.chat || null,
        chatMetadata: ctx.chatMetadata,
        chat: ctx.chat,
    };
}
