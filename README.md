# NOTE
While you are free to use this extension however you see fit, I originally made it for personal use, so it may be buggy or may not work for you. At the moment, it's not something I plan to release officially. However, if you do use it and find issues, feel free to reach out to me. Otherwise, you are welcome to fork and modify it as needed, just don't forget the plugin as well.

To set expectations: this was 100% vibe-coded using Kiro and Claude Opus.

> Currently DOES NOT support group chats

# Chat Branches Rewrite (v1.0.0)

This is the rewritten Chat Branches extension with a cleaner structure, smoother UI behavior, and full branch management for character chats.

- **Extension repo:** https://github.com/spaceman2408/SillyTavern-ChatBranchesNew

## What You Get

- Interactive branch tree for each character chat
- Quick branch switching by double-click or double-tap
- Rename chat files directly in the tree while keeping branch safety via unique UUID-based storage
- Message viewer popup so you can inspect a branch without leaving your current chat
- Rebuild Storage button for plugin index recovery
- Better plugin detection and clearer disabled states when plugin is offline
- Three tree layouts:
  - `Top Down`
  - `Horizontal Expansion` (curved connectors)
  - `List`

## Main Features

## Tree View
- Shows your branch history as a connected tree
- Highlights your currently active chat
- Expand/collapse nodes to keep large trees readable
- Right-click or long-press for actions:
  - View Messages
  - Expand All
  - Collapse All
  - Find Current Node
- Pan around large trees easily

## Requirements

This extension requires the companion server plugin:

- **Plugin repo:** https://github.com/spaceman2408/chat-branches-plugin
- **Plugin API base:** `/api/plugins/chat-branches-plugin`

If the plugin is not detected, tree actions and rebuild are disabled until it is available.

## Installation

### Extension
1. Or install from inside SillyTavern:
**Extensions -> Install Extension -> paste repo link**
`https://github.com/spaceman2408/SillyTavern-ChatBranchesNew`
2. Install with folder method:
`public/scripts/extensions/third-party/SillyTavern-ChatBranchesNew`
3. Restart SillyTavern (or reload extensions/page)
4. Enable **Chat Branches** in Extensions settings

### Server Plugin
1. Install `chat-branches-plugin`
2. Restart SillyTavern server
3. The extension will auto-detect plugin availability and enable controls

## Settings

Open **Extensions -> Chat Branches**:

- `Enable extension`
- `Tree layout`: Top Down / Horizontal Expansion / List
- `Rebuild Storage`
- `Install Plugin` helper (shown if plugin missing)

## Notes

- Group chats are not supported
- Checkpoint chats are excluded from tracking
- Your existing branch/chat storage remains compatible

## Limitations

- Group chats are not supported
- Checkpoint chats are excluded from branch tracking
- Plugin is required for full functionality

## Troubleshooting

### Plugin not detected
1. Confirm plugin install path and server startup logs
2. Restart SillyTavern server
3. Wait for auto health check or refresh once

### Tree missing expected branches
1. Confirm chats have UUID metadata
2. Run **Rebuild Storage**
3. Reopen tree view

### Rename failed
- Check for duplicate names
- Avoid invalid filename characters: `< > : " / \ | ? *`
- Can't start a name with a dot `.` or space
- Can't go over 255 characters
