// =========================================================================================================
// Panel: Control Left - v2.0build20191004-jscript-panel3-v0615
// =========================================================================================================

var g_btns = safeGdiImage(imgPath + "buttons.png");
var presetCount = 5, b_btns = [], i_size, t_r = false;
btn_panel = 1;

var a_name = ";;CONSOLE;;;TIME".split(";");
var a_func = [function(){fb.Exit()}, getMainMenu, function(){fb.ShowConsole()}, function(){fb.RunMainMenuCommand("View/Show Status pane")}, function(){fb.RunMainMenuCommand("View/Show Status bar")}, function(){window.SetProperty("Remain Time", t_r ? false : true); TimeOpt()}];

var b_name = "Button 01;Button 02;Button 03;Button 04;Button 05;Button 06;Button 07;Button 08".split(";");
for (var j_ = 0; j_ < 8; j_++) b_btns.push(getButtonProperties(b_name[j_]));

// ----- CREATE BUTTONS -----
buttonsOptions();
buttonsColours();

function buttonsRefresh() {
	Buttons = {};
	var qx = [0, rbx, 0, bxf * 3, bxf * 5, rbx];
	for (var i = 0; i < 6; i++) Buttons["a_" + i] = new TextButton(a_name[i], a_func[i], padX + qx[i], i > 1 ? by1 : padY, bbw, bbh, i > 1 ? btn1Siz : btn2Siz, i > 1 ? btn1Opt : btn2Opt, btnsCol);
	for (var j = 0; j < 8; j++) if (b_btns[j].Exists) Buttons["b_" + j] = new TextButton(b_btns[j].Text.toUpperCase(), OptBtnCmd, padX + bxf * (j < 5 ? (j * 2 + 3) : (j * 2 - 3)), j < 5 ? padY : by1, bbw, bbh, btn1Siz, btn1Opt, btnsCol, "", b_btns[j]);
}

// ----- CREATE BUTTON MENU -----

function getButtonMenu(x, y) {
	var a = {}
	for (var i = 0; i < 5; i++) a[i] = window.CreatePopupMenu();

	for (var j = 0; j < 8; j++) a[1].AppendMenuItem(b_btns[j].Exists ? 8 : 0, j + 101, b_btns[j].Text ? b_btns[j].Text : b_name[j]);
	a[1].AppendMenuSeparator();
	a[1].AppendMenuItem(0, 109, "Edit buttons");
	a[1].AppendMenuItem(0, 120, "Re-detect command types");
	a[1].AppendMenuItem(0, 121, "Command guide...");

	for (var k = 1; k >= 1 && k <= presetCount; k++) a[2].AppendMenuItem(0, k + 200, "Preset " + k);
	a[2].CheckMenuRadioItem(201, 200 + presetCount, appPreset + 200);

	var tmp_arr = ["Flat", "Soft", "Medium", "Strong"];
	for (var l = 0; l < 4; l++) a[3].AppendMenuItem(0, l + 301, tmp_arr[l]);
	a[3].CheckMenuRadioItem(301, 304, depthPreset + 301);

	var roundness = typeof darkOneButtonRoundness == "function" ? darkOneButtonRoundness() : -1;
	var round_values = [-1, 0, 20, 33, 60, 100];
	var round_labels = [
		"Automatic / follow button style",
		"Square (0%)",
		"Subtle (20%)",
		"Classic DarkOne (33%)",
		"Rounded (60%)",
		"Maximum / pill (100%)"
	];
	for (var r = 0; r < round_values.length; r++) {
		a[4].AppendMenuItem(0, 401 + r, round_labels[r]);
		if (roundness == round_values[r]) a[4].CheckMenuItem(401 + r, true);
	}
	a[4].AppendMenuSeparator();
	a[4].AppendMenuItem(0, 407, "Custom roundness...");
	if (round_values.indexOf(roundness) == -1) a[4].CheckMenuItem(407, true);

	a[1].AppendTo(a[0], 0 | 16, "Optional buttons");
	a[0].AppendMenuSeparator();
	a[0].AppendMenuItem(0, 900, "DarkOne Tools...");
	a[0].AppendMenuSeparator();
	a[2].AppendTo(a[0], 0 | 16, "Button style");
	a[3].AppendTo(a[0], 0 | 16, "Button depth");
	a[4].AppendTo(a[0], 0 | 16, "Button roundness");

	var idx = a[0].TrackPopupMenu(x, y);

	switch (true) {
		case idx >= 101 && idx <= 108:
			var button_index = idx - 101;
			var was_enabled = b_btns[button_index].Exists;
			window.SetProperty(b_name[button_index], !was_enabled);
			if (was_enabled || window.GetProperty(b_name[button_index] + " command string", "")) {
				window.Reload();
				return true;
			}
			try {
				var c = utils.InputBox("Enter your main menu, context menu or trusted local JavaScript command here:", "Button command", "", true);
				var d = utils.InputBox("Enter the name for the button here\n(up to 10 letters):", "Button name", "");
				window.SetProperty(b_name[button_index] + " command string", c);
				d && window.SetProperty(b_name[button_index] + " name (up to 10 letters)", String(d).substring(0, 10));
				window.SetProperty(b_name[button_index] + " command style", 0);
				window.Reload();
				return true;
			} catch (e) {
				window.SetProperty(b_name[button_index], false);
			}
			break;

		case idx == 109:
			window.ShowProperties();
			break;

		case idx == 120:
			resetOptionalButtonCommandStyles(b_name);
			utils.MessageBox("Stored optional-button command types were reset. They will be detected again on the next click.", "DarkOneJSP3 optional buttons", MB_OK | MB_ICONASTERISK);
			break;

		case idx == 121:
			showOptionalButtonCommandGuide();
			break;

		case idx == 900:
			darkOneToolsMenu(x, y);
			break;

		case idx >= 201 && idx <= 200 + presetCount:
			window.SetProperty("Buttons appearance preset", idx - 200);
			appPreset = window.GetProperty("Buttons appearance preset");
			window.NotifyOthers("ButtonPreset", appPreset);
			buttonsOptions();
			buttonsSizes();
			buttonsRefresh();
			window.Repaint();
			break;

		case idx >= 301 && idx <= 304:
			window.SetProperty("Buttons depth preset", idx - 301);
			depthPreset = window.GetProperty("Buttons depth preset");
			window.NotifyOthers("DepthPreset", depthPreset);
			buttonsOptions();
			buttonsRefresh();
			window.Repaint();
			break;

		case idx >= 401 && idx <= 406:
			var round_values = [-1, 0, 20, 33, 60, 100];
			darkOneSetButtonRoundness(round_values[idx - 401]);
			buttonsOptions();
			buttonsSizes();
			buttonsRefresh();
			window.Repaint();
			break;

		case idx == 407:
			if (darkOneInputButtonRoundness()) {
				buttonsOptions();
				buttonsSizes();
				buttonsRefresh();
				window.Repaint();
			}
			break;
	}

	for (var m = 0; m < 5; m++) a[m].Dispose();
}

// ----- CREATE TIMESWITCH OPTION -----
function TimeOpt() {
	t_r = window.GetProperty("Remain Time", false);
	window.NotifyOthers("remTime", t_r);
}

TimeOpt();

// ----- DRAW -----
function on_paint(gr) {
	gr.FillRectangle(0, 0, ww, wh, p_backcol);
if (g_btns) {
		gr.DrawImage(g_btns, padX + (bbw - i_size) / 2, padY + (bbh - i_size) / 2, i_size, i_size, 294, 0, 36, 36);
		gr.DrawImage(g_btns, (ww - area / 8) - padX + (bbw - i_size) / 2, padY + (bbh - i_size) / 2, i_size, i_size, 420, 0, 36, 36);
	}
	darkOneDrawText(gr, "PANE --- STATUS --- BAR", btn_font, btnsCol.text_normal, padX + bxf * 3, by1, bbw * 2, Math.ceil(bbh / 3 * 2), 1);
	buttonsDraw(gr);
}

// ----- MOUSE ACTIONS -----
function on_mouse_move(x, y) {
	buttonsMouseMove(x, y);
}

function on_mouse_lbtn_down(x, y) {
	buttonsMouseLbtnDown(x, y);
}

function on_mouse_lbtn_up(x, y) {
	buttonsMouseLbtnUp(x, y);
}

function on_mouse_rbtn_up(x, y) {
	getButtonMenu(x, y);
	return true;
}

function on_mouse_leave() {
	buttonsMouseLeave();
}

// ----- EVENTS -----
function on_size() {
	ww = window.Width;
	wh = window.Height;
	i_size = ww / 105 * 3 * (typeof darkOneIconScale == 'function' ? darkOneIconScale() : 1.0);
	buttonsSizes();
	buttonsRefresh();
}

function on_notify_data(name, info) {
	if (darkOneHandleResetNotification(name, info)) return;
	if (typeof darkOneHandleNotify != 'function') return;
	var change = darkOneHandleNotify(name, info);
	if (!change || !darkOneNotifyAffects(change, 'controls')) return;
	buttonsOptions();
	buttonsSizes();
	buttonsRefresh();
	window.Repaint();
}

function on_colours_changed() {
	get_colours();
	buttonsColours();
	window.Repaint();
}

function on_script_unload() {
	buttonsUnload();
	disposeImage(g_btns);
	g_btns = null;
}
