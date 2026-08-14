function on_char(code) {
	if (cSettings.visible) {
		for (var i = 0; i < p.settings.pages.length; i++) {
			for (var j = 0; j < p.settings.pages[i].elements.length; j++) {
				if (p.settings.pages[i].elements[j].objType == "TB") p.settings.pages[i].elements[j].on_char(code);
			}
		}
	} else if (p.playlistManager.inputboxID >= 0) {
		p.playlistManager.inputbox.on_char(code);
	}
}

function on_colours_changed() {
	get_colours();
	p.topBar.setButtons();
	p.headerBar.setButtons();
	p.scrollbar.setButtons();
	p.scrollbar.setCursorButton();
	p.playlistManager.setButtons();
	p.settings.setButtons();
	resize_panels();
	window.Repaint();
}

function on_drag_drop(action, x, y, mask) {
	if (y < p.list.y) {
		action.Effect = 0;
	} else if (cPlaylistManager.visible && p.playlistManager.isHoverObject(x, y)) {
		if (g_drag_drop_playlist_id == -1) {
			if (p.playlistManager.ishoverHeader) {
				if (g_drag_drop_internal) {
					var pl = plman.CreatePlaylist(plman.PlaylistCount, "Dropped Items")
					var selectedItems = plman.GetPlaylistSelectedItems(g_active_playlist);
					try {
						plman.InsertPlaylistItems(pl, 0, selectedItems, true);
					} finally {
						DarkOnePerformance.dispose(selectedItems);
					}
					plman.ActivePlaylist = pl;
					action.Effect = 0;
				} else {
					action.Playlist = plman.CreatePlaylist(plman.PlaylistCount, "Dropped Items");
					action.Base = 0;
					action.ToSelect = true;
					action.Effect = 1;
				}
			} else {
				action.Effect = 0;
			}
		} else if (playlist_can_add_items(g_drag_drop_playlist_id)) {
			var base = plman.GetPlaylistItemCount(g_drag_drop_playlist_id);

			if (g_drag_drop_internal) {
				if (g_drag_drop_playlist_id != g_active_playlist) {
					plman.UndoBackup(g_drag_drop_playlist_id);
					plman.InsertPlaylistItems(g_drag_drop_playlist_id, base, plman.GetPlaylistSelectedItems(g_active_playlist));
				}
				action.Effect = 0;
			} else {
				plman.UndoBackup(g_drag_drop_playlist_id);
				action.Playlist = g_drag_drop_playlist_id;
				action.Base = base;
				action.ToSelect = false;
				action.Effect = 1;
			}
		} else {
			action.Effect = 0;
		}
	} else {
		var new_pos = g_drag_drop_bottom ? plman.GetPlaylistItemCount(g_active_playlist) : g_drag_drop_track_id;

		if (g_drag_drop_internal) {
			if (playlist_can_reorder(g_active_playlist)) {
				plman.UndoBackup(g_active_playlist);
				plman.MovePlaylistSelectionV2(g_active_playlist, new_pos);
			}
			action.Effect = 0;
		} else if (playlist_can_add_items(g_active_playlist)) {
			plman.ClearPlaylistSelection(g_active_playlist);
			plman.UndoBackup(g_active_playlist);
			action.Playlist = g_active_playlist;
			action.Base = new_pos;
			action.ToSelect = true;
			action.Effect = 1;
		} else {
			action.Effect = 0;
		}
	}

	g_drag_drop_playlist_manager_hover = false;
	g_drag_drop_playlist_id = -1;
	g_drag_drop_track_id = -1;
	g_drag_drop_row_id = -1;
	g_drag_drop_bottom = false;
	g_drag_drop_internal = false;
	full_repaint();
}

function on_drag_enter() {
	g_drag_drop_status = true;
}

function on_drag_leave() {
	g_drag_drop_status = false;
	g_drag_drop_playlist_manager_hover = false;
	g_drag_drop_track_id = -1;
	g_drag_drop_row_id = -1;
	g_drag_drop_playlist_id = -1;
	p.list.buttonclicked = false;

	if (cScrollBar.interval) {
		window.ClearInterval(cScrollBar.interval);
		cScrollBar.interval = false;
	}

	window.Repaint();
}

function on_drag_over(action, x, y, mask) {
	g_drag_drop_playlist_manager_hover = false;
	g_drag_drop_track_id = -1;
	g_drag_drop_row_id = -1;
	g_drag_drop_bottom = false;

	if (y < p.list.y) {
		action.Effect = 0;
	} else if (cPlaylistManager.visible && p.playlistManager.isHoverObject(x, y)) {
		g_drag_drop_playlist_manager_hover = true;
		p.playlistManager.check("drag_over", x, y);
		if (g_drag_drop_playlist_id == -1) {
			action.Effect = p.playlistManager.ishoverHeader ? 1 : 0;
		} else if (g_drag_drop_internal) {
			action.Effect = g_drag_drop_playlist_id == g_active_playlist ? 0 : 1;
		} else if (playlist_can_add_items(g_drag_drop_playlist_id)) {
			action.Effect = 1;
		} else {
			action.Effect = 0;
		}
	} else if (g_drag_drop_internal && !playlist_can_reorder(g_active_playlist)) {
		action.Effect = 0;
	} else if (g_drag_drop_internal || playlist_can_add_items(g_active_playlist)) {
		p.list.check("drag_over", x, y);
		if (y > p.list.y && y < p.list.y + 40) {
			on_mouse_wheel(1, true);
		} else if (y > p.list.y + p.list.h - 40 && y < p.list.y + p.list.h) {
			on_mouse_wheel(-1, true);
		}
		action.Effect = 1;
	} else {
		action.Effect = 0;
	}
	full_repaint();
}

function on_focus(is_focused) {
	if (p.playlistManager.inputboxID >= 0) {
		p.playlistManager.inputbox.on_focus(is_focused);
	}
	if (is_focused) {
		plman.SetActivePlaylistContext();
		window.SetPlaylistSelectionTracking();
	} else {
		p.playlistManager.inputboxID = -1;
		full_repaint();
	}
}

function on_font_changed() {
	get_font();
	p.topBar.setButtons();
	p.headerBar.setButtons();
	p.scrollbar.setButtons();
	p.scrollbar.setCursorButton();
	p.playlistManager.setButtons();
	p.settings.setButtons();
	resize_panels();
	window.Repaint();
}

function on_get_album_art_done(metadb, art_id, image) {
	if (!image)
		return;

	var consumed = false;
	for (var i = 0; i < p.list.groups.length; i++) {
		var group = p.list.groups[i];
		if (group.metadb && group.metadb.Compare(metadb)) {
			consumed = g_image_cache.set(group.group_key, image);
			break;
		}
	}
	if (!consumed) DarkOnePerformance.dispose(image);
}

function on_item_focus_change(playlist, from, to) {
	if (playlist != g_active_playlist) return;

	p.list.focusedTrackId = to;
	var center_focus_item = p.list.isFocusedItemVisible();
	var rebuilt = false;
	if ((!center_focus_item && !p.list.drawRectSel) || (center_focus_item && to == 0)) {
		p.list.setItems(true);
		rebuilt = true;
	}
	p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);

	if (rebuilt) {
		full_repaint();
	} else {
		p.list.repaintTrack(from);
		p.list.repaintTrack(to);
	}
}

function on_key_down(vkey) {
	if (cSettings.visible) {
		g_textbox_tabbed = false;
		var elements = p.settings.pages[p.settings.currentPageId].elements;
		for (var j = 0; j < elements.length; j++) {
			if (typeof elements[j].on_key_down == "function") elements[j].on_key_down(vkey);
		}
	} else {
		if (p.playlistManager.inputboxID >= 0) {
			switch (vkey) {
			case VK_ESCAPE:
			case 222:
				p.playlistManager.inputboxID = -1;
				full_repaint();
				break;
			default:
				p.playlistManager.inputbox.on_key_down(vkey);
			}
		} else {
			var mask = GetKeyboardMask();
			if (mask == KMask.none) {
				switch (vkey) {
				case VK_F2:
					// rename playlist (playlist manager panel visible)
					if (cPlaylistManager.visible && playlist_can_rename(g_active_playlist)) {
						p.playlistManager.inputbox = new oInputbox(p.playlistManager.w - p.playlistManager.border - p.playlistManager.scrollbarWidth - scale(40), cPlaylistManager.rowHeight - 10, plman.GetPlaylistName(g_active_playlist), "", "renamePlaylist()");
						p.playlistManager.inputboxID = g_active_playlist;
						// activate box content + selection activated
						if (cPlaylistManager.inputbox_timeout) window.ClearTimeout(cPlaylistManager.inputbox_timeout);
						cPlaylistManager.inputbox_timeout = window.SetTimeout(inputboxPlaylistManager_activate, 20);
					}
					break;
				case VK_F5:
					p.list.groups.forEach(function (item) {
						item.cover_img = null;
					});
					g_image_cache.reset();
					DarkOnePerformance.dispose(g_stub_image);
					var refreshedStub = fb.GetAlbumArtStub(cGroup.art_id);
					g_stub_image = DarkOnePerformance.toBitmap(refreshedStub, true);
					full_repaint();
					break;
				case VK_TAB:
					togglePlaylistManager();
					break;
				case VK_UP:
					var scrollstep = 1;
					var new_focus_id = 0;
					if (p.list.count > 0 && !p.list.keypressed && !cScrollBar.timeout) {
						p.list.keypressed = true;
						new_focus_id = (p.list.focusedTrackId > 0) ? p.list.focusedTrackId - scrollstep : 0;
						var grpId = p.list.getGroupIdfromTrackId(new_focus_id);

						if (p.list.focusedTrackId == 0 && p.list.offset > 0) {
							p.list.scrollItems(1, scrollstep);
							cScrollBar.timeout = window.SetTimeout(function () {
								cScrollBar.timeout = false;
								p.list.scrollItems(1, scrollstep);
								if (cScrollBar.interval) window.ClearInterval(cScrollBar.interval);
								cScrollBar.interval = window.SetInterval(function () {
									p.list.scrollItems(1, scrollstep);
								}, 50);
							}, 400);
						} else {
							plman.SetPlaylistFocusItem(g_active_playlist, new_focus_id);
							plman.ClearPlaylistSelection(g_active_playlist);
							plman.SetPlaylistSelectionSingle(g_active_playlist, new_focus_id, true);
							cScrollBar.timeout = window.SetTimeout(function () {
								cScrollBar.timeout = false;
								if (cScrollBar.interval) window.ClearInterval(cScrollBar.interval);
								cScrollBar.interval = window.SetInterval(function () {
									new_focus_id = (p.list.focusedTrackId > 0) ? p.list.focusedTrackId - scrollstep : 0;
									var grpId = p.list.getGroupIdfromTrackId(new_focus_id);
									plman.SetPlaylistFocusItem(g_active_playlist, new_focus_id);
									plman.ClearPlaylistSelection(g_active_playlist);
									plman.SetPlaylistSelectionSingle(g_active_playlist, new_focus_id, true);
								}, 50);
							}, 400);
						}
					}
					break;
				case VK_DOWN:
					if (p.list.count > 0 && !p.list.keypressed && !cScrollBar.timeout) {
						p.list.keypressed = true;
						var new_focus_id = (p.list.focusedTrackId < p.list.count - 1) ? p.list.focusedTrackId + 1 : p.list.count - 1;

						plman.SetPlaylistFocusItem(g_active_playlist, new_focus_id);
						plman.ClearPlaylistSelection(g_active_playlist);
						plman.SetPlaylistSelectionSingle(g_active_playlist, new_focus_id, true);
						cScrollBar.timeout = window.SetTimeout(function () {
							cScrollBar.timeout = false;
							if (cScrollBar.interval) window.ClearInterval(cScrollBar.interval);
							cScrollBar.interval = window.SetInterval(function () {
								new_focus_id = (p.list.focusedTrackId < p.list.count - 1) ? p.list.focusedTrackId + 1 : p.list.count - 1;
								var grpId = p.list.getGroupIdfromTrackId(new_focus_id);
								plman.SetPlaylistFocusItem(g_active_playlist, new_focus_id);
								plman.ClearPlaylistSelection(g_active_playlist);
								plman.SetPlaylistSelectionSingle(g_active_playlist, new_focus_id, true);
							}, 50);
						}, 400);
					}
					break;
				case VK_RETURN:
					plman.ExecutePlaylistDefaultAction(g_active_playlist, p.list.focusedTrackId);
					break;
				case VK_END:
					if (p.list.count > 0) {
						plman.SetPlaylistFocusItem(g_active_playlist, p.list.count - 1);
						plman.ClearPlaylistSelection(g_active_playlist);
						plman.SetPlaylistSelectionSingle(g_active_playlist, p.list.count - 1, true);
					}
					break;
				case VK_HOME:
					if (p.list.count > 0) {
						plman.SetPlaylistFocusItem(g_active_playlist, 0);
						plman.ClearPlaylistSelection(g_active_playlist);
						plman.SetPlaylistSelectionSingle(g_active_playlist, 0, true);
					}
					break;
				case VK_DELETE:
					if (playlist_can_remove_items(g_active_playlist)) {
						plman.UndoBackup(g_active_playlist);
						plman.RemovePlaylistSelection(g_active_playlist);
					}
					break;
				}
			} else {
				switch (mask) {
				case KMask.shift:
					switch (vkey) {
					case VK_SHIFT: // SHIFT key alone
						p.list.SHIFT_count = 0;
						break;
					case VK_UP: // SHIFT + KEY UP
						if (p.list.SHIFT_count == 0) {
							if (p.list.SHIFT_start_id == null) {
								p.list.SHIFT_start_id = p.list.focusedTrackId;
							}
							plman.ClearPlaylistSelection(g_active_playlist);
							plman.SetPlaylistSelectionSingle(g_active_playlist, p.list.focusedTrackId, true);
							if (p.list.focusedTrackId > 0) {
								p.list.SHIFT_count--;
								p.list.focusedTrackId--;
								plman.SetPlaylistSelectionSingle(g_active_playlist, p.list.focusedTrackId, true);
								plman.SetPlaylistFocusItem(g_active_playlist, p.list.focusedTrackId);
							}
						} else if (p.list.SHIFT_count < 0) {
							if (p.list.focusedTrackId > 0) {
								p.list.SHIFT_count--;
								p.list.focusedTrackId--;
								plman.SetPlaylistSelectionSingle(g_active_playlist, p.list.focusedTrackId, true);
								plman.SetPlaylistFocusItem(g_active_playlist, p.list.focusedTrackId);
							}
						} else {
							plman.SetPlaylistSelectionSingle(g_active_playlist, p.list.focusedTrackId, false);
							p.list.SHIFT_count--;
							p.list.focusedTrackId--;
							plman.SetPlaylistFocusItem(g_active_playlist, p.list.focusedTrackId);
						}
						break;
					case VK_DOWN: // SHIFT + KEY DOWN
						if (p.list.SHIFT_count == 0) {
							if (p.list.SHIFT_start_id == null) {
								p.list.SHIFT_start_id = p.list.focusedTrackId;
							}
							plman.ClearPlaylistSelection(g_active_playlist);
							plman.SetPlaylistSelectionSingle(g_active_playlist, p.list.focusedTrackId, true);
							if (p.list.focusedTrackId < p.list.count - 1) {
								p.list.SHIFT_count++;
								p.list.focusedTrackId++;
								plman.SetPlaylistSelectionSingle(g_active_playlist, p.list.focusedTrackId, true);
								plman.SetPlaylistFocusItem(g_active_playlist, p.list.focusedTrackId);
							}
						} else if (p.list.SHIFT_count > 0) {
							if (p.list.focusedTrackId < p.list.count - 1) {
								p.list.SHIFT_count++;
								p.list.focusedTrackId++;
								plman.SetPlaylistSelectionSingle(g_active_playlist, p.list.focusedTrackId, true);
								plman.SetPlaylistFocusItem(g_active_playlist, p.list.focusedTrackId);
							}
						} else {
							plman.SetPlaylistSelectionSingle(g_active_playlist, p.list.focusedTrackId, false);
							p.list.SHIFT_count++;
							p.list.focusedTrackId++;
							plman.SetPlaylistFocusItem(g_active_playlist, p.list.focusedTrackId);
						}
						break;
					}
					break;
				case KMask.ctrl:
					if (vkey == 65) { // CTRL+A
						fb.RunMainMenuCommand("Edit/Select all");
						full_repaint();
					}
					if (vkey == 88) { // CTRL+X
						if (playlist_can_remove_items(g_active_playlist)) {
							var items = plman.GetPlaylistSelectedItems(g_active_playlist);
							if (items.CopyToClipboard()) {
								plman.UndoBackup(g_active_playlist);
								plman.RemovePlaylistSelection(g_active_playlist);
							}
							items.Dispose();
						}
					}
					if (vkey == 67) { // CTRL+C
						var items = plman.GetPlaylistSelectedItems(g_active_playlist);
						items.CopyToClipboard();
						items.Dispose();
					}
					if (vkey == 86) { // CTRL+V
						if (playlist_can_add_items(g_active_playlist) && fb.CheckClipboardContents()) {
							var clipboard_contents = fb.GetClipboardContents();
							plman.UndoBackup(g_active_playlist);
							plman.InsertPlaylistItems(g_active_playlist, p.list.focusedTrackId + 1, clipboard_contents);
							clipboard_contents.Dispose();
						}
					}
					if (vkey == 73) { // CTRL+I
						cTopBar.visible = !cTopBar.visible;
						window.SetProperty("JSPLAYLIST.TopBar.Visible", cTopBar.visible);
						resize_panels();
						full_repaint();
					}
					if (vkey == 84) { // CTRL+T
						// Toggle Toolbar
						if (!p.on_key_timeout) {
							cHeaderBar.locked = !cHeaderBar.locked;
							window.SetProperty("JSPLAYLIST.HEADERBAR2.Locked", cHeaderBar.locked);
							if (!cHeaderBar.locked) {
								p.headerBar.visible = false;
							}
							resize_panels();
							full_repaint();
							p.on_key_timeout = window.SetTimeout(function () {
								p.on_key_timeout = false;
							}, 300);
						}
					}
					if (vkey == 89) { // CTRL+Y
						fb.RunMainMenuCommand("Edit/Redo");
					}
					if (vkey == 90) { // CTRL+Z
						fb.RunMainMenuCommand("Edit/Undo");
					}
					break;
				}
			}
		}
	}
}

function on_key_up(vkey) {
	if (!cSettings.visible) {
		p.list.keypressed = false;
		if (cScrollBar.timeout) {
			window.ClearTimeout(cScrollBar.timeout);
			cScrollBar.timeout = false;
		}
		if (cScrollBar.interval) {
			window.ClearInterval(cScrollBar.interval);
			cScrollBar.interval = false;
		}
		if (vkey == VK_SHIFT) {
			p.list.SHIFT_start_id = null;
			p.list.SHIFT_count = 0;
		}
	}
}

function on_mouse_lbtn_dblclk(x, y, mask) {
	g_double_clicked = true;

	if (cSettings.visible) {
		p.settings.on_mouse("lbtn_dblclk", x, y);
	} else {
		p.list.check("lbtn_dblclk", x, y);

		if (p.headerBar.visible)
			p.headerBar.on_mouse("lbtn_dblclk", x, y);

		if (cPlaylistManager.visible) {
			p.playlistManager.check("lbtn_dblclk", x, y);
		} else {
			if (properties.showscrollbar && p.scrollbar && p.list.totalRows > 0 && (p.list.totalRows > p.list.totalRowVisible)) {
				p.scrollbar.check("lbtn_dblclk", x, y);
				if (p.scrollbar.hover) {
					on_mouse_lbtn_down(x, y);
				}
			}
		}
	}
}

function on_mouse_lbtn_down(x, y) {
	if (cSettings.visible) {
		p.settings.on_mouse("lbtn_down", x, y);
	} else {
		p.list.check("lbtn_down", x, y);

		if (!cPlaylistManager.visible) {
			if (p.playlistManager.woffset == 0 && properties.showscrollbar && p.scrollbar && p.list.totalRows > 0 && (p.list.totalRows > p.list.totalRowVisible)) {
				p.scrollbar.check("lbtn_down", x, y);
			}

			if (p.scrollbar.hover && !p.scrollbar.cursorDrag) {
				var scrollstep = p.list.totalRowVisible;
				if (y < p.scrollbar.cursorPos) {
					if (!p.list.buttonclicked && !cScrollBar.timeout) {
						p.list.buttonclicked = true;
						p.list.scrollItems(1, scrollstep);
						cScrollBar.timeout = window.SetTimeout(function () {
							cScrollBar.timeout = false;
							p.list.scrollItems(1, scrollstep);
							if (cScrollBar.interval) window.ClearInterval(cScrollBar.interval);
							cScrollBar.interval = window.SetInterval(function () {
								if (p.scrollbar.hover) {
									if (mouse_x > p.scrollbar.x && p.scrollbar.cursorPos > mouse_y) {
										p.list.scrollItems(1, scrollstep);
									}
								}
							}, 60);
						}, 400);
					}
				} else {
					if (!p.list.buttonclicked && !cScrollBar.timeout) {
						p.list.buttonclicked = true;
						p.list.scrollItems(-1, scrollstep);
						cScrollBar.timeout = window.SetTimeout(function () {
							cScrollBar.timeout = false;
							p.list.scrollItems(-1, scrollstep);
							if (cScrollBar.interval) window.ClearInterval(cScrollBar.interval);
							cScrollBar.interval = window.SetInterval(function () {
								if (p.scrollbar.hover) {
									if (mouse_x > p.scrollbar.x && p.scrollbar.cursorPos + p.scrollbar.cursorHeight < mouse_y) {
										p.list.scrollItems(-1, scrollstep);
									}
								}
							}, 60);
						}, 400)
					}
				}
			}
		} else {
			p.playlistManager.check("lbtn_down", x, y);
		}

		if (cTopBar.visible) {
			p.topBar.buttonCheck("lbtn_down", x, y);
		}

		if (p.headerBar.visible) {
			p.headerBar.on_mouse("lbtn_down", x, y);
		}
	}
}

function on_mouse_lbtn_up(x, y) {
	if (cSettings.visible) {
		p.settings.on_mouse("lbtn_up", x, y);
	} else {
		p.list.buttonclicked = false;
		if (cScrollBar.timeout) {
			window.ClearTimeout(cScrollBar.timeout);
			cScrollBar.timeout = false;
		}
		if (cScrollBar.interval) {
			window.ClearInterval(cScrollBar.interval);
			cScrollBar.interval = false;
		}

		p.list.check("lbtn_up", x, y);

		if (p.playlistManager.woffset > 0 || cPlaylistManager.visible) {
			p.playlistManager.check("lbtn_up", x, y);
		}

		if (properties.showscrollbar && p.scrollbar && p.list.totalRows > 0 && (p.list.totalRows > p.list.totalRowVisible)) {
			p.scrollbar.check("lbtn_up", x, y);
		}

		if (cTopBar.visible) {
			p.topBar.buttonCheck("lbtn_up", x, y);
		}

		if (p.headerBar.visible) {
			p.headerBar.on_mouse("lbtn_up", x, y);
		}

		full_repaint();
	}
}

function on_mouse_mbtn_down(x, y, mask) {
	g_middle_clicked = true;
	togglePlaylistManager();
}

function on_mouse_mbtn_up(x, y, mask) {
	if (g_middle_click_timeout) window.ClearTimeout(g_middle_click_timeout);
	g_middle_click_timeout = window.SetTimeout(function () {
		g_middle_click_timeout = false;
		g_middle_clicked = false;
	}, 250);
}

function on_mouse_move(x, y) {
	if (x == mouse_x && y == mouse_y)
		return;

	if (cSettings.visible) {
		p.settings.on_mouse("move", x, y);
	} else {
		if (p.playlistManager.woffset > 0) {
			if (!cPlaylistManager.blink_interval) {
				p.playlistManager.check("move", x, y);
			}
		}

		p.list.check("move", x, y);

		if (!cPlaylistManager.visible) {
			if (properties.showscrollbar && p.scrollbar && p.list.totalRows > 0 && (p.list.totalRows > p.list.totalRowVisible)) {
				p.scrollbar.check("move", x, y);
			}
		}

		if (p.headerBar.visible) {
			p.headerBar.on_mouse("move", x, y);
		}

		if (cPlaylistManager.drag_moved) {
			if (p.playlistManager.ishoverItem) {
				window.SetCursor(IDC_HELP);
			} else {
				window.SetCursor(IDC_NO);
			}
		}
	}

	mouse_x = x;
	mouse_y = y;
}

function on_mouse_rbtn_up(x, y) {
	if (cSettings.visible) {
		p.settings.on_mouse("rbtn_up", x, y);
	} else {
		if (x >= ww - p.scrollbar.w)
			return false;

		if (p.headerBar.visible)
			p.headerBar.on_mouse("rbtn_up", x, y);

		p.playlistManager.check("rbtn_up", x, y);
		p.list.check("rbtn_up", x, y);
	}

	return true;
}

function on_mouse_wheel(delta, force_row_snap) {
	if (g_middle_clicked)
		return;

	if (cSettings.visible) {
		p.settings.on_mouse("wheel", mouse_x, mouse_y, delta);
		if (cSettings.wheel_timeout) window.ClearTimeout(cSettings.wheel_timeout);
		cSettings.wheel_timeout = window.SetTimeout(function () {
			cSettings.wheel_timeout = false;
			on_mouse_move(mouse_x + 1, mouse_y + 1);
		}, 50);
	}

	if (p.list.ishover || cScrollBar.timeout) {
		if (!g_mouse_wheel_timeout) {
			var wheel_scroll = function () {
				p.list.scrollItems(delta, cList.scrollstep, !force_row_snap);
			};

			if (cList.wheel_throttle === 0) {
				wheel_scroll();
			} else {
				g_mouse_wheel_timeout = window.SetTimeout(function () {
					g_mouse_wheel_timeout = false;
					wheel_scroll();
				}, cList.wheel_throttle);
			}
		}
	} else {
		p.playlistManager.check("wheel", mouse_x, mouse_y, delta);
	}
}

function on_paint(gr) {
	if (g_playlist_profiler) g_playlist_profiler.begin();
	if (cSettings.visible) {
		p.settings && p.settings.draw(gr);
	} else {
		gr.Clear(g_colour_background);
		if (fb.IsPlaying && properties.showwallpaper && images.wallpaper) {
			DrawWallpaper(gr);
		}

		if (p.list) {
			if (p.list.count == 0) {
				if (plman.PlaylistCount > 0) {
					var text_top = plman.GetPlaylistName(g_active_playlist);
					var text_bot = "This playlist is empty";
				} else {
					var text_top = "JSPlaylist coded by Br3tt";
					var text_bot = "Create a playlist to start!";
				}
				var y = Math.floor(wh / 2);
				gr.WriteTextSimple(text_top, g_font_20_bold, g_colour_text, 0, y - g_z5 - height(g_font_20_bold), ww, height(g_font_20_bold), 2, 1, 1);
				gr.FillRectangle(40, Math.floor(wh / 2), ww - 80, 1, g_colour_text & 0x40ffffff);
				gr.WriteTextSimple(text_bot, g_font_12_bold, blendColours(g_colour_text, g_colour_background, 0.35), 0, y + g_z5, ww, height(g_font_12_bold), 2, 0, 1);
			} else {
				p.headerBar.calculateColumns();

				if (properties.showscrollbar && p.scrollbar && p.list.totalRows > 0 && (p.list.totalRows > p.list.totalRowVisible)) {
					p.scrollbar.visible = true;
					p.scrollbar.draw(gr);
				} else {
					p.scrollbar.visible = false;
				}

				p.list.draw(gr);
			}
		}

		// draw background part above playlist (topbar + headerbar)
		if (cTopBar.visible || p.headerBar.visible) {
			gr.FillRectangle(0, 0, ww, p.list.y, g_colour_background);
		}

		// TopBar
		if (cTopBar.visible) {
			p.topBar && p.topBar.draw(gr);
		}

		// HeaderBar
		if (p.headerBar.visible) {
			p.headerBar && p.headerBar.drawColumns(gr);
			if (p.headerBar.borderDragged && p.headerBar.borderDraggedId >= 0) {
				// all borders
				for (var b = 0; b < p.headerBar.borders.length; b++) {
					var lg_x = p.headerBar.borders[b].x - 2;
					var lg_w = p.headerBar.borders[b].w;
					var segment_h = 5;
					var gap_h = 5;
					if (b == p.headerBar.borderDraggedId) {
						var d = ((mouse_x / 10) - Math.floor(mouse_x / 10)) * 10; // give a value between [0;9]
					} else {
						d = 5;
					}
					var ty = 0;
					for (var lg_y = p.list.y; lg_y < p.list.y + p.list.h + segment_h; lg_y += segment_h + gap_h) {
						ty = lg_y - segment_h + d;
						th = segment_h;
						if (ty < p.list.y) {
							th = th - Math.abs(p.list.y - ty);
							ty = p.list.y;
						}
						if (b == p.headerBar.borderDraggedId) {
							gr.FillRectangle(lg_x, ty, lg_w, th, g_colour_text & 0x32ffffff);
						} else {
							gr.FillRectangle(lg_x, ty, lg_w, th, g_colour_text & 0x16ffffff);
						}
					}
				}
			}
		} else {
			p.headerBar && p.headerBar.drawHiddenPanel(gr);
		}

		p.playlistManager && p.playlistManager.draw(gr);
	}
	if (g_playlist_profiler) {
		var stats = g_playlist_render_cache ? g_playlist_render_cache.stats() : null;
		g_playlist_profiler.end(stats ? ("cache " + stats.hits + "/" + stats.misses) : "");
	}
}

function update_playlist_playback_state() {
	var previous = g_cached_playing_index;
	var isPlaying = !!fb.IsPlaying;
	var location = null;
	if (isPlaying) {
		try { location = plman.GetPlayingItemLocation(); } catch (e) {}
	}

	g_playlist_paint_state.isPlaying = isPlaying;
	g_playlist_paint_state.isPaused = isPlaying && !!fb.IsPaused;
	g_playlist_paint_state.playingPlaylist = location ? location.PlaylistIndex : -1;
	g_playlist_paint_state.playingItem = location ? location.PlaylistItemIndex : -1;
	g_cached_playing_index = g_playlist_paint_state.playingPlaylist == g_active_playlist
		? g_playlist_paint_state.playingItem
		: -1;
	return previous;
}

function get_active_playing_track_index() {
	return g_cached_playing_index;
}

function refresh_playing_render_cache() {
	var previous = update_playlist_playback_state();
	if (g_playlist_render_cache) {
		if (previous >= 0) g_playlist_render_cache.invalidate(previous);
		if (g_cached_playing_index >= 0) g_playlist_render_cache.invalidate(g_cached_playing_index);
	}
}

function invalidate_current_render_cache() {
	if (g_playlist_render_cache && g_cached_playing_index >= 0)
		g_playlist_render_cache.invalidate(g_cached_playing_index);
}

function bump_playlist_dynamic_generation() {
	g_playlist_dynamic_generation = (g_playlist_dynamic_generation + 1) % 2147483647;
}

function repaint_current_playlist_row() {
	var index = g_cached_playing_index;
	if (index < 0 || !p.list) return;
	if (p.list.nowplaying_y + cRow.playlist_h > p.list.y && p.list.nowplaying_y < p.list.y + p.list.h) {
		window.RepaintRect(p.list.x, p.list.nowplaying_y, p.list.w, cRow.playlist_h);
	}
}

function on_metadb_changed(handle_list, fromhook) {
	if (g_playlist_render_cache) {
		g_playlist_render_cache.invalidateHandles(handle_list, p.list ? p.list.handleList : null);
	}
	full_repaint();
}

function on_playback_dynamic_info() {
	bump_playlist_dynamic_generation();
	invalidate_current_render_cache();
	repaint_current_playlist_row();
}

function on_playback_dynamic_info_track(type) {
	bump_playlist_dynamic_generation();
	// Stream metadata can change title-format output without a normal metadata
	// callback. Album-art updates also affect the wallpaper/dynamic palette.
	invalidate_current_render_cache();
	if (type == 1) {
		update_wallpaper();

		if (properties.enableDynamicColours) {
			on_colours_changed();
		}

		full_repaint();
	} else {
		repaint_current_playlist_row();
	}
}

function on_playback_new_track() {
	bump_playlist_dynamic_generation();
	refresh_playing_render_cache();
	update_wallpaper();

	if (properties.enableDynamicColours) {
		on_colours_changed();
	}

	full_repaint();
}

function on_playback_pause(state) {
	bump_playlist_dynamic_generation();
	g_playlist_paint_state.isPlaying = true;
	g_playlist_paint_state.isPaused = !!state;
	repaint_current_playlist_row();
}

function on_playback_queue_changed() {
	if (g_playlist_render_cache) g_playlist_render_cache.invalidateAll();
	full_repaint();
}

function on_playback_stop(reason) {
	bump_playlist_dynamic_generation();
	refresh_playing_render_cache();
	if (reason != 2) {
		update_wallpaper();

		if (properties.enableDynamicColours) {
			on_colours_changed();
		}

		full_repaint();
	}
}

function on_playback_time(time) {
	g_double_clicked = false;
	g_seconds = time;
	bump_playlist_dynamic_generation();

	if (!cSettings.visible) repaint_current_playlist_row();
}

function on_playback_seek(time) {
	g_seconds = time;
	bump_playlist_dynamic_generation();
	repaint_current_playlist_row();
}

function on_playlist_item_ensure_visible(playlist, index) {
	if (g_double_clicked)
		return;

	on_item_focus_change(playlist, 0, index);
}

function on_playlist_items_added(playlistIndex) {
	update_playlist_playback_state();
	if (playlistIndex == g_active_playlist) {
		update_playlist();
		p.topBar.setDatas();
		p.headerBar.resetSortIndicators();
		full_repaint();
	}
}

function on_playlist_items_changed(playlistIndex) {
	update_playlist_playback_state();
	if (playlistIndex == g_active_playlist) {
		// Metadata-only changes such as an inline rating update must refresh the
		// row data without recentering the viewport on the previously focused
		// playlist item.
		update_playlist(true);
		p.topBar.setDatas();
		p.headerBar.resetSortIndicators();
		full_repaint();
	}
}

function on_playlist_items_removed(playlistIndex, new_count) {
	update_playlist_playback_state();
	if (playlistIndex == g_active_playlist) {
		update_playlist();
		p.topBar.setDatas();
		p.headerBar.resetSortIndicators();
		full_repaint();
	}
}

function on_playlist_items_reordered(playlistIndex) {
	update_playlist_playback_state();
	if (playlistIndex == g_active_playlist && p.headerBar.columnDragged == 0) {
		update_playlist();
		p.headerBar.resetSortIndicators();
		full_repaint();
	} else {
		p.headerBar.columnDragged = 0;
	}
}

function on_playlist_items_replaced(playlistIndex) {
	update_playlist_playback_state();
	if (playlistIndex == g_active_playlist) {
		update_playlist();
		p.topBar.setDatas();
		p.headerBar.resetSortIndicators();
		full_repaint();
	}
}

function on_playlist_items_selection_change() {
	if (p.list) p.list.refreshSelectionCache();
	full_repaint();
}

function on_playlist_switch() {
	g_active_playlist = plman.ActivePlaylist
	update_playlist_playback_state();
	update_playlist();
	p.topBar.setDatas();
	p.headerBar.resetSortIndicators();
	full_repaint();
}

function on_playlists_changed() {
	g_active_playlist = plman.ActivePlaylist;
	update_playlist_playback_state();
	if (g_playlist_render_cache) g_playlist_render_cache.invalidateAll();

	p.topBar.setDatas();

	if (cPlaylistManager.visible && cPlaylistManager.drag_dropped) {
		window.SetCursor(IDC_ARROW);
	}

	p.playlistManager.refresh();
	full_repaint();
}

function on_script_unload() {
	if (g_js_playlist_cadence_reporter) g_js_playlist_cadence_reporter.dispose();

	function clearTimer(id) {
		if (id) {
			try { window.ClearTimeout(id); } catch (e) {}
			try { window.ClearInterval(id); } catch (e) {}
		}
		return false;
	}

	function clearObjectTimers(obj, names) {
		if (!obj)
			return;

		for (var i = 0; i < names.length; i++) {
			if (obj[names[i]])
				obj[names[i]] = clearTimer(obj[names[i]]);
		}
	}

	if (g_repaint_scheduler) {
		g_repaint_scheduler.cancel();
		g_repaint_scheduler = null;
	}
	if (g_playlist_scroll_frame) {
		g_playlist_scroll_frame.stop();
		g_playlist_scroll_frame = null;
	}
	if (g_playlist_scrollbar_drag_frame) {
		g_playlist_scrollbar_drag_frame.stop();
		g_playlist_scrollbar_drag_frame = null;
	}
	g_mouse_wheel_timeout = clearTimer(g_mouse_wheel_timeout);
	g_middle_click_timeout = clearTimer(g_middle_click_timeout);
	clearObjectTimers(typeof p == "object" ? p : null, ["on_key_timeout"]);
	clearObjectTimers(typeof cInputbox == "object" ? cInputbox : null, ["cursor_interval"]);
	clearObjectTimers(typeof cScrollBar == "object" ? cScrollBar : null, ["interval", "timeout", "timerID", "repaint_timeout"]);
	clearObjectTimers(typeof cPlaylistManager == "object" ? cPlaylistManager : null, ["hscroll_interval", "blink_interval", "init_timeout", "inputbox_timeout"]);
	clearObjectTimers(typeof cHeaderBar == "object" ? cHeaderBar : null, ["timerAutoHide"]);
	clearObjectTimers(typeof cSettings == "object" ? cSettings : null, ["wheel_timeout"]);
	clearObjectTimers(typeof cList == "object" ? cList : null, ["interval"]);

	try {
		var uiResources = [];
		if (p.topBar && p.topBar.button && p.topBar.button.img) uiResources = uiResources.concat(p.topBar.button.img);
		if (p.headerBar) uiResources = uiResources.concat([p.headerBar.slide_close, p.headerBar.slide_open]);
		if (p.scrollbar) uiResources = uiResources.concat([p.scrollbar.cursorImage_normal, p.scrollbar.upImage_normal, p.scrollbar.downImage_normal]);
		if (p.playlistManager) {
			uiResources = uiResources.concat([p.playlistManager.bt_sortAz_normal, p.playlistManager.bt_sortZa_normal]);
			if (p.playlistManager.scrollbar) {
				uiResources = uiResources.concat([
					p.playlistManager.scrollbar.cursorImage_normal,
					p.playlistManager.scrollbar.upImage_normal,
					p.playlistManager.scrollbar.downImage_normal
				]);
			}
		}
		if (p.settings) {
			var settingsButtons = [p.settings.newbutton, p.settings.delbutton, p.settings.newbuttonPattern, p.settings.delbuttonPattern, p.settings.closebutton];
			for (var sb = 0; sb < settingsButtons.length; sb++) {
				if (settingsButtons[sb] && settingsButtons[sb].img) uiResources = uiResources.concat(settingsButtons[sb].img);
			}
			uiResources.push(p.settings.tab_img);
			for (var sp = 0; sp < p.settings.pages.length; sp++) {
				for (var se = 0; se < p.settings.pages[sp].elements.length; se++) {
					var element = p.settings.pages[sp].elements[se];
					if (!element) continue;
					if (element.objType == "CB") {
						uiResources = uiResources.concat([element.checkbox_normal_off, element.checkbox_hover_off, element.checkbox_normal_on, element.checkbox_hover_on]);
					} else if (element.objType == "RB") {
						uiResources = uiResources.concat([element.radiobt_normal_off, element.radiobt_hover_off, element.radiobt_normal_on, element.radiobt_hover_on]);
					}
				}
			}
		}
		DarkOnePerformance.disposeUnique(uiResources);

		DarkOnePerformance.dispose(images.wallpaper);
		images.wallpaper = null;
		g_image_cache.reset();
		DarkOnePerformance.dispose(g_stub_image);
		g_stub_image = null;
		if (p.topBar && p.topBar.logo) {
			DarkOnePerformance.dispose(p.topBar.logo);
			p.topBar.logo = null;
		}
		if (p.list && p.list.handleList) {
			p.list.handleList.Dispose();
			p.list.handleList = null;
		}
	} catch (e) {}
}

function on_size() {
	ww = window.Width;
	wh = window.Height;
	resize_panels();

	if (!g_init_on_size) {
		update_playlist();
		g_init_on_size = true;
	}
}

function DrawCover(gr, img, dst_x, dst_y, dst_w, dst_h) {
	if (img) {
		var s = Math.min(dst_w / img.Width, dst_h / img.Height);
		var w = Math.floor(img.Width * s);
		var h = Math.floor(img.Height * s);
		dst_x += Math.round((dst_w - w) / 2);
		dst_w = w;
		dst_h = h;
		gr.DrawBitmap(img, dst_x, dst_y, dst_w, dst_h, 0, 0, img.Width, img.Height);
	}
	DrawRectangle(gr, dst_x, dst_y, dst_w - 1, dst_h - 1, g_colour_text);
}

function DrawWallpaper(gr) {
	if (images.wallpaper.Width / images.wallpaper.Height < ww / wh) {
		var src_x = 0;
		var src_w = images.wallpaper.Width;
		var src_h = Math.round(wh * images.wallpaper.Width / ww);
		var src_y = Math.round((images.wallpaper.Height - src_h) / 2);
	} else {
		var src_y = 0;
		var src_w = Math.round(ww * images.wallpaper.Height / wh);
		var src_h = images.wallpaper.Height;
		var src_x = Math.round((images.wallpaper.Width - src_w) / 2);
	}

	gr.DrawBitmap(images.wallpaper, 0, p.list.y, ww, p.list.h, src_x, src_y, src_w, src_h, 0.1);
}

function GetKeyboardMask() {
	if (utils.IsKeyPressed(VK_CONTROL))
		return KMask.ctrl;
	else if (utils.IsKeyPressed(VK_SHIFT))
		return KMask.shift;
	else
		return KMask.none;
}

function num(strg, nb) {
	var i;
	var str = strg.toString();
	var k = nb - str.length;

	if (k > 0) {
		for (i = 0; i < k; i++) {
			str = "0" + str;
		}
	}

	return str.toString();
}

function button(normal, hover, down) {
	this.img = [normal, hover, down];
	this.w = this.img[0].Width;
	this.h = this.img[0].Height;
	this.state = ButtonStates.normal;

	this.update = function (normal, hover, down) {
		this.img = [normal, hover, down];
		this.w = this.img[0].Width;
		this.h = this.img[0].Height;
	}

	this.draw = function (gr, x, y) {
		this.x = x;
		this.y = y;
		if (this.img[this.state]) gr.DrawImage(this.img[this.state], this.x, this.y, this.w, this.h, 0, 0, this.w, this.h);
	}

	this.checkstate = function (event, x, y) {
		this.ishover = (x > this.x && x < this.x + this.w - 1 && y > this.y && y < this.y + this.h - 1);
		var old = this.state;
		switch (event) {
		case "lbtn_down":
			switch (this.state) {
			case ButtonStates.normal:
			case ButtonStates.hover:
				this.state = this.ishover ? ButtonStates.down : ButtonStates.normal;
				this.isdown = true;
				break;
			}
			break;
		case "lbtn_up":
			this.state = this.ishover ? ButtonStates.hover : ButtonStates.normal;
			this.isdown = false;
			break;
		case "move":
			switch (this.state) {
			case ButtonStates.normal:
			case ButtonStates.hover:
				this.state = this.ishover ? ButtonStates.hover : ButtonStates.normal;
				break;
			}
			break;
		}

		if (this.state != old) {
			window.RepaintRect(this.x, this.y, this.w, this.h);
		}
		return this.state;
	}
}

function get_tfo(pattern) {
	if (!tfos[pattern]) {
		tfos[pattern] = fb.TitleFormat(pattern);
	}
	return tfos[pattern];
}

function renamePlaylist() {
	var text = p.playlistManager.inputbox.text.trim();

	if (p.playlistManager.inputboxID > -1 && text.length) {
		plman.RenamePlaylist(p.playlistManager.playlists[p.playlistManager.inputboxID].idx, text);
		p.playlistManager.inputboxID = -1;
	}
}

function inputboxPlaylistManager_activate() {
	if (cPlaylistManager.inputbox_timeout) {
		window.ClearTimeout(cPlaylistManager.inputbox_timeout);
		cPlaylistManager.inputbox_timeout = false;
	}

	p.playlistManager.inputbox.on_focus(true);
	p.playlistManager.inputbox.edit = true;
	p.playlistManager.inputbox.Cpos = p.playlistManager.inputbox.text.length;
	p.playlistManager.inputbox.anchor = p.playlistManager.inputbox.Cpos;
	p.playlistManager.inputbox.SelBegin = p.playlistManager.inputbox.Cpos;
	p.playlistManager.inputbox.SelEnd = p.playlistManager.inputbox.Cpos;

	if (!cInputbox.cursor_interval) {
		p.playlistManager.inputbox.resetCursorTimer();
	}

	p.playlistManager.inputbox.dblclk = true;
	p.playlistManager.inputbox.SelBegin = 0;
	p.playlistManager.inputbox.SelEnd = p.playlistManager.inputbox.text.length;
	p.playlistManager.inputbox.text_selected = p.playlistManager.inputbox.text;
	p.playlistManager.inputbox.select = true;
	full_repaint();
}

function togglePlaylistManager() {
	if (!cPlaylistManager.hscroll_interval) {
		if (cPlaylistManager.visible) {
			cPlaylistManager.hscroll_interval = window.SetInterval(function () {
				p.playlistManager.repaint();
				p.playlistManager.woffset -= cPlaylistManager.step;
				if (p.playlistManager.woffset <= 0) {
					p.playlistManager.woffset = 0;
					cPlaylistManager.visible = false;
					p.headerBar.button.update(p.headerBar.slide_open, p.headerBar.slide_open, p.headerBar.slide_open);
					full_repaint();
					window.ClearInterval(cPlaylistManager.hscroll_interval);
					cPlaylistManager.hscroll_interval = false;
				}
			}, 16);
		} else {
			p.playlistManager.refresh();
			cPlaylistManager.hscroll_interval = window.SetInterval(function () {
				p.playlistManager.woffset += cPlaylistManager.step;
				if (p.playlistManager.woffset >= cPlaylistManager.width) {
					p.playlistManager.woffset = cPlaylistManager.width;
					cPlaylistManager.visible = true;
					p.headerBar.button.update(p.headerBar.slide_close, p.headerBar.slide_close, p.headerBar.slide_close);
					full_repaint();
					window.ClearInterval(cPlaylistManager.hscroll_interval);
					cPlaylistManager.hscroll_interval = false;
				} else {
					p.playlistManager.repaint();
				}
			}, 16);
		}
	}
}

function image_cache() {
	this.get = function (metadb, group_key) {
		var bitmap = this.cachelist[group_key];
		if (bitmap)
			return bitmap;

		if (!this.requested[group_key]) {
			this.requested[group_key] = true;
			window.SetTimeout(function () {
				metadb.GetAlbumArtThumbAsync(window.ID, cGroup.art_id);
			}, 20);
		}
		return null;
	}

	this.set = function (group_key, image) {
		var bitmap = DarkOnePerformance.toBitmap(image, true);
		if (!bitmap)
			return false;

		var previous = this.cachelist[group_key];
		if (previous && previous !== bitmap) {
			DarkOnePerformance.dispose(previous);
			if (p.list && p.list.groups) {
				for (var i = 0; i < p.list.groups.length; i++) {
					if (p.list.groups[i].group_key == group_key) p.list.groups[i].cover_img = null;
				}
			}
		}
		this.cachelist[group_key] = bitmap;
		full_repaint();
		return true;
	}

	this.reset = function () {
		for (var key in this.cachelist) {
			DarkOnePerformance.dispose(this.cachelist[key]);
		}
		this.cachelist = {};
		this.requested = {};
	}

	this.cachelist = {};
	this.requested = {};
}

function full_repaint() {
	need_repaint = true;
	if (g_repaint_scheduler)
		g_repaint_scheduler.request();
}

function repaint_scroll_frame() {
	need_repaint = true;
	// Animation frames repaint directly from the shared frame loop. Calls made
	// outside a frame (for example direct scrollbar positioning) remain
	// coalesced through the normal interval-aware repaint scheduler.
	if (!g_playlist_scroll_frame_in_tick && g_repaint_scheduler)
		g_repaint_scheduler.request();
}

function stop_playlist_scroll_frame_if_idle() {
	if (g_playlist_scroll_frame && !cList.scroll_timer && !cList.free_scroll_timer)
		g_playlist_scroll_frame.stop();
}

function stop_smooth_scroll() {
	cList.scroll_timer = false;
	cList.scroll_delta = 0;
	stop_playlist_scroll_frame_if_idle();
}

function get_free_scroll_max_px() {
	if (!p.list || cRow.playlist_h <= 0)
		return 0;

	var max_rows = Math.max(0, p.list.totalRows - p.list.totalRowVisible);
	return max_rows * cRow.playlist_h;
}

function stop_free_wheel_scroll() {
	cList.free_scroll_timer = false;
	stop_playlist_scroll_frame_if_idle();
}

function reset_free_wheel_scroll() {
	stop_free_wheel_scroll();
	cList.free_scroll_position = p.list ? p.list.offset * cRow.playlist_h : 0;
	cList.free_scroll_target = cList.free_scroll_position;
	cList.free_scroll_offset = 0;
	cList.free_scroll_active = false;
}

function apply_free_wheel_position(position, preserve_scrollbar_cursor, suppress_repaint) {
	var max_px = get_free_scroll_max_px();
	position = Math.max(0, Math.min(max_px, position));

	var row_h = Math.max(1, cRow.playlist_h);
	var base_row = Math.floor(position / row_h);
	var pixel_offset = position - (base_row * row_h);
	var max_rows = Math.max(0, p.list.totalRows - p.list.totalRowVisible);

	if (base_row >= max_rows) {
		base_row = max_rows;
		pixel_offset = 0;
		position = base_row * row_h;
	}

	var offset_changed = p.list.offset != base_row;
	var required_rows = p.list.getViewportRowsToLoad(pixel_offset, base_row);
	if (offset_changed)
		p.list.offset = base_row;
	if (offset_changed || (p.list.loadedRowCount || 0) < required_rows)
		p.list.setItems(false, pixel_offset);

	cList.free_scroll_position = position;
	cList.free_scroll_offset = pixel_offset;
	cList.free_scroll_active = pixel_offset > 0 || !!cList.free_scroll_timer;
	if (!preserve_scrollbar_cursor)
		p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset, position);
	if (!suppress_repaint)
		repaint_scroll_frame();
}

function repaint_playlist_scrollbar_drag_frame() {
	need_repaint = true;
	if (window.IsVisible) {
		need_repaint = false;
		window.Repaint();
	} else if (g_repaint_scheduler) {
		g_repaint_scheduler.request();
	}
}

function ensure_playlist_scrollbar_drag_frame() {
	if (!g_playlist_scrollbar_drag_frame) {
		g_playlist_scrollbar_drag_frame = DarkOnePerformance.createFrameLoop(window, {
			getDelay: function () { return cList.repaint_interval; },
			hiddenDelay: 250,
			tick: playlist_scrollbar_drag_frame_tick
		});
	}
	return g_playlist_scrollbar_drag_frame;
}

function begin_playlist_scrollbar_drag(snap_to_rows) {
	stop_smooth_scroll();
	stop_free_wheel_scroll();

	var current = cList.free_scroll_active
		? cList.free_scroll_position
		: (p.list ? p.list.offset * Math.max(1, cRow.playlist_h) : 0);

	cList.scrollbar_drag_active = true;
	cList.scrollbar_drag_snap = !!snap_to_rows;
	cList.scrollbar_drag_position = current;
	cList.scrollbar_drag_target = current;
	cList.scrollbar_drag_last_tick = 0;
}

function update_playlist_scrollbar_drag(position, snap_to_rows) {
	position = Math.max(0, Math.min(get_free_scroll_max_px(), Number(position) || 0));
	cList.scrollbar_drag_active = true;
	cList.scrollbar_drag_snap = !!snap_to_rows;
	cList.scrollbar_drag_target = position;

	if (!properties.smoothscrolling) {
		cList.scrollbar_drag_position = position;
		apply_free_wheel_position(position, true, true);
		repaint_playlist_scrollbar_drag_frame();
		return;
	}

	ensure_playlist_scrollbar_drag_frame();
	g_playlist_scrollbar_drag_frame.request();
}

function playlist_scrollbar_drag_frame_tick() {
	if (!cList.scrollbar_drag_active)
		return false;

	var now = Date.now ? Date.now() : new Date().getTime();
	var elapsed = cList.scrollbar_drag_last_tick
		? Math.max(1, Math.min(64, now - cList.scrollbar_drag_last_tick))
		: cList.repaint_interval;
	cList.scrollbar_drag_last_tick = now;

	var current = cList.scrollbar_drag_position;
	var target = cList.scrollbar_drag_target;
	var distance = target - current;

	if (Math.abs(distance) <= 0.5) {
		current = target;
	} else {
		// Time-based half-life keeps the drag response equally quick at every
		// refresh rate while allowing 8 ms to produce genuine intermediate
		// frames between mouse-move callbacks.
		var alpha = 1 - Math.pow(0.5, elapsed / 8);
		var movement = distance * alpha;
		if (Math.abs(movement) < 0.5)
			movement = distance < 0 ? -0.5 : 0.5;
		current += movement;
	}

	current = Math.max(0, Math.min(get_free_scroll_max_px(), current));
	cList.scrollbar_drag_position = current;
	var render_position = cList.scrollbar_drag_snap
		? Math.round(current / Math.max(1, cRow.playlist_h)) * Math.max(1, cRow.playlist_h)
		: current;
	apply_free_wheel_position(render_position, true, true);
	repaint_playlist_scrollbar_drag_frame();

	return cList.scrollbar_drag_active && Math.abs(cList.scrollbar_drag_target - current) > 0.5;
}

function finish_playlist_scrollbar_drag(position, snap_to_rows) {
	position = Math.max(0, Math.min(get_free_scroll_max_px(), Number(position) || 0));
	if (g_playlist_scrollbar_drag_frame)
		g_playlist_scrollbar_drag_frame.stop();

	cList.scrollbar_drag_active = false;
	cList.scrollbar_drag_snap = !!snap_to_rows;
	cList.scrollbar_drag_target = position;
	cList.scrollbar_drag_position = position;
	cList.scrollbar_drag_last_tick = 0;
	apply_free_wheel_position(position, true, true);

	if (snap_to_rows) {
		cList.free_scroll_position = p.list.offset * Math.max(1, cRow.playlist_h);
		cList.free_scroll_target = cList.free_scroll_position;
		cList.free_scroll_offset = 0;
		cList.free_scroll_active = false;
	} else {
		cList.free_scroll_target = position;
		cList.free_scroll_active = cList.free_scroll_offset > 0;
	}

	repaint_playlist_scrollbar_drag_frame();
}

function cancel_playlist_scrollbar_drag() {
	if (g_playlist_scrollbar_drag_frame)
		g_playlist_scrollbar_drag_frame.stop();
	cList.scrollbar_drag_active = false;
	cList.scrollbar_drag_last_tick = 0;
}

function scroll_wheel_freely(delta) {
	stop_smooth_scroll();

	if (!cList.free_scroll_active && !cList.free_scroll_timer) {
		cList.free_scroll_position = p.list.offset * cRow.playlist_h;
		cList.free_scroll_target = cList.free_scroll_position;
	}

	var step_px = cList.free_wheel_step > 0 ? cList.free_wheel_step : Math.max(4, Math.round(cRow.playlist_h * 0.65));
	cList.free_scroll_target = Math.max(0, Math.min(get_free_scroll_max_px(), cList.free_scroll_target - (delta * step_px)));

	if (!properties.smoothscrolling) {
		apply_free_wheel_position(cList.free_scroll_target);
		return;
	}

	start_free_wheel_scroll_timer();
}

function free_wheel_scroll_tick() {
	var distance = cList.free_scroll_target - cList.free_scroll_position;
	if (Math.abs(distance) <= 0.75) {
		apply_free_wheel_position(cList.free_scroll_target);
		stop_free_wheel_scroll();
		cList.free_scroll_active = cList.free_scroll_offset > 0;
		return;
	}

	var movement = distance / cList.scroll_div;
	if (Math.abs(movement) < 1)
		movement = distance < 0 ? -1 : 1;

	apply_free_wheel_position(cList.free_scroll_position + movement);
}

function start_free_wheel_scroll_timer() {
	if (!cList.free_scroll_timer) {
		cList.free_scroll_timer = true;
		ensure_playlist_scroll_frame();
		g_playlist_scroll_frame.request();
	}
}

function set_scroll_delta() {
	var maxOffset = p.list.totalRows > p.list.totalRowVisible ? p.list.totalRows - p.list.totalRowVisible : 0;
	if (!properties.smoothscrolling || maxOffset <= 0)
		return;

	if (!cList.scroll_timer) {
		cList.scroll_delta = cRow.playlist_h;
		start_smooth_scroll_timer();
	} else {
		cList.scroll_delta = cRow.playlist_h;
	}
}

function smooth_scroll_tick() {
	cList.scroll_step = Math.max(1, Math.round(cList.scroll_delta / cList.scroll_div));
	cList.scroll_delta -= cList.scroll_step;

	if (cList.scroll_delta <= 1) {
		stop_smooth_scroll();
	}

	repaint_scroll_frame();
}

function start_smooth_scroll_timer() {
	if (!cList.scroll_timer) {
		cList.scroll_timer = true;
		ensure_playlist_scroll_frame();
		g_playlist_scroll_frame.request();
	}
}

function playlist_scroll_frame_tick() {
	g_playlist_scroll_frame_in_tick = true;
	try {
		if (cList.free_scroll_timer)
			free_wheel_scroll_tick();
		else if (cList.scroll_timer)
			smooth_scroll_tick();
	} finally {
		g_playlist_scroll_frame_in_tick = false;
	}

	if (need_repaint && window.IsVisible) {
		need_repaint = false;
		window.Repaint();
	}

	return !!cList.scroll_timer || !!cList.free_scroll_timer;
}

function ensure_playlist_scroll_frame() {
	if (!g_playlist_scroll_frame) {
		g_playlist_scroll_frame = DarkOnePerformance.createFrameLoop(window, {
			getDelay: function () { return cList.repaint_interval; },
			hiddenDelay: 250,
			tick: playlist_scroll_frame_tick
		});
	}
	return g_playlist_scroll_frame;
}

function reschedule_active_playlist_scroll_timers() {
	if (!cList.scroll_timer && !cList.free_scroll_timer)
		return;

	ensure_playlist_scroll_frame();
	g_playlist_scroll_frame.reschedule();
	if (!g_playlist_scroll_frame.isRunning())
		g_playlist_scroll_frame.request();
}

function apply_playlist_refresh_interval(value) {
	value = Math.max(7, Math.min(40, Math.round(Number(value)) || 8));
	if (cList.repaint_interval == value) return false;

	cList.repaint_interval = value;
	if (typeof g_js_playlist_cadence_reporter != "undefined" && g_js_playlist_cadence_reporter)
		g_js_playlist_cadence_reporter.announce();
	start_repaint_timer();
	reschedule_active_playlist_scroll_timers();
	if (g_playlist_scrollbar_drag_frame && g_playlist_scrollbar_drag_frame.isRunning())
		g_playlist_scrollbar_drag_frame.reschedule();
	return true;
}

function set_playlist_refresh_interval(value) {
	value = Math.max(7, Math.min(40, Math.round(Number(value)) || 8));
	window.SetProperty("JSPLAYLIST.UI Refresh Interval (ms)", value);
	return apply_playlist_refresh_interval(value);
}

function start_repaint_timer() {
	if (!g_repaint_scheduler) {
		g_repaint_scheduler = DarkOnePerformance.createRepaintScheduler(window, {
			getDelay: function () { return cList.repaint_interval; },
			hiddenDelay: 250,
			repaint: function () {
				if (!need_repaint) return;
				need_repaint = false;
				window.Repaint();
			}
		});
	} else {
		g_repaint_scheduler.reschedule();
	}
	if (need_repaint) g_repaint_scheduler.request();
}

function resize_panels() {
	cRow.playlist_h = scale(cRow.default_playlist_h);

	if (cList.enableExtraLine) {
		cRow.playlist_h += scale(6);
	}

	if (p.list)
		reset_free_wheel_scroll();

	p.topBar.setSize(0, 0, ww, cTopBar.visible ? cTopBar.height + cHeaderBar.borderWidth : 0);

	p.headerBar.visible = cHeaderBar.locked;
	p.headerBar.setSize(0, p.topBar.h, ww, cHeaderBar.height);
	p.headerBar.calculateColumns();

	// set Size of List
	var list_h = wh - p.topBar.h - (p.headerBar.visible ? p.headerBar.h + cHeaderBar.borderWidth : 0);
	p.list.setSize(0, wh - list_h, ww, list_h);

	if (g_init_on_size) {
		p.list.setItems(true);
	}

	// set Size of scrollbar
	p.scrollbar.setSize(p.list.x + p.list.w - cScrollBar.width, p.list.y, cScrollBar.width, p.list.h);
	p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);

	// set Size of Settings
	p.settings.setSize(0, 0, ww, wh);

	// set Size of PlaylistManager
	if (cPlaylistManager.visible) {
		cPlaylistManager.visible = g_init_on_size;
		p.playlistManager.woffset = g_init_on_size ? 0 : cPlaylistManager.width;
	}
	p.playlistManager.setSize(ww, p.list.y, cPlaylistManager.width, p.list.h);
	p.playlistManager.refresh();
}

function init() {
	get_font();
	get_colours();
	plman.SetActivePlaylistContext();
	update_wallpaper();
	var stub = fb.GetAlbumArtStub(cGroup.art_id);
	g_stub_image = DarkOnePerformance.toBitmap(stub, true);
	g_playlist_render_cache = new DarkOnePlaylistRenderCache({
		enabled: properties.enableRenderCache,
		maxEntries: properties.renderCacheRows
	});
	g_playlist_profiler = DarkOnePerformance.createProfiler(
		utils,
		properties.performanceProfiling,
		"Enhanced JS Playlist paint",
		120
	);

	p.list = new oList("p.list");
	p.topBar = new oTopBar();
	p.headerBar = new oHeaderBar();
	p.scrollbar = new PlaylistScrollBar();

	p.playlistManager = new oPlaylistManager();
	p.settings = new oSettings();
	update_playlist_playback_state();

	start_repaint_timer();
}

function update_playlist(preserveOffset) {
	var previous_offset = preserveOffset ? p.list.offset : null;
	g_group_id_focused = 0;
	if (g_playlist_render_cache) g_playlist_render_cache.invalidateAll();
	p.list.updateHandleList();

	if (typeof previous_offset == "number") {
		var maximum_offset = Math.max(0, p.list.totalRows - p.list.totalRowVisible);
		p.list.offset = Math.max(0, Math.min(Math.round(previous_offset), maximum_offset));
	}

	p.list.setItems(false);
	p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);

	if (cHeaderBar.sortRequested) {
		window.SetCursor(IDC_ARROW);
		cHeaderBar.sortRequested = false;
	}
}

function height(font) {
	return JSON.parse(font).Size + scale(4)
}

function scale(size) {
	return Math.round(size * g_font_size / 12);
}

function js_font(name, size, bold) {
	return JSON.stringify({
		Name : name,
		Size : scale(size),
		Weight : bold ? 700 : 400,
	});
}

function get_font() {
	var default_font;

	if (window.IsDefaultUI) {
		default_font = JSON.parse(window.GetFontDUI(FontTypeDUI.playlists));
	} else {
		default_font = JSON.parse(window.GetFontCUI(FontTypeCUI.items));
	}

	var name = default_font.Name;
	g_font_size = default_font.Size;

	cTopBar.height = scale(54);
	cHeaderBar.height = scale(26);
	cHeaderBar.borderWidth = scale(2);
	cSettings.topBarHeight = scale(50);
	cSettings.tabPaddingWidth = scale(16);
	cSettings.rowHeight = scale(30);
	cPlaylistManager.width = scale(220);
	cPlaylistManager.rowHeight = scale(28);
	cPlaylistManager.statusBarHeight = scale(18);
	cScrollBar.width = scale(cScrollBar.defaultWidth);

	g_z2 = scale(2);
	g_z4 = scale(4);
	g_z5 = scale(5);
	g_z10 = scale(10);
	g_z16 = scale(16);

	g_font_12 = js_font(name, 12);
	g_font_12_bold = js_font(name, 12, true);
	g_font_20_bold = js_font(name, 20, true);

	g_font_fluent_12 = js_font("Segoe Fluent Icons", 12);
	g_font_fluent_20 = js_font("Segoe Fluent Icons", 20);
	g_font_fluent_40 = js_font("Segoe Fluent Icons", 40);

	g_font_group1 = js_font(name, 16, true);
	g_font_group2 = js_font(name, 14);

	columns.rating_w = (chars.rating_off.calc_width2(g_font_fluent_20) * 5) + 4;
	g_queue_width = "0000".calc_width2(g_font_20_bold);
}

function get_colours() {
	g_dynamic = false;
	g_colour_mood = window.GetProperty("JSPLAYLIST.COLOUR.MOOD", RGB(196,30,35));
	g_colour_rating = window.GetProperty("JSPLAYLIST.COLOUR.RATING", RGB(255, 128, 0));

	if (properties.enableDynamicColours) {
		var arr = GetNowPlayingColours();
		if (arr.length) {
			g_dynamic = true;
			g_colour_background = arr[0];
			g_colour_text = arr[1];
			g_colour_selection = arr[2];
			g_colour_selected_text = arr[3];
			g_colour_highlight = g_colour_text;
			return;
		}
	}

	if (properties.enableCustomColours) {
		g_colour_background = window.GetProperty("JSPLAYLIST.COLOUR BACKGROUND NORMAL", RGB(25, 25, 35));
		g_colour_selection = window.GetProperty("JSPLAYLIST.COLOUR BACKGROUND SELECTED", RGB(130,150,255));
		g_colour_text = window.GetProperty("JSPLAYLIST.COLOUR TEXT NORMAL", RGB(180, 180, 180));
		g_colour_selected_text = DetermineTextColour(g_colour_selection);
		g_colour_highlight = window.GetProperty("JSPLAYLIST.COLOUR TEXT HIGHLIGHT", g_colour_text);
	} else {
		if (window.IsDefaultUI) {
			g_colour_background = window.GetColourDUI(ColourTypeDUI.background);
			g_colour_selection = window.GetColourDUI(ColourTypeDUI.selection);
			g_colour_text = window.GetColourDUI(ColourTypeDUI.text);
			g_colour_selected_text = DetermineTextColour(g_colour_selection);
			g_colour_highlight = window.GetColourDUI(ColourTypeDUI.highlight);
		} else {
			g_colour_background = window.GetColourCUI(ColourTypeCUI.background);
			g_colour_selection = window.GetColourCUI(ColourTypeCUI.selection_background);
			g_colour_text = window.GetColourCUI(ColourTypeCUI.text);
			g_colour_selected_text = window.GetColourCUI(ColourTypeCUI.selection_text);
			g_colour_highlight = g_colour_text;
		}
	}
}

function update_wallpaper() {
	if (images.wallpaper) {
		images.wallpaper.Dispose();
		images.wallpaper = null;
	}

	if (!properties.showwallpaper)
		return;

	var metadb = fb.GetNowPlaying();

	if (!metadb)
		return;

	var img = null;

	if (properties.wallpapertype == -1) {
		if (utils.IsFile(properties.wallpaperpath)) {
			img = utils.LoadImage(properties.wallpaperpath);
		} else {
			img = utils.LoadImage(fb.ProfilePath + properties.wallpaperpath);
		}
	} else {
		img = metadb.GetAlbumArt(properties.wallpapertype);
	}

	if (!img)
		return;

	if (properties.wallpaperblurred) {
		img.StackBlur(properties.wallpaperblurvalue);
	}

	images.wallpaper =  img.CreateBitmap();
	img.Dispose();
}

var g_middle_clicked = false;
var g_middle_click_timeout = false;
var g_textbox_tabbed = false;
var g_init_on_size = false;
var g_seconds = 0;
var g_mouse_wheel_timeout = false;
var g_repaint_scheduler = null;
var g_playlist_scroll_frame = null;
var g_playlist_scrollbar_drag_frame = null;
var g_playlist_scroll_frame_in_tick = false;
var g_playlist_render_cache = null;
var g_playlist_profiler = null;
var g_cached_playing_index = -1;
var g_playlist_paint_state = {
	isPlaying: false,
	isPaused: false,
	playingPlaylist: -1,
	playingItem: -1,
	secondaryPattern: '',
	lovedSync: false,
	dynamicGeneration: 0,
	columns: []
};
var g_playlist_dynamic_generation = 0;
var g_active_playlist = plman.ActivePlaylist;
var g_image_cache = new image_cache();
var g_stub_image = null;

var g_drag_drop_status = false;
var g_drag_drop_bottom = false;
var g_drag_drop_track_id = -1;
var g_drag_drop_row_id = -1;
var g_drag_drop_playlist_id = -1;
var g_drag_drop_playlist_manager_hover = false;
var g_drag_drop_internal = false;

var g_colour_text = 0;
var g_colour_selected_text = 0;
var g_colour_background = 0;
var g_colour_selection = 0;
var g_colour_highlight = 0;
var g_colour_mood = 0;
var g_colour_rating = 0;
var g_font_size = 0;
var g_queue_width = 0;
var g_dynamic = false;
var g_double_clicked = false;

var g_tf_pattern = "";
var g_tf2_pattern = "";

var ww = 0, wh = 0;
var mouse_x = 0, mouse_y = 0;
var need_repaint = false;
var foo_playcount = fb.CheckComponent("foo_playcount");
var foo_lastfm_playcount_sync = fb.CheckComponent("foo_lastfm_playcount_sync");
var tfos = {};
var tf_group_key = null;

var KMask = {
	none: 0,
	ctrl: 1,
	shift: 2
};

var ButtonStates = {
	normal: 0,
	hover: 1,
	down: 2
};

var properties = {
	enableDynamicColours: window.GetProperty("JSPLAYLIST.Enable Dynamic Colours", false),
	enableCustomColours: window.GetProperty("JSPLAYLIST.Enable Custom Colours", false),
	showgroupheaders : window.GetProperty("JSPLAYLIST.Show Group Headers", true),
	showscrollbar : window.GetProperty("JSPLAYLIST.Show Scrollbar", true),
	showwallpaper : window.GetProperty("JSPLAYLIST.Show Wallpaper", false),
	wallpaperblurred : window.GetProperty("JSPLAYLIST.Wallpaper Blurred", false),
	wallpaperblurvalue : window.GetProperty("JSPLAYLIST.Wallpaper StackBlur value", 60),
	wallpapertype : window.GetProperty("JSPLAYLIST.Wallpaper Type", 0),
	wallpaperpath : window.GetProperty("JSPLAYLIST.Default Wallpaper Path", ""),
	smoothscrolling : window.GetProperty("JSPLAYLIST.Enable Smooth Scrolling", true),
	enableRenderCache : window.GetProperty("JSPLAYLIST.Enable Render Cache", true),
	renderCacheRows : Math.max(64, Math.min(4096, Math.round(window.GetProperty("JSPLAYLIST.Render Cache Rows", 768)))),
	performanceProfiling : window.GetProperty("JSPLAYLIST.Enable Performance Profiling", false),
	max_columns : 24,
	max_patterns : 25,
	use_foo_lastfm_playcount_sync : window.GetProperty("Love tracks with foo_lastfm_playcount_sync", false),
};

var images = {
	wallpaper : null,
};

var cRow = {
	default_playlist_h : window.GetProperty("JSPLAYLIST.Playlist Row Height in Pixel", 28),
	playlist_h : 29,
};

var p = {
	topbar : null,
	headerBar : null,
	list : null,
	playlistManager : null,
	settings : null,
	on_key_timeout : false
};

var cSettings = {
	visible : false,
	topBarHeight : 50,
	tabPaddingWidth : 16,
	rowHeight : 30,
	wheel_timeout : false
};

var cPlaylistManager = {
	width : 220,
	rowHeight : 28,
	showStatusBar : true,
	statusBarHeight : 18,
	step : 50,
	visible : false,
	hscroll_interval : false,
	drag_clicked : false,
	drag_moved : false,
	drag_target_id : -1,
	drag_source_id : -1,
	drag_dropped : false,
	rightClickedId : null,
	init_timeout : false,
	inputbox_timeout : false,
};

var cTopBar = {
	height : 54,
	visible : window.GetProperty("JSPLAYLIST.TopBar.Visible", true)
};

var cHeaderBar = {
	height : 26,
	borderWidth : 2,
	locked : window.GetProperty("JSPLAYLIST.HEADERBAR2.Locked", true),
	timerAutoHide : false,
	sortRequested : false
};

var cScrollBar = {
	defaultWidth : 17,
	width : 17,
	buttonType : {
		cursor : 0,
		up : 1,
		down : 2
	},
	interval : false,
	timeout : false,
	timer_counter : 0,
	repaint_timeout : false,
};

var cGroup = {
	expandedHeight : 3,
	pattern_idx : window.GetProperty("JSPLAYLIST.GROUPBY2.INDEX", 0),
	art_id : window.GetProperty("JSPLAYLIST.GROUPBY2.ART.ID", 0),
};

var cover = { show : true };

var cList = {
	scrollstep : Math.max(1, Math.min(10, window.GetProperty("JSPLAYLIST.Playlist Scroll Step", 3))),
	scroll_timer : false,
	scroll_delta : cRow.playlist_h,
	scroll_direction : 1,
	scroll_step : Math.floor(cRow.playlist_h / 3),
	scroll_div : Math.max(1.25, Math.min(10, window.GetProperty("JSPLAYLIST.Smooth Scroll Divisor", 2))),
	repaint_interval : Math.max(7, Math.min(40, window.GetProperty("JSPLAYLIST.UI Refresh Interval (ms)", 8))),
	wheel_throttle : Math.max(0, Math.min(40, window.GetProperty("JSPLAYLIST.Playlist Wheel Throttle (ms)", 8))),
	wheel_snap : window.GetProperty("JSPLAYLIST.Snap Wheel Scrolling To Rows", true),
	scrollbar_snap : window.GetProperty("JSPLAYLIST.Snap Scrollbar Dragging To Rows", true),
	free_wheel_step : Math.max(0, Math.min(240, window.GetProperty("JSPLAYLIST.Free Wheel Step (pixels)", 0))),
	free_scroll_timer : false,
	free_scroll_position : 0,
	free_scroll_target : 0,
	free_scroll_offset : 0,
	free_scroll_active : false,
	scrollbar_drag_active : false,
	scrollbar_drag_snap : true,
	scrollbar_drag_position : 0,
	scrollbar_drag_target : 0,
	scrollbar_drag_last_tick : 0,
	borderWidth : 2,
	enableExtraLine : window.GetProperty("JSPLAYLIST.Enable Extra Line", true)
};

var columns = {
	mood_x : 0,
	mood_w : 0,
	rating_x : 0,
	rating_w : 0,
};

var g_js_playlist_cadence_reporter = DarkOneUiCadence.createSourceReporter(window, {
	source: DarkOneUiCadence.sources.jsPlaylist,
	getInterval: function () { return cList.repaint_interval; }
});

init();
