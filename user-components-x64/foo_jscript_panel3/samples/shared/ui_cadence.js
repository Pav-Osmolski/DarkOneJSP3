/*
 * Enhanced JScript Panel sample UI cadence protocol
 * Version: 0.1.1
 *
 * Coordinates refresh-rate announcements from JS Playlist and Smooth Playlist
 * Manager with the volume-knob preview and Centre Display repaint cadence.
 * Actual fb.Volume writes retain a separate safe minimum cadence.
 */

var DARKONE_UI_CADENCE_VERSION = "0.1.1";

var DarkOneUiCadence = typeof DarkOneUiCadence != "undefined"
    ? DarkOneUiCadence
    : (function () {
    "use strict";

    var PROTOCOL_VERSION = 1;
    var SOURCE_STATE_NOTIFICATION = "DarkOneJSP3.UIRefresh.Source.State";
    var SOURCE_QUERY_NOTIFICATION = "DarkOneJSP3.UIRefresh.Source.Query";
    var VOLUME_STATE_NOTIFICATION = "DarkOneJSP3.VolumeRefresh.State";
    var VOLUME_QUERY_NOTIFICATION = "DarkOneJSP3.VolumeRefresh.Query";

    var SOURCE_JS_PLAYLIST = "js-playlist";
    var SOURCE_PLAYLIST_MANAGER = "playlist-manager";

    var VOLUME_MODE_AUTO = 0;
    var VOLUME_MANUAL_INTERVALS = [8, 10, 12, 16];
    var VOLUME_MENU_IDS = [20, 21, 22, 23, 24];

    function own(object, name) {
        return Object.prototype.hasOwnProperty.call(object, name);
    }

    function notify(hostWindow, name, payload) {
        try {
            hostWindow.NotifyOthers(name, payload);
            return true;
        } catch (e) {
            return false;
        }
    }

    function normaliseInterval(value, fallback, minimum, maximum) {
        value = Math.round(Number(value));
        fallback = Math.round(Number(fallback));
        minimum = Math.round(Number(minimum));
        maximum = Math.round(Number(maximum));

        if (!isFinite(fallback)) fallback = 16;
        if (!isFinite(minimum)) minimum = 8;
        if (!isFinite(maximum)) maximum = 40;
        if (minimum > maximum) {
            var swap = minimum;
            minimum = maximum;
            maximum = swap;
        }
        if (!isFinite(value)) value = fallback;
        return Math.max(minimum, Math.min(maximum, value));
    }

    function normaliseVolumeMode(value) {
        value = Math.round(Number(value));
        if (value === VOLUME_MODE_AUTO) return VOLUME_MODE_AUTO;
        for (var i = 0; i < VOLUME_MANUAL_INTERVALS.length; i++) {
            if (value === VOLUME_MANUAL_INTERVALS[i]) return value;
        }
        return VOLUME_MODE_AUTO;
    }

    function volumeMenuIdForMode(mode) {
        mode = normaliseVolumeMode(mode);
        if (mode === VOLUME_MODE_AUTO) return VOLUME_MENU_IDS[0];
        for (var i = 0; i < VOLUME_MANUAL_INTERVALS.length; i++) {
            if (mode === VOLUME_MANUAL_INTERVALS[i]) return VOLUME_MENU_IDS[i + 1];
        }
        return VOLUME_MENU_IDS[0];
    }

    function volumeModeForMenuId(id) {
        id = Math.round(Number(id));
        if (id === VOLUME_MENU_IDS[0]) return VOLUME_MODE_AUTO;
        for (var i = 0; i < VOLUME_MANUAL_INTERVALS.length; i++) {
            if (id === VOLUME_MENU_IDS[i + 1]) return VOLUME_MANUAL_INTERVALS[i];
        }
        return null;
    }

    function appendVolumeMenu(menu, mode, resolvedInterval, flags) {
        flags = flags == null ? 0 : flags;
        mode = normaliseVolumeMode(mode);
        resolvedInterval = normaliseInterval(resolvedInterval, 16, 8, 40);

        menu.AppendMenuItem(flags, VOLUME_MENU_IDS[0], "Automatic (currently " + resolvedInterval + " ms)");
        for (var i = 0; i < VOLUME_MANUAL_INTERVALS.length; i++) {
            var interval = VOLUME_MANUAL_INTERVALS[i];
            menu.AppendMenuItem(flags, VOLUME_MENU_IDS[i + 1], interval + " ms");
        }
        menu.CheckMenuRadioItem(
            VOLUME_MENU_IDS[0],
            VOLUME_MENU_IDS[VOLUME_MENU_IDS.length - 1],
            volumeMenuIdForMode(mode)
        );
    }

    function validPayload(info) {
        return info && typeof info === "object" && Number(info.version) === PROTOCOL_VERSION;
    }

    function createSourceReporter(hostWindow, options) {
        options = options || {};
        var source = String(options.source || "");
        var active = false;

        function getInterval() {
            var value = typeof options.getInterval === "function" ? options.getInterval() : options.interval;
            return normaliseInterval(value, 16, 7, 40);
        }

        function announce(available) {
            if (!source) return false;
            return notify(hostWindow, SOURCE_STATE_NOTIFICATION, {
                version: PROTOCOL_VERSION,
                source: source,
                available: available !== false,
                interval: available === false ? 0 : getInterval()
            });
        }

        return {
            start: function () {
                if (active) return;
                active = true;
                announce(true);
            },
            announce: function () {
                if (active) announce(true);
            },
            handleNotification: function (name, info) {
                if (name !== SOURCE_QUERY_NOTIFICATION) return false;
                if (active) announce(true);
                return true;
            },
            dispose: function () {
                if (!active) return;
                announce(false);
                active = false;
            },
            getInterval: getInterval
        };
    }

    function createVolumeOwner(hostWindow, options) {
        options = options || {};
        var propertyName = String(options.propertyName || "DARKONEJSP3.VOLUME.DRAG.REFRESH.MODE");
        var fallback = normaliseInterval(options.fallback, 16, 8, 40);
        var mode = normaliseVolumeMode(hostWindow.GetProperty(propertyName, VOLUME_MODE_AUTO));
        var sourceIntervals = {};
        var resolved = fallback;
        var active = false;

        function resolve() {
            if (mode !== VOLUME_MODE_AUTO) return mode;

            var fastest = null;
            for (var source in sourceIntervals) {
                if (!own(sourceIntervals, source)) continue;
                var interval = normaliseInterval(sourceIntervals[source], fallback, 8, 40);
                if (fastest === null || interval < fastest) fastest = interval;
            }
            return fastest === null ? fallback : fastest;
        }

        function announce() {
            if (!active) return;
            notify(hostWindow, VOLUME_STATE_NOTIFICATION, {
                version: PROTOCOL_VERSION,
                available: true,
                mode: mode,
                interval: resolved
            });
        }

        function update(forceAnnouncement) {
            var next = resolve();
            var changed = next !== resolved;
            var previous = resolved;
            resolved = next;
            if (changed && typeof options.onChange === "function") {
                options.onChange(resolved, previous, mode);
            }
            if (changed || forceAnnouncement) announce();
            return changed;
        }

        return {
            start: function () {
                if (active) return;
                active = true;
                update(true);
                notify(hostWindow, SOURCE_QUERY_NOTIFICATION, { version: PROTOCOL_VERSION });
            },
            handleNotification: function (name, info) {
                if (name === SOURCE_STATE_NOTIFICATION) {
                    if (!validPayload(info) || !info.source) return true;
                    var source = String(info.source);
                    if (info.available === false) {
                        if (own(sourceIntervals, source)) delete sourceIntervals[source];
                    } else {
                        sourceIntervals[source] = normaliseInterval(info.interval, fallback, 8, 40);
                    }
                    update(false);
                    return true;
                }

                if (name === VOLUME_QUERY_NOTIFICATION) {
                    announce();
                    return true;
                }
                return false;
            },
            setMode: function (value) {
                var next = normaliseVolumeMode(value);
                if (next === mode) return false;
                mode = next;
                hostWindow.SetProperty(propertyName, mode);
                update(true);
                return true;
            },
            getMode: function () {
                return mode;
            },
            getInterval: function () {
                return resolved;
            },
            dispose: function () {
                if (!active) return;
                notify(hostWindow, VOLUME_STATE_NOTIFICATION, {
                    version: PROTOCOL_VERSION,
                    available: false,
                    mode: mode,
                    interval: fallback
                });
                active = false;
            }
        };
    }

    function createVolumeFollower(hostWindow, options) {
        options = options || {};
        var fallback = normaliseInterval(options.fallback, 16, 8, 40);
        var interval = fallback;
        var mode = VOLUME_MODE_AUTO;
        var active = false;

        function update(nextInterval, nextMode) {
            nextInterval = normaliseInterval(nextInterval, fallback, 8, 40);
            nextMode = normaliseVolumeMode(nextMode);
            var changed = nextInterval !== interval || nextMode !== mode;
            var previous = interval;
            interval = nextInterval;
            mode = nextMode;
            if (changed && typeof options.onChange === "function") {
                options.onChange(interval, previous, mode);
            }
            return changed;
        }

        return {
            start: function () {
                if (active) return;
                active = true;
                notify(hostWindow, VOLUME_QUERY_NOTIFICATION, { version: PROTOCOL_VERSION });
            },
            handleNotification: function (name, info) {
                if (name !== VOLUME_STATE_NOTIFICATION) return false;
                if (!validPayload(info)) return true;
                if (info.available === false) update(fallback, VOLUME_MODE_AUTO);
                else update(info.interval, info.mode);
                return true;
            },
            getInterval: function () {
                return interval;
            },
            getMode: function () {
                return mode;
            },
            dispose: function () {
                active = false;
            }
        };
    }

    return {
        protocolVersion: PROTOCOL_VERSION,
        notifications: {
            sourceState: SOURCE_STATE_NOTIFICATION,
            sourceQuery: SOURCE_QUERY_NOTIFICATION,
            volumeState: VOLUME_STATE_NOTIFICATION,
            volumeQuery: VOLUME_QUERY_NOTIFICATION
        },
        sources: {
            jsPlaylist: SOURCE_JS_PLAYLIST,
            playlistManager: SOURCE_PLAYLIST_MANAGER
        },
        volumeModeAuto: VOLUME_MODE_AUTO,
        volumeManualIntervals: VOLUME_MANUAL_INTERVALS.slice(0),
        normaliseInterval: normaliseInterval,
        normaliseVolumeMode: normaliseVolumeMode,
        appendVolumeMenu: appendVolumeMenu,
        volumeModeForMenuId: volumeModeForMenuId,
        createSourceReporter: createSourceReporter,
        createVolumeOwner: createVolumeOwner,
        createVolumeFollower: createVolumeFollower
    };
})();
