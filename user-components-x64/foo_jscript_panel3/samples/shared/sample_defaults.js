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
            "DARKONEJSP3.PAGE.TEXT.CUSTOM.COLOUR": 0xffdcdcdc
        },
        behaviour: {}
    },
    "lastfm-info": {
        appearance: {
            "DARKONEJSP3.PAGE.BACKGROUND.MODE": 3,
            "DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR": 0xff181818,
            "DARKONEJSP3.PAGE.COLOURS.DYNAMIC.ENABLED": false,
            "DARKONEJSP3.PAGE.TEXT.MODE": 0,
            "DARKONEJSP3.PAGE.TEXT.CUSTOM.COLOUR": 0xffdcdcdc
        },
        behaviour: {}
    },
    "properties": {
        appearance: {
            "DARKONEJSP3.PAGE.BACKGROUND.MODE": 3,
            "DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR": 0xff181818,
            "DARKONEJSP3.PAGE.COLOURS.DYNAMIC.ENABLED": false,
            "DARKONEJSP3.PAGE.TEXT.MODE": 0,
            "DARKONEJSP3.PAGE.TEXT.CUSTOM.COLOUR": 0xffdcdcdc
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
            "DARKONEJSP3.PAGE.SELECTED.BACKGROUND.CUSTOM.COLOUR": 0xff303030
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
            "DARKONEJSP3.PAGE.TEXT.CUSTOM.COLOUR": 0xffdcdcdc
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
