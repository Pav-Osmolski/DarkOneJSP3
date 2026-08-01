function PlaylistScrollBar() {
	this.buttons = new Array(3);

	this.draw = function (gr, x, y) {
		// draw background and buttons up & down
		gr.FillRectangle(this.x, this.y, this.w, this.h, g_colour_text & 0x15ffffff);
		// draw up & down buttons
		this.buttons[cScrollBar.buttonType.up] && this.buttons[cScrollBar.buttonType.up].draw(gr, this.x, this.y);
		this.buttons[cScrollBar.buttonType.down] && this.buttons[cScrollBar.buttonType.down].draw(gr, this.x, this.y + this.h - this.w);

		// draw cursor
		this.buttons[cScrollBar.buttonType.cursor] && this.buttons[cScrollBar.buttonType.cursor].draw(gr, this.x, this.cursorPos);
	}

	this.setCursor = function (totalRowVisible, totalRows, offset, pixelPosition) {
		if (totalRows > 0 && totalRows > totalRowVisible && this.w > 2) {
			this.cursorWidth = this.w;
			// calc cursor height
			this.cursorHeight = Math.round((totalRowVisible / totalRows) * this.area_h);
			if (this.cursorHeight < this.w - 2 || this.cursorHeight > p.list.h)
				this.cursorHeight = this.w - 2;
			// cursor pos. A pixel position is supplied by free wheel/scrollbar mode.
			var maxRows = totalRows - totalRowVisible;
			var maxPixels = maxRows * Math.max(1, cRow.playlist_h);
			var ratio = typeof pixelPosition == "number" && maxPixels > 0 ? pixelPosition / maxPixels : offset / maxRows;
			ratio = Math.max(0, Math.min(1, ratio));
			this.cursorPos = this.area_y + Math.round((this.area_h - this.cursorHeight) * ratio);
			this.setCursorButton();
		}
	}

	this.setCursorButton = function () {
		if (!this.cursorWidth || !this.cursorHeight)
			return;

		this.cursorImage_normal = utils.CreateImage(this.cursorWidth, this.cursorHeight);
		var gb = this.cursorImage_normal.GetGraphics();

		gb.FillRectangle(0, 0, this.cursorWidth, this.cursorHeight, g_colour_text & 0x33ffffff);
		this.cursorImage_normal.ReleaseGraphics();

		// create/refresh cursor Button in buttons array
		this.buttons[cScrollBar.buttonType.cursor] = new button(this.cursorImage_normal, this.cursorImage_normal, this.cursorImage_normal);
	}

	this.setButtons = function () {
		// normal scroll_up Image
		this.upImage_normal = utils.CreateImage(this.w, this.w);
		var gb = this.upImage_normal.GetGraphics();
		gb.WriteTextSimple(chars.up, g_font_fluent_12, g_colour_text & 0x55ffffff, 0, 0, this.w, this.w, 2, 2);
		this.upImage_normal.ReleaseGraphics();

		// normal scroll_down Image
		this.downImage_normal = utils.CreateImage(this.w, this.w);
		gb = this.downImage_normal.GetGraphics();
		gb.WriteTextSimple(chars.down, g_font_fluent_12, g_colour_text & 0x55ffffff, 0, 0, this.w, this.w, 2, 2);
		this.downImage_normal.ReleaseGraphics();

		this.buttons[cScrollBar.buttonType.up] = new button(this.upImage_normal, this.upImage_normal, this.upImage_normal);
		this.buttons[cScrollBar.buttonType.down] = new button(this.downImage_normal, this.downImage_normal, this.downImage_normal);
	}

	this.setSize = function (x, y, w, h) {
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		// scrollbar area for the cursor (<=> scrollbar height minus up & down buttons height)
		this.area_y = y + w;
		this.area_h = h - (w * 2);
		this.setButtons();
	}

	this.getRatioFromCursorPos = function () {
		var travel = this.area_h - this.cursorHeight;
		if (travel <= 0)
			return 0;
		return Math.max(0, Math.min(1, (this.cursorPos - this.area_y) / travel));
	}

	this.setOffsetFromCursorPos = function () {
		// calc idx of the item to display at the top of the panel list
		return Math.round((p.list.totalRows - p.list.totalRowVisible) * this.getRatioFromCursorPos());
	}

	this.setPixelPositionFromCursorPos = function () {
		return get_free_scroll_max_px() * this.getRatioFromCursorPos();
	}

	this.cursorCheck = function (event, x, y) {
		this.ishover = (x >= this.x && x <= this.x + this.w && y >= this.cursorPos && y <= (this.cursorPos + this.cursorHeight));

		switch (event) {
		case "lbtn_down":
			this.buttons[0] && this.buttons[0].checkstate(event, x, y);
			if (this.ishover) {
				cancel_playlist_scrollbar_drag();
				if (cList.scrollbar_snap)
					reset_free_wheel_scroll();
				else if (!cList.free_scroll_active) {
					cList.free_scroll_position = p.list.offset * cRow.playlist_h;
					cList.free_scroll_target = cList.free_scroll_position;
				}
				begin_playlist_scrollbar_drag(cList.scrollbar_snap);
				this.cursorClickX = x;
				this.cursorClickY = y;
				this.cursorDrag = true;
				this.cursorDragDelta = y - this.cursorPos;
				this.clicked = true;
			}
			break;
		case "lbtn_up":
			this.buttons[0] && this.buttons[0].checkstate(event, x, y);
			if (this.cursorDrag) {
				if (cList.scrollbar_snap) {
					var final_row = this.setOffsetFromCursorPos();
					finish_playlist_scrollbar_drag(final_row * Math.max(1, cRow.playlist_h), true);
					p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);
				} else {
					var final_position = this.setPixelPositionFromCursorPos();
					finish_playlist_scrollbar_drag(final_position, false);
					p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset, final_position);
				}
			}
			this.cursorClickX = 0;
			this.cursorClickY = 0;
			this.cursorDrag = false;
			this.clicked = false;
			break;
		case "move":
			this.buttons[0] && this.buttons[0].checkstate(event, x, y);
			if (this.cursorDrag) {
				this.cursorPos = y - this.cursorDragDelta;
				if (this.cursorPos + this.cursorHeight > this.area_y + this.area_h) {
					this.cursorPos = (this.area_y + this.area_h) - this.cursorHeight;
				}
				if (this.cursorPos < this.area_y) {
					this.cursorPos = this.area_y;
				}

				if (cList.scrollbar_snap) {
					var target_row = this.setOffsetFromCursorPos();
					update_playlist_scrollbar_drag(target_row * Math.max(1, cRow.playlist_h), true);
				} else {
					update_playlist_scrollbar_drag(this.setPixelPositionFromCursorPos(), false);
				}
			}
			break;
		}
	}

	this.isHoverObject = function (x, y) {
		return (x >= this.x && x <= this.x + this.w && y > this.area_y && y < this.area_y + this.area_h);
	}

	this.check = function (event, x, y) {
		this.hover = this.isHoverObject(x, y);

		// check cursor
		this.cursorCheck(event, x, y);

		// check other buttons
		for (var i = 1; i < this.buttons.length; i++) {
			switch (event) {
			case "lbtn_dblclk":
				switch (i) {
				case 1: // up button
					if (this.buttons[i] && this.buttons[i].checkstate(event, x, y) == ButtonStates.hover) {
						this.clicked = true;
						p.list.buttonclicked = true;
						this.buttons[i].checkstate("lbtn_down", x, y);

						p.list.offset = p.list.offset > 0 ? p.list.offset - 1 : 0;
						p.list.setItems(false);
						p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);
						full_repaint();
						if (!cScrollBar.interval) {
							cScrollBar.interval = window.SetInterval(function () {
								cScrollBar.timer_counter++;
								if (cScrollBar.timer_counter > 7) {
									p.list.offset = p.list.offset > 0 ? p.list.offset - 1 : 0;
									p.list.setItems(false);
									p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);
									full_repaint();
								}
							}, 60);
						}
					}
					break;
				case 2: // down button
					if (this.buttons[i] && this.buttons[i].checkstate(event, x, y) == ButtonStates.hover) {
						this.clicked = true;
						p.list.buttonclicked = true;
						this.buttons[i].checkstate("lbtn_down", x, y);

						p.list.offset = p.list.offset >= (p.list.totalRows - p.list.totalRowVisible) ? (p.list.totalRows - p.list.totalRowVisible) : p.list.offset + 1;
						p.list.setItems(false);
						p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);
						full_repaint();
						if (!cScrollBar.interval) {
							cScrollBar.interval = window.SetInterval(function () {
								cScrollBar.timer_counter++;
								if (cScrollBar.timer_counter > 7) {
									p.list.offset = p.list.offset >= (p.list.totalRows - p.list.totalRowVisible) ? (p.list.totalRows - p.list.totalRowVisible) : p.list.offset + 1;
									p.list.setItems(false);
									p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);
									full_repaint();
								}
							}, 60);
						}
					}
					break;
				}
				break;
			case "lbtn_down":
				switch (i) {
				case 1: // up button
					if (this.buttons[i] && this.buttons[i].checkstate(event, x, y) == ButtonStates.down) {
						this.clicked = true;
						p.list.buttonclicked = true;
						cScrollBar.timer_counter = 0;
						p.list.offset = p.list.offset > 0 ? p.list.offset - 1 : 0;
						p.list.setItems(false);
						p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);
						full_repaint();
						if (!cScrollBar.interval) {
							cScrollBar.interval = window.SetInterval(function () {
								cScrollBar.timer_counter++;
								if (cScrollBar.timer_counter > 7) {
									p.list.offset = p.list.offset > 0 ? p.list.offset - 1 : 0;
									p.list.setItems(false);
									p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);
									full_repaint();
								}
							}, 60);
						}
					}
					break;
				case 2: // down button
					if (this.buttons[i] && this.buttons[i].checkstate(event, x, y) == ButtonStates.down) {
						this.clicked = true;
						p.list.buttonclicked = true;
						cScrollBar.timer_counter = 0;
						p.list.offset = p.list.offset >= (p.list.totalRows - p.list.totalRowVisible) ? (p.list.totalRows - p.list.totalRowVisible) : p.list.offset + 1;
						p.list.setItems(false);
						p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);
						full_repaint();
						if (!cScrollBar.interval) {
							cScrollBar.interval = window.SetInterval(function () {
								cScrollBar.timer_counter++;
								if (cScrollBar.timer_counter > 7) {
									p.list.offset = p.list.offset >= (p.list.totalRows - p.list.totalRowVisible) ? (p.list.totalRows - p.list.totalRowVisible) : p.list.offset + 1;
									p.list.setItems(false);
									p.scrollbar.setCursor(p.list.totalRowVisible, p.list.totalRows, p.list.offset);
									full_repaint();
								}
							}, 60);
						}
					}
					break;
				}
				break;
			case "lbtn_up":
				if (cScrollBar.interval) {
					window.ClearInterval(cScrollBar.interval);
					cScrollBar.interval = false;
				}
				cScrollBar.timer_counter = 0;
				this.buttons[i] && this.buttons[i].checkstate(event, x, y);
				this.clicked = false;
				break;
			default:
				this.buttons[i] && this.buttons[i].checkstate(event, x, y);
			}
		}
	}
}

function ScrollBar(parent, x, y, w, h, total_items, item_height) {
	this.parent = parent;
	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;
	this.total = total_items;
	this.itemHeight = item_height;
	this.offset = 0;
	this.buttons = [null, null, null];
	this.scrollStep = 3;

	this.setCursorButton = function () {
		// normal cursor Image
		this.cursorImage_normal = utils.CreateImage(this.cursorWidth, this.cursorHeight);
		var gb = this.cursorImage_normal.GetGraphics();
		gb.FillRectangle(0, 0, this.cursorWidth, this.cursorHeight, g_colour_text & 0x33ffffff);
		this.cursorImage_normal.ReleaseGraphics();

		// create/refresh cursor Button in buttons array
		this.buttons[cScrollBar.buttonType.cursor] = new button(this.cursorImage_normal, this.cursorImage_normal, this.cursorImage_normal);
	}

	this.setButtons = function () {
		// normal scroll_up Image
		this.upImage_normal = utils.CreateImage(this.w, this.w);
		var gb = this.upImage_normal.GetGraphics();
		gb.WriteTextSimple(chars.up, g_font_fluent_12, g_colour_text & 0x55ffffff, 0, 0, this.w, this.w, 2, 2);
		this.upImage_normal.ReleaseGraphics();

		// normal scroll_down Image
		this.downImage_normal = utils.CreateImage(this.w, this.w);
		gb = this.downImage_normal.GetGraphics();
		gb.WriteTextSimple(chars.down, g_font_fluent_12, g_colour_text & 0x55ffffff, 0, 0, this.w, this.w, 2, 2);
		this.downImage_normal.ReleaseGraphics();

		this.buttons[cScrollBar.buttonType.up] = new button(this.upImage_normal, this.upImage_normal, this.upImage_normal);
		this.buttons[cScrollBar.buttonType.down] = new button(this.downImage_normal, this.downImage_normal, this.downImage_normal);
	}

	this.updateCursorPos = function (offset) {
		this.offset = offset;
		this.ratio1 = this.totalRowsFull / this.total;
		this.cursorWidth = this.w;
		this.cursorHeight = Math.round(this.ratio1 * this.cursorAreaHeight);
		if (this.cursorHeight < this.w - 2 || this.cursorHeight > p.list.h)
			this.cursorHeight = this.w - 2;
		var ratio2 = this.offset / (this.total - this.totalRowsFull);
		this.cursorY = this.cursorAreaY + Math.round((this.cursorAreaHeight - this.cursorHeight) * ratio2);
		this.setCursorButton();
	}

	this.reSet = function (total_items, item_height, offset) {
		this.total = total_items;
		this.itemHeight = item_height;
		this.offset = offset;
		//
		this.setButtons();
		this.totalRowsFull = Math.floor(this.h / this.itemHeight);
		this.totalRowsVisibles = Math.ceil(this.h / this.itemHeight);
		this.visible = (this.total > this.totalRowsFull);
		this.buttonHeight = this.buttons[cScrollBar.buttonType.up].h;
		this.cursorAreaY = this.y + this.buttonHeight;
		this.cursorAreaHeight = this.h - (this.buttonHeight * 2);
		if (this.visible)
			this.updateCursorPos(this.offset);

	}
	this.reSet(this.total, this.itemHeight, this.offset);

	this.reSize = function (x, y, w, h, total_items, item_height, offset) {
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		this.total = total_items;
		this.itemHeight = item_height;
		this.offset = offset;
		this.reSet(this.total, this.itemHeight, this.offset);
	}

	this.drawXY = function (gr, x, y) {
		this.x = x;
		this.y = y;
		if (this.visible) {
			gr.FillRectangle(this.x, this.y, this.w, this.h, g_colour_background);
			gr.FillRectangle(this.x, this.y, this.w, this.h, g_colour_text & 0x15ffffff);
			// scrollbar buttons
			this.buttons[cScrollBar.buttonType.cursor].draw(gr, x, this.cursorY);
			this.buttons[cScrollBar.buttonType.up].draw(gr, x, y);
			this.buttons[cScrollBar.buttonType.down].draw(gr, x, this.cursorAreaY + this.cursorAreaHeight);
		}
	}

	this.draw = function (gr) {
		if (this.visible) {
			// scrollbar background
			gr.FillRectangle(this.x, this.y, this.w, this.h, g_colour_background);
			gr.FillRectangle(this.x, this.y, this.w, this.h, g_colour_text & 0x15ffffff);
			// scrollbar buttons
			this.buttons[cScrollBar.buttonType.cursor].draw(gr, this.x, this.cursorY);
			this.buttons[cScrollBar.buttonType.up].draw(gr, this.x, this.y);
			this.buttons[cScrollBar.buttonType.down].draw(gr, this.x, this.cursorAreaY + this.cursorAreaHeight);
		}
	}

	this.getOffsetFromCursorPos = function () {
		// calc ratio of the scroll cursor to calc the equivalent item for the full playlist (with gh)
		var ratio = (this.cursorY - this.cursorAreaY) / (this.cursorAreaHeight - this.cursorHeight);
		// calc idx of the item (of the full list with gh) to display at top of the panel list (visible)
		var newOffset = Math.round((this.total - this.totalRowsFull) * ratio);
		return newOffset;
	}

	this.cursorCheck = function (event, x, y) {
		this.ishover = (x >= this.x && x <= this.x + this.w && y >= this.cursorY && y <= (this.cursorY + this.cursorHeight));

		if (!this.buttons[cScrollBar.buttonType.cursor])
			return;

		switch (event) {
		case "lbtn_down":
			if (this.buttons[cScrollBar.buttonType.cursor].checkstate(event, x, y) == ButtonStates.down) {
				this.cursorClickX = x;
				this.cursorClickY = y;
				this.cursorDrag = true;
				this.cursorDragDelta = y - this.cursorY;
			}
			break;
		case "lbtn_up":
			this.buttons[cScrollBar.buttonType.cursor].checkstate(event, x, y);
			if (this.cursorDrag) {
				eval(this.parent).offset = this.getOffsetFromCursorPos();
				full_repaint();
			}
			this.cursorClickX = 0;
			this.cursorClickY = 0;
			this.cursorDrag = false;
			break;
		case "move":
			this.buttons[cScrollBar.buttonType.cursor].checkstate(event, x, y);
			if (this.cursorDrag) {
				this.cursorY = y - this.cursorDragDelta;
				if (this.cursorY + this.cursorHeight > this.cursorAreaY + this.cursorAreaHeight) {
					this.cursorY = (this.cursorAreaY + this.cursorAreaHeight) - this.cursorHeight;
				}
				if (this.cursorY < this.cursorAreaY) {
					this.cursorY = this.cursorAreaY;
				}
				this.offset = this.getOffsetFromCursorPos();
				eval(this.parent).offset = this.offset;

				if (!cScrollBar.repaint_timeout) {
					cScrollBar.repaint_timeout = window.SetTimeout(function () {
						cScrollBar.repaint_timeout = false;
						full_repaint();
					}, cList.repaint_interval);
				}
			}
			break;
		}
	}

	this.check = function (event, x, y, delta) {
		this.isHoverScrollbar = (x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h);
		this.isHoverCursor = (x >= this.x && x <= this.x + this.w && y >= this.cursorY && y <= this.cursorY + this.cursorHeight);
		this.isHoverEmptyArea = (x >= this.x && x <= this.x + this.w && y >= this.y + this.buttonHeight && y <= this.cursorAreaY + this.cursorAreaHeight) && !this.isHoverCursor;
		this.isHoverButtons = this.isHoverScrollbar && !this.isHoverCursor && !this.isHoverEmptyArea;

		// cursor events
		if (!this.buttonClick)
			this.cursorCheck(event, x, y);

		if (!this.cursorDrag) {
			// buttons events
			var totalButtonToCheck = 3;
			for (var i = 1; i < totalButtonToCheck; i++) {
				switch (event) {
				case "lbtn_down":
					switch (i) {
					case 1: // up button
						if (this.buttons[i].checkstate(event, x, y) == ButtonStates.down) {
							this.buttonClick = true;
							this.offset = this.offset > 0 ? this.offset - 1 : 0;
							this.updateCursorPos(this.offset);
							eval(this.parent).offset = this.offset;
							full_repaint();
							if (!cScrollBar.timerID) {
								cScrollBar.timerID = window.SetInterval((function () {
									if (cScrollBar.timer_counter > 7) {
										if (this.offset > 0) this.offset--;
										this.updateCursorPos(this.offset);
										eval(this.parent).offset = this.offset;
										full_repaint();
									} else {
										cScrollBar.timer_counter++;
									}
								}).bind(this), 60);
							}
						}
						break;
					case 2: // down button
						if (this.buttons[i].checkstate(event, x, y) == ButtonStates.down) {
							this.buttonClick = true;
							var max_offset = this.total - this.totalRowsFull;
							this.offset = (this.offset + 1 >= max_offset ? max_offset : this.offset + 1);
							this.updateCursorPos(this.offset);
							eval(this.parent).offset = this.offset;
							full_repaint();
							if (!cScrollBar.timerID) {
								cScrollBar.timerID = window.SetInterval((function () {
									if (cScrollBar.timer_counter > 7) {
										var max_offset = this.total - this.totalRowsFull;
										this.offset = (this.offset + 1 >= max_offset ? max_offset : this.offset + 1);
										this.updateCursorPos(this.offset);
										eval(this.parent).offset = this.offset;
										full_repaint();
									} else {
										cScrollBar.timer_counter++;
									}
								}).bind(this), 60);
							}
						}
						break;
					}
					break;
				case "lbtn_up":
					this.buttonClick = false;
					if (cScrollBar.timerID) {
						window.ClearInterval(cScrollBar.timerID);
						cScrollBar.timerID = false;
					}
					cScrollBar.timer_counter = 0;
					this.buttons[i].checkstate(event, x, y);
					break;
				default:
					this.buttons[i].checkstate(event, x, y);
				}
			}

			// click on empty scrollbar area to scroll page
			if (this.isHoverEmptyArea) {
				switch (event) {
				case "lbtn_down":
				case "lbtn_dblclk":
					switch (y < this.cursorY) {
					case true: // up
						this.offset = this.offset > this.totalRowsFull ? this.offset - this.totalRowsFull : 0;
						this.reSet(this.total, this.itemHeight, this.offset);
						full_repaint();
						if (!cScrollBar.timerID) {
							cScrollBar.timerID = window.SetInterval((function () {
								if (cScrollBar.timer_counter > 7 && mouse_y < this.cursorY) {
									this.offset = this.offset > this.totalRowsFull ? this.offset - this.totalRowsFull : 0;
									this.reSet(this.total, this.itemHeight, this.offset);
									full_repaint();
								} else {
									cScrollBar.timer_counter++;
								}
							}).bind(this), 60);
						}
						break;
					case false: // down
						var max_offset = this.total - this.totalRowsFull;
						this.offset = (this.offset + this.totalRowsFull >= max_offset ? max_offset : this.offset + this.totalRowsFull);
						this.reSet(this.total, this.itemHeight, this.offset);
						full_repaint();
						if (!cScrollBar.timerID) {
							cScrollBar.timerID = window.SetInterval((function () {
								if (cScrollBar.timer_counter > 7 && mouse_y > this.cursorY + this.cursorHeight) {
									var max_offset = this.total - this.totalRowsFull;
									this.offset = (this.offset + this.totalRowsFull >= max_offset ? max_offset : this.offset + this.totalRowsFull);
									this.reSet(this.total, this.itemHeight, this.offset);
									full_repaint();
								} else {
									cScrollBar.timer_counter++;
								}
							}).bind(this), 60);
						}
						break;
					}
					break;
				}
			}

			// mouse wheel event
			if (event == "wheel") {
				if (delta > 0) {
					this.offset = this.offset > this.scrollStep ? this.offset - this.scrollStep : 0;
				} else {
					this.offset = (this.offset < (this.total - this.totalRowsFull - this.scrollStep) ? (this.offset + this.scrollStep) : (this.total - this.totalRowsFull));
				}
				eval(this.parent).offset = this.offset;
				this.reSet(this.total, this.itemHeight, this.offset);
				full_repaint();
			}
		}
	}

	if (this.cursorHeight) this.setCursorButton();
	this.setButtons();
}
