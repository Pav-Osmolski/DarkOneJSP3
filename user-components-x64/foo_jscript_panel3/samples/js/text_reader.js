function _text_reader(x, y, w, h) {
	this.clear_layout = function () {
		if (this.text_layout) {
			this.text_layout.Dispose();
			this.text_layout = null;
		}
	}

	this.containsXY = function (x, y) {
		return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
	}

	this.font_changed = function () {
		this.reset();
		this.metadb_changed();
	}

	this.header_text = function () {
		return panel.tf(this.properties.title_tf.value);
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

	this.metadb_changed = function () {
		if (panel.metadb) {
			var str = '';

			var temp_filename = panel.tf(this.properties.filename_tf.value);
			if (this.filename == temp_filename) {
				window.Repaint(); // title might have changed
				return;
			}

			this.filename = temp_filename;

			if (utils.IsFolder(this.filename)) {
				this.filename = _.first(_getFiles(this.filename, this.exts))
			}

			if (this.properties.utf8.enabled) {
				str = utils.ReadUTF8(this.filename);
			} else {
				var codepage = utils.DetectCharset(this.filename);
				str = utils.ReadTextFile(this.filename, codepage);
			}

			str = str.replace(/\t/g, '    ');

			if (str != this.text) {
				this.clear_layout()
				this.text = str;

				if (this.text.length) {
					this.text_layout = utils.CreateTextLayout(this.text, this.properties.fixed.enabled ? 'Consolas' : panel.fonts.name, _scale(panel.fonts.size.value));
				}
			}
		} else {
			this.clear_layout();
			this.reset();
		}
		this.update();
		window.Repaint();
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
		panel.m.AppendMenuItem(MF_STRING, 1300, 'Refresh');
		panel.m.AppendMenuSeparator();
		panel.m.AppendMenuItem(MF_STRING, 1301, 'Custom title...');
		panel.m.AppendMenuSeparator();
		panel.m.AppendMenuItem(MF_STRING, 1302, 'Custom path...');
		panel.m.AppendMenuSeparator();
		panel.m.AppendMenuItem(CheckMenuIf(this.properties.fixed.enabled), 1303, 'Fixed width font');
		panel.m.AppendMenuSeparator();
		panel.s10.AppendMenuItem(MF_STRING, 1310, 'UTF8');
		panel.s10.AppendMenuItem(MF_STRING, 1311, 'Auto-detect');
		panel.s10.CheckMenuRadioItem(1310, 1311, this.properties.utf8.enabled ? 1310 : 1311);
		panel.s10.AppendTo(panel.m, MF_STRING, 'Encoding');
		panel.m.AppendMenuSeparator();
		panel.m.AppendMenuItem(EnableMenuIf(utils.IsFile(this.filename)), 1999, 'Open containing folder');
		panel.m.AppendMenuSeparator();
	}

	this.rbtn_up_done = function (idx) {
		switch (idx) {
		case 1300:
			this.clear_layout();
			this.reset();
			this.metadb_changed();
			break;
		case 1301:
			this.properties.title_tf.value = utils.InputBox('You can use full title formatting here.', window.Name, this.properties.title_tf.value);
			window.Repaint();
			break;
		case 1302:
			this.properties.filename_tf.value = utils.InputBox('Use title formatting to specify a path to a text file. eg: $directory_path(%path%)\\info.txt\n\nIf you prefer, you can specify just the path to a folder and the first txt or log file will be used.', window.Name, this.properties.filename_tf.value);
			this.metadb_changed();
			break;
		case 1303:
			this.properties.fixed.toggle();
			this.clear_layout();
			this.reset();
			this.metadb_changed();
			break;
		case 1310:
		case 1311:
			this.properties.utf8.enabled = idx == 1310;
			this.clear_layout();
			this.reset();
			this.metadb_changed();
			break;
		case 1999:
			_explorer(this.filename);
			break;
		}
	}

	this.reset = function () {
		this.text = this.filename = '';
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

	panel.text_objects.push(this);
	this.name = 'text_reader';

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

	this.filename = '';
	this.exts = ['txt', 'log'];

	this.properties = {
		title_tf : new _p('2K3.TEXT.TITLE.TF', '%album artist% - $if2(%album%,%title%)'),
		filename_tf : new _p('2K3.TEXT.FILENAME.TF', '$directory_path(%path%)'),
		fixed : new _p('2K3.TEXT.FONTS.FIXED', true),
		utf8 : new _p('2K3.TEXT.UTF8', true),
	};

	this.up_btn = new _sb(chars.up, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset < 0; }, this), _.bind(function () { this.wheel(1); }, this));
	this.down_btn = new _sb(chars.down, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset > this.ha - this.text_height; }, this), _.bind(function () { this.wheel(-1); }, this));
}
