function _images(options) {
	options = options || {};
	this.containsXY = function (x, y) {
		return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
	}

	this.draw_blurred_image = function (gr) {
		gr.Clear(RGB(30, 30, 30));
		_drawImage(gr, this.bitmap.blur, 0, 0, panel.w, panel.h, image.crop, this.properties.blur_opacity.value);
	}

	this.log = function (message) {
		console.log(N, '[Last.fm images] ' + String(message || ''));
	}

	this.http_status_name = function (status) {
		switch (Number(status) || 0) {
		case 400: return 'Bad Request';
		case 401: return 'Unauthorized';
		case 403: return 'Forbidden';
		case 404: return 'Not Found';
		case 408: return 'Request Timeout';
		case 425: return 'Too Early';
		case 429: return 'Too Many Requests';
		case 500: return 'Internal Server Error';
		case 501: return 'Not Implemented';
		case 502: return 'Bad Gateway';
		case 503: return 'Service Unavailable';
		case 504: return 'Gateway Timeout';
		default: return '';
		}
	}

	this.header_value = function (response_headers, name) {
		if (!response_headers || !name)
			return '';

		var wanted = String(name).toLowerCase();
		if (typeof response_headers == 'object') {
			for (var object_key in response_headers) {
				if (Object.prototype.hasOwnProperty.call(response_headers, object_key) && String(object_key).toLowerCase() == wanted)
					return String(response_headers[object_key] || '');
			}
		}

		var raw = String(response_headers || '');
		try {
			var parsed = JSON.parse(raw);
			if (parsed && typeof parsed == 'object') {
				for (var json_key in parsed) {
					if (Object.prototype.hasOwnProperty.call(parsed, json_key) && String(json_key).toLowerCase() == wanted)
						return String(parsed[json_key] || '');
				}
			}
		} catch (e) {}

		var escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		var match = new RegExp('(?:^|\\r?\\n)\\s*' + escaped + '\\s*:\\s*([^\\r\\n]+)', 'i').exec(raw);
		return match ? String(match[1] || '').replace(/^\s+|\s+$/g, '') : '';
	}

	this.clean_diagnostic_value = function (value, limit) {
		var text = String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, '');
		limit = Number(limit) || 120;
		return text.length > limit ? text.substring(0, limit) + '...' : text;
	}

	this.response_preview = function (response_text, status) {
		var text = String(response_text || '');
		if (!text.length)
			return '';

		text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/ig, ' ')
			.replace(/<style\b[^>]*>[\s\S]*?<\/style>/ig, ' ')
			.replace(/<[^>]+>/g, ' ')
			.replace(/&nbsp;/ig, ' ')
			.replace(/&amp;/ig, '&')
			.replace(/&lt;/ig, '<')
			.replace(/&gt;/ig, '>')
			.replace(/&quot;/ig, '"')
			.replace(/&#(?:39|x27);/ig, "'");
		text = this.clean_diagnostic_value(text, this.response_preview_limit);

		var status_text = String(Number(status) || '');
		if (status_text.length && text.indexOf(status_text + ' ' + status_text + ' ') == 0)
			text = text.substring(status_text.length + 1);
		return text;
	}

	this.is_transient_http_failure = function (success, status) {
		status = Number(status) || 0;
		if (!success && status < 400)
			return true;
		return status == 0 || status == 408 || status == 425 || status == 429 || (status >= 500 && status < 600);
	}

	this.retry_after_ms = function (response_headers) {
		var value = this.header_value(response_headers, 'Retry-After');
		if (!value.length)
			return 0;

		var seconds = Number(value);
		if (!isNaN(seconds))
			return Math.max(0, seconds * 1000);

		var date_value = Date.parse(value);
		return isNaN(date_value) ? 0 : Math.max(0, date_value - Date.now());
	}

	this.log_http_failure = function (artist, success, status, response_text, response_headers, will_retry) {
		status = Number(status) || 0;
		var body_length = String(response_text || '').length;
		var reason = status
			? 'HTTP ' + status + (this.http_status_name(status).length ? ' ' + this.http_status_name(status) : '')
			: 'transport failure';
		var details = [];
		if (body_length)
			details.push(body_length + '-character response');

		var diagnostic_headers = [
			['Content-Type', 'Content-Type'],
			['Retry-After', 'Retry-After'],
			['X-Lfm-Upstream-Type', 'X-Lfm-Upstream-Type'],
			['X-Cache', 'X-Cache'],
			['Fastly-Restarts', 'Fastly-Restarts'],
		];
		for (var i = 0; i < diagnostic_headers.length; i++) {
			var value = this.clean_diagnostic_value(this.header_value(response_headers, diagnostic_headers[i][0]), 120);
			if (value.length)
				details.push(diagnostic_headers[i][1] + ': ' + value);
		}

		var message = 'Request for "' + artist + '" failed: ' + reason;
		if (!status && body_length)
			message += ': ' + this.clean_diagnostic_value(response_text, this.response_preview_limit);
		if (details.length)
			message += ' (' + details.join('; ') + ')';
		message += '.' + (will_retry ? ' Another automatic attempt will follow.' : '');
		this.log(message);

		if (status) {
			var preview = this.response_preview(response_text, status);
			if (preview.length)
				this.log('Response preview: "' + preview + '".');
		}
	}

	this.artist_state = function (artist) {
		artist = String(artist || '');
		if (!this.history[artist]) {
			this.history_size++;
			this.history[artist] = {
				attempts : 0,
				last_attempt : 0,
				pending : false,
				pending_files : 0,
				succeeded : 0,
				failed : 0,
				phase : 'idle',
				unavailable : false,
				last_error : '',
				last_http_status : 0,
				retryable : true,
				retry_after_until : 0,
			};
		}
		var state = this.history[artist];
		state.last_used = ++this.history_clock;
		if (this.history_size > this.history_limit) {
			var keys = Object.keys(this.history);
			var oldest = null;
			for (var i = 0; i < keys.length; i++) {
				var key = keys[i];
				if (key != artist && key != this.artist && !this.history[key].pending &&
						(oldest === null || this.history[key].last_used < this.history[oldest].last_used))
					oldest = key;
			}
			if (oldest !== null) {
				delete this.history[oldest];
				this.history_size--;
			}
		}
		return state;
	}

	// Use the existing one-second interval: deadlines also advance while hidden.
	this.check_download_deadlines = function () {
		var now = Date.now();
		var changed = false;
		for (var artist in this.history) {
			var state = this.history[artist];
			if (!state.pending || !state.deadline || now < state.deadline) continue;
			for (var id in this.artists) {
				if (this.artists[id] != artist) continue;
				delete this.artists[id];
				delete this.automatic_tasks[id];
			}
			for (var path in this.download_tasks) {
				if (this.download_tasks[path].artist == artist)
					this.download_tasks[path].timed_out = true;
			}
			state.pending = false;
			state.pending_files = 0;
			state.deadline = 0;
			state.last_error = 'download-timeout';
			state.retryable = true;
			state.retry_after_until = now + this.auto_download_retry_ms;
			state.phase = state.attempts > 0 && state.attempts < this.auto_download_attempt_limit ? 'retrying' : 'error';
			this.log('Download timed out for "' + artist + '"; late callbacks will not complete a newer request.');
			changed = true;
		}
		if (changed) this.notify_status_changed();
	}

	this.current_state = function () {
		return this.artist_state(this.artist);
	}

	this.notify_status_changed = function () {
		if (typeof options.status_changed == 'function')
			options.status_changed();
		else
			window.Repaint();
	}

	this.status_text = function () {
		if (this.bitmap.normal || this.image_paths.length)
			return '';
		if (!_tagged(this.artist))
			return 'No artist selected';

		var state = this.current_state();
		if (state.pending)
			return 'Downloading images...';
        if (state.last_error == 'browser-verification') return 'Last.fm browser verification required';
		if (state.phase == 'retrying')
			return state.last_error == 'no-images'
				? 'No images found - retrying...'
				: state.last_error == 'unreadable-page'
					? 'Last.fm page could not be read - retrying...'
					: state.last_error == 'http-transient'
						? 'Last.fm is temporarily unavailable - retrying...'
					: 'Image download failed - retrying...';
		if (state.unavailable)
			return 'No images available';
		if (state.phase == 'error')
			return state.last_error == 'unreadable-page'
				? 'Last.fm page could not be read'
				: state.last_error == 'http-transient'
					? 'Last.fm is temporarily unavailable'
					: state.last_error == 'http-error'
						? 'Last.fm request failed'
				: 'Image download failed';
		return 'No images downloaded';
	}

	this.extract_image_urls = function (response_text) {
		var html = String(response_text || '');
		var urls = [];
		var seen = {};
		var dom_count = 0;
		var raw_count = 0;
		var parse_error = '';

		function add_url(value, raw) {
			var url = String(value || '').replace(/&amp;/g, '&').replace(/^\s+|\s+$/g, '');
			if (url.indexOf('//') == 0)
				url = 'https:' + url;
			if (!url.length || seen[url])
				return;
			if (url.indexOf('lastfm-img') == -1 && url.indexOf('/i/u/avatar') == -1)
				return;
			seen[url] = true;
			urls.push(url);
			if (raw)
				raw_count++;
			else
				dom_count++;
		}

		var elements = [];
		try {
			elements = _getElementsByTagName(html, 'li');
			for (var i = 0; i < elements.length; i++) {
				if (!elements[i] || !/(^|\s)image-list-item-wrapper(\s|$)/.test(String(elements[i].className || '')))
					continue;
				var img = _firstElement(elements[i], 'img');
				if (img)
					add_url(img.src || img.getAttribute && (img.getAttribute('src') || img.getAttribute('data-src')), false);
			}
		} catch (e) {
			parse_error = String(e.message || e);
		}

		var gallery_match = /<ul\b[^>]*class\s*=\s*["'][^"']*\bimage-list\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i.exec(html);
		var gallery_html = gallery_match ? gallery_match[1] : '';
		var linked_image_re = /<a\b[^>]*href\s*=\s*["'][^"']*\/\+images\/[^"']+["'][^>]*>[\s\S]*?<img\b[^>]*(?:src|data-src)\s*=\s*["']([^"']+)["']/ig;
		var linked_match;
		while ((linked_match = linked_image_re.exec(html)) !== null)
			add_url(linked_match[1], true);

		if (gallery_match) {
			var gallery_image_re = /<img\b[^>]*(?:src|data-src)\s*=\s*["']([^"']+)["']/ig;
			var image_match;
			while ((image_match = gallery_image_re.exec(gallery_html)) !== null)
				add_url(image_match[1], true);
		}

		var explicit_empty = /(?:there are no images|no images (?:have been added|are available)|this artist has no images)/i.test(html);
		var gallery_has_items = /\/\+images\/[^"'?#<\s]+/i.test(gallery_html);
		var gallery_has_media = /<(?:img|source)\b/i.test(gallery_html);
		return {
			urls : urls,
			dom_count : dom_count,
			raw_count : raw_count,
			parse_error : parse_error,
			gallery_recognised : !!gallery_match || gallery_has_items,
			confirmed_empty : explicit_empty || (!!gallery_match && !gallery_has_items && !gallery_has_media),
			response_length : html.length,
		};
	}

	this.region_visible = function () {
		if (!this.appearance || !this.appearance.displayed())
			return false;
		if (!this.properties.hide_if_no_images.enabled || this.image_paths.length)
			return true;
		return !this.current_state().unavailable;
	}

	this.download = function (automatic) {
		if (this.disposed || !_tagged(this.artist))
			return false;

		var artist = this.artist;
		var state = this.artist_state(artist);
		if (state.pending) {
			this.log('A request for "' + artist + '" is already in progress.');
			this.notify_status_changed();
			return false;
		}

		// Bound active requests even during rapid track changes/manual requests.
		var pending_count = 0;
		for (var key in this.history) if (this.history[key].pending) pending_count++;
		if (pending_count >= this.request_limit) return false;

		try {
			var url = 'https://www.last.fm/music/' + encodeURIComponent(artist) + '/+images';
			var task_id = utils.HTTPRequestAsync(window.ID, 0, url, DarkOneNetwork.lastfmHtmlHeaders());
			this.artists[task_id] = artist;
			if (automatic)
				this.automatic_tasks[task_id] = artist;
			state.pending = true;
			state.pending_files = 0;
			state.succeeded = 0;
			state.failed = 0;
			state.phase = 'requesting';
			state.deadline = Date.now() + this.request_timeout_ms;
			state.unavailable = false;
			state.last_error = '';
			state.last_http_status = 0;
			state.retryable = true;
			state.retry_after_until = 0;
			state.last_attempt = Date.now();
			if (automatic)
				state.attempts++;
			this.log((automatic ? 'Automatic' : 'Manual') + ' request started for "' + artist + '"' +
				(automatic ? ' (attempt ' + state.attempts + ' of ' + this.auto_download_attempt_limit + ').' : '.'));
			this.notify_status_changed();
			return true;
		} catch (e) {
			state.pending = false;
			state.phase = 'error';
			state.last_error = String(e.message || e);
			this.log('Could not start a request for "' + artist + '": ' + state.last_error);
			this.notify_status_changed();
			return false;
		}
	}

	this.maybe_auto_download = function () {
		if (this.disposed || window.IsVisible === false || !fb.IsPlaying ||
				panel.selection.value != 0 || this.properties.source.value != 1 ||
				!this.properties.auto_download.enabled || !this.wants_artwork() ||
				!_tagged(this.artist) || this.image_paths.length)
			return false;

		var now = Date.now();
		var state = this.artist_state(this.artist);
		if (state.pending || state.attempts >= this.auto_download_attempt_limit ||
				state.retryable === false || now < state.retry_after_until ||
				state.unavailable ||
				now - state.last_attempt < this.auto_download_retry_ms)
			return false;

		if (!this.download(true))
			return false;
		return true;
	}


	// Inspect content, not the URL suffix. GIFs remain static in this bitmap renderer.
	this.image_format = function (bytes) {
		function ascii(start, count) {
			var value = '';
			for (var i = start; i < start + count && i < bytes.length; i++)
				value += String.fromCharCode(bytes[i]);
			return value;
		}
		if (ascii(0, 6) == 'GIF87a' || ascii(0, 6) == 'GIF89a') return 'gif';
		if (bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255) return 'jpg';
		if (bytes[0] == 137 && ascii(1, 3) == 'PNG' &&
			bytes[4] == 13 && bytes[5] == 10 && bytes[6] == 26 && bytes[7] == 10) return 'png';
		if (ascii(0, 4) == 'RIFF' && ascii(8, 4) == 'WEBP') return 'webp';
		if (ascii(0, 2) == 'BM') return 'bmp';
		if (ascii(0, 4) == 'II\x2a\x00' || ascii(0, 4) == 'MM\x00\x2a') return 'tif';
		// Unknown formats are left to the installed image decoder, never guessed.
		return '';
	}

	this.inspect_image_file = function (path, force) {
		var key = path.toLowerCase();
		var cached = this.checked_files[key];
		if (!force && cached !== undefined && (!cached || utils.IsFile(cached))) return cached;
		if (Object.keys(this.checked_files).length >= 1024) this.checked_files = Object.create(null);
		var img = null;
		var stream = null;
		var result = path;
		try {
			img = utils.LoadImage(path);
			if (!img) throw new Error('Image decoder rejected the file');
		} catch (e) {
			this.log('Unreadable image excluded: ' + path + ' (' + String(e.message || e) + ')');
			this.checked_files[key] = '';
			return '';
		} finally {
			if (img) try { img.Dispose(); } catch (e) {}
		}
		try {
			var files = new ActiveXObject('Scripting.FileSystemObject');
			// LoadFromFile buffers the file: bound the allocation before reading.
			if (Number(files.GetFile(path).Size) > 32 * 1024 * 1024)
				throw new Error('File exceeds the 32 MiB signature inspection limit');
			stream = new ActiveXObject('ADODB.Stream');
			stream.Type = 1;
			stream.Open();
			stream.LoadFromFile(path);
			var format = this.image_format(new VBArray(stream.Read(16)).toArray());
			stream.Close();
			stream = null;
			var extension = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
			if (format && extension != format && !(format == 'jpg' && extension == 'jpeg') &&
					!(format == 'tif' && extension == 'tiff')) {
				var target = path.substring(0, path.lastIndexOf('.') + 1) + format;
				if (files.FileExists(target)) {
					this.log('Image extension correction skipped because the destination exists: ' + target);
				} else {
					files.GetFile(path).Move(target);
					result = target;
					this.log('Corrected image extension: ' + path + ' -> ' + target);
				}
			}
		} catch (e) {
			// COM may be unavailable or the cache read-only. Keep the decoded image usable.
			if (!this.signature_warning_logged) {
				this.log('Image extension inspection unavailable; keeping decoded images: ' + String(e.message || e));
				this.signature_warning_logged = true;
			}
		} finally {
			if (stream) try { stream.Close(); } catch (e) {}
		}
		// Bounded session cache avoids file reads during every slideshow refresh.
		if (Object.keys(this.checked_files).length >= 1024) this.checked_files = Object.create(null);
		this.checked_files[key] = result;
		this.checked_files[result.toLowerCase()] = result;
		return result;
	}

	this.existing_image_file = function (path) {
		var base = path.substring(0, path.lastIndexOf('.') + 1);
		for (var i = 0; i < this.exts.length; i++) {
			var candidate = base + this.exts[i];
			if (utils.IsFile(candidate) && this.inspect_image_file(candidate, false)) return true;
		}
		return false;
	}

	this.download_file_done = function (path, success, error_text) {
		if (this.disposed || !path)
			return;

		var lower_path = path.toLowerCase();
		var extension = lower_path.substring(lower_path.lastIndexOf('.') + 1);
		var task = this.download_tasks[lower_path];
		var active_folder_file = this.folder.length &&
			lower_path.indexOf(this.folder.toLowerCase()) == 0 &&
			_.includes(this.exts, extension);
		if (!task && !active_folder_file)
			return;

		if (task)
			delete this.download_tasks[lower_path];

		if (success) {
			var inspected_path = this.inspect_image_file(path, true);
			success = !!inspected_path;
			if (success) path = inspected_path;
			else error_text = 'Downloaded file is not a decodable image: ' + path;
		}

		if (!success) {
			this.log('Image file failed for "' + (task ? task.artist : this.artist) + '": ' +
				String(error_text || path));
		} else {
			this.log('Saved image for "' + (task ? task.artist : this.artist) + '": ' + path);
		}

		if (success && active_folder_file)
			this.update();

		if (!task)
			return;
		if (task.timed_out)
			return; // callback carries a path, not a generation ID

		var state = this.artist_state(task.artist);
		if (success)
			state.succeeded++;
		else
			state.failed++;
		state.pending_files = Math.max(0, state.pending_files - 1);
		if (!state.pending_files)
			this.complete_download(task.artist, state);
	}

	this.complete_download = function (artist, state) {
		state.pending = false;
		state.deadline = 0;
		if (state.succeeded > 0) {
			state.phase = 'available';
			state.unavailable = false;
			state.last_error = '';
			state.last_http_status = 0;
			state.retryable = true;
			state.retry_after_until = 0;
			this.log('Download completed for "' + artist + '": ' + state.succeeded +
				' saved, ' + state.failed + ' failed.');
		} else {
			state.last_error = state.last_error || 'file-download';
			state.phase = state.attempts > 0 && state.attempts < this.auto_download_attempt_limit
				? 'retrying'
				: 'error';
			this.log('Download completed for "' + artist + '" without a saved image' +
				(state.failed ? ' (' + state.failed + ' failed).' : '.'));
		}
		this.notify_status_changed();
	}

	this.http_request_done = function (id, success, response_text, status, response_headers) {
		var artist = this.artists[id];

		if (!artist)
			return; // we didn't request this id

		delete this.artists[id];
		var automatic_artist = this.automatic_tasks[id];
		delete this.automatic_tasks[id];
		var automatic = !!automatic_artist;
		var state = this.artist_state(artist);
		state.deadline = 0;

		if (this.disposed)
			return;

		status = Number(status) || 0;
        if (DarkOneNetwork.isLastfmVerificationPage(response_text)) {
            state.pending = false;
            state.last_error = 'browser-verification';
            state.last_http_status = status;
            state.retryable = false;
            state.retry_after_until = 0;
            state.unavailable = false;
            state.phase = 'error';
            this.log('Last.fm browser verification required for "' + artist + '". Automatic retries stopped; cached images were preserved. Try Request identity > HTML services in the biography menu, then Download now. Changing identity may not resolve verification.');
            this.notify_status_changed();
            return;
        }
		var http_ok = success && (!status || (status >= 200 && status < 300));
		if (!http_ok) {
			var retryable = this.is_transient_http_failure(success, status);
			var will_retry = automatic && retryable && state.attempts < this.auto_download_attempt_limit;
			state.pending = false;
			state.last_error = status ? (retryable ? 'http-transient' : 'http-error') : String(response_text || 'request failed');
			state.last_http_status = status;
			state.retryable = retryable;
			state.retry_after_until = retryable
				? Date.now() + Math.max(this.auto_download_retry_ms, this.retry_after_ms(response_headers))
				: 0;
			state.phase = will_retry
				? 'retrying'
				: 'error';
			this.log_http_failure(artist, success, status, response_text, response_headers, will_retry);
			this.notify_status_changed();
			return;
		}

		var filename_base = _artistFolder(artist) + utils.ReplaceIllegalChars(artist) + '_';
		var extracted = this.extract_image_urls(response_text);
		var candidates = [];
		for (var i = 0; i < extracted.urls.length; i++) {
			var url = extracted.urls[i].replace('avatar170s/', '');
			candidates.push({
				url : url,
				filename : filename_base + url.substring(url.lastIndexOf('/') + 1) + '.jpg',
			});
		}

		if (!candidates.length) {
			state.pending = false;
			if (extracted.confirmed_empty) {
				state.last_error = 'no-images';
				state.last_http_status = 0;
				state.retryable = true;
				state.unavailable = !automatic || state.attempts >= this.auto_download_attempt_limit;
				state.phase = state.unavailable ? 'unavailable' : 'retrying';
				this.log('Last.fm confirmed an empty image gallery for "' + artist + '"' +
					(state.unavailable ? '.' : '; another automatic attempt will follow.'));
			} else {
				state.last_error = 'unreadable-page';
				state.last_http_status = 0;
				state.retryable = true;
				state.unavailable = false;
				state.phase = automatic && state.attempts < this.auto_download_attempt_limit
					? 'retrying'
					: 'error';
				this.log('Last.fm returned an unrecognised image page for "' + artist + '" (' +
					extracted.response_length + ' characters' +
					(extracted.parse_error.length ? '; DOM error: ' + extracted.parse_error : '') + ').' +
					(state.phase == 'retrying' ? ' Another automatic attempt will follow.' : ''));
			}
			this.notify_status_changed();
			return;
		}

		var queued = 0;
		for (var j = 0; j < candidates.length && queued < this.properties.limit.value; j++) {
			var item = candidates[j];
			if (this.existing_image_file(item.filename))
				continue;
			// Keep timed-out paths quarantined until their callback arrives. The
			// native API cannot distinguish two generations writing the same path.
			if (this.download_tasks[item.filename.toLowerCase()] ||
					Object.keys(this.download_tasks).length >= this.download_task_limit)
				continue;
			try {
				this.download_tasks[item.filename.toLowerCase()] = { artist : artist };
				utils.DownloadFileAsync(window.ID, item.url, item.filename, true);
				queued++;
			} catch (e) {
				delete this.download_tasks[item.filename.toLowerCase()];
				state.failed++;
				this.log('Could not queue an image for "' + artist + '": ' + String(e.message || e));
			}
		}

		state.pending_files = queued;
		state.pending = queued > 0;
		state.deadline = queued > 0 ? Date.now() + this.download_timeout_ms : 0;
		state.phase = queued > 0 ? 'downloading' : 'available';
		state.unavailable = false;
		state.last_error = '';
		state.last_http_status = 0;
		state.retryable = true;
		state.retry_after_until = 0;
		this.log('Last.fm returned ' + candidates.length + ' image' +
			(candidates.length == 1 ? '' : 's') + ' for "' + artist + '"; ' + queued + ' queued' +
			(extracted.raw_count ? ' (raw-markup fallback recovered ' + extracted.raw_count + ')' : '') + '.');

		if (!queued) {
			if (artist == this.artist)
				this.update();
			state.pending = false;
			if (!this.image_paths.length && artist == this.artist) {
				state.phase = 'error';
				state.last_error = 'existing-files-unavailable';
			}
		}
		this.notify_status_changed();
	}

	this.interval_func = _.bind(function () {
		if (this.disposed)
			return;
		this.check_download_deadlines();
		if (window.IsVisible === false)
			return;

		this.time++;
		this.maybe_auto_download();

		if (this.properties.cycle.value > 0 && this.image_paths.length > 1 && this.time % this.properties.cycle.value == 0) {
			this.image_index++;

			if (this.image_index == this.image_paths.length) {
				this.image_index = 0;
			}

			this.update_image();
			window.Repaint();
		}

		if (this.properties.source.value == 1 && this.folder.length && this.time % 3 == 0 && _getFiles(this.folder, this.exts).length != this.image_paths.length) {
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
		if (this.containsXY(x, y) && this.image_index < this.image_paths.length) {
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
		this.maybe_auto_download();
	}

	this.move = function (x, y) {
		this.mx = x;
		this.my = y;
		return this.containsXY(x, y);
	}

	this.paint = function (gr) {
		if (this.is_bio_panel) {
			if (this.bitmap.normal) {
				if (this.appearance) {
					this.appearance.paint_background(gr, this.bitmap.normal, this.bitmap.blur);
					if (this.appearance.displayed()) {
						var rect = _drawImage(gr, this.bitmap.normal, this.x, this.y, this.w, this.h, this.properties.aspect.value == image.full ? image.full_top_align : this.properties.aspect.value);
						this.appearance.paint_border(gr, rect);
					}
				} else {
					this.draw_blurred_image(gr);
					_drawOverlay(gr, 0, 0, panel.w, panel.h, 180);
					_drawImage(gr, this.bitmap.normal, this.x, this.y, this.w, this.h, this.properties.aspect.value == image.full ? image.full_top_align : this.properties.aspect.value, 1.0, RGB(150, 150, 150));
				}
			} else if (!this.appearance) {
				_drawOverlay(gr, 0, 0, panel.w, panel.h);
			} else if (this.region_visible()) {
				var status = this.status_text();
				if (status.length) {
					gr.WriteTextSimple(
						status,
						panel.fonts.normal,
						panel.colours.text,
						this.x,
						this.y,
						this.w,
						this.h,
						DWRITE_TEXT_ALIGNMENT_CENTER,
						DWRITE_PARAGRAPH_ALIGNMENT_CENTER,
						DWRITE_WORD_WRAPPING_NO_WRAP,
						DWRITE_TRIMMING_GRANULARITY_CHARACTER
					);
				}
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
		this.maybe_auto_download();
	}

	this.rbtn_up = function (x, y, force) {
		if (!force && !this.containsXY(x, y))
			return;

		if (this.is_bio_panel) {
			panel.m.AppendMenuItem(MF_STRING, 1600, 'Image left, Text right');
			panel.m.AppendMenuItem(MF_STRING, 1601, 'Image top, Text bottom');
			panel.m.CheckMenuRadioItem(1600, 1601, this.properties.layout.value + 1600);
			panel.m.AppendMenuSeparator();
			if (this.appearance)
				this.appearance.append_menu(panel.m);
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
			if (this.appearance)
				panel.m.AppendMenuItem(CheckMenuIf(this.properties.hide_if_no_images.enabled), 1005, 'Hide if no images available');
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
		if (this.appearance && this.appearance.handle_menu(idx)) {
			this.maybe_auto_download();
			return;
		}

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
			this.maybe_auto_download();
			break;
		case 1005:
			this.properties.hide_if_no_images.toggle();
			this.notify_status_changed();
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
			try {
				this.bitmap.normal.Dispose();
			} catch (e) {}
			this.bitmap.normal = null;
		}

		if (this.bitmap.blur) {
			try {
				this.bitmap.blur.Dispose();
			} catch (e) {}
			this.bitmap.blur = null;
		}
	}

	this.dispose = function () {
		if (this.disposed)
			return;

		this.disposed = true;
		if (this.interval_id) {
			window.ClearInterval(this.interval_id);
			this.interval_id = 0;
		}

		this.reset_image();
		this.image_paths = [];
		this.artists = {};
		this.automatic_tasks = {};
		this.download_tasks = {};
		this.history = Object.create(null);
		this.history_size = 0;
	}

	this.update = function () {
		if (this.disposed)
			return;

		this.update_image_paths();
		if (this.image_paths.length && _tagged(this.artist)) {
			var state = this.current_state();
			state.phase = 'available';
			state.unavailable = false;
			state.last_error = '';
			state.last_http_status = 0;
			state.retryable = true;
			state.retry_after_until = 0;
		}
		this.update_image();
		this.notify_status_changed();
	}

	this.update_image = function () {
		this.reset_image();

		if (this.image_index < this.image_paths.length) {
			var img = null;
			try {
				img = utils.LoadImage(this.image_paths[this.image_index]);
				if (img) {
					this.bitmap.normal = img.CreateBitmap();
					if (this.wants_blur()) {
						img.StackBlur(120);
						this.bitmap.blur = img.CreateBitmap();
					}
				}
			} catch (e) {
				console.log(N, e.message || e);
			} finally {
				if (img) {
					try {
						img.Dispose();
					} catch (e) {}
				}
			}
		}
	}

	this.wants_artwork = function () {
		return !this.appearance || this.appearance.wants_artwork();
	}

	this.wants_blur = function () {
		if (this.appearance)
			return this.appearance.wants_blur();
		return this.is_bio_panel || this.properties.aspect.value == image.full;
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
		if (this.properties.source.value == 1) {
			var checked = [];
			for (var i = 0; i < this.image_paths.length; i++) {
				var original = this.image_paths[i];
				if (this.download_tasks[original.toLowerCase()]) continue;
				var path = this.inspect_image_file(original, false);
				if (path && checked.indexOf(path) == -1) checked.push(path);
			}
			this.image_paths = checked;
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
	this.history = Object.create(null); // bounded automatic-download state keyed by artist
	this.history_clock = 0;
	this.history_size = 0;
	this.history_limit = 256;
	this.request_limit = 32;
	this.download_task_limit = 256;
	this.request_timeout_ms = 45000;
	this.download_timeout_ms = 120000;
	this.limits = [1, 3, 5, 10, 15, 20];
	this.modes = ['grid', 'left', 'right', 'top', 'bottom', 'off'];
	this.exts = ['bmp', 'tif', 'tiff', 'webp', 'jpg', 'jpeg', 'png', 'gif', 'heif', 'heic', 'avif', 'jxl'];
	this.folder = '';
	this.artist = '';
	this.artists = {};
	this.automatic_tasks = {};
	this.download_tasks = {};
	this.checked_files = Object.create(null);
	this.signature_warning_logged = false;
	this.properties = {};
	this.image_index = 0;
	this.time = 0;
	this.counter = 0;
	this.auto_download_attempt_limit = 3;
	this.auto_download_retry_ms = 30000;
	this.response_preview_limit = 160;
	this.disposed = false;
	this.interval_id = 0;
	this.is_bio_panel = panel.text_objects.length == 1 && panel.text_objects[0].name == 'lastfm_bio';
	this.appearance = options.appearance || null;

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
		hide_if_no_images : new _p('2K3.LASTFM.BIO.IMAGES.HIDE.IF.NO.IMAGES', false),
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



	utils.CreateFolder(folders.artists);
	this.interval_id = window.SetInterval(this.interval_func, 1000);
}
