"use strict";
include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\shared.js');
//
// v0.7.38 adds persistent standard/alternate main view modes, synchronised
// Spectrum visibility and atomic ArtSpectrum geometry/divider transitions.
//
// v0.7.37 separates selecting the remembered Custom divider colour from
// editing that stored colour through the native picker.
//
// v0.7.36 centralises divider state serialisation, notifications, mode values
// and menu mapping in the shared JSplitter protocol helper.

var DARKONEJSP3_RESET_ROLE = "main-columns";

// Replaces Panel Stack Splitter 02: left information stack, centre artwork /
// spectrum column, and right playlist column.
//
// v0.7.35 consolidates divider mode validation, menu mapping and custom
// colour picking through the shared DarkOneJSP3 colour helper.

var startupReadiness = DarkOneProtocol.startup.createReadinessBridge(
    window,
    'MainColumns'
);
var dividerStateBroadcast = false;
var ww = 0;
var wh = 0;

var MAIN_LAYOUT_MODE_PROPERTY = 'DARKONEJSP3.MAIN.LAYOUT.MODE';
var MAIN_LAYOUT_STANDARD = 0;
var MAIN_LAYOUT_ART_PLAYLIST = 1;

var ART_SPECTRUM_PREPARE_NOTIFICATION = 'DarkOneJSP3.ArtSpectrum.PrepareLayout';
var ART_SPECTRUM_MODE_QUERY_NOTIFICATION = 'DarkOneJSP3.ArtSpectrum.Mode.Query';
var ART_SPECTRUM_MODE_STATE_NOTIFICATION = 'DarkOneJSP3.ArtSpectrum.Mode.State';
var artSpectrumVisualiserVisible = true;
var artSpectrumModeKnown = false;

// Layout changes are applied synchronously with ArtSpectrum temporarily hidden.
// This prevents native child windows and host-owned divider strips from exposing
// an intermediate geometry while switching between the standard and alternate
// layouts.

var DIVIDER_MODE_PROPERTY = 'DARKONEJSP3.ART.SPECTRUM.DIVIDER.MODE';
var DIVIDER_CUSTOM_COLOUR_PROPERTY =
    'DARKONEJSP3.ART.SPECTRUM.DIVIDER.CUSTOM.COLOUR';

// Saved divider mode numbers are owned by the shared protocol. Custom remains
// mode 3 for compatibility with existing properties.
var DIVIDER_PROTOCOL = DarkOneProtocol.divider;
var DIVIDER_TRANSPARENT = DIVIDER_PROTOCOL.modes.transparent;
var DIVIDER_BLACK = DIVIDER_PROTOCOL.modes.black;
var DIVIDER_DARKONE = DIVIDER_PROTOCOL.modes.darkOne;
var DIVIDER_CUSTOM = DIVIDER_PROTOCOL.modes.custom;
var DIVIDER_DARKONE_DARK = DIVIDER_PROTOCOL.modes.darkOneDark;
var DIVIDER_COLUMNS_UI = DIVIDER_PROTOCOL.modes.columnsUi;
var DIVIDER_MENU_OPTIONS = DIVIDER_PROTOCOL.menuOptions(100);

var MENU_STRING = 0x00000000;
var MENU_POPUP = 0x00000010;


function mainLayoutMode() {
    var mode = Math.round(Number(window.GetProperty(MAIN_LAYOUT_MODE_PROPERTY, MAIN_LAYOUT_STANDARD)));
    return mode === MAIN_LAYOUT_ART_PLAYLIST ? mode : MAIN_LAYOUT_STANDARD;
}

function setMainLayoutMode(mode) {
    mode = mode === MAIN_LAYOUT_ART_PLAYLIST ? mode : MAIN_LAYOUT_STANDARD;
    if (mode === mainLayoutMode()) return;

    window.SetProperty(MAIN_LAYOUT_MODE_PROPERTY, mode);
    layoutMainColumns(mode, true);
    window.Repaint();
}

function toggleMainLayoutMode() {
    setMainLayoutMode(mainLayoutMode() === MAIN_LAYOUT_STANDARD
        ? MAIN_LAYOUT_ART_PLAYLIST
        : MAIN_LAYOUT_STANDARD);
}

function dividerMode() {
    return DIVIDER_PROTOCOL.normaliseMode(
        window.GetProperty(DIVIDER_MODE_PROPERTY, DIVIDER_BLACK)
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
    return DIVIDER_PROTOCOL.state(dividerMode(), dividerCustomColour());
}

function broadcastDividerState() {
    dividerStateBroadcast = true;
    window.NotifyOthers(
        DIVIDER_PROTOCOL.notifications.state,
        DIVIDER_PROTOCOL.serialiseState(dividerState())
    );
}

function setDividerMode(mode) {
    mode = DIVIDER_PROTOCOL.normaliseMode(mode);
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

function alternateArtWidth(baseWidth, dividerWidth) {
    var minimumPlaylistWidth = Math.max(1, DOJSP3.idiv(ww, 3));
    var maximumArtWidth = Math.max(1, ww - minimumPlaylistWidth - dividerWidth);

    // When Spectrum is hidden the visual column can use the complete main-area
    // height as its square side. This deliberately breaks away from the legacy
    // one-third grid: Album Art remains a full 1:1 square and Playlist simply
    // consumes the width that remains. With Spectrum visible, preserve the
    // established column width so the analyser retains useful vertical space.
    var preferred = artSpectrumVisualiserVisible ? baseWidth : wh;
    return DOJSP3.clamp(preferred, 1, maximumArtWidth);
}

function mainLayoutGeometry(modeOverride) {
    var px = Math.max(1, DOJSP3.idiv(ww, 640));
    var dividerWidth = px * 2;
    var dividerCentre = DOJSP3.idiv(ww, 3);
    var leftWidth = DOJSP3.clamp(
        dividerCentre - px,
        1,
        Math.max(1, ww - 2)
    );

    var layoutMode = modeOverride === MAIN_LAYOUT_ART_PLAYLIST
        ? MAIN_LAYOUT_ART_PLAYLIST
        : modeOverride === MAIN_LAYOUT_STANDARD
            ? MAIN_LAYOUT_STANDARD
            : mainLayoutMode();

    if (layoutMode === MAIN_LAYOUT_ART_PLAYLIST) {
        var artWidth = alternateArtWidth(leftWidth, dividerWidth);
        var playlistLeft = DOJSP3.clamp(
            artWidth + dividerWidth,
            artWidth + 1,
            Math.max(artWidth + 1, ww - 1)
        );
        return {
            mode: MAIN_LAYOUT_ART_PLAYLIST,
            px: px,
            dividerWidth: dividerWidth,
            artX: 0,
            artWidth: artWidth,
            playlistX: playlistLeft,
            playlistWidth: Math.max(1, ww - playlistLeft),
            dividerPositions: [artWidth]
        };
    }

    var playlistLeft = DOJSP3.clamp(
        ww - dividerCentre + px,
        leftWidth + 1,
        Math.max(leftWidth + 1, ww - 1)
    );
    var artLeft = DOJSP3.clamp(leftWidth + dividerWidth, leftWidth, playlistLeft);
    var rightDivider = Math.max(artLeft, playlistLeft - dividerWidth);
    return {
        mode: MAIN_LAYOUT_STANDARD,
        px: px,
        dividerWidth: dividerWidth,
        infoX: 0,
        infoWidth: leftWidth,
        artX: artLeft,
        artWidth: Math.max(1, rightDivider - artLeft),
        playlistX: playlistLeft,
        playlistWidth: Math.max(1, ww - playlistLeft),
        dividerPositions: [leftWidth, playlistLeft - dividerWidth]
    };
}

function prepareArtSpectrum(width, height) {
    // Pre-layout the Album Art/Spectrum grandchildren at the target host size.
    // Layout-mode transitions call this while the outer ArtSpectrum host is
    // temporarily hidden, so only final child geometry is ever exposed.
    window.NotifyOthers(
        ART_SPECTRUM_PREPARE_NOTIFICATION,
        String(Math.max(1, Math.round(width))) + '|' +
            String(Math.max(1, Math.round(height)))
    );
}

function layoutMainColumns(modeOverride, transition) {
    if (ww <= 0 || wh <= 0) return;

    var info = DOJSP3.panel(DOJSP3.titles.infoStack);
    var art = DOJSP3.panel(DOJSP3.titles.artSpectrum);
    var playlist = DOJSP3.panel(DOJSP3.titles.playlist);
    var geometry = mainLayoutGeometry(modeOverride);
    var hideArtDuringTransition = Boolean(transition && art);

    // ArtSpectrum contains native child windows. Hide only this outer host while
    // changing layouts, pre-layout its grandchildren at the final target size,
    // move every sibling with parent repainting suppressed, then expose the host
    // again. All operations complete in the same script callback, so Windows does
    // not get an opportunity to paint an old child/divider geometry in between.
    if (hideArtDuringTransition) DOJSP3.show(art, false);
    if (hideArtDuringTransition) prepareArtSpectrum(geometry.artWidth, wh);

    if (geometry.mode === MAIN_LAYOUT_ART_PLAYLIST) {
        DOJSP3.move(art, geometry.artX, 0, geometry.artWidth, wh);
        DOJSP3.move(playlist, geometry.playlistX, 0, geometry.playlistWidth, wh);
        DOJSP3.show(info, false);
        DOJSP3.show(playlist, true);
    } else {
        DOJSP3.move(info, geometry.infoX, 0, geometry.infoWidth, wh);
        DOJSP3.move(art, geometry.artX, 0, geometry.artWidth, wh);
        DOJSP3.move(playlist, geometry.playlistX, 0, geometry.playlistWidth, wh);
        DOJSP3.show(info, true);
        DOJSP3.show(playlist, true);
    }

    DOJSP3.show(art, true);

    if (!dividerStateBroadcast) broadcastDividerState();
    if (!startupReadiness.isReady() && info && art && playlist) {
        startupReadiness.signal();
    }
}

function dividerMetrics() {
    var geometry = mainLayoutGeometry();
    return {
        width: geometry.dividerWidth,
        positions: geometry.dividerPositions
    };
}

function isDividerPoint(x) {
    var metrics = dividerMetrics();
    var targetWidth = Math.max(10, metrics.width);
    var padding = Math.ceil((targetWidth - metrics.width) / 2);
    for (var i = 0; i < metrics.positions.length; i++) {
        var left = metrics.positions[i];
        if (x >= left - padding && x < left + metrics.width + padding) return true;
    }
    return false;
}

function on_colours_changed() {
    window.Repaint();
}

function on_size(width, height) {
    ww = width;
    wh = height;
    if (!artSpectrumModeKnown) {
        window.NotifyOthers(ART_SPECTRUM_MODE_QUERY_NOTIFICATION, true);
    }
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
    for (var i = 0; i < metrics.positions.length; i++) {
        gr.FillSolidRect(metrics.positions[i], 0, metrics.width, wh, colour);
    }
}

function on_notify_data(name, data) {
    if (name === ART_SPECTRUM_MODE_STATE_NOTIFICATION) {
        var visible = String(data) !== 'art-only';
        var changed = !artSpectrumModeKnown || visible !== artSpectrumVisualiserVisible;
        artSpectrumModeKnown = true;
        artSpectrumVisualiserVisible = visible;
        if (changed) {
            if (mainLayoutMode() === MAIN_LAYOUT_ART_PLAYLIST) {
                // Alternate geometry depends on whether Spectrum is present.
                // Apply the complete target layout synchronously so the right
                // divider moves with ArtSpectrum rather than one repaint later.
                layoutMainColumns(MAIN_LAYOUT_ART_PLAYLIST, true);
            }

            // The upper side dividers belong to DOJSP3.Main, not ArtSpectrum.
            // Repaint them after every visualiser state change even when standard
            // column geometry itself is unchanged. This prevents child-window
            // invalidation from leaving either standard divider visually erased.
            window.Repaint();
        }
        return;
    }

    if (name === DarkOneViewBridge.notification) {
        var viewCommand = DarkOneViewBridge.parseNotification(data);
        if (viewCommand === DarkOneViewBridge.commands.layoutToggle) {
            toggleMainLayoutMode();
            return;
        }
    }

    if (name === DIVIDER_PROTOCOL.notifications.query) {
        broadcastDividerState();
        return;
    }

    if (name === DIVIDER_PROTOCOL.notifications.set) {
        var requestedState = DIVIDER_PROTOCOL.parseState(data);
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
    startupReadiness.handle(name);
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
    colourMenu.AppendMenuSeparator();
    colourMenu.AppendMenuItem(MENU_STRING, 106, 'Set custom colour...');
    colourMenu.AppendTo(menu, MENU_POPUP, 'Side divider colour');

    var id = menu.TrackPopupMenu(x, y);
    var selected = DarkOneColour.optionForId(DIVIDER_MENU_OPTIONS, id);
    if (selected) {
        setDividerMode(selected.mode);
    } else if (id === 106) {
        chooseCustomDividerColour();
    }

    return true;
}
