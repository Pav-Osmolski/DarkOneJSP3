"use strict";
include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\shared.js');
var DARKONEJSP3_RESET_ROLE = "main-columns";

// Replaces Panel Stack Splitter 02: left information stack, centre artwork /
// spectrum column, and right playlist column.

var STARTUP_CONTROLLER_NAME = 'MainColumns';
var startupLayoutReady = false;
var dividerStateBroadcast = false;
var ww = 0;
var wh = 0;

var DIVIDER_MODE_PROPERTY = 'DARKONEJSP3.ART.SPECTRUM.DIVIDER.MODE';
var DIVIDER_CUSTOM_COLOUR_PROPERTY =
    'DARKONEJSP3.ART.SPECTRUM.DIVIDER.CUSTOM.COLOUR';

// 0 = transparent / inherit parent, 1 = black, 2 = DarkOne grey,
// 3 = custom (legacy), 4 = DarkOne dark grey, 5 = Columns UI global
// background. Keeping custom at 3 preserves existing properties.
var DIVIDER_TRANSPARENT = 0;
var DIVIDER_BLACK = 1;
var DIVIDER_DARKONE = 2;
var DIVIDER_CUSTOM = 3;
var DIVIDER_DARKONE_DARK = 4;
var DIVIDER_COLUMNS_UI = 5;

var MENU_STRING = 0x00000000;
var MENU_POPUP = 0x00000010;

var DIVIDER_MESSAGE_VERSION = 'v1';
var DIVIDER_QUERY_NOTIFICATION = 'DarkOneJSP3.ArtSpectrum.Divider.Query';
var DIVIDER_SET_NOTIFICATION = 'DarkOneJSP3.ArtSpectrum.Divider.Set';
var DIVIDER_STATE_NOTIFICATION = 'DarkOneJSP3.ArtSpectrum.Divider.State';

function signalStartupReady() {
    startupLayoutReady = true;
    window.NotifyOthers('DarkOneJSP3.Startup.Ready', STARTUP_CONTROLLER_NAME);
}

function opaqueColour(colour) {
    return 0xff000000 + ((Number(colour) >>> 0) & 0x00ffffff);
}

function colourToHex(colour) {
    var rgb = (Number(colour) >>> 0) & 0x00ffffff;
    var value = rgb.toString(16).toUpperCase();
    while (value.length < 6) value = '0' + value;
    return '#' + value;
}

function dividerMode() {
    return DOJSP3.clamp(
        Math.round(Number(window.GetProperty(
            DIVIDER_MODE_PROPERTY,
            DIVIDER_BLACK
        )) || 0),
        DIVIDER_TRANSPARENT,
        DIVIDER_COLUMNS_UI
    );
}

function columnsUiBackgroundColour() {
    try {
        return opaqueColour(window.GetColourCUI(3));
    } catch (e) {
        return DOJSP3.colours.bar;
    }
}

function dividerCustomColour() {
    return opaqueColour(window.GetProperty(
        DIVIDER_CUSTOM_COLOUR_PROPERTY,
        0xff000000
    ));
}

function dividerColour() {
    var mode = dividerMode();
    if (mode === DIVIDER_BLACK) return 0xff000000;
    if (mode === DIVIDER_DARKONE) return DOJSP3.colours.bar;
    if (mode === DIVIDER_DARKONE_DARK) return DOJSP3.colours.separator;
    if (mode === DIVIDER_COLUMNS_UI) return columnsUiBackgroundColour();
    if (mode === DIVIDER_CUSTOM) return dividerCustomColour();
    return null;
}

function dividerState() {
    return {
        mode: dividerMode(),
        customColour: dividerCustomColour()
    };
}

function serialiseDividerState(state) {
    return DIVIDER_MESSAGE_VERSION + '|' +
        String(state.mode) + '|' +
        String(state.customColour >>> 0);
}

function parseDividerStateMessage(data) {
    // JSplitter-to-JSplitter notifications are deliberately serialised. This
    // avoids relying on component-specific object marshalling and keeps the
    // state bridge independent from JScript Panel notification behaviour.
    if (data && typeof data === 'object') {
        return {
            mode: DOJSP3.clamp(
                Math.round(Number(data.mode) || 0),
                DIVIDER_TRANSPARENT,
                DIVIDER_COLUMNS_UI
            ),
            customColour: opaqueColour(data.customColour)
        };
    }

    var parts = String(data || '').split('|');
    if (parts.length !== 3 || parts[0] !== DIVIDER_MESSAGE_VERSION) return null;

    var mode = Number(parts[1]);
    var colour = Number(parts[2]);
    if (isNaN(mode) || isNaN(colour)) return null;

    return {
        mode: DOJSP3.clamp(
            Math.round(mode),
            DIVIDER_TRANSPARENT,
            DIVIDER_COLUMNS_UI
        ),
        customColour: opaqueColour(colour)
    };
}

function broadcastDividerState() {
    dividerStateBroadcast = true;
    window.NotifyOthers(
        DIVIDER_STATE_NOTIFICATION,
        serialiseDividerState(dividerState())
    );
}

function setDividerMode(mode) {
    mode = DOJSP3.clamp(
        Math.round(Number(mode) || 0),
        DIVIDER_TRANSPARENT,
        DIVIDER_COLUMNS_UI
    );
    window.SetProperty(DIVIDER_MODE_PROPERTY, mode);
    window.Repaint();
    broadcastDividerState();
}

function setCustomDividerColour(colour) {
    window.SetProperty(
        DIVIDER_CUSTOM_COLOUR_PROPERTY,
        opaqueColour(colour)
    );
    setDividerMode(DIVIDER_CUSTOM);
}

function chooseCustomDividerColour() {
    var current = dividerCustomColour();
    var chosen = null;
    try {
        if (utils && typeof utils.ColourPicker === 'function') {
            chosen = utils.ColourPicker(0, current);
        }
    } catch (e) {
        chosen = null;
    }
    if (chosen === null || typeof chosen === 'undefined' ||
            isNaN(Number(chosen))) return;
    setCustomDividerColour(chosen);
}

function layoutMainColumns() {
    if (ww <= 0 || wh <= 0) return;

    var info = DOJSP3.panel(DOJSP3.titles.infoStack);
    var art = DOJSP3.panel(DOJSP3.titles.artSpectrum);
    var playlist = DOJSP3.panel(DOJSP3.titles.playlist);

    // Align the upper side columns with the outer edges of the original
    // lower separator strips. The separator centres remain at the DarkOne
    // one-third positions and retain their original thickness.
    var px = Math.max(1, DOJSP3.idiv(ww, 640));
    var dividerCentre = DOJSP3.idiv(ww, 3);
    var leftWidth = DOJSP3.clamp(
        dividerCentre - px,
        1,
        Math.max(1, ww - 2)
    );
    var playlistLeft = DOJSP3.clamp(
        ww - dividerCentre + px,
        leftWidth + 1,
        Math.max(leftWidth + 1, ww - 1)
    );
    var artLeft = DOJSP3.clamp(leftWidth + px * 2, leftWidth, playlistLeft);
    var rightDivider = Math.max(artLeft, playlistLeft - px * 2);
    var artWidth = Math.max(1, rightDivider - artLeft);

    DOJSP3.move(info, 0, 0, leftWidth, wh);
    DOJSP3.move(art, artLeft, 0, artWidth, wh);
    DOJSP3.move(playlist, playlistLeft, 0, Math.max(1, ww - playlistLeft), wh);

    DOJSP3.show(info, true);
    DOJSP3.show(art, true);
    DOJSP3.show(playlist, true);

    if (!dividerStateBroadcast) broadcastDividerState();
    if (!startupLayoutReady && info && art && playlist) signalStartupReady();
}

function dividerMetrics() {
    var px = Math.max(1, DOJSP3.idiv(ww, 640));
    return {
        width: px * 2,
        left: DOJSP3.idiv(ww, 3) - px,
        right: ww - DOJSP3.idiv(ww, 3) - px
    };
}

function isDividerPoint(x) {
    var metrics = dividerMetrics();
    var targetWidth = Math.max(10, metrics.width);
    var padding = Math.ceil((targetWidth - metrics.width) / 2);
    return (x >= metrics.left - padding &&
            x < metrics.left + metrics.width + padding) ||
        (x >= metrics.right - padding &&
            x < metrics.right + metrics.width + padding);
}

function on_colours_changed() {
    window.Repaint();
}

function on_size(width, height) {
    ww = width;
    wh = height;
    layoutMainColumns();
}

function on_paint(gr) {
    // Continue the lower divider strips through the upper layout. Geometry is
    // fixed; only the fill is user-selectable. Transparent paints nothing so
    // the owning/root splitter background is inherited through the reserved
    // separator width.
    if (dividerMode() === DIVIDER_TRANSPARENT) return;

    gr.FillSolidRect(0, 0, ww, wh, DOJSP3.colours.bar);
    var colour = dividerColour();
    var metrics = dividerMetrics();
    gr.FillSolidRect(metrics.left, 0, metrics.width, wh, colour);
    gr.FillSolidRect(metrics.right, 0, metrics.width, wh, colour);
}

function on_notify_data(name, data) {
    if (name === DIVIDER_QUERY_NOTIFICATION) {
        broadcastDividerState();
        return;
    }

    if (name === DIVIDER_SET_NOTIFICATION) {
        var requestedState = parseDividerStateMessage(data);
        if (requestedState) {
            window.SetProperty(
                DIVIDER_CUSTOM_COLOUR_PROPERTY,
                requestedState.customColour
            );
            window.SetProperty(
                DIVIDER_MODE_PROPERTY,
                requestedState.mode
            );
            window.Repaint();
            broadcastDividerState();
        }
        return;
    }

    if (darkOneJsp3HandleReset(name, data)) return;
    if (name === 'DarkOneJSP3.Startup.QueryReady' && startupLayoutReady) {
        signalStartupReady();
    }
}

function on_mouse_rbtn_up(x, y) {
    // Child panels keep their native menus. The same menu can also be opened
    // directly from either exposed divider strip.
    if (!isDividerPoint(x)) return false;

    var menu = window.CreatePopupMenu();
    var colourMenu = window.CreatePopupMenu();

    colourMenu.AppendMenuItem(MENU_STRING, 100, 'Transparent / inherit parent');
    colourMenu.AppendMenuItem(MENU_STRING, 101, 'Black');
    colourMenu.AppendMenuItem(MENU_STRING, 102, 'DarkOne grey');
    colourMenu.AppendMenuItem(MENU_STRING, 103, 'DarkOne dark grey');
    colourMenu.AppendMenuItem(MENU_STRING, 105, 'Columns UI global background');
    colourMenu.AppendMenuItem(
        MENU_STRING,
        104,
        'Custom colour... (' + colourToHex(dividerCustomColour()) + ')'
    );
    var selectedDividerId = dividerMode() === DIVIDER_CUSTOM
        ? 104
        : (dividerMode() === DIVIDER_DARKONE_DARK
            ? 103
            : (dividerMode() === DIVIDER_COLUMNS_UI
                ? 105
                : 100 + dividerMode()));
    colourMenu.CheckMenuRadioItem(100, 105, selectedDividerId);
    colourMenu.AppendTo(menu, MENU_POPUP, 'Side divider colour');

    var id = menu.TrackPopupMenu(x, y);
    if (id === 100) setDividerMode(DIVIDER_TRANSPARENT);
    else if (id === 101) setDividerMode(DIVIDER_BLACK);
    else if (id === 102) setDividerMode(DIVIDER_DARKONE);
    else if (id === 103) setDividerMode(DIVIDER_DARKONE_DARK);
    else if (id === 104) chooseCustomDividerColour();
    else if (id === 105) setDividerMode(DIVIDER_COLUMNS_UI);

    return true;
}
