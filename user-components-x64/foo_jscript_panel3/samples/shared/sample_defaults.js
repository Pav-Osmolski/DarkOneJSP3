"use strict";

// Canonical defaults owned by the enhanced JScript Panel sample suite.
// Property names intentionally remain unchanged so existing DarkOneJSP3 and
// third-party theme configurations retain their saved settings.
var JSP3_ENHANCED_RESET_REGISTRY = {
    "lastfm-bio": {
        appearance: {
            "DARKONEJSP3.PAGE.BACKGROUND.MODE": 3,
            "DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR": 0xff181818,
            "DARKONEJSP3.PAGE.COLOURS.DYNAMIC.ENABLED": false,
            "DARKONEJSP3.PAGE.TEXT.MODE": 0,
            "DARKONEJSP3.PAGE.TEXT.CUSTOM.COLOUR": 0xffdcdcdc,
            "DARKONEJSP3.PAGE.WALLPAPER.MODE": 0,
            "DARKONEJSP3.PAGE.WALLPAPER.PATH": "",
            "DARKONEJSP3.PAGE.WALLPAPER.BLURRED": false,
            "2K3.LASTFM.BIO.IMAGES.DISPLAY": true,
            "2K3.LASTFM.BIO.IMAGES.BACKGROUND.ENABLED": true,
            "2K3.LASTFM.BIO.IMAGES.BACKGROUND.BLURRED": true,
            "2K3.LASTFM.BIO.IMAGES.BACKGROUND.DARKNESS": 1,
            "2K3.LASTFM.BIO.IMAGES.BORDER.STYLE": 1,
            "2K3.LASTFM.BIO.IMAGES.BORDER.COLOUR.MODE": 0,
            "2K3.LASTFM.BIO.IMAGES.BORDER.COLOUR.CUSTOM": 0xff969696,
            "2K3.LASTFM.BIO.IMAGES.HIDE.IF.NO.IMAGES": false,
            "2K3.IMAGES.LAYOUT": 0,
            "2K3.IMAGES.RATIO": 0.5
        },
        behaviour: {
            "2K3.IMAGES.AUTO.DOWNLOAD": true
        }
    },
    "lastfm-info": {
        appearance: {
            "DARKONEJSP3.PAGE.BACKGROUND.MODE": 3,
            "DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR": 0xff181818,
            "DARKONEJSP3.PAGE.COLOURS.DYNAMIC.ENABLED": false,
            "DARKONEJSP3.PAGE.TEXT.MODE": 0,
            "DARKONEJSP3.PAGE.TEXT.CUSTOM.COLOUR": 0xffdcdcdc,
            "DARKONEJSP3.PAGE.WALLPAPER.MODE": 0,
            "DARKONEJSP3.PAGE.WALLPAPER.PATH": "",
            "DARKONEJSP3.PAGE.WALLPAPER.BLURRED": false
        },
        behaviour: {}
    },
    "properties": {
        appearance: {
            "DARKONEJSP3.PAGE.BACKGROUND.MODE": 3,
            "DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR": 0xff181818,
            "DARKONEJSP3.PAGE.COLOURS.DYNAMIC.ENABLED": false,
            "DARKONEJSP3.PAGE.TEXT.MODE": 0,
            "DARKONEJSP3.PAGE.TEXT.CUSTOM.COLOUR": 0xffdcdcdc,
            "DARKONEJSP3.PAGE.WALLPAPER.MODE": 0,
            "DARKONEJSP3.PAGE.WALLPAPER.PATH": "",
            "DARKONEJSP3.PAGE.WALLPAPER.BLURRED": false
        },
        behaviour: {}
    },
    "queue-viewer": {
        appearance: {
            "DARKONEJSP3.PAGE.BACKGROUND.MODE": 3,
            "DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR": 0xff181818,
            "DARKONEJSP3.PAGE.COLOURS.DYNAMIC.ENABLED": false,
            "DARKONEJSP3.PAGE.TEXT.MODE": 0,
            "DARKONEJSP3.PAGE.TEXT.CUSTOM.COLOUR": 0xffdcdcdc,
            "DARKONEJSP3.PAGE.SELECTED.BACKGROUND.MODE": 0,
            "DARKONEJSP3.PAGE.SELECTED.BACKGROUND.CUSTOM.COLOUR": 0xff303030,
            "DARKONEJSP3.PAGE.WALLPAPER.MODE": 0,
            "DARKONEJSP3.PAGE.WALLPAPER.PATH": "",
            "DARKONEJSP3.PAGE.WALLPAPER.BLURRED": false
        },
        behaviour: { "DARKONEJSP3.QUEUE.TF": "%artist% - %title%" }
    },
    "js-playlist": {
        appearance: {},
        behaviour: {
            "JSPLAYLIST.Enable Smooth Scrolling": true,
            "JSPLAYLIST.UI Refresh Interval (ms)": 8,
            "JSPLAYLIST.Smooth Scroll Divisor": 2,
            "JSPLAYLIST.Playlist Wheel Throttle (ms)": 8,
            "JSPLAYLIST.Playlist Scroll Step": 3,
            "JSPLAYLIST.Snap Wheel Scrolling To Rows": true,
            "JSPLAYLIST.Snap Scrollbar Dragging To Rows": true,
            "JSPLAYLIST.Free Wheel Step (pixels)": 0,
            "JSPLAYLIST.Enable Render Cache": true,
            "JSPLAYLIST.Render Cache Rows": 768,
            "JSPLAYLIST.Enable Performance Profiling": false
        },
        complete: {}
    },
    "album-art": {
        appearance: {
            "2K3.PANEL.COLOURS.MODE": 0,
            "2K3.PANEL.COLOURS.CUSTOM.BACKGROUND": 0xff000000,
            "2K3.ARTREADER.ASPECT": 0,
            "2K3.ARTREADER.SQUARE.SIZING": 0
        },
        behaviour: {}
    },
    "playlist-manager": {
        appearance: {
            "SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER": true,
            "SMOOTH.PLAYLIST.MANAGER.FILTER.WIDTH": 300,
            "SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT": 26,
            "SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS": true
        },
        behaviour: {
            "SMOOTH.UI.REFRESH.INTERVAL.MS": 8,
            "SMOOTH.SCROLL.SMOOTHNESS": 1.75,
            "SMOOTH.ROW.SCROLL.STEP": 3,
            "SMOOTH.PLAYLIST.MANAGER.REMEMBER.SCROLL": true,
            "SMOOTH.PLAYLIST.MANAGER.AUTO.SHOW.ACTIVE": true,
            "SMOOTH.Enable Performance Profiling": false
        },
        complete: {
            "SMOOTH.PLAYLIST.MANAGER.SCROLL": 0,
            "SMOOTH.PLAYLIST.MANAGER.SCROLL.STATE.V2": ""
        }
    },
    "musicbrainz": {
        appearance: {},
        behaviour: {
            "DARKONEJSP3.MUSICBRAINZ.MODE": 0,
            "DARKONEJSP3.MUSICBRAINZ.ARTIST.SOURCE": 0,
            "DARKONEJSP3.MUSICBRAINZ.AUTO.RESOLVE": true,
            "DARKONEJSP3.MUSICBRAINZ.CACHE.DAYS": 7,
            "DARKONEJSP3.MUSICBRAINZ.CONTACT": "",
            "DARKONEJSP3.MUSICBRAINZ.LINKS.FULL.URLS": false,
            "DARKONEJSP3.MUSICBRAINZ.RELEASE.LIMIT": 500,
            "DARKONEJSP3.MUSICBRAINZ.RELEASE.SORT": 0,
            "DARKONEJSP3.MUSICBRAINZ.REMEMBER.SCROLL": true,
            "DARKONEJSP3.MUSICBRAINZ.SCROLL.STATE": "{}"
        }
    },
    "album-notes": {
        appearance: {
            "DARKONEJSP3.PAGE.BACKGROUND.MODE": 3,
            "DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR": 0xff181818,
            "DARKONEJSP3.PAGE.COLOURS.DYNAMIC.ENABLED": false,
            "DARKONEJSP3.PAGE.TEXT.MODE": 0,
            "DARKONEJSP3.PAGE.TEXT.CUSTOM.COLOUR": 0xffdcdcdc,
            "DARKONEJSP3.PAGE.WALLPAPER.MODE": 0,
            "DARKONEJSP3.PAGE.WALLPAPER.PATH": "",
            "DARKONEJSP3.PAGE.WALLPAPER.BLURRED": false,
            "2K3.ALBUM.NOTES.ART.DISPLAY": true,
            "2K3.ALBUM.NOTES.ART.BACKGROUND.ENABLED": true,
            "2K3.ALBUM.NOTES.ART.BACKGROUND.BLURRED": true,
            "2K3.ALBUM.NOTES.ART.BACKGROUND.DARKNESS": 1,
            "2K3.ALBUM.NOTES.ART.BORDER.STYLE": 1,
            "2K3.ALBUM.NOTES.ART.BORDER.COLOUR.MODE": 0,
            "2K3.ALBUM.NOTES.ART.BORDER.COLOUR.CUSTOM": 0xff969696,
            "2K3.ARTREADER.LAYOUT": 0,
            "2K3.ARTREADER.RATIO": 0.5
        },
        behaviour: {
            "DARKONEJSP3.ALBUM.NOTES.APPLE.STOREFRONT": "gb",
            "DARKONEJSP3.ALBUM.NOTES.APPLE.TOKEN": "",
            "DARKONEJSP3.ALBUM.NOTES.BROWSE.SOURCE": "allmusic",
            "DARKONEJSP3.ALBUM.NOTES.CACHE.APPLEMUSIC.DAYS": 30,
            "DARKONEJSP3.ALBUM.NOTES.CACHE.THEAUDIODB.DAYS": 30,
            "DARKONEJSP3.ALBUM.NOTES.CACHE.WIKIPEDIA.DAYS": 30,
            "DARKONEJSP3.ALBUM.NOTES.MODE": 0,
            "DARKONEJSP3.ALBUM.NOTES.MUSICBRAINZ.LINKS": true,
            "DARKONEJSP3.ALBUM.NOTES.MUSICBRAINZ.RELEASES": true,
            "DARKONEJSP3.ALBUM.NOTES.NEGATIVE.CACHE.HOURS": 24,
            "DARKONEJSP3.ALBUM.NOTES.SOURCE.ALLMUSIC": true,
            "DARKONEJSP3.ALBUM.NOTES.SOURCE.APPLEMUSIC": false,
            "DARKONEJSP3.ALBUM.NOTES.SOURCE.MUSICBRAINZ": true,
            "DARKONEJSP3.ALBUM.NOTES.SOURCE.PRIORITY": "allmusic,theaudiodb,wikipedia,applemusic",
            "DARKONEJSP3.ALBUM.NOTES.SOURCE.THEAUDIODB": false,
            "DARKONEJSP3.ALBUM.NOTES.SOURCE.WIKIPEDIA": false,
            "DARKONEJSP3.ALBUM.NOTES.THEAUDIODB.KEY": "2",
            "DARKONEJSP3.ALBUM.NOTES.VIEW": 0
        }
    }
};

// Standalone descriptive-theme adapter. This deliberately lives in the
// component tree: enhanced samples must never require a DarkOneJSP3 profile
// folder when they are used by another theme.
var DARKONEJSP3_THEME_NOTIFICATION = "DarkOneJSP3.Theme.Apply";
var DARKONEJSP3_THEME_CAPTURE_QUERY_NOTIFICATION = "DarkOneJSP3.Theme.Capture.Query";
var DARKONEJSP3_THEME_CAPTURE_RESPONSE_NOTIFICATION = "DarkOneJSP3.Theme.Capture.Response";
var jsp3EnhancedThemeCaptureTarget = null;

function jsp3EnhancedThemeObject(info) {
    var theme = info;
    try { if (typeof theme === "string") theme = JSON.parse(theme); } catch (e) { return null; }
    if (!theme || typeof theme !== "object" || Array.isArray(theme) ||
            theme.format !== "DarkOneJSP3 Theme" || Number(theme.formatVersion) !== 1 ||
            !theme.appearance || typeof theme.appearance !== "object") return null;
    return theme;
}

function jsp3EnhancedThemePath(theme, dotted) {
    var value = theme;
    var parts = dotted.split(".");
    for (var i = 0; i < parts.length; i++) {
        if (!value || !Object.prototype.hasOwnProperty.call(value, parts[i])) return undefined;
        value = value[parts[i]];
    }
    return value;
}

function jsp3EnhancedThemeColour(value) {
    if (typeof value === "number" && isFinite(value)) return value >>> 0;
    var match = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(value == null ? "" : value).replace(/^\s+|\s+$/g, ""));
    if (!match) return undefined;
    return parseInt(match[1].length === 6 ? "ff" + match[1] : match[1], 16) >>> 0;
}

function jsp3EnhancedThemeColourText(value) {
    var resolved = jsp3EnhancedThemeColour(value);
    if (resolved === undefined) return "#FF000000";
    return "#" + ("00000000" + (resolved >>> 0).toString(16).toUpperCase()).slice(-8);
}

function jsp3EnhancedThemeNormalise(value, kind, minimum, maximum) {
    if (kind === "colour") return jsp3EnhancedThemeColour(value);
    if (kind === "boolean") return typeof value === "boolean" ? value : undefined;
    if (kind === "colourType") {
        var colourTypes = ["Custom", "Dynamic", "Off"];
        if (typeof value === "number" && isFinite(value)) {
            value = Math.round(value);
            return value >= 0 && value < colourTypes.length ? colourTypes[value] : undefined;
        }
        value = String(value == null ? "" : value).replace(/^\s+|\s+$/g, "").toLowerCase();
        for (var colourTypeIndex = 0; colourTypeIndex < colourTypes.length; colourTypeIndex++) {
            if (colourTypes[colourTypeIndex].toLowerCase() === value) return colourTypes[colourTypeIndex];
        }
        return undefined;
    }
    if (kind === "number") {
        value = Number(value);
        return isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : undefined;
    }
    if (kind === "integer") {
        value = Number(value);
        return isFinite(value) ? Math.round(Math.max(minimum, Math.min(maximum, value))) : undefined;
    }
    if (kind === "string" || kind === "path") {
        return value == null ? undefined : String(value).replace(/[\u0000-\u001f]/g, " ").substring(0, 160);
    }
    return undefined;
}

function jsp3EnhancedThemeProperties(info, role) {
    var theme = jsp3EnhancedThemeObject(info);
    var result = {};
    if (!theme) return null;
    function add(propertyName, themePath, kind, minimum, maximum, fallbackThemePath) {
        var source = jsp3EnhancedThemePath(theme, themePath);
        if (source === undefined && fallbackThemePath) {
            source = jsp3EnhancedThemePath(theme, fallbackThemePath);
        }
        var value = source === undefined ? undefined : jsp3EnhancedThemeNormalise(
            source, kind, minimum, maximum
        );
        if (jsp3EnhancedThemeCaptureTarget) {
            try {
                var missing = "__DARKONEJSP3_THEME_PROPERTY_MISSING__";
                var currentSource = window.GetProperty(
                    propertyName,
                    value === undefined ? missing : value
                );
                var current = jsp3EnhancedThemeNormalise(
                    currentSource === missing ? undefined : currentSource,
                    kind, minimum, maximum
                );
                if (current !== undefined) {
                    jsp3EnhancedThemeCaptureTarget[themePath] = kind === "colour"
                        ? jsp3EnhancedThemeColourText(current) : current;
                }
            } catch (e) {}
        }
        if (value !== undefined) result[propertyName] = value;
    }
    function addColourType(dynamicProperty, customProperty, themePath, legacyCustomPath) {
        var source = jsp3EnhancedThemePath(theme, themePath);
        var value = source === undefined ? undefined : jsp3EnhancedThemeNormalise(source, "colourType");
        if (value === undefined && legacyCustomPath) {
            var legacy = jsp3EnhancedThemeNormalise(
                jsp3EnhancedThemePath(theme, legacyCustomPath), "boolean"
            );
            if (legacy !== undefined) value = legacy ? "Custom" : "Off";
        }
        var dynamicDefault = value === "Dynamic";
        var customDefault = value === "Custom";
        if (jsp3EnhancedThemeCaptureTarget) {
            try {
                var currentDynamic = window.GetProperty(dynamicProperty, dynamicDefault) === true;
                var currentCustom = window.GetProperty(customProperty, customDefault) === true;
                jsp3EnhancedThemeCaptureTarget[themePath] = currentDynamic ? "Dynamic" : currentCustom ? "Custom" : "Off";
            } catch (e) {}
        }
        if (value !== undefined) {
            result[dynamicProperty] = value === "Dynamic";
            result[customProperty] = value === "Custom";
        }
    }
    function page() {
        add("DARKONEJSP3.PAGE.BACKGROUND.MODE", "appearance.pages.backgroundMode", "integer", 0, 5);
        add("DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR", "appearance.pages.customBackground", "colour");
        add("DARKONEJSP3.PAGE.COLOURS.DYNAMIC.ENABLED", "appearance.pages.dynamicColours", "boolean");
        add("DARKONEJSP3.PAGE.TEXT.MODE", "appearance.pages.textMode", "integer", 0, 1);
        add("DARKONEJSP3.PAGE.TEXT.CUSTOM.COLOUR", "appearance.pages.customText", "colour");
        add("DARKONEJSP3.PAGE.WALLPAPER.MODE", "appearance.pages.wallpaperMode", "integer", 0, 2);
        add("DARKONEJSP3.PAGE.WALLPAPER.PATH", "appearance.pages.wallpaperPath", "path");
        add("DARKONEJSP3.PAGE.WALLPAPER.BLURRED", "appearance.pages.wallpaperBlurred", "boolean");
    }
    if (role === "lastfm-bio" || role === "lastfm-info" || role === "properties" ||
            role === "album-notes" || role === "queue-viewer") {
        page();
        if (role === "queue-viewer") {
            add("DARKONEJSP3.PAGE.SELECTED.BACKGROUND.MODE", "appearance.pages.selectedBackgroundMode", "integer", 0, 2);
            add("DARKONEJSP3.PAGE.SELECTED.BACKGROUND.CUSTOM.COLOUR", "appearance.palette.selected", "colour");
        }
        if (role === "lastfm-bio") {
            add("2K3.LASTFM.BIO.IMAGES.DISPLAY", "appearance.pages.artwork.visible", "boolean");
            add("2K3.LASTFM.BIO.IMAGES.BACKGROUND.ENABLED", "appearance.pages.artwork.backgroundEnabled", "boolean");
            add("2K3.LASTFM.BIO.IMAGES.BACKGROUND.BLURRED", "appearance.pages.artwork.backgroundBlurred", "boolean");
            add("2K3.IMAGES.RATIO", "appearance.pages.artwork.ratio", "number", 0.1, 0.9);
        }
        if (role === "album-notes") {
            add("2K3.ALBUM.NOTES.ART.DISPLAY", "appearance.pages.artwork.visible", "boolean");
            add("2K3.ALBUM.NOTES.ART.BACKGROUND.ENABLED", "appearance.pages.artwork.backgroundEnabled", "boolean");
            add("2K3.ALBUM.NOTES.ART.BACKGROUND.BLURRED", "appearance.pages.artwork.backgroundBlurred", "boolean");
            add("2K3.ARTREADER.RATIO", "appearance.pages.artwork.ratio", "number", 0.1, 0.9);
        }
    } else if (role === "album-art") {
        add("2K3.PANEL.COLOURS.MODE", "appearance.albumArt.backgroundMode", "integer", 0, 2);
        add("2K3.PANEL.COLOURS.CUSTOM.BACKGROUND", "appearance.albumArt.customBackground", "colour");
        add("2K3.ARTREADER.ASPECT", "appearance.albumArt.aspect", "integer", 0, 3);
        add("2K3.ARTREADER.SQUARE.SIZING", "appearance.albumArt.squareSizing", "integer", 0, 1);
    } else if (role === "playlist-manager") {
        addColourType("SMOOTH.DYNAMIC.COLOURS.ENABLED", "SMOOTH.CUSTOM.COLOURS.ENABLED",
            "appearance.playlistManager.colourType");
        add("SMOOTH.COLOUR.TEXT", "appearance.playlistManager.text", "colour");
        add("SMOOTH.COLOUR.BACKGROUND.NORMAL", "appearance.playlistManager.background", "colour");
        add("SMOOTH.COLOUR.BACKGROUND.SELECTED", "appearance.playlistManager.selectedBackground", "colour");
        add("SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER", "appearance.playlistManager.showFilter", "boolean");
        add("SMOOTH.PLAYLIST.MANAGER.FILTER.WIDTH", "appearance.playlistManager.filterWidth", "integer", 80, 1000);
        add("SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT", "appearance.playlistManager.rowHeight", "integer", 18, 80);
        add("SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS", "appearance.playlistManager.alternatingRows", "boolean");
    } else if (role === "js-playlist") {
        addColourType("JSPLAYLIST.Enable Dynamic Colours", "JSPLAYLIST.Enable Custom Colours",
            "appearance.playlist.colourType", "appearance.playlist.customColours");
        add("JSPLAYLIST.COLOUR TEXT NORMAL", "appearance.playlist.text", "colour", undefined, undefined, "appearance.palette.text");
        add("JSPLAYLIST.COLOUR TEXT HIGHLIGHT", "appearance.playlist.highlight", "colour", undefined, undefined, "appearance.palette.accent");
        add("JSPLAYLIST.COLOUR BACKGROUND NORMAL", "appearance.playlist.background", "colour", undefined, undefined, "appearance.palette.pageBackground");
        add("JSPLAYLIST.COLOUR BACKGROUND SELECTED", "appearance.playlist.selectedBackground", "colour", undefined, undefined, "appearance.palette.selected");
        add("JSPLAYLIST.COLOUR.MOOD", "appearance.playlist.mood", "colour");
        add("JSPLAYLIST.COLOUR.RATING", "appearance.playlist.rating", "colour");
        add("JSPLAYLIST.Show Wallpaper", "appearance.playlist.showWallpaper", "boolean");
        add("JSPLAYLIST.Wallpaper Blurred", "appearance.pages.wallpaperBlurred", "boolean");
        add("JSPLAYLIST.Default Wallpaper Path", "appearance.pages.wallpaperPath", "path");
    }
    return result;
}

function jsp3EnhancedCaptureTheme(info, role) {
    var theme = jsp3EnhancedThemeObject(info);
    if (!theme) return null;
    var result = {};
    jsp3EnhancedThemeCaptureTarget = result;
    try { jsp3EnhancedThemeProperties(theme, role); }
    finally { jsp3EnhancedThemeCaptureTarget = null; }
    return result;
}

function jsp3EnhancedThemeCaptureRequest(info) {
    var payload;
    if (typeof info === "string" && info.length > 262144) return null;
    try { payload = typeof info === "string" ? JSON.parse(info) : info; } catch (e) { return null; }
    var id = payload ? String(payload.id || "") : "";
    if (!payload || payload.version !== 1 ||
            !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(id) ||
            !jsp3EnhancedThemeObject(payload.theme)) return null;
    var issuedAt = Math.round(Number(payload.issuedAt));
    var age = new Date().getTime() - issuedAt;
    if (!isFinite(issuedAt) || issuedAt <= 0 || age < -5000 || age > 5000) return null;
    return { id: id, theme: payload.theme };
}

function jsp3EnhancedApplyTheme(info, role) {
    var values = jsp3EnhancedThemeProperties(info, role);
    if (!values) throw new Error("invalid or unsupported DarkOneJSP3 theme");
    var changed = false;
    for (var name in values) {
        if (!Object.prototype.hasOwnProperty.call(values, name)) continue;
        try {
            if (window.GetProperty(name, null) !== values[name]) {
                window.SetProperty(name, values[name]);
                changed = true;
            }
        } catch (e) {}
    }
    return changed;
}

function jsp3EnhancedRoleDefaults(role, scope) {
    var entry = JSP3_ENHANCED_RESET_REGISTRY[role];
    var result = {};
    if (!entry) return result;

    function add(values) {
        for (var key in values) {
            if (Object.prototype.hasOwnProperty.call(values, key)) result[key] = values[key];
        }
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

function jsp3EnhancedApplyRoleReset(role, scope) {
    var values = jsp3EnhancedRoleDefaults(role, scope || "all");
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

// Compatibility aliases for themes and scripts written against the original
// DarkOneJSP3 integration names.
var DARKONEJSP3_SAMPLE_RESET_REGISTRY = JSP3_ENHANCED_RESET_REGISTRY;
function darkOneJsp3RoleDefaults(role, scope) {
    return jsp3EnhancedRoleDefaults(role, scope);
}
function darkOneJsp3ApplyRoleReset(role, scope) {
    return jsp3EnhancedApplyRoleReset(role, scope);
}
