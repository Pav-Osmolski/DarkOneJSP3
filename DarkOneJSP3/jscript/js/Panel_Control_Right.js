// =========================================================================================================
// Panel: Control Right - v2.0build20191004-jscript-panel3-v0618
// =========================================================================================================

var g_btns = safeBitmapImage(imgPath + "buttons.png");
var b_btns = [], i_size, qx = [], volknob = null;
btn_panel = 2;

var volume_knob_repaint = null;
var darkOneVolumeCadenceOwner = DarkOneUiCadence.createVolumeOwner(window, {
	propertyName: "DARKONEJSP3.VOLUME.DRAG.REFRESH.MODE",
	fallback: 16,
	onChange: function() {
		if (volume_knob_repaint) volume_knob_repaint.reschedule();
		if (volknob && typeof volknob.onCadenceChanged == "function") volknob.onCadenceChanged();
	}
});

function darkOneGetVolumeDragInterval() {
	return darkOneVolumeCadenceOwner ? darkOneVolumeCadenceOwner.getInterval() : 16;
}

function darkOneGetVolumeWriteInterval() {
	// Keep expensive global fb.Volume notifications at the proven-safe cadence.
	// The knob preview can still repaint at the faster adaptive UI interval.
	return Math.max(16, darkOneGetVolumeDragInterval());
}

function darkOneGetVolumeDragMode() {
	return darkOneVolumeCadenceOwner ? darkOneVolumeCadenceOwner.getMode() : DarkOneUiCadence.volumeModeAuto;
}

function darkOneSetVolumeDragMode(mode) {
	return darkOneVolumeCadenceOwner ? darkOneVolumeCadenceOwner.setMode(mode) : false;
}

volume_knob_repaint = DarkOnePerformance.createRepaintScheduler(window, {
	getDelay: darkOneGetVolumeDragInterval,
	repaint: function() { if (volknob) volknob.Repaint(); }
});
var volume_change_deadline = DarkOnePerformance.createTrailingDeadline(window, {
	delay: 3000,
	onExpire: function() {
		v_change = false;
		if (volknob) volknob.Repaint();
	}
});

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
	darkOneShowControlButtonMenu(x, y, {
		buttonNames: b_name,
		buttonProperties: b_btns
	});
}

// ----- DRAW -----
function on_paint(gr) {
	gr.FillRectangle(0, 0, ww, wh, p_backcol);
for (var i = 0; i < 7; i++) g_btns && gr.DrawBitmap(g_btns, padX + qx[i] + (bbw - i_size) / 2, padY + (bbh - i_size) / 2, i_size, i_size, 42 * i, 0, 36, 36);
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
	v_change = true;
	volume_change_deadline.touch();
	if (!v_drag) volume_knob_repaint.request();
}

function on_notify_data(name, info) {
	if (darkOneVolumeCadenceOwner && darkOneVolumeCadenceOwner.handleNotification(name, info)) return;
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
	if (darkOneVolumeCadenceOwner) darkOneVolumeCadenceOwner.dispose();
	volume_change_deadline.cancel();
	volume_knob_repaint.cancel();
	volknob && volknob.dispose();
	volknob && volknob.on_mouse_leave();
	buttonsUnload();
	disposeImage(g_btns);
	g_btns = null;
	volknob = null;
}
