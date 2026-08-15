// =========================================================================================================
// Optional button properties and command execution - hardened for JSP3.
// Disabled buttons retain their configuration. Command types are re-detected
// automatically after a cached main/context command stops resolving.
// =========================================================================================================

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
        '1. DarkOneJSP3 internal command, for example: DarkOneJSP3/Layout/Toggle, DarkOneJSP3/Visualiser/Toggle or DarkOneJSP3/InfoStack/Menu\n' +
        '2. Main-menu path, for example: View/Console\n' +
        '3. Context-menu command for the current selection\n' +
        '4. JavaScript code executed locally by this panel\n\n' +
        'JavaScript commands are advanced functionality and should only contain code you trust. ' +
        'Use Re-detect command types after components or menu names change.',
        'DarkOneJSP3 optional buttons', MB_OK | MB_ICONASTERISK
    );
}

function darkOneRunInternalButtonCommand(command, button) {
    if (typeof DarkOneViewBridge != 'object' || !DarkOneViewBridge) return false;
    var internal = DarkOneViewBridge.commandForButtonPath(command);
    if (!internal) return false;
    var anchorX = null;
    if (internal === DarkOneViewBridge.commands.infoStackMenu && button && window.Width > 0) {
        anchorX = Math.round((Number(button.x) + Number(button.w) / 2) * 1000 / window.Width);
    }
    if (DarkOneViewBridge.writeCommand(internal, anchorX)) return true;
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
