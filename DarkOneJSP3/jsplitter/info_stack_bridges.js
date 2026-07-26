"use strict";

// InfoStack-only adapters for the shared startup and side-divider protocols.
// Property ownership remains with Root and Main Columns respectively; this
// helper owns only the InfoStack menu state and notification plumbing.

var STARTUP_PROTOCOL = DarkOneProtocol.startup;
var startupReadiness = STARTUP_PROTOCOL.createReadinessBridge(
    window,
    'InfoStack'
);

var DIVIDER_PROTOCOL = DarkOneProtocol.divider;
var DIVIDER_TRANSPARENT = DIVIDER_PROTOCOL.modes.transparent;
var DIVIDER_BLACK = DIVIDER_PROTOCOL.modes.black;
var DIVIDER_DARKONE = DIVIDER_PROTOCOL.modes.darkOne;
var DIVIDER_CUSTOM = DIVIDER_PROTOCOL.modes.custom;
var DIVIDER_DARKONE_DARK = DIVIDER_PROTOCOL.modes.darkOneDark;
var DIVIDER_COLUMNS_UI = DIVIDER_PROTOCOL.modes.columnsUi;
var DIVIDER_MENU_OPTIONS = DIVIDER_PROTOCOL.menuOptions(900);
var dividerMenuMode = DIVIDER_BLACK;
var dividerMenuCustomColour = 0xff000000;
var dividerMenuStateKnown = false;

var STARTUP_OFF = STARTUP_PROTOCOL.transitions.off;
var STARTUP_BLACK_REVEAL = STARTUP_PROTOCOL.transitions.blackReveal;
var STARTUP_STAGED_REVEAL = STARTUP_PROTOCOL.transitions.stagedReveal;
var startupMenuTransition = STARTUP_PROTOCOL.defaults.transition;
var startupMenuMinimumDelay = STARTUP_PROTOCOL.defaults.minimumDelay;
var startupMenuReadinessTimeout = STARTUP_PROTOCOL.defaults.readinessTimeout;
var startupMenuStateKnown = false;

function requestDividerState() {
    window.NotifyOthers(
        DIVIDER_PROTOCOL.notifications.query,
        DIVIDER_PROTOCOL.version
    );
}

function setDividerState(mode, customColour) {
    dividerMenuMode = DIVIDER_PROTOCOL.normaliseMode(mode);
    if (typeof customColour !== 'undefined') {
        dividerMenuCustomColour = DarkOneColour.opaque(customColour);
    }
    dividerMenuStateKnown = true;
    window.NotifyOthers(
        DIVIDER_PROTOCOL.notifications.set,
        DIVIDER_PROTOCOL.serialiseState(
            dividerMenuMode,
            dividerMenuCustomColour
        )
    );
}

function chooseCustomDividerColour() {
    var chosen = DarkOneColour.pickJsplitter(
        dividerMenuCustomColour,
        window.Name,
        'Enter a side-divider colour as #RRGGBB or R,G,B.'
    );
    if (chosen === null) return;
    setDividerState(DIVIDER_CUSTOM, chosen);
}

function applyStartupMenuState(state) {
    startupMenuTransition = state.transition;
    startupMenuMinimumDelay = state.minimumDelay;
    startupMenuReadinessTimeout = state.readinessTimeout;
    startupMenuStateKnown = true;
}

function requestStartupControlState() {
    window.NotifyOthers(
        STARTUP_PROTOCOL.notifications.queryControls,
        STARTUP_PROTOCOL.version
    );
}

function sendStartupControlCommand(action, key, value) {
    var message = STARTUP_PROTOCOL.serialiseCommand(action, key, value);
    if (message === null) return false;
    window.NotifyOthers(STARTUP_PROTOCOL.notifications.commandControls, message);
    return true;
}

function setStartupTransition(mode) {
    startupMenuTransition = STARTUP_PROTOCOL.normaliseValue(
        'transition',
        mode
    );
    startupMenuStateKnown = true;
    sendStartupControlCommand('set', 'transition', startupMenuTransition);
}

function setStartupTiming(key, title, current, minimum, maximum) {
    try {
        var entered = Math.round(Number(utils.InputBox(
            'Enter a value from ' + minimum + ' to ' + maximum +
                ' milliseconds.',
            title,
            String(current)
        )));
        if (!isFinite(entered) || entered < minimum || entered > maximum) {
            try {
                fb.ShowPopupMessage(
                    'Enter a value from ' + minimum + ' to ' + maximum +
                        ' milliseconds.',
                    title
                );
            } catch (e) {}
            return;
        }
        if (key === 'minimum-delay') startupMenuMinimumDelay = entered;
        else startupMenuReadinessTimeout = entered;
        startupMenuStateKnown = true;
        sendStartupControlCommand('set', key, entered);
    } catch (e2) {}
}

function restoreStartupControlDefaults() {
    startupMenuTransition = STARTUP_PROTOCOL.defaults.transition;
    startupMenuMinimumDelay = STARTUP_PROTOCOL.defaults.minimumDelay;
    startupMenuReadinessTimeout = STARTUP_PROTOCOL.defaults.readinessTimeout;
    startupMenuStateKnown = true;
    sendStartupControlCommand('restore');
}

function requestInfoStackBridgeStates() {
    if (!dividerMenuStateKnown) requestDividerState();
    if (!startupMenuStateKnown) requestStartupControlState();
}

function appendInfoStackDividerMenu(menu) {
    DarkOneColour.appendRadioOptions(
        menu,
        DIVIDER_MENU_OPTIONS,
        dividerMenuMode,
        dividerMenuCustomColour,
        MENU_STRING
    );
}

function appendInfoStackStartupMenu(menu, transitionMenu) {
    transitionMenu.AppendMenuItem(MENU_STRING, 1000, 'Off');
    transitionMenu.AppendMenuItem(MENU_STRING, 1001, 'Black reveal');
    transitionMenu.AppendMenuItem(MENU_STRING, 1002, 'Staged reveal');
    transitionMenu.CheckMenuRadioItem(
        1000,
        1002,
        1000 + startupMenuTransition
    );
    transitionMenu.AppendTo(menu, MENU_POPUP, 'Transition');
    menu.AppendMenuItem(
        MENU_STRING,
        1010,
        'Minimum black hold... (' + startupMenuMinimumDelay + ' ms)'
    );
    menu.AppendMenuItem(
        MENU_STRING,
        1011,
        'Layout-readiness timeout... (' +
            startupMenuReadinessTimeout + ' ms)'
    );
    menu.AppendMenuSeparator();
    menu.AppendMenuItem(
        startupMenuTransition === STARTUP_OFF ? MENU_GRAYED : MENU_STRING,
        1012,
        'Preview startup transition'
    );
    menu.AppendMenuItem(MENU_STRING, 1013, 'Restore startup defaults');
}

function handleInfoStackBridgeMenu(id) {
    var selected = DarkOneColour.optionForId(DIVIDER_MENU_OPTIONS, id);
    if (selected) {
        if (selected.custom) chooseCustomDividerColour();
        else setDividerState(selected.mode);
        return true;
    }

    if (id === 1000 || id === 1001 || id === 1002) {
        setStartupTransition(id - 1000);
    } else if (id === 1010) {
        setStartupTiming(
            'minimum-delay',
            'DarkOneJSP3 minimum black hold',
            startupMenuMinimumDelay,
            0,
            5000
        );
    } else if (id === 1011) {
        setStartupTiming(
            'readiness-timeout',
            'DarkOneJSP3 layout-readiness timeout',
            startupMenuReadinessTimeout,
            500,
            10000
        );
    } else if (id === 1012) {
        sendStartupControlCommand('preview');
    } else if (id === 1013) {
        restoreStartupControlDefaults();
    } else {
        return false;
    }
    return true;
}

function handleInfoStackBridgeNotification(name, data) {
    if (name === STARTUP_PROTOCOL.notifications.stateControls) {
        var startupState = STARTUP_PROTOCOL.parseState(data);
        if (startupState) applyStartupMenuState(startupState);
        return true;
    }

    if (name === DIVIDER_PROTOCOL.notifications.state) {
        var receivedState = DIVIDER_PROTOCOL.parseState(data);
        if (receivedState) {
            dividerMenuMode = receivedState.mode;
            dividerMenuCustomColour = receivedState.customColour;
            dividerMenuStateKnown = true;
        }
        return true;
    }

    return startupReadiness.handle(name);
}
