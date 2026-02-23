<p align="center">
  <img src="./logo.svg" alt="Chat Branches logo" width="760" />
</p>

<div align="center">

[Overview](#overview) - [Choose a Branch](#choose-a-branch) - [Requirements](#requirements) - [Installation](#installation) - [Usage](#usage) - [Settings](#settings) - [Limitations](#limitations) - [Performance](#performance) - [Troubleshooting](#troubleshooting) - [FAQ](#faq)

</div>

# Chat Branches (No-Plugin Branch)

This README is for:
- `ChatBranches-NoPlugin`

This branch runs fully in memory from chat metadata and does **not** require a server plugin.

## Overview

Chat Branches adds a branch graph/tree view for character chats in SillyTavern.

Key features:
- Interactive tree viewer with 3 layouts:
  - `Top Down`
  - `Horizontal Expansion`
  - `List`
- Expand/collapse controls for large trees
- Fast branch switching from tree nodes
- Rename chat files from tree nodes
- Message viewer popup for branch inspection
- Rebuild cache from current metadata (in-memory only)

## Choose a Branch

- Repository: https://github.com/spaceman2408/SillyTavern-ChatBranchesNew
- `master`: plugin-backed architecture (best for large-scale performance)
- `ChatBranches-NoPlugin`: plugin-free, in-memory architecture (this README)

## Requirements

- SillyTavern

No companion plugin is required on this branch.

## Installation

### Install from SillyTavern
1. Open **Extensions**.
2. Choose **Install Extension**.
3. Paste:
   - `https://github.com/spaceman2408/SillyTavern-ChatBranchesNew`
4. Switch extension branch to:
   - `ChatBranches-NoPlugin`
5. Reload extensions/page (or restart SillyTavern).
6. Enable **Chat Branches** in extension settings if it is disabled.

### Manual folder install
1. Place the extension at:
   - `public/scripts/extensions/third-party/SillyTavern-ChatBranchesNew`
2. Reload extensions/page (or restart SillyTavern).
3. Switch extension branch to:
   - `ChatBranches-NoPlugin`
4. Enable **Chat Branches** in extension settings if it is disabled.

## Usage

Open the tree from:
- Character actions toolbar (near `Create Branch`)
- Options menu (hamburger) under chat/file actions

Tree interactions:
- Double-click (or double-tap) a node to switch chats
- Click `+/-` to expand/collapse
- Right-click (or long-press) for context actions
- Pan inside the tree viewport
- Rename directly from node controls

## Settings

Open **Extensions -> Chat Branches**:
- `Enable extension`
- `Tree layout`:
  - Top Down
  - Horizontal Expansion
  - List
- `Reindex Cache` (rebuilds the in-memory relationship cache)

## Limitations

- Group chats are not supported
- Checkpoint chats are excluded from branch tracking/UUID injection
- Performance depends on chat count and metadata quality

## Performance

### Expectations
- Up to ~200 chats for the selected character: usually little to no slowdown
- Around 500+ chats for the selected character: indexing time becomes noticeable
- Around 1000+ chats for the selected character: strongly consider using `master` (plugin-backed)

This branch prioritizes plugin-free convenience, not maximum scale.

### My Specs and Timings

Tested on:
- `AMD Ryzen 7 9800X3D`
- `NVIDIA 5070 Ti`

Measured load times:
- Character under `200` chats: about `50-100 ms`
- Character around `700` chats: about `900 ms - 1.2 s`
- Character around `1000` chats: about `1.6 s - 1.9 s`
- Same `1000+` chat character on `master` (plugin-backed): about `40-60 ms` (near-instant)

On modest hardware (`Ryzen 3 3250U` laptop with `Radeon Graphics`), the same `~700` chat character took around `3.4 s`.

## Troubleshooting

### Tree missing expected branches
1. Confirm chats have valid branch metadata/UUID lineage where expected.
2. Run **Reindex Cache**.
3. Reopen the tree.

### Rename failed
- Name already exists
- Invalid filename chars: `< > : " / \ | ? *`
- Name starts with disallowed leading dot/space
- Name exceeds 255 chars

### Tree opens slowly on large characters
- This branch computes relationships in memory from available chat metadata.
- Large chat sets take longer to index and render.
- Practical guidance:
  - `~200` chats: usually fine
  - `500+` chats: expect noticeable slowdown
  - `1000+` chats: use `master` for better responsiveness

## FAQ

### Is this branch plugin-free?
Yes. `ChatBranches-NoPlugin` runs without the chat-branches server plugin.

### Why can large trees still feel slow?
The extension builds and renders relationships from chat metadata in memory. More chats and deeper trees require more processing and DOM work.

### Is this branch fast enough for me?
- Around `200` chats: usually fast enough
- Around `500+` chats: expect noticeable slowdown
- Around `1000+` chats: `master` is strongly recommended

### Will this branch damage or modify my old chats?
No. It uses existing chat metadata and works in memory. Standard branch metadata updates still happen for normal (non-checkpoint, non-group) character chats.

### Why does one character lag while others feel fine?
Tree cost is per character dataset. One character with deep branching and many chats can be much slower than characters with smaller histories.

### Can I stay on this branch and still improve responsiveness?
A little:
- Rename files less often
- Reindex less often
- Avoid swapping characters frequently

The longest bottleneck is chat file read speed, which depends heavily on your hardware.

### What does Reindex Cache do?
It rebuilds the extension's in-memory relationship cache from currently available chat metadata. It does not require or call a plugin.

### Why are checkpoint chats not shown in the branch tree?
Checkpoint chats are intentionally excluded from branch tracking and UUID injection guardrails.

### Which branch should I use?
- Use `ChatBranches-NoPlugin` for zero plugin dependency
- Use `master` for plugin-backed architecture and better large-scale responsiveness

## Quick Showcase

### Tree view
![Chat Branches View](https://i.imgur.com/kpAw0l6.png)

### Message viewer popup
![Chat View Popup](https://i.imgur.com/iUV8SVi.png)
