// =========================================================================================================
// TextButton Object - v2.0build20191010-jscript-panel3-v042
// =========================================================================================================

function TextButton(text, func, x, y, w, h, size_options, options, colours, tiptext, funcOption) {
	this.text = text;
	this.func = func;
	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;

	var a_ = "text_x_margin;text_y_margin;func_left_pad;func_top_pad;func_right_pad;func_bottom_pad".split(";");
	for (var l = 0; l < 6; l++) this[a_[l]] = size_options && size_options[a_[l]] != null ? size_options[a_[l]] : 0;

	this.left = this.x + this.func_left_pad;
	this.top = this.y + this.func_top_pad;
	this.w_ = this.w - this.func_left_pad - this.func_right_pad;
	this.h_ = this.h - this.func_top_pad - this.func_bottom_pad;
	this.right = this.x + this.w - this.func_right_pad;
	this.bottom = this.y + this.h - this.func_bottom_pad;

	var b_ = "btn_style;font_style;line_width;text_align_h;text_align_v;text_onclick_shift;text_shadow;btn_depth;arc_override".split(";");
	for (var i = 0; i < b_.length; i++) this[b_[i]] = options && options[b_[i]] != null ? options[b_[i]] : 0;
	this.text_shift = 0;

	var c_ = "shadow_colour;text_normal;line_normal;back_normal;text_hover;line_hover;back_hover;text_down;line_down;back_down".split(";");
	for (var j = 0; j < 10; j++) this[c_[j]] = colours && colours[c_[j]] != null ? colours[c_[j]] : j < 4 ? null : this[c_[j - 3]];
	this.colour_text = this[c_[1]];
	this.colour_line = this[c_[2]];
	this.colour_back = this[c_[3]];

	var d_ = Math.floor(Math.min(this.w_ - this.line_width, this.h_ - this.line_width) / 2);
	this.arc_size = size_options && size_options.arc_size != null ? Math.min(d_, size_options.arc_size) : Math.min(d_, Math.min(this.w, this.h) / 6);

	this.funcOption = funcOption;
	this.state = ButtonStates.normal;

	this.traceMouse = function(x, y) {
		if (this.state == ButtonStates.hide) return false;

		var b = this.left < x && x < this.right && this.top < y && y < this.bottom;

		if (b) btn_down ? this.changeState(ButtonStates.down) : this.changeState(ButtonStates.hover);
		else this.changeState(ButtonStates.normal);
		return b;
	}

	this.changeState = function(newstate) {
		newstate != this.state && this.repaint();
		this.state = newstate;

		this.text_shift = this.state == ButtonStates.down ? this.text_onclick_shift : 0;

		switch (this.state) {
			case ButtonStates.normal:
				this.colour_text = this.text_normal;
				this.colour_line = this.line_normal;
				this.colour_back = this.back_normal;
				break;

			case ButtonStates.hover:
				this.colour_text = this.text_hover;
				this.colour_line = this.line_hover;
				this.colour_back = this.back_hover;
				break;

			case ButtonStates.down:
				this.colour_text = this.text_down;
				this.colour_line = this.line_down;
				this.colour_back = this.back_down;
				break;

			default:
				this.colour_text = this.colour_line = this.colour_back = null;
		}
	}

	this.draw = function(gr) {
		var a = this.h_ - this.line_width;
		var b = Math.min(a / 3, this.btn_depth);
		var c = this.arc_override ? this.arc_size : this.btn_style == 2 ? this.arc_size : Math.min(this.arc_size, Math.round(sysWidth / 640));

		if (this.btn_style == 3) {
			this.colour_back && darkOneFillEllipse(gr, this.left, this.top, this.w_, this.h_, this.colour_back);
			this.btn_depth > 0 && darkOneDrawEllipse(gr, this.left, this.top + this.line_width, this.w_, a, b, 0x1FFFFFFF);
			this.btn_depth > 0 && darkOneDrawEllipse(gr, this.left, this.top, this.w_, a, b, 0x3F000000);
			this.colour_line && this.line_width > 0 && darkOneDrawEllipse(gr, this.left, this.top, this.w_, this.h_, this.line_width, this.colour_line);
		} else if (c <= 0) {
			this.colour_back && gr.FillRectangle(this.left, this.top, this.w_, this.h_, this.colour_back);
			this.btn_depth > 0 && gr.DrawRectangle(this.left, this.top + this.line_width, this.w_, a, b, 0x1FFFFFFF);
			this.btn_depth > 0 && gr.DrawRectangle(this.left, this.top, this.w_, a, b, 0x3F000000);
			this.colour_line && this.line_width > 0 && gr.DrawRectangle(this.left, this.top, this.w_, this.h_, this.line_width, this.colour_line);
		} else {
			this.colour_back && gr.FillRoundedRectangle(this.left, this.top, this.w_, this.h_, c, c, this.colour_back);
			this.btn_depth > 0 && gr.DrawRoundedRectangle(this.left, this.top + this.line_width, this.w_, a, c, c, b, 0x1FFFFFFF);
			this.btn_depth > 0 && gr.DrawRoundedRectangle(this.left, this.top, this.w_, a, c, c, b, 0x3F000000);
			this.colour_line && this.line_width > 0 && gr.DrawRoundedRectangle(this.left, this.top, this.w_, this.h_, c, c, this.line_width, this.colour_line);
		}

		var d = this.text != "" ? darkOneCalcTextHeight(this.text, btn_font) : 0;
		var e = this.text_align_v == 1 ? this.y + Math.floor((this.h - d) / 2) : this.text_align_v == 2 ? this.y + Math.floor(this.h / 3 * 2) : this.y;
		if (d > 0) {
			if (this.text_shadow > 0) darkOneDrawText(gr, this.text, btn_font, this.shadow_colour, this.x + this.text_x_margin + Math.abs(this.text_shift) + this.text_shadow, e + this.text_y_margin + this.text_shift + this.text_shadow, this.w, d, this.text_align_h);
			darkOneDrawText(gr, this.text, btn_font, this.colour_text, this.x + this.text_x_margin + Math.abs(this.text_shift), e + this.text_y_margin + this.text_shift, this.w, d, this.text_align_h);
		}
	}

	this.repaint = function() {
		window.RepaintRect(this.x, this.y, this.w, this.h);
	}

	this.onClick = function() {
		this.func && this.func();
	}
}