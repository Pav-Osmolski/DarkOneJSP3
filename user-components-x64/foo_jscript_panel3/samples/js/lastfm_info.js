function _lastfm_info(x, y, w, h) {
	this.containsXY = function (x, y) {
		return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
	}

	this.draw_row = function (gr, text, colour, x, y, w, h, text_alignment) {
		gr.WriteTextSimple(text, panel.fonts.normal, colour, x, y, w, h, text_alignment || DWRITE_TEXT_ALIGNMENT_LEADING, DWRITE_PARAGRAPH_ALIGNMENT_CENTER, DWRITE_WORD_WRAPPING_NO_WRAP, DWRITE_TRIMMING_GRANULARITY_CHARACTER);
	}

	this.font_changed = function () {
		this.size();
		this.reset();
	}

	this.get = function () {
		if (lastfm.api_key.empty())
			return;

		switch (this.properties.mode.value) {
		case 0:
			if (!_tagged(this.artist)) {
				return;
			}

			var url = lastfm.base_url() + '&limit=100&method=' + this.artist_methods[this.properties.artist_method.value].method + '&artist=' + encodeURIComponent(this.artist);
			break;
		case 1:
			if (this.properties.user_mode.value == 0) {
				var url = lastfm.base_url() + '&limit=100&method=' + this.chart_methods[this.properties.charts_method.value].method + '&period=' + this.chart_periods[this.properties.charts_period.value].period + '&user=' + lastfm.username;
			} else {
				var url = lastfm.base_url() + '&limit=100&method=user.getRecentTracks&user=' + lastfm.username;
			}
			break;
		}

		var task_id = utils.HTTPRequestAsync(window.ID, 0, url, lastfm.ua);
		this.filenames[task_id] = this.filename;
	}

	this.header_text = function () {
		if (this.properties.mode.value == 0) {
			return this.artist + ': ' + this.artist_methods[this.properties.artist_method.value].display;
		} else {
			if (this.properties.user_mode.value == 0) {
				return lastfm.username + ': ' + this.chart_periods[this.properties.charts_period.value].display + ' ' + this.chart_methods[this.properties.charts_method.value].display + ' charts';
			} else {
				return lastfm.username + ': recent tracks';
			}
		}
	}

	this.http_request_done = function (id, success, response_text) {
		var f = this.filenames[id];

		if (!f)
			return;

		if (!success) {
			console.log(N, response_text);
			return;
		}

		var data = _jsonParse(response_text);

		if (data.error) {
			console.log(N, data.message);
			return;
		}

		if (_save(f, response_text)) {
			this.reset();
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
		// user mode
		if (this.properties.mode.value == 1)
			return;

		if (panel.metadb) {
			var temp_artist = panel.tf(DEFAULT_ARTIST);
			if (this.artist == temp_artist)
				return;

			this.artist = temp_artist;
			this.update();
		} else {
			this.artist = '';
			this.filename = '';
			this.data = [];
			this.count = 0;
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
			break;
		case !this.in_range:
			break;
		default:
			var item = this.data[this.index];

			if (x > this.x + this.clickable_text_x && x < this.x + this.clickable_text_x + Math.min(item.width, this.text_width) && typeof item.url == 'string') {
				window.SetCursor(IDC_HAND);
				_tt(item.url);
			} else {
				_tt('');
			}
			break;
		}

		return true;
	}

	this.paint = function (gr) {
		if (lastfm.api_key.empty()) {
			gr.WriteTextSimple('Use the right click menu to set your own Last.fm API key.', panel.fonts.normal, panel.colours.text, this.x, this.y + _scale(12), this.w, this.h);
			return;
		}

		if (this.count == 0)
			return;

		switch (true) {
		case this.properties.mode.value == 1 && this.properties.user_mode.value == 0: // charts
			this.clickable_text_x = this.spacer_w + 5;
			this.text_width = Math.round(this.w * 0.5);
			var lastfm_charts_bar_x = this.x + this.clickable_text_x + this.text_width + 10;
			var unit_width = (this.w - lastfm_charts_bar_x - _scale(50)) / this.data[0].playcount;

			for (var i = 0; i < Math.min(this.count, this.rows); i++) {
				var bar_width = Math.ceil(unit_width * this.data[i + this.offset].playcount);
				this.draw_row(gr, this.data[i + this.offset].rank + '.', panel.colours.highlight, this.x, this.y + _scale(12) + (i * panel.row_height), this.clickable_text_x - 5, panel.row_height, DWRITE_TEXT_ALIGNMENT_TRAILING);
				this.draw_row(gr, this.data[i + this.offset].name, panel.colours.text, this.x + this.clickable_text_x, this.y + _scale(12) + (i * panel.row_height), this.text_width, panel.row_height);
				gr.FillRectangle(lastfm_charts_bar_x, this.y + _scale(13) + (i * panel.row_height), bar_width, panel.row_height - 3, panel.colours.highlight);
				this.draw_row(gr, _formatNumber(this.data[i + this.offset].playcount, ','), panel.colours.text, lastfm_charts_bar_x + bar_width + 5, this.y + _scale(12) + (i * panel.row_height), _scale(60), panel.row_height);
			}
			break;
		default: // other
			this.clickable_text_x = 0;
			this.text_width = this.w;

			for (var i = 0; i < Math.min(this.count, this.rows); i++) {
				this.draw_row(gr, this.data[i + this.offset].name, panel.colours.text, this.x, this.y + _scale(12) + (i * panel.row_height), this.text_width, panel.row_height);
			}
			break;
		}

		this.up_btn.paint(gr, panel.colours.text);
		this.down_btn.paint(gr, panel.colours.text);
	}

	this.playback_new_track = function () {;
		this.time_elapsed = 0;
		panel.item_focus_change();
	}

	this.playback_time = function () {
		this.time_elapsed++;

		if (this.time_elapsed == 3 && this.properties.mode.value == 1 && this.properties.user_mode.value == 1 && lastfm.username.length) {
			this.get();
		}
	}

	this.rbtn_up = function (x, y) {
		panel.m.AppendMenuItem(MF_STRING, 1100, 'Artist Info');
		panel.m.AppendMenuItem(MF_STRING, 1101, 'User Info');
		panel.m.CheckMenuRadioItem(1100, 1101, this.properties.mode.value + 1100);
		panel.m.AppendMenuSeparator();

		if (this.properties.mode.value == 0) {
			panel.m.AppendMenuItem(MF_STRING, 1102, 'Similar Artists');
			panel.m.AppendMenuItem(MF_STRING, 1103, 'Top Tracks');
			panel.m.AppendMenuItem(MF_STRING, 1104, 'Top Tags');
			panel.m.CheckMenuRadioItem(1102, 1104, this.properties.artist_method.value + 1102);
			panel.m.AppendMenuSeparator();
		} else {
			panel.m.AppendMenuItem(MF_STRING, 1110, 'Charts');
			panel.m.AppendMenuItem(MF_STRING, 1111, 'Recent Tracks');
			panel.m.CheckMenuRadioItem(1110, 1111, this.properties.user_mode.value + 1110);
			panel.m.AppendMenuSeparator();

			if (this.properties.user_mode.value == 0) {
				this.chart_methods.forEach(function (item, i) {
					panel.m.AppendMenuItem(MF_STRING, i + 1120, _.capitalize(item.display));
				});

				panel.m.CheckMenuRadioItem(1120, 1122, this.properties.charts_method.value + 1120);
				panel.m.AppendMenuSeparator();

				this.chart_periods.forEach(function (item, i) {
					panel.m.AppendMenuItem(MF_STRING, i + 1130, _.capitalize(item.display));
				});

				panel.m.CheckMenuRadioItem(1130, 1135, this.properties.charts_period.value + 1130);
				panel.m.AppendMenuSeparator();
			}
		}

		panel.m.AppendMenuItem(MF_STRING, 1150, 'Last.fm username...');
		panel.m.AppendMenuItem(MF_STRING, 1151, 'Last.fm API key...');
		panel.m.AppendMenuSeparator();
		panel.m.AppendMenuItem(EnableMenuIf(utils.IsFile(this.filename)), 1999, 'Open containing folder');
		panel.m.AppendMenuSeparator();
	}

	this.rbtn_up_done = function (idx) {
		switch (idx) {
		case 1100:
		case 1101:
			this.properties.mode.value = idx - 1100;
			this.reset();
			break;
		case 1102:
		case 1103:
		case 1104:
			this.properties.artist_method.value = idx - 1102;
			this.reset();
			break;
		case 1110:
		case 1111:
			this.properties.user_mode.value = idx - 1110;
			this.reset();
			break;
		case 1120:
		case 1121:
		case 1122:
			this.properties.charts_method.value = idx - 1120;
			this.reset();
			break;
		case 1130:
		case 1131:
		case 1132:
		case 1133:
		case 1134:
		case 1135:
			this.properties.charts_period.value = idx - 1130;
			this.reset();
			break;
		case 1150:
			lastfm.update_username();
			break;
		case 1151:
			lastfm.update_api_key();
			break;
		case 1999:
			_explorer(this.filename);
			break;
		}
	}

	this.reset = function () {
		this.count = 0;
		this.data = [];
		this.artist = '';

		if (this.properties.mode.value == 0) { // artist
			this.metadb_changed();
		} else { // user
			this.update();
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
		this.spacer_w = '0000'.calc_width2(panel.fonts.normal);
		this.filename = '';

		switch (this.properties.mode.value) {
		case 0:
			this.filename = _artistFolder(this.artist) + 'lastfm.' + this.artist_methods[this.properties.artist_method.value].method + '.json';
			if (utils.IsFile(this.filename)) {
				this.data = _(_.get(_jsonParseFile(this.filename), this.artist_methods[this.properties.artist_method.value].json, []))
					.map(function (item) {
						return {
							name : item.name,
							width : item.name.calc_width2(panel.fonts.normal),
							url : item.url
						};
					}, this)
					.value();

				if (_fileExpired(this.filename, ONE_DAY)) {
					this.get();
				}
			} else {
				this.get();
			}
			break;
		case 1:
			if (!lastfm.username.length) {
				console.log(N, 'Last.fm username not set.');
				break;
			}

			if (this.properties.user_mode.value == 0) {
				this.filename = folders.lastfm + lastfm.username + '.' + this.chart_methods[this.properties.charts_method.value].method + '.' + this.chart_periods[this.properties.charts_period.value].period + '.json';
				if (utils.IsFile(this.filename)) {
					var data = _.get(_jsonParseFile(this.filename), this.chart_methods[this.properties.charts_method.value].json, []);

					for (var i = 0; i < data.length; i++) {
						if (this.properties.charts_method.value == 0) {
							var name = data[i].name;
							var url = data[i].url;
						} else {
							var name = data[i].artist.name + ' - ' + data[i].name;
							var url = data[i].url;
						}
						this.data[i] = {
							name : name,
							width : name.calc_width2(panel.fonts.normal),
							url : url,
							playcount : data[i].playcount,
							rank : i > 0 && data[i].playcount == data[i - 1].playcount ? this.data[i - 1].rank : i + 1
						};
					}

					if (_fileExpired(this.filename, ONE_DAY)) {
						this.get();
					}
				} else {
					this.get();
				}
			} else {
				this.filename = folders.lastfm + lastfm.username + '.user.getRecentTracks.json';

				if (utils.IsFile(this.filename)) {
					this.data = _(_.get(_jsonParseFile(this.filename), 'recenttracks.track', []))
						.filter('date')
						.map(function (item) {
							var name = item.artist['#text'] + ' - ' + item.name;
							return {
								name : name,
								width : name.calc_width2(panel.fonts.normal),
								url : item.url
							};
						})
						.value();
				} else {
					this.get();
				}
			}
		}

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

	utils.CreateFolder(folders.artists);
	utils.CreateFolder(folders.lastfm);
	panel.list_objects.push(this);

	this.name = 'lastfm_info'; // needs a name to be triggerd by lastfm user name change
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
	this.spacer_w = 0;
	this.artist = '';
	this.filename = '';
	this.filenames = {};
	this.time_elapsed = 0;

	this.artist_methods = [{
			method : 'artist.getSimilar',
			json : 'similarartists.artist',
			display : 'similar artists',
		}, {
			method : 'artist.getTopTracks',
			json : 'toptracks.track',
			display : 'top tracks',
		}, {
			method : 'artist.getTopTags',
			json : 'toptags.tag',
			display : 'top tags',
		}
	];

	this.chart_methods = [{
			method : 'user.getTopArtists',
			json : 'topartists.artist',
			display : 'artist',
		}, {
			method : 'user.getTopAlbums',
			json : 'topalbums.album',
			display : 'album',
		}, {
			method : 'user.getTopTracks',
			json : 'toptracks.track',
			display : 'track',
		}
	];

	this.chart_periods = [{
			period : 'overall',
			display : 'overall',
		}, {
			period : '7day',
			display : 'last 7 days',
		}, {
			period : '1month',
			display : '1 month',
		}, {
			period : '3month',
			display : '3 month',
		}, {
			period : '6month',
			display : '6 month',
		}, {
			period : '12month',
			display : '12 month',
		}
	];

	this.properties = {
		mode : new _p('2K3.LIST.LASTFM.MODE2', 0), // 0 artist 1 user
		artist_method : new _p('2K3.LIST.LASTFM.ARTIST.METHOD', 0), // 0 similar artists 1 top tracks 2 top tags
		user_mode : new _p('2K3.LIST.LASTFM.USER.MODE', 0), // 0 charts 1 recent tracks
		charts_method : new _p('2K3.LIST.LASTFM.CHARTS.METHOD', 0),
		charts_period : new _p('2K3.LIST.LASTFM.CHARTS.PERIOD', 0),
	};

	if (this.properties.mode.value == 1) {
		this.update();
	}

	this.up_btn = new _sb(chars.up, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset > 0; }, this), _.bind(function () { this.wheel(1); }, this));
	this.down_btn = new _sb(chars.down, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset < this.count - this.rows; }, this), _.bind(function () { this.wheel(-1); }, this));
}
