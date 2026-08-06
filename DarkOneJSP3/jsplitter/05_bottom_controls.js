"use strict";
include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\shared.js');

var DARKONEJSP3_RESET_ROLE = "bottom-controls";

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
var runtimeBridgePollTimer = null;
var runtimeBridgePollTick = 0;
var bottomAreaStateFileSnapshot = '';
var lastResetCommandId = '';

var BOTTOM_AREA_PROTOCOL = DarkOneProtocol.bottomArea;
var RUNTIME_DATA_DIR = fb.ProfilePath + 'js_data\\';
var BOTTOM_AREA_STATE_FILE = RUNTIME_DATA_DIR + 'darkonejsp3.bottom-area-state.txt';
var BOTTOM_AREA_LEGACY_STATE_FILE = fb.ProfilePath + 'DarkOneJSP3\\shared\\bottom-area-state.txt';
var RESET_COMMAND_FILE = RUNTIME_DATA_DIR + 'darkonejsp3.reset-command.txt';
var RUNTIME_BRIDGE_POLL_INTERVAL = 100;
var RESET_COMMAND_POLL_INTERVAL = 500;
var RESET_COMMAND_POLL_DIVISOR = Math.max(1, Math.round(
    RESET_COMMAND_POLL_INTERVAL / RUNTIME_BRIDGE_POLL_INTERVAL
));
var LAST_RESET_COMMAND_PROPERTY = 'DARKONEJSP3.RESET.LAST.COMMAND.ID';
var BOTTOM_BACKGROUND_MODE_PROPERTY = 'DARKONEJSP3.BOTTOM.BACKGROUND.MODE';
var BOTTOM_BACKGROUND_CUSTOM_PROPERTY = 'DARKONEJSP3.BOTTOM.BACKGROUND.CUSTOM.COLOUR';
var BOTTOM_DIVIDER_MODE_PROPERTY = 'DARKONEJSP3.BOTTOM.DIVIDER.MODE';
var BOTTOM_DIVIDER_CUSTOM_PROPERTY = 'DARKONEJSP3.BOTTOM.DIVIDER.CUSTOM.COLOUR';

function bottomAreaState() {
    return BOTTOM_AREA_PROTOCOL.state(
        window.GetProperty(
            BOTTOM_BACKGROUND_MODE_PROPERTY,
            BOTTOM_AREA_PROTOCOL.defaults.backgroundMode
        ),
        window.GetProperty(
            BOTTOM_BACKGROUND_CUSTOM_PROPERTY,
            BOTTOM_AREA_PROTOCOL.defaults.backgroundCustomColour
        ),
        window.GetProperty(
            BOTTOM_DIVIDER_MODE_PROPERTY,
            BOTTOM_AREA_PROTOCOL.defaults.dividerMode
        ),
        window.GetProperty(
            BOTTOM_DIVIDER_CUSTOM_PROPERTY,
            BOTTOM_AREA_PROTOCOL.defaults.dividerCustomColour
        )
    );
}

function sameBottomAreaState(a, b) {
    return a && b &&
        a.backgroundMode === b.backgroundMode &&
        (a.backgroundCustomColour >>> 0) === (b.backgroundCustomColour >>> 0) &&
        a.dividerMode === b.dividerMode &&
        (a.dividerCustomColour >>> 0) === (b.dividerCustomColour >>> 0);
}

function applyBottomAreaState(state, repaint) {
    state = BOTTOM_AREA_PROTOCOL.parseState(state);
    if (!state) return false;
    var changed = !sameBottomAreaState(bottomAreaState(), state);
    window.SetProperty(BOTTOM_BACKGROUND_MODE_PROPERTY, state.backgroundMode);
    window.SetProperty(BOTTOM_BACKGROUND_CUSTOM_PROPERTY, state.backgroundCustomColour);
    window.SetProperty(BOTTOM_DIVIDER_MODE_PROPERTY, state.dividerMode);
    window.SetProperty(BOTTOM_DIVIDER_CUSTOM_PROPERTY, state.dividerCustomColour);
    if (changed && repaint !== false) window.Repaint();
    return changed;
}

function broadcastBottomAreaState(state) {
    state = BOTTOM_AREA_PROTOCOL.parseState(state) || bottomAreaState();
    try {
        window.NotifyOthers(
            BOTTOM_AREA_PROTOCOL.notifications.state,
            BOTTOM_AREA_PROTOCOL.serialiseState(state)
        );
    } catch (e) {}
}

function ensureRuntimeDataFolder() {
    try { utils.CreateFolder(RUNTIME_DATA_DIR); } catch (e) {}
}

function logRuntimeBridgeFailure(label, path, detail) {
    try {
        console.log('[DarkOneJSP3] Unable to write ' + label + ' at "' + path + '": ' + detail);
    } catch (e) {}
}

function tryWriteRuntimeFile(path, content, label) {
    ensureRuntimeDataFolder();
    try {
        var result = utils.WriteTextFile(path, String(content));
        if (result === false) {
            logRuntimeBridgeFailure(label, path, 'utils.WriteTextFile returned false');
            return false;
        }
        return true;
    } catch (e) {
        logRuntimeBridgeFailure(label, path, String(e));
    }
    return false;
}

function readBottomAreaStatePath(path) {
    try {
        return BOTTOM_AREA_PROTOCOL.parseState(utils.ReadTextFile(path, 65001));
    } catch (e) {}
    return null;
}

function readBottomAreaStateFile() {
    var current = readBottomAreaStatePath(BOTTOM_AREA_STATE_FILE);
    if (current) return current;
    var legacy = readBottomAreaStatePath(BOTTOM_AREA_LEGACY_STATE_FILE);
    if (!legacy) return null;
    writeBottomAreaStateFile(legacy);
    return legacy;
}

function writeBottomAreaStateFile(state) {
    state = BOTTOM_AREA_PROTOCOL.parseState(state) || bottomAreaState();
    var serialised = BOTTOM_AREA_PROTOCOL.serialiseState(state);
    if (!tryWriteRuntimeFile(
            BOTTOM_AREA_STATE_FILE,
            serialised,
            'shared bottom-area state')) return false;
    bottomAreaStateFileSnapshot = serialised;
    broadcastBottomAreaState(state);
    return true;
}

function syncBottomAreaStateFile(createIfMissing) {
    var state = readBottomAreaStateFile();
    if (!state) {
        if (createIfMissing) writeBottomAreaStateFile(bottomAreaState());
        return false;
    }
    var serialised = BOTTOM_AREA_PROTOCOL.serialiseState(state);
    if (serialised === bottomAreaStateFileSnapshot) return false;
    bottomAreaStateFileSnapshot = serialised;
    var changed = applyBottomAreaState(state, true);
    broadcastBottomAreaState(state);
    return changed;
}

function readResetCommandFile() {
    try {
        return darkOneJsp3ParseResetCommand(
            utils.ReadTextFile(RESET_COMMAND_FILE, 65001),
            new Date().getTime()
        );
    } catch (e) {}
    return null;
}

function acknowledgeResetCommandFile() {
    try {
        var result = utils.RemovePath(RESET_COMMAND_FILE);
        if (result === false) throw new Error('utils.RemovePath returned false');
        return true;
    } catch (e) {
        // Older hosts may not expose RemovePath here. Clearing the short-lived
        // command still prevents a stale payload being reparsed indefinitely.
        return tryWriteRuntimeFile(RESET_COMMAND_FILE, '', 'factory-reset acknowledgement');
    }
}

function processResetCommand(command) {
    if (!command || command.id === lastResetCommandId) return false;
    lastResetCommandId = command.id;
    window.SetProperty(LAST_RESET_COMMAND_PROPERTY, command.id);

    darkOneJsp3ApplyRoleReset(DARKONEJSP3_RESET_ROLE, command.scope);
    if (command.scope === 'appearance' || command.scope === 'all') {
        writeBottomAreaStateFile(bottomAreaState());
    }

    var payload = JSON.stringify({
        version: 1,
        scope: command.scope,
        commandId: command.id
    });
    try { window.NotifyOthers(DARKONEJSP3_RESET_NOTIFICATION, payload); } catch (e) {}
    acknowledgeResetCommandFile();
    try { window.Reload(); } catch (e2) { window.Repaint(); }
    return true;
}

function syncResetCommandFile() {
    return processResetCommand(readResetCommandFile());
}

function ensureRuntimeBridge() {
    if (runtimeBridgePollTimer) return;
    lastResetCommandId = String(window.GetProperty(LAST_RESET_COMMAND_PROPERTY, '') || '');
    syncBottomAreaStateFile(true);
    syncResetCommandFile();
    runtimeBridgePollTick = 0;
    runtimeBridgePollTimer = setInterval(function () {
        syncBottomAreaStateFile(false);
        runtimeBridgePollTick++;
        if (runtimeBridgePollTick >= RESET_COMMAND_POLL_DIVISOR) {
            runtimeBridgePollTick = 0;
            syncResetCommandFile();
        }
    }, RUNTIME_BRIDGE_POLL_INTERVAL);
}

function disposeRuntimeBridge() {
    if (!runtimeBridgePollTimer) return;
    clearInterval(runtimeBridgePollTimer);
    runtimeBridgePollTimer = null;
    runtimeBridgePollTick = 0;
}

function bottomAreaColour(mode, customColour, transparentFallback) {
    if (mode === BOTTOM_AREA_PROTOCOL.modes.black) return 0xff000000;
    if (mode === BOTTOM_AREA_PROTOCOL.modes.darkOne) return DOJSP3.colours.bar;
    if (mode === BOTTOM_AREA_PROTOCOL.modes.darkOneDark) return DOJSP3.colours.separator;
    if (mode === BOTTOM_AREA_PROTOCOL.modes.columnsUi) {
        return DarkOneColour.columnsUi(3, DOJSP3.colours.bar);
    }
    if (mode === BOTTOM_AREA_PROTOCOL.modes.custom) {
        return DarkOneColour.opaque(customColour);
    }
    return transparentFallback;
}

function bottomBackgroundColour() {
    var state = bottomAreaState();
    return bottomAreaColour(
        state.backgroundMode,
        state.backgroundCustomColour,
        DOJSP3.colours.separator
    );
}

function bottomDividerColour() {
    var state = bottomAreaState();
    return bottomAreaColour(
        state.dividerMode,
        state.dividerCustomColour,
        bottomBackgroundColour()
    );
}

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
    ensureRuntimeBridge();
    layoutBottomControls();
}

function on_paint(gr) {
    var state = bottomAreaState();
    // Resolve Transparent / inherit parent to the common recessed parent tone.
    // Skipping this fill exposes JSplitter's native backing and creates mixed
    // #202020/#181818 regions across the composite bottom layout.
    gr.FillSolidRect(0, 0, ww, wh, bottomBackgroundColour());

    var px = Math.max(1, DOJSP3.idiv(ww, 640));
    var leftDivider = DOJSP3.idiv(ww, 3) - px;
    var rightDivider = ww - DOJSP3.idiv(ww, 3) - px;
    if (state.dividerMode !== BOTTOM_AREA_PROTOCOL.modes.transparent) {
        var dividerColour = bottomDividerColour();
        gr.FillSolidRect(leftDivider, 0, px * 2, wh, dividerColour);
        gr.FillSolidRect(rightDivider, 0, px * 2, wh, dividerColour);
    }

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
    if (name === DARKONEJSP3_RESET_NOTIFICATION) {
        var resetScope = darkOneJsp3ResetScope(data);
        if (resetScope && DARKONEJSP3_RESET_REGISTRY[DARKONEJSP3_RESET_ROLE]) {
            darkOneJsp3ApplyRoleReset(DARKONEJSP3_RESET_ROLE, resetScope);
            if (resetScope === 'appearance' || resetScope === 'all') {
                writeBottomAreaStateFile(bottomAreaState());
            }
            try { window.Reload(); } catch (e) { window.Repaint(); }
            return;
        }
    }
    startupReadiness.handle(name);
}

function on_colours_changed() {
    window.Repaint();
}

function on_script_unload() {
    disposeRuntimeBridge();
}
