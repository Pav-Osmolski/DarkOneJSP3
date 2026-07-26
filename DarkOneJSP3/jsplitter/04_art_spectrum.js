"use strict";
include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\shared.js');

// Replaces Panel Stack Splitter 04.

var startupReadiness = DarkOneProtocol.startup.createReadinessBridge(
    window,
    'ArtSpectrum'
);
var ww = 0;
var wh = 0;

function layoutArtSpectrum() {
    if (ww <= 0 || wh <= 0) return;

    var art = DOJSP3.panel(DOJSP3.titles.albumArt);
    var spectrum = DOJSP3.panel(DOJSP3.titles.spectrum);
    // Fill the complete centre column. The former 20 px side inset exposed the
    // host's black background as visible gaps beside the visualiser.
    var inset = 0;
    var width = Math.max(1, ww);
    var artHeight = Math.min(width, Math.max(1, wh - 1));
    var spectrumY = Math.min(Math.max(0, wh - 1), artHeight);
    var spectrumHeight = Math.max(1, wh - spectrumY);

    DOJSP3.move(art, inset, 0, width, artHeight);
    DOJSP3.move(spectrum, inset, spectrumY, width, spectrumHeight);
    DOJSP3.show(art, true);
    DOJSP3.show(spectrum, true);

    if (!startupReadiness.isReady() && art && spectrum) {
        startupReadiness.signal();
    }
}

function on_size(width, height) {
    ww = width;
    wh = height;
    layoutArtSpectrum();
}

function on_paint(gr) {
    gr.FillSolidRect(0, 0, ww, wh, 0xff000000);
}

function on_notify_data(name, data) {
    if (darkOneJsp3HandleReset(name, data)) return;
    startupReadiness.handle(name);
}
