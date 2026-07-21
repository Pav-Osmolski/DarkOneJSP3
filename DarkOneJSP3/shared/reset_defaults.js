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
            "Buttons appearance preset": 1,
            "Buttons depth preset": 0
        },
        behaviour: {},
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
        behaviour: {}
    },
    "info-stack": {
        appearance: {
            "DarkOneJSP3.InfoStack.BackgroundColour": 0xff181818,
            "DarkOneJSP3.InfoStack.BackgroundMode": 4,
            "DarkOneJSP3.InfoStack.FontSize": 0,
            "DarkOneJSP3.InfoStack.AutoFontScale": 100,
            "DarkOneJSP3.InfoStack.TabAreaHeight": 0,
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
            "DarkOneJSP3.DisplayWaveform.BackgroundMode": 2,
            "DarkOneJSP3.DisplayWaveform.HideWhenStopped": true
        },
        behaviour: { "DarkOneJSP3.DisplayWaveform.NewTrackRevealDelay": 200 }
    },
    "lastfm-bio": {
        appearance: {
            "DARKONEJSP3.PAGE.BACKGROUND.MODE": 3,
            "DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR": 0xff181818
        },
        behaviour: {}
    },
    "lastfm-info": {
        appearance: {
            "DARKONEJSP3.PAGE.BACKGROUND.MODE": 3,
            "DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR": 0xff181818
        },
        behaviour: {}
    },
    "properties": {
        appearance: {
            "DARKONEJSP3.PAGE.BACKGROUND.MODE": 3,
            "DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR": 0xff181818
        },
        behaviour: {}
    },
    "queue-viewer": {
        appearance: {
            "DARKONEJSP3.PAGE.BACKGROUND.MODE": 3,
            "DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR": 0xff181818
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
            "JSPLAYLIST.Free Wheel Step (pixels)": 0
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
            "SMOOTH.PLAYLIST.MANAGER.AUTO.SHOW.ACTIVE": true
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
            "DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR": 0xff181818
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
