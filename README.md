<p align="center">
  <img src="./logo.svg" alt="Chat Branches logo" width="760" />
</p>

<div align="center">

[Main Features](#main-features) - [Requirements](#requirements) - [Installation](#installation) - [How to Use](#how-to-use) - [Settings](#settings) - [Troubleshooting](#troubleshooting)

</div>

# NOTE
While you are free to use this extension however you see fit, I originally made it for personal use, so it may be buggy or may not work for you. At the moment, it's not something I plan to release officially In ST cord. However, if you do use it and find issues, feel free to reach out to me. Otherwise, you are welcome to fork and modify it as needed, just don't forget the plugin as well.

To set expectations: this was 100% vibe-coded using Kiro and ~~Claude Opus~~ Rewrite was done with Codex 5.3. In this rewrite, I use SillyTavern's `getContext()` as the primary runtime interface, so extension behavior comes from context APIs/events rather than older direct imports.

> Currently DOES NOT support group chats

## Announcement

A new branch is available: `ChatBranches-NoPlugin`. This branch does not require the server plugin; it uses in-memory branch caches and manually reads chat files from disk.

After installation, you can switch to this branch in SillyTavern:
1. Go to **Manage Extensions**
2. Find **Chat Branches**
3. Click the **Branch** button
4. Select `ChatBranches-NoPlugin`

If you have characters with 1000+ chats, the plugin-based branch will be faster and is recommended for better performance.

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

If the plugin is not detected, tree actions and rebuild are disabled until it is available.

## Installation

### Extension
1. Install from inside SillyTavern:
**Extensions -> Install Extension -> paste repo link**
`https://github.com/spaceman2408/SillyTavern-ChatBranchesNew`
2. Or download and install with folder method:
`public/scripts/extensions/third-party/SillyTavern-ChatBranchesNew`
3. Delete old Chat Branches extension if you have it installed to avoid conflicts
4. Restart SillyTavern (or reload extensions/page)
5. Enable **Chat Branches** in Extensions settings (if not already enabled)

### Server Plugin
1. Install `chat-branches-plugin` by visiting its [repo](https://github.com/spaceman2408/chat-branches-plugin) and following the instructions
2. Restart SillyTavern server (you must restart the console not refresh the browser)
3. The extension will auto-detect plugin availability and enable controls

## How to Use

You can find the Chat Branches button in two places: 
  - In the character actions toolbar (next to the `Create Branch` button)
  - In the options menu (Hamburger icon) below `Manage Chat Files`


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

# Quick Showcase

### The main tree view
![Chat Branches View](https://i.imgur.com/kpAw0l6.png)

### The message viewer popup
![Chat View Popup](https://i.imgur.com/iUV8SVi.png)
