"use strict";
include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\shared.js');
// v0.7.36 centralises startup-control serialisation, notification names and
// readiness handshakes in the shared JSplitter protocol helper.

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

var STARTUP_PROTOCOL = DarkOneProtocol.startup;
var STARTUP_OFF = STARTUP_PROTOCOL.transitions.off;
var STARTUP_BLACK_REVEAL = STARTUP_PROTOCOL.transitions.blackReveal;
var STARTUP_STAGED_REVEAL = STARTUP_PROTOCOL.transitions.stagedReveal;
var STARTUP_STAGE_GAP_MS = 125;
var STARTUP_PREPAINT_DELAY_MS = 150;
var STARTUP_CONTROLLERS = STARTUP_PROTOCOL.controllers;

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
    return STARTUP_PROTOCOL.normaliseValue(
        'transition',
        window.GetProperty(
            STARTUP_TRANSITION_PROPERTY,
            STARTUP_PROTOCOL.defaults.transition
        )
    );
}

function startupMinimumDelay() {
    return STARTUP_PROTOCOL.normaliseValue(
        'minimum-delay',
        window.GetProperty(
            STARTUP_MINIMUM_DELAY_PROPERTY,
            STARTUP_PROTOCOL.defaults.minimumDelay
        )
    );
}

function startupSafetyTimeout() {
    return STARTUP_PROTOCOL.normaliseValue(
        'readiness-timeout',
        window.GetProperty(
            STARTUP_SAFETY_TIMEOUT_PROPERTY,
            STARTUP_PROTOCOL.defaults.readinessTimeout
        )
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
    window.NotifyOthers(STARTUP_PROTOCOL.notifications.queryReady, true);

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

function startupPropertyKey(name) {
    if (name === STARTUP_TRANSITION_PROPERTY) return 'transition';
    if (name === STARTUP_MINIMUM_DELAY_PROPERTY) return 'minimum-delay';
    if (name === STARTUP_SAFETY_TIMEOUT_PROPERTY) return 'readiness-timeout';
    return '';
}

function startupPropertyForKey(key) {
    if (key === 'transition') return STARTUP_TRANSITION_PROPERTY;
    if (key === 'minimum-delay') return STARTUP_MINIMUM_DELAY_PROPERTY;
    if (key === 'readiness-timeout') return STARTUP_SAFETY_TIMEOUT_PROPERTY;
    return '';
}

function normaliseStartupProperty(name, value) {
    var key = startupPropertyKey(name);
    return key ? STARTUP_PROTOCOL.normaliseValue(key, value) : null;
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

function startupControlState() {
    return STARTUP_PROTOCOL.state(
        startupTransition(),
        startupMinimumDelay(),
        startupSafetyTimeout()
    );
}

function broadcastStartupControlState() {
    window.NotifyOthers(
        STARTUP_PROTOCOL.notifications.stateControls,
        STARTUP_PROTOCOL.serialiseState(startupControlState())
    );
}

function restoreStartupDefaults() {
    applyStartupProperty(
        STARTUP_TRANSITION_PROPERTY,
        STARTUP_PROTOCOL.defaults.transition
    );
    applyStartupProperty(
        STARTUP_MINIMUM_DELAY_PROPERTY,
        STARTUP_PROTOCOL.defaults.minimumDelay
    );
    applyStartupProperty(
        STARTUP_SAFETY_TIMEOUT_PROPERTY,
        STARTUP_PROTOCOL.defaults.readinessTimeout
    );
}

function handleStartupControlCommand(data) {
    var command = STARTUP_PROTOCOL.parseCommand(data);
    if (!command) return false;

    if (command.action === 'set') {
        applyStartupProperty(startupPropertyForKey(command.key), command.value);
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
    if (name === STARTUP_PROTOCOL.notifications.queryControls) {
        if (STARTUP_PROTOCOL.isVersion(data)) broadcastStartupControlState();
        return;
    }
    if (name === STARTUP_PROTOCOL.notifications.commandControls) {
        handleStartupControlCommand(data);
        return;
    }

    if (darkOneJsp3HandleReset(name, data)) return;
    if (name === STARTUP_PROTOCOL.notifications.ready) {
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
