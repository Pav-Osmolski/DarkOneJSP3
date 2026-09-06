"use strict";

suite('Scroll fade resource lifecycle', function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path('user-components-x64/foo_jscript_panel3/samples/js/common.js'), 'utf8');
    const start = source.indexOf('var _scroll_fade_surface =');
    const end = source.indexOf('function _writeTextLayoutWithScrollFade(', start);
    const images = [];
    const utils = {CreateImage(w, h) {
        const image = {w, h, disposed: 0,
            Dispose() { if (++this.disposed !== 1) throw new Error('Double disposal'); },
            GetGraphics() { return {Clear() {}, FillRectangle() {}}; },
            ReleaseGraphics() {},
        };
        images.push(image);
        return image;
    }};
    const api = new Function('utils', 'RGBA', source.slice(start, end) +
        '\nreturn {surface:_scrollFadeSurface, mask:_scrollFadeMask, dispose:_disposeScrollFadeResources};')(
        utils, (r,g,b,a) => a);
    api.surface(100, 80);
    api.mask(80, 12, true, false);
    const initialCount = images.length;
    for (let i = 0; i < 100; i++) {
        api.surface(100, 80);
        api.mask(80, 12, true, false);
    }
    if (images.length !== initialCount) throw new Error('Unchanged fade paint reallocated resources');
    for (let i = 1; i <= 100; i++) {
        api.surface(100 + i, 80);
        api.mask(80, 12, !!(i % 2), !(i % 2));
        if (images.filter(item => !item.disposed).length !== 2)
            throw new Error('Fade replacement retained obsolete native images');
    }
    api.dispose();
    api.dispose();
    if (images.some(item => item.disposed !== 1)) throw new Error('Fade unload cleanup was not exactly once');
    api.surface(200, 80);
    api.mask(80, 12, true, true);
    api.dispose();
    if (images.some(item => item.disposed !== 1)) throw new Error('Fade cache could not be safely recreated');
    // The panel wrapper is the common unload owner for every fade consumer.
    const panel = fs.readFileSync(__path('user-components-x64/foo_jscript_panel3/samples/js/panel.js'), 'utf8');
    if (!panel.includes('finally {\n\t\t\t\tif (typeof _disposeScrollFadeResources'))
        throw new Error('Panel unload no longer guarantees fade cleanup');
});
