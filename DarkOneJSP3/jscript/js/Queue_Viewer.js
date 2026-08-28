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

    var queueOriginUserRemoved = typeof PlaybackQueueOrigin !== 'undefined'
        ? PlaybackQueueOrigin.user_removed : 1;
    var queueOriginPlaybackAdvance = typeof PlaybackQueueOrigin !== 'undefined'
        ? PlaybackQueueOrigin.playback_advance : 2;

    var queueBridgeEnabled = typeof DARKONEJSP3_QUEUE_BRIDGE_ENABLED !== 'undefined' &&
        DARKONEJSP3_QUEUE_BRIDGE_ENABLED === true &&
        typeof DarkOneQueueBridge !== 'undefined';

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

    this.rebuild_selection_lookup = function () {
        this.selected_lookup = {};
        for (var i = 0; i < this.selected_indices.length; i++)
            this.selected_lookup[this.selected_indices[i]] = true;
    }

    this.is_selected = function (index) {
        return !!this.selected_lookup[index];
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
        this.rebuild_selection_lookup();

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
        this.rebuild_selection_lookup();
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

    this.sort_queue_rows = function (rows) {
        rows.sort(function (a, b) {
            if (a.queue_index !== b.queue_index) return a.queue_index - b.queue_index;
            if (a.playlist_index !== b.playlist_index) return a.playlist_index - b.playlist_index;
            return a.playlist_item_index - b.playlist_item_index;
        });
        return rows;
    }

    this.source_identity = function (playlist_index, item_index) {
        try { return String(this.source_id_tfo.EvalPlaylistItem(playlist_index, item_index)); }
        catch (e) { return ''; }
    }

    this.capture_playlist_snapshot = function (playlist_count, item_counts) {
        var snapshot = [];
        for (var i = 0; i < playlist_count; i++) {
            var count = item_counts ? item_counts[i] : -1;
            if (count < 0) {
                try { count = plman.GetPlaylistItemCount(i); } catch (countError) { return null; }
            }
            var name = '';
            try { name = String(plman.GetPlaylistName(i)); } catch (nameError) { name = String(i); }
            snapshot.push(name + '\u0000' + count);
        }
        return snapshot;
    }

    this.playlist_snapshots_equal = function (left, right) {
        if (!left || !right || left.length !== right.length) return false;
        for (var i = 0; i < left.length; i++) {
            if (left[i] !== right[i]) return false;
        }
        return true;
    }

    this.playlist_snapshot_matches = function () {
        var playlist_count;
        try { playlist_count = plman.PlaylistCount; } catch (e) { return false; }
        var current = this.capture_playlist_snapshot(playlist_count, null);
        return this.playlist_snapshots_equal(this.playlist_snapshot, current);
    }

    this.build_scan_playlist_order = function (playlist_count) {
        var order = [];
        var seen = {};
        var add = function (index) {
            index = Math.round(Number(index));
            if (index < 0 || index >= playlist_count || seen[index]) return;
            seen[index] = true;
            order.push(index);
        };
        for (var i = 0; i < this.data.length; i++) add(this.data[i].playlist_index);
        try { add(plman.ActivePlaylist); } catch (e) {}
        for (var n = 0; n < playlist_count; n++) add(n);
        return order;
    }

    this.bridge_fallback_text = function (sourceId, queueIndex) {
        var value = String(sourceId || '');
        var separator = value.lastIndexOf('|');
        var path = separator >= 0 ? value.substring(0, separator) : value;
        var slash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
        if (slash >= 0) path = path.substring(slash + 1);
        return path || ('Queue item ' + queueIndex);
    }

    this.cancel_bridge_refresh = function () {
        if (this.bridge_timer) {
            window.ClearTimeout(this.bridge_timer);
            this.bridge_timer = 0;
        }
        this.bridge_attempt = 0;
    }

    this.read_bridge_state = function () {
        if (!this.bridge_enabled || !this.bridge_state_file) return null;
        try {
            if (!utils.IsFile(this.bridge_state_file)) return null;
            return DarkOneQueueBridge.parse(utils.ReadTextFile(this.bridge_state_file, 65001));
        } catch (e) {
            return null;
        }
    }

    this.bridge_source_matches = function (entry) {
        if (entry.playlistIndex < 0 || entry.playlistIndex >= plman.PlaylistCount ||
            entry.playlistItemIndex < 0 ||
            entry.playlistItemIndex >= plman.GetPlaylistItemCount(entry.playlistIndex)) return false;
        if (!entry.sourceId) return true;
        return this.source_identity(entry.playlistIndex, entry.playlistItemIndex) === entry.sourceId;
    }

    this.apply_bridge_state = function (state, force_log) {
        if (!state || state.available === false) return false;
        var started = Date.now();
        var rows = [];
        var selection = this.pending_selection || this.capture_selection();
        for (var i = 0; i < state.entries.length; i++) {
            var entry = state.entries[i];
            var sourceMatches = false;
            try { sourceMatches = this.bridge_source_matches(entry); } catch (e) {}
            var text = this.bridge_fallback_text(entry.sourceId, entry.queueIndex);
            if (sourceMatches) {
                try { text = this.tfo.EvalPlaylistItem(entry.playlistIndex, entry.playlistItemIndex); }
                catch (formatError) {}
            }
            rows.push({
                queue_index: entry.queueIndex,
                playlist_index: entry.playlistIndex,
                playlist_item_index: entry.playlistItemIndex,
                source_id: entry.sourceId,
                text: text
            });
        }

        this.cancel_scan();
        this.apply_queue_data(rows, selection);
        this.pending_selection = null;
        if (this.pending_queue_position_selection) {
            this.apply_queue_position_selection(this.pending_queue_position_selection);
            this.pending_queue_position_selection = null;
        }
        this.bridge_token = DarkOneQueueBridge.token(state);
        this.bridge_session = String(state.session || '');
        this.bridge_generation = Number(state.generation) || 0;
        this.bridge_writable = state.writable === true;
        this.bridge_capabilities = Array.isArray(state.capabilities) ? state.capabilities.slice(0) : [];
        this.bridge_mode = true;
        this.has_scanned = true;
        this.dirty = false;
        this.scanning = false;
        this.progress = 100;
        if (force_log || !this.bridge_logged) {
            console.log('[Enhanced Queue Viewer] Loaded ' + this.count + ' queue entr' +
                (this.count === 1 ? 'y' : 'ies') + ' via direct JSplitter queue bridge in ' +
                (Date.now() - started) + ' ms; no playlist scan required.');
            this.bridge_logged = true;
        }
        this.force_log = false;
        window.Repaint();
        return true;
    }

    this.fallback_from_bridge = function (force_log) {
        this.cancel_bridge_refresh();
        this.bridge_min_generation = 0;
        this.bridge_mode = false;
        this.bridge_writable = false;
        this.bridge_capabilities = [];
        this.request_scan(!!force_log, 0);
    }

    this.try_bridge_refresh = function () {
        this.bridge_timer = 0;
        if (!this.bridge_enabled) {
            this.fallback_from_bridge(this.bridge_force_log);
            return;
        }
        var state = this.read_bridge_state();
        var token = state ? DarkOneQueueBridge.token(state) : '';
        var stateGeneration = state ? (Number(state.generation) || 0) : 0;
        var generationReady = stateGeneration >= this.bridge_min_generation;
        if (state && state.available !== false && generationReady &&
            (!this.bridge_require_new || !this.bridge_token || token !== this.bridge_token)) {
            var forceLog = this.bridge_force_log;
            this.bridge_force_log = false;
            this.cancel_bridge_refresh();
            this.bridge_min_generation = 0;
            this.apply_bridge_state(state, forceLog);
            return;
        }
        if (state && state.available === false) {
            var unavailableLog = this.bridge_force_log;
            this.bridge_force_log = false;
            this.fallback_from_bridge(unavailableLog);
            return;
        }
        if (++this.bridge_attempt >= 10) {
            var fallbackLog = this.bridge_force_log;
            this.bridge_force_log = false;
            this.fallback_from_bridge(fallbackLog);
            return;
        }
        var self = this;
        this.bridge_timer = window.SetTimeout(function () {
            self.try_bridge_refresh();
        }, 20);
    }

    this.request_bridge_refresh = function (force_log, delay, require_new, minimum_generation) {
        if (!this.bridge_enabled) return false;
        this.pending_selection = this.capture_selection();
        this.dirty = true;
        this.force_log = this.force_log || !!force_log;
        this.bridge_force_log = this.bridge_force_log || !!force_log;
        this.bridge_require_new = !!require_new;
        this.bridge_min_generation = Math.max(0, Number(minimum_generation) || 0);
        this.cancel_scan();
        this.cancel_bridge_refresh();
        var self = this;
        this.bridge_timer = window.SetTimeout(function () {
            self.try_bridge_refresh();
        }, Math.max(0, Number(delay) || 0));
        window.Repaint();
        return true;
    }

    this.source_topology_changed = function () {
        if (this.bridge_enabled) this.request_bridge_refresh(false, 20, true);
    }

    this.apply_queue_data = function (rows, selection_snapshot) {
        this.data = this.sort_queue_rows(rows);
        this.count = this.data.length;
        this.offset = Math.min(this.offset, Math.max(0, this.count - this.rows));
        this.hover_index = -1;
        this.restore_selection(selection_snapshot);
        window.Repaint();
    }

    this.publish_scan_data = function (state, force) {
        if (!force && state.data.length === state.last_published_count) return false;
        var now = Date.now();
        if (!force && state.last_published_count > 0 && now - state.last_publish_at < 75) return false;
        this.apply_queue_data(state.data.slice(), this.pending_selection);
        state.last_published_count = state.data.length;
        state.last_publish_at = now;
        return true;
    }

    this.refresh_known_queue_sources = function () {
        if (!this.has_scanned || this.dirty || this.scanning || this.scan_timer) return false;
        if (!this.playlist_snapshot_matches()) return false;

        var selection = this.capture_selection();
        var seen = {};
        var rows = [];
        try {
            for (var i = 0; i < this.data.length; i++) {
                var oldRow = this.data[i];
                var sourceKey = this.selection_source_key(oldRow);
                if (seen[sourceKey]) continue;
                seen[sourceKey] = true;

                if (oldRow.playlist_index < 0 || oldRow.playlist_index >= plman.PlaylistCount ||
                    oldRow.playlist_item_index < 0 ||
                    oldRow.playlist_item_index >= plman.GetPlaylistItemCount(oldRow.playlist_index)) return false;

                var sourceId = this.source_identity(oldRow.playlist_index, oldRow.playlist_item_index);
                if (oldRow.source_id && sourceId !== oldRow.source_id) return false;

                var indexes = parseQueueIndexes(
                    this.queue_indexes_tfo.EvalPlaylistItem(oldRow.playlist_index, oldRow.playlist_item_index)
                );
                if (!indexes.length) continue;
                var text = this.tfo.EvalPlaylistItem(oldRow.playlist_index, oldRow.playlist_item_index);
                for (var n = 0; n < indexes.length; n++) {
                    rows.push({
                        queue_index : indexes[n],
                        playlist_index : oldRow.playlist_index,
                        playlist_item_index : oldRow.playlist_item_index,
                        source_id : sourceId,
                        text : text
                    });
                }
            }
        } catch (e) {
            console.log('[Enhanced Queue Viewer] Targeted queue refresh fell back to a full scan: ' + e.message);
            return false;
        }

        this.apply_queue_data(rows, selection);
        this.dirty = false;
        return true;
    }

    this.apply_queue_position_selection = function (target) {
        if (!target || !Array.isArray(target.queueIndexes)) return false;
        var selected = [];
        var active = -1;
        for (var i = 0; i < this.data.length; i++) {
            var queueIndex = Number(this.data[i].queue_index) || 0;
            if (target.queueIndexes.indexOf(queueIndex) >= 0) selected.push(i);
            if (queueIndex === target.activeQueueIndex) active = i;
        }
        selected = this.normalise_selection(selected);
        this.selected_indices = selected;
        this.rebuild_selection_lookup();
        this.selected_index = selected.indexOf(active) >= 0
            ? active : (selected.length ? selected[selected.length - 1] : -1);
        this.anchor_index = this.selected_index;
        if (this.selected_index >= 0) this.ensure_visible(this.selected_index);
        window.Repaint();
        return true;
    }

    this.mutation_selection_target = function (action, queueIndexes) {
        queueIndexes = (queueIndexes || []).slice().sort(function (a, b) { return a - b; });
        if (action === 'clear') return { queueIndexes: [], activeQueueIndex: -1 };
        if (action === 'skipTo') return { queueIndexes: [], activeQueueIndex: -1 };
        if (action === 'remove' || action === 'removeMany') {
            var remaining = Math.max(0, this.count - queueIndexes.length);
            if (!remaining) return { queueIndexes: [], activeQueueIndex: -1 };
            var next = Math.min(queueIndexes[0], remaining);
            return { queueIndexes: [next], activeQueueIndex: next };
        }

        var activeQueueIndex = this.valid_index(this.selected_index)
            ? Number(this.data[this.selected_index].queue_index) || 0 : 0;
        var selectedLookup = Object.create(null);
        for (var s = 0; s < queueIndexes.length; s++) selectedLookup[queueIndexes[s]] = true;
        var rows = [];
        for (var i = 1; i <= this.count; i++) {
            rows.push({ queueIndex: i, selected: selectedLookup[i] === true, active: i === activeQueueIndex });
        }
        var temp;
        if (action === 'moveUp') {
            for (var up = 1; up < rows.length; up++) {
                if (rows[up].selected && !rows[up - 1].selected) {
                    temp = rows[up - 1]; rows[up - 1] = rows[up]; rows[up] = temp;
                }
            }
        } else if (action === 'moveDown') {
            for (var down = rows.length - 2; down >= 0; down--) {
                if (rows[down].selected && !rows[down + 1].selected) {
                    temp = rows[down + 1]; rows[down + 1] = rows[down]; rows[down] = temp;
                }
            }
        } else if (action === 'moveTop' || action === 'moveBottom') {
            var chosen = [];
            var other = [];
            for (var n = 0; n < rows.length; n++) (rows[n].selected ? chosen : other).push(rows[n]);
            rows = action === 'moveTop' ? chosen.concat(other) : other.concat(chosen);
        }
        var selectedPositions = [];
        var activePosition = -1;
        for (var r = 0; r < rows.length; r++) {
            if (rows[r].selected) selectedPositions.push(r + 1);
            if (rows[r].active) activePosition = r + 1;
        }
        return { queueIndexes: selectedPositions, activeQueueIndex: activePosition };
    }

    this.cancel_mutation_wait = function () {
        if (this.mutation_timer) {
            window.ClearTimeout(this.mutation_timer);
            this.mutation_timer = 0;
        }
        this.mutation_attempt = 0;
    }

    this.bridge_has_capability = function (action) {
        return this.bridge_mode && this.bridge_writable &&
            this.bridge_capabilities.indexOf(action) >= 0;
    }

    this.selected_queue_indexes = function () {
        var rows = this.selected_row_indices();
        var indexes = [];
        for (var i = 0; i < rows.length; i++) {
            if (!this.valid_index(rows[i])) continue;
            var queueIndex = Number(this.data[rows[i]].queue_index) || 0;
            if (queueIndex > 0 && indexes.indexOf(queueIndex) === -1) indexes.push(queueIndex);
        }
        indexes.sort(function (a, b) { return a - b; });
        return indexes;
    }

    this.can_move_selected_up = function () {
        if (!this.bridge_has_capability('moveUp')) return false;
        var selected = this.selected_row_indices();
        for (var i = 0; i < selected.length; i++) {
            var row = selected[i];
            if (row > 0 && !this.is_selected(row - 1)) return true;
        }
        return false;
    }

    this.can_move_selected_down = function () {
        if (!this.bridge_has_capability('moveDown')) return false;
        var selected = this.selected_row_indices();
        for (var i = selected.length - 1; i >= 0; i--) {
            var row = selected[i];
            if (row >= 0 && row < this.count - 1 && !this.is_selected(row + 1)) return true;
        }
        return false;
    }

    this.read_mutation_result = function () {
        if (!this.bridge_result_file || !utils.IsFile(this.bridge_result_file)) return null;
        try {
            return DarkOneQueueBridge.parseResult(utils.ReadTextFile(this.bridge_result_file, 65001));
        } catch (e) {
            return null;
        }
    }

    this.poll_mutation_result = function () {
        this.mutation_timer = 0;
        if (!this.mutation_pending_id) return;
        var result = this.read_mutation_result();
        if (result && result.id === this.mutation_pending_id) {
            var accepted = result.accepted === true;
            var message = result.message || '';
            this.cancel_mutation_wait();
            this.mutation_pending_id = '';
            if (!accepted) {
                this.mutation_target_selection = null;
                if (message) console.log('[Enhanced Queue Viewer] ' + message);
            } else if (Number(result.generation) >= this.bridge_generation) {
                this.pending_queue_position_selection = this.mutation_target_selection;
            }
            var acknowledgedGeneration = accepted ? (Number(result.generation) || 0) : 0;
            this.mutation_target_selection = null;
            // The ordinary queue callback may already have consumed the mutation
            // generation before the acknowledgement arrives. Accept the current
            // token in that case, but never accept an older published generation.
            this.request_bridge_refresh(false, accepted ? 5 : 0, false, acknowledgedGeneration);
            return;
        }
        if (++this.mutation_attempt >= 50) {
            this.cancel_mutation_wait();
            this.mutation_pending_id = '';
            this.mutation_target_selection = null;
            console.log('[Enhanced Queue Viewer] Queue command bridge timed out; refreshing authoritative state.');
            this.request_bridge_refresh(false, 0, false);
            return;
        }
        var self = this;
        this.mutation_timer = window.SetTimeout(function () {
            self.poll_mutation_result();
        }, 20);
    }

    this.request_queue_mutation = function (action, queueIndexes) {
        if (!this.bridge_has_capability(action) || this.mutation_pending_id) return false;
        var commandId = this.bridge_session + '-' + Date.now().toString(36) + '-' + (++this.mutation_sequence).toString(36);
        var command = DarkOneQueueBridge.command(
            commandId,
            this.bridge_session,
            this.bridge_generation,
            action,
            queueIndexes || []
        );
        try {
            utils.CreateFolder(fb.ProfilePath + 'js_data\\');
            var written = utils.WriteTextFile(
                this.bridge_command_file,
                DarkOneQueueBridge.serialiseCommand(command)
            );
            if (written === false) {
                console.log('[Enhanced Queue Viewer] Queue command write failed: utils.WriteTextFile returned false');
                return false;
            }
        } catch (e) {
            console.log('[Enhanced Queue Viewer] Queue command write failed: ' + e.message);
            return false;
        }
        this.pending_selection = this.capture_selection();
        this.mutation_target_selection = this.mutation_selection_target(action, command.queueIndexes);
        this.mutation_pending_id = commandId;
        this.cancel_mutation_wait();
        var self = this;
        this.mutation_timer = window.SetTimeout(function () {
            self.poll_mutation_result();
        }, 20);
        return true;
    }

    this.remove_selected_from_queue = function () {
        var indexes = this.selected_queue_indexes();
        if (!indexes.length) return false;
        return this.request_queue_mutation(indexes.length === 1 ? 'remove' : 'removeMany', indexes);
    }

    this.clear_playback_queue = function () {
        return this.count > 0 && this.request_queue_mutation('clear', []);
    }

    this.move_selected_queue = function (action) {
        var indexes = this.selected_queue_indexes();
        return indexes.length > 0 && this.request_queue_mutation(action, indexes);
    }

    this.skip_to_queue_row = function (index) {
        if (!this.valid_index(index) || !this.bridge_has_capability('skipTo')) return false;
        var queueIndex = Number(this.data[index].queue_index) || 0;
        if (queueIndex < 1) return false;
        if (!this.is_selected(index)) this.select_only(index, false);
        else {
            this.selected_index = index;
            this.ensure_visible(index);
            window.RepaintRect(this.x, this.y, this.w, this.h);
        }
        return this.request_queue_mutation('skipTo', [queueIndex]);
    }

    this.font_changed = function () {
        this.size();
        window.Repaint();
    }

    this.header_text = function () {
        if (this.scanning) return 'Queue Viewer — scanning ' + this.progress + '%';
        if (this.scan_timer) return 'Queue Viewer — preparing scan';
        if (this.mutation_pending_id) return 'Queue Viewer — updating queue…';
        return 'Queue Viewer';
    }

    this.source_row_valid = function (index) {
        if (!this.valid_index(index)) return false;
        var row = this.data[index];
        try {
            if (row.playlist_index < 0 || row.playlist_index >= plman.PlaylistCount ||
                row.playlist_item_index < 0 ||
                row.playlist_item_index >= plman.GetPlaylistItemCount(row.playlist_index)) return false;
            return !row.source_id || this.source_identity(row.playlist_index, row.playlist_item_index) === row.source_id;
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
        case 0x2E: // Delete
            return this.remove_selected_from_queue();
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
        if (this.up_btn.lbtn_up(x, y) || this.down_btn.lbtn_up(x, y)) return true;
        var row = this.row_at(x, y);
        if (row < 0) {
            this.clear_selection();
            return true;
        }
        var ctrl = utils.IsKeyPressed(VK_CONTROL);
        var shift = utils.IsKeyPressed(VK_SHIFT);
        if (shift) this.select_range(row, ctrl);
        else if (ctrl) this.toggle_selection(row);
        else this.select_only(row, false);
        return true;
    }

    this.lbtn_dblclk = function (x, y) {
        var row = this.row_at(x, y);
        if (row < 0) return false;
        return this.bridge_has_capability('skipTo')
            ? this.skip_to_queue_row(row)
            : this.focus_row(row);
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
            var configuredSelectedBackground = typeof panel.selected_background_colour == 'function'
                ? panel.selected_background_colour()
                : null;
			var configuredSelectedText = typeof panel.selected_text_colour == 'function'
				? panel.selected_text_colour(configuredSelectedBackground)
				: panel.colours.highlight;
            for (var i = 0; i < visible; i++) {
                var index = i + this.offset;
                var row = this.data[index];
                var rowY = this.y + _scale(12) + (i * panel.row_height);
                var selected = this.is_selected(index);
                if (selected) {
                    gr.FillRectangle(
                        this.x,
                        rowY,
                        this.w,
                        panel.row_height,
                        configuredSelectedBackground === null
                            ? setAlpha(panel.colours.highlight, index === this.selected_index ? 42 : 30)
                            : configuredSelectedBackground
                    );
                } else if (index === this.hover_index) {
                    gr.FillRectangle(this.x, rowY, this.w, panel.row_height, setAlpha(panel.colours.highlight, 20));
                }
                gr.WriteTextSimple(row.queue_index + '.  ' + row.text, panel.fonts.normal,
                    selected
                        ? configuredSelectedText
                        : (index === this.hover_index ? panel.colours.highlight : panel.colours.text),
                    this.x, rowY, this.w, panel.row_height,
                    DWRITE_TEXT_ALIGNMENT_LEADING, DWRITE_PARAGRAPH_ALIGNMENT_CENTER,
                    DWRITE_WORD_WRAPPING_NO_WRAP, DWRITE_TRIMMING_GRANULARITY_CHARACTER);
            }
        }
        this.up_btn.paint(gr, panel.colours.text);
        this.down_btn.paint(gr, panel.colours.text);
    }

    this.playback_queue_changed = function (origin) {
        if (this.bridge_enabled) {
            this.request_bridge_refresh(false, 10, true);
            return;
        }
        if ((origin === queueOriginUserRemoved || origin === queueOriginPlaybackAdvance) &&
            this.refresh_known_queue_sources()) return;
        if (this.scanning || this.scan_timer) this.cancel_scan();
        this.dirty = true;
        window.Repaint();
    };

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

        if (this.bridge_mode) {
            var mutation_ready = this.bridge_writable && !this.mutation_pending_id;
            if (this.bridge_writable) {
                panel.m.AppendMenuItem(EnableMenuIf(mutation_ready && has_selection), 1410,
                    selected_count > 1 ? 'Remove selected items from queue' : 'Remove item from queue');
                panel.m.AppendMenuItem(EnableMenuIf(mutation_ready && this.can_move_selected_up()), 1411, 'Move up');
                panel.m.AppendMenuItem(EnableMenuIf(mutation_ready && this.can_move_selected_down()), 1412, 'Move down');
                panel.m.AppendMenuItem(EnableMenuIf(mutation_ready && this.can_move_selected_up()), 1413, 'Move to top');
                panel.m.AppendMenuItem(EnableMenuIf(mutation_ready && this.can_move_selected_down()), 1414, 'Move to bottom');
                panel.m.AppendMenuSeparator();
                panel.m.AppendMenuItem(EnableMenuIf(mutation_ready && this.count > 0), 1415, 'Clear playback queue');
            } else {
                panel.m.AppendMenuItem(MF_GRAYED, 1416, 'Queue editing unavailable');
            }
            panel.m.AppendMenuSeparator();
        }

        panel.m.AppendMenuItem(EnableMenuIf(active_valid), 1402, 'Show source playlist item');
        if (this.bridge_has_capability('skipTo')) {
            panel.m.AppendMenuItem(
                EnableMenuIf(!this.mutation_pending_id && this.valid_index(active)),
                1408,
                'Skip to this track'
            );
        }
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
        case 1410:
            this.remove_selected_from_queue();
            break;
        case 1411:
            this.move_selected_queue('moveUp');
            break;
        case 1412:
            this.move_selected_queue('moveDown');
            break;
        case 1413:
            this.move_selected_queue('moveTop');
            break;
        case 1414:
            this.move_selected_queue('moveBottom');
            break;
        case 1415:
            this.clear_playback_queue();
            break;
        case 1400:
            try {
                var value = utils.InputBox('Enter title formatting for queue items.', window.Name, this.properties.tf.value);
                if (!value.empty()) {
                    this.properties.tf.value = value;
                    this.tfo = fb.TitleFormat(value);
                    this.update(true);
                }
            } catch (e) {}
            break;
        case 1401:
            this.update(true);
            break;
        case 1402:
            this.focus_row(this.active_row_index());
            break;
        case 1403:
            this.play_row(this.active_row_index());
            break;
        case 1408:
            this.skip_to_queue_row(this.active_row_index());
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
        if (row.playlist_index < 0 || row.playlist_item_index < 0) {
            return 'id:' + String(row.source_id || '');
        }
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
            this.rebuild_selection_lookup();
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
        this.rebuild_selection_lookup();
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
        this.scan_state = null;
        this.scanning = false;
        this.progress = 0;
    }

    this.request_scan = function (force_log, delay) {
        this.cancel_bridge_refresh();
        this.bridge_mode = false;
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
        var item_counts = [];
        var total_items = 0;
        for (var i = 0; i < playlist_count; i++) {
            var count = 0;
            try { count = plman.GetPlaylistItemCount(i); }
            catch (e) { console.log('[Enhanced Queue Viewer] Failed to count playlist ' + i + ': ' + e.message); }
            item_counts.push(count);
            total_items += count;
        }
        this.scanning = true;
        this.progress = 0;
        this.scan_state = {
            generation : generation,
            started : Date.now(),
            playlist_count : playlist_count,
            playlist_order : this.build_scan_playlist_order(playlist_count),
            playlist_position : 0,
            playlist_item_counts : item_counts,
            playlist_snapshot : this.capture_playlist_snapshot(playlist_count, item_counts),
            item_index : 0,
            processed_items : 0,
            total_items : total_items,
            data : [],
            last_published_count : 0,
            last_publish_at : 0,
            last_repaint_at : 0,
            last_progress : -1,
            expected_queue_total : 0,
            found_queue_indexes : {},
            found_queue_count : 0,
            early_complete : false
        };
        window.Repaint();
        this.scan_chunk(generation);
    }

    this.update_scan_progress = function (state, force) {
        var next = state.total_items > 0
            ? Math.min(99, Math.floor(state.processed_items * 100 / state.total_items))
            : (state.playlist_position >= state.playlist_order.length ? 100 : 0);
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
        var budgetMs = 5;
        var batchSize = 16;
        var batchRemaining = batchSize;
        var withinBudget = function () {
            if (--batchRemaining > 0) return true;
            batchRemaining = batchSize;
            return Date.now() - sliceStarted < budgetMs;
        };

        while (!state.early_complete && state.playlist_position < state.playlist_order.length && Date.now() - sliceStarted < budgetMs) {
            var playlistIndex = state.playlist_order[state.playlist_position];
            var itemCount = state.playlist_item_counts[playlistIndex] || 0;

            while (!state.early_complete && state.item_index < itemCount && withinBudget()) {
                var itemIndex = state.item_index++;
                state.processed_items++;
                try {
                    var indexes = parseQueueIndexes(this.queue_indexes_tfo.EvalPlaylistItem(playlistIndex, itemIndex));
                    if (!indexes.length) continue;
                    if (state.expected_queue_total <= 0) {
                        try {
                            var queueTotal = parseInt(this.queue_total_tfo.EvalPlaylistItem(playlistIndex, itemIndex), 10);
                            if (!isNaN(queueTotal) && queueTotal > 0) state.expected_queue_total = queueTotal;
                        } catch (queueTotalError) {}
                    }
                    var text = this.tfo.EvalPlaylistItem(playlistIndex, itemIndex);
                    var sourceId = this.source_identity(playlistIndex, itemIndex);
                    for (var n = 0; n < indexes.length; n++) {
                        var queueIndex = indexes[n];
                        if (state.found_queue_indexes[queueIndex]) continue;
                        state.found_queue_indexes[queueIndex] = true;
                        state.found_queue_count++;
                        state.data.push({
                            queue_index : queueIndex,
                            playlist_index : playlistIndex,
                            playlist_item_index : itemIndex,
                            source_id : sourceId,
                            text : text
                        });
                    }
                    if (state.expected_queue_total > 0 &&
                        state.found_queue_count >= state.expected_queue_total) {
                        state.early_complete = true;
                    }
                } catch (e2) {
                    console.log('[Enhanced Queue Viewer] Failed at playlist ' + playlistIndex +
                        ', item ' + itemIndex + ': ' + e2.message);
                }
            }

            if (!state.early_complete && state.item_index >= itemCount) {
                state.item_index = 0;
                state.playlist_position++;
                this.publish_scan_data(state, false);
            }
        }

        this.update_scan_progress(state, false);
        if (state.early_complete || state.playlist_position >= state.playlist_order.length) {
            this.finish_scan(generation);
            return;
        }

        var self = this;
        this.scan_timer = window.SetTimeout(function () {
            self.scan_timer = 0;
            self.scan_chunk(generation);
        }, 1);
    }

    this.finish_scan = function (generation) {
        if (!this.scan_state || generation !== this.scan_generation) return;
        var state = this.scan_state;
        var currentSnapshot = this.capture_playlist_snapshot(plman.PlaylistCount, null);
        if (!this.playlist_snapshots_equal(state.playlist_snapshot, currentSnapshot)) {
            this.scan_state = null;
            this.scanning = false;
            this.progress = 0;
            this.dirty = true;
            window.Repaint();
            return;
        }
        this.apply_queue_data(state.data, this.pending_selection);
        this.pending_selection = null;
        this.playlist_snapshot = state.playlist_snapshot || [];
        this.has_scanned = true;
        this.dirty = false;
        this.scanning = false;
        this.progress = 100;
        this.scan_state = null;
        var elapsed = Date.now() - state.started;
        if (this.force_log || elapsed >= 100) {
            console.log('[Enhanced Queue Viewer] Scanned ' + state.processed_items + ' items across ' +
                state.playlist_count + ' playlists in ' + elapsed + ' ms; found ' + this.count + ' queue entr' +
                (this.count === 1 ? 'y' : 'ies') + '; source field: %queue_indexes%; prioritised incremental scan' +
                (state.early_complete ? '; stopped early after %queue_total% confirmed all queue entries.' : '.') );
        }
        this.force_log = false;
        window.Repaint();
    }

    this.on_visible_paint = function () {
        if ((this.dirty || !this.has_scanned) && !this.scanning && !this.scan_timer && !this.bridge_timer) {
            if (!this.request_bridge_refresh(false, 25, false)) this.request_scan(false, 25);
        }
    }

    this.update = function (force_log) {
        if (!this.request_bridge_refresh(!!force_log, 0, false)) this.request_scan(!!force_log, 0);
    }

    this.wheel = function (s) {
        if (!this.containsXY(this.mx, this.my)) return false;
        return this.scroll_by(-s * 3);
    }

    this.dispose = function () {
        this.cancel_mutation_wait();
        this.mutation_pending_id = '';
        this.mutation_target_selection = null;
        this.pending_queue_position_selection = null;
        this.cancel_bridge_refresh();
        this.cancel_scan();
        this.data = [];
        this.count = 0;
        this.selected_indices = [];
        this.rebuild_selection_lookup();
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
    this.selected_lookup = {};
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
    this.playlist_snapshot = [];
    this.bridge_enabled = queueBridgeEnabled;
    this.bridge_state_file = this.bridge_enabled
        ? fb.ProfilePath + 'js_data\\' + DarkOneQueueBridge.fileName
        : '';
    this.bridge_command_file = this.bridge_enabled
        ? fb.ProfilePath + 'js_data\\' + DarkOneQueueBridge.commandFileName
        : '';
    this.bridge_result_file = this.bridge_enabled
        ? fb.ProfilePath + 'js_data\\' + DarkOneQueueBridge.resultFileName
        : '';
    this.bridge_timer = 0;
    this.bridge_attempt = 0;
    this.bridge_require_new = false;
    this.bridge_force_log = false;
    this.bridge_token = '';
    this.bridge_session = '';
    this.bridge_generation = 0;
    this.bridge_min_generation = 0;
    this.bridge_mode = false;
    this.bridge_writable = false;
    this.bridge_capabilities = [];
    this.bridge_logged = false;
    this.mutation_timer = 0;
    this.mutation_attempt = 0;
    this.mutation_pending_id = '';
    this.mutation_sequence = 0;
    this.mutation_target_selection = null;
    this.pending_queue_position_selection = null;
    this.properties = { tf : new _p('DARKONEJSP3.QUEUE.TF', '%artist% - %title%') };
    this.tfo = fb.TitleFormat(this.properties.tf.value);
    this.queue_indexes_tfo = fb.TitleFormat('[%queue_indexes%]');
    this.queue_total_tfo = fb.TitleFormat('[%queue_total%]');
    this.source_id_tfo = fb.TitleFormat('%path%|%subsong%');
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
