function _panel(options) {
	// Optional DarkOneJSP3 information-page background support is enabled only
	// by the adapted Biography, Last.fm, Album Notes, Queue and Properties
	// entry scripts. Generic JScript Panel samples retain their normal behaviour.
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

	this.page_background_colour = function () {
		switch (this.page_background.mode.value) {
		case 0:
			return 0x00000000;
		case 1:
			return RGB(0, 0, 0);
		case 2:
			return RGB(32, 32, 32);
		case 4:
			return this.page_background.custom.value;
		case 5:
			return this.colours.background;
		default:
			return RGB(24, 24, 24);
		}
	}

	this.page_background_hex = function () {
		var value = Number(this.page_background.custom.value) & 0x00ffffff;
		var text = value.toString(16).toUpperCase();
		while (text.length < 6) text = '0' + text;
		return '#' + text;
	}

	this.paint = function (gr) {
		if (this.darkonejsp3_page_background) {
			gr.Clear(this.page_background_colour());
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

		if (this.darkonejsp3_page_background) {
			this.s15.AppendMenuItem(MF_STRING, 130, 'Transparent / inherit parent');
			this.s15.AppendMenuItem(MF_STRING, 131, 'Black');
			this.s15.AppendMenuItem(MF_STRING, 132, 'DarkOne grey');
			this.s15.AppendMenuItem(MF_STRING, 133, 'DarkOne dark grey');
			this.s15.AppendMenuItem(MF_STRING, 135, 'Columns UI global background');
			this.s15.AppendMenuItem(MF_STRING, 134, 'Custom colour... (' + this.page_background_hex() + ')');
			this.s15.CheckMenuRadioItem(130, 135, this.page_background.mode.value + 130);
			this.s15.AppendTo(this.m, MF_STRING, 'Page background colour');
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
		case idx >= 130 && idx <= 133:
			this.page_background.mode.value = idx - 130;
			window.Repaint();
			break;
		case idx == 135:
			this.page_background.mode.value = 5;
			window.Repaint();
			break;
		case idx == 134:
			var chosen = utils.ColourPicker(this.page_background.custom.value);
			if (chosen !== null && typeof chosen !== 'undefined' && !isNaN(Number(chosen))) {
				this.page_background.custom.value = chosen;
				this.page_background.mode.value = 4;
				window.Repaint();
			}
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
	this.darkonejsp3_page_background = false;
	this.page_background = null;
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
		if (options.darkonejsp3_page_background === true) {
			this.darkonejsp3_page_background = true;
			this.page_background = {
				mode : new _p('DARKONEJSP3.PAGE.BACKGROUND.MODE', 3),
				custom : new _p('DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR', RGB(24, 24, 24))
			};
		} else if (options.custom_background === true) {
			this.custom_background = true;
			this.colours.mode = new _p('2K3.PANEL.COLOURS.MODE', 0);
			this.colours.custom_background = new _p('2K3.PANEL.COLOURS.CUSTOM.BACKGROUND', RGB(0, 0, 0));
		}
	}

	this.colours_changed();
	this.font_changed();
}
