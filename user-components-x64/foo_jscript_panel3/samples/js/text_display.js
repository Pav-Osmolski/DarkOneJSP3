function _text_display(x, y, w, h, buttons_or_rating) {
	this.clear_layout = function () {
		if (this.text_layout) {
			this.text_layout.Dispose();
			this.text_layout = null;
		}

		this.text = '';
	}

	this.containsXY = function (x, y) {
		return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
	}

	this.refresh = function (force) {
		if (force) {
			this.font = JSON.parse(panel.fonts.normal);
		}

		this.default_colour = this.properties.albumart.enabled ? RGB(240, 240, 240) : panel.colours.text;

		var tmp = '';
		var tfo = panel.get_tfo(this.properties.text_tf.value);

		if (panel.prefer_playing()) {
			var loc = plman.GetPlayingItemLocation();

			if (loc.IsValid) {
				tmp = tfo.EvalPlaylistItem(loc.PlaylistIndex, loc.PlaylistItemIndex);
			} else {
				tmp = tfo.Eval();
			}
		} else {
			var PlaylistIndex = plman.ActivePlaylist;
			var PlaylistItemIndex = plman.GetPlaylistFocusItemIndex(PlaylistIndex);

			if (PlaylistIndex > -1 && PlaylistItemIndex > -1) {
				tmp = tfo.EvalPlaylistItem(PlaylistIndex, PlaylistItemIndex);
			}
		}

		if (force || tmp != this.text) {
			this.clear_layout()
			this.text = tmp;

			if (this.text.length) {
				if (this.properties.layout.value == 1) {
					this.text_layout = utils.CreateTextLayout(this.text, this.font.Name, this.font.Size, this.font.Weight, this.font.Style, this.font.Stretch, 2, 0);
				} else {
					this.text_layout = utils.CreateTextLayout(this.text, this.font.Name, this.font.Size, this.font.Weight, this.font.Style, this.font.Stretch, this.properties.halign.value, this.properties.valign.value);
				}
			}
		}

		this.size();
		window.Repaint();
	}

// callbacks begin
	this.metadb_changed = function () {
		this.refresh();
	}

	this.move = function (x, y) {
		this.mx = x;
		this.my = y;
		window.SetCursor(IDC_ARROW);
		return this.containsXY(x, y);
	}

	this.playback_time = function () {
		if (this.properties.per_second.enabled) {
			this.refresh();
		}
	}

	this.paint = function (gr) {
		if (this.properties.albumart.enabled) {
			if (this.properties.albumart_blur.enabled) {
				_drawImage(gr, albumart.bitmap.blur, 0, 0, panel.w, panel.h, image.crop);
				_drawOverlay(gr, 0, 0, panel.w, panel.h, 120);
			} else {
				_drawImage(gr, albumart.bitmap.normal, 0, 0, panel.w, panel.h, image.crop);
				_drawOverlay(gr, 0, 0, panel.w, panel.h, 160);
			}
		}

		if (this.properties.layout.value > 0) {
			var border = this.properties.albumart.enabled ? RGB(150, 150, 150) : panel.colours.text;
			_drawImage(gr, albumart.bitmap.normal, albumart.x, albumart.y, albumart.w, albumart.h, albumart.properties.aspect.value, 1.0, border);
		}

		if (this.text_layout) {
			gr.WriteTextLayout(this.text_layout, this.default_colour, this.x, this.y, this.w, this.h, this.offset);
		}
	}

	this.rbtn_up = function (x, y) {
		if (this.properties.layout.value > 0) {
			panel.m.AppendMenuItem(MF_GRAYED, 0, 'Text display options');
		}

		panel.m.AppendMenuItem(MF_STRING, 1200, 'Custom text...');
		panel.m.AppendMenuItem(CheckMenuIf(this.properties.per_second.enabled), 1201, 'Per-second updates');
		panel.m.AppendMenuSeparator();

		if (!this.buttons_or_rating) {
			panel.m.AppendMenuItem(MF_GRAYED, 1203, 'Layout');
			panel.m.AppendMenuItem(MF_STRING, 1204, 'Text only');
			panel.m.AppendMenuItem(MF_STRING, 1205, 'Album Art top, Text bottom');
			panel.m.AppendMenuItem(MF_STRING, 1206, 'Album Art left, Text right');
			panel.m.CheckMenuRadioItem(1204, 1206, this.properties.layout.value + 1204);
			panel.m.AppendMenuSeparator();
			panel.m.AppendMenuItem(CheckMenuIf(this.properties.albumart.enabled), 1207, 'Album art background');
			panel.m.AppendMenuItem(GetMenuFlags(this.properties.albumart.enabled, this.properties.albumart_blur.enabled), 1208, 'Enable blur effect');
			panel.m.AppendMenuSeparator();
		}

		if (this.properties.layout.value != 1) {
			// s10 used by album art
			panel.s11.AppendMenuItem(MF_STRING, 1210, 'Left');
			panel.s11.AppendMenuItem(MF_STRING, 1211, 'Right');
			panel.s11.AppendMenuItem(MF_STRING, 1212, 'Centre');
			panel.s11.CheckMenuRadioItem(1210, 1212, this.properties.halign.value + 1210);
			panel.s11.AppendTo(panel.m, MF_STRING, 'Text alignment (horizontal)');
			panel.s12.AppendMenuItem(MF_STRING, 1220, 'Top');
			panel.s12.AppendMenuItem(MF_STRING, 1221, 'Bottom');
			panel.s12.AppendMenuItem(MF_STRING, 1222, 'Centre');
			panel.s12.CheckMenuRadioItem(1220, 1222, this.properties.valign.value + 1220);
			panel.s12.AppendTo(panel.m, MF_STRING, 'Text alignment (vertical)');

			if (this.properties.layout.value == 0) {
				panel.m.AppendMenuItem(MF_STRING, 1230, 'Margin...');
			}

			panel.m.AppendMenuSeparator();
		}

		if (this.properties.layout.value > 0) {
			panel.m.AppendMenuItem(MF_GRAYED, 0, 'Album art options');
			albumart.rbtn_up(x, y);
		}
	}

	this.rbtn_up_done = function (idx) {
		switch (idx) {
		case 1200:
			try {
				var tmp = utils.TextBox('You can use full title formatting here. Custom colours and fonts are supported. See Help.', window.Name, this.properties.text_tf.value, this.help_url);
				if (tmp != this.properties.text_tf.value) {
					this.properties.text_tf.value = tmp;
					this.refresh();
				}
			} catch (e) {}
			break;
		case 1201:
			this.properties.per_second.toggle();
			break;
		case 1204:
		case 1205:
		case 1206:
			this.properties.layout.value = idx - 1204;
			this.refresh(true);
			_tt('');
			break;
		case 1207:
			this.properties.albumart.toggle();

			if (this.properties.albumart.enabled) {
				panel.custom_background = false;
				albumart.metadb_changed();
			} else {
				panel.custom_background = true;
			}

			this.refresh(true);
			break;
		case 1208:
			this.properties.albumart_blur.toggle();
			albumart.metadb_changed();
			break;
		case 1210:
		case 1211:
		case 1212:
			this.properties.halign.value = idx - 1210;
			this.refresh(true);
			break;
		case 1220:
		case 1221:
		case 1222:
			this.properties.valign.value = idx - 1220;
			this.refresh(true);
			break;
		case 1230:
			var tmp = utils.InputBox('Enter a margin here. It will be ignored if Album Art is enabled.', window.Name, this.properties.margin.value);

			if (tmp != this.properties.margin.value) {
				this.properties.margin.value = tmp;
				this.size();
			}

			break;
		default:
			albumart.rbtn_up_done(idx);
			break;
		}

		window.Repaint();
	}

	this.size = function () {
		this.text_height = 0;
		var margin = _scale(12);

		switch (this.properties.layout.value) {
		case 0: // text only
			var margin_property = _scale(this.properties.margin.value);

			this.x = margin_property;
			this.y = margin_property;
			this.w = panel.w - (margin_property * 2);
			this.h = panel.h - (margin_property * 2);

			if (this.text_layout) {
				this.text_height = this.text_layout.CalcTextHeight(this.w);
			}
			break;
		case 1: // album art top, text bottom
			var width = panel.w - (margin * 2);

			if (this.text_layout) {
				this.text_height = this.text_layout.CalcTextHeight(width);
			}

			var text_height = Math.min(this.text_height + margin, panel.h / 2);

			albumart.x = margin;
			albumart.y = margin;
			albumart.w = width;
			albumart.h = panel.h - text_height - (margin * 2);

			this.x = margin;
			this.y = panel.h - text_height;
			this.w = width;
			this.h = text_height - margin;

			if (this.buttons_or_rating) {
				albumart.h -= _scale(40);
				this.y -= _scale(40);
			}
			break;
		case 2: // album art left, text right
			albumart.x = margin;
			albumart.y = margin;
			albumart.w = (panel.w / 2) - margin;
			albumart.h = panel.h - (margin * 2);

			this.x = (margin * 2) + albumart.w;
			this.y = margin;
			this.w = albumart.w - margin;
			this.h = panel.h - (margin * 2);

			if (this.text_layout) {
				this.text_height = this.text_layout.CalcTextHeight(this.w);
			}
			break;
		}

		if (this.text_height < this.h)
			this.offset = 0;
		else if (this.offset < this.h - this.text_height)
			this.offset = this.h - this.text_height;

		this.scroll_step = _scale(panel.fonts.size.value) * 4;
	}

	this.wheel = function (s) {
		if (!this.containsXY(this.mx, this.my))
			return false;

		if (this.text_height > this.h) {
			this.offset += s * this.scroll_step;

			if (this.offset > 0)
				this.offset = 0;
			else if (this.offset < this.h - this.text_height)
				this.offset = this.h - this.text_height;

			window.RepaintRect(this.x, this.y, this.w, this.h);
		}

		return true;
	}
// callbacks end

	panel.display_objects.push(this);
	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;
	this.buttons_or_rating = buttons_or_rating;
	this.default_colour = 0;
	this.text_layout = null;
	this.text_height = 0;
	this.scroll_step = 0;
	this.mx = 0;
	this.my = 0;
	this.offset = 0;
	this.text = '';
	this.font = JSON.parse(panel.fonts.normal);
	this.help_url = 'https://jscript-panel.github.io/docs/guides/font-rgb/';

	this.properties = {
		text_tf : new _p('2K3.TEXT.DISPLAY.TF', ''),
		halign : new _p('2K3.TEXT.HALIGN', 2),
		valign : new _p('2K3.TEXT.VALIGN', 2),
		per_second : new _p('2K3.TEXT.PER.SECOND', false),
		albumart : new _p('2K3.TEXT.ALBUMART', true),
		albumart_blur : new _p('2K3.TEXT.ALBUMART.BLUR', true),
		layout : new _p('2K3.TEXT.LAYOUT', 0), // 0 text only, 1 album art top text bottom 2 album art left text right
		margin : new _p('2K3.TEXT.MARGIN', 6),
	};

	if (this.properties.text_tf.value.empty()) {
		this.properties.text_tf.value = utils.ReadUTF8(fb.ComponentPath + 'samples\\text\\text_display_default');
	}

	if (this.buttons_or_rating) {
		this.properties.layout.value = 1;
		this.properties.albumart.enabled = true;
		this.properties.albumart_blur.enabled = true;
	}

	if (this.properties.albumart.enabled) {
		panel.custom_background = false;
	}
}
