import { EXTENSION_NAME, PLUGIN_BASE_URL } from './src/constants.js';
import { ctxSnapshot, ensureSettings } from './src/context.js';
import { createStore } from './src/state/store.js';
import { PluginClient } from './src/api/plugin-client.js';
import { BranchService } from './src/services/branch-service.js';
import { ChatService } from './src/services/chat-service.js';
import { RebuildService } from './src/services/rebuild-service.js';
import { SettingsPanel } from './src/ui/settings-panel.js';
import { ButtonManager } from './src/ui/button-manager.js';
import { TreeViewController } from './src/ui/tree-view/TreeViewController.js';

const store = createStore();
const settings = ensureSettings();

const getSettings = () => settings;

const pluginClient = new PluginClient({
    baseUrl: PLUGIN_BASE_URL,
    store,
    settingsProvider: getSettings,
});

const chatService = new ChatService();
const branchService = new BranchService({
    pluginClient,
    settingsProvider: getSettings,
});
const rebuildService = new RebuildService({
    pluginClient,
    chatService,
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
        pluginBaseUrl: PLUGIN_BASE_URL,
        selected_group: snapshot.groupId,
        chat: snapshot.chat,
        saveChat: snapshot.ctx.saveChat,
        chat_metadata: snapshot.chatMetadata,
    };
}

const treeView = new TreeViewController(treeDependencies());

const settingsPanel = new SettingsPanel({
    getSettings,
    pluginClient,
    store,
    onToggleEnabled: async (enabled) => {
        settings.enabled = enabled;
        const { ctx } = ctxSnapshot();
        ctx.saveSettingsDebounced();
    },
    onRebuild: async () => rebuildService.showRebuildDialog(),
});

const buttonManager = new ButtonManager({
    getSettings,
    pluginClient,
    onOpenTreeView: async () => {
        if (!store.pluginRunning) {
            toastr.error('Chat Branches plugin is not installed or not running.', 'Plugin Error');
            return;
        }
        treeView.updateDependencies(treeDependencies());
        await treeView.show();
    },
    onCreateBranch: async (mesId) => branchService.createBranchWithUUID(mesId),
});

function applyPluginStateToUi() {
    settingsPanel.refresh();
    buttonManager.injectOptionsButton();
    buttonManager.injectMessageButtons();
}

function startPluginHealthWatcher() {
    let previous = store.pluginRunning;
    let offlineDelayMs = 5000;

    const runCheck = async () => {
        await pluginClient.healthCheck();
        const isOnline = store.pluginRunning;

        if (isOnline) {
            offlineDelayMs = 5000;
        } else {
            offlineDelayMs = Math.min(offlineDelayMs * 2, 60000);
        }

        if (store.pluginRunning !== previous) {
            previous = isOnline;
            applyPluginStateToUi();
            if (isOnline) {
                toastr.success('Chat Branches plugin detected. Extension controls are now available.', 'Plugin Ready');
            } else {
                toastr.warning('Chat Branches plugin went offline. Extension controls were disabled.', 'Plugin Offline');
            }
        }

        const nextDelay = isOnline ? 30000 : offlineDelayMs;
        setTimeout(runCheck, nextDelay);
    };

    setTimeout(runCheck, store.pluginRunning ? 30000 : 5000);
}

function registerEvents() {
    const { ctx } = ctxSnapshot();
    const source = ctx.eventSource;
    const events = ctx.eventTypes;

    source.on(events.CHAT_CREATED, () => branchService.ensureChatUUID());
    source.on(events.CHAT_CHANGED, async () => {
        await branchService.ensureChatUUID();
        await branchService.syncChangedChatName();
        treeView.updateDependencies(treeDependencies());
        buttonManager.injectOptionsButton();
        buttonManager.onMessageEvent();
    });
    source.on(events.CHAT_RENAMED, (name) => branchService.syncRename(name));
    source.on(events.CHAT_DELETED, (chatName) => branchService.handleChatDeleted(chatName));
    source.on(events.CHARACTER_DELETED, (data) => branchService.handleCharacterDeleted(data));

    source.on(events.MESSAGE_RECEIVED, () => buttonManager.onMessageEvent());
    source.on(events.MESSAGE_SENT, () => buttonManager.onMessageEvent());
    source.on(events.MESSAGE_UPDATED, () => buttonManager.onMessageEvent());
}

jQuery(async () => {
    await pluginClient.healthCheck();

    await settingsPanel.mount();
    buttonManager.bind();
    registerEvents();
    startPluginHealthWatcher();

    treeView.updateDependencies(treeDependencies());
    await branchService.ensureChatUUID();

    applyPluginStateToUi();
});
