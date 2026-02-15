# NOTE
While you are free to use this extension however you see fit, I originally made it for personal use, so it may be buggy or may not work for you. At the moment, it's not something I plan to release officially. However, if you do use it and find issues, feel free to reach out to me. Otherwise, you are welcome to fork and modify it as needed, just don't forget the plugin as well.

To set expectations: this was 100% vibe-coded using Kiro and Claude Opus. I know I don't use `getContext` as well as I could; I learned about that after most of the code was written and didn't feel like refactoring everything.

> Currently DOES NOT support group chats

# Chat Branches Rewrite (v1.0.0)

This is the rewritten Chat Branches extension, now organized as a modular `getContext()`-first codebase with full branch lifecycle support and plugin-backed tree performance.

- **Extension repo:** https://github.com/spaceman2408/SillyTavern-ChatBranchesNew

## What's New In 1.0

- Full rewrite with service/controller architecture
- `getContext()`-first runtime access (no legacy direct ST imports in extension flow)
- Preserved settings continuity via `extension_settings['SillyTavern-ChatBranches']`
- Improved plugin health handling (offline/online detection with adaptive polling)
- Rebuild Storage disabled when plugin is unavailable
- Tree layout variants:
  - `Top Down`
  - `Horizontal Expansion`
  - `List`

## Core Features

- Automatic UUID lifecycle on character chats:
  - `uuid`
  - `parent_uuid`
  - `root_uuid`
- Branch creation from message branch points with plugin registration
- Interactive tree view with active-node detection by UUID
- Inline rename flow with plugin + chat file synchronization
- Message viewer popup with chunked rendering for long chats
- Storage rebuild tool to rebuild plugin records from existing UUID-backed chats

## Requirements

This extension requires the companion server plugin:

- **Plugin repo:** https://github.com/spaceman2408/chat-branches-plugin
- **Plugin API base:** `/api/plugins/chat-branches-plugin`

Without the plugin:
- Chat Branches UI actions are disabled
- Rebuild Storage is disabled
- Install guidance is shown in settings

## Installation

## Extension
1. Place this folder in:
`public/scripts/extensions/third-party/SillyTavern-ChatBranchesNew`
2. Restart SillyTavern (or reload extensions/page)
3. Enable **Chat Branches** in Extensions settings

## Server Plugin
1. Install `chat-branches-plugin`
2. Restart SillyTavern server
3. The extension will auto-detect plugin availability and enable controls

## How It Works

## Runtime Model (`getContext`-first)
- Runtime state is read from `getContext()` snapshots
- Events are subscribed through `ctx.eventSource` + `ctx.eventTypes`
- Metadata and settings are persisted through context APIs (`saveMetadata`, `saveSettingsDebounced`)

## Data Flow
1. `BranchService` handles UUID assignment, rename sync, deletion sync, branch creation.
2. `PluginClient` handles plugin API calls, caching, and normalized error handling.
3. `TreeViewController` orchestrates tree loading/rendering and delegates behavior to tree modules.

## Tree View UX
- Double-click (or mobile double-tap) to switch chats
- Right-click/long-press context menu:
  - View Messages
  - Expand All
  - Collapse All
  - Find Current Node
- Expand/collapse nodes with per-node toggles
- Panning support for large trees
- Root selector for multi-root character histories

## Settings

Open **Extensions -> Chat Branches**:

- `Enable extension`
- `Tree layout`: Top Down / Horizontal Expansion / List
- `Rebuild Storage`
- `Install Plugin` helper (shown if plugin missing)

## Limitations

- Group chats are not supported
- Checkpoint chats are excluded from branch tracking
- Plugin is required for full functionality

## Project Structure

```text
SillyTavern-ChatBranchesNew/
├── manifest.json
├── index.js
├── index.html
└── src/
    ├── api/
    │   └── plugin-client.js
    ├── services/
    │   ├── branch-service.js
    │   ├── chat-service.js
    │   └── rebuild-service.js
    ├── state/
    │   └── store.js
    ├── ui/
    │   ├── button-manager.js
    │   ├── settings-panel.js
    │   ├── message-viewer/
    │   │   └── MessageViewerController.js
    │   └── tree-view/
    │       ├── TreeViewController.js
    │       ├── treeEvents.js
    │       ├── treeRender.js
    │       ├── treeModel.js
    │       ├── treeLineDrawer.js
    │       ├── treeLayout.js
    │       ├── treeRenameFlow.js
    │       ├── treeRootSelector.js
    │       ├── ContextMenu.js
    │       └── ChatRenameHandler.js
    ├── css/
    │   ├── styles.css
    │   ├── chat-tree-base.css
    │   ├── layout-top-down.css
    │   ├── layout-horizontal.css
    │   ├── layout-list.css
    │   └── message-viewer-popup.css
    ├── constants.js
    └── context.js
```

## Troubleshooting

## Plugin not detected
1. Confirm plugin install path and server startup logs
2. Restart SillyTavern server
3. Wait for auto health check or refresh once

## Tree missing expected branches
1. Confirm chats have UUID metadata
2. Run **Rebuild Storage**
3. Reopen tree view

## Rename failed
- Check for duplicate names
- Avoid invalid filename characters: `< > : " / \ | ? *`
- Can't start a name with a dot `.` or space
- Can't go over 255 characters
