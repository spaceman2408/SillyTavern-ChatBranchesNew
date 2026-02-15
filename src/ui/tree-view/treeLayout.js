export function getLayoutClass(layoutVariant) {
    const layout = layoutVariant || 'top-down';
    if (layout === 'horizontal') return 'tree-layout-horizontal';
    if (layout === 'list') return 'tree-layout-list';
    return 'tree-layout-top-down';
}

export function shouldDrawLines(layoutVariant) {
    const layout = layoutVariant || 'top-down';
    return layout === 'top-down' || layout === 'horizontal';
}

export function getVariantCssPath(extensionName, layoutVariant) {
    const safeLayout = ['top-down', 'horizontal', 'list'].includes(layoutVariant)
        ? layoutVariant
        : 'top-down';
    return `/scripts/extensions/third-party/${extensionName}/src/css/layout-${safeLayout}.css`;
}

export function ensureTreeStylesLoaded(extensionName, layoutVariant) {
    const baseHref = `/scripts/extensions/third-party/${extensionName}/src/css/chat-tree-base.css`;
    const variantHref = getVariantCssPath(extensionName, layoutVariant);

    let baseLink = $('#chat-tree-base-styles');
    if (!baseLink.length) {
        $('head').append(`<link id="chat-tree-base-styles" rel="stylesheet" href="${baseHref}">`);
        baseLink = $('#chat-tree-base-styles');
    } else {
        baseLink.attr('href', baseHref);
    }

    let variantLink = $('#chat-tree-layout-styles');
    if (!variantLink.length) {
        $('head').append(`<link id="chat-tree-layout-styles" rel="stylesheet" href="${variantHref}">`);
        variantLink = $('#chat-tree-layout-styles');
    } else {
        variantLink.attr('href', variantHref);
    }
}
