// =========================================================================================================
// Common Button Options - v2.0build20191019-jscript-panel3-v042
// =========================================================================================================

var appPreset = window.GetProperty("Buttons appearance preset", 1);
var depthPreset = window.GetProperty("Buttons depth preset", 0);
var btn1Opt = {}, btn2Opt = {}, btnsCol = {}, btn1Siz = {}, btn2Siz = {}, vknbOpt = {}, btn_font = null, btn_font_key = '';
var area, bxf, bbw, bbh, by1, by2, padX, padY, rbx = 0, btn_panel;

function buttonsOptions() {
	btn1Opt.btn_depth = Math.max(Math.round(sysWidth / 1280), 1) * depthPreset;
	btn1Opt.btn_style = appPreset > 2 ? 3 : appPreset;
	btn1Opt.font_name = typeof darkOneControlFontName == "function" ? darkOneControlFontName() : "Arial Black";
	btn1Opt.font_weight = typeof darkOneControlFontWeight == "function" ? darkOneControlFontWeight() : DWRITE_FONT_WEIGHT_BLACK;
	btn1Opt.line_width = Math.round(sysWidth / 1280);
	btn1Opt.text_align_h = 1;
	btn1Opt.arc_override = typeof darkOneButtonRoundness == "function" && darkOneButtonRoundness() >= 0;

	if (btn_panel != 3) {
		btn2Opt.btn_depth = btn1Opt.btn_depth;
		btn2Opt.btn_style = appPreset > 3 ? appPreset - 3 : appPreset;
		btn2Opt.line_width = btn1Opt.line_width;
		btn2Opt.arc_override = btn1Opt.arc_override;
	}

	if (btn_panel == 2) {
		vknbOpt.knob_depth = btn1Opt.btn_depth;
		vknbOpt.line_width = btn1Opt.line_width;
	}
}

function buttonsColours() {
	btnsCol.back_down = RGBA(0, 0, 0, 64);
	btnsCol.back_hover = RGBA(0, 0, 0, 32);
	btnsCol.line_normal = RGBA(16, 16, 16, 255);
	btnsCol.text_normal = ui_btntxtcol;

	if (btn_panel == 2) {
		vknbOpt.line_normal = btnsCol.line_normal;
		vknbOpt.inactive_colour = RGB(64, 64, 64);
		vknbOpt.active_colour = RGB(41, 143, 204);
	}
}

function buttonsSizes() {
	var hitbox_scale = typeof darkOneButtonHitboxScale == 'function' ? darkOneButtonHitboxScale() : 1.0;
	var font_scale = typeof darkOneFontScale == 'function' ? darkOneFontScale() : 1.0;
	area = ww / 21 * 20;
	padX = ww / 42;
	padY = btn_panel == 3 ? Math.floor(wh / 3) : Math.floor(ww / 105 * 4);
	bxf = area / 16;
	bbw = btn_panel == 3 ? ww - 8 : Math.floor(area / 8);
	bbh = Math.floor((bbw / 25 * 12) * hitbox_scale);
	by1 = Math.floor(area / 80 * 7) + padY;
	by2 = wh - bbh - padY;
	rbx = (ww - area / 8) - (padX * 2);

	btn1Siz.font_size = Math.max(1, Math.round(bbw * 7 / 50 * font_scale));

	var roundness = typeof darkOneButtonRoundness == "function" ? darkOneButtonRoundness() : -1;
	if (roundness >= 0) {
		var max_arc = Math.max(0, (Math.min(bbw, bbh) - btn1Opt.line_width) / 2);
		btn1Siz.arc_size = max_arc * roundness / 100;
		btn2Siz.arc_size = btn1Siz.arc_size;
	} else {
		delete btn1Siz.arc_size;
		delete btn2Siz.arc_size;
	}

	btn1Siz.func_left_pad = appPreset == 2 ? bbw / 25 : appPreset > 2 ? bbw / 2 - bbh / 4 : 0;
	btn1Siz.func_right_pad = btn1Siz.func_left_pad;
	btn1Siz.func_top_pad = appPreset == 1 ? Math.floor(bbh / 3 * 2) : appPreset == 2 ? Math.ceil(bbh / 2) : appPreset > 2 ? bbh / 2 : 0;
	var font_key = [btn1Opt.font_name, btn1Siz.font_size, btn1Opt.font_weight].join('|');
	if (font_key != btn_font_key || !btn_font) {
		btn_font_key = font_key;
		btn_font = darkOneCreateFont(btn1Opt.font_name, btn1Siz.font_size, 0, btn1Opt.font_weight);
	}

	if (btn_panel != 3) {
		btn2Siz.func_left_pad = appPreset == 2 || appPreset == 5 ? bbw / 25 : appPreset == 3 ? (bbw - bbh) / 2 : 0;
		btn2Siz.func_right_pad = btn2Siz.func_left_pad;
	}
}