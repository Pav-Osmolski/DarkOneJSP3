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
        state: 'DarkOneJSP3.BottomArea.State',
        commit: 'DarkOneJSP3.BottomArea.Commit'
    });

    var bottomAreaDefaults = Object.freeze({
        backgroundMode: dividerModes.darkOne,
        backgroundCustomColour: 0xff000000,
        backgroundLinearGradient: false,
        dividerMode: dividerModes.darkOneDark,
        dividerCustomColour: 0xff000000,
        sideDividersVisible: true,
        depthMode: 0
    });

    var bottomAreaDepths = Object.freeze({ flat: 0, soft: 1 });
    var bottomAreaDepthValues = Object.freeze([
        bottomAreaDepths.flat,
        bottomAreaDepths.soft
    ]);

    function normaliseBottomAreaBoolean(value, fallback) {
        if (value === true || value === 1 || value === '1' || value === 'true') return true;
        if (value === false || value === 0 || value === '0' || value === 'false') return false;
        return Boolean(fallback);
    }

    function normaliseBottomAreaDepth(value, fallback) {
        value = Math.round(Number(value));
        return bottomAreaDepthValues.indexOf(value) >= 0 ? value : fallback;
    }

    function normaliseBottomAreaRevision(value, fallback) {
        value = String(value || '');
        if (/^[A-Za-z0-9._-]{1,128}$/.test(value)) return value;
        return typeof fallback !== 'undefined' ? String(fallback) : 'state';
    }

    function bottomAreaState(backgroundMode, backgroundCustomColour,
            backgroundLinearGradient, dividerMode, dividerCustomColour,
            sideDividersVisible, depthMode, revision) {
        return {
            revision: normaliseBottomAreaRevision(revision, 'state'),
            backgroundMode: DarkOneColour.normaliseMode(
                backgroundMode,
                dividerModeValues,
                bottomAreaDefaults.backgroundMode
            ),
            backgroundCustomColour: DarkOneColour.opaque(backgroundCustomColour),
            backgroundLinearGradient: normaliseBottomAreaBoolean(
                backgroundLinearGradient,
                bottomAreaDefaults.backgroundLinearGradient
            ),
            dividerMode: DarkOneColour.normaliseMode(
                dividerMode,
                dividerModeValues,
                bottomAreaDefaults.dividerMode
            ),
            dividerCustomColour: DarkOneColour.opaque(dividerCustomColour),
            sideDividersVisible: normaliseBottomAreaBoolean(
                sideDividersVisible,
                bottomAreaDefaults.sideDividersVisible
            ),
            depthMode: normaliseBottomAreaDepth(
                depthMode,
                bottomAreaDefaults.depthMode
            )
        };
    }

    function serialiseBottomAreaState(state) {
        state = state || bottomAreaDefaults;
        state = bottomAreaState(
            state.backgroundMode,
            state.backgroundCustomColour,
            state.backgroundLinearGradient,
            state.dividerMode,
            state.dividerCustomColour,
            state.sideDividersVisible,
            state.depthMode,
            state.revision
        );
        return bottomArea.version + '|' +
            String(state.revision) + '|' +
            String(state.backgroundMode) + '|' +
            String(state.backgroundCustomColour >>> 0) + '|' +
            (state.backgroundLinearGradient ? '1' : '0') + '|' +
            String(state.dividerMode) + '|' +
            String(state.dividerCustomColour >>> 0) + '|' +
            (state.sideDividersVisible ? '1' : '0') + '|' +
            String(state.depthMode);
    }

    function parseBottomAreaState(data) {
        if (data && typeof data === 'object') {
            return bottomAreaState(
                data.backgroundMode,
                data.backgroundCustomColour,
                data.backgroundLinearGradient,
                data.dividerMode,
                data.dividerCustomColour,
                data.sideDividersVisible,
                data.depthMode,
                data.revision
            );
        }
        var parts = String(data || '').split('|');
        var legacyV1 = parts.length === 5 && parts[0] === 'v1';
        if (!legacyV1 &&
                (parts.length !== 9 || parts[0] !== bottomArea.version)) return null;
        var revision = legacyV1 ? 'v1-migration' :
            normaliseBottomAreaRevision(parts[1], '');
        if (!revision) return null;
        var offset = legacyV1 ? 0 : 1;
        var backgroundMode = Number(parts[1 + offset]);
        var backgroundCustomColour = Number(parts[2 + offset]);
        var backgroundLinearGradient = legacyV1 ? false : parts[4];
        var dividerMode = Number(parts[legacyV1 ? 3 : 5]);
        var dividerCustomColour = Number(parts[legacyV1 ? 4 : 6]);
        var sideDividersVisible = legacyV1 ? true : parts[7];
        var depthMode = legacyV1 ? bottomAreaDepths.flat : parts[8];
        if (!isFinite(backgroundMode) || !isFinite(backgroundCustomColour) ||
                !isFinite(dividerMode) || !isFinite(dividerCustomColour)) return null;
        return bottomAreaState(
            backgroundMode,
            backgroundCustomColour,
            backgroundLinearGradient,
            dividerMode,
            dividerCustomColour,
            sideDividersVisible,
            depthMode,
            revision
        );
    }



    var bottomAreaCommitVersion = 'v5';
    var bottomAreaCommitMaxAgeMs = 5000;
    var bottomAreaCommitMaxLeadMs = 1000;

    function bottomAreaCommit(id, issuedAt, applyAt, state) {
        id = String(id || '');
        issuedAt = Math.round(Number(issuedAt));
        applyAt = Math.round(Number(applyAt));
        state = parseBottomAreaState(state);
        if (!/^[A-Za-z0-9._-]{1,128}$/.test(id) ||
                !isFinite(issuedAt) || !isFinite(applyAt) || !state ||
                applyAt < issuedAt ||
                applyAt - issuedAt > bottomAreaCommitMaxLeadMs) return null;
        state = bottomAreaState(
            state.backgroundMode,
            state.backgroundCustomColour,
            state.backgroundLinearGradient,
            state.dividerMode,
            state.dividerCustomColour,
            state.sideDividersVisible,
            state.depthMode,
            id
        );
        return {
            id: id,
            issuedAt: issuedAt,
            applyAt: applyAt,
            state: state
        };
    }

    function serialiseBottomAreaCommit(commit) {
        commit = commit && bottomAreaCommit(
            commit.id,
            commit.issuedAt,
            commit.applyAt,
            commit.state
        );
        if (!commit) return '';
        var state = commit.state;
        return bottomAreaCommitVersion + '|' +
            commit.id + '|' +
            String(commit.issuedAt) + '|' +
            String(commit.applyAt) + '|' +
            String(state.backgroundMode) + '|' +
            String(state.backgroundCustomColour >>> 0) + '|' +
            (state.backgroundLinearGradient ? '1' : '0') + '|' +
            String(state.dividerMode) + '|' +
            String(state.dividerCustomColour >>> 0) + '|' +
            (state.sideDividersVisible ? '1' : '0') + '|' +
            String(state.depthMode);
    }

    function parseBottomAreaCommit(data, now) {
        if (data && typeof data === 'object') {
            var objectCommit = bottomAreaCommit(
                data.id,
                data.issuedAt,
                data.applyAt,
                data.state || data
            );
            if (!objectCommit) return null;
            now = Math.round(Number(now));
            if (isFinite(now) &&
                    (objectCommit.issuedAt > now + bottomAreaCommitMaxAgeMs ||
                     now - objectCommit.issuedAt > bottomAreaCommitMaxAgeMs)) return null;
            return objectCommit;
        }
        var parts = String(data || '').split('|');
        if (parts.length !== 11 || parts[0] !== bottomAreaCommitVersion) return null;
        var commit = bottomAreaCommit(
            parts[1],
            Number(parts[2]),
            Number(parts[3]),
            bottomAreaState(
                Number(parts[4]),
                Number(parts[5]),
                parts[6],
                Number(parts[7]),
                Number(parts[8]),
                parts[9],
                parts[10]
            )
        );
        if (!commit) return null;
        now = Math.round(Number(now));
        if (isFinite(now) &&
                (commit.issuedAt > now + bottomAreaCommitMaxAgeMs ||
                 now - commit.issuedAt > bottomAreaCommitMaxAgeMs)) return null;
        return commit;
    }

    function bottomAreaMenuOptions(baseId, transparentLabel) {
        var options = dividerMenuOptions(baseId);
        options[0].label = String(transparentLabel || 'Transparent / inherit parent');
        return options;
    }

    var bottomArea = Object.freeze({
        version: 'v5',
        notifications: bottomAreaNotifications,
        modes: dividerModes,
        modeValues: dividerModeValues,
        defaults: bottomAreaDefaults,
        depths: bottomAreaDepths,
        state: bottomAreaState,
        serialiseState: serialiseBottomAreaState,
        parseState: parseBottomAreaState,
        commitVersion: bottomAreaCommitVersion,
        commitMaxAgeMs: bottomAreaCommitMaxAgeMs,
        commitMaxLeadMs: bottomAreaCommitMaxLeadMs,
        commit: bottomAreaCommit,
        serialiseCommit: serialiseBottomAreaCommit,
        parseCommit: parseBottomAreaCommit,
        menuOptions: bottomAreaMenuOptions
    });

    return Object.freeze({
        startup: startup,
        divider: divider,
        bottomArea: bottomArea
    });
})();
