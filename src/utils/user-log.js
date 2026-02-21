const recentMessages = new Map();

function shouldLog(dedupeKey, dedupeMs) {
    if (!dedupeKey || !dedupeMs || dedupeMs <= 0) return true;
    const now = Date.now();
    const last = recentMessages.get(dedupeKey) || 0;
    if (now - last < dedupeMs) return false;
    recentMessages.set(dedupeKey, now);
    return true;
}

function getConsoleMethod(level) {
    if (level === 'error') return console.error;
    if (level === 'warn') return console.warn;
    return console.info;
}

function getToastMethod(level) {
    if (level === 'error') return toastr.error;
    if (level === 'warn') return toastr.warning;
    if (level === 'success') return toastr.success;
    return toastr.info;
}

function write(level, message, options = {}) {
    const title = options.title || 'Chat Branches';
    const dedupeKey = options.dedupeKey || null;
    const dedupeMs = Number(options.dedupeMs || 0);
    if (!shouldLog(dedupeKey, dedupeMs)) return;

    const consoleMethod = getConsoleMethod(level);
    consoleMethod(`[ChatBranches] ${message}`);

    if (options.toast) {
        const toastMethod = getToastMethod(level);
        toastMethod(message, title);
    }
}

export const userLog = {
    info: (message, options = {}) => write('info', message, options),
    success: (message, options = {}) => write('success', message, options),
    warn: (message, options = {}) => write('warn', message, options),
    error: (message, options = {}) => write('error', message, options),
};

