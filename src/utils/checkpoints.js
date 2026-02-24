export function isCheckpointChatName(chatName) {
    return Boolean(chatName && String(chatName).includes('Checkpoint #'));
}

export function isCheckpointMetadata(chatMetadata) {
    void chatMetadata;
    return false;
}

export function isCheckpointChat(chatName, chatMetadata = null) {
    return isCheckpointChatName(chatName) || isCheckpointMetadata(chatMetadata);
}
