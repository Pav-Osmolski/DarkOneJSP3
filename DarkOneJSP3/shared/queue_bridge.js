"use strict";

// Shared file-backed queue bridge protocol between the always-running
// DarkOneJSP3 JSplitter root and the JScript Panel Queue Viewer.
// JSplitter owns authoritative queue enumeration and mutation; JScript Panel 3
// consumes the published state and sends small versioned commands back.

var DarkOneQueueBridge = (function () {
    var VERSION = 'v2';
    var FILE_NAME = 'darkonejsp3.queue-state.json';
    var COMMAND_FILE_NAME = 'darkonejsp3.queue-command.json';
    var RESULT_FILE_NAME = 'darkonejsp3.queue-command-result.json';
    var CAPABILITIES = [
        'remove', 'removeMany', 'clear',
        'moveUp', 'moveDown', 'moveTop', 'moveBottom'
    ];

    function integer(value, fallback) {
        value = Number(value);
        return isFinite(value) ? Math.round(value) : fallback;
    }

    function cleanIndexes(values) {
        var clean = [];
        values = Array.isArray(values) ? values : [];
        for (var i = 0; i < values.length; i++) {
            var value = integer(values[i], 0);
            if (value > 0 && clean.indexOf(value) === -1) clean.push(value);
        }
        clean.sort(function (a, b) { return a - b; });
        return clean;
    }

    function cleanCapabilities(values) {
        var clean = [];
        values = Array.isArray(values) ? values : [];
        for (var i = 0; i < values.length; i++) {
            var value = String(values[i] || '');
            if (CAPABILITIES.indexOf(value) >= 0 && clean.indexOf(value) === -1) clean.push(value);
        }
        return clean;
    }

    function cleanEntry(entry, queueIndex) {
        entry = entry || {};
        var index = integer(
            typeof entry.queueIndex !== 'undefined' ? entry.queueIndex : queueIndex,
            queueIndex
        );
        if (index < 1) index = queueIndex;
        return {
            queueIndex: index,
            playlistIndex: integer(entry.playlistIndex, -1),
            playlistItemIndex: integer(entry.playlistItemIndex, -1),
            sourceId: String(entry.sourceId || '')
        };
    }

    function state(session, generation, available, entries, writable, capabilities) {
        var clean = [];
        entries = entries || [];
        for (var i = 0; i < entries.length; i++) {
            clean.push(cleanEntry(entries[i], i + 1));
        }
        clean.sort(function (a, b) { return a.queueIndex - b.queueIndex; });
        var canWrite = writable === true;
        var caps = canWrite ? cleanCapabilities(capabilities || CAPABILITIES) : [];
        return {
            version: VERSION,
            session: String(session || ''),
            generation: Math.max(0, integer(generation, 0)),
            available: available !== false,
            writable: canWrite,
            capabilities: caps,
            entries: clean
        };
    }

    function serialise(value) {
        value = state(
            value && value.session,
            value && value.generation,
            value && value.available,
            value && value.entries,
            value && value.writable,
            value && value.capabilities
        );
        return JSON.stringify(value);
    }

    function parse(value) {
        var parsed;
        try {
            parsed = typeof value === 'string' ? JSON.parse(value) : value;
        } catch (e) {
            return null;
        }
        if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.entries)) return null;
        return state(
            parsed.session,
            parsed.generation,
            parsed.available,
            parsed.entries,
            parsed.writable,
            parsed.capabilities
        );
    }

    function command(id, session, generation, action, queueIndexes) {
        action = String(action || '');
        if (CAPABILITIES.indexOf(action) < 0) action = '';
        return {
            version: VERSION,
            id: String(id || ''),
            session: String(session || ''),
            generation: Math.max(0, integer(generation, 0)),
            action: action,
            queueIndexes: cleanIndexes(queueIndexes)
        };
    }

    function serialiseCommand(value) {
        return JSON.stringify(command(
            value && value.id,
            value && value.session,
            value && value.generation,
            value && value.action,
            value && value.queueIndexes
        ));
    }

    function parseCommand(value) {
        var parsed;
        try {
            parsed = typeof value === 'string' ? JSON.parse(value) : value;
        } catch (e) {
            return null;
        }
        if (!parsed || parsed.version !== VERSION) return null;
        var clean = command(parsed.id, parsed.session, parsed.generation, parsed.action, parsed.queueIndexes);
        if (!clean.id || !clean.session || !clean.action) return null;
        return clean;
    }

    function result(id, session, accepted, generation, message) {
        return {
            version: VERSION,
            id: String(id || ''),
            session: String(session || ''),
            accepted: accepted === true,
            generation: Math.max(0, integer(generation, 0)),
            message: String(message || '')
        };
    }

    function serialiseResult(value) {
        return JSON.stringify(result(
            value && value.id,
            value && value.session,
            value && value.accepted,
            value && value.generation,
            value && value.message
        ));
    }

    function parseResult(value) {
        var parsed;
        try {
            parsed = typeof value === 'string' ? JSON.parse(value) : value;
        } catch (e) {
            return null;
        }
        if (!parsed || parsed.version !== VERSION) return null;
        var clean = result(parsed.id, parsed.session, parsed.accepted, parsed.generation, parsed.message);
        return clean.id ? clean : null;
    }

    function token(value) {
        if (!value) return '';
        return String(value.session || '') + ':' + String(integer(value.generation, 0));
    }

    return Object.freeze({
        version: VERSION,
        fileName: FILE_NAME,
        commandFileName: COMMAND_FILE_NAME,
        resultFileName: RESULT_FILE_NAME,
        capabilities: CAPABILITIES.slice(0),
        state: state,
        serialise: serialise,
        parse: parse,
        command: command,
        serialiseCommand: serialiseCommand,
        parseCommand: parseCommand,
        result: result,
        serialiseResult: serialiseResult,
        parseResult: parseResult,
        token: token
    });
})();
