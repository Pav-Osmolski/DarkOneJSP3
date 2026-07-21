function _play_log(x, y, w, h) {
	this.clear_layout = function () {
		if (this.text_layout) {
			this.text_layout.Dispose();
			this.text_layout = null;
		}
	}

	this.containsXY = function (x, y) {
		return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
	}

	this.create_layout = function () {
		this.clear_layout();

		if (this.text.length) {
			this.text_layout = utils.CreateTextLayout(this.text, panel.fonts.name, _scale(panel.fonts.size.value));
		}

		this.update();
		window.Repaint();
	}

	this.font_changed = function () {
		this.create_layout();
	}

	this.get_lines = function () {
		var lines = _stringToArray(this.text, CRLF);

		if (this.properties.limit.value > 0) {
			lines = _.take(lines, this.properties.limit.value);
		}

		return lines;
	}

	this.header_text = function () {
		return 'Play Log';
	}

	this.log = function () {
		var current = this.tfo.Eval();

		if (current != this.last) {
			this.last = current;
			var str = utils.TimestampToDateString(utils.Now()) + ' ' + current;

			var lines = this.get_lines();

			if (lines.length == this.properties.limit.value) {
				lines.pop();
			}

			lines.unshift(str);

			this.text = lines.join(CRLF);
			_save(this.filename, this.text);

			this.create_layout();
		}
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
			gr.WriteTextLayout(this.text_layout, panel.colours.text, this.x, this.y + _scale(12), this.w, this.ha, this.offset);
			this.up_btn.paint(gr, panel.colours.text);
			this.down_btn.paint(gr, panel.colours.text);
		}
	}

	this.rbtn_up = function (x, y) {
		panel.m.AppendMenuItem(MF_STRING, 1200, 'Title format...');
		panel.m.AppendMenuItem(MF_STRING, 1201, 'Limit');
		panel.m.AppendMenuItem(MF_STRING, 1202, 'Clear');
		panel.m.AppendMenuSeparator();
		panel.m.AppendMenuItem(EnableMenuIf(utils.IsFile(this.filename)), 1999, 'Open containing folder');
		panel.m.AppendMenuSeparator();
	}

	this.rbtn_up_done = function (idx) {
		switch (idx) {
		case 1200:
			var tmp = utils.InputBox('Enter title format pattern.', window.Name, this.properties.tf.value);

			if (tmp.empty()) {
				tmp = this.properties.tf.default_;
			}

			if (tmp != this.properties.tf.value) {
				this.properties.tf.value = tmp;
				this.tfo = panel.get_tfo(this.properties.tf.value);
			}
			break;
		case 1201:
			var tmp = Number(utils.InputBox('Enter limit', window.Name, this.properties.limit.value));
			this.properties.limit.value =  tmp >= 0 ? tmp : this.properties.limit.default_;
			this.text = this.get_lines().join(CRLF);
			_save(this.filename, this.text);
			this.create_layout();
			break;
		case 1202:
			this.text = '';
			_save(this.filename, this.text);
			this.clear_layout();
			window.Repaint();
			break;
		case 1999:
			_explorer(this.filename);
			break;
		}
	}

	this.read_file = function () {
		this.text = utils.ReadUTF8(this.filename);
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
		else if (this.offset < this.ha - this.text_height)
			this.offset = this.ha - this.text_height;
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

	utils.CreateFolder(folders.data);
	panel.text_objects.push(this);
	this.name = 'play_log';

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

	this.properties = {
		limit : new _p('2K3.TEXT.LOG.LIMIT', 100),
		tf : new _p('2K3.TEXT.LOG.TF', '[%artist% - ]%title%'),
	};

	this.filename = '';
	this.last = '';
	this.tfo = panel.get_tfo(this.properties.tf.value);
	this.filename = folders.data + 'play_log.txt';
	this.read_file();
	this.create_layout();

	this.up_btn = new _sb(chars.up, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset < 0; }, this), _.bind(function () { this.wheel(1); }, this));
	this.down_btn = new _sb(chars.down, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset > this.ha - this.text_height; }, this), _.bind(function () { this.wheel(-1); }, this));
}
