// DarkOneJSP3: DirectWrite playlist-name filter restored from the JSP2 manager.
function oFilterBox() {
	this.x = 0;
	this.y = 0;
	this.w = 0;
	this.h = 0;
	this.iconWidth = 0;
	this.hoverIcon = false;
	this.pendingTimer = false;
	this.lastText = "";
	this.inputbox = new oInputbox(100, 20, false, "", "Filter", filterResponse);

	this.setSize = function (x, y, w, h) {
		this.x = x;
		this.y = y;
		this.w = Math.max(scale(100), w);
		this.h = Math.max(scale(16), h);
		this.iconWidth = Math.max(this.h, scale(22));
		this.inputbox.setSize(Math.max(scale(60), this.w - this.iconWidth - scale(5)), this.h);
	}

	this.contains = function (x, y) {
		return x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h;
	}

	this.icon_contains = function (x, y) {
		return x >= this.x && x <= this.x + this.iconWidth && y >= this.y && y <= this.y + this.h;
	}

	this.draw = function (gr) {
		var icon = this.inputbox.text.length ? chars.close : chars.search;
		var iconColour = this.inputbox.text.length && this.hoverIcon ? 0xffff5050 : g_colour_text;
		gr.WriteTextSimple(icon, g_font_fluent_20, iconColour, this.x, this.y, this.iconWidth, this.h, 2, 2, 1, 1);
		this.inputbox.draw(gr, this.x + this.iconWidth, this.y);

		// Original DarkOne divider at the end of the filter field.
		var dividerX = this.x + this.w;
		for (var yy = this.y + scale(2); yy < this.y + this.h - scale(1); yy += scale(2)) {
			gr.FillRectangle(dividerX, yy, 1, 1, g_colour_text & 0x45ffffff);
		}
	}

	this.schedule = function () {
		if (this.pendingTimer) window.ClearTimeout(this.pendingTimer);
		this.pendingTimer = window.SetTimeout((function () {
			this.pendingTimer = false;
			if (this.inputbox.text != this.lastText) {
				this.lastText = this.inputbox.text;
				filterResponse();
			}
		}).bind(this), 180);
	}

	this.clear = function () {
		if (!this.inputbox.text.length) return;
		this.inputbox.text = "";
		this.inputbox.prev_text = "";
		this.inputbox.offset = 0;
		this.inputbox.Cpos = 0;
		this.inputbox.SelBegin = 0;
		this.inputbox.SelEnd = 0;
		this.lastText = "";
		filterResponse();
		brw.repaint();
	}

	this.cancel_edit = function () {
		this.inputbox.on_focus(false);
		this.hoverIcon = false;
	}

	this.on_focus = function (focused) {
		this.inputbox.on_focus(focused);
	}

	this.on_key_down = function (vkey) {
		var before = this.inputbox.text;
		if (vkey == VK_RETURN) {
			filterResponse();
			return;
		}
		this.inputbox.on_key_down(vkey);
		if (this.inputbox.text != before) this.schedule();
	}

	this.on_char = function (code) {
		var before = this.inputbox.text;
		this.inputbox.on_char(code);
		if (this.inputbox.text != before) this.schedule();
	}

	this.on_mouse = function (event, x, y) {
		var inside = this.contains(x, y);
		var iconInside = this.icon_contains(x, y);
		if (event == "move") {
			var changed = this.hoverIcon != iconInside;
			this.hoverIcon = iconInside;
			this.inputbox.check("move", x, y);
			if (changed) brw.repaint();
			return inside;
		}

		if (!inside) {
			if (event == "lbtn_down") this.inputbox.check("lbtn_down", x, y);
			return false;
		}

		if (event == "lbtn_up" && iconInside && this.inputbox.text.length) {
			this.clear();
			return true;
		}

		var before = this.inputbox.text;
		this.inputbox.check(event, x, y);
		if (this.inputbox.text != before) this.schedule();
		return true;
	}

	this.dispose = function () {
		if (this.pendingTimer) window.ClearTimeout(this.pendingTimer);
		this.pendingTimer = false;
	}
}
