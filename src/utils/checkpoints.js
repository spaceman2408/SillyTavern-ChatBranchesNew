function normalizeBranchPoint(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function isCheckpointChatName(chatName) {
    return Boolean(chatName && String(chatName).includes('Checkpoint #'));
}

export function isCheckpointMetadata(chatMetadata) {
    if (!chatMetadata || typeof chatMetadata !== 'object') return false;

    // Checkpoints/bookmarks carry main_chat metadata but no parent lineage.
    const hasMainChat = Boolean(String(chatMetadata.main_chat || '').trim());
    if (!hasMainChat) return false;

    const hasParent = Boolean(String(chatMetadata.parent_uuid || '').trim());
    const hasBranchPoint = normalizeBranchPoint(chatMetadata.branch_point) !== null;
    return !hasParent && !hasBranchPoint;
}

export function isCheckpointChat(chatName, chatMetadata = null) {
    return isCheckpointChatName(chatName) || isCheckpointMetadata(chatMetadata);
}
