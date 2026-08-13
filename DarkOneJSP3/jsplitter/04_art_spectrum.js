"use strict";
include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\shared.js');

// Replaces Panel Stack Splitter 04.

var DARKONEJSP3_RESET_ROLE = "art-spectrum";

var startupReadiness = DarkOneProtocol.startup.createReadinessBridge(
    window,
    'ArtSpectrum'
);
var ww = 0;
var wh = 0;

var ART_SPECTRUM_MODE_PROPERTY = 'DARKONEJSP3.ARTSPECTRUM.LAYOUT.MODE';
var ART_SPECTRUM_SPLIT = 0;
var ART_SPECTRUM_ART_ONLY = 1;

var ART_SPECTRUM_PREPARE_NOTIFICATION = 'DarkOneJSP3.ArtSpectrum.PrepareLayout';
var ART_SPECTRUM_MODE_QUERY_NOTIFICATION = 'DarkOneJSP3.ArtSpectrum.Mode.Query';
var ART_SPECTRUM_MODE_STATE_NOTIFICATION = 'DarkOneJSP3.ArtSpectrum.Mode.State';

function artSpectrumMode() {
    var mode = Math.round(Number(window.GetProperty(ART_SPECTRUM_MODE_PROPERTY, ART_SPECTRUM_SPLIT)));
    return mode === ART_SPECTRUM_ART_ONLY ? mode : ART_SPECTRUM_SPLIT;
}

function broadcastArtSpectrumMode() {
    window.NotifyOthers(
        ART_SPECTRUM_MODE_STATE_NOTIFICATION,
        artSpectrumMode() === ART_SPECTRUM_ART_ONLY ? 'art-only' : 'split'
    );
}

function setArtSpectrumMode(mode) {
    mode = mode === ART_SPECTRUM_ART_ONLY ? mode : ART_SPECTRUM_SPLIT;
    window.SetProperty(ART_SPECTRUM_MODE_PROPERTY, mode);
    layoutArtSpectrum();
    broadcastArtSpectrumMode();
    window.Repaint();
}

function toggleVisualiser() {
    setArtSpectrumMode(artSpectrumMode() === ART_SPECTRUM_SPLIT
        ? ART_SPECTRUM_ART_ONLY
        : ART_SPECTRUM_SPLIT);
}

function layoutArtSpectrumForSize(width, height) {
    width = Math.max(1, Math.round(width));
    height = Math.max(1, Math.round(height));

    var art = DOJSP3.panel(DOJSP3.titles.albumArt);
    var spectrum = DOJSP3.panel(DOJSP3.titles.spectrum);
    // Fill the complete centre/left column. With the visualiser enabled, Album
    // Art keeps the original square-first upper allocation and Spectrum receives
    // the remaining height. Album-art-only mode gives the JSP3 panel the complete
    // host rectangle; its own Square sizing setting decides whether the artwork
    // fits inside that rectangle or fills its height and crops horizontally.
    if (artSpectrumMode() === ART_SPECTRUM_ART_ONLY) {
        DOJSP3.move(art, 0, 0, width, height);
        DOJSP3.show(art, true);
        DOJSP3.show(spectrum, false);
    } else {
        var artHeight = Math.min(width, Math.max(1, height - 1));
        var spectrumY = Math.min(Math.max(0, height - 1), artHeight);
        var spectrumHeight = Math.max(1, height - spectrumY);
        DOJSP3.move(art, 0, 0, width, artHeight);
        DOJSP3.move(spectrum, 0, spectrumY, width, spectrumHeight);
        DOJSP3.show(art, true);
        DOJSP3.show(spectrum, true);
    }

    if (!startupReadiness.isReady() && art && spectrum) {
        startupReadiness.signal();
    }
}

function layoutArtSpectrum() {
    if (ww <= 0 || wh <= 0) return;
    layoutArtSpectrumForSize(ww, wh);
}

function on_size(width, height) {
    ww = width;
    wh = height;
    layoutArtSpectrum();
    broadcastArtSpectrumMode();
}

function on_paint(gr) {
    gr.FillSolidRect(0, 0, ww, wh, 0xff000000);
}

function on_notify_data(name, data) {
    if (name === ART_SPECTRUM_PREPARE_NOTIFICATION) {
        var parts = String(data || '').split('|');
        var targetWidth = Math.round(Number(parts[0]));
        var targetHeight = Math.round(Number(parts[1]));
        if (parts.length === 2 && isFinite(targetWidth) && targetWidth > 0 &&
                isFinite(targetHeight) && targetHeight > 0) {
            layoutArtSpectrumForSize(targetWidth, targetHeight);
        }
        return;
    }
    if (name === ART_SPECTRUM_MODE_QUERY_NOTIFICATION) {
        broadcastArtSpectrumMode();
        return;
    }

    if (name === DarkOneViewBridge.notification) {
        var viewCommand = DarkOneViewBridge.parseNotification(data);
        if (viewCommand === DarkOneViewBridge.commands.visualiserToggle) {
            toggleVisualiser();
            return;
        }
    }
    if (darkOneJsp3HandleReset(name, data)) return;
    startupReadiness.handle(name);
}
