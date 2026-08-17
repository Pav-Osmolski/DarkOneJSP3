// =========================================================================================================
// Optional button properties and command execution - hardened for JSP3.
// Disabled buttons retain their configuration. Command types are re-detected
// automatically after a cached main/context command stops resolving.
// =========================================================================================================

var DARKONE_INFOSTACK_TAB_COLOUR_OPTIONS = [
    { id: 800, mode: 0, label: 'Default - DarkOne blue' },
    { id: 802, mode: 2, label: 'Columns UI selected-item background' },
    { id: 801, mode: 1, custom: true }
];
var DARKONE_INFOSTACK_BACKGROUND_OPTIONS = [
    { id: 700, mode: 0, label: 'Transparent / inherit parent' },
    { id: 701, mode: 1, label: 'Black' },
    { id: 702, mode: 2, label: 'DarkOne grey' },
    { id: 703, mode: 4, label: 'DarkOne dark grey' },
    { id: 705, mode: 5, label: 'Columns UI global background' },
    { id: 704, mode: 3, custom: true }
];
var DARKONE_INFOSTACK_DIVIDER_OPTIONS = [
    { id: 900, mode: 0, label: 'Transparent / inherit parent' },
    { id: 901, mode: 1, label: 'Black' },
    { id: 902, mode: 2, label: 'DarkOne grey' },
    { id: 903, mode: 4, label: 'DarkOne dark grey' },
    { id: 904, mode: 5, label: 'Columns UI global background' },
    { id: 905, mode: 3, custom: true }
];

function getButtonProperties(keyIsButton) {
    this.OptButton = function () {
        this.BtnName = '';
        this.Text = '';
        this.CmdString = '';
        this.CmdStyle = 0;
        this.Exists = false;
    };

    var btnOn = new OptButton();
    btnOn.BtnName = keyIsButton;
    btnOn.Exists = window.GetProperty(btnOn.BtnName, false);
    btnOn.Text = String(window.GetProperty(btnOn.BtnName + ' name (up to 10 letters)', btnOn.BtnName.toUpperCase())).substring(0, 10);
    btnOn.CmdString = window.GetProperty(btnOn.BtnName + ' command string', '');
    btnOn.CmdStyle = window.GetProperty(btnOn.BtnName + ' command style', 0);
    return btnOn;
}

function resetOptionalButtonCommandStyles(buttonNames) {
    for (var i = 0; i < buttonNames.length; i++) {
        if (window.GetProperty(buttonNames[i] + ' command string', ''))
            window.SetProperty(buttonNames[i] + ' command style', 0);
    }
}

function showOptionalButtonCommandGuide() {
    utils.MessageBox(
        'Optional buttons accept one of four trusted local command types:\n\n' +
        '1. DarkOneJSP3 internal command, for example: DarkOneJSP3/Layout/Toggle, DarkOneJSP3/Visualiser/Toggle, DarkOneJSP3/InfoStack/Menu or DarkOneJSP3/Tools/Menu\n' +
        '2. Main-menu path, for example: View/Console\n' +
        '3. Context-menu command for the current selection\n' +
        '4. JavaScript code executed locally by this panel\n\n' +
        'JavaScript commands are advanced functionality and should only contain code you trust. ' +
        'Use Re-detect command types after components or menu names change.',
        'DarkOneJSP3 optional buttons', MB_OK | MB_ICONASTERISK
    );
}

function darkOneInfoStackMenuFallbackState() {
    return {
        activeIndex: 0,
        visible: [true, true, true, true, true, true],
        labels: ['Playlists', 'Biography', 'Last.fm', 'Album Notes', 'Queue', 'Properties'],
        tabStripVisible: true,
        fixedFontSize: 0,
        automaticFontScale: 100,
        tabAreaHeight: 0,
        tabColourMode: 0,
        tabCustomColour: 0xff298fcc,
        backgroundMode: 4,
        backgroundCustomColour: 0xff181818,
        dividerMode: 1,
        dividerCustomColour: 0xff000000,
        startupTransition: 0,
        startupMinimumDelay: 250,
        startupReadinessTimeout: 2000
    };
}

function darkOneInfoStackMenuState() {
    var result = darkOneInfoStackMenuFallbackState();
    var state = DarkOneViewBridge.readInfoStackState();
    if (!state) return result;

    function number(value, fallbackValue, minimum, maximum) {
        value = Math.round(Number(value));
        if (!isFinite(value)) value = fallbackValue;
        return Math.max(minimum, Math.min(maximum, value));
    }

    result.activeIndex = number(state.activeIndex, 0, 0, 5);
    if (state.visible instanceof Array && state.visible.length === 6) {
        for (var i = 0; i < 6; i++) result.visible[i] = Boolean(state.visible[i]);
    }
    if (state.labels instanceof Array && state.labels.length === 6) {
        for (var j = 0; j < 6; j++) {
            var label = String(state.labels[j] || '').replace(/^\s+|\s+$/g, '');
            if (label) result.labels[j] = label.substring(0, 40);
        }
    }
    result.tabStripVisible = state.tabStripVisible !== false;
    result.fixedFontSize = number(state.fixedFontSize, 0, 0, 48);
    result.automaticFontScale = number(state.automaticFontScale, 100, 50, 200);
    result.tabAreaHeight = number(state.tabAreaHeight, 0, 0, 240);
    result.tabColourMode = number(state.tabColourMode, 0, 0, 2);
    result.tabCustomColour = DarkOneColour.opaque(state.tabCustomColour == null ? result.tabCustomColour : state.tabCustomColour);
    result.backgroundMode = number(state.backgroundMode, 4, 0, 5);
    result.backgroundCustomColour = DarkOneColour.opaque(state.backgroundCustomColour == null ? result.backgroundCustomColour : state.backgroundCustomColour);
    result.dividerMode = number(state.dividerMode, 1, 0, 5);
    result.dividerCustomColour = DarkOneColour.opaque(state.dividerCustomColour == null ? result.dividerCustomColour : state.dividerCustomColour);
    result.startupTransition = number(state.startupTransition, 0, 0, 2);
    result.startupMinimumDelay = number(state.startupMinimumDelay, 250, 0, 5000);
    result.startupReadinessTimeout = number(state.startupReadinessTimeout, 2000, 500, 10000);
    return result;
}

function darkOneInfoStackMenuLabel(value) {
    return String(value).replace(/&/g, '&&');
}

function darkOneShowInfoStackLocalMenu(button) {
    var state = darkOneInfoStackMenuState();
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
    var startupMenu = window.CreatePopupMenu();
    var startupTransitionMenu = window.CreatePopupMenu();
    var submenus = [tabSettingsMenu, appearanceMenu, visibilityMenu, titlesMenu, fontMenu,
        tabColourMenu, areaMenu, backgroundMenu, dividerMenu, startupMenu, startupTransitionMenu];
    var selectedId = 0;

    try {
        for (var i = 0; i < 6; i++) {
            menu.AppendMenuItem(state.visible[i] ? 0 : 1, 100 + i, darkOneInfoStackMenuLabel(state.labels[i]));
            visibilityMenu.AppendMenuItem(0, 300 + i, darkOneInfoStackMenuLabel(state.labels[i]));
            visibilityMenu.CheckMenuItem(300 + i, state.visible[i]);
            titlesMenu.AppendMenuItem(0, 400 + i, 'Rename ' + darkOneInfoStackMenuLabel(state.labels[i]) + '...');
        }
        menu.CheckMenuRadioItem(100, 105, 100 + state.activeIndex);
        menu.AppendMenuSeparator();
        menu.AppendMenuItem(0, 250, 'Show tab strip');
        menu.CheckMenuItem(250, state.tabStripVisible);
        menu.AppendMenuSeparator();

        titlesMenu.AppendMenuSeparator();
        titlesMenu.AppendMenuItem(0, 450, 'Use Title Case defaults');
        titlesMenu.AppendMenuItem(0, 451, 'Use UPPERCASE defaults');
        titlesMenu.AppendMenuItem(0, 452, 'Reset ' + darkOneInfoStackMenuLabel(state.labels[state.activeIndex]) + ' to default');
        titlesMenu.AppendMenuItem(0, 453, 'Reset all titles to defaults');

        fontMenu.AppendMenuItem(0, 200, 'Automatic tab font size');
        fontMenu.CheckMenuItem(200, state.fixedFontSize === 0);
        fontMenu.AppendMenuItem(0, 201, 'Set fixed tab font size...');
        fontMenu.AppendMenuSeparator();
        fontMenu.AppendMenuItem(0, 202, 'Set automatic base scale... (' + state.automaticFontScale + '%)');
        fontMenu.AppendMenuItem(state.automaticFontScale === 100 ? 1 : 0, 203, 'Reset automatic base scale');

        DarkOneColour.appendRadioOptions(tabColourMenu, DARKONE_INFOSTACK_TAB_COLOUR_OPTIONS, state.tabColourMode, state.tabCustomColour, 0);
        tabColourMenu.AppendMenuSeparator();
        tabColourMenu.AppendMenuItem(0, 803, 'Set custom colour...');

        areaMenu.AppendMenuItem(0, 600, 'Automatic height (follows tab font sizing)');
        areaMenu.CheckMenuItem(600, state.tabAreaHeight === 0);
        areaMenu.AppendMenuItem(0, 601, 'Set fixed tab area height...');

        DarkOneColour.appendRadioOptions(backgroundMenu, DARKONE_INFOSTACK_BACKGROUND_OPTIONS, state.backgroundMode, state.backgroundCustomColour, 0);
        backgroundMenu.AppendMenuSeparator();
        backgroundMenu.AppendMenuItem(0, 706, 'Set custom colour...');

        DarkOneColour.appendRadioOptions(dividerMenu, DARKONE_INFOSTACK_DIVIDER_OPTIONS, state.dividerMode, state.dividerCustomColour, 0);
        dividerMenu.AppendMenuSeparator();
        dividerMenu.AppendMenuItem(0, 106, 'Set custom colour...');

        startupTransitionMenu.AppendMenuItem(0, 1000, 'Off');
        startupTransitionMenu.AppendMenuItem(0, 1001, 'Black reveal');
        startupTransitionMenu.AppendMenuItem(0, 1002, 'Staged reveal');
        startupTransitionMenu.CheckMenuRadioItem(1000, 1002, 1000 + state.startupTransition);
        startupTransitionMenu.AppendTo(startupMenu, 16, 'Transition');
        startupMenu.AppendMenuItem(0, 1010, 'Minimum black hold... (' + state.startupMinimumDelay + ' ms)');
        startupMenu.AppendMenuItem(0, 1011, 'Layout-readiness timeout... (' + state.startupReadinessTimeout + ' ms)');
        startupMenu.AppendMenuSeparator();
        startupMenu.AppendMenuItem(state.startupTransition === 0 ? 1 : 0, 1012, 'Preview startup transition');
        startupMenu.AppendMenuItem(0, 1013, 'Restore startup defaults');

        visibilityMenu.AppendTo(tabSettingsMenu, 16, 'Visible tabs');
        titlesMenu.AppendTo(tabSettingsMenu, 16, 'Tab titles');
        fontMenu.AppendTo(tabSettingsMenu, 16, 'Tab font size');
        tabColourMenu.AppendTo(tabSettingsMenu, 16, 'Tab font colour');
        areaMenu.AppendTo(tabSettingsMenu, 16, 'Tab area');
        backgroundMenu.AppendTo(appearanceMenu, 16, 'InfoStack backing colour');
        dividerMenu.AppendTo(appearanceMenu, 16, 'Side divider colour');
        tabSettingsMenu.AppendTo(menu, 16, 'Tab settings');
        appearanceMenu.AppendTo(menu, 16, 'Appearance');
        startupMenu.AppendTo(menu, 16, 'Startup');

        var x = button ? Math.max(0, Math.round(Number(button.x) || 0)) : 0;
        var y = button ? Math.max(0, Math.round((Number(button.y) || 0) + (Number(button.h) || 0))) : 0;
        selectedId = menu.TrackPopupMenu(x, y);
    } finally {
        try { menu.Dispose(); } catch (e) {}
        for (var d = 0; d < submenus.length; d++) {
            try { submenus[d].Dispose(); } catch (e2) {}
        }
    }

    if (!selectedId) return true;
    var action = DarkOneViewBridge.infoStackActionCommand(selectedId);
    if (action && DarkOneViewBridge.writeCommand(action, null)) return true;
    utils.MessageBox(
        'DarkOneJSP3 could not publish the InfoStack menu action. Please try again.',
        'DarkOneJSP3 optional button', MB_OK | MB_ICONEXCLAMATION
    );
    return true;
}

function darkOneIsToolsMenuCommand(command) {
    return String(command || '').replace(/\\/g, '/').replace(/^\s+|\s+$/g, '').toLowerCase() ===
        'darkonejsp3/tools/menu';
}

function darkOneShowToolsLocalMenu(button) {
    var x = button ? Math.max(0, Math.round(Number(button.x) || 0)) : 0;
    var y = button ? Math.max(0, Math.round((Number(button.y) || 0) + (Number(button.h) || 0))) : 0;
    darkOneToolsMenu(x, y);
    return true;
}

function darkOneRunInternalButtonCommand(command, button) {
    if (darkOneIsToolsMenuCommand(command)) {
        return darkOneShowToolsLocalMenu(button);
    }
    if (typeof DarkOneViewBridge != 'object' || !DarkOneViewBridge) return false;
    var internal = DarkOneViewBridge.commandForButtonPath(command);
    if (!internal) return false;
    if (internal === DarkOneViewBridge.commands.infoStackMenu) {
        return darkOneShowInfoStackLocalMenu(button);
    }
    if (DarkOneViewBridge.writeCommand(internal, null)) return true;
    utils.MessageBox(
        'DarkOneJSP3 could not publish the internal view command. Please try again.',
        'DarkOneJSP3 optional button', MB_OK | MB_ICONEXCLAMATION
    );
    return true;
}

function optionalButtonFailure(button, styleName) {
    var propName = button.BtnName + ' command style';
    window.SetProperty(propName, 0);
    var result = utils.MessageBox(
        'The cached ' + styleName + ' command no longer resolves:\n\n' + button.CmdString +
        '\n\nIts command type has been reset. Click the button again to re-detect it, or choose OK to edit the panel properties now.',
        'Optional ' + button.BtnName + ' command', MB_OKCANCEL | MB_ICONEXCLAMATION
    );
    if (result == 1) window.ShowProperties();
}

function OptBtnCmd() {
    var button = this.funcOption;
    var propName = button.BtnName + ' command style';
    var tmp_style = Number(window.GetProperty(propName, 0)) || 0;
    var tmp_string = String(button.CmdString || '').trim();
    var tmp_func;

    if (!tmp_string) {
        utils.MessageBox('No command is configured for ' + button.BtnName + '.', 'DarkOneJSP3 optional button', MB_OK | MB_ICONEXCLAMATION);
        window.ShowProperties();
        return;
    }

    if (tmp_style == 0) {
        if (darkOneRunInternalButtonCommand(tmp_string, this)) {
            window.SetProperty(propName, 4);
            return;
        }
        if (fb.RunMainMenuCommand(tmp_string)) {
            window.SetProperty(propName, 1);
            return;
        }
        if (fb.RunContextCommand(tmp_string)) {
            window.SetProperty(propName, 2);
            return;
        }
        try {
            tmp_func = new Function('"use strict";\n' + tmp_string);
            tmp_func();
            window.SetProperty(propName, 3);
            return;
        } catch (e) {
            var message = utils.MessageBox(
                'The command could not be resolved as a DarkOneJSP3 internal command, main-menu command, context-menu command or JavaScript.\n\n' +
                tmp_string + '\n\nJavaScript diagnostic:\n' + e +
                '\n\nChoose OK to edit the command, or Cancel if this is a context command that only needs a valid playlist selection.',
                'Optional ' + button.BtnName + ' error', MB_OKCANCEL | MB_ICONEXCLAMATION
            );
            if (message == 1) window.ShowProperties();
            return;
        }
    }

    switch (tmp_style) {
    case 1:
        if (!fb.RunMainMenuCommand(tmp_string)) optionalButtonFailure(button, 'main-menu');
        break;
    case 2:
        if (!fb.RunContextCommand(tmp_string)) optionalButtonFailure(button, 'context-menu');
        break;
    case 3:
        try {
            tmp_func = new Function('"use strict";\n' + tmp_string);
            tmp_func();
        } catch (e2) {
            window.SetProperty(propName, 0);
            var result = utils.MessageBox(
                'The JavaScript command is invalid or obsolete:\n\n' + e2 +
                '\n\nIts command type has been reset. Choose OK to edit the command.',
                'Optional ' + button.BtnName + ' error', MB_OKCANCEL | MB_ICONEXCLAMATION
            );
            if (result == 1) window.ShowProperties();
        }
        break;
    case 4:
        if (!darkOneRunInternalButtonCommand(tmp_string, this)) {
            window.SetProperty(propName, 0);
            OptBtnCmd.call(this);
        }
        break;
    default:
        window.SetProperty(propName, 0);
        OptBtnCmd.call(this);
        break;
    }
}
