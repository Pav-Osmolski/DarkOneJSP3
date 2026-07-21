"use strict";
include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\shared.js');
var DARKONEJSP3_RESET_ROLE = "root";

// Replaces Panel Stack Splitter 01.
// The old root reserved a width-scaled bottom strip. Unlike the original PSS,
// both major children are positioned explicitly so there is no full-window
// invisible overlay intercepting mouse input.
//
// v0.6.9 refines the v0.6.6 startup curtain. Optional reveal modes now repaint
// the hidden root to the final DarkOne grey and allow that backing frame to
// settle before the native child windows are shown. This prevents the
// DisplayStack host from exposing a black first frame during startup. Off is
// the default; Black reveal and Staged reveal remain available explicitly.
//
// v0.7.25 makes this root the sole owner of startup configuration. The
// InfoStack JSplitter menu queries and updates it through versioned serialised
// JSplitter-to-JSplitter messages, replacing the ineffective JScript Panel
// property/notification bridge.

var STARTUP_TRANSITION_PROPERTY = 'DARKONEJSP3.STARTUP.TRANSITION';
var STARTUP_MINIMUM_DELAY_PROPERTY = 'DARKONEJSP3.STARTUP.MINIMUM.DELAY';
var STARTUP_SAFETY_TIMEOUT_PROPERTY = 'DARKONEJSP3.STARTUP.SAFETY.TIMEOUT';

var STARTUP_OFF = 0;
var STARTUP_BLACK_REVEAL = 1;
var STARTUP_STAGED_REVEAL = 2;
var STARTUP_STAGE_GAP_MS = 125;
var STARTUP_PREPAINT_DELAY_MS = 150;


var STARTUP_CONTROL_MESSAGE_VERSION = 'v1';
var STARTUP_CONTROL_QUERY_NOTIFICATION =
    'DarkOneJSP3.Startup.Controls.Query';
var STARTUP_CONTROL_COMMAND_NOTIFICATION =
    'DarkOneJSP3.Startup.Controls.Command';
var STARTUP_CONTROL_STATE_NOTIFICATION =
    'DarkOneJSP3.Startup.Controls.State';

var STARTUP_CONTROLLERS = [
    'MainColumns',
    'InfoStack',
    'ArtSpectrum',
    'BottomControls',
    'DisplayWaveform'
];

var ww = 0;
var wh = 0;
var rootLaidOut = false;
var startupComplete = false;
var startupPreview = false;
var stagedRevealPending = false;
var minimumDelayElapsed = false;
var startupReady = Object.create(null);
var minimumDelayTimer = 0;
var safetyTimer = 0;
var stageTimer = 0;
var rootMainVisible = false;
var rootControlsVisible = false;

function startupTransition() {
    return DOJSP3.clamp(
        Math.round(Number(window.GetProperty(STARTUP_TRANSITION_PROPERTY, STARTUP_OFF)) || 0),
        STARTUP_OFF,
        STARTUP_STAGED_REVEAL
    );
}

function startupMinimumDelay() {
    return DOJSP3.clamp(
        Math.round(Number(window.GetProperty(STARTUP_MINIMUM_DELAY_PROPERTY, 250)) || 0),
        0,
        5000
    );
}

function startupSafetyTimeout() {
    return DOJSP3.clamp(
        Math.round(Number(window.GetProperty(STARTUP_SAFETY_TIMEOUT_PROPERTY, 2000)) || 0),
        500,
        10000
    );
}

function clearStartupTimer(timer) {
    if (timer) clearTimeout(timer);
    return 0;
}

function clearStartupTimers() {
    minimumDelayTimer = clearStartupTimer(minimumDelayTimer);
    safetyTimer = clearStartupTimer(safetyTimer);
    stageTimer = clearStartupTimer(stageTimer);
}

function rootPanel(title) {
    // Avoid missing-panel diagnostics during the earliest script-evaluation
    // phase. Normal layout uses DOJSP3.panel() and still reports real mistakes.
    try { return window.GetPanel(title); } catch (e) { return null; }
}

function setRootVisibility(mainVisible, controlsVisible) {
    rootMainVisible = Boolean(mainVisible);
    rootControlsVisible = Boolean(controlsVisible);

    var main = rootPanel(DOJSP3.titles.main);
    var controls = rootPanel(DOJSP3.titles.controls);
    if (main) main.Show(rootMainVisible);
    if (controls) controls.Show(rootControlsVisible);
}

function hideRootChildrenImmediately() {
    if (startupTransition() === STARTUP_OFF) {
        startupComplete = true;
        setRootVisibility(true, true);
    } else {
        setRootVisibility(false, false);
    }
}

// Hide the two large child windows as soon as the root script is evaluated.
// This closes the brief FCL-visible interval before the first on_size callback.
hideRootChildrenImmediately();

function allStartupControllersReady() {
    for (var i = 0; i < STARTUP_CONTROLLERS.length; i++) {
        if (!startupReady[STARTUP_CONTROLLERS[i]]) return false;
    }
    return true;
}

function missingStartupControllers() {
    var missing = [];
    for (var i = 0; i < STARTUP_CONTROLLERS.length; i++) {
        if (!startupReady[STARTUP_CONTROLLERS[i]]) missing.push(STARTUP_CONTROLLERS[i]);
    }
    return missing;
}

function revealStartupTheme() {
    clearStartupTimers();
    startupComplete = true;
    startupPreview = false;
    stagedRevealPending = startupTransition() === STARTUP_STAGED_REVEAL;

    // Keep both native child windows hidden while the root replaces its black
    // curtain with the final DarkOne-grey backing frame. The tested 150 ms
    // settle period lets queued native sizing/painting complete before
    // DOJSP3.DisplayStack becomes visible, avoiding its black first frame.
    setRootVisibility(false, false);
    window.Repaint();

    stageTimer = setTimeout(function () {
        stageTimer = 0;
        if (stagedRevealPending) {
            setRootVisibility(true, false);
            window.Repaint();
            stageTimer = setTimeout(function () {
                stageTimer = 0;
                stagedRevealPending = false;
                setRootVisibility(true, true);
                window.Repaint();
            }, STARTUP_STAGE_GAP_MS);
        } else {
            setRootVisibility(true, true);
            window.Repaint();
        }
    }, STARTUP_PREPAINT_DELAY_MS);
}

function tryFinishStartup(force) {
    if (startupComplete || !rootLaidOut) return;
    if (!force && (!minimumDelayElapsed || (!startupPreview && !allStartupControllersReady()))) return;

    if (force && !startupPreview) {
        var missing = missingStartupControllers();
        if (missing.length) {
            console.log('[DarkOneJSP3] Startup layout-readiness timeout expired; revealing with controllers still pending: ' + missing.join(', '));
        }
    }
    revealStartupTheme();
}

function beginStartupGate(preview) {
    clearStartupTimers();
    startupPreview = Boolean(preview);
    startupComplete = false;
    stagedRevealPending = false;
    minimumDelayElapsed = false;

    var transition = startupTransition();
    if (transition === STARTUP_OFF) {
        startupComplete = true;
        startupPreview = false;
        stagedRevealPending = false;
        setRootVisibility(true, true);
        window.Repaint();
        return;
    }

    setRootVisibility(false, false);
    window.Repaint();

    var minimum = startupMinimumDelay();
    if (minimum <= 0) {
        minimumDelayElapsed = true;
    } else {
        minimumDelayTimer = setTimeout(function () {
            minimumDelayTimer = 0;
            minimumDelayElapsed = true;
            tryFinishStartup(false);
        }, minimum);
    }

    if (startupPreview) {
        // Preview demonstrates the visual timing only; the live layout has
        // already passed the readiness handshake.
        tryFinishStartup(false);
        return;
    }

    // Ask controllers that may have completed before the root's first size
    // callback to repeat their readiness notification.
    window.NotifyOthers('DarkOneJSP3.Startup.QueryReady', true);

    var effectiveSafety = Math.max(startupSafetyTimeout(), minimum + 250);
    safetyTimer = setTimeout(function () {
        safetyTimer = 0;
        minimumDelayElapsed = true;
        tryFinishStartup(true);
    }, effectiveSafety);

    tryFinishStartup(false);
}

function layoutRoot() {
    if (ww <= 0 || wh <= 0) return;

    var main = DOJSP3.panel(DOJSP3.titles.main);
    var controls = DOJSP3.panel(DOJSP3.titles.controls);

    var bottomHeight = DOJSP3.idiv(ww, 10) + DOJSP3.idiv(ww, 128);
    bottomHeight = DOJSP3.clamp(bottomHeight, 1, wh);
    var mainHeight = Math.max(1, wh - bottomHeight);

    DOJSP3.move(main, 0, 0, ww, mainHeight);
    DOJSP3.move(controls, 0, mainHeight, ww, bottomHeight);
    DOJSP3.show(main, rootMainVisible);
    DOJSP3.show(controls, rootControlsVisible);
}

function normaliseStartupProperty(name, value) {
    value = Math.round(Number(value));
    if (!isFinite(value)) return null;
    if (name === STARTUP_TRANSITION_PROPERTY) {
        return DOJSP3.clamp(value, STARTUP_OFF, STARTUP_STAGED_REVEAL);
    }
    if (name === STARTUP_MINIMUM_DELAY_PROPERTY) {
        return DOJSP3.clamp(value, 0, 5000);
    }
    if (name === STARTUP_SAFETY_TIMEOUT_PROPERTY) {
        return DOJSP3.clamp(value, 500, 10000);
    }
    return null;
}

function applyStartupProperty(name, value) {
    name = String(name || '');
    var normalised = normaliseStartupProperty(name, value);
    if (normalised === null) return false;

    window.SetProperty(name, normalised);
    if (name === STARTUP_TRANSITION_PROPERTY &&
            startupTransition() === STARTUP_OFF && !startupComplete) {
        startupComplete = true;
        startupPreview = false;
        stagedRevealPending = false;
        clearStartupTimers();
        setRootVisibility(true, true);
        window.Repaint();
    }
    return true;
}

function startupControlStateMessage() {
    return STARTUP_CONTROL_MESSAGE_VERSION + '|state|' +
        String(startupTransition()) + '|' +
        String(startupMinimumDelay()) + '|' +
        String(startupSafetyTimeout());
}

function broadcastStartupControlState() {
    window.NotifyOthers(
        STARTUP_CONTROL_STATE_NOTIFICATION,
        startupControlStateMessage()
    );
}

function parseStartupControlCommand(data) {
    var parts = String(data || '').split('|');
    if (parts[0] !== STARTUP_CONTROL_MESSAGE_VERSION) return null;

    var action = String(parts[1] || '');
    if (action === 'preview' || action === 'restore') {
        return parts.length === 2 ? { action: action } : null;
    }
    if (action !== 'set' || parts.length !== 4) return null;

    var key = String(parts[2] || '');
    var property = key === 'transition' ? STARTUP_TRANSITION_PROPERTY :
        key === 'minimum-delay' ? STARTUP_MINIMUM_DELAY_PROPERTY :
        key === 'readiness-timeout' ? STARTUP_SAFETY_TIMEOUT_PROPERTY : '';
    if (!property) return null;

    var value = normaliseStartupProperty(property, parts[3]);
    if (value === null) return null;
    return { action: action, property: property, value: value };
}

function restoreStartupDefaults() {
    applyStartupProperty(STARTUP_TRANSITION_PROPERTY, STARTUP_OFF);
    applyStartupProperty(STARTUP_MINIMUM_DELAY_PROPERTY, 250);
    applyStartupProperty(STARTUP_SAFETY_TIMEOUT_PROPERTY, 2000);
}

function handleStartupControlCommand(data) {
    var command = parseStartupControlCommand(data);
    if (!command) return false;

    if (command.action === 'set') {
        applyStartupProperty(command.property, command.value);
        broadcastStartupControlState();
        return true;
    }
    if (command.action === 'restore') {
        restoreStartupDefaults();
        broadcastStartupControlState();
        return true;
    }
    if (command.action === 'preview') {
        if (rootLaidOut && startupTransition() !== STARTUP_OFF) {
            beginStartupGate(true);
        }
        return true;
    }
    return false;
}

function on_size(width, height) {
    ww = width;
    wh = height;
    layoutRoot();

    if (!rootLaidOut && ww > 0 && wh > 0) {
        rootLaidOut = true;
        beginStartupGate(false);
    } else {
        tryFinishStartup(false);
    }
}

function on_paint(gr) {
    // Once startup is complete, paint the prepared DarkOne-grey backing even
    // while Staged reveal is waiting to show the bottom controls.
    var curtainActive = !startupComplete || startupPreview;
    gr.FillSolidRect(0, 0, ww, wh, curtainActive ? 0xff000000 : DOJSP3.colours.bar);
}

function on_notify_data(name, data) {
    if (name === STARTUP_CONTROL_QUERY_NOTIFICATION) {
        if (String(data || '') === STARTUP_CONTROL_MESSAGE_VERSION) {
            broadcastStartupControlState();
        }
        return;
    }
    if (name === STARTUP_CONTROL_COMMAND_NOTIFICATION) {
        handleStartupControlCommand(data);
        return;
    }

    if (darkOneJsp3HandleReset(name, data)) return;
    if (name === 'DarkOneJSP3.Startup.Ready') {
        var controller = String(data || '');
        if (STARTUP_CONTROLLERS.indexOf(controller) >= 0) {
            startupReady[controller] = true;
            tryFinishStartup(false);
        }
    }
}

function on_script_unload() {
    clearStartupTimers();
}
