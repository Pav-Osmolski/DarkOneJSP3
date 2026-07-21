function _console(x, y, w, h) {
	this.clear_layout = function () {
		if (this.text_layout) {
			this.text_layout.Dispose();
			this.text_layout = null;
		}
	}

	this.console_refresh = function () {
		this.clear_layout();
		this.colour_string = '';
		var lines = _(console.GetLines(this.properties.timestamp.enabled).toArray())
			.takeRight(100)
			.value();

		if (lines.length > 0) {
			var str = lines.join(CRLF);

			// apply highlight colour to timestamp if available
			if (this.properties.timestamp.enabled && panel.colours.text != panel.colours.highlight) {
				var colours = [];
				colours.push({
					'Start' : 0,
					'Length' : str.length,
					'Colour' : panel.colours.text,
				});

				var start = 0;

				for (var i = 0; i < lines.length; i++) {
					colours.push({
						'Start' : start,
						'Length' : 23,
						'Colour' : panel.colours.highlight,
					});

					start += lines[i].length + CRLF.length;
				}

				this.colour_string = JSON.stringify(colours);
			}

			this.text_layout = utils.CreateTextLayout(str, panel.fonts.name, _scale(panel.fonts.size.value));
		}

		this.update();
	}

	this.containsXY = function (x, y) {
		return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
	}

	this.font_changed = function () {
		this.console_refresh();
	}

	this.header_text = function () {
		return 'Console';
	}

	this.key_down = function (k) {
		switch (k) {
		case VK_UP:
			this.wheel(1);
			return true;
		case VK_DOWN:
			this.wheel(-1);
			return true;
		default:
			return false;
		}
	}

	this.lbtn_up = function (x, y) {
		if (!this.containsXY(x, y))
			return false;

		this.up_btn.lbtn_up(x, y);
		this.down_btn.lbtn_up(x, y);
		return true;
	}

	this.move = function (x, y) {
		this.mx = x;
		this.my = y;
		window.SetCursor(IDC_ARROW);

		if (!this.containsXY(x, y))
			return false;

		this.up_btn.move(x, y);
		this.down_btn.move(x, y);
		return true;
	}

	this.paint = function (gr) {
		if (this.text_layout) {
			gr.WriteTextLayout(this.text_layout, this.colour_string || panel.colours.text, this.x, this.y + _scale(12), this.w, this.ha, this.offset);
			this.up_btn.paint(gr, panel.colours.text);
			this.down_btn.paint(gr, panel.colours.text);
		}
	}

	this.rbtn_up = function (x, y) {
		panel.m.AppendMenuItem(MF_STRING, 1010, 'Clear');
		panel.m.AppendMenuSeparator();
		panel.m.AppendMenuItem(CheckMenuIf(this.properties.timestamp.enabled), 1011, 'Show timestamp');
		panel.m.AppendMenuSeparator();
	}

	this.rbtn_up_done = function (idx) {
		switch (idx) {
		case 1010:
			console.ClearBacklog();
			break;
		case 1011:
			this.properties.timestamp.toggle();
			this.console_refresh();
			window.Repaint();
			break;
		}
	}

	this.size = function () {
		this.ha = this.h - _scale(24);
		this.up_btn.x = this.x + Math.round((this.w - _scale(12)) / 2);
		this.down_btn.x = this.up_btn.x;
		this.up_btn.y = this.y;
		this.down_btn.y = this.y + this.h - _scale(12);
		this.update();
	}

	this.update = function () {
		if (!this.text_layout) {
			this.text_height = 0;
			return;
		}

		this.text_height = this.text_layout.CalcTextHeight(this.w);
		this.scroll_step = _scale(panel.fonts.size.value) * 4;

		if (this.text_height < this.ha)
			this.offset = 0;
		else
			this.offset = -(this.text_height - this.ha);
	}

	this.wheel = function (s) {
		if (!this.containsXY(this.mx, this.my))
			return false;

		if (this.text_height > this.ha) {
			this.offset += s * this.scroll_step;

			if (this.offset > 0)
				this.offset = 0;
			else if (this.offset < this.ha - this.text_height)
				this.offset = this.ha - this.text_height;

			window.RepaintRect(this.x, this.y, this.w, this.h);
		}

		return true;
	}

	panel.text_objects.push(this);
	this.name = 'console';

	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;
	this.ha = h - _scale(24); // height adjusted for up/down buttons
	this.text_layout = null;
	this.text_height = 0;
	this.scroll_step = 0;
	this.mx = 0;
	this.my = 0;
	this.offset = 0;
	this.text = '';

	this.colour_string = '';

	this.properties = {
		timestamp : new _p('2K3.TEXT.CONSOLE.TIMESTAMP', true)
	};

	this.up_btn = new _sb(chars.up, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset < 0; }, this), _.bind(function () { this.wheel(1); }, this));
	this.down_btn = new _sb(chars.down, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset > this.ha - this.text_height; }, this), _.bind(function () { this.wheel(-1); }, this));
}
