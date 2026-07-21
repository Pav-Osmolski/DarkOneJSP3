function _images() {
	this.containsXY = function (x, y) {
		return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
	}

	this.draw_blurred_image = function (gr) {
		gr.Clear(RGB(30, 30, 30));
		_drawImage(gr, this.bitmap.blur, 0, 0, panel.w, panel.h, image.crop, this.properties.blur_opacity.value);
	}

	this.download = function () {
		if (!_tagged(this.artist))
			return;

		var url = 'https://www.last.fm/music/' + encodeURIComponent(this.artist) + '/+images';
		var task_id = utils.HTTPRequestAsync(window.ID, 0, url, this.headers);
		this.artists[task_id] = this.artist;
	}

	this.http_request_done = function (id, success, response_text) {
		var artist = this.artists[id];

		if (!artist)
			return; // we didn't request this id

		if (!success) {
			console.log(N, response_text);
			return;
		}

		var filename_base = _artistFolder(artist) + utils.ReplaceIllegalChars(artist) + '_'

		_(_getElementsByTagName(response_text, 'li'))
			.filter({ className : 'image-list-item-wrapper' })
			.map(function (item) {
				var img = _firstElement(item, 'img');
				var url = img.src.replace('avatar170s/', '');
				return {
					url : url,
					filename : filename_base + url.substring(url.lastIndexOf('/') + 1) + '.jpg',
				};
			})
			.filter(function (item) {
				return !utils.IsFile(item.filename);
			})
			.take(this.properties.limit.value)
			.forEach(function (item) {
				utils.DownloadFileAsync(window.ID, item.url, item.filename, true);
			})
			.value();
	}

	this.interval_func = _.bind(function () {
		this.time++;

		if (this.properties.cycle.value > 0 && this.image_paths.length > 1 && this.time % this.properties.cycle.value == 0) {
			this.image_index++;

			if (this.image_index == this.image_paths.length) {
				this.image_index = 0;
			}

			this.update_image();
			window.Repaint();
		}

		if (this.properties.source.value == 1 && this.time % 3 == 0 && _getFiles(this.folder, this.exts).length != this.image_paths.length) {
			this.update();
		}
	}, this);

	this.key_down = function (k) {
		switch (k) {
		case VK_LEFT:
		case VK_UP:
			this.wheel(1);
			break
		case VK_RIGHT:
		case VK_DOWN:
			this.wheel(-1);
			break;
		}
	}

	this.lbtn_dblclk = function (x, y) {
		if (this.containsXY(x, y)) {
			var path = this.image_paths[this.image_index];
			switch (this.properties.double_click_mode.value) {
			case 0:
				utils.Run(path);
				break;
			case 1:
				fb.ShowPictureViewer(path);
				break;
			case 2:
				_explorer(path);
				break;
			}
		}
	}

	this.metadb_changed = function () {
		if (panel.metadb) {
			if (this.properties.source.value == 0) { // custom folder
				var temp_folder = panel.tf(this.properties.tf.value);
				if (this.folder == temp_folder) {
					return;
				}
				this.folder = temp_folder;
			} else { // last.fm
				var temp_artist = panel.tf(DEFAULT_ARTIST);
				if (this.artist == temp_artist) {
					return;
				}
				this.artist = temp_artist;
				this.folder = _artistFolder(this.artist);
			}
		} else {
			this.artist = '';
			this.folder = '';
		}

		this.update();
	}

	this.move = function (x, y) {
		this.mx = x;
		this.my = y;
		return this.containsXY(x, y);
	}

	this.paint = function (gr) {
		if (this.is_bio_panel) {
			if (this.bitmap.normal) {
				this.draw_blurred_image(gr);
				_drawOverlay(gr, 0, 0, panel.w, panel.h, 180);
				_drawImage(gr, this.bitmap.normal, this.x, this.y, this.w, this.h, this.properties.aspect.value == image.full ? image.full_top_align : this.properties.aspect.value, 1.0, RGB(150, 150, 150));
			} else {
				_drawOverlay(gr, 0, 0, panel.w, panel.h);
			}
		} else if (this.bitmap.normal) {
			if (this.properties.aspect.value == image.full) {
				this.draw_blurred_image(gr);
				_drawImage(gr, this.bitmap.normal, this.x + 20, this.y + 20, this.w - 40, this.h - 40, this.properties.aspect.value, 1.0, RGB(150, 150, 150));
			} else {
				_drawImage(gr, this.bitmap.normal, this.x, this.y, this.w, this.h, this.properties.aspect.value);
			}
		}
	}

	this.playback_new_track = function () {
		this.counter = 0;
		panel.item_focus_change();
	}

	this.playback_time = function () {
		this.counter++;

		if (panel.selection.value == 0 && this.properties.source.value == 1 && this.properties.auto_download.enabled && this.counter == 2 && this.image_paths.length == 0 && !this.history[this.artist]) {
			this.history[this.artist] = true;
			this.download();
		}
	}

	this.rbtn_up = function (x, y) {
		if (!this.containsXY(x, y))
			return;

		if (this.is_bio_panel) {
			panel.m.AppendMenuItem(MF_STRING, 1600, 'Image left, Text right');
			panel.m.AppendMenuItem(MF_STRING, 1601, 'Image top, Text bottom');
			panel.m.CheckMenuRadioItem(1600, 1601, this.properties.layout.value + 1600);
			panel.m.AppendMenuSeparator();
		} else {
			panel.m.AppendMenuItem(MF_STRING, 1000, 'Custom folder');
			panel.m.AppendMenuItem(MF_STRING, 1001, 'Last.fm artist art');
			panel.m.CheckMenuRadioItem(1000, 1001, this.properties.source.value + 1000);
			panel.m.AppendMenuSeparator();
		}

		if (this.properties.source.value == 0) { // custom folder
			panel.m.AppendMenuItem(MF_STRING, 1002, 'Set custom folder...');
			panel.m.AppendMenuSeparator();
		} else { // last.fm
			panel.m.AppendMenuItem(EnableMenuIf(panel.metadb), 1003, 'Download now');
			panel.m.AppendMenuItem(CheckMenuIf(this.properties.auto_download.enabled), 1004, 'Automatic downloads');
			this.limits.forEach(function (item) {
				panel.s10.AppendMenuItem(MF_STRING, item + 1010, item);
			});
			panel.s10.CheckMenuRadioItem(_.first(this.limits) + 1010, _.last(this.limits) + 1010, this.properties.limit.value + 1010);
			panel.s10.AppendTo(panel.m, MF_STRING, 'Limit');
			panel.m.AppendMenuSeparator();
		}

		panel.s12.AppendMenuItem(MF_STRING, 1400, 'Off');
		panel.s12.AppendMenuItem(MF_STRING, 1405, '5 seconds');
		panel.s12.AppendMenuItem(MF_STRING, 1410, '10 seconds');
		panel.s12.AppendMenuItem(MF_STRING, 1420, '20 seconds');
		panel.s12.AppendMenuItem(MF_STRING, 1430, '30 seconds');
		panel.s12.AppendMenuItem(MF_STRING, 1460, '60 seconds');
		panel.s12.CheckMenuRadioItem(1400, 1460, this.properties.cycle.value + 1400);
		panel.s12.AppendTo(panel.m, MF_STRING, 'Cycle');
		panel.m.AppendMenuSeparator();

		panel.m.AppendMenuItem(MF_STRING, 1500, 'Crop (focus on centre)');
		panel.m.AppendMenuItem(MF_STRING, 1501, 'Crop (focus on top)');
		//panel.m.AppendMenuItem(MF_STRING, 1502, 'Stretch');
		panel.m.AppendMenuItem(MF_STRING, 1503, 'Full');
		panel.m.CheckMenuRadioItem(1500, 1503, this.properties.aspect.value + 1500);
		panel.m.AppendMenuSeparator();

		if (this.image_index < this.image_paths.length) {
			panel.m.AppendMenuItem(MF_STRING, 1530, 'Open image');
			panel.m.AppendMenuItem(MF_STRING, 1531, 'Delete image');
			panel.m.AppendMenuSeparator();
		}

		panel.s13.AppendMenuItem(MF_STRING, 1540, 'Opens image in external viewer');
		panel.s13.AppendMenuItem(MF_STRING, 1541, 'Opens image using fb2k viewer');
		panel.s13.AppendMenuItem(MF_STRING, 1542, 'Opens containing folder');
		panel.s13.CheckMenuRadioItem(1540, 1542, this.properties.double_click_mode.value + 1540);
		panel.s13.AppendTo(panel.m, MF_STRING, 'Double click');
		panel.m.AppendMenuSeparator();

		panel.m.AppendMenuItem(EnableMenuIf(utils.IsFolder(this.folder)), 1550, 'Open containing folder');
		panel.m.AppendMenuSeparator();
	}

	this.rbtn_up_done = function (idx) {
		switch (idx) {
		case 1000:
		case 1001:
			this.properties.source.value = idx - 1000;
			this.artist = '';
			this.folder = '';
			this.metadb_changed();
			break;
		case 1002:
			try {
				this.properties.tf.value = utils.TextBox('Enter title formatting or an absolute path to a folder. You can specify multiple folders by placing each one on their own line.', window.Name, this.properties.tf.value);
				this.folder = '';
				this.metadb_changed();
			} catch (e) {}
			break;
		case 1003:
			this.download();
			break;
		case 1004:
			this.properties.auto_download.toggle();
			break;
		case 1011:
		case 1013:
		case 1015:
		case 1020:
		case 1025:
		case 1030:
			this.properties.limit.value = idx - 1010;
			break;
		case 1400:
		case 1405:
		case 1410:
		case 1420:
		case 1430:
		case 1460:
			this.properties.cycle.value = idx - 1400;
			break;
		case 1500:
		case 1501:
		case 1502:
		case 1503:
			this.properties.aspect.value = idx - 1500;
			window.Repaint();
			break;
		case 1530:
			utils.Run(this.image_paths[this.image_index]);
			break;
		case 1531:
			utils.RemovePath(this.image_paths[this.image_index]);
			this.update();
			break;
		case 1540:
		case 1541:
		case 1542:
			this.properties.double_click_mode.value = idx - 1540;
			break;
		case 1550:
			if (this.image_paths.length) {
				_explorer(this.image_paths[this.image_index]);
			} else {
				utils.Run(this.folder);
			}
			break;
		case 1600:
		case 1601:
			this.properties.layout.value = idx - 1600;
			on_size();
			window.Repaint();
			break;
		}
	}

	this.reset_image = function () {
		if (this.bitmap.normal) {
			this.bitmap.normal.Dispose();
			this.bitmap.normal = null;
		}

		if (this.bitmap.blur) {
			this.bitmap.blur.Dispose();
			this.bitmap.blur = null;
		}
	}

	this.update = function () {
		this.update_image_paths();
		this.update_image();
		window.Repaint();
	}

	this.update_image = function () {
		this.reset_image();

		if (this.image_index < this.image_paths.length) {
			var img = utils.LoadImage(this.image_paths[this.image_index]);

			if (img) {
				this.bitmap.normal = img.CreateBitmap();
				img.StackBlur(120);
				this.bitmap.blur = img.CreateBitmap();
				img.Dispose();
			}
		}
	}

	this.update_image_paths = function () {
		this.image_index = 0;
		this.image_paths = [];

		if (this.properties.source.value == 0 && _.includes(this.properties.tf.value, CRLF)) {
			var folders = _stringToArray(this.properties.tf.value, CRLF).map(function (item) {
				return panel.tf(item);
			});

			this.image_paths = _getFiles(folders, this.exts);
		} else {
			this.image_paths = _getFiles(this.folder, this.exts);
		}
	}

	this.wheel = function (s) {
		if (!this.is_bio_panel && utils.IsKeyPressed(VK_SHIFT) && this.properties.aspect.value == image.full) {
			var value = _clamp(this.properties.blur_opacity.value + (s * 0.05), 0.2, 0.8);

			if (value != this.properties.blur_opacity.value) {
				this.properties.blur_opacity.value = value;
				window.Repaint();
			}

			return;
		}

		if (!this.containsXY(this.mx, this.my))
			return false;

		if (this.image_paths.length > 1) {
			this.image_index -= s;

			if (this.image_index < 0) {
				this.image_index = this.image_paths.length - 1;
			} else if (this.image_index >= this.image_paths.length) {
				this.image_index = 0;
			}

			this.update_image();
			window.Repaint();
		}

		return true;
	}

	this.x = 0;
	this.y = 0;
	this.w = 0;
	this.h = 0;
	this.mx = 0;
	this.my = 0;
	this.image_paths = [];
	this.history = {}; // track auto-downloads, attempt same artist only once per session
	this.limits = [1, 3, 5, 10, 15, 20];
	this.modes = ['grid', 'left', 'right', 'top', 'bottom', 'off'];
	this.exts = ['webp', 'jpg', 'jpeg', 'png', 'gif', 'heif', 'heic', 'avif', 'jxl'];
	this.folder = '';
	this.artist = '';
	this.artists = {};
	this.properties = {};
	this.image_index = 0;
	this.time = 0;
	this.counter = 0;
	this.is_bio_panel = panel.text_objects.length == 1 && panel.text_objects[0].name == 'lastfm_bio';

	this.bitmap = {
		normal : null,
		blur : null,
	};

	this.properties = {
		source : new _p('2K3.IMAGES.SOURCE', 0), // 0 custom folder 1 last.fm
		tf : new _p('2K3.IMAGES.CUSTOM.FOLDER.TF', '$directory_path(%path%)'),
		cycle : new _p('2K3.IMAGES.CYCLE', 5),
		aspect : new _p('2K3.IMAGES.ASPECT', this.is_bio_panel ? image.crop_top : image.full),
		limit : new _p('2K3.IMAGES.DOWNLOAD.LIMIT', 10),
		auto_download : new _p('2K3.IMAGES.AUTO.DOWNLOAD', true),
		double_click_mode : new _p('2K3.IMAGES.DOUBLE.CLICK.MODE', 1), // 0 external viewer 1 fb2k viewer 2 explorer
	};

	if (this.is_bio_panel) {
		this.properties.source.value = 1;
		this.properties.layout = new _p('2K3.IMAGES.LAYOUT', 0); // 0 horizontal, 1 vertical
		this.properties.ratio = new _p('2K3.IMAGES.RATIO', 0.5);
		this.properties.blur_opacity = new _p('2K3.BIO.BLUR.OPACITY', 1);
	} else {
		this.properties.blur_opacity = new _p('2K3.IMAGES.BLUR.OPACITY', 0.5);
	}

	this.headers = JSON.stringify({
		'User-Agent' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
		'Referer' : 'https://www.last.fm',
	});

	utils.CreateFolder(folders.artists);
	window.SetInterval(this.interval_func, 1000);
}
