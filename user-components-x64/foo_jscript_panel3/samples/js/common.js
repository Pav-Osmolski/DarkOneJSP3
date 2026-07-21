function _artistFolder(artist) {
	var folder = folders.artists + utils.ReplaceIllegalChars(artist, true, true);
	utils.CreateFolder(folder);
	return folder + '\\';
}

function _button(x, y, w, h, normal, hover, fn, tiptext) {
	this.paint = function (gr) {
		if (this.current.char) {
			gr.WriteTextSimple(this.current.char, this.font, this.current.colour, this.x, this.y, this.w, this.h, 2, 2);
		} else if (this.current.img) {
			_drawImage(gr, this.current.img, this.x, this.y, this.w, this.h, image.full);
		}
	}

	this.containsXY = function (x, y) {
		return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
	}

	this.lbtn_up = function (x, y, mask) {
		if (this.fn) {
			this.fn(x, y, mask);
		}
	}

	this.cs = function (s) {
		if (s == 'hover') {
			this.current = this.hover;
			_tt(this.tiptext);
		} else {
			this.current = this.normal;
		}

		window.RepaintRect(this.x, this.y, this.w, this.h);
	}

	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;
	this.fn = fn;
	this.tiptext = tiptext;
	this.normal = normal;
	this.hover = hover || normal;
	this.current = normal;

	if (this.current.char) {
		this.font = JSON.stringify({Name:'Segoe Fluent Icons',Size:this.h - _scale(10)});
	}
}

function _buttons() {
	this.paint = function (gr) {
		_.invoke(this.buttons, 'paint', gr);
	}

	this.move = function (x, y) {
		var temp_btn = null;
		_.forEach(this.buttons, function (item, i) {
			if (item.containsXY(x, y)) {
				temp_btn = i;
			}
		});

		if (this.btn == temp_btn) {
			return this.btn;
		}

		if (this.btn) {
			this.buttons[this.btn].cs('normal');
		}

		if (temp_btn) {
			this.buttons[temp_btn].cs('hover');
		} else {
			_tt('');
		}

		this.btn = temp_btn;
		return this.btn;
	}

	this.leave = function () {
		if (this.btn) {
			_tt('');
			this.buttons[this.btn].cs('normal');
		}

		this.btn = null;
	}

	this.lbtn_up = function (x, y, mask) {
		if (this.btn) {
			this.buttons[this.btn].lbtn_up(x, y, mask);
			return true;
		}

		return false;
	}

	this.change_font = function (name) {
		_.forEach(this.buttons, function (item) {
			item.font = JSON.stringify({Name:name,Size:item.h - _scale(10)});
		});
	}

	this.buttons = {};
	this.btn = null;
}

function _clamp(value, min, max) {
	if (value < min)
		return min;
	else if (value > max)
		return max;
	else
		return value;
}

function _dispose() {
	_.forEach(arguments, function (item) {
		if (item) {
			item.Dispose();
		}
	});
}

function _drawImageOrBitmap(gr, img, dst_x, dst_y, dst_w, dst_h, src_x, src_y, src_w, src_h, opacity) {
	if (typeof img.Path == 'string') {
		gr.DrawImage(img, dst_x, dst_y, dst_w, dst_h, src_x, src_y, src_w, src_h, opacity);
	} else {
		gr.DrawBitmap(img, dst_x, dst_y, dst_w, dst_h, src_x, src_y, src_w, src_h, opacity);
	}
}

function _drawImage(gr, img, dst_x, dst_y, dst_w, dst_h, mode, opacity, border) {
	if (!img)
		return [];

	switch (true) {
	case (dst_w == dst_h && img.Width == img.Height) || (dst_w == img.Width && dst_h == img.Height):
	case mode == image.stretch:
		_drawImageOrBitmap(gr, img, dst_x, dst_y, dst_w, dst_h, 0, 0, img.Width, img.Height, opacity || 1);
		break;
	case mode == image.crop:
	case mode == image.crop_top:
		if (img.Width / img.Height < dst_w / dst_h) {
			var src_x = 0;
			var src_w = img.Width;
			var src_h = Math.round(dst_h * img.Width / dst_w);
			var src_y = Math.round((img.Height - src_h) / (mode == image.crop_top ? 4 : 2));
		} else {
			var src_y = 0;
			var src_w = Math.round(dst_w * img.Height / dst_h);
			var src_h = img.Height;
			var src_x = Math.round((img.Width - src_w) / 2);
		}

		_drawImageOrBitmap(gr, img, dst_x, dst_y, dst_w, dst_h, src_x + 3, src_y + 3, src_w - 6, src_h - 6, opacity || 1);
		break;
	case mode == image.full:
	case mode == image.full_top_align:
	default:
		var s = Math.min(dst_w / img.Width, dst_h / img.Height);
		var w = Math.floor(img.Width * s);
		var h = Math.floor(img.Height * s);
		dst_x += Math.round((dst_w - w) / 2);
		dst_y = mode == image.full_top_align ? dst_y : dst_y + Math.round((dst_h - h) / 2);
		dst_w = w;
		dst_h = h;

		_drawImageOrBitmap(gr, img, dst_x, dst_y, dst_w, dst_h, 0, 0, img.Width, img.Height, opacity || 1);
		break;
	}

	if (border) {
		DrawRectangle(gr, dst_x, dst_y, dst_w, dst_h, border);
	}

	return [dst_x, dst_y, dst_w, dst_h];
}

function _drawOverlay(gr, x, y, w, h, alpha) {
	gr.FillRectangle(x, y, w, h, RGBA(0, 0, 0, alpha || 230));
}

function _explorer(file) {
	if (utils.IsFile(file)) {
		utils.Run('explorer', '/select,' + _q(file));
	}
}

function _fbEscape(value) {
	if (typeof value != 'string')
		return '';

	return value.replace(/'/g, "''").replace(/[\(\)\[\],$]/g, "'$&'");
}

function _fileExpired(file, period) {
	return Math.floor(Date.now() / 1000) - utils.GetLastModified(file) > period;
}

function _firstElement(obj, tag_name) {
	try {
		return _.first(obj.getElementsByTagName(tag_name));
	} catch (e) {}

	return undefined;
}

function _formatNumber(number, separator) {
	return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

function _getElementsByTagName(value, tag) {
	doc.open();
	var div = doc.createElement('div');
	div.innerHTML = value;
	var data = div.getElementsByTagName(tag);
	doc.close();
	return data;
}

function _getExt(path) {
	return path.split('.').pop().toLowerCase();
}

function _getFiles(folder, exts) {
	var files = [];

	if (_.isArray(folder)) {
		folder.forEach(function (item) {
			Array.prototype.push.apply(files, utils.ListFiles(item).toArray());
		});
	} else {
		files = utils.ListFiles(folder).toArray();
	}

	if (!exts) {
		return files;
	}

	return _.filter(files, function (item) {
		var ext = _getExt(item);
		return _.includes(exts, ext);
	});
}

function _help(x, y, flags) {
	var menu = window.CreatePopupMenu();
	_.forEach(ha_links, function (item, i) {
		menu.AppendMenuItem(MF_STRING, i + 100, item[0]);

		if (i == 1) {
			menu.AppendMenuSeparator();
		}
	});
	menu.AppendMenuSeparator();
	menu.AppendMenuItem(MF_STRING, 1, 'Configure...');

	var idx = menu.TrackPopupMenu(x, y, flags);
	menu.Dispose();

	switch (idx) {
	case 0:
		break;
	case 1:
		window.ShowConfigure();
		break;
	default:
		utils.Run(ha_links[idx - 100][1]);
		break;
	}
}

function _isUUID(value) {
	var re = /^[0-9a-f]{8}-[0-9a-f]{4}-[345][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
	return re.test(value);
}

function _jsonParse(value) {
	try {
		var data = JSON.parse(value);
		return data;
	} catch (e) {
		return [];
	}
}

function _jsonParseFile(file) {
	return _jsonParse(utils.ReadUTF8(file));
}

function _lockSize(w, h) {
	window.MinWidth = window.MaxWidth = w;
	window.MinHeight = window.MaxHeight = h;
}

function _menu(x, y, flags) {
	var menu = window.CreatePopupMenu();
	var file = new _main_menu_helper('File', 10000, menu);
	var edit = new _main_menu_helper('Edit', 20000, menu);
	var view = new _main_menu_helper('View', 30000, menu);
	var playback = new _main_menu_helper('Playback', 40000, menu);
	var library = new _main_menu_helper('Library', 50000, menu);
	var help = new _main_menu_helper('Help', 60000, menu);

	var idx = menu.TrackPopupMenu(x, y, flags);
	menu.Dispose();

	switch (true) {
	case idx == 0:
		break;
	case idx < 20000:
		file.mm.ExecuteByID(idx - 10000);
		break;
	case idx < 30000:
		edit.mm.ExecuteByID(idx - 20000);
		break;
	case idx < 40000:
		view.mm.ExecuteByID(idx - 30000);
		break;
	case idx < 50000:
		playback.mm.ExecuteByID(idx - 40000);
		break;
	case idx < 60000:
		library.mm.ExecuteByID(idx - 50000);
		break;
	case idx < 70000:
		help.mm.ExecuteByID(idx - 60000);
		break;
	}

	file.mm.Dispose();
	edit.mm.Dispose();
	view.mm.Dispose();
	playback.mm.Dispose();
	library.mm.Dispose();
	help.mm.Dispose();
}

function _main_menu_helper(name, base_id, main_menu) {
	this.popup = window.CreatePopupMenu();
	this.mm = fb.CreateMainMenuManager(name);
	this.mm.BuildMenu(this.popup, base_id);
	this.popup.AppendTo(main_menu, MF_STRING, name);
}

function _p(name, default_) {
	Object.defineProperty(this, _.isBoolean(default_) ? 'enabled' : 'value', {
		get : function () {
			return this.val;
		},
		set : function (value) {
			this.val = value;
			window.SetProperty(this.name, this.val);
		}
	});

	this.toggle = function () {
		this.val = !this.val;
		window.SetProperty(this.name, this.val);
	}

	this.name = name;
	this.default_ = default_;
	this.val = window.GetProperty(name, default_);
}

function _q(value) {
	return '"' + value + '"';
}

function _save(file, value) {
	if (utils.WriteTextFile(file, value))
		return true;

	console.log(N, 'Error saving to ' + file);
	return false;
}

function _sb(ch, x, y, w, h, v, fn) {
	this.paint = function (gr, colour) {
		if (this.v()) {
			gr.WriteTextSimple(this.ch, this.font, colour, this.x, this.y, this.w, this.h, 2, 2);
		}
	}

	this.containsXY = function (x, y) {
		return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h && this.v();
	}

	this.move = function (x, y) {
		if (!this.containsXY(x, y))
			return false;

		window.SetCursor(IDC_HAND);
		return true;
	}

	this.lbtn_up = function (x, y) {
		if (!this.containsXY(x, y))
			return false;

		if (this.fn) {
			this.fn(x, y);
		}

		return true;
	}

	this.ch = ch;
	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;
	this.v = v;
	this.fn = fn;
	this.font = JSON.stringify({Name:'Segoe Fluent Icons',Size:h});
}

function _scale(size) {
	return Math.round(size * DPI / 72);
}

function _stringToArray(str, sep) {
	if (typeof str != 'string' || typeof sep != 'string')
		return [];

	return str.split(sep).map(function (item) { return item.trim(); }).filter(function (item) { return !item.empty(); });
}

function _stripTags(value) {
	doc.open();
	var div = doc.createElement('div');
	div.innerHTML = value.toString().replace(/<[Pp][^>]*>/g, '').replace(/<\/[Pp]>/g, '<br>').replace(/\n/g, '<br>');
	var tmp = div.innerText.trim();
	doc.close();
	return tmp;
}

function _tagged(value) {
	return value != '' && value != '?';
}

function _tt(value) {
	if (tooltip.Text != value) {
		tooltip.Text = value;
		tooltip.Activate();
	}
}

var doc = new ActiveXObject('htmlfile');

var CRLF = '\r\n';
var ONE_DAY = 86400;
var DEFAULT_ARTIST = '$meta(artist,0)';
var N = window.Name + ':';
var LM = _scale(5);
var TM = _scale(22);

var tooltip = window.CreateTooltip('Segoe UI', _scale(12));
tooltip.SetMaxWidth(800);

var folders = {};
folders.home = fb.ComponentPath + 'samples\\';
folders.images = folders.home + 'images\\';
folders.data = fb.ProfilePath + 'js_data\\';
folders.artists = folders.data + 'artists\\';
folders.lastfm = folders.data + 'lastfm\\';

var image = {
	crop : 0,
	crop_top : 1,
	stretch : 2,
	full : 3,
	full_top_align : 4,
};

var ha_links = [
	['Title Formatting Reference', 'https://wiki.hydrogenaud.io/index.php?title=Foobar2000:Title_Formatting_Reference'],
	['Query Syntax', 'https://wiki.hydrogenaud.io/index.php?title=Foobar2000:Query_syntax'],
	['Homepage', 'https://www.foobar2000.org/'],
	['Components', 'https://www.foobar2000.org/components'],
	['Wiki', 'https://wiki.hydrogenaud.io/index.php?title=Foobar2000:Foobar2000'],
	['Forums', 'https://hydrogenaud.io/index.php/board,28.0.html']
];

// == DARKONEJSP3 SHARED NETWORK COORDINATOR ==
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
// == END DARKONEJSP3 SHARED NETWORK COORDINATOR ==
