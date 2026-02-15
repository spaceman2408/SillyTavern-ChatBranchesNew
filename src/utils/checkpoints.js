export function isCheckpointChat(chatName) {
    return Boolean(chatName && String(chatName).includes('Checkpoint #'));
}