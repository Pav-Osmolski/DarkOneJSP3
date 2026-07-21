function oPlaylist(idx, parent) {
	this.idx = idx;
	this.name = plman.GetPlaylistName(idx);
	this.y = -1;
}

function oPlaylistManager() {
	this.h = p.list.h;
	this.woffset = 0;
	this.border = 2;
	this.playlists = [];
	this.offset = 0;
	this.totalRows = Math.floor(this.area_h / cPlaylistManager.rowHeight);
	this.scrollbar = new ScrollBar("p.playlistManager", 0, 0, cScrollBar.width, 0, 0, cPlaylistManager.rowHeight);
	this.scrollbarWidth = 0;
	this.inputbox = null;
	this.inputboxID = -1;

	this.sortNameAsc = function (obj_a, obj_b) {
		return (obj_a.name.toLowerCase() > obj_b.name.toLowerCase() ? 1 : -1);
	}
	this.sortNameDesc = function (obj_a, obj_b) {
		return (obj_a.name.toLowerCase() < obj_b.name.toLowerCase() ? 1 : -1);
	}

	this.setButtons = function () {
		// Az & zA vars
		var Az_h = cPlaylistManager.statusBarHeight;
		var Az_w = Math.floor(Az_h * 1.9);
		var left_padding = g_z2;
		var right_padding = 4;

		// normal sort Az playlist Image
		this.bt_sortAz_normal = utils.CreateImage(Az_w, Az_h);
		var gb = this.bt_sortAz_normal.GetGraphics();
		gb.FillRectangle(0, 0, 1, Az_h, blendColours(g_colour_background, g_colour_text, 0.35));
		gb.WriteTextSimple(chars.up, g_font_fluent_12, blendColours(g_colour_background, g_colour_text, 0.5), left_padding, 1, Az_w, Az_h, 0, 2);
		gb.WriteTextSimple("Az", g_font_12, blendColours(g_colour_background, g_colour_text, 0.5), 0, 0, Az_w - right_padding, Az_h, 1, 2);
		gb.FillRectangle(Az_w - 1, 0, 1, Az_h, blendColours(g_colour_background, g_colour_text, 0.35));
		this.bt_sortAz_normal.ReleaseGraphics();

		this.sortAz_button = new button(this.bt_sortAz_normal, this.bt_sortAz_normal, this.bt_sortAz_normal);

		// normal sort Za playlist Image
		this.bt_sortZa_normal = utils.CreateImage(Az_w, Az_h);
		var gb = this.bt_sortZa_normal.GetGraphics();
		gb.WriteTextSimple(chars.down, g_font_fluent_12, blendColours(g_colour_background, g_colour_text, 0.5), left_padding, 1, Az_w, Az_h, 0, 2);
		gb.WriteTextSimple("Za", g_font_12, blendColours(g_colour_background, g_colour_text, 0.5), 0, 0, Az_w - right_padding, Az_h, 1, 2);
		gb.FillRectangle(Az_w - 1, 0, 1, Az_h, blendColours(g_colour_background, g_colour_text, 0.35));
		this.bt_sortZa_normal.ReleaseGraphics();

		this.sortZa_button = new button(this.bt_sortZa_normal, this.bt_sortZa_normal, this.bt_sortZa_normal);
	}
	this.setButtons();

	this.repaint = function () {
		window.RepaintRect(this.x - this.woffset, this.y, this.w, this.h);
	}

	this.setSize = function (x, y, w, h) {
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;

		if (cPlaylistManager.visible) {
			this.woffset = this.w;
		} else {
			this.woffset = 0;
		}

		this.totalRows = Math.floor((h - cPlaylistManager.rowHeight - (cPlaylistManager.showStatusBar ? cPlaylistManager.statusBarHeight : 0)) / cPlaylistManager.rowHeight);
		this.offset = 0;

		// scrollbar resize
		this.scrollbar.reSize(this.x - this.woffset + this.w - cScrollBar.width, this.y + cPlaylistManager.rowHeight, cScrollBar.width, this.h - cPlaylistManager.rowHeight - (cPlaylistManager.showStatusBar ? cPlaylistManager.statusBarHeight : 0), 0, cPlaylistManager.rowHeight, this.offset);
		if (this.scrollbar.visible) {
			this.scrollbarWidth = this.scrollbar.w;
		} else {
			this.scrollbarWidth = 0;
		}
	}

	this.refresh = function () {
		this.playlists = [];
		this.rowTotal = plman.PlaylistCount;
		for (var i = 0; i < this.rowTotal; i++) {
			this.playlists.push(new oPlaylist(i, this));
		}
		this.max = this.rowTotal > this.totalRows ? this.totalRows : this.rowTotal;
		this.offset = 0;
		this.scrollbar.reSet(this.rowTotal, cPlaylistManager.rowHeight, this.offset);
		if (this.scrollbar.visible) {
			this.scrollbarWidth = this.scrollbar.w;
		} else {
			this.scrollbarWidth = 0;
		}
	}

	this.draw = function (gr) {
		if (this.woffset == 0)
			return;

		if (this.playlists.length != plman.PlaylistCount) this.refresh();

		var cx = this.x - this.woffset + this.border + 5;
		var cw = this.w - this.border - this.scrollbarWidth - 10;
		var ch = cPlaylistManager.rowHeight;
		var row_idx = 0;

		// panel bg
		gr.FillRectangle(this.x - this.woffset + 1, this.y + this.border, this.w, this.h - this.border, setAlpha(g_colour_background, 230));
		gr.DrawRectangle(this.x - this.woffset + this.border, this.y, this.w - this.border, this.h, 1, setAlpha(g_colour_text, 150));

		// panel header
		if (this.ishoverHeader) {
			if (g_drag_drop_playlist_manager_hover) {
				gr.FillRectangle(this.x - this.woffset + this.border, this.y, this.w - this.border, ch - 1, g_colour_text & 0x25ffffff);
				gr.DrawRectangle(this.x - this.woffset + this.border + 1, this.y + 1, this.w - this.border - 2, ch - 1 - 2, 2, g_colour_text);
				gr.WriteTextSimple("TO A NEW PLAYLIST", g_font_12, blendColours(g_colour_text, g_colour_background, 0.25), cx + g_z5, this.y, cw - g_z10, ch, 0, 2, 1);
			} else {
				gr.FillRectangle(this.x - this.woffset + this.border, this.y, this.w - this.border, ch - 1, g_colour_text & 0x15ffffff);
				gr.WriteTextSimple("PLAYLISTS", g_font_12, blendColours(g_colour_text, g_colour_background, 0.25), cx, this.y, cw - g_z5, ch, 0, 2, 1);
			}
		} else {
			if (g_drag_drop_playlist_manager_hover) {
				gr.FillRectangle(this.x - this.woffset + this.border, this.y, this.w - this.border, ch - 1, g_colour_text & 0x15ffffff);
				gr.WriteTextSimple("TO A NEW PLAYLIST", g_font_12, blendColours(g_colour_text, g_colour_background, 0.25), cx + g_z5, this.y, cw - g_z10, ch, 0, 2, 1);
			} else {
				gr.FillRectangle(this.x - this.woffset + this.border, this.y, this.w - this.border, ch - 1, g_colour_text & 0x15ffffff);
				gr.WriteTextSimple("PLAYLISTS", g_font_12, blendColours(g_colour_text, g_colour_background, 0.25), cx, this.y, cw - g_z5, ch, 0, 2, 1);
			}
		}

		gr.FillRectangle(this.x - this.woffset + this.border, this.y + ch - 2, this.w - this.border, 1, g_colour_text & 0x30ffffff);

		cx = this.x - this.woffset + this.border;
		for (var i = this.offset; i < this.playlists.length; i++) {
			var playlistIndex = this.playlists[i].idx;
			var cy = this.y + cPlaylistManager.rowHeight + row_idx * ch;
			this.playlists[i].y = cy;
			var txt_color = g_colour_text;
			var is_hovering = g_drag_drop_playlist_manager_hover && i == this.hoverId && playlist_can_add_items(playlistIndex);

			// draw selected bg if active or being hovered over
			if (playlistIndex == g_active_playlist || is_hovering) {
				gr.FillRectangle(cx + 1, cy + 1, this.w - this.border - this.scrollbarWidth - 2, ch - 2, g_colour_selection);

				if (is_hovering) { // only draw outline if hovering
					gr.DrawRectangle(cx + 1, cy + 1, this.w - this.border - this.scrollbarWidth - 2, ch - 2, 1, setAlpha(txt_color, 190));
				}
				txt_color = g_colour_selected_text;
			}

			// right clicked item
			if (cPlaylistManager.rightClickedId == i) {
				gr.DrawRectangle(cx + 1, cy + 1, this.w - this.border - this.scrollbarWidth - 2, ch - 2, 2, g_colour_text);
			}

			if (plman.IsAutoPlaylist(playlistIndex)) {
				gr.WriteTextSimple(chars.autoplaylist, g_font_fluent_12, txt_color, cx, cy, ch, ch, 2, 2);
			} else if (plman.IsPlaylistLocked(playlistIndex)) {
				gr.WriteTextSimple(chars.lock, g_font_fluent_12, txt_color, cx, cy, ch, ch, 2, 2);
			} else {
				gr.WriteTextSimple(chars.list, g_font_fluent_12, txt_color, cx, cy, ch, ch, 2, 2);
			}

			// draw INPUTBOX if rename requested
			if (this.inputboxID == i) {
				this.inputbox.draw(gr, this.x - this.woffset + this.border + scale(30), cy + 5);
			} else {
				// playlist total items
				var count = plman.GetPlaylistItemCount(playlistIndex);
				gr.WriteTextSimple(count, g_font_12, txt_color, cx + g_z10, cy, cw - g_z5, ch, 1, 2, 1);

				var count_width = "99999".calc_width2(g_font_12);
				// draw playlist name
				gr.WriteTextSimple(this.playlists[i].name, g_font_12, txt_color, cx + g_z10 + height(g_font_12), cy, cw - (g_z10 * 3) - count_width, ch, 0, 2, 1);
			}

			// draw "drag destination bar" on dragging playlist item
			if (this.ishoverItem) {
				if (cPlaylistManager.drag_target_id != this.rowTotal && cPlaylistManager.drag_target_id == i) {
					if (cPlaylistManager.drag_target_id > cPlaylistManager.drag_source_id) {
						gr.DrawRectangle(cx + 1, cy + cPlaylistManager.rowHeight, this.w - this.border - this.scrollbarWidth - 2, 1, 2, txt_color);
					} else if (cPlaylistManager.drag_target_id < cPlaylistManager.drag_source_id) {
						gr.DrawRectangle(cx + 1, cy, this.w - this.border - this.scrollbarWidth - 2, 1, 2, txt_color);
					}
				}
			} else {
				cPlaylistManager.drag_target_id = -1;
			}

			row_idx++;
		}

		// panel footer
		if (cPlaylistManager.showStatusBar) {
			var fx = this.x - this.woffset + this.border;
			var fy = this.y + this.h - cPlaylistManager.statusBarHeight;
			var fw = this.w - this.border;
			var fh = cPlaylistManager.statusBarHeight;
			gr.FillRectangle(fx, fy, fw, fh, blendColours(g_colour_background, g_colour_text, 0.01) & 0xf0ffffff);
			gr.FillRectangle(fx, fy, fw, fh, g_colour_text & 0x15ffffff);
			gr.FillRectangle(fx, fy, fw, 1, g_colour_text & 0x50ffffff);
			var status_txt = this.playlists.length + (this.playlists.length > 1 ? " PLAYLISTS" : " PLAYLIST");
			gr.WriteTextSimple(status_txt, g_font_12, blendColours(g_colour_text, g_colour_background, 0.25), fx + 5, fy, fw - 10, fh, 1, 2, 1);
			// draw sort buttons
			this.sortAz_button.draw(gr, fx, fy);
			this.sortZa_button.draw(gr, fx + this.sortAz_button.img[0].Width, fy);
		}

		// draw scrollbar
		if (this.scrollbarWidth > 0) {
			this.scrollbar.drawXY(gr, this.x - this.woffset + this.w - this.scrollbarWidth, this.y + cPlaylistManager.rowHeight);
		}
	}

	this.isHoverObject = function (x, y) {
		return (x > this.x - this.woffset && x < this.x - this.woffset + this.w - this.scrollbarWidth && y > this.y && y < this.y + this.h);
	}

	this.check = function (event, x, y, delta) {
		this.ishover = this.isHoverObject(x, y);
		this.ishoverHeader = x > this.x - this.woffset && x < this.x - this.woffset + this.w + this.scrollbarWidth && y > this.y && y <= this.y + cPlaylistManager.rowHeight;

		this.ishoverItem = x > this.x - this.woffset && x < this.x - this.woffset + this.w - this.scrollbarWidth && y > this.y + cPlaylistManager.rowHeight && y < this.y + this.h;
		if (this.ishoverItem) {
			this.hoverId = Math.floor((y - ((this.y + cPlaylistManager.rowHeight) - this.offset * cPlaylistManager.rowHeight)) / cPlaylistManager.rowHeight);
			if (this.hoverId >= this.playlists.length)
				this.hoverId = -1;
		} else {
			this.hoverId = -1;
		}

		if (this.hoverId > -1) {
			if (this.hoverId == this.inputboxID) {
				var inputbox_ishover = x > this.inputbox.x - 3 && x < this.inputbox.x + this.inputbox.w + 6 && y > this.inputbox.y && y < this.inputbox.y + this.inputbox.h;
				this.ishover = this.ishover && !inputbox_ishover;
			}
		}

		switch (event) {
		case "lbtn_down":
			this.sortAz_button.checkstate(event, x, y);
			this.sortZa_button.checkstate(event, x, y);

			if (this.inputboxID >= 0) {
				this.inputbox.check("lbtn_down", x, y);
			}

			if (this.hoverId > -1 && this.inputboxID == -1) {
				if (this.hoverId != g_active_playlist) {
					plman.ActivePlaylist = this.hoverId;
				}
				if (cPlaylistManager.visible) {
					// prepare drag item to reorder list
					cPlaylistManager.drag_clicked = true;
					cPlaylistManager.drag_source_id = this.hoverId;
				}
			} else if (this.scrollbar.visible) {
				this.scrollbar.check(event, x, y, delta);
			}
			break;
		case "lbtn_dblclk":
			this.check("lbtn_down", x, y);
			break;
		case "rbtn_up":
			if (this.inputboxID >= 0) {
				this.inputbox.check("rbtn_up", x, y);
			} else {
				if (this.hoverId > -1) {
					cPlaylistManager.rightClickedId = this.hoverId;
					full_repaint();
					this.contextMenu(x, y, this.playlists[this.hoverId].idx);
				} else if (this.ishover) {
					this.contextMenu(x, y, -1);
				}
			}
			break;
		case "lbtn_up":
			if (this.inputboxID >= 0) {
				this.inputbox.check("lbtn_up", x, y);
			} else {
				if (this.scrollbar.visible)
					this.scrollbar.check(event, x, y, delta);

				if (this.sortAz_button.checkstate(event, x, y) == ButtonStates.hover) {
					plman.SortPlaylistsByName(1);
					this.refresh();
					full_repaint();
				}
				if (this.sortZa_button.checkstate(event, x, y) == ButtonStates.hover) {
					plman.SortPlaylistsByName(-1);
					this.refresh();
					full_repaint();
				}

				// hide playlist manager panel if not visible by default
				if (!cPlaylistManager.visible) {
					if (cPlaylistManager.hscroll_interval) {
						window.ClearTimeout(cPlaylistManager.hscroll_interval);
						cPlaylistManager.hscroll_interval = false;
					}
					if (p.playlistManager.woffset > 0) { // if panel opened
						cPlaylistManager.hscroll_interval = window.SetInterval(function () {
							full_repaint();
							if (!cPlaylistManager.blink_interval) {
								p.playlistManager.woffset -= cPlaylistManager.step;
							}
							if (p.playlistManager.woffset <= 0) {
								p.playlistManager.woffset = 0;
								window.ClearInterval(cPlaylistManager.hscroll_interval);
								cPlaylistManager.hscroll_interval = false;
								full_repaint();
							}
						}, 16);
					}
				}

				// drop item playlist
				if (cPlaylistManager.drag_target_id > -1) {
					if (cPlaylistManager.drag_target_id == this.rowTotal) {
						plman.MovePlaylist(this.playlists[cPlaylistManager.drag_source_id].idx, this.playlists[this.rowTotal - 1].idx);
					} else {
						cPlaylistManager.drag_dropped = (cPlaylistManager.drag_source_id != cPlaylistManager.drag_target_id);
						plman.MovePlaylist(this.playlists[cPlaylistManager.drag_source_id].idx, this.playlists[cPlaylistManager.drag_target_id].idx);
					}
				}

			}

			if (cPlaylistManager.drag_moved)
				window.SetCursor(IDC_ARROW);

			cPlaylistManager.drag_clicked = false;
			cPlaylistManager.drag_moved = false;
			cPlaylistManager.drag_source_id = -1;
			cPlaylistManager.drag_target_id = -1;
			break;
		case "drag_over":
			g_drag_drop_playlist_id = this.hoverId;
			break;
		case "move":
			if (!cPlaylistManager.drag_clicked) {
				this.sortAz_button.checkstate(event, x, y);
				this.sortZa_button.checkstate(event, x, y);
			}

			if (this.inputboxID >= 0) {
				this.inputbox.check("move", x, y);
			} else {
				if (this.scrollbar.visible)
					this.scrollbar.check(event, x, y, delta);
				if (cPlaylistManager.drag_moved) {
					if (!this.ishoverHeader) {
						if (this.hoverId > -1 && this.hoverId != cPlaylistManager.drag_source_id) {
							cPlaylistManager.drag_target_id = this.hoverId;
						} else if (y > this.playlists[this.rowTotal - 1].y + cPlaylistManager.rowHeight && y < this.playlists[this.rowTotal - 1].y + cPlaylistManager.rowHeight * 2) {
							cPlaylistManager.drag_target_id = this.rowTotal;
						} else {
							cPlaylistManager.drag_target_id = -1;
						}
					}
				} else {
					if (cPlaylistManager.drag_clicked) {
						cPlaylistManager.drag_moved = true;
					}
				}
			}
			break;
		case "wheel":
			if (this.scrollbar.visible)
				this.scrollbar.check(event, x, y, delta);
			break;
		}
	}

	this.contextMenu = function (x, y, id) {
		var menu = window.CreatePopupMenu();
		var newplaylist = window.CreatePopupMenu();
		var restore = window.CreatePopupMenu();
		var context_popup = window.CreatePopupMenu();
		var context = fb.CreateContextMenuManager();

		menu.AppendMenuItem(MF_STRING, 1, "Load Playlist...");
		newplaylist.AppendMenuItem(MF_STRING, 2, "New Playlist");
		newplaylist.AppendMenuItem(MF_STRING, 3, "New Autoplaylist");
		newplaylist.AppendTo(menu, MF_STRING, "Add");

		var count = plman.RecyclerCount;
		if (count > 0) {
			var history = [];
			for (var i = 0; i < count; i++) {
				history.push(i);
				restore.AppendMenuItem(MF_STRING, 20 + i, plman.GetRecyclerName(i));
			}
			restore.AppendMenuSeparator();
			restore.AppendMenuItem(MF_STRING, 4, "Clear history");
			restore.AppendTo(menu, MF_STRING, "Restore...");
		}

		if (id > - 1) {
			menu.AppendMenuSeparator();
			var lock_name = plman.GetPlaylistLockName(id);

			menu.AppendMenuItem(MF_STRING, 5, "Duplicate this playlist");
			menu.AppendMenuItem(EnableMenuIf(playlist_can_rename(id)), 6, "Rename this playlist\tF2");
			menu.AppendMenuItem(EnableMenuIf(playlist_can_remove(id)), 7, "Remove this playlist\tDel");
			menu.AppendMenuSeparator();
			if (plman.IsAutoPlaylist(id)) {
				menu.AppendMenuItem(MF_STRING, 8, lock_name + " properties");
				menu.AppendMenuItem(MF_STRING, 9, "Convert to a normal playlist");
			} else {
				var is_locked = plman.IsPlaylistLocked(id);
				var is_mine = lock_name == "JScript Panel 3";

				menu.AppendMenuItem(EnableMenuIf(is_mine || !is_locked), 10, "Edit playlist lock...");
				menu.AppendMenuItem(EnableMenuIf(is_mine), 11, "Remove playlist lock");
			}
			var playlist_items = plman.GetPlaylistItems(id);
			if (playlist_items.Count > 0) {
				menu.AppendMenuSeparator();
				context.InitContext(playlist_items);
				context.BuildMenu(context_popup, 1000);
				context_popup.AppendTo(menu, MF_STRING, 'Items');
			}
			playlist_items.Dispose();
		}

		var idx = menu.TrackPopupMenu(x, y);
		menu.Dispose();

		switch (idx) {
		case 0:
			break;
		case 1:
			fb.LoadPlaylist();
			break;
		case 2:
			var pl = plman.CreatePlaylist();
			plman.ActivePlaylist = pl;
			this.inputbox = new oInputbox(this.w - this.border - this.scrollbarWidth - scale(40), cPlaylistManager.rowHeight - 10, plman.GetPlaylistName(pl), "", "renamePlaylist()");
			this.inputboxID = pl;
			if (cPlaylistManager.inputbox_timeout) window.ClearTimeout(cPlaylistManager.inputbox_timeout);
			cPlaylistManager.inputbox_timeout = window.SetTimeout(inputboxPlaylistManager_activate, 20);
			break;
		case 3:
			var pl = plman.CreateAutoPlaylist(plman.PlaylistCount, "", "");
			plman.ActivePlaylist = pl;
			plman.ShowAutoPlaylistUI(pl);
			this.inputbox = new oInputbox(this.w - this.border - this.scrollbarWidth - scale(40), cPlaylistManager.rowHeight - 10, plman.GetPlaylistName(pl), "", "renamePlaylist()");
			this.inputboxID = pl;
			if (cPlaylistManager.inputbox_timeout) window.ClearTimeout(cPlaylistManager.inputbox_timeout);
			cPlaylistManager.inputbox_timeout = window.SetTimeout(inputboxPlaylistManager_activate, 20);
			break;
		case 4:
			plman.RecyclerPurge(history);
			break;
		case 5:
			plman.ActivePlaylist = plman.DuplicatePlaylist(id, "Copy of " + plman.GetPlaylistName(id));
			break;
		case 6:
			this.inputbox = new oInputbox(this.w - this.border - this.scrollbarWidth - scale(40), cPlaylistManager.rowHeight - 10, plman.GetPlaylistName(id), "", "renamePlaylist()");
			this.inputboxID = id;
			if (cPlaylistManager.inputbox_timeout) window.ClearTimeout(cPlaylistManager.inputbox_timeout);
			cPlaylistManager.inputbox_timeout = window.SetTimeout(inputboxPlaylistManager_activate, 20);
			break;
		case 7:
			plman.RemovePlaylistSwitch(id);
			if (this.offset > 0 && this.offset >= this.playlists.length - Math.floor((this.h - (cPlaylistManager.showStatusBar ? cPlaylistManager.statusBarHeight : 0)) / cPlaylistManager.rowHeight)) {
				this.offset--;
				this.refresh();
			}
			break;
		case 8:
			plman.ShowAutoPlaylistUI(id);
			break;
		case 9:
			plman.ActivePlaylist = plman.DuplicatePlaylist(id, plman.GetPlaylistName(id));
			plman.RemovePlaylist(id);
			break;
		case 10:
			plman.ShowPlaylistLockUI(id);
			break;
		case 11:
			plman.RemovePlaylistLock(id);
			break;
		default:
			if (idx < 99) {
				plman.RecyclerRestore(idx - 20);
				plman.ActivePlaylist = plman.PlaylistCount - 1;
			} else if (idx >= 1000) {
				context.ExecuteByID(idx - 1000);
			}
			break;
		}
		context.Dispose();
		cPlaylistManager.rightClickedId = null;
		full_repaint();
		return true;
	}
}
