// =========================================================================================================
// Volumeknob Object - v2.0build20191019-jscript-panel3-opt1
// =========================================================================================================

var vknobOptions = {}, v_change = false, v_drag = false;

function VolumeKnob(x, y, w, h, options) {
	this.left = x;
	this.top = y;
	this.w = w;
	this.h = h;
	this.right = x + w;
	this.bottom = y + h;

	this.knob_depth = options && options.knob_depth != null ? Math.max(options.knob_depth, 1) : 0;
	this.line_width = options && options.line_width != null ? Math.max(options.line_width, 1) : 0;
	this.line_normal = options && options.line_normal != null ? options.line_normal : null;
	this.line_hover = options && options.line_hover != null ? options.line_hover : this.line_normal;
	this.colour_l = this.line_normal;
	this.back_normal = options && options.back_normal != null ? options.back_normal : null;
	this.back_hover = options && options.back_hover != null ? options.back_hover : this.back_normal;
	this.colour_b = this.back_normal;
	this.inactive_colour = options && options.inactive_colour != null ? options.inactive_colour : null;
	this.active_colour = options && options.active_colour != null ? options.active_colour : null;
	this.hover = false;

	this.traceMouse = function(x, y) {
		return x >= this.left && x <= this.right && y >= this.top && y <= this.bottom;
	}

	this.calc_theta = function(x, y) {
		x -= this.left + this.w / 2;
		y -= this.top + this.h / 2;
		var theta = Math.atan2(y, x) / Math.PI * 180;
		if (theta <= 90 && theta > 45) return 270;
		if (theta > 90 && theta < 135) return 0;
		return theta >= 0 ? theta > 90 ? theta - 135 : theta + 225 : theta + 225;
	};

	this.draw = function(gr) {
		var g_R = Math.min(this.w, this.h) / Math.PI;

		this.colour_b && darkOneFillEllipse(gr, this.left, this.top, this.w, this.h, this.colour_b);
		this.knob_depth > 0 && darkOneDrawEllipse(gr, this.left, this.top + this.line_width, this.w, this.h - this.line_width, this.knob_depth, 0x1FFFFFFF);
		this.knob_depth > 0 && darkOneDrawEllipse(gr, this.left, this.top, this.w, this.h - this.line_width, this.knob_depth, 0x3F000000);
		this.colour_l && this.line_width > 0 && darkOneDrawEllipse(gr, this.left, this.top, this.w, this.h, this.line_width, this.colour_l);
		gr.DrawLine(this.left + 1, this.bottom - 1, this.left + 1 + this.w / 12, this.bottom - 1 - this.h / 12, 2, ui_btntxtcol);
		gr.DrawLine(this.right - 1 - this.w / 12, this.bottom - 1 - this.w / 12, this.right - 1, this.bottom - 1, 2, ui_btntxtcol);

		var theta = (Math.pow(10, fb.Volume / 50) - 0.001) / 0.999 * 270;
		var posA = (theta - 45) * Math.PI / 180;
		var cosinusA = Math.cos(posA);
		var sinusA = Math.sin(posA);
		var posX = (this.left + (this.w / 2) - this.w / 20) - (cosinusA * g_R);
		var posY = (this.top + (this.h / 2) - this.w / 20) - (sinusA * g_R);

		var x_col = fb.Volume == -100 ? -65536 : v_change ? this.active_colour : this.inactive_colour;
		this.colour_l && this.line_width > 0 && darkOneDrawEllipse(gr, posX - this.line_width / 2, posY - this.line_width / 2, this.w / 10 + this.line_width, this.w / 10 + this.line_width, this.line_width, this.line_normal);
		this.inactive_colour && this.active_colour && this.line_width && darkOneFillEllipse(gr, posX , posY, this.w / 10, this.w / 10, x_col);
	}

	this.Repaint = function() {
		window.RepaintRect(this.left, this.top, this.w, this.h);
	}

	this.on_mouse_move = function(x, y) {
		if (this.traceMouse(x, y)) {
			if (v_drag) {
				var n = this.calc_theta(x, y) / 270;
				var v = 50 * Math.log(0.99 * n + 0.01) / Math.LN10;
				if (fb.Volume != v) fb.Volume = v;
			}
			this.colour_b = this.back_hover;
			this.colour_l = this.line_hover;
			!this.hover && this.Repaint();
			this.hover = true;
		} else {
			this.colour_b = this.back_normal;
			this.colour_l = this.line_normal;
			this.hover && this.Repaint();
			this.hover = false;
		}

		this.mouseX = x;
		this.mouseY = y;
	}

	this.on_mouse_lbtn_down = function(x, y) {
		v_drag = this.traceMouse(x, y);
	}

	this.on_mouse_lbtn_up = function(x, y) {
		this.on_mouse_move(x,y);
		v_drag = false;
	}

	this.on_mouse_leave = function() {
		var repaint = this.hover || v_drag;
		v_drag = false;
		this.hover = false;
		this.mouseX = null;
		this.mouseY = null;
		this.colour_b = this.back_normal;
		this.colour_l = this.line_normal;
		if (repaint) this.Repaint();
	}

	this.on_mouse_wheel = function(step) {
		if (this.mouseX != null && this.mouseY != null && this.traceMouse(this.mouseX, this.mouseY)) step > 0 ? fb.VolumeUp() : fb.VolumeDown();
	}

	this.on_mouse_rbtn_up = function(x, y) {
		var m = window.CreatePopupMenu();
		var q;

		m.AppendMenuItem(fb.Volume == 0 ? 1 : 0, 1, "Up");
		m.AppendMenuItem(fb.Volume == -100 ? 1 : 0, 2, "Down");
		m.AppendMenuItem(fb.Volume == -100 ? 8 : 0, 3, "Volume Mute");
		m.AppendMenuSeparator();
		for (var i = 0; i < 8; i++) m.AppendMenuItem(fb.Volume == i * -3 ? 8 : 0, i + 4, "Set to " + (i * -3) + " db");

		q = m.TrackPopupMenu(x, y);

		switch (true) {
			case q == 1:
				fb.VolumeUp();
				break;

			case q == 2:
				fb.VolumeDown();
				break;

			case q == 3:
				fb.VolumeMute();
				break;

			case q >= 4 && q <= 11:
				fb.RunMainMenuCommand("Playback/Volume/Set to -" + (q - 4) * 3 + " db");
				this.colour_b = this.back_normal;
				break;
		}

		m.Dispose();
	}
}