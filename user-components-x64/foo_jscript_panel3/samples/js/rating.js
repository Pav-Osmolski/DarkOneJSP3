function _rating(x, y, h, colour) {
	this.containsXY = function (x, y) {
		return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
	}

	this.get_max = function () {
		return this.properties.mode.value < 2 ? 5 : this.properties.max.value;
	}

	this.get_rating = function () {
		switch (this.properties.mode.value) {
		case 1: // foo_playcount
			return panel.tf('$if2(%rating%,0)');
		case 2: // file tag
			var ret = 0;
			var f = panel.metadb.GetFileInfo();
			if (f) {
				var idx = f.MetaFind(this.properties.tag.value);
				ret = idx > -1 ? f.MetaValue(idx, 0) : 0;
				f.Dispose();
			}
			return ret;
		default:
			return 0;
		}
	}

	this.init = _.bind(function () {
		if (this.properties.mode.value == 1 && !this.foo_playcount) { // if mode is set to 1 (foo_playcount) but component is missing, reset to 0.
			this.properties.mode.value = 0;
		}

		if (this.properties.mode.value == 0) {
			utils.ShowPopupMessage('Rating supports 2 different modes.\n\nYou can use foo_playcount which is limited to 5 stars or you can choose to write to your file tags. You can choose the tag name and a max value via the right click menu.', window.Name);
		}
	}, this);

	this.leave = function () {
		if (this.hover) {
			_tt('');
			this.hover = false;
			window.RepaintRect(this.x, this.y, this.w, this.h);
		}
	}

	this.lbtn_up = function (x, y) {
		if (!this.containsXY(x, y))
			return false;

		if (panel.metadb) {
			this.set_rating();
		}

		return true;
	}

	this.metadb_changed = function () {
		if (panel.metadb) {
			this.hover = false;
			this.rating = this.get_rating();
			this.hrating = this.rating;
			this.tiptext = this.properties.mode.value == 0 ? 'Choose a mode first.' : panel.tf('Rate "%title%" by "%artist%".');
		}

		window.Repaint();
	}

	this.move = function (x, y) {
		if (this.containsXY(x, y)) {
			if (panel.metadb) {
				_tt(this.tiptext);
				this.hover = true;
				this.hrating = Math.ceil((x - this.x) / this.h);
				window.RepaintRect(this.x, this.y, this.w, this.h);
			}

			return true;
		}

		this.leave();
		return false;
	}

	this.paint = function (gr) {
		if (panel.metadb) {
			for (var i = 0; i < this.get_max(); i++) {
				gr.WriteTextSimple(i + 1 > (this.hover ? this.hrating : this.rating) ? chars.rating_off : chars.rating_on, this.font, this.colour, this.x + (i * this.h), this.y, this.h, this.h, 2, 2);
			}
		}
	}

	this.rbtn_up = function (x, y) {
		_.forEach(this.modes, function (item, i) {
			panel.s10.AppendMenuItem(EnableMenuIf(this.foo_playcount || i != 1), i + 1000, item);
		}, this);

		panel.s10.CheckMenuRadioItem(1000, 1002, this.properties.mode.value + 1000);
		panel.s10.AppendTo(panel.m, MF_STRING, 'Mode');
		panel.m.AppendMenuItem(EnableMenuIf(this.properties.mode.value == 2), 1004, 'Tag name');
		panel.m.AppendMenuItem(EnableMenuIf(this.properties.mode.value == 2), 1005, 'Max value...');
		panel.m.AppendMenuSeparator();
	}

	this.rbtn_up_done = function (idx) {
		switch (idx) {
		case 1000:
		case 1001:
		case 1002:
			this.properties.mode.value = idx - 1000;
			break;
		case 1004:
			var tmp = utils.InputBox('Enter a custom tag name. Do not use %%. Defaults to "rating" if left blank.', window.Name, this.properties.tag.value);
			this.properties.tag.value = tmp || this.properties.tag.default_;
			break;
		case 1005:
			var tmp = Number(utils.InputBox('Enter a maximum value. Defaults to "5" if left blank.', window.Name, this.properties.max.value));
			this.properties.max.value = tmp > 0 ? tmp : this.properties.max.default_;
			break;
		}

		this.w = this.h * this.get_max();
		this.metadb_changed();
		on_size();
		window.Repaint();
	}

	this.set_rating = function () {
		var handles = fb.CreateHandleList(panel.metadb);

		switch (this.properties.mode.value) {
		case 1: // foo_playcount
			handles.RunContextCommand('Playback Statistics/Rating/' + (this.hrating == this.rating ? '<not set>' : this.hrating));
			break;
		case 2: // file tag
			var tmp = this.hrating == this.rating ? '' : this.hrating;
			var obj = {};
			obj[this.properties.tag.value] = tmp;

			handles.UpdateFileInfoFromJSON(JSON.stringify(obj));
			break;
		}

		handles.Dispose();
	}

	this.properties = {
		max : new _p('2K3.RATING.MAX', 5),
		mode : new _p('2K3.RATING.MODE', 0), // 0 not set 1 foo_playcount 2 file tag
		tag: new _p('2K3.RATING.TAG', 'rating')
	};

	this.x = x;
	this.y = y;
	this.h = _scale(h);
	this.w = this.h * this.get_max();
	this.colour = colour;
	this.font = JSON.stringify({Name:'Segoe Fluent Icons',Size:this.h-2});
	this.hover = false;
	this.rating = 0;
	this.hrating = 0;
	this.modes = ['Not Set', 'foo_playcount', 'File Tag'];
	this.foo_playcount = fb.CheckComponent('foo_playcount');

	window.SetTimeout(this.init, 500);
}
