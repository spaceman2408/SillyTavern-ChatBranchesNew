import { ctxSnapshot } from '../context.js';

async function fetchJson(url, init = {}) {
    const response = await fetch(url, init);
    if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(errorText || `HTTP ${response.status}`);
    }
    return response.json();
}

export class ChatService {
    async saveBranchChat() {
        const { ctx } = ctxSnapshot();
        // ST context API currently exposes saveChat() with no arguments.
        await ctx.saveChat();
    }

    async openChat(chatName) {
        const { ctx } = ctxSnapshot();
        await ctx.openCharacterChat(chatName);
    }

    async renameChatFile(oldName, newName, avatarUrl) {
        const { ctx } = ctxSnapshot();
        return fetchJson('/api/chats/rename', {
            method: 'POST',
            headers: {
                ...ctx.getRequestHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                is_group: false,
                avatar_url: avatarUrl,
                original_file: `${oldName}.jsonl`,
                renamed_file: `${newName}.jsonl`,
            }),
        });
    }

    async fetchChat(characterName, avatarUrl, chatName) {
        const { ctx } = ctxSnapshot();
        return fetchJson('/api/chats/get', {
            method: 'POST',
            headers: {
                ...ctx.getRequestHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ch_name: characterName,
                file_name: chatName,
                avatar_url: avatarUrl,
            }),
        });
    }

    async saveChatData(characterName, avatarUrl, chatName, chatData) {
        const { ctx } = ctxSnapshot();
        return fetchJson('/api/chats/save', {
            method: 'POST',
            headers: {
                ...ctx.getRequestHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ch_name: characterName,
                file_name: chatName,
                avatar_url: avatarUrl,
                chat: chatData,
            }),
        });
    }

    async listCharacterChats(avatarUrl, simple = false) {
        const { ctx } = ctxSnapshot();
        const data = await fetchJson('/api/characters/chats', {
            method: 'POST',
            headers: {
                ...ctx.getRequestHeaders(),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ avatar_url: avatarUrl, simple }),
        });
        return Array.isArray(data) ? data : Object.values(data || {});
    }
}
