function _vu_meter(x, y, w, h) {
	this.clear_graph = function () {
		for (var c = 0; c < this.channels.count; ++c) {
			this.RMS_levels[c] = 0;
			this.Peak_levels[c] = 0;
			this.Peak_falldown[c] = 0;
		}

		window.Repaint();
	}

	this.init = function () {
		this.dBrange = this.maxDB - this.minDB;
		this.colours_changed();

		if (fb.IsPaused)
			this.update_graph();
		else if (fb.IsPlaying)
			this.start_timer();
	}

	this.start_timer = function () {
		if (!this.timer_id) {
			this.timer_id = window.SetInterval((function () { this.update_graph(); }).bind(this), this.timer_interval);
		}
	}

	this.stop_timer = function () {
		if (this.timer_id) {
			window.ClearInterval(this.timer_id);
		}

		this.timer_id = 0;
	}

	this.to_db = function (num) {
		return 20 * Math.log(num) / Math.LN10;
	}

	this.update_graph = function () {
		var cur_time = fb.PlaybackTime;

		if (cur_time < this.rms_window)
			return;

		var chunk = fb.GetAudioChunk(this.rms_window);

		if (!chunk)
			return;

		this.channels.count = chunk.ChannelCount;
		this.channels.config = chunk.ChannelConfig;
		var data = chunk.Data.toArray();
		var frame_len = chunk.SampleCount;

		if (data && this.channels.count > 0 && frame_len > 0) {
			var old_count = this.Peak_levels.length;
			this.RMS_levels.length = this.channels.count;
			this.Peak_levels.length = this.channels.count;
			this.Peak_falldown.length = this.channels.count;

			if (old_count < this.channels.count) {
				for (var c = old_count; c < this.channels.count; ++c) {
					this.Peak_levels[c] = 0;
					this.Peak_falldown[c] = 0;
				}
			}

			for (var c = 0; c < this.channels.count; ++c) {
				var sum = 0, peak = 0;

				for (var i = c; i < data.length; i += this.channels.count) {
					var s = Math.abs(data[i]);

					if (s > peak) {
						peak = s;
					}

					sum += s * s;
				}

				this.RMS_levels[c] = Math.sqrt(sum / frame_len);

				if (peak >= this.Peak_levels[c]) {
					this.Peak_levels[c] = peak;
					this.Peak_falldown[c] = 0;
				} else {
					if (++this.Peak_falldown[c] > this.peak_hold) {
						this.Peak_levels[c] *= this.peak_fall_mul;
					}
				}
			}

			window.Repaint();
		}
	}

// callbacks begin
	this.colours_changed = function () {
		if (this.properties.colour_mode.value == 0) { // UI
			if (window.IsDefaultUI) {
				this.colours.text = window.GetColourDUI(ColourTypeDUI.text);
				this.colours.highlight = window.GetColourDUI(ColourTypeDUI.highlight);
				this.colours.background = window.GetColourDUI(ColourTypeDUI.background);
			} else {
				this.colours.text = window.GetColourCUI(ColourTypeCUI.text);
				this.colours.highlight = window.GetColourCUI(ColourTypeCUI.text);
				this.colours.background = window.GetColourCUI(ColourTypeCUI.background);
			}

			this.solid_colour = this.colours.text == this.colours.highlight;
			this.colours.peak = this.colours.text;

			if (this.solid_colour) {
				this.colours.bar = this.colours.text;
			} else {
				this.brush.Stops = [
					[0.0, this.colours.text],
					[1.0, this.colours.highlight],
				]

				this.colours.bar = JSON.stringify(this.brush);
			}
		} else { // custom
			this.colours.background = this.properties.custom_background.value;
			this.colours.text = this.properties.custom_text.value;
			this.colours.peak = this.properties.custom_peak.value || this.colours.text;

			if (this.properties.bar_mode.value == 0) { // rainbow
				this.solid_colour = false;
				this.brush.Stops = this.rainbow_stops;
				this.colours.bar = JSON.stringify(this.brush);
			} else if (this.properties.bar_mode.value == 1) { // solid colour
				this.solid_colour = true;
				this.colours.bar = this.properties.custom_bar.value;
			} else { // 2 colour gradient
				this.solid_colour = false;

				this.brush.Stops = [
					[0.0, this.properties.custom_bar_g1.value],
					[1.0, this.properties.custom_bar_g2.value],
				];

				this.colours.bar = JSON.stringify(this.brush);
			}
		}
	}

	this.paint = function (gr) {
		gr.Clear(this.colours.background);

		if (this.w < 1 || this.h < 1)
			return;

		var smooth_mode = this.properties.meter_style.value == 0;

		if (this.w > this.h) { // horizontal
			this.brush.Start = [0, 0];
			this.brush.End = [this.w, 0];

			if (!this.solid_colour) {
				this.colours.bar = JSON.stringify(this.brush);
			}

			var bar_width = this.w;
			var bar_height = Math.floor(this.h / this.channels.count);

			if (!smooth_mode) {
				var block_count = Math.max(Math.floor(this.dBrange / this.properties.rms_block_db.value), 1);
				var block_width = bar_width / block_count;
				var block_pad = Math.max(Math.ceil(block_width * 0.05), 1);
			}

			for (var c = 0; c < this.channels.count; ++c) {
				if (this.RMS_levels[c]) {
					var rms_db = _clamp(this.to_db(this.RMS_levels[c]), this.minDB, this.maxDB);

					if (smooth_mode) {
						var width = Math.round(bar_width * (rms_db - this.minDB) / this.dBrange);
						gr.FillRectangle(this.x, this.y + (bar_height * c), width, bar_height - 1, this.colours.bar);
					} else {
						var blocks = Math.round(block_count * (rms_db - this.minDB) / this.dBrange);
						var width = blocks * block_width;
						gr.FillRectangle(this.x, this.y + (bar_height * c), width, bar_height - 1, this.colours.bar);

						for (var i = 1; i <= blocks; ++i) {
							gr.FillRectangle(this.x - Math.ceil(block_pad / 2) + (i * block_width), this.y + (bar_height * c), block_pad, bar_height - 1, this.colours.background);
						}
					}
				}

				if (this.peak_bar_width > 0 && this.Peak_levels[c] > 0) {
					var peak_db = _clamp(this.to_db(this.Peak_levels[c]), this.minDB, this.maxDB);

					if (peak_db > this.minDB) {
						var peak_pos = Math.round(bar_width * (peak_db - this.minDB) / this.dBrange);
						gr.FillRectangle(this.x + peak_pos - this.peak_bar_width / 2, this.y + (bar_height * c), this.peak_bar_width, bar_height - 1, this.colours.peak);
					}
				}
			}
		} else { // vertical
			this.brush.Start = [0, this.h];
			this.brush.End = [0, 0];

			if (!this.solid_colour) {
				this.colours.bar = JSON.stringify(this.brush);
			}

			var bar_width = Math.floor(this.w / this.channels.count);
			var bar_height = this.h;

			if (!smooth_mode) {
				var block_count = Math.max(Math.floor(this.dBrange / this.properties.rms_block_db.value), 1);
				var block_height = bar_height / block_count;
				var block_pad = Math.max(Math.ceil(block_height * 0.05), 1);
			}

			for (var c = 0; c < this.channels.count; ++c) {
				if (this.RMS_levels[c]) {
					var rms_db = _clamp(this.to_db(this.RMS_levels[c]), this.minDB, this.maxDB);

					if (smooth_mode) {
						var height = Math.round(bar_height * (rms_db - this.minDB) / this.dBrange);
					} else {
						var blocks = Math.round(block_count * (rms_db - this.minDB) / this.dBrange);
						var height = blocks * block_height;
					}

					gr.FillRectangle(this.x + (bar_width * c), this.y, bar_width - 1, this.h, this.colours.bar);
					gr.FillRectangle(this.x + (bar_width * c), this.y, bar_width - 1, this.h - height, this.colours.background);

					if (!smooth_mode) {
						for (var i = 1; i <= blocks; ++i) {
							gr.FillRectangle(bar_width * c, this.h - height + Math.ceil(block_pad / 2) + (i * block_height), bar_width - 1, block_pad, this.colours.background);
						}
					}
				}

				if (this.peak_bar_width > 0 && this.Peak_levels[c] > 0) {
					var peak_db = _clamp(this.to_db(this.Peak_levels[c]), this.minDB, this.maxDB);

					if (peak_db > this.minDB) {
						var peak_pos = this.h - Math.round(bar_height * (peak_db - this.minDB) / this.dBrange);
						gr.FillRectangle(this.x + (bar_width * c), this.y + peak_pos, bar_width - 1, this.peak_bar_width, this.colours.peak);
					}
				}
			}
		}
	}

	this.playback_new_track = function () {
		this.start_timer();
	}

	this.playback_pause = function (state) {
		state ? this.stop_timer() : this.start_timer();
	}

	this.playback_stop = function (reason) {
		if (reason != 2) {
			this.stop_timer();
		}

		this.clear_graph();
	}

	this.rbtn_up = function (x, y) {
		var menu = window.CreatePopupMenu();
		var colour_menu = window.CreatePopupMenu();
		var bars_menu = window.CreatePopupMenu();
		var style_menu = window.CreatePopupMenu();

		colour_menu.AppendMenuItem(MF_STRING, 1, 'UI');
		colour_menu.AppendMenuItem(MF_STRING, 2, 'Custom');
		colour_menu.CheckMenuRadioItem(1, 2, this.properties.colour_mode.value + 1);

		if (this.properties.colour_mode.value == 1) {
			bars_menu.AppendMenuItem(MF_STRING, 100, 'Rainbow');
			bars_menu.AppendMenuItem(MF_STRING, 101, 'Solid colour');
			bars_menu.AppendMenuItem(MF_STRING, 102, 'Gradient');
			bars_menu.CheckMenuRadioItem(100, 102, this.properties.bar_mode.value + 100);

			if (this.properties.bar_mode.value == 1) { // solid colour
				bars_menu.AppendMenuSeparator();
				bars_menu.AppendMenuItem(MF_STRING, 110, 'Edit...');
			} else if (this.properties.bar_mode.value == 2) { // 2 colour gradient
				bars_menu.AppendMenuSeparator();
				bars_menu.AppendMenuItem(MF_STRING, 111, 'Gradient 1...');
				bars_menu.AppendMenuItem(MF_STRING, 112, 'Gradient 2...');
			}

			bars_menu.AppendTo(colour_menu, MF_STRING, 'Bars');

			colour_menu.AppendMenuSeparator();
			colour_menu.AppendMenuItem(MF_STRING, 3, 'Background...');
			colour_menu.AppendMenuItem(MF_STRING, 4, 'Text...');
			colour_menu.AppendMenuItem(EnableMenuIf(this.peak_bar_width > 0), 5, 'Peak...');
		}

		colour_menu.AppendTo(menu, MF_STRING, 'Colours');

		style_menu.AppendMenuItem(MF_STRING, 10, 'Smooth');
		style_menu.AppendMenuItem(MF_STRING, 11, 'Blocks');
		style_menu.CheckMenuRadioItem(10, 11, this.properties.meter_style.value + 10);

		if (this.properties.meter_style.value == 1) {
			style_menu.AppendMenuSeparator();
			style_menu.AppendMenuItem(MF_GRAYED, 0, 'Block width (dB)');

			this.rms_block_dbs.forEach(function (item, index) {
				style_menu.AppendMenuItem(MF_STRING, 20 + index, item);
			});

			var rms_block_db_index = this.rms_block_dbs.indexOf(this.properties.rms_block_db.value);
			style_menu.CheckMenuRadioItem(20, 20 + this.rms_block_dbs.length, 20 + rms_block_db_index);
		}

		style_menu.AppendTo(menu, MF_STRING, 'Meter style');

		menu.AppendMenuSeparator();
		menu.AppendMenuItem(MF_STRING, 50, 'Configure...');

		var idx = menu.TrackPopupMenu(x, y);
		menu.Dispose();
		colour_menu.Dispose();
		style_menu.Dispose();
		bars_menu.Dispose();

		switch (idx) {
		case 0:
			break;
		case 1:
		case 2:
			this.properties.colour_mode.value = idx -1;
			this.colours_changed();
			window.Repaint();
			break;
		case 3:
			var tmp = utils.ColourPicker(this.properties.custom_background.value);

			if (tmp != this.properties.custom_background.value) {
				this.properties.custom_background.value = tmp;
				this.colours_changed();
				window.Repaint();
			}
			break;
		case 4:
			var tmp = utils.ColourPicker(this.properties.custom_text.value);

			if (tmp != this.properties.custom_text.value) {
				this.properties.custom_text.value = tmp;
				this.colours_changed();
				window.Repaint();
			}
			break;
		case 5:
			var tmp = utils.ColourPicker(this.colours.peak);

			if (tmp != this.colours.peak) {
				this.properties.custom_peak.value = tmp;
				this.colours_changed();
				window.Repaint();
			}
			break;
		case 10:
		case 11:
			this.properties.meter_style.value = idx - 10;
			window.Repaint();
			break;
		case 20:
		case 21:
		case 22:
		case 23:
			this.properties.rms_block_db.value = this.rms_block_dbs[idx - 20];
			window.Repaint();
			break;
		case 50:
			window.ShowConfigure();
			break;
		case 100:
		case 101:
		case 102:
			this.properties.bar_mode.value = idx - 100;
			this.colours_changed();
			window.Repaint();
			break;
		case 110:
			var tmp = utils.ColourPicker(this.properties.custom_bar.value);

			if (tmp != this.properties.custom_bar.value) {
				this.properties.custom_bar.value = tmp;
				this.colours_changed();
				window.Repaint();
			}
			break;
		case 111:
			var tmp = utils.ColourPicker(this.properties.custom_bar_g1.value);

			if (tmp != this.properties.custom_bar_g1.value) {
				this.properties.custom_bar_g1.value = tmp;
				this.colours_changed();
				window.Repaint();
			}
			break;
		case 112:
			var tmp = utils.ColourPicker(this.properties.custom_bar_g2.value);

			if (tmp != this.properties.custom_bar_g2.value) {
				this.properties.custom_bar_g2.value = tmp;
				this.colours_changed();
				window.Repaint();
			}
			break;
		}

		return true;
	}
// callbacks end

	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;

	this.minDB = -60; // minimum dB on the meter (meter range)
	this.maxDB = 5; // maximum dB on the meter (meter range)

	this.solid_colour = false;
	this.rms_block_dbs = [0.3125, 0.625, 1.25, 2.5];
	this.RMS_levels = [];
	this.Peak_levels = [];
	this.Peak_falldown = [];
	this.timer_id = 0;
	this.dBrange = 0;

	this.channels = {
		count : 2,
		config : 0,
	};

	this.colours = {
		text : 0,
		highlight : 0,
		background : 0,
		bar : 0,
	};

	this.brush = {
		Stops : [],
		Start : [0, 0], // x and y values
		End : [0, 0], // x and y values
	};

	this.rainbow_stops = [
		[ 0.0, RGB(19, 115, 232) ],
		[ 0.33, RGB(15, 168, 149) ],
		[ 0.66, RGB(231, 215, 2) ],
		[ 1.0, RGB(227, 9, 64) ],
	];

	this.properties = {
		colour_mode : new _p("2K3.METER2.COLOURS.MODE", 1), // 0 UI, 1 custom
		bar_mode : new _p("2K3.METER2.BAR.MODE", 0), // 0 rainbow, 1 solid, 2 gradient
		custom_background : new _p("2K3.METER2.BACKGROUND.COLOUR", RGB(30, 30, 30)),
		custom_bar : new _p("2K3.METER2.BAR.COLOUR", RGB(200, 200, 200)),
		custom_bar_g1 : new _p("2K3.METER2.BAR.G1.COLOUR", RGB(0, 128, 255)),
		custom_bar_g2 : new _p("2K3.METER2.BAR.G2.COLOUR", RGB(255, 50, 10)),
		custom_peak : new _p("2K3.METER2.PEAK.COLOUR"), // no default
		custom_text : new _p("2K3.METER2.TEXT.COLOUR", RGB(240, 240, 240)),
		meter_style : new _p("2K3.METER2.STYLE", 1), // 0: smooth, 1: blocks
		rms_block_db : new _p("2K3.METER2.BLOCK.DB", 0.625),
	};
}
