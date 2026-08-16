"use strict";

var DarkOneViewBridge = (function () {
    var VERSION = 'v1';
    var NOTIFICATION = 'DarkOneJSP3.View.Command';
    var COMMAND_FILE = fb.ProfilePath + 'js_data\\darkonejsp3.view-command.txt';
    var INFO_STACK_STATE_FILE = fb.ProfilePath + 'js_data\\darkonejsp3.infostack-menu-state.json';
    var MAX_AGE = 5000;
    var commands = Object.freeze({
        layoutToggle: 'layout-toggle',
        visualiserToggle: 'visualiser-toggle',
        infoStackMenu: 'infostack-menu'
    });

    function normaliseInfoStackActionId(value) {
        value = Math.round(Number(value));
        if (!isFinite(value)) return null;
        if ((value >= 100 && value <= 105) || value === 250 ||
                (value >= 200 && value <= 203) ||
                (value >= 300 && value <= 305) ||
                (value >= 400 && value <= 405) ||
                (value >= 450 && value <= 453) ||
                value === 600 || value === 601 ||
                (value >= 700 && value <= 706) ||
                (value >= 800 && value <= 803) ||
                value === 106 || (value >= 900 && value <= 905) ||
                (value >= 1000 && value <= 1002) ||
                (value >= 1010 && value <= 1013)) return value;
        return null;
    }

    function infoStackActionCommand(value) {
        var id = normaliseInfoStackActionId(value);
        return id === null ? null : 'infostack-action:' + String(id);
    }

    function infoStackActionFromCommand(value) {
        var match = String(value || '').toLowerCase().match(/^infostack-action:(\d+)$/);
        return match ? normaliseInfoStackActionId(match[1]) : null;
    }

    function normaliseCommand(value) {
        value = String(value || '').toLowerCase();
        if (value === commands.layoutToggle || value === commands.visualiserToggle || value === commands.infoStackMenu) return value;
        return infoStackActionCommand(infoStackActionFromCommand(value));
    }

    function commandForButtonPath(value) {
        value = String(value || '').replace(/\\/g, '/').replace(/^\s+|\s+$/g, '').toLowerCase();
        if (value === 'darkonejsp3/layout/toggle') return commands.layoutToggle;
        if (value === 'darkonejsp3/visualiser/toggle' || value === 'darkonejsp3/visualizer/toggle') return commands.visualiserToggle;
        if (value === 'darkonejsp3/infostack/menu') return commands.infoStackMenu;
        return null;
    }

    function createId(now) {
        now = Math.round(Number(now));
        if (!isFinite(now) || now <= 0) now = new Date().getTime();
        return String(now) + '-' + String(Math.floor(Math.random() * 0x1000000));
    }

    function normaliseAnchorX(value) {
        if (value === null || typeof value === 'undefined' || value === '') return null;
        value = Math.round(Number(value));
        return isFinite(value) ? Math.max(0, Math.min(1000, value)) : null;
    }

    function serialise(command, id, issuedAt, anchorX) {
        command = normaliseCommand(command);
        id = String(id || '').replace(/[|\r\n]/g, '');
        issuedAt = Math.round(Number(issuedAt));
        if (!command || !id || !isFinite(issuedAt) || issuedAt <= 0) return null;
        anchorX = normaliseAnchorX(anchorX);
        var payload = VERSION + '|' + id + '|' + String(issuedAt) + '|' + command;
        return anchorX === null ? payload : payload + '|' + String(anchorX);
    }

    function parse(data, now) {
        var parts = String(data || '').split('|');
        if ((parts.length !== 4 && parts.length !== 5) || parts[0] !== VERSION) return null;
        var id = String(parts[1] || '');
        var issuedAt = Math.round(Number(parts[2]));
        var command = normaliseCommand(parts[3]);
        now = Math.round(Number(now));
        if (!isFinite(now)) now = new Date().getTime();
        var anchorX = parts.length === 5 ? normaliseAnchorX(parts[4]) : null;
        if (!id || !isFinite(issuedAt) || issuedAt <= 0 || !command) return null;
        var age = now - issuedAt;
        if (age < -5000 || age > MAX_AGE) return null;
        return { id: id, issuedAt: issuedAt, command: command, anchorX: anchorX };
    }

    function serialiseNotification(command, anchorX) {
        command = normaliseCommand(command);
        if (!command) return null;
        anchorX = normaliseAnchorX(anchorX);
        return anchorX === null ? VERSION + '|' + command : VERSION + '|' + command + '|' + String(anchorX);
    }

    function parseNotificationData(data) {
        var parts = String(data || '').split('|');
        if ((parts.length !== 2 && parts.length !== 3) || parts[0] !== VERSION) return null;
        var command = normaliseCommand(parts[1]);
        if (!command) return null;
        return { command: command, anchorX: parts.length === 3 ? normaliseAnchorX(parts[2]) : null };
    }

    function parseNotification(data) {
        var parsed = parseNotificationData(data);
        return parsed ? parsed.command : null;
    }

    function writeCommand(command, anchorX) {
        command = normaliseCommand(command);
        if (!command) return false;
        var now = new Date().getTime();
        var payload = serialise(command, createId(now), now, anchorX);
        if (!payload) return false;
        try { utils.CreateFolder(fb.ProfilePath + 'js_data\\'); } catch (e) {}
        try {
            var result = utils.WriteTextFile(COMMAND_FILE, payload);
            return result !== false;
        } catch (e2) {}
        return false;
    }

    function serialiseInfoStackState(state, now) {
        if (!state || typeof state !== 'object') return null;
        now = Math.round(Number(now));
        if (!isFinite(now) || now <= 0) now = new Date().getTime();
        var payload = { version: VERSION, issuedAt: now, state: state };
        try { return JSON.stringify(payload); } catch (e) {}
        return null;
    }

    function parseInfoStackState(data) {
        var payload;
        try { payload = JSON.parse(String(data || '')); } catch (e) { return null; }
        if (!payload || payload.version !== VERSION || !payload.state || typeof payload.state !== 'object') return null;
        return payload.state;
    }

    function writeInfoStackState(state) {
        var payload = serialiseInfoStackState(state, new Date().getTime());
        if (!payload) return false;
        try { utils.CreateFolder(fb.ProfilePath + 'js_data\\'); } catch (e) {}
        try { return utils.WriteTextFile(INFO_STACK_STATE_FILE, payload) !== false; } catch (e2) {}
        return false;
    }

    function readInfoStackState() {
        try { return parseInfoStackState(utils.ReadTextFile(INFO_STACK_STATE_FILE, 65001)); } catch (e) {}
        return null;
    }

    return Object.freeze({
        version: VERSION, notification: NOTIFICATION, commandFile: COMMAND_FILE, infoStackStateFile: INFO_STACK_STATE_FILE, commands: commands,
        normaliseCommand: normaliseCommand, normaliseAnchorX: normaliseAnchorX, commandForButtonPath: commandForButtonPath,
        normaliseInfoStackActionId: normaliseInfoStackActionId, infoStackActionCommand: infoStackActionCommand,
        infoStackActionFromCommand: infoStackActionFromCommand,
        serialise: serialise, parse: parse, serialiseNotification: serialiseNotification,
        parseNotificationData: parseNotificationData, parseNotification: parseNotification, writeCommand: writeCommand,
        serialiseInfoStackState: serialiseInfoStackState, parseInfoStackState: parseInfoStackState,
        writeInfoStackState: writeInfoStackState, readInfoStackState: readInfoStackState
    });
})();
