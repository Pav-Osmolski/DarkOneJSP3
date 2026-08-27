"use strict";

// Shared constants and small helpers for the six DarkOneJSP3 JSplitter hosts.
// Each JSplitter has its own JavaScript context, so this file is included by
// each host independently.

include(fb.ProfilePath + 'DarkOneJSP3\\shared\\colour_utils.js');
include(fb.ProfilePath + 'DarkOneJSP3\\shared\\jsplitter_protocols.js');
include(fb.ProfilePath + 'DarkOneJSP3\\shared\\view_bridge.js');

var darkOneGradientRunCacheKey = '';
var darkOneGradientRunCache = [];

function darkOneVerticalGradientRuns(height, topColour, bottomColour) {
    height = Math.max(0, Math.round(height));
    var key = String(height) + '|' + String(topColour >>> 0) + '|' +
        String(bottomColour >>> 0);
    if (key === darkOneGradientRunCacheKey) return darkOneGradientRunCache;

    var runs = [];
    if (height > 0) {
        var denominator = Math.max(1, height - 1);
        var runTop = 0;
        var runColour = DarkOneColour.blend(topColour, bottomColour, 0);
        for (var row = 1; row < height; row++) {
            var colour = DarkOneColour.blend(topColour, bottomColour, row / denominator);
            if ((colour >>> 0) === (runColour >>> 0)) continue;
            runs.push({ top: runTop, height: row - runTop, colour: runColour });
            runTop = row;
            runColour = colour;
        }
        runs.push({ top: runTop, height: height - runTop, colour: runColour });
    }
    darkOneGradientRunCacheKey = key;
    darkOneGradientRunCache = runs;
    return runs;
}

var DOJSP3 = Object.freeze({
    colours: Object.freeze({
        bar: 0xff202020,
        separator: 0xff181818,
        buttonNormal: 0xff298fcc,
        buttonHover: 0xff9b9b9b,
        buttonActive: 0xffffffff
    }),

    titles: Object.freeze({
        main: 'DOJSP3.Main',
        controls: 'DOJSP3.Controls',

        infoStack: 'DOJSP3.InfoStack',
        artSpectrum: 'DOJSP3.ArtSpectrum',
        playlist: 'DOJSP3.Playlist',

        playlistManager: 'DOJSP3.PlaylistManager',
        lastfmBio: 'DOJSP3.LastfmBio',
        lastfmInfo: 'DOJSP3.LastfmInfo',
        albumNotes: 'DOJSP3.AlbumNotes',
        queue: 'DOJSP3.Queue',
        properties: 'DOJSP3.Properties',

        albumArt: 'DOJSP3.AlbumArt',
        spectrum: 'DOJSP3.Spectrum',

        controlsLeft: 'DOJSP3.ControlsLeft',
        quickSearch: 'DOJSP3.QuickSearch',
        displayStack: 'DOJSP3.DisplayStack',
        controlsRight: 'DOJSP3.ControlsRight',

        display: 'DOJSP3.Display',
        waveform: 'DOJSP3.Waveform'
    }),

    mulDiv: function (value, multiplier, divisor) {
        return Math.round(value * multiplier / divisor);
    },

    idiv: function (value, divisor) {
        return Math.floor(value / divisor);
    },

    clamp: function (value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    },

    fillVerticalGradient: function (gr, x, y, width, height, topColour, bottomColour) {
        width = Math.max(0, Math.round(width));
        height = Math.max(0, Math.round(height));
        if (!gr || width <= 0 || height <= 0) return;

        // Cache the coalesced row runs. Repaints at unchanged geometry and
        // colours then perform draw calls only, without repeating colour math.
        var runs = darkOneVerticalGradientRuns(height, topColour, bottomColour);
        for (var i = 0; i < runs.length; i++) {
            var run = runs[i];
            gr.FillSolidRect(x, y + run.top, width, run.height, run.colour);
        }
    },

    panel: function (caption) {
        if (Object.prototype.hasOwnProperty.call(DOJSP3._panels, caption)) {
            return DOJSP3._panels[caption];
        }

        var panel = window.GetPanel(caption);
        if (panel) {
            DOJSP3._panels[caption] = panel;
        } else if (!DOJSP3._missing[caption]) {
            DOJSP3._missing[caption] = true;
            console.log('[DarkOneJSP3] Child panel not found: ' + caption +
                '. Check the exact Columns UI custom title.');
        }
        return panel;
    },

    move: function (panel, x, y, width, height) {
        if (!panel) return;
        x = Math.round(x);
        y = Math.round(y);
        width = Math.max(1, Math.round(width));
        height = Math.max(1, Math.round(height));
        panel.Move(x, y, width, height, false);
    },

    show: function (panel, visible) {
        if (panel) panel.Show(Boolean(visible));
    },

    _panels: Object.create(null),
    _missing: Object.create(null)
});


include(fb.ProfilePath + 'DarkOneJSP3\\shared\\reset_defaults.js');

function darkOneJsp3NormaliseResetScope(value) {
    value = String(value == null ? '' : value).toLowerCase();
    return value == 'appearance' || value == 'behaviour' || value == 'all'
        ? value
        : null;
}

function darkOneJsp3ResetScope(data) {
    if (data == null || data === '') return 'all';
    if (typeof data == 'string') {
        try {
            var payload = JSON.parse(data);
            if (payload && typeof payload == 'object') {
                return Object.prototype.hasOwnProperty.call(payload, 'scope')
                    ? darkOneJsp3NormaliseResetScope(payload.scope)
                    : 'all';
            }
        } catch (e) {}
        return darkOneJsp3NormaliseResetScope(data);
    }
    if (typeof data == 'object') {
        return Object.prototype.hasOwnProperty.call(data, 'scope')
            ? darkOneJsp3NormaliseResetScope(data.scope)
            : 'all';
    }
    return null;
}

function darkOneJsp3HandleReset(name, data) {
    if (name !== DARKONEJSP3_RESET_NOTIFICATION) return false;
    var scope = darkOneJsp3ResetScope(data);
    var role = typeof DARKONEJSP3_RESET_ROLE == 'string' ? DARKONEJSP3_RESET_ROLE : '';
    if (!scope || !role || !DARKONEJSP3_RESET_REGISTRY[role]) return false;
    darkOneJsp3ApplyRoleReset(role, scope);
    try { window.Reload(); } catch (e) { window.Repaint(); }
    return true;
}
