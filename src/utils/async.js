export function debounce(fn, waitMs = 100) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), waitMs);
    };
}

export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTimeout(task, timeoutMs = 5000, timeoutMessage = 'Request timed out') {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });

    try {
        return await Promise.race([task, timeout]);
    } finally {
        clearTimeout(timer);
    }
}