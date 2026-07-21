"use strict";

// Shared constants and small helpers for the six DarkOneJSP3 JSplitter hosts.
// Each JSplitter has its own JavaScript context, so this file is included by
// each host independently.

var DOJSP3 = Object.freeze({
    colours: Object.freeze({
        bar: 0xff202020,
        separator: 0xff181818,
        quickSearchFill: 0xff1e1e1e,
        quickSearchBorder: 0xff696969,
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

function darkOneJsp3ResetScope(data) {
    if (typeof data == 'string') {
        try {
            var payload = JSON.parse(data);
            if (payload && payload.scope) return String(payload.scope);
        } catch (e) {
            if (data == 'appearance' || data == 'behaviour' || data == 'all') return data;
        }
    }
    return data && data.scope ? String(data.scope) : 'all';
}

function darkOneJsp3HandleReset(name, data) {
    if (name !== 'DarkOneJSP3.Reset.Properties') return false;
    var scope = darkOneJsp3ResetScope(data);
    var role = typeof DARKONEJSP3_RESET_ROLE == 'string' ? DARKONEJSP3_RESET_ROLE : '';
    if (!role || !DARKONEJSP3_RESET_REGISTRY[role]) return true;
    darkOneJsp3ApplyRoleReset(role, scope);
    try { window.Reload(); } catch (e) { window.Repaint(); }
    return true;
}

