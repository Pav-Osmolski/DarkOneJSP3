// =========================================================================================================
// Shared optional-button menu and command configuration for the left/right control panels.
// Keeps panel-specific layouts and extra menus local while centralising optional-button,
// command-guide, DarkOne Tools and button-roundness behaviour.
// =========================================================================================================

var DARKONE_CONTROL_BUTTON_MENU = {
    optionalFirstId: 101,
    redetectId: 120,
    guideId: 121,
    roundnessFirstId: 401,
    roundnessCustomId: 407,
    toolsId: 900,
    roundnessValues: [-1, 0, 20, 33, 60, 100],
    roundnessLabels: [
        'Automatic / follow button style',
        'Square (0%)',
        'Subtle (20%)',
        'Classic DarkOne (33%)',
        'Rounded (60%)',
        'Maximum / pill (100%)'
    ]
};

function darkOneOptionalButtonEditId(buttonNames) {
    return DARKONE_CONTROL_BUTTON_MENU.optionalFirstId + buttonNames.length;
}

function darkOneAppendOptionalButtonMenu(menu, buttonNames, buttonProperties) {
    for (var i = 0; i < buttonNames.length; i++) {
        var button = buttonProperties[i];
        menu.AppendMenuItem(
            button && button.Exists ? 8 : 0,
            DARKONE_CONTROL_BUTTON_MENU.optionalFirstId + i,
            button && button.Text ? button.Text : buttonNames[i]
        );
    }
    menu.AppendMenuSeparator();
    menu.AppendMenuItem(0, darkOneOptionalButtonEditId(buttonNames), 'Edit buttons');
    menu.AppendMenuItem(0, DARKONE_CONTROL_BUTTON_MENU.redetectId, 'Re-detect command types');
    menu.AppendMenuItem(0, DARKONE_CONTROL_BUTTON_MENU.guideId, 'Command guide...');
}

function darkOneAppendButtonRoundnessMenu(menu) {
    var roundness = typeof darkOneButtonRoundness == 'function' ? darkOneButtonRoundness() : -1;
    var values = DARKONE_CONTROL_BUTTON_MENU.roundnessValues;
    var labels = DARKONE_CONTROL_BUTTON_MENU.roundnessLabels;

    for (var i = 0; i < values.length; i++) {
        menu.AppendMenuItem(0, DARKONE_CONTROL_BUTTON_MENU.roundnessFirstId + i, labels[i]);
        if (roundness == values[i])
            menu.CheckMenuItem(DARKONE_CONTROL_BUTTON_MENU.roundnessFirstId + i, true);
    }
    menu.AppendMenuSeparator();
    menu.AppendMenuItem(0, DARKONE_CONTROL_BUTTON_MENU.roundnessCustomId, 'Custom roundness...');
    if (values.indexOf(roundness) == -1)
        menu.CheckMenuItem(DARKONE_CONTROL_BUTTON_MENU.roundnessCustomId, true);
}

function darkOneRefreshControlButtonAppearance() {
    buttonsOptions();
    buttonsSizes();
    buttonsRefresh();
    window.Repaint();
}

function darkOneConfigureOptionalButton(buttonIndex, buttonNames, buttonProperties) {
    var buttonName = buttonNames[buttonIndex];
    var button = buttonProperties[buttonIndex];
    var wasEnabled = !!(button && button.Exists);

    window.SetProperty(buttonName, !wasEnabled);
    if (wasEnabled || window.GetProperty(buttonName + ' command string', '')) {
        window.Reload();
        return;
    }

    try {
        var command = utils.InputBox(
            'Enter your main menu, context menu or trusted local JavaScript command here:',
            'Button command', '', true
        );
        var label = utils.InputBox(
            'Enter the name for the button here\n(up to 10 letters):',
            'Button name', ''
        );
        window.SetProperty(buttonName + ' command string', command);
        if (label)
            window.SetProperty(buttonName + ' name (up to 10 letters)', String(label).substring(0, 10));
        window.SetProperty(buttonName + ' command style', 0);
        window.Reload();
    } catch (e) {
        window.SetProperty(buttonName, false);
    }
}

function darkOneHandleControlButtonMenuSelection(index, options) {
    var buttonNames = options.buttonNames;
    var buttonProperties = options.buttonProperties;
    var firstOptional = DARKONE_CONTROL_BUTTON_MENU.optionalFirstId;
    var lastOptional = firstOptional + buttonNames.length - 1;

    if (index >= firstOptional && index <= lastOptional) {
        darkOneConfigureOptionalButton(index - firstOptional, buttonNames, buttonProperties);
        return true;
    }

    if (index == darkOneOptionalButtonEditId(buttonNames)) {
        window.ShowProperties();
        return true;
    }

    if (index == DARKONE_CONTROL_BUTTON_MENU.redetectId) {
        resetOptionalButtonCommandStyles(buttonNames);
        utils.MessageBox(
            'Stored optional-button command types were reset. They will be detected again on the next click.',
            'DarkOneJSP3 optional buttons', MB_OK | MB_ICONASTERISK
        );
        return true;
    }

    if (index == DARKONE_CONTROL_BUTTON_MENU.guideId) {
        showOptionalButtonCommandGuide();
        return true;
    }

    if (index == DARKONE_CONTROL_BUTTON_MENU.toolsId) {
        darkOneToolsMenu(options.x, options.y);
        return true;
    }

    var roundnessOffset = index - DARKONE_CONTROL_BUTTON_MENU.roundnessFirstId;
    if (roundnessOffset >= 0 && roundnessOffset < DARKONE_CONTROL_BUTTON_MENU.roundnessValues.length) {
        darkOneSetButtonRoundness(DARKONE_CONTROL_BUTTON_MENU.roundnessValues[roundnessOffset]);
        darkOneRefreshControlButtonAppearance();
        return true;
    }

    if (index == DARKONE_CONTROL_BUTTON_MENU.roundnessCustomId) {
        if (darkOneInputButtonRoundness())
            darkOneRefreshControlButtonAppearance();
        return true;
    }

    return false;
}

function darkOneShowControlButtonMenu(x, y, options) {
    var rootMenu = window.CreatePopupMenu();
    var optionalMenu = window.CreatePopupMenu();
    var roundnessMenu = window.CreatePopupMenu();
    var extraMenus = [];

    options.x = x;
    options.y = y;

    try {
        darkOneAppendOptionalButtonMenu(optionalMenu, options.buttonNames, options.buttonProperties);
        optionalMenu.AppendTo(rootMenu, 0 | 16, 'Optional buttons');
        rootMenu.AppendMenuSeparator();
        rootMenu.AppendMenuItem(0, DARKONE_CONTROL_BUTTON_MENU.toolsId, 'DarkOne Tools...');
        rootMenu.AppendMenuSeparator();

        if (typeof options.appendExtraMenus == 'function') {
            var created = options.appendExtraMenus(rootMenu);
            if (created) extraMenus = created instanceof Array ? created : [created];
        }

        darkOneAppendButtonRoundnessMenu(roundnessMenu);
        roundnessMenu.AppendTo(rootMenu, 0 | 16, 'Button roundness');

        var index = rootMenu.TrackPopupMenu(x, y);
        if (!darkOneHandleControlButtonMenuSelection(index, options) &&
                typeof options.handleExtraSelection == 'function')
            options.handleExtraSelection(index);
        return index;
    } finally {
        rootMenu.Dispose();
        optionalMenu.Dispose();
        roundnessMenu.Dispose();
        for (var i = 0; i < extraMenus.length; i++)
            if (extraMenus[i] && typeof extraMenus[i].Dispose == 'function') extraMenus[i].Dispose();
    }
}
