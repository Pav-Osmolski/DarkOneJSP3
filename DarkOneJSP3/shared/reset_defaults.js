"use strict";

// Canonical DarkOneJSP3 factory defaults, grouped by the panel that owns them.
// This file is shared by JScript Panel and JSplitter to prevent drift.
var DARKONEJSP3_RESET_REGISTRY = {
    "control-left": {
        appearance: {
            "DARKONEJSP3.FONT.SCALE": 1.0,
            "DARKONEJSP3.BUTTON.HITBOX.SCALE": 1.0,
            "DARKONEJSP3.ICON.SCALE": 1.0,
            "DARKONEJSP3.BUTTON.ROUNDNESS": -1,
            "DARKONEJSP3.CONTROL.FONT.NAME": "Arial Black",
            "DARKONEJSP3.CONTROL.FONT.WEIGHT": 900,
            "Buttons appearance preset": 1,
            "Buttons depth preset": 0
        },
        behaviour: { "Remain Time": false },
        complete: {}
    },
    "control-right": {
        appearance: {
            "DARKONEJSP3.FONT.SCALE": 1.0,
            "DARKONEJSP3.BUTTON.HITBOX.SCALE": 1.0,
            "DARKONEJSP3.ICON.SCALE": 1.0,
            "DARKONEJSP3.BUTTON.ROUNDNESS": -1,
            "DARKONEJSP3.CONTROL.FONT.NAME": "Arial Black",
            "DARKONEJSP3.CONTROL.FONT.WEIGHT": 900,
            "DARKONEJSP3.VOLUME.KNOB.INDICATOR.MODE": 0,
            "DARKONEJSP3.VOLUME.KNOB.INDICATOR.COLOUR": 0xff404040,
            "Buttons appearance preset": 1,
            "Buttons depth preset": 0
        },
        behaviour: {
            "DARKONEJSP3.VOLUME.DRAG.REFRESH.MODE": 0
        },
        complete: {}
    },
    "display": {
        appearance: {
            "DARKONEJSP3.DISPLAY.FONT.SCALE": 1.0,
            "DARKONEJSP3.DISPLAY.LABEL.FONT.NAME": "Arial Black",
            "DARKONEJSP3.DISPLAY.LABEL.FONT.WEIGHT": 900,
            "DARKONEJSP3.DISPLAY.LABEL.FONT.SCALE": 1.0,
            "DARKONEJSP3.DISPLAY.VALUE.FONT.NAME": "Microsoft Sans Serif",
            "DARKONEJSP3.DISPLAY.VALUE.FONT.WEIGHT": 400,
            "DARKONEJSP3.DISPLAY.VALUE.FONT.SCALE": 1.0,
            "DARKONEJSP3.DISPLAY.ACCENT.MODE": 0,
            "DARKONEJSP3.DISPLAY.ACCENT.CUSTOM.COLOUR": 0xff298fcc,
            "Display Style": 0
        },
        behaviour: { "Remain Time on": false }
    },
    "root": {
        appearance: {},
        behaviour: {
            "DARKONEJSP3.STARTUP.TRANSITION": 0,
            "DARKONEJSP3.STARTUP.MINIMUM.DELAY": 250,
            "DARKONEJSP3.STARTUP.SAFETY.TIMEOUT": 2000
        }
    },
    "main-columns": {
        appearance: {
            "DARKONEJSP3.ART.SPECTRUM.DIVIDER.MODE": 1,
            "DARKONEJSP3.ART.SPECTRUM.DIVIDER.CUSTOM.COLOUR": 0xff000000
        },
        behaviour: {
            "DARKONEJSP3.MAIN.LAYOUT.MODE": 0
        }
    },
    "art-spectrum": {
        appearance: {},
        behaviour: {
            "DARKONEJSP3.ARTSPECTRUM.LAYOUT.MODE": 0
        }
    },
    "bottom-controls": {
        appearance: {
            "DARKONEJSP3.BOTTOM.BACKGROUND.MODE": 2,
            "DARKONEJSP3.BOTTOM.BACKGROUND.CUSTOM.COLOUR": 0xff000000,
            "DARKONEJSP3.BOTTOM.BACKGROUND.LINEAR.GRADIENT": false,
            "DARKONEJSP3.BOTTOM.DIVIDER.MODE": 4,
            "DARKONEJSP3.BOTTOM.DIVIDER.CUSTOM.COLOUR": 0xff000000,
            "DARKONEJSP3.BOTTOM.SIDE.DIVIDERS": true,
            "DARKONEJSP3.BOTTOM.DEPTH": 0,
            "DARKONEJSP3.QUICKSEARCH.LAYOUT.LINES": 2,
            "DARKONEJSP3.QUICKSEARCH.LAYOUT.WIDTH.PERCENT": 44,
            "DARKONEJSP3.QUICKSEARCH.LAYOUT.LINE.PIXELS": 24
        },
        behaviour: {}
    },
    "info-stack": {
        appearance: {
            "DarkOneJSP3.InfoStack.BackgroundColour": 0xff181818,
            "DarkOneJSP3.InfoStack.BackgroundMode": 4,
            "DarkOneJSP3.InfoStack.FontSize": 0,
            "DarkOneJSP3.InfoStack.AutoFontScale": 100,
            "DarkOneJSP3.InfoStack.TabAreaHeight": 0,
            "DarkOneJSP3.InfoStack.TabStripVisible": true,
            "DarkOneJSP3.InfoStack.TabColourMode": 0,
            "DarkOneJSP3.InfoStack.TabCustomColour": 0xff298fcc,
            "DarkOneJSP3.InfoStack.Tab.Playlists.Visible": true,
            "DarkOneJSP3.InfoStack.Tab.Playlists.Label": "Playlists",
            "DarkOneJSP3.InfoStack.Tab.Biography.Visible": true,
            "DarkOneJSP3.InfoStack.Tab.Biography.Label": "Biography",
            "DarkOneJSP3.InfoStack.Tab.Lastfm.Visible": true,
            "DarkOneJSP3.InfoStack.Tab.Lastfm.Label": "Last.fm",
            "DarkOneJSP3.InfoStack.Tab.Allmusic.Visible": true,
            "DarkOneJSP3.InfoStack.Tab.Allmusic.Label": "Album Notes",
            "DarkOneJSP3.InfoStack.Tab.Queue.Visible": true,
            "DarkOneJSP3.InfoStack.Tab.Queue.Label": "Queue",
            "DarkOneJSP3.InfoStack.Tab.Properties.Visible": true,
            "DarkOneJSP3.InfoStack.Tab.Properties.Label": "Properties"
        },
        behaviour: {
            "DarkOneJSP3.InfoStack.ActivePanel": 0,
            "DarkOneJSP3.InfoStack.LabelDefaultsVersion": 2
        }
    },
    "display-waveform": {
        appearance: {
            "DarkOneJSP3.DisplayWaveform.BackgroundColour": 0xff202020,
            "DarkOneJSP3.DisplayWaveform.BackgroundMode": 6
        },
        behaviour: {
            "DarkOneJSP3.DisplayWaveform.HideWhenStopped": true,
            "DarkOneJSP3.DisplayWaveform.NewTrackRevealDelay": 200
        }
    }

};


// Cross-component factory-reset command protocol. JScript Panel 3 and
// JSplitter do not share a notification bus, so the initiating JScript panel
// writes one short-lived command into js_data. The Bottom Controls JSplitter
// consumes it and rebroadcasts the established reset notification inside the
// JSplitter host domain.
var DARKONEJSP3_RESET_NOTIFICATION = "DarkOneJSP3.Reset.Properties";
var DARKONEJSP3_RESET_COMMAND_VERSION = "v1";
var DARKONEJSP3_RESET_COMMAND_MAX_AGE = 30000;

function darkOneJsp3ResetCommandScope(value) {
    value = String(value == null ? "" : value).toLowerCase();
    return value === "appearance" || value === "behaviour" || value === "all"
        ? value
        : null;
}

function darkOneJsp3SerialiseResetCommand(commandId, issuedAt, scope) {
    commandId = String(commandId || "").replace(/[|\r\n]/g, "");
    issuedAt = Math.round(Number(issuedAt));
    scope = darkOneJsp3ResetCommandScope(scope);
    if (!commandId || !isFinite(issuedAt) || issuedAt <= 0 || !scope) return null;
    return DARKONEJSP3_RESET_COMMAND_VERSION + "|" + commandId + "|" +
        String(issuedAt) + "|" + scope;
}

function darkOneJsp3ParseResetCommand(data, now) {
    var parts = String(data || "").split("|");
    if (parts.length !== 4 || parts[0] !== DARKONEJSP3_RESET_COMMAND_VERSION) return null;
    var commandId = String(parts[1] || "");
    var issuedAt = Math.round(Number(parts[2]));
    var scope = darkOneJsp3ResetCommandScope(parts[3]);
    now = Math.round(Number(now));
    if (!isFinite(now)) now = new Date().getTime();
    if (!commandId || !isFinite(issuedAt) || issuedAt <= 0 || !scope) return null;
    var age = now - issuedAt;
    if (age < -5000 || age > DARKONEJSP3_RESET_COMMAND_MAX_AGE) return null;
    return { id: commandId, issuedAt: issuedAt, scope: scope };
}


function darkOneJsp3AddOptionalButtonDefaults(role, count) {
    var entry = DARKONEJSP3_RESET_REGISTRY[role];
    if (!entry) return;
    if (!entry.complete) entry.complete = {};
    for (var i = 1; i <= count; i++) {
        var number = i < 10 ? "0" + i : String(i);
        var name = "Button " + number;
        entry.complete[name] = false;
        entry.complete[name + " name (up to 10 letters)"] = name.toUpperCase();
        entry.complete[name + " command string"] = "";
        entry.complete[name + " command style"] = 0;
    }
}

darkOneJsp3AddOptionalButtonDefaults("control-left", 8);
darkOneJsp3AddOptionalButtonDefaults("control-right", 10);

function darkOneJsp3RoleDefaults(role, scope) {
    var entry = DARKONEJSP3_RESET_REGISTRY[role];
    var result = {};
    if (!entry) return result;
    function add(values) {
        for (var key in values) if (Object.prototype.hasOwnProperty.call(values, key)) result[key] = values[key];
    }
    if (scope === "appearance") add(entry.appearance || {});
    else if (scope === "behaviour") add(entry.behaviour || {});
    else {
        add(entry.appearance || {});
        add(entry.behaviour || {});
        add(entry.complete || {});
    }
    return result;
}

function darkOneJsp3ApplyRoleReset(role, scope) {
    var values = darkOneJsp3RoleDefaults(role, scope || "all");
    var changed = false;
    for (var name in values) {
        if (!Object.prototype.hasOwnProperty.call(values, name)) continue;
        try {
            if (window.GetProperty(name, values[name]) !== values[name]) changed = true;
            window.SetProperty(name, values[name]);
        } catch (e) {}
    }
    return changed;
}
