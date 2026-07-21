function _properties(mode, x, y, w, h) {
	this.add_location = function () {
		var names = ['FILE NAME', 'FOLDER NAME', 'FILE PATH', 'SUBSONG INDEX', 'FILE SIZE', 'FILE CREATED', 'LAST MODIFIED'];
		var values = [panel.tf('%filename_ext%'), panel.tf('$directory_path(%path%)'), this.filename, panel.metadb.SubSong, panel.tf('[%filesize_natural%]'), panel.tf('[%file_created%]'), panel.tf('[%last_modified%]')];
		var urls = ['%filename_ext% IS ', '"$directory_path(%path%)" IS ', '%path% IS ', '%subsong% IS ', '%filesize_natural% IS ', '%file_created% IS ', '%last_modified% IS '];

		for (var i = 0; i < 7; i++) {
			this.data.push({
				name : names[i],
				value : values[i],
				url : urls[i] + values[i]
			});
		}

		this.add_separator();
	}

	this.add_meta = function (f) {
		for (var i = 0; i < f.MetaCount; i++) {
			var name = f.MetaName(i).toUpperCase();
			var num = f.MetaValueCount(i);
			for (var j = 0; j < num; j++) {
				var value = f.MetaValue(i, j).replace(/\s{2,}/g, ' ');
				var url = '';
				if (_isUUID(value)) {
					url = this.get_musicbrainz_url(name, value);
				}
				if (url.empty()) {
					url = name.toLowerCase() + (num == 1 ? ' IS ' : ' HAS ') + value;
				}
				this.data.push({
					name : j == 0 ? name : '',
					value : value,
					url : url
				});
			}
		}

		if (this.data.length) {
			if (this.mode == 'properties_other_info') {
				this.data.unshift({
					name : 'Metadata',
					value : 'SECTION_HEADER',
				});
			}
			this.add_separator();
		}
	}

	this.add_other_info = function () {
		var tmp = JSON.parse(fb.CreateHandleList(panel.metadb).GetOtherInfo());

		_.forEach(['Location', 'General'], function (item) {
			this.add_section(tmp[item], item);
		}, this);

		for (var i in tmp) {
			if (i != 'General' && i != 'Location') {
				this.add_section(tmp[i], i);
			}
		}
	}

	this.add_section = function (obj, name) {
		this.data.push({
			name : name,
			value : 'SECTION_HEADER',
		});

		for (var i in obj) {
			this.data.push({
				name : i,
				value : obj[i],
			});
		}

		this.add_separator();
	}

	this.add_separator = function () {
		this.data.push({ name : '', value : '' });
	}

	this.add_tech = function (f) {
		var duration = utils.FormatDuration(Math.max(0, panel.metadb.Length));
		var tmp = [];

		this.data.push({
			name : 'DURATION',
			value : duration,
			url : '%length% IS ' + duration,
		});

		for (var i = 0; i < f.InfoCount; i++) {
			var name = f.InfoName(i);
			var value = f.InfoValue(i).replace(/\s{2,}/g, ' ');

			tmp.push({
				name : name.toUpperCase(),
				value : value,
				url : '%__' + name.toLowerCase() + '% IS ' + value
			});
		}

		Array.prototype.push.apply(this.data, _.sortByOrder(tmp, 'name'));
		this.add_separator();
	}

	this.containsXY = function (x, y) {
		return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
	}

	this.draw_row = function (gr, text, colour, x, y, w, h, text_alignment) {
		gr.WriteTextSimple(text, panel.fonts.normal, colour, x, y, w, h, text_alignment || DWRITE_TEXT_ALIGNMENT_LEADING, DWRITE_PARAGRAPH_ALIGNMENT_CENTER, DWRITE_WORD_WRAPPING_NO_WRAP, DWRITE_TRIMMING_GRANULARITY_CHARACTER);
	}

	this.font_changed = function () {
		this.size();
		this.metadb_changed();
	}

	this.get_musicbrainz_url = function (name, value) {
		switch (name) {
		case 'MUSICBRAINZ_ARTISTID':
		case 'MUSICBRAINZ_ALBUMARTISTID':
		case 'MUSICBRAINZ ARTIST ID':
		case 'MUSICBRAINZ ALBUM ARTIST ID':
			return 'https://musicbrainz.org/artist/' + value;
		case 'MUSICBRAINZ_ALBUMID':
		case 'MUSICBRAINZ ALBUM ID':
			return 'https://musicbrainz.org/release/' + value;
		case 'MUSICBRAINZ_RELEASEGROUPID':
		case 'MUSICBRAINZ RELEASE GROUP ID':
			return 'https://musicbrainz.org/release-group/' + value;
		case 'MUSICBRAINZ_RELEASETRACKID':
		case 'MUSICBRAINZ RELEASE TRACK ID':
			return 'https://musicbrainz.org/track/' + value;
		case 'MUSICBRAINZ_TRACKID':
		case 'MUSICBRAINZ TRACK ID':
			return 'https://musicbrainz.org/recording/' + value;
		case 'MUSICBRAINZ_WORKID':
		case 'MUSICBRAINZ WORK ID':
			return 'https://musicbrainz.org/work/' + value;
		default:
			return '';
		}
	}

	this.header_text = function () {
		return panel.tf('%artist% - %title%');
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

		switch (true) {
		case this.up_btn.lbtn_up(x, y):
		case this.down_btn.lbtn_up(x, y):
		case !this.in_range:
			break;
		default:
			var item = this.data[this.index];

			if (x > this.x + this.clickable_text_x && x < this.x + this.clickable_text_x + Math.min(item.width, this.text_width) && typeof item.url == 'string') {
				if (_.startsWith(item.url, 'http')) {
					utils.Run(item.url);
				} else {
					plman.ActivePlaylist = plman.CreateAutoPlaylist(plman.PlaylistCount, item.value, item.url);
				}
			}

			break;
		}

		return true;
	}

	this.metadb_changed = function () {
		if (panel.metadb) {
			this.update();
		} else {
			this.count = 0;
			this.data = [];
			window.Repaint();
		}
	}

	this.move = function (x, y) {
		this.mx = x;
		this.my = y;
		window.SetCursor(IDC_ARROW);

		if (!this.containsXY(x, y))
			return false;

		this.index = Math.floor((y - this.y - _scale(12)) / panel.row_height) + this.offset;
		this.in_range = this.index >= this.offset && this.index < this.offset + Math.min(this.rows, this.count);

		switch (true) {
		case this.up_btn.move(x, y):
		case this.down_btn.move(x, y):
		case !this.in_range:
			break;
		default:
			var item = this.data[this.index];
			if (x > this.x + this.clickable_text_x && x < this.x + this.clickable_text_x + Math.min(item.width, this.text_width) && typeof item.url == 'string') {
				window.SetCursor(IDC_HAND);

				if (_.startsWith(item.url, 'http')) {
					_tt(item.url);
				} else {
					_tt('Autoplaylist: ' + item.url);
				}
			} else {
				_tt('');
			}
			break;
		}

		return true;
	}

	this.paint = function (gr) {
		if (this.count == 0)
			return;

		this.clickable_text_x = Math.min(this.w * 0.5, this.properties_value_x);
		this.text_width = this.w - this.clickable_text_x;

		for (var i = 0; i < Math.min(this.count, this.rows); i++) {
			if (this.data[i + this.offset].value == 'SECTION_HEADER') {
				this.draw_row(gr, this.data[i + this.offset].name, panel.colours.highlight, this.x, this.y + _scale(12) + (i * panel.row_height), this.w, panel.row_height);
			} else {
				this.draw_row(gr, this.data[i + this.offset].name, panel.colours.text, this.x, this.y + _scale(12) + (i * panel.row_height), this.clickable_text_x - 10, panel.row_height);
				this.draw_row(gr, this.data[i + this.offset].value, panel.colours.highlight, this.x + this.clickable_text_x, this.y + _scale(12) + (i * panel.row_height), this.text_width, panel.row_height);
			}
		}

		this.up_btn.paint(gr, panel.colours.text);
		this.down_btn.paint(gr, panel.colours.text);
	}

	this.rbtn_up = function (x, y) {
		if (this.mode == 'properties') {
			panel.m.AppendMenuItem(CheckMenuIf(this.properties.meta.enabled), 1300, 'Metadata');
			panel.m.AppendMenuItem(CheckMenuIf(this.properties.location.enabled), 1301, 'Location');
			panel.m.AppendMenuItem(CheckMenuIf(this.properties.tech.enabled), 1302, 'Tech Info');
			panel.m.AppendMenuSeparator();
		}

		panel.m.AppendMenuItem(EnableMenuIf(utils.IsFile(this.filename)), 1999, 'Open containing folder');
		panel.m.AppendMenuSeparator();
	}

	this.rbtn_up_done = function (idx) {
		switch (idx) {
		case 1300:
			this.properties.meta.toggle();
			this.metadb_changed();
			break;
		case 1301:
			this.properties.location.toggle();
			this.metadb_changed();
			break;
		case 1302:
			this.properties.tech.toggle();
			this.metadb_changed();
			break;
		case 1999:
			_explorer(this.filename);
			break;
		}
	}

	this.size = function () {
		this.index = 0;
		this.offset = 0;
		this.rows = Math.floor((this.h - _scale(24)) / panel.row_height);
		this.up_btn.x = this.x + Math.round((this.w - _scale(12)) * 0.5);
		this.down_btn.x = this.up_btn.x;
		this.up_btn.y = this.y;
		this.down_btn.y = this.y + this.h - _scale(12);
	}

	this.update = function () {
		this.data = [];
		this.properties_value_x = 0;
		this.filename = panel.metadb.Path;
		var fileinfo = panel.metadb.GetFileInfo();

		if (this.mode == 'properties') {
			if (this.properties.meta.enabled) {
				this.add_meta(fileinfo);
			}
			if (this.properties.location.enabled) {
				this.add_location();
			}
			if (this.properties.tech.enabled) {
				this.add_tech(fileinfo);
			}
		} else {
			this.add_meta(fileinfo);
			this.add_other_info();
		}

		this.data.pop();

		_.forEach(this.data, function (item) {
			item.width = item.value.calc_width2(panel.fonts.normal);
			if (item.value != 'SECTION_HEADER') {
				this.properties_value_x = Math.max(this.properties_value_x, item.name.calc_width2(panel.fonts.normal) + 20);
			}
		}, this);

		fileinfo.Dispose();
		this.count = this.data.length;
		this.offset = 0;
		this.index = 0;
		window.Repaint();
	}

	this.wheel = function (s) {
		if (!this.containsXY(this.mx, this.my))
			return false;

		if (this.count > this.rows) {
			var offset = this.offset - (s * 3);

			if (offset < 0) {
				offset = 0;
			} else if (offset + this.rows > this.count) {
				offset = this.count - this.rows;
			}

			if (this.offset != offset) {
				this.offset = offset;
				window.RepaintRect(this.x, this.y, this.w, this.h);
			}
		}

		return true;
	}

	panel.list_objects.push(this);
	this.mode = mode;

	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;
	this.mx = 0;
	this.my = 0;
	this.index = 0;
	this.offset = 0;
	this.count = 0;
	this.data = [];
	this.clickable_text_x = 0;
	this.filename = '';
	this.properties_value_x = 0;

	if (this.mode == 'properties') {
		this.properties = {
			meta : new _p('2K3.LIST.PROPERTIES.META', true),
			location : new _p('2K3.LIST.PROPERTIES.LOCATION', true),
			tech : new _p('2K3.LIST.PROPERTIES.TECH', true),
		}
	}

	this.up_btn = new _sb(chars.up, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset > 0; }, this), _.bind(function () { this.wheel(1); }, this));
	this.down_btn = new _sb(chars.down, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset < this.count - this.rows; }, this), _.bind(function () { this.wheel(-1); }, this));
}
