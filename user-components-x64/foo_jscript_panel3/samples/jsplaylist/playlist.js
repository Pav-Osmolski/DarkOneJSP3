function oGroup(index, start, metadb, group_key) {
	this.index = index;
	this.start = start;
	this.metadb = metadb;
	this.group_key = group_key;
	this.count = 1;
	this.total_time_length = 0;
	this.total_group_duration_txt = "";
	this.totalPreviousRows = 0;

	this.finalise = function (count, total_time_length) {
		this.count = count;
		this.total_time_length = total_time_length;
		this.total_group_duration_txt = utils.FormatDuration(total_time_length);
	}
}

function oItem(row_index, type, metadb, track_index, group_index, track_index_in_group, heightInRow, groupRowDelta, obj) {
	this.row_index = row_index;
	this.type = type; // 0 track, 1 group
	this.metadb = metadb;
	this.track_index = track_index;
	this.group_index = group_index;
	this.track_index_in_group = track_index_in_group;
	this.heightInRow = heightInRow;
	this.groupRowDelta = groupRowDelta;
	this.obj = obj;

	if (this.type == 1 && this.metadb) {
		var tfo = get_tfo(p.list.groupby[cGroup.pattern_idx].l1 + "^^" + p.list.groupby[cGroup.pattern_idx].r1 + "^^" + p.list.groupby[cGroup.pattern_idx].l2 + "^^" + p.list.groupby[cGroup.pattern_idx].r2);
		var arr = tfo.EvalWithMetadb(this.metadb).split("^^");

		this.l1 = arr[0]
		this.r1 = arr[1];
		this.l2 = arr[2];
		this.r2 = arr[3];
	}

	this.drawRowContents = function (gr, is_selected, paintState) {
		var is_focused = p.list.focusedTrackId == this.track_index;
		var is_playing = paintState.playingPlaylist == g_active_playlist && paintState.playingItem == this.track_index;
		var txt_color = is_selected ? g_colour_selected_text : g_colour_text;
		var fader_txt = setAlpha(txt_color, 180);
		var rating_colour = g_dynamic ? txt_color : g_colour_rating;
		var mood_colour = g_dynamic ? txt_color : g_colour_mood;

		if (is_selected) {
			gr.FillRectangle(this.x, this.y, this.w, this.h, g_colour_selection);
		}

		if (is_focused) {
			DrawRectangle(gr, this.x, this.y, this.w - 1, this.h - 1, fader_txt);
		}

		if (cList.enableExtraLine) {
			var tf1_y = this.y;
			var tf1_h = (this.h / 2) + 2;
			var tf2_y = this.y + (this.h / 2);
			var tf2_h = (this.h / 2) - 2;
		} else {
			var tf1_y = this.y;
			var tf1_h = this.h;
			var tf2_y = 0;
			var tf2_h = 0;
		}

		columns.mood_x = ww;
		columns.rating_x = ww;

		var lovedSync = paintState.lovedSync;
		var secondaryPattern = paintState.secondaryPattern;
		var forceFresh = is_playing && g_playlist_render_cache && g_playlist_render_cache.requiresCurrentRefresh();
		var renderData = g_playlist_render_cache
			? g_playlist_render_cache.getConfigured(this.track_index, forceFresh, paintState.dynamicGeneration)
			: {
				primary: get_tfo(g_tf_pattern).EvalActivePlaylistItem(this.track_index).split("^^"),
				secondary: secondaryPattern ? get_tfo(secondaryPattern).EvalActivePlaylistItem(this.track_index).split("^^") : [],
				loved: lovedSync ? get_tfo("$if2(%lfm_loved%,0)").EvalActivePlaylistItem(this.track_index) : null
			};
		var tf_arr = renderData.primary;
		var tf2_arr = renderData.secondary;

		for (var j = 0; j < p.headerBar.columns.length; j++) {
			if (p.headerBar.columns[j].w > 0) {
				var cx = p.headerBar.columns[j].x + g_z5;
				var cw = (Math.abs(p.headerBar.w * p.headerBar.columns[j].percent / 100000)) - g_z10;
				switch (p.headerBar.columns[j].ref) {
				case "State":
					switch (p.headerBar.columns[j].align) {
					case 0:
						// do nothing
						break;
					case 1:
						cx += cw - g_queue_width;
						break;
					case 2:
						cx += (cw - g_queue_width) / 2;
						break;
					};

					if (is_playing) {
						if (paintState.isPaused) {
							gr.WriteTextSimple(chars.pause, g_font_fluent_20, txt_color, cx, this.y + 2, g_queue_width, cRow.playlist_h - 4, 2, 2);
						} else {
							gr.WriteTextSimple(chars.play, g_font_fluent_20, g_seconds % 2 == 0 ? txt_color : setAlpha(txt_color, 60), cx + 2, this.y + 2, g_queue_width, cRow.playlist_h - 4, 2, 2);
						}
					} else {
						var queue_index = tf_arr[j];
						if (queue_index.length) {
							DrawRectangle(gr, cx, this.y + 2, g_queue_width, cRow.playlist_h - 5, txt_color);
							gr.WriteTextSimple(queue_index, g_font_20_bold, txt_color, cx + 1, this.y + 1, g_queue_width, cRow.playlist_h - 4, 2, 2, 1, 1);
						}
					}
					break;
				case "Mood":
					columns.mood_w = cRow.playlist_h;
					p.headerBar.columns[j].minWidth = 36;
					switch (p.headerBar.columns[j].align) {
					case 0:
						columns.mood_x = cx;
						break;
					case 1:
						columns.mood_x = cx + (cw - columns.mood_w);
						break;
					case 2:
						columns.mood_x = cx + ((cw - columns.mood_w) / 2);
						break;
					}

					if (lovedSync) {
						this.mood = renderData.loved;
					} else {
						this.mood = StripCode(tf_arr[j], chars.etx) || 0;
					}

					gr.WriteTextSimple(this.mood == 0 ? chars.heart_off : chars.heart_on, g_font_fluent_20, mood_colour, columns.mood_x, this.y, columns.mood_w, cRow.playlist_h, 2, 2);
					break;
				case "Rating":
					cw = p.headerBar.columns[j].w - g_z5;
					p.headerBar.columns[j].minWidth = columns.rating_w; // columns.rating_w set inside get_font
					switch (p.headerBar.columns[j].align) {
					case 0:
						columns.rating_x = cx;
						break;
					case 1:
						columns.rating_x = cx + (cw - columns.rating_w);
						break;
					case 2:
						columns.rating_x = cx + ((cw - columns.rating_w) /2);
						break;
					}

					this.rating = StripCode(tf_arr[j], chars.etx) || 0;
					gr.WriteTextSimple(chars.rating_off.repeat(5), g_font_fluent_20, rating_colour & 0x20ffffff, columns.rating_x, this.y, columns.rating_w, cRow.playlist_h, 0, 2);
					gr.WriteTextSimple(chars.rating_on.repeat(this.rating), g_font_fluent_20, rating_colour, columns.rating_x, this.y, columns.rating_w, cRow.playlist_h, 0, 2);
					break;
				default:
					this.drawText(gr, tf_arr[j], g_font_12, txt_color, cx, tf1_y, cw, tf1_h, p.headerBar.columns[j].align);
					if (cList.enableExtraLine) this.drawText(gr, tf2_arr[j], g_font_12, fader_txt, cx, tf2_y, cw, tf2_h, p.headerBar.columns[j].align);
					break;
				}
			}
		}
	}

	this.drawText = function (gr, text, font, colour, x, y, w, h, align) {
		if (!text)
			return;

		if (g_dynamic) {
			// WriteTextSimple ignores $rgb code
			gr.WriteTextSimple(text, font, colour, x, y, w, h, align, 2, 1, 1);
		} else {
			gr.WriteText(text, font, colour, x, y, w, h, align, 2, 1, 1);
		}
	}

	this.draw = function (gr, x, y, w, h, paintState) {
		var is_item_selected = this.type == 0 && plman.IsPlaylistItemSelected(g_active_playlist, this.track_index);
		var cover_size = 0;
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;

		if (this.type == 0) { // track
			if (paintState.isPlaying && paintState.playingPlaylist == g_active_playlist && this.track_index == paintState.playingItem) {
				p.list.nowplaying_y = this.y;
			}
			this.drawRowContents(gr, is_item_selected, paintState);

			if (!properties.showgroupheaders && this.track_index_in_group == 0) {
				gr.FillRectangle(this.x, this.y, this.w, 2, g_colour_text & 0x10ffffff);
			}

			if (this.ishover && g_drag_drop_status && g_drag_drop_row_id > -1 && this.row_index == g_drag_drop_row_id) {
				gr.FillRectangle(this.x, this.y - Math.floor(cList.borderWidth / 2), this.w, cList.borderWidth, g_colour_selection);
				gr.FillRectangle(this.x, this.y - Math.floor(cList.borderWidth / 2) - 3 * cList.borderWidth, cList.borderWidth, 7 * cList.borderWidth, g_colour_selection);
				gr.FillRectangle(this.x + this.w - cList.borderWidth, this.y - Math.floor(cList.borderWidth / 2) - 3 * cList.borderWidth, cList.borderWidth, 7 * cList.borderWidth, g_colour_selection);
			}
		} else if (this.type == 1) { // group header
			var groupDelta = this.groupRowDelta * cRow.playlist_h;

			gr.FillRectangle(this.x, (this.y - groupDelta) + 1, this.w, this.h - 2, setAlpha(g_colour_text, 8));
			gr.FillRectangle(this.x, (this.y - groupDelta) - 1 + this.h, this.w, 1, setAlpha(g_colour_text, 25));

			if (this.obj && this.heightInRow > 1 && cover.show) {
				cover_size = this.heightInRow * cRow.playlist_h;;

				var cv_x = Math.floor(this.x + g_z5);
				var cv_y = Math.floor((this.y - groupDelta) + g_z5);
				var cv_s = Math.floor(cover_size - g_z10);
				if (!this.obj.cover_img) {
					this.obj.cover_img = g_image_cache.get(this.metadb, this.obj.group_key);
				}
				DrawCover(gr, this.obj.cover_img || g_stub_image, cv_x, cv_y, cv_s, cv_s);
			} else {
				cover_size = g_z4;
			}

			var text_left_padding = g_z2;
			var scrollbar_gap = (p.scrollbar.visible && (p.list.totalRows > p.list.totalRowVisible)) ? 0 : cScrollBar.width;
			var lg1_right_field_w = this.r1.calc_width2(g_font_group1) + 20;
			var lg2_right_field_w = this.r2.calc_width2(g_font_group2) + 20;

			var group_text_colour = g_colour_highlight;
			var group_text_colour_fader = setAlpha(group_text_colour, 180);

			if (this.heightInRow == 1) {
				this.drawText(gr, this.l1 + " / " + this.l2, g_font_group1, group_text_colour, this.x + cover_size + text_left_padding, (this.y - groupDelta) - 1, this.w - cover_size - text_left_padding * 4 - lg1_right_field_w - scrollbar_gap, this.h, 0);
				this.drawText(gr, this.r1, g_font_group1, group_text_colour, this.x + cover_size + text_left_padding, (this.y - groupDelta) - 1, this.w - cover_size - text_left_padding * 5 + 2 - scrollbar_gap, this.h, 1);
				gr.FillRectangle(this.x + cover_size + text_left_padding, Math.round(this.y + cRow.playlist_h * 1 - groupDelta - 5), this.w - cover_size - text_left_padding * 5 + 2 - scrollbar_gap, 1, group_text_colour);
			} else {
				this.drawText(gr, this.l1, g_font_group1, group_text_colour, this.x + cover_size + text_left_padding, (this.y - groupDelta) + 3, this.w - cover_size - text_left_padding * 4 - lg1_right_field_w - scrollbar_gap, cRow.playlist_h, 0);
				this.drawText(gr, this.l2, g_font_group2, group_text_colour_fader, this.x + cover_size + text_left_padding, (this.y + cRow.playlist_h - groupDelta) - 4, this.w - cover_size - text_left_padding * 4 - lg2_right_field_w - scrollbar_gap, cRow.playlist_h, 0);
				this.drawText(gr, this.r1, g_font_group1, group_text_colour, this.x + cover_size + text_left_padding, (this.y - groupDelta) + 3, this.w - cover_size - text_left_padding * 5 + 2 - scrollbar_gap, cRow.playlist_h, 1);
				this.drawText(gr, this.r2, g_font_group2, group_text_colour_fader, this.x + cover_size + text_left_padding, (this.y + cRow.playlist_h - groupDelta) - 4, this.w - cover_size - text_left_padding * 5 + 1 - scrollbar_gap, cRow.playlist_h, 1);

				var line_x = this.x + cover_size + text_left_padding;
				var line_y = this.y + (cRow.playlist_h * 2) - groupDelta - 8;
				var line_w = this.w - line_x - scrollbar_gap - (text_left_padding * 2);
				gr.FillRectangle(line_x, line_y, line_w, 1, group_text_colour);

				if (this.obj && this.heightInRow > 2) {
					var lg3_left_field = this.obj.count + (this.obj.count > 1 ? " tracks. " : " track. ") + this.obj.total_group_duration_txt + ".";
					gr.WriteTextSimple(lg3_left_field, g_font_12, group_text_colour_fader, line_x, line_y + 6, line_w, cRow.playlist_h, 0, 0, 1);
				}
			}

			if (this.ishover && g_drag_drop_status && g_drag_drop_row_id > -1 && this.row_index == g_drag_drop_row_id) {
				gr.FillRectangle(this.x, this.y - Math.floor(cList.borderWidth / 2), this.w, cList.borderWidth, g_colour_selection);
				gr.FillRectangle(this.x, this.y - Math.floor(cList.borderWidth / 2) - 3 * cList.borderWidth, cList.borderWidth, 7 * cList.borderWidth, g_colour_selection);
				gr.FillRectangle(this.x + this.w - cList.borderWidth, this.y - Math.floor(cList.borderWidth / 2) - 3 * cList.borderWidth, cList.borderWidth, 7 * cList.borderWidth, g_colour_selection);
			}
		}
	}

	this.drag_drop_check = function (x, y, id) {
		var groupDelta = this.groupRowDelta * cRow.playlist_h;
		this.ishover = (x >= this.x && x < this.x + this.w && y >= this.y && y < this.y + this.h - groupDelta);
		if (this.ishover) {
			var trackId = p.list.getTrackId(this.row_index);
			g_drag_drop_track_id = this.track_index;
			g_drag_drop_row_id = this.row_index;
		}
	}

	this.check = function (event, x, y) {
		var is_item_selected = plman.IsPlaylistItemSelected(g_active_playlist, this.track_index);
		var groupDelta = this.groupRowDelta * cRow.playlist_h;
		this.ishover = (x >= this.x && x < this.x + this.w && y >= this.y && y < this.y + this.h - groupDelta);

		var rating_hover = (this.type == 0 && x >= columns.rating_x && x <= columns.rating_x + columns.rating_w && y > this.y + 2 && y < this.y + this.h - 2);
		var mood_hover = (this.type == 0 && x >= columns.mood_x && x <= columns.mood_x + columns.mood_w - 3 && y > this.y + 2 && y < this.y + this.h - 2);

		switch (event) {
		case "lbtn_down":
			if (this.ishover) {
				p.list.item_clicked = true;
				if (this.type == 1) { // group header
					if (utils.IsKeyPressed(VK_SHIFT)) {
						if (this.obj && p.list.focusedTrackId != this.track_index) {
							if (p.list.SHIFT_start_id != null) {
								p.list.selectAtoB(p.list.SHIFT_start_id, this.track_index + this.obj.count - 1);
							} else {
								p.list.selectAtoB(p.list.focusedTrackId, this.track_index + this.obj.count - 1);
							}
						}
					} else if (utils.IsKeyPressed(VK_CONTROL)) {
						plman.SetPlaylistFocusItem(g_active_playlist, this.track_index);
						p.list.selectGroupTracks(this.group_index, true);
						p.list.SHIFT_start_id = null;
					} else {
						plman.SetPlaylistFocusItem(g_active_playlist, this.track_index);
						plman.ClearPlaylistSelection(g_active_playlist);
						p.list.selectGroupTracks(this.group_index, true);
						p.list.SHIFT_start_id = null;
					}
				} else { // track
					if (!rating_hover && !mood_hover) {
						if (is_item_selected) {
							g_drag_drop_internal = true;
							if (utils.IsKeyPressed(VK_SHIFT)) {
								if (p.list.focusedTrackId != this.track_index) {
									if (p.list.SHIFT_start_id != null) {
										p.list.selectAtoB(p.list.SHIFT_start_id, this.track_index);
									} else {
										p.list.selectAtoB(p.list.focusedTrackId, this.track_index);
									}
								}
							} else if (utils.IsKeyPressed(VK_CONTROL)) {
								plman.SetPlaylistSelectionSingle(g_active_playlist, this.track_index, false);
							} else if (plman.GetPlaylistSelectedItems(g_active_playlist).Count == 1) {
								plman.SetPlaylistFocusItem(g_active_playlist, this.track_index);
								plman.ClearPlaylistSelection(g_active_playlist);
								plman.SetPlaylistSelectionSingle(g_active_playlist, this.track_index, true);
							}
						} else { // click on a not selected track
							if (utils.IsKeyPressed(VK_SHIFT)) {
								if (p.list.focusedTrackId != this.track_index) {
									if (p.list.SHIFT_start_id != null) {
										p.list.selectAtoB(p.list.SHIFT_start_id, this.track_index);
									} else {
										p.list.selectAtoB(p.list.focusedTrackId, this.track_index);
									}
								}
							} else {
								p.list.selX = x;
								p.list.selY = y;
								p.list.drawRectSel_click = true;
								p.list.selStartId = this.track_index;
								p.list.selStartOffset = p.list.offset;
								p.list.selEndOffset = p.list.offset;
								p.list.selDeltaRows = 0;
								p.list.selAffected.splice(0, p.list.selAffected.length);
								plman.SetPlaylistFocusItem(g_active_playlist, this.track_index);
								if (!utils.IsKeyPressed(VK_CONTROL)) {
									plman.ClearPlaylistSelection(g_active_playlist);
								}
								plman.SetPlaylistSelectionSingle(g_active_playlist, this.track_index, true);
								p.list.SHIFT_start_id = null;
							}
						}
					}
				}
			}
			break;
		case "lbtn_dblclk":
			if (this.ishover) {
				if (this.type == 1) { // group header
					p.list.setItems(false);
					full_repaint();
				} else { // track
					if (!rating_hover && !mood_hover) {
						plman.ExecutePlaylistDefaultAction(g_active_playlist, this.track_index);
					}
				}
			}
			break;
		case "lbtn_up":
			g_drag_drop_internal = false;
			if (this.ishover && this.metadb) {
				var handles = fb.CreateHandleList(this.metadb);
				var rp = this.metadb.RawPath;
				var can_tag = rp.indexOf("file://") == 0 || rp.indexOf("cdda://") == 0;

				if (rating_hover ) {
					var new_rating = Math.ceil((x - columns.rating_x) / (columns.rating_w / 5));

					if (foo_playcount) {
						if (new_rating != this.rating && new_rating > 0) {
							handles.RunContextCommand("Playback Statistics/Rating/" + new_rating);
						} else {
							handles.RunContextCommand("Playback Statistics/Rating/<not set>");
						}
					} else if (can_tag) {
						if (new_rating != this.rating && new_rating > 0) {
							handles.UpdateFileInfoFromJSON(JSON.stringify({"RATING" : new_rating}));
						} else {
							handles.UpdateFileInfoFromJSON(JSON.stringify({"RATING" : ""}));
						}
					}
				} else if (mood_hover) {
					if (properties.use_foo_lastfm_playcount_sync) {
						if (foo_lastfm_playcount_sync) {
							var loved = get_tfo("$if2(%lfm_loved%,0)").EvalWithMetadb(this.metadb);
							handles.RunContextCommand("Last.fm Playcount Sync/" + (loved == 1 ? "Unlove" : "Love"));
						}
					} else if (can_tag) {
						if (typeof this.mood == "undefined" || this.mood == 0) {
							var now_ts = new Date().getTime() / 1000;
							var now_str = utils.TimestampToDateString(now_ts);
							handles.UpdateFileInfoFromJSON(JSON.stringify({"MOOD" : now_str}));
						} else {
							handles.UpdateFileInfoFromJSON(JSON.stringify({"MOOD" : ""}));
						}
					}
				}
				handles.Dispose();
			}
			this.drawRectSel_click = false;
			this.drawRectSel = false;
			break;
		case "rbtn_up":
			if (this.ishover) {
				if (is_item_selected) {
					plman.SetPlaylistFocusItem(g_active_playlist, this.track_index);
				} else {
					if (this.type == 1) { // group header
						plman.ClearPlaylistSelection(g_active_playlist);
						plman.SetPlaylistFocusItem(g_active_playlist, this.track_index);
						p.list.selectGroupTracks(this.group_index, true);
						p.list.SHIFT_start_id = null;
					} else { // track
						plman.SetPlaylistFocusItem(g_active_playlist, this.track_index);
						plman.ClearPlaylistSelection(g_active_playlist);
						plman.SetPlaylistSelectionSingle(g_active_playlist, this.track_index, true);
					}
				}
			}
			break;
		case "move":
			// update on mouse move to draw rect selection zone
			if (!this.drawRectSel) {
				this.drawRectSel = this.drawRectSel_click;
			}
			if (p.list.drawRectSel) {
				if (this.ishover) {
					if (this.type == 0) { // track
						p.list.selEndId = this.track_index;
					} else { // group header
						if (this.track_index > 0) {
							if (y > p.list.selY) {
								if (p.list.selStartId <= p.list.selEndId) {
									if (this.track_index == this.track_index + 1) {
										p.list.selEndId = this.track_index - 0;
									} else {
										p.list.selEndId = this.track_index - 1;
									}
								} else {
									if (this.track_index == this.track_index + 1) {
										p.list.selEndId = this.track_index - 1;
									} else {
										p.list.selEndId = this.track_index - 0;
									}
								}
							} else {
								if (p.list.selStartId < p.list.selEndId) {
									if (this.track_index == this.track_index + 1) {
										p.list.selEndId = this.track_index - 0;
									} else {
										p.list.selEndId = this.track_index - 1;
									}
								} else {
									if (this.track_index == this.track_index + 1) {
										p.list.selEndId = this.track_index - 1;
									} else {
										p.list.selEndId = this.track_index - 0;
									}
								}
							}
						}
					}

					if (!cList.interval) {
						window.SetCursor(IDC_HAND);
						cList.interval = window.SetInterval(function () {
							if (mouse_y < p.list.y + cRow.playlist_h) {
								p.list.selEndId = p.list.selEndId > 0 ? p.list.items[0].track_index : 0;
								if (p.scrollbar.visible)
									on_mouse_wheel(1);
							} else if (mouse_y > p.list.y + p.list.h - cRow.playlist_h) {
								p.list.selEndId = p.list.selEndId < p.list.count - 1 ? p.list.items[p.list.items.length - 1].track_index : p.list.count - 1;
								if (p.scrollbar.visible)
									on_mouse_wheel(-1);
							}
							// set selection on items in the rect area drawn
							plman.SetPlaylistSelection(g_active_playlist, p.list.selAffected, false);
							p.list.selAffected.splice(0, p.list.selAffected.length);
							var deb = p.list.selStartId <= p.list.selEndId ? p.list.selStartId : p.list.selEndId;
							var fin = p.list.selStartId <= p.list.selEndId ? p.list.selEndId : p.list.selStartId;
							for (var i = deb; i <= fin; i++) {
								p.list.selAffected.push(i);
							}
							plman.SetPlaylistSelection(g_active_playlist, p.list.selAffected, true);
							plman.SetPlaylistFocusItem(g_active_playlist, p.list.selEndId);
							p.list.selEndOffset = p.list.offset;
						}, 100);
					} else {
						window.SetCursor(IDC_ARROW);
					}
				}
			}
			if (g_drag_drop_internal) {
				plman.GetPlaylistSelectedItems(g_active_playlist).DoDragDrop(1);
				g_drag_drop_internal = false;
			}
			break;
		}
	}
}

function oGroupBy(ref, label, tf, expandedHeight, showCover, l1, r1, l2, r2) {
	this.ref = ref;
	this.label = label;
	this.tf = tf;
	this.expandedHeight = expandedHeight;
	this.showCover = showCover;
	this.l1 = l1;
	this.r1 = r1;
	this.l2 = l2;
	this.r2 = r2;
}

function oList(object_name) {
	this.saveGroupBy = function () {
		var data = ["ref", "label", "tf", "expandedHeight", "showCover", "l1", "r1", "l2", "r2"];

		data.forEach((function (item) {
			var arr = [];
			for (var i = 0; i < this.groupby.length; i++) {
				arr.push(this.groupby[i][item]);
			}
			var str = arr.join("^^");
			window.SetProperty("JSPLAYLIST.GROUPBY2." + item, str);
		}).bind(this));
	}

	this.initGroupBy = function () {
		this.groupby = [];

		var ref = window.GetProperty("JSPLAYLIST.GROUPBY2.ref", "Album^^Custom").split("^^");
		var label = window.GetProperty("JSPLAYLIST.GROUPBY2.label", "Album Artist | Album | Disc^^Folder Structure").split("^^");
		var tf = window.GetProperty("JSPLAYLIST.GROUPBY2.tf", "%album artist%%album%%discnumber%^^$replace(%path%,%filename_ext%,)").split("^^");
		var expandedHeight = window.GetProperty("JSPLAYLIST.GROUPBY2.expandedHeight", "3^^3").split("^^");
		var showCover = window.GetProperty("JSPLAYLIST.GROUPBY2.showCover", "1^^1").split("^^");
		var l1 = window.GetProperty("JSPLAYLIST.GROUPBY2.l1", "$if(%album%,%album% ['('Disc %discnumber% of %totaldiscs%')'],)^^$directory(%path%,1)").split("^^");
		var r1 = window.GetProperty("JSPLAYLIST.GROUPBY2.r1", "[%date%]^^[%date%]").split("^^");
		var l2 = window.GetProperty("JSPLAYLIST.GROUPBY2.l2", "$if(%length%,%album artist%,Stream)^^$directory(%path%,2)").split("^^");
		var r2 = window.GetProperty("JSPLAYLIST.GROUPBY2.r2", "$if2(%genre%,Other)^^$if2(%genre%,Other)").split("^^");

		this.totalGroupBy = ref.length;
		for (var i = 0; i < this.totalGroupBy; i++) {
			this.groupby.push(new oGroupBy(ref[i], label[i], tf[i], expandedHeight[i], showCover[i], l1[i], r1[i], l2[i], r2[i]));
		}
	}

	this.getTotalRows = function () {
		var ct = 0;
		var cv = 0;
		var fin = this.groups.length;
		for (var i = 0; i < fin; i++) {
			this.groups[i].totalPreviousRows += ct;
			this.groups[i].totalPreviousTracks += cv;
			ct += this.groups[i].count + cGroup.expandedHeight;
			cv += this.groups[i].count;
		}
		return ct;
	}

	this.updateGroupByPattern = function (pattern_idx) {
		tf_group_key = get_tfo(this.groupby[pattern_idx].tf);
		cover.show = this.groupby[pattern_idx].showCover == "1";
	}

	this.init_groups = function () {
		this.groups = [];
		this.totalRows = 0;
		g_total_duration_text = utils.FormatDuration(this.handleList.CalcTotalDuration());
		if (this.count == 0)
			return;

		var previous = "";
		var g = 0, t = 0, group_duration = 0;

		var group_keys = [];
		if (properties.showgroupheaders) {
			this.updateGroupByPattern(cGroup.pattern_idx);
			group_keys = tf_group_key.EvalWithMetadbs(this.handleList).toArray();
		}

		for (var i = 0; i < this.count; i++) {
			var metadb = this.handleList.GetItem(i);
			var length = Math.max(metadb.Length, 0);
			var current = properties.showgroupheaders ? group_keys[i] : metadb.Path;

			if (current != previous) {
				if (g > 0) {
					this.groups[g - 1].finalise(t, group_length);
				}
				this.groups.push(new oGroup(g, i, metadb, current));
				t = 1;
				g++;
				group_length = length;
				previous = current;
			} else {
				t++;
				group_length += length;
			}
		}

		this.groups[g - 1].finalise(t, group_length);
		this.totalRows = this.getTotalRows();
	}

	this.updateHandleList = function () {
		if (properties.showgroupheaders) {
			cGroup.expandedHeight = Math.floor(this.groupby[cGroup.pattern_idx].expandedHeight);
		} else {
			cGroup.expandedHeight = 0;
		}

		this.focusedTrackId = plman.GetPlaylistFocusItemIndex(g_active_playlist);
		if (this.handleList) this.handleList.Dispose();
		this.handleList = plman.GetPlaylistItems(g_active_playlist);
		this.count = this.handleList.Count;
		this.init_groups();
		this.getStartOffsetFromFocusId();
	}

	this.setSize = function (x, y, w, h) {
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		this.totalRowVisible = Math.floor(this.h / cRow.playlist_h);
		this.totalRowToLoad = this.totalRowVisible + 1;
	}

	this.selectAtoB = function (start_id, end_id) {
		var affectedItems = [];

		if (this.SHIFT_start_id == null) {
			this.SHIFT_start_id = start_id;
		}

		plman.ClearPlaylistSelection(g_active_playlist);

		var previous_focus_id = this.focusedTrackId;

		if (start_id < end_id) {
			var deb = start_id;
			var fin = end_id;
		} else {
			var deb = end_id;
			var fin = start_id;
		}

		for (var i = deb; i <= fin; i++) {
			affectedItems.push(i);
		}
		plman.SetPlaylistSelection(g_active_playlist, affectedItems, true);
		plman.SetPlaylistFocusItem(g_active_playlist, end_id);

		if (affectedItems.length > 1) {
			if (end_id > previous_focus_id) {
				var delta = end_id - previous_focus_id;
				this.SHIFT_count += delta;
			} else {
				var delta = previous_focus_id - end_id;
				this.SHIFT_count -= delta;
			}
		}
	}

	this.selectGroupTracks = function (gp_id, state) {
		var affectedItems = [];
		var first_trk = this.groups[gp_id].start;
		var total_trks = this.groups[gp_id].count;
		for (var i = first_trk; i < first_trk + total_trks; i++) {
			affectedItems.push(i);
		}
		plman.SetPlaylistSelection(g_active_playlist, affectedItems, state);
	}

	this.getStartOffsetFromFocusId = function () {
		this.focusedTrackId = plman.GetPlaylistFocusItemIndex(g_active_playlist);
		if (this.focusedTrackId == -1) {
			this.offset = 0;
		} else {
			this.focusedRowId = this.getRowId(this.focusedTrackId);
			if (this.totalRows > this.totalRowVisible) {
				var mid = Math.floor(this.totalRowToLoad / 2) - 1;
				if (this.focusedRowId <= mid) {
					this.offset = 0;
				} else {
					var d = this.totalRows - (this.focusedRowId + 1);
					if (d >= Math.floor(this.totalRowToLoad / 2)) {
						this.offset = this.focusedRowId - mid;
					} else {
						this.offset = this.totalRows - this.totalRowVisible;
					}
				}
				if (this.offset < 0)
					this.offset = 0;
			} else {
				this.offset = 0;
			}
		}
		return this.offset;
	}

	this.getGroupIdfromTrackId = function (valeur) {
		var mediane = 0;
		var deb = 0;
		var fin = this.groups.length - 1;
		while (deb <= fin) {
			mediane = Math.floor((fin + deb) / 2);
			if (valeur >= this.groups[mediane].start && valeur < this.groups[mediane].start + this.groups[mediane].count) {
				return mediane;
			} else if (valeur < this.groups[mediane].start) {
				fin = mediane - 1;
			} else {
				deb = mediane + 1;
			}
		}
		return -1;
	}

	this.getGroupIdFromRowId = function (valeur) {
		var mediane = 0;
		var deb = 0;
		var fin = this.groups.length - 1;
		while (deb <= fin) {
			mediane = Math.floor((fin + deb) / 2);
			grp_height = cGroup.expandedHeight;
			grp_size = grp_height + this.groups[mediane].count;
			if (valeur >= this.groups[mediane].totalPreviousRows && valeur < this.groups[mediane].totalPreviousRows + grp_size) {
				return mediane;
			} else if (valeur < this.groups[mediane].totalPreviousRows) {
				fin = mediane - 1;
			} else {
				deb = mediane + 1;
			}
		}
		return -1;
	}

	this.getRowId = function (trackId) {
		var grp_id = this.getGroupIdfromTrackId(trackId);
		return this.groups[grp_id].totalPreviousRows + cGroup.expandedHeight + (trackId - this.groups[grp_id].start);
	}

	this.getTrackId = function (rowId) {
		this.s_group_id = this.getGroupIdFromRowId(rowId);
		if (this.s_group_id >= 0) {
			this.s_group_height = cGroup.expandedHeight;

			var a = rowId - this.groups[this.s_group_id].totalPreviousRows;
			if (a < this.s_group_height) { // row is in the group header
				this.s_groupheader_line_id = a;
				this.s_track_id = this.groups[this.s_group_id].start;
			} else { // row is a track
				this.s_groupheader_line_id = -1;
				this.s_track_id = (a - this.s_group_height) + this.groups[this.s_group_id].start;
			}
			return this.s_track_id;
		}
		return 0;
	}

	this.scrollItems = function (delta, scrollstep, from_mouse_wheel) {
		if (from_mouse_wheel && !cList.wheel_snap) {
			scroll_wheel_freely(delta);
			return;
		}

		reset_free_wheel_scroll();
		var old_offset = this.offset;
		cList.scroll_direction = (delta < 0 ? -1 : 1);
		if (delta > 0) { // scroll up
			this.offset -= scrollstep;
			if (this.offset < 0)
				this.offset = 0;
		} else { // scroll down
			this.offset += scrollstep;
			if (this.offset > this.totalRows - this.totalRowVisible) {
				this.offset = this.totalRows - this.totalRowVisible;
			}
			if (this.offset < 0)
				this.offset = 0;
		}
		this.setItems(false);
		p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);

		if (properties.smoothscrolling && old_offset != this.offset)
			set_scroll_delta();

		if (!p.list.drawRectSel)
			full_repaint();
	}

	this.setItems = function (forceFocus) {
		var track_index_in_group = 0;
		var row_index = 0;
		if (forceFocus) { // from focus item centered in panel
			if (this.totalRows > this.totalRowVisible) {
				var i = this.getStartOffsetFromFocusId();
				if (this.totalRows - this.offset <= this.totalRowVisible) {
					var total_rows_to_draw = this.totalRows < this.totalRowVisible ? this.totalRows : this.totalRowVisible;
				} else {
					var total_rows_to_draw = this.totalRows < this.totalRowToLoad ? this.totalRows : this.totalRowToLoad;
				}

				this.items.splice(0, this.items.length);
				while (i < this.offset + total_rows_to_draw) {
					this.getTrackId(i);
					if (this.s_groupheader_line_id >= 0) { // group header
						this.items.push(new oItem(row_index, 1, this.handleList.GetItem(this.s_track_id), this.s_track_id, this.s_group_id, 0, this.s_group_height, this.s_groupheader_line_id, this.groups[this.s_group_id]));
						i += this.s_group_height - this.s_groupheader_line_id;
						row_index += this.s_group_height - this.s_groupheader_line_id;
					} else { // track row
						track_index_in_group = this.s_track_id - this.groups[this.s_group_id].start;
						this.items.push(new oItem(row_index, 0, this.handleList.GetItem(this.s_track_id), this.s_track_id, this.s_group_id, track_index_in_group, 1, 0, null));
						i++;
						row_index++;
					}
				}
			} else {
				this.offset = 0;
				var i = 0; // offset = 0

				this.items.splice(0, this.items.length);
				while (i < this.totalRows) {
					this.getTrackId(i);
					if (this.s_groupheader_line_id >= 0) { // group header
						this.items.push(new oItem(row_index, 1, this.handleList.GetItem(this.s_track_id), this.s_track_id, this.s_group_id, 0, this.s_group_height, this.s_groupheader_line_id, this.groups[this.s_group_id]));
						i += this.s_group_height - this.s_groupheader_line_id;
						row_index += this.s_group_height - this.s_groupheader_line_id;
					} else { // track row
						track_index_in_group = this.s_track_id - this.groups[this.s_group_id].start;
						this.items.push(new oItem(row_index, 0, this.handleList.GetItem(this.s_track_id), this.s_track_id, this.s_group_id, track_index_in_group, 1, 0, null));
						i++;
						row_index++;
					}
				}
			}
		} else { // fill items from current offset
			if (this.totalRows > this.totalRowVisible) {
				if (typeof this.offset == "undefined") {
					this.getStartOffsetFromFocusId();
				}

				var i = this.offset;
				if (this.totalRows - this.offset <= this.totalRowVisible) {
					var total_rows_to_draw = this.totalRows < this.totalRowVisible ? this.totalRows : this.totalRowVisible;
				} else {
					var total_rows_to_draw = this.totalRows < this.totalRowToLoad ? this.totalRows : this.totalRowToLoad;
				}

				this.items.splice(0, this.items.length);
				while (i < this.offset + total_rows_to_draw) {
					this.getTrackId(i);
					if (this.s_groupheader_line_id >= 0) { // group header
						this.items.push(new oItem(row_index, 1, this.handleList.GetItem(this.s_track_id), this.s_track_id, this.s_group_id, 0, this.s_group_height, this.s_groupheader_line_id, this.groups[this.s_group_id]));
						i += this.s_group_height - this.s_groupheader_line_id;
						row_index += this.s_group_height - this.s_groupheader_line_id;
					} else { // track row
						track_index_in_group = this.s_track_id - this.groups[this.s_group_id].start;
						this.items.push(new oItem(row_index, 0, this.handleList.GetItem(this.s_track_id), this.s_track_id, this.s_group_id, track_index_in_group, 1, 0, null));
						i++;
						row_index++;
					}
				}
			} else {
				var i = 0; // offset = 0
				this.items.splice(0, this.items.length);
				while (i < this.totalRows) {
					this.getTrackId(i);
					if (this.s_groupheader_line_id >= 0) { // group header
						this.items.push(new oItem(row_index, 1, this.handleList.GetItem(this.s_track_id), this.s_track_id, this.s_group_id, 0, this.s_group_height, this.s_groupheader_line_id, this.groups[this.s_group_id]));
						i += this.s_group_height - this.s_groupheader_line_id;
						row_index += this.s_group_height - this.s_groupheader_line_id;
					} else { // track row
						track_index_in_group = this.s_track_id - this.groups[this.s_group_id].start;
						this.items.push(new oItem(row_index, 0, this.handleList.GetItem(this.s_track_id), this.s_track_id, this.s_group_id, track_index_in_group, 1, 0, null));
						i++;
						row_index++;
					}
				}
			}
		}
	}

	this.getOffsetFromCursorPos = function () {
		var r = (this.cursorPos / this.h);
		this.offset = Math.round(r * this.totalRows);
		if (this.offset < 0)
			this.offset = 0;
	}

	this.repaintTrack = function (trackIndex) {
		if (trackIndex == null || trackIndex < 0) return false;
		for (var i = 0; i < this.items.length; i++) {
			var item = this.items[i];
			if (item.type == 0 && item.track_index == trackIndex && typeof item.y == "number") {
				window.RepaintRect(this.x, item.y, this.w, item.h || cRow.playlist_h);
				return true;
			}
		}
		return false;
	}

	this.isFocusedItemVisible = function () {
		if (this.totalRows <= this.totalRowVisible) {
			return true;
		} else {
			var fin = this.items.length;
			for (var i = 0; i < fin; i++) {
				if (this.items[i].group_index >= 0 && this.items[i].type == 0 && this.focusedTrackId == this.items[i].track_index && this.items[i].row_index < this.totalRowVisible) {
					return true;
				}
			}
		}
		return false;
	}

	this.draw = function (gr) {
		var item_h = 0;

		if (cList.free_scroll_active) {
			var expected_offset = Math.floor(cList.free_scroll_position / Math.max(1, cRow.playlist_h));
			if (this.offset != expected_offset) {
				reset_free_wheel_scroll();
				var row_top_y = this.y;
			} else {
				var row_top_y = this.y - cList.free_scroll_offset;
			}
		} else if (cList.scroll_timer) {
			var row_top_y = this.y - (cList.scroll_delta * cList.scroll_direction);
		} else {
			var row_top_y = this.y;
		}
		var width = (this.totalRows <= this.totalRowVisible || !properties.showscrollbar)
			? this.w
			: this.w - cScrollBar.width;

		this.nowplaying = plman.GetPlayingItemLocation();
		var secondaryPattern = cList.enableExtraLine ? g_tf2_pattern : "";
		var lovedSync = properties.use_foo_lastfm_playcount_sync && foo_lastfm_playcount_sync;
		if (g_playlist_render_cache) {
			g_playlist_render_cache.configure(g_tf_pattern, secondaryPattern, lovedSync);
		}
		var paintState = {
			isPlaying: fb.IsPlaying,
			isPaused: fb.IsPaused,
			playingPlaylist: this.nowplaying ? this.nowplaying.PlaylistIndex : -1,
			playingItem: this.nowplaying ? this.nowplaying.PlaylistItemIndex : -1,
			secondaryPattern: secondaryPattern,
			lovedSync: lovedSync,
			dynamicGeneration: g_playlist_dynamic_generation
		};

		var fin = this.items.length;
		for (var i = 0; i < fin; i++) {
			item_h = this.items[i].heightInRow * cRow.playlist_h;
			this.items[i].draw(gr, this.x, row_top_y, width, item_h, paintState);
			row_top_y += item_h - (this.items[i].groupRowDelta * cRow.playlist_h);
		}

		if (g_drag_drop_status && g_drag_drop_bottom) {
			var rowId = fin - 1;
			var item_height_row = (this.items[rowId].type == 0 ? 1 : this.items[rowId].heightInRow);
			var item_height = item_height_row * cRow.playlist_h;
			var limit = this.items[rowId].y + item_height;
			var rx = this.items[rowId].x;
			var ry = this.items[rowId].y;
			var rw = this.items[rowId].w;

			gr.FillRectangle(rx, ry + item_height - Math.floor(cList.borderWidth / 2), rw, cList.borderWidth, g_colour_selection);
			gr.FillRectangle(rx, ry + item_height - Math.floor(cList.borderWidth / 2) - 4 * cList.borderWidth, cList.borderWidth, 9 * cList.borderWidth, g_colour_selection);
			gr.FillRectangle(rx + rw - cList.borderWidth, ry + item_height - Math.floor(cList.borderWidth / 2) - 4 * cList.borderWidth, cList.borderWidth, 9 * cList.borderWidth, g_colour_selection);
		}

		// Draw rect selection
		if (this.drawRectSel) {
			this.selDeltaRows = this.selEndOffset - this.selStartOffset;
			if (this.selX <= mouse_x) {
				if (this.selY - this.selDeltaRows * cRow.playlist_h <= mouse_y) {
					gr.FillRectangle(this.selX, (this.selY - this.selDeltaRows * cRow.playlist_h), mouse_x - this.selX, mouse_y - (this.selY - this.selDeltaRows * cRow.playlist_h), g_colour_selection & 0x33ffffff);
					gr.DrawRectangle(this.selX, (this.selY - this.selDeltaRows * cRow.playlist_h), mouse_x - this.selX - 1, mouse_y - (this.selY - this.selDeltaRows * cRow.playlist_h) - 1, 1, g_colour_selection & 0x66ffffff);
				} else {
					gr.FillRectangle(this.selX, mouse_y, mouse_x - this.selX, this.selY - mouse_y - this.selDeltaRows * cRow.playlist_h, g_colour_selection & 0x33ffffff);
					gr.DrawRectangle(this.selX, mouse_y, mouse_x - this.selX - 1, this.selY - mouse_y - this.selDeltaRows * cRow.playlist_h - 1, 1, g_colour_selection & 0x66ffffff);
				}
			} else {
				if (this.selY - this.selDeltaRows * cRow.playlist_h <= mouse_y) {
					gr.FillRectangle(mouse_x, (this.selY - this.selDeltaRows * cRow.playlist_h), this.selX - mouse_x, mouse_y - (this.selY - this.selDeltaRows * cRow.playlist_h), g_colour_selection & 0x33ffffff);
					gr.DrawRectangle(mouse_x, (this.selY - this.selDeltaRows * cRow.playlist_h), this.selX - mouse_x - 1, mouse_y - (this.selY - this.selDeltaRows * cRow.playlist_h) - 1, 1, g_colour_selection & 0x66ffffff);
				} else {
					gr.FillRectangle(mouse_x, mouse_y, this.selX - mouse_x, this.selY - mouse_y - this.selDeltaRows * cRow.playlist_h, g_colour_selection & 0x33ffffff);
					gr.DrawRectangle(mouse_x, mouse_y, this.selX - mouse_x - 1, this.selY - mouse_y - this.selDeltaRows * cRow.playlist_h - 1, 1, g_colour_selection & 0x66ffffff);
				}
			}
		}
	}

	this.isHoverObject = function (x, y) {
		return (x > this.x && x < this.x + this.w - p.playlistManager.woffset && y > this.y && y < this.y + this.h);
	}

	this.check = function (event, x, y, delta) {
		this.ishover = this.isHoverObject(x, y);
		switch (event) {
		case "lbtn_down":
			this.mclicked = this.ishover;
			if (this.ishover) {
				this.item_clicked = false;
				for (var i = 0; i < this.items.length; i++) {
					this.items[i].check(event, x, y);
				}
				if (!p.scrollbar.isHoverObject(x, y) && x < p.scrollbar.x) {
					if (this.items.length > 0 && !this.item_clicked) {
						this.selX = x;
						this.selY = y;
						this.drawRectSel_click = true;
						this.selStartId = this.items[this.items.length - 1].track_index;
						this.selStartOffset = p.list.offset;
						this.selEndOffset = p.list.offset;
						this.selDeltaRows = 0;
						this.selAffected.splice(0, this.selAffected.length);
						if (!utils.IsKeyPressed(VK_CONTROL)) {
							plman.ClearPlaylistSelection(g_active_playlist);
						}
						this.SHIFT_start_id = null;
						full_repaint();
					}
				}
			}
			break;
		case "lbtn_up":
			if (this.ishover) {
				for (var i = 0; i < this.items.length; i++) {
					this.items[i].check(event, x, y);
				}
			}

			p.list.drawRectSel_click = false;
			p.list.drawRectSel = false;
			if (cList.interval) {
				window.ClearInterval(cList.interval);
				cList.interval = false;
			}
			if (this.mclicked) {
				window.SetCursor(IDC_ARROW);
				this.mclicked = false;
			}
			break;
		case "drag_over":
			g_drag_drop_bottom = false;
			if (this.count > 0) {
				for (var i = 0; i < this.items.length; i++) {
					this.items[i].drag_drop_check(x, y, i);
				}
				if (p.playlistManager.woffset == 0 || (cPlaylistManager.visible && x < p.playlistManager.x - p.playlistManager.woffset)) {
					var rowId = this.items.length - 1;
					var item_height_row = (this.items[rowId].type == 0 ? 1 : this.items[rowId].heightInRow);
					var limit = this.items[rowId].y + item_height_row * cRow.playlist_h;
					if (y > limit) {
						g_drag_drop_bottom = true;
						g_drag_drop_track_id = this.items[rowId].track_index;
						g_drag_drop_row_id = p.list.getTrackId(rowId);
					}
				}
			} else {
				g_drag_drop_bottom = true;
				g_drag_drop_track_id = 0;
				g_drag_drop_row_id = 0;
			}
			break;
		case "move":
			for (var i = 0; i < this.items.length; i++) {
				this.items[i].check(event, x, y);
			}
			if (!this.drawRectSel) {
				this.drawRectSel = this.drawRectSel_click;
			}
			break;
		case "lbtn_dblclk":
			if (this.ishover) {
				for (var i = 0; i < this.items.length; i++) {
					this.items[i].check(event, x, y);
				}
			}
			break;
		case "rbtn_up":
			if (this.ishover) {
				for (var i = 0; i < this.items.length; i++) {
					this.items[i].check(event, x, y);
				}
				if (this.items.length) {
					var rowId = this.items.length - 1;
					var item_height_row = (this.items[rowId].type == 0 ? 1 : this.items[rowId].heightInRow);
					var limit = this.items[rowId].y + item_height_row * cRow.playlist_h;
					if (y > limit) {
						plman.ClearPlaylistSelection(g_active_playlist);
					}
				}
				p.list.contextMenu(x, y);
			}
			break;
		}
	}

	this.contextMenu = function (x, y) {
		var menu = window.CreatePopupMenu();
		var sub = window.CreatePopupMenu();
		var smooth = window.CreatePopupMenu();
		var refresh = window.CreatePopupMenu();
		var context = fb.CreateContextMenuManager();

		var can_remove_flag = EnableMenuIf(playlist_can_remove_items(g_active_playlist));
		var can_paste_flag = EnableMenuIf(playlist_can_add_items(g_active_playlist) && fb.CheckClipboardContents());
		var colour_flag = EnableMenuIf(properties.enableCustomColours);

		menu.AppendMenuItem(MF_STRING, 1, "Panel Settings...");
		sub.AppendMenuItem(CheckMenuIf(properties.enableDynamicColours), 2, "Enable Dynamic");
		sub.AppendMenuItem(CheckMenuIf(properties.enableCustomColours), 3, "Enable Custom");
		sub.AppendMenuSeparator();
		sub.AppendMenuItem(colour_flag, 4, "Text");
		sub.AppendMenuItem(colour_flag, 5, "Highlight");
		sub.AppendMenuItem(colour_flag, 6, "Background");
		sub.AppendMenuItem(colour_flag, 7, "Selected background");
		sub.AppendMenuSeparator();
		sub.AppendMenuItem(MF_STRING, 8, "Mood");
		sub.AppendMenuItem(MF_STRING, 9, "Rating");
		sub.AppendTo(menu, MF_STRING, "Colours");

		smooth.AppendMenuItem(CheckMenuIf(properties.smoothscrolling), 100, "Enable smooth scrolling");
		smooth.AppendMenuSeparator();
		refresh.AppendMenuItem(CheckMenuIf(cList.repaint_interval == 8), 101, "8 ms (120/144 Hz)");
		refresh.AppendMenuItem(CheckMenuIf(cList.repaint_interval == 10), 102, "10 ms (100 Hz)");
		refresh.AppendMenuItem(CheckMenuIf(cList.repaint_interval == 12), 103, "12 ms (80 Hz)");
		refresh.AppendMenuItem(CheckMenuIf(cList.repaint_interval == 16), 104, "16 ms (60 Hz)");
		refresh.AppendTo(smooth, MF_STRING, "UI refresh interval");
		smooth.AppendMenuItem(MF_STRING, 105, "Set custom refresh interval...");
		smooth.AppendMenuItem(MF_STRING, 106, "Set smoothness...");
		smooth.AppendMenuItem(MF_STRING, 107, "Set wheel throttle...");
		smooth.AppendMenuItem(CheckMenuIf(cList.wheel_snap), 110, "Snap wheel scrolling to playlist rows");
		smooth.AppendMenuItem(cList.wheel_snap ? MF_GRAYED : MF_STRING, 111, "Set free-scroll wheel distance...");
		smooth.AppendMenuItem(cList.wheel_snap ? MF_STRING : MF_GRAYED, 108, "Set snapped wheel row step...");
		smooth.AppendMenuItem(CheckMenuIf(cList.scrollbar_snap), 112, "Snap scrollbar dragging to playlist rows");
		smooth.AppendMenuSeparator();
		smooth.AppendMenuItem(MF_STRING, 109, "Restore DarkOneJSP3 defaults");
		smooth.AppendTo(menu, MF_STRING, "Smooth scrolling");

		menu.AppendMenuSeparator();

		var items = plman.GetPlaylistSelectedItems(g_active_playlist);
		if (items.Count > 0) {
			if (items.Count == 1) {
				menu.AppendMenuItem(MF_STRING, 20, "Play");
				menu.SetDefault(20);
				menu.AppendMenuSeparator();
			}

			menu.AppendMenuItem(can_remove_flag, 21, "Crop");
			menu.AppendMenuItem(can_remove_flag, 22, "Remove");
			menu.AppendMenuItem(MF_STRING, 23, "Invert selection");
			menu.AppendMenuSeparator();
			menu.AppendMenuItem(can_remove_flag, 24, "Cut");
			menu.AppendMenuItem(MF_STRING, 25, "Copy");
			menu.AppendMenuItem(can_paste_flag, 26, "Paste");
			menu.AppendMenuSeparator();
			context.InitContextPlaylist();
			context.BuildMenu(menu, 1000);
		} else {
			menu.AppendMenuItem(can_paste_flag, 27, "Paste");
		}

		var idx = menu.TrackPopupMenu(x, y);
		menu.Dispose();

		switch (idx) {
		case 0:
			break;
		case 1:
			for (var i = 0; i < p.settings.pages.length; i++) {
				p.settings.pages[i].reSet();
			}
			p.settings.currentPageId = 0;
			cSettings.visible = true;
			full_repaint();
			break;
		case 2:
			properties.enableDynamicColours = !properties.enableDynamicColours;
			window.SetProperty("JSPLAYLIST.Enable Dynamic Colours", properties.enableDynamicColours);
			on_colours_changed();
			break;
		case 3:
			properties.enableCustomColours = !properties.enableCustomColours;
			window.SetProperty("JSPLAYLIST.Enable Custom Colours", properties.enableCustomColours);
			on_colours_changed();
			break;
		case 4:
			g_colour_text = utils.ColourPicker(g_colour_text);
			window.SetProperty("JSPLAYLIST.COLOUR TEXT NORMAL", g_colour_text);
			on_colours_changed();
			break;
		case 5:
			g_colour_highlight = utils.ColourPicker(g_colour_highlight);
			window.SetProperty("JSPLAYLIST.COLOUR TEXT HIGHLIGHT", g_colour_highlight);
			on_colours_changed();
			break;
		case 6:
			g_colour_background = utils.ColourPicker(g_colour_background);
			window.SetProperty("JSPLAYLIST.COLOUR BACKGROUND NORMAL", g_colour_background);
			on_colours_changed();
			break;
		case 7:
			g_colour_selection = utils.ColourPicker(g_colour_selection);
			window.SetProperty("JSPLAYLIST.COLOUR BACKGROUND SELECTED", g_colour_selection);
			on_colours_changed();
			break;
		case 8:
			g_colour_mood = utils.ColourPicker(g_colour_mood);
			window.SetProperty("JSPLAYLIST.COLOUR.MOOD", g_colour_mood);
			window.Repaint();
			break;
		case 9:
			g_colour_rating = utils.ColourPicker(g_colour_rating);
			window.SetProperty("JSPLAYLIST.COLOUR.RATING", g_colour_rating);
			window.Repaint();
			break;
		case 100:
			properties.smoothscrolling = !properties.smoothscrolling;
			window.SetProperty("JSPLAYLIST.Enable Smooth Scrolling", properties.smoothscrolling);
			if (!properties.smoothscrolling) {
				stop_smooth_scroll();
				if (cList.free_scroll_timer) {
					stop_free_wheel_scroll();
					apply_free_wheel_position(cList.free_scroll_target);
					cList.free_scroll_active = cList.free_scroll_offset > 0;
				}
				full_repaint();
			}
			break;
		case 101:
		case 102:
		case 103:
		case 104:
			set_playlist_refresh_interval([8, 10, 12, 16][idx - 101]);
			break;
		case 105:
			try {
				var refresh_ms = Number(utils.InputBox("Enter a refresh interval from 7 to 40 milliseconds. Lower values are smoother but use more CPU.", window.Name, cList.repaint_interval));
				if (!isNaN(refresh_ms)) {
					set_playlist_refresh_interval(refresh_ms);
				}
			} catch (e) {}
			break;
		case 106:
			try {
				var smoothness = Number(utils.InputBox("Enter smoothness from 1.25 to 10. Lower is snappier; higher eases more slowly.", window.Name, cList.scroll_div));
				if (!isNaN(smoothness)) {
					cList.scroll_div = Math.max(1.25, Math.min(10, smoothness));
					window.SetProperty("JSPLAYLIST.Smooth Scroll Divisor", cList.scroll_div);
				}
			} catch (e) {}
			break;
		case 107:
			try {
				var throttle = Number(utils.InputBox("Enter wheel throttle from 0 to 40 milliseconds. Use 0 for immediate response.", window.Name, cList.wheel_throttle));
				if (!isNaN(throttle)) {
					cList.wheel_throttle = Math.max(0, Math.min(40, Math.round(throttle)));
					window.SetProperty("JSPLAYLIST.Playlist Wheel Throttle (ms)", cList.wheel_throttle);
				}
			} catch (e) {}
			break;
		case 108:
			try {
				var row_step = Number(utils.InputBox("Enter the number of playlist rows moved by each wheel notch (1 to 10).", window.Name, cList.scrollstep));
				if (!isNaN(row_step)) {
					cList.scrollstep = Math.max(1, Math.min(10, Math.round(row_step)));
					window.SetProperty("JSPLAYLIST.Playlist Scroll Step", cList.scrollstep);
				}
			} catch (e) {}
			break;
		case 110:
			cList.wheel_snap = !cList.wheel_snap;
			window.SetProperty("JSPLAYLIST.Snap Wheel Scrolling To Rows", cList.wheel_snap);
			reset_free_wheel_scroll();
			p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);
			full_repaint();
			break;
		case 111:
			try {
				var default_step = cList.free_wheel_step > 0 ? cList.free_wheel_step : Math.max(4, Math.round(cRow.playlist_h * 0.65));
				var pixel_step = Number(utils.InputBox("Enter the free-scroll distance per wheel notch from 4 to 240 pixels. Enter 0 to use the automatic 65% row-height value.", window.Name, default_step));
				if (!isNaN(pixel_step)) {
					cList.free_wheel_step = pixel_step === 0 ? 0 : Math.max(4, Math.min(240, Math.round(pixel_step)));
					window.SetProperty("JSPLAYLIST.Free Wheel Step (pixels)", cList.free_wheel_step);
				}
			} catch (e) {}
			break;
		case 112:
			cList.scrollbar_snap = !cList.scrollbar_snap;
			window.SetProperty("JSPLAYLIST.Snap Scrollbar Dragging To Rows", cList.scrollbar_snap);
			if (cList.scrollbar_snap) {
				reset_free_wheel_scroll();
				p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);
			}
			full_repaint();
			break;
		case 109:
			properties.smoothscrolling = true;
			cList.scroll_div = 2;
			cList.wheel_throttle = 8;
			cList.wheel_snap = true;
			cList.scrollbar_snap = true;
			cList.free_wheel_step = 0;
			cList.scrollstep = 3;
			window.SetProperty("JSPLAYLIST.Enable Smooth Scrolling", true);
			window.SetProperty("JSPLAYLIST.Smooth Scroll Divisor", 2);
			window.SetProperty("JSPLAYLIST.Playlist Wheel Throttle (ms)", 8);
			window.SetProperty("JSPLAYLIST.Snap Wheel Scrolling To Rows", true);
			window.SetProperty("JSPLAYLIST.Snap Scrollbar Dragging To Rows", true);
			window.SetProperty("JSPLAYLIST.Free Wheel Step (pixels)", 0);
			window.SetProperty("JSPLAYLIST.Playlist Scroll Step", 3);
			reset_free_wheel_scroll();
			p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);
			set_playlist_refresh_interval(8);
			break;
		case 20:
			plman.ExecutePlaylistDefaultAction(g_active_playlist, p.list.focusedTrackId);
			break;
		case 21:
			plman.UndoBackup(g_active_playlist);
			plman.RemovePlaylistSelection(g_active_playlist, true);
			break;
		case 22:
			plman.UndoBackup(g_active_playlist);
			plman.RemovePlaylistSelection(g_active_playlist);
			break;
		case 23:
			plman.InvertSelection(g_active_playlist);
			break;
		case 24:
			items.CopyToClipboard();
			plman.UndoBackup(g_active_playlist);
			plman.RemovePlaylistSelection(g_active_playlist);
			break;
		case 25:
			items.CopyToClipboard();
			break;
		case 26:
			var pos = plman.GetPlaylistFocusItemIndex(g_active_playlist) + 1;
			this.pasteItems(pos);
			break;
		case 27:
			var pos = plman.GetPlaylistItemCount(g_active_playlist);
			this.pasteItems(pos);
			break;
		default:
			context.ExecuteByID(idx - 1000);
			break;
		}

		items.Dispose();
		context.Dispose();
		return true;
	}

	this.pasteItems = function (pos) {
		var clipboard_contents = fb.GetClipboardContents();
		plman.UndoBackup(g_active_playlist);
		plman.InsertPlaylistItems(g_active_playlist, pos, clipboard_contents);
		clipboard_contents.Dispose();
	}

	this.objectName = object_name;
	this.focusedTrackId = plman.GetPlaylistFocusItemIndex(g_active_playlist);
	this.handleList = plman.GetPlaylistItems(g_active_playlist);
	this.count = this.handleList.Count;
	this.groups = [];
	this.items = [];
	this.groupby = [];
	this.totalGroupBy = 0;
	this.SHIFT_start_id = null;
	this.SHIFT_count = 0;
	this.ishover = false;
	this.buttonclicked = false;
	this.selAffected = [];
	this.drawRectSel_click = false;
	this.drawRectSel = false;
	this.item_clicked = false;
	this.initGroupBy();
}
