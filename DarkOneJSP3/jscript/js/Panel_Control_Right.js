// =========================================================================================================
// Panel: Control Right - v2.0build20191004-jscript-panel3-v0615
// =========================================================================================================

var g_btns = safeGdiImage(imgPath + "buttons.png");
var v_timer = null, b_btns = [], i_size, qx = [], volknob = null;
btn_panel = 2;

var a_name = ";;;;;;;STOP A. C.;PB. ORDER".split(";");
var a_func = [getOpenMenu, function(){fb.Prev()}, function(){fb.Pause()}, function(){fb.Play()}, function(){fb.Stop();}, function(){fb.Next()}, function(){fb.Random()}, function(){fb.RunMainMenuCommand("Playback/Stop After Current")}, getPBOMenu];

var b_name = "Button 01;Button 02;Button 03;Button 04;Button 05;Button 06;Button 07;Button 08;Button 09;Button 10".split(";");
for (var j_ = 0; j_ < 10; j_++) b_btns.push(getButtonProperties(b_name[j_]));

// ----- CREATE BUTTONS -----
buttonsOptions();
buttonsColours();

function buttonsRefresh() {
	Buttons = {};
	qx = [0, bxf * 3, bxf * 5, bxf * 7, bxf * 9, bxf * 11, rbx, 0, 0];
	for (var i = 0; i < 9; i++) Buttons["a_" + i] = new TextButton(a_name[i], a_func[i], padX + qx[i], i == 7 ? by1 : i == 8 ? by2 : padY, bbw, bbh, i < 7 ? btn2Siz : btn1Siz, i < 7 ? btn2Opt : btn1Opt, btnsCol);
	for (var j = 0; j < 10; j++) if (b_btns[j].Exists) Buttons["b_" + j] = new TextButton(b_btns[j].Text.toUpperCase(), OptBtnCmd, padX + bxf * (j < 5 ? (j * 2 + 3) : (j * 2 - 7)), j < 5 ? by1 : by2, bbw, bbh, btn1Siz, btn1Opt, btnsCol, "", b_btns[j]);
	volknob = new VolumeKnob(padX + rbx, wh - area / 8 - padY, bbw, bbw, vknbOpt);
}

// ----- CREATE BUTTON MENU -----

function getButtonMenu(x, y) {
	var a = window.CreatePopupMenu();
	var b = window.CreatePopupMenu();
	var round_menu = window.CreatePopupMenu();

	for (var i = 0; i < 10; i++) b.AppendMenuItem(b_btns[i].Exists ? 8 : 0, i + 101, b_btns[i].Text ? b_btns[i].Text : b_name[i]);
	b.AppendMenuSeparator();
	b.AppendMenuItem(0, 111, "Edit buttons");
	b.AppendMenuItem(0, 120, "Re-detect command types");
	b.AppendMenuItem(0, 121, "Command guide...");
	b.AppendTo(a, 0 | 16, "Optional buttons");
	a.AppendMenuSeparator();
	a.AppendMenuItem(0, 900, "DarkOne Tools...");
	a.AppendMenuSeparator();

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
		round_menu.AppendMenuItem(0, 401 + r, round_labels[r]);
		if (roundness == round_values[r]) round_menu.CheckMenuItem(401 + r, true);
	}
	round_menu.AppendMenuSeparator();
	round_menu.AppendMenuItem(0, 407, "Custom roundness...");
	if (round_values.indexOf(roundness) == -1) round_menu.CheckMenuItem(407, true);
	round_menu.AppendTo(a, 0 | 16, "Button roundness");

	var idx = a.TrackPopupMenu(x, y);

	switch (true) {
		case idx >= 101 && idx <= 110:
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

		case idx == 111:
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

	a.Dispose();
	b.Dispose();
	round_menu.Dispose();
}

// ----- DRAW -----
function on_paint(gr) {
	gr.FillRectangle(0, 0, ww, wh, p_backcol);
for (var i = 0; i < 7; i++) g_btns && gr.DrawImage(g_btns, padX + qx[i] + (bbw - i_size) / 2, padY + (bbh - i_size) / 2, i_size, i_size, 42 * i, 0, 36, 36);
	darkOneDrawText(gr, "VOLUME", btn_font, btnsCol.text_normal, rbx + padX, by1, bbw, Math.ceil(bbh / 3 * 2), 1);
	buttonsDraw(gr);
	volknob && volknob.draw(gr);
}

// ----- MOUSE ACTIONS -----
function on_mouse_move(x, y){
	buttonsMouseMove(x, y);
	volknob && volknob.on_mouse_move(x, y);
}

function on_mouse_lbtn_down(x, y){
	buttonsMouseLbtnDown(x, y);
	volknob && volknob.on_mouse_lbtn_down(x, y);
}

function on_mouse_lbtn_up(x, y){
	buttonsMouseLbtnUp(x, y);
	volknob && volknob.on_mouse_lbtn_up(x, y);
}

function on_mouse_wheel(step){
	volknob && volknob.on_mouse_wheel(step);
}

function on_mouse_rbtn_up(x, y) {
	volknob && volknob.traceMouse(x, y) ? volknob.on_mouse_rbtn_up(x, y) : getButtonMenu(x, y);
	return true;
}

function on_mouse_leave() {
	buttonsMouseLeave();
	volknob && volknob.on_mouse_leave();
}

// ----- EVENTS -----
function on_size() {
	ww = window.Width;
	wh = window.Height;
	i_size = ww / 105 * 3 * (typeof darkOneIconScale == 'function' ? darkOneIconScale() : 1.0);
	buttonsSizes();
	buttonsRefresh();
}

function on_volume_change(val) {
	v_timer = clearPanelTimer(v_timer);
	v_timer = window.SetTimeout(function () {
		volknob && volknob.Repaint();
		v_timer = clearPanelTimer(v_timer);
		v_change = false;
	}, 3000);
	v_change = true;
	volknob && volknob.Repaint();
}

function on_notify_data(name, info) {
	if (darkOneHandleResetNotification(name, info)) return;
	if (typeof darkOneHandleNotify == 'function') {
		var change = darkOneHandleNotify(name, info);
		if (change) {
			if (darkOneNotifyAffects(change, 'controls')) {
				buttonsOptions();
				buttonsSizes();
				buttonsRefresh();
				window.Repaint();
			}
			return;
		}
	}

	if (name == "ButtonPreset") {
		window.SetProperty("Buttons appearance preset", info);
		appPreset = info;
		buttonsOptions();
		buttonsSizes();
		buttonsRefresh();
		window.Repaint();
	}

	if (name == "DepthPreset") {
		window.SetProperty("Buttons depth preset", info);
		depthPreset = info;
		buttonsOptions();
		buttonsRefresh();
		window.Repaint();
	}
}

function on_colours_changed() {
	get_colours();
	buttonsColours();
	if (volknob) {
		volknob.line_normal = vknbOpt.line_normal;
		volknob.line_hover = vknbOpt.line_normal;
		volknob.inactive_colour = vknbOpt.inactive_colour;
		volknob.active_colour = vknbOpt.active_colour;
	}
	window.Repaint();
}

function on_script_unload() {
	v_timer = clearPanelTimer(v_timer);
	volknob && volknob.on_mouse_leave();
	buttonsUnload();
	disposeImage(g_btns);
	g_btns = null;
	volknob = null;
}
