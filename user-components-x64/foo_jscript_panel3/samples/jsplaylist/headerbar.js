function oBorder() {
	this.leftId = arguments[0];
	this.rightId = arguments[1];
	this.percent = arguments[2];

	this.isHover = function (x, y) {
		return (x >= this.x - 3 && x <= this.x + this.w + 2 && y >= this.y && y <= this.y + this.h);
	}

	this.on_mouse = function (event, x, y) {
		this.ishover = (x >= this.x - 3 && x <= this.x + this.w + 2 && y >= this.y && y <= this.y + this.h);
		switch (event) {
		case "lbtn_down":
			if (this.ishover) {
				this.sourceX = x;
				this.drag = true;
			}
			break;
		case "lbtn_up":
			this.drag = false;
			break;
		case "move":
			if (this.drag) {
				this.delta = x - this.sourceX;
			}
			break;
		}
	}
}

function oColumn() {
	this.label = arguments[0];
	this.tf = arguments[1];
	this.tf2 = arguments[2];
	this.percent = arguments[3];
	this.ref = arguments[4];
	this.align = Math.round(arguments[5]);
	this.sortOrder = arguments[6];
	this.minWidth = 40;
	this.drag = false;

	this.isHover = function (x, y) {
		return (x > this.x && x < this.x + this.w && y >= this.y && y <= this.y + this.h);
	}

	this.on_mouse = function (event, x, y) {
		this.ishover = (x > this.x + 2 && x < this.x + this.w - 2 && y >= this.y && y <= this.y + this.h);
		switch (event) {
		case "lbtn_down":
			if (this.ishover && this.percent > 0) {
				this.drag = true;
			}
			break;
		case "lbtn_up":
			this.drag = false;
			break;
		}
	}
}

function oHeaderBar() {
	this.resetSortIndicators = function () {
		this.sortedColumnId = -1;
		this.sortedColumnDirection = 1;
	}

	this.setButtons = function () {
		// normal playlistManager slide Image
		this.slide_close = utils.CreateImage(cScrollBar.width, this.h);
		var gb = this.slide_close.GetGraphics();
		gb.FillRectangle(0, 0, cScrollBar.width, this.h, g_colour_text & 0x15ffffff);
		gb.WriteTextSimple(chars.right, g_font_fluent_12, g_colour_text, 0, 1, cScrollBar.width, this.h, 2, 2);
		this.slide_close.ReleaseGraphics();

		// hover playlistManager slide Image
		this.slide_open = utils.CreateImage(cScrollBar.width, this.h);
		gb = this.slide_open.GetGraphics();
		gb.FillRectangle(0, 0, cScrollBar.width, this.h, g_colour_text & 0x15ffffff);
		gb.WriteTextSimple(chars.left, g_font_fluent_12, g_colour_text, 0, 1, cScrollBar.width, this.h, 2, 2);
		this.slide_open.ReleaseGraphics();

		if (cPlaylistManager.visible) {
			this.button = new button(this.slide_close, this.slide_close, this.slide_close);
		} else {
			this.button = new button(this.slide_open, this.slide_open, this.slide_open);
		}
	}

	this.setSize = function (x, y, w, h) {
		this.x = x;
		this.y = y + 1;
		this.w = w - cScrollBar.width;
		this.h = cHeaderBar.height - 1;
		this.setButtons();
		this.borderWidth = cHeaderBar.borderWidth;
	}

	this.calculateColumns = function () {
		var tmp = this.x;

		for (var i = 0; i < this.totalColumns; i++) {
			if (this.columns[i].percent > 0) {
				this.columns[i].x = tmp;
				this.columns[i].y = this.y;
				this.columns[i].w = Math.abs(this.w * this.columns[i].percent / 100000);
				this.columns[i].h = this.h;
				if (i != this.columnDraggedId || (this.columnDragged == 1)) {
					if (this.columns[i].x + this.columns[i].w >= this.x + this.w) {
						this.columns[i].w = (this.x + this.w) - this.columns[i].x + 1;
					}
					if (this.columns[i].x + this.columns[i].w < this.x + this.w && this.columns[i].x + this.columns[i].w > this.x + this.w - 4) {
						this.columns[i].w = (this.x + this.w) - this.columns[i].x + 1;
					}
				}
				tmp = this.columns[i].x + this.columns[i].w;
			} else {
				this.columns[i].x = tmp;
				this.columns[i].y = this.y;
				this.columns[i].w = 0;
				this.columns[i].h = this.h;
			}
		}
	}

	this.drawHiddenPanel = function (gr) {
		gr.FillRectangle(this.x, this.y, this.w + cScrollBar.width, 1, g_colour_text & 0x15ffffff);
	}

	this.drawColumns = function (gr) {
		var cx = 0;
		var cy = 0;
		var cw = 0;
		var sx = 0;
		var bx = 0;

		// tweak to only reset mouse cursor to arrowafter a column sorting
		if (this.columnDragged_saved == 3 && this.columnDragged == 0) {
			this.columnDragged_saved = 0;
		}

		// calc column metrics for calculating border metrics as well
		this.calculateColumns();

		// draw borders and left column from each one!
		var tmp = this.x;
		for (var i = 0; i < this.borders.length; i++) {
			var j = this.borders[i].leftId;
			this.borders[i].x = this.columns[j].x + this.columns[j].w - 1;
			this.borders[i].y = this.columns[j].y;
			this.borders[i].w = this.borderWidth;
			this.borders[i].h = this.columns[j].h;
			bx = Math.floor(this.borders[i].x - 1);

			if (this.columns[j].percent > 0) {
				cx = tmp;
				cy = this.y;
				cw = (bx - cx);
				if (j != this.columnDraggedId || (this.columnDragged == 1)) {
					// draw column header bg
					if (this.columnRightClicked == j) {
						gr.FillRectangle(cx, cy, cw, this.h, g_colour_text & 0x30ffffff);
					} else { // normal box
						if (this.columnDragged == 1 && j == this.columnDraggedId) {
							gr.FillRectangle(cx, cy, cw, this.h, g_colour_text & 0x30ffffff);
						} else {
							gr.FillRectangle(cx, cy, cw, this.h, g_colour_text & 0x15ffffff);
						}
					}
					gr.WriteTextSimple(this.columns[j].label, g_font_12_bold, g_colour_text, cx + (this.borderWidth * 2), cy + 1, cw - (this.borderWidth * 4) - 1, this.h, this.columns[j].align, 2, 1, 1);
				} else if (j == this.columnDraggedId && this.columnDragged == 2) {
					gr.FillRectangle(cx, cy, cw, this.h, RGBA(0, 0, 0, 60));
				}
			}

			if (this.borders[i].drag) {
				gr.FillRectangle(Math.floor(bx - 0), this.y, this.borders[i].w, this.h, g_colour_text);
			}
			tmp = bx + this.borderWidth;
		}

		// draw last colum at the right of the last border Object
		for (var i = this.totalColumns - 1; i >= 0; i--) {
			if (this.columns[i].percent > 0) {
				cx = tmp;
				cy = this.y;
				cw = (this.w - this.borderWidth - cx);
				if (i != this.columnDraggedId || (this.columnDragged == 1)) {
					// draw last column bg
					if (this.columnRightClicked == i) {
						gr.FillRectangle(cx, cy, cw, this.h, g_colour_text & 0x30ffffff);
					} else { // normal box
						if (this.columnDragged == 1 && i == this.columnDraggedId) {
							gr.FillRectangle(cx, cy, cw, this.h, g_colour_text & 0x30ffffff);
						} else {
							gr.FillRectangle(cx, cy, cw, this.h, g_colour_text & 0x15ffffff);
						}
					}
					gr.WriteTextSimple(this.columns[i].label, g_font_12_bold, g_colour_text, cx + (this.borderWidth * 2), cy + 1, cw - (this.borderWidth * 4) - 1, this.h, this.columns[i].align, 2, 1, 1);
				} else if (i == this.columnDraggedId && this.columnDragged == 2) {
					gr.FillRectangle(cx, cy, cw, this.h, RGBA(0, 0, 0, 70));
				}
				break;
			}
		}

		// draw dragged column header (last item drawn to be always on the top)
		if (this.columnDragged > 1 && this.columnDraggedId != null) {
			cx = Math.floor(mouse_x - this.clickX) + 2;
			cy = this.y + 3;
			// shadow
			gr.FillRectangle(cx + 4, cy + 3, Math.floor(this.columns[this.columnDraggedId].w - 2), this.h, RGBA(0, 0, 0, 10));
			gr.FillRectangle(cx + 3, cy + 2, Math.floor(this.columns[this.columnDraggedId].w - 2), this.h, RGBA(0, 0, 0, 15));
			gr.FillRectangle(cx + 2, cy + 1, Math.floor(this.columns[this.columnDraggedId].w - 2), this.h, RGBA(0, 0, 0, 30));
			// header bg
			gr.FillRectangle(cx, cy, Math.floor(this.columns[this.columnDraggedId].w - 2), this.h, g_colour_text & 0x66ffffff);
			gr.DrawRectangle(cx, cy + 1, Math.floor(this.columns[this.columnDraggedId].w - 2), this.h - 2, 2, g_colour_text);
			gr.DrawRectangle(cx + 1, cy + 2, Math.floor(this.columns[this.columnDraggedId].w - 5), this.h - 5, 1, blendColours(g_colour_text, g_colour_background, 0.55));
			// header text info
			gr.WriteTextSimple(this.columns[this.columnDraggedId].label, g_font_12_bold, g_colour_background, cx + (this.borderWidth * 2), cy + 1, this.columns[this.columnDraggedId].w - (this.borderWidth * 4) - 2, this.h, this.columns[this.columnDraggedId].align, 2, 1, 1);
		}
		// draw settings button
		this.button.draw(gr, this.x + this.w, this.y);
	}

	this.saveColumns = function () {
		var data = ["label", "tf", "tf2", "percent", "ref", "align", "sortOrder"];

		data.forEach((function (item) {
			var arr = [];
			for (var i = 0; i < this.columns.length; i++) {
				arr.push(this.columns[i][item]);
			}
			var str = arr.join("^^");

			if (item == "tf") g_tf_pattern = str;
			else if (item == "tf2") g_tf2_pattern = str;

			window.SetProperty("JSPLAYLIST.HEADERBAR2." + item, str);
		}).bind(this));
	}

	this.initColumns = function () {
		var borderPercent = 0;
		var previousColumnToDrawId = -1;
		this.columns = [];
		this.borders = [];

		var default_label = [
			"State",
			"Index",
			"#",
			"Title",
			"Date",
			"Artist",
			"Album",
			"Genre",
			"Mood",
			"Rating",
			"Plays",
			"Bitrate",
			"Time"
		].join("^^");

		var default_tf = [
			"[%queue_index%]",
			"$num(%list_index%,$len(%list_total%))",
			"$if2($num(%discnumber%,1).,)$if2($num(%tracknumber%,2),-)",
			"%title%",
			"[%date%]",
			"[%artist%]",
			"$if2(%album%,$if(%length%,Single,Stream))",
			"$if2(%genre%,Other)",
			"$if(%mood%,1,0)",
			"$if2(%rating%,0)",
			"$if2(%play_count%,0)",
			"[%__bitrate% kbps]",
			"$if(%isplaying%,[-%playback_time_remaining%],[%length%])"
		].join("^^");

		var default_tf2 = [
			"",
			"",
			"",
			"[%artist%]",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"",
			"[%__bitrate% kbps]"
		].join("^^")

		var default_percent = [8000, 0, 7000, 50000, 0, 0, 0, 0, 0, 20000, 0, 0, 15000].join("^^");
		var default_ref = ["State", "Index", "Tracknumber", "Title", "Date", "Artist", "Album", "Genre", "Mood", "Rating", "Plays", "Bitrate", "Time"].join("^^");
		var default_align = ["2", "2", "1", "0", "1", "0", "0", "0", "2", "2", "1", "2", "1"].join("^^");
		var default_sortOrder = [
			"%album artist% | $if(%album%,%date%,9999) | %album% | %discnumber% | %tracknumber% | %title%",
			"",
			"%tracknumber% | %album artist% | $if(%album%,%date%,9999) | %album% | %discnumber% | %title%",
			"%title% | %album artist% | $if(%album%,%date%,9999) | %album% | %discnumber% | %tracknumber%",
			"%date% | %album artist% | %album% | %discnumber% | %tracknumber% | %title%",
			"%artist% | $if(%album%,%date%,9999) | %album% | %discnumber% | %tracknumber% | %title%",
			"$if2(%album%,%artist%) | $if(%album%,%date%,9999) | %album artist% | %discnumber% | %tracknumber% | %title%",
			"%genre% | %album artist% | $if(%album%,%date%,9999) | %album% | %discnumber% | %tracknumber% | %title%",
			"%mood% | %album artist% | $if(%album%,%date%,9999) | %album% | %discnumber% | %tracknumber% | %title%",
			"%rating% | %album artist% | $if(%album%,%date%,9999) | %album% | %discnumber% | %tracknumber% | %title%",
			"$if2(%play_count%,0) | %album artist% | $if(%album%,%date%,9999) | %album% | %discnumber% | %tracknumber% | %title%",
			"%__bitrate% | %album artist% | $if(%album%,%date%,9999) | %album% | %discnumber% | %tracknumber% | %title%",
			"%length_seconds%"
		].join("^^");

		var label = window.GetProperty("JSPLAYLIST.HEADERBAR2.label", default_label).split("^^");
		g_tf_pattern = window.GetProperty("JSPLAYLIST.HEADERBAR2.tf", default_tf);
		g_tf2_pattern = window.GetProperty("JSPLAYLIST.HEADERBAR2.tf2", default_tf2);

		// strip null from old config
		var tf = this.split(g_tf_pattern);
		var tf2 = this.split(g_tf2_pattern);
		g_tf_pattern = tf.join("^^");
		g_tf2_pattern = tf2.join("^^");

		var percent = window.GetProperty("JSPLAYLIST.HEADERBAR2.percent", default_percent).split("^^");
		var ref = window.GetProperty("JSPLAYLIST.HEADERBAR2.ref", default_ref).split("^^");
		var align = window.GetProperty("JSPLAYLIST.HEADERBAR2.align", default_align).split("^^");
		var sortOrder = window.GetProperty("JSPLAYLIST.HEADERBAR2.sortOrder", default_sortOrder).split("^^");

		this.totalColumns = label.length;
		for (var i = 0; i < this.totalColumns; i++) {
			this.columns.push(new oColumn(label[i], tf[i], tf2[i], percent[i], ref[i], align[i], sortOrder[i]));
			if (percent[i] > 0) {
				if (previousColumnToDrawId >= 0) {
					this.borders.push(new oBorder(previousColumnToDrawId, i, borderPercent));
				}
				borderPercent += Math.round(percent[i]);
				previousColumnToDrawId = i;
			}
		}

		this.calculateColumns();
	}

	this.split = function (str) {
		return str.split("^^").map(function (item) {
			if (item == "null")
				return "";

			return item;
		});
	}

	this.buttonCheck = function (event, x, y) {
		if (!this.columnDragged && !this.borderDragged) {
			var state = this.button.checkstate(event, x, y);
			switch (event) {
			case "lbtn_down":
				if (state == ButtonStates.down) {
					this.buttonClicked = true;
				}
				break;
			case "lbtn_up":
				if (this.buttonClicked && state == ButtonStates.hover) {
					togglePlaylistManager();
					this.button.state = ButtonStates.hover;
				}
				this.buttonClicked = false;
				break;
			}
			return state;
		}
	}

	this.on_mouse = function (event, x, y, delta) {
		if (!p.scrollbar.clicked) {
			this.ishover = (x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h);

			// check settings button + toolbar if button not hover
			if (this.buttonCheck(event, x, y) != ButtonStates.hover) {
				switch (event) {
				case "lbtn_down":
					if (this.ishover) {
						// check borders:
						for (var i = 0; i < this.borders.length; i++) {
							this.borders[i].on_mouse(event, x, y);
							if (this.borders[i].drag) {
								this.borderDragged = true;
								this.borderDraggedId = i;
								full_repaint();
							}
						}
						// if no click on a border (no border drag), check columns:
						if (!this.borderDragged) {
							for (var i = 0; i < this.columns.length; i++) {
								this.columns[i].on_mouse(event, x, y);
								if (this.columns[i].drag) {
									this.clickX = x - this.columns[i].x;
									if (this.columns[i].tf || this.columns[i].sortOrder) {
										this.columnDragged = 1;
										window.SetCursor(IDC_ARROW);
									} else {
										this.columnDragged = 2;
										window.SetCursor(IDC_SIZEALL);
									}
									this.columnDraggedId = i;
									full_repaint();
									break;
								}
							}
						}
					}
					break;
				case "lbtn_up":
					if (this.borderDragged) {
						for (var i = 0; i < this.borders.length; i++) {
							if (this.borders[i].drag) {
								var percents = window.GetProperty("JSPLAYLIST.HEADERBAR2.percent").split("^^");
								percents[Math.round(this.borders[i].leftId)] = this.columns[this.borders[i].leftId].percent.toString();
								percents[Math.round(this.borders[i].rightId)] = this.columns[this.borders[i].rightId].percent.toString();
								window.SetProperty("JSPLAYLIST.HEADERBAR2.percent", percents.join("^^"));
								this.borders[i].on_mouse(event, x, y);
								full_repaint();
							}
						}
						this.borderDragged = false;
						this.borderDraggedId = -1;
						this.on_mouse("move", x, y); // call "Move" to set mouse cursor if border hover
					} else if (this.columnDragged > 0) {
						if (this.columnDragged == 1) {
							if (this.columnDraggedId == 0) {
								this.columns[0].on_mouse(event, x, y);
							}
							if (this.columnDraggedId > 0 || (this.columnDraggedId == 0 && this.columns[this.columnDraggedId].isHover(x, y))) {
								window.SetCursor(IDC_WAIT);
								this.sortedColumnDirection = (this.columnDraggedId == this.sortedColumnId) ? (0 - this.sortedColumnDirection) : 1;
								this.sortedColumnId = this.columnDraggedId;
								this.columns[this.columnDraggedId].drag = false;
								this.columnDragged = 3;
								this.columnDragged_saved = 3;
								cHeaderBar.sortRequested = true;
								plman.UndoBackup(g_active_playlist);
								if (this.columns[this.columnDraggedId].sortOrder) {
									plman.SortByFormatV2(g_active_playlist, this.columns[this.columnDraggedId].sortOrder, this.sortedColumnDirection);
								} else {
									plman.SortByFormatV2(g_active_playlist, this.columns[this.columnDraggedId].tf, this.sortedColumnDirection);
								}
								update_playlist();
							} else {
								this.columns[this.columnDraggedId].drag = false;
								this.columnDragged = 0;
								this.columnDragged_saved = 0;
							}
						} else {
							for (var i = 0; i < this.columns.length; i++) {
								this.columns[i].on_mouse(event, x, y);
							}
							this.columnDragged = 0;
							this.on_mouse("move", x, y); // call "Move" to set mouse cursor if border hover
						}
						this.columnDraggedId = null;
						full_repaint();
					}
					break;
				case "rbtn_up":
					if (this.ishover) {
						this.columnRightClicked = -1;
						for (var i = 0; i < this.columns.length; i++) {
							if (this.columns[i].percent > 0 && this.columns[i].isHover(x, y)) {
								this.columnRightClicked = i;
								full_repaint();
								break;
							}
						}
						this.contextMenu(x, y, this.columnRightClicked);
					}
					break;
				case "move":
					this.borderHover = false;
					for (var i = 0; i < this.borders.length; i++) {
						if (this.borders[i].isHover(x, y)) {
							this.borderHover = true;
							break;
						}
					}
					if (this.columnDragged < 1) {
						if (this.borderHover || this.borderDragged) {
							window.SetCursor(IDC_SIZEWE);
						} else if (p.playlistManager.inputbox) {
							if (!p.playlistManager.inputbox.ibeam_set)
								window.SetCursor(IDC_ARROW);
						} else {
							window.SetCursor(IDC_ARROW);
						}
					}
					if (this.borderDragged) {
						for (var i = 0; i < this.borders.length; i++) {
							this.borders[i].on_mouse(event, x, y);
							var d = this.borders[i].delta;
							if (this.borders[i].drag) {
								var toDoLeft = (this.columns[this.borders[i].leftId].w + d > this.columns[this.borders[i].leftId].minWidth);
								var toDoRight = (this.columns[this.borders[i].rightId].w - d > this.columns[this.borders[i].rightId].minWidth);
								if (toDoLeft && toDoRight) { // ok, we can resize the left and the right columns
									this.columns[this.borders[i].leftId].w += d;
									this.columns[this.borders[i].rightId].w -= d;
									var addedPercent = Math.abs(this.columns[this.borders[i].leftId].percent) + Math.abs(this.columns[this.borders[i].rightId].percent);
									this.columns[this.borders[i].leftId].percent = Math.abs(this.columns[this.borders[i].leftId].w / this.w * 100000);
									this.columns[this.borders[i].rightId].percent = addedPercent - this.columns[this.borders[i].leftId].percent;
									this.borders[i].sourceX = x;
									full_repaint();
								}
							}
						}
					} else if (this.columnDraggedId != 0 && (this.columnDragged == 1 || this.columnDragged == 2)) {
						this.columnDragged = 2;
						window.SetCursor(IDC_SIZEALL);
						for (var i = 1; i < this.columns.length; i++) {
							if (this.columns[i].percent > 0) {
								if (i != this.columnDraggedId) {
									if ((x > mouse_x && x > this.columns[i].x && i > this.columnDraggedId) || (x < mouse_x && x < this.columns[i].x + this.columns[i].w && i < this.columnDraggedId)) {
										var tmpCol = this.columns[this.columnDraggedId];
										this.columns[this.columnDraggedId] = this.columns[i];
										this.columns[i] = tmpCol;
										// move sortColumnId too !
										if (i == this.sortedColumnId) {
											this.sortedColumnId = this.columnDraggedId;
										} else if (this.columnDraggedId == this.sortedColumnId) {
											this.sortedColumnId = i;
										}
										this.columnDraggedId = i;
										break;
									}
								}
							}
						}
						this.saveColumns();
						full_repaint();
					}
					break;
				}
			}
		}
	}

	this.contextMenu = function (x, y, column_index) {
		var menu = window.CreatePopupMenu();
		var groups = window.CreatePopupMenu();
		var columns = window.CreatePopupMenu();

		groups.AppendMenuItem(CheckMenuIf(properties.showgroupheaders), 1, "Enable Groups");

		if (properties.showgroupheaders) {
			groups.AppendMenuSeparator();
			var groupByMenuIdx = 20;
			var totalGroupBy = p.list.groupby.length;
			for (var i = 0; i < totalGroupBy; i++) {
				groups.AppendMenuItem(MF_STRING, groupByMenuIdx + i, p.list.groupby[i].label);
			}
			groups.CheckMenuRadioItem(groupByMenuIdx, groupByMenuIdx + totalGroupBy - 1, cGroup.pattern_idx + groupByMenuIdx);
		}

		groups.AppendTo(menu, MF_STRING, "Groups");
		menu.AppendMenuSeparator();

		// Columns submenu entries
		var columnMenuIdx = 100;
		for (var i = 0; i < this.columns.length; i++) {
			var label = this.columns[i].label;
			if (i == column_index) label = "[" + label + "]";
			columns.AppendMenuItem(CheckMenuIf(this.columns[i].w > 0), columnMenuIdx + i, label);
		}
		columns.AppendTo(menu, MF_STRING, "Columns");
		menu.AppendMenuSeparator();

		menu.AppendMenuItem(CheckMenuIf(cList.enableExtraLine), 2, "Double Track Line");

		var idx = menu.TrackPopupMenu(x, y);
		menu.Dispose();

		switch (idx) {
		case 1:
			properties.showgroupheaders = !properties.showgroupheaders;
			window.SetProperty("JSPLAYLIST.Show Group Headers", properties.showgroupheaders);

			p.list.updateHandleList();
			p.list.setItems(true);
			p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);
			p.playlistManager.refresh();
			break;
		case 2:
			cList.enableExtraLine = !cList.enableExtraLine;
			window.SetProperty("JSPLAYLIST.Enable Extra Line", cList.enableExtraLine);
			resize_panels();
			p.list.updateHandleList();
			p.list.setItems(true);
			p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);
			break;
		default:
			if (idx >= groupByMenuIdx && idx < 100) {
				cGroup.pattern_idx = idx - groupByMenuIdx;
				window.SetProperty("JSPLAYLIST.GROUPBY2.INDEX", cGroup.pattern_idx);
				p.list.updateHandleList();
				p.list.setItems(true);
				p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);
				full_repaint();
			} else if (idx >= 100) {
				if (this.columns[idx - 100].percent == 0) {
					var newColumnSize = 8000;
					this.columns[idx - 100].percent = newColumnSize;
					var totalColsToResizeDown = 0;
					var last_idx = 0;
					for (var k = 0; k < this.columns.length; k++) {
						if (k != idx - 100 && this.columns[k].percent > newColumnSize) {
							totalColsToResizeDown++;
							last_idx = k;
						}
					}
					var minus_value = Math.floor(newColumnSize / totalColsToResizeDown);
					var reste = newColumnSize - (minus_value * totalColsToResizeDown);
					for (var k = 0; k < this.columns.length; k++) {
						if (k != idx - 100 && this.columns[k].percent > newColumnSize) {
							this.columns[k].percent = Math.abs(this.columns[k].percent) - minus_value;
							if (reste > 0 && k == last_idx) {
								this.columns[k].percent = Math.abs(this.columns[k].percent) - reste;
							}
						}
						this.columns[k].w = Math.abs(this.w * this.columns[k].percent / 100000);
					}
					this.saveColumns();
				} else {
					// check if it's not the last column visible, otherwise we coundn't hide it!
					var nbvis = 0;
					for (var k = 0; k < this.columns.length; k++) {
						if (this.columns[k].percent > 0) {
							nbvis++;
						}
					}
					if (nbvis > 1) {
						var RemovedColumnSize = Math.abs(this.columns[idx - 100].percent);
						this.columns[idx - 100].percent = 0;
						var totalColsToResizeUp = 0;
						var last_idx = 0;
						for (var k = 0; k < this.columns.length; k++) {
							if (k != idx - 100 && this.columns[k].percent > 0) {
								totalColsToResizeUp++;
								last_idx = k;
							}
						}
						var add_value = Math.floor(RemovedColumnSize / totalColsToResizeUp);
						var reste = RemovedColumnSize - (add_value * totalColsToResizeUp);
						for (var k = 0; k < this.columns.length; k++) {
							if (k != idx - 100 && this.columns[k].percent > 0) {
								this.columns[k].percent = Math.abs(this.columns[k].percent) + add_value;
								if (reste > 0 && k == last_idx) {
									this.columns[k].percent = Math.abs(this.columns[k].percent) + reste;
								}
							}
							this.columns[k].w = Math.abs(this.w * this.columns[k].percent / 100000);
						}
						this.saveColumns();
					}
				}
			}

			this.initColumns();
			update_playlist();
			break;
		}
		this.columnRightClicked = -1;
		full_repaint();
		return true;
	}

	this.visible = true;
	this.columns = [];
	this.borders = [];
	this.totalColumns = 0;
	this.borderDragged = false;
	this.borderDraggedId = -1;
	this.columnDragged = 0;
	this.columnDraggedId = null;
	this.columnRightClicked = -1;
	this.borderHover = false;
	this.clickX = 0;
	this.resetSortIndicators();
	this.initColumns();
}
