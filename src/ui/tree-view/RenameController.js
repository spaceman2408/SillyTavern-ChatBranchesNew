export class RenameController {
    constructor(dependencies) {
        this.token = dependencies.token;
        this.characters = dependencies.characters;
        this.this_chid = dependencies.this_chid;
        this.branchGraphService = dependencies.branchGraphService;

        this.INVALID_CHARS = /[<>:"/\\|?*]/g;
        this.RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
        this.MAX_FILENAME_LENGTH = 255;
        this.INVALID_START_CHARS = /^[.\s]+/;
    }

    validateName(newName, treeRoots, excludeUuid = null) {
        if (!newName || newName.trim().length === 0) {
            return { valid: false, error: 'Chat name cannot be empty' };
        }

        const trimmedName = newName.trim();

        if (trimmedName.length > this.MAX_FILENAME_LENGTH) {
            return {
                valid: false,
                error: `Name too long (max ${this.MAX_FILENAME_LENGTH} characters)`,
            };
        }

        if (this.INVALID_CHARS.test(trimmedName)) {
            return {
                valid: false,
                error: 'Name contains invalid characters: < > : " / \\ | ? *',
            };
        }

        if (this.RESERVED_NAMES.test(trimmedName)) {
            return { valid: false, error: 'Name is reserved by the system' };
        }

        if (this.INVALID_START_CHARS.test(trimmedName)) {
            return {
                valid: false,
                error: 'Name cannot start with a dot, space, or other special characters',
            };
        }

        if (this.hasDuplicateName(trimmedName, treeRoots, excludeUuid)) {
            return { valid: false, error: 'A chat with this name already exists' };
        }

        return { valid: true };
    }

    hasDuplicateName(newName, treeRoots, excludeUuid) {
        for (const root of treeRoots) {
            if (this.checkNodeForDuplicate(root, newName, excludeUuid)) {
                return true;
            }
        }
        return false;
    }

    checkNodeForDuplicate(node, newName, excludeUuid) {
        if (node.id !== excludeUuid && node.name === newName) {
            return true;
        }
        if (node.children && node.children.length > 0) {
            return node.children.some((child) =>
                this.checkNodeForDuplicate(child, newName, excludeUuid),
            );
        }
        return false;
    }

    getCharacter() {
        if (!this.characters || this.this_chid === undefined || this.this_chid === null) {
            throw new Error('Character not found');
        }

        const character = this.characters[this.this_chid];
        if (!character) {
            throw new Error('Character not found');
        }
        return character;
    }

    async fetchChat(character, chatName) {
        const response = await fetch('/api/chats/get', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.token,
            },
            body: JSON.stringify({
                ch_name: character.name,
                file_name: String(chatName).replace(/\.jsonl$/i, ''),
                avatar_url: character.avatar,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to load chat ${chatName}`);
        }

        return response.json();
    }

    async renameChatFile(character, oldName, newName) {
        const body = {
            is_group: false,
            avatar_url: character.avatar,
            original_file: `${String(oldName)}.jsonl`,
            renamed_file: `${String(newName).trim()}.jsonl`,
        };

        const response = await fetch('/api/chats/rename', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.token,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            let errorDetails = '';
            try {
                const errorData = await response.json();
                errorDetails = errorData.error || errorData.message || JSON.stringify(errorData);
            } catch {
                errorDetails = await response.text();
            }

            const errorString = String(errorDetails || 'Rename failed').toLowerCase();
            if (errorString === 'true' || errorString.includes('already exists')) {
                throw new Error('A chat with this name already exists');
            }
            if (errorString.includes('not found')) {
                throw new Error('Chat file not found');
            }
            if (errorString.includes('invalid') || errorString.includes('reserved')) {
                throw new Error(errorDetails);
            }
            throw new Error(errorDetails || `Rename failed: ${response.status}`);
        }

        const result = await response.json().catch(() => ({}));
        if (result?.error) {
            throw new Error(result.error || 'Server returned an error');
        }

        return result?.sanitizedFileName || null;
    }

    async saveChat(character, chatName, chatData) {
        const response = await fetch('/api/chats/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.token,
            },
            body: JSON.stringify({
                ch_name: character.name,
                file_name: chatName,
                chat: chatData,
                avatar_url: character.avatar,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to save metadata for ${chatName}`);
        }
    }

    async restoreMetadata(character, chatName, preservedMetadata) {
        if (!preservedMetadata || typeof preservedMetadata !== 'object') return;

        const chatData = await this.fetchChat(character, chatName);
        if (!Array.isArray(chatData) || chatData.length === 0 || typeof chatData[0] !== 'object') {
            return;
        }

        const header = chatData[0];
        const existingMetadata = (header.chat_metadata && typeof header.chat_metadata === 'object') ? header.chat_metadata : {};
        header.chat_metadata = {
            ...existingMetadata,
            ...preservedMetadata,
        };

        await this.saveChat(character, chatName, chatData);
    }

    async performRename(_nodeId, oldName, newName) {
        const character = this.getCharacter();
        const safeNewName = String(newName).trim();

        let preservedMetadata = null;
        try {
            const originalChat = await this.fetchChat(character, oldName);
            const originalHeader = Array.isArray(originalChat) && originalChat.length > 0 ? originalChat[0] : null;
            if (originalHeader && typeof originalHeader.chat_metadata === 'object') {
                preservedMetadata = { ...originalHeader.chat_metadata };
            }
        } catch {
            preservedMetadata = null;
        }

        await this.renameChatFile(character, oldName, safeNewName);
        await this.restoreMetadata(character, safeNewName, preservedMetadata);

        if (this.branchGraphService) {
            this.branchGraphService.invalidateCharacter(character.avatar);
        }
    }

    updateDependencies(dependencies) {
        if (dependencies.token !== undefined) this.token = dependencies.token;
        if (dependencies.characters !== undefined) {
            this.characters = dependencies.characters;
        }
        if (dependencies.this_chid !== undefined) {
            this.this_chid = dependencies.this_chid;
        }
        if (dependencies.branchGraphService !== undefined) {
            this.branchGraphService = dependencies.branchGraphService;
        }
    }
}
