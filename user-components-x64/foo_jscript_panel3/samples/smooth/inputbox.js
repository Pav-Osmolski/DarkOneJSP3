var cInputbox = {
	timer_cursor: false,
	cursor_state: true,
	clipboard: null
}

function oInputbox(w, h, live_update, default_text, empty_text, func) {
	this.w = w;
	this.h = h;
	this.default_text = default_text;
	this.text = default_text;
	this.empty_text = empty_text;
	this.stext = "";
	this.prev_text = "";
	this.func = func;
	this.launch_timer = false;
	this.live_update = live_update;
	this.edit = false;
	this.select = false;
	this.hover = false;
	this.Cpos = 0;
	this.Cx = 0;
	this.offset = 0;
	this.drag = false;

	this.setSize = function (w, h) {
		this.w = w;
		this.h = h;
	}

	this.draw = function (gr, x, y) {
		this.x = x;
		this.y = y;
		gr.FillRectangle(this.x, this.y, this.w, this.h, g_colour_background);

		if (!this.drag && !this.select) {
			this.Cx = this.text.substr(this.offset, this.Cpos - this.offset).calc_width2(g_font);
			while (this.Cx >= this.w) {
				this.offset++;
				this.Cx = this.text.substr(this.offset, this.Cpos - this.offset).calc_width2(g_font);
			}
		}

		if (this.SelBegin != this.SelEnd) {
			this.select = true;
			this.CalcText();
			var px1, px2;
			if (this.SelBegin < this.SelEnd) {
				if (this.SelBegin < this.offset) {
					px1 = this.x;
				} else {
					px1 = this.x + this.GetCx(this.SelBegin);
				}
				px1 = this.GetCx(this.SelBegin);
				px2 = this.GetCx(this.SelEnd);
				this.text_selected = this.text.substring(this.SelBegin, this.SelEnd);
			} else {
				if (this.SelEnd < this.offset) {
					px1 = this.x;
				} else {
					px1 = this.x - this.GetCx(this.SelBegin);
				}
				px2 = this.GetCx(this.SelBegin);
				px1 = this.GetCx(this.SelEnd);
				this.text_selected = this.text.substring(this.SelEnd, this.SelBegin);
			}

			var selection_width = this.x + px1 + px2 - px1 > this.x + this.w ? this.w - px1 : px2 - px1
			gr.FillRectangle(this.x + px1, this.y + 1, selection_width, this.h - 3, g_colour_selection & 0x50ffffff);
		} else {
			this.select = false;
			this.text_selected = "";
		}

		gr.WriteTextSimple(this.text.length > 0 ? this.text.substr(this.offset) : this.empty_text, g_font, g_colour_text, this.x, this.y, this.w, this.h, 0, 2, 1, this.edit ? 0 : 1);

		if (this.edit && !this.select)
			this.drawcursor(gr);
	}

	this.drawcursor = function (gr) {
		if (cInputbox.cursor_state) {
			if (this.Cpos >= this.offset) {
				this.Cx = this.GetCx(this.Cpos);
				var x1 = this.x + this.Cx;
				var x2 = x1;
				var y1 = this.y + 1;
				var y2 = this.y + this.h - 3;
				var lt = 1;
				gr.DrawLine(x1, y1, x2, y2, lt, g_colour_text);
			}
		}
	}

	this.repaint = function () {
		brw.repaint();
	}

	this.CalcText = function () {
		this.TWidth = this.text.substr(this.offset).calc_width2(g_font);
	}

	this.GetCx = function (pos) {
		if (pos >= this.offset) {
			return this.text.substr(this.offset, pos - this.offset).calc_width2(g_font);
		}
		return 0;
	}

	this.GetCPos = function (x) {
		var tx = x - this.x;
		var pos = 0;
		for (var i = this.offset; i < this.text.length; i++) {
			pos += this.text.substr(i, 1).calc_width2(g_font);
			if (pos >= tx + 3) {
				break;
			}
		}
		return i;
	}

	this.on_focus = function (is_focused) {
		if (!is_focused && this.edit) {
			if (this.text.empty()) {
				this.text = this.default_text;
			}
			this.edit = false;
			if (cInputbox.timer_cursor) {
				window.ClearInterval(cInputbox.timer_cursor);
				cInputbox.timer_cursor = false;
				cInputbox.cursor_state = true;
			}
			this.repaint();
		} else if (is_focused && this.edit) {
			this.resetCursorTimer();
		}
	}

	this.resetCursorTimer = function () {
		if (cInputbox.timer_cursor) {
			window.ClearInterval(cInputbox.timer_cursor);
			cInputbox.timer_cursor = false;
			cInputbox.cursor_state = true;
		}
		cInputbox.timer_cursor = window.SetInterval(function () {
			cInputbox.cursor_state = !cInputbox.cursor_state;
			brw.repaint();
		}, 500);
	}

	this.check = function (callback, x, y) {
		this.hover = x >= this.x - 2 && x <= this.x + this.w + 1 && y > this.y && y < this.y + this.h;
		switch (callback) {
		case "lbtn_down":
			if (this.hover) {
				this.dblclk = false;
				this.drag = true;
				this.edit = true;
				this.Cpos = this.GetCPos(x);
				this.anchor = this.Cpos;
				this.SelBegin = this.Cpos;
				this.SelEnd = this.Cpos;
				this.resetCursorTimer();
			} else {
				this.edit = false;
				this.select = false;
				this.SelBegin = 0;
				this.SelEnd = 0;
				this.text_selected = "";
				if (cInputbox.timer_cursor) {
					window.ClearInterval(cInputbox.timer_cursor);
					cInputbox.timer_cursor = false;
					cInputbox.cursor_state = true;
				}
			}
			this.repaint();
			break;
		case "lbtn_up":
			if (!this.dblclk && this.drag) {
				this.SelEnd = this.GetCPos(x);
				if (this.select) {
					if (this.SelBegin > this.SelEnd) {
						this.sBeginSel = this.SelBegin;
						this.SelBegin = this.SelEnd;
						this.SelEnd = this.sBeginSel;
					}
				}
			} else {
				this.dblclk = false;
			}
			this.drag = false;
			break;
		case "lbtn_dblclk":
			if (this.hover) {
				this.dblclk = true;
				this.SelBegin = 0;
				this.SelEnd = this.text.length;
				this.text_selected = this.text;
				this.select = true;
				this.repaint();
			}
			break;
		case "move":
			if (this.drag) {
				this.CalcText();
				var tmp = this.GetCPos(x);
				var tmp_x = this.GetCx(tmp);
				if (tmp < this.SelBegin) {
					if (tmp < this.SelEnd) {
						if (tmp_x < this.x) {
							if (this.offset > 0) {
								this.offset--;
								this.repaint();
							}
						}
					} else if (tmp > this.SelEnd) {
						if (tmp_x + this.x > this.x + this.w) {
							var len = (this.TWidth > this.w) ? this.TWidth - this.w : 0;
							if (len > 0) {
								this.offset++;
								this.repaint();
							}
						}
					}
					this.SelEnd = tmp;
				} else if (tmp > this.SelBegin) {
					if (tmp_x + this.x > this.x + this.w) {
						var len = (this.TWidth > this.w) ? this.TWidth - this.w : 0;
						if (len > 0) {
							this.offset++;
							this.repaint();
						}
					}
					this.SelEnd = tmp;
				}
				this.Cpos = tmp;
				this.repaint();
			}
			if (this.hover || this.drag) {
				window.SetCursor(IDC_IBEAM);
			} else if (this.ibeam_set) {
				window.SetCursor(IDC_ARROW);
			}
			this.ibeam_set = (this.hover || this.drag);
			break;
		case "rbtn_up":
			if (this.hover) {
				this.edit = true;
				this.resetCursorTimer();
				this.repaint();
				this.show_context_menu(x, y);
			} else {
				this.edit = false;
				this.select = false;
				this.SelBegin = 0;
				this.SelEnd = 0;
				this.text_selected = "";
				if (cInputbox.timer_cursor) {
					window.ClearInterval(cInputbox.timer_cursor);
					cInputbox.timer_cursor = false;
					cInputbox.cursor_state = true;
				}
				this.repaint();
			}
			break;
		}
	}

	this.show_context_menu = function (x, y) {
		var menu = window.CreatePopupMenu();
		cInputbox.clipboard = utils.GetClipboardText();
		menu.AppendMenuItem(EnableMenuIf(this.select), 1, "Cut");
		menu.AppendMenuItem(EnableMenuIf(this.select), 2, "Copy");
		menu.AppendMenuSeparator();
		menu.AppendMenuItem(EnableMenuIf(cInputbox.clipboard), 3, "Paste");

		var idx = menu.TrackPopupMenu(x, y);
		menu.Dispose();

		switch (idx) {
		case 1:
			if (this.edit && this.select) {
				utils.SetClipboardText(this.text_selected);
				var p1 = this.SelBegin;
				var p2 = this.SelEnd;
				this.offset = this.offset >= this.text_selected.length ? this.offset - this.text_selected.length : 0;
				this.select = false;
				this.text_selected = "";
				this.Cpos = this.SelBegin;
				this.SelEnd = this.SelBegin;
				this.text = this.text.slice(0, p1) + this.text.slice(p2);
				this.CalcText();
				this.repaint();
			}
			break;
		case 2:
			if (this.edit && this.select) {
				utils.SetClipboardText(this.text_selected);
			}
			break;
		case 3:
			if (this.edit && cInputbox.clipboard) {
				if (this.select) {
					var p1 = this.SelBegin;
					var p2 = this.SelEnd;
					this.select = false;
					this.text_selected = "";
					this.Cpos = this.SelBegin;
					this.SelEnd = this.SelBegin;

					if (this.Cpos < this.text.length) {
						this.text = this.text.slice(0, p1) + cInputbox.clipboard + this.text.slice(p2);
					} else {
						this.text = this.text + cInputbox.clipboard;
					}
					this.Cpos += cInputbox.clipboard.length;
					this.CalcText();
					this.repaint();
				} else {
					if (this.Cpos > 0) {
						this.text = this.text.substring(0, this.Cpos) + cInputbox.clipboard + this.text.substring(this.Cpos, this.text.length);
					} else {
						this.text = cInputbox.clipboard + this.text.substring(this.Cpos, this.text.length);
					}
					this.Cpos += cInputbox.clipboard.length;
					this.CalcText();
					this.repaint();
				}
			}
			break;
		}
	}

	this.on_key_down = function (vkey) {
		this.resetCursorTimer();
		var mask = GetKeyboardMask();

		if (mask == KMask.none) {
			switch (vkey) {
			case VK_BACK:
				this.stext = this.text;
				if (this.edit) {
					if (this.select) {
						if (this.text_selected.length == this.text.length) {
							this.text = "";
							this.Cpos = 0;
						} else {
							if (this.SelBegin > 0) {
								this.text = this.text.substring(0, this.SelBegin) + this.text.substring(this.SelEnd, this.text.length);
								this.Cpos = this.SelBegin;
							} else {
								this.text = this.text.substring(this.SelEnd, this.text.length);
								this.Cpos = this.SelBegin;
							}
						}
					} else {
						if (this.Cpos > 0) {
							this.text = this.text.substr(0, this.Cpos - 1) + this.text.substr(this.Cpos, this.text.length - this.Cpos);
							if (this.offset > 0) {
								this.offset--;
							}
							this.Cpos--;
							this.repaint();
						}
					}
				}
				this.CalcText();
				this.offset = this.offset >= this.text_selected.length ? this.offset - this.text_selected.length : 0;
				this.text_selected = "";
				this.SelBegin = this.Cpos;
				this.SelEnd = this.SelBegin;
				this.select = false;
				this.repaint();
				break;
			case VK_DELETE:
				this.stext = this.text;
				if (this.edit) {
					if (this.select) {
						if (this.text_selected.length == this.text.length) {
							this.text = "";
							this.Cpos = 0;
						} else {
							if (this.SelBegin > 0) {
								this.text = this.text.substring(0, this.SelBegin) + this.text.substring(this.SelEnd, this.text.length);
								this.Cpos = this.SelBegin;
							} else {
								this.text = this.text.substring(this.SelEnd, this.text.length);
								this.Cpos = this.SelBegin;
							}
						}
					} else {
						if (this.Cpos < this.text.length) {
							this.text = this.text.substr(0, this.Cpos) + this.text.substr(this.Cpos + 1, this.text.length - this.Cpos - 1);
							this.repaint();
						}
					}
				}
				this.CalcText();
				this.offset = this.offset >= this.text_selected.length ? this.offset - this.text_selected.length : 0;
				this.text_selected = "";
				this.SelBegin = this.Cpos;
				this.SelEnd = this.SelBegin;
				this.select = false;
				this.repaint();
				break;
			case VK_RETURN:
				window.SetCursor(IDC_ARROW);
				if (this.edit && this.text.length >= 0) {
					eval(this.func);
				}
				break;
			case VK_ESCAPE:
				window.SetCursor(IDC_ARROW);
				if (this.edit) {
					this.edit = false;
					this.text_selected = "";
					this.select = false;
					this.repaint();
				}
				break;
			case VK_END:
				if (this.edit) {
					this.Cpos = this.text.length;
					this.SelBegin = 0;
					this.SelEnd = 0;
					this.select = false;
					this.repaint();
				}
				break;
			case VK_HOME:
				if (this.edit) {
					this.Cpos = 0;
					this.SelBegin = 0;
					this.SelEnd = 0;
					this.select = false;
					this.offset = 0;
					this.repaint();
				}
				break;
			case VK_LEFT:
				if (this.edit) {
					if (this.offset > 0) {
						if (this.Cpos <= this.offset) {
							this.offset--;
							this.Cpos--;
						} else {
							this.Cpos--;
						}
					} else {
						if (this.Cpos > 0)
							this.Cpos--;
					}
					this.SelBegin = this.Cpos;
					this.SelEnd = this.Cpos;
					this.select = false;
					this.repaint();
				}
				break;
			case VK_RIGHT:
				if (this.edit) {
					if (this.Cpos < this.text.length)
						this.Cpos++;
					this.SelBegin = this.Cpos;
					this.SelEnd = this.Cpos;
					this.select = false;
					this.repaint();
				}
				break;
			}
			if (this.edit)
				this.repaint();
		} else {
			switch (mask) {
			case KMask.shift:
				if (vkey == VK_HOME) {
					if (this.edit) {
						if (!this.select) {
							this.anchor = this.Cpos;
							this.select = true;
							if (this.Cpos > 0) {
								this.SelEnd = this.Cpos;
								this.SelBegin = 0;
								this.select = true;
								this.Cpos = 0;
							}
						} else {
							if (this.Cpos > 0) {
								if (this.anchor < this.Cpos) {
									this.SelBegin = 0;
									this.SelEnd = this.anchor;
								} else if (this.anchor > this.Cpos) {
									this.SelBegin = 0;
								}
								this.Cpos = 0;
							}
						}
						if (this.offset > 0) {
							this.offset = 0;
						}
						this.repaint();
					}
				}
				if (vkey == VK_END) {
					if (this.edit) {
						if (!this.select) {
							this.anchor = this.Cpos;
							if (this.Cpos < this.text.length) {
								this.SelBegin = this.Cpos;
								this.SelEnd = this.text.length;
								this.Cpos = this.text.length;
								this.select = true;
							}
						} else {
							if (this.Cpos < this.text.length) {
								if (this.anchor < this.Cpos) {
									this.SelEnd = this.text.length;
								} else if (this.anchor > this.Cpos) {
									this.SelBegin = this.anchor;
									this.SelEnd = this.text.length;
								}
								this.Cpos = this.text.length;
							}
						}

						this.Cx = this.text.substr(this.offset, this.Cpos - this.offset).calc_width2(g_font);
						while (this.Cx >= this.w) {
							this.offset++;
							this.Cx = this.text.substr(this.offset, this.Cpos - this.offset).calc_width2(g_font);
						}

						this.repaint();
					}
				}
				if (vkey == VK_LEFT) {
					if (this.edit) {
						if (!this.select) {
							this.anchor = this.Cpos;
							this.select = true;
							if (this.Cpos > 0) {
								this.SelEnd = this.Cpos;
								this.SelBegin = this.Cpos - 1;
								this.select = true;
								this.Cpos--;
							}
						} else {
							if (this.Cpos > 0) {
								if (this.anchor < this.Cpos) {
									this.SelEnd--;
								} else if (this.anchor > this.Cpos) {
									this.SelBegin--;
								}
								this.Cpos--;
							}
						}
						if (this.offset > 0) {
							var tmp = this.Cpos;
							var tmp_x = this.GetCx(tmp);
							if (tmp < this.offset) {
								this.offset--;
							}
						}
						this.repaint();
					}
				}
				if (vkey == VK_RIGHT) {
					if (this.edit) {
						if (!this.select) {
							this.anchor = this.Cpos;
							if (this.Cpos < this.text.length) {
								this.SelBegin = this.Cpos;
								this.Cpos++;
								this.SelEnd = this.Cpos;
								this.select = true;
							}
						} else {
							if (this.Cpos < this.text.length) {
								if (this.anchor < this.Cpos) {
									this.SelEnd++;
								} else if (this.anchor > this.Cpos) {
									this.SelBegin++;
								}
								this.Cpos++;
							}
						}

						if (this.GetCx(this.Cpos) > this.w) {
							this.offset++;
						}
						this.repaint();
					}
				}
				break;
			case KMask.ctrl:
				if (vkey == 65) { // CTRL+A
					if (this.edit && this.text.length > 0) {
						this.SelBegin = 0;
						this.SelEnd = this.text.length;
						this.text_selected = this.text;
						this.select = true;
						this.repaint();
					}
				}
				if (vkey == 67) { // CTRL+C
					if (this.edit && this.select) {
						utils.SetClipboardText(this.text_selected);
					}
				}
				if (vkey == 88) { // CTRL+X
					if (this.edit && this.select) {
						this.stext = this.text;
						utils.SetClipboardText(this.text_selected);
						var p1 = this.SelBegin;
						var p2 = this.SelEnd;
						this.select = false;
						this.text_selected = "";
						this.Cpos = this.SelBegin;
						this.SelEnd = this.SelBegin;
						this.text = this.text.slice(0, p1) + this.text.slice(p2);
						this.CalcText();
						this.repaint();
					}
				}
				if (vkey == 90) { // CTRL+Z
					if (this.edit) {
						this.text = this.stext;
						this.repaint();
					}
				}
				if (vkey == 86) { // CTRL+V
					cInputbox.clipboard = utils.GetClipboardText();
					if (this.edit && cInputbox.clipboard) {
						this.stext = this.text;
						if (this.select) {
							var p1 = this.SelBegin;
							var p2 = this.SelEnd;
							this.select = false;
							this.text_selected = "";
							this.Cpos = this.SelBegin;
							this.SelEnd = this.SelBegin;
							if (this.Cpos < this.text.length) {
								this.text = this.text.slice(0, p1) + cInputbox.clipboard + this.text.slice(p2);
							} else {
								this.text = this.text + cInputbox.clipboard;
							}
							this.Cpos += cInputbox.clipboard.length;
							this.CalcText();
							this.repaint();
						} else {
							if (this.Cpos > 0) {
								this.text = this.text.substring(0, this.Cpos) + cInputbox.clipboard + this.text.substring(this.Cpos, this.text.length);
							} else {
								this.text = cInputbox.clipboard + this.text.substring(this.Cpos, this.text.length);
							}
							this.Cpos += cInputbox.clipboard.length;
							this.CalcText();
							this.repaint();
						}
					}
				}
				break;
			}
		}
	}

	this.on_char = function (code, mask) {
		if (code == 1 && this.edit && mask == KMask.ctrl) {
			this.Spos = 0;
			this.Cpos = this.text.length;
			this.select = true;
			this.repaint();
		}
		if (code > 31 && this.edit) {
			this.stext = this.text;
			if (this.select) {
				var p1 = this.SelBegin;
				var p2 = this.SelEnd;
				this.text_selected = "";
				this.Cpos = this.SelBegin;
				this.SelEnd = this.SelBegin;
			} else {
				var p1 = this.Cpos;
				var p2 = (this.text.length - this.Cpos) * -1;
			}
			if (this.Cpos < this.text.length) {
				this.text = this.text.slice(0, p1) + String.fromCharCode(code) + this.text.slice(p2);
			} else {
				this.text = this.text + String.fromCharCode(code);
			}
			this.Cpos++;
			if (this.select) {
				this.CalcText();
				if (this.TWidth <= (this.w)) {
					this.offset = 0;
				} else {
					if (this.Cpos - this.offset < 0) {
						this.offset = this.offset > 0 ? this.Cpos - 1 : 0;
					}
				}
				this.select = false;
			}
			this.repaint();
		}

		if (this.live_update && this.text != this.prev_text) {
			if (this.launch_timer) window.ClearTimeout(this.launch_timer);
			this.launch_timer = window.SetTimeout((function () {
				this.lanch_timer = false;
				this.func();
			}).bind(this), 500);
			this.prev_text = this.text;
		}
	}
}
