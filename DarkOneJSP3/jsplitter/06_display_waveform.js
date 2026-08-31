"use strict";
include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\shared.js');
var DARKONEJSP3_RESET_ROLE = "display-waveform";

// Replaces Panel Stack Splitter 06.
//
// Version history (newest first):
// v0.3.15 accepts the extended Bottom-area geometry message used to align
// Quick Search gradients while preserving the earlier three-field shape.
//
// v0.3.14 preserves the shared Soft-depth edge when extreme vertical resizing
// moves this opaque host into the parent's four-row in-place depth stack.
//
// v0.3.13 carries the shared optional bottom-area gradient through the
// Automatic host backing used by transparent Waveform Minibar surfaces and
// aligns its colour stops with the owning bottom-area coordinate space.
//
// v0.3.12 opts the native Waveform Minibar child into JSplitter's
// pseudo-transparency support so the component's Transparent background mode
// can reveal this host's resolved backing instead of the native black fallback.
//
// v0.3.11 coordinates Automatic Bottom-area background changes with the
// shared JSP3/JSplitter apply timestamp so composite colour updates land together.
//
// v0.3.10 separates selecting the remembered Custom host colour from editing
// that stored colour through the native picker.
//
// v0.3.9 adds Automatic as the default host-background mode. Automatic follows
// the shared Bottom area background without adding another runtime-file poller;
// Bottom Controls relays changed state inside the JSplitter notification domain.
//
// v0.3.8 consolidates background-mode validation, menu mapping and custom
// colour picking through the shared DarkOneJSP3 colour helper.
//
// v0.3.7 keeps the child hidden briefly when playback starts from a stopped
// state, preventing Waveform Minibar's previous cached waveform flashing before
// the newly selected track has been processed.
//
// v0.3.4 fixes the unpainted 20 px strip above Waveform Minibar, removes
// the accidental one-pixel frame line, adds a persistent host-background
// selector and can force the native waveform child blank when playback stops.

var startupReadiness = DarkOneProtocol.startup.createReadinessBridge(
    window,
    'DisplayWaveform'
);

var ww = 0;
var wh = 0;
var waveformTop = 0;
var waveformSpacerHeight = 20;

var BACKGROUND_MODE_PROPERTY = 'DarkOneJSP3.DisplayWaveform.BackgroundMode';
var BACKGROUND_COLOUR_PROPERTY = 'DarkOneJSP3.DisplayWaveform.BackgroundColour';
var HIDE_ON_STOP_PROPERTY = 'DarkOneJSP3.DisplayWaveform.HideWhenStopped';
var REVEAL_DELAY_PROPERTY = 'DarkOneJSP3.DisplayWaveform.NewTrackRevealDelay';

var BOTTOM_AREA_PROTOCOL = DarkOneProtocol.bottomArea;
var BOTTOM_AREA_STATE_FILE = fb.ProfilePath + 'js_data\\darkonejsp3.bottom-area-state.txt';
var BOTTOM_AREA_LEGACY_STATE_FILE = fb.ProfilePath + 'DarkOneJSP3\\shared\\bottom-area-state.txt';
var BOTTOM_AREA_GEOMETRY_VERSION = 'v2';
var BOTTOM_AREA_GEOMETRY_QUERY = 'DarkOneJSP3.BottomArea.Geometry.Query';
var BOTTOM_AREA_GEOMETRY_STATE = 'DarkOneJSP3.BottomArea.Geometry.State';

var revealTimer = 0;
var bottomAreaCommitTimer = 0;
var bottomAreaCommitId = '';
var waveformVisible = null;
var hiddenAfterStop = hideWhenStopped() && !fb.IsPlaying;
var bottomAreaGradientHeight = 1;
var bottomAreaGradientOffsetY = 0;

// 0 = transparent / inherit parent, 1 = black, 2 = DarkOne grey,
// 3 = custom (legacy), 4 = DarkOne dark grey, 5 = Columns UI global
// background, 6 = Automatic / shared Bottom area background. Keeping custom
// at 3 preserves existing properties. Existing explicit modes remain unchanged.
var BACKGROUND_TRANSPARENT = 0;
var BACKGROUND_BLACK = 1;
var BACKGROUND_DARKONE = 2;
var BACKGROUND_CUSTOM = 3;
var BACKGROUND_DARKONE_DARK = 4;
var BACKGROUND_COLUMNS_UI = 5;
var BACKGROUND_AUTOMATIC = 6;
var BACKGROUND_MODES = [
    BACKGROUND_TRANSPARENT,
    BACKGROUND_BLACK,
    BACKGROUND_DARKONE,
    BACKGROUND_CUSTOM,
    BACKGROUND_DARKONE_DARK,
    BACKGROUND_COLUMNS_UI,
    BACKGROUND_AUTOMATIC
];
var BACKGROUND_MENU_OPTIONS = [
    { id: 106, mode: BACKGROUND_AUTOMATIC, label: 'Automatic - Bottom area background' },
    { id: 100, mode: BACKGROUND_TRANSPARENT, label: 'Transparent / inherit parent' },
    { id: 101, mode: BACKGROUND_BLACK, label: 'Black' },
    { id: 102, mode: BACKGROUND_DARKONE, label: 'DarkOne grey' },
    { id: 104, mode: BACKGROUND_DARKONE_DARK, label: 'DarkOne dark grey' },
    { id: 105, mode: BACKGROUND_COLUMNS_UI, label: 'Columns UI global background' },
    { id: 103, mode: BACKGROUND_CUSTOM, custom: true }
];

var MENU_STRING = 0x00000000;
var MENU_POPUP = 0x00000010;

function defaultBottomAreaState() {
    return BOTTOM_AREA_PROTOCOL.state(
        BOTTOM_AREA_PROTOCOL.defaults.backgroundMode,
        BOTTOM_AREA_PROTOCOL.defaults.backgroundCustomColour,
        BOTTOM_AREA_PROTOCOL.defaults.backgroundLinearGradient,
        BOTTOM_AREA_PROTOCOL.defaults.dividerMode,
        BOTTOM_AREA_PROTOCOL.defaults.dividerCustomColour,
        BOTTOM_AREA_PROTOCOL.defaults.sideDividersVisible,
        BOTTOM_AREA_PROTOCOL.defaults.depthMode
    );
}

function readBottomAreaStatePath(path) {
    try {
        return BOTTOM_AREA_PROTOCOL.parseState(utils.ReadTextFile(path, 65001));
    } catch (e) {}
    return null;
}

function readBottomAreaStateFile() {
    return readBottomAreaStatePath(BOTTOM_AREA_STATE_FILE) ||
        readBottomAreaStatePath(BOTTOM_AREA_LEGACY_STATE_FILE) ||
        defaultBottomAreaState();
}

var sharedBottomAreaState = readBottomAreaStateFile();

function applySharedBottomAreaState(data, repaint) {
    var state = BOTTOM_AREA_PROTOCOL.parseState(data);
    if (!state) return false;

    var changed = !sharedBottomAreaState ||
        state.backgroundMode !== sharedBottomAreaState.backgroundMode ||
        (state.backgroundCustomColour >>> 0) !==
            (sharedBottomAreaState.backgroundCustomColour >>> 0) ||
        state.backgroundLinearGradient !== sharedBottomAreaState.backgroundLinearGradient ||
        state.depthMode !== sharedBottomAreaState.depthMode;
    sharedBottomAreaState = state;

    if (changed && repaint !== false && backgroundMode() === BACKGROUND_AUTOMATIC) {
        window.Repaint();
    }
    return changed;
}


function scheduleSharedBottomAreaCommit(data) {
    var commit = BOTTOM_AREA_PROTOCOL.parseCommit(data, new Date().getTime());
    if (!commit) return false;
    if (bottomAreaCommitTimer) clearTimeout(bottomAreaCommitTimer);
    bottomAreaCommitTimer = 0;
    bottomAreaCommitId = commit.id;
    var apply = function () {
        if (bottomAreaCommitId !== commit.id) return;
        bottomAreaCommitTimer = 0;
        bottomAreaCommitId = '';
        applySharedBottomAreaState(commit.state, true);
    };
    var delay = Math.max(0, commit.applyAt - new Date().getTime());
    if (delay <= 0) apply();
    else bottomAreaCommitTimer = setTimeout(apply, delay);
    return true;
}

function backgroundMode() {
    return DarkOneColour.normaliseMode(
        window.GetProperty(BACKGROUND_MODE_PROPERTY, BACKGROUND_AUTOMATIC),
        BACKGROUND_MODES,
        BACKGROUND_AUTOMATIC
    );
}

function resolvedSharedBackgroundMode() {
    return DarkOneColour.normaliseMode(
        sharedBottomAreaState.backgroundMode,
        BOTTOM_AREA_PROTOCOL.modeValues,
        BOTTOM_AREA_PROTOCOL.defaults.backgroundMode
    );
}

function sharedBottomAreaBackgroundColour() {
    var mode = resolvedSharedBackgroundMode();
    if (mode === BOTTOM_AREA_PROTOCOL.modes.black) return 0xff000000;
    if (mode === BOTTOM_AREA_PROTOCOL.modes.darkOne) return DOJSP3.colours.bar;
    if (mode === BOTTOM_AREA_PROTOCOL.modes.darkOneDark) return DOJSP3.colours.separator;
    if (mode === BOTTOM_AREA_PROTOCOL.modes.columnsUi) {
        return DarkOneColour.columnsUi(3, DOJSP3.colours.bar);
    }
    if (mode === BOTTOM_AREA_PROTOCOL.modes.custom) {
        return DarkOneColour.opaque(sharedBottomAreaState.backgroundCustomColour);
    }
    return DOJSP3.colours.separator;
}

function backgroundColour(mode) {
    if (typeof mode === 'undefined') mode = backgroundMode();
    if (mode === BACKGROUND_AUTOMATIC) return sharedBottomAreaBackgroundColour();
    if (mode === BACKGROUND_BLACK) return 0xff000000;
    if (mode === BACKGROUND_DARKONE) return DOJSP3.colours.bar;
    if (mode === BACKGROUND_DARKONE_DARK) return DOJSP3.colours.separator;
    if (mode === BACKGROUND_COLUMNS_UI) return DarkOneColour.columnsUi(3, DOJSP3.colours.bar);
    if (mode === BACKGROUND_CUSTOM) {
        return DarkOneColour.opaque(window.GetProperty(
            BACKGROUND_COLOUR_PROPERTY,
            DOJSP3.colours.bar
        ));
    }
    return DOJSP3.colours.separator;
}

function backgroundLinearGradient(mode) {
    if (typeof mode === 'undefined') mode = backgroundMode();
    return mode === BACKGROUND_AUTOMATIC &&
        Boolean(sharedBottomAreaState.backgroundLinearGradient);
}

function sharedSoftDepth(mode) {
    if (typeof mode === 'undefined') mode = backgroundMode();
    return mode === BACKGROUND_AUTOMATIC &&
        sharedBottomAreaState.depthMode === BOTTOM_AREA_PROTOCOL.depths.soft;
}

function parseBottomAreaGeometry(data) {
    var parts = String(data || '').split('|');
    var currentGeometry = parts.length === 4 &&
        parts[0] === BOTTOM_AREA_GEOMETRY_VERSION;
    var legacyGeometry = parts.length === 3 && parts[0] === 'v1';
    if (!currentGeometry && !legacyGeometry) return null;
    var height = Math.round(Number(parts[1]));
    var displayTop = Math.round(Number(parts[2]));
    if (!isFinite(height) || height < 1 || !isFinite(displayTop)) return null;
    return {
        height: height,
        displayTop: DOJSP3.clamp(displayTop, 0, height - 1)
    };
}

function applyBottomAreaGeometry(data) {
    var geometry = parseBottomAreaGeometry(data);
    if (!geometry) return false;
    var changed = geometry.height !== bottomAreaGradientHeight ||
        geometry.displayTop !== bottomAreaGradientOffsetY;
    bottomAreaGradientHeight = geometry.height;
    bottomAreaGradientOffsetY = geometry.displayTop;
    if (changed && (backgroundLinearGradient() || sharedSoftDepth())) window.Repaint();
    return changed;
}

function requestBottomAreaGeometry() {
    try { window.NotifyOthers(BOTTOM_AREA_GEOMETRY_QUERY, true); } catch (e) {}
}

function paintBackground(gr) {
    var mode = backgroundMode();
    var colour = backgroundColour(mode);
    if (!backgroundLinearGradient(mode)) {
        gr.FillSolidRect(0, 0, ww, wh, colour);
    } else {
        var endColour = DarkOneColour.scaleBrightness(colour, 0.7);
        var denominator = Math.max(1, bottomAreaGradientHeight - 1);
        var topAmount = DOJSP3.clamp(bottomAreaGradientOffsetY / denominator, 0, 1);
        var bottomAmount = DOJSP3.clamp(
            (bottomAreaGradientOffsetY + Math.max(0, wh - 1)) / denominator,
            0,
            1
        );
        DOJSP3.fillVerticalGradient(
            gr,
            0,
            0,
            ww,
            wh,
            DarkOneColour.blend(colour, endColour, topAmount),
            DarkOneColour.blend(colour, endColour, bottomAmount)
        );
    }

    if (!sharedSoftDepth(mode) || ww <= 0 || wh <= 0 ||
            bottomAreaGradientOffsetY >= 4) return;

    // Paint only the portion of the parent's in-place four-row depth edge that
    // this opaque child covers. Normal layouts start below row four, so this is
    // active only during extreme vertical resizing.
    if (bottomAreaGradientOffsetY === 0) {
        gr.FillSolidRect(0, 0, ww, 1, 0xff000000);
    }
    if (bottomAreaGradientOffsetY <= 1 &&
            bottomAreaGradientOffsetY + wh > 1) {
        gr.FillSolidRect(0, 1 - bottomAreaGradientOffsetY, ww, 1, 0xff0f0f0f);
    }
    var highlightTop = Math.max(0, 2 - bottomAreaGradientOffsetY);
    var highlightBottom = Math.min(wh, 4 - bottomAreaGradientOffsetY);
    if (highlightBottom > highlightTop) {
        gr.FillSolidRect(
            0,
            highlightTop,
            ww,
            highlightBottom - highlightTop,
            DarkOneColour.scaleBrightness(colour, 1.2)
        );
    }
}

function hideWhenStopped() {
    return Boolean(window.GetProperty(HIDE_ON_STOP_PROPERTY, true));
}

function newTrackRevealDelay() {
    return DOJSP3.clamp(
        Math.round(Number(window.GetProperty(REVEAL_DELAY_PROPERTY, 200)) || 0),
        0,
        2000
    );
}

function cancelWaveformReveal() {
    if (revealTimer) {
        clearTimeout(revealTimer);
        revealTimer = 0;
    }
}

function setBackgroundMode(mode) {
    window.SetProperty(
        BACKGROUND_MODE_PROPERTY,
        DarkOneColour.normaliseMode(mode, BACKGROUND_MODES, BACKGROUND_AUTOMATIC)
    );
    window.Repaint();
}

function setCustomBackgroundColour() {
    var current = window.GetProperty(BACKGROUND_COLOUR_PROPERTY, DOJSP3.colours.bar);
    var chosen = DarkOneColour.pickJsplitter(
        current,
        window.Name,
        'Enter a host background colour as #RRGGBB or R,G,B.\n\n' +
            'This controls the spacer and the area exposed when the waveform is hidden.'
    );
    if (chosen === null) return;
    window.SetProperty(BACKGROUND_COLOUR_PROPERTY, chosen);
    setBackgroundMode(BACKGROUND_CUSTOM);
}

function configureWaveformPseudoTransparency(waveform) {
    if (!waveform) return false;
    try {
        if (waveform.SupportPseudoTransparency !== true) {
            waveform.SupportPseudoTransparency = true;
        }
        return waveform.SupportPseudoTransparency === true;
    } catch (e) {}
    return false;
}

function waveformPanel() {
    var waveform = DOJSP3.panel(DOJSP3.titles.waveform);
    configureWaveformPseudoTransparency(waveform);
    return waveform;
}

function waveformShouldBeVisible(playbackActive) {
    if (!hideWhenStopped()) return true;
    return Boolean(playbackActive) && !hiddenAfterStop;
}

function setWaveformVisible(visible) {
    visible = Boolean(visible);
    if (waveformVisible === visible) return false;

    var waveform = waveformPanel();
    if (!waveform) return false;

    DOJSP3.show(waveform, visible);
    waveformVisible = visible;
    window.Repaint();
    return true;
}

function updateWaveformVisibility(playbackActive) {
    setWaveformVisible(waveformShouldBeVisible(playbackActive));
}

function scheduleWaveformReveal() {
    cancelWaveformReveal();

    var delay = newTrackRevealDelay();
    if (delay <= 0) {
        hiddenAfterStop = false;
        updateWaveformVisibility(fb.IsPlaying);
        return;
    }

    revealTimer = setTimeout(function () {
        revealTimer = 0;
        if (!fb.IsPlaying) return;

        hiddenAfterStop = false;
        updateWaveformVisibility(true);
    }, delay);
}

function layoutDisplayWaveform() {
    if (ww <= 0 || wh <= 0) return;

    var display = DOJSP3.panel(DOJSP3.titles.display);
    var waveform = waveformPanel();
    var half = DOJSP3.clamp(DOJSP3.idiv(wh, 2), 1, wh);
    var maximumWaveformTop = Math.max(0, wh - 1);

    waveformTop = Math.min(maximumWaveformTop, half + waveformSpacerHeight);

    DOJSP3.move(display, 0, 0, ww, Math.max(1, half));

    // The old conversion placed the child at half + 21 and inset it by one
    // pixel, producing a visible line/frame. Start directly after the 20 px
    // spacer and use the full width instead.
    DOJSP3.move(
        waveform,
        0,
        waveformTop,
        ww,
        Math.max(1, wh - waveformTop)
    );

    DOJSP3.show(display, true);
    var desiredWaveformVisibility = waveformShouldBeVisible(fb.IsPlaying);
    DOJSP3.show(waveform, desiredWaveformVisibility);
    waveformVisible = desiredWaveformVisibility;

    if (!startupReadiness.isReady() && display && waveform) {
        startupReadiness.signal();
    }
}

function on_colours_changed() {
    window.Repaint();
}

function on_size(width, height) {
    ww = width;
    wh = height;
    layoutDisplayWaveform();
    requestBottomAreaGeometry();
}

function on_paint(gr) {
    // Paint the whole host. Transparent / inherit parent is resolved by
    // backgroundColour() to the common #181818 parent tone.
    paintBackground(gr);
}

function on_playback_starting(command, is_paused) {
    // If playback is starting after a genuine stop, keep the native child
    // hidden. Showing it here exposes Waveform Minibar's cached bitmap from
    // the previous track before the new-track notification has been handled.
    cancelWaveformReveal();

    if (hideWhenStopped() && hiddenAfterStop) {
        setWaveformVisible(false);
    } else {
        updateWaveformVisibility(true);
    }
}

function on_playback_new_track(metadb) {
    if (hideWhenStopped() && hiddenAfterStop) {
        // Waveform Minibar receives the track change while hidden. Reveal it
        // shortly afterwards, once its cached previous waveform has had time
        // to be replaced. A small configurable delay avoids the stale-frame
        // flash without slowing normal gapless track changes.
        setWaveformVisible(false);
        scheduleWaveformReveal();
    } else {
        updateWaveformVisibility(true);
    }
}

function on_playback_stop(reason) {
    cancelWaveformReveal();

    // Reason 2 is the transient stop used while changing tracks. Preserve the
    // current waveform in that case so ordinary gapless transitions remain
    // immediate. A genuine stop arms anti-flash blanking for the next start.
    if (reason !== 2) {
        hiddenAfterStop = hideWhenStopped();
        updateWaveformVisibility(false);
    }
}

function on_notify_data(name, data) {
    if (name === BOTTOM_AREA_GEOMETRY_STATE) {
        applyBottomAreaGeometry(data);
        return;
    }
    if (name === BOTTOM_AREA_PROTOCOL.notifications.commit) {
        scheduleSharedBottomAreaCommit(data);
        return;
    }
    if (name === BOTTOM_AREA_PROTOCOL.notifications.state) {
        if (bottomAreaCommitTimer) clearTimeout(bottomAreaCommitTimer);
        bottomAreaCommitTimer = 0;
        bottomAreaCommitId = '';
        applySharedBottomAreaState(data, true);
        return;
    }
    if (darkOneJsp3HandleReset(name, data)) return;
    startupReadiness.handle(name);
}

function on_script_unload() {
    cancelWaveformReveal();
    if (bottomAreaCommitTimer) clearTimeout(bottomAreaCommitTimer);
    bottomAreaCommitTimer = 0;
    bottomAreaCommitId = '';
}

function on_mouse_rbtn_up(x, y) {
    var half = DOJSP3.idiv(wh, 2);

    // Preserve the native Display and Waveform Minibar context menus. This
    // controller menu occupies only the DarkOne spacer between the children.
    if (y < half || y >= waveformTop) return false;

    var menu = window.CreatePopupMenu();
    var backgroundMenu = window.CreatePopupMenu();

    DarkOneColour.appendRadioOptions(
        backgroundMenu,
        BACKGROUND_MENU_OPTIONS,
        backgroundMode(),
        window.GetProperty(BACKGROUND_COLOUR_PROPERTY, DOJSP3.colours.bar),
        MENU_STRING
    );
    backgroundMenu.AppendMenuSeparator();
    backgroundMenu.AppendMenuItem(MENU_STRING, 107, 'Set custom colour...');
    backgroundMenu.AppendTo(menu, MENU_POPUP, 'Host background');

    menu.AppendMenuItem(MENU_STRING, 200, 'Force blank waveform when playback stops');
    menu.CheckMenuItem(200, hideWhenStopped());
    menu.AppendMenuItem(
        MENU_STRING,
        201,
        'New-track reveal delay... (' + newTrackRevealDelay() + ' ms)'
    );
    menu.AppendMenuSeparator();
    menu.AppendMenuItem(MENU_STRING, 300, 'Reset waveform-area settings');

    var id = menu.TrackPopupMenu(x, y);

    var selectedBackground = DarkOneColour.optionForId(BACKGROUND_MENU_OPTIONS, id);
    if (selectedBackground) {
        setBackgroundMode(selectedBackground.mode);
    } else if (id === 107) {
        setCustomBackgroundColour();
    } else if (id === 200) {
        var enabled = !hideWhenStopped();
        window.SetProperty(HIDE_ON_STOP_PROPERTY, enabled);
        cancelWaveformReveal();
        hiddenAfterStop = enabled && !fb.IsPlaying;
        updateWaveformVisibility(fb.IsPlaying);
    } else if (id === 201) {
        try {
            var enteredDelay = utils.InputBox(
                'Delay revealing Waveform Minibar after playback starts from a stopped state.\n\n' +
                'This prevents the previous track waveform flashing briefly.\n' +
                'Enter 0 to disable. Valid range: 0-2000 ms.',
                window.Name,
                String(newTrackRevealDelay())
            );
            var parsedDelay = Math.round(Number(enteredDelay));
            if (!isFinite(parsedDelay) || parsedDelay < 0 || parsedDelay > 2000) {
                fb.ShowPopupMessage('Enter a delay from 0 to 2000 milliseconds.', 'DarkOneJSP3');
            } else {
                window.SetProperty(REVEAL_DELAY_PROPERTY, parsedDelay);
            }
        } catch (e) {}
    } else if (id === 300) {
        window.SetProperty(BACKGROUND_MODE_PROPERTY, BACKGROUND_AUTOMATIC);
        window.SetProperty(BACKGROUND_COLOUR_PROPERTY, DOJSP3.colours.bar);
        window.SetProperty(HIDE_ON_STOP_PROPERTY, true);
        window.SetProperty(REVEAL_DELAY_PROPERTY, 200);
        cancelWaveformReveal();
        hiddenAfterStop = !fb.IsPlaying;
        updateWaveformVisibility(fb.IsPlaying);
    }

    return true;
}
