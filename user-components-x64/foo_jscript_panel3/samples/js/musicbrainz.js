function _musicbrainz(x, y, w, h, options) {
	options = options && typeof options == 'object' ? options : {};
	this.managed = options.managed === true;
	this.normalise = function (value) {
		return String(value || '')
			.toLowerCase()
			.replace(/&/g, ' and ')
			.replace(/[^a-z0-9]+/g, ' ')
			.replace(/^\s+|\s+$/g, '')
			.replace(/\s+/g, ' ');
	}

	this.safe_decode = function (value) {
		try {
			return decodeURIComponent(value);
		} catch (e) {
			return value;
		}
	}

	this.containsXY = function (x, y) {
		return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
	}

	this.draw_row = function (gr, text, colour, x, y, w, h, text_alignment, font) {
		gr.WriteTextSimple(text, font || panel.fonts.normal, colour, x, y, w, h, text_alignment || DWRITE_TEXT_ALIGNMENT_LEADING, DWRITE_PARAGRAPH_ALIGNMENT_CENTER, DWRITE_WORD_WRAPPING_NO_WRAP, DWRITE_TRIMMING_GRANULARITY_CHARACTER);
	}

	this.draw_status = function (gr) {
		var message = this.status || 'No MusicBrainz data is available.';
		var colour = this.error ? RGB(220, 110, 110) : panel.colours.text;
		gr.WriteTextSimple(message, panel.fonts.normal, colour, this.x + _scale(16), this.y + _scale(12), Math.max(0, this.w - _scale(32)), Math.max(0, this.h - _scale(24)), DWRITE_TEXT_ALIGNMENT_CENTER, DWRITE_PARAGRAPH_ALIGNMENT_CENTER, DWRITE_WORD_WRAPPING_WRAP, DWRITE_TRIMMING_GRANULARITY_CHARACTER);
	}

	this.font_changed = function () {
		this.rebuild_display_data();
		this.size();
	}

	this.get_artist_name = function () {
		if (!panel.metadb)
			return '';

		if (this.properties.artist_source.value == 1) {
			return panel.tf('$if2($meta(album artist,0),$meta(artist,0))');
		}

		return panel.tf(DEFAULT_ARTIST);
	}

	this.get_tagged_mbid = function () {
		if (!panel.metadb)
			return '';

		var value = '';

		if (this.properties.artist_source.value == 1) {
			value = panel.tf('$if3($meta(musicbrainz_albumartistid,0),$meta(musicbrainz album artist id,0),$meta(musicbrainz_artistid,0),$meta(musicbrainz artist id,0),)');
		} else {
			value = panel.tf('$if3($meta(musicbrainz_artistid,0),$meta(musicbrainz artist id,0),$meta(musicbrainz_albumartistid,0),$meta(musicbrainz album artist id,0),)');
		}

		value = String(value || '').split(/[;,]/)[0].replace(/^\s+|\s+$/g, '').toLowerCase();
		return _isUUID(value) ? value : '';
	}

	this.artist_cache_key = function (artist) {
		return this.normalise(artist);
	}

	this.load_artist_map = function () {
		var data = _jsonParseFile(this.artist_map_file);
		return data && !Array.isArray(data) && typeof data == 'object' ? data : {};
	}

	this.save_artist_map = function () {
		_save(this.artist_map_file, JSON.stringify(this.artist_map, null, 2));
	}

	this.get_cached_artist = function (artist) {
		var entry = this.artist_map[this.artist_cache_key(artist)];
		return entry && _isUUID(entry.mbid) ? entry : null;
	}

	this.set_cached_artist = function (artist, mbid, result, source) {
		var key = this.artist_cache_key(artist);
		if (!key || !_isUUID(mbid))
			return;

		this.artist_map[key] = {
			mbid : mbid,
			name : result && result.name ? result.name : artist,
			sort_name : result && result['sort-name'] ? result['sort-name'] : '',
			disambiguation : result && result.disambiguation ? result.disambiguation : '',
			country : result && result.country ? result.country : '',
			type : result && result.type ? result.type : '',
			score : result && typeof result.score != 'undefined' ? Number(result.score) : 100,
			source : source || 'automatic',
			updated : Date.now()
		};
		this.save_artist_map();
	}

	this.clear_cached_artist = function () {
		var key = this.artist_cache_key(this.artist);
		if (key && this.artist_map[key]) {
			delete this.artist_map[key];
			this.save_artist_map();
		}
	}

	this.get_user_agent = function () {
		var contact = String(this.properties.contact.value || '').replace(/^\s+|\s+$/g, '');
		if (typeof DarkOneNetwork != 'undefined' && typeof DarkOneNetwork.applicationUserAgent == 'function')
			return DarkOneNetwork.applicationUserAgent(contact);
		return 'JSP3EnhancedSamples/0.6.2 (foobar2000 JScript Panel 3' + (contact ? '; ' + contact : '') + ')';
	}

	this.get_header_profile = function () {
		return typeof DarkOneNetwork != 'undefined' && typeof DarkOneNetwork.getApiHeaderProfile == 'function' ? DarkOneNetwork.getApiHeaderProfile() : (typeof DarkOneNetwork != 'undefined' && typeof DarkOneNetwork.getHeaderProfile == 'function' ? DarkOneNetwork.getHeaderProfile() : 'application');
	}

	this.set_header_profile = function (value) {
		var profile = value == 'chrome' ? 'chrome' : 'application';
		if (typeof DarkOneNetwork != 'undefined' && typeof DarkOneNetwork.setHeaderProfile == 'function')
			profile = DarkOneNetwork.setHeaderProfile(profile);
		console.log(N, 'Request identity changed to ' + (profile == 'chrome' ? 'Google Chrome 150-style (experimental).' : 'JSP3 Enhanced Samples application (recommended).'));
		if (profile == 'chrome')
			console.log(N, 'MusicBrainz recommends an application-identifying User-Agent; Chrome mode is intended for diagnostics only.');
	}

	this.request_headers = function () {
		var contact = String(this.properties.contact.value || '').replace(/^\s+|\s+$/g, '');
		if (typeof DarkOneNetwork != 'undefined' && typeof DarkOneNetwork.musicBrainzHeaders == 'function')
			return DarkOneNetwork.musicBrainzHeaders(contact);
		return JSON.stringify({
			'User-Agent' : this.get_user_agent(),
			'Accept' : 'application/json'
		});
	}

	this.clear_request_timer = function () {
		if (this.request_timer) {
			window.ClearTimeout(this.request_timer);
			this.request_timer = 0;
		}
	}

	this.clear_request_watchdog = function (task_id) {
		var timer = this.request_watchdogs[task_id];
		if (timer !== undefined) {
			window.ClearTimeout(timer);
			delete this.request_watchdogs[task_id];
		}
	}

	this.clear_request_watchdogs = function () {
		for (var task_id in this.request_watchdogs) {
			if (Object.prototype.hasOwnProperty.call(this.request_watchdogs, task_id))
				window.ClearTimeout(this.request_watchdogs[task_id]);
		}
		this.request_watchdogs = {};
	}

	this.cancel_requests = function () {
		this.clear_request_timer();
		this.clear_request_watchdogs();
		this.request_queue = [];
		this.requests = {};
		this.request_inflight = 0;
	}

	this.queue_request = function (kind, url, context, retry_count, not_before) {
		this.request_queue.push({
			kind : kind,
			url : url,
			context : context || {},
			retry_count : retry_count || 0,
			not_before : not_before || 0,
			reserved_at : 0,
			generation : this.generation
		});
		this.pump_requests();
	}

	this.pump_requests = function () {
		if (this.disposed || this.request_inflight || this.request_timer || !this.request_queue.length)
			return;

		var self = this;
		var next = this.request_queue[0];
		var now = Date.now();
		var minimum_delay = Math.max(0, next.not_before - now);
		var delay;

		if (!next.reserved_at) {
			if (typeof DarkOneNetwork != 'undefined') {
				delay = DarkOneNetwork.reserveMusicBrainz(this.request_interval, minimum_delay);
			} else {
				delay = Math.max(minimum_delay, this.request_interval - (now - this.last_request_at));
			}
			next.reserved_at = now + delay;
			next.not_before = next.reserved_at;
		} else {
			delay = Math.max(0, next.reserved_at - now);
		}

		this.request_timer = window.SetTimeout(function () {
			self.request_timer = 0;
			self.perform_next_request();
		}, delay);
	}

	this.is_transient_request_failure = function (success, status) {
		status = Number(status) || 0;
		return !success || !status || status == 408 || status == 425 || status == 429 || status >= 500;
	}

	this.retry_request = function (request, status, reason) {
		if (request.retry_count >= 2)
			return false;

		status = Number(status) || 0;
		var delay = status == 429 || status >= 500 ? 1600 * (request.retry_count + 1) : 1200;
		this.request_queue.unshift({
			kind : request.kind,
			url : request.url,
			context : request.context,
			retry_count : request.retry_count + 1,
			not_before : Date.now() + delay,
			reserved_at : 0,
			generation : request.generation
		});
		this.status = 'MusicBrainz request did not complete. Retrying request ' + (request.retry_count + 2) + ' of 3...';
		this.error = false;
		console.log(N, (reason || 'MusicBrainz request failed') + '. Retrying attempt ' + (request.retry_count + 2) + ' of 3.');
		window.Repaint();
		return true;
	}

	this.perform_next_request = function () {
		if (this.disposed || this.request_inflight || !this.request_queue.length)
			return;

		var request = this.request_queue.shift();
		if (request.generation != this.generation) {
			this.pump_requests();
			return;
		}

		var task_id;
		try {
			task_id = utils.HTTPRequestAsync(window.ID, 0, request.url, this.request_headers());
		} catch (e) {
			if (!this.retry_request(request, 0, 'MusicBrainz request could not be started: ' + e.message)) {
				this.loading = false;
				this.error = true;
				this.status = 'MusicBrainz request could not be started: ' + e.message;
			}
			this.pump_requests();
			window.Repaint();
			return;
		}

		this.requests[task_id] = request;
		this.request_inflight = task_id;
		this.last_request_at = Date.now();
		var self = this;
		this.request_watchdogs[task_id] = window.SetTimeout(function () {
			self.request_timed_out(task_id);
		}, this.request_timeout_ms);
	}

	this.request_timed_out = function (task_id) {
		var request = this.requests[task_id];
		if (!request) return;
		this.clear_request_watchdog(task_id);
		delete this.requests[task_id];
		if (this.request_inflight == task_id) this.request_inflight = 0;

		if (request.generation == this.generation && !this.retry_request(request, 0,
			'MusicBrainz request timed out after ' + Math.round(this.request_timeout_ms / 1000) + ' seconds')) {
			this.loading = false;
			this.error = true;
			this.status = 'MusicBrainz request timed out after three attempts. Right-click and choose Refresh to try again.';
		}
		this.pump_requests();
		window.Repaint();
	}

	this.http_request_done = function (id, success, response_text, status, response_headers) {
		var request = this.requests[id];
		if (!request)
			return;

		this.clear_request_watchdog(id);
		delete this.requests[id];
		if (this.request_inflight == id)
			this.request_inflight = 0;

		if (request.generation != this.generation) {
			this.pump_requests();
			return;
		}

		status = Number(status || (success ? 200 : 0));
		if (!success || status < 200 || status >= 300) {
			if (this.is_transient_request_failure(success, status) && this.retry_request(request, status,
				'MusicBrainz request failed' + (status ? ' with HTTP ' + status : ''))) {
				this.pump_requests();
				return;
			}

			this.loading = false;
			this.error = true;
			this.status = 'MusicBrainz request failed' + (status ? ' (HTTP ' + status + ')' : '') + '. Right-click and choose Refresh to try again.';
			console.log(N, this.status);
			this.pump_requests();
			window.Repaint();
			return;
		}

		var data = _jsonParse(response_text);
		if (!data || Array.isArray(data)) {
			this.loading = false;
			this.error = true;
			this.status = 'MusicBrainz returned an invalid JSON response.';
			this.pump_requests();
			window.Repaint();
			return;
		}

		switch (request.kind) {
		case 'artist-search':
			this.handle_artist_search(data, request);
			break;
		case 'release-page':
			this.handle_release_page(data, request);
			break;
		case 'artist-links':
			this.handle_artist_links(data, request);
			break;
		}

		this.pump_requests();
	}

	this.start_artist_search = function (force) {
		if (!this.artist) {
			this.loading = false;
			this.status = 'No artist is available for the selected track.';
			window.Repaint();
			return;
		}

		var cached = !force ? this.get_cached_artist(this.artist) : null;
		if (cached) {
			this.mb_id = cached.mbid;
			this.resolution = cached;
			this.start_mode_load(false);
			return;
		}

		this.loading = true;
		this.error = false;
		this.status = 'Resolving ' + this.artist + ' on MusicBrainz...';
		var query = 'artist:"' + String(this.artist).replace(/([+\-!(){}\[\]^"~*?:\\/])/g, '\\$1') + '"';
		var url = 'https://musicbrainz.org/ws/2/artist/?fmt=json&limit=10&query=' + encodeURIComponent(query);
		this.queue_request('artist-search', url, {artist : this.artist});
		window.Repaint();
	}

	this.artist_candidate_description = function (item) {
		var parts = [item.name || item['sort-name'] || item.id];
		if (item.disambiguation) parts.push(item.disambiguation);
		if (item.country) parts.push(item.country);
		if (item.type) parts.push(item.type);
		return parts.join(' — ');
	}

	this.choose_artist_candidate = function (results, artist) {
		var target = this.normalise(artist);
		var exact = [];

		_.forEach(results || [], function (item) {
			if (!_isUUID(item.id)) return;
			var primary = this.normalise(item.name) == target;
			var sort_exact = this.normalise(item['sort-name']) == target;
			var alias_exact = _.some(item.aliases || [], function (alias) {
				return this.normalise(alias.name) == target;
			}, this);
			if (!primary && !sort_exact && !alias_exact) return;
			var score = Number(item.score || 0) + (primary ? 100 : 0) + (sort_exact ? 30 : 0) + (alias_exact ? 10 : 0);
			exact.push({ item : item, score : score, primary : primary });
		}, this);

		if (!exact.length) return { result : null, ambiguous : false, candidates : [] };

		var primary_matches = _.filter(exact, function (candidate) { return candidate.primary; });
		if (primary_matches.length == 1) return { result : primary_matches[0].item, ambiguous : false, candidates : exact };

		exact.sort(function (a, b) { return b.score - a.score; });
		if (exact.length == 1 || exact[0].score - exact[1].score >= 30)
			return { result : exact[0].item, ambiguous : false, candidates : exact };

		return { result : null, ambiguous : true, candidates : exact };
	}

	this.handle_artist_search = function (data, request) {
		var selection = this.choose_artist_candidate(data.artists || [], request.context.artist);
		var result = selection.result;
		if (!result) {
			this.loading = false;
			this.error = true;
			if (selection.ambiguous) {
				var names = _.map(selection.candidates.slice(0, 4), function (candidate) {
					return this.artist_candidate_description(candidate.item);
				}, this);
				this.status = 'Multiple exact MusicBrainz artist matches were found for "' + request.context.artist + '". No automatic choice was cached. Set the artist MBID manually from the context menu.\r\n\r\n' + names.join('\r\n');
			} else {
				this.status = 'No exact MusicBrainz artist match was found for "' + request.context.artist + '". Add a MUSICBRAINZ_ARTISTID tag or set the MBID manually from the context menu.';
			}
			window.Repaint();
			return;
		}

		this.mb_id = result.id.toLowerCase();
		this.resolution = {
			mbid : this.mb_id,
			name : result.name || this.artist,
			disambiguation : result.disambiguation || '',
			source : 'automatic'
		};
		this.set_cached_artist(this.artist, this.mb_id, result, 'automatic');
		console.log(N, 'Resolved "' + this.artist + '" to MusicBrainz artist ' + this.mb_id + (result.disambiguation ? ' (' + result.disambiguation + ')' : '') + '.');
		this.start_mode_load(false);
	}

	this.cache_period = function () {
		var days = Number(this.properties.cache_days.value);
		return days > 0 ? days * ONE_DAY : 0;
	}

	this.cache_is_expired = function (filename) {
		var period = this.cache_period();
		return period > 0 && _fileExpired(filename, period);
	}

	this.release_filename = function () {
		return _artistFolder(this.artist) + 'musicbrainz.releases.' + this.mb_id + '.json';
	}

	this.links_filename = function () {
		return _artistFolder(this.artist) + 'musicbrainz.links.' + this.mb_id + '.json';
	}

	this.start_mode_load = function (force) {
		if (!_isUUID(this.mb_id)) {
			this.loading = false;
			this.error = true;
			this.status = 'A valid MusicBrainz artist ID is required.';
			window.Repaint();
			return;
		}

		if (this.properties.mode.value == 0) {
			this.load_releases(force);
		} else {
			this.load_links(force);
		}
	}

	this.read_release_cache = function (filename) {
		var data = _jsonParseFile(filename);
		if (Array.isArray(data))
			return data;
		if (data && Array.isArray(data.items))
			return data.items;
		return [];
	}

	this.load_releases = function (force) {
		this.filename = this.release_filename();
		var has_file = utils.IsFile(this.filename);
		var cached = has_file ? this.read_release_cache(this.filename) : [];

		if (cached.length) {
			this.mb_data = cached;
			this.build_release_data();
		}

		if (force || !has_file || !cached.length || this.cache_is_expired(this.filename)) {
			this.mb_data = [];
			this.mb_offset = 0;
			this.loading = true;
			this.error = false;
			this.status = 'Loading MusicBrainz release groups for ' + this.artist + '...';
			this.fetch_release_page();
		} else {
			this.loading = false;
			this.status = '';
		}
		window.Repaint();
	}

	this.fetch_release_page = function () {
		var url = 'https://musicbrainz.org/ws/2/release-group?fmt=json&limit=100&offset=' + this.mb_offset + '&artist=' + this.mb_id;
		this.queue_request('release-page', url, {offset : this.mb_offset});
	}

	this.handle_release_page = function (data, request) {
		var groups = data['release-groups'] || [];
		Array.prototype.push.apply(this.mb_data, groups);

		var total = Math.max(0, Number(data['release-group-count'] || 0));
		var limit = Math.max(100, Number(this.properties.release_limit.value || 500));
		var wanted = Math.min(total, limit);
		var next_offset = request.context.offset + groups.length;

		if (groups.length && next_offset < wanted) {
			this.mb_offset = next_offset;
			this.status = 'Loading MusicBrainz release groups... ' + Math.min(next_offset, wanted) + ' of ' + wanted;
			this.fetch_release_page();
			window.Repaint();
			return;
		}

		this.mb_data = this.mb_data.slice(0, wanted);

		var payload = {
			version : 2,
			artist : this.artist,
			mbid : this.mb_id,
			fetched : Date.now(),
			limit : limit,
			total : total,
			items : this.mb_data
		};
		_save(this.filename, JSON.stringify(payload));
		this.loading = false;
		this.error = false;
		this.status = this.mb_data.length ? '' : 'No release groups were returned for this artist.';
		this.build_release_data();
		window.Repaint();
	}

	this.load_links = function (force) {
		this.filename = this.links_filename();
		var has_file = utils.IsFile(this.filename);
		var cached = has_file ? _jsonParseFile(this.filename) : {};

		if (cached && !Array.isArray(cached) && cached.id) {
			this.mb_links_data = cached;
			this.build_links_data();
		}

		if (force || !has_file || !cached || !cached.id || this.cache_is_expired(this.filename)) {
			this.loading = true;
			this.error = false;
			this.status = 'Loading MusicBrainz links for ' + this.artist + '...';
			var url = 'https://musicbrainz.org/ws/2/artist/' + this.mb_id + '?fmt=json&inc=url-rels';
			this.queue_request('artist-links', url, {});
		} else {
			this.loading = false;
			this.status = '';
		}
		window.Repaint();
	}

	this.handle_artist_links = function (data) {
		this.mb_links_data = data;
		_save(this.filename, JSON.stringify(data));
		this.loading = false;
		this.error = false;
		this.status = '';
		this.build_links_data();
		window.Repaint();
	}

	this.release_group_label = function (item) {
		var primary = item['primary-type'] || item.primary || 'Unspecified type';
		var secondary = item['secondary-types'] || [];
		secondary = secondary.slice().sort();
		return secondary.length ? primary + ' + ' + secondary.join(' + ') : primary;
	}

	this.release_sort_value = function (item) {
		var date = String(item['first-release-date'] || '');
		return date || '0000-00-00';
	}

	this.build_release_data = function () {
		var groups = {};
		var self = this;

		_.forEach(this.mb_data || [], function (item) {
			if (!item || !item.id || !item.title)
				return;

			var group_name = self.release_group_label(item);
			if (!groups[group_name])
				groups[group_name] = [];

			var title = item.title;
			if (item.disambiguation)
				title += ' [' + item.disambiguation + ']';

			groups[group_name].push({
				name : title,
				width : title.calc_width2(panel.fonts.normal),
				url : 'https://musicbrainz.org/release-group/' + item.id,
				date : String(item['first-release-date'] || '').substring(0, 4),
				full_date : String(item['first-release-date'] || ''),
				id : item.id
			});
		});

		var primary_order = ['Album', 'EP', 'Single', 'Broadcast', 'Other', 'Unspecified type'];
		var group_names = Object.keys(groups).sort(function (a, b) {
			var ap = primary_order.indexOf(a.split(' + ')[0]);
			var bp = primary_order.indexOf(b.split(' + ')[0]);
			if (ap < 0) ap = 999;
			if (bp < 0) bp = 999;
			return ap == bp ? a.localeCompare(b) : ap - bp;
		});

		this.data = [];
		_.forEach(group_names, function (group_name) {
			var items = groups[group_name];
			if (self.properties.sort_mode.value == 0) {
				items.sort(function (a, b) {
					return b.full_date.localeCompare(a.full_date) || a.name.localeCompare(b.name);
				});
			} else if (self.properties.sort_mode.value == 1) {
				items.sort(function (a, b) {
					return a.full_date.localeCompare(b.full_date) || a.name.localeCompare(b.name);
				});
			} else {
				items.sort(function (a, b) {
					return a.name.localeCompare(b.name) || b.full_date.localeCompare(a.full_date);
				});
			}

			self.data.push({name : group_name, width : 0, url : 'SECTION_HEADER', date : ''});
			Array.prototype.push.apply(self.data, items);
			self.data.push({name : '', width : 0, url : '', date : ''});
		});

		if (this.data.length)
			this.data.pop();

		this.finish_data_build();
	}

	this.url_domain = function (url) {
		return String(url || '')
			.replace(/^https?:\/\//i, '')
			.replace(/^www\./i, '')
			.split('/')[0];
	}

	this.link_label = function (item, url) {
		if (this.properties.full_urls.enabled)
			return url;

		var type = String(item.type || 'External link');
		var domain = this.url_domain(url);
		return type + (domain ? ' — ' + domain : '');
	}

	this.build_links_data = function () {
		var artist_url = 'https://musicbrainz.org/artist/' + this.mb_id;
		var seen = {};
		var data = [{
			name : this.properties.full_urls.enabled ? artist_url : 'MusicBrainz artist page — musicbrainz.org',
			url : artist_url,
			width : 0,
			type : 'MusicBrainz artist page'
		}];

		_.forEach(_.get(this.mb_links_data, 'relations', []), function (item) {
			var url = item && item.url ? this.safe_decode(item.url.resource) : '';
			if (!url || seen[url])
				return;

			seen[url] = true;
			data.push({
				name : this.link_label(item, url),
				url : url,
				width : 0,
				type : item.type || 'External link'
			});
		}, this);

		data.sort(function (a, b) {
			if (a.url == artist_url) return -1;
			if (b.url == artist_url) return 1;
			return a.type.localeCompare(b.type) || a.url.localeCompare(b.url);
		});

		_.forEach(data, function (item) {
			item.width = item.name.calc_width2(panel.fonts.normal);
		});

		this.data = data;
		this.finish_data_build();
	}

	this.scroll_key = function () {
		return this.mb_id + ':' + this.properties.mode.value;
	}

	this.load_scroll_state = function () {
		var parsed = _jsonParse(this.properties.scroll_state.value);
		return parsed && !Array.isArray(parsed) && typeof parsed == 'object' ? parsed : {};
	}

	this.save_scroll = function () {
		if (!this.properties.remember_scroll.enabled || !_isUUID(this.mb_id))
			return;

		this.scroll_state[this.scroll_key()] = {
			offset : this.offset,
			url : this.data[this.offset] && this.data[this.offset].url ? this.data[this.offset].url : ''
		};
		this.properties.scroll_state.value = JSON.stringify(this.scroll_state);
	}

	this.restore_scroll = function () {
		this.offset = 0;
		if (!this.properties.remember_scroll.enabled || !_isUUID(this.mb_id))
			return;

		var state = this.scroll_state[this.scroll_key()];
		if (!state)
			return;

		if (state.url) {
			var idx = _.findIndex(this.data, function (item) {
				return item.url == state.url;
			});
			if (idx >= 0)
				this.offset = idx;
			else
				this.offset = Number(state.offset || 0);
		} else {
			this.offset = Number(state.offset || 0);
		}

		this.clamp_offset();
	}

	this.finish_data_build = function () {
		this.count = this.data.length;
		this.spacer_w = '0000'.calc_width2(panel.fonts.normal);
		this.index = 0;
		this.restore_scroll();
		this.size();
		window.Repaint();
	}

	this.rebuild_display_data = function () {
		if (this.properties.mode.value == 0 && this.mb_data.length) {
			this.build_release_data();
		} else if (this.properties.mode.value == 1 && this.mb_links_data && this.mb_links_data.id) {
			this.build_links_data();
		}
	}

	this.header_text = function () {
		var mode = this.properties.mode.value == 0 ? 'Releases' : 'Links';
		var suffix = this.resolution && this.resolution.disambiguation ? ' (' + this.resolution.disambiguation + ')' : '';
		return (this.artist || 'MusicBrainz') + suffix + ': ' + mode;
	}

	this.current_track_identity = function () {
		if (!panel.metadb) return { artist : '', tagged_id : '', cached : null, mbid : '' };
		var artist = this.get_artist_name();
		var tagged_id = this.get_tagged_mbid();
		var cached = tagged_id ? null : this.get_cached_artist(artist);
		return {
			artist : artist,
			tagged_id : tagged_id,
			cached : cached,
			mbid : tagged_id || (cached ? cached.mbid : '')
		};
	}

	this.metadb_changed = function () {
		if (!panel.metadb) {
			this.generation++;
			this.cancel_requests();
			this.artist = '';
			this.mb_id = '';
			this.resolution = null;
			this.filename = '';
			this.data = [];
			this.mb_data = [];
			this.mb_links_data = {};
			this.count = 0;
			this.loading = false;
			this.error = false;
			this.status = 'No track is selected.';
			window.Repaint();
			return;
		}

		var identity = this.current_track_identity();
		var temp_artist = identity.artist;
		var tagged_id = identity.tagged_id;
		var cached = identity.cached;
		var temp_id = identity.mbid;

		if (this.artist == temp_artist && this.mb_id == temp_id && this.current_source == this.properties.artist_source.value)
			return;

		this.save_scroll();
		this.generation++;
		this.cancel_requests();
		this.artist = temp_artist;
		this.mb_id = temp_id;
		this.current_source = this.properties.artist_source.value;
		this.resolution = tagged_id ? {mbid : tagged_id, name : temp_artist, source : 'tag'} : cached;
		this.filename = '';
		this.data = [];
		this.mb_data = [];
		this.mb_links_data = {};
		this.count = 0;
		this.offset = 0;
		this.index = 0;
		this.loading = false;
		this.error = false;

		if (!this.artist) {
			this.status = 'No artist is available for the selected track.';
			window.Repaint();
			return;
		}

		if (_isUUID(this.mb_id)) {
			this.start_mode_load(false);
		} else if (this.properties.auto_resolve.enabled) {
			this.start_artist_search(false);
		} else {
			this.status = 'No MusicBrainz artist ID was found. Add a MUSICBRAINZ_ARTISTID tag, enable automatic resolution, or set the MBID manually.';
			this.error = true;
			window.Repaint();
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
		case VK_HOME:
			this.offset = 0;
			this.save_scroll();
			window.Repaint();
			return true;
		case VK_END:
			this.offset = Math.max(0, this.count - this.rows);
			this.save_scroll();
			window.Repaint();
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
			if (item && typeof item.url == 'string' && item.url && item.url != 'SECTION_HEADER') {
				if (x > this.x + this.clickable_text_x && x < this.x + this.clickable_text_x + Math.min(item.width, this.text_width))
					utils.Run(item.url);
			}
			break;
		}

		return true;
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
			if (item && item.url && item.url != 'SECTION_HEADER' && x > this.x + this.clickable_text_x && x < this.x + this.clickable_text_x + Math.min(item.width, this.text_width)) {
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
		if (this.count == 0) {
			this.draw_status(gr);
			return;
		}

		if (this.properties.mode.value == 0) {
			this.text_width = Math.max(0, this.w - this.spacer_w - _scale(10));
			this.clickable_text_x = 0;

			for (var i = 0; i < Math.min(this.count - this.offset, this.rows); i++) {
				var item = this.data[i + this.offset];
				var row_y = this.y + _scale(12) + (i * panel.row_height);
				if (item.url == 'SECTION_HEADER') {
					this.draw_row(gr, item.name, panel.colours.highlight, this.x, row_y, this.text_width, panel.row_height, DWRITE_TEXT_ALIGNMENT_LEADING, panel.fonts.title);
				} else {
					this.draw_row(gr, item.name, panel.colours.text, this.x, row_y, this.text_width, panel.row_height);
					this.draw_row(gr, item.date, panel.colours.highlight, this.x, row_y, this.w, panel.row_height, DWRITE_TEXT_ALIGNMENT_TRAILING);
				}
			}
		} else {
			this.clickable_text_x = 0;
			this.text_width = this.w;

			for (var j = 0; j < Math.min(this.count - this.offset, this.rows); j++) {
				var link = this.data[j + this.offset];
				this.draw_row(gr, link.name, panel.colours.text, this.x, this.y + _scale(12) + (j * panel.row_height), this.text_width, panel.row_height);
			}
		}

		this.up_btn.paint(gr, panel.colours.text);
		this.down_btn.paint(gr, panel.colours.text);
	}

	this.delete_cache = function () {
		if (this.filename && utils.IsFile(this.filename))
			utils.RemovePath(this.filename);
	}

	this.refresh = function () {
		if (!this.artist)
			return;

		this.generation++;
		this.cancel_requests();
		this.data = [];
		this.count = 0;
		this.error = false;

		if (_isUUID(this.mb_id)) {
			this.start_mode_load(true);
		} else {
			this.start_artist_search(true);
		}
	}

	this.set_mode = function (value, force) {
		var next_mode = Number(value) == 1 ? 1 : 0;
		var changed = Number(this.properties.mode.value) != next_mode;
		var identity = this.current_track_identity();
		var identity_current = panel.metadb &&
			this.artist == identity.artist &&
			this.mb_id == identity.mbid &&
			this.current_source == this.properties.artist_source.value;

		if (changed) this.save_scroll();
		this.properties.mode.value = next_mode;

		// Album Notes can keep this object hidden while the focused track changes.
		// Synchronise identity before using any cached rows for the requested mode.
		if (!identity_current) {
			this.metadb_changed();
			return;
		}

		if (!changed && !force) {
			this.rebuild_display_data();
			this.size();
			window.Repaint();
			return;
		}

		this.generation++;
		this.cancel_requests();
		this.filename = '';
		this.data = [];
		this.count = 0;
		this.offset = 0;
		this.index = 0;
		this.loading = false;
		this.error = false;
		this.status = '';

		if (_isUUID(this.mb_id)) {
			this.start_mode_load(!!force);
		} else if (this.properties.auto_resolve.enabled) {
			this.start_artist_search(!!force);
		} else {
			this.status = 'No MusicBrainz artist ID was found. Add a MUSICBRAINZ_ARTISTID tag, enable automatic resolution, or set the MBID manually.';
			this.error = true;
			window.Repaint();
		}
	}

	this.set_manual_mbid = function () {
		var value = utils.InputBox('Enter the MusicBrainz artist MBID for:\n\n' + this.artist, window.Name, this.mb_id || '');
		value = String(value || '').replace(/^\s+|\s+$/g, '').toLowerCase();
		if (!_isUUID(value)) {
			utils.MessageBox('That value is not a valid MusicBrainz artist MBID.', window.Name, 0);
			return;
		}

		this.set_cached_artist(this.artist, value, {name : this.artist, score : 100}, 'manual');
		this.mb_id = value;
		this.resolution = {mbid : value, name : this.artist, source : 'manual'};
		this.refresh();
	}

	this.rbtn_up = function (x, y) {
		panel.m.AppendMenuItem(MF_STRING, 1200, 'Releases');
		panel.m.AppendMenuItem(MF_STRING, 1201, 'Links');
		panel.m.CheckMenuRadioItem(1200, 1201, this.properties.mode.value + 1200);
		panel.m.AppendMenuSeparator();

		panel.s10.AppendMenuItem(MF_STRING, 1210, 'Track artist');
		panel.s10.AppendMenuItem(MF_STRING, 1211, 'Album artist');
		panel.s10.CheckMenuRadioItem(1210, 1211, this.properties.artist_source.value + 1210);
		panel.s10.AppendMenuSeparator();
		panel.s10.AppendMenuItem(CheckMenuIf(this.properties.auto_resolve.enabled), 1212, 'Automatically resolve missing artist IDs');
		panel.s10.AppendMenuItem(EnableMenuIf(!!this.artist), 1213, 'Resolve current artist now');
		panel.s10.AppendMenuItem(EnableMenuIf(!!this.artist), 1214, 'Set artist MBID manually...');
		panel.s10.AppendMenuItem(EnableMenuIf(!!this.get_cached_artist(this.artist)), 1215, 'Clear cached artist match');
		panel.s10.AppendMenuSeparator();
		panel.s10.AppendMenuItem(EnableMenuIf(_isUUID(this.mb_id)), 1216, 'Copy artist MBID');
		panel.s10.AppendMenuItem(EnableMenuIf(_isUUID(this.mb_id)), 1217, 'Open artist on MusicBrainz');
		panel.s10.AppendTo(panel.m, MF_STRING, 'Artist identity');

		panel.s11.AppendMenuItem(MF_STRING, 1231, '1 day');
		panel.s11.AppendMenuItem(MF_STRING, 1237, '7 days');
		panel.s11.AppendMenuItem(MF_STRING, 1260, '30 days');
		panel.s11.AppendMenuItem(MF_STRING, 1230, 'Manual refresh only');
		var cache_id = this.properties.cache_days.value == 1 ? 1231 : this.properties.cache_days.value == 7 ? 1237 : this.properties.cache_days.value == 30 ? 1260 : 1230;
		panel.s11.CheckMenuRadioItem(1230, 1260, cache_id);
		panel.s11.AppendTo(panel.m, MF_STRING, 'Cache refresh');

		if (this.properties.mode.value == 0) {
			panel.s12.AppendMenuItem(MF_STRING, 1301, '100 release groups');
			panel.s12.AppendMenuItem(MF_STRING, 1302, '250 release groups');
			panel.s12.AppendMenuItem(MF_STRING, 1303, '500 release groups');
			panel.s12.AppendMenuItem(MF_STRING, 1304, '1000 release groups');
			var limit_id = this.properties.release_limit.value == 100 ? 1301 : this.properties.release_limit.value == 250 ? 1302 : this.properties.release_limit.value == 1000 ? 1304 : 1303;
			panel.s12.CheckMenuRadioItem(1301, 1304, limit_id);
			panel.s12.AppendTo(panel.m, MF_STRING, 'Release limit');

			panel.s13.AppendMenuItem(MF_STRING, 1310, 'Newest first');
			panel.s13.AppendMenuItem(MF_STRING, 1311, 'Oldest first');
			panel.s13.AppendMenuItem(MF_STRING, 1312, 'Title A-Z');
			panel.s13.CheckMenuRadioItem(1310, 1312, this.properties.sort_mode.value + 1310);
			panel.s13.AppendTo(panel.m, MF_STRING, 'Release sorting');
		} else {
			panel.m.AppendMenuItem(CheckMenuIf(this.properties.full_urls.enabled), 1320, 'Show full link URLs');
		}

		panel.m.AppendMenuItem(CheckMenuIf(this.properties.remember_scroll.enabled), 1330, 'Remember scroll position');
		panel.m.AppendMenuSeparator();

		if (!this.managed) {
			panel.s14.AppendMenuItem(MF_STRING, 1410, 'JSP3 Enhanced Samples application (recommended)');
			panel.s14.AppendMenuItem(MF_STRING, 1411, 'Google Chrome 150-style (experimental)');
			panel.s14.CheckMenuRadioItem(1410, 1411, this.get_header_profile() == 'chrome' ? 1411 : 1410);
			panel.s14.AppendTo(panel.m, MF_STRING, 'Request identity');
			panel.m.AppendMenuSeparator();
		}

		panel.m.AppendMenuItem(EnableMenuIf(!!this.artist), 1400, 'Refresh MusicBrainz data');
		panel.m.AppendMenuItem(EnableMenuIf(utils.IsFile(this.filename)), 1401, 'Delete current cache');
		panel.m.AppendMenuItem(EnableMenuIf(utils.IsFile(this.filename)), 1402, 'Open containing folder');
		panel.m.AppendMenuItem(MF_STRING, 1403, 'Set MusicBrainz contact URL/email...');
		panel.m.AppendMenuSeparator();
	}

	this.rbtn_up_done = function (idx) {
		switch (idx) {
		case 1200:
		case 1201:
			this.save_scroll();
			this.properties.mode.value = idx - 1200;
			this.data = [];
			this.count = 0;
			this.start_mode_load(false);
			break;
		case 1210:
		case 1211:
			this.properties.artist_source.value = idx - 1210;
			this.artist = '';
			this.mb_id = '';
			this.metadb_changed();
			break;
		case 1212:
			this.properties.auto_resolve.toggle();
			if (this.properties.auto_resolve.enabled && !_isUUID(this.mb_id))
				this.start_artist_search(false);
			else
				window.Repaint();
			break;
		case 1213:
			this.clear_cached_artist();
			this.mb_id = '';
			this.start_artist_search(true);
			break;
		case 1214:
			this.set_manual_mbid();
			break;
		case 1215:
			this.clear_cached_artist();
			this.artist = '';
			this.mb_id = '';
			this.current_source = -1;
			this.metadb_changed();
			break;
		case 1216:
			utils.SetClipboardText(this.mb_id);
			break;
		case 1217:
			utils.Run('https://musicbrainz.org/artist/' + this.mb_id);
			break;
		case 1230:
			this.properties.cache_days.value = 0;
			break;
		case 1231:
			this.properties.cache_days.value = 1;
			break;
		case 1237:
			this.properties.cache_days.value = 7;
			break;
		case 1260:
			this.properties.cache_days.value = 30;
			break;
		case 1301:
		case 1302:
		case 1303:
		case 1304:
			this.properties.release_limit.value = [100, 250, 500, 1000][idx - 1301];
			this.refresh();
			break;
		case 1310:
		case 1311:
		case 1312:
			this.properties.sort_mode.value = idx - 1310;
			this.build_release_data();
			break;
		case 1320:
			this.properties.full_urls.toggle();
			this.build_links_data();
			break;
		case 1330:
			this.properties.remember_scroll.toggle();
			if (!this.properties.remember_scroll.enabled) {
				this.offset = 0;
				window.Repaint();
			}
			break;
		case 1400:
			this.refresh();
			break;
		case 1401:
			this.delete_cache();
			this.data = [];
			this.count = 0;
			this.status = 'Cache deleted. Choose Refresh MusicBrainz data to download it again.';
			window.Repaint();
			break;
		case 1402:
			_explorer(this.filename);
			break;
		case 1403:
			var contact = utils.InputBox('MusicBrainz requests should identify the application and provide a maintainer contact URL or email.\n\nEnter the contact portion to append to the JSP3 Enhanced Samples User-Agent. This contact is used only with the recommended JSP3 Enhanced Samples application identity:', window.Name, this.properties.contact.value);
			this.properties.contact.value = String(contact || '').replace(/^\s+|\s+$/g, '');
			break;
		case 1410:
			this.set_header_profile('application');
			break;
		case 1411:
			this.set_header_profile('chrome');
			break;
		}
	}

	this.clamp_offset = function () {
		var max_offset = Math.max(0, this.count - this.rows);
		this.offset = Math.max(0, Math.min(Number(this.offset || 0), max_offset));
	}

	this.size = function () {
		this.rows = Math.max(1, Math.floor((this.h - _scale(24)) / panel.row_height));
		this.clamp_offset();
		this.index = this.offset;
		this.up_btn.x = this.x + Math.round((this.w - _scale(12)) * 0.5);
		this.down_btn.x = this.up_btn.x;
		this.up_btn.y = this.y;
		this.down_btn.y = this.y + this.h - _scale(12);
	}

	this.wheel = function (s) {
		if (!this.containsXY(this.mx, this.my))
			return false;

		if (this.count > this.rows) {
			var offset = this.offset - (s * 3);
			var max_offset = this.count - this.rows;
			offset = Math.max(0, Math.min(offset, max_offset));

			if (this.offset != offset) {
				this.offset = offset;
				this.save_scroll();
				window.RepaintRect(this.x, this.y, this.w, this.h);
			}
		}

		return true;
	}

	this.notify_data = function (name, info) {
		return typeof DarkOneNetwork != 'undefined' ? DarkOneNetwork.onNotify(name, info) : false;
	}

	this.dispose = function () {
		this.disposed = true;
		this.save_scroll();
		this.cancel_requests();
	}

	utils.CreateFolder(folders.data);
	utils.CreateFolder(folders.artists);
	panel.list_objects.push(this);

	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;
	this.mx = 0;
	this.my = 0;
	this.index = 0;
	this.offset = 0;
	this.rows = 1;
	this.count = 0;
	this.data = [];
	this.mb_data = [];
	this.mb_links_data = {};
	this.clickable_text_x = 0;
	this.spacer_w = 0;
	this.text_width = 0;
	this.in_range = false;

	this.artist = '';
	this.mb_id = '';
	this.current_source = -1;
	this.resolution = null;
	this.filename = '';
	this.status = 'Select a track to load MusicBrainz data.';
	this.error = false;
	this.loading = false;
	this.disposed = false;
	this.generation = 0;

	this.requests = {};
	this.request_queue = [];
	this.request_inflight = 0;
	this.request_timer = 0;
	this.request_watchdogs = {};
	this.request_timeout_ms = 15000;
	this.last_request_at = 0;
	this.request_interval = 1100;
	this.mb_offset = 0;

	this.artist_map_file = folders.data + 'musicbrainz.artist-map.json';
	this.artist_map = this.load_artist_map();

	var current_mode = window.GetProperty('DARKONEJSP3.MUSICBRAINZ.MODE', null);
	if (current_mode == null) {
		var legacy_mode = window.GetProperty('2K3.LIST.MUSICBRAINZ.MODE', null);
		if (legacy_mode != null) window.SetProperty('DARKONEJSP3.MUSICBRAINZ.MODE', legacy_mode);
	}

	this.properties = {
		mode : new _p('DARKONEJSP3.MUSICBRAINZ.MODE', 0),
		artist_source : new _p('DARKONEJSP3.MUSICBRAINZ.ARTIST.SOURCE', 0),
		auto_resolve : new _p('DARKONEJSP3.MUSICBRAINZ.AUTO.RESOLVE', true),
		cache_days : new _p('DARKONEJSP3.MUSICBRAINZ.CACHE.DAYS', 7),
		release_limit : new _p('DARKONEJSP3.MUSICBRAINZ.RELEASE.LIMIT', 500),
		sort_mode : new _p('DARKONEJSP3.MUSICBRAINZ.RELEASE.SORT', 0),
		full_urls : new _p('DARKONEJSP3.MUSICBRAINZ.LINKS.FULL.URLS', false),
		remember_scroll : new _p('DARKONEJSP3.MUSICBRAINZ.REMEMBER.SCROLL', true),
		scroll_state : new _p('DARKONEJSP3.MUSICBRAINZ.SCROLL.STATE', '{}'),
		contact : new _p('DARKONEJSP3.MUSICBRAINZ.CONTACT', '')
	};

	this.scroll_state = this.load_scroll_state();
	this.up_btn = new _sb(chars.up, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset > 0; }, this), _.bind(function () { this.wheel(1); }, this));
	this.down_btn = new _sb(chars.down, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset < this.count - this.rows; }, this), _.bind(function () { this.wheel(-1); }, this));
}
// Compatibility callbacks for existing configured panel wrappers.
if (typeof on_notify_data == 'undefined') {
	var on_notify_data = function (name, info) {
		if (typeof musicbrainz != 'undefined' && musicbrainz && typeof musicbrainz.notify_data == 'function') musicbrainz.notify_data(name, info);
	};
}
