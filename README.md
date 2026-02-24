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

---

##  Which Version Should I Use?

There are two ways to run Chat Branches. **When you install the extension, you get the default (master) version**, which requires a companion server plugin. If you don't want to set up the plugin, you can switch to the no-plugin version after installing.

| | Default (`master`) | `ChatBranches-NoPlugin` |
|---|---|---|
| **Server plugin required?** | ✅ Yes | ❌ No |
| **Setup difficulty** | A bit more work | Easier |
| **Best for large chat libraries (1000+ chats)?** | ✅ Yes, faster | ⚠️ May be significantly slower |

**Not sure which to pick?**
- If you don't want to install anything extra → use `ChatBranches-NoPlugin`
- If you have a lot of chats and want the best performance → use the default with the plugin

### Switching to the No-Plugin Version

After installing Chat Branches, you can switch to the no-plugin version at any time:

1. In SillyTavern, go to **Extensions → Manage Extensions**
2. Find **Chat Branches** in the list
3. Click the **Branch** button next to it
4. Select **`ChatBranches-NoPlugin`** from the dropdown
5. **Reload SillyTavern** for the change to take effect

For more details on how the no-plugin version works, see the `ChatBranches-NoPlugin` branch README:
https://github.com/spaceman2408/SillyTavern-ChatBranchesNew/tree/ChatBranches-NoPlugin

---

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

When you install Chat Branches, the default version (`master`) requires the companion server plugin for full functionality. If you'd prefer not to use the plugin, see [Switching to the No-Plugin Version](#switching-to-the-no-plugin-version) above.

- **Plugin repo:** https://github.com/spaceman2408/chat-branches-plugin

Without the plugin installed and running on the default (`master`) version, all Chat Branches controls remain disabled until it is installed and detected.

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

> **Don't want to use the plugin?** After installing, follow the steps in [Switching to the No-Plugin Version](#switching-to-the-no-plugin-version) above, then you're done! No plugin setup needed.

### Server Plugin (Required for default (`master`) branch only)
1. Install `chat-branches-plugin` by visiting its [repo](https://github.com/spaceman2408/chat-branches-plugin) and following the instructions
2. Restart SillyTavern server (you must restart the console, not just refresh the browser)
3. Chat Branches will auto-detect the plugin and enable all controls

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
- `ChatBranches-NoPlugin` may be slower on very large chat libraries (1000+ chats)

## Troubleshooting

### Plugin not detected
1. Confirm plugin install path and server startup logs
2. Restart SillyTavern server (console restart, not browser refresh)
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
