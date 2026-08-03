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

    this.valid_index = function (index) {
        return index >= 0 && index < this.count;
    }

    this.is_selected = function (index) {
        return this.selected_indices.indexOf(index) !== -1;
    }

    this.normalise_selection = function (indices) {
        var result = [];
        for (var i = 0; i < indices.length; i++) {
            var index = Math.round(Number(indices[i]));
            if (this.valid_index(index) && result.indexOf(index) === -1) result.push(index);
        }
        result.sort(function (a, b) { return a - b; });
        return result;
    }

    this.set_selection = function (indices, focus_index, anchor_index, ensure_visible) {
        var selected = this.normalise_selection(indices || []);
        this.selected_indices = selected;

        if (selected.length === 0) {
            this.selected_index = -1;
            this.anchor_index = -1;
        } else {
            this.selected_index = selected.indexOf(focus_index) !== -1
                ? focus_index
                : selected[selected.length - 1];
            this.anchor_index = this.valid_index(anchor_index)
                ? anchor_index
                : this.selected_index;
            if (ensure_visible !== false) this.ensure_visible(this.selected_index);
        }
        window.RepaintRect(this.x, this.y, this.w, this.h);
    }

    this.select_only = function (index, ensure_visible) {
        if (!this.valid_index(index)) {
            this.clear_selection();
            return false;
        }
        this.set_selection([index], index, index, ensure_visible);
        return true;
    }

    this.clear_selection = function () {
        if (!this.selected_indices.length && this.selected_index === -1) return false;
        this.selected_indices = [];
        this.selected_index = -1;
        this.anchor_index = -1;
        window.RepaintRect(this.x, this.y, this.w, this.h);
        return true;
    }

    this.toggle_selection = function (index) {
        if (!this.valid_index(index)) return false;
        var selected = this.selected_indices.slice();
        var position = selected.indexOf(index);
        if (position === -1) selected.push(index);
        else selected.splice(position, 1);
        var focus = selected.length ? (selected.indexOf(index) !== -1 ? index : selected[selected.length - 1]) : -1;
        this.set_selection(selected, focus, index, true);
        return true;
    }

    this.range_indices = function (from, to) {
        var result = [];
        var minimum = Math.min(from, to);
        var maximum = Math.max(from, to);
        for (var i = minimum; i <= maximum; i++) result.push(i);
        return result;
    }

    this.select_range = function (index, additive) {
        if (!this.valid_index(index)) return false;
        var anchor = this.valid_index(this.anchor_index)
            ? this.anchor_index
            : (this.valid_index(this.selected_index) ? this.selected_index : index);
        var selected = this.range_indices(anchor, index);
        if (additive) selected = this.selected_indices.concat(selected);
        this.set_selection(selected, index, anchor, true);
        return true;
    }

    this.select_all = function () {
        if (!this.count) return false;
        var selected = [];
        for (var i = 0; i < this.count; i++) selected.push(i);
        this.set_selection(selected, this.valid_index(this.selected_index) ? this.selected_index : 0, 0, true);
        return true;
    }

    this.ensure_visible = function (index) {
        if (!this.valid_index(index)) return false;
        var next = this.offset;
        if (index < this.offset) next = index;
        else if (index >= this.offset + this.rows) next = index - this.rows + 1;
        next = Math.max(0, Math.min(Math.max(0, this.count - this.rows), next));
        if (next === this.offset) return false;
        this.offset = next;
        this.hover_index = -1;
        return true;
    }

    this.move_selection = function (target, extend) {
        if (!this.count) return false;
        target = Math.max(0, Math.min(this.count - 1, target));
        if (extend) return this.select_range(target, false);
        return this.select_only(target, true);
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

    this.source_row_valid = function (index) {
        if (!this.valid_index(index)) return false;
        var row = this.data[index];
        try {
            return row.playlist_index >= 0 && row.playlist_index < plman.PlaylistCount &&
                row.playlist_item_index >= 0 &&
                row.playlist_item_index < plman.GetPlaylistItemCount(row.playlist_index);
        } catch (e) {
            return false;
        }
    }

    this.active_row_index = function () {
        if (this.valid_index(this.selected_index)) return this.selected_index;
        if (this.valid_index(this.hover_index)) return this.hover_index;
        return -1;
    }

    this.selected_row_indices = function () {
        if (this.selected_indices.length) return this.selected_indices.slice();
        var active = this.active_row_index();
        return active >= 0 ? [active] : [];
    }

    this.source_handle_list = function (indices) {
        var handles = fb.CreateHandleList();
        var lists = {};
        try {
            for (var i = 0; i < indices.length; i++) {
                var index = indices[i];
                if (!this.source_row_valid(index)) continue;
                var row = this.data[index];
                if (!lists[row.playlist_index]) lists[row.playlist_index] = plman.GetPlaylistItems(row.playlist_index);
                handles.AddItem(lists[row.playlist_index].GetItem(row.playlist_item_index));
            }
        } catch (e) {
            console.log('[Enhanced Queue Viewer] Could not read selected source items: ' + e.message);
        } finally {
            for (var key in lists) {
                if (!Object.prototype.hasOwnProperty.call(lists, key)) continue;
                try { lists[key].Dispose(); } catch (disposeError) {}
            }
        }
        return handles;
    }

    this.active_source_path = function () {
        var index = this.active_row_index();
        if (!this.source_row_valid(index)) return '';
        var handles = this.source_handle_list([index]);
        var path = '';
        try {
            if (handles.Count) path = handles.GetItem(0).Path || '';
        } catch (e) {}
        try { handles.Dispose(); } catch (disposeError) {}
        return path;
    }

    this.focus_row = function (index) {
        if (!this.source_row_valid(index)) return false;
        var row = this.data[index];
        try {
            plman.ActivePlaylist = row.playlist_index;
            plman.ClearPlaylistSelection(row.playlist_index);
            plman.SetPlaylistSelectionSingle(row.playlist_index, row.playlist_item_index, true);
            plman.SetPlaylistFocusItem(row.playlist_index, row.playlist_item_index);
            if (!this.is_selected(index)) this.select_only(index, true);
            else {
                this.selected_index = index;
                this.ensure_visible(index);
                window.RepaintRect(this.x, this.y, this.w, this.h);
            }
            return true;
        } catch (e) {
            console.log('[Enhanced Queue Viewer] Could not focus source playlist item: ' + e.message);
            this.request_scan(false, 0);
            return false;
        }
    }

    this.play_row = function (index) {
        if (!this.source_row_valid(index)) return false;
        var row = this.data[index];
        try {
            plman.ActivePlaylist = row.playlist_index;
            plman.ExecutePlaylistDefaultAction(row.playlist_index, row.playlist_item_index);
            if (!this.is_selected(index)) this.select_only(index, true);
            return true;
        } catch (e) {
            console.log('[Enhanced Queue Viewer] Could not play source playlist item: ' + e.message);
            this.request_scan(false, 0);
            return false;
        }
    }

    this.show_properties = function () {
        var handles = this.source_handle_list(this.selected_row_indices());
        var result = false;
        try {
            if (handles.Count) result = handles.RunContextCommand('Properties');
        } catch (e) {
            console.log('[Enhanced Queue Viewer] Could not open item properties: ' + e.message);
        }
        try { handles.Dispose(); } catch (disposeError) {}
        return result;
    }

    this.copy_titles = function () {
        var indices = this.selected_row_indices();
        var values = [];
        for (var i = 0; i < indices.length; i++) values.push(this.data[indices[i]].text);
        if (!values.length) return false;
        utils.SetClipboardText(values.join('\r\n'));
        return true;
    }

    this.copy_paths = function () {
        var handles = this.source_handle_list(this.selected_row_indices());
        var values = [];
        try {
            for (var i = 0; i < handles.Count; i++) {
                var path = handles.GetItem(i).Path || '';
                if (path) values.push(path);
            }
        } catch (e) {
            console.log('[Enhanced Queue Viewer] Could not copy source paths: ' + e.message);
        }
        try { handles.Dispose(); } catch (disposeError) {}
        if (!values.length) return false;
        utils.SetClipboardText(values.join('\r\n'));
        return true;
    }

    this.open_containing_folder = function () {
        var path = this.active_source_path();
        if (!utils.IsFile(path)) return false;
        _explorer(path);
        return true;
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
        var ctrl = utils.IsKeyPressed(VK_CONTROL);
        var shift = utils.IsKeyPressed(VK_SHIFT);
        if (ctrl && k === 0x41) return this.select_all();

        var current = this.valid_index(this.selected_index)
            ? this.selected_index
            : Math.max(0, Math.min(this.count - 1, this.offset));
        switch (k) {
        case VK_UP:
            return this.move_selection(current - 1, shift);
        case VK_DOWN:
            return this.move_selection(current + 1, shift);
        case VK_HOME:
            return this.move_selection(0, shift);
        case VK_END:
            return this.move_selection(this.count - 1, shift);
        case VK_PGUP:
            return this.move_selection(current - Math.max(1, this.rows - 1), shift);
        case VK_PGDN:
            return this.move_selection(current + Math.max(1, this.rows - 1), shift);
        case VK_RETURN:
            return this.focus_row(current);
        case VK_ESCAPE:
            return this.clear_selection();
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
        if (row < 0) return true;
        var ctrl = utils.IsKeyPressed(VK_CONTROL);
        var shift = utils.IsKeyPressed(VK_SHIFT);
        if (shift) this.select_range(row, ctrl);
        else if (ctrl) this.toggle_selection(row);
        else this.select_only(row, false);
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
                var selected = this.is_selected(index);
                if (selected) {
                    gr.FillRectangle(this.x, rowY, this.w, panel.row_height,
                        setAlpha(panel.colours.highlight, index === this.selected_index ? 42 : 30));
                } else if (index === this.hover_index) {
                    gr.FillRectangle(this.x, rowY, this.w, panel.row_height, setAlpha(panel.colours.highlight, 20));
                }
                gr.WriteTextSimple(row.queue_index + '.  ' + row.text, panel.fonts.normal,
                    selected || index === this.hover_index ? panel.colours.highlight : panel.colours.text,
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

    this.rbtn_up = function (x, y) {
        var row = this.row_at(x, y);
        if (row >= 0) {
            if (!this.is_selected(row)) this.select_only(row, false);
            else {
                this.selected_index = row;
                window.RepaintRect(this.x, this.y, this.w, this.h);
            }
        }

        var active = this.active_row_index();
        var selected_rows = this.selected_row_indices();
        var selected_count = selected_rows.length;
        var valid_source_count = 0;
        for (var i = 0; i < selected_rows.length; i++) {
            if (this.source_row_valid(selected_rows[i])) valid_source_count++;
        }
        var has_selection = selected_count > 0;
        var active_valid = this.source_row_valid(active);
        var active_path = active_valid ? this.active_source_path() : '';

        panel.m.AppendMenuItem(EnableMenuIf(active_valid), 1402, 'Show source playlist item');
        panel.m.AppendMenuItem(EnableMenuIf(active_valid), 1403, 'Play source item now');
        panel.m.AppendMenuItem(EnableMenuIf(active_valid && utils.IsFile(active_path)), 1404, 'Open containing folder');
        panel.m.AppendMenuItem(EnableMenuIf(valid_source_count > 0), 1405, selected_count > 1 ? 'Properties for selected items' : 'Properties');
        panel.m.AppendMenuSeparator();
        panel.m.AppendMenuItem(EnableMenuIf(has_selection), 1406, selected_count > 1 ? 'Copy item titles' : 'Copy item title');
        panel.m.AppendMenuItem(EnableMenuIf(valid_source_count > 0), 1407, selected_count > 1 ? 'Copy file paths' : 'Copy file path');
        panel.m.AppendMenuSeparator();
        panel.m.AppendMenuItem(MF_STRING, 1400, 'Item display title formatting...');
        panel.m.AppendMenuItem(MF_STRING, 1401, 'Re-scan playback queue');
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
            this.focus_row(this.active_row_index());
            break;
        case 1403:
            this.play_row(this.active_row_index());
            break;
        case 1404:
            this.open_containing_folder();
            break;
        case 1405:
            this.show_properties();
            break;
        case 1406:
            this.copy_titles();
            break;
        case 1407:
            this.copy_paths();
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

    this.selection_key = function (row) {
        return row.playlist_index + ':' + row.playlist_item_index + ':' + row.queue_index;
    }

    this.selection_source_key = function (row) {
        return row.playlist_index + ':' + row.playlist_item_index;
    }

    this.capture_selection = function () {
        var snapshot = { exact: [], source: [], active_exact: '', active_source: '' };
        for (var i = 0; i < this.selected_indices.length; i++) {
            var index = this.selected_indices[i];
            if (!this.valid_index(index)) continue;
            snapshot.exact.push(this.selection_key(this.data[index]));
            snapshot.source.push(this.selection_source_key(this.data[index]));
        }
        if (this.valid_index(this.selected_index)) {
            snapshot.active_exact = this.selection_key(this.data[this.selected_index]);
            snapshot.active_source = this.selection_source_key(this.data[this.selected_index]);
        }
        return snapshot;
    }

    this.restore_selection = function (snapshot) {
        if (!snapshot || (!snapshot.exact.length && !snapshot.source.length)) {
            this.selected_indices = [];
            this.selected_index = -1;
            this.anchor_index = -1;
            return;
        }

        var selected = [];
        var used = [];
        for (var i = 0; i < snapshot.exact.length; i++) {
            var exact = snapshot.exact[i];
            var found = -1;
            for (var n = 0; n < this.data.length; n++) {
                if (used.indexOf(n) === -1 && this.selection_key(this.data[n]) === exact) {
                    found = n;
                    break;
                }
            }
            if (found === -1) {
                var source = snapshot.source[i];
                for (var m = 0; m < this.data.length; m++) {
                    if (used.indexOf(m) === -1 && this.selection_source_key(this.data[m]) === source) {
                        found = m;
                        break;
                    }
                }
            }
            if (found !== -1) {
                used.push(found);
                selected.push(found);
            }
        }

        var active = -1;
        for (var a = 0; a < this.data.length; a++) {
            if (this.selection_key(this.data[a]) === snapshot.active_exact) {
                active = a;
                break;
            }
        }
        if (active === -1) {
            for (var b = 0; b < this.data.length; b++) {
                if (this.selection_source_key(this.data[b]) === snapshot.active_source) {
                    active = b;
                    break;
                }
            }
        }
        selected = this.normalise_selection(selected);
        this.selected_indices = selected;
        this.selected_index = selected.indexOf(active) !== -1
            ? active
            : (selected.length ? selected[selected.length - 1] : -1);
        this.anchor_index = this.selected_index;
        if (this.selected_index >= 0) this.ensure_visible(this.selected_index);
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
        this.pending_selection = this.capture_selection();
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
                    console.log('[Enhanced Queue Viewer] Failed to read playlist ' + state.playlist_index + ': ' + e.message);
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
                    console.log('[Enhanced Queue Viewer] Failed at playlist ' + state.playlist_index +
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
        this.restore_selection(this.pending_selection);
        this.pending_selection = null;
        this.has_scanned = true;
        this.dirty = false;
        this.scanning = false;
        this.progress = 100;
        this.scan_state = null;
        var elapsed = Date.now() - state.started;
        if (this.force_log || elapsed >= 100) {
            console.log('[Enhanced Queue Viewer] Scanned ' + state.processed_items + ' items across ' +
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
        this.selected_indices = [];
        this.selected_index = -1;
        this.anchor_index = -1;
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
    this.selected_indices = [];
    this.selected_index = -1;
    this.anchor_index = -1;
    this.pending_selection = null;
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
