"use strict";

// InfoStack-only colour state and menu handling. This file is included by
// 03_info_stack_tabs.js and deliberately shares that controller's JSplitter
// script context so the established property names and callbacks remain intact.

// Background modes:
// 0 = transparent, 1 = black, 2 = DarkOne grey, 3 = custom (legacy),
// 4 = DarkOne dark grey, 5 = Columns UI global background. Keeping custom at
// 3 preserves existing properties.
var BACKGROUND_TRANSPARENT = 0;
var BACKGROUND_BLACK = 1;
var BACKGROUND_DARKONE = 2;
var BACKGROUND_CUSTOM = 3;
var BACKGROUND_DARKONE_DARK = 4;
var BACKGROUND_COLUMNS_UI = 5;
var BACKGROUND_MODES = [
    BACKGROUND_TRANSPARENT,
    BACKGROUND_BLACK,
    BACKGROUND_DARKONE,
    BACKGROUND_CUSTOM,
    BACKGROUND_DARKONE_DARK,
    BACKGROUND_COLUMNS_UI
];
var BACKGROUND_MENU_OPTIONS = [
    { id: 700, mode: BACKGROUND_TRANSPARENT, label: 'Transparent / inherit parent' },
    { id: 701, mode: BACKGROUND_BLACK, label: 'Black' },
    { id: 702, mode: BACKGROUND_DARKONE, label: 'DarkOne grey' },
    { id: 703, mode: BACKGROUND_DARKONE_DARK, label: 'DarkOne dark grey' },
    { id: 705, mode: BACKGROUND_COLUMNS_UI, label: 'Columns UI global background' },
    { id: 704, mode: BACKGROUND_CUSTOM, custom: true }
];

// Tab font-colour modes. Only the normal/inactive label uses this accent; the
// selected label stays white and the hovered label stays grey.
var TAB_COLOUR_DEFAULT = 0;
var TAB_COLOUR_CUSTOM = 1;
var TAB_COLOUR_COLUMNS_UI_SELECTED = 2;
var TAB_COLOUR_MODES = [
    TAB_COLOUR_DEFAULT,
    TAB_COLOUR_CUSTOM,
    TAB_COLOUR_COLUMNS_UI_SELECTED
];
var TAB_COLOUR_MENU_OPTIONS = [
    { id: 800, mode: TAB_COLOUR_DEFAULT, label: 'Default - DarkOne blue' },
    { id: 802, mode: TAB_COLOUR_COLUMNS_UI_SELECTED, label: 'Columns UI selected-item background' },
    { id: 801, mode: TAB_COLOUR_CUSTOM, custom: true }
];

function backgroundMode() {
    return DarkOneColour.normaliseMode(
        window.GetProperty(BACKGROUND_MODE_PROPERTY, BACKGROUND_DARKONE_DARK),
        BACKGROUND_MODES,
        BACKGROUND_DARKONE_DARK
    );
}

function storedCustomBackgroundColour() {
    return DarkOneColour.opaque(window.GetProperty(
        BACKGROUND_COLOUR_PROPERTY,
        DOJSP3.colours.separator
    ));
}

function backgroundColour() {
    var mode = backgroundMode();
    if (mode === BACKGROUND_BLACK) return 0xff000000;
    if (mode === BACKGROUND_DARKONE) return DOJSP3.colours.bar;
    if (mode === BACKGROUND_DARKONE_DARK) return DOJSP3.colours.separator;
    if (mode === BACKGROUND_COLUMNS_UI) {
        return DarkOneColour.columnsUi(3, DOJSP3.colours.bar);
    }
    if (mode === BACKGROUND_CUSTOM) return storedCustomBackgroundColour();
    return 0x00000000;
}

function tabColourMode() {
    return DarkOneColour.normaliseMode(
        window.GetProperty(TAB_COLOUR_MODE_PROPERTY, TAB_COLOUR_DEFAULT),
        TAB_COLOUR_MODES,
        TAB_COLOUR_DEFAULT
    );
}

function storedCustomTabColour() {
    return DarkOneColour.opaque(window.GetProperty(
        TAB_CUSTOM_COLOUR_PROPERTY,
        DOJSP3.colours.buttonNormal
    ));
}

function tabAccentColour() {
    var mode = tabColourMode();
    if (mode === TAB_COLOUR_CUSTOM) return storedCustomTabColour();
    if (mode === TAB_COLOUR_COLUMNS_UI_SELECTED) {
        return DarkOneColour.columnsUi(4, DOJSP3.colours.buttonNormal);
    }
    return DOJSP3.colours.buttonNormal;
}

function repaintTabArea() {
    window.RepaintRect(0, tabY, ww, tabAreaHeight);
}

function setTabColourMode(mode) {
    window.SetProperty(
        TAB_COLOUR_MODE_PROPERTY,
        DarkOneColour.normaliseMode(mode, TAB_COLOUR_MODES, TAB_COLOUR_DEFAULT)
    );
    repaintTabArea();
}

function setCustomTabColour() {
    var chosen = DarkOneColour.pickJsplitter(
        storedCustomTabColour(),
        window.Name,
        'Enter a colour as #RRGGBB or R,G,B.\n\nExamples: #298FCC or 41,143,204'
    );
    if (chosen === null) return;

    window.SetProperty(TAB_CUSTOM_COLOUR_PROPERTY, chosen);
    setTabColourMode(TAB_COLOUR_CUSTOM);
}

function setBackgroundMode(mode) {
    window.SetProperty(
        BACKGROUND_MODE_PROPERTY,
        DarkOneColour.normaliseMode(
            mode,
            BACKGROUND_MODES,
            BACKGROUND_DARKONE_DARK
        )
    );
    window.Repaint();
}

function setCustomBackgroundColour() {
    var chosen = DarkOneColour.pickJsplitter(
        storedCustomBackgroundColour(),
        window.Name,
        'Enter a colour as #RRGGBB or R,G,B.\n\nExamples: #000000 or 24,24,24'
    );
    if (chosen === null) return;

    window.SetProperty(BACKGROUND_COLOUR_PROPERTY, chosen);
    setBackgroundMode(BACKGROUND_CUSTOM);
}

function appendInfoStackTabColourMenu(menu) {
    DarkOneColour.appendRadioOptions(
        menu,
        TAB_COLOUR_MENU_OPTIONS,
        tabColourMode(),
        storedCustomTabColour(),
        MENU_STRING
    );
}

function appendInfoStackBackgroundMenu(menu) {
    DarkOneColour.appendRadioOptions(
        menu,
        BACKGROUND_MENU_OPTIONS,
        backgroundMode(),
        storedCustomBackgroundColour(),
        MENU_STRING
    );
}

function handleInfoStackColourMenu(id) {
    var selected = DarkOneColour.optionForId(TAB_COLOUR_MENU_OPTIONS, id);
    if (selected) {
        if (selected.custom) setCustomTabColour();
        else setTabColourMode(selected.mode);
        return true;
    }

    selected = DarkOneColour.optionForId(BACKGROUND_MENU_OPTIONS, id);
    if (selected) {
        if (selected.custom) setCustomBackgroundColour();
        else setBackgroundMode(selected.mode);
        return true;
    }
    return false;
}
