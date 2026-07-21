// DarkOneJSP3 shared network coordination for JSP3 panels.
// Coordinates provider pacing, AllMusic backoff and separate API/HTML
// request-identity profiles used by Album Notes providers.

var DarkOneNetwork = typeof DarkOneNetwork != 'undefined' ? DarkOneNetwork : (function () {
    var NOTIFY_NAME = 'DarkOneJSP3.Network.State';
    var STATE_FILE = folders.data + 'darkonejsp3.network-state.json';
    var MB_INTERVAL_DEFAULT = 1100;
    var ALLMUSIC_BACKOFF_DEFAULT = 30 * 60 * 1000;
    var APPLICATION_VERSION = '0.6.2';
    var CHROME_MAJOR_VERSION = '150';
    var HEADER_PROFILE_APPLICATION = 'application';
    var HEADER_PROFILE_CHROME = 'chrome';
    var local_musicbrainz_next = 0;
    var local_provider_next = {};
    var local_allmusic_backoff_until = 0;
    var local_api_header_profile = '';
    var local_html_header_profile = '';

    function number(value, fallback) {
        value = Number(value);
        return isNaN(value) ? fallback : value;
    }

    function normalise_header_profile(value) {
        return String(value || '').toLowerCase() == HEADER_PROFILE_CHROME ? HEADER_PROFILE_CHROME : HEADER_PROFILE_APPLICATION;
    }

    function load() {
        var state = {};
        try {
            if (utils.IsFile(STATE_FILE)) {
                var parsed = JSON.parse(utils.ReadUTF8(STATE_FILE));
                if (parsed && typeof parsed == 'object') state = parsed;
            }
        } catch (e) {}
        return state;
    }

    function save(state) {
        try {
            utils.CreateFolder(folders.data);
            _save(STATE_FILE, JSON.stringify(state, null, 2));
        } catch (e) {}
    }

    function broadcast(payload) {
        try { window.NotifyOthers(NOTIFY_NAME, JSON.stringify(payload)); } catch (e) {}
    }

    function get_api_header_profile() {
        if (local_api_header_profile.length) return local_api_header_profile;
        var state = load();
        local_api_header_profile = normalise_header_profile(state.api_header_profile || state.header_profile);
        return local_api_header_profile;
    }

    function set_api_header_profile(value) {
        var profile = normalise_header_profile(value);
        var state = load();
        state.api_header_profile = profile;
        local_api_header_profile = profile;
        save(state);
        broadcast({ scope : 'headers-api', profile : profile });
        return profile;
    }

    function get_html_header_profile() {
        if (local_html_header_profile.length) return local_html_header_profile;
        var state = load();
        local_html_header_profile = normalise_header_profile(state.html_header_profile || state.header_profile);
        return local_html_header_profile;
    }

    function set_html_header_profile(value) {
        var profile = normalise_header_profile(value);
        var state = load();
        state.html_header_profile = profile;
        local_html_header_profile = profile;
        save(state);
        broadcast({ scope : 'headers-html', profile : profile });
        return profile;
    }

    function get_legacy_header_profile() {
        return get_html_header_profile();
    }

    function set_legacy_header_profile(value) {
        var profile = normalise_header_profile(value);
        var state = load();
        state.header_profile = profile;
        state.api_header_profile = profile;
        state.html_header_profile = profile;
        local_api_header_profile = profile;
        local_html_header_profile = profile;
        save(state);
        broadcast({ scope : 'headers', profile : profile });
        return profile;
    }

    function application_user_agent(contact) {
        contact = String(contact || '').replace(/^\s+|\s+$/g, '');
        return 'DarkOneJSP3/' + APPLICATION_VERSION + ' (foobar2000 JScript Panel 3' + (contact ? '; ' + contact : '') + ')';
    }

    function chrome_user_agent() {
        return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + CHROME_MAJOR_VERSION + '.0.0.0 Safari/537.36';
    }

    function add_chrome_client_hints(values) {
        values['Sec-CH-UA'] = '"Chromium";v="' + CHROME_MAJOR_VERSION + '", "Google Chrome";v="' + CHROME_MAJOR_VERSION + '", "Not_A Brand";v="99"';
        values['Sec-CH-UA-Mobile'] = '?0';
        values['Sec-CH-UA-Platform'] = '"Windows"';
        return values;
    }

    function json_headers(contact, extra) {
        var values;
        if (get_api_header_profile() == HEADER_PROFILE_CHROME) {
            values = add_chrome_client_hints({
                'User-Agent' : chrome_user_agent(),
                'Accept' : 'application/json',
                'Accept-Language' : 'en-GB,en;q=0.9',
                'Cache-Control' : 'no-cache',
                'Pragma' : 'no-cache'
            });
        } else {
            values = {
                'User-Agent' : application_user_agent(contact),
                'Accept' : 'application/json'
            };
        }
        if (extra && typeof extra == 'object') {
            for (var key in extra) if (Object.prototype.hasOwnProperty.call(extra, key)) values[key] = extra[key];
        }
        return JSON.stringify(values);
    }

    function allmusic_referer(url) {
        var match = String(url || '').match(/^(https?:\/\/(?:www\.)?allmusic\.com\/album\/[^\/?#]+)/i);
        return match ? match[1].replace(/^http:/i, 'https:') + '/' : 'https://www.allmusic.com/';
    }

    function allmusic_headers(url, kind) {
        var is_ajax = kind == 'allmusic-review-ajax';
        var referer = allmusic_referer(url);
        if (get_html_header_profile() != HEADER_PROFILE_CHROME) {
            return JSON.stringify({
                'User-Agent' : application_user_agent(''),
                'Referer' : referer,
                'Accept' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language' : 'en-GB,en;q=0.9'
            });
        }
        var values = add_chrome_client_hints({
            'User-Agent' : chrome_user_agent(),
            'Referer' : referer,
            'Accept-Language' : 'en-GB,en;q=0.9',
            'Cache-Control' : 'no-cache',
            'Pragma' : 'no-cache',
            'Sec-Fetch-Site' : 'same-origin'
        });
        if (is_ajax) {
            values.Accept = 'text/html, */*; q=0.01';
            values['X-Requested-With'] = 'XMLHttpRequest';
            values['Sec-Fetch-Dest'] = 'empty';
            values['Sec-Fetch-Mode'] = 'cors';
        } else {
            values.Accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
            values['Upgrade-Insecure-Requests'] = '1';
            values['Sec-Fetch-Dest'] = 'document';
            values['Sec-Fetch-Mode'] = 'navigate';
            values['Sec-Fetch-User'] = '?1';
        }
        return JSON.stringify(values);
    }

    function musicbrainz_headers(contact) { return json_headers(contact, null); }
    function theaudiodb_headers() { return json_headers('', null); }
    function wikipedia_headers() { return json_headers('', { 'Api-User-Agent' : application_user_agent('') }); }
    function apple_music_headers(token) { return json_headers('', { 'Authorization' : 'Bearer ' + String(token || '') }); }

    function header_profile_label(scope) {
        var profile = scope == 'api' ? get_api_header_profile() : get_html_header_profile();
        return profile == HEADER_PROFILE_CHROME ? 'Google Chrome ' + CHROME_MAJOR_VERSION + '-style' : 'DarkOneJSP3 application';
    }

    function normalise_future_timestamp(value, now, maximum_ahead) {
        value = number(value, 0);
        if (value < now - 1000 || value > now + maximum_ahead) return 0;
        return value;
    }

    function reserve_musicbrainz(interval, minimum_delay) {
        var now = Date.now();
        interval = Math.max(1000, number(interval, MB_INTERVAL_DEFAULT));
        minimum_delay = Math.max(0, number(minimum_delay, 0));
        var state = load();
        var disk_next = normalise_future_timestamp(state.musicbrainz_next_allowed, now, 60000);
        var local_next = normalise_future_timestamp(local_musicbrainz_next, now, 60000);
        var scheduled = Math.max(now + minimum_delay, disk_next, local_next);
        var next_allowed = scheduled + interval;
        local_musicbrainz_next = next_allowed;
        state.musicbrainz_next_allowed = next_allowed;
        save(state);
        broadcast({ scope : 'musicbrainz', next_allowed : next_allowed });
        return Math.max(0, scheduled - now);
    }

    function reserve_provider(key, interval, minimum_delay) {
        key = String(key || 'generic').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'generic';
        if (key == 'musicbrainz') return reserve_musicbrainz(interval, minimum_delay);
        var now = Date.now();
        interval = Math.max(0, number(interval, 0));
        minimum_delay = Math.max(0, number(minimum_delay, 0));
        var state = load();
        if (!state.provider_next_allowed || typeof state.provider_next_allowed != 'object') state.provider_next_allowed = {};
        var disk_next = normalise_future_timestamp(state.provider_next_allowed[key], now, 60000);
        var local_next = normalise_future_timestamp(local_provider_next[key], now, 60000);
        var scheduled = Math.max(now + minimum_delay, disk_next, local_next);
        var next_allowed = scheduled + interval;
        local_provider_next[key] = next_allowed;
        state.provider_next_allowed[key] = next_allowed;
        save(state);
        broadcast({ scope : 'provider', key : key, next_allowed : next_allowed });
        return Math.max(0, scheduled - now);
    }

    function set_allmusic_backoff(duration) {
        var now = Date.now();
        var until = now + Math.max(60000, number(duration, ALLMUSIC_BACKOFF_DEFAULT));
        var state = load();
        state.allmusic_backoff_until = until;
        local_allmusic_backoff_until = until;
        save(state);
        broadcast({ scope : 'allmusic', backoff_until : until });
        return until;
    }

    function clear_allmusic_backoff() {
        var state = load();
        state.allmusic_backoff_until = 0;
        local_allmusic_backoff_until = 0;
        save(state);
        broadcast({ scope : 'allmusic', backoff_until : 0 });
    }

    function allmusic_backoff_until() {
        var now = Date.now();
        var state = load();
        var disk = number(state.allmusic_backoff_until, 0);
        var until = Math.max(local_allmusic_backoff_until, disk);
        if (until <= now) {
            if (disk) { state.allmusic_backoff_until = 0; save(state); }
            local_allmusic_backoff_until = 0;
            return 0;
        }
        local_allmusic_backoff_until = until;
        return until;
    }

    function is_allmusic_backoff_active() { return allmusic_backoff_until() > Date.now(); }

    function on_notify(name, info) {
        if (name != NOTIFY_NAME) return false;
        var payload = info;
        if (typeof payload == 'string') {
            try { payload = JSON.parse(payload); } catch (e) { return true; }
        }
        if (!payload || typeof payload != 'object') return true;
        if (payload.scope == 'musicbrainz') local_musicbrainz_next = Math.max(local_musicbrainz_next, number(payload.next_allowed, 0));
        else if (payload.scope == 'provider') local_provider_next[payload.key] = Math.max(number(local_provider_next[payload.key], 0), number(payload.next_allowed, 0));
        else if (payload.scope == 'allmusic') local_allmusic_backoff_until = Math.max(0, number(payload.backoff_until, 0));
        else if (payload.scope == 'headers-api') local_api_header_profile = normalise_header_profile(payload.profile);
        else if (payload.scope == 'headers-html') local_html_header_profile = normalise_header_profile(payload.profile);
        else if (payload.scope == 'headers') {
            local_api_header_profile = normalise_header_profile(payload.profile);
            local_html_header_profile = local_api_header_profile;
        }
        return true;
    }

    return {
        reserveMusicBrainz : reserve_musicbrainz,
        reserveProvider : reserve_provider,
        setAllMusicBackoff : set_allmusic_backoff,
        clearAllMusicBackoff : clear_allmusic_backoff,
        allMusicBackoffUntil : allmusic_backoff_until,
        isAllMusicBackoffActive : is_allmusic_backoff_active,
        getHeaderProfile : get_legacy_header_profile,
        setHeaderProfile : set_legacy_header_profile,
        getApiHeaderProfile : get_api_header_profile,
        setApiHeaderProfile : set_api_header_profile,
        getHtmlHeaderProfile : get_html_header_profile,
        setHtmlHeaderProfile : set_html_header_profile,
        headerProfileLabel : header_profile_label,
        applicationUserAgent : application_user_agent,
        chromeUserAgent : chrome_user_agent,
        allMusicHeaders : allmusic_headers,
        musicBrainzHeaders : musicbrainz_headers,
        theAudioDBHeaders : theaudiodb_headers,
        wikipediaHeaders : wikipedia_headers,
        appleMusicHeaders : apple_music_headers,
        onNotify : on_notify
    };
})();
