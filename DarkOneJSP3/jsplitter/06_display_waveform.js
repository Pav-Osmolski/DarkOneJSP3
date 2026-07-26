"use strict";
include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\shared.js');
var DARKONEJSP3_RESET_ROLE = "display-waveform";

// Replaces Panel Stack Splitter 06.
//
// v0.3.4 fixes the unpainted 20 px strip above Waveform Minibar, removes
// the accidental one-pixel frame line, adds a persistent host-background
// selector and can force the native waveform child blank when playback stops.
//
// v0.3.7 keeps the child hidden briefly when playback starts from a stopped
// state, preventing Waveform Minibar's previous cached waveform flashing before
// the newly selected track has been processed.
//
// v0.3.8 consolidates background-mode validation, menu mapping and custom
// colour picking through the shared DarkOneJSP3 colour helper.

var STARTUP_CONTROLLER_NAME = 'DisplayWaveform';
var startupLayoutReady = false;

function signalStartupReady() {
    startupLayoutReady = true;
    window.NotifyOthers('DarkOneJSP3.Startup.Ready', STARTUP_CONTROLLER_NAME);
}

var ww = 0;
var wh = 0;
var waveformTop = 0;
var waveformSpacerHeight = 20;

var BACKGROUND_MODE_PROPERTY = 'DarkOneJSP3.DisplayWaveform.BackgroundMode';
var BACKGROUND_COLOUR_PROPERTY = 'DarkOneJSP3.DisplayWaveform.BackgroundColour';
var HIDE_ON_STOP_PROPERTY = 'DarkOneJSP3.DisplayWaveform.HideWhenStopped';
var REVEAL_DELAY_PROPERTY = 'DarkOneJSP3.DisplayWaveform.NewTrackRevealDelay';

var revealTimer = 0;
var waveformVisible = null;
var hiddenAfterStop = hideWhenStopped() && !fb.IsPlaying;

// 0 = transparent / inherit parent, 1 = black, 2 = DarkOne grey,
// 3 = custom (legacy), 4 = DarkOne dark grey, 5 = Columns UI global
// background. Keeping custom at 3 preserves existing properties.
var BACKGROUND_TRANSPARENT = 0;
var BACKGROUND_BLACK = 1;
var BACKGROUND_DARKONE = 2;
var BACKGROUND_CUSTOM = 3;
var BACKGROUND_DARKONE_DARK = 4;
var BACKGROUND_COLUMNS_UI = 5;
var BACKGROUND_MODES = [
    BACKGROUND_TRANSPARENT,
    BACKGROUND_BLACK,
    BACKGROUND_DARKONE,
    BACKGROUND_CUSTOM,
    BACKGROUND_DARKONE_DARK,
    BACKGROUND_COLUMNS_UI
];
var BACKGROUND_MENU_OPTIONS = [
    { id: 100, mode: BACKGROUND_TRANSPARENT, label: 'Transparent / inherit parent' },
    { id: 101, mode: BACKGROUND_BLACK, label: 'Black' },
    { id: 102, mode: BACKGROUND_DARKONE, label: 'DarkOne grey' },
    { id: 104, mode: BACKGROUND_DARKONE_DARK, label: 'DarkOne dark grey' },
    { id: 105, mode: BACKGROUND_COLUMNS_UI, label: 'Columns UI global background' },
    { id: 103, mode: BACKGROUND_CUSTOM, custom: true }
];

var MENU_STRING = 0x00000000;
var MENU_POPUP = 0x00000010;

function backgroundMode() {
    return DarkOneColour.normaliseMode(
        window.GetProperty(BACKGROUND_MODE_PROPERTY, BACKGROUND_DARKONE),
        BACKGROUND_MODES,
        BACKGROUND_DARKONE
    );
}

function backgroundColour() {
    var mode = backgroundMode();
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
    return 0x00000000;
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
        DarkOneColour.normaliseMode(mode, BACKGROUND_MODES, BACKGROUND_DARKONE)
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

function waveformShouldBeVisible(playbackActive) {
    if (!hideWhenStopped()) return true;
    return Boolean(playbackActive) && !hiddenAfterStop;
}

function setWaveformVisible(visible) {
    visible = Boolean(visible);
    if (waveformVisible === visible) return false;

    var waveform = DOJSP3.panel(DOJSP3.titles.waveform);
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
    var waveform = DOJSP3.panel(DOJSP3.titles.waveform);
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

    if (!startupLayoutReady && display && waveform) signalStartupReady();
}

function on_colours_changed() {
    window.Repaint();
}

function on_size(width, height) {
    ww = width;
    wh = height;
    layoutDisplayWaveform();
}

function on_paint(gr) {
    var mode = backgroundMode();
    if (mode !== BACKGROUND_TRANSPARENT) {
        // Paint the whole host. Child windows cover their own rectangles,
        // while the spacer and stopped/hidden waveform area retain this fill.
        gr.FillSolidRect(0, 0, ww, wh, backgroundColour());
    }
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
    if (darkOneJsp3HandleReset(name, data)) return;
    if (name === 'DarkOneJSP3.Startup.QueryReady' && startupLayoutReady) {
        signalStartupReady();
    }
}

function on_script_unload() {
    cancelWaveformReveal();
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
        if (selectedBackground.custom) setCustomBackgroundColour();
        else setBackgroundMode(selectedBackground.mode);
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
        window.SetProperty(BACKGROUND_MODE_PROPERTY, BACKGROUND_DARKONE);
        window.SetProperty(BACKGROUND_COLOUR_PROPERTY, DOJSP3.colours.bar);
        window.SetProperty(HIDE_ON_STOP_PROPERTY, true);
        window.SetProperty(REVEAL_DELAY_PROPERTY, 200);
        cancelWaveformReveal();
        hiddenAfterStop = !fb.IsPlaying;
        updateWaveformVisibility(fb.IsPlaying);
    }

    return true;
}
