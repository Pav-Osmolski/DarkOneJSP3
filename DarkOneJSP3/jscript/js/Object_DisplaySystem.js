// =========================================================================================================
// DisplaySystem Object - v2.0build20191007-jscript-panel3-phase2-v0618
// =========================================================================================================

var darkOneDisplayVolumeCadence = DarkOneUiCadence.createVolumeFollower(window, {
	fallback: 16,
	onChange: function() {
		if (typeof display_system != "undefined" && display_system && typeof display_system.onVolumeCadenceChanged == "function")
			display_system.onVolumeCadenceChanged();
	}
});

var g_matrix_source = safeGdiImage(imgPath + "dot_matrix.png");
var g_icons_source = safeGdiImage(imgPath + "sac_pbo.png");
var g_matrix = DarkOnePerformance.toBitmap(g_matrix_source, false);
var g_icons = DarkOnePerformance.toBitmap(g_icons_source, false);

var DARKONE_DISPLAY_ACCENT_DEFAULT = 0;
var DARKONE_DISPLAY_ACCENT_CUSTOM = 1;
var DARKONE_DISPLAY_ACCENT_COLUMNS_UI_SELECTED = 2;
var DARKONE_DISPLAY_ACCENT_MODES = [
	DARKONE_DISPLAY_ACCENT_DEFAULT,
	DARKONE_DISPLAY_ACCENT_CUSTOM,
	DARKONE_DISPLAY_ACCENT_COLUMNS_UI_SELECTED
];
var DARKONE_DISPLAY_ACCENT_MODE_PROPERTY = "DARKONEJSP3.DISPLAY.ACCENT.MODE";
var DARKONE_DISPLAY_CUSTOM_COLOUR_PROPERTY = "DARKONEJSP3.DISPLAY.ACCENT.CUSTOM.COLOUR";
var DARKONE_DISPLAY_DEFAULT_BLUE = -14053428; // #298FCC
var DARKONE_DISPLAY_MATRIX_ROW_HEIGHT = 60;
var DARKONE_DISPLAY_MATRIX_ROW_STRIDE = 66;
var DARKONE_DISPLAY_ICON_ROW_HEIGHT = 36;
var DARKONE_DISPLAY_ICON_ROW_STRIDE = 42;
var DARKONE_DISPLAY_WHITE_ROW_INDEX = 4;

function darkOneUseImageGraphics(image, callback) {
	var gr = null;
	try {
		gr = image.GetGraphics();
		callback(gr);
	} finally {
		if (gr) {
			try { image.ReleaseGraphics(); } catch (e) {}
		}
	}
}

function darkOneCreateTintedSpriteRow(source, source_y, width, height, colour) {
	if (!source) return null;

	var mask = null;
	var solid = null;
	var result = null;
	try {
		mask = utils.CreateImage(width, height);
		darkOneUseImageGraphics(mask, function (gr) {
			gr.DrawImage(source, 0, 0, width, height, 0, source_y, width, height);
		});
		mask.ApplyEffect(1); // white source glyphs -> black mask pixels

		solid = utils.CreateImage(width, height);
		darkOneUseImageGraphics(solid, function (gr) {
			gr.FillRectangle(0, 0, width, height, colour);
		});

		result = utils.CreateImage(width, height);
		darkOneUseImageGraphics(result, function (gr) {
			gr.DrawImageWithMask(solid, mask, 0, 0, width, height);
		});
		return result;
	} catch (e) {
		try { console.log('DarkOneJSP3 display accent sprite generation failed: ' + e.message); } catch (e2) {}
		disposeImage(result);
		return null;
	} finally {
		disposeImage(mask);
		disposeImage(solid);
	}
}

// ----- DIRECT DOT-MATRIX RENDERING -----
// Values are drawn directly from the cached Direct2D sprite sheet. Earlier
// builds rebuilt mutable off-screen images and converted them to new device
// bitmaps whenever time, bitrate or track numbers changed. Direct sprite draws
// remove that steady resource churn while preserving the same source geometry.

// ----- TITLE-FORMAT CACHE -----
var tf_display_lossless = fb.TitleFormat("$if($stricmp(%__encoding%,lossless),1)");
var tf_display_lossy = fb.TitleFormat("$if($not($stricmp(%__encoding%,lossless)),1)");
var tf_display_hires = fb.TitleFormat("$if($and($greater(%samplerate%,88199),$greater(%__bitspersample%,23)),1)");
var tf_display_multich = fb.TitleFormat("$if($greater(%__channels%,2),1)");
var tf_display_md5 = fb.TitleFormat("[%__md5%]");
var tf_display_replaygain = fb.TitleFormat("[%replaygain_track_gain%]");
var tf_display_tracknumber_exists = fb.TitleFormat("[%tracknumber%]");
var tf_display_totaltracks_exists = fb.TitleFormat("[%totaltracks%]");
var tf_display_tracknumber = fb.TitleFormat("[$num(%tracknumber%,2)]");
var tf_display_totaltracks = fb.TitleFormat("[$num(%totaltracks%,2)]");
var tf_display_bitrate = fb.TitleFormat("%bitrate%");

function evalTitleFormat(tf) {
	try {
		return tf.Eval();
	} catch (e) {
		return "";
	}
}

// ----- DISPLAY-SYSTEM -----

var section = {
	sac : 0,
	pbo : 1,
	pbt : 2,
	vol : 3,
	bit : 4,
};

var DARKONE_DISPLAY_INDICATOR_LABELS = ["LOSSLESS", "LOSSY", "HI-RES", "MULTI-CH", "AUDIO MD5", "REPLAYGAIN"];
var DARKONE_DISPLAY_VALUE_LABELS = ["TRACK", "TOTAL", "TIME", "VOLUME", "KBPS"];

function DisplaySystem() {
	this.display_style = window.GetProperty("Display Style", 0);
	var t_rem = window.GetProperty("Remain Time on", false), v_change = false;
	var self = this;
	var volume_repaint = DarkOnePerformance.createRepaintScheduler(window, {
		getDelay: function() { return darkOneDisplayVolumeCadence.getInterval(); },
		repaint: function() { self.repaint(section.vol); }
	});
	var volume_change_deadline = DarkOnePerformance.createTrailingDeadline(window, {
		delay: 3000,
		onExpire: function() {
			v_change = false;
			self.repaint(section.vol);
		}
	});

	this.initPos = function() {
		this.x = 0;
		this.y = 0;
		this.w = ww;
		this.h = wh;
		this.right = this.x + this.w;
		this.bottom = this.y + this.h;
		this.pxSize = this.w / 400;
		this.box_w = this.w / 6;
		this.box_h = this.pxSize * 9;
		this.ind_y = this.bottom - this.pxSize * 32;
		this.inf_y = this.bottom - this.pxSize * 28;
		this.inf_h = this.pxSize * 32;
		this.InitFonts();
		this.img_y = this.bottom - this.pxSize * 21;
		this.img_h = this.pxSize * 20;
		this.signs_left = this.x + Math.floor(this.w - this.pxSize * 18);
		this.time_left = this.x + this.pxSize * 162;
	}

	this.InitFonts = function(force) {
		var master_scale = typeof darkOneDisplayFontScale == 'function' ? darkOneDisplayFontScale() : 1.0;
		var label_scale = typeof darkOneDisplayLabelFontScale == 'function' ? darkOneDisplayLabelFontScale() : 1.0;
		var value_scale = typeof darkOneDisplayValueFontScale == 'function' ? darkOneDisplayValueFontScale() : 1.0;
		var label_name = typeof darkOneDisplayLabelFontName == 'function' ? darkOneDisplayLabelFontName() : "Arial Black";
		var label_weight = typeof darkOneDisplayLabelFontWeight == 'function' ? darkOneDisplayLabelFontWeight() : DWRITE_FONT_WEIGHT_BLACK;
		var value_name = typeof darkOneDisplayValueFontName == 'function' ? darkOneDisplayValueFontName() : "Microsoft Sans Serif";
		var value_weight = typeof darkOneDisplayValueFontWeight == 'function' ? darkOneDisplayValueFontWeight() : DWRITE_FONT_WEIGHT_NORMAL;
		var label_size = Math.max(1, Math.round(this.pxSize * 7 * master_scale * label_scale));
		var value_size = Math.max(1, Math.round(this.pxSize * 29 * master_scale * value_scale));
		var font_key = [label_name, label_weight, label_size, value_name, value_weight, value_size].join('|');
		if (!force && this.font_key === font_key && this.font_arial && this.font_serif) return false;

		this.font_key = font_key;
		this.font_arial = darkOneCreateFont(label_name, label_size, 0, label_weight);
		this.font_serif = darkOneCreateFont(value_name, value_size, 0, value_weight);
		this.value_label_widths = {};
		for (var i = 0; i < DARKONE_DISPLAY_VALUE_LABELS.length; i++) {
			this.value_label_widths[DARKONE_DISPLAY_VALUE_LABELS[i]] = darkOneCalcTextWidth(DARKONE_DISPLAY_VALUE_LABELS[i], this.font_arial);
		}
		this.value_label_widths["TIME REMAINING"] = darkOneCalcTextWidth("TIME REMAINING", this.font_arial);
		return true;
	}

	this.traceMouse = function(x, y) {
		return x >= this.x && x <= this.right && y >= this.y && y <= this.bottom;
	}

	this.disposeAccentSprites = function() {
		disposeImage(this.custom_matrix_bitmap);
		disposeImage(this.custom_icons_bitmap);
		disposeImage(this.custom_matrix_source);
		disposeImage(this.custom_icons_source);
		this.custom_matrix_bitmap = null;
		this.custom_icons_bitmap = null;
		this.custom_matrix_source = null;
		this.custom_icons_source = null;
	};

	this.refreshAccentSprites = function() {
		this.disposeAccentSprites();
		this.matrix_bitmap = g_matrix;
		this.matrix_source_y = 0;
		this.icon_bitmap = g_icons;
		this.icon_source_y = 0;

		if (this.accent_mode == DARKONE_DISPLAY_ACCENT_DEFAULT) return;

		this.custom_matrix_source = darkOneCreateTintedSpriteRow(
			g_matrix_source,
			DARKONE_DISPLAY_WHITE_ROW_INDEX * DARKONE_DISPLAY_MATRIX_ROW_STRIDE,
			g_matrix_source ? g_matrix_source.Width : 0,
			DARKONE_DISPLAY_MATRIX_ROW_HEIGHT,
			this.active_colour
		);
		this.custom_icons_source = darkOneCreateTintedSpriteRow(
			g_icons_source,
			DARKONE_DISPLAY_WHITE_ROW_INDEX * DARKONE_DISPLAY_ICON_ROW_STRIDE,
			g_icons_source ? g_icons_source.Width : 0,
			DARKONE_DISPLAY_ICON_ROW_HEIGHT,
			this.active_colour
		);
		this.custom_matrix_bitmap = DarkOnePerformance.toBitmap(this.custom_matrix_source, false);
		this.custom_icons_bitmap = DarkOnePerformance.toBitmap(this.custom_icons_source, false);

		if (this.custom_matrix_source && this.custom_matrix_bitmap) {
			this.matrix_bitmap = this.custom_matrix_bitmap;
		}
		if (this.custom_icons_source && this.custom_icons_bitmap) {
			this.icon_bitmap = this.custom_icons_bitmap;
		}
	};

	// Direct panel painting uses cached Direct2D bitmaps. Values are composed
	// from sprite-sheet source rectangles without rebuilding mutable images.
	this.drawMatrixSprite = function(gr, dx, dy, dw, dh, sx, sw, sh) {
		if (!this.matrix_bitmap) return;
		gr.DrawBitmap(this.matrix_bitmap, dx, dy, dw, dh, sx, this.matrix_source_y, sw, sh);
	};

	this.drawVolumeMatrix = function(gr, volume) {
		var text = pad_right(volume, 10);
		var base_x = this.x + this.pxSize * 204;
		var unit = this.pxSize / 3;
		for (var i = 0; i < 6; i++) {
			var index = i < 4 ? i : i + 1;
			var offset = i < 4 ? 0 : -36;
			var xoffset = index * 54 + offset;
			var digit = text.charAt(index);
			var source_x = digit == " " ? 648 : digit == "-" ? 738 : Number(digit) * 54;
			if (!isFinite(source_x)) source_x = 648;
			this.drawMatrixSprite(gr, base_x + xoffset * unit, this.img_y, 54 * unit, this.img_h, source_x, 54, 60);
		}
		this.drawMatrixSprite(gr, base_x + 216 * unit, this.img_y, 18 * unit, this.img_h, 720, 18, 60);
		this.drawMatrixSprite(gr, base_x + 396 * unit, this.img_y, 108 * unit, this.img_h, 792, 108, 60);
	};

	this.drawStatusIcon = function(gr, dx, dy, dw, dh, sx, active) {
		var bitmap = active ? this.icon_bitmap : g_icons;
		if (!bitmap) return;
		var source_y = active ? this.icon_source_y : DARKONE_DISPLAY_WHITE_ROW_INDEX * DARKONE_DISPLAY_ICON_ROW_STRIDE;
		gr.DrawBitmap(bitmap, dx, dy, dw, dh, sx, source_y, 54, 36, active ? 1.0 : 0.02);
	};

	this.drawMatrixDigit = function(gr, character, dx, dy, dw, dh) {
		var source_x = -1;
		if (character >= '0' && character <= '9') source_x = Number(character) * 54;
		else if (character == '-') source_x = 738;
		if (source_x >= 0) this.drawMatrixSprite(gr, dx, dy, dw, dh, source_x, 54, 60);
	};

	this.drawTrackNumberMatrix = function(gr, text, base_x) {
		var unit = this.pxSize / 3;
		for (var i = 0; i < 4; i++)
			this.drawMatrixDigit(gr, text.charAt(i), base_x + i * 54 * unit, this.img_y, 54 * unit, this.img_h);
	};

	this.drawTimeMatrix = function(gr, text, base_x) {
		var unit = this.pxSize / 3;
		var text_indexes = [0, 1, 3, 4, 6, 7];
		var x_offsets = [0, 54, 126, 180, 252, 306];
		for (var i = 0; i < text_indexes.length; i++)
			this.drawMatrixDigit(gr, text.charAt(text_indexes[i]), base_x + x_offsets[i] * unit, this.img_y, 54 * unit, this.img_h);
		this.drawMatrixSprite(gr, base_x + 108 * unit, this.img_y, 18 * unit, this.img_h, 702, 18, 60);
		this.drawMatrixSprite(gr, base_x + 234 * unit, this.img_y, 18 * unit, this.img_h, 702, 18, 60);
	};

	this.drawBitrateMatrix = function(gr, text, base_x) {
		var unit = this.pxSize / 3;
		for (var i = 0; i < 5; i++)
			this.drawMatrixDigit(gr, text.charAt(i), base_x + i * 54 * unit, this.img_y, 54 * unit, this.img_h);
	};

	this.InitColours = function() {
		var mode = window.GetProperty(DARKONE_DISPLAY_ACCENT_MODE_PROPERTY, null);
		var custom_colour = window.GetProperty(DARKONE_DISPLAY_CUSTOM_COLOUR_PROPERTY, null);

		mode = DarkOneColour.normaliseMode(
			mode,
			DARKONE_DISPLAY_ACCENT_MODES,
			DARKONE_DISPLAY_ACCENT_DEFAULT
		);
		custom_colour = Number(custom_colour == null ? DARKONE_DISPLAY_DEFAULT_BLUE : custom_colour);
		if (!isFinite(custom_colour)) custom_colour = DARKONE_DISPLAY_DEFAULT_BLUE;

		this.accent_mode = mode;
		this.custom_accent_colour = custom_colour;
		this.active_colour = mode == DARKONE_DISPLAY_ACCENT_CUSTOM
			? custom_colour
			: (mode == DARKONE_DISPLAY_ACCENT_COLUMNS_UI_SELECTED
				? DarkOneColour.columnsUi(4, DARKONE_DISPLAY_DEFAULT_BLUE)
				: DARKONE_DISPLAY_DEFAULT_BLUE);
		this.inactive_colour = combColours(p_backcol, -1, 0.02);
		this.refreshAccentSprites();
	}

	this.setAccent = function(mode, custom_colour) {
		mode = DarkOneColour.normaliseMode(
			mode,
			DARKONE_DISPLAY_ACCENT_MODES,
			DARKONE_DISPLAY_ACCENT_DEFAULT
		);
		window.SetProperty(DARKONE_DISPLAY_ACCENT_MODE_PROPERTY, mode);
		if (custom_colour != null) window.SetProperty(DARKONE_DISPLAY_CUSTOM_COLOUR_PROPERTY, Number(custom_colour));
		this.InitColours();
		this.setColours();
	}

	this.setDisplayStyle = function(style) {
		style = Number(style) == 1 ? 1 : 0;
		window.SetProperty("Display Style", style);
		if (this.display_style == style) return false;

		this.display_style = style;
		this.init();
		window.Repaint();
		return true;
	};


	this.setColours = function() {
		this.Colours = [];

		if (fb.IsPlaying) {
			var a = [tf_display_lossless, tf_display_lossy, tf_display_hires, tf_display_multich, tf_display_md5, tf_display_replaygain];
			for (var i = 0; i < 6; i++) this.Colours[i] = evalTitleFormat(a[i]) ? this.active_colour : this.inactive_colour;
			this.Colours[6] = evalTitleFormat(tf_display_tracknumber_exists) ? ui_btntxtcol : this.inactive_colour;
			this.Colours[7] = evalTitleFormat(tf_display_totaltracks_exists) ? ui_btntxtcol : this.inactive_colour;
			this.Colours[8] = ui_btntxtcol;
		} else for (var i = 0; i < 9; i++) this.Colours[i] = this.inactive_colour;
	}

	this.setTrackNo = function() {
		if (fb.IsPlaying) {
			var a = evalTitleFormat(tf_display_tracknumber);
			var b = evalTitleFormat(tf_display_totaltracks);
			this.TrackNo = this.display_style == 1 ? pad(a, 4) : a;
			this.TotalNo = this.display_style == 1 ? pad(b, 4) : b;
			this.Trackinfo = fb.PlaybackLength <= 0 ? false : true;
		} else {
			this.TrackNo = "";
			this.TotalNo = "";
			this.Trackinfo = false;
		}
	}

	this.setPBTime = function() {
		this.Elapse = TimeFmt(fb.PlaybackTime);
		this.Remain = fb.PlaybackLength <= 0 ? this.display_style == 1 ? "" : "-- : -- : --" : TimeFmt(fb.PlaybackLength - fb.PlaybackTime);
	}

	this.setBitrate = function() {
		var a = evalTitleFormat(tf_display_bitrate);
		this.Bitrate = this.display_style == 1 ? pad_right(a, 5) : a;
	}

	this.init = function() {
		this.setColours();
		this.setTrackNo();
		this.setPBTime();
		this.setBitrate();
	}

	this.repaint = function(what) {
		switch (what) {
		case section.sac:
			window.RepaintRect(this.signs_left, this.ind_y + this.pxSize * 2, this.pxSize * 18 + this.pxSize, this.pxSize * 12 + this.pxSize);
			break;
		case section.pbo:
			window.RepaintRect(this.signs_left, this.bottom - this.pxSize * 13, this.pxSize * 18 + this.pxSize, this.pxSize * 12 + this.pxSize);
			break;
		case section.pbt:
			if (!v_change) window.RepaintRect(this.time_left - this.pxSize * 18, this.ind_y, this.pxSize * 138, this.inf_h);
			break;
		case section.vol:
			window.RepaintRect(this.time_left, this.ind_y, this.pxSize * 210, this.inf_h + this.box_h);
			break;
		case section.bit:
			if (!v_change) window.RepaintRect(this.x + this.pxSize * 282, this.inf_y, this.pxSize * 90, this.inf_h);
			break;
		}
	}

	this.draw = function(gr) {
		for (var i = 0; i < 6; i++) {
			gr.DrawRectangle(this.x + this.box_w * i + this.pxSize * 2, this.y, this.box_w - this.pxSize * 4, this.box_h, this.pxSize, this.Colours[i]);
			darkOneDrawText(gr, DARKONE_DISPLAY_INDICATOR_LABELS[i], this.font_arial, this.Colours[i], this.x + this.box_w * i + this.pxSize * 2, this.y, this.box_w - this.pxSize * 4, this.box_h, 5);
		}

		for (var j = 0; j < 5; j++) {
			var valueLabel = j == 2 && t_rem ? "TIME REMAINING" : DARKONE_DISPLAY_VALUE_LABELS[j];
			var valueColour;
			var valueOffset;
			switch (j) {
			case 0:
				valueColour = this.Colours[6];
				valueOffset = 0;
				break;
			case 1:
				valueColour = this.Colours[7];
				valueOffset = this.pxSize * 72;
				break;
			case 2:
				valueColour = this.Colours[8];
				valueOffset = this.pxSize * (this.display_style == 1 ? 162 : 169);
				break;
			case 3:
				valueColour = v_change ? ui_btntxtcol : this.inactive_colour;
				valueOffset = this.pxSize * 310;
				break;
			default:
				valueColour = v_change ? this.inactive_colour : this.Colours[8];
				valueOffset = this.pxSize * 349;
			}
			darkOneDrawText(gr, valueLabel, this.font_arial, valueColour, this.x + valueOffset, this.ind_y, this.value_label_widths[valueLabel], this.box_h, 0);
		}

		if (this.display_style == 1) {
			if (fb.IsPlaying) {
				if (this.Trackinfo) {
					this.drawTrackNumberMatrix(gr, this.TrackNo, this.x);
					this.drawTrackNumberMatrix(gr, this.TotalNo, this.x + this.pxSize * 72);
				} else {
					this.drawMatrixSprite(gr, this.x, this.img_y, this.pxSize * 104, this.img_h, 1260, 312, 60);
				}
				this.drawMatrixSprite(gr, this.x + this.pxSize * 144, this.img_y, this.pxSize * 18, this.img_h, fb.IsPaused ? 594 : 540, 54, 60);
			}

			if (v_change) {
				this.drawVolumeMatrix(gr, fb.Volume.toFixed(2) + " db");
			} else {
				if (fb.IsPlaying) {
					var g = t_rem && fb.PlaybackLength < 0 ? false : true;
					if (g) {
						var t = t_rem ? this.Remain : this.Elapse;
						this.drawTimeMatrix(gr, t, this.time_left);
					} else {
						this.drawMatrixSprite(gr, this.time_left, this.img_y, this.pxSize * 116, this.img_h, 900, 348, 60);
					}

					this.drawBitrateMatrix(gr, this.Bitrate, this.x + this.pxSize * 282);
				}
			}
		} else {
			if (this.Trackinfo) {
				darkOneDrawText(gr, this.TrackNo, this.font_serif, this.active_colour, this.x, this.inf_y, this.pxSize * 72, this.inf_h, 0);
				darkOneDrawText(gr, this.TotalNo, this.font_serif, this.active_colour, this.x + this.pxSize * 72, this.inf_y, this.pxSize * 72, this.inf_h, 0);
			} else if (fb.IsPlaying) {
				darkOneDrawText(gr, "Stream", this.font_serif, this.active_colour, this.x, this.inf_y, this.pxSize * 144, this.inf_h, 0);
			}

			if (v_change) {
				darkOneDrawText(gr, fb.Volume.toFixed(2) + " dB", this.font_serif, this.active_colour, this.time_left, this.inf_y, this.pxSize * 210, this.inf_h, 2);
			} else if (fb.IsPlaying) {
				var t = fb.IsPaused ? "-Paused-" : t_rem ? this.Remain : this.Elapse;
				darkOneDrawText(gr, t, this.font_serif, this.active_colour, this.time_left, this.inf_y, this.pxSize * 120, this.inf_h, 5);
				darkOneDrawText(gr, this.Bitrate, this.font_serif, this.active_colour, this.x + this.pxSize * 282, this.inf_y, this.pxSize * 90, this.inf_h, 2);
			}
		}
		this.drawStatusIcon(gr, this.signs_left, this.ind_y + this.pxSize * 2, this.pxSize * 18, this.pxSize * 12, 0, fb.StopAfterCurrent);
		this.drawStatusIcon(gr, this.signs_left, this.bottom - this.pxSize * 13, this.pxSize * 18, this.pxSize * 12, 60 + plman.PlaybackOrder * 60, fb.IsPlaying);
	}

	this.VolumeChange = function(val) {
		v_change = true;
		volume_change_deadline.touch();
		volume_repaint.request();
	}

	this.onVolumeCadenceChanged = function() {
		volume_repaint.reschedule();
	}

	this.NotifyData = function(name, info) {
		if (name == "remTime") {
			t_rem = info;
			window.SetProperty("Remain Time on", t_rem);
			if (fb.IsPlaying) this.repaint(section.pbt);
		}
	}

	this.PlayTime = function(time) {
		this.setPBTime();
		this.repaint(section.pbt);
	}

	this.PlayDynInfo = function() {
		this.setBitrate();
		this.repaint(section.bit);
	}

	this.PlayEdited = function() {
		this.setTrackNo();
		window.Repaint();
	}

	this.onStop = function(reason) {
		if (reason != 2) {
			this.setColours();
			this.setTrackNo();
			this.setPBTime();
			this.setBitrate();
		}
		window.Repaint();
	}

	this.onUnload = function() {
		darkOneDisplayVolumeCadence.dispose();
		volume_change_deadline.cancel();
		volume_repaint.cancel();
		this.font_arial = null;
		this.font_serif = null;
		this.value_label_widths = null;
		this.disposeAccentSprites();
		disposeImage(g_matrix);
		disposeImage(g_icons);
		disposeImage(g_matrix_source);
		disposeImage(g_icons_source);
		g_matrix = null;
		g_icons = null;
		g_matrix_source = null;
		g_icons_source = null;
	};

	this.InitColours();
	this.init();
}

var display_system = new DisplaySystem();