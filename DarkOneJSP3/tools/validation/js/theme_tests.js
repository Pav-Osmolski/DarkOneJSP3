"use strict";

suite("optional theme callback guards", function () {
    const fs = require("fs");
    const vm = require("vm");
    const playlistMain = fs.readFileSync(__path("user-components-x64/foo_jscript_panel3/samples/jsplaylist/main.js"), "utf8");
    function extract(source, name) {
        const match = source.match(new RegExp("function " + name + "\\([^]*?\\n}"));
        if (!match) throw new Error("Missing " + name);
        return match[0];
    }
    let paints = 0, colours = 0, wallpaper = 0, buttons = 0;
    const settings = {"JSPLAYLIST.Enable Custom Colours": true};
    const ctx = {
        properties: {enableDynamicColours: false, enableCustomColours: false, showwallpaper: false, wallpaperblurred: false, wallpaperpath: ""},
        window: {GetProperty(k, d) { return k in settings ? settings[k] : d; }, Repaint() { paints++; }},
        get_colours() { colours++; }, update_wallpaper() { wallpaper++; },
        p: {}, cList: {free_scroll_offset: 7}, selectedTracks: [1, 7, 15]
    };
    ["topBar", "headerBar", "scrollbar", "playlistManager", "settings"].forEach(key =>
        ctx.p[key] = {setButtons() { buttons++; }, setCursorButton() { buttons++; }});
    vm.createContext(ctx);
    vm.runInContext(extract(playlistMain, "refresh_playlist_theme_colours") + "\n" + extract(playlistMain, "jsp3EnhancedRefreshTheme"), ctx);
    if (!ctx.jsp3EnhancedRefreshTheme(["js-playlist"]) || paints !== 1 || colours !== 1 || buttons !== 6 || wallpaper !== 0 ||
            !ctx.properties.enableCustomColours || ctx.cList.free_scroll_offset !== 7 || ctx.selectedTracks.length !== 3)
        throw new Error("Playlist live theme refresh rebuilt wallpaper or lost scroll/selection state");
    settings["JSPLAYLIST.Show Wallpaper"] = true;
    ctx.jsp3EnhancedRefreshTheme(["js-playlist"]);
    if (wallpaper !== 1 || !ctx.properties.showwallpaper) throw new Error("Changed wallpaper was not refreshed");
    ctx.jsp3EnhancedRefreshTheme(["js-playlist"]);
    if (wallpaper !== 1) throw new Error("Unchanged wallpaper was regenerated");

    // Exercise the real settings button lifecycle: a stubbed setButtons hid
    // the regression where live recolouring erased every settings tab.
    const settingsSource = fs.readFileSync(__path("user-components-x64/foo_jscript_panel3/samples/jsplaylist/settings.js"), "utf8");
    const graphics = {DrawRectangle() {}, WriteTextSimple() {}, FillRectangle() {}};
    const imageFactory = () => ({GetGraphics() { return graphics; }, ReleaseGraphics() {}});
    Object.assign(ctx, {
        utils: {CreateImage: imageFactory},
        DarkOnePerformance: {disposeUnique() {}, dispose(img) { if (img) img.disposed = true; }},
        setAlpha(c) { return c; }, scale(n) { return n; }, g_colour_text: 123,
        g_font_12_bold: "font", cSettings: {tabPaddingWidth: 20, topBarHeight: 40},
        cHeaderBar: {borderWidth: 1}, createSettingsBackArrow: imageFactory,
        ButtonStates: {normal: 0, hover: 1}, full_repaint() {},
        button: function (a, b, c) { this.img = [a, b, c]; this.checkstate = () => this.state || 0; },
        oPage: function (id, name, label) { this.label = label; this.elements = []; this.setSize = function () {}; }
    });
    vm.runInContext('String.prototype.calc_width2 = function () { return 80; };\n' + extract(settingsSource, "oSettings"), ctx);
    ctx.p.settings = new ctx.oSettings();
    ctx.p.settings.setSize(0, 0, 800, 600);
    const pages = ctx.p.settings.pages;
    pages[2].offset = 7;
    pages[2].elements.push({objType: "TB", inputbox: {text: "unsaved edit"}});
    ctx.p.settings.currentPageId = 2;
    for (let pass = 0; pass < 3; pass++) {
        const previousImage = ctx.p.settings.tab_img;
        ctx.jsp3EnhancedRefreshTheme(["js-playlist"]);
        if (ctx.p.settings.tabButtons.length !== 4 || !previousImage.disposed ||
                ctx.p.settings.tabButtons.some(b => b.img.some(img => img !== ctx.p.settings.tab_img || img.disposed)) ||
                ctx.p.settings.pages !== pages || ctx.p.settings.currentPageId !== 2 ||
                pages[2].offset !== 7 || pages[2].elements[0].inputbox.text !== "unsaved edit")
            throw new Error("Live theme refresh lost settings tabs, image ownership or page/edit state");
    }
    ctx.p.settings.tabButtons[1].state = ctx.ButtonStates.hover;
    ctx.p.settings.on_mouse("lbtn_up", 0, 0);
    if (ctx.p.settings.currentPageId !== 1) throw new Error("Recoloured settings tabs cannot be selected");
    ctx.p.settings.setSize(0, 0, 900, 700);
    if (ctx.p.settings.tabButtons.length !== 4) throw new Error("Resize duplicated settings tabs");

    const managerSource = fs.readFileSync(__path("user-components-x64/foo_jscript_panel3/samples/smooth/jsspm.js"), "utf8");
    let metrics = 0;
    const manager = {ppt: {showFilterBox: true, filterBoxWidth: 300, defaultRowHeight: 32},
        window: {GetProperty(k, d) { return k === "SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT" ? 32 : d; }},
        clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }, get_colours() {},
        brw: {rows: [1, 2], scrollbar: {setNewColours() {}}, repaint() {}},
        get_metrics() { metrics++; }, g_filterbox: {cancel_edit() { throw new Error("Unexpected filter reset"); }}};
    vm.createContext(manager);
    vm.runInContext(extract(managerSource, "jsp3EnhancedRefreshTheme"), manager);
    if (!manager.jsp3EnhancedRefreshTheme(["playlist-manager"]) || metrics !== 0 || manager.brw.rows.length !== 2)
        throw new Error("Manager colour refresh rebuilt geometry or playlist rows");
    manager.ppt.defaultRowHeight = 26;
    manager.jsp3EnhancedRefreshTheme(["playlist-manager"]);
    if (metrics !== 1) throw new Error("Manager theme row spacing was not refreshed");

    const entries = [
        "DarkOneJSP3/jscript/js/Panel_Control_Left.js",
        "DarkOneJSP3/jscript/js/Panel_Control_Right.js",
        "DarkOneJSP3/jscript/js/Panel_Display.js",
        "DarkOneJSP3/jscript/DarkOneJSP3 - Quick Search.txt",
        "DarkOneJSP3/jscript/DarkOneJSP3 - Queue Viewer.txt"
    ];
    entries.forEach(function (entry) {
        const source = fs.readFileSync(__path(entry), "utf8");
        if (!/typeof darkOneJsp3HandleTheme == ['"]function['"]\s*&&/.test(source))
            throw new Error(entry + " calls the optional theme handler without a runtime guard");
    });
    const inPlaceRefreshes = {
        "DarkOneJSP3/jscript/js/Panel_Control_Left.js": {
            callback: "darkOneRefreshControlLeftTheme",
            tokens: ["get_colours();", "buttonsOptions();", "darkOneApplyBottomAreaAppearance(false);",
                "buttonsSizes();", "buttonsRefresh();"]
        },
        "DarkOneJSP3/jscript/js/Panel_Control_Right.js": {
            callback: "darkOneRefreshControlRightTheme",
            tokens: ["get_colours();", "buttonsOptions();", "darkOneApplyBottomAreaAppearance(false);",
                "buttonsSizes();", "buttonsRefresh();"]
        },
        "DarkOneJSP3/jscript/js/Panel_Display.js": {
            callback: "darkOneRefreshDisplayTheme",
            tokens: ["get_colours();", "display_system.display_style =",
                "darkOneApplyBottomAreaAppearance(false);", "display_system.initPos();", "display_system.setPBTime();"]
        },
        "DarkOneJSP3/jscript/DarkOneJSP3 - Quick Search.txt": {
            callback: "darkOneRefreshQuickSearchTheme",
            tokens: ["return !!quickSearch && quickSearch.refreshTheme(change) === true;"]
        }
    };
    Object.keys(inPlaceRefreshes).forEach(function (entry) {
        const source = fs.readFileSync(__path(entry), "utf8");
        const contract = inPlaceRefreshes[entry];
        if (!source.includes("DARKONEJSP3_RESET_ROLE, " + contract.callback))
            throw new Error(entry + " does not opt into the in-place Theme Apply refresh");
        const callbackSource = source.match(new RegExp("function " + contract.callback + "\\([^]*?\\n}"));
        if (!callbackSource) throw new Error(entry + " lacks its refresh function");
        contract.tokens.forEach(function (token) {
            if (!callbackSource[0].includes(token))
                throw new Error(entry + " has an incomplete in-place Theme Apply refresh: " + token);
        });
    });
    const quickSearchSource = fs.readFileSync(__path("DarkOneJSP3/jscript/js/Quick_Search.js"), "utf8");
    ["this.refreshTheme = function (change)", "this.parentBackgroundState = change && change.bottomState ?",
        "this.coloursChanged();", "this.size(this.w, this.h);", "this.layoutCommand();"].forEach(function (token) {
        if (!quickSearchSource.includes(token))
            throw new Error("Quick Search has an incomplete in-place Theme Apply refresh: " + token);
    });
});

suite("theme format validation", function () {
    const fs = require("fs");
    const vm = require("vm");
    global.fb = { ProfilePath: "C:\\profile\\" };
    vm.runInThisContext(fs.readFileSync(__path("DarkOneJSP3/shared/theme_engine.js"), "utf8"));
    const source = fs.readFileSync(__path("DarkOneJSP3/themes/Default.json"), "utf8");
    const theme = DarkOneTheme.parse(source);
    function assert(value, message) { if (!value) throw new Error(message); }
    assert(theme.name === "New Default", "Bundled default theme name changed");
    assert(DarkOneTheme.validate(theme).valid, "Default theme is invalid");
    const revival = DarkOneTheme.parse(fs.readFileSync(__path("DarkOneJSP3/themes/DarkOne v4 Revival.json"), "utf8"));
    assert(DarkOneTheme.validate(revival).valid && revival.name === "DarkOne v4 Modern",
        "Bundled Revival theme is invalid or its supplied display name changed");
    assert(DarkOneTheme.stringify(theme).endsWith("\n"), "Theme JSON lacks final newline");
    assert(DarkOneTheme.colour("#FF298FCC") === 0xff298fcc, "ARGB parsing failed");
    assert(DarkOneTheme.colour("#298FCC") === 0xff298fcc, "RGB parsing failed");
    assert(DarkOneTheme.colour("#GG0000") === undefined, "Invalid colour was accepted");
    assert(!DarkOneTheme.validate({format: "wrong", formatVersion: 1, name: "x", appearance: {}}).valid,
        "Wrong format marker was accepted");
    const badName = JSON.parse(source); badName.name = "bad\nname";
    assert(!DarkOneTheme.validate(badName).valid, "Control characters in a theme name were accepted");
});

suite("theme role allow-list and clamping", function () {
    const fs = require("fs");
    const vm = require("vm");
    global.fb = { ProfilePath: "C:\\profile\\" };
    const values = {};
    const notifications = [];
    const stageTimers = [];
    let reloads = 0;
    let repaints = 0;
    global.window = {
        GetProperty(name, fallback) { return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : fallback; },
        SetProperty(name, value) { values[name] = value; },
        NotifyOthers(name, data) { notifications.push([name, data]); },
        SetTimeout(fn) { stageTimers.push(fn); return stageTimers.length; },
        ClearTimeout(id) { if (id > 0 && id <= stageTimers.length) stageTimers[id - 1] = null; },
        Reload() { reloads++; },
        Repaint() { repaints++; }
    };
    vm.runInThisContext(fs.readFileSync(__path("DarkOneJSP3/shared/theme_engine.js"), "utf8"));
    const theme = JSON.parse(fs.readFileSync(__path("DarkOneJSP3/themes/Default.json"), "utf8"));
    theme.appearance.typography.controlScale = 99;
    theme.appearance.controls.roundness = -50;
    theme.appearance.controls.buttonStyle = 99;
    theme.appearance.palette.untrustedProperty = "ignored";
    DarkOneTheme.apply(theme, "control-left");
    function assert(value, message) { if (!value) throw new Error(message); }
    assert(values["DARKONEJSP3.FONT.SCALE"] === 2, "Control scale was not clamped");
    assert(values["DARKONEJSP3.BUTTON.ROUNDNESS"] === -1, "Roundness was not clamped");
    assert(values["Buttons appearance preset"] === 5, "Button style was not clamped to its real 1-5 range");
    assert(!Object.prototype.hasOwnProperty.call(values, "untrustedProperty"), "Unknown field escaped the allow-list");
    const unchangedDetail = DarkOneTheme.applyDetailed(theme, "control-left");
    assert(unchangedDetail.changed === false && unchangedDetail.names.length === 0,
        "Detailed theme apply reported unchanged properties as changed");
    values["DARKONEJSP3.FONT.SCALE"] = 1;
    let refreshedDetail = null;
    assert(darkOneJsp3HandleTheme(DARKONEJSP3_THEME_NOTIFICATION,
            DarkOneTheme.stringify(theme), "control-left", function (detail) {
                refreshedDetail = detail;
                return true;
            }) && refreshedDetail && refreshedDetail.changed &&
            refreshedDetail.names.indexOf("DARKONEJSP3.FONT.SCALE") >= 0 && reloads === 0,
        "Successful in-place Theme Apply did not suppress the panel reload");
    const repaintBeforeUnchanged = repaints;
    refreshedDetail = null;
    darkOneJsp3HandleTheme(DARKONEJSP3_THEME_NOTIFICATION,
        DarkOneTheme.stringify(theme), "control-left", function (detail) {
            refreshedDetail = detail;
            return true;
        });
    assert(refreshedDetail === null && repaints === repaintBeforeUnchanged + 1 && reloads === 0,
        "Unchanged Theme Apply did not use the lightweight repaint path");
    values["DARKONEJSP3.FONT.SCALE"] = 1;
    darkOneJsp3HandleTheme(DARKONEJSP3_THEME_NOTIFICATION,
        DarkOneTheme.stringify(theme), "control-left", function () { return false; });
    assert(reloads === 1, "A declined in-place Theme Apply did not fall back to reload");
    values["DARKONEJSP3.FONT.SCALE"] = 1;
    darkOneJsp3HandleTheme(DARKONEJSP3_THEME_NOTIFICATION,
        DarkOneTheme.stringify(theme), "control-left", function () {});
    assert(reloads === 2, "An ambiguous in-place Theme Apply result suppressed the safe reload fallback");
    values["DARKONEJSP3.FONT.SCALE"] = 1;
    darkOneJsp3HandleTheme(DARKONEJSP3_THEME_NOTIFICATION,
        DarkOneTheme.stringify(theme), "control-left", function () {
            throw new Error("injected refresh failure");
        });
    assert(reloads === 3, "A failed in-place Theme Apply did not fall back to reload");
    values["DARKONEJSP3.FONT.SCALE"] = 1;
    let stagedRefreshes = 0;
    const stagedAt = Date.now();
    const stagedPayload = DarkOneTheme.stage(theme, "stage-first", stagedAt, stagedAt + 50);
    assert(DarkOneTheme.parseStage(stagedPayload, stagedAt) &&
        darkOneJsp3HandleTheme(DARKONEJSP3_THEME_STAGE_NOTIFICATION,
            stagedPayload, "control-left", function () { stagedRefreshes++; return true; }) &&
        values["DARKONEJSP3.FONT.SCALE"] === 2 && stagedRefreshes === 0 && stageTimers.length === 1,
        "Theme stage did not update properties without painting before its boundary");
    stageTimers[0]();
    assert(stagedRefreshes === 1 && darkOneJsp3PendingThemeStage === null,
        "Theme stage did not refresh once at its acknowledged boundary");
    values["DARKONEJSP3.FONT.SCALE"] = 1;
    const flushAt = Date.now();
    const flushPayload = DarkOneTheme.stage(theme, "stage-flush", flushAt, flushAt + 50);
    const repaintsBeforeStageFlush = repaints;
    darkOneJsp3HandleTheme(DARKONEJSP3_THEME_STAGE_NOTIFICATION,
        flushPayload, "control-left", function () { stagedRefreshes++; return true; });
    darkOneJsp3HandleTheme(DARKONEJSP3_THEME_NOTIFICATION,
        DarkOneTheme.stringify(theme), "control-left", function () { stagedRefreshes++; return true; });
    assert(stagedRefreshes === 2 && darkOneJsp3PendingThemeStage === null &&
        repaints === repaintsBeforeStageFlush,
        "Matching Theme Apply did not flush its staged cache refresh or avoid a duplicate repaint");
    values["DARKONEJSP3.FONT.SCALE"] = 1;
    const rapidTheme = JSON.parse(JSON.stringify(theme));
    rapidTheme.appearance.typography.controlScale = 0.75;
    const rapidAt = Date.now();
    let rapidStageRefreshes = 0;
    darkOneJsp3HandleTheme(DARKONEJSP3_THEME_STAGE_NOTIFICATION,
        DarkOneTheme.stage(theme, "stage-obsolete", rapidAt, rapidAt + 50),
        "control-left", function () { rapidStageRefreshes++; return true; });
    const obsoleteStageTimerId = darkOneJsp3ThemeStageTimer;
    darkOneJsp3HandleTheme(DARKONEJSP3_THEME_STAGE_NOTIFICATION,
        DarkOneTheme.stage(rapidTheme, "stage-current", rapidAt, rapidAt + 60),
        "control-left", function () { rapidStageRefreshes++; return true; });
    const currentStageTimerId = darkOneJsp3ThemeStageTimer;
    assert(stageTimers[obsoleteStageTimerId - 1] === null && currentStageTimerId !== obsoleteStageTimerId &&
        values["DARKONEJSP3.FONT.SCALE"] === 0.75,
        "A rapid Theme stage did not cancel and supersede its obsolete predecessor");
    stageTimers[currentStageTimerId - 1]();
    assert(rapidStageRefreshes === 1 && darkOneJsp3PendingThemeStage === null &&
        DarkOneTheme.stage(theme, "invalid id", rapidAt, rapidAt + 50) === "",
        "Rapid Theme staging refreshed an obsolete theme or accepted an unsafe id");
    darkOneJsp3DisposeThemeStage();
    // Two identical requests still need the refresh prepared by the first.
    values["DARKONEJSP3.FONT.SCALE"] = 1;
    let identicalRefreshes = 0;
    let identicalDetail;
    function identicalRefresh(detail) { identicalRefreshes++; identicalDetail = detail; return true; }
    darkOneJsp3HandleTheme(DARKONEJSP3_THEME_STAGE_NOTIFICATION,
        DarkOneTheme.stage(theme, "identical-first", rapidAt, rapidAt + 50), "control-left", identicalRefresh);
    const identicalOldTimer = darkOneJsp3ThemeStageTimer;
    darkOneJsp3HandleTheme(DARKONEJSP3_THEME_STAGE_NOTIFICATION,
        DarkOneTheme.stage(theme, "identical-second", rapidAt, rapidAt + 60), "control-left", identicalRefresh);
    assert(stageTimers[identicalOldTimer - 1] === null && darkOneJsp3PendingThemeStage,
        "Identical supersession discarded the pending cache refresh");
    stageTimers[darkOneJsp3ThemeStageTimer - 1]();
    assert(identicalRefreshes === 1 && identicalDetail.names.includes("DARKONEJSP3.FONT.SCALE"),
        "Identical supersession lost dirty property names");
    darkOneJsp3DisposeThemeStage();
    vm.runInThisContext(fs.readFileSync(__path("DarkOneJSP3/shared/colour_utils.js"), "utf8"));
    vm.runInThisContext(fs.readFileSync(__path("DarkOneJSP3/shared/jsplitter_protocols.js"), "utf8"));
    const stagedBottom = DarkOneProtocol.bottomArea.state(2, 0xff000000, false, 4, 0xff000000, true, 0, "paint-stage");
    const coordinatedStage = DarkOneTheme.stage(theme, "paint-stage", rapidAt, rapidAt + 75, stagedBottom);
    assert(DarkOneTheme.parseStage(coordinatedStage, rapidAt), "Coordinated stage failed to parse");
    const malformedStage = JSON.parse(coordinatedStage);
    malformedStage.bottomState.revision = "wrong";
    assert(!DarkOneTheme.parseStage(JSON.stringify(malformedStage), rapidAt),
        "Coordinated stage accepted a different bottom revision");
    darkOneJsp3HandleTheme(DARKONEJSP3_THEME_STAGE_NOTIFICATION, coordinatedStage, "control-left", identicalRefresh);
    const watchdog = darkOneJsp3ThemeStageTimer;
    const commit = DarkOneProtocol.bottomArea.commit("paint-stage", rapidAt, rapidAt + 75, stagedBottom);
    assert(darkOneJsp3HandleTheme("DarkOneJSP3.BottomArea.Commit",
        DarkOneProtocol.bottomArea.serialiseCommit(commit), "control-left", identicalRefresh),
        "Coordinated commit was not consumed by the theme stage");
    assert(stageTimers[watchdog - 1] === null, "Coordinated commit retained a competing watchdog");
    stageTimers[darkOneJsp3ThemeStageTimer - 1]();
    assert(notifications.length === 0, "Commit claimed a paint before its paint callback");
    darkOneJsp3ThemePainted();
    darkOneJsp3ThemePainted();
    assert(notifications.length === 1 && JSON.parse(notifications[0][1]).id === "paint-stage",
        "Paint callback omitted or duplicated its request-bound receipt");
    notifications.length = 0;
    darkOneJsp3DisposeThemeStage();
    values["DARKONEJSP3.FONT.SCALE"] = 1.35;
    const capturedControl = DarkOneTheme.capture(theme, "control-left");
    assert(capturedControl["appearance.typography.controlScale"] === 1.35,
        "Reverse theme adapter did not read the current role-owned property");
    const trimmedTheme = JSON.parse(JSON.stringify(theme));
    delete trimmedTheme.appearance.typography.controlScale;
    assert(DarkOneTheme.capture(trimmedTheme, "control-left")["appearance.typography.controlScale"] === 1.35,
        "Reverse theme adapter could not restore a live setting omitted from a manual JSON draft");
    const captureQuery = DarkOneTheme.captureQuery(theme, "capture-role", Date.now());
    assert(darkOneJsp3HandleTheme(DARKONEJSP3_THEME_CAPTURE_QUERY_NOTIFICATION,
            captureQuery, "control-left") && notifications.length === 1,
        "Theme capture query was not handled by a project panel");
    const capturedResponse = DarkOneTheme.parseCaptureResponse(notifications[0][1], "capture-role");
    assert(capturedResponse && capturedResponse.role === "control-left" &&
        capturedResponse.values["appearance.typography.controlScale"] === 1.35,
        "Project-panel capture response did not round-trip");
    values["DarkOneJSP3.InfoStack.Tab.ThemeManager.Visible"] = false;
    const capturedInfoStack = DarkOneTheme.capture(theme, "info-stack");
    assert(capturedInfoStack["appearance.infoStack.tabs.ThemeManager.visible"] === false,
        "Reverse InfoStack adapter confused Theme availability with saved tab visibility");
    const queue = DarkOneTheme.roleProperties(theme, "queue-viewer");
    assert(queue["DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR"] === 0xff181818,
        "Queue page palette mapping failed");
    assert(queue["DARKONEJSP3.PAGE.SELECTED.BACKGROUND.CUSTOM.COLOUR"] === 0xff303030,
        "Queue selection mapping failed");
    theme.appearance.quickSearch.customText = "#FFDCDCDC";
    theme.appearance.quickSearch.customBackground = "#FF000000";
    theme.appearance.quickSearch.customBorder = "#FF000000";
    theme.appearance.quickSearch.fixedFontSize = 0;
    theme.appearance.quickSearch.automaticFontScale = 100;
    const quickSearch = DarkOneTheme.roleProperties(theme, "quick-search");
    assert(quickSearch["DARKONEJSP3.QUICKSEARCH.COLOUR.NORMAL.TEXT.CUSTOM"] === 0xffdcdcdc &&
        quickSearch["DARKONEJSP3.QUICKSEARCH.COLOUR.NORMAL.BACKGROUND.CUSTOM"] === 0xff000000 &&
        quickSearch["DARKONEJSP3.QUICKSEARCH.COLOUR.BORDER.CUSTOM"] === 0xff000000 &&
        quickSearch["DARKONEJSP3.QUICKSEARCH.FONT.SIZE"] === 0 &&
        quickSearch["DARKONEJSP3.QUICKSEARCH.FONT.AUTO.SCALE"] === 100,
        "Quick Search dedicated colours or font settings were not mapped");
    values["DarkOneJSP3.InfoStack.AutoFontScale"] = 80;
    values["DARKONEJSP3.QUICKSEARCH.FONT.SIZE"] = 17;
    values["DARKONEJSP3.QUICKSEARCH.FONT.AUTO.SCALE"] = 125;
    const capturedInfoScale = DarkOneTheme.capture(theme, "info-stack");
    const capturedQuickSearchScale = DarkOneTheme.capture(theme, "quick-search");
    assert(capturedInfoScale["appearance.infoStack.automaticFontScale"] === 80 &&
        capturedQuickSearchScale["appearance.quickSearch.fixedFontSize"] === 17 &&
        capturedQuickSearchScale["appearance.quickSearch.automaticFontScale"] === 125 &&
        !Object.prototype.hasOwnProperty.call(capturedQuickSearchScale, "appearance.infoStack.automaticFontScale"),
        "InfoStack and Quick Search font scales were not captured independently");
    const playlist = DarkOneTheme.roleProperties(theme, "js-playlist");
    assert(playlist["JSPLAYLIST.Enable Dynamic Colours"] === false &&
        playlist["JSPLAYLIST.Enable Custom Colours"] === true &&
        playlist["JSPLAYLIST.COLOUR.MOOD"] === 0xffc41e23 &&
        playlist["JSPLAYLIST.COLOUR.RATING"] === 0xffff8000,
        "JS Playlist colour type or dedicated colours were not mapped");
    theme.appearance.playlist.colourType = "Dynamic";
    const dynamicPlaylist = DarkOneTheme.roleProperties(theme, "js-playlist");
    assert(dynamicPlaylist["JSPLAYLIST.Enable Dynamic Colours"] === true &&
        dynamicPlaylist["JSPLAYLIST.Enable Custom Colours"] === false,
        "JS Playlist Dynamic mode did not produce mutually exclusive flags");
    delete theme.appearance.playlist.colourType;
    theme.appearance.playlist.customColours = true;
    const legacyPlaylist = DarkOneTheme.roleProperties(theme, "js-playlist");
    assert(legacyPlaylist["JSPLAYLIST.Enable Dynamic Colours"] === false &&
        legacyPlaylist["JSPLAYLIST.Enable Custom Colours"] === true,
        "Legacy playlist customColours themes were not migrated safely");
    const oldTheme = JSON.parse(JSON.stringify(theme));
    ["text", "highlight", "background", "selectedBackground"].forEach(key =>
        delete oldTheme.appearance.playlist[key]);
    delete oldTheme.appearance.quickSearch.customText;
    delete oldTheme.appearance.quickSearch.customBackground;
    delete oldTheme.appearance.quickSearch.customBorder;
    delete oldTheme.appearance.quickSearch.automaticFontScale;
    const oldPlaylistColours = DarkOneTheme.roleProperties(oldTheme, "js-playlist");
    const oldQuickSearchColours = DarkOneTheme.roleProperties(oldTheme, "quick-search");
    assert(oldPlaylistColours["JSPLAYLIST.COLOUR TEXT NORMAL"] === 0xffdcdcdc &&
        oldPlaylistColours["JSPLAYLIST.COLOUR TEXT HIGHLIGHT"] === 0xff298fcc &&
        oldQuickSearchColours["DARKONEJSP3.QUICKSEARCH.COLOUR.NORMAL.TEXT.CUSTOM"] === 0xffdcdcdc &&
        oldQuickSearchColours["DARKONEJSP3.QUICKSEARCH.COLOUR.BORDER.CUSTOM"] === 0xff000000 &&
        oldQuickSearchColours["DARKONEJSP3.QUICKSEARCH.FONT.AUTO.SCALE"] ===
            oldTheme.appearance.infoStack.automaticFontScale,
        "Older WIP themes lost their shared-palette or shared-font-scale fallbacks");
    delete theme.appearance.playlist.customColours;
    theme.appearance.playlist.colourType = "Custom";
    values["JSPLAYLIST.Enable Dynamic Colours"] = true;
    values["JSPLAYLIST.Enable Custom Colours"] = true;
    const capturedPlaylist = DarkOneTheme.capture(theme, "js-playlist");
    assert(capturedPlaylist["appearance.playlist.colourType"] === "Dynamic",
        "JS Playlist capture did not normalise the ambiguous two-switch state to Dynamic");
    values["SMOOTH.DYNAMIC.COLOURS.ENABLED"] = false;
    values["SMOOTH.CUSTOM.COLOURS.ENABLED"] = false;
    const capturedPlaylistManager = DarkOneTheme.capture(theme, "playlist-manager");
    assert(capturedPlaylistManager["appearance.playlistManager.colourType"] === "Off",
        "Playlist Manager capture did not normalise disabled colour switches to Off");
    Object.keys(theme.appearance.infoStack.tabs).forEach(key =>
        theme.appearance.infoStack.tabs[key].visible = false);
    const tabs = DarkOneTheme.roleProperties(theme, "info-stack");
    assert(tabs["DarkOneJSP3.InfoStack.Tab.Playlists.Visible"] === true,
        "Theme mapping allowed every InfoStack tab to be hidden");
    vm.runInThisContext(fs.readFileSync(
        __path("user-components-x64/foo_jscript_panel3/samples/shared/sample_defaults.js"), "utf8"));
    jsp3EnhancedApplyTheme(theme, "album-art");
    assert(values["2K3.PANEL.COLOURS.MODE"] === 0 &&
        values["2K3.PANEL.COLOURS.CUSTOM.BACKGROUND"] === 0xff000000,
        "Standalone Album Art theme mapping failed");
    values["2K3.PANEL.COLOURS.MODE"] = 2;
    const capturedAlbumArt = jsp3EnhancedCaptureTheme(theme, "album-art");
    assert(capturedAlbumArt["appearance.albumArt.backgroundMode"] === 2,
        "Standalone sample reverse adapter did not capture its live property");
    values["JSPLAYLIST.COLOUR.RATING"] = 0xff123456;
    values["JSPLAYLIST.Default Wallpaper Path"] = "";
    const standalonePlaylistCapture = jsp3EnhancedCaptureTheme(theme, "js-playlist");
    const standalonePlaylistResponse = DarkOneTheme.captureResponse(
        "playlist-empty-path", "js-playlist", standalonePlaylistCapture
    );
    const parsedPlaylistResponse = DarkOneTheme.parseCaptureResponse(
        standalonePlaylistResponse, "playlist-empty-path"
    );
    assert(parsedPlaylistResponse &&
        parsedPlaylistResponse.values["appearance.playlist.rating"] === "#FF123456" &&
        parsedPlaylistResponse.values["appearance.pages.wallpaperPath"] === "",
        "An empty optional wallpaper path rejected the complete JS Playlist capture response");
    const pageWithNoWallpaper = DarkOneTheme.roleProperties(theme, "lastfm-bio");
    assert(pageWithNoWallpaper["DARKONEJSP3.PAGE.WALLPAPER.PATH"] === "",
        "The default theme cannot clear a previously configured page wallpaper path");
    theme.appearance.playlistManager.colourType = "Custom";
    jsp3EnhancedApplyTheme(theme, "playlist-manager");
    assert(values["SMOOTH.DYNAMIC.COLOURS.ENABLED"] === false &&
        values["SMOOTH.CUSTOM.COLOURS.ENABLED"] === true &&
        values["SMOOTH.COLOUR.TEXT"] === 0xffffffff,
        "Standalone Playlist Manager adapter did not apply its colour settings");
});

suite("theme command hardening", function () {
    const fs = require("fs");
    const vm = require("vm");
    global.fb = { ProfilePath: "C:\\profile\\" };
    vm.runInThisContext(fs.readFileSync(__path("DarkOneJSP3/shared/theme_engine.js"), "utf8"));
    const theme = JSON.parse(fs.readFileSync(__path("DarkOneJSP3/themes/Default.json"), "utf8"));
    const now = Date.now();
    const raw = DarkOneTheme.command(theme, "test-command", now);
    const parsed = DarkOneTheme.parseCommand(raw, now + 10);
    function assert(value, message) { if (!value) throw new Error(message); }
    assert(parsed && parsed.id === "test-command" && parsed.theme.name === theme.name,
        "Valid command did not round-trip");
    assert(DarkOneTheme.parseCommand(raw, now + 31000) === null, "Expired command was accepted");
    assert(DarkOneTheme.parseCommand("{}", now) === null, "Malformed command was accepted");
    assert(DarkOneTheme.parseCommand("x".repeat(262145), now) === null,
        "Oversized command was accepted");
    const bad = JSON.parse(raw); bad.theme.formatVersion = 999;
    assert(DarkOneTheme.parseCommand(JSON.stringify(bad), now) === null,
        "Unsupported theme format version was accepted");
    const query = DarkOneTheme.captureQuery(theme, "capture-test", now);
    assert(DarkOneTheme.parseCaptureQuery(query, now + 10).id === "capture-test" &&
        DarkOneTheme.parseCaptureQuery(query, now + 6000) === null,
        "Theme capture query expiry or parsing failed");
    const response = DarkOneTheme.captureResponse("capture-test", "display", {
        "appearance.palette.accent": "#FF123456"
    });
    assert(DarkOneTheme.parseCaptureResponse(response, "capture-test").role === "display" &&
        DarkOneTheme.parseCaptureResponse(response, "wrong-id") === null &&
        DarkOneTheme.parseCaptureResponse(JSON.stringify({version:1,id:"capture-test",role:"display",values:{"unsafe.path":1}}), "capture-test") === null &&
        DarkOneTheme.parseCaptureResponse(JSON.stringify({version:1,id:"capture-test",role:"display",values:{"appearance.palette.text":"#FFFFFFFF"}}), "capture-test") === null &&
        DarkOneTheme.captureResponse("bad id", "display", {"appearance.palette.accent":"#FF123456"}) === null,
        "Theme capture response accepted mismatched or unsafe data");
    assert(DarkOneTheme.captureResponse("capture-test", "js-playlist", {
        "appearance.palette.accent": "#FF123456"
    }) === null, "JS Playlist capture still accepts its retired shared-palette path");
    const bundle = DarkOneTheme.captureBundle("capture-test", now, {
        "info-stack": {"appearance.infoStack.tabs.ThemeManager.visible": false}
    });
    const parsedBundle = DarkOneTheme.parseCaptureBundle(bundle, "capture-test", now + 10);
    assert(parsedBundle &&
        parsedBundle.responses["info-stack"]["appearance.infoStack.tabs.ThemeManager.visible"] === false &&
        DarkOneTheme.parseCaptureBundle(bundle, "wrong-id", now + 10) === null &&
        DarkOneTheme.parseCaptureBundle(bundle, "capture-test", now + 6000) === null,
        "Cross-host capture bundle validation or expiry failed");
});

suite("theme manager file-operation guards", function () {
    const fs = require("fs");
    const vm = require("vm");
    const source = fs.readFileSync(__path("DarkOneJSP3/jscript/DarkOneJSP3 - Theme Manager.txt"), "utf8");
    function assert(value, message) { if (!value) throw new Error(message); }
    ["tmValidName", "utils.WriteTextFile", "utils.RemovePath", "Default.json is protected",
        "Default.json cannot be deleted", "DarkOneTheme.stringify", "DARKONEJSP3_THEME_COMMAND_FILE"].forEach(token =>
        assert(source.includes(token), "Theme Manager guard is missing: " + token));
    assert(source.includes("/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i"),
        "Reserved Windows names are not rejected");
    assert(!source.includes("eval("), "Theme Manager must not evaluate theme content");

    const profile = "C:\\profile\\";
    const defaultPath = profile + "DarkOneJSP3\\themes\\Default.json";
    const defaultTheme = fs.readFileSync(__path("DarkOneJSP3/themes/Default.json"), "utf8");
    const files = new Map([[defaultPath, defaultTheme]]);
    const properties = new Map();
    const notifications = [];
    const inputs = [];
    const popupSelections = [];
    const popupMenus = [];
    const timers = [];
    let rejectedWritePath = "";
    let rejectThemeNotification = false;
    global.fb = { ProfilePath: profile };
    global.window = {
        Width: 980, Height: 620, Name: "Theme Manager",
        GetProperty(name, fallback) { return properties.has(name) ? properties.get(name) : fallback; },
        SetProperty(name, value) { properties.set(name, value); },
        NotifyOthers(name, data) {
            if (rejectThemeNotification && name === "DarkOneJSP3.Theme.Apply") throw new Error("transport unavailable");
            notifications.push([name, data]);
        },
        Repaint() {}, SetCursor() {},
        SetTimeout(fn) { timers.push(fn); return timers.length; },
        ClearTimeout(id) { if (id > 0 && id <= timers.length) timers[id - 1] = null; },
        CreatePopupMenu() {
            const menu = {
                items: [], checks: [], separators: 0, disposed: false,
                AppendMenuItem(flags, id, label) { this.items.push([flags, id, label]); },
                AppendMenuSeparator() { this.separators++; },
                CheckMenuItem(id, checked) { this.checks.push([id, !!checked]); },
                TrackPopupMenu() { return popupSelections.length ? popupSelections.shift() : 0; },
                Dispose() { this.disposed = true; }
            };
            popupMenus.push(menu);
            return menu;
        }
    };
    global.utils = {
        CreateFolder() {},
        ListFiles(folder) { return {toArray() { return Array.from(files.keys()).filter(path => path.startsWith(folder) && path.endsWith(".json")); }}; },
        ReadTextFile(path) { if (!files.has(path)) throw new Error("missing"); return files.get(path); },
        WriteTextFile(path, data) {
            if (path === rejectedWritePath) return false;
            files.set(path, String(data));
            return true;
        },
        RemovePath(path) { return files.delete(path); },
        IsFile(path) { return files.has(path); },
        InputBox() { if (!inputs.length) throw new Error("cancel"); return inputs.shift(); },
        MessageBox() { return 6; }
    };
    vm.runInThisContext(fs.readFileSync(__path("DarkOneJSP3/shared/colour_utils.js"), "utf8"));
    vm.runInThisContext(fs.readFileSync(__path("DarkOneJSP3/shared/jsplitter_protocols.js"), "utf8"));
    vm.runInThisContext(fs.readFileSync(__path("DarkOneJSP3/shared/theme_engine.js"), "utf8"));
    vm.runInThisContext(source, {filename: "Theme Manager"});

    assert(tmState.theme.name === JSON.parse(defaultTheme).name && tmState.files.length === 1,
        "Theme Manager did not load Default.json");
    const olderScaleTheme = JSON.parse(defaultTheme);
    delete olderScaleTheme.appearance.quickSearch.fixedFontSize;
    delete olderScaleTheme.appearance.quickSearch.automaticFontScale;
    olderScaleTheme.appearance.infoStack.automaticFontScale = 80;
    const upgradedScaleTheme = tmUpgradeThemeDraft(olderScaleTheme);
    assert(upgradedScaleTheme.appearance.quickSearch.fixedFontSize === 0 &&
        upgradedScaleTheme.appearance.quickSearch.automaticFontScale === 80,
        "Earlier WIP themes did not receive the Quick Search font compatibility defaults");
    olderScaleTheme.appearance.quickSearch = 7;
    assert(typeof tmUpgradeThemeDraft(olderScaleTheme).appearance.quickSearch === "object",
        "Malformed nested Quick Search data was not normalised safely for the editor");
    const availabilityPath = profile + "js_data\\darkonejsp3.theme-manager-availability.json";
    const availability = JSON.parse(files.get(availabilityPath));
    assert(availability.version === "v1" && availability.title === "DOJSP3.ThemeManager" &&
        notifications.some(item => item[0] === "DarkOneJSP3.ThemeManager.Available"),
        "Theme Manager did not publish both optional-child availability transports");
    assert(tmCategories.length === 6 && tmCategories[5].name === "Manager" &&
        tmFields.Manager.length === 4, "Theme Manager self-customisation category is missing");
    assert(tmFields.Colours.some(field => field[1] === "appearance.playlist.colourType" &&
            field[2] === "enum" && field[3].join("|") === "Custom|Dynamic|Off") &&
        tmFields.Colours.some(field => field[1] === "appearance.playlist.mood") &&
        tmFields.Colours.some(field => field[1] === "appearance.playlist.rating") &&
        tmFields.Colours.some(field => field[1] === "appearance.playlistManager.colourType") &&
        tmFields.Controls.some(field => field[1] === "appearance.quickSearch.customBackground") &&
        tmFields.Controls.some(field => field[1] === "appearance.quickSearch.customBorder") &&
        tmFields.Controls.some(field => field[1] === "appearance.quickSearch.fixedFontSize") &&
        tmFields.Controls.some(field => field[1] === "appearance.quickSearch.automaticFontScale") &&
        tmFields.InfoStack.some(field => field[0] === "Tab automatic base scale (%)"),
        "Theme Manager is missing panel-specific playlist, Quick Search or InfoStack fields");
    const roundnessField = tmFields.Controls[2];
    assert(roundnessField[0] === "Button roundness (%)" && roundnessField[2] === "roundness" &&
        tmDisplayValue(roundnessField, -1) === "Automatic" &&
        tmDisplayValue(roundnessField, 33) === "33%",
        "Theme Manager exposes the internal button-roundness sentinel or an ambiguous label");
    tmSet("appearance.controls.roundness", -1);
    popupSelections.push(1);
    tmEdit(roundnessField, 100, 100);
    assert(tmGet("appearance.controls.roundness") === -1 && popupMenus[0].checks.some(item => item[0] === 1 && item[1]) &&
        popupMenus[0].items.map(item => item[2]).join("|") === TM_ROUNDNESS_LABELS.concat(["Custom roundness..."]).join("|") &&
        popupMenus[0].disposed, "Theme Manager roundness menu does not match the TOOLS presets");
    popupSelections.push(4);
    tmEdit(roundnessField, 100, 100);
    assert(tmGet("appearance.controls.roundness") === 33,
        "Theme Manager roundness preset did not store its documented percentage");
    inputs.push("47");
    popupSelections.push(100);
    tmEdit(roundnessField, 100, 100);
    assert(tmGet("appearance.controls.roundness") === 47 && tmDisplayValue(roundnessField, 47) === "47%",
        "Theme Manager custom roundness did not clamp/display a percentage");
    popupSelections.push(1);
    tmEdit(roundnessField, 100, 100);
    const playlistTypeField = tmFields.Colours.filter(field =>
        field[1] === "appearance.playlist.colourType")[0];
    popupSelections.push(2);
    tmEdit(playlistTypeField, 100, 100);
    assert(tmGet("appearance.playlist.colourType") === "Dynamic" &&
        tmDisplayValue(playlistTypeField, "Dynamic") === "Dynamic",
        "Theme Manager colour-type enum did not retain a readable JSON value");
    tmSet("appearance.manager.fixedFontSize", 16);
    assert(JSON.parse(tmFonts.normal).Size === 16,
        "Theme Manager fixed font size was not applied immediately");
    tmSet("appearance.manager.fixedFontSize", 0);
    tmSet("appearance.manager.automaticFontScale", 150);
    assert(JSON.parse(tmFonts.normal).Size === 18 && tmManagerScale() === 1.5,
        "Theme Manager automatic base scale did not resize fonts and geometry");
    [50, 75, 100, 150, 200].forEach(function (managerScale) {
        tmSet("appearance.manager.automaticFontScale", managerScale);
        const rowHeight = tmMetric(48);
        const layout = tmFieldValueLayout("colour", 40, tmMetric(320), 70, rowHeight);
        assert(layout.valueX + layout.valueWidth + layout.gap === layout.swatchX,
            "Colour value and swatch gap drifted at " + managerScale + "% Manager scale");
        assert(layout.swatchX + layout.swatchSize === layout.right,
            "Colour swatch is not right anchored at " + managerScale + "% Manager scale");
        assert(layout.labelX + layout.labelWidth + layout.gap <= layout.valueX,
            "Colour value overlaps its field label at " + managerScale + "% Manager scale");
        assert(layout.swatchY === 70 + Math.round((rowHeight - layout.swatchSize) / 2),
            "Colour swatch is not vertically centred at " + managerScale + "% Manager scale");
    });
    tmState.hits = [];
    tmClippedHit("field", 0, 20, 80, 200, 48, 100, 120);
    assert(tmState.hits.length === 1 && tmState.hits[0].y === 100 && tmState.hits[0].h === 20,
        "Scrolled Theme Manager row hit target was not clipped below the fixed header");
    tmClippedHit("field", 1, 20, 40, 200, 48, 100, 120);
    assert(tmState.hits.length === 1,
        "Fully masked Theme Manager row retained an interactive header-overlap target");
    tmSet("appearance.manager.automaticFontScale", 100);
    tmState.dirty = false;
    const originalAccent = tmGet("appearance.palette.accent");
    const realSetTimeout = window.SetTimeout;
    const draftBeforeTimerFailure = JSON.stringify(tmState.theme);
    window.SetTimeout = function () { throw new Error("timer unavailable"); };
    tmCaptureCurrent();
    window.SetTimeout = realSetTimeout;
    assert(!tmState.capture && tmCaptureTimer === 0 && JSON.stringify(tmState.theme) === draftBeforeTimerFailure,
        "Capture timer failure stranded a request or changed the draft");
    tmCaptureCurrent();
    const captureNotification = notifications.filter(item =>
        item[0] === "DarkOneJSP3.Theme.Capture.Query").pop();
    assert(captureNotification && tmState.capture,
        "Capture current did not issue a bounded snapshot request");
    const captureId = tmState.capture.id;
    on_notify_data("DarkOneJSP3.Theme.Capture.Response", DarkOneTheme.captureResponse(captureId, "control-left", {
        "appearance.typography.controlScale": 1.25
    }));
    on_notify_data("DarkOneJSP3.Theme.Capture.Response", DarkOneTheme.captureResponse(captureId, "control-left", {
        "appearance.typography.controlScale": 1.75
    }));
    on_notify_data("DarkOneJSP3.Theme.Capture.Response", DarkOneTheme.captureResponse(captureId, "display", {
        "appearance.palette.accent": "#FF111111"
    }));
    on_notify_data("DarkOneJSP3.Theme.Capture.Response", DarkOneTheme.captureResponse(captureId, "js-playlist", {
        "appearance.playlist.rating": "#FF123456",
        "appearance.pages.wallpaperPath": ""
    }));
    on_notify_data("DarkOneJSP3.Theme.Capture.Response", DarkOneTheme.captureResponse(captureId, "quick-search", {
        "appearance.quickSearch.fixedFontSize": 17,
        "appearance.quickSearch.automaticFontScale": 125
    }));
    const captureResponsePath = profile + "js_data\\darkonejsp3.theme-capture-response.json";
    files.set(captureResponsePath, DarkOneTheme.captureBundle(captureId, Date.now(), {
        "info-stack": {
            "appearance.infoStack.tabs.ThemeManager.visible": false,
            "appearance.infoStack.automaticFontScale": 80,
            "appearance.palette.accent": "#FF222222"
        }
    }));
    const captureTimer = timers[tmCaptureTimer - 1];
    assert(typeof captureTimer === "function", "Capture current did not schedule bounded aggregation");
    captureTimer();
    assert(tmGet("appearance.typography.controlScale") === 1.25 &&
        tmGet("appearance.infoStack.tabs.ThemeManager.visible") === false &&
        tmGet("appearance.infoStack.automaticFontScale") === 80 &&
        tmGet("appearance.quickSearch.fixedFontSize") === 17 &&
        tmGet("appearance.quickSearch.automaticFontScale") === 125 &&
        tmGet("appearance.playlist.rating") === "#FF123456" &&
        tmGet("appearance.palette.accent") === originalAccent && tmState.dirty &&
        /1 shared setting differed/.test(tmState.status),
        "Capture current did not import independent scales, hidden Theme visibility, preserve first responses, or retain a conflicting shared field");
    assert(!files.has(captureResponsePath) &&
        !files.has(profile + "js_data\\darkonejsp3.theme-capture-query.json"),
        "Completed Capture current left its cross-host runtime files behind");
    assert(tmValidName("../escape") === null && tmValidName("CON") === null &&
        tmValidName("safe-theme") === "safe-theme", "Theme filename validation failed");
    const nameBeforeFailedSave = tmState.theme.name;
    rejectedWritePath = profile + "DarkOneJSP3\\themes\\Write Failure.json";
    inputs.push("Write Failure");
    tmSaveAs();
    assert(tmState.theme.name === nameBeforeFailedSave && tmState.selectedFile === "Default.json" &&
        !files.has(rejectedWritePath), "Failed Save as mutated the live Theme Manager state");
    rejectedWritePath = "";
    const authorField = tmFields.Manager.filter(f => f[1] === "author")[0];
    const descriptionField = tmFields.Manager.filter(f => f[1] === "description")[0];
    const metadataDescription = 'A longer description with "quotes", Unicode: café, and ' + "detail ".repeat(40);
    inputs.push("Test author", metadataDescription);
    tmEdit(authorField, 0, 0);
    tmEdit(descriptionField, 0, 0);
    assert(tmState.theme.author === "Test author" && tmState.theme.description === metadataDescription && tmState.dirty,
        "Theme metadata editing failed or truncated a long description");
    tmState.dirty = false;
    inputs.push(null, undefined, metadataDescription);
    tmEdit(authorField, 0, 0);
    tmEdit(descriptionField, 0, 0);
    tmEdit(descriptionField, 0, 0);
    tmEdit(authorField, 0, 0); // thrown cancellation
    assert(!tmState.dirty && tmState.theme.author === "Test author" && tmState.theme.description === metadataDescription,
        "Cancelled or unchanged metadata edit changed the draft");
    inputs.push("x".repeat(2049));
    tmEdit(descriptionField, 0, 0);
    assert(tmState.theme.description === metadataDescription && !tmState.dirty,
        "Oversized description was silently truncated or replaced the draft");
    inputs.push("");
    tmEdit(authorField, 0, 0);
    assert(tmState.theme.author === "", "Theme author cannot be cleared");
    inputs.push("Test author");
    tmEdit(authorField, 0, 0);
    inputs.push("Blue Test");
    tmSaveAs();
    assert(files.has(profile + "DarkOneJSP3\\themes\\Blue Test.json"),
        "Save as did not create readable JSON");
    const savedMetadata = DarkOneTheme.parse(files.get(profile + "DarkOneJSP3\\themes\\Blue Test.json"));
    assert(savedMetadata.author === "Test author" && savedMetadata.description === metadataDescription,
        "Theme metadata did not survive Save as and JSON reload");
    inputs.push("Renamed Test");
    tmRename();
    assert(files.has(profile + "DarkOneJSP3\\themes\\Renamed Test.json") &&
        !files.has(profile + "DarkOneJSP3\\themes\\Blue Test.json"),
        "Rename was not write-before-remove");
    tmApply();
    const submittedName = tmState.theme.name;
    const submittedBackground = tmState.theme.appearance.bottomArea.backgroundMode;
    tmState.theme.name = "Edited while applying";
    tmState.theme.appearance.bottomArea.backgroundMode = 4;
    tmCaptureCurrent();
    assert(!tmState.capture, "Capture read partially applied panel settings");
    const appliedBottomState = DarkOneProtocol.bottomArea.parseState(
        files.get(profile + "js_data\\darkonejsp3.bottom-area-state.txt")
    );
    const appliedBottomCommit = DarkOneProtocol.bottomArea.parseCommit(
        files.get(profile + "js_data\\darkonejsp3.bottom-area-command.txt"), Date.now()
    );
    const themeNotificationsBeforeBoundary = notifications.filter(item =>
        item[0] === "DarkOneJSP3.Theme.Apply").length;
    assert(files.has(profile + "js_data\\darkonejsp3.theme-command.json") &&
        appliedBottomState && appliedBottomState.backgroundMode === 2 &&
        appliedBottomCommit && appliedBottomCommit.id === appliedBottomState.revision &&
        tmApplyAckTimer > 0 && tmApplyTimer === 0 &&
        notifications.every(item => item[0] !== "DarkOneJSP3.Theme.Stage") &&
        themeNotificationsBeforeBoundary === 0,
        "Apply did not wait for Bottom Controls before releasing either host domain");
    const acknowledgedAt = Date.now();
    const acknowledgedCommit = DarkOneProtocol.bottomArea.commit(
        appliedBottomCommit.id,
        acknowledgedAt,
        acknowledgedAt + 75,
        appliedBottomCommit.state
    );
    files.set(
        profile + "js_data\\darkonejsp3.bottom-area-ack.txt",
        DarkOneProtocol.bottomArea.serialiseCommit(acknowledgedCommit)
    );
    const acknowledgementTimer = timers[tmApplyAckTimer - 1];
    assert(typeof acknowledgementTimer === "function", "Bottom Controls acknowledgement poll was not scheduled");
    acknowledgementTimer();
    const releasedStage = JSON.parse(notifications.filter(item => item[0] === "DarkOneJSP3.Theme.Stage").pop()[1]);
    assert(releasedStage.theme.name === submittedName && releasedStage.theme.appearance.bottomArea.backgroundMode === submittedBackground,
        "Editing the draft changed an in-flight Apply request");
    tmState.theme.name = submittedName;
    tmState.theme.appearance.bottomArea.backgroundMode = submittedBackground;
    const stageNotification = notifications.map(item => item[0]).lastIndexOf(
        "DarkOneJSP3.Theme.Stage"
    );
    const lastBottomCommitNotification = notifications.map(item => item[0]).lastIndexOf(
        DarkOneProtocol.bottomArea.notifications.commit
    );
    assert(stageNotification >= 0 && lastBottomCommitNotification > stageNotification &&
        tmApplyAckTimer === 0 && tmApplyTimer > 0 &&
        !files.has(profile + "js_data\\darkonejsp3.bottom-area-ack.txt"),
        "Acknowledgement did not stage theme values before releasing the shared repaint commit");
    const applyBoundaryTimer = timers[tmApplyTimer - 1];
    assert(typeof applyBoundaryTimer === "function", "Theme notification was not scheduled for the coordinated apply boundary");
    applyBoundaryTimer();
    assert(notifications.every(item => item[0] !== "DarkOneJSP3.Theme.Apply"),
        "Wider theme delivery ran before bottom paint receipts");
    on_notify_data("DarkOneJSP3.Theme.Painted", JSON.stringify({id: "obsolete", role: "display"}));
    assert(!tmBottomPaints.display, "An obsolete paint receipt released a newer apply");
    function completeBottomPaints(id) {
        files.set(profile + "js_data\\darkonejsp3.bottom-area-painted.txt", id);
        ["control-left", "control-right", "display", "quick-search"].forEach(role =>
            on_notify_data("DarkOneJSP3.Theme.Painted", JSON.stringify({id, role})));
    }
    completeBottomPaints(appliedBottomCommit.id);
    timers[tmApplyTimer - 1]();
    const lastThemeNotification = notifications.map(item => item[0]).lastIndexOf("DarkOneJSP3.Theme.Apply");
    assert(lastThemeNotification > lastBottomCommitNotification,
        "The wider theme notification did not follow the bottom-area commit boundary");
    rejectedWritePath = profile + "js_data\\darkonejsp3.bottom-area-state.txt";
    tmApply();
    assert(/^Theme was not applied: bottom-area state bridge write failed/.test(tmState.status) &&
        !files.has(profile + "js_data\\darkonejsp3.theme-command.json") &&
        !files.has(profile + "js_data\\darkonejsp3.bottom-area-command.txt"),
        "A failed bottom-area bridge write left a partial theme or commit command active");
    rejectedWritePath = "";
    rejectThemeNotification = true;
    tmApply();
    const rejectedRequest = DarkOneProtocol.bottomArea.parseCommit(
        files.get(profile + "js_data\\darkonejsp3.bottom-area-command.txt"), Date.now()
    );
    const rejectedAckAt = Date.now();
    files.set(
        profile + "js_data\\darkonejsp3.bottom-area-ack.txt",
        DarkOneProtocol.bottomArea.serialiseCommit(DarkOneProtocol.bottomArea.commit(
            rejectedRequest.id, rejectedAckAt, rejectedAckAt + 75, rejectedRequest.state
        ))
    );
    const rejectedAckTimer = timers[tmApplyAckTimer - 1];
    rejectedAckTimer();
    const rejectedNotificationTimer = timers[tmApplyTimer - 1];
    assert(typeof rejectedNotificationTimer === "function",
        "Best-effort theme notification was not scheduled");
    completeBottomPaints(rejectedRequest.id);
    rejectedNotificationTimer();
    assert(/^Applied /.test(tmState.status),
        "Best-effort notification failure falsely reported a persisted theme command as failed");
    rejectThemeNotification = false;

    const externalTheme = JSON.parse(defaultTheme);
    externalTheme.appearance.manager.fixedFontSize = 0;
    externalTheme.appearance.manager.automaticFontScale = 150;
    on_notify_data("DarkOneJSP3.Theme.Apply", JSON.stringify(externalTheme));
    assert(JSON.parse(tmFonts.normal).Size === 18 && tmState.scroll === 0,
        "External theme apply did not refresh Theme Manager fonts and geometry");
    tmDelete();
    assert(tmState.selectedFile === "Default.json" && !files.has(profile + "DarkOneJSP3\\themes\\Renamed Test.json"),
        "Delete did not return to the protected default");
    rejectedWritePath = profile + "js_data\\darkonejsp3.bottom-area-state.txt";
    tmResetDefault();
    assert(/^Theme was not applied:/.test(tmState.status),
        "Reset default hid an Apply failure behind a success message");
    rejectedWritePath = "";
    on_size();
    const roundedOutlines = [];
    const graphics = {
        FillRectangle() {}, FillRoundedRectangle() {}, DrawRectangle() {},
        DrawRoundedRectangle() { roundedOutlines.push(Array.from(arguments)); },
        WriteTextSimple() {}
    };
    on_paint(graphics);
    assert(tmState.hits.length > 10, "Responsive Theme Manager did not create interaction targets");
    assert(roundedOutlines.some(args => args[4] > 0 && args[5] > 0 && args[7] === tmColours.danger),
        "Delete button border does not use the same rounded geometry as its fill");
    for (let i = 0; i < 30; i++) files.set(profile + "DarkOneJSP3\\themes\\Theme " + i + ".json", defaultTheme);
    tmListFiles();
    window.Width = 420; window.Height = 300; on_size(); on_paint(graphics);
    on_mouse_move(10, 100); on_mouse_wheel(-1); on_paint(graphics);
    assert(tmState.sidebarWidth < 220 && tmState.fileScroll > 0,
        "Compact layout or independently scrollable theme list failed");
    on_script_unload();
    assert(!files.has(availabilityPath),
        "Theme Manager availability beacon survived panel unload");
});
