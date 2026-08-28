var DARKONE_PAGE_BACKGROUND_TRANSPARENT = 0;
var DARKONE_PAGE_BACKGROUND_BLACK = 1;
var DARKONE_PAGE_BACKGROUND_GREY = 2;
var DARKONE_PAGE_BACKGROUND_DARK_GREY = 3;
var DARKONE_PAGE_BACKGROUND_CUSTOM = 4;
var DARKONE_PAGE_BACKGROUND_COLUMNS_UI = 5;
var DARKONE_PAGE_BACKGROUND_MODES = [
	DARKONE_PAGE_BACKGROUND_TRANSPARENT,
	DARKONE_PAGE_BACKGROUND_BLACK,
	DARKONE_PAGE_BACKGROUND_GREY,
	DARKONE_PAGE_BACKGROUND_DARK_GREY,
	DARKONE_PAGE_BACKGROUND_CUSTOM,
	DARKONE_PAGE_BACKGROUND_COLUMNS_UI
];
var DARKONE_PAGE_BACKGROUND_MENU_OPTIONS = [
	{ id : 131, mode : DARKONE_PAGE_BACKGROUND_TRANSPARENT, label : 'Transparent / inherit parent' },
	{ id : 132, mode : DARKONE_PAGE_BACKGROUND_BLACK, label : 'Black' },
	{ id : 133, mode : DARKONE_PAGE_BACKGROUND_GREY, label : 'DarkOne grey' },
	{ id : 134, mode : DARKONE_PAGE_BACKGROUND_DARK_GREY, label : 'DarkOne dark grey' },
	{ id : 135, mode : DARKONE_PAGE_BACKGROUND_COLUMNS_UI, label : 'Columns UI global background' },
	{ id : 136, mode : DARKONE_PAGE_BACKGROUND_CUSTOM, custom : true }
];
var DARKONE_PAGE_COLOURS_DYNAMIC_MENU_ID = 130;
var DARKONE_PAGE_BACKGROUND_CUSTOM_MENU_ID = 137;
var DARKONE_PAGE_TEXT_DEFAULT = 0;
var DARKONE_PAGE_TEXT_CUSTOM = 1;
var DARKONE_PAGE_TEXT_DEFAULT_MENU_ID = 140;
var DARKONE_PAGE_TEXT_CUSTOM_MENU_ID = 141;
var DARKONE_PAGE_TEXT_PICKER_MENU_ID = 142;
var DARKONE_PAGE_SELECTED_DEFAULT = 0;
var DARKONE_PAGE_SELECTED_CUSTOM = 1;
var DARKONE_PAGE_SELECTED_DEFAULT_MENU_ID = 150;
var DARKONE_PAGE_SELECTED_CUSTOM_MENU_ID = 151;
var DARKONE_PAGE_SELECTED_PICKER_MENU_ID = 152;
var DARKONE_PAGE_WALLPAPER_NONE = 0;
var DARKONE_PAGE_WALLPAPER_FRONT = 1;
var DARKONE_PAGE_WALLPAPER_CUSTOM = 2;
var DARKONE_PAGE_WALLPAPER_NONE_MENU_ID = 160;
var DARKONE_PAGE_WALLPAPER_FRONT_MENU_ID = 161;
var DARKONE_PAGE_WALLPAPER_CUSTOM_MENU_ID = 162;
var DARKONE_PAGE_WALLPAPER_PATH_MENU_ID = 163;
var DARKONE_PAGE_WALLPAPER_BLUR_MENU_ID = 164;
var DARKONE_PAGE_WALLPAPER_OPACITY = 0.1;
var DARKONE_PAGE_WALLPAPER_BLUR_VALUE = 50;
var on_script_unload;

function _panel(options) {
	// Optional enhanced information-page background support is enabled only
	// by participating entry scripts. Generic JScript Panel samples retain their
	// normal behaviour. The legacy DarkOneJSP3 option remains an alias.
	this.create_font = function (size, weight) {
		return JSON.stringify({
			Name : this.fonts.name,
			Size : _scale(size),
			Weight : weight || 400,
			Style : 0,
			Stretch : 5
		});
	}

	this.draw_header = function (gr, text) {
		gr.WriteText2(text, this.fonts.small, this.colours.highlight, LM, 0, this.w - (LM * 2), TM, DWRITE_TEXT_ALIGNMENT_LEADING, DWRITE_PARAGRAPH_ALIGNMENT_CENTER, DWRITE_WORD_WRAPPING_NO_WRAP, DWRITE_TRIMMING_GRANULARITY_CHARACTER);
		gr.DrawLine(0, TM + 0.5, this.w, TM + 0.5, 1, setAlpha(this.colours.highlight, 80));
	}

	this.get_tfo = function (t) {
		if (!this.tfo[t]) {
			this.tfo[t] = fb.TitleFormat(t);
		}

		return this.tfo[t];
	}

	this.prefer_playing = function () {
		return this.selection.value == 0 && fb.IsPlaying;
	}

	this.tf = function (t) {
		if (!this.metadb)
			return '';

		var tfo = this.get_tfo(t);

		if (this.prefer_playing())
			return tfo.Eval();

		return tfo.EvalWithMetadb(this.metadb);
	}

// callbacks begin
	this.colours_changed = function () {
		if (window.IsDefaultUI) {
			this.colours.background = window.GetColourDUI(1);
			this.colours.text = window.GetColourDUI(0);
			this.colours.highlight = window.GetColourDUI(2);
		} else {
			this.colours.background = window.GetColourCUI(3);
			this.colours.text = window.GetColourCUI(0);
			this.colours.highlight = blendColours(this.colours.text, this.colours.background, 0.4);
		}

		this.dynamic_palette = null;
		if (!this.enhanced_page_background) return;

		if (this.dynamic_colours.value && typeof GetNowPlayingColours == 'function') {
			try {
				var dynamic = GetNowPlayingColours();
				if (dynamic && dynamic.length >= 4) {
					this.dynamic_palette = [
						DarkOneColour.opaque(dynamic[0]),
						DarkOneColour.opaque(dynamic[1]),
						DarkOneColour.opaque(dynamic[2]),
						DarkOneColour.opaque(dynamic[3])
					];
				}
			} catch (e) {}
		}

		if (this.dynamic_palette) {
			this.colours.background = this.dynamic_palette[0];
			this.colours.text = this.dynamic_palette[1];
		} else if (this.text_colour.mode.value == DARKONE_PAGE_TEXT_CUSTOM) {
			this.colours.text = DarkOneColour.opaque(this.text_colour.custom.value);
		}
		this.colours.highlight = blendColours(
			this.colours.text,
			this.page_contrast_background_colour(),
			0.4
		);
	}

	this.playback_colours_changed = function (type) {
		if (!this.enhanced_page_background) return false;
		var changed = arguments.length == 0 || type == 1
			? this.update_wallpaper()
			: false;
		if (this.dynamic_colours.value) {
			this.colours_changed();
			changed = true;
		}
		if (changed) window.Repaint();
		return changed;
	}

	this.font_changed = function () {
		this.fonts.name = JSON.parse(window.IsDefaultUI ? window.GetFontDUI(0) : window.GetFontCUI(0)).Name;
		this.fonts.normal = this.create_font(this.fonts.size.value);
		this.fonts.small = this.create_font(this.fonts.size.value - 2);
		this.fonts.title = this.create_font(this.fonts.size.value, 700);
		this.row_height = _scale(this.fonts.size.value + 4);
		_.invoke(this.text_objects, 'font_changed');
		_.invoke(this.list_objects, 'font_changed');
		_.invoke(this.display_objects, 'refresh', true);
	}

	this.item_focus_change = function () {
		if (!this.metadb_func)
			return;

		this.metadb = this.prefer_playing() ? fb.GetNowPlaying() : fb.GetFocusItem();

		if (!this.metadb) {
			_tt('');
		}

		on_metadb_changed();
	}

	this.page_background_mode = function () {
		return DarkOneColour.normaliseMode(
			this.page_background.mode.value,
			DARKONE_PAGE_BACKGROUND_MODES,
			DARKONE_PAGE_BACKGROUND_DARK_GREY
		);
	}

	this.page_background_colour = function () {
		if (this.dynamic_palette) return this.dynamic_palette[0];
		switch (this.page_background_mode()) {
		case DARKONE_PAGE_BACKGROUND_TRANSPARENT:
			return 0x00000000;
		case DARKONE_PAGE_BACKGROUND_BLACK:
			return RGB(0, 0, 0);
		case DARKONE_PAGE_BACKGROUND_GREY:
			return RGB(32, 32, 32);
		case DARKONE_PAGE_BACKGROUND_CUSTOM:
			return DarkOneColour.opaque(this.page_background.custom.value);
		case DARKONE_PAGE_BACKGROUND_COLUMNS_UI:
			return DarkOneColour.opaque(this.colours.background);
		default:
			return RGB(24, 24, 24);
		}
	}

	this.page_contrast_background_colour = function () {
		var background = this.page_background_colour();
		return (background >>> 0) === 0 ? this.colours.background : background;
	}

	this.selected_background_colour = function () {
		if (!this.enhanced_selected_background) return null;
		if (this.dynamic_palette) return this.dynamic_palette[2];
		return this.selected_background.mode.value == DARKONE_PAGE_SELECTED_CUSTOM
			? DarkOneColour.opaque(this.selected_background.custom.value)
			: null;
	}

	this.selected_text_colour = function (background) {
		if (this.dynamic_palette) return this.dynamic_palette[3];
		if (typeof background != 'number') background = this.selected_background_colour();
		return background !== null && typeof DetermineTextColour == 'function'
			? DetermineTextColour(background)
			: this.colours.highlight;
	}

	this.wallpaper_mode = function () {
		if (!this.enhanced_page_background || !this.wallpaper) return DARKONE_PAGE_WALLPAPER_NONE;
		var mode = Math.round(Number(this.wallpaper.mode.value));
		return mode == DARKONE_PAGE_WALLPAPER_FRONT || mode == DARKONE_PAGE_WALLPAPER_CUSTOM
			? mode
			: DARKONE_PAGE_WALLPAPER_NONE;
	}

	this.dispose_wallpaper = function () {
		if (!this.wallpaper_image) return false;
		try { this.wallpaper_image.Dispose(); } catch (e) {}
		this.wallpaper_image = null;
		return true;
	}

	this.update_wallpaper = function (force) {
		var changed = this.dispose_wallpaper();
		var mode = this.wallpaper_mode();
		this.wallpaper_pending = false;
		if (mode == DARKONE_PAGE_WALLPAPER_NONE) return changed;
		if (!force && window.IsVisible === false) {
			this.wallpaper_pending = true;
			return changed;
		}

		var metadb = fb.GetNowPlaying();
		if (!metadb) return changed;

		var source = null;
		var bitmap = null;
		try {
			if (mode == DARKONE_PAGE_WALLPAPER_FRONT) {
				source = metadb.GetAlbumArt();
			} else if (!String(this.wallpaper.path.value || '').length) {
				return changed;
			} else if (utils.IsFile(this.wallpaper.path.value)) {
				source = utils.LoadImage(this.wallpaper.path.value);
			} else {
				source = utils.LoadImage(fb.ProfilePath + this.wallpaper.path.value);
			}

			if (!source) return changed;
			if (this.wallpaper.blurred.value) source.StackBlur(DARKONE_PAGE_WALLPAPER_BLUR_VALUE);
			try {
				bitmap = source.CreateBitmap();
			} catch (bitmap_error) {
				// GDI+ render paths may already provide the drawable image object.
				bitmap = source;
				source = null;
			}
		} catch (e) {
			console.log('[Information page wallpaper] Could not load the selected image: ' + e.message);
		} finally {
			if (source) {
				try { source.Dispose(); } catch (dispose_error) {}
			}
		}

		this.wallpaper_image = bitmap;
		return changed || Boolean(bitmap);
	}

	this.draw_wallpaper = function (gr) {
		if (this.wallpaper_pending && window.IsVisible !== false) this.update_wallpaper(true);
		if (!this.wallpaper_image || this.wallpaper_mode() == DARKONE_PAGE_WALLPAPER_NONE) return;
		var width = this.w;
		var height = this.h - TM;
		if (width <= 0 || height <= 0) return;

		if (this.wallpaper_image.Width / this.wallpaper_image.Height < width / height) {
			var src_x = 0;
			var src_w = this.wallpaper_image.Width;
			var src_h = Math.round(height * this.wallpaper_image.Width / width);
			var src_y = Math.round((this.wallpaper_image.Height - src_h) / 2);
		} else {
			var src_y = 0;
			var src_w = Math.round(width * this.wallpaper_image.Height / height);
			var src_h = this.wallpaper_image.Height;
			var src_x = Math.round((this.wallpaper_image.Width - src_w) / 2);
		}

		_drawImageOrBitmap(
			gr,
			this.wallpaper_image,
			0,
			TM,
			width,
			height,
			src_x + 3,
			src_y + 3,
			src_w - 6,
			src_h - 6,
			DARKONE_PAGE_WALLPAPER_OPACITY
		);
	}

	this.dispose = function () {
		this.wallpaper_pending = false;
		this.dispose_wallpaper();
	}

	this.paint = function (gr) {
		if (this.enhanced_page_background) {
			gr.Clear(this.page_background_colour());
			this.draw_wallpaper(gr);
			return;
		}

		switch (true) {
		case !this.custom_background:
		case this.colours.mode.value == 0:
			var col = this.colours.background;
			break;
		case this.colours.mode.value == 1:
			var col = window.IsDark ? 0x202020 : utils.GetSysColour(15);
			break;
		case this.colours.mode.value == 2:
			var col = this.colours.custom_background.value;
			break;
		}

		gr.Clear(col);
	}

	this.rbtn_up = function (x, y, object) {
		this.m = window.CreatePopupMenu();
		this.s1 = window.CreatePopupMenu();
		this.s2 = window.CreatePopupMenu();
		this.s3 = window.CreatePopupMenu();
		this.s10 = window.CreatePopupMenu();
		this.s11 = window.CreatePopupMenu();
		this.s12 = window.CreatePopupMenu();
		this.s13 = window.CreatePopupMenu();
		this.s14 = window.CreatePopupMenu();
		this.s15 = window.CreatePopupMenu();
		this.s16 = null;
		this.s17 = null;
		this.s18 = null;
		this.s19 = null;

		// panel 1-999
		// object 1000+
		if (object) {
			object.rbtn_up(x, y);
		}

		if (this.list_objects.length || this.text_objects.length || this.display_objects.length) {
			_.forEach(this.fonts.sizes, function (item) {
				this.s1.AppendMenuItem(MF_STRING, item, item);
			}, this);

			this.s1.CheckMenuRadioItem(_.first(this.fonts.sizes), _.last(this.fonts.sizes), this.fonts.size.value);
			this.s1.AppendTo(this.m, MF_STRING, 'Font size');
			this.m.AppendMenuSeparator();
		}

		if (this.enhanced_page_background) {
			this.s16 = window.CreatePopupMenu();
			this.s17 = window.CreatePopupMenu();
			this.s15.AppendMenuItem(
				CheckMenuIf(this.dynamic_colours.value),
				DARKONE_PAGE_COLOURS_DYNAMIC_MENU_ID,
				'Enable Dynamic'
			);
			this.s15.AppendMenuSeparator();
			DarkOneColour.appendRadioOptions(
				this.s16,
				DARKONE_PAGE_BACKGROUND_MENU_OPTIONS,
				this.page_background_mode(),
				this.page_background.custom.value,
				MF_STRING
			);
			this.s16.AppendMenuSeparator();
			this.s16.AppendMenuItem(MF_STRING, DARKONE_PAGE_BACKGROUND_CUSTOM_MENU_ID, 'Set custom colour...');
			this.s16.AppendTo(this.s15, MF_STRING, 'Page background');

			this.s17.AppendMenuItem(MF_STRING, DARKONE_PAGE_TEXT_DEFAULT_MENU_ID, 'Default');
			this.s17.AppendMenuItem(MF_STRING, DARKONE_PAGE_TEXT_CUSTOM_MENU_ID, 'Custom');
			this.s17.CheckMenuRadioItem(
				DARKONE_PAGE_TEXT_DEFAULT_MENU_ID,
				DARKONE_PAGE_TEXT_CUSTOM_MENU_ID,
				this.text_colour.mode.value == DARKONE_PAGE_TEXT_CUSTOM
					? DARKONE_PAGE_TEXT_CUSTOM_MENU_ID
					: DARKONE_PAGE_TEXT_DEFAULT_MENU_ID
			);
			this.s17.AppendMenuSeparator();
			this.s17.AppendMenuItem(MF_STRING, DARKONE_PAGE_TEXT_PICKER_MENU_ID, 'Set custom colour...');
			this.s17.AppendTo(this.s15, MF_STRING, 'Text');

			if (this.enhanced_selected_background) {
				this.s18 = window.CreatePopupMenu();
				this.s18.AppendMenuItem(MF_STRING, DARKONE_PAGE_SELECTED_DEFAULT_MENU_ID, 'Default');
				this.s18.AppendMenuItem(MF_STRING, DARKONE_PAGE_SELECTED_CUSTOM_MENU_ID, 'Custom');
				this.s18.CheckMenuRadioItem(
					DARKONE_PAGE_SELECTED_DEFAULT_MENU_ID,
					DARKONE_PAGE_SELECTED_CUSTOM_MENU_ID,
					this.selected_background.mode.value == DARKONE_PAGE_SELECTED_CUSTOM
						? DARKONE_PAGE_SELECTED_CUSTOM_MENU_ID
						: DARKONE_PAGE_SELECTED_DEFAULT_MENU_ID
				);
				this.s18.AppendMenuSeparator();
				this.s18.AppendMenuItem(MF_STRING, DARKONE_PAGE_SELECTED_PICKER_MENU_ID, 'Set custom colour...');
				this.s18.AppendTo(this.s15, MF_STRING, 'Selected background');
			}
			this.s15.AppendTo(this.m, MF_STRING, 'Colours');
			this.m.AppendMenuSeparator();

			this.s19 = window.CreatePopupMenu();
			this.s19.AppendMenuItem(MF_STRING, DARKONE_PAGE_WALLPAPER_NONE_MENU_ID, 'None');
			this.s19.AppendMenuItem(MF_STRING, DARKONE_PAGE_WALLPAPER_FRONT_MENU_ID, 'Front cover of playing track');
			this.s19.AppendMenuItem(MF_STRING, DARKONE_PAGE_WALLPAPER_CUSTOM_MENU_ID, 'Custom image');
			this.s19.CheckMenuRadioItem(
				DARKONE_PAGE_WALLPAPER_NONE_MENU_ID,
				DARKONE_PAGE_WALLPAPER_CUSTOM_MENU_ID,
				DARKONE_PAGE_WALLPAPER_NONE_MENU_ID + this.wallpaper_mode()
			);
			this.s19.AppendMenuSeparator();
			this.s19.AppendMenuItem(
				EnableMenuIf(this.wallpaper_mode() == DARKONE_PAGE_WALLPAPER_CUSTOM),
				DARKONE_PAGE_WALLPAPER_PATH_MENU_ID,
				'Custom image path...'
			);
			this.s19.AppendMenuSeparator();
			this.s19.AppendMenuItem(
				GetMenuFlags(this.wallpaper_mode() != DARKONE_PAGE_WALLPAPER_NONE, this.wallpaper.blurred.value),
				DARKONE_PAGE_WALLPAPER_BLUR_MENU_ID,
				'Blur'
			);
			this.s19.AppendTo(this.m, MF_STRING, 'Background Wallpaper');
			this.m.AppendMenuSeparator();
		} else if (this.custom_background) {
			this.s2.AppendMenuItem(MF_STRING, 100, window.IsDefaultUI ? 'Use default UI setting' : 'Use columns UI setting');
			this.s2.AppendMenuItem(MF_STRING, 101, 'Splitter');
			this.s2.AppendMenuItem(MF_STRING, 102, 'Custom');
			this.s2.CheckMenuRadioItem(100, 102, this.colours.mode.value + 100);
			this.s2.AppendMenuSeparator();
			this.s2.AppendMenuItem(EnableMenuIf(this.colours.mode.value == 2), 103, 'Set custom colour...');
			this.s2.AppendTo(this.m, MF_STRING, 'Background colour');
			this.m.AppendMenuSeparator();
		}

		if (this.metadb_func) {
			this.s3.AppendMenuItem(MF_STRING, 110, 'Prefer now playing');
			this.s3.AppendMenuItem(MF_STRING, 111, 'Follow selected track (playlist)');
			this.s3.CheckMenuRadioItem(110, 111, this.selection.value + 110);
			this.s3.AppendTo(this.m, MF_STRING, 'Selection mode');
			this.m.AppendMenuSeparator();
		}

		this.m.AppendMenuItem(MF_STRING, 120, 'Configure...');

		var idx = this.m.TrackPopupMenu(x, y);
		this.m.Dispose();

		// Do not touch the optional colour helper for ordinary samples. Switch
		// case expressions are evaluated in order, so resolving this beforehand
		// avoids a ReferenceError when an object-specific command is selected.
		var background_option = null;
		if (this.enhanced_page_background && typeof DarkOneColour !== 'undefined') {
			background_option = DarkOneColour.optionForId(
				DARKONE_PAGE_BACKGROUND_MENU_OPTIONS,
				idx
			);
		}

		switch (true) {
		case idx == 0:
			break;
		case idx <= 16:
			this.fonts.size.value = idx;
			this.font_changed();
			window.Repaint();
			break;
		case idx == 100:
		case idx == 101:
		case idx == 102:
			this.colours.mode.value = idx - 100;
			window.Repaint();
			break;
		case idx == 103:
			this.colours.custom_background.value = utils.ColourPicker(this.colours.custom_background.value);
			window.Repaint();
			break;
		case idx == 110:
		case idx == 111:
			this.selection.value = idx - 110;
			this.item_focus_change();
			break;
		case idx == 120:
			window.ShowConfigure();
			break;
		case idx == DARKONE_PAGE_COLOURS_DYNAMIC_MENU_ID:
			this.dynamic_colours.value = !this.dynamic_colours.value;
			this.colours_changed();
			window.Repaint();
			break;
		case Boolean(background_option):
			this.page_background.mode.value = background_option.mode;
			this.colours_changed();
			window.Repaint();
			break;
		case idx == DARKONE_PAGE_BACKGROUND_CUSTOM_MENU_ID:
			var chosen = DarkOneColour.pickJscript(
				this.page_background.custom.value,
				window.Name,
				'Enter a page background colour as #RRGGBB or R,G,B.'
			);
			if (chosen === null) break;
			this.page_background.custom.value = chosen;
			this.page_background.mode.value = DARKONE_PAGE_BACKGROUND_CUSTOM;
			this.colours_changed();
			window.Repaint();
			break;
		case idx == DARKONE_PAGE_TEXT_DEFAULT_MENU_ID:
		case idx == DARKONE_PAGE_TEXT_CUSTOM_MENU_ID:
			this.text_colour.mode.value = idx - DARKONE_PAGE_TEXT_DEFAULT_MENU_ID;
			this.colours_changed();
			window.Repaint();
			break;
		case idx == DARKONE_PAGE_TEXT_PICKER_MENU_ID:
			var text_colour = DarkOneColour.pickJscript(
				this.text_colour.custom.value,
				window.Name,
				'Enter a text colour as #RRGGBB or R,G,B.'
			);
			if (text_colour === null) break;
			this.text_colour.custom.value = text_colour;
			this.text_colour.mode.value = DARKONE_PAGE_TEXT_CUSTOM;
			this.colours_changed();
			window.Repaint();
			break;
		case idx == DARKONE_PAGE_SELECTED_DEFAULT_MENU_ID:
		case idx == DARKONE_PAGE_SELECTED_CUSTOM_MENU_ID:
			if (!this.enhanced_selected_background) break;
			this.selected_background.mode.value = idx - DARKONE_PAGE_SELECTED_DEFAULT_MENU_ID;
			window.Repaint();
			break;
		case idx == DARKONE_PAGE_SELECTED_PICKER_MENU_ID:
			if (!this.enhanced_selected_background) break;
			var selected_colour = DarkOneColour.pickJscript(
				this.selected_background.custom.value,
				window.Name,
				'Enter a selected background colour as #RRGGBB or R,G,B.'
			);
			if (selected_colour === null) break;
			this.selected_background.custom.value = selected_colour;
			this.selected_background.mode.value = DARKONE_PAGE_SELECTED_CUSTOM;
			window.Repaint();
			break;
		case idx >= DARKONE_PAGE_WALLPAPER_NONE_MENU_ID &&
				idx <= DARKONE_PAGE_WALLPAPER_CUSTOM_MENU_ID:
			this.wallpaper.mode.value = idx - DARKONE_PAGE_WALLPAPER_NONE_MENU_ID;
			this.update_wallpaper();
			window.Repaint();
			break;
		case idx == DARKONE_PAGE_WALLPAPER_PATH_MENU_ID:
			try {
				var path = utils.InputBox(
					'Enter the full path to an image.',
					window.Name,
					this.wallpaper.path.value
				);
				if (path == this.wallpaper.path.value) break;
				this.wallpaper.path.value = path;
				this.update_wallpaper();
				window.Repaint();
			} catch (input_error) {}
			break;
		case idx == DARKONE_PAGE_WALLPAPER_BLUR_MENU_ID:
			this.wallpaper.blurred.value = !this.wallpaper.blurred.value;
			this.update_wallpaper();
			window.Repaint();
			break;
		case idx > 999:
			if (object) {
				object.rbtn_up_done(idx);
			}
			break;
		}

		return true;
	}

	this.size = function () {
		this.w = window.Width;
		this.h = window.Height;
	}
// callbacks end

	this.fonts = {};
	this.colours = {};
	this.tfo = {};
	this.list_objects = [];
	this.text_objects = [];
	this.display_objects = [];
	this.custom_background = false;
	this.enhanced_page_background = false;
	this.darkonejsp3_page_background = false;
	this.enhanced_selected_background = false;
	this.page_background = null;
	this.dynamic_palette = null;
	this.dynamic_colours = null;
	this.text_colour = null;
	this.selected_background = null;
	this.wallpaper = null;
	this.wallpaper_image = null;
	this.wallpaper_pending = false;
	this.w = 0;
	this.h = 0;
	this.metadb = fb.GetFocusItem();
	this.metadb_func = typeof on_metadb_changed == 'function';
	this.fonts.sizes = [10, 12, 14, 16];
	this.fonts.size = new _p('2K3.PANEL.FONTS.SIZE', 12);

	if (this.metadb_func) {
		this.selection = new _p('2K3.PANEL.SELECTION', 0);
	}

	if (typeof options == 'object') {
		if (options.enhanced_page_background === true ||
				options.darkonejsp3_page_background === true) {
			this.enhanced_page_background = true;
			this.darkonejsp3_page_background = true;
			this.page_background = {
				mode : new _p('DARKONEJSP3.PAGE.BACKGROUND.MODE', 3),
				custom : new _p('DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR', RGB(24, 24, 24))
			};
			this.dynamic_colours = new _p('DARKONEJSP3.PAGE.COLOURS.DYNAMIC.ENABLED', false);
			this.text_colour = {
				mode : new _p('DARKONEJSP3.PAGE.TEXT.MODE', DARKONE_PAGE_TEXT_DEFAULT),
				custom : new _p('DARKONEJSP3.PAGE.TEXT.CUSTOM.COLOUR', RGB(220, 220, 220))
			};
			this.wallpaper = {
				mode : new _p('DARKONEJSP3.PAGE.WALLPAPER.MODE', DARKONE_PAGE_WALLPAPER_NONE),
				path : new _p('DARKONEJSP3.PAGE.WALLPAPER.PATH', ''),
				blurred : new _p('DARKONEJSP3.PAGE.WALLPAPER.BLURRED', false)
			};
			// Existing Columns UI layouts retain the wrapper source saved inside the
			// JScript Panel instance. Detect the project Queue bridge as well as the
			// current explicit option so upgraded layouts gain the selection controls
			// without requiring an FCL replacement or manual script reload.
			if (options.enhanced_selected_background === true ||
					(typeof DARKONEJSP3_QUEUE_BRIDGE_ENABLED != 'undefined' &&
					DARKONEJSP3_QUEUE_BRIDGE_ENABLED === true)) {
				this.enhanced_selected_background = true;
				this.selected_background = {
					mode : new _p('DARKONEJSP3.PAGE.SELECTED.BACKGROUND.MODE', DARKONE_PAGE_SELECTED_DEFAULT),
					custom : new _p('DARKONEJSP3.PAGE.SELECTED.BACKGROUND.CUSTOM.COLOUR', RGB(48, 48, 48))
				};
			}
		} else if (options.custom_background === true) {
			this.custom_background = true;
			this.colours.mode = new _p('2K3.PANEL.COLOURS.MODE', 0);
			this.colours.custom_background = new _p('2K3.PANEL.COLOURS.CUSTOM.BACKGROUND', RGB(0, 0, 0));
		}
	}

	this.colours_changed();
	this.font_changed();
	this.update_wallpaper();

	if (this.enhanced_page_background) {
		var previous_unload = typeof on_script_unload == 'function' ? on_script_unload : null;
		var self = this;
		on_script_unload = function () {
			self.dispose();
			if (previous_unload) previous_unload();
		};
	}
}
