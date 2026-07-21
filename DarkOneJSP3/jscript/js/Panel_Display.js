// =========================================================================================================
// Panel: Display - v2.0build20191019-jscript-panel3-phase2-v0616
// =========================================================================================================

function displayAccentHex(colour) {
	var value = Number(colour) >>> 0;
	return "#" + ("000000" + (value & 0x00ffffff).toString(16).toUpperCase()).slice(-6);
}

// ----- DRAW -----
function on_paint(gr) {
	gr.FillRectangle(0, 0, ww, wh, p_backcol);
	display_system.draw(gr);
}

// ----- MOUSE ACTIONS -----
function on_mouse_rbtn_up(x, y) {
	if (display_system.traceMouse(x, y)) {
		var a = {};

		for (var i = 0; i < 3; i++) a[i] = window.CreatePopupMenu();

		a[1].AppendMenuItem(MF_STRING, 1, "Plain Font");
		a[1].AppendMenuItem(MF_STRING, 2, "Dot Matrix");
		a[1].CheckMenuRadioItem(1, 2, display_system.display_style + 1);

		a[2].AppendMenuItem(MF_STRING, 20, "Default - DarkOne blue");
		a[2].AppendMenuItem(MF_STRING, 22, "Columns UI selected-item background");
		a[2].AppendMenuItem(MF_STRING, 21, "Custom colour... (" + displayAccentHex(display_system.custom_accent_colour) + ")");
		var selected_accent_id = display_system.accent_mode == DARKONE_DISPLAY_ACCENT_CUSTOM
			? 21
			: (display_system.accent_mode == DARKONE_DISPLAY_ACCENT_COLUMNS_UI_SELECTED ? 22 : 20);
		a[2].CheckMenuRadioItem(20, 22, selected_accent_id);

		a[1].AppendTo(a[0], MF_STRING, "Display Style");
		a[2].AppendTo(a[0], MF_STRING, "Display accent colour");
		a[0].AppendMenuSeparator();
		a[0].AppendMenuItem(MF_STRING, 900, "DarkOne Tools...");

		var idx = a[0].TrackPopupMenu(x, y);

		switch (idx) {
			case 1:
			case 2:
				window.SetProperty("Display Style", idx - 1);
				display_system.display_style = window.GetProperty("Display Style");
				display_system.InitImages();
				display_system.init();
				window.Repaint();
				break;

			case 20:
				display_system.setAccent(DARKONE_DISPLAY_ACCENT_DEFAULT);
				window.Repaint();
				break;

			case 21:
				var chosen = utils.ColourPicker(display_system.custom_accent_colour);
				display_system.setAccent(DARKONE_DISPLAY_ACCENT_CUSTOM, chosen);
				window.Repaint();
				break;

			case 22:
				display_system.setAccent(DARKONE_DISPLAY_ACCENT_COLUMNS_UI_SELECTED);
				window.Repaint();
				break;

			case 900:
				darkOneToolsMenu(x, y);
				break;
		}

		for (var j = 0; j < 3; j++) a[j].Dispose();

		return true;
	}
}

// ----- EVENTS -----
function on_size() {
	ww = window.Width;
	wh = window.Height;
	display_system.initPos();
}

function on_volume_change(val) {
	display_system.VolumeChange(val);
}

function on_notify_data(name, info) {
	if (darkOneHandleResetNotification(name, info)) return;
	if (typeof darkOneHandleNotify == 'function') {
		var change = darkOneHandleNotify(name, info);
		if (change) {
			if (darkOneNotifyAffects(change, 'display')) {
				var accent_changed = darkOneNotifyMatches(change, 'DARKONEJSP3.DISPLAY.ACCENT.');
				var font_changed = change.all;
				for (var i = 0; !font_changed && i < change.names.length; i++) {
					var property_name = change.names[i];
					font_changed = property_name.indexOf('DARKONEJSP3.DISPLAY.') === 0 &&
						property_name.indexOf('DARKONEJSP3.DISPLAY.ACCENT.') !== 0;
				}
				if (font_changed) display_system.InitFonts();
				if (accent_changed) {
					display_system.InitColours();
					display_system.setColours();
					display_system.resetRenderedImages();
				}
				window.Repaint();
			}
			return;
		}
	}
	display_system.NotifyData(name, info);
}

function on_playlist_stop_after_current_changed(state) {
	display_system.repaint(section.sac);
}

function on_playback_order_changed(new_order) {
	display_system.repaint(section.pbo);
}

function on_playback_new_track(metadb) {
	display_system.init();
	window.Repaint();
}

function on_playback_time(time) {
	display_system.PlayTime(time);
}

function on_playback_dynamic_info() {
	display_system.PlayDynInfo();
}

function on_playback_edited() {
	display_system.PlayEdited();
}

function on_playback_pause(state) {
	display_system.repaint(section.pbt);
}

function on_playback_stop(reason) {
	display_system.onStop(reason);
}

function on_script_unload() {
	display_system.onUnload();
}

function on_colours_changed() {
	get_colours();
	display_system.InitColours();
	display_system.setColours();
	display_system.resetRenderedImages();
	window.Repaint();
}
