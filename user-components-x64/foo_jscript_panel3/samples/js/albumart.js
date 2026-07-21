function _albumart(x, y, w, h) {
	this.want_blur = function () {
		if (panel.display_objects.length) {
			var properties = panel.display_objects[0].properties;
			return properties.albumart.enabled && properties.albumart_blur.enabled;
		} else {
			return this.is_review_panel;
		}
	}

	this.containsXY = function (x, y) {
		return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
	}

	this.get_custom = function (id, type) {
		switch (type) {
		case AlbumArtType.embedded:
			return panel.metadb.GetAlbumArtEmbedded(id);
		case AlbumArtType.default:
			return panel.metadb.GetAlbumArt(id, false);
		case AlbumArtType.stub:
			return fb.GetAlbumArtStub(id);
		default:
			return null;
		}
	}

	this.key_down = function (k) {
		switch (k) {
		case VK_LEFT:
		case VK_UP:
			this.wheel(1);
			return true;
		case VK_RIGHT:
		case VK_DOWN:
			this.wheel(-1);
			return true;
		default:
			return false;
		}
	}

	this.lbtn_dblclk = function (x, y) {
		if (!this.containsXY(x, y))
			return false;

		if (panel.metadb) {
			switch (this.properties.double_click_mode.value) {
			case 0:
				if (panel.metadb.Path == this.path) {
					_explorer(this.path);
				} else if (utils.IsFile(this.path) || _.startsWith(this.path, 'http')) {
					utils.Run(this.path);
				}
				break;
			case 1:
				if (this.properties.mode.value == 0) {
					panel.metadb.ShowAlbumArtViewer(this.properties.id.value);
				} else {
					if (this.custom_id > -1 && this.custom_type > -1) {
						panel.metadb.ShowAlbumArtViewer2(this.custom_id, this.custom_type);
					}
				}
				break;
			case 2:
				if (utils.IsFile(this.path)) {
					_explorer(this.path);
				}
				break;
			}
		}

		return true;
	}

	this.metadb_changed = function () {
		var img = null;
		this.custom_id = -1;
		this.custom_type = -1;

		if (panel.metadb) {
			if (this.properties.mode.value == 0) {
				img = panel.metadb.GetAlbumArt(this.properties.id.value);
			} else {
				_.forEach(_stringToArray(this.properties.edit.value, CRLF), function (item) {
					var id_type = _stringToArray(item, '_');
					if (id_type.length == 2) {
						var id = this.ids.indexOf(id_type[0]);
						var type = this.types.indexOf(id_type[1]);

						if (id > -1 && type > -1) {
							img = this.get_custom(id, type);

							if (img) {
								// if valid, store the id/type for ShowAlbumArtViewer2
								this.custom_id = id;
								this.custom_type = type;
								return false;
							}
						}
					}
				}, this);
			}
		}

		this.reset_images();

		if (img) {
			this.tooltip = 'Original dimensions: ' + img.Width + 'x' + img.Height + 'px';
			this.path = img.Path;

			if (this.path.length) {
				this.tooltip += '\nPath: ' + this.path;
			}

			this.bitmap.normal = img.CreateBitmap();

			if (this.want_blur()) {
				img.StackBlur(120);
				this.bitmap.blur = img.CreateBitmap();
			}

			img.Dispose();
		}

		window.Repaint();
	}

	this.move = function (x, y) {
		this.mx = x;
		this.my = y;

		if (this.containsXY(x, y)) {
			if (this.bitmap.normal && this.properties.tooltip.enabled) {
				_tt(this.tooltip);
			}

			this.hover = true;
			return true;
		}

		if (this.hover) {
			_tt('');
		}

		this.hover = false;
		return false;
	}

	this.paint = function (gr) {
		if (!this.bitmap.normal)
			return;

		if (this.is_review_panel) {
			_drawImage(gr, this.bitmap.normal, this.x, this.y, this.w, this.h, this.properties.aspect.value == image.full ? image.full_top_align : this.properties.aspect.value, 1.0, RGB(150, 150, 150));
		} else {
			_drawImage(gr, this.bitmap.normal, this.x, this.y, this.w, this.h, this.properties.aspect.value);
		}
	}

	this.reset_images = function () {
		if (this.bitmap.normal) {
			this.bitmap.normal.Dispose();
			this.bitmap.normal = null;
		}

		if (this.bitmap.blur) {
			this.bitmap.blur.Dispose();
			this.bitmap.blur = null;
		}

		this.tooltip = this.path = '';
	}

	this.rbtn_up = function (x, y) {
		if (this.is_review_panel) {
			panel.m.AppendMenuItem(MF_STRING, 1000, 'Album Art left, Text right');
			panel.m.AppendMenuItem(MF_STRING, 1001, 'Album Art top, Text bottom');
			panel.m.CheckMenuRadioItem(1000, 1001, this.properties.layout.value + 1000);
			panel.m.AppendMenuSeparator();
		}

		panel.m.AppendMenuItem(MF_STRING, 1002, 'Refresh');
		panel.m.AppendMenuSeparator();
		panel.m.AppendMenuItem(MF_GRAYED, 0, 'Mode');
		panel.m.AppendMenuItem(MF_STRING, 1010, 'Default');
		panel.m.AppendMenuItem(MF_STRING, 1011, 'Custom');
		panel.m.AppendMenuSeparator();
		panel.m.CheckMenuRadioItem(1010, 1011, this.properties.mode.value + 1010);

		if (this.properties.mode.value == 0) {
			this.ids.forEach(function (item, i) {
				panel.m.AppendMenuItem(MF_STRING, i + 1020, _.capitalize(item));
			});
			panel.m.CheckMenuRadioItem(1020, 1024, this.properties.id.value + 1020);
		} else {
			panel.m.AppendMenuItem(MF_STRING, 1030, 'Edit...');
		}

		panel.m.AppendMenuSeparator();
		panel.m.AppendMenuItem(MF_STRING, 1040, 'Crop (focus on centre)');
		panel.m.AppendMenuItem(MF_STRING, 1041, 'Crop (focus on top)');
		//panel.m.AppendMenuItem(MF_STRING, 1042, 'Stretch');
		panel.m.AppendMenuItem(MF_STRING, 1043, 'Full');
		panel.m.CheckMenuRadioItem(1040, 1043, this.properties.aspect.value + 1040);
		panel.m.AppendMenuSeparator();
		panel.m.AppendMenuItem(CheckMenuIf(this.properties.tooltip.enabled), 1045, 'Show hover tooltip');
		panel.m.AppendMenuSeparator();
		panel.m.AppendMenuItem(EnableMenuIf(utils.IsFile(this.path)), 1050, 'Open containing folder');
		panel.m.AppendMenuSeparator();
		panel.m.AppendMenuItem(EnableMenuIf(panel.metadb), 1060, 'Google image search');
		panel.m.AppendMenuSeparator();
		panel.s10.AppendMenuItem(MF_STRING, 1070, 'Opens image in external viewer');
		panel.s10.AppendMenuItem(MF_STRING, 1071, 'Opens image using fb2k viewer');
		panel.s10.AppendMenuItem(MF_STRING, 1072, 'Opens containing folder');
		panel.s10.CheckMenuRadioItem(1070, 1072, this.properties.double_click_mode.value + 1070);
		panel.s10.AppendTo(panel.m, MF_STRING, 'Double click');
		panel.m.AppendMenuSeparator();
	}

	this.rbtn_up_done = function (idx) {
		switch (idx) {
		case 1000:
		case 1001:
			this.properties.layout.value = idx - 1000;
			on_size();
			window.Repaint();
			break;
		case 1002:
			this.metadb_changed();
			break;
		case 1010:
		case 1011:
			this.properties.mode.value = idx - 1010;
			this.metadb_changed();
			break;
		case 1020:
		case 1021:
		case 1022:
		case 1023:
		case 1024:
			this.properties.id.value = idx - 1020;
			this.metadb_changed();
			break;
		case 1030:
			try {
				var tmp = utils.TextBox('Enter image types here. Each one will checked in order until a valid image is found. See Help.', window.Name, this.properties.edit.value, this.help_text);
				if (tmp != this.properties.edit.value) {
					this.properties.edit.value = tmp;
					this.metadb_changed();
				}
			} catch (e) {}
			break;
		case 1040:
		case 1041:
		case 1042:
		case 1043:
			this.properties.aspect.value = idx - 1040;
			window.Repaint();
			break;
		case 1045:
			this.properties.tooltip.toggle();
			if (!this.properties.tooltip.enabled) _tt('');
			break;
		case 1050:
			_explorer(this.path);
			break;
		case 1060:
			utils.Run('https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(panel.tf('%album artist%[ %album%]')));
			break;
		case 1070:
		case 1071:
		case 1072:
			this.properties.double_click_mode.value = idx - 1070;
			break;
		}
	}

	this.wheel = function (s) {
		if (this.properties.mode.value == 1 || !this.containsXY(this.mx, this.my))
			return false;

		var id = this.properties.id.value - s;

		if (id < 0) {
			id = 4;
		} else if (id > 4) {
			id = 0;
		}

		this.properties.id.value = id;
		_tt('');
		this.metadb_changed();
		return true;
	}

	this.is_review_panel = panel.text_objects.length == 1 && panel.text_objects[0].name == 'allmusic';

	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;
	this.mx = 0;
	this.my = 0;
	this.tooltip = '';
	this.image_index = 0;
	this.path = null;
	this.hover = false;
	this.ids =  ['front', 'back', 'disc', 'icon', 'artist'];
	this.types = ['embedded', 'default', 'stub'];
	this.custom_id = -1;
	this.custom_type = -1;
	this.help_text = utils.ReadUTF8(fb.ComponentPath + 'samples\\text\\albumart_help');

	this.bitmap = {
		normal : null,
		blur : null,
	};

	this.properties = {
		aspect : new _p('2K3.ARTREADER.ASPECT', image.full),
		id : new _p('2K3.ARTREADER.ID', 0),
		double_click_mode : new _p('2K3.ARTREADER.DOUBLE.CLICK.MODE', 1), // 0 external viewer 1 fb2k viewer 2 explorer
		mode : new _p('2K3.ARTREADER.MODE', 0), // 0 default, 1 custom
		edit : new _p('2K3.ARTREADER.EDIT', 'front_default\r\ndisc_default\r\nartist_default\r\nfront_stub\r\n'),
		tooltip : new _p('2K3.ARTREADER.TOOLTIP', true),
	};

	if (this.is_review_panel) {
		this.properties.layout = new _p('2K3.ARTREADER.LAYOUT', 0); // 0 horizontal, 1 vertical
		this.properties.ratio = new _p('2K3.ARTREADER.RATIO', 0.5);
	}
}
