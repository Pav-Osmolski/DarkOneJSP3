"use strict";

// InfoStack-only adapters for startup readiness and the shared side-divider
// protocol. Startup configuration is presented by TOOLS and remains owned by
// Root; this helper retains only the InfoStack readiness handshake.
//
// Version history (newest first):
// v0.2.0 removes Startup configuration from InfoStack after TOOLS gained its
// dedicated root-owned state and command bridge.
//
// v0.1.2 removes obsolete protocol aliases left behind after the local-owner
// INFOSTACK popup integration; notification and property semantics are unchanged.

var STARTUP_PROTOCOL = DarkOneProtocol.startup;
var startupReadiness = STARTUP_PROTOCOL.createReadinessBridge(
    window,
    'InfoStack'
);

var DIVIDER_PROTOCOL = DarkOneProtocol.divider;
var DIVIDER_BLACK = DIVIDER_PROTOCOL.modes.black;
var DIVIDER_CUSTOM = DIVIDER_PROTOCOL.modes.custom;
var DIVIDER_MENU_OPTIONS = DIVIDER_PROTOCOL.menuOptions(900);
var dividerMenuMode = DIVIDER_BLACK;
var dividerMenuCustomColour = 0xff000000;
var dividerMenuStateKnown = false;

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
    if (typeof publishInfoStackMenuState === 'function') publishInfoStackMenuState();
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

function requestInfoStackDividerState() {
    if (!dividerMenuStateKnown) requestDividerState();
}

function appendInfoStackDividerMenu(menu) {
    DarkOneColour.appendRadioOptions(
        menu,
        DIVIDER_MENU_OPTIONS,
        dividerMenuMode,
        dividerMenuCustomColour,
        MENU_STRING
    );
    menu.AppendMenuSeparator();
    menu.AppendMenuItem(MENU_STRING, 106, 'Set custom colour...');
}

function handleInfoStackBridgeMenu(id) {
    var selected = DarkOneColour.optionForId(DIVIDER_MENU_OPTIONS, id);
    if (selected) {
        setDividerState(selected.mode);
        return true;
    }
    if (id === 106) {
        chooseCustomDividerColour();
        return true;
    }

    return false;
}

function handleInfoStackBridgeNotification(name, data) {
    if (name === DIVIDER_PROTOCOL.notifications.state) {
        var receivedState = DIVIDER_PROTOCOL.parseState(data);
        if (receivedState) {
            dividerMenuMode = receivedState.mode;
            dividerMenuCustomColour = receivedState.customColour;
            dividerMenuStateKnown = true;
            if (typeof publishInfoStackMenuState === 'function') publishInfoStackMenuState();
        }
        return true;
    }

    return startupReadiness.handle(name);
}
