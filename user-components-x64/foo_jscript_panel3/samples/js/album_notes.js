function _album_notes(x, y, w, h) {
    var self = this;

    this.note_source_defs = [
        { key : 'allmusic', label : 'AllMusic', property : 'DARKONEJSP3.ALBUM.NOTES.SOURCE.ALLMUSIC', default_value : true },
        { key : 'theaudiodb', label : 'TheAudioDB', property : 'DARKONEJSP3.ALBUM.NOTES.SOURCE.THEAUDIODB', default_value : false },
        { key : 'wikipedia', label : 'Wikipedia', property : 'DARKONEJSP3.ALBUM.NOTES.SOURCE.WIKIPEDIA', default_value : false },
        { key : 'applemusic', label : 'Apple Music', property : 'DARKONEJSP3.ALBUM.NOTES.SOURCE.APPLEMUSIC', default_value : false }
    ];

    this.properties = {
        view : new _p('DARKONEJSP3.ALBUM.NOTES.VIEW', 0),
        notes_mode : new _p('DARKONEJSP3.ALBUM.NOTES.MODE', 0),
        browse_source : new _p('DARKONEJSP3.ALBUM.NOTES.BROWSE.SOURCE', 'allmusic'),
        source_priority : new _p('DARKONEJSP3.ALBUM.NOTES.SOURCE.PRIORITY', 'allmusic,theaudiodb,wikipedia,applemusic'),
        musicbrainz_resolver : new _p('DARKONEJSP3.ALBUM.NOTES.SOURCE.MUSICBRAINZ', true),
        musicbrainz_releases : new _p('DARKONEJSP3.ALBUM.NOTES.MUSICBRAINZ.RELEASES', true),
        musicbrainz_links : new _p('DARKONEJSP3.ALBUM.NOTES.MUSICBRAINZ.LINKS', true),
        negative_cache_hours : new _p('DARKONEJSP3.ALBUM.NOTES.NEGATIVE.CACHE.HOURS', 24),
        theaudiodb_key : new _p('DARKONEJSP3.ALBUM.NOTES.THEAUDIODB.KEY', '2'),
        apple_token : new _p('DARKONEJSP3.ALBUM.NOTES.APPLE.TOKEN', ''),
        apple_storefront : new _p('DARKONEJSP3.ALBUM.NOTES.APPLE.STOREFRONT', 'gb')
    };

    this.cache_properties = {
        theaudiodb : new _p('DARKONEJSP3.ALBUM.NOTES.CACHE.THEAUDIODB.DAYS', 30),
        wikipedia : new _p('DARKONEJSP3.ALBUM.NOTES.CACHE.WIKIPEDIA.DAYS', 30),
        applemusic : new _p('DARKONEJSP3.ALBUM.NOTES.CACHE.APPLEMUSIC.DAYS', 30)
    };

    this.source_properties = {};
    _.forEach(this.note_source_defs, function (item) {
        self.source_properties[item.key] = new _p(item.property, item.default_value);
    });

    this.source_enabled = function (key) {
        if (key == 'musicbrainz') return !!this.properties.musicbrainz_resolver.enabled;
        return !!(this.source_properties[key] && this.source_properties[key].enabled);
    };

    this.set_source_enabled = function (key, enabled) {
        if (key == 'musicbrainz') this.properties.musicbrainz_resolver.enabled = !!enabled;
        else if (this.source_properties[key]) this.source_properties[key].enabled = !!enabled;
        else return;
        if (this.properties.notes_mode.value == 1 && !this.source_enabled(this.properties.browse_source.value)) this.select_first_enabled_source();
        this.restart_current_view(true);
    };

    this.source_label = function (key) {
        if (key == 'musicbrainz') return 'MusicBrainz';
        for (var i = 0; i < this.note_source_defs.length; i++) if (this.note_source_defs[i].key == key) return this.note_source_defs[i].label;
        return key;
    };

    this.normalise = function (value) {
        return utils.ConvertToAscii(String(value || '')).toLowerCase().replace(/&amp;/g, '&').replace(/&/g, ' and ').replace(/\band\b/g, '').replace(/[^a-z0-9]+/g, '');
    };

    this.clean_album = function (value) {
        var original = String(value || '');
        var result = original
            .replace(/[\s\-_]*(?:\(|\[|\{)\s*(?:disc|disk|cd)\s*\d+(?:\s*(?:of|\/)\s*\d+)?\s*(?:\)|\]|\})\s*$/ig, '')
            .replace(/[\s\-_]*(?:disc|disk|cd)\s*\d+(?:\s*(?:of|\/)\s*\d+)?\s*$/ig, '')
            .replace(/[\s\-_]*(?:\(|\[|\{)\s*(?:bonus|deluxe|expanded|explicit|clean|remaster(?:ed)?|anniversary|special|limited|edition|version)\b[^\)\]\}]*?(?:\)|\]|\})\s*$/ig, '');
        return result.trim() || original;
    };

    this.clean_mbid = function (value) {
        var match = String(value || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
        return match ? match[0].toLowerCase() : '';
    };

    this.get_tag_mbid = function (names) {
        for (var i = 0; i < names.length; i++) {
            try {
                var value = this.clean_mbid(panel.tf('$meta(' + names[i] + ')'));
                if (value.length) return value;
            } catch (e) {}
        }
        return '';
    };

    this.album_key = function () { return this.normalise(this.artist) + '|' + this.normalise(this.album_clean || this.album); };

    this.load_identity_map = function () {
        try {
            if (utils.IsFile(this.identity_file)) {
                var value = JSON.parse(utils.ReadUTF8(this.identity_file));
                if (value && typeof value == 'object') return value;
            }
        } catch (e) {}
        return {};
    };

    this.save_identity_map = function () {
        try { _save(this.identity_file, JSON.stringify(this.identity_map, null, 2)); } catch (e) {}
    };

    this.build_identity = function () {
        var key = this.album_key();
        var saved = this.identity_map[key] || {};
        var tagged_rg = this.get_tag_mbid(['MUSICBRAINZ_RELEASEGROUPID', 'MUSICBRAINZ RELEASE GROUP ID']);
        var tagged_release = this.get_tag_mbid(['MUSICBRAINZ_ALBUMID', 'MUSICBRAINZ_RELEASEID', 'MUSICBRAINZ RELEASE ID']);
        var tagged_artist = this.get_tag_mbid(['MUSICBRAINZ_ALBUMARTISTID', 'MUSICBRAINZ ALBUM ARTIST ID', 'MUSICBRAINZ_ARTISTID', 'MUSICBRAINZ ARTIST ID']);
        var use_saved_override = !!saved.manual && this.clean_mbid(saved.release_group_mbid).length;
        this.identity = {
            artist : this.artist,
            album : this.album_clean || this.album,
            release_group_mbid : use_saved_override ? this.clean_mbid(saved.release_group_mbid) : (tagged_rg || this.clean_mbid(saved.release_group_mbid)),
            release_mbid : tagged_release || this.clean_mbid(saved.release_mbid),
            artist_mbid : tagged_artist || this.clean_mbid(saved.artist_mbid),
            match_method : use_saved_override ? 'manual release-group MBID' : (tagged_rg ? 'file tag release-group MBID' : (saved.release_group_mbid ? 'saved MusicBrainz match' : 'artist/album tags')),
            manual : use_saved_override
        };
    };

    this.save_identity = function (manual) {
        var key = this.album_key();
        if (!key.length || !this.identity.release_group_mbid.length) return;
        this.identity.manual = !!manual;
        this.identity_map[key] = {
            artist : this.artist,
            album : this.album_clean || this.album,
            release_group_mbid : this.identity.release_group_mbid,
            release_mbid : this.identity.release_mbid || '',
            artist_mbid : this.identity.artist_mbid || '',
            match_method : this.identity.match_method || '',
            manual : !!manual,
            saved_at : Date.now()
        };
        this.save_identity_map();
    };

    this.forget_identity = function () {
        var key = this.album_key();
        if (key && this.identity_map[key]) {
            delete this.identity_map[key];
            this.save_identity_map();
        }
        this.build_identity();
    };

    this.identity_text = function () {
        var lines = [
            'Artist: ' + (this.artist || '(none)'),
            'Album: ' + (this.album_clean || this.album || '(none)'),
            'Release-group MBID: ' + (this.identity.release_group_mbid || '(not resolved)'),
            'Release MBID: ' + (this.identity.release_mbid || '(not tagged)'),
            'Artist MBID: ' + (this.identity.artist_mbid || '(not tagged)'),
            'Match method: ' + (this.identity.match_method || '(none)')
        ];
        return lines.join('\r\n');
    };

    this.get_priority = function () {
        var valid = {}, result = [], raw = String(this.properties.source_priority.value || '').split(',');
        for (var i = 0; i < this.note_source_defs.length; i++) valid[this.note_source_defs[i].key] = true;
        for (var r = 0; r < raw.length; r++) {
            var key = String(raw[r] || '').toLowerCase();
            if (valid[key] && result.indexOf(key) < 0) result.push(key);
        }
        for (var j = 0; j < this.note_source_defs.length; j++) if (result.indexOf(this.note_source_defs[j].key) < 0) result.push(this.note_source_defs[j].key);
        return result;
    };

    this.set_priority = function (order) {
        this.properties.source_priority.value = order.join(',');
        this.restart_current_view(true);
    };

    this.move_priority = function (source, delta) {
        var order = this.get_priority(), index = order.indexOf(source), target = index + delta;
        if (index < 0 || target < 0 || target >= order.length) return;
        var temp = order[index]; order[index] = order[target]; order[target] = temp;
        this.set_priority(order);
    };

    this.priority_text = function () {
        var order = this.get_priority(), labels = [];
        for (var i = 0; i < order.length; i++) labels.push(this.source_label(order[i]));
        return labels.join(' > ');
    };

    this.select_first_enabled_source = function () {
        var order = this.get_priority();
        for (var i = 0; i < order.length; i++) if (this.source_enabled(order[i])) { this.properties.browse_source.value = order[i]; return order[i]; }
        this.properties.browse_source.value = 'allmusic';
        return '';
    };

    this.cache_days_for_source = function (source) {
        return this.cache_properties[source] ? Number(this.cache_properties[source].value) : 0;
    };

    this.cache_filenames = function (source) {
        if (!this.artist.length || !this.album.length) return [];
        var folder = _artistFolder(this.artist), names = [];
        if (this.identity.release_group_mbid.length) names.push(folder + 'album-notes.' + this.identity.release_group_mbid + '.' + source + '.json');
        names.push(folder + 'album-notes.' + utils.ReplaceIllegalChars(this.album_clean || this.album) + '.' + source + '.json');
        return names;
    };

    this.cache_filename = function (source) {
        var names = this.cache_filenames(source);
        return names.length ? names[0] : '';
    };

    this.load_cache = function (source) {
        var names = this.cache_filenames(source);
        for (var i = 0; i < names.length; i++) {
            var filename = names[i];
            if (!utils.IsFile(filename)) continue;
            try {
                var value = JSON.parse(utils.ReadUTF8(filename));
                if (!value || this.normalise(value.artist) != this.normalise(this.artist) || this.normalise(value.album) != this.normalise(this.album_clean || this.album)) continue;
                var age_ms = Math.max(0, Date.now() - Number(value.fetched_at || 0));
                if (value.negative) {
                    if (age_ms <= Math.max(1, Number(this.properties.negative_cache_hours.value)) * 3600000) return value;
                    continue;
                }
                var days = this.cache_days_for_source(source);
                if (days > 0 && age_ms > days * 86400000) continue;
                if (value.text) return value;
            } catch (e) {}
        }
        return null;
    };

    this.save_cache = function (source, text, url, content_type, extra) {
        var filename = this.cache_filename(source);
        if (!filename.length || !text.length) return;
        var value = {
            version : 2,
            source : source,
            source_label : this.source_label(source),
            content_type : content_type || 'album notes',
            artist : this.artist,
            album : this.album_clean || this.album,
            release_group_mbid : this.identity.release_group_mbid || '',
            text : text,
            url : String(url || ''),
            fetched_at : Date.now(),
            extra : extra || {}
        };
        _save(filename, JSON.stringify(value, null, 2));
    };

    this.save_negative_cache = function (source, reason) {
        if (!this.cache_properties[source]) return;
        var filename = this.cache_filename(source);
        if (!filename.length) return;
        _save(filename, JSON.stringify({
            version : 2,
            source : source,
            artist : this.artist,
            album : this.album_clean || this.album,
            release_group_mbid : this.identity.release_group_mbid || '',
            negative : true,
            reason : String(reason || 'no result'),
            fetched_at : Date.now()
        }, null, 2));
    };

    this.clear_source_cache = function (source) {
        var names = this.cache_filenames(source);
        for (var i = 0; i < names.length; i++) if (utils.IsFile(names[i])) utils.RemovePath(names[i]);
    };

    this.clear_layout = function () {
        if (this.text_layout) { this.text_layout.Dispose(); this.text_layout = null; }
    };

    this.rebuild_text_layout = function () {
        this.clear_layout();
        var value = this.display_text.length ? this.display_text : this.status;
        if (value.length) this.text_layout = utils.CreateTextLayout(value, panel.fonts.name, _scale(panel.fonts.size.value));
        this.update();
        window.Repaint();
    };

    this.set_status = function (value, error) {
        this.status = String(value || '');
        this.error = !!error;
        this.text = '';
        this.display_text = '';
        this.rebuild_text_layout();
    };

    this.source_summary = function (source, content_type, extra, from_cache) {
        var lines = ['Source: ' + this.source_label(source), 'Content: ' + String(content_type || 'album notes')];
        extra = extra || {};
        if (extra.author) lines.push('Reviewer: ' + extra.author);
        if (extra.publication) lines.push('Publication: ' + extra.publication);
        if (extra.rating) lines.push('Rating: ' + extra.rating);
        if (extra.score) lines.push('Score: ' + extra.score + (extra.votes ? ' · ' + extra.votes + ' votes' : ''));
        if (extra.language) lines.push('Language: ' + extra.language);
        if (from_cache) lines.push('Cache: local cached copy');
        return lines.join('\r\n');
    };

    this.show_result = function (source, text, url, content_type, extra, from_cache) {
        if (!text || !String(text).trim().length) { this.provider_no_result(source, source + ' returned no usable text'); return; }
        this.cancel_requests();
        this.active_source = source;
        this.source_url = String(url || '');
        this.content_type = String(content_type || 'album notes');
        this.text = String(text).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().replace(/\n/g, '\r\n');
        this.display_text = this.source_summary(source, this.content_type, extra, !!from_cache) + '\r\n\r\n' + this.text;
        this.status = '';
        this.error = false;
        this.result_info = { source : source, content_type : this.content_type, url : this.source_url, extra : extra || {}, from_cache : !!from_cache };
        if (!from_cache) this.save_cache(source, this.text, this.source_url, this.content_type, extra);
        this.record_diagnostic(source, 'success', (from_cache ? 'loaded from cache' : 'retrieved successfully'), { content_type : this.content_type });
        this.rebuild_text_layout();
        console.log(N, 'Album Notes loaded ' + this.content_type + ' from ' + this.source_label(source) + (from_cache ? ' cache.' : '.'));
    };

    this.header_text = function () {
        if (this.properties.view.value == 1) return this.musicbrainz.header_text() + ' · Releases';
        if (this.properties.view.value == 2) return this.musicbrainz.header_text() + ' · Links';
        var base = panel.tf('%album artist%[ - %album%]');
        return base + (this.active_source.length ? ' · ' + this.source_label(this.active_source) : ' · Album Notes');
    };

    this.record_diagnostic = function (source, state, detail, extra) {
        this.diagnostics[source] = {
            state : String(state || ''),
            detail : String(detail || ''),
            extra : extra || {},
            timestamp : Date.now()
        };
    };

    this.format_diagnostics = function () {
        var lines = [
            'Enhanced Album Notes diagnostics',
            '',
            'Artist: ' + (this.artist || '(none)'),
            'Album: ' + (this.album_clean || this.album || '(none)'),
            'Mode: ' + (Number(this.properties.notes_mode.value) == 1 ? 'Browse one source' : 'Best available'),
            'Priority: ' + this.priority_text(),
            'Release-group MBID: ' + (this.identity.release_group_mbid || '(not resolved)'),
            'Identity method: ' + (this.identity.match_method || '(none)'),
            'API identity: ' + (typeof DarkOneNetwork != 'undefined' ? DarkOneNetwork.headerProfileLabel('api') : 'application'),
            'HTML identity: ' + (typeof DarkOneNetwork != 'undefined' ? DarkOneNetwork.headerProfileLabel('html') : 'application'),
            ''
        ];
        for (var i = 0; i < this.note_source_defs.length; i++) {
            var item = this.note_source_defs[i], diag = this.diagnostics[item.key];
            lines.push(item.label + ': ' + (this.source_enabled(item.key) ? 'enabled' : 'disabled') + (diag ? ' · ' + diag.state + ' · ' + diag.detail : ''));
        }
        lines.push('MusicBrainz resolver: ' + (this.properties.musicbrainz_resolver.enabled ? 'enabled' : 'disabled'));
        return lines.join('\r\n');
    };

    this.begin_notes = function (force) {
        this.generation++;
        this.clear_allmusic_activation_guard();
        this.cancel_requests();
        this.active_source = '';
        this.source_url = '';
        this.content_type = '';
        this.failed_sources = {};
        this.attempted_sources = {};
        this.diagnostics = {};
        this.text = '';
        this.display_text = '';
        this.status = '';
        this.error = false;
        this.identity_lookup_pending = false;

        if (!panel.metadb || !this.artist.length || !this.album.length) {
            this.set_status('Select a track with artist and album tags to load album notes.');
            return;
        }

        if (Number(this.properties.notes_mode.value) == 1) {
            var selected = String(this.properties.browse_source.value || '');
            if (!this.source_enabled(selected)) selected = this.select_first_enabled_source();
            if (!selected.length) { this.set_status('All album-note sources are disabled.', true); return; }
            this.start_source(selected, !!force);
            return;
        }
        this.try_next_source('Starting enabled-source chain', !!force);
    };

    this.start_source = function (source, force) {
        if (!this.source_enabled(source)) { this.failed_sources[source] = 'disabled'; this.try_next_source(this.source_label(source) + ' is disabled', force); return; }
        this.attempted_sources[source] = true;
        this.active_source = source;
        this.record_diagnostic(source, 'checking', 'request started');
        if (source == 'allmusic') {
            this.set_status('Checking AllMusic...');
            var activation_generation = this.generation;
            this.allmusic.activate_managed(!!force);
            this.clear_allmusic_activation_guard();
            this.allmusic_activation_timer = window.SetTimeout(function () {
                self.allmusic_activation_timer = 0;
                if (activation_generation != self.generation || self.disposed) return;
                if (self.properties.view.value != 0 || self.active_source != 'allmusic') return;
                if (self.allmusic.terminal_state.length || self.allmusic.text.length || self.allmusic.has_pending_work()) return;
                self.on_allmusic_terminal({
                    success : false,
                    source : 'allmusic',
                    reason : 'provider activation produced no request or terminal result',
                    text : '',
                    url : self.allmusic.resolved_album_url,
                    artist : self.artist,
                    album : self.album
                });
            }, 250);
        } else if (source == 'theaudiodb') {
            this.set_status('Checking TheAudioDB...');
            this.start_theaudiodb(force);
        } else if (source == 'wikipedia') {
            this.set_status('Checking Wikipedia...');
            this.start_wikipedia(force);
        } else if (source == 'applemusic') {
            this.set_status('Checking Apple Music...');
            this.start_apple_music(force);
        }
    };

    this.clear_allmusic_activation_guard = function () {
        if (!this.allmusic_activation_timer) return;
        window.ClearTimeout(this.allmusic_activation_timer);
        this.allmusic_activation_timer = 0;
    };

    this.on_allmusic_terminal = function (result) {
        this.clear_allmusic_activation_guard();
        if (this.properties.view.value != 0 || result.artist != this.artist || result.album != this.album || !this.attempted_sources.allmusic) return;
        if (result.success) {
            this.active_source = 'allmusic';
            this.source_url = result.url || '';
            this.content_type = 'editorial album review';
            this.result_info = { source : 'allmusic', content_type : this.content_type, url : this.source_url, extra : {}, from_cache : false };
            this.record_diagnostic('allmusic', 'success', 'review available');
            window.Repaint();
            return;
        }
        this.failed_sources.allmusic = result.reason || 'unavailable';
        this.record_diagnostic('allmusic', 'failed', this.failed_sources.allmusic);
        this.try_next_source(this.failed_sources.allmusic, false);
    };

    this.try_next_source = function (reason, force) {
        if (this.properties.view.value != 0) return;
        if (Number(this.properties.notes_mode.value) == 1) {
            var selected = String(this.properties.browse_source.value || '');
            var message_one = this.source_label(selected) + ' did not return usable album notes.';
            this.active_source = '';
            this.set_status(message_one, true);
            console.log(N, message_one + (reason ? ' Last result: ' + reason : ''));
            return;
        }
        var order = this.get_priority();
        for (var i = 0; i < order.length; i++) {
            var source = order[i];
            if (this.source_enabled(source) && !this.attempted_sources[source]) { this.start_source(source, !!force); return; }
        }
        var enabled = [];
        for (var j = 0; j < order.length; j++) if (this.source_enabled(order[j])) enabled.push(this.source_label(order[j]));
        var message = enabled.length ? 'No enabled album-note source returned usable text.' : 'All album-note sources are disabled.';
        if (this.properties.musicbrainz_releases.enabled || this.properties.musicbrainz_links.enabled) message += '\r\n\r\nMusicBrainz views remain available from the View menu.';
        this.active_source = '';
        this.set_status(message, true);
        console.log(N, message + (reason ? ' Last result: ' + reason : ''));
    };

    this.provider_failed = function (source, reason) {
        this.failed_sources[source] = String(reason || 'unavailable');
        this.record_diagnostic(source, 'failed', this.failed_sources[source]);
        console.log(N, this.source_label(source) + ' was skipped: ' + this.failed_sources[source]);
        this.try_next_source(this.failed_sources[source], false);
    };

    this.provider_no_result = function (source, reason) {
        this.save_negative_cache(source, reason);
        this.provider_failed(source, reason);
    };

    this.provider_interval = function (provider) {
        if (provider == 'musicbrainz') return 1100;
        if (provider == 'theaudiodb') return 550;
        if (provider == 'wikipedia') return 250;
        if (provider == 'applemusic') return 250;
        return 0;
    };

    this.queue_request = function (request, minimum_delay) {
        var generation = request.generation;
        var delay = Math.max(0, Number(minimum_delay || 0));
        if (typeof DarkOneNetwork != 'undefined') {
            if (request.provider == 'musicbrainz') delay = DarkOneNetwork.reserveMusicBrainz(1100, delay);
            else if (typeof DarkOneNetwork.reserveProvider == 'function') delay = DarkOneNetwork.reserveProvider(request.provider, this.provider_interval(request.provider), delay);
        }
        var execute = function () {
            if (generation != self.generation || self.disposed) return;
            var id;
            try { id = utils.HTTPRequestAsync(window.ID, 0, request.url, request.headers); }
            catch (e) { self.final_request_failure(request, 'request could not be started: ' + e.message); return; }
            request.started_at = Date.now();
            self.requests[id] = request;
            self.watchdogs[id] = window.SetTimeout(function () { self.request_timeout(id); }, self.request_timeout_ms);
        };
        if (delay > 0) this.request_timers.push(window.SetTimeout(execute, delay)); else execute();
    };

    this.request = function (owner, provider, kind, url, context, headers, options) {
        options = options || {};
        var request = {
            owner : owner,
            provider : provider,
            kind : kind,
            url : url,
            context : context || {},
            headers : headers,
            generation : this.generation,
            attempt : Number(options.attempt || 1),
            max_attempts : Number(options.max_attempts || 3),
            started_at : 0
        };
        this.queue_request(request, Number(options.minimum_delay || 0));
    };

    this.request_musicbrainz = function (owner, kind, url, context) {
        this.request(owner, 'musicbrainz', kind, url, context, DarkOneNetwork.musicBrainzHeaders(''), { max_attempts : 3 });
    };

    this.clear_watchdog = function (id) {
        if (this.watchdogs[id] !== undefined) { window.ClearTimeout(this.watchdogs[id]); delete this.watchdogs[id]; }
    };

    this.request_timeout = function (id) {
        var request = this.requests[id];
        if (!request) return;
        delete this.requests[id];
        this.clear_watchdog(id);
        if (request.generation != this.generation) return;
        this.retry_or_fail(request, 'request timed out', 0);
    };

    this.cancel_requests = function () {
        for (var id in this.watchdogs) if (Object.prototype.hasOwnProperty.call(this.watchdogs, id)) window.ClearTimeout(this.watchdogs[id]);
        for (var i = 0; i < this.request_timers.length; i++) window.ClearTimeout(this.request_timers[i]);
        this.requests = {};
        this.watchdogs = {};
        this.request_timers = [];
    };

    this.is_transient_status = function (status) {
        status = Number(status || 0);
        return status == 0 || status == 408 || status == 425 || status == 429 || status == 502 || status == 503 || status == 504;
    };

    this.retry_after_ms = function (headers) {
        var value = String(headers || ''), seconds = 0;
        try {
            var parsed = JSON.parse(value);
            for (var key in parsed) if (Object.prototype.hasOwnProperty.call(parsed, key) && String(key).toLowerCase() == 'retry-after') seconds = Number(parsed[key]);
        } catch (e) {
            var match = value.match(/retry-after["'\s:]+(\d+)/i);
            if (match) seconds = Number(match[1]);
        }
        if (!seconds) {
            var raw_match = value.match(/retry-after[\"'\s:]+([^\r\n}]+)/i);
            if (raw_match) {
                var raw_value = String(raw_match[1] || '').replace(/^[\"']|[\"',\s]+$/g, '').trim();
                var date_value = Date.parse(raw_value);
                if (!isNaN(date_value)) return Math.max(0, date_value - Date.now());
            }
        }
        return isNaN(seconds) ? 0 : Math.max(0, seconds * 1000);
    };

    this.retry_or_fail = function (request, reason, retry_after) {
        if (request.attempt < request.max_attempts) {
            request.attempt++;
            var jitter = Math.floor(Math.random() * 251);
            var delay = Math.max(Number(retry_after || 0), 1200 * Math.pow(2, request.attempt - 2)) + jitter;
            this.record_diagnostic(request.owner, 'retrying', reason + ' · attempt ' + request.attempt + ' of ' + request.max_attempts);
            console.log(N, this.source_label(request.owner) + ' ' + reason + '. Retrying attempt ' + request.attempt + ' of ' + request.max_attempts + '...');
            this.queue_request(request, delay);
            return;
        }
        this.final_request_failure(request, reason);
    };

    this.final_request_failure = function (request, reason) {
        if (request.kind == 'identity-search') { this.resume_without_identity(request.context.resume_source, reason); return; }
        if (request.kind == 'tadb-mb') { this.request_theaudiodb_search(); return; }
        if (request.kind == 'wiki-mb-release') { this.request_wikipedia_search(); return; }
        this.provider_failed(request.owner, reason);
    };

    this.http_request_done = function (id, success, response_text, status, response_headers) {
        this.allmusic.http_request_done(id, success, response_text, status, response_headers);
        this.musicbrainz.http_request_done(id, success, response_text, status, response_headers);
        var request = this.requests[id];
        if (!request) return;
        delete this.requests[id];
        this.clear_watchdog(id);
        if (request.generation != this.generation) return;
        status = Number(status || (success ? 200 : 0));
        if (!success || status < 200 || status >= 300) {
            if (this.is_transient_status(status)) { this.retry_or_fail(request, 'HTTP ' + status, this.retry_after_ms(response_headers)); return; }
            this.final_request_failure(request, 'HTTP ' + status);
            return;
        }
        try {
            var data = JSON.parse(response_text);
            this.handle_provider_response(request, data);
        } catch (e) {
            this.final_request_failure(request, 'invalid JSON response');
        }
    };

    this.handle_provider_response = function (request, data) {
        switch (request.kind) {
        case 'identity-search': this.parse_identity_search(data, request.context.resume_source); break;
        case 'tadb-mb': this.parse_theaudiodb(data, true); break;
        case 'tadb-search': this.parse_theaudiodb(data, false); break;
        case 'wiki-mb-release': this.parse_wikipedia_mb(data); break;
        case 'wiki-search': this.parse_wikipedia_search(data); break;
        case 'wiki-toc': this.parse_wikipedia_toc(data, request.context.title); break;
        case 'wiki-section': this.parse_wikipedia_section(data, request.context.title); break;
        case 'apple-search': this.parse_apple_music(data); break;
        }
    };

    this.artist_credit_name = function (item) {
        var credit = item && item['artist-credit'] || [], names = [];
        for (var i = 0; i < credit.length; i++) {
            var part = credit[i] || {};
            if (part.name) names.push(part.name);
            else if (part.artist && part.artist.name) names.push(part.artist.name);
        }
        return names.join(' & ');
    };

    this.ensure_release_group_identity = function (resume_source) {
        if (this.identity.release_group_mbid.length) return true;
        if (!this.properties.musicbrainz_resolver.enabled) return false;
        if (this.identity_lookup_pending) return false;
        this.identity_lookup_pending = true;
        this.record_diagnostic('musicbrainz', 'checking', 'resolving release-group identity for ' + this.source_label(resume_source));
        var query = 'releasegroup:"' + String(this.album_clean || this.album).replace(/"/g, '') + '" AND artist:"' + String(this.artist).replace(/"/g, '') + '"';
        var url = 'https://musicbrainz.org/ws/2/release-group/?fmt=json&limit=8&query=' + encodeURIComponent(query);
        this.request_musicbrainz(resume_source, 'identity-search', url, { resume_source : resume_source });
        return false;
    };

    this.parse_identity_search = function (data, resume_source) {
        this.identity_lookup_pending = false;
        var groups = data && data['release-groups'] || [], candidates = [];
        var wanted_album = this.normalise(this.album_clean || this.album), wanted_artist = this.normalise(this.artist);
        for (var i = 0; i < groups.length; i++) {
            var item = groups[i] || {}, album = this.normalise(this.clean_album(item.title || '')), artist = this.normalise(this.artist_credit_name(item));
            if (album == wanted_album && (artist == wanted_artist || (wanted_artist == 'variousartists' && (artist == 'variousartists' || artist == 'various')))) candidates.push(item);
        }
        var unique = {};
        for (var c = 0; c < candidates.length; c++) if (candidates[c].id) unique[candidates[c].id] = candidates[c];
        var ids = Object.keys(unique);
        if (ids.length == 1) {
            this.identity.release_group_mbid = this.clean_mbid(ids[0]);
            this.identity.match_method = 'exact MusicBrainz release-group search';
            this.save_identity(false);
            this.record_diagnostic('musicbrainz', 'success', 'resolved release-group MBID ' + this.identity.release_group_mbid);
            this.start_source(resume_source, false);
            return;
        }
        this.resume_without_identity(resume_source, ids.length > 1 ? 'ambiguous exact MusicBrainz release-group matches' : 'no exact MusicBrainz release-group match');
    };

    this.resume_without_identity = function (source, reason) {
        this.identity_lookup_pending = false;
        this.record_diagnostic('musicbrainz', 'unresolved', reason);
        if (source == 'theaudiodb') this.request_theaudiodb_search();
        else if (source == 'wikipedia') this.request_wikipedia_search();
        else this.provider_failed(source, reason);
    };

    this.start_theaudiodb = function (force) {
        if (!force) {
            var cached = this.load_cache('theaudiodb');
            if (cached) {
                if (cached.negative) { this.provider_failed('theaudiodb', 'cached no-result: ' + cached.reason); return; }
                this.show_result('theaudiodb', cached.text, cached.url, cached.content_type, cached.extra, true); return;
            }
        }
        var key = String(this.properties.theaudiodb_key.value || '2').trim() || '2';
        if (this.identity.release_group_mbid.length || this.ensure_release_group_identity('theaudiodb')) {
            var url = 'https://www.theaudiodb.com/api/v1/json/' + encodeURIComponent(key) + '/album-mb.php?i=' + encodeURIComponent(this.identity.release_group_mbid);
            this.request('theaudiodb', 'theaudiodb', 'tadb-mb', url, {}, DarkOneNetwork.theAudioDBHeaders(), { max_attempts : 3 });
        } else if (!this.identity_lookup_pending) this.request_theaudiodb_search();
    };

    this.request_theaudiodb_search = function () {
        var key = String(this.properties.theaudiodb_key.value || '2').trim() || '2';
        var url = 'https://www.theaudiodb.com/api/v1/json/' + encodeURIComponent(key) + '/searchalbum.php?s=' + encodeURIComponent(this.artist) + '&a=' + encodeURIComponent(this.album_clean || this.album);
        this.request('theaudiodb', 'theaudiodb', 'tadb-search', url, {}, DarkOneNetwork.theAudioDBHeaders(), { max_attempts : 3 });
    };

    this.score_album = function (candidate_artist, candidate_album) {
        var a1 = this.normalise(candidate_artist), a2 = this.normalise(this.artist);
        var b1 = this.normalise(this.clean_album(candidate_album)), b2 = this.normalise(this.album_clean || this.album);
        if (!b1.length || b1 != b2) return -1;
        if (a1 == a2) return 300;
        if (a2 == 'variousartists' && (a1 == 'variousartists' || a1 == 'various')) return 250;
        return -1;
    };

    this.parse_theaudiodb = function (data, from_mbid) {
        var albums = data && (data.album || data.albums) || [], best = null;
        for (var i = 0; i < albums.length; i++) {
            var item = albums[i] || {}, score = this.score_album(item.strArtist || '', item.strAlbum || '');
            if (score > -1 && (!best || score > best.score)) best = { item : item, score : score };
        }
        if (!best) {
            if (from_mbid) { this.request_theaudiodb_search(); return; }
            this.provider_no_result('theaudiodb', 'no exact artist/album match'); return;
        }
        var item = best.item, text = String(item.strReview || '').trim(), type = 'album review';
        if (!text.length) { text = String(item.strDescriptionEN || '').trim(); type = 'album description'; }
        if (!text.length) { this.provider_no_result('theaudiodb', 'the matched album has no review or English description'); return; }
        var url = item.idAlbum ? 'https://www.theaudiodb.com/album/' + item.idAlbum : '';
        this.show_result('theaudiodb', text, url, type, { score : item.intScore || '', votes : item.intScoreVotes || '', idAlbum : item.idAlbum || '', match_method : from_mbid ? 'release-group MBID plus exact verification' : 'exact artist/album search' }, false);
    };

    this.start_wikipedia = function (force) {
        if (!force) {
            var cached = this.load_cache('wikipedia');
            if (cached) {
                if (cached.negative) { this.provider_failed('wikipedia', 'cached no-result: ' + cached.reason); return; }
                this.show_result('wikipedia', cached.text, cached.url, cached.content_type, cached.extra, true); return;
            }
        }
        if (this.identity.release_group_mbid.length || this.ensure_release_group_identity('wikipedia')) {
            var url = 'https://musicbrainz.org/ws/2/release-group/' + this.identity.release_group_mbid + '?inc=url-rels&fmt=json';
            this.request_musicbrainz('wikipedia', 'wiki-mb-release', url, {});
        } else if (!this.identity_lookup_pending) this.request_wikipedia_search();
    };

    this.parse_wikipedia_mb = function (data) {
        var relations = data && data.relations || [];
        for (var i = 0; i < relations.length; i++) {
            var url = relations[i] && relations[i].url && relations[i].url.resource || '';
            var match = String(url).match(/^https?:\/\/en\.wikipedia\.org\/wiki\/(.+)$/i);
            if (match) { this.request_wikipedia_toc(decodeURIComponent(match[1].replace(/_/g, ' '))); return; }
        }
        this.request_wikipedia_search();
    };

    this.request_wikipedia_search = function () {
        var query = 'intitle:"' + (this.album_clean || this.album).replace(/"/g, '') + '" ' + this.artist;
        var url = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srnamespace=0&srlimit=8&format=json&formatversion=2&srsearch=' + encodeURIComponent(query);
        this.request('wikipedia', 'wikipedia', 'wiki-search', url, {}, DarkOneNetwork.wikipediaHeaders(), { max_attempts : 3 });
    };

    this.parse_wikipedia_search = function (data) {
        var results = data && data.query && data.query.search || [];
        var wanted_album = this.normalise(this.album_clean || this.album), wanted_artist = this.normalise(this.artist), best = null;
        for (var i = 0; i < results.length; i++) {
            var item = results[i] || {}, title = String(item.title || ''), title_norm = this.normalise(title.replace(/\([^\)]*\)$/, '')), snippet = this.normalise(_stripTags(item.snippet || '')), score = 0;
            if (title_norm == wanted_album) score += 220;
            else if (title_norm.indexOf(wanted_album) > -1) score += 120;
            if (snippet.indexOf(wanted_artist) > -1) score += 100;
            if (snippet.indexOf('album') > -1) score += 40;
            if (!best || score > best.score) best = { title : title, score : score };
        }
        if (!best || best.score < 120) { this.provider_no_result('wikipedia', 'no confident album article match'); return; }
        this.request_wikipedia_toc(best.title);
    };

    this.request_wikipedia_toc = function (title) {
        var url = 'https://en.wikipedia.org/w/api.php?action=parse&prop=tocdata&redirects=1&format=json&formatversion=2&page=' + encodeURIComponent(title);
        this.request('wikipedia', 'wikipedia', 'wiki-toc', url, { title : title }, DarkOneNetwork.wikipediaHeaders(), { max_attempts : 3 });
    };

    this.parse_wikipedia_toc = function (data, title) {
        var sections = data && data.parse && data.parse.tocdata && data.parse.tocdata.sections || [];
        var priorities = [/^critical reception$/i, /^reception$/i, /^reviews?$/i, /^release and reception$/i, /critical reception/i, /reception/i, /reviews?/i], match = null;
        for (var p = 0; p < priorities.length && !match; p++) for (var i = 0; i < sections.length; i++) if (priorities[p].test(String(sections[i].line || ''))) { match = sections[i]; break; }
        if (!match) { this.provider_no_result('wikipedia', 'the matched article has no reception/review section'); return; }
        var page = data.parse.title || title;
        var url = 'https://en.wikipedia.org/w/api.php?action=parse&prop=text&redirects=1&format=json&formatversion=2&page=' + encodeURIComponent(page) + '&section=' + encodeURIComponent(match.index);
        this.request('wikipedia', 'wikipedia', 'wiki-section', url, { title : page }, DarkOneNetwork.wikipediaHeaders(), { max_attempts : 3 });
    };

    this.clean_wikipedia_html = function (html) {
        html = String(html || '')
            .replace(/<table[\s\S]*?<\/table>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<sup[\s\S]*?<\/sup>/gi, '')
            .replace(/<figure[\s\S]*?<\/figure>/gi, '')
            .replace(/<div[^>]+class="[^"]*(?:hatnote|thumb|mw-editsection|navbox)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
            .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '')
            .replace(/<li[^>]*>/gi, '\n• ')
            .replace(/<br\s*\/?\s*>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n');
        return _stripTags(html).replace(/\[[0-9]+\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
    };

    this.parse_wikipedia_section = function (data, title) {
        var html = data && data.parse && data.parse.text || '', text = this.clean_wikipedia_html(html);
        if (!text.length) { this.provider_no_result('wikipedia', 'the reception section contained no readable text'); return; }
        var page = data.parse.title || title;
        this.show_result('wikipedia', text, 'https://en.wikipedia.org/wiki/' + encodeURIComponent(page.replace(/ /g, '_')), 'critical-reception summary', { page : page, match_method : this.identity.release_group_mbid ? 'MusicBrainz relationship or article search' : 'article search' }, false);
    };

    this.start_apple_music = function (force) {
        if (!force) {
            var cached = this.load_cache('applemusic');
            if (cached) {
                if (cached.negative) { this.provider_failed('applemusic', 'cached no-result: ' + cached.reason); return; }
                this.show_result('applemusic', cached.text, cached.url, cached.content_type, cached.extra, true); return;
            }
        }
        var token = String(this.properties.apple_token.value || '').trim();
        if (!token.length) { this.provider_failed('applemusic', 'no developer token is configured'); return; }
        var storefront = String(this.properties.apple_storefront.value || 'gb').toLowerCase().replace(/[^a-z]/g, '').substring(0, 2) || 'gb';
        var term = this.artist + ' ' + (this.album_clean || this.album);
        var url = 'https://api.music.apple.com/v1/catalog/' + storefront + '/search?types=albums&limit=10&term=' + encodeURIComponent(term);
        this.request('applemusic', 'applemusic', 'apple-search', url, {}, DarkOneNetwork.appleMusicHeaders(token), { max_attempts : 3 });
    };

    this.parse_apple_music = function (data) {
        var albums = data && data.results && data.results.albums && data.results.albums.data || [], best = null;
        for (var i = 0; i < albums.length; i++) {
            var item = albums[i] || {}, attr = item.attributes || {}, score = this.score_album(attr.artistName || '', attr.name || '');
            if (score > -1 && (!best || score > best.score)) best = { item : item, score : score };
        }
        if (!best) { this.provider_no_result('applemusic', 'no exact catalogue album match'); return; }
        var attr = best.item.attributes || {}, notes = attr.editorialNotes || {}, text = String(notes.standard || notes.short || '').trim();
        if (!text.length) { this.provider_no_result('applemusic', 'the matched album has no editorial notes'); return; }
        this.show_result('applemusic', text, attr.url || '', 'editorial album notes', { catalog_id : best.item.id || '', match_method : 'exact artist/album catalogue search' }, false);
    };

    this.metadb_changed = function () {
        var artist = panel.metadb ? panel.tf('%album artist%') : '', album = panel.metadb ? panel.tf('%album%') : '';
        if (artist == this.artist && album == this.album && !this.force_reload) return;
        this.force_reload = false;
        this.artist = artist;
        this.album = album;
        this.album_clean = this.clean_album(album);
        this.build_identity();
        this.offset = 0;
        if (this.properties.view.value == 0) this.begin_notes(false);
        else this.musicbrainz.metadb_changed();
    };

    this.restart_current_view = function (force) {
        this.force_reload = false;
        if (this.properties.view.value == 0) {
            this.begin_notes(!!force);
        } else {
            // Route every MusicBrainz view change through its public API. This
            // preserves scroll state, cancels stale work and reloads the correct
            // cache without clearing internal identity fields from Album Notes.
            this.musicbrainz.set_mode(this.properties.view.value - 1, !!force);
        }
        window.Repaint();
    };

    this.set_view = function (value, force) {
        var next_view = Math.max(0, Math.min(2, Number(value) || 0));
        if (next_view == 1 && !this.properties.musicbrainz_releases.enabled) return;
        if (next_view == 2 && !this.properties.musicbrainz_links.enabled) return;

        var previous_view = Number(this.properties.view.value) || 0;
        if (previous_view > 0 && next_view == 0) this.musicbrainz.save_scroll();
        this.properties.view.value = next_view;
        this.restart_current_view(!!force);
    };

    this.paint = function (gr) {
        if (this.properties.view.value == 1 || this.properties.view.value == 2) { this.musicbrainz.paint(gr); return; }
        if (this.active_source == 'allmusic' && (this.allmusic.text.length || this.allmusic.status_text.length)) { this.allmusic.paint(gr); return; }
        if (!this.text_layout) return;
        var colour = this.error ? RGB(220, 110, 110) : panel.colours.text;
        gr.WriteTextLayout(this.text_layout, colour, this.x, this.y + _scale(12), this.w, this.ha, this.offset);
        this.up_btn.paint(gr, panel.colours.text);
        this.down_btn.paint(gr, panel.colours.text);
    };

    this.containsXY = function (mx, my) { return mx > this.x && mx < this.x + this.w && my > this.y && my < this.y + this.h; };
    this.move = function (mx, my) {
        this.mx = mx; this.my = my;
        if (this.properties.view.value) return this.musicbrainz.move(mx, my);
        if (this.active_source == 'allmusic') return this.allmusic.move(mx, my);
        window.SetCursor(IDC_ARROW); this.up_btn.move(mx, my); this.down_btn.move(mx, my); return this.containsXY(mx, my);
    };
    this.lbtn_up = function (mx, my) {
        if (this.properties.view.value) return this.musicbrainz.lbtn_up(mx, my);
        if (this.active_source == 'allmusic') return this.allmusic.lbtn_up(mx, my);
        if (!this.containsXY(mx, my)) return false; this.up_btn.lbtn_up(mx, my); this.down_btn.lbtn_up(mx, my); return true;
    };
    this.wheel = function (step) {
        if (this.properties.view.value) return this.musicbrainz.wheel(step);
        if (this.active_source == 'allmusic') return this.allmusic.wheel(step);
        if (!this.containsXY(this.mx, this.my)) return false;
        if (this.text_height > this.ha) {
            this.offset += step * this.scroll_step;
            if (this.offset > 0) this.offset = 0;
            else if (this.offset < this.ha - this.text_height) this.offset = this.ha - this.text_height;
            window.RepaintRect(this.x, this.y, this.w, this.h);
        }
        return true;
    };
    this.key_down = function (key) {
        if (this.properties.view.value) return this.musicbrainz.key_down(key);
        if (this.active_source == 'allmusic') return this.allmusic.key_down(key);
        if (key == VK_UP) return this.wheel(1); if (key == VK_DOWN) return this.wheel(-1); return false;
    };

    this.update = function () {
        if (!this.text_layout) { this.text_height = 0; return; }
        this.text_height = this.text_layout.CalcTextHeight(this.w);
        this.scroll_step = _scale(panel.fonts.size.value) * 4;
        if (this.text_height < this.ha) this.offset = 0;
        else if (this.offset < this.ha - this.text_height) this.offset = this.ha - this.text_height;
    };

    this.size = function () {
        this.ha = this.h - _scale(24);
        this.up_btn.x = this.x + Math.round((this.w - _scale(12)) / 2); this.down_btn.x = this.up_btn.x;
        this.up_btn.y = this.y; this.down_btn.y = this.y + this.h - _scale(12);
        this.allmusic.x = this.x; this.allmusic.y = this.y; this.allmusic.w = this.w; this.allmusic.h = this.h; this.allmusic.size();
        this.musicbrainz.x = this.x; this.musicbrainz.y = this.y; this.musicbrainz.w = this.w; this.musicbrainz.h = this.h; this.musicbrainz.size();
        this.update();
    };

    this.font_changed = function () { this.rebuild_text_layout(); };
    this.notify_data = function (name, info) { return typeof DarkOneNetwork != 'undefined' ? DarkOneNetwork.onNotify(name, info) : false; };

    this.open_source = function () { if (this.source_url.length) utils.Run(this.source_url); };
    this.displayed_notes = function () { return this.active_source == 'allmusic' ? String(this.allmusic.text || '') : this.text; };
    this.delete_current_cache = function () {
        if (this.active_source == 'allmusic') {
            this.allmusic.delete_cache(true); this.allmusic.clear_blocked_state(); this.allmusic.reset(); this.begin_notes(true); return;
        }
        this.clear_source_cache(this.active_source);
        this.restart_current_view(true);
    };

    this.dispose_custom_menus = function () {
        var names = ['menu_view', 'menu_mode', 'menu_browse', 'menu_sources', 'menu_priority', 'menu_provider', 'menu_identity', 'menu_identity_api', 'menu_identity_html', 'menu_cache', 'menu_source_actions'];
        for (var i = 0; i < names.length; i++) {
            var menu = this[names[i]];
            if (menu) { try { menu.Dispose(); } catch (e) {} this[names[i]] = null; }
        }
        for (var j = 0; j < this.dynamic_menus.length; j++) try { this.dynamic_menus[j].Dispose(); } catch (e2) {}
        this.dynamic_menus = [];
    };

    this.rbtn_up = function (mx, my) {
        this.dispose_custom_menus();
        if (this.properties.view.value == 0) {
            if (this.active_source == 'allmusic' || (this.source_enabled('allmusic') && !this.active_source.length)) this.allmusic.rbtn_up(mx, my);
        } else this.musicbrainz.rbtn_up(mx, my);

        this.menu_view = window.CreatePopupMenu();
        this.menu_mode = window.CreatePopupMenu();
        this.menu_browse = window.CreatePopupMenu();
        this.menu_sources = window.CreatePopupMenu();
        this.menu_priority = window.CreatePopupMenu();
        this.menu_provider = window.CreatePopupMenu();
        this.menu_identity = window.CreatePopupMenu();
        this.menu_identity_api = window.CreatePopupMenu();
        this.menu_identity_html = window.CreatePopupMenu();
        this.menu_cache = window.CreatePopupMenu();
        this.menu_source_actions = window.CreatePopupMenu();

        this.menu_view.AppendMenuItem(MF_STRING, 2000, 'Album notes');
        this.menu_view.AppendMenuItem(EnableMenuIf(this.properties.musicbrainz_releases.enabled), 2001, 'MusicBrainz releases');
        this.menu_view.AppendMenuItem(EnableMenuIf(this.properties.musicbrainz_links.enabled), 2002, 'MusicBrainz links');
        this.menu_view.CheckMenuRadioItem(2000, 2002, 2000 + Number(this.properties.view.value));
        this.menu_view.AppendTo(panel.m, MF_STRING, 'View');

        if (this.properties.view.value == 0) {
            this.menu_mode.AppendMenuItem(MF_STRING, 2020, 'Best available');
            this.menu_mode.AppendMenuItem(MF_STRING, 2021, 'Browse one source');
            this.menu_mode.CheckMenuRadioItem(2020, 2021, Number(this.properties.notes_mode.value) == 1 ? 2021 : 2020);
            this.menu_mode.AppendTo(panel.m, MF_STRING, 'Album-note mode');

            for (var b = 0; b < this.note_source_defs.length; b++) {
                var browse_item = this.note_source_defs[b];
                this.menu_browse.AppendMenuItem(EnableMenuIf(this.source_enabled(browse_item.key)), 2025 + b, browse_item.label);
            }
            var browse_index = 0;
            for (var bi = 0; bi < this.note_source_defs.length; bi++) if (this.note_source_defs[bi].key == this.properties.browse_source.value) browse_index = bi;
            this.menu_browse.CheckMenuRadioItem(2025, 2028, 2025 + browse_index);
            this.menu_browse.AppendTo(panel.m, EnableMenuIf(Number(this.properties.notes_mode.value) == 1), 'Browse source');
        }

        for (var s = 0; s < this.note_source_defs.length; s++) {
            var source_item = this.note_source_defs[s];
            this.menu_sources.AppendMenuItem(CheckMenuIf(this.source_enabled(source_item.key)), 2010 + s, source_item.label);
        }
        this.menu_sources.AppendMenuSeparator();
        this.menu_sources.AppendMenuItem(CheckMenuIf(this.properties.musicbrainz_resolver.enabled), 2014, 'MusicBrainz matching and relationships');
        this.menu_sources.AppendMenuItem(CheckMenuIf(this.properties.musicbrainz_releases.enabled), 2015, 'MusicBrainz Releases view');
        this.menu_sources.AppendMenuItem(CheckMenuIf(this.properties.musicbrainz_links.enabled), 2016, 'MusicBrainz Links view');
        this.menu_sources.AppendTo(panel.m, MF_STRING, 'Sources');

        var order = this.get_priority();
        this.menu_priority.AppendMenuItem(MF_GRAYED, 0, this.priority_text());
        this.menu_priority.AppendMenuSeparator();
        for (var p = 0; p < order.length; p++) {
            var priority_sub = window.CreatePopupMenu();
            priority_sub.AppendMenuItem(EnableMenuIf(p > 0), 2100 + p * 2, 'Move earlier');
            priority_sub.AppendMenuItem(EnableMenuIf(p < order.length - 1), 2101 + p * 2, 'Move later');
            priority_sub.AppendTo(this.menu_priority, MF_STRING, (p + 1) + '. ' + this.source_label(order[p]));
            this.dynamic_menus.push(priority_sub);
        }
        this.menu_priority.AppendMenuSeparator();
        this.menu_priority.AppendMenuItem(MF_STRING, 2120, 'Restore default order');
        this.menu_priority.AppendMenuItem(MF_STRING, 2121, 'Prefer descriptive sources');
        this.menu_priority.AppendTo(panel.m, MF_STRING, 'Source priority');

        this.menu_provider.AppendMenuItem(MF_STRING, 2030, 'Set TheAudioDB API key...');
        this.menu_provider.AppendMenuItem(MF_STRING, 2031, 'Set Apple Music developer token...');
        this.menu_provider.AppendMenuItem(MF_STRING, 2032, 'Set Apple Music storefront...');
        this.menu_provider.AppendMenuSeparator();
        this.menu_provider.AppendMenuItem(MF_STRING, 2033, 'Show resolved album identity');
        this.menu_provider.AppendMenuItem(EnableMenuIf(!!panel.metadb), 2034, 'Set release-group MBID manually...');
        this.menu_provider.AppendMenuItem(EnableMenuIf(!!this.identity_map[this.album_key()]), 2035, 'Forget saved album identity');
        this.menu_provider.AppendMenuItem(EnableMenuIf(this.identity.release_group_mbid.length), 2036, 'Copy release-group MBID');
        this.menu_provider.AppendTo(panel.m, MF_STRING, 'Provider and matching settings');

        this.menu_identity_api.AppendMenuItem(MF_STRING, 2040, 'JSP3 Enhanced Samples application (recommended)');
        this.menu_identity_api.AppendMenuItem(MF_STRING, 2041, 'Google Chrome 150-style (experimental)');
        this.menu_identity_api.CheckMenuRadioItem(2040, 2041, DarkOneNetwork.getApiHeaderProfile() == 'chrome' ? 2041 : 2040);
        this.menu_identity_api.AppendTo(this.menu_identity, MF_STRING, 'API services');
        this.menu_identity_html.AppendMenuItem(MF_STRING, 2042, 'JSP3 Enhanced Samples application');
        this.menu_identity_html.AppendMenuItem(MF_STRING, 2043, 'Google Chrome 150-style (experimental)');
        this.menu_identity_html.CheckMenuRadioItem(2042, 2043, DarkOneNetwork.getHtmlHeaderProfile() == 'chrome' ? 2043 : 2042);
        this.menu_identity_html.AppendTo(this.menu_identity, MF_STRING, 'HTML services');
        this.menu_identity.AppendTo(panel.m, MF_STRING, 'Request identity');

        if (this.properties.view.value == 0) {
            var cache_sources = ['theaudiodb', 'wikipedia', 'applemusic'], cache_values = [1, 7, 14, 30, 0];
            for (var cs = 0; cs < cache_sources.length; cs++) {
                var cache_source = cache_sources[cs], cache_sub = window.CreatePopupMenu();
                for (var cv = 0; cv < cache_values.length; cv++) cache_sub.AppendMenuItem(MF_STRING, 2200 + cs * 10 + cv, cache_values[cv] ? cache_values[cv] + (cache_values[cv] == 1 ? ' day' : ' days') : 'Manual refresh only');
                var current_days = this.cache_days_for_source(cache_source), current_index = cache_values.indexOf(current_days);
                if (current_index < 0) current_index = 3;
                cache_sub.CheckMenuRadioItem(2200 + cs * 10, 2204 + cs * 10, 2200 + cs * 10 + current_index);
                cache_sub.AppendTo(this.menu_cache, MF_STRING, this.source_label(cache_source));
                this.dynamic_menus.push(cache_sub);
            }
            this.menu_cache.AppendTo(panel.m, MF_STRING, 'Cache periods');
            panel.m.AppendMenuSeparator();
            panel.m.AppendMenuItem(MF_STRING, 2050, 'Refresh enabled sources');
            panel.m.AppendMenuItem(EnableMenuIf(this.active_source.length), 2051, 'Clear current source cache');
            panel.m.AppendMenuSeparator();
            this.menu_source_actions.AppendMenuItem(EnableMenuIf(this.source_url.length), 2052, 'Open source page');
            this.menu_source_actions.AppendMenuItem(EnableMenuIf(this.source_url.length), 2053, 'Copy source URL');
            this.menu_source_actions.AppendMenuSeparator();
            this.menu_source_actions.AppendMenuItem(MF_STRING, 2054, 'Show diagnostics');
            this.menu_source_actions.AppendMenuItem(MF_STRING, 2056, 'Copy diagnostics');
            this.menu_source_actions.AppendTo(panel.m, MF_STRING, 'Current source');
            panel.m.AppendMenuSeparator();
            panel.m.AppendMenuItem(EnableMenuIf(this.displayed_notes().length), 2055, 'Copy displayed notes');
        }
        panel.m.AppendMenuSeparator();
    };

    this.rbtn_up_done = function (idx) {
        if (idx < 2000) {
            if (this.properties.view.value == 0) this.allmusic.rbtn_up_done(idx); else this.musicbrainz.rbtn_up_done(idx);
            return;
        }
        switch (idx) {
        case 2000: case 2001: case 2002:
            this.set_view(idx - 2000, false); break;
        case 2020: this.properties.notes_mode.value = 0; this.restart_current_view(true); break;
        case 2021: this.properties.notes_mode.value = 1; this.select_first_enabled_source(); this.restart_current_view(true); break;
        case 2014: this.properties.musicbrainz_resolver.toggle(); this.restart_current_view(true); break;
        case 2015:
            this.properties.musicbrainz_releases.toggle();
            if (!this.properties.musicbrainz_releases.enabled && this.properties.view.value == 1) this.set_view(0, true);
            else window.Repaint();
            break;
        case 2016:
            this.properties.musicbrainz_links.toggle();
            if (!this.properties.musicbrainz_links.enabled && this.properties.view.value == 2) this.set_view(0, true);
            else window.Repaint();
            break;
        case 2030:
            try { this.properties.theaudiodb_key.value = String(utils.InputBox('Enter your TheAudioDB API key. The public test/development key is 2.', window.Name, this.properties.theaudiodb_key.value || '2') || '2').trim() || '2'; } catch (e) {}
            this.restart_current_view(true); break;
        case 2031:
            try { this.properties.apple_token.value = String(utils.InputBox('Enter the Apple Music developer token. Leave empty to remove it.', window.Name, this.properties.apple_token.value) || '').trim(); } catch (e2) {}
            this.restart_current_view(true); break;
        case 2032:
            try { this.properties.apple_storefront.value = String(utils.InputBox('Enter a two-letter Apple Music storefront code, for example gb or us.', window.Name, this.properties.apple_storefront.value) || 'gb').toLowerCase().replace(/[^a-z]/g, '').substring(0, 2) || 'gb'; } catch (e3) {}
            this.restart_current_view(true); break;
        case 2033: utils.MessageBox(this.identity_text(), 'Album Notes identity', 0); break;
        case 2034:
            try {
                var mbid = this.clean_mbid(utils.InputBox('Enter a MusicBrainz release-group MBID for the current album.', window.Name, this.identity.release_group_mbid));
                if (mbid.length) { this.identity.release_group_mbid = mbid; this.identity.match_method = 'manual release-group MBID'; this.save_identity(true); this.restart_current_view(true); }
                else utils.MessageBox('That value is not a valid MusicBrainz release-group MBID.', window.Name, 0);
            } catch (e4) {}
            break;
        case 2035: this.forget_identity(); this.restart_current_view(true); break;
        case 2036: utils.SetClipboardText(this.identity.release_group_mbid); break;
        case 2040: DarkOneNetwork.setApiHeaderProfile('application'); this.restart_current_view(true); break;
        case 2041: DarkOneNetwork.setApiHeaderProfile('chrome'); this.restart_current_view(true); break;
        case 2042: DarkOneNetwork.setHtmlHeaderProfile('application'); this.restart_current_view(true); break;
        case 2043: DarkOneNetwork.setHtmlHeaderProfile('chrome'); this.restart_current_view(true); break;
        case 2050:
            this.generation++; this.cancel_requests();
            for (var ci = 0; ci < this.note_source_defs.length; ci++) if (this.note_source_defs[ci].key != 'allmusic') this.clear_source_cache(this.note_source_defs[ci].key);
            this.allmusic.delete_cache(true); this.allmusic.clear_blocked_state(); this.allmusic.reset(); this.begin_notes(true); break;
        case 2051: this.delete_current_cache(); break;
        case 2052: this.open_source(); break;
        case 2053: utils.SetClipboardText(this.source_url); break;
        case 2054: utils.MessageBox(this.format_diagnostics(), 'Album Notes retrieval diagnostics', 0); break;
        case 2055: utils.SetClipboardText(this.displayed_notes()); break;
        case 2056: utils.SetClipboardText(this.format_diagnostics()); break;
        case 2120: this.set_priority(['allmusic', 'theaudiodb', 'wikipedia', 'applemusic']); break;
        case 2121: this.set_priority(['theaudiodb', 'wikipedia', 'applemusic', 'allmusic']); break;
        }

        if (idx >= 2010 && idx <= 2013) {
            var source_index = idx - 2010, source_key = this.note_source_defs[source_index].key;
            this.set_source_enabled(source_key, !this.source_enabled(source_key));
            if (source_key == 'applemusic' && this.source_enabled(source_key) && !String(this.properties.apple_token.value || '').trim().length) this.rbtn_up_done(2031);
        } else if (idx >= 2025 && idx <= 2028) {
            var browse_key = this.note_source_defs[idx - 2025].key;
            if (this.source_enabled(browse_key)) { this.properties.browse_source.value = browse_key; this.properties.notes_mode.value = 1; this.restart_current_view(true); }
        } else if (idx >= 2100 && idx <= 2107) {
            var priority_index = Math.floor((idx - 2100) / 2), priority_order = this.get_priority();
            if (priority_index < priority_order.length) this.move_priority(priority_order[priority_index], (idx - 2100) % 2 == 0 ? -1 : 1);
        } else if (idx >= 2200 && idx <= 2224) {
            var cache_source_index = Math.floor((idx - 2200) / 10), cache_option = (idx - 2200) % 10;
            var cache_sources2 = ['theaudiodb', 'wikipedia', 'applemusic'], cache_values2 = [1, 7, 14, 30, 0];
            if (cache_source_index < cache_sources2.length && cache_option < cache_values2.length) {
                this.cache_properties[cache_sources2[cache_source_index]].value = cache_values2[cache_option];
                if (this.active_source == cache_sources2[cache_source_index]) this.restart_current_view(false);
            }
        }
        this.dispose_custom_menus();
    };

    this.dispose = function () { this.disposed = true; this.dispose_custom_menus(); this.clear_allmusic_activation_guard(); this.cancel_requests(); this.clear_layout(); this.allmusic.dispose(); this.musicbrainz.dispose(); };

    panel.text_objects.push(this);
    this.x = x; this.y = y; this.w = w; this.h = h; this.ha = h - _scale(24);
    this.mx = 0; this.my = 0; this.offset = 0; this.text_height = 0; this.scroll_step = 0;
    this.text_layout = null; this.text = ''; this.display_text = ''; this.status = ''; this.error = false;
    this.artist = ''; this.album = ''; this.album_clean = ''; this.active_source = ''; this.source_url = ''; this.content_type = '';
    this.failed_sources = {}; this.attempted_sources = {}; this.diagnostics = {}; this.result_info = {};
    this.requests = {}; this.watchdogs = {}; this.request_timers = []; this.request_timeout_ms = 15000;
    this.generation = 0; this.disposed = false; this.force_reload = false; this.identity_lookup_pending = false;
    this.allmusic_activation_timer = 0;
    this.identity_file = folders.data + 'darkonejsp3.album-identity.json';
    this.identity_map = this.load_identity_map();
    this.identity = { release_group_mbid : '', release_mbid : '', artist_mbid : '', match_method : '' };
    this.dynamic_menus = [];
    this.allmusic = new _allmusic(x, y, w, h, { managed : true, source_enabled : function (key) { return self.source_enabled(key); }, is_active : function () { return self.properties.view.value == 0 && self.active_source == 'allmusic'; }, on_terminal : function (result) { self.on_allmusic_terminal(result); } });
    this.musicbrainz = new _musicbrainz(x, y, w, h, { managed : true });
    this.musicbrainz.properties.mode.value = Math.max(0, Number(this.properties.view.value) - 1);
    this.up_btn = new _sb(chars.up, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset < 0; }, this), _.bind(function () { this.wheel(1); }, this));
    this.down_btn = new _sb(chars.down, this.x, this.y, _scale(12), _scale(12), _.bind(function () { return this.offset > this.ha - this.text_height; }, this), _.bind(function () { this.wheel(-1); }, this));
}
