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
var bottomAreaCommitPollTimer = null;
var bottomAreaCommitApplyTimer = null;
var bottomAreaPendingCommitId = '';
var bottomAreaStateFileSnapshot = '';
var lastResetCommandId = '';
var lastQuickSearchLayoutCommandId = '';
var lastViewCommandId = '';

var BOTTOM_AREA_PROTOCOL = DarkOneProtocol.bottomArea;
var RUNTIME_DATA_DIR = fb.ProfilePath + 'js_data\\';
var BOTTOM_AREA_STATE_FILE = RUNTIME_DATA_DIR + 'darkonejsp3.bottom-area-state.txt';
var BOTTOM_AREA_COMMIT_FILE = RUNTIME_DATA_DIR + 'darkonejsp3.bottom-area-command.txt';
var BOTTOM_AREA_COMMIT_POLL_MS = 25;
var BOTTOM_AREA_LEGACY_STATE_FILE = fb.ProfilePath + 'DarkOneJSP3\\shared\\bottom-area-state.txt';
var RESET_COMMAND_FILE = RUNTIME_DATA_DIR + 'darkonejsp3.reset-command.txt';
var QUICKSEARCH_LAYOUT_COMMAND_FILE = RUNTIME_DATA_DIR + 'darkonejsp3.quicksearch-layout-command.txt';
var VIEW_COMMAND_FILE = DarkOneViewBridge.commandFile;
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
var QUICKSEARCH_LAYOUT_LINES_PROPERTY = 'DARKONEJSP3.QUICKSEARCH.LAYOUT.LINES';
var QUICKSEARCH_LAYOUT_WIDTH_PROPERTY = 'DARKONEJSP3.QUICKSEARCH.LAYOUT.WIDTH.PERCENT';
var QUICKSEARCH_LAYOUT_LINE_PIXELS_PROPERTY = 'DARKONEJSP3.QUICKSEARCH.LAYOUT.LINE.PIXELS';

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


function broadcastBottomAreaCommit(commit) {
    var serialised = BOTTOM_AREA_PROTOCOL.serialiseCommit(commit);
    if (!serialised) return false;
    try {
        window.NotifyOthers(BOTTOM_AREA_PROTOCOL.notifications.commit, serialised);
        return true;
    } catch (e) {}
    return false;
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
    // A coordinated commit owns the visual transition until applyAt. If the
    // 100 ms fallback happens to run before the 25 ms commit poll, consume the
    // command here instead of exposing the canonical state early.
    if (!bottomAreaPendingCommitId) {
        try {
            if (utils.IsFile(BOTTOM_AREA_COMMIT_FILE)) syncBottomAreaCommitFile();
        } catch (e) {}
    }
    if (bottomAreaPendingCommitId) return false;
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


function acknowledgeBottomAreaCommitFile() {
    try {
        var result = utils.RemovePath(BOTTOM_AREA_COMMIT_FILE);
        if (result === false) throw new Error('utils.RemovePath returned false');
        return true;
    } catch (e) {
        return tryWriteRuntimeFile(
            BOTTOM_AREA_COMMIT_FILE,
            '',
            'bottom-area commit acknowledgement'
        );
    }
}

function readBottomAreaCommitFile() {
    try {
        return {
            raw: String(utils.ReadTextFile(BOTTOM_AREA_COMMIT_FILE, 65001) || ''),
            commit: null
        };
    } catch (e) {}
    return null;
}

function cancelPendingBottomAreaCommit() {
    if (bottomAreaCommitApplyTimer) clearTimeout(bottomAreaCommitApplyTimer);
    bottomAreaCommitApplyTimer = null;
    bottomAreaPendingCommitId = '';
}

function applyPendingBottomAreaCommit(commit) {
    if (!commit || commit.id !== bottomAreaPendingCommitId) return false;
    bottomAreaCommitApplyTimer = null;
    bottomAreaPendingCommitId = '';
    bottomAreaStateFileSnapshot = BOTTOM_AREA_PROTOCOL.serialiseState(commit.state);
    return applyBottomAreaState(commit.state, true);
}

function scheduleBottomAreaCommit(commit) {
    commit = BOTTOM_AREA_PROTOCOL.parseCommit(commit, new Date().getTime());
    if (!commit) return false;
    cancelPendingBottomAreaCommit();
    bottomAreaPendingCommitId = commit.id;
    // Relay immediately inside the JSplitter host. Display/Waveform receives the
    // same absolute applyAt value and schedules its repaint for the same frame.
    broadcastBottomAreaCommit(commit);
    var delay = Math.max(0, commit.applyAt - new Date().getTime());
    if (delay <= 0) return applyPendingBottomAreaCommit(commit);
    bottomAreaCommitApplyTimer = setTimeout(function () {
        applyPendingBottomAreaCommit(commit);
    }, delay);
    return true;
}

function syncBottomAreaCommitFile() {
    try {
        if (!utils.IsFile(BOTTOM_AREA_COMMIT_FILE)) return false;
    } catch (e) { return false; }
    var state = readBottomAreaCommitFile();
    if (!state) return false;
    state.commit = BOTTOM_AREA_PROTOCOL.parseCommit(state.raw, new Date().getTime());
    if (!state.commit) {
        if (state.raw) acknowledgeBottomAreaCommitFile();
        return false;
    }
    if (state.commit.id === bottomAreaPendingCommitId) {
        acknowledgeBottomAreaCommitFile();
        return false;
    }
    scheduleBottomAreaCommit(state.commit);
    acknowledgeBottomAreaCommitFile();
    return true;
}

function pollBottomAreaCommitFile() {
    bottomAreaCommitPollTimer = null;
    syncBottomAreaCommitFile();
    bottomAreaCommitPollTimer = setTimeout(
        pollBottomAreaCommitFile,
        BOTTOM_AREA_COMMIT_POLL_MS
    );
}

function initialiseBottomAreaCommitBridge() {
    if (bottomAreaCommitPollTimer) clearTimeout(bottomAreaCommitPollTimer);
    syncBottomAreaCommitFile();
    bottomAreaCommitPollTimer = setTimeout(
        pollBottomAreaCommitFile,
        BOTTOM_AREA_COMMIT_POLL_MS
    );
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

function readQuickSearchLayoutCommand() {
    try {
        var parts = String(utils.ReadTextFile(QUICKSEARCH_LAYOUT_COMMAND_FILE, 65001) || '').split('|');
        if (parts[0] !== 'v1' && parts[0] !== 'v2' && parts[0] !== 'v3') return null;
        if ((parts[0] === 'v1' && parts.length !== 4) ||
            ((parts[0] === 'v2' || parts[0] === 'v3') && parts.length !== 5)) return null;
        var id = String(parts[1] || '');
        var lines = Math.round(Number(parts[2]));
        var widthPercent = Math.round(Number(parts[3]));
        var linePixels = parts[0] === 'v1' ? 24 : Math.round(Number(parts[4]));
        if (!id || !isFinite(lines) || !isFinite(widthPercent) || !isFinite(linePixels)) return null;
        // v1/v2 used 1-4 fixed line counts. Preserve 1/2 and safely migrate
        // obsolete 3/4-line values to the new two-line maximum. v3 adds 0 = Auto.
        if (parts[0] !== 'v3') lines = DOJSP3.clamp(lines, 1, 2);
        else lines = DOJSP3.clamp(lines, 0, 2);
        return {
            id: id,
            lines: lines,
            widthPercent: DOJSP3.clamp(widthPercent, 20, 100),
            linePixels: DOJSP3.clamp(linePixels, 24, 58)
        };
    } catch (e) {}
    return null;
}

function acknowledgeQuickSearchLayoutCommand() {
    try {
        var result = utils.RemovePath(QUICKSEARCH_LAYOUT_COMMAND_FILE);
        if (result === false) throw new Error('utils.RemovePath returned false');
        return true;
    } catch (e) {
        return tryWriteRuntimeFile(
            QUICKSEARCH_LAYOUT_COMMAND_FILE,
            '',
            'Quick Search layout acknowledgement'
        );
    }
}

function syncQuickSearchLayoutCommand() {
    var command = readQuickSearchLayoutCommand();
    if (!command) return false;
    if (command.id === lastQuickSearchLayoutCommandId) {
        acknowledgeQuickSearchLayoutCommand();
        return false;
    }
    lastQuickSearchLayoutCommandId = command.id;
    var oldLines = Math.round(Number(window.GetProperty(QUICKSEARCH_LAYOUT_LINES_PROPERTY, 2)));
    var oldWidth = Math.round(Number(window.GetProperty(QUICKSEARCH_LAYOUT_WIDTH_PROPERTY, 44)));
    var oldLinePixels = Math.round(Number(window.GetProperty(QUICKSEARCH_LAYOUT_LINE_PIXELS_PROPERTY, 24)));
    window.SetProperty(QUICKSEARCH_LAYOUT_LINES_PROPERTY, command.lines);
    window.SetProperty(QUICKSEARCH_LAYOUT_WIDTH_PROPERTY, command.widthPercent);
    window.SetProperty(QUICKSEARCH_LAYOUT_LINE_PIXELS_PROPERTY, command.linePixels);
    acknowledgeQuickSearchLayoutCommand();
    var changed = oldLines !== command.lines || oldWidth !== command.widthPercent ||
        oldLinePixels !== command.linePixels;
    if (changed && ww > 0 && wh > 0) {
        layoutBottomControls();
        window.Repaint();
    }
    return changed;
}

function readViewCommandFile() {
    try {
        var raw = String(utils.ReadTextFile(VIEW_COMMAND_FILE, 65001) || '');
        return {
            raw: raw,
            command: DarkOneViewBridge.parse(raw, new Date().getTime())
        };
    } catch (e) {}
    return null;
}

function acknowledgeViewCommandFile() {
    try {
        var result = utils.RemovePath(VIEW_COMMAND_FILE);
        if (result === false) throw new Error('utils.RemovePath returned false');
        return true;
    } catch (e) {
        return tryWriteRuntimeFile(VIEW_COMMAND_FILE, '', 'view-command acknowledgement');
    }
}

function syncViewCommandFile() {
    var state = readViewCommandFile();
    if (!state) return false;
    var command = state.command;
    if (!command) {
        // A crash/restart can leave an expired or malformed command behind.
        // Remove non-empty invalid payloads once so the 100 ms bridge does not
        // reread the same stale command for the remainder of the session.
        if (state.raw) acknowledgeViewCommandFile();
        return false;
    }
    if (command.id === lastViewCommandId) {
        acknowledgeViewCommandFile();
        return false;
    }
    lastViewCommandId = command.id;
    var payload = DarkOneViewBridge.serialiseNotification(command.command, command.anchorX);
    if (payload) {
        try { window.NotifyOthers(DarkOneViewBridge.notification, payload); } catch (e) {}
    }
    acknowledgeViewCommandFile();
    return !!payload;
}

function ensureRuntimeBridge() {
    if (runtimeBridgePollTimer) return;
    lastResetCommandId = String(window.GetProperty(LAST_RESET_COMMAND_PROPERTY, '') || '');
    initialiseBottomAreaCommitBridge();
    syncBottomAreaStateFile(true);
    syncResetCommandFile();
    syncQuickSearchLayoutCommand();
    syncViewCommandFile();
    runtimeBridgePollTick = 0;
    runtimeBridgePollTimer = setInterval(function () {
        syncBottomAreaStateFile(false);
        syncQuickSearchLayoutCommand();
        syncViewCommandFile();
        runtimeBridgePollTick++;
        if (runtimeBridgePollTick >= RESET_COMMAND_POLL_DIVISOR) {
            runtimeBridgePollTick = 0;
            syncResetCommandFile();
        }
    }, RUNTIME_BRIDGE_POLL_INTERVAL);
}

function disposeRuntimeBridge() {
    if (runtimeBridgePollTimer) clearInterval(runtimeBridgePollTimer);
    runtimeBridgePollTimer = null;
    runtimeBridgePollTick = 0;
    if (bottomAreaCommitPollTimer) clearTimeout(bottomAreaCommitPollTimer);
    bottomAreaCommitPollTimer = null;
    cancelPendingBottomAreaCommit();
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
    var quickSearchWidthPercent = DOJSP3.clamp(
        Math.round(Number(window.GetProperty(QUICKSEARCH_LAYOUT_WIDTH_PROPERTY, 44))),
        20,
        100
    );
    var quickSearchLines = DOJSP3.clamp(
        Math.round(Number(window.GetProperty(QUICKSEARCH_LAYOUT_LINES_PROPERTY, 2))),
        0,
        2
    );
    var quickSearchOuterWidth = DOJSP3.clamp(
        DOJSP3.mulDiv(panelWidth, quickSearchWidthPercent, 100),
        1,
        ww
    );
    var quickSearchLinePixels = DOJSP3.clamp(
        Math.round(Number(window.GetProperty(QUICKSEARCH_LAYOUT_LINE_PIXELS_PROPERTY, 24))),
        24,
        58
    );

    // Quick Search owns the lower-left slot beneath ControlsLeft. Derive that
    // slot first, then size inside it; fixed modes are preferred heights, never
    // demands that can overlap the controls above. Automatic consumes the whole
    // slot. This keeps every mode safe during aggressive vertical resizing.
    var leftHeight = DOJSP3.clamp(DOJSP3.mulDiv(wh, 5, 8), 1, wh);
    var quickSearchBottomInset = Math.max(2, DOJSP3.idiv(wh, 8));
    var quickSearchGap = DOJSP3.clamp(DOJSP3.idiv(wh, 64), 2, 8);
    var quickSearchAreaBottom = Math.max(0, wh - quickSearchBottomInset);
    var quickSearchAreaTop = Math.min(quickSearchAreaBottom, leftHeight + quickSearchGap);
    var quickSearchAvailableHeight = Math.max(1, quickSearchAreaBottom - quickSearchAreaTop);
    var quickSearchPreferredHeight = 12 + quickSearchLinePixels * Math.max(1, quickSearchLines);
    var quickSearchHeight = quickSearchLines === 0
        ? quickSearchAvailableHeight
        : Math.min(quickSearchPreferredHeight, quickSearchAvailableHeight);
    quickSearchHeight = Math.max(1, quickSearchHeight);
    var quickSearchTop = Math.max(0, quickSearchAreaBottom - quickSearchHeight);
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

    DOJSP3.move(left, 0, 0, sideWidth, leftHeight);
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

    // Match the original DarkOne2021/PSS Quick Search outer frame exactly:
    // a two-pixel #696969 border with a #1e1e1e interior. The scripted
    // Quick Search normally uses its own internal frame setting of None.
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
