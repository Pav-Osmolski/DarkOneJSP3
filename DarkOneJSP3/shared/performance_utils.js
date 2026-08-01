/*
 * DarkOneJSP3 shared performance helpers
 * Version: 0.1.1
 *
 * Host-neutral utilities for demand-driven repaint scheduling, animation
 * frames, Direct2D bitmap conversion and lightweight optional profiling.
 */

var DARKONE_PERFORMANCE_UTILS_VERSION = "0.1.1";

var DarkOnePerformance = (function () {
    "use strict";

    function positiveInteger(value, fallback) {
        value = Math.round(Number(value));
        return isFinite(value) && value > 0 ? value : fallback;
    }

    function dispose(resource) {
        if (!resource) return;
        // Native JScript Panel COM methods can report typeof == "unknown".
        // Call the method directly and let try/catch handle unsupported objects.
        try { resource.Dispose(); } catch (e) {}
    }

    function toBitmap(image, disposeSource) {
        if (!image) return null;

        var bitmap = null;
        try {
            // Do not gate native COM methods with typeof == "function".
            bitmap = image.CreateBitmap();
        } catch (e) {
            // An existing IJSBitmap has no CreateBitmap method and is already
            // suitable for DrawBitmap, so retain it unchanged.
            bitmap = image;
        }

        if (disposeSource && bitmap !== image) dispose(image);
        return bitmap;
    }

    function loadBitmap(path) {
        var bitmap = null;
        try {
            if (typeof utils !== "undefined") bitmap = utils.LoadBitmap(path);
        } catch (e) {
            bitmap = null;
        }

        if (bitmap) return bitmap;

        var image = null;
        try {
            if (typeof utils !== "undefined") {
                image = utils.LoadImage(path);
                bitmap = toBitmap(image, true);
            }
        } catch (e2) {
            dispose(image);
            bitmap = null;
        }
        return bitmap;
    }

    function createRepaintScheduler(hostWindow, options) {
        options = options || {};
        var timer = false;
        var pending = false;
        var hiddenDelay = positiveInteger(options.hiddenDelay, 250);

        function getDelay() {
            var value = typeof options.getDelay === "function" ? options.getDelay() : options.delay;
            return positiveInteger(value, 16);
        }

        function schedule(delay) {
            if (timer) return;
            timer = hostWindow.SetTimeout(run, positiveInteger(delay, getDelay()));
        }

        function run() {
            timer = false;
            if (!pending) return;

            if (!hostWindow.IsVisible) {
                schedule(hiddenDelay);
                return;
            }

            pending = false;
            if (typeof options.repaint === "function") options.repaint();
        }

        return {
            request: function (delay) {
                pending = true;
                schedule(delay);
            },
            reschedule: function () {
                if (timer) {
                    hostWindow.ClearTimeout(timer);
                    timer = false;
                }
                if (pending) schedule(getDelay());
            },
            cancel: function () {
                if (timer) hostWindow.ClearTimeout(timer);
                timer = false;
                pending = false;
            },
            isPending: function () {
                return pending || !!timer;
            }
        };
    }

    function createFrameLoop(hostWindow, options) {
        options = options || {};
        var timer = false;
        var requested = false;
        var hiddenDelay = positiveInteger(options.hiddenDelay, 250);

        function getDelay() {
            var value = typeof options.getDelay === "function" ? options.getDelay() : options.delay;
            return positiveInteger(value, 16);
        }

        function schedule(delay) {
            if (timer) return;
            timer = hostWindow.SetTimeout(run, positiveInteger(delay, getDelay()));
        }

        function run() {
            timer = false;
            if (!requested) return;

            if (!hostWindow.IsVisible) {
                schedule(hiddenDelay);
                return;
            }

            requested = false;
            var keepRunning = false;
            if (typeof options.tick === "function") keepRunning = options.tick() === true;
            if (keepRunning || requested) {
                requested = true;
                schedule(getDelay());
            }
        }

        return {
            request: function (delay) {
                requested = true;
                schedule(delay);
            },
            reschedule: function () {
                if (timer) {
                    hostWindow.ClearTimeout(timer);
                    timer = false;
                }
                if (requested) schedule(getDelay());
            },
            stop: function () {
                if (timer) hostWindow.ClearTimeout(timer);
                timer = false;
                requested = false;
            },
            isRunning: function () {
                return requested || !!timer;
            }
        };
    }

    function createProfiler(utilsObject, enabled, name, sampleSize) {
        if (!enabled || !utilsObject) return null;

        var profiler = null;
        // CreateProfiler is another native COM method and may report
        // typeof == "unknown" in the JScript engine.
        try { profiler = utilsObject.CreateProfiler(name || "DarkOneJSP3"); } catch (e) {}
        if (!profiler) return null;

        var count = 0;
        var total = 0;
        var maximum = 0;
        var samples = positiveInteger(sampleSize, 120);

        return {
            begin: function () {
                if (profiler && typeof profiler.Reset === "function") profiler.Reset();
            },
            end: function (suffix) {
                if (!profiler) return;
                var elapsed = Number(profiler.Time) || 0;
                total += elapsed;
                maximum = Math.max(maximum, elapsed);
                count++;
                if (count >= samples) {
                    try {
                        console.log((name || "DarkOneJSP3") + ": average " +
                            (total / count).toFixed(3) + " ms, peak " + maximum.toFixed(3) +
                            " ms over " + count + " frames" + (suffix ? " (" + suffix + ")" : ""));
                    } catch (e) {}
                    count = 0;
                    total = 0;
                    maximum = 0;
                }
            },
            enabled: function () {
                return !!profiler;
            }
        };
    }

    return {
        dispose: dispose,
        toBitmap: toBitmap,
        loadBitmap: loadBitmap,
        createRepaintScheduler: createRepaintScheduler,
        createFrameLoop: createFrameLoop,
        createProfiler: createProfiler
    };
})();
