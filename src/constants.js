export const EXTENSION_NAME = 'SillyTavern-ChatBranches';
export const SETTINGS_KEY = 'SillyTavern-ChatBranches';
export const PLUGIN_BASE_URL = '/api/plugins/chat-branches-plugin';
export const PLUGIN_REPO_URL = 'https://github.com/spaceman2408/chat-branches-plugin';

export const DEFAULT_SETTINGS = {
    enabled: true,
    ui: {
        autoInjectButtons: true,
    },
    diagnostics: {
        verbose: false,
    },
};

export const TREE_CACHE_TTL_MS = 5000;
export const BRANCH_CACHE_TTL_MS = 5000;