function on_char(code) {
	if (ppt.library && ppt.showHeaderBar && brw.inputbox.edit) {
		brw.inputbox.on_char(code);
	}
}

function on_focus(is_focused) {
	if (!is_focused) {
		brw.repaint();
	}
}

function on_key_down(vkey) {
	if (ppt.showHeaderBar) {
		brw.inputbox.on_key_down(vkey);
	}

	if (GetKeyboardMask() == KMask.ctrl) {
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

function on_library_initialised() {
	if (ppt.library) {
		brw.populate();
	}
}

function on_library_items_added() {
	if (ppt.library) {
		brw.populate();
	}
}

function on_library_items_changed(handles, fromhook) {
	if (ppt.library && !fromhook) {
		brw.populate();
	}
}

function on_library_items_removed() {
	if (ppt.library) {
		brw.populate();
	}
}

function on_mouse_lbtn_dblclk(x, y, mask) {
	brw.on_mouse("lbtn_dblclk", x, y);
}

function on_mouse_lbtn_down(x, y) {
	if (x < brw.w && ppt.library) g_drag_drop = true;

	brw.on_mouse("lbtn_down", x, y);
}

function on_mouse_lbtn_up(x, y) {
	g_drag_drop = false;
	brw.on_mouse("lbtn_up", x, y);
}

function on_mouse_move(x, y) {
	if (m_x == x && m_y == y)
		return;

	m_x = x;
	m_y = y;

	brw.on_mouse("move", x, y);
}

function on_mouse_rbtn_down(x, y) {
	brw.on_mouse("rbtn_down", x, y);
}

function on_mouse_rbtn_up(x, y) {
	brw.on_mouse("rbtn_up", x, y);
	return true;
}

function on_mouse_wheel(step) {
	if (utils.IsKeyPressed(VK_CONTROL)) {
		update_extra_font_size(step);
	} else {
		scroll -= step * brw.rowHeight * ppt.rowScrollStep;
		scroll = check_scroll(scroll)
		brw.on_mouse("wheel", m_x, m_y, step);
	}
}

function on_paint(gr) {
	if (ww < 10 || wh < 10)
		return;

	gr.Clear(g_colour_background);
	brw.draw(gr);

	if (ppt.library && ppt.showHeaderBar) {
		var size = ppt.headerBarHeight;

		if (brw.inputbox.text.length > 0) {
			brw.reset_bt.draw(gr, 0, 0);
		} else {
			gr.WriteTextSimple(chars.search, g_font_fluent_20, g_colour_text, 0, -2, size, size, 2, 2);
		}

		brw.inputbox.draw(gr, size + 4, 2);
	}
}

function on_playback_dynamic_info_track(type) {
	if (type == 1 && ppt.enableDynamicColours) {
		on_colours_changed();
		brw.repaint();
	}
}

function on_playback_new_track() {
	if (ppt.enableDynamicColours) {
		on_colours_changed();
		brw.repaint();
	}
}

function on_playback_stop(reason) {
	if (reason != 2 && ppt.enableDynamicColours) {
		on_colours_changed();
		brw.repaint();
	}
}

function on_playlist_items_added(playlistIndex) {
	if (!ppt.library && playlistIndex == g_active_playlist) {
		brw.populate();
	}
}

function on_playlist_items_changed(playlistIndex) {
	if (!ppt.library && playlistIndex == g_active_playlist) {
		brw.populate();
	}
}

function on_playlist_items_removed(playlistIndex, new_count) {
	if (!ppt.library && playlistIndex == g_active_playlist) {
		brw.selected_indexes = [];
		brw.populate();
	}
}

function on_playlist_items_reordered(playlistIndex) {
	if (!ppt.library && playlistIndex == g_active_playlist) {
		brw.populate();
	}
}

function on_playlist_items_replaced(playlistIndex) {
	if (!ppt.library && playlistIndex == g_active_playlist) {
		brw.populate();
	}
}

function on_playlist_switch() {
	g_active_playlist = plman.ActivePlaylist;

	if (!ppt.library) {
		brw.populate();
	}
}

function on_playlists_changed() {
	g_active_playlist = plman.ActivePlaylist;

	if (!ppt.library) {
		brw.populate();
	}
}

function oBrowser() {
	this.repaint = function () {
		need_repaint = true;
	}

	this.setSize = function () {
		this.x = 0;
		this.y = ppt.showHeaderBar ? ppt.headerBarHeight : 0;
		this.w = ww - cScrollBar.width;
		this.h = wh - this.y;

		switch (ppt.display) {
		case 0:
			this.totalColumns = 1;
			this.rowsCount = this.groups.length;
			this.thumbnailWidth = this.w;
			this.rowHeight = scale(ppt.default_lineHeightMin);
			break;
		case 1:
			this.totalColumns = Math.floor(this.w / scale(ppt.default_thumbnailWidthMin));
			if (this.totalColumns < 1) this.totalColumns = 1;
			this.thumbnailWidth = this.w / this.totalColumns;
			this.rowsCount = Math.ceil(this.groups.length / this.totalColumns);
			this.rowHeight = this.thumbnailWidth + (g_font_height * 4);
			break;
		}

		this.totalRows = Math.ceil(this.h / this.rowHeight);
		this.totalRowsVis = Math.floor(this.h / this.rowHeight);

		this.reset_bt = new button(images.reset, images.reset, images.reset);
		this.inputbox.setSize(ww * 0.6, scale(20));
		this.scrollbar.setSize();

		scroll = Math.round(scroll / this.rowHeight) * this.rowHeight;
		scroll = check_scroll(scroll);
		scroll_ = scroll;

		this.scrollbar.updateScrollbar();
	}

	this.populate = function () {
		this.groups = [];
		this.list.RemoveAll();
		var obj;

		if (ppt.library) {
			this.list = fb.GetLibraryItems(g_filter_text);
			obj = group_objects[ppt.tagMode];
			this.list.SortByFormat(obj.sort_tf, 1);
		} else {
			this.list = plman.GetPlaylistItems(g_active_playlist);
			obj = group_objects[0];
		}

		if (this.list.Count > 0) {
			if (ppt.library && ppt.tagMode == 1) { // multi value artist
				var arr = this.list.GroupByTag("artist").toArray();

				for (var i = 0; i < arr.length; i += 2) {
					var artist = arr[i];
					if (artist.empty())
						continue;

					var handles = arr[i + 1];
					var cachekey = utils.HashString(artist);
					var group = new oGroup(g, i, handles.GetItem(0), artist, cachekey);
					group.finalise(handles);

					this.groups.push(group);
				}
			} else {
				var g = 0;
				var track_tfs = obj.group_tfo.EvalWithMetadbs(this.list).toArray();
				var previous = "";
				var handles = fb.CreateHandleList();

				track_tfs.forEach((function (track_tf, i) {
					var parts = track_tf.split(" ^^^ ");
					var cachekey = utils.HashString(parts[0]);
					var meta = parts[1];
					var current = meta.toLowerCase();
					var handle = this.list.GetItem(i);

					if (current != previous) {
						previous = current;
						if (g > 0) {
							this.groups[g - 1].finalise(handles);
							handles.RemoveAll();
						}
						g++;
						this.groups.push(new oGroup(g, i, handle, meta, cachekey));
					}
					handles.AddItem(handle);
				}).bind(this));

				this.groups[g - 1].finalise(handles);
				handles.Dispose();
			}

			if (ppt.showAllItem) {
				var meta = "All items";

				if (ppt.tagMode == 0) {
					var name = obj.name;
					if (this.groups.length > 1) name += "s";
					var all_items = "(" + this.groups.length + " " + name + ")"
					meta += " ^^ " + all_items;
				}

				this.groups.unshift(new oGroup(0, 0, null, meta, 0));
				this.groups[0].finalise(this.list);
			}
		}

		get_metrics();
		this.repaint();
	}

	this.sendItemsToPlaylist = function (index) {
		if (this.groups.length == 0)
			return;

		var p = plman.FindOrCreatePlaylist(ppt.sendto_playlist, true);
		plman.UndoBackup(p);
		plman.ClearPlaylist(p);
		plman.InsertPlaylistItems(p, 0, this.groups[index].handles)
		plman.ActivePlaylist = p;
		if (ppt.sendto_playlist_play) {
			plman.ExecutePlaylistDefaultAction(p, 0);
		}
	}

	this.getlimits = function () {
		if (this.groups.length <= this.totalRowsVis * this.totalColumns) {
			var start_ = 0;
			var end_ = this.groups.length;
		} else {
			var start_ = Math.round(scroll_ / this.rowHeight) * this.totalColumns;
			var end_ = Math.round((scroll_ + wh + this.rowHeight) / this.rowHeight) * this.totalColumns;
			end_ = (this.groups.length < end_) ? this.groups.length : end_;
			start_ = start_ > 0 ? start_ - this.totalColumns : (start_ < 0 ? 0 : start_);
		}
		g_start_ = start_;
		g_end_ = end_;
	}

	this.draw = function (gr) {
		this.getlimits();

		var cx = 0;
		var ax = 0;
		var ay = 0;
		var aw = this.thumbnailWidth;
		var ah = this.rowHeight;
		var margin = scale(8);

		for (var i = g_start_; i < g_end_; i++) {
			var group = this.groups[i];

			var row = Math.floor(i / this.totalColumns);
			ax = this.x + (cx * this.thumbnailWidth);
			ay = Math.floor(this.y + (row * this.rowHeight) - scroll_);

			var normal_text = g_colour_text;
			var fader_txt = setAlpha(normal_text, 180);

			if (!group.cover_image && !group.image_requested && group.metadb) {
				group.image_requested = true;
				var id = ppt.tagMode == 0 ? AlbumArtId.front : AlbumArtId.artist;
				group.cover_image = get_art(group.metadb, group.cachekey, id);
			}

			var fh = g_font_height + 6;
			var str = group.date.length ? group.date + "\r\n" + group.artist : group.artist;

			switch (ppt.display) {
			case 0:
				if (i % 2 != 0) {
					gr.FillRectangle(ax, ay, aw, ah, setAlpha(g_colour_text, 8));
				}

				if (this.selected_indexes.indexOf(i) > -1) {
					drawSelectedRectangle(gr, ax, ay, aw, ah);
					normal_text = g_colour_selected_text;
					fader_txt = setAlpha(normal_text, 180);
				}

				var cover_size = ah - (margin * 2);
				var text_left = cover_size + (margin * 2);
				var text_width = aw - cover_size - (margin * 3);

				if (ppt.showAllItem && i == 0 && this.groups.length > 1) {
					gr.FillRectangle(ax + margin, ay + margin, cover_size, cover_size, g_colour_background);
					drawImage(gr, images.all, ax + margin, ay + margin, cover_size, cover_size, ppt.autoFill, normal_text & 0x25ffffff);
				} else {
					if (!group.cover_image) gr.FillRectangle(ax + margin, ay + margin, cover_size, cover_size, g_colour_background);
					drawImage(gr, group.cover_image || images.noart, ax + margin, ay + margin, cover_size, cover_size, ppt.autoFill, normal_text & 0x25ffffff);
				}

				if (ppt.tagMode == 0) { // album
					gr.WriteTextSimple(group.album, g_font_bold, normal_text, ax + text_left, ay + (fh * 0.2), text_width, fh, 0, 0, 1, 1);

					if (str.length) str += "\r\n";
					str += group.count + " track";
					if (group.count > 1) str += "s";
					str += ". " + group.duration + ".";
					gr.WriteTextSimple(str, g_font, fader_txt, ax + text_left, ay + (fh * 0.2) + fh, text_width, fh * 3, 0, 0, 1, 1);
				} else { // artist/album artist, 1 line
					gr.WriteTextSimple(group.artist, g_font, normal_text, ax + text_left, ay, text_width, ah, 0, 2, 1, 1);
				}
				break;
			case 1:
				var cover_size = aw - (margin * 2);

				if (this.selected_indexes.indexOf(i) > -1) {
					drawSelectedRectangle(gr, ax, ay, aw, ah);
					normal_text = g_colour_selected_text;
					fader_txt = setAlpha(normal_text, 180);
				}

				if (ppt.showAllItem && i == 0 && this.groups.length > 1) {
					gr.FillRectangle(ax + margin, ay + margin, cover_size, cover_size, g_colour_background);
					drawImage(gr, images.all, ax + margin, ay + margin, cover_size, cover_size, ppt.autoFill, normal_text & 0x25ffffff);
				} else {
					if (group.cover_image) {
						drawImage(gr, group.cover_image, ax + margin, ay + margin, cover_size, cover_size, ppt.autoFill, normal_text & 0x25ffffff);
					} else {
						gr.FillRectangle(ax + margin, ay + margin, cover_size, cover_size, g_colour_background);
						drawImage(gr, images.noart, ax + margin, ay + margin, cover_size, cover_size, ppt.autoFill, normal_text & 0x25ffffff);
					}
				}

				if (ppt.tagMode == 0) {
					gr.WriteTextSimple(group.album, g_font_bold, normal_text, ax + margin, ay + cover_size + (fh * 0.7), cover_size, fh, 2, 0, 1, 1);
					gr.WriteTextSimple(str, g_font, fader_txt, ax + margin, ay + cover_size + (fh * 0.7) + fh, cover_size, fh * 2, 2, 0, 1, 1);
				} else {
					gr.WriteTextSimple(group.artist, g_font_bold, normal_text, ax + margin, ay + cover_size + margin, cover_size, fh * 3, 2, 2, 3, 1);
				}

				break;
			}

			if (cx == this.totalColumns - 1) {
				cx = 0;
			} else {
				cx++;
			}
		}

		this.scrollbar.draw(gr);

		if (ppt.showHeaderBar) {
			var total = this.groups.length;
			var nb_groups = (ppt.showAllItem && total > 1 ? total - 1 : total);
			var boxText = nb_groups + " " + group_objects[ppt.tagMode].name;
			if (nb_groups != 1) boxText += "s";
			draw_header_bar(gr, boxText, this)
		}
	}

	this.set_playlist_selection = function (group) {
		var start = group.start;
		var end = start + group.count;
		var arr = [];
		for (var i = start; i < end; i++) {
			arr.push(i);
		}

		plman.ClearPlaylistSelection(g_active_playlist);
		plman.SetPlaylistSelection(g_active_playlist, arr, true);
		plman.SetPlaylistFocusItem(g_active_playlist, start);
	}

	this.reset_selection = function () {
		this.selected_indexes = [];
		this.selected_handles.RemoveAll();

		if (ppt.library) {
			window.SetSelection(this.selected_handles, 6);
		} else {
			window.SetSelection(this.selected_handles, 1);

			if (g_active_playlist > -1) {
				plman.ClearPlaylistSelection(g_active_playlist);
			}
		}
	}

	this.on_mouse = function (event, x, y, delta) {
		var shift = utils.IsKeyPressed(VK_SHIFT);
		var ctrl = utils.IsKeyPressed(VK_CONTROL);
		var active_index = -1;
		var hover = x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;

		if (hover) {
			var active_row = Math.ceil((y + scroll_ - this.y) / this.rowHeight) - 1;
			var tmp = (active_row * this.totalColumns) + (Math.ceil((x - this.x) / this.thumbnailWidth) - 1);
			if (tmp < this.groups.length) {
				active_index = tmp;
			}
		}

		switch (event) {
		case "lbtn_dblclk":
			if (active_index > -1) {
				if (ppt.library) {
					this.sendItemsToPlaylist(active_index);
				} else {
					plman.ExecutePlaylistDefaultAction(g_active_playlist, this.groups[active_index].start);
				}
			}
			break;
		case "lbtn_down":
			if (active_index > -1) {
				if (ppt.library) {
					if (shift) {
						if (this.old_active_index == -1 || active_index == this.old_active_index) {
							this.selected_indexes = [active_index];
						} else {
							var start = Math.min(active_index, this.old_active_index);
							var end = Math.max(active_index, this.old_active_index);

							this.selected_indexes = [];
							for (var i = start; i <= end; i++) {
								this.selected_indexes.push(i);
							}
						}
					} else {
						this.old_active_index = active_index;

						if (ctrl) {
							var idx = this.selected_indexes.indexOf(active_index);
							if (idx > -1) {
								this.selected_indexes.splice(idx, 1);
							} else {
								this.selected_indexes.push(active_index);
								this.selected_indexes.sort(function (a, b) { return a - b; });
							}
						} else {
							if (this.selected_indexes.indexOf(active_index) == -1) {
								this.selected_indexes = [active_index];
							}
						}
					}

					this.selected_handles.RemoveAll();
					this.selected_indexes.forEach((function (item) {
						this.selected_handles.AddItems(this.groups[item].handles);
					}).bind(this));

					window.SetSelection(this.selected_handles, 6);
				} else {
					this.selected_indexes = [active_index];
					this.selected_handles = this.groups[active_index].handles.Clone();
					window.SetSelection(this.selected_handles, 1);
					this.set_playlist_selection(this.groups[active_index]);
				}
			} else if (!shift && !ctrl) {
				this.reset_selection();
			}
			break;
		case "lbtn_up":
			if (shift || ctrl) {
				// do nothing
			} else if (active_index > -1) {
				this.selected_indexes = [active_index];
				this.selected_handles = this.groups[active_index].handles.Clone();

				if (ppt.library) {
					window.SetSelection(this.selected_handles, 6);
				} else {
					window.SetSelection(this.selected_handles, 1);
					this.set_playlist_selection(this.groups[active_index]);
				}
			}
			break;
		case "move":
			if (g_drag_drop && active_index > -1) {
				this.selected_handles.DoDragDrop(1);
				g_drag_drop = false;
			}
			break;
		case "rbtn_down":
			if (active_index > -1) {
				if (this.selected_indexes.indexOf(active_index) > -1) break;

				this.selected_indexes = [active_index];
				this.selected_handles = this.groups[active_index].handles.Clone();

				if (ppt.library) {
					window.SetSelection(this.selected_handles, 6);
				} else {
					window.SetSelection(this.selected_handles, 1);
					this.set_playlist_selection(this.groups[active_index]);
				}
			} else {
				this.reset_selection();
			}
			break;
		case "rbtn_up":
			if (active_index > -1) {
				this.context_menu(x, y);
			} else if (!this.inputbox.hover) {
				this.settings_menu(x, y);
			}
			break;
		case "wheel":
			if (cScrollBar.visible) {
				this.scrollbar.updateScrollbar();
			}
			break;
		}

		if (ppt.library && ppt.showHeaderBar && this.list) {
			this.inputbox.check(event, x, y);

			if (this.inputbox.text.length > 0) {
				if (event == "lbtn_down" || event == "move") {
					this.reset_bt.checkstate(event, x, y);
				} else if (event == "lbtn_up") {
					if (this.reset_bt.checkstate("lbtn_up", x, y) == ButtonStates.hover) {
						this.inputbox.text = "";
						this.inputbox.offset = 0;
						g_sendResponse();
					}
				}
			}
		}

		if (cScrollBar.visible) {
			this.scrollbar.on_mouse(event, x, y);
		}

		if (event != "move") {
			this.repaint();
		}
	}

	this.context_menu = function (x, y) {
		var menu = window.CreatePopupMenu();
		var sub = window.CreatePopupMenu();
		var add = window.CreatePopupMenu()
		var context = fb.CreateContextMenuManager();

		if (ppt.library) {
			menu.AppendMenuItem(EnableMenuIf(playlist_can_add_items(g_active_playlist)), 1, "Add to current playlist");
		}

		menu.AppendMenuItem(MF_STRING, 2, "Add to new playlist");

		for (var i = 0; i < plman.PlaylistCount; i++) {
			add.AppendMenuItem(EnableMenuIf(playlist_can_add_items(i)), i + 10, plman.GetPlaylistName(i));
		}
		add.AppendTo(menu, MF_STRING, "Add to other playlist");
		menu.AppendMenuSeparator();

		if (ppt.library) {
			sub.AppendMenuItem(MF_STRING, 1000, "Send to default playlist and play");
			sub.AppendMenuItem(MF_STRING, 1001, "Send to default playlist");
			sub.CheckMenuRadioItem(1000, 1001, ppt.sendto_playlist_play ? 1000 : 1001);
			sub.AppendMenuSeparator();

			sub.AppendMenuItem(MF_STRING, 1002, "Default playlist name")
			sub.AppendTo(menu, MF_STRING, "Double click");

			menu.AppendMenuSeparator();
		}

		context.InitContext(this.selected_handles);
		context.BuildMenu(menu, 10000);

		var idx = menu.TrackPopupMenu(x, y);
		menu.Dispose();

		switch (idx) {
		case 0:
			break;
		case 1:
			var base = plman.GetPlaylistItemCount(g_active_playlist);
			plman.InsertPlaylistItems(g_active_playlist, base, this.selected_handles);
			break;
		case 2:
			var name = "";
			if (this.selected_indexes.length == 1 && !(ppt.showAllItem && this.selected_indexes[0] == 0)) {
				name = group_objects[ppt.tagMode].playlist_tfo.EvalWithMetadb(this.selected_handles.GetItem(0));
			}
			var p = plman.CreatePlaylist(plman.PlaylistCount, name);
			plman.ActivePlaylist = p
			plman.InsertPlaylistItems(p, 0, this.selected_handles);
			break;
		case 1000:
		case 1001:
			ppt.sendto_playlist_play = idx == 1000;
			window.SetProperty("SMOOTH.SENDTO.PLAYLIST.PLAY", ppt.sendto_playlist_play);
			break;
		case 1002:
			var tmp = utils.InputBox("Enter default playlist name", window.Name, ppt.sendto_playlist);
			if (tmp.length && tmp != ppt.sendto_playlist) {
				ppt.sendto_playlist = tmp;
				window.SetProperty("SMOOTH.SENDTO.PLAYLIST", ppt.sendto_playlist);
			}
			break;
		default:
			if (idx < 1000) {
				var target_playlist = idx - 10;
				plman.UndoBackup(target_playlist);
				var base = plman.GetPlaylistItemCount(target_playlist);
				plman.InsertPlaylistItems(target_playlist, base, this.selected_handles);
				plman.ActivePlaylist = target_playlist;
			} else {
				context.ExecuteByID(idx - 10000);
			}
			break;
		}

		context.Dispose();
		return true;
	}

	this.settings_menu = function (x, y) {
		var menu = window.CreatePopupMenu();
		var colour_popup = window.CreatePopupMenu();
		var art_popup = window.CreatePopupMenu();

		menu.AppendMenuItem(CheckMenuIf(ppt.showHeaderBar), 1, "Header Bar");
		menu.AppendMenuSeparator();

		var colour_flag = EnableMenuIf(ppt.enableCustomColours);
		colour_popup.AppendMenuItem(CheckMenuIf(ppt.enableDynamicColours), 2, "Enable Dynamic");
		colour_popup.AppendMenuItem(CheckMenuIf(ppt.enableCustomColours), 3, "Enable Custom");
		colour_popup.AppendMenuSeparator();
		colour_popup.AppendMenuItem(colour_flag, 4, "Text");
		colour_popup.AppendMenuItem(colour_flag, 5, "Background");
		colour_popup.AppendMenuItem(colour_flag, 6, "Selected background");
		colour_popup.AppendTo(menu, MF_STRING, "Colours");

		art_popup.AppendMenuItem(CheckMenuIf(ppt.autoFill), 7, "Auto-fill");
		art_popup.AppendMenuItem(MF_STRING, 8, "Clear cache");
		art_popup.AppendTo(menu, MF_STRING, "Album Art");
		menu.AppendMenuSeparator();

		menu.AppendMenuItem(MF_STRING, 10, "Library");
		menu.AppendMenuItem(MF_STRING, 11, "Playlist");
		menu.CheckMenuRadioItem(10, 11, ppt.library ? 10 : 11);
		menu.AppendMenuSeparator();

		menu.AppendMenuItem(MF_STRING, 20, "List");
		menu.AppendMenuItem(MF_STRING, 21, "Grid");
		menu.CheckMenuRadioItem(20, 21, 20 + ppt.display);
		menu.AppendMenuSeparator();

		if (ppt.library) {
			menu.AppendMenuItem(MF_STRING, 30, "Album");
			menu.AppendMenuItem(MF_STRING, 31, "Artist");
			menu.AppendMenuItem(MF_STRING, 32, "Album Artist");
			menu.CheckMenuRadioItem(30, 32, 30 + ppt.tagMode);
			menu.AppendMenuSeparator();

			menu.AppendMenuItem(MF_STRING, 33, "Sort pattern...");
			menu.AppendMenuSeparator();
		}

		menu.AppendMenuItem(CheckMenuIf(ppt.showAllItem), 40, "Show all items");
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
		case 7:
			ppt.autoFill = !ppt.autoFill;
			window.SetProperty("SMOOTH.AUTO.FILL", ppt.autoFill);
			images.clear();
			this.populate();
			break;
		case 8:
			utils.RemoveFolderRecursive(CACHE_FOLDER, 1);
			images.clear();
			this.populate();
			break;
		case 10:
		case 11:
			ppt.library = idx == 10;
			window.SetProperty("SMOOTH.LIBRARY", ppt.library);
			this.populate();
			break;
		case 20:
		case 21:
			ppt.display = idx - 20;
			window.SetProperty("SMOOTH.DISPLAY", ppt.display);
			get_metrics();
			this.repaint();
			break;
		case 30:
		case 31:
		case 32:
			ppt.tagMode = idx - 30;
			window.SetProperty("SMOOTH.TAG.MODE", ppt.tagMode);
			this.populate();
			break;
		case 33:
			var obj = group_objects[ppt.tagMode];
			var tmp = utils.InputBox('Enter sort pattern for "' + obj.name + '"', window.Name, obj.sort_tf);
			if (tmp != obj.sort_tf) {
				obj.sort_tf = tmp;
				window.SetProperty(obj.sort_property, obj.sort_tf);
				this.populate();
			}
			break;
		case 40:
			ppt.showAllItem = !ppt.showAllItem;
			window.SetProperty("SMOOTH.SHOW.ALL.ITEMS", ppt.showAllItem);
			this.populate();
			break;
		case 50:
			window.ShowConfigure();
			break;
		}
		return true;
	}

	window.SetInterval(function () {
		if (!window.IsVisible) {
			need_repaint = true;
			return;
		}

		scroll = check_scroll(scroll);
		if (Math.abs(scroll - scroll_) >= 1) {
			scroll_ += (scroll - scroll_) / ppt.scrollSmoothness;
			isScrolling = true;
			need_repaint = true;
			if (scroll_prev != scroll)
				brw.scrollbar.updateScrollbar();
		} else {
			if (scroll_ != scroll) {
				scroll_ = scroll;
				need_repaint = true;
			}
			if (isScrolling) {
				if (scroll_ < 1)
					scroll_ = 0;
				isScrolling = false;
				need_repaint = true;
			}
		}

		if (need_repaint) {
			need_repaint = false;
			window.Repaint();
		}

		scroll_prev = scroll;

	}, ppt.refreshRate);

	window.SetTimeout(function () {
		brw.populate();
	}, 100);

	this.groups = [];
	this.rowsCount = 0;
	this.scrollbar = new oScrollbar();
	this.list = fb.CreateHandleList();
	this.selected_handles = fb.CreateHandleList();
	this.selected_indexes = [];
	this.old_active_index = -1;
	this.inputbox = new oInputbox(300, scale(20), true, "", "Filter", g_sendResponse);
}

function oGroup(index, start, metadb, groupkey, cachekey) {
	this.index = index;
	this.start = start;
	this.count = 1;
	this.metadb = metadb;
	this.groupkey = groupkey;
	this.cachekey = cachekey;
	this.cover_image = null;
	this.image_requested = false;

	var arr = this.groupkey.split(" ^^ ");
	this.artist = arr[0];
	this.album = arr[1] || "";
	this.date = arr[2] || "";

	this.finalise = function (handles) {
		this.handles = handles.Clone();
		this.count = this.handles.Count;
		this.duration = utils.FormatDuration(this.handles.CalcTotalDuration());
	}
}

function get_metrics() {
	if (ppt.display == 0) {
		ppt.rowScrollStep = 3;
	} else {
		ppt.rowScrollStep = 1;
	}

	if (ppt.showHeaderBar) {
		ppt.headerBarHeight = scale(ppt.defaultHeaderBarHeight);
	} else {
		ppt.headerBarHeight = 0;
	}
	cScrollBar.width = scale(cScrollBar.defaultWidth);
	cScrollBar.minCursorHeight = scale(cScrollBar.defaultMinCursorHeight);

	brw.setSize();
}

function check_scroll(scroll___) {
	if (scroll___ < 0) {
		scroll___ = 0;
	}

	var g1 = brw.h - (brw.totalRowsVis * brw.rowHeight);
	var end_limit = (brw.rowsCount * brw.rowHeight) - (brw.totalRowsVis * brw.rowHeight) - g1;

	if (scroll___ != 0 && scroll___ > end_limit) {
		scroll___ = end_limit;
	}

	return scroll___;
}

function g_sendResponse() {
	g_filter_text = brw.inputbox.text
	brw.populate();
}

function group_object(name, group, group_hash, sort_property, default_sort, playlist) {
	this.name = name;
	this.sort_property = sort_property;
	this.sort_tf = window.GetProperty(sort_property, default_sort);

	this.group_tfo = fb.TitleFormat(group_hash + " ^^^ " + group);
	this.playlist_tfo = fb.TitleFormat(playlist);
}

var album_obj = new group_object(
	"album",
	"$if(%album%,$if2(%album artist%,Unknown Artist),%directory%) ^^ $if2(%album%,'('Singles')') ^^ [%date%]",
	"%path%",
	"SMOOTH.SORT.ALBUM2",
	"$if(%album%,%album% | %album artist% | %date% | %discnumber% | %tracknumber% | %title%,zzz%path_sort%)",
	"%album artist% - %album%"
);

var artist_obj = new group_object(
	"artist",
	"$if2($meta(artist,0),Unknown Artist)",
	"artists$meta(artist,0)",
	"SMOOTH.SORT.ARTIST",
	"$meta(artist,0) | %date% | %album% | %discnumber% | %tracknumber% | %title%",
	"%artist%"
);

var album_artist_obj = new group_object(
	"album artist",
	"%album artist%",
	"artists%album artist%",
	"SMOOTH.SORT.ALBUM.ARTIST",
	"%album artist% | %date% | %album% | %discnumber% | %tracknumber% | %title%",
	"%album artist%"
);

var group_objects = [album_obj, artist_obj, album_artist_obj];

ppt.library = window.GetProperty("SMOOTH.LIBRARY", true); // false = active playlist
ppt.display = window.GetProperty("SMOOTH.DISPLAY", 1); // 0 = list, 1 = grid
ppt.sendto_playlist = window.GetProperty("SMOOTH.SENDTO.PLAYLIST", "Library selection");
ppt.sendto_playlist_play = window.GetProperty("SMOOTH.SENDTO.PLAYLIST.PLAY", true);
ppt.showAllItem = window.GetProperty("SMOOTH.SHOW.ALL.ITEMS", true);
ppt.tagMode = window.GetProperty("SMOOTH.TAG.MODE", 0); // 0 = album, 1 = artist, 2 = album artist

ppt.default_thumbnailWidthMin = window.GetProperty("SMOOTH.THUMB.MIN.WIDTH", 130);
ppt.default_lineHeightMin = window.GetProperty("SMOOTH.LINE.MIN.HEIGHT", 120);

var g_drag_drop = false;
var g_filter_text = "";
var brw = new oBrowser();

get_metrics();
