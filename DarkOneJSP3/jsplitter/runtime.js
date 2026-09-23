"use strict";

// JSplitter-only support. Never import this module in a JScript Panel 3 script.
function darkOneUpdateRect(x, y, width, height, panelWidth, panelHeight) {
    if (![x, y, width, height].every(function (v) { return typeof v === 'number' && isFinite(v); })) {
        return { x: 0, y: 0, width: panelWidth, height: panelHeight };
    }
    var left = Math.max(0, x), top = Math.max(0, y);
    return { x: left, y: top, width: Math.max(0, Math.min(panelWidth, x + Math.max(0, width)) - left),
        height: Math.max(0, Math.min(panelHeight, y + Math.max(0, height)) - top) };
}

function createDarkOneControllerRuntime(host, services) {
    var channel = null, closed = false, stats = {}, reports = null, requestId = '';
    var sent = 0, received = 0, fallbacks = 0;
    var query = 'DarkOneJSP3.Diagnostics.Query.v1';
    var response = 'DarkOneJSP3.Diagnostics.Response.v1';
    var degraded = 'DarkOneJSP3.ControllerState.Fallback.v1';
    // Width is a replaceable state snapshot. Requests, readiness, theme commits,
    // queue operations and all ordering-sensitive messages remain synchronous.
    var widthMessage = 'DarkOneJSP3.InfoStack.MainAreaWidth';
    var sequence = 0, lastSequence = {};
    var identity = String(host.ID || '') + ':' + String(services.now()) + ':' + Math.random();
    var handler = null;
    function now() { return services.now(); }
    function stopChannel() {
        if (channel) { try { channel.close(); } catch (e) {} channel = null; }
    }
    function valid(name, data) {
        return name === widthMessage && typeof data === 'string' && data.length < 32 &&
            isFinite(Number(data)) && Number(data) > 0;
    }
    function snapshot() {
        var result = { panel: String(host.Name || host.ID || 'JSplitter'),
            transport: channel ? 'BroadcastChannel' : 'NotifyOthers fallback',
            messages: {sent: sent, received: received, fallbacks: fallbacks}, timingsMs: {} };
        Object.keys(stats).forEach(function (key) {
            var value = stats[key];
            result.timingsMs[key] = {count:value.count, last:value.last, maximum:value.maximum,
                average:value.count ? value.total / value.count : 0};
        });
        try { result.memory = host.JsMemoryStats || 'Unavailable'; } catch (e) { result.memory = 'Unavailable'; }
        return result;
    }
    function record(label, start) {
        var elapsed = Math.max(0, now() - start);
        var value = stats[label] || (stats[label] = {count:0,total:0,last:0,maximum:0});
        value.count++; value.total += elapsed; value.last = elapsed;
        value.maximum = Math.max(value.maximum, elapsed);
    }
    var started = now();
    try {
        if (services.Channel) {
            channel = new services.Channel('DarkOneJSP3.ControllerState.v1');
            channel.onmessage = function (event) {
                var value = event && event.data;
                if (closed || !handler || !value || value.version !== 1 ||
                        typeof value.sender !== 'string' || value.sender.length > 200 ||
                        !valid(value.name, value.data) || !isFinite(value.sequence) || value.sequence < 1) return;
                if ((lastSequence[value.sender] || 0) >= value.sequence) return;
                if (Object.keys(lastSequence).length > 32) lastSequence = {};
                lastSequence[value.sender] = value.sequence;
                received++;
                handler(value.name, value.data);
            };
            channel.onmessageerror = function () {
                // Switch all live controllers together and ask the width owner to resync.
                if (closed) return;
                fallbacks++;
                stopChannel();
                host.NotifyOthers(degraded, true);
            };
        }
    } catch (e) { channel = null; }
    return {
        send: function (name, data) {
            if (closed) return false;
            if (channel && valid(name, data)) {
                try {
                    channel.postMessage({version:1,sender:identity,sequence:++sequence,name:name,data:data});
                    sent++; return true;
                } catch (e) {
                    fallbacks++; stopChannel();
                    host.NotifyOthers(degraded, true);
                }
            }
            host.NotifyOthers(name, data);
            return false;
        },
        wrap: function (label, callback) {
            return function () {
                var start = now();
                try { return callback.apply(this, arguments); }
                finally { record(label, start); }
            };
        },
        bind: function (callback) {
            record('scriptSetup', started);
            handler = function (name, data) {
                if (closed) return;
                if (name === degraded && data === true) {
                    stopChannel();
                    return callback('DarkOneJSP3.InfoStack.MainAreaWidth.Query', true);
                }
                if (name === query && typeof data === 'string' && data.length < 200) {
                    host.NotifyOthers(response, JSON.stringify({id:data,report:snapshot()})); return;
                }
                if (name === response) {
                    if (reports && typeof data === 'string' && data.length < 65536) {
                        try {
                            var item = JSON.parse(data);
                            if (item.id === requestId && item.report && reports.length < 16) reports.push(item.report);
                        } catch (e) {}
                    }
                    return;
                }
                var start = now();
                try { return callback(name, data); }
                finally { record(name === 'DarkOneJSP3.Theme.Apply' ? 'themeNotification' : 'notification', start); }
            };
            return handler;
        },
        snapshot: snapshot,
        showReport: function () {
            if (closed) return;
            reports = [snapshot()]; requestId = identity + ':' + now();
            try { host.NotifyOthers(query, requestId); } catch (e) {}
            var output = {package:'DarkOneJSP3 v1.3.0',scope:'JSplitter controllers only; session callback timings, not total application latency',panels:reports};
            try { output.system = services.systemInfo(); } catch (e) { output.system = 'Unavailable'; }
            try { output.highResolutionTimers = services.highResolutionTimers(); } catch (e) { output.highResolutionTimers = 'Unavailable'; }
            reports = null;
            services.show(JSON.stringify(output, null, 2));
        },
        close: function () {
            closed = true; handler = null; reports = null;
            stopChannel();
        }
    };
}
