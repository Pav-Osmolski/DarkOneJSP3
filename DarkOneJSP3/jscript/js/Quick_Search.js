"use strict";

// DarkOneJSP3 scripted replacement for foo_quicksearch.
// Search execution stays inside JScript Panel 3, where the library/playlist
// APIs live. JSplitter is used only to resize the parent-owned panel slot.

var DARKONE_QUICKSEARCH_LAYOUT_COMMAND = fb.ProfilePath + 'js_data\\darkonejsp3.quicksearch-layout-command.txt';
var DARKONE_QUICKSEARCH_LAYOUT_VERSION = 'v3';
var DARKONE_QUICKSEARCH_CONTEXT_FILE = fb.ProfilePath + 'js_data\\darkonejsp3.quicksearch-context-tags.json';
var DARKONE_QUICKSEARCH_IMAGE_FOLDER = fb.ProfilePath + 'DarkOneJSP3\\images\\';
var DARKONE_QUICKSEARCH_CUSTOM_ICON = DARKONE_QUICKSEARCH_IMAGE_FOLDER + 'quicksearch.png';

var QS_SOURCE_LIBRARY = 0;
var QS_SOURCE_PLAYLIST = 1;
var QS_SOURCE_INLINE = 2;
var QS_SOURCE_ALL_PLAYLISTS = 3;

var QS_MATCH_ALL = 0;
var QS_MATCH_ANY = 1;
var QS_MATCH_EXACT = 2;
var QS_MATCH_PREFIX = 3;
var QS_MATCH_EXTENDED = 4;

var QS_RESULT_STANDARD = 0;
var QS_RESULT_NEW_PLAYLIST = 1;
var QS_RESULT_NEW_AUTOPLAYLIST = 2;

var QS_LOCK_ADD = 1;
var QS_LOCK_REMOVE = 2;
var QS_LOCK_REORDER = 4;
var QS_LOCK_REPLACE = 8;
var QS_LOCK_RENAME = 16;
var QS_LOCK_REMOVE_PLAYLIST = 32;
var QS_LOCK_RECOMMENDED = QS_LOCK_ADD | QS_LOCK_REMOVE | QS_LOCK_REORDER | QS_LOCK_REPLACE | QS_LOCK_RENAME;

var QS_FRAME_NONE = 0;
var QS_FRAME_GREY = 1;
var QS_FRAME_SUNKEN = 2;

var QS_COLOUR_DEFAULT = 0;
var QS_COLOUR_CUSTOM = 1;

var QS_DEFAULT_TAGS = [
    { name: 'All', value: '%artist%|%album artist%|%album%|%title%|%genre%|%date%|%composer%', context: false },
    { name: 'Artist', value: '%artist%', context: true },
    { name: 'Album Artist', value: '%album artist%', context: true },
    { name: 'Album', value: '%album%', context: true },
    { name: 'Title', value: '%title%', context: true },
    { name: 'Genre', value: '%genre%', context: true },
    { name: 'Date', value: '%date%', context: true },
    { name: 'Composer', value: '%composer%', context: true }
];

function quickSearchClamp(value, minimum, maximum) {
    value = Number(value);
    if (!isFinite(value)) value = minimum;
    return Math.max(minimum, Math.min(maximum, value));
}

function quickSearchClone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (e) { return value; }
}

function quickSearchParseJson(value, fallback) {
    try {
        var parsed = JSON.parse(String(value || ''));
        return parsed == null ? quickSearchClone(fallback) : parsed;
    } catch (e) {}
    return quickSearchClone(fallback);
}

function quickSearchArray(value) {
    return Object.prototype.toString.call(value) === '[object Array]' ? value : [];
}

function quickSearchNormaliseText(value) {
    return String(value == null ? '' : value).replace(/^\s+|\s+$/g, '');
}

function quickSearchEscapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function quickSearchWildcardRegExp(value) {
    var pattern = quickSearchEscapeRegExp(value)
        .replace(/\\\*/g, '.*')
        .replace(/\\\?/g, '.');
    return new RegExp('^' + pattern + '$', 'i');
}

function quickSearchQuoteQuery(value) {
    return '"' + String(value == null ? '' : value)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"') + '"';
}

function quickSearchTagExpressions(tag) {
    var raw = tag && tag.value != null ? String(tag.value) : '';
    var parts = raw.split('|');
    var result = [];
    for (var i = 0; i < parts.length; i++) {
        var value = quickSearchNormaliseText(parts[i]);
        if (value) result.push(value);
    }
    return result.length ? result : ['%artist%', '%album%', '%title%'];
}

function quickSearchMenuRadio(menu, first, last, selected) {
    try { menu.CheckMenuRadioItem(first, last, selected); } catch (e) {}
}

function quickSearchEnable(flag) {
    return flag ? MF_STRING : MF_GRAYED;
}

function quickSearchNormaliseFontSize(value) {
    value = Math.round(Number(value) || 0);
    return value <= 0 ? 0 : Math.round(quickSearchClamp(value, 8, 48));
}

function quickSearchSafeDispose(value) {
    try { if (value && typeof value.Dispose === 'function') value.Dispose(); } catch (e) {}
}


function quickSearchPublishContextTags(tags) {
    var output = [];
    for (var i = 0; i < tags.length; i++) {
        if (!tags[i] || !tags[i].context) continue;
        output.push({ name: String(tags[i].name || ''), value: String(tags[i].value || '') });
    }
    try { utils.CreateFolder(fb.ProfilePath + 'js_data\\'); } catch (e) {}
    try { utils.WriteTextFile(DARKONE_QUICKSEARCH_CONTEXT_FILE, JSON.stringify(output)); } catch (e2) {}
}

function DarkOneQuickSearch() {
    var self = this;

    this.properties = {
        source: Math.round(quickSearchClamp(window.GetProperty('DARKONEJSP3.QUICKSEARCH.SOURCE', QS_SOURCE_LIBRARY), QS_SOURCE_LIBRARY, QS_SOURCE_ALL_PLAYLISTS)),
        match: Math.round(quickSearchClamp(window.GetProperty('DARKONEJSP3.QUICKSEARCH.MATCH', QS_MATCH_ALL), QS_MATCH_ALL, QS_MATCH_EXTENDED)),
        tagName: String(window.GetProperty('DARKONEJSP3.QUICKSEARCH.TAG', 'All') || 'All'),
        autoSearch: Boolean(window.GetProperty('DARKONEJSP3.QUICKSEARCH.AUTOSEARCH', false)),
        resultMode: Math.round(quickSearchClamp(window.GetProperty('DARKONEJSP3.QUICKSEARCH.RESULT.MODE', QS_RESULT_STANDARD), QS_RESULT_STANDARD, QS_RESULT_NEW_AUTOPLAYLIST)),
        targetPlaylist: String(window.GetProperty('DARKONEJSP3.QUICKSEARCH.TARGET.PLAYLIST', 'Quick Search') || 'Quick Search'),
        newPlaylist: String(window.GetProperty('DARKONEJSP3.QUICKSEARCH.NEW.PLAYLIST', 'Search Results') || 'Search Results'),
        appendQuery: Boolean(window.GetProperty('DARKONEJSP3.QUICKSEARCH.APPEND.QUERY', true)),
        focusResults: Boolean(window.GetProperty('DARKONEJSP3.QUICKSEARCH.FOCUS.RESULTS', true)),
        resetText: Boolean(window.GetProperty('DARKONEJSP3.QUICKSEARCH.RESET.TEXT', false)),
        standardLockMask: Math.round(quickSearchClamp(window.GetProperty('DARKONEJSP3.QUICKSEARCH.RESULT.STANDARD.LOCK.MASK', QS_LOCK_RECOMMENDED), 0, 63)),
        standardLockOwned: Boolean(window.GetProperty('DARKONEJSP3.QUICKSEARCH.RESULT.STANDARD.LOCK.OWNED', false)),
        standardLockTarget: String(window.GetProperty('DARKONEJSP3.QUICKSEARCH.RESULT.STANDARD.LOCK.TARGET', '') || ''),
        standardLockGuid: String(window.GetProperty('DARKONEJSP3.QUICKSEARCH.RESULT.STANDARD.LOCK.GUID', '') || ''),
        removeParentheses: Boolean(window.GetProperty('DARKONEJSP3.QUICKSEARCH.REMOVE.PARENTHESES', true)),
        autoExtended: Boolean(window.GetProperty('DARKONEJSP3.QUICKSEARCH.AUTO.EXTENDED', true)),
        autoDelay: quickSearchClamp(window.GetProperty('DARKONEJSP3.QUICKSEARCH.AUTO.DELAY', 300), 50, 3000),
        autocomplete: Boolean(window.GetProperty('DARKONEJSP3.QUICKSEARCH.AUTOCOMPLETE', true)),
        historySize: Math.round(quickSearchClamp(window.GetProperty('DARKONEJSP3.QUICKSEARCH.HISTORY.SIZE', 20), 0, 100)),
        manageFavorites: Boolean(window.GetProperty('DARKONEJSP3.QUICKSEARCH.MANAGE.FAVORITES', true)),
        frame: Math.round(quickSearchClamp(window.GetProperty('DARKONEJSP3.QUICKSEARCH.FRAME', QS_FRAME_NONE), QS_FRAME_NONE, QS_FRAME_SUNKEN)),
        iconMode: String(window.GetProperty('DARKONEJSP3.QUICKSEARCH.ICON.MODE', 'vector') || 'vector') === 'custom' ? 'custom' : 'vector',
        statusBadge: Boolean(window.GetProperty('DARKONEJSP3.QUICKSEARCH.ICON.STATUS.BADGE', false)),
        showPlaceholder: Boolean(window.GetProperty('DARKONEJSP3.QUICKSEARCH.SHOW.PLACEHOLDER', true)),
        normalTextMode: Math.round(quickSearchClamp(window.GetProperty('DARKONEJSP3.QUICKSEARCH.COLOUR.NORMAL.TEXT.MODE', QS_COLOUR_DEFAULT), QS_COLOUR_DEFAULT, QS_COLOUR_CUSTOM)),
        normalTextCustom: DarkOneColour.opaque(window.GetProperty('DARKONEJSP3.QUICKSEARCH.COLOUR.NORMAL.TEXT.CUSTOM', 0xffdcdcdc)),
        normalBackgroundMode: Math.round(quickSearchClamp(window.GetProperty('DARKONEJSP3.QUICKSEARCH.COLOUR.NORMAL.BACKGROUND.MODE', QS_COLOUR_DEFAULT), QS_COLOUR_DEFAULT, QS_COLOUR_CUSTOM)),
        normalBackgroundCustom: DarkOneColour.opaque(window.GetProperty('DARKONEJSP3.QUICKSEARCH.COLOUR.NORMAL.BACKGROUND.CUSTOM', 0xff1e1e1e)),
        errorTextMode: Math.round(quickSearchClamp(window.GetProperty('DARKONEJSP3.QUICKSEARCH.COLOUR.ERROR.TEXT.MODE', QS_COLOUR_DEFAULT), QS_COLOUR_DEFAULT, QS_COLOUR_CUSTOM)),
        errorTextCustom: DarkOneColour.opaque(window.GetProperty('DARKONEJSP3.QUICKSEARCH.COLOUR.ERROR.TEXT.CUSTOM', 0xffffe1e1)),
        errorBackgroundMode: Math.round(quickSearchClamp(window.GetProperty('DARKONEJSP3.QUICKSEARCH.COLOUR.ERROR.BACKGROUND.MODE', QS_COLOUR_DEFAULT), QS_COLOUR_DEFAULT, QS_COLOUR_CUSTOM)),
        errorBackgroundCustom: DarkOneColour.opaque(window.GetProperty('DARKONEJSP3.QUICKSEARCH.COLOUR.ERROR.BACKGROUND.CUSTOM', 0xff581f1f)),
        lines: Math.round(quickSearchClamp(window.GetProperty('DARKONEJSP3.QUICKSEARCH.LAYOUT.LINES', 2), 0, 2)),
        widthPercent: Math.round(quickSearchClamp(window.GetProperty('DARKONEJSP3.QUICKSEARCH.LAYOUT.WIDTH.PERCENT', 44), 20, 100)),
        fontSize: quickSearchNormaliseFontSize(window.GetProperty('DARKONEJSP3.QUICKSEARCH.FONT.SIZE', 0)),
        autoFontScale: Math.round(quickSearchClamp(window.GetProperty('DARKONEJSP3.QUICKSEARCH.FONT.AUTO.SCALE', 100), 50, 200)),
        tags: quickSearchParseJson(window.GetProperty('DARKONEJSP3.QUICKSEARCH.TAGS', JSON.stringify(QS_DEFAULT_TAGS)), QS_DEFAULT_TAGS),
        history: quickSearchArray(quickSearchParseJson(window.GetProperty('DARKONEJSP3.QUICKSEARCH.HISTORY', '[]'), [])),
        favorites: quickSearchArray(quickSearchParseJson(window.GetProperty('DARKONEJSP3.QUICKSEARCH.FAVORITES', '[]'), []))
    };

    this.previousMatchBeforeExtended = this.properties.match === QS_MATCH_EXTENDED ? QS_MATCH_ALL : this.properties.match;
    this.autoExtendedActive = false;
    this.autoTimer = 0;
    this.icon = null;
    this.iconHover = false;
    this.lastSuccess = true;
    this.lastSearch = null;
    this.lastResultPlaylistIndex = -1;
    this.inlineMatches = [];
    this.inlineCursor = -1;
    this.libraryCacheRevision = 0;
    this.cache = Object.create(null);
    this.w = 0;
    this.h = 0;
    this.iconX = 0;
    this.iconY = 0;
    this.iconW = 0;
    this.inputX = 0;
    this.inputY = 0;
    this.inputW = 0;
    this.inputH = 0;

    this.normaliseTags = function () {
        var seenNames = Object.create(null);
        var seenValues = Object.create(null);
        var cleaned = [];
        if (Object.prototype.toString.call(this.properties.tags) !== '[object Array]') {
            this.properties.tags = quickSearchClone(QS_DEFAULT_TAGS);
        }
        for (var i = 0; i < this.properties.tags.length; i++) {
            var item = this.properties.tags[i] || {};
            var name = quickSearchNormaliseText(item.name);
            var value = quickSearchNormaliseText(item.value);
            var nk = name.toLowerCase();
            var vk = value.toLowerCase();
            if (!name || !value || seenNames[nk] || seenValues[vk]) continue;
            seenNames[nk] = true;
            seenValues[vk] = true;
            cleaned.push({ name: name, value: value, context: Boolean(item.context) });
            if (cleaned.length >= 80) break;
        }
        this.properties.tags = cleaned.length ? cleaned : quickSearchClone(QS_DEFAULT_TAGS);
        if (!this.tagByName(this.properties.tagName)) this.properties.tagName = this.properties.tags[0].name;
        this.saveTags();
    };

    this.tagByName = function (name) {
        name = String(name || '').toLowerCase();
        for (var i = 0; i < this.properties.tags.length; i++) {
            if (String(this.properties.tags[i].name).toLowerCase() === name) return this.properties.tags[i];
        }
        return null;
    };

    this.currentTag = function () {
        return this.tagByName(this.properties.tagName) || this.properties.tags[0];
    };

    this.normaliseSnapshots = function (items, limit) {
        var output = [];
        items = quickSearchArray(items);
        limit = Math.max(0, Math.round(Number(limit) || 0));
        for (var i = 0; i < items.length && output.length < limit; i++) {
            var item = items[i];
            if (!item || typeof item !== 'object') continue;
            var text = quickSearchNormaliseText(item.text);
            if (!text) continue;
            var tag = this.tagByName(item.tagName) || this.currentTag();
            output.push({
                text: text,
                source: Math.round(quickSearchClamp(item.source, QS_SOURCE_LIBRARY, QS_SOURCE_ALL_PLAYLISTS)),
                match: Math.round(quickSearchClamp(item.match, QS_MATCH_ALL, QS_MATCH_EXTENDED)),
                tagName: tag.name,
                at: isFinite(Number(item.at)) ? Number(item.at) : 0
            });
        }
        return output;
    };

    this.save = function (name, value) {
        this.properties[name] = value;
        var keys = {
            source: 'DARKONEJSP3.QUICKSEARCH.SOURCE',
            match: 'DARKONEJSP3.QUICKSEARCH.MATCH',
            tagName: 'DARKONEJSP3.QUICKSEARCH.TAG',
            autoSearch: 'DARKONEJSP3.QUICKSEARCH.AUTOSEARCH',
            resultMode: 'DARKONEJSP3.QUICKSEARCH.RESULT.MODE',
            targetPlaylist: 'DARKONEJSP3.QUICKSEARCH.TARGET.PLAYLIST',
            newPlaylist: 'DARKONEJSP3.QUICKSEARCH.NEW.PLAYLIST',
            appendQuery: 'DARKONEJSP3.QUICKSEARCH.APPEND.QUERY',
            focusResults: 'DARKONEJSP3.QUICKSEARCH.FOCUS.RESULTS',
            resetText: 'DARKONEJSP3.QUICKSEARCH.RESET.TEXT',
            standardLockMask: 'DARKONEJSP3.QUICKSEARCH.RESULT.STANDARD.LOCK.MASK',
            standardLockOwned: 'DARKONEJSP3.QUICKSEARCH.RESULT.STANDARD.LOCK.OWNED',
            standardLockTarget: 'DARKONEJSP3.QUICKSEARCH.RESULT.STANDARD.LOCK.TARGET',
            standardLockGuid: 'DARKONEJSP3.QUICKSEARCH.RESULT.STANDARD.LOCK.GUID',
            removeParentheses: 'DARKONEJSP3.QUICKSEARCH.REMOVE.PARENTHESES',
            autoExtended: 'DARKONEJSP3.QUICKSEARCH.AUTO.EXTENDED',
            autoDelay: 'DARKONEJSP3.QUICKSEARCH.AUTO.DELAY',
            autocomplete: 'DARKONEJSP3.QUICKSEARCH.AUTOCOMPLETE',
            historySize: 'DARKONEJSP3.QUICKSEARCH.HISTORY.SIZE',
            manageFavorites: 'DARKONEJSP3.QUICKSEARCH.MANAGE.FAVORITES',
            frame: 'DARKONEJSP3.QUICKSEARCH.FRAME',
            iconMode: 'DARKONEJSP3.QUICKSEARCH.ICON.MODE',
            statusBadge: 'DARKONEJSP3.QUICKSEARCH.ICON.STATUS.BADGE',
            showPlaceholder: 'DARKONEJSP3.QUICKSEARCH.SHOW.PLACEHOLDER',
            normalTextMode: 'DARKONEJSP3.QUICKSEARCH.COLOUR.NORMAL.TEXT.MODE',
            normalTextCustom: 'DARKONEJSP3.QUICKSEARCH.COLOUR.NORMAL.TEXT.CUSTOM',
            normalBackgroundMode: 'DARKONEJSP3.QUICKSEARCH.COLOUR.NORMAL.BACKGROUND.MODE',
            normalBackgroundCustom: 'DARKONEJSP3.QUICKSEARCH.COLOUR.NORMAL.BACKGROUND.CUSTOM',
            errorTextMode: 'DARKONEJSP3.QUICKSEARCH.COLOUR.ERROR.TEXT.MODE',
            errorTextCustom: 'DARKONEJSP3.QUICKSEARCH.COLOUR.ERROR.TEXT.CUSTOM',
            errorBackgroundMode: 'DARKONEJSP3.QUICKSEARCH.COLOUR.ERROR.BACKGROUND.MODE',
            errorBackgroundCustom: 'DARKONEJSP3.QUICKSEARCH.COLOUR.ERROR.BACKGROUND.CUSTOM',
            lines: 'DARKONEJSP3.QUICKSEARCH.LAYOUT.LINES',
            widthPercent: 'DARKONEJSP3.QUICKSEARCH.LAYOUT.WIDTH.PERCENT',
            fontSize: 'DARKONEJSP3.QUICKSEARCH.FONT.SIZE',
            autoFontScale: 'DARKONEJSP3.QUICKSEARCH.FONT.AUTO.SCALE'
        };
        if (keys[name]) window.SetProperty(keys[name], value);
    };

    this.saveTags = function () {
        window.SetProperty('DARKONEJSP3.QUICKSEARCH.TAGS', JSON.stringify(this.properties.tags));
        quickSearchPublishContextTags(this.properties.tags);
    };

    this.saveHistory = function () {
        window.SetProperty('DARKONEJSP3.QUICKSEARCH.HISTORY', JSON.stringify(this.properties.history));
    };

    this.saveFavorites = function () {
        window.SetProperty('DARKONEJSP3.QUICKSEARCH.FAVORITES', JSON.stringify(this.properties.favorites));
    };

    this.normaliseTags();
    this.properties.history = this.normaliseSnapshots(this.properties.history, this.properties.historySize);
    this.properties.favorites = this.normaliseSnapshots(this.properties.favorites, 32);

    this.customPngExists = function () {
        try { return utils.IsFile(DARKONE_QUICKSEARCH_CUSTOM_ICON); } catch (e) { return false; }
    };

    this.loadIcon = function () {
        quickSearchSafeDispose(this.icon);
        this.icon = null;
        if (this.properties.iconMode !== 'custom' || !this.customPngExists()) return false;
        try {
            var image = utils.LoadImage(DARKONE_QUICKSEARCH_CUSTOM_ICON);
            if (image && Number(image.Width) > 0 && Number(image.Height) > 0) {
                this.icon = image;
                return true;
            }
            quickSearchSafeDispose(image);
        } catch (e) {
            console.log('[DarkOneJSP3 Quick Search] Could not load ' + DARKONE_QUICKSEARCH_CUSTOM_ICON + ': ' + e.message);
        }
        return false;
    };

    this.syncCustomPngState = function () {
        var exists = this.customPngExists();
        if (this.properties.iconMode !== 'custom') return exists;
        if (exists && this.loadIcon()) return true;

        // A previously selected custom icon may have been removed between
        // sessions. Fall back cleanly instead of leaving a stale/empty mode.
        this.save('iconMode', 'vector');
        quickSearchSafeDispose(this.icon);
        this.icon = null;
        return false;
    };

    this.selectCustomPng = function () {
        if (!this.customPngExists()) return false;
        this.save('iconMode', 'custom');
        if (!this.loadIcon()) {
            this.save('iconMode', 'vector');
            utils.ShowPopupMessage(
                'Could not load the Quick Search custom icon.\n\nExpected file:\n' + DARKONE_QUICKSEARCH_CUSTOM_ICON,
                window.Name
            );
            return false;
        }
        window.Repaint();
        return true;
    };

    this.coloursChanged = function () {
        var defaultText = RGB(220, 220, 220);
        var defaultBackground = RGB(30, 30, 30);
        var defaultAccent = RGB(180, 180, 180);
        try {
            defaultText = window.IsDefaultUI ? window.GetColourDUI(0) : window.GetColourCUI(0);
            defaultBackground = window.IsDefaultUI ? window.GetColourDUI(1) : window.GetColourCUI(3);
            defaultAccent = window.IsDefaultUI ? window.GetColourDUI(2) : window.GetColourCUI(0);
        } catch (e) {}
        this.colours = {
            text: this.properties.normalTextMode === QS_COLOUR_CUSTOM ? this.properties.normalTextCustom : defaultText,
            background: this.properties.normalBackgroundMode === QS_COLOUR_CUSTOM ? this.properties.normalBackgroundCustom : defaultBackground,
            accent: defaultAccent,
            errorText: this.properties.errorTextMode === QS_COLOUR_CUSTOM ? this.properties.errorTextCustom : RGB(255, 225, 225),
            errorBackground: this.properties.errorBackgroundMode === QS_COLOUR_CUSTOM ? this.properties.errorBackgroundCustom : RGB(88, 31, 31)
        };
        this.applyInputColours();
    };

    this.measureTextLineHeight = function (font) {
        var fallback = this.fontSizePixels() + 4;
        var layout = null;
        try {
            var parsed = JSON.parse(String(font || ''));
            layout = utils.CreateTextLayout(
                'Mg',
                String(parsed.Name || 'Segoe UI'),
                Number(parsed.Size) || 12,
                Number(parsed.Weight) || 400,
                Number(parsed.Style) || 0,
                Number(parsed.Stretch) || 5
            );
            var measured = Math.ceil(layout.CalcTextHeight(4096));
            if (isFinite(measured) && measured > 0) return measured;
        } catch (e) {} finally {
            quickSearchSafeDispose(layout);
        }
        return Math.max(8, Math.round(fallback));
    };

    this.fontChanged = function () {
        var font = null;
        try { font = window.IsDefaultUI ? window.GetFontDUI(0) : window.GetFontCUI(0); } catch (e) {}
        if (!font) font = JSON.stringify({ Name: 'Segoe UI', Size: 12, Weight: 400, Style: 0, Stretch: 5 });
        g_font_12 = font;
        this.baseFont = font;
        this.baseFontSize = this.fontSizeFrom(font);
        this.size(this.w, this.h);
        // The parent JSplitter owns the child slot. Republish the desired line
        // height whenever the Columns UI/JSP3 font changes so the fixed-height
        // modes retain enough preferred room for the configured base font.
        if (typeof this.layoutCommand === 'function') this.layoutCommand();
    };

    this.fontSizeFrom = function (font) {
        try {
            var parsed = JSON.parse(String(font || ''));
            var size = Math.round(Number(parsed.Size));
            if (isFinite(size) && size > 0) return size;
        } catch (e) {}
        return 12;
    };

    this.fontSizePixels = function () {
        return this.fontSizeFrom(this.font || g_font_12);
    };

    this.controlFontScale = function () {
        var value = Number(window.GetProperty('DARKONEJSP3.FONT.SCALE', 1.0));
        if (!isFinite(value)) value = 1.0;
        return quickSearchClamp(value, 0.75, 1.75);
    };

    this.inferredRootWidth = function () {
        // BottomControls gives Quick Search a percentage of its 5/16 centre
        // column. Reconstructing the root width lets the text follow the same
        // responsive-width principle as the InfoStack and control panels while
        // remaining independent of the user's chosen Quick Search width.
        var percent = quickSearchClamp(this.properties.widthPercent, 20, 100);
        var outerWidth = Math.max(1, this.w + 4);
        return outerWidth * 16 * 100 / (5 * percent);
    };

    this.buildResponsiveFont = function (size) {
        var parsed = null;
        try { parsed = JSON.parse(String(this.baseFont || '')); } catch (e) {}
        parsed = parsed || { Name: 'Segoe UI', Size: 12, Weight: 400, Style: 0, Stretch: 5 };
        return JSON.stringify({
            Name: String(parsed.Name || 'Segoe UI'),
            Size: Math.max(1, Math.round(size)),
            Weight: Number(parsed.Weight) || 400,
            Style: Number(parsed.Style) || 0,
            Stretch: Number(parsed.Stretch) || 5
        });
    };

    this.automaticFontScale = function () {
        return Math.round(quickSearchClamp(Number(this.properties.autoFontScale) || 100, 50, 200));
    };

    this.automaticFontSize = function () {
        var base = Math.max(8, Number(this.baseFontSize) || 12);
        var rootWidth = this.inferredRootWidth();
        // 1280 px is the neutral DarkOne layout width. Width changes scale the
        // font smoothly; the independent automatic base scale mirrors the
        // InfoStack control and lets users tune that responsive calculation.
        var widthScale = quickSearchClamp(rootWidth / 1280, 0.70, 1.50);
        var autoScale = this.automaticFontScale() / 100;
        return Math.round(quickSearchClamp(base * widthScale * this.controlFontScale() * autoScale, 8, 48));
    };

    this.responsiveFontSize = function () {
        var configured = Math.round(Number(this.properties.fontSize) || 0);
        if (configured > 0) return Math.round(quickSearchClamp(configured, 8, 48));
        return this.automaticFontSize();
    };

    this.rebuildResponsiveFont = function () {
        var size = this.responsiveFontSize();
        var maximumTextHeight = Math.max(8, this.h - 14);
        var font = this.buildResponsiveFont(size);
        var measured = this.measureTextLineHeight(font);
        while (size > 8 && measured > maximumTextHeight) {
            size--;
            font = this.buildResponsiveFont(size);
            measured = this.measureTextLineHeight(font);
        }
        this.font = font;
        g_font_12 = font;
        this.textLineHeight = Math.max(8, measured);
    };

    this.layoutLinePixels = function () {
        // The parent uses an uncompressed line unit as the preferred fixed-height
        // target. Fixed font sizing is independent of the automatic base scale;
        // actual available height remains authoritative and may still compress it.
        var configured = Math.round(Number(this.properties.fontSize) || 0);
        var base = configured > 0
            ? quickSearchClamp(configured, 8, 48)
            : quickSearchClamp((Number(this.baseFontSize) || 12) * this.controlFontScale() * this.automaticFontScale() / 100, 8, 48);
        return Math.round(quickSearchClamp(base + 10, 24, 58));
    };

    this.applyInputColours = function () {
        if (!this.input || !this.colours) return;
        this.input.textcolor = this.lastSuccess ? this.colours.text : this.colours.errorText;
        this.input.backcolor = this.lastSuccess ? this.colours.background : this.colours.errorBackground;
        this.input.bordercolor = 0;
        this.input.backselectioncolor = setAlpha(this.colours.accent, 130);
    };

    this.input = new oInputbox(100, 20, '', this.properties.showPlaceholder ? 'Search...' : '', 'quickSearchInputCommit()');

    this.syncPlaceholder = function () {
        if (!this.input) return;
        this.input.empty_text = this.properties.showPlaceholder ? 'Search...' : '';
    };

    // oInputbox is designed for compact single-line sample controls. Quick
    // Search can deliberately occupy a taller responsive panel slot while the
    // editable text remains one line, so keep caret and selection geometry
    // tied to the measured font line height rather than the control height.
    this.input.quickSearchTextBand = function () {
        var maximum = Math.max(1, this.h - 6);
        var height = Math.max(8, Math.min(maximum, Math.round(self.textLineHeight || self.fontSizePixels() + 4)));
        return {
            y: this.y + Math.floor((this.h - height) / 2),
            h: height
        };
    };

    this.input.drawcursor = function (gr) {
        if (!cInputbox.cursor_state || this.Cpos < this.offset) return;
        this.Cx = this.GetCx(this.Cpos);
        var band = this.quickSearchTextBand();
        var x = this.x + this.Cx;
        gr.DrawLine(x, band.y, x, band.y + band.h - 1, 1, this.textcolor);
    };

    this.input.draw = function (gr, x, y) {
        this.x = x;
        this.y = y;

        if (this.bordercolor) {
            gr.DrawRectangle(x - 2, y, (this.w + 4) - 1, this.h - 1, 1, this.bordercolor);
        }
        gr.FillRectangle(x - 1, y + 1, this.w + 2, this.h - 2, this.backcolor);

        if (!this.drag && !this.select) {
            this.Cx = this.text.substr(this.offset, this.Cpos - this.offset).calc_width2(g_font_12);
            while (this.Cx >= this.w - this.right_margin && this.offset < this.Cpos) {
                this.offset++;
                this.Cx = this.text.substr(this.offset, this.Cpos - this.offset).calc_width2(g_font_12);
            }
        }

        if (this.SelBegin !== this.SelEnd) {
            this.select = true;
            this.CalcText();
            var begin = Math.min(this.SelBegin, this.SelEnd);
            var end = Math.max(this.SelBegin, this.SelEnd);
            var px1 = begin < this.offset ? 0 : this.GetCx(begin);
            var px2 = end < this.offset ? 0 : this.GetCx(end);
            px1 = Math.max(0, Math.min(this.w, px1));
            px2 = Math.max(0, Math.min(this.w, px2));
            this.text_selected = this.text.substring(begin, end);
            if (px2 > px1) {
                var band = this.quickSearchTextBand();
                gr.FillRectangle(this.x + px1, band.y, px2 - px1, band.h, this.backselectioncolor & 0xaaffffff);
            }
        } else {
            this.select = false;
            this.text_selected = '';
        }

        if (this.text.length > 0) {
            gr.WriteTextSimple(this.text.substr(this.offset), g_font_12, this.edit ? this.textcolor : blendColours(this.textcolor, this.backcolor, 0.5), this.x, this.y, this.w, this.h, 0, 2, this.edit ? 0 : 1);
        } else {
            gr.WriteTextSimple(this.empty_text, g_font_12, blendColours(this.textcolor, this.backcolor, 0.5), this.x, this.y, this.w, this.h, 0, 2, this.edit ? 0 : 1);
        }

        if (this.edit && !this.select) this.drawcursor(gr);
    };

    // Repaint a small margin around the input so a 1 px caret drawn exactly on
    // the text edge can never survive an otherwise-correct focus repaint.
    this.input.repaint = function () {
        var left = Math.max(0, Math.floor(this.x) - 3);
        var top = Math.max(0, Math.floor(this.y) - 2);
        var right = Math.min(window.Width, Math.ceil(this.x + this.w) + 4);
        var bottom = Math.min(window.Height, Math.ceil(this.y + this.h) + 2);
        window.RepaintRect(left, top, Math.max(1, right - left), Math.max(1, bottom - top));
    };

    // The stock helper treats an empty edit as "restore default_text" when it
    // loses focus. That makes deleted search text reappear. A search field must
    // allow a genuinely empty committed value, so commit the current text as-is
    // (including empty) and keep default_text only as the Escape rollback value.
    this.input.on_focus = function (is_focused) {
        if (!is_focused) {
            var wasEditing = this.edit;
            if (wasEditing) {
                this.default_text = this.text;
                this.Cpos = Math.max(0, Math.min(this.text.length, this.Cpos));
                if (this.func) eval(this.func);
            }
            this.SelBegin = this.Cpos;
            this.SelEnd = this.Cpos;
            this.select = false;
            this.text_selected = '';
            this.drag = false;
            this.edit = false;
            if (cInputbox.cursor_interval) {
                window.ClearInterval(cInputbox.cursor_interval);
                cInputbox.cursor_interval = false;
            }
            cInputbox.cursor_state = false;
            // Focus loss is rare. Repaint the complete panel once so no caret
            // pixel can be stranded by host clipping/rounding at the field edge.
            window.Repaint();
        } else {
            cInputbox.cursor_state = true;
            if (!cInputbox.cursor_interval) this.resetCursorTimer();
            this.repaint();
        }
    };
    this.input.edit = false;
    this.input.default_text = '';
    this.input.text = '';
    this.input.Cpos = 0;
    this.input.SelBegin = 0;
    this.input.SelEnd = 0;

    this.layoutCommand = function () {
        var data = DARKONE_QUICKSEARCH_LAYOUT_VERSION + '|' +
            String(new Date().getTime()) + '-' + String(Math.floor(Math.random() * 1000000)) + '|' +
            String(this.properties.lines) + '|' + String(this.properties.widthPercent) + '|' +
            String(this.layoutLinePixels());
        try { utils.CreateFolder(fb.ProfilePath + 'js_data\\'); } catch (e) {}
        try { utils.WriteTextFile(DARKONE_QUICKSEARCH_LAYOUT_COMMAND, data); } catch (e2) {
            console.log('[DarkOneJSP3 Quick Search] Could not publish layout command: ' + e2.message);
        }
    };

    this.setLines = function (value) {
        value = Math.round(quickSearchClamp(value, 0, 2));
        if (value === this.properties.lines) return;
        this.save('lines', value);
        this.layoutCommand();
    };

    this.setWidthPercent = function (value) {
        value = Math.round(quickSearchClamp(value, 20, 100));
        if (value === this.properties.widthPercent) return;
        this.save('widthPercent', value);
        this.layoutCommand();
    };

    this.size = function (w, h) {
        this.w = Math.max(1, Number(w) || 1);
        this.h = Math.max(1, Number(h) || 1);

        // Treat the JSP3 child rectangle as a real content box. The JSplitter
        // host supplies the outer DarkOne frame. Insets also contract slightly
        // when the host is vertically compressed so fixed modes remain usable.
        var padX = Math.max(2, Math.min(4, Math.floor(this.w / 80)));
        var padY = Math.max(2, Math.min(4, Math.floor(this.h / 8)));
        var innerH = Math.max(1, this.h - padY * 2);

        this.rebuildResponsiveFont();

        // Keep the built-in/search PNG icon visually balanced and never larger
        // than the actual inner height, even at extremely small window sizes.
        var iconCell = Math.round(innerH * 0.82);
        iconCell = Math.max(1, Math.min(innerH, 36, Math.max(8, iconCell)));

        this.iconX = padX;
        this.iconY = Math.floor((this.h - iconCell) / 2);
        this.iconW = iconCell;

        this.statusW = 0;
        this.statusX = 0;
        this.statusY = 0;
        this.statusH = 0;
        if (this.properties.statusBadge) {
            // Compute the label locally because size() is also called during
            // constructor initialisation before statusLabel() is attached.
            var statusLabel = ['LIB', 'PL', 'IN', 'ALL'][this.properties.source] || 'LIB';
            if (this.properties.autoSearch) statusLabel += '·A';
            else if (this.properties.resultMode === QS_RESULT_NEW_AUTOPLAYLIST) statusLabel += '·AP';
            else if (this.properties.resultMode === QS_RESULT_NEW_PLAYLIST) statusLabel += '·N';
            this.statusW = Math.max(28, Math.min(56, statusLabel.calc_width2(g_font_12) + 8));
            this.statusH = Math.max(12, Math.min(innerH, this.fontSizePixels() + 4));
            this.statusX = Math.max(padX, this.w - padX - this.statusW);
            this.statusY = Math.floor((this.h - this.statusH) / 2);
        }

        this.inputX = Math.min(this.w - 1, this.iconX + iconCell + padX);
        this.inputY = padY;
        var inputRight = this.properties.statusBadge ? this.statusX - padX : this.w - padX;
        this.inputW = Math.max(1, inputRight - this.inputX);
        this.inputH = Math.max(1, this.h - padY * 2);
        this.input.w = this.inputW;
        this.input.h = this.inputH;
        this.applyInputColours();
        window.Repaint();
    };

    this.coloursChanged();
    this.fontChanged();
    this.syncCustomPngState();

    this.drawVectorIcon = function (gr, x, y, w, h, colour) {
        var extent = Math.max(1, Math.min(w, h));
        var radius = Math.max(3, extent * 0.24);
        var centreX = x + extent * 0.40;
        var centreY = y + extent * 0.40;
        var thickness = Math.max(1, extent * 0.085);

        // JSP3 DrawEllipse uses centre/radius coordinates, not an x/y/w/h
        // bounding rectangle. Keep the circle and handle wholly inside the
        // icon cell so the one-line layout remains crisp rather than clipped.
        gr.DrawEllipse(centreX, centreY, radius, radius, thickness, colour);
        var tangent = radius * 0.70;
        var startX = centreX + tangent;
        var startY = centreY + tangent;
        var endX = x + extent * 0.82;
        var endY = y + extent * 0.82;
        gr.DrawLine(startX, startY, endX, endY, thickness, colour);
    };

    this.drawCustomIcon = function (gr, x, y, w, h) {
        if (!this.icon) return false;
        var imageW = Number(this.icon.Width);
        var imageH = Number(this.icon.Height);
        if (!(imageW > 0) || !(imageH > 0)) return false;
        var availW = Math.max(1, Math.round(w * 0.90));
        var availH = Math.max(1, Math.round(h * 0.90));
        var scale = Math.min(availW / imageW, availH / imageH);
        var dw = Math.max(1, Math.round(imageW * scale));
        var dh = Math.max(1, Math.round(imageH * scale));
        var dx = Math.round(x + (w - dw) / 2);
        var dy = Math.round(y + (h - dh) / 2);
        gr.DrawImage(this.icon, dx, dy, dw, dh, 0, 0, imageW, imageH);
        return true;
    };

    this.statusLabel = function () {
        var source = ['LIB', 'PL', 'IN', 'ALL'][this.properties.source] || 'LIB';
        if (this.properties.autoSearch) return source + '·A';
        if (this.properties.resultMode === QS_RESULT_NEW_AUTOPLAYLIST) return source + '·AP';
        if (this.properties.resultMode === QS_RESULT_NEW_PLAYLIST) return source + '·N';
        return source;
    };

    this.autocompleteText = function () {
        if (!this.properties.autocomplete) return '';
        var text = this.input.text;
        if (!text || this.input.Cpos !== text.length) return '';
        var lower = text.toLowerCase();
        for (var i = 0; i < this.properties.history.length; i++) {
            var candidate = String(this.properties.history[i].text || '');
            if (candidate.length > text.length && candidate.toLowerCase().indexOf(lower) === 0) return candidate;
        }
        return '';
    };

    this.paint = function (gr) {
        // The icon, spacing and optional status area are part of the same
        // Quick Search control as the text field. Paint the complete JSP3
        // surface with the configured Normal background first so there is no
        // visually separate icon cell. The input box can still paint its Error
        // background over its own rectangle after a failed search.
        gr.FillRectangle(0, 0, this.w, this.h, this.colours.background);

        if (this.properties.frame === QS_FRAME_GREY) {
            gr.DrawRectangle(0, 0, this.w - 1, this.h - 1, 1, RGB(105, 105, 105));
        } else if (this.properties.frame === QS_FRAME_SUNKEN) {
            gr.DrawRectangle(0, 0, this.w - 1, this.h - 1, 1, RGB(72, 72, 72));
            if (this.w > 2 && this.h > 2) gr.DrawRectangle(1, 1, this.w - 3, this.h - 3, 1, RGB(20, 20, 20));
        }

        var iconColour = this.iconHover ? RGB(235, 235, 235) : RGB(165, 165, 165);
        if (!this.drawCustomIcon(gr, this.iconX, this.iconY, this.iconW, this.iconW)) {
            this.drawVectorIcon(gr, this.iconX, this.iconY, this.iconW, this.iconW, iconColour);
        }

        this.input.draw(gr, this.inputX, this.inputY);

        var completion = this.autocompleteText();
        if (completion && this.input.offset === 0) {
            var typed = this.input.text;
            var typedWidth = typed.calc_width2(g_font_12);
            var suffix = completion.substring(typed.length);
            if (typedWidth < this.inputW - 6) {
                gr.WriteTextSimple(
                    suffix,
                    g_font_12,
                    blendColours(this.colours.text, this.colours.background, 0.65),
                    this.inputX + typedWidth,
                    this.inputY,
                    Math.max(1, this.inputW - typedWidth),
                    this.inputH,
                    0,
                    2,
                    0
                );
            }
        }

        if (this.properties.statusBadge && this.statusW > 0) {
            // Keep the optional mode indicator in its own right-hand slot. It
            // must never mask the magnifier/custom PNG (the old overlay caused
            // the one-line icon to appear as a clipped crescent).
            gr.WriteTextSimple(
                this.statusLabel(),
                g_font_12,
                iconColour,
                this.statusX,
                this.statusY,
                this.statusW,
                this.statusH,
                1,
                2,
                1
            );
        }
    };

    this.historyMarker = function (source) {
        if (source === QS_SOURCE_PLAYLIST) return ' [P]';
        if (source === QS_SOURCE_INLINE) return ' [I]';
        if (source === QS_SOURCE_ALL_PLAYLISTS) return ' [A]';
        return '';
    };

    this.playlistIndexByName = function (name) {
        name = String(name || '');
        for (var i = 0; i < plman.PlaylistCount; i++) {
            try { if (plman.GetPlaylistName(i) === name) return i; } catch (e) {}
        }
        return -1;
    };

    this.sourceHandles = function (source, targetIndex) {
        if (source === QS_SOURCE_LIBRARY) return fb.GetLibraryItems();
        if (source === QS_SOURCE_PLAYLIST || source === QS_SOURCE_INLINE) {
            if (plman.ActivePlaylist < 0 || plman.ActivePlaylist >= plman.PlaylistCount) return fb.CreateHandleList();
            return plman.GetPlaylistItems(plman.ActivePlaylist);
        }
        var result = fb.CreateHandleList();
        for (var i = 0; i < plman.PlaylistCount; i++) {
            if (i === targetIndex) continue;
            var list = null;
            try {
                list = plman.GetPlaylistItems(i);
                for (var j = 0; j < list.Count; j++) result.AddItem(list.GetItem(j));
            } catch (e) {
            } finally {
                quickSearchSafeDispose(list);
            }
        }
        return result;
    };

    this.evaluateFields = function (handles, tag, sourceKey) {
        var expressions = quickSearchTagExpressions(tag);
        var key = sourceKey + '|' + this.libraryCacheRevision + '|' + expressions.join('|');
        if (sourceKey === 'library' && this.cache[key]) return this.cache[key];
        var columns = [];
        for (var i = 0; i < expressions.length; i++) {
            var values = [];
            try { values = fb.TitleFormat(expressions[i]).EvalWithMetadbs(handles).toArray(); } catch (e) {}
            columns.push(values);
        }
        if (sourceKey === 'library') this.cache[key] = columns;
        return columns;
    };

    this.basicFilter = function (handles, text, tag, match, sourceKey) {
        var results = fb.CreateHandleList();
        var fields = this.evaluateFields(handles, tag, sourceKey);
        var query = quickSearchNormaliseText(text).toLowerCase();
        var words = query.split(/\s+/).filter(function (item) { return item.length > 0; });
        var wildcard = match === QS_MATCH_EXACT ? quickSearchWildcardRegExp(text) : null;

        for (var row = 0; row < handles.Count; row++) {
            var rowFields = [];
            for (var col = 0; col < fields.length; col++) rowFields.push(String(fields[col][row] || ''));
            var matchRow = false;

            if (match === QS_MATCH_EXACT) {
                for (var e = 0; e < rowFields.length; e++) {
                    if (wildcard.test(rowFields[e])) { matchRow = true; break; }
                }
            } else if (match === QS_MATCH_PREFIX) {
                for (var p = 0; p < rowFields.length; p++) {
                    if (rowFields[p].toLowerCase().indexOf(query) === 0) { matchRow = true; break; }
                }
            } else {
                var haystack = rowFields.join('\u001f').toLowerCase();
                if (match === QS_MATCH_ANY) {
                    for (var a = 0; a < words.length; a++) {
                        if (haystack.indexOf(words[a]) !== -1) { matchRow = true; break; }
                    }
                } else {
                    matchRow = words.length > 0;
                    for (var m = 0; m < words.length; m++) {
                        if (haystack.indexOf(words[m]) === -1) { matchRow = false; break; }
                    }
                }
            }
            if (matchRow) results.AddItem(handles.GetItem(row));
        }
        return results;
    };

    this.queryFilter = function (handles, text) {
        try { return handles.GetQueryItems(text); } catch (e) {
            console.log('[DarkOneJSP3 Quick Search] Query error: ' + e.message);
            return null;
        }
    };

    this.searchHandles = function (source, text, tag, match, targetIndex) {
        var sourceList = this.sourceHandles(source, targetIndex);
        var result = null;
        try {
            if (match === QS_MATCH_EXTENDED) result = this.queryFilter(sourceList, text);
            else result = this.basicFilter(sourceList, text, tag, match, source === QS_SOURCE_LIBRARY ? 'library' : 'dynamic');
        } finally {
            if (result !== sourceList) quickSearchSafeDispose(sourceList);
        }
        return result;
    };

    this.standardPlaylistIndex = function () {
        return this.playlistIndexByName(this.properties.targetPlaylist);
    };

    this.clearStandardLockOwnership = function () {
        if (this.properties.standardLockOwned) this.save('standardLockOwned', false);
        if (this.properties.standardLockTarget) this.save('standardLockTarget', '');
        if (this.properties.standardLockGuid) this.save('standardLockGuid', '');
    };

    this.standardPlaylistGuid = function (index) {
        try { return String(plman.GetGUID(index) || ''); } catch (e) { return ''; }
    };

    this.ownedStandardPlaylistIndex = function () {
        if (!this.properties.standardLockOwned) return -1;
        if (this.properties.standardLockGuid) {
            try { return plman.FindByGUID(this.properties.standardLockGuid); } catch (e) { return -1; }
        }
        return this.playlistIndexByName(this.properties.standardLockTarget || this.properties.targetPlaylist);
    };

    this.standardPlaylistLockOwnedByQuickSearch = function (index) {
        if (!this.properties.standardLockOwned || index < 0 || index >= plman.PlaylistCount) return false;
        try {
            var name = plman.GetPlaylistName(index);
            var guid = this.standardPlaylistGuid(index);
            if (!plman.IsPlaylistLocked(index) || plman.GetPlaylistLockName(index) !== 'JScript Panel 3') return false;

            if (this.properties.standardLockGuid) {
                var expectedGuidMask = Math.round(quickSearchClamp(this.properties.standardLockMask, 0, 63));
                if (!guid || guid !== this.properties.standardLockGuid || !expectedGuidMask ||
                        plman.GetPlaylistLockFilterMask(index) !== expectedGuidMask) return false;
                if (name !== this.properties.standardLockTarget) this.save('standardLockTarget', name);
                return true;
            }

            // Early v0.1.14 development builds stored only the component-level ownership
            // boolean/name. Migrate once, but only when the current configured
            // target and mask still match; this avoids claiming an unrelated
            // JScript Panel 3 lock merely because the component owner string is
            // identical. Future ownership decisions use the persistent GUID.
            var expectedName = this.properties.standardLockTarget || this.properties.targetPlaylist;
            var expectedMask = Math.round(quickSearchClamp(this.properties.standardLockMask, 0, 63));
            if (!guid || name !== expectedName || !expectedMask ||
                    plman.GetPlaylistLockFilterMask(index) !== expectedMask) {
                this.clearStandardLockOwnership();
                return false;
            }
            this.save('standardLockTarget', name);
            this.save('standardLockGuid', guid);
            return true;
        } catch (e) {
            return false;
        }
    };

    this.releaseStandardPlaylistLock = function (index) {
        if (!this.standardPlaylistLockOwnedByQuickSearch(index)) return false;
        try {
            var removed = Boolean(plman.RemovePlaylistLock(index));
            if (removed) this.clearStandardLockOwnership();
            return removed;
        } catch (e) {
            console.log('[DarkOneJSP3 Quick Search] Could not temporarily release Standard results playlist lock: ' + e.message);
            return false;
        }
    };

    this.releaseOwnedStandardLockForTarget = function (targetName) {
        targetName = String(targetName || '');
        if (!this.properties.standardLockOwned) return false;
        if (!this.properties.standardLockGuid && this.properties.standardLockTarget &&
                targetName && this.properties.standardLockTarget !== targetName) return false;
        var index = this.ownedStandardPlaylistIndex();
        if (index < 0) {
            this.clearStandardLockOwnership();
            return false;
        }
        return this.releaseStandardPlaylistLock(index);
    };

    this.applyStandardPlaylistLock = function (index) {
        if (index < 0 || index >= plman.PlaylistCount) return false;
        var mask = Math.round(quickSearchClamp(this.properties.standardLockMask, 0, 63));
        try {
            var previousOwnedIndex = this.ownedStandardPlaylistIndex();
            if (previousOwnedIndex >= 0 && previousOwnedIndex !== index) {
                this.releaseStandardPlaylistLock(previousOwnedIndex);
            } else if (previousOwnedIndex < 0 && this.properties.standardLockOwned) {
                this.clearStandardLockOwnership();
            }
            if (plman.IsPlaylistLocked(index)) {
                if (!this.standardPlaylistLockOwnedByQuickSearch(index)) {
                    console.log('[DarkOneJSP3 Quick Search] Standard results playlist already has a lock not owned by this Quick Search instance; leaving it unchanged.');
                    this.clearStandardLockOwnership();
                    return false;
                }
                var currentMask = plman.GetPlaylistLockFilterMask(index);
                if (currentMask === mask && mask !== 0) return true;
                if (!plman.RemovePlaylistLock(index)) return false;
                this.clearStandardLockOwnership();
            }
            if (!mask) {
                this.clearStandardLockOwnership();
                return true;
            }
            var added = Boolean(plman.AddPlaylistLock(index, mask));
            if (added) {
                this.save('standardLockOwned', true);
                this.save('standardLockTarget', plman.GetPlaylistName(index));
                this.save('standardLockGuid', this.standardPlaylistGuid(index));
            }
            return added;
        } catch (e) {
            console.log('[DarkOneJSP3 Quick Search] Could not apply Standard results playlist lock: ' + e.message);
            return false;
        }
    };

    this.syncStandardPlaylistLock = function () {
        var index = this.standardPlaylistIndex();
        if (index >= 0) this.applyStandardPlaylistLock(index);
        else if (this.properties.standardLockOwned) this.releaseOwnedStandardLockForTarget(this.properties.targetPlaylist);
    };

    this.setStandardLockFlag = function (flag) {
        var mask = Math.round(quickSearchClamp(this.properties.standardLockMask, 0, 63));
        this.setStandardLockMask((mask & flag) ? (mask & ~flag) : (mask | flag));
    };

    this.setStandardLockMask = function (mask) {
        mask = Math.round(quickSearchClamp(mask, 0, 63));
        if (mask === this.properties.standardLockMask) {
            this.syncStandardPlaylistLock();
            return;
        }
        // Validate/release the currently recorded lock against the old mask
        // before saving the new mask. GetPlaylistLockName identifies only the
        // JSP3 component, not the individual panel, so a same-playlist lock
        // whose mask no longer matches ours must never be removed as "ours".
        var ownedIndex = this.ownedStandardPlaylistIndex();
        if (ownedIndex >= 0) this.releaseStandardPlaylistLock(ownedIndex);
        else if (this.properties.standardLockOwned) this.clearStandardLockOwnership();
        this.save('standardLockMask', mask);
        this.syncStandardPlaylistLock();
    };

    this.resultPlaylistName = function (base, text) {
        base = quickSearchNormaliseText(base) || 'Search Results';
        if (!this.properties.appendQuery) return base;
        var compact = quickSearchNormaliseText(text).replace(/\s+/g, ' ');
        return compact ? base + ' [' + compact + ']' : base;
    };

    this.outputPlaylistName = function (resultMode, text) {
        // The query suffix is explicitly a New playlist/autoplaylist naming
        // preference. The reusable Standard results playlist must keep its
        // exact configured target name so it can be found, refreshed and
        // locked consistently across searches.
        if (resultMode === QS_RESULT_NEW_PLAYLIST) return this.resultPlaylistName(this.properties.newPlaylist, text);
        return this.properties.targetPlaylist;
    };

    this.feedPlaylist = function (handles, name, createNew) {
        var index;
        var standard = !createNew;
        if (createNew) {
            index = plman.CreatePlaylist(plman.PlaylistCount, name);
        } else {
            index = this.playlistIndexByName(name);
            if (index < 0) index = plman.CreatePlaylist(plman.PlaylistCount, name);
            this.releaseStandardPlaylistLock(index);
        }
        try {
            if (standard) {
                try { plman.UndoBackup(index); } catch (e) {}
                plman.ClearPlaylist(index);
            }
            if (handles && handles.Count) plman.InsertPlaylistItems(index, 0, handles);
        } finally {
            if (standard) this.applyStandardPlaylistLock(index);
        }
        plman.ActivePlaylist = index;
        if (handles && handles.Count && this.properties.focusResults) {
            try {
                plman.ClearPlaylistSelection(index);
                plman.SetPlaylistSelectionSingle(index, 0, true);
                plman.SetPlaylistFocusItem(index, 0);
            } catch (e2) {}
        }
        return index;
    };

    this.inlineSelect = function (handles) {
        var playlist = plman.ActivePlaylist;
        if (playlist < 0 || playlist >= plman.PlaylistCount) return false;
        var list = plman.GetPlaylistItems(playlist);
        var indices = [];
        try {
            for (var i = 0; i < list.Count; i++) {
                if (handles.Find(list.GetItem(i)) >= 0) indices.push(i);
            }
            plman.ClearPlaylistSelection(playlist);
            if (indices.length) plman.SetPlaylistSelection(playlist, indices, true);
            this.inlineMatches = indices;
            this.inlineCursor = indices.length ? 0 : -1;
            if (indices.length && this.properties.focusResults) plman.SetPlaylistFocusItem(playlist, indices[0]);
        } finally {
            quickSearchSafeDispose(list);
        }
        return indices.length > 0;
    };

    this.inlineNavigate = function (delta) {
        if (this.properties.source !== QS_SOURCE_INLINE || !this.inlineMatches.length || this.properties.focusResults) return false;
        this.inlineCursor += delta;
        if (this.inlineCursor < 0) this.inlineCursor = this.inlineMatches.length - 1;
        if (this.inlineCursor >= this.inlineMatches.length) this.inlineCursor = 0;
        try { plman.SetPlaylistFocusItem(plman.ActivePlaylist, this.inlineMatches[this.inlineCursor]); } catch (e) {}
        return true;
    };

    this.titleFormatQueryField = function (expression) {
        return quickSearchQuoteQuery(expression);
    };

    this.autoplaylistQuery = function (text, tag, match) {
        if (match === QS_MATCH_EXTENDED) return text;
        var fields = quickSearchTagExpressions(tag);
        var query = quickSearchNormaliseText(text);
        var words = query.split(/\s+/).filter(function (item) { return item.length > 0; });
        var clauses = [];
        var i, j;
        if (match === QS_MATCH_ALL || match === QS_MATCH_ANY) {
            for (i = 0; i < words.length; i++) {
                var perWord = [];
                for (j = 0; j < fields.length; j++) {
                    perWord.push(this.titleFormatQueryField(fields[j]) + ' HAS ' + quickSearchQuoteQuery(words[i]));
                }
                clauses.push('(' + perWord.join(' OR ') + ')');
            }
            return clauses.join(match === QS_MATCH_ALL ? ' AND ' : ' OR ');
        }
        if (match === QS_MATCH_EXACT) {
            for (i = 0; i < fields.length; i++) clauses.push(this.titleFormatQueryField(fields[i]) + ' IS ' + quickSearchQuoteQuery(query));
            return '(' + clauses.join(' OR ') + ')';
        }
        if (match === QS_MATCH_PREFIX) {
            // A title-format field expression is valid as a query field. $strstr=1
            // expresses a case-insensitive prefix test without requiring the
            // component's private transformed-query implementation.
            for (i = 0; i < fields.length; i++) {
                var prefixTf = '$stricmp($left(' + fields[i] + ',' + String(query.length) + '),' + query.replace(/,/g, '\\,') + ')';
                clauses.push(this.titleFormatQueryField(prefixTf) + ' EQUAL 1');
            }
            return '(' + clauses.join(' OR ') + ')';
        }
        return query;
    };

    this.createAutoplaylist = function (text, tag, match) {
        var query = this.autoplaylistQuery(text, tag, match);
        // Parse the generated query before creating a persistent autoplaylist.
        // An empty source keeps this validation cheap even with a large library.
        var validationSource = fb.CreateHandleList();
        var validationResult = null;
        try {
            validationResult = validationSource.GetQueryItems(query);
        } finally {
            quickSearchSafeDispose(validationResult);
            quickSearchSafeDispose(validationSource);
        }
        var name = this.resultPlaylistName(this.properties.newPlaylist, text);
        var index = plman.CreateAutoPlaylist(plman.PlaylistCount, name, query);
        plman.ActivePlaylist = index;
        return index;
    };

    this.addHistory = function (snapshot) {
        if (!this.properties.historySize) {
            this.properties.history = [];
            this.saveHistory();
            return;
        }
        var key = [snapshot.text, snapshot.source, snapshot.tagName, snapshot.match].join('\u001f').toLowerCase();
        var filtered = [];
        for (var i = 0; i < this.properties.history.length; i++) {
            var h = this.properties.history[i];
            var hk = [h.text, h.source, h.tagName, h.match].join('\u001f').toLowerCase();
            if (hk !== key) filtered.push(h);
        }
        filtered.unshift(quickSearchClone(snapshot));
        this.properties.history = filtered.slice(0, this.properties.historySize);
        this.saveHistory();
    };

    this.snapshot = function (text, source, match, tag) {
        return {
            text: text,
            source: source,
            match: match,
            tagName: tag.name,
            at: new Date().getTime()
        };
    };

    this.applySnapshot = function (snapshot, execute) {
        if (!snapshot) return;
        this.input.text = String(snapshot.text || '');
        this.input.default_text = this.input.text;
        this.input.Cpos = this.input.text.length;
        this.input.SelBegin = this.input.Cpos;
        this.input.SelEnd = this.input.Cpos;
        this.input.offset = 0;
        this.save('source', Math.round(quickSearchClamp(snapshot.source, 0, 3)));
        this.save('match', Math.round(quickSearchClamp(snapshot.match, 0, 4)));
        this.autoExtendedActive = false;
        if (this.tagByName(snapshot.tagName)) this.save('tagName', snapshot.tagName);
        this.updateAutoExtended();
        window.Repaint();
        if (execute) this.execute({});
    };

    this.execute = function (override) {
        override = override || {};
        var text = quickSearchNormaliseText(Object.prototype.hasOwnProperty.call(override, 'text') ? override.text : this.input.text);
        if (!text) {
            this.lastSuccess = false;
            this.applyInputColours();
            window.Repaint();
            return false;
        }
        var source = Object.prototype.hasOwnProperty.call(override, 'source') ? override.source : this.properties.source;
        var match = Object.prototype.hasOwnProperty.call(override, 'match') ? override.match : this.properties.match;
        var resultMode = Object.prototype.hasOwnProperty.call(override, 'resultMode') ? override.resultMode : this.properties.resultMode;
        var tag = this.currentTag();

        if (source === QS_SOURCE_INLINE) resultMode = QS_RESULT_STANDARD;
        else { this.inlineMatches = []; this.inlineCursor = -1; }
        if (source !== QS_SOURCE_LIBRARY && resultMode === QS_RESULT_NEW_AUTOPLAYLIST) resultMode = QS_RESULT_NEW_PLAYLIST;

        var targetIndex = this.playlistIndexByName(this.properties.targetPlaylist);
        var sourceSkipIndex = this.lastResultPlaylistIndex >= 0 ? this.lastResultPlaylistIndex : targetIndex;
        var handles = null;
        var success = false;
        try {
            if (resultMode === QS_RESULT_NEW_AUTOPLAYLIST && source === QS_SOURCE_LIBRARY) {
                this.lastResultPlaylistIndex = this.createAutoplaylist(text, tag, match);
                success = true;
            } else {
                handles = this.searchHandles(source, text, tag, match, sourceSkipIndex);
                if (handles) {
                    if (source === QS_SOURCE_INLINE) {
                        success = this.inlineSelect(handles);
                    } else if (resultMode === QS_RESULT_STANDARD || handles.Count) {
                        // Standard results are a reusable view of the current
                        // search, so an empty valid result must clear stale
                        // previous contents. One-shot New playlist output still
                        // avoids creating an empty playlist.
                        var name = this.outputPlaylistName(resultMode, text);
                        this.lastResultPlaylistIndex = this.feedPlaylist(handles, name, resultMode === QS_RESULT_NEW_PLAYLIST);
                        success = true;
                    }
                }
            }
        } catch (e) {
            console.log('[DarkOneJSP3 Quick Search] Search failed: ' + e.message);
            success = false;
        } finally {
            quickSearchSafeDispose(handles);
        }

        this.lastSuccess = success;
        this.applyInputColours();
        if (success) {
            var snap = this.snapshot(text, source, match, tag);
            this.lastSearch = quickSearchClone(snap);
            this.addHistory(snap);
            if (this.properties.resetText) {
                this.input.text = '';
                this.input.default_text = '';
                this.input.Cpos = 0;
                this.input.SelBegin = 0;
                this.input.SelEnd = 0;
                this.input.offset = 0;
            } else {
                this.input.default_text = this.input.text;
            }
        }
        window.Repaint();
        return success;
    };

    this.modifiers = function () {
        return {
            ctrl: Boolean(utils.IsKeyPressed(VK_CONTROL)),
            alt: Boolean(utils.IsKeyPressed(VK_ALT)),
            shift: Boolean(utils.IsKeyPressed(VK_SHIFT))
        };
    };

    this.enter = function () {
        var m = this.modifiers();
        var override = {};
        if (m.ctrl && m.alt && m.shift) {
            override.source = QS_SOURCE_ALL_PLAYLISTS;
            override.resultMode = QS_RESULT_NEW_PLAYLIST;
        } else if (m.ctrl && m.alt) {
            override.source = QS_SOURCE_PLAYLIST;
            override.resultMode = QS_RESULT_NEW_PLAYLIST;
        } else if (m.ctrl && m.shift) {
            override.source = QS_SOURCE_LIBRARY;
            override.resultMode = QS_RESULT_NEW_AUTOPLAYLIST;
        } else if (m.alt && m.shift) {
            override.source = QS_SOURCE_ALL_PLAYLISTS;
        } else if (m.ctrl) {
            override.resultMode = QS_RESULT_NEW_PLAYLIST;
        } else if (m.alt) {
            override.source = QS_SOURCE_PLAYLIST;
        } else if (m.shift) {
            override.source = QS_SOURCE_INLINE;
        }
        return this.execute(override);
    };

    this.deletePreviousWord = function () {
        if (!this.input.edit) return false;
        if (this.input.select) {
            this.input.on_key_down(VK_BACK);
            this.textChanged();
            return true;
        }
        var pos = this.input.Cpos;
        if (pos <= 0) return true;
        var left = this.input.text.substring(0, pos);
        var start = left.replace(/\s+$/g, '').search(/\S+$/);
        if (start < 0) start = 0;
        this.input.stext = this.input.text;
        this.input.text = this.input.text.substring(0, start) + this.input.text.substring(pos);
        this.input.Cpos = start;
        this.input.SelBegin = start;
        this.input.SelEnd = start;
        this.input.select = false;
        this.input.text_selected = '';
        this.input.offset = Math.min(this.input.offset, start);
        this.textChanged();
        return true;
    };

    this.updateAutoExtended = function () {
        if (!this.properties.autoExtended) return;
        var hasPercent = this.input.text.indexOf('%') !== -1;
        if (hasPercent && this.properties.match !== QS_MATCH_EXTENDED) {
            this.previousMatchBeforeExtended = this.properties.match;
            this.autoExtendedActive = true;
            this.save('match', QS_MATCH_EXTENDED);
        } else if (!hasPercent && this.autoExtendedActive && this.properties.match === QS_MATCH_EXTENDED) {
            this.save('match', this.previousMatchBeforeExtended);
            this.autoExtendedActive = false;
        } else if (this.properties.match !== QS_MATCH_EXTENDED) {
            this.autoExtendedActive = false;
        }
    };

    this.textChanged = function () {
        this.updateAutoExtended();
        this.lastSuccess = true;
        this.applyInputColours();
        if (this.autoTimer) {
            window.ClearTimeout(this.autoTimer);
            this.autoTimer = 0;
        }
        if (this.properties.autoSearch && quickSearchNormaliseText(this.input.text).length > 1) {
            this.autoTimer = window.SetTimeout(function () {
                self.autoTimer = 0;
                self.execute({});
            }, this.properties.autoDelay);
        }
        window.Repaint();
    };

    this.keyDown = function (vkey) {
        if (vkey === VK_RETURN && this.input.edit) {
            this.enter();
            return true;
        }
        if (vkey === VK_TAB && this.input.edit) {
            var completion = this.autocompleteText();
            if (completion) {
                this.input.text = completion;
                this.input.Cpos = completion.length;
                this.input.SelBegin = this.input.Cpos;
                this.input.SelEnd = this.input.Cpos;
                this.input.default_text = completion;
                this.textChanged();
            } else {
                this.enter();
            }
            return true;
        }
        if (vkey === VK_BACK && utils.IsKeyPressed(VK_CONTROL)) return this.deletePreviousWord();
        if (vkey === VK_UP && this.inlineNavigate(-1)) return true;
        if (vkey === VK_DOWN && this.inlineNavigate(1)) return true;
        var before = this.input.text;
        this.input.on_key_down(vkey);
        if (this.input.text !== before) this.textChanged();
        return false;
    };

    this.character = function (code) {
        var before = this.input.text;
        this.input.on_char(code, GetKeyboardMask());
        if (this.input.text !== before) this.textChanged();
    };

    this.mouseMove = function (x, y) {
        var hover = x >= this.iconX && x <= this.iconX + this.iconW && y >= this.iconY && y <= this.iconY + this.iconW;
        if (hover !== this.iconHover) {
            this.iconHover = hover;
            window.RepaintRect(this.iconX, this.iconY, this.iconW, this.iconW);
        }
        this.input.check('move', x, y);
        if (hover) window.SetCursor(IDC_HAND);
    };

    this.mouseLeave = function () {
        if (this.iconHover) {
            this.iconHover = false;
            window.RepaintRect(this.iconX, this.iconY, this.iconW, this.iconW);
        }
    };

    this.lbtnDown = function (x, y) {
        if (x >= this.iconX && x <= this.iconX + this.iconW && y >= this.iconY && y <= this.iconY + this.iconW) return true;
        this.input.check('lbtn_down', x, y);
        return false;
    };

    this.lbtnUp = function (x, y) {
        if (x >= this.iconX && x <= this.iconX + this.iconW && y >= this.iconY && y <= this.iconY + this.iconW) {
            this.showMenu(this.iconX, this.iconY + this.iconW);
            return true;
        }
        this.input.check('lbtn_up', x, y);
        return false;
    };

    this.lbtnDblclk = function (x, y) {
        this.input.check('lbtn_dblclk', x, y);
    };

    this.rbtnUp = function (x, y) {
        if (x >= this.inputX && x <= this.inputX + this.inputW && y >= this.inputY && y <= this.inputY + this.inputH) {
            var before = this.input.text;
            this.input.check('rbtn_up', x, y);
            if (this.input.text !== before) this.textChanged();
            return true;
        }
        this.showMenu(x, y);
        return true;
    };

    this.recallLast = function (mode) {
        if (!this.lastSearch && this.properties.history.length) this.lastSearch = quickSearchClone(this.properties.history[0]);
        if (!this.lastSearch) return;
        this.applySnapshot(this.lastSearch, false);
        this.execute({ resultMode: mode });
    };

    this.addCurrentFavorite = function () {
        var text = quickSearchNormaliseText(this.input.text);
        if (!text) return;
        var snap = this.snapshot(text, this.properties.source, this.properties.match, this.currentTag());
        var key = [snap.text, snap.source, snap.tagName, snap.match].join('\u001f').toLowerCase();
        for (var i = 0; i < this.properties.favorites.length; i++) {
            var f = this.properties.favorites[i];
            if ([f.text, f.source, f.tagName, f.match].join('\u001f').toLowerCase() === key) return;
        }
        this.properties.favorites.unshift(snap);
        this.properties.favorites = this.properties.favorites.slice(0, 32);
        this.saveFavorites();
    };

    this.editCurrentTag = function () {
        var current = this.currentTag();
        try {
            var name = quickSearchNormaliseText(utils.InputBox('Tag name:', window.Name, current.name));
            if (!name) return;
            var value = quickSearchNormaliseText(utils.InputBox('Title-format expression. Use | between multiple fields.', window.Name, current.value));
            if (!value) return;
            for (var i = 0; i < this.properties.tags.length; i++) {
                if (this.properties.tags[i] === current) continue;
                if (this.properties.tags[i].name.toLowerCase() === name.toLowerCase() || this.properties.tags[i].value.toLowerCase() === value.toLowerCase()) return;
            }
            current.name = name;
            current.value = value;
            this.save('tagName', name);
            this.saveTags();
            this.cache = Object.create(null);
        } catch (e) {}
    };

    this.addTag = function () {
        try {
            var name = quickSearchNormaliseText(utils.InputBox('Tag name:', window.Name, 'Custom'));
            if (!name) return;
            var value = quickSearchNormaliseText(utils.InputBox('Title-format expression. Use | between multiple fields.', window.Name, '%artist%'));
            if (!value) return;
            for (var i = 0; i < this.properties.tags.length; i++) {
                if (this.properties.tags[i].name.toLowerCase() === name.toLowerCase() || this.properties.tags[i].value.toLowerCase() === value.toLowerCase()) return;
            }
            this.properties.tags.push({ name: name, value: value, context: true });
            this.saveTags();
            this.save('tagName', name);
            this.cache = Object.create(null);
        } catch (e) {}
    };

    this.removeCurrentTag = function () {
        if (this.properties.tags.length <= 1) return;
        var current = this.currentTag();
        for (var i = 0; i < this.properties.tags.length; i++) {
            if (this.properties.tags[i] === current) {
                this.properties.tags.splice(i, 1);
                this.save('tagName', this.properties.tags[Math.max(0, i - 1)].name);
                this.saveTags();
                this.cache = Object.create(null);
                return;
            }
        }
    };

    this.currentTagIndex = function () {
        var current = this.currentTag();
        for (var i = 0; i < this.properties.tags.length; i++) {
            if (this.properties.tags[i] === current) return i;
        }
        return 0;
    };

    this.moveCurrentTag = function (delta) {
        var from = this.currentTagIndex();
        var to = from + delta;
        if (to < 0 || to >= this.properties.tags.length) return false;
        var item = this.properties.tags[from];
        this.properties.tags.splice(from, 1);
        this.properties.tags.splice(to, 0, item);
        this.saveTags();
        this.cache = Object.create(null);
        return true;
    };

    this.setColourMode = function (modeProperty, mode) {
        mode = mode === QS_COLOUR_CUSTOM ? QS_COLOUR_CUSTOM : QS_COLOUR_DEFAULT;
        this.save(modeProperty, mode);
        this.coloursChanged();
        window.Repaint();
    };

    this.editCustomColour = function (modeProperty, customProperty, title) {
        var current = this.properties[customProperty];
        var chosen = DarkOneColour.pickJscript(current, title, 'Enter a colour as #RRGGBB:');
        if (chosen === null) return false;
        chosen = DarkOneColour.opaque(chosen);
        this.save(customProperty, chosen);
        this.save(modeProperty, QS_COLOUR_CUSTOM);
        this.coloursChanged();
        window.Repaint();
        return true;
    };

    this.appendColourChoiceMenu = function (menu, idBase, label, mode, customColour) {
        var child = window.CreatePopupMenu();
        child.AppendMenuItem(MF_STRING, idBase, 'Default');
        child.AppendMenuItem(MF_STRING, idBase + 1, 'Custom colour (' + DarkOneColour.toHex(customColour) + ')');
        child.AppendMenuSeparator();
        child.AppendMenuItem(MF_STRING, idBase + 2, 'Set custom colour...');
        quickSearchMenuRadio(child, idBase, idBase + 1, idBase + (mode === QS_COLOUR_CUSTOM ? 1 : 0));
        child.AppendTo(menu, MF_STRING, label);
        return child;
    };

    this.setSource = function (source) {
        if (source !== this.properties.source) { this.inlineMatches = []; this.inlineCursor = -1; }
        this.save('source', source);
        if (source === QS_SOURCE_INLINE && this.properties.resultMode !== QS_RESULT_STANDARD) this.save('resultMode', QS_RESULT_STANDARD);
        if (source !== QS_SOURCE_LIBRARY && this.properties.resultMode === QS_RESULT_NEW_AUTOPLAYLIST) this.save('resultMode', QS_RESULT_STANDARD);
        if (this.properties.autoSearch && quickSearchNormaliseText(this.input.text).length > 1) this.textChanged();
        window.Repaint();
    };

    this.setResultMode = function (mode) {
        if (mode !== QS_RESULT_STANDARD && this.properties.source === QS_SOURCE_INLINE) return;
        if (mode === QS_RESULT_NEW_AUTOPLAYLIST && this.properties.source !== QS_SOURCE_LIBRARY) return;
        this.save('resultMode', mode);
        if (mode !== QS_RESULT_STANDARD && this.properties.autoSearch) this.save('autoSearch', false);
        window.Repaint();
    };

    this.setAutoExtended = function (enabled) {
        enabled = Boolean(enabled);
        if (!enabled && this.autoExtendedActive && this.properties.match === QS_MATCH_EXTENDED) {
            this.save('match', this.previousMatchBeforeExtended);
        }
        this.autoExtendedActive = false;
        this.save('autoExtended', enabled);
        if (enabled) this.updateAutoExtended();
        if (this.properties.autoSearch && quickSearchNormaliseText(this.input.text).length > 1) this.textChanged();
        window.Repaint();
    };

    this.setAutoSearch = function (enabled) {
        enabled = Boolean(enabled);
        this.save('autoSearch', enabled);
        if (enabled && this.properties.resultMode !== QS_RESULT_STANDARD) this.save('resultMode', QS_RESULT_STANDARD);
        if (enabled) this.textChanged();
        else if (this.autoTimer) { window.ClearTimeout(this.autoTimer); this.autoTimer = 0; }
        window.Repaint();
    };

    this.resetConfiguration = function (scope) {
        scope = String(scope || 'all').toLowerCase();
        if (scope !== 'appearance' && scope !== 'behaviour' && scope !== 'all') scope = 'all';

        var resetAppearance = scope === 'appearance' || scope === 'all';
        var resetBehaviour = scope === 'behaviour' || scope === 'all';

        if (resetBehaviour) {
            var previousTargetPlaylist = this.properties.targetPlaylist;
            this.releaseOwnedStandardLockForTarget(previousTargetPlaylist);
            var behaviourDefaults = {
                source: QS_SOURCE_LIBRARY,
                match: QS_MATCH_ALL,
                tagName: 'All',
                autoSearch: false,
                resultMode: QS_RESULT_STANDARD,
                targetPlaylist: 'Quick Search',
                newPlaylist: 'Search Results',
                appendQuery: true,
                focusResults: true,
                resetText: false,
                standardLockMask: QS_LOCK_RECOMMENDED,
                standardLockOwned: false,
                standardLockTarget: '',
                standardLockGuid: '',
                removeParentheses: true,
                autoExtended: true,
                autoDelay: 300,
                autocomplete: true,
                historySize: 20,
                manageFavorites: true
            };
            for (var behaviourKey in behaviourDefaults) {
                if (Object.prototype.hasOwnProperty.call(behaviourDefaults, behaviourKey)) this.save(behaviourKey, behaviourDefaults[behaviourKey]);
            }
            this.previousMatchBeforeExtended = QS_MATCH_ALL;
            this.autoExtendedActive = false;
            this.inlineMatches = [];
            this.inlineCursor = -1;
            if (this.autoTimer) window.ClearTimeout(this.autoTimer);
            this.autoTimer = 0;
            this.lastSuccess = true;
            this.syncStandardPlaylistLock();
        }

        if (resetAppearance) {
            var appearanceDefaults = {
                frame: QS_FRAME_NONE,
                iconMode: 'vector',
                statusBadge: false,
                showPlaceholder: true,
                normalTextMode: QS_COLOUR_DEFAULT,
                normalTextCustom: 0xffdcdcdc,
                normalBackgroundMode: QS_COLOUR_DEFAULT,
                normalBackgroundCustom: 0xff1e1e1e,
                errorTextMode: QS_COLOUR_DEFAULT,
                errorTextCustom: 0xffffe1e1,
                errorBackgroundMode: QS_COLOUR_DEFAULT,
                errorBackgroundCustom: 0xff581f1f,
                lines: 2,
                widthPercent: 44,
                fontSize: 0,
                autoFontScale: 100
            };
            for (var appearanceKey in appearanceDefaults) {
                if (Object.prototype.hasOwnProperty.call(appearanceDefaults, appearanceKey)) this.save(appearanceKey, appearanceDefaults[appearanceKey]);
            }
            this.loadIcon();
            this.syncPlaceholder();
            this.coloursChanged();
            this.size(this.w, this.h);
            this.layoutCommand();
        }

        // Tag definitions, history and favourites are user data rather than an
        // appearance/behaviour preference. Preserve them for scoped factory
        // resets and clear them only for the panel's explicit complete reset.
        if (scope === 'all') {
            this.properties.tags = quickSearchClone(QS_DEFAULT_TAGS);
            this.properties.history = [];
            this.properties.favorites = [];
            this.saveTags();
            this.saveHistory();
            this.saveFavorites();
        }

        this.applyInputColours();
        window.Repaint();
    };

    this.showMenu = function (x, y) {
        var customPngAvailable = this.syncCustomPngState();
        var root = window.CreatePopupMenu();
        var sourceMenu = window.CreatePopupMenu();
        var tagMenu = window.CreatePopupMenu();
        var matchMenu = window.CreatePopupMenu();
        var historyMenu = window.CreatePopupMenu();
        var favoritesMenu = window.CreatePopupMenu();
        var resultMenu = window.CreatePopupMenu();
        var lockMenu = window.CreatePopupMenu();
        var optionsMenu = window.CreatePopupMenu();
        var visualMenu = window.CreatePopupMenu();
        var heightMenu = window.CreatePopupMenu();
        var widthMenu = window.CreatePopupMenu();
        var fontMenu = window.CreatePopupMenu();
        var colourMenu = window.CreatePopupMenu();
        var colourSubmenus = [];

        var idSource = 100;
        sourceMenu.AppendMenuItem(MF_STRING, idSource + 0, 'Media library');
        sourceMenu.AppendMenuItem(MF_STRING, idSource + 1, 'Current playlist');
        sourceMenu.AppendMenuItem(MF_STRING, idSource + 2, 'Current playlist (inline)');
        sourceMenu.AppendMenuItem(MF_STRING, idSource + 3, 'All playlists');
        quickSearchMenuRadio(sourceMenu, idSource, idSource + 3, idSource + this.properties.source);
        sourceMenu.AppendTo(root, MF_STRING, 'Search in');

        var idTag = 200;
        for (var i = 0; i < this.properties.tags.length && i < 80; i++) tagMenu.AppendMenuItem(MF_STRING, idTag + i, this.properties.tags[i].name);
        if (this.properties.match !== QS_MATCH_EXTENDED) {
            var selectedTag = 0;
            for (var ti = 0; ti < this.properties.tags.length; ti++) if (this.properties.tags[ti].name === this.properties.tagName) selectedTag = ti;
            quickSearchMenuRadio(tagMenu, idTag, idTag + Math.max(0, this.properties.tags.length - 1), idTag + selectedTag);
        }
        tagMenu.AppendMenuSeparator();
        tagMenu.AppendMenuItem(MF_STRING, 290, 'Add tag...');
        tagMenu.AppendMenuItem(MF_STRING, 291, 'Edit current tag...');
        tagMenu.AppendMenuItem(quickSearchEnable(this.properties.tags.length > 1), 292, 'Delete current tag');
        tagMenu.AppendMenuItem(MF_STRING, 293, this.currentTag().context ? 'Disable current tag in Search for same' : 'Enable current tag in Search for same');
        var currentTagIndex = this.currentTagIndex();
        tagMenu.AppendMenuItem(quickSearchEnable(currentTagIndex > 0), 295, 'Move current tag up');
        tagMenu.AppendMenuItem(quickSearchEnable(currentTagIndex < this.properties.tags.length - 1), 296, 'Move current tag down');
        tagMenu.AppendMenuItem(MF_STRING, 294, 'Reset tag list');
        tagMenu.AppendTo(root, this.properties.match === QS_MATCH_EXTENDED ? MF_GRAYED : MF_STRING, 'Tags');

        var idMatch = 300;
        var matchNames = ['Match all', 'Match any', 'Exact', 'Prefix', 'Extended'];
        for (i = 0; i < matchNames.length; i++) matchMenu.AppendMenuItem(MF_STRING, idMatch + i, matchNames[i]);
        quickSearchMenuRadio(matchMenu, idMatch, idMatch + 4, idMatch + this.properties.match);
        matchMenu.AppendTo(root, MF_STRING, 'Match');

        root.AppendMenuItem(MF_STRING, 400, this.properties.autoSearch ? 'Autosearch ✓' : 'Autosearch');
        root.AppendMenuSeparator();

        resultMenu.AppendMenuItem(MF_STRING, 410, 'Standard results playlist');
        resultMenu.AppendMenuItem(quickSearchEnable(this.properties.source !== QS_SOURCE_INLINE), 411, 'New playlist');
        resultMenu.AppendMenuItem(quickSearchEnable(this.properties.source === QS_SOURCE_LIBRARY), 412, 'New autoplaylist');
        quickSearchMenuRadio(resultMenu, 410, 412, 410 + this.properties.resultMode);
        resultMenu.AppendMenuSeparator();
        var lockItems = [
            [420, QS_LOCK_ADD, 'Disable adding items'],
            [421, QS_LOCK_REMOVE, 'Disable removing items'],
            [422, QS_LOCK_REORDER, 'Disable reordering items'],
            [423, QS_LOCK_REPLACE, 'Disable replacing items'],
            [424, QS_LOCK_RENAME, 'Disable renaming this playlist'],
            [425, QS_LOCK_REMOVE_PLAYLIST, 'Disable removing this playlist']
        ];
        for (i = 0; i < lockItems.length; i++) {
            lockMenu.AppendMenuItem(MF_STRING, lockItems[i][0], lockItems[i][2] + ((this.properties.standardLockMask & lockItems[i][1]) ? ' ✓' : ''));
        }
        lockMenu.AppendMenuSeparator();
        lockMenu.AppendMenuItem(this.properties.standardLockMask === QS_LOCK_RECOMMENDED ? MF_GRAYED : MF_STRING, 427, 'Recommended defaults');
        lockMenu.AppendMenuItem(this.properties.standardLockMask === 0 ? MF_GRAYED : MF_STRING, 428, 'No locks');
        lockMenu.AppendTo(resultMenu, MF_STRING, 'Lock type');
        resultMenu.AppendTo(root, MF_STRING, 'Results');

        var historyLimit = Math.min(this.properties.history.length, 40);
        for (i = 0; i < historyLimit; i++) historyMenu.AppendMenuItem(MF_STRING, 500 + i, this.properties.history[i].text + this.historyMarker(this.properties.history[i].source));
        if (!historyLimit) historyMenu.AppendMenuItem(MF_GRAYED, 599, '(empty)');
        historyMenu.AppendMenuSeparator();
        historyMenu.AppendMenuItem(quickSearchEnable(historyLimit > 0), 598, 'Clear history');
        historyMenu.AppendTo(root, MF_STRING, 'History');

        if (this.properties.manageFavorites) {
            var favLimit = Math.min(this.properties.favorites.length, 32);
            for (i = 0; i < favLimit; i++) favoritesMenu.AppendMenuItem(MF_STRING, 600 + i, this.properties.favorites[i].text + this.historyMarker(this.properties.favorites[i].source));
            if (!favLimit) favoritesMenu.AppendMenuItem(MF_GRAYED, 699, '(empty)');
            favoritesMenu.AppendMenuSeparator();
            favoritesMenu.AppendMenuItem(MF_STRING, 698, 'Add current search');
            favoritesMenu.AppendMenuItem(quickSearchEnable(favLimit > 0), 697, 'Clear favorites');
            favoritesMenu.AppendTo(root, MF_STRING, 'Favorites');
        }

        root.AppendMenuSeparator();
        optionsMenu.AppendMenuItem(MF_STRING, 700, this.properties.resetText ? 'Reset search text after success ✓' : 'Reset search text after success');
        optionsMenu.AppendMenuItem(MF_STRING, 702, this.properties.removeParentheses ? 'Remove parentheses for Search for same ✓' : 'Remove parentheses for Search for same');
        optionsMenu.AppendMenuItem(MF_STRING, 703, this.properties.autoExtended ? 'Auto-switch to Extended on % ✓' : 'Auto-switch to Extended on %');
        optionsMenu.AppendMenuItem(MF_STRING, 704, this.properties.autocomplete ? 'Autocomplete from history ✓' : 'Autocomplete from history');
        optionsMenu.AppendMenuItem(MF_STRING, 705, this.properties.focusResults ? 'Focus first result ✓' : 'Focus first result');
        optionsMenu.AppendMenuSeparator();
        optionsMenu.AppendMenuItem(MF_STRING, 706, 'Autosearch delay... (' + this.properties.autoDelay + ' ms)');
        optionsMenu.AppendMenuItem(MF_STRING, 707, 'History size... (' + this.properties.historySize + ')');
        optionsMenu.AppendMenuItem(MF_STRING, 708, 'Target playlist...');
        optionsMenu.AppendMenuItem(MF_STRING, 709, 'New playlist name...');
        optionsMenu.AppendMenuItem(MF_STRING, 710, this.properties.appendQuery ? 'Append search text to new playlist name ✓' : 'Append search text to new playlist name');
        optionsMenu.AppendMenuItem(MF_STRING, 711, this.properties.manageFavorites ? 'Manage favorites ✓' : 'Manage favorites');
        optionsMenu.AppendTo(root, MF_STRING, 'Preferences');

        heightMenu.AppendMenuItem(MF_STRING, 800, 'Automatic');
        heightMenu.AppendMenuItem(MF_STRING, 801, '1 line');
        heightMenu.AppendMenuItem(MF_STRING, 802, '2 lines');
        quickSearchMenuRadio(heightMenu, 800, 802, 800 + this.properties.lines);
        heightMenu.AppendTo(visualMenu, MF_STRING, 'Height');

        var widthValues = [30, 44, 60, 80, 100];
        for (i = 0; i < widthValues.length; i++) widthMenu.AppendMenuItem(MF_STRING, 820 + i, widthValues[i] + '%');
        widthMenu.AppendMenuSeparator();
        widthMenu.AppendMenuItem(MF_STRING, 829, 'Custom width...');
        for (i = 0; i < widthValues.length; i++) if (this.properties.widthPercent === widthValues[i]) quickSearchMenuRadio(widthMenu, 820, 824, 820 + i);
        widthMenu.AppendTo(visualMenu, MF_STRING, 'Width');

        fontMenu.AppendMenuItem(MF_STRING, 830, 'Automatic font size');
        fontMenu.CheckMenuItem(830, Number(this.properties.fontSize) === 0);
        fontMenu.AppendMenuItem(MF_STRING, 831, 'Set fixed font size...');
        fontMenu.AppendMenuSeparator();
        fontMenu.AppendMenuItem(MF_STRING, 832, 'Set automatic base scale... (' + this.automaticFontScale() + '%)');
        fontMenu.AppendMenuItem(this.automaticFontScale() === 100 ? MF_GRAYED : MF_STRING, 833, 'Reset automatic base scale');
        fontMenu.AppendTo(visualMenu, MF_STRING, 'Font size');
        visualMenu.AppendMenuItem(MF_STRING, 834, this.properties.showPlaceholder ? 'Show placeholder text ✓' : 'Show placeholder text');

        visualMenu.AppendMenuSeparator();
        visualMenu.AppendMenuItem(MF_STRING, 840, this.properties.iconMode === 'vector' ? 'Built-in scalable icon ✓' : 'Built-in scalable icon');
        visualMenu.AppendMenuItem(
            quickSearchEnable(customPngAvailable),
            841,
            customPngAvailable ? (this.properties.iconMode === 'custom' ? 'Custom PNG ✓' : 'Custom PNG') : 'Custom PNG (unavailable)'
        );
        visualMenu.AppendMenuItem(MF_STRING, 843, this.properties.statusBadge ? 'Show search-mode indicator ✓' : 'Show search-mode indicator');
        visualMenu.AppendMenuSeparator();
        colourSubmenus.push(this.appendColourChoiceMenu(colourMenu, 860, 'Normal text', this.properties.normalTextMode, this.properties.normalTextCustom));
        colourSubmenus.push(this.appendColourChoiceMenu(colourMenu, 863, 'Normal background', this.properties.normalBackgroundMode, this.properties.normalBackgroundCustom));
        colourSubmenus.push(this.appendColourChoiceMenu(colourMenu, 866, 'Error text', this.properties.errorTextMode, this.properties.errorTextCustom));
        colourSubmenus.push(this.appendColourChoiceMenu(colourMenu, 869, 'Error background', this.properties.errorBackgroundMode, this.properties.errorBackgroundCustom));
        colourMenu.AppendTo(visualMenu, MF_STRING, 'Colours');
        visualMenu.AppendMenuSeparator();
        visualMenu.AppendMenuItem(MF_STRING, 850, this.properties.frame === QS_FRAME_NONE ? 'Frame: None ✓' : 'Frame: None');
        visualMenu.AppendMenuItem(MF_STRING, 851, this.properties.frame === QS_FRAME_GREY ? 'Frame: Grey ✓' : 'Frame: Grey');
        visualMenu.AppendMenuItem(MF_STRING, 852, this.properties.frame === QS_FRAME_SUNKEN ? 'Frame: Sunken ✓' : 'Frame: Sunken');
        visualMenu.AppendTo(root, MF_STRING, 'Appearance');

        root.AppendMenuSeparator();
        root.AppendMenuItem(quickSearchEnable(Boolean(this.lastSearch || this.properties.history.length)), 900, 'Create playlist from last search');
        root.AppendMenuItem(quickSearchEnable(Boolean(this.lastSearch || this.properties.history.length)), 901, 'Create autoplaylist from last search');
        var activeIsAutoPlaylist = false;
        try { activeIsAutoPlaylist = plman.ActivePlaylist >= 0 && plman.IsAutoPlaylist(plman.ActivePlaylist); } catch (autoPlaylistCheckError) {}
        root.AppendMenuItem(quickSearchEnable(activeIsAutoPlaylist), 902, 'Edit active autoplaylist...');
        root.AppendMenuItem(MF_STRING, 999, 'Reset Quick Search configuration');

        var idx = root.TrackPopupMenu(x, y);
        root.Dispose(); sourceMenu.Dispose(); tagMenu.Dispose(); matchMenu.Dispose(); historyMenu.Dispose(); favoritesMenu.Dispose(); resultMenu.Dispose(); lockMenu.Dispose(); optionsMenu.Dispose(); visualMenu.Dispose(); heightMenu.Dispose(); widthMenu.Dispose(); fontMenu.Dispose(); colourMenu.Dispose();
        for (var colourDisposeIndex = 0; colourDisposeIndex < colourSubmenus.length; colourDisposeIndex++) quickSearchSafeDispose(colourSubmenus[colourDisposeIndex]);

        if (idx >= 100 && idx <= 103) this.setSource(idx - 100);
        else if (idx >= 200 && idx < 280) { var tagIndex = idx - 200; if (this.properties.tags[tagIndex]) { this.save('tagName', this.properties.tags[tagIndex].name); if (this.properties.autoSearch) this.textChanged(); } }
        else if (idx === 290) this.addTag();
        else if (idx === 291) this.editCurrentTag();
        else if (idx === 292) this.removeCurrentTag();
        else if (idx === 293) { this.currentTag().context = !this.currentTag().context; this.saveTags(); }
        else if (idx === 295) this.moveCurrentTag(-1);
        else if (idx === 296) this.moveCurrentTag(1);
        else if (idx === 294) { this.properties.tags = quickSearchClone(QS_DEFAULT_TAGS); this.saveTags(); this.save('tagName', 'All'); this.cache = Object.create(null); }
        else if (idx >= 300 && idx <= 304) { this.save('match', idx - 300); this.autoExtendedActive = false; if (this.properties.match !== QS_MATCH_EXTENDED) this.previousMatchBeforeExtended = this.properties.match; if (this.properties.autoSearch) this.textChanged(); }
        else if (idx === 400) this.setAutoSearch(!this.properties.autoSearch);
        else if (idx >= 410 && idx <= 412) this.setResultMode(idx - 410);
        else if (idx >= 420 && idx <= 425) this.setStandardLockFlag(lockItems[idx - 420][1]);
        else if (idx === 427) this.setStandardLockMask(QS_LOCK_RECOMMENDED);
        else if (idx === 428) this.setStandardLockMask(0);
        else if (idx >= 500 && idx < 540) this.applySnapshot(this.properties.history[idx - 500], true);
        else if (idx === 598) { this.properties.history = []; this.saveHistory(); }
        else if (idx >= 600 && idx < 632) this.applySnapshot(this.properties.favorites[idx - 600], true);
        else if (idx === 698) this.addCurrentFavorite();
        else if (idx === 697) { this.properties.favorites = []; this.saveFavorites(); }
        else if (idx === 700) this.save('resetText', !this.properties.resetText);
        else if (idx === 702) this.save('removeParentheses', !this.properties.removeParentheses);
        else if (idx === 703) this.setAutoExtended(!this.properties.autoExtended);
        else if (idx === 704) this.save('autocomplete', !this.properties.autocomplete);
        else if (idx === 705) this.save('focusResults', !this.properties.focusResults);
        else if (idx === 706) { try { this.save('autoDelay', Math.round(quickSearchClamp(utils.InputBox('Autosearch delay in milliseconds (50-3000):', window.Name, this.properties.autoDelay), 50, 3000))); } catch (e) {} }
        else if (idx === 707) { try { this.save('historySize', Math.round(quickSearchClamp(utils.InputBox('History size (0-100):', window.Name, this.properties.historySize), 0, 100))); this.properties.history = this.properties.history.slice(0, this.properties.historySize); this.saveHistory(); } catch (e2) {} }
        else if (idx === 708) { try { var tp = quickSearchNormaliseText(utils.InputBox('Target results playlist:', window.Name, this.properties.targetPlaylist)); if (tp && tp !== this.properties.targetPlaylist) { var oldTarget = this.properties.targetPlaylist; this.releaseOwnedStandardLockForTarget(oldTarget); this.save('targetPlaylist', tp); this.syncStandardPlaylistLock(); } } catch (e3) {} }
        else if (idx === 709) { try { var np = quickSearchNormaliseText(utils.InputBox('Base name for new playlists:', window.Name, this.properties.newPlaylist)); if (np) this.save('newPlaylist', np); } catch (e4) {} }
        else if (idx === 710) this.save('appendQuery', !this.properties.appendQuery);
        else if (idx === 711) this.save('manageFavorites', !this.properties.manageFavorites);
        else if (idx >= 800 && idx <= 802) this.setLines(idx - 800);
        else if (idx >= 820 && idx <= 824) this.setWidthPercent(widthValues[idx - 820]);
        else if (idx === 829) { try { this.setWidthPercent(utils.InputBox('Width as a percentage of the left bottom-control area (20-100):', window.Name, this.properties.widthPercent)); } catch (e5) {} }
        else if (idx === 830) {
            this.save('fontSize', 0);
            this.size(this.w, this.h);
            this.layoutCommand();
        }
        else if (idx === 831) {
            try {
                var currentFontSize = Number(this.properties.fontSize) || this.automaticFontSize();
                var fixedFontSize = Number(utils.InputBox(
                    'Enter the fixed Quick Search font size in pixels. Enter 0 to return to automatic scaling.',
                    window.Name,
                    currentFontSize
                ));
                if (!isNaN(fixedFontSize)) {
                    this.save('fontSize', fixedFontSize <= 0 ? 0 : Math.round(quickSearchClamp(fixedFontSize, 8, 48)));
                    this.size(this.w, this.h);
                    this.layoutCommand();
                }
            } catch (fontSizeError) {}
        }
        else if (idx === 832) {
            try {
                var enteredFontScale = Number(utils.InputBox(
                    'Adjust the responsive automatic font calculation as a percentage.\n\n' +
                    '100% preserves the normal DarkOne scaling. Suggested range: 75% to 150%.',
                    window.Name,
                    this.automaticFontScale()
                ));
                if (!isNaN(enteredFontScale)) {
                    this.save('autoFontScale', Math.round(quickSearchClamp(enteredFontScale, 50, 200)));
                    this.size(this.w, this.h);
                    this.layoutCommand();
                }
            } catch (fontScaleError) {}
        }
        else if (idx === 833) {
            this.save('autoFontScale', 100);
            this.size(this.w, this.h);
            this.layoutCommand();
        }
        else if (idx === 834) {
            this.save('showPlaceholder', !this.properties.showPlaceholder);
            this.syncPlaceholder();
            window.Repaint();
        }
        else if (idx === 840) { this.save('iconMode', 'vector'); this.loadIcon(); }
        else if (idx === 841) this.selectCustomPng();
        else if (idx === 843) this.save('statusBadge', !this.properties.statusBadge);
        else if (idx === 860) this.setColourMode('normalTextMode', QS_COLOUR_DEFAULT);
        else if (idx === 861) this.setColourMode('normalTextMode', QS_COLOUR_CUSTOM);
        else if (idx === 862) this.editCustomColour('normalTextMode', 'normalTextCustom', 'Quick Search - Normal text colour');
        else if (idx === 863) this.setColourMode('normalBackgroundMode', QS_COLOUR_DEFAULT);
        else if (idx === 864) this.setColourMode('normalBackgroundMode', QS_COLOUR_CUSTOM);
        else if (idx === 865) this.editCustomColour('normalBackgroundMode', 'normalBackgroundCustom', 'Quick Search - Normal background colour');
        else if (idx === 866) this.setColourMode('errorTextMode', QS_COLOUR_DEFAULT);
        else if (idx === 867) this.setColourMode('errorTextMode', QS_COLOUR_CUSTOM);
        else if (idx === 868) this.editCustomColour('errorTextMode', 'errorTextCustom', 'Quick Search - Error text colour');
        else if (idx === 869) this.setColourMode('errorBackgroundMode', QS_COLOUR_DEFAULT);
        else if (idx === 870) this.setColourMode('errorBackgroundMode', QS_COLOUR_CUSTOM);
        else if (idx === 871) this.editCustomColour('errorBackgroundMode', 'errorBackgroundCustom', 'Quick Search - Error background colour');
        else if (idx >= 850 && idx <= 852) this.save('frame', idx - 850);
        else if (idx === 900) this.recallLast(QS_RESULT_NEW_PLAYLIST);
        else if (idx === 901) this.recallLast(QS_RESULT_NEW_AUTOPLAYLIST);
        else if (idx === 902) { try { if (plman.ActivePlaylist >= 0 && plman.IsAutoPlaylist(plman.ActivePlaylist)) plman.ShowAutoPlaylistUI(plman.ActivePlaylist); } catch (autoPlaylistEditError) {} }
        else if (idx === 999) this.resetConfiguration();
        window.Repaint();
    };

    this.contextSearch = function (payload) {
        if (!payload || typeof payload !== 'object') return false;
        var text = quickSearchNormaliseText(payload.text);
        if (!text) return false;
        if (this.properties.removeParentheses) text = text.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
        if (payload.tagName && this.tagByName(payload.tagName)) this.save('tagName', payload.tagName);
        this.input.text = text;
        this.input.default_text = text;
        this.input.Cpos = text.length;
        this.input.SelBegin = text.length;
        this.input.SelEnd = text.length;
        this.save('source', QS_SOURCE_LIBRARY);
        this.save('match', QS_MATCH_EXACT);
        this.execute({ source: QS_SOURCE_LIBRARY, match: QS_MATCH_EXACT });
        return true;
    };

    this.libraryChanged = function () {
        this.libraryCacheRevision++;
        this.cache = Object.create(null);
        if (this.properties.autoSearch && this.properties.source === QS_SOURCE_LIBRARY) this.textChanged();
    };

    this.playlistChanged = function (playlistIndex) {
        var active = plman.ActivePlaylist;
        if (playlistIndex < 0 && this.properties.standardLockOwned && this.ownedStandardPlaylistIndex() < 0) this.clearStandardLockOwnership();
        if (this.properties.source === QS_SOURCE_INLINE && (playlistIndex < 0 || playlistIndex === active)) {
            this.inlineMatches = [];
            this.inlineCursor = -1;
        }
        if (!this.properties.autoSearch) return;
        if ((this.properties.source === QS_SOURCE_PLAYLIST || this.properties.source === QS_SOURCE_INLINE) && playlistIndex === active) this.textChanged();
        else if (this.properties.source === QS_SOURCE_ALL_PLAYLISTS) this.textChanged();
    };

    this.dispose = function () {
        if (this.autoTimer) window.ClearTimeout(this.autoTimer);
        this.autoTimer = 0;
        quickSearchSafeDispose(this.icon);
        this.icon = null;
        try { utils.RemovePath(DARKONE_QUICKSEARCH_CONTEXT_FILE); } catch (e) {}
    };

}
