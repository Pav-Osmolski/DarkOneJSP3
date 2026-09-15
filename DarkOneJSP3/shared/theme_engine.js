"use strict";

// DarkOneJSP3 descriptive theme format and strict property adapter.
// Theme files expose stable, human-readable names. Only this allow-list knows
// the implementation property names owned by each panel.
var DARKONEJSP3_THEME_NOTIFICATION = "DarkOneJSP3.Theme.Apply";
var DARKONEJSP3_THEME_STAGE_NOTIFICATION = "DarkOneJSP3.Theme.Stage";
var DARKONEJSP3_THEME_PAINT_NOTIFICATION = "DarkOneJSP3.Theme.Painted";
var DARKONEJSP3_THEME_COMMAND_FILE = fb.ProfilePath + "js_data\\darkonejsp3.theme-command.json";
var DARKONEJSP3_THEME_CAPTURE_QUERY_NOTIFICATION = "DarkOneJSP3.Theme.Capture.Query";
var DARKONEJSP3_THEME_CAPTURE_RESPONSE_NOTIFICATION = "DarkOneJSP3.Theme.Capture.Response";
var DARKONEJSP3_THEME_CAPTURE_QUERY_FILE = fb.ProfilePath + "js_data\\darkonejsp3.theme-capture-query.json";
var DARKONEJSP3_THEME_CAPTURE_RESPONSE_FILE = fb.ProfilePath + "js_data\\darkonejsp3.theme-capture-response.json";
var DARKONEJSP3_THEME_FORMAT = "DarkOneJSP3 Theme";
var DARKONEJSP3_THEME_FORMAT_VERSION = 1;
var DARKONEJSP3_THEME_COMMAND_MAX_AGE = 30000;
var DARKONEJSP3_THEME_CAPTURE_MAX_AGE = 5000;
var DARKONEJSP3_THEME_STAGE_MAX_AGE = 5000;
var DARKONEJSP3_THEME_STAGE_MAX_LEAD = 1000;

var DarkOneTheme = (function () {
    var captureTarget = null;
    var captureMappingTarget = null;
    var captureMappings = {};
    var captureRoles = {
        "control-left": true,
        "control-right": true,
        "display": true,
        "main-columns": true,
        "art-spectrum": true,
        "bottom-controls": true,
        "quick-search": true,
        "info-stack": true,
        "display-waveform": true,
        "lastfm-bio": true,
        "lastfm-info": true,
        "properties": true,
        "album-notes": true,
        "queue-viewer": true,
        "album-art": true,
        "playlist-manager": true,
        "js-playlist": true
    };

    function own(object, key) {
        return object && Object.prototype.hasOwnProperty.call(object, key);
    }

    function object(value) {
        return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    }

    function path(root, dotted) {
        var value = root;
        var parts = dotted.split(".");
        for (var i = 0; i < parts.length; i++) {
            if (!own(value, parts[i])) return undefined;
            value = value[parts[i]];
        }
        return value;
    }

    function clampNumber(value, minimum, maximum, integer) {
        value = Number(value);
        if (!isFinite(value)) return undefined;
        value = Math.max(minimum, Math.min(maximum, value));
        return integer ? Math.round(value) : value;
    }

    function colour(value) {
        if (typeof value === "number" && isFinite(value)) return value >>> 0;
        var text = String(value == null ? "" : value).replace(/^\s+|\s+$/g, "");
        var match = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text);
        if (!match) return undefined;
        var hex = match[1].length === 6 ? "ff" + match[1] : match[1];
        return parseInt(hex, 16) >>> 0;
    }

    function colourText(value) {
        var resolved = colour(value);
        if (resolved === undefined) return "#FF000000";
        var text = (resolved >>> 0).toString(16).toUpperCase();
        return "#" + ("00000000" + text).slice(-8);
    }

    function text(value, maximum) {
        if (value == null) return undefined;
        value = String(value).replace(/[\u0000-\u001f]/g, " ").replace(/^\s+|\s+$/g, "");
        return value ? value.substring(0, maximum || 160) : undefined;
    }

    function optionalText(value, maximum) {
        if (value == null) return undefined;
        value = String(value).replace(/[\u0000-\u001f]/g, " ").replace(/^\s+|\s+$/g, "");
        return value.substring(0, maximum || 160);
    }

    function boolean(value) {
        return typeof value === "boolean" ? value : undefined;
    }

    function choice(value, values) {
        value = String(value == null ? "" : value);
        return values.indexOf(value) >= 0 ? value : undefined;
    }

    function colourType(value) {
        var values = ["Custom", "Dynamic", "Off"];
        if (typeof value === "number" && isFinite(value)) {
            value = Math.round(value);
            return value >= 0 && value < values.length ? values[value] : undefined;
        }
        value = String(value == null ? "" : value).replace(/^\s+|\s+$/g, "").toLowerCase();
        for (var i = 0; i < values.length; i++) {
            if (values[i].toLowerCase() === value) return values[i];
        }
        return undefined;
    }

    var rules = {
        colour: colour,
        colourType: colourType,
        bool: boolean,
        string: function (value) { return text(value, 160); },
        path: function (value) { return optionalText(value, 160); },
        font: function (value) { return text(value, 80); },
        scale: function (value) { return clampNumber(value, 0.5, 2, false); },
        ratio: function (value) { return clampNumber(value, 0.1, 0.9, false); },
        percent: function (value) { return clampNumber(value, 50, 200, true); },
        widthPercent: function (value) { return clampNumber(value, 20, 100, true); },
        pixels: function (value) { return clampNumber(value, 0, 240, true); },
        dimension: function (value) { return clampNumber(value, 0, 1000, true); },
        fontSize: function (value) { return clampNumber(value, 0, 48, true); },
        weight: function (value) { return clampNumber(value, 100, 950, true); },
        roundness: function (value) { return clampNumber(value, -1, 100, true); },
        mode0_1: function (value) { return clampNumber(value, 0, 1, true); },
        mode0_2: function (value) { return clampNumber(value, 0, 2, true); },
        mode0_3: function (value) { return clampNumber(value, 0, 3, true); },
        mode0_4: function (value) { return clampNumber(value, 0, 4, true); },
        mode0_5: function (value) { return clampNumber(value, 0, 5, true); },
        mode0_6: function (value) { return clampNumber(value, 0, 6, true); },
        style1_5: function (value) { return clampNumber(value, 1, 5, true); }
    };

    function add(result, theme, propertyName, themePath, rule, fallbackThemePath) {
        if (captureMappingTarget) captureMappingTarget[themePath] = rule;
        var source = path(theme, themePath);
        if (source === undefined && fallbackThemePath) source = path(theme, fallbackThemePath);
        var value = source === undefined ? undefined : rules[rule](source);
        if (captureTarget) {
            try {
                var missing = "__DARKONEJSP3_THEME_PROPERTY_MISSING__";
                var currentSource = window.GetProperty(
                    propertyName,
                    value === undefined ? missing : value
                );
                var current = currentSource === missing ? undefined : rules[rule](currentSource);
                if (current !== undefined) {
                    captureTarget[themePath] = rule === "colour" ? colourText(current) : current;
                }
            } catch (e) {}
        }
        if (value !== undefined) result[propertyName] = value;
    }

    // The playlist panels expose Dynamic and Custom as independent switches,
    // although the effective modes are mutually exclusive (Dynamic wins when
    // both are enabled). Themes use one deterministic 0/1/2 choice instead:
    // Custom, Dynamic or Off. Capture normalises legacy two-switch states.
    function addColourType(result, theme, dynamicProperty, customProperty,
            themePath, legacyCustomPath) {
        if (captureMappingTarget) captureMappingTarget[themePath] = "colourType";
        var source = path(theme, themePath);
        var value = source === undefined ? undefined : rules.colourType(source);
        if (value === undefined && legacyCustomPath) {
            var legacy = rules.bool(path(theme, legacyCustomPath));
            if (legacy !== undefined) value = legacy ? "Custom" : "Off";
        }
        var dynamicDefault = value === "Dynamic";
        var customDefault = value === "Custom";
        if (captureTarget) {
            try {
                var currentDynamic = window.GetProperty(dynamicProperty, dynamicDefault) === true;
                var currentCustom = window.GetProperty(customProperty, customDefault) === true;
                captureTarget[themePath] = currentDynamic ? "Dynamic" : currentCustom ? "Custom" : "Off";
            } catch (e) {}
        }
        if (value !== undefined) {
            result[dynamicProperty] = value === "Dynamic";
            result[customProperty] = value === "Custom";
        }
    }

    function commonPage(result, theme) {
        add(result, theme, "DARKONEJSP3.PAGE.BACKGROUND.MODE", "appearance.pages.backgroundMode", "mode0_5");
        add(result, theme, "DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR", "appearance.pages.customBackground", "colour");
        add(result, theme, "DARKONEJSP3.PAGE.COLOURS.DYNAMIC.ENABLED", "appearance.pages.dynamicColours", "bool");
        add(result, theme, "DARKONEJSP3.PAGE.TEXT.MODE", "appearance.pages.textMode", "mode0_1");
        add(result, theme, "DARKONEJSP3.PAGE.TEXT.CUSTOM.COLOUR", "appearance.pages.customText", "colour");
        add(result, theme, "DARKONEJSP3.PAGE.WALLPAPER.MODE", "appearance.pages.wallpaperMode", "mode0_2");
        add(result, theme, "DARKONEJSP3.PAGE.WALLPAPER.PATH", "appearance.pages.wallpaperPath", "path");
        add(result, theme, "DARKONEJSP3.PAGE.WALLPAPER.BLURRED", "appearance.pages.wallpaperBlurred", "bool");
    }

    function roleProperties(theme, role) {
        var result = {};
        if (role === "control-left" || role === "control-right") {
            add(result, theme, "DARKONEJSP3.FONT.SCALE", "appearance.typography.controlScale", "scale");
            add(result, theme, "DARKONEJSP3.CONTROL.FONT.NAME", "appearance.typography.controlFamily", "font");
            add(result, theme, "DARKONEJSP3.CONTROL.FONT.WEIGHT", "appearance.typography.controlWeight", "weight");
            add(result, theme, "DARKONEJSP3.BUTTON.HITBOX.SCALE", "appearance.controls.hitboxScale", "scale");
            add(result, theme, "DARKONEJSP3.ICON.SCALE", "appearance.controls.iconScale", "scale");
            add(result, theme, "DARKONEJSP3.BUTTON.ROUNDNESS", "appearance.controls.roundness", "roundness");
            add(result, theme, "Buttons appearance preset", "appearance.controls.buttonStyle", "style1_5");
            add(result, theme, "Buttons depth preset", "appearance.controls.buttonDepth", "mode0_3");
            if (role === "control-right") {
                add(result, theme, "DARKONEJSP3.VOLUME.KNOB.INDICATOR.MODE", "appearance.controls.volumeIndicatorMode", "mode0_1");
                add(result, theme, "DARKONEJSP3.VOLUME.KNOB.INDICATOR.COLOUR", "appearance.palette.volumeIndicator", "colour");
            }
        } else if (role === "display") {
            add(result, theme, "DARKONEJSP3.DISPLAY.FONT.SCALE", "appearance.typography.displayScale", "scale");
            add(result, theme, "DARKONEJSP3.DISPLAY.LABEL.FONT.NAME", "appearance.typography.displayLabelFamily", "font");
            add(result, theme, "DARKONEJSP3.DISPLAY.LABEL.FONT.WEIGHT", "appearance.typography.displayLabelWeight", "weight");
            add(result, theme, "DARKONEJSP3.DISPLAY.LABEL.FONT.SCALE", "appearance.typography.displayLabelScale", "scale");
            add(result, theme, "DARKONEJSP3.DISPLAY.VALUE.FONT.NAME", "appearance.typography.displayValueFamily", "font");
            add(result, theme, "DARKONEJSP3.DISPLAY.VALUE.FONT.WEIGHT", "appearance.typography.displayValueWeight", "weight");
            add(result, theme, "DARKONEJSP3.DISPLAY.VALUE.FONT.SCALE", "appearance.typography.displayValueScale", "scale");
            add(result, theme, "DARKONEJSP3.DISPLAY.ACCENT.MODE", "appearance.display.accentMode", "mode0_2");
            add(result, theme, "DARKONEJSP3.DISPLAY.ACCENT.CUSTOM.COLOUR", "appearance.palette.accent", "colour");
            add(result, theme, "Display Style", "appearance.display.style", "mode0_1");
        } else if (role === "main-columns") {
            add(result, theme, "DARKONEJSP3.ART.SPECTRUM.DIVIDER.MODE", "appearance.layout.dividerMode", "mode0_5");
            add(result, theme, "DARKONEJSP3.ART.SPECTRUM.DIVIDER.CUSTOM.COLOUR", "appearance.palette.divider", "colour");
            add(result, theme, "DARKONEJSP3.MAIN.LAYOUT.MODE", "appearance.layout.mainColumnsMode", "mode0_3");
        } else if (role === "art-spectrum") {
            add(result, theme, "DARKONEJSP3.ARTSPECTRUM.LAYOUT.MODE", "appearance.layout.artSpectrumMode", "mode0_1");
        } else if (role === "bottom-controls") {
            add(result, theme, "DARKONEJSP3.BOTTOM.BACKGROUND.MODE", "appearance.bottomArea.backgroundMode", "mode0_5");
            add(result, theme, "DARKONEJSP3.BOTTOM.BACKGROUND.CUSTOM.COLOUR", "appearance.bottomArea.customBackground", "colour");
            add(result, theme, "DARKONEJSP3.BOTTOM.BACKGROUND.LINEAR.GRADIENT", "appearance.bottomArea.linearGradient", "bool");
            add(result, theme, "DARKONEJSP3.BOTTOM.DIVIDER.MODE", "appearance.bottomArea.dividerMode", "mode0_5");
            add(result, theme, "DARKONEJSP3.BOTTOM.DIVIDER.CUSTOM.COLOUR", "appearance.bottomArea.customDivider", "colour");
            add(result, theme, "DARKONEJSP3.BOTTOM.SIDE.DIVIDERS", "appearance.bottomArea.sideDividers", "bool");
            add(result, theme, "DARKONEJSP3.BOTTOM.DEPTH", "appearance.bottomArea.depth", "mode0_1");
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.LAYOUT.LINES", "appearance.bottomArea.quickSearchLines", "mode0_2");
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.LAYOUT.WIDTH.PERCENT", "appearance.bottomArea.quickSearchWidthPercent", "widthPercent");
        } else if (role === "quick-search") {
            result["DARKONEJSP3.QUICKSEARCH.COLOUR.BACKGROUND.PALETTE.VERSION"] = 1;
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.COLOUR.NORMAL.TEXT.MODE", "appearance.quickSearch.normalTextMode", "mode0_1");
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.COLOUR.NORMAL.TEXT.CUSTOM", "appearance.quickSearch.customText", "colour", "appearance.palette.text");
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.COLOUR.NORMAL.BACKGROUND.MODE", "appearance.quickSearch.normalBackgroundMode", "mode0_5");
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.COLOUR.NORMAL.BACKGROUND.CUSTOM", "appearance.quickSearch.customBackground", "colour", "appearance.bottomArea.customBackground");
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.COLOUR.BORDER.MODE", "appearance.quickSearch.borderMode", "mode0_1");
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.COLOUR.BORDER.CUSTOM", "appearance.quickSearch.customBorder", "colour", "appearance.palette.divider");
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.COLOUR.ERROR.TEXT.MODE", "appearance.quickSearch.errorTextMode", "mode0_1");
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.COLOUR.ERROR.TEXT.CUSTOM", "appearance.quickSearch.customErrorText", "colour");
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.COLOUR.ERROR.BACKGROUND.MODE", "appearance.quickSearch.errorBackgroundMode", "mode0_6");
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.COLOUR.ERROR.BACKGROUND.CUSTOM", "appearance.quickSearch.customErrorBackground", "colour");
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.LAYOUT.LINES", "appearance.bottomArea.quickSearchLines", "mode0_2");
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.LAYOUT.WIDTH.PERCENT", "appearance.bottomArea.quickSearchWidthPercent", "widthPercent");
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.FONT.SIZE", "appearance.quickSearch.fixedFontSize", "fontSize");
            add(result, theme, "DARKONEJSP3.QUICKSEARCH.FONT.AUTO.SCALE", "appearance.quickSearch.automaticFontScale", "percent", "appearance.infoStack.automaticFontScale");
        } else if (role === "info-stack") {
            add(result, theme, "DarkOneJSP3.InfoStack.BackgroundMode", "appearance.infoStack.backgroundMode", "mode0_5");
            add(result, theme, "DarkOneJSP3.InfoStack.BackgroundColour", "appearance.infoStack.customBackground", "colour");
            add(result, theme, "DarkOneJSP3.InfoStack.FontSize", "appearance.infoStack.fixedFontSize", "fontSize");
            add(result, theme, "DarkOneJSP3.InfoStack.AutoFontScale", "appearance.infoStack.automaticFontScale", "percent");
            add(result, theme, "DarkOneJSP3.InfoStack.TabAreaHeight", "appearance.infoStack.tabAreaHeight", "pixels");
            add(result, theme, "DarkOneJSP3.InfoStack.TabStripVisible", "appearance.infoStack.tabStripVisible", "bool");
            add(result, theme, "DarkOneJSP3.InfoStack.TabColourMode", "appearance.infoStack.tabColourMode", "mode0_2");
            add(result, theme, "DarkOneJSP3.InfoStack.TabCustomColour", "appearance.palette.accent", "colour");
            var tabs = ["Playlists", "Biography", "Lastfm", "Allmusic", "Queue", "Properties", "ThemeManager"];
            for (var i = 0; i < tabs.length; i++) {
                add(result, theme, "DarkOneJSP3.InfoStack.Tab." + tabs[i] + ".Visible", "appearance.infoStack.tabs." + tabs[i] + ".visible", "bool");
                add(result, theme, "DarkOneJSP3.InfoStack.Tab." + tabs[i] + ".Label", "appearance.infoStack.tabs." + tabs[i] + ".label", "string");
            }
            var declaredTabs = 0;
            var visibleTabs = 0;
            for (var tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
                var visibleName = "DarkOneJSP3.InfoStack.Tab." + tabs[tabIndex] + ".Visible";
                if (own(result, visibleName)) {
                    declaredTabs++;
                    if (result[visibleName]) visibleTabs++;
                }
            }
            if (declaredTabs === tabs.length && visibleTabs === 0) {
                result["DarkOneJSP3.InfoStack.Tab.Playlists.Visible"] = true;
            }
        } else if (role === "display-waveform") {
            add(result, theme, "DarkOneJSP3.DisplayWaveform.BackgroundMode", "appearance.displayWaveform.backgroundMode", "mode0_6");
            add(result, theme, "DarkOneJSP3.DisplayWaveform.BackgroundColour", "appearance.displayWaveform.customBackground", "colour");
        } else if (role === "lastfm-bio" || role === "lastfm-info" || role === "properties" || role === "album-notes" || role === "allmusic" || role === "queue-viewer") {
            commonPage(result, theme);
            if (role === "queue-viewer") {
                add(result, theme, "DARKONEJSP3.PAGE.SELECTED.BACKGROUND.MODE", "appearance.pages.selectedBackgroundMode", "mode0_2");
                add(result, theme, "DARKONEJSP3.PAGE.SELECTED.BACKGROUND.CUSTOM.COLOUR", "appearance.palette.selected", "colour");
            }
            if (role === "lastfm-bio") {
                add(result, theme, "2K3.LASTFM.BIO.IMAGES.DISPLAY", "appearance.pages.artwork.visible", "bool");
                add(result, theme, "2K3.LASTFM.BIO.IMAGES.BACKGROUND.ENABLED", "appearance.pages.artwork.backgroundEnabled", "bool");
                add(result, theme, "2K3.LASTFM.BIO.IMAGES.BACKGROUND.BLURRED", "appearance.pages.artwork.backgroundBlurred", "bool");
                add(result, theme, "2K3.IMAGES.RATIO", "appearance.pages.artwork.ratio", "ratio");
            }
            if (role === "album-notes" || role === "allmusic") {
                add(result, theme, (role === "allmusic" ? "2K3.ALLMUSIC.ART.DISPLAY" : "2K3.ALBUM.NOTES.ART.DISPLAY"), "appearance.pages.artwork.visible", "bool");
                add(result, theme, (role === "allmusic" ? "2K3.ALLMUSIC.ART.BACKGROUND.ENABLED" : "2K3.ALBUM.NOTES.ART.BACKGROUND.ENABLED"), "appearance.pages.artwork.backgroundEnabled", "bool");
                add(result, theme, (role === "allmusic" ? "2K3.ALLMUSIC.ART.BACKGROUND.BLURRED" : "2K3.ALBUM.NOTES.ART.BACKGROUND.BLURRED"), "appearance.pages.artwork.backgroundBlurred", "bool");
                add(result, theme, "2K3.ARTREADER.RATIO", "appearance.pages.artwork.ratio", "ratio");
            }
        } else if (role === "playlist-manager") {
            addColourType(result, theme,
                "SMOOTH.DYNAMIC.COLOURS.ENABLED", "SMOOTH.CUSTOM.COLOURS.ENABLED",
                "appearance.playlistManager.colourType");
            add(result, theme, "SMOOTH.COLOUR.TEXT", "appearance.playlistManager.text", "colour");
            add(result, theme, "SMOOTH.COLOUR.BACKGROUND.NORMAL", "appearance.playlistManager.background", "colour");
            add(result, theme, "SMOOTH.COLOUR.BACKGROUND.SELECTED", "appearance.playlistManager.selectedBackground", "colour");
            add(result, theme, "SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER", "appearance.playlistManager.showFilter", "bool");
            add(result, theme, "SMOOTH.PLAYLIST.MANAGER.FILTER.WIDTH", "appearance.playlistManager.filterWidth", "dimension");
            add(result, theme, "SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT", "appearance.playlistManager.rowHeight", "dimension");
            add(result, theme, "SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS", "appearance.playlistManager.alternatingRows", "bool");
        } else if (role === "js-playlist") {
            addColourType(result, theme,
                "JSPLAYLIST.Enable Dynamic Colours", "JSPLAYLIST.Enable Custom Colours",
                "appearance.playlist.colourType", "appearance.playlist.customColours");
            add(result, theme, "JSPLAYLIST.COLOUR TEXT NORMAL", "appearance.playlist.text", "colour", "appearance.palette.text");
            add(result, theme, "JSPLAYLIST.COLOUR TEXT HIGHLIGHT", "appearance.playlist.highlight", "colour", "appearance.palette.accent");
            add(result, theme, "JSPLAYLIST.COLOUR BACKGROUND NORMAL", "appearance.playlist.background", "colour", "appearance.palette.pageBackground");
            add(result, theme, "JSPLAYLIST.COLOUR BACKGROUND SELECTED", "appearance.playlist.selectedBackground", "colour", "appearance.palette.selected");
            add(result, theme, "JSPLAYLIST.COLOUR.MOOD", "appearance.playlist.mood", "colour");
            add(result, theme, "JSPLAYLIST.COLOUR.RATING", "appearance.playlist.rating", "colour");
            add(result, theme, "JSPLAYLIST.Show Wallpaper", "appearance.playlist.showWallpaper", "bool");
            add(result, theme, "JSPLAYLIST.Wallpaper Blurred", "appearance.pages.wallpaperBlurred", "bool");
            add(result, theme, "JSPLAYLIST.Default Wallpaper Path", "appearance.pages.wallpaperPath", "path");
        }
        return result;
    }

    function captureIdentifier(value) {
        value = String(value == null ? "" : value);
        return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value) ? value : null;
    }

    function captureMapping(role) {
        role = String(role || "");
        if (!own(captureRoles, role)) return null;
        if (own(captureMappings, role)) return captureMappings[role];
        var mapping = {};
        captureMappingTarget = mapping;
        try { roleProperties({}, role); } finally { captureMappingTarget = null; }
        captureMappings[role] = mapping;
        return mapping;
    }

    function normaliseCaptureValues(role, source) {
        if (!source || typeof source !== "object" || Array.isArray(source)) return null;
        var mapping = captureMapping(role);
        if (!mapping) return null;
        var values = {};
        for (var key in source) {
            if (!own(source, key) || !own(mapping, key)) return null;
            var rule = mapping[key];
            var value = rules[rule](source[key]);
            if (value === undefined) return null;
            values[key] = rule === "colour" ? colourText(value) : value;
        }
        return values;
    }

    function validate(theme) {
        theme = object(theme);
        var errors = [];
        if (theme.format !== DARKONEJSP3_THEME_FORMAT) errors.push("format must be \"" + DARKONEJSP3_THEME_FORMAT + "\"");
        if (Number(theme.formatVersion) !== DARKONEJSP3_THEME_FORMAT_VERSION) errors.push("formatVersion must be " + DARKONEJSP3_THEME_FORMAT_VERSION);
        if (typeof theme.name !== "string" || !theme.name.replace(/^\s+|\s+$/g, "") ||
                theme.name.length > 80 || /[\u0000-\u001f]/.test(theme.name)) {
            errors.push("name must be 1-80 visible characters without control characters");
        }
        if (!own(theme, "appearance") || typeof theme.appearance !== "object" || Array.isArray(theme.appearance)) errors.push("appearance must be an object");
        return { valid: errors.length === 0, errors: errors };
    }

    function parse(value) {
        if (typeof value === "string" && value.length > 262144) {
            throw new Error("theme document exceeds the 256 KiB safety limit");
        }
        var theme = typeof value === "string" ? JSON.parse(value) : value;
        var check = validate(theme);
        if (!check.valid) throw new Error(check.errors.join("; "));
        return theme;
    }

    function stringify(theme) {
        theme = parse(theme);
        return JSON.stringify(theme, null, 2) + "\n";
    }

    function applyDetailed(theme, role) {
        theme = parse(theme);
        var values = roleProperties(theme, role);
        var changedNames = [];
        for (var propertyName in values) {
            if (!own(values, propertyName)) continue;
            try {
                var oldValue = window.GetProperty(propertyName, null);
                if (oldValue !== values[propertyName]) {
                    window.SetProperty(propertyName, values[propertyName]);
                    changedNames.push(propertyName);
                }
            } catch (e) {}
        }
        return {
            changed: changedNames.length > 0,
            names: changedNames
        };
    }

    function apply(theme, role) {
        return applyDetailed(theme, role).changed;
    }

    function capture(theme, role) {
        theme = parse(theme);
        if (!own(captureRoles, String(role || ""))) return {};
        var result = {};
        captureTarget = result;
        try { roleProperties(theme, role); } finally { captureTarget = null; }
        return result;
    }

    function captureQuery(theme, id, issuedAt) {
        id = captureIdentifier(id);
        issuedAt = Math.round(Number(issuedAt));
        if (!id || !isFinite(issuedAt) || issuedAt <= 0) throw new Error("invalid capture request metadata");
        var payload = JSON.stringify({
            version: 1,
            id: id,
            issuedAt: issuedAt,
            theme: parse(theme)
        });
        if (payload.length > 262144) throw new Error("capture request exceeds the 256 KiB safety limit");
        return payload;
    }

    function parseCaptureQuery(value, now) {
        var payload;
        if (typeof value === "string" && value.length > 262144) return null;
        try { payload = typeof value === "string" ? JSON.parse(value) : value; } catch (e) { return null; }
        var id = payload && captureIdentifier(payload.id);
        if (!payload || payload.version !== 1 || !id) return null;
        var issuedAt = Math.round(Number(payload.issuedAt));
        now = Math.round(Number(now));
        if (!isFinite(now)) now = new Date().getTime();
        var age = now - issuedAt;
        if (!isFinite(issuedAt) || issuedAt <= 0 || age < -5000 || age > DARKONEJSP3_THEME_CAPTURE_MAX_AGE) return null;
        try { payload.theme = parse(payload.theme); } catch (e2) { return null; }
        return { id: id, issuedAt: issuedAt, theme: payload.theme };
    }

    function captureResponse(id, role, values) {
        id = captureIdentifier(id);
        role = String(role || "");
        values = normaliseCaptureValues(role, values);
        if (!id || !values) return null;
        var payload = JSON.stringify({ version: 1, id: id, role: role, values: values });
        return payload.length <= 65536 ? payload : null;
    }

    function parseCaptureResponse(value, requestId) {
        var payload;
        if (typeof value === "string" && value.length > 65536) return null;
        try { payload = typeof value === "string" ? JSON.parse(value) : value; } catch (e) { return null; }
        var id = payload && captureIdentifier(payload.id);
        var expectedId = captureIdentifier(requestId);
        var role = payload ? String(payload.role || "") : "";
        if (!payload || payload.version !== 1 || !id || !expectedId || id !== expectedId) return null;
        var values = normaliseCaptureValues(role, payload.values);
        if (!values) return null;
        return { id: id, role: role, values: values };
    }

    function captureBundle(id, issuedAt, responses) {
        id = captureIdentifier(id);
        issuedAt = Math.round(Number(issuedAt));
        if (!id || !isFinite(issuedAt) || issuedAt <= 0 || !responses ||
                typeof responses !== "object" || Array.isArray(responses)) return null;
        var clean = {};
        for (var role in responses) {
            if (!own(responses, role)) continue;
            var values = normaliseCaptureValues(role, responses[role]);
            if (!values) return null;
            clean[role] = values;
        }
        var payload = JSON.stringify({ version: 1, id: id, issuedAt: issuedAt, responses: clean });
        return payload.length <= 262144 ? payload : null;
    }

    function parseCaptureBundle(value, requestId, now) {
        var payload;
        if (typeof value === "string" && value.length > 262144) return null;
        try { payload = typeof value === "string" ? JSON.parse(value) : value; } catch (e) { return null; }
        var id = payload && captureIdentifier(payload.id);
        var expectedId = captureIdentifier(requestId);
        if (!payload || payload.version !== 1 || !id || !expectedId || id !== expectedId ||
                !payload.responses || typeof payload.responses !== "object" ||
                Array.isArray(payload.responses)) return null;
        var issuedAt = Math.round(Number(payload.issuedAt));
        now = Math.round(Number(now));
        if (!isFinite(now)) now = new Date().getTime();
        var age = now - issuedAt;
        if (!isFinite(issuedAt) || issuedAt <= 0 || age < -5000 ||
                age > DARKONEJSP3_THEME_CAPTURE_MAX_AGE) return null;
        var responses = {};
        for (var role in payload.responses) {
            if (!own(payload.responses, role)) continue;
            var values = normaliseCaptureValues(role, payload.responses[role]);
            if (!values) return null;
            responses[role] = values;
        }
        return { id: id, issuedAt: issuedAt, responses: responses };
    }

    function command(theme, id, issuedAt) {
        return JSON.stringify({
            version: 1,
            id: String(id || ""),
            issuedAt: Math.round(Number(issuedAt)),
            theme: parse(theme)
        });
    }

    function parseCommand(value, now) {
        var payload;
        if (typeof value === "string" && value.length > 262144) return null;
        try { payload = typeof value === "string" ? JSON.parse(value) : value; } catch (e) { return null; }
        if (!payload || payload.version !== 1 || !text(payload.id, 120)) return null;
        var issuedAt = Math.round(Number(payload.issuedAt));
        now = Math.round(Number(now));
        if (!isFinite(now)) now = new Date().getTime();
        var age = now - issuedAt;
        if (!isFinite(issuedAt) || issuedAt <= 0 || age < -5000 || age > DARKONEJSP3_THEME_COMMAND_MAX_AGE) return null;
        try { payload.theme = parse(payload.theme); } catch (e2) { return null; }
        return { id: String(payload.id), issuedAt: issuedAt, theme: payload.theme };
    }

    function stage(theme, id, issuedAt, applyAt, bottomState) {
        id = String(id || "");
        issuedAt = Math.round(Number(issuedAt));
        applyAt = Math.round(Number(applyAt));
        if (!/^[A-Za-z0-9._-]{1,128}$/.test(id) ||
                !isFinite(issuedAt) || !isFinite(applyAt) ||
                applyAt < issuedAt ||
                applyAt - issuedAt > DARKONEJSP3_THEME_STAGE_MAX_LEAD) return "";
        return JSON.stringify({
            version: 1,
            id: id,
            issuedAt: issuedAt,
            applyAt: applyAt,
            theme: parse(theme),
            bottomState: bottomState || null
        });
    }

    function parseStage(value, now) {
        var payload;
        if (typeof value === "string" && value.length > 262144) return null;
        try { payload = typeof value === "string" ? JSON.parse(value) : value; } catch (e) { return null; }
        if (!payload || payload.version !== 1 ||
                !/^[A-Za-z0-9._-]{1,128}$/.test(String(payload.id || ""))) return null;
        var issuedAt = Math.round(Number(payload.issuedAt));
        var applyAt = Math.round(Number(payload.applyAt));
        now = Math.round(Number(now));
        if (!isFinite(now)) now = new Date().getTime();
        var age = now - issuedAt;
        if (!isFinite(issuedAt) || !isFinite(applyAt) || issuedAt <= 0 ||
                applyAt < issuedAt || applyAt - issuedAt > DARKONEJSP3_THEME_STAGE_MAX_LEAD ||
                age < -DARKONEJSP3_THEME_STAGE_MAX_AGE ||
                age > DARKONEJSP3_THEME_STAGE_MAX_AGE) return null;
        try { payload.theme = parse(payload.theme); } catch (e2) { return null; }
        var bottomState = null;
        if (payload.bottomState != null) {
            if (typeof DarkOneProtocol !== "undefined")
                bottomState = DarkOneProtocol.bottomArea.parseState(payload.bottomState);
            else if (typeof darkOneBottomAreaParseState === "function")
                bottomState = darkOneBottomAreaParseState(payload.bottomState);
            if (!bottomState || bottomState.revision !== String(payload.id)) return null;
        }
        return {
            id: String(payload.id),
            issuedAt: issuedAt,
            applyAt: applyAt,
            theme: payload.theme,
            bottomState: bottomState
        };
    }

    return {
        apply: apply,
        applyDetailed: applyDetailed,
        capture: capture,
        captureBundle: captureBundle,
        captureQuery: captureQuery,
        captureResponse: captureResponse,
        colour: colour,
        colourText: colourText,
        command: command,
        parse: parse,
        parseCommand: parseCommand,
        parseStage: parseStage,
        parseCaptureBundle: parseCaptureBundle,
        parseCaptureQuery: parseCaptureQuery,
        parseCaptureResponse: parseCaptureResponse,
        roleProperties: roleProperties,
        stage: stage,
        stringify: stringify,
        validate: validate
    };
})();

var darkOneJsp3PendingThemeStage = null;
var darkOneJsp3ThemeStageTimer = 0;
var darkOneJsp3CompletedThemeStageSignature = "";
var darkOneJsp3CompletedThemeStageAt = 0;
var darkOneJsp3ThemePaintPending = null;

function darkOneJsp3ThemeTrace(phase, id, role) {
    try {
        if (window.GetProperty("DARKONEJSP3.THEME.DEBUG.TIMING", false))
            console.log("[Theme timing] " + new Date().getTime() + " " + role + " " + id + " " + phase);
    } catch (e) {}
}

function darkOneJsp3ThemePainted() {
    var pending = darkOneJsp3ThemePaintPending;
    if (!pending) return;
    darkOneJsp3ThemePaintPending = null;
    darkOneJsp3ThemeTrace("paint-callback", pending.id, pending.role);
    try { window.NotifyOthers(DARKONEJSP3_THEME_PAINT_NOTIFICATION,
        JSON.stringify({ id: pending.id, role: pending.role })); } catch (e) {}
}

function darkOneJsp3ThemeHasChanges(detail, prefixes) {
    if (!detail || !detail.names) return true;
    for (var i = 0; i < detail.names.length; i++)
        for (var j = 0; j < prefixes.length; j++)
            if (detail.names[i].indexOf(prefixes[j]) === 0) return true;
    return false;
}

function darkOneJsp3CancelThemeStage() {
    if (darkOneJsp3ThemeStageTimer) {
        try { window.ClearTimeout(darkOneJsp3ThemeStageTimer); } catch (e) {}
    }
    darkOneJsp3ThemeStageTimer = 0;
    darkOneJsp3PendingThemeStage = null;
}

function darkOneJsp3RefreshThemeResult(result, role, refreshChangedTheme) {
    var refreshed = false;
    // Saved Queue Viewer wrappers call the project handler before the sample
    // adapter. Opt them into the shared page refresh without replacing the FCL.
    if (typeof refreshChangedTheme !== "function" && role === "queue-viewer" &&
            typeof _refreshPageTheme === "function" && typeof panel !== "undefined") {
        refreshChangedTheme = function () { return _refreshPageTheme(panel, [role]); };
    }
    if (typeof refreshChangedTheme === "function") {
        try {
            refreshed = refreshChangedTheme(result) === true;
        } catch (refreshError) {
            try {
                console.log("[DarkOneJSP3] In-place theme refresh failed for " +
                    role + ": " + refreshError.message);
            } catch (refreshLogError) {}
        }
    }
    if (!refreshed) {
        try { window.Reload(); } catch (e) { window.Repaint(); }
    }
    return refreshed;
}

function darkOneJsp3CompleteThemeStage(id) {
    var pending = darkOneJsp3PendingThemeStage;
    if (!pending || pending.id !== String(id || "")) return false;
    if (darkOneJsp3ThemeStageTimer) {
        try { window.ClearTimeout(darkOneJsp3ThemeStageTimer); } catch (e) {}
    }
    darkOneJsp3ThemeStageTimer = 0;
    darkOneJsp3PendingThemeStage = null;
    darkOneJsp3CompletedThemeStageSignature = pending.signature;
    darkOneJsp3CompletedThemeStageAt = new Date().getTime();
    darkOneJsp3ThemePaintPending = { id: pending.id, role: pending.role };
    if (pending.result.bottomState && typeof darkOneApplyBottomAreaState === "function")
        darkOneApplyBottomAreaState(pending.result.bottomState, false);
    darkOneJsp3ThemeTrace("commit", pending.id, pending.role);
    darkOneJsp3RefreshThemeResult(pending.result, pending.role, pending.refresh);
    return true;
}

function darkOneJsp3DisposeThemeStage() {
    darkOneJsp3CancelThemeStage();
    darkOneJsp3CompletedThemeStageSignature = "";
    darkOneJsp3CompletedThemeStageAt = 0;
    darkOneJsp3ThemePaintPending = null;
}

function darkOneJsp3ApplyTheme(theme, role) {
    return DarkOneTheme.apply(theme, role);
}

function darkOneJsp3HandleTheme(name, data, role, refreshChangedTheme) {
    role = role || (typeof DARKONEJSP3_RESET_ROLE === "string" ? DARKONEJSP3_RESET_ROLE : "");
    if (name === "DarkOneJSP3.BottomArea.Commit" && darkOneJsp3PendingThemeStage) {
        var commit = typeof DarkOneProtocol !== "undefined" ?
            DarkOneProtocol.bottomArea.parseCommit(data, new Date().getTime()) : null;
        // Older saved control wrappers do not import DarkOneProtocol.
        if (!commit && typeof darkOneBottomAreaParseCommit === "function")
            commit = darkOneBottomAreaParseCommit(data, new Date().getTime());
        if (commit && commit.id === darkOneJsp3PendingThemeStage.id) {
            darkOneJsp3PendingThemeStage.result.bottomState = commit.state;
            if (darkOneJsp3ThemeStageTimer) {
                try { window.ClearTimeout(darkOneJsp3ThemeStageTimer); } catch (e) {}
            }
            var commitDelay = Math.max(0, commit.applyAt - new Date().getTime());
            if (!commitDelay) darkOneJsp3CompleteThemeStage(commit.id);
            else {
                try {
                    darkOneJsp3ThemeStageTimer = window.SetTimeout(function () {
                        darkOneJsp3CompleteThemeStage(commit.id);
                    }, commitDelay);
                } catch (commitTimerError) { darkOneJsp3CompleteThemeStage(commit.id); }
            }
            return true;
        }
    }
    if (name === DARKONEJSP3_THEME_CAPTURE_QUERY_NOTIFICATION) {
        var request = DarkOneTheme.parseCaptureQuery(data, new Date().getTime());
        if (!request) return true;
        if (role) {
            try {
                var values = DarkOneTheme.capture(request.theme, role);
                if (Object.keys(values).length) {
                    var response = DarkOneTheme.captureResponse(request.id, role, values);
                    if (response) window.NotifyOthers(DARKONEJSP3_THEME_CAPTURE_RESPONSE_NOTIFICATION, response);
                }
            } catch (captureError) {}
        }
        return true;
    }
    if (name === DARKONEJSP3_THEME_STAGE_NOTIFICATION) {
        if (!role || typeof refreshChangedTheme !== "function") return true;
        var staged = DarkOneTheme.parseStage(data, new Date().getTime());
        if (!staged) return true;
        try {
            var previousStage = darkOneJsp3PendingThemeStage;
            var stagedResult = DarkOneTheme.applyDetailed(staged.theme, role);
            if (previousStage) {
                for (var n = 0; n < previousStage.result.names.length; n++) {
                    var oldName = previousStage.result.names[n];
                    if (stagedResult.names.indexOf(oldName) < 0) stagedResult.names.push(oldName);
                }
                stagedResult.changed = stagedResult.names.length > 0;
            }
            darkOneJsp3CancelThemeStage();
            stagedResult.bottomState = staged.bottomState;
            if (!stagedResult.changed && !staged.bottomState) return true;
            darkOneJsp3PendingThemeStage = {
                id: staged.id,
                applyAt: staged.applyAt,
                signature: DarkOneTheme.stringify(staged.theme),
                result: stagedResult,
                role: role,
                refresh: refreshChangedTheme
            };
            darkOneJsp3ThemeTrace("prepared-properties", staged.id, role);
            // Coordinated delivery has one commit timer. This later watchdog
            // recovers only when the matching commit notification is lost.
            var stageDelay = Math.max(0, staged.applyAt - new Date().getTime()) +
                (staged.bottomState ? 750 : 0);
            if (stageDelay <= 0) {
                darkOneJsp3CompleteThemeStage(staged.id);
            } else {
                try {
                    darkOneJsp3ThemeStageTimer = window.SetTimeout(function () {
                        darkOneJsp3CompleteThemeStage(staged.id);
                    }, stageDelay);
                } catch (stageTimerError) {
                    darkOneJsp3CompleteThemeStage(staged.id);
                }
            }
        } catch (stageError) {
            darkOneJsp3CancelThemeStage();
            try { console.log("[DarkOneJSP3] Theme stage rejected by " + role + ": " + stageError.message); }
            catch (stageLogError) {}
        }
        return true;
    }
    if (name !== DARKONEJSP3_THEME_NOTIFICATION) return false;
    if (!role) return true;
    try {
        var incomingTheme = DarkOneTheme.parse(data);
        var incomingSignature = DarkOneTheme.stringify(incomingTheme);
        var unrefreshedNames = [];
        if (darkOneJsp3PendingThemeStage) {
            if (darkOneJsp3PendingThemeStage.signature === incomingSignature) {
                darkOneJsp3CompleteThemeStage(darkOneJsp3PendingThemeStage.id);
            } else {
                unrefreshedNames = darkOneJsp3PendingThemeStage.result.names;
                darkOneJsp3CancelThemeStage();
            }
        }
        var result = DarkOneTheme.applyDetailed(incomingTheme, role);
        for (var dirty = 0; dirty < unrefreshedNames.length; dirty++) {
            if (result.names.indexOf(unrefreshedNames[dirty]) < 0)
                result.names.push(unrefreshedNames[dirty]);
        }
        result.changed = result.names.length > 0;
        if (result.changed) {
            darkOneJsp3RefreshThemeResult(result, role, refreshChangedTheme);
        } else {
            var stageAge = new Date().getTime() - darkOneJsp3CompletedThemeStageAt;
            if (incomingSignature === darkOneJsp3CompletedThemeStageSignature &&
                    stageAge >= 0 && stageAge <= 5000) {
                darkOneJsp3CompletedThemeStageSignature = "";
                darkOneJsp3CompletedThemeStageAt = 0;
                return true;
            }
            window.Repaint();
        }
    } catch (error) {
        try { console.log("[DarkOneJSP3] Theme rejected by " + role + ": " + error.message); } catch (e2) {}
    }
    return true;
}
