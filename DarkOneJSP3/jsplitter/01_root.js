"use strict";
include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\shared.js');
include(fb.ProfilePath + 'DarkOneJSP3\\shared\\queue_bridge.js');
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


// Direct playback-queue bridge. JSplitter exposes GetPlaybackQueueContents(),
// while JScript Panel 3 does not. Publish only the small queue state into
// js_data so the recommended scripted Queue Viewer can avoid a full playlist scan.
var QUEUE_BRIDGE_PROTOCOL = DarkOneQueueBridge;
var QUEUE_BRIDGE_DATA_DIR = fb.ProfilePath + 'js_data\\';
var QUEUE_BRIDGE_STATE_FILE = QUEUE_BRIDGE_DATA_DIR + QUEUE_BRIDGE_PROTOCOL.fileName;
var QUEUE_BRIDGE_COMMAND_FILE = QUEUE_BRIDGE_DATA_DIR + QUEUE_BRIDGE_PROTOCOL.commandFileName;
var QUEUE_BRIDGE_RESULT_FILE = QUEUE_BRIDGE_DATA_DIR + QUEUE_BRIDGE_PROTOCOL.resultFileName;
var queueBridgeSession = Date.now().toString(36) + '-' +
    Math.floor(Math.random() * 0x7fffffff).toString(36);
var queueBridgeGeneration = 0;
var queueBridgeRefreshTimer = 0;
var queueBridgeStateRetryTimer = 0;
var queueBridgeStateRetryAttempt = 0;
var queueBridgePublishedGeneration = 0;
var queueBridgeFailureLogged = false;
var queueBridgeCommandTimer = 0;
var queueBridgeLastCommandId = '';
var queueBridgeMutationInProgress = false;
var QUEUE_BRIDGE_COMMAND_POLL_MS = 25;
var QUEUE_BRIDGE_STATE_RETRY_MS = 50;
var QUEUE_BRIDGE_STATE_RETRY_LIMIT = 3;
var queueBridgeSourceIdTfo = fb.TitleFormat('%path%|%subsong%');

function normaliseQueueBridgeIndex(value) {
    value = Number(value);
    if (!isFinite(value) || value === 0xffffffff) return -1;
    value = Math.round(value);
    return value >= 0 ? value : -1;
}

function queueBridgeSourceId(handle) {
    if (!handle) return '';
    try { return String(queueBridgeSourceIdTfo.EvalWithMetadb(handle)); }
    catch (e) {
        try { return String(handle.Path || '') + '|' + String(handle.SubSong || 0); }
        catch (ignored) { return ''; }
    }
}

function queueBridgeState(generation) {
    var entries = [];
    var available = true;
    try {
        var contents = plman.GetPlaybackQueueContents();
        for (var i = 0; i < contents.length; i++) {
            var item = contents[i];
            entries.push({
                queueIndex: i + 1,
                playlistIndex: normaliseQueueBridgeIndex(item.PlaylistIndex),
                playlistItemIndex: normaliseQueueBridgeIndex(item.PlaylistItemIndex),
                sourceId: queueBridgeSourceId(item.Handle)
            });
        }
        queueBridgeFailureLogged = false;
    } catch (e) {
        available = false;
        if (!queueBridgeFailureLogged) {
            console.log('[DarkOneJSP3] Direct queue bridge unavailable; scripted Queue Viewer will use its JScript Panel fallback: ' + e.message);
            queueBridgeFailureLogged = true;
        }
    }

    return QUEUE_BRIDGE_PROTOCOL.state(
        queueBridgeSession,
        generation,
        available,
        entries,
        available,
        QUEUE_BRIDGE_PROTOCOL.capabilities
    );
}

function publishQueueBridgeState(generation) {
    var state = queueBridgeState(generation);
    try {
        utils.CreateFolder(QUEUE_BRIDGE_DATA_DIR);
        var written = utils.WriteTextFile(
            QUEUE_BRIDGE_STATE_FILE,
            QUEUE_BRIDGE_PROTOCOL.serialise(state)
        );
        if (written === false) {
            console.log('[DarkOneJSP3] Queue bridge state write failed: utils.WriteTextFile returned false');
            return false;
        }
        queueBridgePublishedGeneration = Math.max(
            queueBridgePublishedGeneration,
            generation
        );
        if (queueBridgeStateRetryTimer) {
            clearTimeout(queueBridgeStateRetryTimer);
            queueBridgeStateRetryTimer = 0;
        }
        queueBridgeStateRetryAttempt = 0;
        return true;
    } catch (writeError) {
        console.log('[DarkOneJSP3] Queue bridge state write failed: ' + writeError.message);
        return false;
    }
}

function retryQueueBridgeState() {
    queueBridgeStateRetryTimer = 0;
    if (queueBridgePublishedGeneration >= queueBridgeGeneration) {
        queueBridgeStateRetryAttempt = 0;
        return;
    }
    if (publishQueueBridgeState(queueBridgeGeneration)) return;
    queueBridgeStateRetryAttempt++;
    if (queueBridgeStateRetryAttempt < QUEUE_BRIDGE_STATE_RETRY_LIMIT) {
        queueBridgeStateRetryTimer = setTimeout(
            retryQueueBridgeState,
            QUEUE_BRIDGE_STATE_RETRY_MS
        );
    } else {
        console.log('[DarkOneJSP3] Queue bridge state publication retry limit reached; a later queue change will retry publication.');
    }
}

function scheduleQueueBridgeStateRetry() {
    if (queueBridgeStateRetryTimer ||
        queueBridgePublishedGeneration >= queueBridgeGeneration) return;
    queueBridgeStateRetryAttempt = 0;
    queueBridgeStateRetryTimer = setTimeout(
        retryQueueBridgeState,
        QUEUE_BRIDGE_STATE_RETRY_MS
    );
}

function writeQueueBridgeState() {
    var generation = ++queueBridgeGeneration;
    if (publishQueueBridgeState(generation)) return true;
    scheduleQueueBridgeStateRetry();
    return false;
}

function writeQueueBridgeResult(command, accepted, message) {
    var value = QUEUE_BRIDGE_PROTOCOL.result(
        command && command.id,
        queueBridgeSession,
        accepted === true,
        queueBridgeGeneration,
        message || ''
    );
    try {
        utils.CreateFolder(QUEUE_BRIDGE_DATA_DIR);
        var written = utils.WriteTextFile(
            QUEUE_BRIDGE_RESULT_FILE,
            QUEUE_BRIDGE_PROTOCOL.serialiseResult(value)
        );
        if (written === false) {
            console.log('[DarkOneJSP3] Queue command result write failed: utils.WriteTextFile returned false');
            return false;
        }
        return true;
    } catch (e) {
        console.log('[DarkOneJSP3] Queue command result write failed: ' + e.message);
        return false;
    }
}

function queueBridgeQueueIndexes(command, queueLength) {
    var indexes = [];
    var source = command && command.queueIndexes ? command.queueIndexes : [];
    for (var i = 0; i < source.length; i++) {
        var zeroBased = Math.round(Number(source[i])) - 1;
        if (zeroBased >= 0 && zeroBased < queueLength && indexes.indexOf(zeroBased) === -1) {
            indexes.push(zeroBased);
        }
    }
    indexes.sort(function (a, b) { return a - b; });
    return indexes;
}

function queueBridgeSnapshotItem(item) {
    // FbPlaybackQueueItem objects are live queue wrappers. Capture the source
    // coordinates before any destructive queue mutation so FlushPlaybackQueue()
    // cannot invalidate the data needed to restore playlist-backed entries.
    return {
        Handle: item && item.Handle ? item.Handle : null,
        PlaylistIndex: normaliseQueueBridgeIndex(item && item.PlaylistIndex),
        PlaylistItemIndex: normaliseQueueBridgeIndex(item && item.PlaylistItemIndex),
        RestorePlaylistSource: queueBridgeCanRestorePlaylistSource(item)
    };
}

function queueBridgeReorder(contents, selectedIndexes, action) {
    var rows = [];
    var selected = Object.create(null);
    for (var i = 0; i < selectedIndexes.length; i++) selected[selectedIndexes[i]] = true;
    for (var n = 0; n < contents.length; n++) {
        rows.push({ item: queueBridgeSnapshotItem(contents[n]), selected: selected[n] === true });
    }

    var temp;
    if (action === 'moveUp') {
        for (var up = 1; up < rows.length; up++) {
            if (rows[up].selected && !rows[up - 1].selected) {
                temp = rows[up - 1]; rows[up - 1] = rows[up]; rows[up] = temp;
            }
        }
    } else if (action === 'moveDown') {
        for (var down = rows.length - 2; down >= 0; down--) {
            if (rows[down].selected && !rows[down + 1].selected) {
                temp = rows[down + 1]; rows[down + 1] = rows[down]; rows[down] = temp;
            }
        }
    } else if (action === 'moveTop' || action === 'moveBottom') {
        var chosen = [];
        var other = [];
        for (var r = 0; r < rows.length; r++) (rows[r].selected ? chosen : other).push(rows[r]);
        rows = action === 'moveTop' ? chosen.concat(other) : other.concat(chosen);
    }
    return rows;
}

function queueBridgePlaylistItemCount(playlistIndex) {
    // JSplitter inherits the Spider Monkey Panel playlist API, where the
    // canonical count method is PlaylistItemCount(). Keep the older JSP-style
    // alias only as a defensive fallback for compatible hosts.
    if (typeof plman.PlaylistItemCount === 'function') {
        return plman.PlaylistItemCount(playlistIndex);
    }
    if (typeof plman.GetPlaylistItemCount === 'function') {
        return plman.GetPlaylistItemCount(playlistIndex);
    }
    throw new Error('Playlist item count API is unavailable');
}

function queueBridgeCanRestorePlaylistSource(item) {
    var playlistIndex = normaliseQueueBridgeIndex(item && item.PlaylistIndex);
    var itemIndex = normaliseQueueBridgeIndex(item && item.PlaylistItemIndex);
    if (playlistIndex < 0 || itemIndex < 0 || playlistIndex >= plman.PlaylistCount) return false;
    try { return itemIndex < queueBridgePlaylistItemCount(playlistIndex); }
    catch (e) { return false; }
}

function queueBridgeRestoreQueue(rows) {
    // Validate live handles before destructive reconstruction so a malformed
    // queue item cannot silently disappear after FlushPlaybackQueue().
    for (var preflight = 0; preflight < rows.length; preflight++) {
        if (!rows[preflight].item || !rows[preflight].item.Handle) {
            throw new Error('Playback queue item has no live handle');
        }
    }

    plman.FlushPlaybackQueue();
    for (var i = 0; i < rows.length; i++) {
        var item = rows[i].item;
        var restored = false;
        if (item.RestorePlaylistSource) {
            try {
                plman.AddPlaylistItemToPlaybackQueue(
                    item.PlaylistIndex,
                    item.PlaylistItemIndex
                );
                restored = true;
            } catch (playlistError) {
                restored = false;
            }
        }
        if (!restored) plman.AddItemToPlaybackQueue(item.Handle);
    }
}

function executeQueueBridgeCommand(command) {
    if (!command || command.session !== queueBridgeSession) {
        return { accepted: false, message: 'Queue session changed; refresh and retry.' };
    }
    if (command.generation !== queueBridgeGeneration) {
        return { accepted: false, message: 'Playback queue changed before the command could be applied.' };
    }

    var contents;
    try { contents = plman.GetPlaybackQueueContents(); }
    catch (e) { return { accepted: false, message: 'Direct playback queue access failed: ' + e.message }; }

    var indexes = queueBridgeQueueIndexes(command, contents.length);
    if (command.action !== 'clear' && !indexes.length) {
        return { accepted: false, message: 'No valid playback queue entries were selected.' };
    }

    queueBridgeMutationInProgress = true;
    try {
        switch (command.action) {
        case 'remove':
            plman.RemoveItemFromPlaybackQueue(indexes[0]);
            break;
        case 'removeMany':
            plman.RemoveItemsFromPlaybackQueue(indexes);
            break;
        case 'clear':
            plman.FlushPlaybackQueue();
            break;
        case 'moveUp':
        case 'moveDown':
        case 'moveTop':
        case 'moveBottom':
            queueBridgeRestoreQueue(queueBridgeReorder(contents, indexes, command.action));
            break;
        default:
            return { accepted: false, message: 'Unsupported playback queue command.' };
        }
    } catch (e) {
        return { accepted: false, message: 'Playback queue command failed: ' + e.message };
    } finally {
        queueBridgeMutationInProgress = false;
    }

    writeQueueBridgeState();
    return { accepted: true, message: '' };
}

function acknowledgeQueueBridgeCommandFile() {
    try {
        var removed = utils.RemovePath(QUEUE_BRIDGE_COMMAND_FILE);
        if (removed === false) throw new Error('utils.RemovePath returned false');
        return true;
    } catch (e) {
        // Keep compatibility with hosts that cannot remove the bridge file.
        // A blank acknowledgement still prevents a processed command payload
        // from being replayed or reparsed indefinitely.
        try {
            var cleared = utils.WriteTextFile(QUEUE_BRIDGE_COMMAND_FILE, '');
            if (cleared === false) throw new Error('utils.WriteTextFile returned false');
            return true;
        } catch (clearError) {
            console.log('[DarkOneJSP3] Queue command acknowledgement failed: ' + clearError.message);
            return false;
        }
    }
}

function pollQueueBridgeCommand() {
    queueBridgeCommandTimer = 0;
    try {
        if (utils.IsFile(QUEUE_BRIDGE_COMMAND_FILE)) {
            var command = QUEUE_BRIDGE_PROTOCOL.parseCommand(
                utils.ReadTextFile(QUEUE_BRIDGE_COMMAND_FILE, 65001)
            );
            if (command) {
                if (command.id !== queueBridgeLastCommandId) {
                    // Mark first: even a failing mutation must never be replayed.
                    queueBridgeLastCommandId = command.id;
                    var outcome = executeQueueBridgeCommand(command);
                    writeQueueBridgeResult(command, outcome.accepted, outcome.message);
                }
                // Commands are short-lived. Remove the processed/stale payload
                // so the 25 ms poll normally performs only a cheap existence check.
                acknowledgeQueueBridgeCommandFile();
            }
        }
    } catch (e) {
        console.log('[DarkOneJSP3] Queue command bridge failed: ' + e.message);
    }
    queueBridgeCommandTimer = setTimeout(pollQueueBridgeCommand, QUEUE_BRIDGE_COMMAND_POLL_MS);
}

function initialiseQueueCommandBridge() {
    if (queueBridgeCommandTimer) clearTimeout(queueBridgeCommandTimer);
    queueBridgeCommandTimer = setTimeout(pollQueueBridgeCommand, QUEUE_BRIDGE_COMMAND_POLL_MS);
}

function scheduleQueueBridgeRefresh() {
    if (queueBridgeRefreshTimer) clearTimeout(queueBridgeRefreshTimer);
    queueBridgeRefreshTimer = setTimeout(function () {
        queueBridgeRefreshTimer = 0;
        writeQueueBridgeState();
    }, 10);
}

function initialiseQueueBridge() {
    // writeQueueBridgeState() owns bounded publication retry, so startup does
    // not need a second independent retry timer.
    writeQueueBridgeState();
}

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

function on_playback_queue_changed(origin) {
    // Queue mutations are republished once by the command bridge after the
    // complete operation, avoiding transient partially-rebuilt reorder states.
    if (queueBridgeMutationInProgress) return;
    writeQueueBridgeState();
}

function on_playlists_changed() {
    scheduleQueueBridgeRefresh();
}

function on_playlist_items_added(playlistIndex) {
    scheduleQueueBridgeRefresh();
}

function on_playlist_items_removed(playlistIndex, newCount) {
    scheduleQueueBridgeRefresh();
}

function on_playlist_items_reordered(playlistIndex) {
    scheduleQueueBridgeRefresh();
}

function on_script_unload() {
    clearStartupTimers();
    if (queueBridgeRefreshTimer) {
        clearTimeout(queueBridgeRefreshTimer);
        queueBridgeRefreshTimer = 0;
    }
    if (queueBridgeCommandTimer) {
        clearTimeout(queueBridgeCommandTimer);
        queueBridgeCommandTimer = 0;
    }
}

// Publish a fresh session immediately. This overwrites any state file left by
// an earlier foobar2000 run before the Queue Viewer has a chance to use it.
initialiseQueueBridge();
initialiseQueueCommandBridge();
