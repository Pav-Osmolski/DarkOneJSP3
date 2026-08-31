"use strict";
include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\shared.js');

var DARKONEJSP3_RESET_ROLE = "info-stack";

// Replaces Panel Stack Splitter 03.
// The source PSS contains stale placement/show code for a seventh child but
// only six actual panels and six buttons. This port deliberately implements
// the six real panels.
//
// Version history (newest first):
// v0.6.33 keeps automatic tab font and area geometry fixed across standard and
// expanded InfoStack widths by using the main controller's reference width.
//
// v0.6.32 removes Startup configuration from both InfoStack menu surfaces;
// TOOLS now owns its presentation through a dedicated root-state bridge.
//
// v0.6.31 makes optional-button menu-state publication change-driven and removes
// the obsolete notification-triggered popup fallback, keeping popup ownership
// local while avoiding redundant runtime-file writes.
//
// v0.6.30 keeps the optional-button popup local to its JScript Panel owner;
// selected menu actions are forwarded back to InfoStack after the popup closes.
//
// v0.6.29 consolidates InfoStack configuration into Tab settings and Appearance
// submenus so direct page selection remains the focus of the top-level menu.
//
// v0.6.28 adds a persistent tab-strip visibility toggle and a streamlined
// InfoStack menu that can also be opened from a DarkOneJSP3 optional button.
//
// v0.6.27 separates remembered Custom colour selection from native picker editing
// for InfoStack tab, backing and shared side-divider colours.
//
// v0.6.26 caches resolved tab geometry, labels, colours and unchanged font resources.
//
// v0.6.25 separates InfoStack-only colour state and controller bridges into
// focused include helpers while preserving the established script context,
// menu IDs, saved properties and notification behaviour.
//
// v0.6.23 consolidates colour conversion, menu mapping and picker behaviour
// through the shared DarkOneJSP3 colour helper without changing saved modes.
//
// v0.6.22 adds Columns UI selected-item background as a live inactive-tab
// font-colour source. Existing Default and Custom modes remain values 0 and 1;
// the new Columns UI mode uses value 2.
//
// v0.6.21 adds an explicit Columns UI global background choice to the
// InfoStack backing and upper-divider menus. Existing mode values are retained;
// the new live Columns UI mode uses value 5.
//
// v0.6.20 adds the same DarkOne dark grey choice to the two upper side
// dividers while preserving their legacy custom-colour mode at value 3.
//
// v0.6.19 fixes the background-mode range so the new DarkOne dark grey mode
// (value 4) is not clamped to the legacy custom-colour mode (value 3).
//
// v0.6.18 distinguishes the InfoStack backing/tab-strip background from the
// five JScript Panel page backgrounds, adds DarkOne dark grey (RGB 24,24,24),
// and makes it the default so transparent pages inherit the intended tone.
//
// v0.6.17 hosts startup controls in this JSplitter menu. The root remains the
// sole property owner; versioned serialised messages query state, change the
// mode/timings, preview the curtain and restore defaults reliably.
//
// v0.6.16 hosts the Album Art/Spectrum divider-colour menu inside JSplitter.
// State is exchanged with Main Columns through a serialised JSplitter-to-
// JSplitter notification, avoiding unsupported JScript Panel bridging.
//
// v0.6.15 clarifies the tab-area override command as a fixed-height action.
// The automatic-height check item remains the only automatic mode control.
//
// v0.6.14 makes the automatic tab-area padding follow that same scale while
// automatic font sizing is active. Fixed font sizing keeps the established
// 100% padding, and a manually configured tab-area height remains independent.
//
// v0.6.13 adds a percentage-based automatic-font scale. The normal 100% value
// preserves the existing responsive calculation, while users can enlarge or
// reduce it without switching to a fixed pixel size.
//
// v0.6.12 fixes the JSplitter-specific native colour-picker call. JSplitter
// requires utils.ColourPicker(window_id, default_colour), while JScript Panel
// takes the default colour first and supports an error-on-cancel flag. Cancelling
// the native picker now exits cleanly instead of falling through to the manual
// text-entry fallback.
//
// v0.6.11 adds a Default/Custom font-colour mode for inactive tab labels.
// The active label remains white and the hovered label remains grey so the
// existing selection and hover feedback are preserved.
//
// v0.3.2 makes Title Case the default label style and adds a persistent,
// user-configurable tab-area height while retaining the original DarkOne
// width-scaled geometry as the automatic setting.
//
// v0.3.1 centres tab labels across the entire reserved tab strip (the original
// PSS layout reserved both a spacing gap and the text row at the bottom).
//
// v0.3.0 adds persistent background, tab visibility and display-label
// customisation. Child custom titles are stable API identifiers; only the
// labels drawn in this tab strip are renamed.

var INFO_PANELS = [
    { key: 'Playlists',  title: DOJSP3.titles.playlistManager, defaultLabel: 'Playlists',  uppercaseLabel: 'PLAYLISTS' },
    { key: 'Biography',  title: DOJSP3.titles.lastfmBio,       defaultLabel: 'Biography',  uppercaseLabel: 'BIOGRAPHY' },
    { key: 'Lastfm',     title: DOJSP3.titles.lastfmInfo,      defaultLabel: 'Last.fm',    uppercaseLabel: 'LAST.FM' },
    { key: 'Allmusic',   title: DOJSP3.titles.albumNotes,      defaultLabel: 'Album Notes', uppercaseLabel: 'ALBUM NOTES' },
    { key: 'Queue',      title: DOJSP3.titles.queue,           defaultLabel: 'Queue',      uppercaseLabel: 'QUEUE' },
    { key: 'Properties', title: DOJSP3.titles.properties,      defaultLabel: 'Properties', uppercaseLabel: 'PROPERTIES' }
];


function hideInfoChildrenBeforeFirstLayout() {
    // The exported FCL may leave a child visible while JSplitter is still
    // evaluating this controller. Hide every candidate immediately so the
    // saved active tab is the first information panel the user actually sees.
    for (var i = 0; i < INFO_PANELS.length; i++) {
        try {
            var child = window.GetPanel(INFO_PANELS[i].title);
            if (child) child.Show(false);
        } catch (e) {}
    }
}

hideInfoChildrenBeforeFirstLayout();

var ACTIVE_PROPERTY = 'DarkOneJSP3.InfoStack.ActivePanel';
var FONT_PROPERTY = 'DarkOneJSP3.InfoStack.FontSize';
var AUTO_FONT_SCALE_PROPERTY = 'DarkOneJSP3.InfoStack.AutoFontScale';
var BACKGROUND_MODE_PROPERTY = 'DarkOneJSP3.InfoStack.BackgroundMode';
var BACKGROUND_COLOUR_PROPERTY = 'DarkOneJSP3.InfoStack.BackgroundColour';
var TAB_AREA_HEIGHT_PROPERTY = 'DarkOneJSP3.InfoStack.TabAreaHeight';
var TAB_STRIP_VISIBLE_PROPERTY = 'DarkOneJSP3.InfoStack.TabStripVisible';
var LABEL_DEFAULTS_VERSION_PROPERTY = 'DarkOneJSP3.InfoStack.LabelDefaultsVersion';
var TAB_COLOUR_MODE_PROPERTY = 'DarkOneJSP3.InfoStack.TabColourMode';
var TAB_CUSTOM_COLOUR_PROPERTY = 'DarkOneJSP3.InfoStack.TabCustomColour';
var INFO_STACK_MAIN_AREA_WIDTH_NOTIFICATION = 'DarkOneJSP3.InfoStack.MainAreaWidth';

include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\info_stack_colours.js');
include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\info_stack_bridges.js');


var activeIndex = DOJSP3.clamp(Number(window.GetProperty(ACTIVE_PROPERTY, 0)) || 0, 0, INFO_PANELS.length - 1);
var hoverIndex = -1;
var ww = 0;
var wh = 0;
var mainAreaWidth = 0;
var tabHeight = 18;
var tabY = 0;
var tabAreaHeight = 18;
var contentHeight = 1;
var font = gdi.Font('Segoe UI', 10, 0);
var infoStackFontKey = '';
var infoStackRenderModel = {
    visible: [],
    labels: [],
    rects: [],
    backgroundMode: 0,
    backgroundColour: 0,
    tabAccentColour: 0
};
var infoStackMenuStateKey = null;

// JSplitter exposes these values in docs/Flags.js, but does not inject that
// documentation file into each panel script automatically. Keep the small
// set used by this controller local so it has no external include dependency.
var TAB_TEXT_FLAGS = 0x00000001 | 0x00000004 | 0x00000020 | 0x00000800;
var CURSOR_ARROW = 32512;
var CURSOR_HAND = 32649;
var MENU_STRING = 0x00000000;
var MENU_GRAYED = 0x00000001;
var MENU_POPUP = 0x00000010;

function visibleProperty(index) {
    return 'DarkOneJSP3.InfoStack.Tab.' + INFO_PANELS[index].key + '.Visible';
}

function labelProperty(index) {
    return 'DarkOneJSP3.InfoStack.Tab.' + INFO_PANELS[index].key + '.Label';
}

function migrateTitleCaseDefaults() {
    var version = Number(window.GetProperty(LABEL_DEFAULTS_VERSION_PROPERTY, 0)) || 0;
    if (version >= 2) return;

    // v0.3.0/v0.3.1 stored all-caps defaults. v0.6.0 renames only the
    // untouched information-source default from AllMusic to Album Notes.
    // User-customised labels remain unchanged.
    for (var i = 0; i < INFO_PANELS.length; i++) {
        var legacy = INFO_PANELS[i].uppercaseLabel;
        var current = String(window.GetProperty(labelProperty(i), legacy));
        if (version < 1 && current === legacy) {
            window.SetProperty(labelProperty(i), INFO_PANELS[i].defaultLabel);
            current = INFO_PANELS[i].defaultLabel;
        }
        if (version < 2 && INFO_PANELS[i].key === 'Allmusic' && current === 'AllMusic') {
            window.SetProperty(labelProperty(i), 'Album Notes');
        }
    }
    window.SetProperty(LABEL_DEFAULTS_VERSION_PROPERTY, 2);
}

migrateTitleCaseDefaults();

function isTabVisible(index) {
    return Boolean(window.GetProperty(visibleProperty(index), true));
}

function tabLabel(index) {
    var value = String(window.GetProperty(labelProperty(index), INFO_PANELS[index].defaultLabel));
    value = value.replace(/^\s+|\s+$/g, '');
    return value || INFO_PANELS[index].defaultLabel;
}

function menuLabel(value) {
    // Win32 menus use ampersands for access keys. Doubling them preserves a
    // literal ampersand in a user-supplied tab title.
    return String(value).replace(/&/g, '&&');
}

function infoStackMenuStateSnapshot() {
    var visible = [];
    var labels = [];
    for (var i = 0; i < INFO_PANELS.length; i++) {
        visible.push(isTabVisible(i));
        labels.push(tabLabel(i));
    }
    return {
        activeIndex: activeIndex,
        visible: visible,
        labels: labels,
        tabStripVisible: isTabStripVisible(),
        fixedFontSize: Math.max(0, Math.round(Number(window.GetProperty(FONT_PROPERTY, 0)) || 0)),
        automaticFontScale: automaticFontScale(),
        tabAreaHeight: configuredTabAreaHeight(),
        tabColourMode: tabColourMode(),
        tabCustomColour: storedCustomTabColour(),
        backgroundMode: backgroundMode(),
        backgroundCustomColour: storedCustomBackgroundColour(),
        dividerMode: dividerMenuMode,
        dividerCustomColour: dividerMenuCustomColour
    };
}

function publishInfoStackMenuState() {
    var snapshot = infoStackMenuStateSnapshot();
    var key;
    try { key = JSON.stringify(snapshot); } catch (e) { return false; }
    if (key === infoStackMenuStateKey) return false;
    try {
        if (DarkOneViewBridge.writeInfoStackState(snapshot)) {
            infoStackMenuStateKey = key;
            return true;
        }
    } catch (e2) {}
    return false;
}

function visibleIndexes() {
    var result = [];
    for (var i = 0; i < INFO_PANELS.length; i++) {
        if (isTabVisible(i)) result.push(i);
    }
    return result;
}

function rebuildInfoStackRenderModel() {
    var visible = visibleIndexes();
    var labels = [];
    var rects = [];
    var baseWidth = visible.length ? Math.floor(ww / visible.length) : 0;
    for (var slot = 0; slot < visible.length; slot++) {
        var index = visible[slot];
        var x = slot * baseWidth;
        labels.push(tabLabel(index));
        rects.push({
            index: index,
            x: x,
            width: slot === visible.length - 1 ? ww - x : baseWidth
        });
    }
    infoStackRenderModel.visible = visible;
    infoStackRenderModel.labels = labels;
    infoStackRenderModel.rects = rects;
    infoStackRenderModel.backgroundMode = backgroundMode();
    infoStackRenderModel.backgroundColour = backgroundColour();
    infoStackRenderModel.tabAccentColour = tabAccentColour();
}

function ensureActiveTab() {
    var visible = visibleIndexes();

    // Recover safely if imported/corrupt properties somehow hide every tab.
    if (!visible.length) {
        window.SetProperty(visibleProperty(0), true);
        visible = [0];
    }

    if (isTabVisible(activeIndex)) return;

    activeIndex = visible[0];
    window.SetProperty(ACTIVE_PROPERTY, activeIndex);
}

function automaticReferenceWidth() {
    if (mainAreaWidth <= 0) return ww;

    // Recreate the normal three-column InfoStack width. Automatic sizing was
    // designed around that width, so widening only the panel must not enlarge
    // its tab strip.
    var px = Math.max(1, DOJSP3.idiv(mainAreaWidth, 640));
    return DOJSP3.clamp(
        DOJSP3.idiv(mainAreaWidth, 3) - px,
        1,
        Math.max(1, mainAreaWidth - 2)
    );
}

function inferredRootWidth() {
    var referenceWidth = automaticReferenceWidth();
    return referenceWidth > 0 ? (referenceWidth * 64 / 21) : 0;
}

function automaticFontScale() {
    var value = Math.round(Number(window.GetProperty(AUTO_FONT_SCALE_PROPERTY, 100)) || 100);
    return DOJSP3.clamp(value, 50, 200);
}

function automaticFontSize() {
    var baseSize = DOJSP3.clamp(Math.round(inferredRootWidth() / 112), 10, 36);
    return DOJSP3.clamp(Math.round(baseSize * automaticFontScale() / 100), 8, 48);
}

function rebuildFont(force) {
    var configured = Number(window.GetProperty(FONT_PROPERTY, 0)) || 0;
    var size = configured > 0
        ? DOJSP3.clamp(Math.round(configured), 8, 48)
        : automaticFontSize();
    var key = 'Segoe UI|' + size + '|0';
    if (!force && key === infoStackFontKey) return false;

    font = gdi.Font('Segoe UI', size, 0);
    infoStackFontKey = key;
    tabHeight = Math.max(16, font.Height + 2);
    return true;
}

function configuredTabAreaHeight() {
    return Math.max(0, Math.round(Number(window.GetProperty(TAB_AREA_HEIGHT_PROPERTY, 0)) || 0));
}

function automaticTabAreaHeight() {
    // Preserve the original 100% PSS geometry, but let automatic font scaling
    // enlarge or reduce the surrounding tab-area padding proportionally. A
    // fixed font size is independent of the automatic base-scale property.
    var baseGap = DOJSP3.idiv(automaticReferenceWidth(), 40);
    var fixedFontSize = Number(window.GetProperty(FONT_PROPERTY, 0)) || 0;
    var gapScale = fixedFontSize > 0 ? 100 : automaticFontScale();
    var scaledGap = Math.max(0, Math.round(baseGap * gapScale / 100));
    return tabHeight + scaledGap;
}

function setTabAreaHeight(value) {
    value = Math.round(Number(value) || 0);
    window.SetProperty(TAB_AREA_HEIGHT_PROPERTY, value <= 0 ? 0 : DOJSP3.clamp(value, 18, 240));
    layoutInfoStack();
    window.Repaint();
    publishInfoStackMenuState();
}

function panelAt(index) {
    return DOJSP3.panel(INFO_PANELS[index].title);
}

function applyVisibility() {
    ensureActiveTab();
    for (var i = 0; i < INFO_PANELS.length; i++) {
        var p = panelAt(i);
        DOJSP3.show(p, isTabVisible(i) && i === activeIndex);
    }
}

function layoutInfoStack() {
    if (ww <= 0 || wh <= 0) return;

    ensureActiveTab();
    rebuildFont();
    if (isTabStripVisible()) {
        var requestedAreaHeight = configuredTabAreaHeight();
        var desiredAreaHeight = requestedAreaHeight > 0 ? requestedAreaHeight : automaticTabAreaHeight();
        var maximumAreaHeight = Math.max(1, wh - 1);
        var minimumAreaHeight = Math.min(Math.max(18, tabHeight), maximumAreaHeight);

        tabAreaHeight = Math.max(minimumAreaHeight, Math.min(desiredAreaHeight, maximumAreaHeight));
        contentHeight = Math.max(1, wh - tabAreaHeight);
        tabY = contentHeight;
        // Recalculate from the final boundary so the child area and tab area
        // always consume the splitter exactly, even at very small dimensions.
        tabAreaHeight = Math.max(1, wh - tabY);
    } else {
        tabAreaHeight = 0;
        contentHeight = wh;
        tabY = wh;
    }

    var allChildrenAvailable = true;
    for (var i = 0; i < INFO_PANELS.length; i++) {
        var child = panelAt(i);
        if (!child) allChildrenAvailable = false;
        DOJSP3.move(child, 0, 0, ww, contentHeight);
    }
    applyVisibility();
    rebuildInfoStackRenderModel();
    if (!startupReadiness.isReady() && allChildrenAvailable) {
        startupReadiness.signal();
    }
}

function selectPanel(index, notify) {
    index = DOJSP3.clamp(Math.round(Number(index) || 0), 0, INFO_PANELS.length - 1);
    if (!isTabVisible(index) || activeIndex === index) return;

    activeIndex = index;
    window.SetProperty(ACTIVE_PROPERTY, activeIndex);
    applyVisibility();
    window.Repaint();

    if (notify !== false) {
        window.NotifyOthers('DarkOneJSP3.InfoStack.SelectionChanged', activeIndex);
    }
    publishInfoStackMenuState();
}

function nearestVisibleIndex(fromIndex) {
    var visible = visibleIndexes();
    if (!visible.length) return -1;

    for (var i = 0; i < visible.length; i++) {
        if (visible[i] > fromIndex) return visible[i];
    }
    for (var j = visible.length - 1; j >= 0; j--) {
        if (visible[j] < fromIndex) return visible[j];
    }
    return visible[0];
}

function setTabVisible(index, visible) {
    visible = Boolean(visible);
    if (isTabVisible(index) === visible) return;

    if (!visible && visibleIndexes().length <= 1) {
        fb.ShowPopupMessage('At least one information tab must remain visible.', 'DarkOneJSP3');
        return;
    }

    window.SetProperty(visibleProperty(index), visible);

    if (!visible && activeIndex === index) {
        var replacement = nearestVisibleIndex(index);
        if (replacement >= 0) {
            activeIndex = replacement;
            window.SetProperty(ACTIVE_PROPERTY, activeIndex);
            window.NotifyOthers('DarkOneJSP3.InfoStack.SelectionChanged', activeIndex);
        }
    }

    hoverIndex = -1;
    layoutInfoStack();
    window.Repaint();
    publishInfoStackMenuState();
}

function setTabLabel(index, value) {
    value = String(value || '').replace(/^\s+|\s+$/g, '');
    if (!value) {
        window.SetProperty(labelProperty(index), INFO_PANELS[index].defaultLabel);
    } else {
        // Keep accidental essays out of the tab strip while still allowing
        // comfortably descriptive labels.
        window.SetProperty(labelProperty(index), value.substring(0, 40));
    }
    rebuildInfoStackRenderModel();
    window.RepaintRect(0, tabY, ww, tabAreaHeight);
    publishInfoStackMenuState();
}

function renameTab(index) {
    try {
        var current = tabLabel(index);
        var entered = utils.InputBox(
            'Enter the display title for this tab. Leave it empty to restore the default.\n\n' +
            'This changes only the visible label, not the JSplitter child custom title.',
            window.Name,
            current
        );
        setTabLabel(index, entered);
    } catch (e) {}
}

function applyLabelPreset(useTitleCase) {
    for (var i = 0; i < INFO_PANELS.length; i++) {
        window.SetProperty(
            labelProperty(i),
            useTitleCase ? INFO_PANELS[i].defaultLabel : INFO_PANELS[i].uppercaseLabel
        );
    }
    rebuildInfoStackRenderModel();
    window.RepaintRect(0, tabY, ww, tabAreaHeight);
    publishInfoStackMenuState();
}

function resetAllLabels() {
    for (var i = 0; i < INFO_PANELS.length; i++) {
        window.SetProperty(labelProperty(i), INFO_PANELS[i].defaultLabel);
    }
    rebuildInfoStackRenderModel();
    window.RepaintRect(0, tabY, ww, tabAreaHeight);
    publishInfoStackMenuState();
}

function isTabStripVisible() {
    return Boolean(window.GetProperty(TAB_STRIP_VISIBLE_PROPERTY, true));
}

function setTabStripVisible(visible) {
    visible = Boolean(visible);
    if (isTabStripVisible() === visible) return;
    window.SetProperty(TAB_STRIP_VISIBLE_PROPERTY, visible);
    hoverIndex = -1;
    layoutInfoStack();
    window.Repaint();
    publishInfoStackMenuState();
}

function tabFromPoint(x, y) {
    if (!isTabStripVisible() || y < tabY || y >= tabY + tabAreaHeight || x < 0 || x >= ww) return -1;

    var visible = infoStackRenderModel.visible;
    if (!visible.length) return -1;

    var slot = DOJSP3.clamp(Math.floor(x * visible.length / Math.max(1, ww)), 0, visible.length - 1);
    return visible[slot];
}

function on_colours_changed() {
    rebuildInfoStackRenderModel();
    window.Repaint();
}

function on_size(width, height) {
    ww = width;
    wh = height;
    layoutInfoStack();
    requestInfoStackDividerState();
    publishInfoStackMenuState();
}

function on_paint(gr) {
    if (infoStackRenderModel.backgroundMode !== BACKGROUND_TRANSPARENT) {
        gr.FillSolidRect(0, 0, ww, wh, infoStackRenderModel.backgroundColour);
    }

    if (!isTabStripVisible()) return;

    var rects = infoStackRenderModel.rects;
    for (var slot = 0; slot < rects.length; slot++) {
        var rect = rects[slot];
        var colour = rect.index === activeIndex
            ? DOJSP3.colours.buttonActive
            : (rect.index === hoverIndex ? DOJSP3.colours.buttonHover : infoStackRenderModel.tabAccentColour);
        gr.GdiDrawText(infoStackRenderModel.labels[slot], font, colour, rect.x, tabY, rect.width, tabAreaHeight, TAB_TEXT_FLAGS);
    }
}

function on_mouse_move(x, y) {
    var next = tabFromPoint(x, y);
    if (next !== hoverIndex) {
        hoverIndex = next;
        window.SetCursor(hoverIndex >= 0 ? CURSOR_HAND : CURSOR_ARROW);
        window.RepaintRect(0, tabY, ww, tabAreaHeight);
    }
}

function on_mouse_leave() {
    if (hoverIndex !== -1) {
        hoverIndex = -1;
        window.SetCursor(CURSOR_ARROW);
        window.RepaintRect(0, tabY, ww, tabAreaHeight);
    }
}

function on_mouse_lbtn_up(x, y) {
    var index = tabFromPoint(x, y);
    if (index >= 0) selectPanel(index, true);
}

function handleInfoStackMenuAction(id, targetIndex) {
    id = Math.round(Number(id) || 0);
    if (!id) return false;
    targetIndex = DOJSP3.clamp(Math.round(Number(targetIndex) || 0), 0, INFO_PANELS.length - 1);
    if (id >= 100 && id < 100 + INFO_PANELS.length) {
        selectPanel(id - 100, true);
    } else if (id === 250) {
        setTabStripVisible(!isTabStripVisible());
    } else if (id === 200) {
        window.SetProperty(FONT_PROPERTY, 0);
        layoutInfoStack();
        window.Repaint();
    } else if (id === 201) {
        try {
            var current = Number(window.GetProperty(FONT_PROPERTY, 0)) || automaticFontSize();
            var entered = Number(utils.InputBox(
                'Enter the fixed tab font size in pixels. Enter 0 to return to automatic scaling.',
                window.Name,
                current
            ));
            if (!isNaN(entered)) {
                window.SetProperty(
                    FONT_PROPERTY,
                    entered <= 0 ? 0 : DOJSP3.clamp(Math.round(entered), 8, 48)
                );
                layoutInfoStack();
                window.Repaint();
            }
        } catch (e) {}
    } else if (id === 202) {
        try {
            var enteredScale = Number(utils.InputBox(
                'Adjust the responsive automatic font calculation as a percentage.\n\n' +
                '100% preserves the normal DarkOne scaling. Suggested range: 75% to 150%.',
                window.Name,
                automaticFontScale()
            ));
            if (!isNaN(enteredScale)) {
                window.SetProperty(
                    AUTO_FONT_SCALE_PROPERTY,
                    DOJSP3.clamp(Math.round(enteredScale), 50, 200)
                );
                layoutInfoStack();
                window.Repaint();
            }
        } catch (e2) {}
    } else if (id === 203) {
        window.SetProperty(AUTO_FONT_SCALE_PROPERTY, 100);
        layoutInfoStack();
        window.Repaint();
    } else if (handleInfoStackColourMenu(id)) {
    } else if (id >= 300 && id < 300 + INFO_PANELS.length) {
        var visibilityIndex = id - 300;
        setTabVisible(visibilityIndex, !isTabVisible(visibilityIndex));
    } else if (id >= 400 && id < 400 + INFO_PANELS.length) {
        renameTab(id - 400);
    } else if (id === 450) {
        applyLabelPreset(true);
    } else if (id === 451) {
        applyLabelPreset(false);
    } else if (id === 452) {
        setTabLabel(targetIndex, '');
    } else if (id === 453) {
        resetAllLabels();
    } else if (id === 600) {
        setTabAreaHeight(0);
    } else if (id === 601) {
        try {
            var currentHeight = configuredTabAreaHeight() || Math.round(tabAreaHeight || automaticTabAreaHeight());
            var enteredHeight = Number(utils.InputBox(
                'Enter a fixed tab-area height in pixels. Enter 0 to restore automatic height.\n\n' +
                'The minimum height automatically expands when required to fit the selected tab font.',
                window.Name,
                currentHeight
            ));
            if (!isNaN(enteredHeight)) setTabAreaHeight(enteredHeight);
        } catch (e3) {}
    } else if (!handleInfoStackBridgeMenu(id)) {
        return false;
    }
    publishInfoStackMenuState();
    return true;
}

function showInfoStackMenu(x, y, targetIndex) {
    targetIndex = DOJSP3.clamp(Math.round(Number(targetIndex) || 0), 0, INFO_PANELS.length - 1);

    var menu = window.CreatePopupMenu();
    var tabSettingsMenu = window.CreatePopupMenu();
    var appearanceMenu = window.CreatePopupMenu();
    var visibilityMenu = window.CreatePopupMenu();
    var titlesMenu = window.CreatePopupMenu();
    var fontMenu = window.CreatePopupMenu();
    var tabColourMenu = window.CreatePopupMenu();
    var areaMenu = window.CreatePopupMenu();
    var backgroundMenu = window.CreatePopupMenu();
    var dividerMenu = window.CreatePopupMenu();

    requestInfoStackDividerState();

    var i;
    for (i = 0; i < INFO_PANELS.length; i++) {
        menu.AppendMenuItem(isTabVisible(i) ? MENU_STRING : MENU_GRAYED, 100 + i, menuLabel(tabLabel(i)));
        visibilityMenu.AppendMenuItem(MENU_STRING, 300 + i, menuLabel(tabLabel(i)));
        visibilityMenu.CheckMenuItem(300 + i, isTabVisible(i));
        titlesMenu.AppendMenuItem(MENU_STRING, 400 + i, 'Rename ' + menuLabel(tabLabel(i)) + '...');
    }
    menu.CheckMenuRadioItem(100, 100 + INFO_PANELS.length - 1, 100 + activeIndex);
    menu.AppendMenuSeparator();
    menu.AppendMenuItem(MENU_STRING, 250, 'Show tab strip');
    menu.CheckMenuItem(250, isTabStripVisible());
    menu.AppendMenuSeparator();

    titlesMenu.AppendMenuSeparator();
    titlesMenu.AppendMenuItem(MENU_STRING, 450, 'Use Title Case defaults');
    titlesMenu.AppendMenuItem(MENU_STRING, 451, 'Use UPPERCASE defaults');
    titlesMenu.AppendMenuItem(MENU_STRING, 452, 'Reset ' + menuLabel(tabLabel(targetIndex)) + ' to default');
    titlesMenu.AppendMenuItem(MENU_STRING, 453, 'Reset all titles to defaults');

    fontMenu.AppendMenuItem(MENU_STRING, 200, 'Automatic tab font size');
    fontMenu.CheckMenuItem(200, Number(window.GetProperty(FONT_PROPERTY, 0)) === 0);
    fontMenu.AppendMenuItem(MENU_STRING, 201, 'Set fixed tab font size...');
    fontMenu.AppendMenuSeparator();
    fontMenu.AppendMenuItem(
        MENU_STRING,
        202,
        'Set automatic base scale... (' + automaticFontScale() + '%)'
    );
    fontMenu.AppendMenuItem(
        automaticFontScale() === 100 ? MENU_GRAYED : MENU_STRING,
        203,
        'Reset automatic base scale'
    );

    appendInfoStackTabColourMenu(tabColourMenu);

    var configuredArea = configuredTabAreaHeight();
    areaMenu.AppendMenuItem(MENU_STRING, 600, 'Automatic height (follows tab font sizing)');
    areaMenu.CheckMenuItem(600, configuredArea === 0);
    areaMenu.AppendMenuItem(MENU_STRING, 601, 'Set fixed tab area height...');

    appendInfoStackBackgroundMenu(backgroundMenu);
    appendInfoStackDividerMenu(dividerMenu);

    visibilityMenu.AppendTo(tabSettingsMenu, MENU_POPUP, 'Visible tabs');
    titlesMenu.AppendTo(tabSettingsMenu, MENU_POPUP, 'Tab titles');
    fontMenu.AppendTo(tabSettingsMenu, MENU_POPUP, 'Tab font size');
    tabColourMenu.AppendTo(tabSettingsMenu, MENU_POPUP, 'Tab font colour');
    areaMenu.AppendTo(tabSettingsMenu, MENU_POPUP, 'Tab area');

    backgroundMenu.AppendTo(appearanceMenu, MENU_POPUP, 'InfoStack backing colour');
    dividerMenu.AppendTo(appearanceMenu, MENU_POPUP, 'Side divider colour');

    tabSettingsMenu.AppendTo(menu, MENU_POPUP, 'Tab settings');
    appearanceMenu.AppendTo(menu, MENU_POPUP, 'Appearance');

    // JSplitter's MenuObject is released by the host and does not expose
    // the JSP3/SMP Dispose() method. Calling it aborts command handling.
    var id = menu.TrackPopupMenu(x, y);

    handleInfoStackMenuAction(id, targetIndex);
    return true;
}

function on_mouse_rbtn_up(x, y) {
    if (!isTabStripVisible() || y < tabY) return false;
    var targetIndex = tabFromPoint(x, y);
    if (targetIndex < 0) targetIndex = activeIndex;
    return showInfoStackMenu(x, y, targetIndex);
}

function on_notify_data(name, data) {
    if (name === INFO_STACK_MAIN_AREA_WIDTH_NOTIFICATION) {
        var width = Number(data);
        if (!isFinite(width) || width <= 0) return;
        width = Math.round(width);
        if (width === mainAreaWidth) return;

        mainAreaWidth = width;
        layoutInfoStack();
        window.Repaint();
        return;
    }
    if (name === DarkOneViewBridge.notification) {
        var viewCommand = DarkOneViewBridge.parseNotificationData(data);
        if (!viewCommand) return;
        var actionId = DarkOneViewBridge.infoStackActionFromCommand(viewCommand.command);
        if (actionId !== null) {
            handleInfoStackMenuAction(actionId, activeIndex);
            return;
        }
        // Menu ownership must remain local to the panel that invoked it. The
        // legacy infostack-menu transport is deliberately ignored here; stock
        // buttons send only a selected infostack-action:<id> command.
        return;
    }
    if (handleInfoStackBridgeNotification(name, data)) return;
    if (darkOneJsp3HandleReset(name, data)) return;
    if (name === 'DarkOneJSP3.InfoStack.Select') {
        selectPanel(data, false);
    }
}
