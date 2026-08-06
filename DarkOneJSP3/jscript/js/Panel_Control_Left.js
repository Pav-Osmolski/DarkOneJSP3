// =========================================================================================================
// Panel: Control Left - v2.0build20191004-jscript-panel3-v0616
// =========================================================================================================

var g_btns = safeBitmapImage(imgPath + "buttons.png");
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

function buttonsLayout() {
	var qx = [0, rbx, 0, bxf * 3, bxf * 5, rbx];
	for (var i = 0; i < 6; i++) {
		var primary = Buttons["a_" + i];
		if (primary) primary.updateLayout(padX + qx[i], i > 1 ? by1 : padY, bbw, bbh, i > 1 ? btn1Siz : btn2Siz);
	}
	for (var j = 0; j < 8; j++) {
		var optional = Buttons["b_" + j];
		if (optional) optional.updateLayout(padX + bxf * (j < 5 ? (j * 2 + 3) : (j * 2 - 3)), j < 5 ? padY : by1, bbw, bbh, btn1Siz);
	}
}

// ----- CREATE BUTTON MENU -----

function getButtonMenu(x, y) {
	darkOneShowControlButtonMenu(x, y, {
		buttonNames: b_name,
		buttonProperties: b_btns,
		appendExtraMenus: function (rootMenu) {
			var styleMenu = window.CreatePopupMenu();
			var depthMenu = window.CreatePopupMenu();

			for (var i = 1; i <= presetCount; i++)
				styleMenu.AppendMenuItem(0, i + 200, "Preset " + i);
			styleMenu.CheckMenuRadioItem(201, 200 + presetCount, appPreset + 200);

			var depthLabels = ["Flat", "Soft", "Medium", "Strong"];
			for (var j = 0; j < depthLabels.length; j++)
				depthMenu.AppendMenuItem(0, j + 301, depthLabels[j]);
			depthMenu.CheckMenuRadioItem(301, 304, depthPreset + 301);

			styleMenu.AppendTo(rootMenu, 0 | 16, "Button style");
			depthMenu.AppendTo(rootMenu, 0 | 16, "Button depth");
			return [styleMenu, depthMenu];
		},
		handleExtraSelection: function (index) {
			if (index >= 201 && index <= 200 + presetCount) {
				window.SetProperty("Buttons appearance preset", index - 200);
				appPreset = window.GetProperty("Buttons appearance preset");
				window.NotifyOthers("ButtonPreset", appPreset);
				buttonsOptions();
				buttonsSizes();
				buttonsRefresh();
				window.Repaint();
				return true;
			}

			if (index >= 301 && index <= 304) {
				window.SetProperty("Buttons depth preset", index - 301);
				depthPreset = window.GetProperty("Buttons depth preset");
				window.NotifyOthers("DepthPreset", depthPreset);
				buttonsOptions();
				buttonsRefresh();
				window.Repaint();
				return true;
			}

			return false;
		}
	});
}

// ----- CREATE TIMESWITCH OPTION -----
function TimeOpt() {
	t_r = window.GetProperty("Remain Time", false);
	window.NotifyOthers("remTime", t_r);
}

TimeOpt();

// ----- DRAW -----
function on_paint(gr) {
	darkOnePaintBottomAreaBackground(gr);
if (g_btns) {
		gr.DrawBitmap(g_btns, padX + (bbw - i_size) / 2, padY + (bbh - i_size) / 2, i_size, i_size, 294, 0, 36, 36);
		gr.DrawBitmap(g_btns, (ww - area / 8) - padX + (bbw - i_size) / 2, padY + (bbh - i_size) / 2, i_size, i_size, 420, 0, 36, 36);
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
	if (Buttons.a_0) buttonsLayout();
	else buttonsRefresh();
	darkOneRequestBottomAreaState();
}

function on_notify_data(name, info) {
	if (darkOneHandleResetNotification(name, info)) return;
	if (typeof darkOneHandleNotify != 'function') return;
	var change = darkOneHandleNotify(name, info);
	if (!change) return;
	if (!darkOneNotifyAffects(change, 'controls')) return;
	buttonsOptions();
	buttonsSizes();
	buttonsRefresh();
	window.Repaint();
}

function on_colours_changed() {
	get_colours();
	darkOneApplyBottomAreaAppearance();
}

function on_script_unload() {
	if (typeof darkOneDisposeBottomAreaBridge == 'function') darkOneDisposeBottomAreaBridge();
	buttonsUnload();
	disposeImage(g_btns);
	g_btns = null;
}
