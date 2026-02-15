export function ensureAppendedOnce($parent, selector, html) {
    if ($parent.find(selector).length) return;
    $parent.append(html);
}

export function removeIfPresent(selector) {
    $(selector).remove();
}