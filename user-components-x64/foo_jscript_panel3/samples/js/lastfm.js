function _lastfm() {
	this.base_url = function () {
		return 'https://ws.audioscrobbler.com/2.0/?format=json&api_key=' + this.api_key;
	}

	this.notify_data = function (name, data) {
		if (name == '2K3.NOTIFY.LASTFM') {
			this.read_file();

			_.forEach(panel.list_objects, function (item) {
				if (item.name == 'lastfm_info') {
					item.reset();
				}
			});

			_.forEach(panel.text_objects, function (item) {
				if (item.name == 'lastfm_bio') {
					item.reset();
					item.metadb_changed();
				}
			});
		}
	}

	this.read_file = function () {
		var obj = _jsonParseFile(this.json_file);

		// DarkOne2021/JSP2 Phase 2 stored personal credentials in lastfm.ini.
		// Import them once, then let JSP3 use its native JSON settings file.
		if ((!obj.api_key && !obj.username) && utils.IsFile(this.legacy_ini_file)) {
			obj.api_key = utils.ReadINI(this.legacy_ini_file, 'Last.fm', 'api_key') || '';
			obj.username = utils.ReadINI(this.legacy_ini_file, 'Last.fm', 'username') || '';
			if (obj.api_key || obj.username) {
				utils.WriteTextFile(this.json_file, JSON.stringify({ username : obj.username, api_key : obj.api_key }));
			}
		}

		this.api_key = obj.api_key || '';
		this.username = obj.username || '';
	}

	this.update_api_key = function () {
		var api_key = utils.InputBox('Enter your Last.fm API key', window.Name, this.api_key);

		if (api_key != this.api_key) {
			this.api_key = api_key;
			this.write_file();
			window.NotifyOthers('2K3.NOTIFY.LASTFM', 'update');
			this.notify_data('2K3.NOTIFY.LASTFM', 'update');
		}
	}

	this.update_username = function () {
		var username = utils.InputBox('Enter your Last.fm username', window.Name, this.username);

		if (username != this.username) {
			this.username = username;
			this.write_file();
			window.NotifyOthers('2K3.NOTIFY.LASTFM', 'update');
			this.notify_data('2K3.NOTIFY.LASTFM', 'update');
		}
	}

	this.write_file = function () {
		var str = JSON.stringify({
			username : this.username,
			api_key : this.api_key,
		});

		utils.WriteTextFile(this.json_file, str);
	}

	utils.CreateFolder(folders.data);
	this.json_file = folders.data + 'lastfm.json';
	this.legacy_ini_file = folders.data + 'lastfm.ini';
	this.api_key = '';
	this.username = ''
	this.ua = 'jscript_panel_lastfm';
	this.read_file();
}
