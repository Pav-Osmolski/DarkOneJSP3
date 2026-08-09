"use strict";

// Shared colour helpers used by the enhanced JScript Panel samples and
// DarkOneJSP3 integration scripts. The functions are deliberately host-neutral;
// callers provide the appropriate native picker signature where needed.
var DarkOneColour = Object.freeze({
    opaque: function (colour) {
        return 0xff000000 + ((Number(colour) >>> 0) & 0x00ffffff);
    },

    nativeSigned: function (colour) {
        return Number(colour) | 0;
    },

    normalisePickerChoice: function (value) {
        if (value === null || typeof value === 'undefined') return null;
        var number = Number(value);
        if (!isFinite(number) || Math.floor(number) !== number) return null;
        // Native hosts may return either signed LONG values or unsigned ARGB.
        if (number < -2147483648 || number > 4294967295) return null;
        return this.opaque(number);
    },

    toHex: function (colour) {
        var rgb = (Number(colour) >>> 0) & 0x00ffffff;
        var value = rgb.toString(16).toUpperCase();
        while (value.length < 6) value = '0' + value;
        return '#' + value;
    },

    parseOpaque: function (value) {
        value = String(value || '').replace(/^\s+|\s+$/g, '');
        var match = value.match(/^#?([0-9a-f]{6})$/i);
        if (match) return 0xff000000 + parseInt(match[1], 16);

        match = value.match(/^\s*(\d{1,3})\s*[,; ]\s*(\d{1,3})\s*[,; ]\s*(\d{1,3})\s*$/);
        if (!match) return null;

        function channel(number) {
            return Math.max(0, Math.min(255, parseInt(number, 10)));
        }

        return 0xff000000 +
            (channel(match[1]) * 0x10000) +
            (channel(match[2]) * 0x100) +
            channel(match[3]);
    },

    columnsUi: function (index, fallback) {
        try {
            return this.opaque(window.GetColourCUI(index));
        } catch (e) {
            return this.opaque(fallback);
        }
    },

    isChoice: function (value) {
        return this.normalisePickerChoice(value) !== null;
    },

    logPickerFailure: function (host, context, error) {
        try {
            if (typeof console === 'undefined' || typeof console.log === 'undefined') return;
            var label = context ? ' (' + context + ')' : '';
            var message = error && error.message ? error.message : String(error);
            console.log('[DarkOneJSP3] ' + host + ' ColourPicker failed' + label + ': ' + message);
        } catch (ignored) {}
    },

    normaliseMode: function (value, allowedModes, fallback) {
        value = Math.round(Number(value));
        if (isNaN(value)) return fallback;
        for (var i = 0; i < allowedModes.length; i++) {
            if (value === allowedModes[i]) return value;
        }
        return fallback;
    },

    optionForMode: function (options, mode) {
        for (var i = 0; i < options.length; i++) {
            if (options[i].mode === mode) return options[i];
        }
        return null;
    },

    optionForId: function (options, id) {
        for (var i = 0; i < options.length; i++) {
            if (options[i].id === id) return options[i];
        }
        return null;
    },

    appendRadioOptions: function (menu, options, selectedMode, customColour, flags) {
        var minimumId = null;
        var maximumId = null;

        for (var i = 0; i < options.length; i++) {
            var option = options[i];
            var label = option.custom
                ? 'Custom colour (' + this.toHex(customColour) + ')'
                : option.label;
            menu.AppendMenuItem(flags, option.id, label);
            minimumId = minimumId === null ? option.id : Math.min(minimumId, option.id);
            maximumId = maximumId === null ? option.id : Math.max(maximumId, option.id);
        }

        var selected = this.optionForMode(options, selectedMode) || options[0];
        if (selected && minimumId !== null && maximumId !== null) {
            menu.CheckMenuRadioItem(minimumId, maximumId, selected.id);
        }
        return selected ? selected.id : 0;
    },

    pickJsplitter: function (current, title, prompt) {
        current = this.opaque(current);
        var pickerAvailable = typeof utils !== 'undefined' &&
            typeof utils.ColourPicker !== 'undefined';

        if (pickerAvailable) {
            try {
                var chosen = utils.ColourPicker(0, this.nativeSigned(current));
                var normalised = this.normalisePickerChoice(chosen);
                // Both supported native pickers return their supplied default
                // when the dialog is cancelled. Treat an unchanged result as
                // cancellation so selecting Custom never changes mode on Cancel.
                return normalised !== null && normalised !== current ? normalised : null;
            } catch (e) {
                this.logPickerFailure('JSplitter', title, e);
                return null;
            }
        }

        try {
            var entered = utils.InputBox(prompt, title, this.toHex(current));
            return this.parseOpaque(entered);
        } catch (e2) {}
        return null;
    },

    pickJscript: function (current, title, prompt) {
        current = this.opaque(current);
        var pickerAvailable = typeof utils !== 'undefined' &&
            typeof utils.ColourPicker !== 'undefined';

        if (pickerAvailable) {
            try {
                // JScript Panel 3 uses the one-argument native signature and
                // expects a signed 32-bit colour at the host boundary.
                var chosen = utils.ColourPicker(this.nativeSigned(current));
                var normalised = this.normalisePickerChoice(chosen);
                return normalised !== null && normalised !== current ? normalised : null;
            } catch (e) {
                this.logPickerFailure('JScript Panel', title, e);
                return null;
            }
        }

        try {
            var entered = utils.InputBox(prompt, title, this.toHex(current));
            return this.parseOpaque(entered);
        } catch (e2) {}
        return null;
    }
});
