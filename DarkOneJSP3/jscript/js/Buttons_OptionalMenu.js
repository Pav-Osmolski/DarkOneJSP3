// =========================================================================================================
// Shared optional-button menu and command configuration for the left/right control panels.
// Keeps panel-specific optional-button configuration local while centralising its
// command guide and edit behaviour. Universal appearance controls live in
// DarkOne Tools > Buttons.
// =========================================================================================================
// Version history (newest first):
// v0.1.2 keeps context menus panel-specific by limiting them to Optional buttons;
// shared appearance and DarkOne Tools now use the locally owned TOOLS popup.
//
// v0.1.1 centralised the two control-panel configuration menus while preserving
// their panel-specific optional-button lists and saved properties.
// =========================================================================================================

var DARKONE_CONTROL_BUTTON_MENU = {
    optionalFirstId: 101,
    redetectId: 120,
    guideId: 121
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

    return false;
}

function darkOneShowControlButtonMenu(x, y, options) {
    var menus = [];

    try {
        var rootMenu = window.CreatePopupMenu();
        menus.push(rootMenu);
        var optionalMenu = window.CreatePopupMenu();
        menus.push(optionalMenu);
        darkOneAppendOptionalButtonMenu(optionalMenu, options.buttonNames, options.buttonProperties);
        optionalMenu.AppendTo(rootMenu, 0 | 16, 'Optional buttons');

        var index = rootMenu.TrackPopupMenu(x, y);
        darkOneHandleControlButtonMenuSelection(index, options);
        return index;
    } finally {
        for (var i = menus.length - 1; i >= 0; i--) {
            try { menus[i].Dispose(); } catch (e) {}
        }
    }
}
