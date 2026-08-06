"use strict";

// Shared serialisation and notification helpers for communication between the
// DarkOneJSP3 JSplitter controllers. Each JSplitter executes in its own script
// context, so protocol data is deliberately exchanged as versioned strings.

var DarkOneProtocol = (function () {
    function clampInteger(value, minimum, maximum, fallback) {
        value = Math.round(Number(value));
        if (!isFinite(value)) value = fallback;
        return Math.max(minimum, Math.min(maximum, value));
    }

    var startupNotifications = Object.freeze({
        queryControls: 'DarkOneJSP3.Startup.Controls.Query',
        commandControls: 'DarkOneJSP3.Startup.Controls.Command',
        stateControls: 'DarkOneJSP3.Startup.Controls.State',
        ready: 'DarkOneJSP3.Startup.Ready',
        queryReady: 'DarkOneJSP3.Startup.QueryReady'
    });

    var startupTransitions = Object.freeze({
        off: 0,
        blackReveal: 1,
        stagedReveal: 2
    });

    var startupDefaults = Object.freeze({
        transition: startupTransitions.off,
        minimumDelay: 250,
        readinessTimeout: 2000
    });

    var startupControllers = Object.freeze([
        'MainColumns',
        'InfoStack',
        'ArtSpectrum',
        'BottomControls',
        'DisplayWaveform'
    ]);

    function normaliseStartupValue(key, value) {
        if (key === 'transition') {
            return clampInteger(
                value,
                startupTransitions.off,
                startupTransitions.stagedReveal,
                startupDefaults.transition
            );
        }
        if (key === 'minimum-delay') {
            return clampInteger(value, 0, 5000, startupDefaults.minimumDelay);
        }
        if (key === 'readiness-timeout') {
            return clampInteger(value, 500, 10000, startupDefaults.readinessTimeout);
        }
        return null;
    }

    function startupState(transition, minimumDelay, readinessTimeout) {
        return {
            transition: normaliseStartupValue('transition', transition),
            minimumDelay: normaliseStartupValue('minimum-delay', minimumDelay),
            readinessTimeout: normaliseStartupValue(
                'readiness-timeout',
                readinessTimeout
            )
        };
    }

    function serialiseStartupState(state) {
        state = startupState(
            state && state.transition,
            state && state.minimumDelay,
            state && state.readinessTimeout
        );
        return startup.version + '|state|' +
            String(state.transition) + '|' +
            String(state.minimumDelay) + '|' +
            String(state.readinessTimeout);
    }

    function parseStartupState(data) {
        var parts = String(data || '').split('|');
        if (parts.length !== 5 || parts[0] !== startup.version ||
                parts[1] !== 'state') return null;

        var transition = Number(parts[2]);
        var minimumDelay = Number(parts[3]);
        var readinessTimeout = Number(parts[4]);
        if (!isFinite(transition) || !isFinite(minimumDelay) ||
                !isFinite(readinessTimeout)) return null;

        return startupState(transition, minimumDelay, readinessTimeout);
    }

    function serialiseStartupCommand(action, key, value) {
        action = String(action || '');
        if (action === 'preview' || action === 'restore') {
            return startup.version + '|' + action;
        }
        if (action !== 'set') return null;

        value = Number(value);
        if (!isFinite(value)) return null;

        var normalised = normaliseStartupValue(String(key || ''), value);
        if (normalised === null) return null;
        return startup.version + '|set|' + String(key) + '|' + String(normalised);
    }

    function parseStartupCommand(data) {
        var parts = String(data || '').split('|');
        if (parts[0] !== startup.version) return null;

        var action = String(parts[1] || '');
        if (action === 'preview' || action === 'restore') {
            return parts.length === 2 ? { action: action } : null;
        }
        if (action !== 'set' || parts.length !== 4) return null;

        var key = String(parts[2] || '');
        var rawValue = Number(parts[3]);
        if (!isFinite(rawValue)) return null;

        var value = normaliseStartupValue(key, rawValue);
        if (value === null) return null;
        return { action: action, key: key, value: value };
    }

    function createReadinessBridge(host, controllerName) {
        var ready = false;
        controllerName = String(controllerName || '');

        function signal() {
            ready = true;
            host.NotifyOthers(startupNotifications.ready, controllerName);
        }

        return Object.freeze({
            signal: signal,
            isReady: function () {
                return ready;
            },
            handle: function (name) {
                if (name !== startupNotifications.queryReady || !ready) {
                    return false;
                }
                signal();
                return true;
            }
        });
    }

    var startup = Object.freeze({
        version: 'v1',
        notifications: startupNotifications,
        transitions: startupTransitions,
        defaults: startupDefaults,
        controllers: startupControllers,
        normaliseValue: normaliseStartupValue,
        state: startupState,
        serialiseState: serialiseStartupState,
        parseState: parseStartupState,
        serialiseCommand: serialiseStartupCommand,
        parseCommand: parseStartupCommand,
        isVersion: function (data) {
            return String(data || '') === startup.version;
        },
        createReadinessBridge: createReadinessBridge
    });

    var dividerNotifications = Object.freeze({
        query: 'DarkOneJSP3.ArtSpectrum.Divider.Query',
        set: 'DarkOneJSP3.ArtSpectrum.Divider.Set',
        state: 'DarkOneJSP3.ArtSpectrum.Divider.State'
    });

    var dividerModes = Object.freeze({
        transparent: 0,
        black: 1,
        darkOne: 2,
        custom: 3,
        darkOneDark: 4,
        columnsUi: 5
    });

    var dividerModeValues = Object.freeze([
        dividerModes.transparent,
        dividerModes.black,
        dividerModes.darkOne,
        dividerModes.custom,
        dividerModes.darkOneDark,
        dividerModes.columnsUi
    ]);

    function normaliseDividerMode(value) {
        return DarkOneColour.normaliseMode(
            value,
            dividerModeValues,
            dividerModes.black
        );
    }

    function dividerState(mode, customColour) {
        return {
            mode: normaliseDividerMode(mode),
            customColour: DarkOneColour.opaque(customColour)
        };
    }

    function serialiseDividerState(state, customColour) {
        if (typeof state !== 'object' || state === null) {
            state = dividerState(state, customColour);
        } else {
            state = dividerState(state.mode, state.customColour);
        }
        return divider.version + '|' + String(state.mode) + '|' +
            String(state.customColour >>> 0);
    }

    function parseDividerState(data) {
        if (data && typeof data === 'object') {
            return dividerState(data.mode, data.customColour);
        }

        var parts = String(data || '').split('|');
        if (parts.length !== 3 || parts[0] !== divider.version) return null;

        var mode = Number(parts[1]);
        var customColour = Number(parts[2]);
        if (!isFinite(mode) || !isFinite(customColour)) return null;
        return dividerState(mode, customColour);
    }

    function dividerMenuOptions(baseId) {
        baseId = Math.round(Number(baseId));
        if (!isFinite(baseId)) baseId = 0;
        return [
            { id: baseId, mode: dividerModes.transparent,
                label: 'Transparent / inherit parent' },
            { id: baseId + 1, mode: dividerModes.black, label: 'Black' },
            { id: baseId + 2, mode: dividerModes.darkOne,
                label: 'DarkOne grey' },
            { id: baseId + 3, mode: dividerModes.darkOneDark,
                label: 'DarkOne dark grey' },
            { id: baseId + 4, mode: dividerModes.columnsUi,
                label: 'Columns UI global background' },
            { id: baseId + 5, mode: dividerModes.custom, custom: true }
        ];
    }

    var divider = Object.freeze({
        version: 'v1',
        notifications: dividerNotifications,
        modes: dividerModes,
        modeValues: dividerModeValues,
        normaliseMode: normaliseDividerMode,
        state: dividerState,
        serialiseState: serialiseDividerState,
        parseState: parseDividerState,
        menuOptions: dividerMenuOptions
    });

    var bottomAreaNotifications = Object.freeze({
        query: 'DarkOneJSP3.BottomArea.Query',
        set: 'DarkOneJSP3.BottomArea.Set',
        state: 'DarkOneJSP3.BottomArea.State'
    });

    var bottomAreaDefaults = Object.freeze({
        backgroundMode: dividerModes.darkOne,
        backgroundCustomColour: 0xff000000,
        dividerMode: dividerModes.darkOneDark,
        dividerCustomColour: 0xff000000
    });

    function bottomAreaState(backgroundMode, backgroundCustomColour,
            dividerMode, dividerCustomColour) {
        return {
            backgroundMode: DarkOneColour.normaliseMode(
                backgroundMode,
                dividerModeValues,
                bottomAreaDefaults.backgroundMode
            ),
            backgroundCustomColour: DarkOneColour.opaque(backgroundCustomColour),
            dividerMode: DarkOneColour.normaliseMode(
                dividerMode,
                dividerModeValues,
                bottomAreaDefaults.dividerMode
            ),
            dividerCustomColour: DarkOneColour.opaque(dividerCustomColour)
        };
    }

    function serialiseBottomAreaState(state) {
        state = state || bottomAreaDefaults;
        state = bottomAreaState(
            state.backgroundMode,
            state.backgroundCustomColour,
            state.dividerMode,
            state.dividerCustomColour
        );
        return bottomArea.version + '|' +
            String(state.backgroundMode) + '|' +
            String(state.backgroundCustomColour >>> 0) + '|' +
            String(state.dividerMode) + '|' +
            String(state.dividerCustomColour >>> 0);
    }

    function parseBottomAreaState(data) {
        if (data && typeof data === 'object') {
            return bottomAreaState(
                data.backgroundMode,
                data.backgroundCustomColour,
                data.dividerMode,
                data.dividerCustomColour
            );
        }
        var parts = String(data || '').split('|');
        if (parts.length !== 5 || parts[0] !== bottomArea.version) return null;
        var backgroundMode = Number(parts[1]);
        var backgroundCustomColour = Number(parts[2]);
        var dividerMode = Number(parts[3]);
        var dividerCustomColour = Number(parts[4]);
        if (!isFinite(backgroundMode) || !isFinite(backgroundCustomColour) ||
                !isFinite(dividerMode) || !isFinite(dividerCustomColour)) return null;
        return bottomAreaState(
            backgroundMode,
            backgroundCustomColour,
            dividerMode,
            dividerCustomColour
        );
    }

    function bottomAreaMenuOptions(baseId, transparentLabel) {
        var options = dividerMenuOptions(baseId);
        options[0].label = String(transparentLabel || 'Transparent / inherit parent');
        return options;
    }

    var bottomArea = Object.freeze({
        version: 'v1',
        notifications: bottomAreaNotifications,
        modes: dividerModes,
        modeValues: dividerModeValues,
        defaults: bottomAreaDefaults,
        state: bottomAreaState,
        serialiseState: serialiseBottomAreaState,
        parseState: parseBottomAreaState,
        menuOptions: bottomAreaMenuOptions
    });

    return Object.freeze({
        startup: startup,
        divider: divider,
        bottomArea: bottomArea
    });
})();
