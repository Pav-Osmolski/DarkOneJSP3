function _queue_viewer(x, y, w, h) {
    function parseQueueIndexes(value) {
        if (!value) return [];
        var matches = String(value).match(/\d+/g);
        if (!matches) return [];
        var result = [];
        for (var i = 0; i < matches.length; i++) {
            var index = parseInt(matches[i], 10);
            if (!isNaN(index) && index > 0 && result.indexOf(index) === -1) result.push(index);
        }
        return result;
    }

    this.containsXY = function (x, y) {
        return x >= this.x && x < this.x + this.w && y >= this.y && y < this.y + this.h;
    }

    this.row_at = function (x, y) {
        if (!this.containsXY(x, y)) return -1;
        var index = Math.floor((y - this.y - _scale(12)) / panel.row_height) + this.offset;
        return index >= this.offset && index < Math.min(this.count, this.offset + this.rows) ? index : -1;
    }

    this.release_scan_items = function (state) {
        state = state || this.scan_state;
        if (state && state.items) {
            try { state.items.Dispose(); } catch (e) {}
            state.items = null;
        }
    }

    this.font_changed = function () {
        this.size();
        window.Repaint();
    }

    this.header_text = function () {
        if (this.scanning) return 'Queue Viewer — scanning ' + this.progress + '%';
        if (this.scan_timer) return 'Queue Viewer — preparing scan';
        return 'Queue Viewer';
    }

    this.focus_row = function (index) {
        if (index < 0 || index >= this.count) return false;
        var row = this.data[index];
        try {
            if (row.playlist_index < 0 || row.playlist_index >= plman.PlaylistCount) return false;
            if (row.playlist_item_index < 0 || row.playlist_item_index >= plman.GetPlaylistItemCount(row.playlist_index)) return false;
            plman.ActivePlaylist = row.playlist_index;
            plman.ClearPlaylistSelection(row.playlist_index);
            plman.SetPlaylistSelectionSingle(row.playlist_index, row.playlist_item_index, true);
            plman.SetPlaylistFocusItem(row.playlist_index, row.playlist_item_index);
            this.selected_index = index;
            window.RepaintRect(this.x, this.y, this.w, this.h);
            return true;
        } catch (e) {
            console.log('[DarkOneJSP3 Queue Viewer] Could not focus source playlist item: ' + e.message);
            this.request_scan(false, 0);
            return false;
        }
    }

    this.scroll_by = function (rows) {
        if (this.count <= this.rows) return false;
        var next = Math.max(0, Math.min(this.count - this.rows, this.offset + rows));
        if (next === this.offset) return false;
        this.offset = next;
        this.hover_index = -1;
        window.RepaintRect(this.x, this.y, this.w, this.h);
        return true;
    }

    this.key_down = function (k) {
        switch (k) {
        case VK_UP:
            return this.scroll_by(-1);
        case VK_DOWN:
            return this.scroll_by(1);
        case VK_RETURN:
            return this.focus_row(this.selected_index >= 0 ? this.selected_index : this.offset);
        default:
            return false;
        }
    }

    this.leave = function () {
        if (this.hover_index !== -1) {
            this.hover_index = -1;
            window.RepaintRect(this.x, this.y, this.w, this.h);
        }
    }

    this.lbtn_up = function (x, y) {
        if (!this.containsXY(x, y)) return false;
        this.up_btn.lbtn_up(x, y);
        this.down_btn.lbtn_up(x, y);
        var row = this.row_at(x, y);
        if (row >= 0 && row !== this.selected_index) {
            this.selected_index = row;
            window.RepaintRect(this.x, this.y, this.w, this.h);
        }
        return true;
    }

    this.lbtn_dblclk = function (x, y) {
        var row = this.row_at(x, y);
        return row >= 0 ? this.focus_row(row) : false;
    }

    this.move = function (x, y) {
        this.mx = x;
        this.my = y;
        window.SetCursor(IDC_ARROW);
        if (!this.containsXY(x, y)) {
            this.leave();
            return false;
        }
        if (this.up_btn.move(x, y) || this.down_btn.move(x, y)) return true;
        var next = this.row_at(x, y);
        if (next !== this.hover_index) {
            this.hover_index = next;
            window.RepaintRect(this.x, this.y, this.w, this.h);
        }
        return true;
    }

    this.paint = function (gr) {
        if (this.count === 0) {
            var message = this.scanning
                ? 'Scanning playback queue… ' + this.progress + '%'
                : (this.scan_timer
                    ? 'Preparing playback queue scan…'
                    : (this.has_scanned ? 'Playback queue is empty.' : 'Queue scan is deferred until this tab is opened.'));
            gr.WriteTextSimple(message, panel.fonts.normal, panel.colours.text,
                this.x, this.y + _scale(12), this.w, panel.row_height,
                DWRITE_TEXT_ALIGNMENT_CENTER, DWRITE_PARAGRAPH_ALIGNMENT_CENTER,
                DWRITE_WORD_WRAPPING_NO_WRAP, DWRITE_TRIMMING_GRANULARITY_CHARACTER);
        } else {
            var visible = Math.min(this.rows, this.count - this.offset);
            for (var i = 0; i < visible; i++) {
                var index = i + this.offset;
                var row = this.data[index];
                var rowY = this.y + _scale(12) + (i * panel.row_height);
                if (index === this.selected_index) {
                    gr.FillRectangle(this.x, rowY, this.w, panel.row_height, setAlpha(panel.colours.highlight, 34));
                } else if (index === this.hover_index) {
                    gr.FillRectangle(this.x, rowY, this.w, panel.row_height, setAlpha(panel.colours.highlight, 20));
                }
                gr.WriteTextSimple(row.queue_index + '.  ' + row.text, panel.fonts.normal,
                    index === this.hover_index || index === this.selected_index ? panel.colours.highlight : panel.colours.text,
                    this.x, rowY, this.w, panel.row_height,
                    DWRITE_TEXT_ALIGNMENT_LEADING, DWRITE_PARAGRAPH_ALIGNMENT_CENTER,
                    DWRITE_WORD_WRAPPING_NO_WRAP, DWRITE_TRIMMING_GRANULARITY_CHARACTER);
            }
        }
        this.up_btn.paint(gr, panel.colours.text);
        this.down_btn.paint(gr, panel.colours.text);
    }

    this.playback_queue_changed = function () {
        if (this.scanning || this.scan_timer) this.cancel_scan();
        this.dirty = true;
        window.Repaint();
    }

    this.rbtn_up = function () {
        panel.m.AppendMenuItem(MF_STRING, 1400, 'Item display title formatting...');
        panel.m.AppendMenuItem(MF_STRING, 1401, 'Re-scan playback queue');
        panel.m.AppendMenuItem(EnableMenuIf(this.selected_index >= 0 || this.hover_index >= 0), 1402, 'Show source playlist item');
        panel.m.AppendMenuSeparator();
    }

    this.rbtn_up_done = function (idx) {
        switch (idx) {
        case 1400:
            try {
                var value = utils.InputBox('Enter title formatting for queue items.', window.Name, this.properties.tf.value);
                if (!value.empty()) {
                    this.properties.tf.value = value;
                    this.tfo = fb.TitleFormat(value);
                    this.request_scan(true, 0);
                }
            } catch (e) {}
            break;
        case 1401:
            this.request_scan(true, 0);
            break;
        case 1402:
            this.focus_row(this.hover_index >= 0 ? this.hover_index : this.selected_index);
            break;
        }
    }

    this.size = function () {
        this.offset = Math.min(this.offset, Math.max(0, this.count - 1));
        this.rows = Math.max(1, Math.floor((this.h - _scale(24)) / panel.row_height));
        if (this.offset + this.rows > this.count) this.offset = Math.max(0, this.count - this.rows);
        this.up_btn.x = this.x + Math.round((this.w - _scale(12)) * 0.5);
        this.down_btn.x = this.up_btn.x;
        this.up_btn.y = this.y;
        this.down_btn.y = this.y + this.h - _scale(12);
    }

    this.cancel_scan = function () {
        this.scan_generation++;
        if (this.scan_timer) {
            window.ClearTimeout(this.scan_timer);
            this.scan_timer = 0;
        }
        this.release_scan_items();
        this.scan_state = null;
        this.scanning = false;
        this.progress = 0;
    }

    this.request_scan = function (force_log, delay) {
        this.dirty = true;
        this.force_log = this.force_log || !!force_log;
        this.cancel_scan();
        var self = this;
        this.scan_timer = window.SetTimeout(function () {
            self.scan_timer = 0;
            self.begin_scan();
        }, Math.max(0, Number(delay) || 0));
    }

    this.begin_scan = function () {
        var generation = ++this.scan_generation;
        var playlist_count = plman.PlaylistCount;
        var total_items = 0;
        for (var i = 0; i < playlist_count; i++) {
            try { total_items += plman.GetPlaylistItemCount(i); } catch (e) {}
        }
        this.scanning = true;
        this.progress = 0;
        this.scan_state = {
            generation : generation,
            started : Date.now(),
            playlist_count : playlist_count,
            playlist_index : 0,
            item_index : 0,
            item_count : 0,
            items : null,
            processed_items : 0,
            total_items : total_items,
            data : [],
            last_repaint_at : 0,
            last_progress : -1
        };
        window.Repaint();
        this.scan_chunk(generation);
    }

    this.update_scan_progress = function (state, force) {
        var next = state.total_items > 0
            ? Math.min(99, Math.floor(state.processed_items * 100 / state.total_items))
            : (state.playlist_index >= state.playlist_count ? 100 : 0);
        var now = Date.now();
        var changed = next !== state.last_progress;
        this.progress = next;
        if (force || (changed && now - state.last_repaint_at >= 75) || now - state.last_repaint_at >= 150) {
            state.last_progress = next;
            state.last_repaint_at = now;
            window.Repaint();
        }
    }

    this.scan_chunk = function (generation) {
        if (!this.scan_state || generation !== this.scan_generation) return;
        var state = this.scan_state;
        var sliceStarted = Date.now();
        var budgetMs = 12;

        while (state.playlist_index < state.playlist_count && Date.now() - sliceStarted < budgetMs) {
            if (!state.items) {
                try {
                    state.items = plman.GetPlaylistItems(state.playlist_index);
                    state.item_count = state.items.Count;
                    state.item_index = 0;
                } catch (e) {
                    console.log('[DarkOneJSP3 Queue Viewer] Failed to read playlist ' + state.playlist_index + ': ' + e.message);
                    state.playlist_index++;
                    continue;
                }
            }

            while (state.item_index < state.item_count && Date.now() - sliceStarted < budgetMs) {
                var itemIndex = state.item_index++;
                state.processed_items++;
                try {
                    var indexes = parseQueueIndexes(this.queue_indexes_tfo.EvalPlaylistItem(state.playlist_index, itemIndex));
                    if (!indexes.length) continue;
                    var text = this.tfo.EvalPlaylistItem(state.playlist_index, itemIndex);
                    for (var n = 0; n < indexes.length; n++) {
                        state.data.push({
                            queue_index : indexes[n],
                            playlist_index : state.playlist_index,
                            playlist_item_index : itemIndex,
                            text : text
                        });
                    }
                } catch (e2) {
                    console.log('[DarkOneJSP3 Queue Viewer] Failed at playlist ' + state.playlist_index +
                        ', item ' + itemIndex + ': ' + e2.message);
                }
            }

            if (state.item_index >= state.item_count) {
                this.release_scan_items(state);
                state.item_count = 0;
                state.item_index = 0;
                state.playlist_index++;
            }
        }

        this.update_scan_progress(state, false);
        if (state.playlist_index >= state.playlist_count) {
            this.finish_scan(generation);
            return;
        }

        var self = this;
        this.scan_timer = window.SetTimeout(function () {
            self.scan_timer = 0;
            self.scan_chunk(generation);
        }, 0);
    }

    this.finish_scan = function (generation) {
        if (!this.scan_state || generation !== this.scan_generation) return;
        var state = this.scan_state;
        this.release_scan_items(state);
        state.data.sort(function (a, b) {
            if (a.queue_index !== b.queue_index) return a.queue_index - b.queue_index;
            if (a.playlist_index !== b.playlist_index) return a.playlist_index - b.playlist_index;
            return a.playlist_item_index - b.playlist_item_index;
        });
        this.data = state.data;
        this.count = this.data.length;
        this.offset = Math.min(this.offset, Math.max(0, this.count - this.rows));
        this.hover_index = -1;
        this.selected_index = this.count ? Math.min(Math.max(0, this.selected_index), this.count - 1) : -1;
        this.has_scanned = true;
        this.dirty = false;
        this.scanning = false;
        this.progress = 100;
        this.scan_state = null;
        var elapsed = Date.now() - state.started;
        if (this.force_log || elapsed >= 100) {
            console.log('[DarkOneJSP3 Queue Viewer] Scanned ' + state.processed_items + ' items across ' +
                state.playlist_count + ' playlists in ' + elapsed + ' ms; found ' + this.count + ' queue entr' +
                (this.count === 1 ? 'y' : 'ies') + '; source field: %queue_indexes%; incremental scan.');
        }
        this.force_log = false;
        window.Repaint();
    }

    this.on_visible_paint = function () {
        if ((this.dirty || !this.has_scanned) && !this.scanning && !this.scan_timer) this.request_scan(false, 25);
    }

    this.update = function (force_log) {
        this.request_scan(!!force_log, 0);
    }

    this.wheel = function (s) {
        if (!this.containsXY(this.mx, this.my)) return false;
        return this.scroll_by(-s * 3);
    }

    this.dispose = function () {
        this.cancel_scan();
        this.data = [];
        this.count = 0;
    }

    panel.list_objects.push(this);
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.mx = -1;
    this.my = -1;
    this.offset = 0;
    this.rows = 1;
    this.count = 0;
    this.data = [];
    this.hover_index = -1;
    this.selected_index = -1;
    this.dirty = true;
    this.has_scanned = false;
    this.scanning = false;
    this.progress = 0;
    this.force_log = false;
    this.scan_timer = 0;
    this.scan_generation = 0;
    this.scan_state = null;
    this.properties = { tf : new _p('DARKONEJSP3.QUEUE.TF', '%artist% - %title%') };
    this.tfo = fb.TitleFormat(this.properties.tf.value);
    this.queue_indexes_tfo = fb.TitleFormat('[%queue_indexes%]');
    this.up_btn = new _sb(chars.up, this.x, this.y, _scale(12), _scale(12),
        _.bind(function () { return this.offset > 0; }, this),
        _.bind(function () { this.scroll_by(-3); }, this));
    this.down_btn = new _sb(chars.down, this.x, this.y, _scale(12), _scale(12),
        _.bind(function () { return this.offset < this.count - this.rows; }, this),
        _.bind(function () { this.scroll_by(3); }, this));
}
// Compatibility callbacks for layouts whose embedded wrapper predates v0.5.0.
if (typeof on_mouse_lbtn_dblclk == 'undefined') {
    var on_mouse_lbtn_dblclk = function (x, y) {
        if (typeof queue != 'undefined' && queue) queue.lbtn_dblclk(x, y);
    };
}
if (typeof on_script_unload == 'undefined') {
    var on_script_unload = function () {
        if (typeof queue != 'undefined' && queue) queue.dispose();
    };
}
