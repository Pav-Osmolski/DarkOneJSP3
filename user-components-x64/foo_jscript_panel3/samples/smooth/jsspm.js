function on_char(code) {
	if (brw.inputboxID >= 0) {
		brw.inputbox.on_char(code);
	} else if (ppt.showHeaderBar && ppt.showFilterBox) {
		g_filterbox.on_char(code);
	}
}

function on_drag_drop(action, x, y, mask) {
	if (x > brw.scrollbar.x || y < brw.y) {
		action.Effect = 0;
	} else {
		if (g_drag_drop_target_id > -1) {
			if (playlist_can_add_items(g_drag_drop_target_id)) {
				plman.UndoBackup(g_drag_drop_target_id);
				action.Playlist = g_drag_drop_target_id;
				action.Base = plman.GetPlaylistItemCount(g_drag_drop_target_id);
				action.ToSelect = false;
				action.Effect = 1;
			} else {
				action.Effect = 0;
			}
		} else {
			action.Playlist = plman.CreatePlaylist(plman.PlaylistCount, "Dropped Items");;
			action.Base = 0;
			action.ToSelect = true;
			action.Effect = 1;
		}
	}
	g_drag_drop_target_id = -1;
	brw.repaint();
}

function on_drag_leave() {
	g_drag_drop_target_id = -1;

	if (cScrollBar.timerID) {
		window.ClearInterval(cScrollBar.timerID);
		cScrollBar.timerID = false;
	}

	brw.repaint();
}

function on_drag_over(action, x, y, mask) {
	if (x > brw.scrollbar.x || y < brw.y) {
		action.Effect = 0;
	} else {
		g_drag_drop_target_id = -1;
		brw.on_mouse("drag_over", x, y);
		if (g_drag_drop_target_id > -1) {
			action.Effect = playlist_can_add_items(g_drag_drop_target_id) ? 1 : 0;
		} else {
			action.Effect = 1;
		}
	}
	brw.repaint();
}

function on_focus(is_focused) {
	if (brw.inputboxID >= 0) {
		brw.inputbox.on_focus(is_focused);
	}
	if (ppt.showHeaderBar && ppt.showFilterBox) {
		g_filterbox.on_focus(is_focused);
	}
	if (!is_focused) {
		brw.inputboxID = -1;
		brw.repaint();
	}
}

function on_key_down(vkey) {
	if (brw.inputboxID >= 0) {
		if (vkey == VK_ESCAPE) brw.inputboxID = -1;
		brw.inputbox.on_key_down(vkey);
		return;
	}

	var mask = GetKeyboardMask();

	// Keep standard text-editing shortcuts inside the playlist filter.
	if (ppt.showHeaderBar && ppt.showFilterBox && g_filterbox.inputbox.edit) {
		if (!(mask == KMask.ctrl && (vkey == 48 || vkey == 84))) {
			g_filterbox.on_key_down(vkey);
			return;
		}
	}

	if (mask == KMask.none && brw.rows.length > 0) {
		switch (vkey) {
		case VK_F2:
			var renameIndex = brw.getSelectedPlaylistIndex();
			if (renameIndex > -1 && playlist_can_rename(renameIndex)) {
				brw.showSelectedPlaylist();
				brw.rename_playlist(renameIndex);
			}
			break;
		case VK_RETURN:
			var activateIndex = brw.getSelectedPlaylistIndex();
			if (activateIndex > -1) {
				plman.ActivePlaylist = activateIndex;
				brw.repaint();
			}
			break;
		case VK_DELETE:
			var removeIndex = brw.getSelectedPlaylistIndex();
			if (removeIndex > -1) plman.RemovePlaylistSwitch(removeIndex);
			break;
		case VK_UP:
			if (brw.selectedRow > 0) {
				brw.selectedRow--;
				brw.showSelectedPlaylist();
				brw.repaint();
			}
			break;
		case VK_DOWN:
			if (brw.selectedRow < brw.rows.length - 1) {
				brw.selectedRow++;
				brw.showSelectedPlaylist();
				brw.repaint();
			}
			break;
		case VK_HOME:
			brw.selectedRow = 0;
			brw.showSelectedPlaylist();
			brw.repaint();
			break;
		case VK_END:
			brw.selectedRow = brw.rows.length - 1;
			brw.showSelectedPlaylist();
			brw.repaint();
			break;
		}
	} else if (mask == KMask.ctrl) {
		if (vkey == 48) { // CTRL+0
			if (ppt.extra_font_size > 0) {
				ppt.extra_font_size = 0;
				window.SetProperty("SMOOTH.EXTRA.FONT.SIZE", ppt.extra_font_size);
				get_font();
				get_metrics();
				get_images();
				brw.repaint();
			}
		} else if (vkey == 84) { // CTRL+T
			ppt.showHeaderBar = !ppt.showHeaderBar;
			window.SetProperty("SMOOTH.SHOW.TOP.BAR", ppt.showHeaderBar);
			get_metrics();
			brw.repaint();
		}
	}
}

function on_key_up(vkey) {
	cScrollBar.timerCounter = -1;

	if (cScrollBar.timerID) {
		window.ClearTimeout(cScrollBar.timerID);
		cScrollBar.timerID = false;
	}

	brw.repaint();
}

function on_mouse_lbtn_down(x, y) {
	if (ppt.showHeaderBar && ppt.showFilterBox && g_filterbox.on_mouse("lbtn_down", x, y)) return;
	brw.on_mouse("lbtn_down", x, y);
}

function on_mouse_lbtn_up(x, y) {
	if (ppt.showHeaderBar && ppt.showFilterBox && g_filterbox.on_mouse("lbtn_up", x, y)) return;
	brw.on_mouse("lbtn_up", x, y);
}

function on_mouse_lbtn_dblclk(x, y, mask) {
	if (ppt.showHeaderBar && ppt.showFilterBox && g_filterbox.on_mouse("lbtn_dblclk", x, y)) return;
	brw.on_mouse("lbtn_dblclk", x, y);
}

function on_mouse_rbtn_up(x, y) {
	if (ppt.showHeaderBar && ppt.showFilterBox && g_filterbox.on_mouse("rbtn_up", x, y)) return true;
	brw.on_mouse("rbtn_up", x, y);
	return true;
}

function on_mouse_move(x, y) {
	if (m_x == x && m_y == y)
		return;

	m_x = x;
	m_y = y;

	if (ppt.showHeaderBar && ppt.showFilterBox) g_filterbox.on_mouse("move", x, y);
	brw.on_mouse("move", x, y);
}

function on_mouse_wheel(step) {
	if (utils.IsKeyPressed(VK_CONTROL)) {
		brw.inputboxID = -1;
		update_extra_font_size(step);
	} else {
		scroll -= step * ppt.rowHeight * ppt.rowScrollStep;
		scroll = check_scroll(scroll);
		brw.on_mouse("wheel", m_x, m_y, step);
		brw.repaint();
	}
}

function on_paint(gr) {
	if (g_playlist_manager_profiler) g_playlist_manager_profiler.begin();
	brw.draw(gr);
	if (g_playlist_manager_profiler) g_playlist_manager_profiler.end();
}

function on_playback_dynamic_info_track(type) {
	if (type == 1) {
		if (ppt.wallpapermode == 1) {
			setWallpaperImg();
		}
		if (ppt.enableDynamicColours) {
			on_colours_changed();
		}
		brw.repaint();
	}
}

function on_playback_new_track() {
	setWallpaperImg();

	if (ppt.enableDynamicColours) {
		on_colours_changed();
	}

	brw.repaint();
}

function on_playback_stop(reason) {
	if (reason != 2) {
		setWallpaperImg();

		if (ppt.enableDynamicColours) {
			on_colours_changed();
		}
	}
	brw.repaint();
}

function on_playlist_items_added(playlistIndex) {
	brw.updatePlaylistCount(playlistIndex);
}

function on_playlist_items_removed(playlistIndex) {
	brw.updatePlaylistCount(playlistIndex);
}

function on_playlist_switch() {
	g_active_playlist = plman.ActivePlaylist;
	var activeRow = brw.getRowFromPlaylistIndex(g_active_playlist);
	if (activeRow > -1) {
		brw.selectedRow = activeRow;
		if (ppt.autoShowActivePlaylist) brw.showSelectedPlaylist();
	}
	brw.repaint();
}

function on_playlists_changed() {
	g_active_playlist = plman.ActivePlaylist;
	brw.populate();
}

function oBrowser() {
	this.getRowFromPlaylistIndex = function (playlistIndex) {
		for (var i = 0; i < this.rows.length; i++) {
			if (this.rows[i].idx == playlistIndex) return i;
		}
		return -1;
	}

	this.getPlaylistIndex = function (rowIndex) {
		return rowIndex >= 0 && rowIndex < this.rows.length ? this.rows[rowIndex].idx : -1;
	}

	this.getSelectedPlaylistIndex = function () {
		return this.getPlaylistIndex(this.selectedRow);
	}

	this.updatePlaylistCount = function (playlistIndex) {
		var row = this.getRowFromPlaylistIndex(playlistIndex);
		if (row > -1) {
			this.rows[row].count = plman.GetPlaylistItemCount(playlistIndex);
			var rowY = Math.floor(this.y + (row * ppt.rowHeight) - scroll_);
			if (window.IsVisible && rowY + ppt.rowHeight > this.y && rowY < this.y + this.h) {
				window.RepaintRect(this.x, rowY, this.w, ppt.rowHeight);
				return;
			}
		}
		this.repaint();
	}

	this.refreshPlaylistFlags = function (playlistIndex) {
		var row = this.getRowFromPlaylistIndex(playlistIndex);
		if (row < 0) return;
		this.rows[row].isAutoPlaylist = plman.IsAutoPlaylist(playlistIndex);
		this.rows[row].isLocked = !this.rows[row].isAutoPlaylist && plman.IsPlaylistLocked(playlistIndex);
		this.repaint();
	}

	this.repaint = function () {
		need_repaint = true;
		if (g_playlist_manager_frame) g_playlist_manager_frame.request();
	}

	// Enhanced sample: persist a semantic scroll anchor instead of only
	// an absolute pixel value. This keeps the same top playlist visible when
	// row height, DPI/font scaling or the panel dimensions change.
	this.getMaxScroll = function (rowHeight, viewportHeight, rowCount) {
		var rh = Math.max(1, Number(rowHeight) || 1);
		var vh = Math.max(0, Number(viewportHeight) || 0);
		var count = typeof rowCount == 'number' ? rowCount : this.rows.length;
		return Math.max(0, (Math.max(0, count) * rh) - vh);
	}

	this.captureScrollState = function (value, rowHeight, viewportHeight) {
		var rh = Math.max(1, Number(rowHeight) || ppt.rowHeight || 1);
		var maxScroll = this.getMaxScroll(rh, viewportHeight, this.rows.length);
		var pixel = Math.max(0, Math.min(Number(value) || 0, maxScroll));
		var rowFloat = pixel / rh;
		var row = Math.max(0, Math.min(this.rows.length ? this.rows.length - 1 : 0, Math.floor(rowFloat)));
		var offset = Math.max(0, Math.min(0.999999, rowFloat - row));
		var guid = '';

		if (this.rows.length && this.rows[row]) {
			guid = String(this.rows[row].guid || '');
		}

		return {
			version: 2,
			guid: guid,
			row: row,
			offset: Math.round(offset * 1000000) / 1000000,
			bottom: maxScroll > 0 && Math.abs(pixel - maxScroll) <= 1,
			pixel: Math.round(pixel),
			rowHeight: rh
		};
	}

	this.resolveScrollState = function (state) {
		var maxScroll = this.getMaxScroll(ppt.rowHeight, this.h, this.rows.length);
		if (!state || typeof state != 'object') return 0;
		if (state.bottom) return maxScroll;

		var row = Math.max(0, Math.round(Number(state.row) || 0));
		var offset = Math.max(0, Math.min(0.999999, Number(state.offset) || 0));

		if (state.guid) {
			try {
				var playlistIndex = plman.FindByGUID(String(state.guid));
				var mappedRow = this.getRowFromPlaylistIndex(playlistIndex);
				if (mappedRow > -1) row = mappedRow;
			} catch (e) {}
		}

		if (this.rows.length) row = Math.min(row, this.rows.length - 1);
		return Math.max(0, Math.min((row + offset) * ppt.rowHeight, maxScroll));
	}

	this.readSavedScrollState = function () {
		var raw = window.GetProperty(g_manager_scroll_state_property, '');
		if (typeof raw == 'string' && raw.length) {
			try {
				var state = JSON.parse(raw);
				if (state && state.version == 2) return state;
			} catch (e) {}
		}
		return null;
	}

	this.saveScrollPosition = function (force) {
		if (!ppt.rememberManagerScrollPosition || !g_manager_scroll_restore_done) return;
		var state = this.captureScrollState(scroll, ppt.rowHeight, this.h);
		var serialised = JSON.stringify(state);
		if (!force && serialised == g_manager_scroll_last_saved) return;
		g_manager_scroll_last_saved = serialised;
		window.SetProperty(g_manager_scroll_state_property, serialised);
		// Retain the original numeric property for backwards compatibility.
		window.SetProperty(g_manager_scroll_property, state.pixel);
	}

	this.queueSaveScrollPosition = function () {
		if (!ppt.rememberManagerScrollPosition || !g_manager_scroll_restore_done || g_manager_scroll_save_timer) return;
		g_manager_scroll_save_timer = window.SetTimeout(function () {
			g_manager_scroll_save_timer = false;
			if (brw) brw.saveScrollPosition(false);
		}, 250);
	}

	this.restoreScrollPosition = function () {
		g_manager_scroll_restore_done = true;
		var state = this.readSavedScrollState();

		if (state) {
			scroll = this.resolveScrollState(state);
		} else {
			// One-time migration from the pre-v0.4.7 absolute-pixel property.
			scroll = check_scroll(Math.max(0, Math.round(window.GetProperty(g_manager_scroll_property, 0))));
		}

		scroll_ = scroll;
		scroll_prev = scroll;
		this.layoutRowHeight = ppt.rowHeight;
		this.layoutHeight = this.h;
		this.scrollbar.updateScrollbar();
		this.saveScrollPosition(true);
		this.repaint();
	}


	this.setSize = function () {
		var oldRowHeight = this.layoutRowHeight || ppt.rowHeight;
		var oldHeight = this.layoutHeight || this.h || 0;
		var layoutAnchor = null;

		if (g_manager_scroll_restore_done && this.rows.length && oldHeight > 0) {
			layoutAnchor = this.captureScrollState(scroll, oldRowHeight, oldHeight);
		}

		this.x = 0;
		this.y = ppt.showHeaderBar ? ppt.headerBarHeight : 0;
		this.w = ww - cScrollBar.width;
		this.h = wh - this.y;
		this.totalRows = Math.ceil(this.h / ppt.rowHeight);
		this.totalRowsVis = Math.floor(this.h / ppt.rowHeight);

		if (ppt.showHeaderBar && ppt.showFilterBox) {
			var filterWidth = Math.min(scale(ppt.filterBoxWidth), Math.max(scale(120), Math.floor(ww * 0.62)));
			g_filterbox.setSize(scale(4), scale(2), filterWidth, Math.max(scale(18), ppt.headerBarHeight - scale(4)));
		}

		if (this.inputboxID > -1) {
			var rh = ppt.rowHeight - 10;
			var tw = this.w - rh - 10;
			if (this.inputbox) {
				this.inputbox.setSize(tw, rh);
			}
		}

		this.scrollbar.setSize();

		if (layoutAnchor) {
			scroll = this.resolveScrollState(layoutAnchor);
		} else {
			scroll = Math.round(scroll / ppt.rowHeight) * ppt.rowHeight;
			scroll = check_scroll(scroll);
		}

		scroll_ = scroll;
		scroll_prev = scroll;
		this.layoutRowHeight = ppt.rowHeight;
		this.layoutHeight = this.h;

		this.scrollbar.updateScrollbar();
		if (layoutAnchor) this.saveScrollPosition(true);
	}

	this.getlimits = function () {
		if (this.rows.length <= this.totalRowsVis) {
			var start_ = 0;
			var end_ = this.rows.length - 1;
		} else {
			if (scroll_ < 0)
				scroll_ = scroll;
			var start_ = Math.round(scroll_ / ppt.rowHeight + 0.4);
			var end_ = start_ + this.totalRows;
			start_ = start_ > 0 ? start_ - 1 : start_;
			if (start_ < 0)
				start_ = 0;
			if (end_ >= this.rows.length)
				end_ = this.rows.length - 1;
		}
		g_start_ = start_;
		g_end_ = end_;
	}

	this.populate = function () {
		var previousPlaylist = this.getSelectedPlaylistIndex();
		var listAnchor = g_manager_scroll_restore_done && this.rows.length
			? this.captureScrollState(scroll, this.layoutRowHeight || ppt.rowHeight, this.layoutHeight || this.h)
			: null;
		var needle = g_filter_text.toLowerCase();
		this.rows = [];

		for (var i = 0; i < plman.PlaylistCount; i++) {
			var name = plman.GetPlaylistName(i);
			if (!needle.length || name.toLowerCase().indexOf(needle) > -1) {
				var guid = '';
				try { guid = String(plman.GetGUID(i)); } catch (e) {}
				var isAutoPlaylist = plman.IsAutoPlaylist(i);
				this.rows.push(new oPlaylist(
					i,
					name,
					plman.GetPlaylistItemCount(i),
					guid,
					isAutoPlaylist,
					!isAutoPlaylist && plman.IsPlaylistLocked(i)
				));
			}
		}

		this.playlistCountSnapshot = plman.PlaylistCount;
		var selected = this.getRowFromPlaylistIndex(previousPlaylist);
		if (selected < 0) selected = this.getRowFromPlaylistIndex(g_active_playlist);
		this.selectedRow = selected > -1 ? selected : (this.rows.length ? 0 : -1);

		if (listAnchor) {
			scroll = this.resolveScrollState(listAnchor);
			scroll_ = scroll;
			scroll_prev = scroll;
		} else {
			scroll = check_scroll(scroll);
			scroll_ = check_scroll(scroll_);
		}

		this.scrollbar.updateScrollbar();
		if (listAnchor) this.saveScrollPosition(true);
		this.repaint();
	}

	this.showSelectedPlaylist = function () {
		var offset = ppt.rowHeight * this.selectedRow;
		if (offset < scroll || offset + ppt.rowHeight > scroll + this.h) {
			scroll = (this.selectedRow - Math.floor(this.totalRowsVis / 2)) * ppt.rowHeight;
			scroll = check_scroll(scroll);
			this.scrollbar.updateScrollbar();
		}
	}

	this.draw = function (gr) {
		drawBackground(gr)

		this.getlimits();

		if (this.rows.length > 0) {
			var ax = 0;
			var ay = 0;
			var aw = this.w;
			var ah = ppt.rowHeight;

			for (var i = g_start_; i <= g_end_; i++) {
				ay = Math.floor(this.y + (i * ah) - scroll_);
				var normal_text = g_colour_text;

				if (ppt.alternatingRowShading && i % 2 != 0) {
					gr.FillRectangle(ax, ay, aw, ah, setAlpha(g_colour_text, 8));
				}

				if (this.rows[i].idx == g_active_playlist) {
					drawSelectedRectangle(gr, ax, ay, aw, ah);
					normal_text = g_colour_selected_text;
				} else if (i == this.selectedRow) {
					gr.DrawRectangle(ax + 1, ay + 1, aw - 2, ah - 2, 2.0, g_colour_selection);
				}

				if (cPlaylistManager.drag_target_id == i) {
					if (cPlaylistManager.drag_target_id > cPlaylistManager.drag_source_id) {
						gr.DrawRectangle(ax, ay + ppt.rowHeight - 2, aw - 1, 1, 2.0, g_colour_selection);
					} else if (cPlaylistManager.drag_target_id < cPlaylistManager.drag_source_id) {
						gr.DrawRectangle(ax, ay + 1, aw - 1, 1, 2.0, g_colour_selection);
					}
				}

				if (this.rows[i].idx == g_drag_drop_target_id && playlist_can_add_items(this.rows[i].idx)) {
					gr.DrawRectangle(ax + 1, ay + 1, aw - 2, ah - 2, 2.0, g_colour_text & 0xa0ffffff);
				}

				if (this.rows[i].isAutoPlaylist) {
					gr.WriteTextSimple(chars.autoplaylist, g_font_fluent_20, normal_text, ax + scale(5), ay, ah, ah, 0, 2);
				} else if (this.rows[i].isLocked) {
					gr.WriteTextSimple(chars.lock, g_font_fluent_20, normal_text, ax + scale(5), ay, ah, ah, 0, 2);
				} else {
					gr.WriteTextSimple(chars.list, g_font_fluent_20, normal_text, ax + scale(6), ay, ah, ah, 0, 2);
				}

				if (this.inputboxID == this.rows[i].idx) {
					this.inputbox.draw(gr, ah, ay + 5);
				} else {
					gr.WriteTextSimple(this.rows[i].name, g_font, normal_text, ah * 1.2, ay, aw - (ah * 2.5), ah, 0, 2, 1, 1);
					gr.WriteTextSimple(this.rows[i].count, g_font, normal_text, ah, ay, aw - ah - 5, ah, 1, 2, 1, 1);
				}
			}
		}

		this.scrollbar.draw(gr);

		if (ppt.showHeaderBar) {
			var total = this.playlistCountSnapshot;
			var boxText = this.rows.length == total ? String(total) : this.rows.length + " of " + total;
			boxText += total == 1 ? " playlist" : " playlists";
			draw_header_bar(gr, boxText, this);
			if (ppt.showFilterBox) g_filterbox.draw(gr);
		}
	}

	this.on_mouse = function (event, x, y) {
		var activeRow = -1;
		var hover = x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;

		if (hover) {
			var tmp = Math.ceil((y + scroll_ - this.y) / ppt.rowHeight - 1);
			if (tmp < this.rows.length) {
				activeRow = tmp;
			}
		}

		switch (event) {
		case "drag_over":
			if (activeRow > -1) {
				g_drag_drop_target_id = this.getPlaylistIndex(activeRow);
			}
			break;
		case "lbtn_dblclk":
			var doubleClickPlaylist = this.getPlaylistIndex(activeRow);
			if (doubleClickPlaylist > -1 && g_active_playlist != doubleClickPlaylist) {
				this.inputboxID = -1;
				plman.ActivePlaylist = doubleClickPlaylist;
			}
			break;
		case "lbtn_down":
			this.selectedRow = activeRow;
			if (activeRow > -1) {
				if (this.getPlaylistIndex(activeRow) == this.inputboxID) {
					this.inputbox.check("lbtn_down", x, y);
				} else {
					this.inputboxID = -1;
					cPlaylistManager.drag_clicked = true;
					cPlaylistManager.drag_source_id = this.selectedRow;
				}
			} else {
				this.inputboxID = -1;
			}
			break;
		case "lbtn_up":
			if (this.inputboxID > -1) {
				this.inputbox.check("lbtn_up", x, y);
			} else if (cPlaylistManager.drag_target_id > -1 && cPlaylistManager.drag_target_id != cPlaylistManager.drag_source_id) {
				var sourcePlaylist = this.getPlaylistIndex(cPlaylistManager.drag_source_id);
				var targetPlaylist = this.getPlaylistIndex(cPlaylistManager.drag_target_id);
				if (sourcePlaylist > -1 && targetPlaylist > -1) {
					plman.MovePlaylist(sourcePlaylist, targetPlaylist);
					this.selectedRow = cPlaylistManager.drag_target_id;
				}
			}

			if (timers.movePlaylist) {
				window.ClearInterval(timers.movePlaylist);
				timers.movePlaylist = false;
			}

			if (cPlaylistManager.drag_moved)
				window.SetCursor(IDC_ARROW);

			cPlaylistManager.drag_clicked = false;
			cPlaylistManager.drag_moved = false;
			cPlaylistManager.drag_source_id = -1;
			cPlaylistManager.drag_target_id = -1;
			break;
		case "move":
			if (this.inputboxID > -1) {
				this.inputbox.check("move", x, y);
			} else {
				if (cPlaylistManager.drag_clicked) {
					cPlaylistManager.drag_moved = true;
				}
				if (cPlaylistManager.drag_moved) {
					window.SetCursor(IDC_HELP);
					if (activeRow > -1) {
						if (timers.movePlaylist) {
							window.ClearInterval(timers.movePlaylist);
							timers.movePlaylist = false;
						}
						if (activeRow != cPlaylistManager.drag_source_id) {
							cPlaylistManager.drag_target_id = activeRow;
						} else {
							cPlaylistManager.drag_target_id = -1;
						}
					} else {
						if (y < this.y) {
							if (!timers.movePlaylist) {
								timers.movePlaylist = window.SetInterval(function () {
									scroll -= ppt.rowHeight;
									scroll = check_scroll(scroll);
									cPlaylistManager.drag_target_id = cPlaylistManager.drag_target_id > 0 ? cPlaylistManager.drag_target_id - 1 : 0;
									brw.repaint();
								}, 100);
							}
						} else if (y > this.y + this.h) {
							if (!timers.movePlaylist) {
								timers.movePlaylist = window.SetInterval((function () {
									scroll += ppt.rowHeight;
									scroll = check_scroll(scroll);
									cPlaylistManager.drag_target_id = cPlaylistManager.drag_target_id < this.rows.length - 1 ? cPlaylistManager.drag_target_id + 1 : this.rows.length - 1;
									brw.repaint();
								}).bind(this), 100);
							}
						}
					}
				}
			}
			break;
		case "rbtn_up":
			this.selectedRow = activeRow;
			this.repaint();
			if (this.inputboxID > -1) {
				if (this.inputbox.hover) {
					this.inputbox.check("rbtn_up", x, y);
				}
			} else {
				if (hover) {
					this.context_menu(x, y, this.getPlaylistIndex(activeRow));
				} else {
					this.settings_menu(x, y);
				}
			}
			break;
		}

		if (cScrollBar.visible) {
			this.scrollbar.on_mouse(event, x, y);
		}

		if (event != "move") {
			this.repaint();
		}
	}

	this.rename_playlist = function (p) {
		var rh = ppt.rowHeight - 10;
		var tw = this.w - rh - 100;
		this.inputbox = new oInputbox(tw, rh, false, plman.GetPlaylistName(p), "", "renamePlaylist()");
		this.inputboxID = p;
		this.inputbox.on_focus(true);
		this.inputbox.edit = true;
		this.inputbox.Cpos = this.inputbox.text.length;
		this.inputbox.anchor = this.inputbox.Cpos;
		this.inputbox.SelBegin = this.inputbox.Cpos;
		this.inputbox.SelEnd = this.inputbox.Cpos;
		if (!cInputbox.timer_cursor) {
			this.inputbox.resetCursorTimer();
		}
		this.inputbox.dblclk = true;
		this.inputbox.SelBegin = 0;
		this.inputbox.SelEnd = this.inputbox.text.length;
		this.inputbox.text_selected = this.inputbox.text;
		this.inputbox.select = true;
		this.repaint();
	}

	this.context_menu = function (x, y, id) {
		var menu = window.CreatePopupMenu();
		var autoplaylist_popup = window.CreatePopupMenu();
		var restore_popup = window.CreatePopupMenu();
		var context_popup = window.CreatePopupMenu();
		var context = fb.CreateContextMenuManager();

		var count = plman.PlaylistCount;
		var recycler_count = plman.RecyclerCount;
		var history = [];

		if (id > -1) {
			var lock_name = plman.GetPlaylistLockName(id);

			menu.AppendMenuItem(EnableMenuIf(playlist_can_rename(id)), 1, "Rename this playlist\tF2");
			menu.AppendMenuItem(EnableMenuIf(playlist_can_remove(id)), 2, "Remove this playlist\tDel");
			menu.AppendMenuItem(MF_STRING, 3, "Duplicate this playlist");
			menu.AppendMenuSeparator();
			if (plman.IsAutoPlaylist(id)) {
				menu.AppendMenuItem(MF_STRING, 4, lock_name + " properties");
				menu.AppendMenuItem(MF_STRING, 5, "Convert to a normal playlist");
			} else {
				var is_locked = plman.IsPlaylistLocked(id);
				var is_mine = lock_name == "JScript Panel 3";

				menu.AppendMenuItem(EnableMenuIf(is_mine || !is_locked), 6, "Edit playlist lock...");
				menu.AppendMenuItem(EnableMenuIf(is_mine), 7, "Remove playlist lock");
			}
			var playlist_items = plman.GetPlaylistItems(id);
			if (playlist_items.Count > 0) {
				menu.AppendMenuSeparator();
				context.InitContext(playlist_items);
				context.BuildMenu(context_popup, 1000);
				context_popup.AppendTo(menu, MF_STRING, 'Items');
			}
			menu.AppendMenuSeparator();
		}

		for (var i = 0; i < autoplaylists.length; i++) {
			autoplaylist_popup.AppendMenuItem(MF_STRING, 200 + i, autoplaylists[i][0]);
		}

		menu.AppendMenuItem(MF_STRING, 100, "Create new playlist");
		menu.AppendMenuItem(MF_STRING, 101, "Load playlist...");
		menu.AppendMenuSeparator();
		menu.AppendMenuItem(MF_STRING, 102, "Create new autoplaylist");
		autoplaylist_popup.AppendTo(menu, MF_STRING, "Preset autoplaylists");

		if (recycler_count > 0) {
			menu.AppendMenuSeparator();

			for (var i = 0; i < recycler_count; i++) {
				history.push(i);
				restore_popup.AppendMenuItem(MF_STRING, 10 + i, plman.GetRecyclerName(i));
			}

			restore_popup.AppendMenuSeparator();
			restore_popup.AppendMenuItem(MF_STRING, 103, "Clear history");
			restore_popup.AppendTo(menu, MF_STRING, "Restore");
		}

		menu.AppendMenuSeparator();
		menu.AppendMenuItem(EnableMenuIf(count > 1), 104, "Sort playlists A-Z");
		menu.AppendMenuItem(EnableMenuIf(count > 1), 105, "Sort playlists Z-A");


		var idx = menu.TrackPopupMenu(x, y);
		menu.Dispose();

		switch (idx) {
		case 0:
			break;
		case 1:
			this.rename_playlist(id);
			break;
		case 2:
			plman.RemovePlaylistSwitch(id);
			break;
		case 3:
			plman.ActivePlaylist = plman.DuplicatePlaylist(id, "Copy of " + plman.GetPlaylistName(id));
			break;
		case 4:
			plman.ShowAutoPlaylistUI(id);
			break;
		case 5:
			plman.ActivePlaylist = plman.DuplicatePlaylist(id, plman.GetPlaylistName(id));
			plman.RemovePlaylist(id);
			break;
		case 6:
			plman.ShowPlaylistLockUI(id);
			this.refreshPlaylistFlags(id);
			break;
		case 7:
			plman.RemovePlaylistLock(id);
			this.refreshPlaylistFlags(id);
			break;
		case 100:
			if (g_filter_text.length) g_filterbox.clear();
			var p = plman.CreatePlaylist();
			plman.ActivePlaylist = p;
			this.rename_playlist(p);
			break;
		case 101:
			fb.LoadPlaylist();
			break;
		case 102:
			if (g_filter_text.length) g_filterbox.clear();
			var p = plman.CreateAutoPlaylist(plman.PlaylistCount, "", "enter your query here");
			plman.ActivePlaylist = p;
			plman.ShowAutoPlaylistUI(p);
			this.rename_playlist(p);
			break;
		case 103:
			plman.RecyclerPurge(history);
			break;
		case 104:
			plman.SortPlaylistsByName(1);
			break;
		case 105:
			plman.SortPlaylistsByName(-1);
			break;
		default:
			if (idx >= 10 && idx <= 98) {
				plman.RecyclerRestore(idx - 10);
				plman.ActivePlaylist = plman.PlaylistCount - 1;
			} else if (idx >= 200 && idx < 200 + autoplaylists.length) {
				var item = autoplaylists[idx - 200];
				plman.ActivePlaylist = plman.CreateAutoPlaylist(plman.PlaylistCount, item[0], item[1], ppt.autoplaylist_sort_pattern);
			} else if (idx >= 1000) {
				context.ExecuteByID(idx - 1000);
			}
			break;
		}

		context.Dispose();
		this.repaint();
		return true;
	}

	this.settings_menu = function (x, y) {
		var menu = window.CreatePopupMenu();
		var sub1 = window.CreatePopupMenu();
		var sub2 = window.CreatePopupMenu();
		var sub3 = window.CreatePopupMenu();
		var sub4 = window.CreatePopupMenu();

		menu.AppendMenuItem(CheckMenuIf(ppt.showHeaderBar), 1, "Header Bar");
		menu.AppendMenuItem(GetMenuFlags(ppt.showHeaderBar, ppt.showFilterBox), 7, "Playlist filter");
		menu.AppendMenuSeparator();

		var colour_flag = EnableMenuIf(ppt.enableCustomColours);
		sub1.AppendMenuItem(CheckMenuIf(ppt.enableDynamicColours), 2, "Enable Dynamic");
		sub1.AppendMenuItem(CheckMenuIf(ppt.enableCustomColours), 3, "Enable Custom");
		sub1.AppendMenuItem(CheckMenuIf(ppt.alternatingRowShading), 8, "Alternating row shading");
		sub1.AppendMenuSeparator();
		sub1.AppendMenuItem(colour_flag, 4, "Text");
		sub1.AppendMenuItem(colour_flag, 5, "Background");
		sub1.AppendMenuItem(colour_flag, 6, "Selected background");
		sub1.AppendTo(menu, MF_STRING, "Colours");
		menu.AppendMenuSeparator();

		sub2.AppendMenuItem(MF_STRING, 10, "None");
		sub2.AppendMenuItem(MF_STRING, 11, "Front cover of playing track");
		sub2.AppendMenuItem(MF_STRING, 12, "Custom image");
		sub2.CheckMenuRadioItem(10, 12, ppt.wallpapermode + 10);
		sub2.AppendMenuSeparator();
		sub2.AppendMenuItem(EnableMenuIf(ppt.wallpapermode == 2), 13, "Custom image path...");
		sub2.AppendMenuSeparator();

		sub2.AppendMenuItem(GetMenuFlags(ppt.wallpapermode != 0, ppt.wallpaperblurred), 14, "Blur");
		sub2.AppendTo(menu, MF_STRING, "Background Wallpaper");



		menu.AppendMenuSeparator();
		sub3.AppendMenuItem(CheckMenuIf(ppt.rememberManagerScrollPosition), 30, "Remember manager scroll position");
		sub3.AppendMenuItem(CheckMenuIf(ppt.autoShowActivePlaylist), 31, "Keep active playlist visible");
		sub3.AppendMenuSeparator();
		sub3.AppendMenuItem(CheckMenuIf(ppt.refreshRate == 8), 33, "8 ms refresh (120/144 Hz)");
		sub3.AppendMenuItem(CheckMenuIf(ppt.refreshRate == 10), 34, "10 ms refresh (100 Hz)");
		sub3.AppendMenuItem(CheckMenuIf(ppt.refreshRate == 12), 35, "12 ms refresh (80 Hz)");
		sub3.AppendMenuItem(CheckMenuIf(ppt.refreshRate == 16), 36, "16 ms refresh (60 Hz)");
		sub3.AppendMenuItem(MF_STRING, 37, "Set custom refresh interval...");
		sub3.AppendMenuSeparator();
		sub3.AppendMenuItem(MF_STRING, 38, "Set smoothness...");
		sub3.AppendMenuItem(MF_STRING, 39, "Set wheel row step...");
		sub3.AppendTo(menu, MF_STRING, "Enhanced smooth scrolling");

		sub4.AppendMenuItem(MF_STRING, 40, "Compact / DarkOne2021 (26)");
		sub4.AppendMenuItem(MF_STRING, 41, "Balanced (29)");
		sub4.AppendMenuItem(MF_STRING, 42, "Original JSP3 spacing (32)");
		if (ppt.defaultRowHeight == 26 || ppt.defaultRowHeight == 29 || ppt.defaultRowHeight == 32) {
			sub4.CheckMenuRadioItem(40, 42, ppt.defaultRowHeight == 26 ? 40 : ppt.defaultRowHeight == 29 ? 41 : 42);
		}
		sub4.AppendMenuSeparator();
		sub4.AppendMenuItem(MF_STRING, 43, "Set custom row height...");
		sub4.AppendMenuItem(MF_STRING, 44, "Restore DarkOne2021 spacing");
		sub4.AppendTo(menu, MF_STRING, "Playlist row spacing");

		menu.AppendMenuSeparator();
		menu.AppendMenuItem(MF_STRING, 50, "Configure...");

		var idx = menu.TrackPopupMenu(x, y);
		menu.Dispose();

		switch (idx) {
		case 1:
			ppt.showHeaderBar = !ppt.showHeaderBar;
			window.SetProperty("SMOOTH.SHOW.TOP.BAR", ppt.showHeaderBar);
			get_metrics();
			this.repaint();
			break;
		case 7:
			ppt.showFilterBox = !ppt.showFilterBox;
			window.SetProperty("SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER", ppt.showFilterBox);
			if (!ppt.showFilterBox) g_filterbox.cancel_edit();
			get_metrics();
			this.repaint();
			break;
		case 2:
			ppt.enableDynamicColours = !ppt.enableDynamicColours;
			window.SetProperty("SMOOTH.DYNAMIC.COLOURS.ENABLED", ppt.enableDynamicColours);
			on_colours_changed();
			break
		case 3:
			ppt.enableCustomColours = !ppt.enableCustomColours;
			window.SetProperty("SMOOTH.CUSTOM.COLOURS.ENABLED", ppt.enableCustomColours);
			on_colours_changed();
			break;
		case 8:
			ppt.alternatingRowShading = !ppt.alternatingRowShading;
			window.SetProperty(
				"SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS",
				ppt.alternatingRowShading
			);
			this.repaint();
			break;
		case 4:
			g_colour_text = utils.ColourPicker(g_colour_text);
			window.SetProperty("SMOOTH.COLOUR.TEXT", g_colour_text);
			on_colours_changed();
			break;
		case 5:
			g_colour_background = utils.ColourPicker(g_colour_background);
			window.SetProperty("SMOOTH.COLOUR.BACKGROUND.NORMAL", g_colour_background);
			on_colours_changed();
			break;
		case 6:
			g_colour_selection = utils.ColourPicker(g_colour_selection);
			window.SetProperty("SMOOTH.COLOUR.BACKGROUND.SELECTED", g_colour_selection);
			on_colours_changed();
			break;
		case 10:
		case 11:
		case 12:
			ppt.wallpapermode = idx - 10;
			window.SetProperty("SMOOTH.WALLPAPER.MODE2", ppt.wallpapermode);
			setWallpaperImg();
			this.repaint();
			break;
		case 13:
			var tmp = utils.InputBox("Enter the full path to an image.", window.Name, ppt.wallpaperpath);
			if (tmp != ppt.wallpaperpath) {
				ppt.wallpaperpath = tmp;
				window.SetProperty("SMOOTH.WALLPAPER.PATH", ppt.wallpaperpath);
				setWallpaperImg();
				this.repaint();
			}
			break;
		case 14:
			ppt.wallpaperblurred = !ppt.wallpaperblurred;
			window.SetProperty("SMOOTH.WALLPAPER.BLURRED", ppt.wallpaperblurred);
			setWallpaperImg();
			this.repaint();
			break;

		case 30:
			ppt.rememberManagerScrollPosition = !ppt.rememberManagerScrollPosition;
			window.SetProperty("SMOOTH.PLAYLIST.MANAGER.REMEMBER.SCROLL", ppt.rememberManagerScrollPosition);
			if (ppt.rememberManagerScrollPosition) { g_manager_scroll_restore_done = true; this.saveScrollPosition(true); }
			break;
		case 31:
			ppt.autoShowActivePlaylist = !ppt.autoShowActivePlaylist;
			window.SetProperty("SMOOTH.PLAYLIST.MANAGER.AUTO.SHOW.ACTIVE", ppt.autoShowActivePlaylist);
			break;
		case 33:
		case 34:
		case 35:
		case 36:
			set_playlist_manager_refresh_rate([8, 10, 12, 16][idx - 33]);
			break;
		case 37:
			try {
				var refresh_ms = Number(utils.InputBox('Enter a refresh interval from 8 to 40 milliseconds. Lower values are smoother but use more CPU.', window.Name, ppt.refreshRate));
				if (!isNaN(refresh_ms)) set_playlist_manager_refresh_rate(refresh_ms);
			} catch (e) {}
			break;
		case 38:
			try { var sm = Number(utils.InputBox('Lower is snappier; higher is smoother. Suggested range: 1.25 to 6.', window.Name, ppt.scrollSmoothness)); if (!isNaN(sm)) { window.SetProperty("SMOOTH.SCROLL.SMOOTHNESS", clamp(sm, 1.25, 10)); window.Reload(); } } catch (e) {}
			break;
		case 39:
			try { var rs = Number(utils.InputBox('Mouse-wheel row step. Suggested range: 1 to 10.', window.Name, ppt.rowScrollStep)); if (!isNaN(rs)) { window.SetProperty("SMOOTH.ROW.SCROLL.STEP", clamp(Math.round(rs), 1, 10)); window.Reload(); } } catch (e) {}
			break;
		case 40:
		case 41:
		case 42:
			ppt.defaultRowHeight = [26, 29, 32][idx - 40];
			window.SetProperty("SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT", ppt.defaultRowHeight);
			get_metrics();
			this.repaint();
			break;
		case 43:
			try {
				var rowHeight = Number(utils.InputBox('Playlist row height before font/DPI scaling. Suggested range: 20 to 48. DarkOne2021 default: 26.', window.Name, ppt.defaultRowHeight));
				if (!isNaN(rowHeight)) {
					ppt.defaultRowHeight = clamp(Math.round(rowHeight), 20, 64);
					window.SetProperty("SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT", ppt.defaultRowHeight);
					get_metrics();
					this.repaint();
				}
			} catch (e) {}
			break;
		case 44:
			ppt.defaultRowHeight = 26;
			window.SetProperty("SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT", ppt.defaultRowHeight);
			get_metrics();
			this.repaint();
			break;
		case 50:
			window.ShowConfigure();
			break;
		}
		return true;
	}

	// Populate asynchronously, then request the first managed repaint.
	timers.initialPopulate = window.SetTimeout(function () {
		timers.initialPopulate = false;
		brw.populate();
		if (ppt.rememberManagerScrollPosition) brw.restoreScrollPosition();
		else { g_manager_scroll_restore_done = true; if (ppt.autoShowActivePlaylist) brw.showSelectedPlaylist(); }
	}, 100);

	this.rows = [];
	this.scrollbar = new oScrollbar();
	this.inputbox = null;
	this.inputboxID = -1;
	this.selectedRow = -1;
	this.playlistCountSnapshot = -1;
}

function oPlaylist(idx, name, count, guid, isAutoPlaylist, isLocked) {
	this.idx = idx;
	this.name = name;
	this.count = count;
	this.guid = guid || '';
	this.isAutoPlaylist = !!isAutoPlaylist;
	this.isLocked = !!isLocked;
}

function get_metrics() {
	if (ppt.showHeaderBar) {
		ppt.headerBarHeight = scale(ppt.defaultHeaderBarHeight);
	} else {
		ppt.headerBarHeight = 0;
	}

	ppt.rowHeight = scale(ppt.defaultRowHeight);
	cScrollBar.width = scale(cScrollBar.defaultWidth);
	cScrollBar.minCursorHeight = scale(cScrollBar.defaultMinCursorHeight);

	brw.setSize();
}

function check_scroll(scroll___) {
	if (scroll___ < 0)
		scroll___ = 0;
	var g1 = brw.h - (brw.totalRowsVis * ppt.rowHeight);
	var end_limit = (brw.rows.length * ppt.rowHeight) - (brw.totalRowsVis * ppt.rowHeight) - g1;

	if (scroll___ != 0 && scroll___ > end_limit) {
		scroll___ = end_limit;
	}

	return scroll___;
}

function renamePlaylist() {
	var text = brw.inputbox.text.trim();

	if (brw.inputboxID > -1 && text.length) {
		plman.RenamePlaylist(brw.inputboxID, text);
		brw.inputboxID = -1;
	}
}

function filterResponse() {
	var next = g_filterbox.inputbox.text.trim();
	if (next == g_filter_text) return;
	g_filter_text = next;
	scroll = 0;
	scroll_ = 0;
	brw.populate();
}


ppt.rememberManagerScrollPosition = window.GetProperty("SMOOTH.PLAYLIST.MANAGER.REMEMBER.SCROLL", true);
ppt.autoShowActivePlaylist = window.GetProperty("SMOOTH.PLAYLIST.MANAGER.AUTO.SHOW.ACTIVE", true);
ppt.showFilterBox = window.GetProperty("SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER", true);
ppt.filterBoxWidth = clamp(Math.round(Number(window.GetProperty("SMOOTH.PLAYLIST.MANAGER.FILTER.WIDTH", 300))) || 300, 120, 600);
ppt.alternatingRowShading = window.GetProperty(
	"SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS",
	true
);
var g_manager_scroll_property = "SMOOTH.PLAYLIST.MANAGER.SCROLL";
var g_manager_scroll_state_property = "SMOOTH.PLAYLIST.MANAGER.SCROLL.STATE.V2";
var g_manager_scroll_restore_done = false;
var g_manager_scroll_save_timer = false;
var g_manager_scroll_last_saved = '';

// Enhanced sample: keep playlist-manager density independent from the stock JSP3 default.
// The value is a logical row height and is still scaled with the active CUI item font/DPI.
ppt.defaultRowHeight = clamp(Math.round(Number(window.GetProperty("SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT", 26))) || 26, 20, 64);
ppt.rowHeight = ppt.defaultRowHeight;
ppt.autoplaylist_sort_pattern = "%album artist% | $if(%album%,%date%,9999) | %album% | %discnumber% | %tracknumber% | %title%";

var autoplaylists = [
	["Media Library", "ALL"],
	["Tracks never played", "%play_count% MISSING"],
	["Tracks played in the last 5 days", "%last_played% DURING LAST 5 DAYS"],
	["Tracks unrated", "%rating% MISSING"],
	["Tracks rated 1", "%rating% IS 1"],
	["Tracks rated 2", "%rating% IS 2"],
	["Tracks rated 3", "%rating% IS 3"],
	["Tracks rated 4", "%rating% IS 4"],
	["Tracks rated 5", "%rating% IS 5"],
];

var cPlaylistManager = {
	drag_clicked: false,
	drag_source_id: -1,
	drag_target_id: -1,
}


function apply_playlist_manager_refresh_rate(value) {
	value = clamp(Math.round(Number(value)) || 8, 8, 40);
	if (ppt.refreshRate == value) return false;

	ppt.refreshRate = value;
	if (typeof g_playlist_manager_cadence_reporter != "undefined" && g_playlist_manager_cadence_reporter)
		g_playlist_manager_cadence_reporter.announce();

	if (g_playlist_manager_frame) {
		g_playlist_manager_frame.reschedule();
		if (Math.abs(scroll - scroll_) >= 1 || need_repaint || cScrollBar.timerID || timers.movePlaylist) {
			g_playlist_manager_frame.request();
		}
	}
	return true;
}

function set_playlist_manager_refresh_rate(value) {
	value = clamp(Math.round(Number(value)) || 8, 8, 40);
	window.SetProperty("SMOOTH.UI.REFRESH.INTERVAL.MS", value);
	return apply_playlist_manager_refresh_rate(value);
}

function playlist_manager_frame_tick() {
	scroll = check_scroll(scroll);
	var targetChanged = scroll_prev != scroll;
	var moving = Math.abs(scroll - scroll_) >= 1;

	if (moving) {
		scroll_ += (scroll - scroll_) / ppt.scrollSmoothness;
		need_repaint = true;
		isScrolling = true;
		if (targetChanged) brw.scrollbar.updateScrollbar();
	} else if (isScrolling) {
		if (scroll_ < 1) scroll_ = 0;
		else scroll_ = scroll;
		isScrolling = false;
		need_repaint = true;
	}

	if (need_repaint) {
		need_repaint = false;
		window.Repaint();
	}

	if (targetChanged) brw.queueSaveScrollPosition();
	scroll_prev = scroll;

	return Math.abs(scroll - scroll_) >= 1 || !!cScrollBar.timerID || !!timers.movePlaylist;
}

var g_playlist_manager_frame = DarkOnePerformance.createFrameLoop(window, {
	getDelay: function () { return ppt.refreshRate; },
	hiddenDelay: 250,
	tick: playlist_manager_frame_tick
});
var g_playlist_manager_profiler = DarkOnePerformance.createProfiler(
	utils,
	window.GetProperty("SMOOTH.Enable Performance Profiling", false),
	"Enhanced Playlist Manager paint",
	120
);
var g_playlist_manager_cadence_reporter = DarkOneUiCadence.createSourceReporter(window, {
	source: DarkOneUiCadence.sources.playlistManager,
	getInterval: function () { return ppt.refreshRate; }
});

var timers = {
	movePlaylist: false,
	repaint: false,
	initialPopulate: false,
};

var g_filter_text = "";
var g_drag_drop_target_id = -1;
var g_filterbox = new oFilterBox();
var brw = new oBrowser();

get_metrics();
setWallpaperImg();

function clearPlaylistManagerTimers() {
	if (g_manager_scroll_save_timer) {
		window.ClearTimeout(g_manager_scroll_save_timer);
		g_manager_scroll_save_timer = false;
	}
	if (g_playlist_manager_frame) g_playlist_manager_frame.stop();
	timers.repaint = false;
	if (timers.initialPopulate) {
		window.ClearTimeout(timers.initialPopulate);
		timers.initialPopulate = false;
	}
	if (timers.movePlaylist) {
		window.ClearInterval(timers.movePlaylist);
		timers.movePlaylist = false;
	}
	if (cScrollBar.timerID) {
		window.ClearInterval(cScrollBar.timerID);
		cScrollBar.timerID = false;
	}
	if (cInputbox.timer_cursor) {
		window.ClearInterval(cInputbox.timer_cursor);
		cInputbox.timer_cursor = false;
		cInputbox.cursor_state = true;
	}
	if (brw && brw.inputbox && brw.inputbox.launch_timer) {
		window.ClearTimeout(brw.inputbox.launch_timer);
		brw.inputbox.launch_timer = false;
	}
	if (g_filterbox && g_filterbox.inputbox &&
		g_filterbox.inputbox.launch_timer) {
		window.ClearTimeout(g_filterbox.inputbox.launch_timer);
		g_filterbox.inputbox.launch_timer = false;
	}
}

function on_script_unload() {
	if (g_playlist_manager_cadence_reporter) g_playlist_manager_cadence_reporter.dispose();
	if (brw) {
		brw.saveScrollPosition(true);
		if (brw.scrollbar) brw.scrollbar.dispose();
	}
	clearPlaylistManagerTimers();
	if (g_filterbox) g_filterbox.dispose();
}
