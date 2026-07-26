"use strict";
include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\shared.js');
var DARKONEJSP3_RESET_ROLE = "main-columns";

// Replaces Panel Stack Splitter 02: left information stack, centre artwork /
// spectrum column, and right playlist column.
//
// v0.7.35 consolidates divider mode validation, menu mapping and custom
// colour picking through the shared DarkOneJSP3 colour helper.

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
var DIVIDER_MODES = [
    DIVIDER_TRANSPARENT,
    DIVIDER_BLACK,
    DIVIDER_DARKONE,
    DIVIDER_CUSTOM,
    DIVIDER_DARKONE_DARK,
    DIVIDER_COLUMNS_UI
];
var DIVIDER_MENU_OPTIONS = [
    { id: 100, mode: DIVIDER_TRANSPARENT, label: 'Transparent / inherit parent' },
    { id: 101, mode: DIVIDER_BLACK, label: 'Black' },
    { id: 102, mode: DIVIDER_DARKONE, label: 'DarkOne grey' },
    { id: 103, mode: DIVIDER_DARKONE_DARK, label: 'DarkOne dark grey' },
    { id: 105, mode: DIVIDER_COLUMNS_UI, label: 'Columns UI global background' },
    { id: 104, mode: DIVIDER_CUSTOM, custom: true }
];

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

function dividerMode() {
    return DarkOneColour.normaliseMode(
        window.GetProperty(DIVIDER_MODE_PROPERTY, DIVIDER_BLACK),
        DIVIDER_MODES,
        DIVIDER_BLACK
    );
}

function dividerCustomColour() {
    return DarkOneColour.opaque(window.GetProperty(
        DIVIDER_CUSTOM_COLOUR_PROPERTY,
        0xff000000
    ));
}

function dividerColour() {
    var mode = dividerMode();
    if (mode === DIVIDER_BLACK) return 0xff000000;
    if (mode === DIVIDER_DARKONE) return DOJSP3.colours.bar;
    if (mode === DIVIDER_DARKONE_DARK) return DOJSP3.colours.separator;
    if (mode === DIVIDER_COLUMNS_UI) return DarkOneColour.columnsUi(3, DOJSP3.colours.bar);
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
            mode: DarkOneColour.normaliseMode(
                data.mode,
                DIVIDER_MODES,
                DIVIDER_BLACK
            ),
            customColour: DarkOneColour.opaque(data.customColour)
        };
    }

    var parts = String(data || '').split('|');
    if (parts.length !== 3 || parts[0] !== DIVIDER_MESSAGE_VERSION) return null;

    var mode = Number(parts[1]);
    var colour = Number(parts[2]);
    if (isNaN(mode) || isNaN(colour)) return null;

    return {
        mode: DarkOneColour.normaliseMode(
            mode,
            DIVIDER_MODES,
            DIVIDER_BLACK
        ),
        customColour: DarkOneColour.opaque(colour)
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
    mode = DarkOneColour.normaliseMode(mode, DIVIDER_MODES, DIVIDER_BLACK);
    window.SetProperty(DIVIDER_MODE_PROPERTY, mode);
    window.Repaint();
    broadcastDividerState();
}

function setCustomDividerColour(colour) {
    window.SetProperty(
        DIVIDER_CUSTOM_COLOUR_PROPERTY,
        DarkOneColour.opaque(colour)
    );
    setDividerMode(DIVIDER_CUSTOM);
}

function chooseCustomDividerColour() {
    var chosen = DarkOneColour.pickJsplitter(
        dividerCustomColour(),
        window.Name,
        'Enter a side-divider colour as #RRGGBB or R,G,B.'
    );
    if (chosen === null) return;
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

    DarkOneColour.appendRadioOptions(
        colourMenu,
        DIVIDER_MENU_OPTIONS,
        dividerMode(),
        dividerCustomColour(),
        MENU_STRING
    );
    colourMenu.AppendTo(menu, MENU_POPUP, 'Side divider colour');

    var id = menu.TrackPopupMenu(x, y);
    var selected = DarkOneColour.optionForId(DIVIDER_MENU_OPTIONS, id);
    if (selected) {
        if (selected.custom) chooseCustomDividerColour();
        else setDividerMode(selected.mode);
    }

    return true;
}
