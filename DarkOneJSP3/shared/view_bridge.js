"use strict";

var DarkOneViewBridge = (function () {
    var VERSION = 'v1';
    var NOTIFICATION = 'DarkOneJSP3.View.Command';
    var COMMAND_FILE = fb.ProfilePath + 'js_data\\darkonejsp3.view-command.txt';
    var MAX_AGE = 5000;
    var commands = Object.freeze({
        layoutToggle: 'layout-toggle',
        visualiserToggle: 'visualiser-toggle',
        infoStackMenu: 'infostack-menu'
    });

    function normaliseCommand(value) {
        value = String(value || '').toLowerCase();
        return value === commands.layoutToggle || value === commands.visualiserToggle || value === commands.infoStackMenu ? value : null;
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

    return Object.freeze({
        version: VERSION, notification: NOTIFICATION, commandFile: COMMAND_FILE, commands: commands,
        normaliseCommand: normaliseCommand, normaliseAnchorX: normaliseAnchorX, commandForButtonPath: commandForButtonPath,
        serialise: serialise, parse: parse, serialiseNotification: serialiseNotification,
        parseNotificationData: parseNotificationData, parseNotification: parseNotification, writeCommand: writeCommand
    });
})();
