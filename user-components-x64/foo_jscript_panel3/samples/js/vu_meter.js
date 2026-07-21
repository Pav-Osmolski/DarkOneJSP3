var properties = {
	colour_mode : new _p("2K3.METER.COLOURS.MODE", 1), // 0 UI, 1 custom
	bar_mode : new _p("2K3.METER.BAR.MODE", 0), // 0 rainbow, 1 solid, 2 gradient
	custom_background : new _p("2K3.METER.BACKGROUND.COLOUR", RGB(30, 30, 30)),
	custom_bar : new _p("2K3.METER.BAR.COLOUR", RGB(200, 200, 200)),
	custom_bar_g1 : new _p("2K3.METER.BAR.G1.COLOUR", RGB(0, 128, 255)),
	custom_bar_g2 : new _p("2K3.METER.BAR.G2.COLOUR", RGB(255, 50, 10)),
	custom_peak : new _p("2K3.METER.PEAK.COLOUR"), // no default
	custom_text : new _p("2K3.METER.TEXT.COLOUR", RGB(240, 240, 240)),
	meter_style : new _p("2K3.METER.STYLE", 1), // 0: smooth, 1: blocks
	rms_block_db : new _p("2K3.METER.BLOCK.DB", 0.625),
	rms_3db : new _p("2K3.METER.AES", false),
};

// blocks by count style has been removed
if (properties.meter_style.value > 1) {
	properties.meter_style.value = 1;
}

var font_t = CreateFontString("Segoe UI", 8);
var solid_colour = false;
var rms_block_dbs = [0.3125, 0.625, 1.25, 2.5];
var RMS_levels = [], Peak_levels = [], Peak_falldown = [];
var ChannelNames = [ "FL", "FR", "FC", "LFE", "BL", "BR", "FCL", "FCR", "BC", "SL", "SR", "TC", "TFL", "TFC", "TFR", "TBL", "TBC", "TBR" ];
var ww = 0, wh = 0, timer_id = 0, rms_db_offset = 0, dBrange = 0;

var channels = {
	count : 2,
	config : 0,
};

var colours = {
	text : 0,
	highlight : 0,
	background : 0,
	bar : 0,
};

var brush = {
	Stops : [],
	Start : [0, 0], // x and y values
	End : [0, 0], // x and y values
};

var rainbow_stops = [
	[ 0.0, RGB(19, 115, 232) ],
	[ 0.33, RGB(15, 168, 149) ],
	[ 0.66, RGB(231, 215, 2) ],
	[ 1.0, RGB(227, 9, 64) ],
];

function init() {
	dBrange = maxDB - minDB

	update_rms_offset();
	update_colours();

	if (fb.IsPaused)
		update_graph();
	else if (fb.IsPlaying)
		start_timer();
	else
		get_initial_track_info();
}

function update_rms_offset() {
	if (properties.rms_3db.enabled) {
		rms_db_offset = 20 * Math.log(Math.sqrt(2)) / Math.LN10; // 3.01029995663981 dB
	} else {
		rms_db_offset = 0;
	}
}

function update_colours() {
	if (properties.colour_mode.value == 0) { // UI
		if (window.IsDefaultUI) {
			colours.text = window.GetColourDUI(ColourTypeDUI.text);
			colours.highlight = window.GetColourDUI(ColourTypeDUI.highlight);
			colours.background = window.GetColourDUI(ColourTypeDUI.background);
		} else {
			colours.text = window.GetColourCUI(ColourTypeCUI.text);
			colours.highlight = window.GetColourCUI(ColourTypeCUI.text);
			colours.background = window.GetColourCUI(ColourTypeCUI.background);
		}

		solid_colour = colours.text == colours.highlight;
		colours.peak = colours.text;

		if (solid_colour) {
			colours.bar = colours.text;
		} else {
			brush.Stops = [
				[0.0, colours.text],
				[1.0, colours.highlight],
			]

			colours.bar = JSON.stringify(brush);
		}
	} else { // custom
		colours.background = properties.custom_background.value;
		colours.text = properties.custom_text.value;
		colours.peak = properties.custom_peak.value || colours.text;

		if (properties.bar_mode.value == 0) { // rainbow
			solid_colour = false;
			brush.Stops = rainbow_stops;
			colours.bar = JSON.stringify(brush);
		} else if (properties.bar_mode.value == 1) { // solid colour
			solid_colour = true;
			colours.bar = properties.custom_bar.value;
		} else { // 2 colour gradient
			solid_colour = false;

			brush.Stops = [
				[0.0, properties.custom_bar_g1.value],
				[1.0, properties.custom_bar_g2.value],
			];

			colours.bar = JSON.stringify(brush);
		}
	}
}

function clear_graph() {
	for (var c = 0; c < channels.count; ++c) {
		RMS_levels[c] = 0;
		Peak_levels[c] = 0;
		Peak_falldown[c] = 0;
	}

	window.Repaint();
}

function update_graph() {
	var cur_time = fb.PlaybackTime;

	if (cur_time < rms_window)
		return;

	var chunk = fb.GetAudioChunk(rms_window);

	if (!chunk)
		return;

	channels.count = chunk.ChannelCount;
	channels.config = chunk.ChannelConfig;
	var data = chunk.Data.toArray();
	var frame_len = chunk.SampleCount;

	if (data && channels.count > 0 && frame_len > 0) {
		var old_count = Peak_levels.length;
		RMS_levels.length = channels.count;
		Peak_levels.length = channels.count;
		Peak_falldown.length = channels.count;

		if (old_count < channels.count) {
			for (var c = old_count; c < channels.count; ++c) {
				Peak_levels[c] = 0;
				Peak_falldown[c] = 0;
			}
		}

		for (var c = 0; c < channels.count; ++c) {
			var sum = 0, peak = 0;

			for (var i = c; i < data.length; i += channels.count) {
				var s = Math.abs(data[i]);

				if (s > peak) {
					peak = s;
				}

				sum += s * s;
			}

			RMS_levels[c] = Math.sqrt(sum/frame_len);

			if (peak >= Peak_levels[c]) {
				Peak_levels[c] = peak;
				Peak_falldown[c] = 0;
			} else {
				if (++Peak_falldown[c] > peak_hold) {
					Peak_levels[c] *= peak_fall_mul;
				}
			}
		}

		window.Repaint();
	}
}

function to_db(num) {
	return 20 * Math.log(num) / Math.LN10;
}

function start_timer() {
	if (!timer_id) {
		timer_id = window.SetInterval(update_graph, timer_interval);
	}
}

function stop_timer() {
	if (timer_id) {
		window.ClearInterval(timer_id);
	}

	timer_id = 0;
}

function get_initial_track_info() {
	var handle = fb.GetFocusItem();

	if (!handle)
		return;

	var info = handle.GetFileInfo();

	var idx = info.InfoFind("channels");

	if (idx >= 0) {
		channels.count = Number(info.InfoValue(idx));
	}

	idx = info.InfoFind("WAVEFORMATEXTENSIBLE_CHANNEL_MASK");

	if (idx >= 0) {
		channels.config = Number(info.InfoValue(idx));
	}

	info.Dispose();
	handle.Dispose();
}

function channel_name(ch) {
	if (ch < ChannelNames.length) {
		if (channels.config) {
			for (var i = 0, idx = 0; i < ChannelNames.length; ++i) {
				if (channels.config & (1 << i)) {
					if (idx == ch)
						return ChannelNames[i];

					idx++;
				}
			}
		} else {
			return ChannelNames[ch];
		}
	}

	return "Ch" + (ch + 1);
}

function on_colours_changed() {
	update_colours();
	window.Repaint();
}

function on_mouse_rbtn_up(x, y) {
	var menu = window.CreatePopupMenu();
	var colour_menu = window.CreatePopupMenu();
	var bars_menu = window.CreatePopupMenu();
	var style_menu = window.CreatePopupMenu();

	colour_menu.AppendMenuItem(MF_STRING, 1, 'UI');
	colour_menu.AppendMenuItem(MF_STRING, 2, 'Custom');
	colour_menu.CheckMenuRadioItem(1, 2, properties.colour_mode.value + 1);

	if (properties.colour_mode.value == 1) {
		bars_menu.AppendMenuItem(MF_STRING, 100, 'Rainbow');
		bars_menu.AppendMenuItem(MF_STRING, 101, 'Solid colour');
		bars_menu.AppendMenuItem(MF_STRING, 102, 'Gradient');
		bars_menu.CheckMenuRadioItem(100, 102, properties.bar_mode.value + 100);

		if (properties.bar_mode.value == 1) { // solid colour
			bars_menu.AppendMenuSeparator();
			bars_menu.AppendMenuItem(MF_STRING, 110, 'Edit...');
		} else if (properties.bar_mode.value == 2) { // 2 colour gradient
			bars_menu.AppendMenuSeparator();
			bars_menu.AppendMenuItem(MF_STRING, 111, 'Gradient 1...');
			bars_menu.AppendMenuItem(MF_STRING, 112, 'Gradient 2...');
		}

		bars_menu.AppendTo(colour_menu, MF_STRING, 'Bars');

		colour_menu.AppendMenuSeparator();
		colour_menu.AppendMenuItem(MF_STRING, 3, 'Background...');
		colour_menu.AppendMenuItem(MF_STRING, 4, 'Text...');
		colour_menu.AppendMenuItem(EnableMenuIf(peak_bar_width > 0), 5, 'Peak...');
	}

	colour_menu.AppendTo(menu, MF_STRING, 'Colours');

	style_menu.AppendMenuItem(MF_STRING, 10, 'Smooth');
	style_menu.AppendMenuItem(MF_STRING, 11, 'Blocks');
	style_menu.CheckMenuRadioItem(10, 11, properties.meter_style.value + 10);

	if (properties.meter_style.value == 1) {
		style_menu.AppendMenuSeparator();
		style_menu.AppendMenuItem(MF_GRAYED, 0, 'Block width (dB)');

		rms_block_dbs.forEach(function (item, index) {
			style_menu.AppendMenuItem(MF_STRING, 20 + index, item);
		});

		var rms_block_db_index = rms_block_dbs.indexOf(properties.rms_block_db.value);
		style_menu.CheckMenuRadioItem(20, 20 + rms_block_dbs.length, 20 + rms_block_db_index);
	}

	style_menu.AppendTo(menu, MF_STRING, 'Meter style');

	menu.AppendMenuSeparator();
	menu.AppendMenuItem(CheckMenuIf(properties.rms_3db.enabled), 30, 'Use AES +3dB RMS');
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
		properties.colour_mode.value = idx -1;
		update_colours();
		window.Repaint();
		break;
	case 3:
		var tmp = utils.ColourPicker(properties.custom_background.value);

		if (tmp != properties.custom_background.value) {
			properties.custom_background.value = tmp;
			update_colours();
			window.Repaint();
		}
		break;
	case 4:
		var tmp = utils.ColourPicker(properties.custom_text.value);

		if (tmp != properties.custom_text.value) {
			properties.custom_text.value = tmp;
			update_colours();
			window.Repaint();
		}
		break;
	case 5:
		var tmp = utils.ColourPicker(colours.peak);

		if (tmp != colours.peak) {
			properties.custom_peak.value = tmp;
			update_colours();
			window.Repaint();
		}
		break;
	case 10:
	case 11:
		properties.meter_style.value = idx - 10;
		window.Repaint();
		break;
	case 20:
	case 21:
	case 22:
	case 23:
		properties.rms_block_db.value = rms_block_dbs[idx - 20];
		window.Repaint();
		break;
	case 30:
		properties.rms_3db.toggle();
		update_rms_offset();
		window.Repaint();
		break;
	case 50:
		window.ShowConfigure();
		break;
	case 100:
	case 101:
	case 102:
		properties.bar_mode.value = idx - 100;
		update_colours();
		window.Repaint();
		break;
	case 110:
		var tmp = utils.ColourPicker(properties.custom_bar.value);

		if (tmp != properties.custom_bar.value) {
			properties.custom_bar.value = tmp;
			update_colours();
			window.Repaint();
		}
		break;
	case 111:
		var tmp = utils.ColourPicker(properties.custom_bar_g1.value);

		if (tmp != properties.custom_bar_g1.value) {
			properties.custom_bar_g1.value = tmp;
			update_colours();
			window.Repaint();
		}
		break;
	case 112:
		var tmp = utils.ColourPicker(properties.custom_bar_g2.value);

		if (tmp != properties.custom_bar_g2.value) {
			properties.custom_bar_g2.value = tmp;
			update_colours();
			window.Repaint();
		}
		break;
	}

	return true;
}

function on_paint(gr) {
	gr.Clear(colours.background);

	if (wh < 1 || ww < 1)
		return;

	var show_ch_labels = true;
	var show_db_labels = true;
	var bar_pad_left = _scale(20);
	var bar_pad_right = _scale(20);
	var bar_pad_top = _scale(4);
	var bar_pad_bottom = _scale(24);
	var bar_width = ww - bar_pad_left - bar_pad_right;
	var bar_height = Math.floor((wh - bar_pad_top - bar_pad_bottom) / channels.count);

	// bars are too thin for channel labels, hide them
	if (bar_height < 12) {
		show_ch_labels = false;

		// bars are too thin for dB scale too
		if (bar_height < 4) {
			show_db_labels = false;
			bar_pad_left = 0;
			bar_pad_right = 0;
			bar_pad_top = 0;
			bar_pad_bottom = 0;
			bar_width = ww;
			bar_height = Math.floor(wh / channels.count);
		}
	}

	if (bar_width != brush.End[0]) {
		brush.End[0] = bar_width;

		if (!solid_colour) {
			colours.bar = JSON.stringify(brush);
		}
	}

	// labels
	if (show_ch_labels) {
		for (var c = 0; c < channels.count; ++c) {
			gr.WriteTextSimple(channel_name(c), font_t, colours.text, 0, bar_pad_top + (bar_height * c), bar_pad_left, bar_height, 2, 2);
		}
	}

	if (show_db_labels) {
		var db_spacing = 5;

		if (dBrange < db_spacing) {
			db_spacing = 1;
		}

		if (ww * db_spacing / dBrange < _scale(64)) {
			db_spacing = ((_scale(64) * dBrange) / ww);
			db_spacing -= (db_spacing % 5);
		}

		var y = bar_pad_top + (bar_height * channels.count) + _scale(4);
		gr.FillRectangle(bar_pad_left, y, bar_width, 1, colours.text);

		for (var i = minDB, j = 0; i <= maxDB; i += db_spacing, j++) {
			var x = bar_pad_left + (bar_width * j / (dBrange / db_spacing));
			gr.WriteTextSimple(i + "dB", font_t, colours.text, x - (bar_pad_left / 2), y, _scale(100), wh - y, 0, 2);
			gr.DrawLine(x, y - _scale(2), x, y + _scale(2), 1, colours.text);
		}
	}

	// bars
	if (properties.meter_style.value == 1) { // block mode
		var block_count = Math.max(Math.floor(dBrange / properties.rms_block_db.value), 1);
		var block_width = bar_width / block_count;
		var block_pad = Math.max(Math.ceil(block_width * 0.05), 1);
	}

	for (var c = 0; c < channels.count; ++c) {
		if (RMS_levels[c]) {
			var rms_db = _clamp(to_db(RMS_levels[c]) + rms_db_offset, minDB, maxDB);

			if (properties.meter_style.value == 0) { // smooth mode
				var width = Math.round(bar_width * (rms_db - minDB) / dBrange);
				gr.FillRectangle(bar_pad_left, bar_pad_top + (bar_height * c), width, bar_height - 1, colours.bar);
			} else { // block mode
				var blocks = Math.round(block_count * (rms_db - minDB) / dBrange);
				var width = blocks * block_width;
				gr.FillRectangle(bar_pad_left, bar_pad_top + (bar_height * c), width, bar_height - 1, colours.bar);

				for (var i = 1; i <= blocks; ++i) {
					gr.FillRectangle(bar_pad_left - Math.ceil(block_pad / 2) + (i * block_width), bar_pad_top + (bar_height * c), block_pad, bar_height - 1, colours.background);
				}
			}
		}

		if (peak_bar_width > 0 && Peak_levels[c] > 0) {
			var peak_db = _clamp(to_db(Peak_levels[c]), minDB, maxDB);

			if (peak_db > minDB) {
				var peak_pos = Math.round(bar_width * (peak_db - minDB) / dBrange);
				gr.FillRectangle(bar_pad_left + peak_pos - peak_bar_width / 2, bar_pad_top + (bar_height * c), peak_bar_width, bar_height - 1, colours.peak);
			}
		}
	}
}

function on_playback_new_track(handle) {
	start_timer();
}

function on_playback_pause(state) {
	state ? stop_timer() : start_timer();
}

function on_playback_stop(reason) {
	if (reason != 2) {
		stop_timer();
	}

	clear_graph();
}

function on_size() {
	ww = window.Width;
	wh = window.Height;
}
