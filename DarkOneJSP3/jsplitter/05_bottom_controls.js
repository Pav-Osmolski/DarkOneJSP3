"use strict";
include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\shared.js');

// Replaces Panel Stack Splitter 05.

var startupReadiness = DarkOneProtocol.startup.createReadinessBridge(
    window,
    'BottomControls'
);
var ww = 0;
var wh = 0;
var qsX = 0;
var qsY = 0;
var qsW = 1;
var qsH = 1;

function layoutBottomControls() {
    if (ww <= 0 || wh <= 0) return;

    var left = DOJSP3.panel(DOJSP3.titles.controlsLeft);
    var quickSearch = DOJSP3.panel(DOJSP3.titles.quickSearch);
    var displayStack = DOJSP3.panel(DOJSP3.titles.displayStack);
    var right = DOJSP3.panel(DOJSP3.titles.controlsRight);

    var maximumSideWidth = Math.max(1, DOJSP3.idiv(Math.max(1, ww - 1), 2));
    var sideWidth = DOJSP3.clamp(DOJSP3.mulDiv(ww, 21, 64), 1, maximumSideWidth);
    var panelWidth = DOJSP3.clamp(DOJSP3.mulDiv(ww, 5, 16), 1, ww);
    var quickSearchOuterWidth = DOJSP3.clamp(
        DOJSP3.mulDiv(panelWidth, 7, 16),
        1,
        ww
    );
    var quickSearchHeight = DOJSP3.clamp(
        Math.max(DOJSP3.mulDiv(wh, 13, 64), 26),
        1,
        wh
    );
    var quickSearchTop = DOJSP3.clamp(
        wh - (DOJSP3.idiv(wh, 8) + quickSearchHeight),
        0,
        Math.max(0, wh - quickSearchHeight)
    );
    var displayHeight = DOJSP3.clamp(DOJSP3.mulDiv(ww, 3, 40), 1, wh);
    var displayTop = DOJSP3.clamp(
        DOJSP3.mulDiv(ww, 9, 640),
        0,
        Math.max(0, wh - displayHeight)
    );
    var displayLeft = DOJSP3.clamp(
        DOJSP3.idiv(ww - panelWidth, 2),
        0,
        Math.max(0, ww - panelWidth)
    );

    qsX = DOJSP3.clamp(DOJSP3.idiv(ww, 128) + 1, 0, Math.max(0, ww - 1));
    qsY = quickSearchTop;
    qsW = Math.min(Math.max(1, quickSearchOuterWidth), Math.max(1, ww - qsX));
    qsH = Math.min(Math.max(1, quickSearchHeight), Math.max(1, wh - qsY));

    var quickSearchLeft = DOJSP3.clamp(qsX + 2, 0, Math.max(0, ww - 1));
    var quickSearchChildTop = DOJSP3.clamp(quickSearchTop + 2, 0, Math.max(0, wh - 1));
    var quickSearchWidth = Math.min(
        Math.max(1, quickSearchOuterWidth - 4),
        Math.max(1, ww - quickSearchLeft)
    );
    var quickSearchChildHeight = Math.min(
        Math.max(1, quickSearchHeight - 4),
        Math.max(1, wh - quickSearchChildTop)
    );

    DOJSP3.move(left, 0, 0, sideWidth, DOJSP3.clamp(DOJSP3.mulDiv(wh, 5, 8), 1, wh));
    DOJSP3.move(quickSearch,
        quickSearchLeft,
        quickSearchChildTop,
        quickSearchWidth,
        quickSearchChildHeight);
    DOJSP3.move(displayStack, displayLeft, displayTop, panelWidth, displayHeight);
    DOJSP3.move(right, Math.max(0, ww - sideWidth), 0, sideWidth, wh);

    DOJSP3.show(left, true);
    DOJSP3.show(quickSearch, true);
    DOJSP3.show(displayStack, true);
    DOJSP3.show(right, true);

    if (!startupReadiness.isReady() && left && quickSearch && displayStack && right) {
        startupReadiness.signal();
    }
}

function on_size(width, height) {
    ww = width;
    wh = height;
    layoutBottomControls();
}

function on_paint(gr) {
    gr.FillSolidRect(0, 0, ww, wh, DOJSP3.colours.bar);

    var px = Math.max(1, DOJSP3.idiv(ww, 640));
    var leftDivider = DOJSP3.idiv(ww, 3) - px;
    var rightDivider = ww - DOJSP3.idiv(ww, 3) - px;
    gr.FillSolidRect(leftDivider, 0, px * 2, wh, DOJSP3.colours.separator);
    gr.FillSolidRect(rightDivider, 0, px * 2, wh, DOJSP3.colours.separator);

    // Match the original DarkOne2021/PSS Quick Search frame exactly:
    // a two-pixel #696969 border with a #1e1e1e interior. The native
    // Quick Search Toolbar must have its own frame set to None so it does
    // not add a second white/sunken border over this frame.
    gr.FillSolidRect(qsX, qsY, qsW, qsH, DOJSP3.colours.quickSearchBorder);
    gr.FillSolidRect(
        qsX + 2,
        qsY + 2,
        Math.max(1, qsW - 4),
        Math.max(1, qsH - 4),
        DOJSP3.colours.quickSearchFill
    );
}

function on_notify_data(name, data) {
    if (darkOneJsp3HandleReset(name, data)) return;
    startupReadiness.handle(name);
}
