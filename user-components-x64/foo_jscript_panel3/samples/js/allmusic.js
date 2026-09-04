function _allmusic(x, y, w, h, options) {
	options = options && typeof options == 'object' ? options : {};
	this.managed = options.managed === true;
	this.source_enabled = typeof options.source_enabled == 'function' ? options.source_enabled : function () { return true; };
	this.is_active = typeof options.is_active == 'function' ? options.is_active : function () { return true; };
	this.terminal_callback = typeof options.on_terminal == 'function' ? options.on_terminal : null;
	this.terminal_state = '';
	this.notify_terminal = function (success, reason) {
		var next = success ? 'success' : 'failure';
		if (!success && this.terminal_state.length) return;
		if (success && this.terminal_state == 'success') return;
		this.terminal_state = next;
		if (this.terminal_callback) {
			try {
				this.terminal_callback({
					success : !!success,
					source : 'allmusic',
					reason : String(reason || ''),
					text : this.text,
					url : this.resolved_album_url,
					artist : this.artist,
					album : this.album
				});
			} catch (e) { console.log(N, 'Album Notes provider callback failed: ' + e.message); }
		}
	}

	this.has_pending_work = function () {
		var key;
		for (key in this.request_kinds)
			if (Object.prototype.hasOwnProperty.call(this.request_kinds, key)) return true;
		for (key in this.scheduled_request_timers)
			if (Object.prototype.hasOwnProperty.call(this.scheduled_request_timers, key)) return true;
		return false;
	}

	this.activate_managed = function (force) {
		if (!this.managed) {
			this.metadb_changed();
			return this.terminal_state || (this.has_pending_work() ? 'pending' : 'idle');
		}

		if (force) this.reset();

		if (!panel.metadb) {
			this.metadb_changed();
			return 'failure';
		}

		var temp_artist = panel.tf('%album artist%');
		var temp_album = panel.tf('%album%');
		if (this.artist != temp_artist || this.album != temp_album) {
			this.metadb_changed();
			return this.terminal_state || (this.has_pending_work() ? 'pending' : 'idle');
		}

		// Album Notes may start a new source chain while the same album remains
		// focused. Re-arm the terminal callback instead of treating the provider
		// identity match as proof that useful work is already in progress.
		this.terminal_state = '';

		if (this.text.length) {
			this.notify_terminal(true, 'cached review');
			return 'success';
		}

		if (this.state.blocked && this.resolved_album_url.length) {
			this.status_text = this.blocked_message();
			this.rebuild_text_layout();
			this.notify_terminal(false, 'saved browser-verification state');
			return 'failure';
		}

		if (this.has_pending_work()) return 'pending';

		if (!_tagged(this.artist) || !_tagged(this.album)) {
			this.notify_terminal(false, 'artist or album tags are missing');
			return 'failure';
		}

		// A completed or cancelled attempt can leave the URL history populated
		// even though no request, result or terminal state remains. A managed
		// reactivation is a new source-chain attempt, so stale history must not
		// turn it into a silent no-op.
		this.history = {};
		this.last_request_url = '';
		this.mb_fallback_started = false;
		this.review_url = this.resolved_album_url.length ? this.resolved_album_url + '/reviewAjax' : '';
		this.status_text = '';
		this.get();

		if (!this.has_pending_work() && !this.terminal_state.length) {
			this.notify_terminal(false, 'provider did not start a request');
			return 'failure';
		}

		return this.terminal_state || 'pending';
	}
	this.clear_layout = function () {
		if (this.text_layout) {
			this.text_layout.Dispose();
			this.text_layout = null;
		}
	}


	this.rebuild_text_layout = function () {
		this.clear_layout();
		var value = this.text.length ? this.text : this.status_text;

		if (value.length)
			this.text_layout = utils.CreateTextLayout(value, panel.fonts.name, _scale(panel.fonts.size.value));

		this.update();
	}

	this.set_status = function (value) {
		this.status_text = String(value || '').trim();
		this.rebuild_text_layout();
		window.Repaint();
	}

	this.default_state = function () {
		return {
			version : 1,
			url : '',
			blocked : false,
			blocked_reason : '',
			blocked_at : 0
		};
	}

	this.load_state = function () {
		this.state = this.default_state();

		if (this.state_filename.length && utils.IsFile(this.state_filename)) {
			try {
				var saved = JSON.parse(utils.ReadUTF8(this.state_filename));
				if (saved && typeof saved == 'object') {
					this.state.version = Number(saved.version) || 1;
					this.state.url = String(saved.url || '');
					this.state.blocked = !!saved.blocked;
					this.state.blocked_reason = String(saved.blocked_reason || '');
					this.state.blocked_at = Number(saved.blocked_at) || 0;
				}
			} catch (e) {
				console.log(N, 'Could not read saved AllMusic lookup state: ' + e.message);
			}
		}

		this.resolved_album_url = this.normalise_allmusic_album_url(this.state.url);
		this.state.url = this.resolved_album_url;
	}

	this.save_state = function () {
		if (!this.state_filename.length)
			return;

		if (!this.state.url.length && !this.state.blocked) {
			if (utils.IsFile(this.state_filename))
				utils.RemovePath(this.state_filename);
			return;
		}

		_save(this.state_filename, JSON.stringify(this.state, null, 2));
	}

	this.cache_album_url = function (value) {
		var url = this.normalise_allmusic_album_url(value);
		if (!url.length)
			return '';

		this.resolved_album_url = url;
		this.state.url = url;
		this.save_state();
		return url;
	}

	this.clear_blocked_state = function () {
		this.state.blocked = false;
		this.state.blocked_reason = '';
		this.state.blocked_at = 0;
		this.save_state();
	}

	this.is_cloudflare_challenge = function (status, response_text, response_headers) {
		if (Number(status) != 403)
			return false;

		var headers = String(response_headers || '').toLowerCase();
		var body = String(response_text || '').toLowerCase();
		return headers.indexOf('cf-mitigated') > -1 ||
			headers.indexOf('cf-ray') > -1 ||
			headers.indexOf('challenges.cloudflare.com') > -1 ||
			body.indexOf('<title>just a moment...</title>') > -1 ||
			body.indexOf('challenges.cloudflare.com') > -1;
	}

	this.blocked_message = function () {
		return 'AllMusic blocked automated review retrieval with browser verification.\r\n\r\n' +
			'Right-click and choose "Open album on AllMusic" to read it in your browser. ' +
			'You can then copy the review text and choose "Paste review from clipboard" to save it locally.';
	}

	this.mark_cloudflare_blocked = function (request_url) {
		if (typeof DarkOneNetwork != 'undefined') DarkOneNetwork.setAllMusicBackoff(30 * 60 * 1000);
		var album_url = this.cache_album_url(request_url || this.resolved_album_url);
		this.review_url = '';
		this.state.blocked = true;
		this.state.blocked_reason = 'cloudflare_challenge';
		this.state.blocked_at = Date.now();
		if (album_url.length)
			this.state.url = album_url;
		this.save_state();
		this.set_status(this.blocked_message());
		console.log(N, 'AllMusic returned a Cloudflare browser-verification challenge. Automated review retrieval has been paused for this album.');
		this.notify_terminal(false, 'browser verification challenge');
	}

	this.containsXY = function (x, y) {
		return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
	}

	this.font_changed = function () {
		this.reset();
		if (!this.managed || this.is_active()) this.metadb_changed();
	}


	this.get_header_profile = function () {
		return typeof DarkOneNetwork != 'undefined' && typeof DarkOneNetwork.getHtmlHeaderProfile == 'function' ? DarkOneNetwork.getHtmlHeaderProfile() : (typeof DarkOneNetwork != 'undefined' && typeof DarkOneNetwork.getHeaderProfile == 'function' ? DarkOneNetwork.getHeaderProfile() : 'application');
	}

	this.set_header_profile = function (value) {
		var profile = value == 'chrome' ? 'chrome' : 'application';
		if (typeof DarkOneNetwork != 'undefined' && typeof DarkOneNetwork.setHeaderProfile == 'function')
			profile = DarkOneNetwork.setHeaderProfile(profile);
		console.log(N, 'Request identity changed to ' + (profile == 'chrome' ? 'Google Chrome 150-style (experimental).' : 'JSP3 Enhanced Samples application (recommended).'));
		if (profile == 'chrome')
			console.log(N, 'Chrome-style headers do not execute JavaScript challenges or create a real browser session.');
	}

	this.make_allmusic_headers = function (url, kind) {
		if (typeof DarkOneNetwork != 'undefined' && typeof DarkOneNetwork.allMusicHeaders == 'function')
			return DarkOneNetwork.allMusicHeaders(url, kind);
		return this.headers;
	}

	this.make_musicbrainz_headers = function () {
		if (typeof DarkOneNetwork != 'undefined' && typeof DarkOneNetwork.musicBrainzHeaders == 'function')
			return DarkOneNetwork.musicBrainzHeaders('');
		return this.mb_headers;
	}

	this.clear_request_watchdog = function (task_id) {
		var timer_id = this.request_watchdogs[task_id];
		if (timer_id !== undefined) {
			window.ClearTimeout(timer_id);
			delete this.request_watchdogs[task_id];
		}
	}

	this.forget_request = function (task_id) {
		this.clear_request_watchdog(task_id);
		delete this.filenames[task_id];
		delete this.request_kinds[task_id];
		delete this.request_urls[task_id];
		delete this.request_attempts[task_id];
	}

	this.clear_request_timers = function () {
		for (var task_id in this.request_watchdogs) {
			if (Object.prototype.hasOwnProperty.call(this.request_watchdogs, task_id))
				window.ClearTimeout(this.request_watchdogs[task_id]);
		}

		for (var timer_id in this.scheduled_request_timers) {
			if (Object.prototype.hasOwnProperty.call(this.scheduled_request_timers, timer_id))
				window.ClearTimeout(Number(timer_id));
		}

		this.request_watchdogs = {};
		this.scheduled_request_timers = {};
		this.filenames = {};
		this.request_kinds = {};
		this.request_urls = {};
		this.request_attempts = {};
	}

	this.is_transient_musicbrainz_failure = function (success, status) {
		status = Number(status) || 0;
		return !success || !status || status == 408 || status == 425 || status == 429 || status >= 500;
	}

	this.retry_musicbrainz_request = function (url, kind, attempt, reason, extra_delay) {
		if (attempt >= this.mb_max_attempts) {
			this.musicbrainz_failed('MusicBrainz lookup failed after ' + attempt + ' attempts (' + reason + ').');
			return;
		}

		var next_attempt = attempt + 1;
		console.log(N, 'MusicBrainz ' + reason + '. Retrying (attempt ' + next_attempt + ' of ' + this.mb_max_attempts + ')...');
		this.set_status('MusicBrainz lookup did not complete. Retrying (' + next_attempt + '/' + this.mb_max_attempts + ')...');
		this.make_musicbrainz_request(url, kind, next_attempt, extra_delay || 1500);
	}

	this.request_timed_out = function (task_id) {
		var filename = this.filenames[task_id];
		var kind = this.request_kinds[task_id] || '';
		var request_url = this.request_urls[task_id] || '';
		var attempt = Number(this.request_attempts[task_id]) || 1;

		this.forget_request(task_id);

		if (!filename || filename != this.filename)
			return;

		if (kind.indexOf('musicbrainz-') == 0) {
			this.retry_musicbrainz_request(request_url, kind, attempt, 'request timed out after ' + Math.round(this.request_timeout_ms / 1000) + ' seconds', 1500);
		} else if (kind == 'allmusic-search') {
			console.log(N, 'AllMusic search request timed out. Trying MusicBrainz relationship lookup...');
			this.begin_musicbrainz_fallback('AllMusic search timed out');
		} else {
			this.set_status('The AllMusic request timed out. Use Refresh from AllMusic to retry.');
			console.log(N, 'AllMusic request timed out for: ' + request_url);
			this.notify_terminal(false, 'request timed out');
		}
	}

	this.make_request = function (url, kind, headers, delay, attempt) {
		var filename = this.filename;
		attempt = Number(attempt) || 1;

		var execute = _.bind(function () {
			// Ignore a delayed lookup if the focused album changed before it ran.
			if (!filename.length || filename != this.filename)
				return;

			this.last_request_url = url;
			var task_id;
			var request_headers = headers || this.headers;
			if (kind.indexOf('allmusic-') == 0)
				request_headers = this.make_allmusic_headers(url, kind);
			else if (kind.indexOf('musicbrainz-') == 0)
				request_headers = this.make_musicbrainz_headers();

			try {
				task_id = utils.HTTPRequestAsync(window.ID, 0, url, request_headers);
			} catch (e) {
				if (kind.indexOf('musicbrainz-') == 0) {
					this.retry_musicbrainz_request(url, kind, attempt, 'request could not be started: ' + e.message, 1500);
				} else {
					this.set_status('The web request could not be started: ' + e.message);
					this.notify_terminal(false, 'request could not be started');
				}
				return;
			}

			this.filenames[task_id] = filename;
			this.request_kinds[task_id] = kind;
			this.request_urls[task_id] = url;
			this.request_attempts[task_id] = attempt;
			this.request_watchdogs[task_id] = window.SetTimeout(_.bind(function () {
				this.request_timed_out(task_id);
			}, this), this.request_timeout_ms);
		}, this);

		if (delay && delay > 0) {
			var timer_id = window.SetTimeout(_.bind(function () {
				delete this.scheduled_request_timers[timer_id];
				execute();
			}, this), delay);
			this.scheduled_request_timers[timer_id] = true;
		} else {
			execute();
		}
	}

	this.make_musicbrainz_request = function (url, kind, attempt, minimum_delay) {
		var minimum = Math.max(0, Number(minimum_delay) || 0);
		var now = Date.now();
		var delay;
		if (typeof DarkOneNetwork != 'undefined') {
			delay = DarkOneNetwork.reserveMusicBrainz(1100, minimum);
		} else {
			delay = Math.max(minimum, 1100 - (now - this.mb_last_request_time));
		}
		this.mb_last_request_time = now + delay;
		this.make_request(url, kind, this.mb_headers, delay, attempt || 1);
	}

	this.should_skip_allmusic_request = function () {
		if (this.allow_allmusic_retry_once) {
			this.allow_allmusic_retry_once = false;
			return false;
		}
		return typeof DarkOneNetwork != 'undefined' && DarkOneNetwork.isAllMusicBackoffActive();
	}

	this.handle_global_allmusic_backoff = function () {
		if (!this.should_skip_allmusic_request()) return false;
		if (this.resolved_album_url.length) {
			this.state.blocked = true;
			this.state.blocked_reason = 'browser_verification_backoff';
			this.state.blocked_at = Date.now();
			this.save_state();
			this.set_status(this.blocked_message());
			console.log(N, 'Skipping an AllMusic HTTP request while the browser-verification backoff is active.');
			this.notify_terminal(false, 'browser-verification backoff');
		} else if (_tagged(this.artist) && _tagged(this.album)) {
			this.begin_musicbrainz_fallback('AllMusic browser-verification backoff is active');
		}
		return true;
	}

	this.get = function () {
		var url;

		if (this.handle_global_allmusic_backoff()) return;

		if (this.review_url.length) {
			url = this.review_url;
			this.make_request(url, /\/reviewAjax$/i.test(url) ? 'allmusic-review-ajax' : 'allmusic-review-page', this.headers, 0);
			return;
		}

		if (this.resolved_album_url.length) {
			this.review_url = this.resolved_album_url + '/reviewAjax';
			this.make_request(this.review_url, 'allmusic-review-ajax', this.headers, 0);
			return;
		}

		if (!_tagged(this.artist) || !_tagged(this.album)) {
			this.notify_terminal(false, 'artist or album tags are missing');
			return;
		}

		if (this.artist.toLowerCase() == 'various artists') {
			url = this.search_base + encodeURIComponent(this.album_clean || this.album);
		} else {
			url = this.search_base + encodeURIComponent(this.artist + ' ' + (this.album_clean || this.album));
		}

		if (this.history[url]) {
			if (!this.has_pending_work())
				this.begin_musicbrainz_fallback('AllMusic search was already attempted');
			return;
		}

		this.history[url] = true;
		this.make_request(url, 'allmusic-search', this.headers, 0);
	}

	this.header_text = function () {
		return panel.tf('%album artist%[ - %album%]');
	}

	this.http_request_done = function (id, success, response_text, status, response_headers) {
		var filename = this.filenames[id];
		var kind = this.request_kinds[id] || '';
		var request_url = this.request_urls[id] || this.last_request_url;
		var attempt = Number(this.request_attempts[id]) || 1;

		this.forget_request(id);

		if (!filename || filename != this.filename)
			return;

		status = Number(status) || 0;
		var http_ok = success && (!status || (status >= 200 && status < 300));

		if (!http_ok && kind != 'allmusic-search' && kind.indexOf('allmusic-review-') == 0 && this.is_cloudflare_challenge(status, response_text, response_headers)) {
			this.mark_cloudflare_blocked(request_url);
			return;
		}

		if (!http_ok) {
			var detail = success ? ('HTTP ' + status) : String(response_text || 'request failed');

			if (kind == 'allmusic-search') {
				console.log(N, 'AllMusic search request returned ' + detail + '. Trying MusicBrainz relationship lookup...');
				this.begin_musicbrainz_fallback(detail);
			} else if (kind == 'allmusic-review-ajax') {
				this.try_review_page(request_url, detail);
			} else if (kind.indexOf('musicbrainz-') == 0) {
				if (this.is_transient_musicbrainz_failure(success, status)) {
					var retry_delay = status == 429 || status == 503 ? 3000 : 1500;
					this.retry_musicbrainz_request(request_url, kind, attempt, 'request returned ' + detail, retry_delay);
				} else {
					this.musicbrainz_failed('MusicBrainz request returned ' + detail + '.');
				}
			} else {
				console.log(N, detail);
			}
			return;
		}

		switch (kind) {
		case 'allmusic-search':
			this.parse_search_results(response_text);
			break;
		case 'allmusic-review-page':
		case 'allmusic-review-ajax':
			this.handle_review_response(response_text, filename, kind, request_url);
			break;
		case 'musicbrainz-search':
			this.parse_musicbrainz_search(response_text);
			break;
		case 'musicbrainz-release':
			this.parse_musicbrainz_release(response_text);
			break;
		case 'musicbrainz-release-group':
			this.parse_musicbrainz_release_group(response_text);
			break;
		default:
			console.log(N, 'Unknown web-request response type for: ' + request_url);
			break;
		}
	}

	this.handle_review_response = function (response_text, filename, kind, request_url) {
		// The dedicated endpoint may return a bare fragment. The full album page
		// must contain a recognised editorial-review container; otherwise generic
		// account, navigation and footer paragraphs could be mistaken for a review.
		var content = this.parse_review(response_text, kind == 'allmusic-review-page');

		if (content.length && this.is_allmusic_page_chrome(content)) {
			console.log(N, 'Ignored AllMusic page navigation/account text because it did not contain an editorial review.');
			content = '';
		}

		if (content.length) {
			this.cache_album_url(request_url);
			if (typeof DarkOneNetwork != 'undefined') DarkOneNetwork.clearAllMusicBackoff();
			this.clear_blocked_state();
			this.review_url = '';
			this.status_text = '';
			console.log(N, 'A review was found and saved.');
			_save(filename, content);
			this.reset();
			this.metadb_changed();
			this.notify_terminal(true, 'review found');
		} else if (kind == 'allmusic-review-ajax') {
			this.try_review_page(request_url, 'the review endpoint contained no parseable review body');
		} else {
			this.review_url = '';
			this.set_status('No review was found on the AllMusic page for this album.');
			console.log(N, 'No editorial review was found on the full AllMusic album page; page navigation and account text were ignored.');
			this.notify_terminal(false, 'no review body');
		}
	}

	this.try_review_page = function (request_url, reason) {
		var album_page = this.normalise_allmusic_album_url(request_url);

		if (!album_page.length) {
			console.log(N, 'Could not retry the full AllMusic album page: ' + reason);
			this.notify_terminal(false, 'could not resolve the full AllMusic album page');
			return;
		}

		this.review_url = album_page;
		console.log(N, 'The review endpoint failed (' + reason + '). Trying the full album page...');
		this.make_request(album_page, 'allmusic-review-page', this.headers, 0);
	}

	this.is_match = function (artist, album) {
		return this.is_artist_match(artist, this.artist) && this.is_album_match(album, this.album);
	}

	this.is_artist_match = function (candidate, wanted) {
		var a = this.tidy(candidate);
		var b = this.tidy(wanted);
		if (a == b) return true;
		return b == 'variousartists' && (a == 'variousartists' || a == 'various');
	}

	this.is_album_match = function (candidate, wanted) {
		var a = this.tidy(this.clean_album(candidate));
		var b = this.tidy(this.clean_album(wanted));
		if (a == b) return true;
		if (!a.length || !b.length) return false;
		return (a.indexOf(b) == 0 || b.indexOf(a) == 0) && Math.min(a.length, b.length) / Math.max(a.length, b.length) > 0.75;
	}

	this.clean_album = function (value) {
		var original = String(value || '');
		var str = original;
		str = str.replace(/[\s\-_]*(?:\(|\[|\{)\s*(?:disc|disk|cd)\s*\d+(?:\s*(?:of|\/)\s*\d+)?\s*(?:\)|\]|\})\s*$/ig, '');
		str = str.replace(/[\s\-_]*(?:disc|disk|cd)\s*\d+(?:\s*(?:of|\/)\s*\d+)?\s*$/ig, '');
		str = str.replace(/[\s\-_]*(?:\(|\[|\{)\s*(?:bonus|deluxe|expanded|explicit|clean|remaster(?:ed)?|anniversary|special|limited|edition|version)\b[^\)\]\}]*?(?:\)|\]|\})\s*$/ig, '');
		return str.trim() || original;
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

			var temp_artist = panel.tf('%album artist%');
			var temp_album = panel.tf('%album%');

			if (this.artist == temp_artist && this.album == temp_album)
				return;

			this.clear_request_timers();
			// The fallback guard belongs to one album only. A blocked or failed
			// lookup must not prevent MusicBrainz resolution for the next album.
			this.mb_fallback_started = false;
			this.terminal_state = '';
			this.artist = temp_artist;
			this.album = temp_album;
			this.album_clean = this.clean_album(temp_album);
			this.filename = _artistFolder(this.artist) + 'allmusic.' + utils.ReplaceIllegalChars(this.album_clean || this.album) + '.txt';
			this.state_filename = this.filename.replace(/\.txt$/i, '.state.json');
			this.review_url = '';
			this.status_text = '';
			this.load_state();

			if (utils.IsFile(this.filename)) {
				str = utils.ReadUTF8(this.filename).trim();
				if (str.empty()) {
					// empty files left by previous version can be removed
					utils.RemovePath(this.filename);
				} else if (this.is_allmusic_page_chrome(str)) {
					console.log(N, 'Removed a cached AllMusic page shell that did not contain an editorial review: ' + this.filename);
					utils.RemovePath(this.filename);
					str = '';
				}
			}

			this.text = str;

			if (!this.text.length) {
				if (this.state.blocked && this.resolved_album_url.length) {
					this.status_text = this.blocked_message();
					this.notify_terminal(false, 'saved browser-verification state');
				} else {
					this.get();
				}
			} else {
				this.notify_terminal(true, 'cached review');
			}

			this.rebuild_text_layout();
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
		if (!this.text_layout)
			return;

		_writeTextLayoutWithScrollFade(gr, this.text_layout, panel.colours.text, this.x, this.y + _scale(12), this.w, this.ha, this.offset, this.up_btn.v(), this.down_btn.v());
		this.up_btn.paint(gr, panel.colours.text);
		this.down_btn.paint(gr, panel.colours.text);
	}

	this.is_allmusic_page_chrome = function (value) {
		var text = String(value || '').toLowerCase().replace(/\s+/g, ' ');
		var account_markers = [
			'to set your preferred streaming service, log in to your allmusic account',
			'to submit streaming links, log in to your allmusic account',
			"don't have an account?"
		];
		var page_markers = [
			'user reviews', 'track listing', 'credits', 'releases', 'similar albums',
			'what is allmusic?', 'privacy policy', 'terms of service', 'account settings'
		];
		var account_hits = 0;
		var page_hits = 0;

		for (var i = 0; i < account_markers.length; i++)
			if (text.indexOf(account_markers[i]) > -1) account_hits++;
		for (var j = 0; j < page_markers.length; j++)
			if (text.indexOf(page_markers[j]) > -1) page_hits++;

		return account_hits > 0 && page_hits >= 4;
	}

	this.parse_review = function (response_text, require_review_container) {
		if (response_text.empty())
			return '';

		function normalise(value) {
			return String(value || '')
				.replace(/\r\n?/g, '\n')
				.replace(/[ \t]+\n/g, '\n')
				.replace(/\n[ \t]+/g, '\n')
				.replace(/[ \t]{2,}/g, ' ')
				.replace(/\n{3,}/g, '\n\n')
				.trim();
		}

		function append_paragraphs(target, source) {
			var nodes = source ? source.getElementsByTagName('p') : _getElementsByTagName(response_text, 'p');
			var added = 0;

			for (var i = 0; i < nodes.length; i++) {
				var paragraph = normalise(nodes[i].innerText);

				if (paragraph.length) {
					target.push(paragraph);
					added++;
				}
			}

			// Some AllMusic responses contain the review body without explicit <p> tags.
			if (!added && source) {
				var fallback = normalise(source.innerText);

				if (fallback.length)
					target.push(fallback);
			}
		}

		function class_tokens(item) {
			return ' ' + String(item && item.className || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
		}

		function has_class(item, name) {
			return class_tokens(item).indexOf(' ' + name + ' ') > -1;
		}

		function is_editorial_review_context(item) {
			var node = item;

			for (var depth = 0; depth < 6 && node; depth++) {
				var cls = class_tokens(node);
				var prop = String(node.getAttribute ? node.getAttribute('itemprop') || '' : '').toLowerCase();

				if (cls.indexOf(' user-review ') > -1 || cls.indexOf(' user-reviews ') > -1)
					return false;
				if (prop == 'review' || prop == 'reviewbody' ||
					cls.indexOf(' review ') > -1 || cls.indexOf(' album-review ') > -1 ||
					cls.indexOf(' editorial-review ') > -1 || cls.indexOf(' review-section ') > -1 ||
					cls.indexOf(' review-content ') > -1)
					return true;

				node = node.parentNode;
			}

			return false;
		}

		var divs = _getElementsByTagName(response_text, 'div');
		var review_bodies = [];
		var text_bodies = [];

		for (var i = 0; i < divs.length; i++) {
			var item = divs[i];
			var cls = String(item.className || '').toLowerCase();
			var prop = String(item.getAttribute ? item.getAttribute('itemprop') || '' : '').toLowerCase();

			if (prop == 'reviewbody' || has_class(item, 'review-body') || has_class(item, 'review_body')) {
				review_bodies.push(item);
			} else if ((!require_review_container && cls.indexOf('text') > -1) ||
				(require_review_container && is_editorial_review_context(item) &&
					(has_class(item, 'text') || has_class(item, 'review') || has_class(item, 'album-review') ||
						has_class(item, 'editorial-review') || has_class(item, 'review-content')))) {
				text_bodies.push(item);
			}
		}

		// Prefer semantic reviewBody markup. For older/alternate AllMusic markup,
		// choose the longest text container so nested wrappers are not duplicated.
		if (!review_bodies.length && text_bodies.length) {
			var longest = text_bodies[0];
			var longest_length = normalise(longest.innerText).length;

			for (var j = 1; j < text_bodies.length; j++) {
				var candidate_length = normalise(text_bodies[j].innerText).length;

				if (candidate_length > longest_length) {
					longest = text_bodies[j];
					longest_length = candidate_length;
				}
			}

			review_bodies.push(longest);
		}

		var paragraphs = [];

		if (review_bodies.length) {
			for (var k = 0; k < review_bodies.length; k++)
				append_paragraphs(paragraphs, review_bodies[k]);
		} else if (!require_review_container) {
			append_paragraphs(paragraphs, null);
		}

		// Avoid duplicate text when an endpoint returns nested semantic wrappers.
		var seen = {};
		var unique = [];

		for (var n = 0; n < paragraphs.length; n++) {
			var key = paragraphs[n].toLowerCase();

			if (!seen[key]) {
				seen[key] = true;
				unique.push(paragraphs[n]);
			}
		}

		return unique.join('\r\n\r\n');
	}

	this.get_link_href = function (link) {
		var href = '';

		try {
			href = String(link.getAttribute('href') || '');
		} catch (e) {}

		if (!href.length) {
			try {
				href = String(link.href || '');
			} catch (e) {}
		}

		return href.trim();
	}

	this.get_album_page_url = function (link) {
		var href = this.get_link_href(link);

		if (!href.length || href.toLowerCase().indexOf('/album/') == -1)
			return '';

		if (href.indexOf('//') == 0) {
			href = 'https:' + href;
		} else if (href.charAt(0) == '/') {
			href = 'https://www.allmusic.com' + href;
		} else if (!/^https?:\/\//i.test(href)) {
			return '';
		}

		return href.split('#')[0].split('?')[0].replace(/\/+$/, '');
	}

	this.get_nearby_artist = function (album_link) {
		var node = album_link;
		var fallback = '';
		var wanted = this.tidy(this.artist);

		// Current AllMusic search results no longer use the old strict
		// div.info > div.title/div.artist structure. Walk only the nearest
		// result-card ancestors so we do not accidentally match another card.
		for (var depth = 0; depth < 5 && node; depth++) {
			var links;

			try {
				links = node.getElementsByTagName('a');
			} catch (e) {
				links = [];
			}

			for (var i = 0; i < links.length; i++) {
				var link = links[i];
				var href = this.get_link_href(link).toLowerCase();
				var text = String(link.innerText || '').trim();

				if (text.length && href.indexOf('/artist/') > -1) {
					if (this.is_artist_match(text, this.artist))
						return text;

					if (!fallback.length)
						fallback = text;
				}
			}

			try {
				var node_text = String(node.innerText || '');

				// Keep this bounded to a result-sized element. Once the ancestor
				// becomes the whole results page it can contain unrelated matches.
				if (node_text.length && node_text.length < 1200 && wanted.length && this.tidy(node_text).indexOf(wanted) > -1)
					return this.artist;
			} catch (e) {}

			node = node.parentNode;
		}

		return fallback;
	}

	this.score_search_candidate = function (album, artist) {
		var candidate_album = this.tidy(this.clean_album(album));
		var wanted_album = this.tidy(this.clean_album(this.album));
		var exact_album = candidate_album.length && candidate_album == wanted_album;

		if (!exact_album && !this.is_album_match(album, this.album))
			return -1;

		var score = exact_album ? 120 : 80;

		if (artist.length) {
			if (!this.is_artist_match(artist, this.artist))
				return -1;

			score += 140;
		}

		return score;
	}

	this.parse_search_results = function (response_text) {
		try {
			this.review_url = '';

			var links = _getElementsByTagName(response_text, 'a');
			var best = null;
			var album_link_count = 0;
			var seen_urls = {};

			for (var i = 0; i < links.length; i++) {
				var link = links[i];
				var album_page = this.get_album_page_url(link);
				var album = String(link.innerText || '').trim();

				// Search result cards usually contain a second, image-only link to
				// the same album. Ignore empty anchors and duplicate album URLs.
				if (!album_page.length || !album.length || seen_urls[album_page])
					continue;

				seen_urls[album_page] = true;
				album_link_count++;

				var artist = this.get_nearby_artist(link);
				var score = this.score_search_candidate(album, artist);

				if (score < 0)
					continue;

				if (!best || score > best.score) {
					best = {
						album : album,
						artist : artist,
						score : score,
						url : album_page + '/reviewAjax'
					};
				}
			}

			if (best) {
				this.cache_album_url(best.url);
				this.review_url = best.url;
				console.log(N, 'A page was found for ' + _q(this.album) + ' (' + best.album + (best.artist.length ? ' - ' + best.artist : '') + '). Now checking for review...');
				this.get();
			} else {
				console.log(N, 'A match could not be found for ' + _q(this.album) + '. Parsed ' + album_link_count + ' album links from: ' + this.last_request_url);
				this.begin_musicbrainz_fallback(album_link_count ? 'no matching AllMusic result' : 'the AllMusic response contained no album links');
			}
		} catch (e) {
			console.log(N, 'Could not parse AllMusic server response: ' + e.message);
			this.begin_musicbrainz_fallback('AllMusic response parsing failed');
		}
	}


	this.clean_mbid = function (value) {
		var match = String(value || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
		return match ? match[0].toLowerCase() : '';
	}

	this.get_tag_mbid = function (name) {
		try {
			return this.clean_mbid(panel.tf('$meta(' + name + ')'));
		} catch (e) {
			return '';
		}
	}

	this.escape_musicbrainz_query = function (value) {
		return String(value || '').replace(/([\\"])/g, '\\$1');
	}

	this.begin_musicbrainz_fallback = function (reason) {
		if (this.mb_fallback_started)
			return;

		if (!this.source_enabled('musicbrainz')) {
			this.musicbrainz_failed('MusicBrainz relationship lookup is disabled.');
			return;
		}

		this.mb_fallback_started = true;
		this.set_status('Looking up the AllMusic album relationship through MusicBrainz...');
		console.log(N, 'Using MusicBrainz as an AllMusic URL resolver (' + reason + ').');

		var release_group_id = this.get_tag_mbid('MUSICBRAINZ_RELEASEGROUPID');
		if (release_group_id.length) {
			this.request_musicbrainz_release_group(release_group_id);
			return;
		}

		var release_id = this.get_tag_mbid('MUSICBRAINZ_ALBUMID');
		if (release_id.length) {
			var release_url = 'https://musicbrainz.org/ws/2/release/' + release_id + '?inc=release-groups&fmt=json';
			this.make_musicbrainz_request(release_url, 'musicbrainz-release');
			return;
		}

		var query = 'releasegroup:"' + this.escape_musicbrainz_query(this.album_clean || this.album) + '" AND artist:"' + this.escape_musicbrainz_query(this.artist) + '"';
		var search_url = 'https://musicbrainz.org/ws/2/release-group/?query=' + encodeURIComponent(query) + '&fmt=json&limit=10';
		this.make_musicbrainz_request(search_url, 'musicbrainz-search');
	}

	this.request_musicbrainz_release_group = function (release_group_id) {
		var url = 'https://musicbrainz.org/ws/2/release-group/' + release_group_id + '?inc=url-rels+artist-credits&fmt=json';
		this.make_musicbrainz_request(url, 'musicbrainz-release-group');
	}

	this.musicbrainz_artist_credit = function (value) {
		var credit = value && value['artist-credit'];
		var names = [];

		if (!credit || !credit.length)
			return '';

		for (var i = 0; i < credit.length; i++) {
			var item = credit[i] || {};
			var name = String(item.name || (item.artist && item.artist.name) || '').trim();
			if (name.length)
				names.push(name + String(item.joinphrase || ''));
		}

		return names.join('').trim();
	}

	this.parse_musicbrainz_search = function (response_text) {
		var data;
		try {
			data = JSON.parse(response_text);
		} catch (e) {
			this.musicbrainz_failed('MusicBrainz returned invalid search data.');
			return;
		}

		var groups = data['release-groups'] || [];
		var best = null;

		for (var i = 0; i < groups.length; i++) {
			var group = groups[i] || {};
			var artist = this.musicbrainz_artist_credit(group);
			var match_score = this.score_search_candidate(String(group.title || ''), artist);
			if (match_score < 0)
				continue;

			var score = match_score + (Number(group.score) || 0);
			if (!best || score > best.score)
				best = { id : String(group.id || ''), score : score, title : group.title, artist : artist };
		}

		if (best && best.id.length) {
			console.log(N, 'MusicBrainz matched ' + _q(best.title) + (best.artist.length ? ' by ' + best.artist : '') + '. Checking its AllMusic relationship...');
			this.request_musicbrainz_release_group(best.id);
		} else {
			this.musicbrainz_failed('MusicBrainz could not match this artist and album.');
		}
	}

	this.parse_musicbrainz_release = function (response_text) {
		var data;
		try {
			data = JSON.parse(response_text);
		} catch (e) {
			this.musicbrainz_failed('MusicBrainz returned invalid release data.');
			return;
		}

		var release_group = data['release-group'] || {};
		var release_group_id = this.clean_mbid(release_group.id || '');
		if (release_group_id.length)
			this.request_musicbrainz_release_group(release_group_id);
		else
			this.musicbrainz_failed('The tagged MusicBrainz release has no release-group identifier.');
	}

	this.normalise_allmusic_album_url = function (value) {
		var url = String(value || '').trim();
		if (!url.length)
			return '';

		url = url.replace(/\/reviewAjax\/?$/i, '').split('#')[0].split('?')[0].replace(/\/+$/, '');
		var match = url.match(/^https?:\/\/(?:www\.)?allmusic\.com(\/album\/[^\s]+)$/i);
		return match ? ('https://www.allmusic.com' + match[1]) : '';
	}

	this.parse_musicbrainz_release_group = function (response_text) {
		var data;
		try {
			data = JSON.parse(response_text);
		} catch (e) {
			this.musicbrainz_failed('MusicBrainz returned invalid release-group data.');
			return;
		}

		var relations = data.relations || [];
		var allmusic_url = '';

		for (var i = 0; i < relations.length; i++) {
			var relation = relations[i] || {};
			var resource = relation.url && relation.url.resource;
			var candidate = this.normalise_allmusic_album_url(resource);

			if (candidate.length && (String(relation.type || '').toLowerCase() == 'allmusic' || candidate.toLowerCase().indexOf('allmusic.com/album/') > -1)) {
				allmusic_url = candidate;
				break;
			}
		}

		if (allmusic_url.length) {
			this.cache_album_url(allmusic_url);
			this.review_url = allmusic_url + '/reviewAjax';
			console.log(N, 'MusicBrainz supplied the AllMusic album URL. Now checking for a review...');
			this.get();
		} else {
			this.musicbrainz_failed('The matching MusicBrainz release group has no AllMusic relationship.');
		}
	}

	this.musicbrainz_failed = function (message) {
		this.set_status(message + '\r\n\r\nUse "Fetch from manual AllMusic URL..." from the right-click menu for this album.');
		console.log(N, message + ' Use "Fetch from manual AllMusic URL..." for this album.');
		this.notify_terminal(false, message);
	}

	this.normalise_pasted_review = function (value) {
		return String(value || '')
			.replace(/\u00a0/g, ' ')
			.replace(/\r\n?/g, '\n')
			.replace(/[ \t]+\n/g, '\n')
			.replace(/\n[ \t]+/g, '\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim()
			.replace(/\n/g, '\r\n');
	}

	this.rbtn_up = function (x, y) {
		this.cb = this.normalise_pasted_review(utils.GetClipboardText());
		panel.m.AppendMenuItem(EnableMenuIf(panel.metadb && this.cb.length > 0 && _tagged(this.artist) && _tagged(this.album)), 1000, 'Paste review from clipboard');
		panel.m.AppendMenuItem(EnableMenuIf(this.resolved_album_url.length), 1001, 'Open album on AllMusic');
		panel.m.AppendMenuSeparator();

		panel.s11.AppendMenuItem(EnableMenuIf(panel.metadb), 1100, 'Refresh from AllMusic (retry once)');
		panel.s11.AppendMenuItem(EnableMenuIf(utils.IsFile(this.filename)), 1101, 'Delete cached review');
		panel.s11.AppendMenuSeparator();
		panel.s11.AppendMenuItem(EnableMenuIf(panel.metadb), 1102, 'Fetch from manual AllMusic URL...');
		panel.s11.AppendMenuItem(EnableMenuIf(this.resolved_album_url.length), 1106, 'Copy AllMusic album URL');
		panel.s11.AppendMenuSeparator();
		panel.s11.AppendMenuItem(EnableMenuIf(_tagged(this.artist)), 1103, 'Open artist cache folder');
		panel.s11.AppendMenuItem(MF_STRING, 1104, 'Open js_data cache folder');
		panel.s11.AppendMenuItem(EnableMenuIf(utils.IsFile(this.filename)), 1105, 'Copy cache file path');
		panel.s11.AppendTo(panel.m, MF_STRING, 'AllMusic cache/tools');

		if (!this.managed) {
			panel.s12.AppendMenuItem(MF_STRING, 1150, 'JSP3 Enhanced Samples application (recommended)');
			panel.s12.AppendMenuItem(MF_STRING, 1151, 'Google Chrome 150-style (experimental)');
			panel.s12.CheckMenuRadioItem(1150, 1151, this.get_header_profile() == 'chrome' ? 1151 : 1150);
			panel.s12.AppendTo(panel.m, MF_STRING, 'Request identity');
			panel.m.AppendMenuSeparator();
		}
		panel.m.AppendMenuItem(EnableMenuIf(utils.IsFile(this.filename)), 1999, 'Open containing folder');
		panel.m.AppendMenuSeparator();
	}

	this.rbtn_up_done = function (idx) {
		switch (idx) {
		case 1000:
			if (_save(this.filename, this.cb)) {
				console.log(N, 'Saved review text from the clipboard.');
				this.reset();
				this.metadb_changed();
			}
			break;
		case 1001:
			utils.Run(this.resolved_album_url);
			break;
		case 1100:
			this.refresh();
			break;
		case 1101:
			this.delete_cache(false);
			break;
		case 1102:
			this.manual_url();
			break;
		case 1103:
			utils.Run('explorer', _q(_artistFolder(this.artist)));
			break;
		case 1104:
			utils.CreateFolder(folders.data);
			utils.Run('explorer', _q(folders.data));
			break;
		case 1105:
			utils.SetClipboardText(this.filename);
			break;
		case 1106:
			utils.SetClipboardText(this.resolved_album_url);
			break;
		case 1150:
			this.set_header_profile('application');
			break;
		case 1151:
			this.set_header_profile('chrome');
			break;
		case 1999:
			_explorer(this.filename);
			break;
		}
	}

	this.delete_cache = function (silent) {
		if (utils.IsFile(this.filename)) {
			utils.RemovePath(this.filename);
			if (!silent) console.log(N, 'Deleted cached AllMusic review: ' + this.filename);
		}
		this.text = '';
		this.status_text = '';
		this.offset = 0;
		this.rebuild_text_layout();
		window.Repaint();
	}

	this.refresh = function (manual_url) {
		if (!panel.metadb) return;
		// Discard watchdogs, delayed retries and task metadata from the previous
		// attempt. Late callbacks then have no matching filename and are ignored.
		this.clear_request_timers();
		this.terminal_state = '';
		this.allow_allmusic_retry_once = true;
		this.delete_cache(true);
		this.clear_blocked_state();
		this.status_text = 'Looking up the AllMusic review...';

		if (manual_url) {
			this.cache_album_url(manual_url);
			this.review_url = this.normalise_allmusic_album_url(manual_url) + '/reviewAjax';
		} else {
			this.review_url = this.resolved_album_url.length ? this.resolved_album_url + '/reviewAjax' : '';
		}

		this.history = {};
		this.last_request_url = '';
		this.mb_fallback_started = false;
		this.rebuild_text_layout();
		console.log(N, manual_url ? 'Fetching AllMusic review from manual URL...' : 'Refreshing AllMusic review...');
		this.get();
	}

	this.manual_url = function () {
		if (!panel.metadb) return;
		try {
			var url = utils.InputBox('Paste the full AllMusic album URL. It will be used once for the current album and saved to the normal cache file.', window.Name, '');
			url = String(url || '').trim();
			if (url.length) {
				url = this.normalise_allmusic_album_url(url);
				if (url.length)
					this.refresh(url);
				else
					console.log(N, 'The supplied URL is not an AllMusic album page.');
			}
		} catch (e) {}
	}

	this.notify_data = function (name, info) {
		return typeof DarkOneNetwork != 'undefined' ? DarkOneNetwork.onNotify(name, info) : false;
	}

	this.dispose = function () {
		this.clear_request_timers();
		this.clear_layout();
	}

	this.reset = function () {
		this.clear_request_timers();
		this.text = this.status_text = this.artist = this.album = this.album_clean = this.filename = this.state_filename = '';
		this.review_url = this.resolved_album_url = '';
		this.state = this.default_state();
		this.mb_fallback_started = false;
		this.allow_allmusic_retry_once = false;
		this.terminal_state = '';
		this.history = {};
		this.last_request_url = '';
	}

	this.size = function () {
		this.ha = this.h - _scale(24);
		this.up_btn.x = this.x + Math.round((this.w - _scale(12)) / 2);
		this.down_btn.x = this.up_btn.x;
		this.up_btn.y = this.y;
		this.down_btn.y = this.y + this.h - _scale(12);
		this.update();
	}

	this.tidy = function (str) {
		return utils.ConvertToAscii(String(str || '')).toLowerCase().replace(/&amp;/g, '&').replace(/&/g, ' and ').replace(/\band\b/g, '').replace(/[^a-z0-9]+/g, '');
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

	utils.CreateFolder(folders.artists);
	panel.text_objects.push(this);
	this.name = 'allmusic';

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
	this.status_text = '';

	this.artist = '';
	this.album = '';
	this.album_clean = '';
	this.filename = '';
	this.state_filename = '';
	this.resolved_album_url = '';
	this.state = this.default_state();
	this.filenames = {};
	this.request_kinds = {};
	this.request_urls = {};
	this.request_attempts = {};
	this.request_watchdogs = {};
	this.scheduled_request_timers = {};
	this.request_timeout_ms = 15000;
	this.mb_max_attempts = 3;
	this.review_url = '';
	this.mb_fallback_started = false;
	this.allow_allmusic_retry_once = false;
	this.mb_last_request_time = 0;
	this.search_base = 'https://www.allmusic.com/search/albums/';
	this.history = {};
	this.last_request_url = '';

	this.headers = JSON.stringify({
		'User-Agent' : 'JSP3EnhancedSamples/0.6.2 (foobar2000 JScript Panel 3)',
		'Referer' : 'https://www.allmusic.com/',
		'Accept' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
		'Accept-Language' : 'en-GB,en;q=0.9'
	});

	this.mb_headers = JSON.stringify({
		'User-Agent' : 'JSP3EnhancedSamples/0.6.2 (foobar2000 JScript Panel 3)',
		'Accept' : 'application/json'
	});

	this.up_btn = new _sb(chars.up, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset < 0; }, this), _.bind(function () { this.wheel(1); }, this));
	this.down_btn = new _sb(chars.down, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset > this.ha - this.text_height; }, this), _.bind(function () { this.wheel(-1); }, this));
}
// Compatibility callbacks for existing configured panel wrappers.
if (typeof on_notify_data == 'undefined') {
	var on_notify_data = function (name, info) {
		if (typeof allmusic != 'undefined' && allmusic && typeof allmusic.notify_data == 'function') allmusic.notify_data(name, info);
	};
}
