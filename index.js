import { EXTENSION_NAME, GRAPH_CACHE_TTL_MS } from './src/constants.js';
import { ctxSnapshot, ensureSettings } from './src/context.js';
import { createStore } from './src/state/store.js';
import { BranchService } from './src/services/branch-service.js';
import { BranchGraphService } from './src/services/branch-graph-service.js';
import { ChatService } from './src/services/chat-service.js';
import { RebuildService } from './src/services/rebuild-service.js';
import { SettingsPanel } from './src/ui/settings-panel.js';
import { ButtonManager } from './src/ui/button-manager.js';
import { TreeViewController } from './src/ui/tree-view/TreeViewController.js';

const LOG_PREFIX = '[Chat Branches]';
const logInfo = (message, meta = null) => {
    if (meta) {
        console.info(`${LOG_PREFIX} ${message}`, meta);
        return;
    }
    console.info(`${LOG_PREFIX} ${message}`);
};

const store = createStore();
const settings = ensureSettings();

const getSettings = () => settings;

const chatService = new ChatService();
const branchGraphService = new BranchGraphService({
    store,
    chatService,
    ttlMs: GRAPH_CACHE_TTL_MS,
});

const branchService = new BranchService({
    settingsProvider: getSettings,
    branchGraphService,
});

const rebuildService = new RebuildService({
    branchGraphService,
    getSettings,
});

function treeDependencies() {
    const snapshot = ctxSnapshot();
    return {
        characters: snapshot.ctx.characters,
        this_chid: snapshot.characterId,
        token: snapshot.ctx.getRequestHeaders()['X-CSRF-Token'],
        openCharacterChat: snapshot.ctx.openCharacterChat,
        extensionName: `${EXTENSION_NAME}New`,
        branchGraphService,
        selected_group: snapshot.groupId,
        chat: snapshot.chat,
        saveChat: snapshot.ctx.saveChat,
        chat_metadata: snapshot.chatMetadata,
        layoutVariant: settings.ui?.treeLayout || 'top-down',
    };
}

const treeView = new TreeViewController(treeDependencies());

const settingsPanel = new SettingsPanel({
    getSettings,
    onToggleEnabled: async (enabled) => {
        settings.enabled = enabled;
        const { ctx } = ctxSnapshot();
        ctx.saveSettingsDebounced();

        if (enabled) {
            await branchService.ensureChatUUID();
        }

        treeView.updateDependencies(treeDependencies());
        buttonManager.injectOptionsButton();
        buttonManager.injectMessageButtons();
    },
    onRebuild: async () => rebuildService.showRebuildDialog(),
    onLayoutChange: async (layoutVariant) => {
        settings.ui.treeLayout = layoutVariant;
        const { ctx } = ctxSnapshot();
        ctx.saveSettingsDebounced();
        treeView.updateDependencies(treeDependencies());
        treeView.applyLayoutVariant();
    },
});

const buttonManager = new ButtonManager({
    getSettings,
    onOpenTreeView: async () => {
        treeView.updateDependencies(treeDependencies());
        await treeView.show();
    },
    onCreateBranch: async (mesId) => branchService.createBranchWithUUID(mesId),
});

let lastCharacterAvatar = null;

function applyUiState() {
    settingsPanel.refresh();
    buttonManager.injectOptionsButton();
    buttonManager.injectMessageButtons();
}

function invalidateCurrentCharacterGraph() {
    const snapshot = ctxSnapshot();
    const avatar = snapshot.character?.avatar;
    if (!avatar) return;
    branchGraphService.invalidateCharacter(avatar);
}

function syncCharacterSwapInvalidation() {
    const snapshot = ctxSnapshot();
    const currentAvatar = snapshot.character?.avatar || null;

    if (lastCharacterAvatar && currentAvatar && lastCharacterAvatar !== currentAvatar) {
        branchGraphService.invalidateCharacter(lastCharacterAvatar);
    }

    lastCharacterAvatar = currentAvatar;
}

function registerEvents() {
    const { ctx } = ctxSnapshot();
    const source = ctx.eventSource;
    const events = ctx.eventTypes;

    source.on(events.CHAT_CREATED, async () => {
        await branchService.ensureChatUUID();
        invalidateCurrentCharacterGraph();
    });

    source.on(events.CHAT_CHANGED, async () => {
        const before = ctxSnapshot();

        syncCharacterSwapInvalidation();
        await branchService.ensureChatUUID();
        invalidateCurrentCharacterGraph();

        const after = ctxSnapshot();
        logInfo(`Chat changed to "${after.chatName || '(unknown)'}"`, {
            uuid: after.chatMetadata?.uuid || null,
            previousChat: before.chatName || null,
            previousUuid: before.chatMetadata?.uuid || null,
        });

        treeView.updateDependencies(treeDependencies());
        buttonManager.injectOptionsButton();
        buttonManager.onMessageEvent();
    });

    source.on(events.CHAT_LOADED, () => {
        syncCharacterSwapInvalidation();
    });

    source.on(events.CHARACTER_PAGE_LOADED, () => {
        syncCharacterSwapInvalidation();
    });

    source.on(events.CHAT_RENAMED, async (name) => {
        await branchService.syncRename(name);
        invalidateCurrentCharacterGraph();

        const snapshot = ctxSnapshot();
        logInfo(`Chat rename synced: "${name || snapshot.chatName || '(unknown)'}"`, {
            uuid: snapshot.chatMetadata?.uuid || null,
        });
    });

    source.on(events.CHAT_DELETED, async (chatName) => {
        await branchService.handleChatDeleted(chatName);
    });

    source.on(events.CHARACTER_DELETED, async (data) => {
        await branchService.handleCharacterDeleted(data);
    });

    source.on(events.CHARACTER_RENAMED, async (oldAvatar, newAvatar) => {
        if (oldAvatar) branchGraphService.invalidateCharacter(String(oldAvatar));
        if (newAvatar) branchGraphService.invalidateCharacter(String(newAvatar));
    });

    source.on(events.MESSAGE_RECEIVED, () => buttonManager.onMessageEvent());
    source.on(events.MESSAGE_SENT, () => buttonManager.onMessageEvent());
    source.on(events.MESSAGE_UPDATED, () => buttonManager.onMessageEvent());
}

jQuery(async () => {
    await settingsPanel.mount();
    buttonManager.bind();
    registerEvents();

    treeView.updateDependencies(treeDependencies());
    syncCharacterSwapInvalidation();
    await branchService.ensureChatUUID();

    applyUiState();
});
