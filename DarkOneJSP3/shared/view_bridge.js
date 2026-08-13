"use strict";

var DarkOneViewBridge = (function () {
    var VERSION = 'v1';
    var NOTIFICATION = 'DarkOneJSP3.View.Command';
    var COMMAND_FILE = fb.ProfilePath + 'js_data\\darkonejsp3.view-command.txt';
    var MAX_AGE = 5000;
    var commands = Object.freeze({
        layoutToggle: 'layout-toggle',
        visualiserToggle: 'visualiser-toggle'
    });

    function normaliseCommand(value) {
        value = String(value || '').toLowerCase();
        return value === commands.layoutToggle || value === commands.visualiserToggle ? value : null;
    }

    function commandForButtonPath(value) {
        value = String(value || '').replace(/\\/g, '/').replace(/^\s+|\s+$/g, '').toLowerCase();
        if (value === 'darkonejsp3/layout/toggle') return commands.layoutToggle;
        if (value === 'darkonejsp3/visualiser/toggle' || value === 'darkonejsp3/visualizer/toggle') return commands.visualiserToggle;
        return null;
    }

    function createId(now) {
        now = Math.round(Number(now));
        if (!isFinite(now) || now <= 0) now = new Date().getTime();
        return String(now) + '-' + String(Math.floor(Math.random() * 0x1000000));
    }

    function serialise(command, id, issuedAt) {
        command = normaliseCommand(command);
        id = String(id || '').replace(/[|\r\n]/g, '');
        issuedAt = Math.round(Number(issuedAt));
        if (!command || !id || !isFinite(issuedAt) || issuedAt <= 0) return null;
        return VERSION + '|' + id + '|' + String(issuedAt) + '|' + command;
    }

    function parse(data, now) {
        var parts = String(data || '').split('|');
        if (parts.length !== 4 || parts[0] !== VERSION) return null;
        var id = String(parts[1] || '');
        var issuedAt = Math.round(Number(parts[2]));
        var command = normaliseCommand(parts[3]);
        now = Math.round(Number(now));
        if (!isFinite(now)) now = new Date().getTime();
        if (!id || !isFinite(issuedAt) || issuedAt <= 0 || !command) return null;
        var age = now - issuedAt;
        if (age < -5000 || age > MAX_AGE) return null;
        return { id: id, issuedAt: issuedAt, command: command };
    }

    function serialiseNotification(command) {
        command = normaliseCommand(command);
        return command ? VERSION + '|' + command : null;
    }

    function parseNotification(data) {
        var parts = String(data || '').split('|');
        if (parts.length !== 2 || parts[0] !== VERSION) return null;
        return normaliseCommand(parts[1]);
    }

    function writeCommand(command) {
        command = normaliseCommand(command);
        if (!command) return false;
        var now = new Date().getTime();
        var payload = serialise(command, createId(now), now);
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
        normaliseCommand: normaliseCommand, commandForButtonPath: commandForButtonPath,
        serialise: serialise, parse: parse, serialiseNotification: serialiseNotification,
        parseNotification: parseNotification, writeCommand: writeCommand
    });
})();
