from __future__ import annotations

import re

from .context import ValidationContext


def run(ctx: ValidationContext) -> None:
    root = ctx.root
    project = ctx.project
    samples = ctx.samples
    errors = ctx.errors
    rel = ctx.rel
    text = ctx.text
    # Standalone enhanced-sample reset bridge scope and ownership.
    sample_defaults_import = '%fb2k_component_path%samples\\shared\\sample_defaults.js'
    sample_bridge_import = '%fb2k_component_path%samples\\js\\jsp3_enhanced_reset.js'
    legacy_project_import = '%fb2k_profile_path%DarkOneJSP3\\'
    reset_entries: set[str] = set()
    if samples.exists():
        for entry in samples.glob('*.txt'):
            body = text(entry)
            if legacy_project_import in body:
                errors.append(rel(entry) + ' retains a hard DarkOneJSP3 profile dependency')
            if sample_defaults_import in body or sample_bridge_import in body:
                reset_entries.add(entry.name)
            if (sample_defaults_import in body) != (sample_bridge_import in body):
                errors.append(rel(entry) + ' imports only half of the standalone reset bridge')
    expected_reset_entries = {
        'Album Notes.txt',
        'Last.fm Artist Info + User Info.txt',
        'Last.fm Bio.txt',
        'MusicBrainz.txt',
        'JS Playlist.txt',
        'Properties.txt',
        'Smooth Playlist Manager.txt',
    }
    if reset_entries != expected_reset_entries:
        errors.append(
            'Standalone reset bridge import ownership mismatch: ' +
            ', '.join(sorted(reset_entries))
        )

    # Any active entry script that calls the reset helper must import both halves.
    reset_callback_entries = (
        sorted(samples.glob('*.txt')) +
        sorted((project / 'jscript').glob('*.txt')) +
        sorted((project / 'jsplitter' / 'loaders').glob('*.txt'))
    )
    for entry in reset_callback_entries:
        body = text(entry)
        if 'jsp3EnhancedHandleSampleReset(' not in body:
            continue
        missing = []
        if sample_defaults_import not in body:
            missing.append('sample_defaults.js')
        if sample_bridge_import not in body:
            missing.append('jsp3_enhanced_reset.js')
        if missing:
            errors.append(
                rel(entry) + ' calls the standalone reset helper without importing ' +
                ' and '.join(missing)
            )

    queue_entry = project / 'jscript' / 'DarkOneJSP3 - Queue Viewer.txt'
    if queue_entry.exists():
        body = text(queue_entry)
        if '// @version "0.8.1"' not in body:
            errors.append('DarkOneJSP3 Queue Viewer wrapper version is not 0.8.1')
        if 'jsp3EnhancedHandleSampleReset(name, info, "queue-viewer")' not in body:
            errors.append('DarkOneJSP3 Queue Viewer reset callback is missing')
        if sample_defaults_import not in body or sample_bridge_import not in body:
            errors.append('DarkOneJSP3 Queue Viewer standalone reset imports are incomplete')
        for token in [
            '@import "%fb2k_profile_path%DarkOneJSP3\\shared\\queue_bridge.js"',
            'var DARKONEJSP3_QUEUE_BRIDGE_ENABLED = true;',
            'function on_playlists_changed() { queue.source_topology_changed(); }',
        ]:
            if token not in body:
                errors.append('DarkOneJSP3 Queue Viewer direct bridge wrapper is incomplete: ' + token)

    generic_queue_entry = samples / 'Queue Viewer.txt'
    if generic_queue_entry.exists() and '// @version "0.8.1"' not in text(generic_queue_entry):
        errors.append('Generic enhanced Queue Viewer entry version is not 0.8.1')

    queue_source = project / 'jscript' / 'js' / 'Queue_Viewer.js'
    if queue_source.exists():
        body = text(queue_source)
        for token in [
            'this.selected_indices = []',
            'this.select_range = function',
            'this.select_all = function',
            'case VK_PGUP:',
            'case VK_PGDN:',
            "handles.RunContextCommand('Properties')",
            'plman.ExecutePlaylistDefaultAction',
            'utils.SetClipboardText',
            'this.apply_queue_data(state.data, this.pending_selection)',
            "case 1407:",
            "case 1410:",
            "case 1415:",
            "case 0x2E: // Delete",
            "this.request_queue_mutation = function",
            "'Remove item from queue'",
            "'Move to top'",
            "'Clear playback queue'",
            'this.bridge_min_generation = 0',
            'stateGeneration >= this.bridge_min_generation',
            'acknowledgedGeneration',
        ]:
            if token not in body:
                errors.append('Queue Viewer navigation/command support is missing: ' + token)
        for forbidden in [
            'FlushPlaybackQueue',
            'RemoveItemFromPlaybackQueue',
            'RemoveItemsFromPlaybackQueue',
            'GetPlaybackQueueHandles',
        ]:
            if forbidden in body:
                errors.append('Queue Viewer uses unsupported queue API: ' + forbidden)

    for path in [
        samples / 'js' / 'darkone_network.js',
        samples / 'js' / 'musicbrainz.js',
        samples / 'js' / 'allmusic.js',
        samples / 'js' / 'album_notes.js',
        project / 'jscript' / 'js' / 'Queue_Viewer.js',
    ]:
        if not path.exists():
            continue
        body = text(path)
        for obsolete in [
            'DarkOneJSP3 application (recommended)',
            'DarkOneJSP3 Album Notes diagnostics',
            '[DarkOneJSP3 Queue Viewer]',
            "'DarkOneJSP3/0.6.2 (foobar2000 JScript Panel 3",
        ]:
            if obsolete in body:
                errors.append(rel(path) + ' retains visible project branding in a standalone sample: ' + obsolete)

    common = samples / 'js' / 'common.js'
    if common.exists():
        body = text(common)
        if 'darkOneJsp3HandleSampleReset' in body:
            errors.append('Generic common.js still contains the project reset bridge')
        if re.search(r'(^|\n)\s*include\s*\(', body):
            errors.append('samples/js/common.js contains a runtime include() call')

    panel_helper = samples / 'js' / 'panel.js'
    if panel_helper.exists():
        body = text(panel_helper)
        for token in [
            'options.enhanced_page_background === true',
            'options.darkonejsp3_page_background === true',
            "new _p('DARKONEJSP3.PAGE.BACKGROUND.MODE', 3)",
            "new _p('DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR', RGB(24, 24, 24))",
            "'DarkOne grey'",
            "'DarkOne dark grey'",
            "'Columns UI global background'",
            "'Page background colour'",
            'gr.Clear(this.page_background_colour())',
            "typeof DarkOneColour !== 'undefined'",
            'case Boolean(background_option):',
        ]:
            if token not in body:
                errors.append('Page-background helper is missing: ' + token)

    page_background_entries = {
        samples / 'Last.fm Bio.txt': 'lastfm-bio',
        samples / 'Last.fm Artist Info + User Info.txt': 'lastfm-info',
        samples / 'Album Notes.txt': 'album-notes',
        project / 'jscript' / 'DarkOneJSP3 - Queue Viewer.txt': 'queue-viewer',
        samples / 'Properties.txt': 'properties',
    }
    for entry, role in page_background_entries.items():
        if not entry.exists():
            continue
        body = text(entry)
        if 'new _panel({ enhanced_page_background : true })' not in body:
            errors.append(rel(entry) + ' does not opt in to page backgrounds')
        if role not in body:
            errors.append(rel(entry) + ' does not identify its reset role: ' + role)

    standalone_performance_helper = samples / 'shared' / 'performance_utils.js'
    standalone_cadence_helper = samples / 'shared' / 'ui_cadence.js'
    component_helpers = root / 'user-components-x64' / 'foo_jscript_panel3' / 'helpers.txt'
    if standalone_performance_helper.exists() and 'typeof DarkOnePerformance != "undefined"' not in text(standalone_performance_helper):
        errors.append('Standalone performance helper lacks duplicate-import protection')
    if standalone_cadence_helper.exists() and 'typeof DarkOneUiCadence != "undefined"' not in text(standalone_cadence_helper):
        errors.append('Standalone UI-cadence helper lacks duplicate-import protection')
    canonical_import_order = {
        samples / 'JS Playlist.txt': [
            'samples\\shared\\performance_utils.js',
            'samples\\shared\\ui_cadence.js',
            '%fb2k_component_path%helpers.txt',
        ],
        samples / 'Smooth Playlist Manager.txt': [
            'samples\\shared\\performance_utils.js',
            'samples\\shared\\ui_cadence.js',
            '%fb2k_component_path%helpers.txt',
        ],
        project / 'jscript' / 'DarkOneJSP3 - Display Panel.txt': [
            'DarkOneJSP3\\shared\\performance_utils.js',
            'DarkOneJSP3\\shared\\ui_cadence.js',
            '%fb2k_component_path%helpers.txt',
        ],
        project / 'jscript' / 'DarkOneJSP3 - Control Panel - Left.txt': [
            'DarkOneJSP3\\shared\\performance_utils.js',
            '%fb2k_component_path%helpers.txt',
        ],
        project / 'jscript' / 'DarkOneJSP3 - Control Panel - Right.txt': [
            'DarkOneJSP3\\shared\\performance_utils.js',
            'DarkOneJSP3\\shared\\ui_cadence.js',
            '%fb2k_component_path%helpers.txt',
        ],
    }
    for entry, tokens in canonical_import_order.items():
        if not entry.exists():
            continue
        body = text(entry)
        positions = [body.find(token) for token in tokens]
        if any(position < 0 for position in positions) or positions != sorted(positions):
            errors.append(rel(entry) + ' does not load canonical helpers before helpers.txt')

    redundant_network_import = '%fb2k_component_path%samples\\js\\darkone_network.js'
    for entry in [
        samples / 'Album Notes.txt',
        samples / 'MusicBrainz.txt',
        samples / 'Allmusic Review.txt',
        samples / 'Allmusic Review + Album Art.txt',
    ]:
        if entry.exists() and redundant_network_import in text(entry):
            errors.append(rel(entry) + ' redundantly imports the network coordinator after common.js')

    if component_helpers.exists():
        helper_body = text(component_helpers)
        for token in [
            '// == JSP3 ENHANCED SAMPLE COMPATIBILITY HELPERS ==',
            'var DarkOnePerformance = typeof DarkOnePerformance != "undefined"',
            'var DarkOneUiCadence = typeof DarkOneUiCadence != "undefined"',
            '// == END JSP3 ENHANCED SAMPLE COMPATIBILITY HELPERS ==',
        ]:
            if token not in helper_body:
                errors.append('helpers.txt legacy-sample compatibility is missing: ' + token)

    performance_helper = project / 'shared' / 'performance_utils.js'
    if performance_helper.exists():
        body = text(performance_helper)
        for token in [
            'DARKONE_PERFORMANCE_UTILS_VERSION = "0.1.5"',
            'createRepaintScheduler',
            'createFrameLoop',
            'createValueCoalescer',
            'reschedule: function ()',
            'createTrailingDeadline',
            'createProfiler',
            'toBitmap',
        ]:
            if token not in body:
                errors.append('Shared performance-helper module is incomplete: ' + token)
        for forbidden in [
            'typeof resource.Dispose',
            'typeof image.CreateBitmap',
            'typeof utils.LoadBitmap',
            'typeof utils.LoadImage',
            'typeof utilsObject.CreateProfiler',
            'typeof profiler.Reset',
        ]:
            if forbidden in body:
                errors.append(
                    'Shared performance-helper module incorrectly gates a native JScript Panel COM method with typeof: ' +
                    forbidden)


    ui_cadence_helper = project / 'shared' / 'ui_cadence.js'
    if ui_cadence_helper.exists():
        body = text(ui_cadence_helper)
        for token in [
            'DARKONE_UI_CADENCE_VERSION = "0.1.1"',
            'DarkOneJSP3.UIRefresh.Source.State',
            'DarkOneJSP3.UIRefresh.Source.Query',
            'DarkOneJSP3.VolumeRefresh.State',
            'DarkOneJSP3.VolumeRefresh.Query',
            'createSourceReporter',
            'createVolumeOwner',
            'createVolumeFollower',
            'Automatic (currently ',
            'VOLUME_MANUAL_INTERVALS = [8, 10, 12, 16]',
        ]:
            if token not in body:
                errors.append('Shared UI-cadence protocol is incomplete: ' + token)

    project_reset_receivers = {
        project / 'jscript' / 'js' / 'Config_Global_Script.js': [
            'function darkOneNormaliseResetScope(value)',
            "if (!scope || !role || !DARKONEJSP3_RESET_REGISTRY[role]) return false;",
        ],
        project / 'jsplitter' / 'shared.js': [
            'function darkOneJsp3NormaliseResetScope(value)',
            "if (!scope || !role || !DARKONEJSP3_RESET_REGISTRY[role]) return false;",
        ],
    }
    for receiver, tokens in project_reset_receivers.items():
        if not receiver.exists():
            continue
        receiver_body = text(receiver)
        for token in tokens:
            if token not in receiver_body:
                errors.append(rel(receiver) + ' project reset hardening is missing: ' + token)

    reset_bridge_path = samples / 'js' / 'jsp3_enhanced_reset.js'
    if reset_bridge_path.exists():
        bridge_body = text(reset_bridge_path)
        for token in [
            'function jsp3EnhancedNormaliseResetScope(value)',
            'function jsp3EnhancedHasResetRole(role)',
            'if (!scope) return false;',
            'if (!handled) return false;',
        ]:
            if token not in bridge_body:
                errors.append('Standalone reset bridge hardening is missing: ' + token)

    legacy_reset_path = samples / 'js' / 'darkonejsp3_reset.js'
    if legacy_reset_path.exists():
        legacy_body = text(legacy_reset_path)
        for token in [
            '// == JSP3 ENHANCED LEGACY SAMPLE DEFAULTS ==',
            '// == END JSP3 ENHANCED LEGACY SAMPLE DEFAULTS ==',
            '// == JSP3 ENHANCED LEGACY RESET BRIDGE ==',
            '// == END JSP3 ENHANCED LEGACY RESET BRIDGE ==',
        ]:
            if token not in legacy_body:
                errors.append('Legacy saved-entry reset adapter is missing: ' + token)

    sample_registry_path = samples / 'shared' / 'sample_defaults.js'
    if sample_registry_path.exists():
        registry_body = text(sample_registry_path)
        for token in [
            'var JSP3_ENHANCED_RESET_REGISTRY = {',
            'function jsp3EnhancedRoleDefaults(role, scope)',
            'function jsp3EnhancedApplyRoleReset(role, scope)',
            'var DARKONEJSP3_SAMPLE_RESET_REGISTRY = JSP3_ENHANCED_RESET_REGISTRY',
        ]:
            if token not in registry_body:
                errors.append('Standalone sample-default registry is missing: ' + token)
        for role in ['lastfm-bio', 'lastfm-info', 'album-notes', 'queue-viewer', 'properties']:
            role_match = re.search(
                r'"' + re.escape(role) + r'"\s*:\s*\{(.*?)(?=\n    "[^"]+"\s*:\s*\{|\n\};)',
                registry_body, re.S)
            if not role_match:
                errors.append('Standalone sample reset registry is missing page-background role: ' + role)
                continue
            block = role_match.group(1)
            for token in [
                    '"DARKONEJSP3.PAGE.BACKGROUND.MODE": 3',
                    '"DARKONEJSP3.PAGE.BACKGROUND.CUSTOM.COLOUR": 0xff181818']:
                if token not in block:
                    errors.append('Standalone sample reset registry page-background default is missing for ' + role + ': ' + token)

    album_notes = samples / 'Album Notes.txt'
    if album_notes.exists():
        album_notes_entry_body = text(album_notes)
        token = 'jsp3EnhancedHandleSampleReset(name, info, ["album-notes", "musicbrainz"])'
        if token not in album_notes_entry_body:
            errors.append('Album Notes does not reset embedded MusicBrainz settings')
        if '// @version "0.6.8"' not in album_notes_entry_body:
            errors.append('Album Notes entry version is not 0.6.8')

    album_art_entry = samples / 'Album Art.txt'
    if album_art_entry.exists():
        album_art_body = text(album_art_entry)
        for token in [
            '// @name "Album Art - Enhanced"',
            '// @version "0.1.2"',
            '// @author "marc2003 / DeViLhoOD"',
            'albumart.dispose();',
        ]:
            if token not in album_art_body:
                errors.append('Enhanced Album Art entry is missing: ' + token)
        for token in [
            'Side divider colour',
            'DarkOneJSP3.ArtSpectrum.Divider.',
            'darkOneJsp3Divider',
        ]:
            if token in album_art_body:
                errors.append('Album Art retains unsupported divider bridge: ' + token)

    album_art_impl = samples / 'js' / 'albumart.js'
    if album_art_impl.exists():
        album_art_impl_body = text(album_art_impl)
        for token in [
            'this.wheel_debounce_ms = 80;',
            'this.pending_id = id;',
            'this.wheel_timer = window.SetTimeout(function () {',
            'return this.cycle_artwork(s, true);',
            'this.cancel_wheel_selection();',
            "square_sizing : new _p('2K3.ARTREADER.SQUARE.SIZING', 0)",
            "'Panel sizing'",
            "'Fill panel height (crop sides)'",
            'this.square_rect = function ()',
        ]:
            if token not in album_art_impl_body:
                errors.append('Album Art wheel hardening is missing: ' + token)

    legacy_allmusic_entry = samples / 'Allmusic Review.txt'
    if legacy_allmusic_entry.exists() and '// @version "0.6.6"' not in text(legacy_allmusic_entry):
        errors.append('Legacy AllMusic-slot Album Notes entry version is not 0.6.6')
    allmusic_art_entry = samples / 'Allmusic Review + Album Art.txt'
    if allmusic_art_entry.exists() and '// @version "0.6.4"' not in text(allmusic_art_entry):
        errors.append('AllMusic + Album Art entry version is not 0.6.4')

    allmusic_impl = samples / 'js' / 'allmusic.js'
    album_notes_impl = samples / 'js' / 'album_notes.js'
    if allmusic_impl.exists():
        allmusic_body = text(allmusic_impl)
        for token in [
            'this.activate_managed = function (force)',
            'this.has_pending_work = function ()',
            "this.history = {};",
            "this.notify_terminal(false, 'provider did not start a request');",
            "this.notify_terminal(false, 'browser-verification backoff');",
            "this.notify_terminal(false, 'request could not be started');",
            "this.notify_terminal(false, 'artist or album tags are missing');",
            "this.notify_terminal(false, 'could not resolve the full AllMusic album page');",
        ]:
            if token not in allmusic_body:
                errors.append('AllMusic state-machine hardening is missing: ' + token)
    if album_notes_impl.exists():
        album_notes_body = text(album_notes_impl)
        for token in [
            'this.allmusic.activate_managed(!!force);',
            'this.clear_allmusic_activation_guard = function ()',
            'this.allmusic_activation_timer = window.SetTimeout(function ()',
            "reason : 'provider activation produced no request or terminal result'",
            'this.clear_allmusic_activation_guard(); this.cancel_requests();',
        ]:
            if token not in album_notes_body:
                errors.append('Album Notes AllMusic activation guard is missing: ' + token)
    musicbrainz = samples / 'MusicBrainz.txt'
    if musicbrainz.exists():
        musicbrainz_body = text(musicbrainz)
        if 'jsp3EnhancedHandleSampleReset(name, info, "musicbrainz")' not in musicbrainz_body:
            errors.append('Standalone MusicBrainz reset bridge is missing')
        if '// @version "0.6.4"' not in musicbrainz_body:
            errors.append('MusicBrainz entry version is not 0.6.4')
    js_playlist_entry = samples / 'JS Playlist.txt'
    if js_playlist_entry.exists():
        body = text(js_playlist_entry)
        if 'jsp3EnhancedHandleSampleReset(name, info, "js-playlist")' not in body:
            errors.append('JS Playlist reset bridge is missing')
        if '// @version "0.6.4"' not in body:
            errors.append('JS Playlist entry version is not 0.6.4')
        for token in [
            'samples\\shared\\performance_utils.js',
            'samples\\shared\\ui_cadence.js',
            'samples\\jsplaylist\\render_cache.js',
        ]:
            if token not in body:
                errors.append('JS Playlist performance import is missing: ' + token)

    js_playlist_main = samples / 'jsplaylist' / 'main.js'
    js_playlist_rows = samples / 'jsplaylist' / 'playlist.js'
    js_playlist_header = samples / 'jsplaylist' / 'headerbar.js'
    js_playlist_topbar = samples / 'jsplaylist' / 'topbar.js'
    js_playlist_cache = samples / 'jsplaylist' / 'render_cache.js'
    if js_playlist_rows.exists():
        body = text(js_playlist_rows)
        for token in [
            'DARKONE_JSPLAYLIST_QUICKSEARCH_CONTEXT_FILE',
            'jsplaylist_quicksearch_context_tags()',
            'get_playlist_viewport_row_load_count(',
            'this.getViewportRowsToLoad = function (pixel_shift, offset_override)',
            'this.loadedRowCount = rowsToLoad;',
            'jsplaylist_quicksearch_context_value(quicksearch_metadb, quicksearch_tags[qs])',
            'jsplaylist_quicksearch_notify(quicksearch_tags[quicksearch_index], quicksearch_values[quicksearch_index])',
            '"Search for same"',
            '700 + qs',
        ]:
            if token not in body:
                errors.append('JS Playlist Quick Search context integration is missing: ' + token)

    if js_playlist_main.exists():
        body = text(js_playlist_main)
        for token in [
            'DarkOnePerformance.createRepaintScheduler(window, {',
            'g_repaint_scheduler.request();',
            'function repaint_scroll_frame()',
            'repaint_scroll_frame();',
            'DarkOnePerformance.toBitmap(image, true)',
            'g_stub_image = DarkOnePerformance.toBitmap(refreshedStub, true);',
            'gr.DrawBitmap(img,',
            'g_playlist_render_cache.invalidateAll();',
            'g_playlist_render_cache.invalidateHandles(handle_list, p.list ? p.list.handleList : null);',
            'function on_playback_dynamic_info() {',
            'function on_playback_seek(time) {',
            'function bump_playlist_dynamic_generation() {',
            'function repaint_current_playlist_row() {',
            'function on_playlists_changed() {',
            'function update_playlist(preserveOffset)',
            'var previous_offset = preserveOffset ? p.list.offset : null;',
            'p.list.offset = Math.max(0, Math.min(Math.round(previous_offset), maximum_offset));',
            'update_playlist(true);',
            'Metadata-only changes such as an inline rating update',
            'DarkOnePerformance.createProfiler(',
            'function set_playlist_refresh_interval(value)',
            'g_js_playlist_cadence_reporter.announce();',
            'DarkOneUiCadence.createSourceReporter(window, {',
            'function reschedule_active_playlist_scroll_timers()',
            'function playlist_scroll_frame_tick()',
            'function ensure_playlist_scroll_frame()',
            'function repaint_playlist_scrollbar_drag_frame()',
            'function ensure_playlist_scrollbar_drag_frame()',
            'function begin_playlist_scrollbar_drag(snap_to_rows)',
            'function update_playlist_scrollbar_drag(position, snap_to_rows)',
            'function playlist_scrollbar_drag_frame_tick()',
            'function finish_playlist_scrollbar_drag(position, snap_to_rows)',
            'function cancel_playlist_scrollbar_drag()',
            'apply_free_wheel_position(position, preserve_scrollbar_cursor, suppress_repaint)',
            'DarkOnePerformance.createFrameLoop(window, {',
            'getDelay: function () { return cList.repaint_interval; }',
            'tick: playlist_scroll_frame_tick',
            'window.Repaint();',
        ]:
            if token not in body:
                errors.append('JS Playlist performance optimisation is missing: ' + token)
        for obsolete in [
            'function on_playlist_items_changed(playlistIndex) {\n\tif (playlistIndex == g_active_playlist) {\n\t\tupdate_playlist();',
            'DarkOneDisplayRefresh.createController(window, {',
            'function set_playlist_refresh_automatic()',
            'g_repaint_timer = window.SetInterval(function () {',
            'window.SetInterval(smooth_scroll_tick, cList.repaint_interval)',
            'window.SetInterval(free_wheel_scroll_tick, cList.repaint_interval)',
            'gr.DrawImage(img, dst_x, dst_y, dst_w, dst_h',
            'g_stub_image = fb.GetAlbumArtStub(cGroup.art_id);',
            'function schedule_playlist_scrollbar_drag_frame(',
            'function flush_playlist_scrollbar_drag_frame(',
            'function cancel_playlist_scrollbar_drag_frame(',
            'cList.scrollbar_drag_rebuild_items',
        ]:
            if obsolete in body:
                errors.append('JS Playlist retains an obsolete rendering path: ' + obsolete)
    js_playlist_scrollbar = samples / 'jsplaylist' / 'scrollbar.js'
    if js_playlist_scrollbar.exists():
        body = text(js_playlist_scrollbar)
        for token in [
            'cancel_playlist_scrollbar_drag();',
            'begin_playlist_scrollbar_drag(cList.scrollbar_snap);',
            'update_playlist_scrollbar_drag(target_row * Math.max(1, cRow.playlist_h), true);',
            'update_playlist_scrollbar_drag(this.setPixelPositionFromCursorPos(), false);',
            'finish_playlist_scrollbar_drag(final_row * Math.max(1, cRow.playlist_h), true);',
            'finish_playlist_scrollbar_drag(final_position, false);',
        ]:
            if token not in body:
                errors.append('JS Playlist scrollbar-drag interpolation handling is missing: ' + token)
        if 'g_mouse_wheel_timeout = window.SetTimeout(function () {' in body:
            errors.append('JS Playlist scrollbar dragging still reuses the wheel-throttle timer')
        for obsolete in [
            'schedule_playlist_scrollbar_drag_frame(',
            'flush_playlist_scrollbar_drag_frame(',
            'cancel_playlist_scrollbar_drag_frame(',
            'apply_free_wheel_position(this.setPixelPositionFromCursorPos(), true, true);',
        ]:
            if obsolete in body:
                errors.append('JS Playlist scrollbar dragging retains an input-driven one-shot path: ' + obsolete)
    if js_playlist_rows.exists():
        body = text(js_playlist_rows)
        for token in [
            'g_playlist_render_cache.getConfigured(this.track_index, forceFresh, paintState.dynamicGeneration)',
            'g_playlist_render_cache.configure(g_tf_pattern, secondaryPattern, lovedSync);',
            'paintState.dynamicGeneration = g_playlist_dynamic_generation;',
            'var paintState = g_playlist_paint_state;',
            'this.repaintTrack = function (trackIndex)',
            'this.refreshSelectionCache = function ()',
            'item.is_selected = item.type == 0 && plman.IsPlaylistItemSelected(',
            'this.allowItemReuse && !forceFocus',
            'var reusable = {};',
            'this.buildPaintColumns = function ()',
        ]:
            if token not in body:
                errors.append('JS Playlist row-cache optimisation is missing: ' + token)
    if js_playlist_topbar.exists():
        body = text(js_playlist_topbar)
        for token in [
            'DarkOnePerformance.loadBitmap(',
            'gr.DrawBitmap(this.logo,',
        ]:
            if token not in body:
                errors.append('JS Playlist top-bar bitmap optimisation is missing: ' + token)
        if 'gr.DrawImage(this.logo,' in body:
            errors.append('JS Playlist top bar retains the obsolete image rendering path')

    if js_playlist_header.exists():
        body = text(js_playlist_header)
        for token in [
            'this.columnsDirty = true;',
            'this.columnsVersion = 0;',
            'if (!this.columnsDirty) return;',
            'this.columnsVersion++;',
            'this.invalidateColumns();',
        ]:
            if token not in body:
                errors.append('JS Playlist column-layout caching is missing: ' + token)
    if js_playlist_cache.exists():
        body = text(js_playlist_cache)
        for token in [
            'DARKONE_JSPLAYLIST_RENDER_CACHE_VERSION = "0.1.1"',
            'this.globalClockDynamic',
            'this.dynamicHits',
            'this.primaryCoupledDynamic',
            'this.getConfigured = function (trackIndex, refreshCurrentFields, currentGeneration)',
            'entry.dynamicResult && entry.dynamicKey === dynamicKey',
            'this.invalidateHandles = function (changedHandles, activeHandles)',
            'if (key === this.patternKey) return false;',
            'this.invalidateAll = function ()',
            'this.maxEntries',
        ]:
            if token not in body:
                errors.append('JS Playlist render-cache module is incomplete: ' + token)

    # v1.0.9 JSP3 native-resource/API hardening invariants.
    if js_playlist_main.exists():
        body = text(js_playlist_main)
        for token in [
            'DarkOnePerformance.dispose(selectedItems);',
            'DarkOnePerformance.disposeUnique(uiResources);',
        ]:
            if token not in body:
                errors.append('JS Playlist native-resource cleanup is missing: ' + token)
    if js_playlist_topbar.exists():
        body = text(js_playlist_topbar)
        for token in ['DarkOnePerformance.disposeUnique(this.button.img);', 'DarkOnePerformance.dispose(playlistItems);']:
            if token not in body:
                errors.append('JS Playlist top-bar native cleanup is missing: ' + token)
    if js_playlist_header.exists() and 'DarkOnePerformance.disposeUnique([this.slide_close, this.slide_open]);' not in text(js_playlist_header):
        errors.append('JS Playlist header images are not disposed before replacement')
    if js_playlist_scrollbar.exists():
        body = text(js_playlist_scrollbar)
        for token in [
            'DarkOnePerformance.dispose(this.cursorImage_normal);',
            'DarkOnePerformance.disposeUnique([this.upImage_normal, this.downImage_normal]);',
        ]:
            if token not in body:
                errors.append('JS Playlist scrollbar image replacement cleanup is missing: ' + token)
    js_playlist_manager_source = samples / 'jsplaylist' / 'playlistmanager.js'
    if js_playlist_manager_source.exists() and 'DarkOnePerformance.disposeUnique([this.bt_sortAz_normal, this.bt_sortZa_normal]);' not in text(js_playlist_manager_source):
        errors.append('JS Playlist playlist-manager button images are not disposed before replacement')
    js_playlist_settings_resource = samples / 'jsplaylist' / 'settings.js'
    if js_playlist_settings_resource.exists():
        body = text(js_playlist_settings_resource)
        for token in [
            'this.checkbox_normal_off, this.checkbox_hover_off',
            'this.radiobt_normal_off, this.radiobt_hover_off',
            'DarkOnePerformance.disposeUnique(previousButtonImages);',
            'DarkOnePerformance.dispose(this.tab_img);',
        ]:
            if token not in body:
                errors.append('JS Playlist settings image cleanup is missing: ' + token)
    smooth_scrollbar_source = samples / 'smooth' / 'scrollbar.js'
    if smooth_scrollbar_source.exists():
        body = text(smooth_scrollbar_source)
        for token in ['this.dispose = function ()', 'DarkOnePerformance.disposeUnique([']:
            if token not in body:
                errors.append('Smooth scrollbar native-image cleanup is missing: ' + token)
    dwrite_fonts = samples / 'basic' / 'DWriteFonts.txt'
    if dwrite_fonts.exists():
        body = text(dwrite_fonts)
        if 'function on_font_changed()' not in body or 'on_fonts_changed' in body:
            errors.append('DWrite Fonts sample does not use the documented on_font_changed() callback')
    quick_search_resource_source = project / 'jscript' / 'js' / 'Quick_Search.js'
    if quick_search_resource_source.exists():
        body = text(quick_search_resource_source)
        if "try { value.Dispose(); } catch (e) {}" not in body:
            errors.append('Quick Search native disposal does not call Dispose() directly under exception handling')
    optional_button_source = project / 'jscript' / 'js' / 'Buttons_OptionalMenu.js'
    if optional_button_source.exists():
        body = text(optional_button_source)
        for token in [
            'var menus = [];',
            'var rootMenu = window.CreatePopupMenu();',
            'menus.push(rootMenu);',
            'var optionalMenu = window.CreatePopupMenu();',
            'menus.push(optionalMenu);',
            'for (var i = menus.length - 1; i >= 0; i--)',
            'try { menus[i].Dispose(); } catch (e) {}',
        ]:
            if token not in body:
                errors.append('Optional-button menu disposal is missing: ' + token)
    if js_playlist_cache.exists():
        body = text(js_playlist_cache)
        for forbidden in ['typeof changedHandles.Find', 'typeof activeHandles.GetItem']:
            if forbidden in body:
                errors.append('JS Playlist render-cache selective invalidation still gates a native method with typeof: ' + forbidden)
        for token in ['activeHandle = activeHandles.GetItem(trackIndex);', 'changedHandles.Find(activeHandle)', 'activeHandle.Dispose();']:
            if token not in body:
                errors.append('JS Playlist render-cache native-call hardening is missing: ' + token)

    display_performance = project / 'jscript' / 'js' / 'Object_DisplaySystem.js'
    if display_performance.exists():
        body = text(display_performance)
        for token in [
            'DarkOnePerformance.toBitmap(g_matrix_source, false)',
            'DarkOnePerformance.toBitmap(g_icons_source, false)',
            'this.drawMatrixSprite = function(',
            'gr.DrawBitmap(this.matrix_bitmap,',
            'this.drawMatrixDigit = function(',
            'this.drawTrackNumberMatrix = function(',
            'this.drawTimeMatrix = function(',
            'this.drawBitrateMatrix = function(',
            'this.setDisplayStyle = function(style)',
            'if (!force && this.font_key === font_key',
            'this.value_label_widths = {};',
            'this.value_label_widths[valueLabel]',
        ]:
            if token not in body:
                errors.append('Display bitmap/measurement optimisation is missing: ' + token)
        for obsolete in [
            'function BaseImage()',
            'function NumImage()',
            'function TimeImage()',
            'function BitrateImage()',
            'this.drawMatrixSpriteToImage = function(',
            'this.InitImages = function()',
        ]:
            if obsolete in body:
                errors.append('Display retains an obsolete composite-bitmap path: ' + obsolete)

    display_panel = project / 'jscript' / 'js' / 'Panel_Display.js'
    if display_panel.exists():
        body = text(display_panel)
        if 'display_system.setDisplayStyle(idx - 1);' not in body:
            errors.append('Display Style menu does not use the validated style setter')

    js_playlist_settings = samples / 'jsplaylist' / 'settings.js'
    if js_playlist_settings.exists():
        body = text(js_playlist_settings)
        for token in [
            'function createSettingsBackArrow(colour, size)',
            'var image = utils.CreateImage(size, size);',
            'var samplesPerAxis = 4;',
            'function containsPoint(px, py)',
            'gr.FillRectangle(x, y, 1, 1, setAlpha(colour, alpha));',
            'createSettingsBackArrow(this.color2, button_zoomSize)',
            'createSettingsBackArrow(this.color1, button_zoomSize)',
        ]:
            if token not in body:
                errors.append('JS Playlist settings back-arrow correction is missing: ' + token)
        for obsolete in [
            'utils.CreateImage(75, 75)',
            'close_off.Resize(button_zoomSize, button_zoomSize)',
            'close_ov.Resize(button_zoomSize, button_zoomSize)',
            'gb.DrawLine(21, 36, 36, 21, 3, this.color2)',
            'gr.DrawLine(headX, centreY - headOffset, tipX, centreY, stroke, colour)',
            'gr.DrawLine(tipX, centreY, headX, centreY + headOffset, stroke, colour)',
            'gr.DrawLine(tipX, centreY, shaftEndX, centreY, stroke, colour)',
        ]:
            if obsolete in body:
                errors.append('JS Playlist retains overlapping/resampled back-arrow code: ' + obsolete)
    playlist_manager_entry = samples / 'Smooth Playlist Manager.txt'
    if playlist_manager_entry.exists():
        body = text(playlist_manager_entry)
        if 'jsp3EnhancedHandleSampleReset(name, info, "playlist-manager")' not in body:
            errors.append('Smooth Playlist Manager reset bridge is missing')
        if '// @version "0.5.7"' not in body:
            errors.append('Smooth Playlist Manager entry version is not 0.5.7')
        if 'samples\\shared\\performance_utils.js' not in body:
            errors.append('Smooth Playlist Manager does not import shared performance helpers')
        if 'samples\\shared\\ui_cadence.js' not in body:
            errors.append('Smooth Playlist Manager does not import shared UI-cadence helpers')

    playlist_manager_impl = samples / 'smooth' / 'jsspm.js'
    if playlist_manager_impl.exists():
        body = text(playlist_manager_impl)
        for token in [
            'ppt.alternatingRowShading = window.GetProperty(',
            '"SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS"',
            'CheckMenuIf(ppt.alternatingRowShading)',
            'if (ppt.alternatingRowShading && i % 2 != 0)',
        ]:
            if token not in body:
                errors.append('Playlist Manager alternating-row control is missing: ' + token)
        for token in [
            'DarkOnePerformance.createFrameLoop(window, {',
            'function playlist_manager_frame_tick()',
            'if (g_playlist_manager_frame) g_playlist_manager_frame.stop();',
            'this.rows[i].isAutoPlaylist',
            'this.rows[i].isLocked',
            '!isAutoPlaylist && plman.IsPlaylistLocked(i)',
            'window.IsVisible && rowY + ppt.rowHeight',
            'DarkOnePerformance.createProfiler(',
            'function set_playlist_manager_refresh_rate(value)',
            'g_playlist_manager_cadence_reporter.announce();',
            'DarkOneUiCadence.createSourceReporter(window, {',
            'ppt.refreshRate = value;',
            'g_playlist_manager_frame.reschedule();',
            'set_playlist_manager_refresh_rate([8, 10, 12, 16][idx - 33]);',
            'Set custom refresh interval...',
            'timers.initialPopulate = window.SetTimeout(function () {',
            'function clearPlaylistManagerTimers()',
            'g_playlist_manager_frame.stop();',
            'window.ClearTimeout(timers.initialPopulate);',
            'window.ClearInterval(timers.movePlaylist);',
            'window.ClearInterval(cScrollBar.timerID);',
            'window.ClearInterval(cInputbox.timer_cursor);',
            'window.ClearTimeout(brw.inputbox.launch_timer);',
            'window.ClearTimeout(g_filterbox.inputbox.launch_timer);',
            'clearPlaylistManagerTimers();',
        ]:
            if token not in body:
                errors.append('Playlist Manager timer cleanup is missing: ' + token)
        for obsolete in [
            'DarkOneDisplayRefresh.createController(window, {',
            'function set_playlist_manager_refresh_automatic()',
            'timers.repaint = window.SetInterval(function () {',
            'plman.IsAutoPlaylist(this.rows[i].idx)',
            'plman.IsPlaylistLocked(this.rows[i].idx)',
            'window.SetProperty("SMOOTH.UI.REFRESH.INTERVAL.MS", [8, 10, 12, 16][idx - 32]);',
        ]:
            if obsolete in body:
                errors.append('Playlist Manager retains an obsolete performance path: ' + obsolete)

    registry_path = project / 'shared' / 'reset_defaults.js'
    sample_registry_path = samples / 'shared' / 'sample_defaults.js'
    if registry_path.exists():
        registry = text(registry_path)
        for role in ['control-left', 'control-right', 'display', 'root', 'main-columns', 'info-stack',
                     'display-waveform', 'bottom-controls']:
            if f'"{role}"' not in registry:
                errors.append('DarkOneJSP3 reset role missing: ' + role)
        for role in ['album-notes', 'musicbrainz', 'queue-viewer', 'js-playlist', 'playlist-manager']:
            if f'"{role}"' in registry:
                errors.append('Sample-owned reset role remains in the DarkOneJSP3 registry: ' + role)
        if '"DARKONEJSP3.VOLUME.DRAG.REFRESH.MODE": 0' not in registry:
            errors.append('Control Right reset registry is missing the automatic volume-cadence default')
        # The Bottom Controls JSplitter owns only the mirrored Quick Search
        # geometry values. Font, placeholder and result-lock properties live in
        # the JScript Panel instance and are reset by its scoped wrapper.
        for forbidden in [
            '"DARKONEJSP3.QUICKSEARCH.FONT.SIZE"',
            '"DARKONEJSP3.QUICKSEARCH.FONT.AUTO.SCALE"',
            '"DARKONEJSP3.QUICKSEARCH.SHOW.PLACEHOLDER"',
            '"DARKONEJSP3.QUICKSEARCH.RESULT.STANDARD.LOCK.MASK"',
        ]:
            if forbidden in registry:
                errors.append('JSplitter reset registry incorrectly owns a JScript Panel Quick Search property: ' + forbidden)
        for required in [
            '"DARKONEJSP3.QUICKSEARCH.LAYOUT.LINES": 2',
            '"DARKONEJSP3.QUICKSEARCH.LAYOUT.WIDTH.PERCENT": 44',
            '"DARKONEJSP3.QUICKSEARCH.LAYOUT.LINE.PIXELS": 24',
        ]:
            if required not in registry:
                errors.append('Bottom Controls reset registry is missing Quick Search layout ownership: ' + required)
        for token in [
            'darkOneJsp3AddOptionalButtonDefaults("control-left", 8);',
            'darkOneJsp3AddOptionalButtonDefaults("control-right", 10);',
            'add(entry.complete || {});',
        ]:
            if token not in registry:
                errors.append('Optional-button reset coverage is missing: ' + token)
        for token in [
            '"DARKONEJSP3.ART.SPECTRUM.DIVIDER.MODE": 1',
            '"DARKONEJSP3.ART.SPECTRUM.DIVIDER.CUSTOM.COLOUR": 0xff000000',
        ]:
            if token not in registry:
                errors.append('Upper divider reset default is missing: ' + token)
        for token in [
            '"DARKONEJSP3.BOTTOM.BACKGROUND.MODE": 2',
            '"DARKONEJSP3.BOTTOM.BACKGROUND.CUSTOM.COLOUR": 0xff000000',
            '"DARKONEJSP3.BOTTOM.DIVIDER.MODE": 4',
            '"DARKONEJSP3.BOTTOM.DIVIDER.CUSTOM.COLOUR": 0xff000000',
        ]:
            if token not in registry:
                errors.append('Bottom-area reset default is missing: ' + token)

    if sample_registry_path.exists():
        sample_registry = text(sample_registry_path)
        playlist_defaults = [
            '"JSPLAYLIST.Enable Smooth Scrolling": true',
            '"JSPLAYLIST.UI Refresh Interval (ms)": 8',
            '"JSPLAYLIST.Smooth Scroll Divisor": 2',
            '"JSPLAYLIST.Playlist Wheel Throttle (ms)": 8',
            '"JSPLAYLIST.Playlist Scroll Step": 3',
            '"JSPLAYLIST.Snap Wheel Scrolling To Rows": true',
            '"JSPLAYLIST.Snap Scrollbar Dragging To Rows": true',
            '"JSPLAYLIST.Free Wheel Step (pixels)": 0',
        ]
        manager_defaults = [
            '"SMOOTH.UI.REFRESH.INTERVAL.MS": 8',
            '"SMOOTH.SCROLL.SMOOTHNESS": 1.75',
            '"SMOOTH.ROW.SCROLL.STEP": 3',
            '"SMOOTH.PLAYLIST.MANAGER.REMEMBER.SCROLL": true',
            '"SMOOTH.PLAYLIST.MANAGER.AUTO.SHOW.ACTIVE": true',
            '"SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER": true',
            '"SMOOTH.PLAYLIST.MANAGER.FILTER.WIDTH": 300',
            '"SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT": 26',
            '"SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS": true',
            '"SMOOTH.PLAYLIST.MANAGER.SCROLL": 0',
            '"SMOOTH.PLAYLIST.MANAGER.SCROLL.STATE.V2": ""',
        ]
        for token in playlist_defaults:
            if token not in sample_registry:
                errors.append('JS Playlist reset default is missing: ' + token)
        for token in manager_defaults:
            if token not in sample_registry:
                errors.append('Playlist Manager reset default is missing: ' + token)

    art_spectrum_reset = project / 'jsplitter' / '04_art_spectrum.js'
    if art_spectrum_reset.exists():
        art_spectrum_reset_body = text(art_spectrum_reset)
        if 'var DARKONEJSP3_RESET_ROLE = "art-spectrum";' not in art_spectrum_reset_body:
            errors.append('Album Art/Spectrum controller does not declare its reset role')
        if 'darkOneJsp3HandleReset(name, data)' not in art_spectrum_reset_body:
            errors.append('Album Art/Spectrum controller does not handle factory reset')

    shared = project / 'jsplitter' / 'shared.js'
    if shared.exists() and 'if (!scope || !role || !DARKONEJSP3_RESET_REGISTRY[role]) return false;' not in text(shared):
        errors.append('JSplitter reset handler does not reject invalid scopes or hosts without settings')

    # Obsolete property migrations and helper parameters.
    display_system = project / 'jscript' / 'js' / 'Object_DisplaySystem.js'
    if display_system.exists():
        body = text(display_system)
        if 'Display Colour (0-5)' in body or 'DARKONE_DISPLAY_LEGACY_COLOURS' in body:
            errors.append('Obsolete Display Colour (0-5) migration remains active')
    config = project / 'jscript' / 'js' / 'Config_Global_Script.js'
    if config.exists():
        body = text(config)
        if 'function darkOneNumberProperty(name, legacyName,' in body:
            errors.append('darkOneNumberProperty still accepts legacyName')
        if 'function darkOneStringProperty(name, legacyName,' in body:
            errors.append('darkOneStringProperty still accepts legacyName')
        for token in [
            'function darkOneResetScope(info)',
            "JSON.stringify({ version : 1, scope : scope })",
        ]:
            if token not in body:
                errors.append('Control-panel reset bridge is missing: ' + token)
        if "NotifyOthers('DarkOneJSP3.Reset.Properties', { scope : scope })" in body:
            errors.append('Control-panel reset still sends an object payload')

    sample_reset = samples / 'js' / 'jsp3_enhanced_reset.js'
    if sample_reset.exists():
        body = text(sample_reset)
        for token in [
            'function jsp3EnhancedSampleResetScope(info)',
            'var scope = jsp3EnhancedSampleResetScope(info);',
            'JSP3Enhanced.Reset.Properties',
            'DarkOneJSP3.Reset.Properties',
            'function darkOneJsp3HandleSampleReset(name, info, roles)',
            'JSON.parse(info)',
        ]:
            if token not in body:
                errors.append('Standalone sample reset bridge is missing: ' + token)
    if shared.exists():
        body = text(shared)
        for token in [
            'function darkOneJsp3ResetScope(data)',
            'var scope = darkOneJsp3ResetScope(data);',
            'JSON.parse(data)',
        ]:
            if token not in body:
                errors.append('JSplitter reset bridge is missing serialised parsing: ' + token)

    info_stack_controller = project / 'jsplitter' / '03_info_stack_tabs.js'
    info_stack_colours = project / 'jsplitter' / 'info_stack_colours.js'
    info_stack_bridges = project / 'jsplitter' / 'info_stack_bridges.js'
    if info_stack_controller.exists():
        body = text(info_stack_controller)
        for token in [
            r"include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\info_stack_colours.js');",
            r"include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\info_stack_bridges.js');",
            'appendInfoStackTabColourMenu(tabColourMenu);',
            'appendInfoStackBackgroundMenu(backgroundMenu);',
            'appendInfoStackDividerMenu(dividerMenu);',
            'handleInfoStackColourMenu(id)',
            'handleInfoStackBridgeMenu(id)',
            'handleInfoStackBridgeNotification(name, data)',
            'requestInfoStackDividerState();',
        ]:
            if token not in body:
                errors.append('InfoStack helper integration is missing: ' + token)
        for token in [
            'function infoStackMenuStateSnapshot()',
            'function publishInfoStackMenuState()',
            'function handleInfoStackMenuAction(id, targetIndex)',
            'DarkOneViewBridge.infoStackActionFromCommand(viewCommand.command)',
        ]:
            if token not in body:
                errors.append('InfoStack local-menu bridge integration is missing: ' + token)
        for obsolete in [
            'function backgroundMode()',
            'function requestDividerState()',
            'function applyStartupMenuState(state)',
            'appendInfoStackStartupMenu(',
            "startupMenu.AppendTo(menu, MENU_POPUP, 'Startup')",
            'var DIVIDER_PROTOCOL = DarkOneProtocol.divider;',
            'var BACKGROUND_TRANSPARENT = 0;',
        ]:
            if obsolete in body:
                errors.append('InfoStack controller retains extracted logic: ' + obsolete)
    if info_stack_colours.exists():
        body = text(info_stack_colours)
        for token in [
            'var BACKGROUND_CUSTOM = 3;',
            'var BACKGROUND_DARKONE_DARK = 4;',
            'var BACKGROUND_COLUMNS_UI = 5;',
            "{ id: 703, mode: BACKGROUND_DARKONE_DARK, label: 'DarkOne dark grey' }",
            "{ id: 705, mode: BACKGROUND_COLUMNS_UI, label: 'Columns UI global background' }",
            "{ id: 704, mode: BACKGROUND_CUSTOM, custom: true }",
            'var TAB_COLOUR_COLUMNS_UI_SELECTED = 2;',
            "{ id: 802, mode: TAB_COLOUR_COLUMNS_UI_SELECTED, label: 'Columns UI selected-item background' }",
            "{ id: 801, mode: TAB_COLOUR_CUSTOM, custom: true }",
            'DarkOneColour.normaliseMode(',
            'DarkOneColour.appendRadioOptions(',
            'DarkOneColour.pickJsplitter(',
            'DarkOneColour.columnsUi(4, DOJSP3.colours.buttonNormal)',
            'function handleInfoStackColourMenu(id)',
        ]:
            if token not in body:
                errors.append('InfoStack colour helper is missing: ' + token)
    if info_stack_bridges.exists():
        body = text(info_stack_bridges)
        for token in [
            'var STARTUP_PROTOCOL = DarkOneProtocol.startup;',
            'var DIVIDER_PROTOCOL = DarkOneProtocol.divider;',
            'var DIVIDER_MENU_OPTIONS = DIVIDER_PROTOCOL.menuOptions(900);',
            'DIVIDER_PROTOCOL.notifications.query',
            'DIVIDER_PROTOCOL.notifications.set',
            'DIVIDER_PROTOCOL.notifications.state',
            'DIVIDER_PROTOCOL.serialiseState(',
            'DIVIDER_PROTOCOL.parseState(data)',
            'STARTUP_PROTOCOL.createReadinessBridge(',
            'function requestInfoStackDividerState()',
            'function handleInfoStackBridgeMenu(id)',
            'function handleInfoStackBridgeNotification(name, data)',
        ]:
            if token not in body:
                errors.append('InfoStack bridge helper is missing: ' + token)
        for obsolete in [
            'var DIVIDER_DARKONE = DIVIDER_PROTOCOL.modes.darkOne;',
            'var DIVIDER_DARKONE_DARK = DIVIDER_PROTOCOL.modes.darkOneDark;',
            'var DIVIDER_COLUMNS_UI = DIVIDER_PROTOCOL.modes.columnsUi;',
            'var STARTUP_BLACK_REVEAL = STARTUP_PROTOCOL.transitions.blackReveal;',
            'var STARTUP_STAGED_REVEAL = STARTUP_PROTOCOL.transitions.stagedReveal;',
            'STARTUP_PROTOCOL.notifications.queryControls',
            'STARTUP_PROTOCOL.notifications.commandControls',
            'STARTUP_PROTOCOL.notifications.stateControls',
            'function requestStartupControlState()',
            'function sendStartupControlCommand(action, key, value)',
            'function appendInfoStackStartupMenu(',
        ]:
            if obsolete in body:
                errors.append('InfoStack bridge helper retains unused protocol alias: ' + obsolete)

    display_system_path = project / 'jscript' / 'js' / 'Object_DisplaySystem.js'
    if display_system_path.exists():
        body = text(display_system_path)
        for token in [
            'var DARKONE_DISPLAY_ACCENT_COLUMNS_UI_SELECTED = 2;',
            'var DARKONE_DISPLAY_ACCENT_MODES = [',
            'DarkOneColour.normaliseMode(',
            'DarkOneColour.columnsUi(4, DARKONE_DISPLAY_DEFAULT_BLUE)',
            'if (this.accent_mode == DARKONE_DISPLAY_ACCENT_DEFAULT) return;',
            'this.refreshAccentSprites = function()',
            'this.custom_matrix_bitmap = DarkOnePerformance.toBitmap(',
            'this.custom_icons_bitmap = DarkOnePerformance.toBitmap(',
            'this.drawStatusIcon = function(',
        ]:
            if token not in body:
                errors.append('Display selected-item accent is missing: ' + token)

    display_panel_path = project / 'jscript' / 'js' / 'Panel_Display.js'
    if display_panel_path.exists():
        body = text(display_panel_path)
        for token in [
            'var DARKONE_DISPLAY_ACCENT_MENU_OPTIONS = [',
            'DARKONE_DISPLAY_ACCENT_COLUMNS_UI_SELECTED',
            'DarkOneColour.appendRadioOptions(',
            'DarkOneColour.pickJscript(',
            'if (chosen === null) break;',
        ]:
            if token not in body:
                errors.append('Display accent menu consolidation is missing: ' + token)

    # Established startup and layout invariants.
    root_controller = project / 'jsplitter' / '01_root.js'
    if root_controller.exists():
        body = text(root_controller)
        for token in [
            'var STARTUP_PREPAINT_DELAY_MS = 150;',
            'var STARTUP_STAGE_GAP_MS = 125;',
            'setRootVisibility(false, false);',
            'window.Repaint();',
            'var STARTUP_PROTOCOL = DarkOneProtocol.startup;',
            'var STARTUP_CONTROLLERS = STARTUP_PROTOCOL.controllers;',
            'STARTUP_PROTOCOL.serialiseState(state)',
            'STARTUP_PROTOCOL.parseCommand(data)',
            'STARTUP_PROTOCOL.notifications.queryControls',
            'STARTUP_PROTOCOL.notifications.commandControls',
            'STARTUP_PROTOCOL.notifications.ready',
            'DarkOneViewBridge.writeStartupState(state)',
            'DarkOneViewBridge.parseStartupActionCommand(data)',
            'function handleStartupViewCommand(data)',
            'if (name === DarkOneViewBridge.notification)',
            "if (key === 'readiness-timeout') return STARTUP_SAFETY_TIMEOUT_PROPERTY;",
            'function restoreStartupDefaults()',
        ]:
            if token not in body:
                errors.append('Startup reveal invariant is missing: ' + token)
        for obsolete in [
            "'DarkOneJSP3.Startup.Preview'",
            "'DarkOneJSP3.Settings.Batch'",
            "'DarkOneJSP3.SetProperty'",
            'function applySharedStartupProperty',
            'function applySharedStartupBatch',
        ]:
            if obsolete in body:
                errors.append('Root retains obsolete startup bridge: ' + obsolete)
    info_stack = project / 'jsplitter' / '03_info_stack_tabs.js'
    if info_stack.exists():
        body = text(info_stack)
        if 'hideInfoChildrenBeforeFirstLayout();' not in body or 'child.Show(false);' not in body:
            errors.append('InfoStack no longer hides children during initialisation')
        for token in [
            "var AUTO_FONT_SCALE_PROPERTY = 'DarkOneJSP3.InfoStack.AutoFontScale';",
            'function automaticFontScale()',
            'DOJSP3.clamp(value, 50, 200)',
            'baseSize * automaticFontScale() / 100',
            'var baseGap = DOJSP3.idiv(ww, 40);',
            'var gapScale = fixedFontSize > 0 ? 100 : automaticFontScale();',
            'baseGap * gapScale / 100',
            "'Set automatic base scale... (' + automaticFontScale() + '%)'",
            "'Automatic height (follows tab font sizing)'",
            "'Set fixed tab area height...'",
            "'Side divider colour'",
            r"include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\info_stack_colours.js');",
            r"include(fb.ProfilePath + 'DarkOneJSP3\\jsplitter\\info_stack_bridges.js');",
            'appendInfoStackTabColourMenu(tabColourMenu);',
            'appendInfoStackBackgroundMenu(backgroundMenu);',
            'appendInfoStackDividerMenu(dividerMenu);',
            'requestInfoStackDividerState();',
            'handleInfoStackBridgeNotification(name, data)',
        ]:
            if token not in body:
                errors.append('InfoStack automatic-font scale is missing: ' + token)
        for obsolete in [
            "'Set tab area height... ('",
            "'Set tab area height...'",
        ]:
            if obsolete in body:
                errors.append('InfoStack retains contradictory tab-area wording: ' + obsolete)

    config_global = project / 'jscript' / 'js' / 'Config_Global_Script.js'
    if config_global.exists():
        body = text(config_global)
        for token in [
            'var DARKONE_TOOLS_STARTUP_IDS = Object.freeze({',
            'function darkOneToolsStartupState()',
            'DarkOneViewBridge.readStartupState()',
            'function darkOneAppendToolsStartupMenu(menu, transitionMenu, state)',
            'function darkOneHandleToolsStartupMenuSelection(id, state)',
            'DarkOneViewBridge.startupActionCommand(action, key, value)',
            "startup.AppendTo(m, MF_STRING, 'Startup')",
            "utilities.AppendTo(m, MF_STRING, 'Utilities')",
        ]:
            if token not in body:
                errors.append('DarkOne Tools Startup/Utilities integration is missing: ' + token)
        for obsolete in [
            'DARKONEJSP3_STARTUP_DEFAULTS',
            'darkOneStartupTransition',
            'darkOneStartupMinimumDelay',
            'darkOneStartupSafetyTimeout',
            'darkOneSetStartupNumberProperty',
            'darkOnePreviewStartupTransition',
            "'DARKONEJSP3.STARTUP.TRANSITION'",
            "'DARKONEJSP3.STARTUP.MINIMUM.DELAY'",
            "'DARKONEJSP3.STARTUP.SAFETY.TIMEOUT'",
        ]:
            if obsolete in body:
                errors.append('JScript Panel retains obsolete startup control: ' + obsolete)

    main_columns = project / 'jsplitter' / '02_main_columns.js'
    if main_columns.exists():
        body = text(main_columns)
        for token in [
            'var px = Math.max(1, DOJSP3.idiv(ww, 640));',
            'var dividerCentre = DOJSP3.idiv(ww, 3);',
            'var dividerWidth = px * 2;',
            'function alternateArtWidth(baseWidth, dividerWidth)',
            'var preferred = artSpectrumVisualiserVisible ? baseWidth : wh;',
            'function mainLayoutGeometry(modeOverride)',
            'function prepareArtSpectrum(width, height)',
            'function layoutMainColumns(modeOverride, transition)',
            'if (hideArtDuringTransition) DOJSP3.show(art, false);',
            'if (hideArtDuringTransition) prepareArtSpectrum(geometry.artWidth, wh);',
            'DOJSP3.show(art, true);',
            'layoutMainColumns(MAIN_LAYOUT_ART_PLAYLIST, true);',
            'ART_SPECTRUM_PREPARE_NOTIFICATION',
            "var DIVIDER_MODE_PROPERTY = 'DARKONEJSP3.ART.SPECTRUM.DIVIDER.MODE';",
            "'DARKONEJSP3.ART.SPECTRUM.DIVIDER.CUSTOM.COLOUR';",
            'function dividerColour()',
            'if (mode === DIVIDER_BLACK) return 0xff000000;',
            'if (mode === DIVIDER_DARKONE) return DOJSP3.colours.bar;',
            'if (mode === DIVIDER_DARKONE_DARK) return DOJSP3.colours.separator;',
            'if (mode === DIVIDER_COLUMNS_UI) return DarkOneColour.columnsUi(3, DOJSP3.colours.bar);',
            'if (mode === DIVIDER_CUSTOM) return dividerCustomColour();',
            'if (dividerMode() === DIVIDER_TRANSPARENT) return;',
            "var MAIN_LAYOUT_MODE_PROPERTY = 'DARKONEJSP3.MAIN.LAYOUT.MODE';",
            'MAIN_LAYOUT_ART_PLAYLIST',
            'dividerPositions: [artWidth]',
            'positions: geometry.dividerPositions',
            'gr.FillSolidRect(metrics.positions[i], 0, metrics.width, wh, colour);',
            'DarkOneViewBridge.commands.layoutToggle',
            'DIVIDER_PROTOCOL.notifications.query',
            'DIVIDER_PROTOCOL.notifications.set',
            "'Side divider colour'",
            'var DIVIDER_MENU_OPTIONS = DIVIDER_PROTOCOL.menuOptions(100);',
            'var DIVIDER_DARKONE_DARK = DIVIDER_PROTOCOL.modes.darkOneDark;',
            'var DIVIDER_COLUMNS_UI = DIVIDER_PROTOCOL.modes.columnsUi;',
            'DarkOneColour.pickJsplitter(',
            'DarkOneColour.appendRadioOptions(',
            'DIVIDER_PROTOCOL.serialiseState(dividerState())',
            'DIVIDER_PROTOCOL.parseState(data)',
            'var targetWidth = Math.max(10, metrics.width);',
        ]:
            if token not in body:
                errors.append('Verified main-column geometry is missing: ' + token)
        for obsolete in [
            'gr.FillSolidRect(leftDivider, 0, px * 2, wh, 0xff000000);',
            'gr.FillSolidRect(rightDivider, 0, px * 2, wh, 0xff000000);',
            'DOJSP3.move(playlist, geometry.playlistX, 0, geometry.playlistWidth, wh);\n        DOJSP3.move(art, geometry.artX, 0, geometry.artWidth, wh);\n        DOJSP3.show(art, true);',
            'MAIN_LAYOUT_EXPANSION_SETTLE_MS',
            'stageMainLayoutExpansion',
            'mainLayoutTransitionTimer',
            'pendingMainLayoutMode',
        ]:
            if obsolete in body:
                errors.append('Upper divider remains hard-coded black: ' + obsolete)

    bottom_config = project / 'jscript' / 'js' / 'Config_Global_Script.js'
    if bottom_config.exists():
        body = text(bottom_config)
        for token in [
            "'DarkOneJSP3.BottomArea.Query'",
            "'DarkOneJSP3.BottomArea.Set'",
            "'DarkOneJSP3.BottomArea.State'",
            "'DARKONEJSP3.BOTTOM.BACKGROUND.MODE'",
            "'DARKONEJSP3.BOTTOM.BACKGROUND.CUSTOM.COLOUR'",
            "'DARKONEJSP3.BOTTOM.DIVIDER.MODE'",
            "'DARKONEJSP3.BOTTOM.DIVIDER.CUSTOM.COLOUR'",
            "'Bottom area background'",
            "'Bottom area side divider colour'",
            "'Transparent / inherit background'",
            "'Columns UI global background'",
            'if (mode === DARKONE_BOTTOM_MODE_DARKONE) return 0xff202020;',
            'function darkOnePaintBottomAreaBackground(gr)',
            'function darkOneApplyBottomAreaState(state, repaint)',
            'function darkOneInitialiseBottomAreaState(queryPeers)',
            'function darkOneRequestBottomAreaState()',
            'var darkOneBottomAreaInitialised = false;',
            "var DARKONE_RUNTIME_DATA_DIR = fb.ProfilePath + 'js_data\\\\';",
            "var DARKONE_BOTTOM_AREA_STATE_FILE = DARKONE_RUNTIME_DATA_DIR + 'darkonejsp3.bottom-area-state.txt';",
            "var DARKONE_BOTTOM_AREA_COMMIT_FILE = DARKONE_RUNTIME_DATA_DIR + 'darkonejsp3.bottom-area-command.txt';",
            "commit : 'DarkOneJSP3.BottomArea.Commit'",
            'function darkOneScheduleBottomAreaCommit(commit)',
            "var DARKONE_BOTTOM_AREA_LEGACY_STATE_FILE = fb.ProfilePath + 'DarkOneJSP3\\\\shared\\\\bottom-area-state.txt';",
            "var DARKONE_RESET_COMMAND_FILE = DARKONE_RUNTIME_DATA_DIR + 'darkonejsp3.reset-command.txt';",
            'function darkOneWriteResetCommand(scope)',
            'function darkOneResetBottomAreaDefaults()',
            'function darkOneScheduleBottomAreaStateRetry(serialised)',
            "utils.WriteTextFile(path, String(content))",
            "appearance.AppendTo(m, MF_STRING, 'Appearance');",
        ]:
            if token not in body:
                errors.append('JScript bottom-area appearance is missing: ' + token)
        for obsolete in [
            'darkOneBottomAreaStatePollTimer',
            'window.SetInterval(function ()',
            "DARKONE_BOTTOM_AREA_STATE_FILE = fb.ProfilePath + 'DarkOneJSP3\\\\shared\\\\bottom-area-state.txt'",
        ]:
            if obsolete in body[body.index('// Shared bottom-area appearance.'):body.index('function repeat(')]:
                errors.append('JScript bottom-area bridge retains obsolete polling/source-tree state: ' + obsolete)
        if 'serialised,\n                false' in body:
            errors.append('JScript bottom-area state writer still uses the failed three-argument call')

    bottom_controls = project / 'jsplitter' / '05_bottom_controls.js'
    if bottom_controls.exists():
        body = text(bottom_controls)
        for token in [
            'var DARKONEJSP3_RESET_ROLE = "bottom-controls";',
            'var BOTTOM_AREA_PROTOCOL = DarkOneProtocol.bottomArea;',
            "var BOTTOM_BACKGROUND_MODE_PROPERTY = 'DARKONEJSP3.BOTTOM.BACKGROUND.MODE';",
            "var BOTTOM_DIVIDER_MODE_PROPERTY = 'DARKONEJSP3.BOTTOM.DIVIDER.MODE';",
            'function bottomBackgroundColour()',
            'function bottomDividerColour()',
            "var RUNTIME_DATA_DIR = fb.ProfilePath + 'js_data\\\\';",
            "var BOTTOM_AREA_STATE_FILE = RUNTIME_DATA_DIR + 'darkonejsp3.bottom-area-state.txt';",
            "var BOTTOM_AREA_COMMIT_FILE = RUNTIME_DATA_DIR + 'darkonejsp3.bottom-area-command.txt';",
            'var BOTTOM_AREA_COMMIT_POLL_MS = 25;',
            'function syncBottomAreaCommitFile()',
            'function scheduleBottomAreaCommit(commit)',
            "var BOTTOM_AREA_LEGACY_STATE_FILE = fb.ProfilePath + 'DarkOneJSP3\\\\shared\\\\bottom-area-state.txt';",
            "var RESET_COMMAND_FILE = RUNTIME_DATA_DIR + 'darkonejsp3.reset-command.txt';",
            'var RUNTIME_BRIDGE_POLL_INTERVAL = 100;',
            'var RESET_COMMAND_POLL_INTERVAL = 500;',
            'var RESET_COMMAND_POLL_DIVISOR = Math.max(1, Math.round(',
            'function syncBottomAreaStateFile(createIfMissing)',
            'function broadcastBottomAreaState(state)',
            'BOTTOM_AREA_PROTOCOL.notifications.state',
            'function syncResetCommandFile()',
            'function processResetCommand(command)',
            'function acknowledgeResetCommandFile()',
            'runtimeBridgePollTimer = setInterval(function ()',
            'window.NotifyOthers(DARKONEJSP3_RESET_NOTIFICATION, payload)',
            'gr.FillSolidRect(0, 0, ww, wh, bottomBackgroundColour());',
            'DOJSP3.colours.separator',
            'if (state.dividerMode !== BOTTOM_AREA_PROTOCOL.modes.transparent)',
            'var leftDivider = DOJSP3.idiv(ww, 3) - px;',
            'var rightDivider = ww - DOJSP3.idiv(ww, 3) - px;',
            'gr.FillSolidRect(leftDivider, 0, px * 2, wh, dividerColour);',
            'gr.FillSolidRect(rightDivider, 0, px * 2, wh, dividerColour);',
            'function on_colours_changed()',
            'function readViewCommandFile()',
            'if (state.raw) acknowledgeViewCommandFile();',
        ]:
            if token not in body:
                errors.append('Shared bottom-area appearance is missing: ' + token)
        for obsolete in [
            'bottomAreaStateBroadcast',
            'BOTTOM_AREA_PROTOCOL.notifications.query',
            'BOTTOM_AREA_PROTOCOL.notifications.set',
        ]:
            if obsolete in body:
                errors.append('Bottom Controls retains obsolete JSplitter notification plumbing: ' + obsolete)

    protocol_path = project / 'shared' / 'jsplitter_protocols.js'
    if protocol_path.exists():
        protocol_body = text(protocol_path)
        for token in [
            '{ id: baseId + 4, mode: dividerModes.columnsUi,',
            '{ id: baseId + 5, mode: dividerModes.custom, custom: true }',
            "commit: 'DarkOneJSP3.BottomArea.Commit'",
            'function serialiseBottomAreaCommit(commit)',
            'function parseBottomAreaCommit(data, now)',
        ]:
            if token not in protocol_body:
                errors.append('Shared colour-menu ID mapping has drifted: ' + token)

    display_waveform = project / 'jsplitter' / '06_display_waveform.js'
    if display_waveform.exists():
        body = text(display_waveform)
        for token in [
            'var BACKGROUND_CUSTOM = 3;',
            'var BACKGROUND_DARKONE_DARK = 4;',
            'var BACKGROUND_COLUMNS_UI = 5;',
            'var BACKGROUND_AUTOMATIC = 6;',
            'var BACKGROUND_MODES = [',
            "{ id: 106, mode: BACKGROUND_AUTOMATIC, label: 'Automatic - Bottom area background' }",
            "{ id: 104, mode: BACKGROUND_DARKONE_DARK, label: 'DarkOne dark grey' }",
            "{ id: 105, mode: BACKGROUND_COLUMNS_UI, label: 'Columns UI global background' }",
            "{ id: 103, mode: BACKGROUND_CUSTOM, custom: true }",
            'if (mode === BACKGROUND_DARKONE_DARK) return DOJSP3.colours.separator;',
            'if (mode === BACKGROUND_COLUMNS_UI) return DarkOneColour.columnsUi(3, DOJSP3.colours.bar);',
            "var BOTTOM_AREA_STATE_FILE = fb.ProfilePath + 'js_data\\\\darkonejsp3.bottom-area-state.txt';",
            'var sharedBottomAreaState = readBottomAreaStateFile();',
            'function applySharedBottomAreaState(data, repaint)',
            'function scheduleSharedBottomAreaCommit(data)',
            'BOTTOM_AREA_PROTOCOL.notifications.commit',
            'if (mode === BACKGROUND_AUTOMATIC) return sharedBottomAreaBackgroundColour();',
            'return DOJSP3.colours.separator;',
            'gr.FillSolidRect(0, 0, ww, wh, backgroundColour());',
            'BOTTOM_AREA_PROTOCOL.notifications.state',
            'DarkOneColour.normaliseMode(',
            'DarkOneColour.appendRadioOptions(',
            'DarkOneColour.pickJsplitter(',
            'function on_colours_changed()',
            'function configureWaveformPseudoTransparency(waveform)',
            'waveform.SupportPseudoTransparency = true;',
            'var waveform = waveformPanel();',
        ]:
            if token not in body:
                errors.append('Waveform background palette is missing: ' + token)
        if 'window.GetProperty(BACKGROUND_MODE_PROPERTY, BACKGROUND_AUTOMATIC)' not in body:
            errors.append('Waveform Automatic background is not the default for new properties')

    reset_defaults = project / 'shared' / 'reset_defaults.js'
    if reset_defaults.exists() and (
            '"DarkOneJSP3.DisplayWaveform.BackgroundMode": 6' not in
            text(reset_defaults)):
        errors.append(
            'Waveform appearance reset does not restore Automatic background mode'
        )
    if reset_defaults.exists():
        reset_body = text(reset_defaults)
        expected_waveform_reset = '''    "display-waveform": {
        appearance: {
            "DarkOneJSP3.DisplayWaveform.BackgroundColour": 0xff202020,
            "DarkOneJSP3.DisplayWaveform.BackgroundMode": 6
        },
        behaviour: {
            "DarkOneJSP3.DisplayWaveform.HideWhenStopped": true,
            "DarkOneJSP3.DisplayWaveform.NewTrackRevealDelay": 200
        }
    }'''
        if expected_waveform_reset not in reset_body:
            errors.append('Waveform reset defaults do not separate appearance and behaviour correctly')
        for token in [
            '"DARKONEJSP3.MAIN.LAYOUT.MODE": 0',
            '"DARKONEJSP3.ARTSPECTRUM.LAYOUT.MODE": 0',
        ]:
            if token not in reset_body:
                errors.append('View-layout reset default is missing: ' + token)

    art_spectrum = project / 'jsplitter' / '04_art_spectrum.js'
    if art_spectrum.exists():
        body = text(art_spectrum)
        for token in [
            "var ART_SPECTRUM_MODE_PROPERTY = 'DARKONEJSP3.ARTSPECTRUM.LAYOUT.MODE';",
            'ART_SPECTRUM_ART_ONLY',
            'function layoutArtSpectrumForSize(width, height)',
            'DOJSP3.move(art, 0, 0, width, height);',
            'ART_SPECTRUM_PREPARE_NOTIFICATION',
            'broadcastArtSpectrumMode();',
            'DOJSP3.show(spectrum, false);',
            'DarkOneViewBridge.commands.visualiserToggle',
        ]:
            if token not in body:
                errors.append('Album Art/Spectrum responsive view mode is missing: ' + token)
        if 'layoutArtSpectrumForSize(ww, wh);' not in body:
            errors.append('Album Art/Spectrum controller does not fill its host')

    info_stack_tabs = project / 'jsplitter' / '03_info_stack_tabs.js'
    if info_stack_tabs.exists():
        info_body = text(info_stack_tabs)
        for token in [
            "var TAB_STRIP_VISIBLE_PROPERTY = 'DarkOneJSP3.InfoStack.TabStripVisible';",
            'function isTabStripVisible()',
            'function setTabStripVisible(visible)',
            "menu.AppendMenuItem(MENU_STRING, 250, 'Show tab strip');",
            'menu.CheckMenuItem(250, isTabStripVisible());',
            'function showInfoStackMenu(x, y, targetIndex)',
            'DarkOneViewBridge.parseNotificationData(data)',
            'contentHeight = wh;',
            'tabAreaHeight = 0;',
        ]:
            if token not in info_body:
                errors.append('InfoStack button/tab-strip integration is missing: ' + token)
        if "selectMenu.AppendTo(menu, MENU_POPUP, 'Select tab');" in info_body:
            errors.append('InfoStack menu still nests tab selection under the obsolete Select tab submenu')
        for obsolete in [
            'startupTransition:',
            'startupMinimumDelay:',
            'startupReadinessTimeout:',
            'appendInfoStackStartupMenu(',
        ]:
            if obsolete in info_body:
                errors.append('InfoStack menu-state snapshot still contains Startup configuration: ' + obsolete)
        for token in [
            "visibilityMenu.AppendTo(tabSettingsMenu, MENU_POPUP, 'Visible tabs');",
            "titlesMenu.AppendTo(tabSettingsMenu, MENU_POPUP, 'Tab titles');",
            "fontMenu.AppendTo(tabSettingsMenu, MENU_POPUP, 'Tab font size');",
            "tabColourMenu.AppendTo(tabSettingsMenu, MENU_POPUP, 'Tab font colour');",
            "areaMenu.AppendTo(tabSettingsMenu, MENU_POPUP, 'Tab area');",
            "backgroundMenu.AppendTo(appearanceMenu, MENU_POPUP, 'InfoStack backing colour');",
            "dividerMenu.AppendTo(appearanceMenu, MENU_POPUP, 'Side divider colour');",
            "tabSettingsMenu.AppendTo(menu, MENU_POPUP, 'Tab settings');",
            "appearanceMenu.AppendTo(menu, MENU_POPUP, 'Appearance');",
        ]:
            if token not in info_body:
                errors.append('InfoStack menu consolidation is missing: ' + token)
        for obsolete in [
            "visibilityMenu.AppendTo(menu, MENU_POPUP, 'Visible tabs');",
            "titlesMenu.AppendTo(menu, MENU_POPUP, 'Tab titles');",
            "fontMenu.AppendTo(menu, MENU_POPUP, 'Tab font size');",
            "tabColourMenu.AppendTo(menu, MENU_POPUP, 'Tab font colour');",
            "areaMenu.AppendTo(menu, MENU_POPUP, 'Tab area');",
            "backgroundMenu.AppendTo(menu, MENU_POPUP, 'InfoStack backing colour');",
            "dividerMenu.AppendTo(menu, MENU_POPUP, 'Side divider colour');",
            "startupMenu.AppendTo(menu, MENU_POPUP, 'Startup');",
        ]:
            if obsolete in info_body:
                errors.append('InfoStack menu still exposes a configuration item at top level: ' + obsolete)

    view_bridge = project / 'shared' / 'view_bridge.js'
    if view_bridge.exists():
        body = text(view_bridge)
        for token in [
            "var NOTIFICATION = 'DarkOneJSP3.View.Command';",
            "layoutToggle: 'layout-toggle'",
            "visualiserToggle: 'visualiser-toggle'",
            "infoStackMenu: 'infostack-menu'",
            "darkonejsp3/infostack/menu",
            "darkonejsp3.view-command.txt",
            "darkonejsp3.infostack-menu-state.json",
            "darkonejsp3.startup-menu-state.json",
            'function infoStackActionCommand(value)',
            'function infoStackActionFromCommand(value)',
            'function startupActionCommand(action, key, value)',
            'function parseStartupActionCommand(value)',
            'function writeInfoStackState(state)',
            'function readInfoStackState()',
            'function writeStartupState(state)',
            'function readStartupState()',
            'function writeCommand(command, anchorX)',
            'function parseNotificationData(data)',
        ]:
            if token not in body:
                errors.append('View-command bridge is missing: ' + token)
        for obsolete in [
            '(value >= 1000 && value <= 1002)',
            '(value >= 1010 && value <= 1013)',
        ]:
            if obsolete in body:
                errors.append('InfoStack selected-action bridge still accepts removed Startup ids: ' + obsolete)
    else:
        errors.append('View-command bridge file is missing')

    opt_button_command = project / 'jscript' / 'js' / 'Buttons_Function_OptBtnCmd.js'
    if opt_button_command.exists():
        body = text(opt_button_command)
        for token in [
            'function darkOneShowInfoStackLocalMenu(button)',
            'DarkOneViewBridge.readInfoStackState()',
            'selectedId = menu.TrackPopupMenu(x, y);',
            'DarkOneViewBridge.infoStackActionCommand(selectedId)',
            'if (internal === DarkOneViewBridge.commands.infoStackMenu)',
            'return darkOneShowInfoStackLocalMenu(button);',
        ]:
            if token not in body:
                errors.append('INFOSTACK optional-button local popup is missing: ' + token)
        if 'DarkOneViewBridge.writeCommand(internal, anchorX)' in body:
            errors.append('INFOSTACK optional button still routes the menu itself across the view bridge')
        for obsolete in [
            'startupTransitionMenu.AppendMenuItem(',
            "startupMenu.AppendTo(menu, 16, 'Startup')",
            'startupMinimumDelay',
            'startupReadinessTimeout',
        ]:
            if obsolete in body:
                errors.append('INFOSTACK optional-button popup still exposes Startup: ' + obsolete)
    else:
        errors.append('Optional-button command script is missing')

    colour_helper = project / 'shared' / 'colour_utils.js'
    if colour_helper.exists():
        body = text(colour_helper)
        forbidden_picker_guards = [
            r"typeof\s+utils\.ColourPicker\s*={2,3}\s*['\"]function['\"]",
            r"typeof\s+utils\.ColourPicker\s*!={1,2}\s*['\"]unknown['\"]",
        ]
        for pattern in forbidden_picker_guards:
            if re.search(pattern, body):
                errors.append('Shared colour helper uses an unreliable native ColourPicker type guard')
        if body.count("typeof utils.ColourPicker !== 'undefined'") < 2:
            errors.append('Shared colour helper does not support native ColourPicker methods reported as unknown')
        if 'utils.ColourPicker(current, true)' in body:
            errors.append('Shared colour helper uses an unsupported two-argument JScript Panel ColourPicker call')
        if 'nativeSigned: function (colour)' not in body:
            errors.append('Shared colour helper does not expose signed native-colour conversion')
        if 'normalisePickerChoice: function (value)' not in body:
            errors.append('Shared colour helper does not validate native picker results')
        if "if (!isFinite(number) || Math.floor(number) !== number) return null;" not in body:
            errors.append('Shared colour helper does not reject non-finite or fractional picker results')
        if 'number < -2147483648 || number > 4294967295' not in body:
            errors.append('Shared colour helper does not enforce signed/unsigned 32-bit picker bounds')
        if 'logPickerFailure: function (host, context, error)' not in body:
            errors.append('Shared colour helper does not provide contextual picker diagnostics')
        if 'var chosen = utils.ColourPicker(this.nativeSigned(current));' not in body:
            errors.append('Shared colour helper does not pass a signed 32-bit colour to JScript Panel ColourPicker')
        if 'var chosen = utils.ColourPicker(0, this.nativeSigned(current));' not in body:
            errors.append('Shared colour helper does not pass a signed 32-bit colour to JSplitter ColourPicker')

        for token in [
            'var DarkOneColour = Object.freeze({',
            'opaque: function (colour)',
            'nativeSigned: function (colour)',
            'normalisePickerChoice: function (value)',
            'logPickerFailure: function (host, context, error)',
            'toHex: function (colour)',
            'columnsUi: function (index, fallback)',
            'parseOpaque: function (value)',
            'normaliseMode: function (value, allowedModes, fallback)',
            'appendRadioOptions: function (menu, options, selectedMode, customColour, flags)',
            'pickJsplitter: function (current, title, prompt)',
            'pickJscript: function (current, title, prompt)',
        ]:
            if token not in body:
                errors.append('Shared colour helper is missing: ' + token)

    global_config = project / 'jscript' / 'js' / 'Config_Global_Script.js'
    if global_config.exists():
        body = text(global_config)
        if re.search(r'''typeof\s+utils\.ColourPicker\s*={2,3}\s*['"]function['"]''', body):
            errors.append('Bottom-area custom-colour fallback uses an unreliable native ColourPicker type guard')
        if "typeof utils.ColourPicker !== 'undefined'" not in body:
            errors.append('Bottom-area custom-colour fallback does not accept native ColourPicker methods reported as unknown')
        if 'utils.ColourPicker(current, true)' in body:
            errors.append('Bottom-area custom-colour fallback uses an unsupported two-argument JScript Panel picker call')
        if 'utils.ColourPicker(Number(current) | 0)' not in body:
            errors.append('Bottom-area custom-colour fallback does not pass a signed 32-bit colour to JScript Panel ColourPicker')
        if 'function darkOneNormaliseBottomPickerChoice(value)' not in body or \
                'number < -2147483648 || number > 4294967295' not in body:
            errors.append('Bottom-area legacy picker fallback lacks strict finite 32-bit result validation')
        if "typeof DarkOneColour.pickJscript !== 'undefined'" not in body:
            errors.append('Bottom-area picker does not prefer the canonical shared colour helper')
        for forbidden in [
            'DARKONE_BOTTOM_COLOUR_PICKER_DELAY',
            'darkOneBottomAreaPickerTimer',
            'darkOneQueueBottomAreaColourPicker',
            'darkOneCancelBottomAreaColourPicker',
            'bottomCustomHandled',
            'bottomCustomOption',
        ]:
            if forbidden in body:
                errors.append('Bottom-area custom-colour picker retains obsolete or duplicate dispatch code: ' + forbidden)
        for token in [
            "chosen = darkOnePickBottomAreaColour(",
            "state.backgroundCustomColour = chosen;",
            "state.dividerCustomColour = chosen;",
            "background.AppendMenuItem(MF_STRING, 9806, 'Set custom colour...');",
            "divider.AppendMenuItem(MF_STRING, 9826, 'Set custom colour...');",
            "var menu = window.CreatePopupMenu();\n    // Register ownership immediately",
            "disposableMenus.push(menu);\n    var weights = [",
            "bottomAreaHandled = darkOneHandleBottomAreaMenuSelection(idx);",
            "try {\n    var m = window.CreatePopupMenu(); menus.push(m);",
            "idx = m.TrackPopupMenu(x, y);",
            "} finally {\n        for (var i = menus.length - 1; i >= 0; i--)",
        ]:
            if token not in body:
                errors.append('Bottom-area menu hardening is missing: ' + token)
        tools_start = body.find('function darkOneToolsMenu(x, y)')
        tools_end = body.find('function darkOneSetFontWeightProperty', tools_start)
        tools_body = body[tools_start:tools_end if tools_end > tools_start else len(body)]
        if tools_body.count('darkOneHandleBottomAreaMenuSelection(idx)') != 1:
            errors.append('Bottom-area commands do not use exactly one menu dispatch path')
        if tools_body.count('.Dispose()') != 1:
            errors.append('DarkOne Tools menu cleanup is not centralised in one finally-protected loop')


    jsplitter_shared = project / 'jsplitter' / 'shared.js'
    if jsplitter_shared.exists() and \
            'DarkOneJSP3\\\\shared\\\\jsplitter_protocols.js' not in text(jsplitter_shared):
        errors.append('JSplitter shared loader does not import the protocol helper')

    protocol_helper = project / 'shared' / 'jsplitter_protocols.js'
    if protocol_helper.exists():
        body = text(protocol_helper)
        for token in [
            'var DarkOneProtocol = (function () {',
            "queryControls: 'DarkOneJSP3.Startup.Controls.Query'",
            "commandControls: 'DarkOneJSP3.Startup.Controls.Command'",
            "stateControls: 'DarkOneJSP3.Startup.Controls.State'",
            "ready: 'DarkOneJSP3.Startup.Ready'",
            "queryReady: 'DarkOneJSP3.Startup.QueryReady'",
            'serialiseState: serialiseStartupState',
            'parseState: parseStartupState',
            'serialiseCommand: serialiseStartupCommand',
            'parseCommand: parseStartupCommand',
            'createReadinessBridge: createReadinessBridge',
            "query: 'DarkOneJSP3.ArtSpectrum.Divider.Query'",
            "set: 'DarkOneJSP3.ArtSpectrum.Divider.Set'",
            "state: 'DarkOneJSP3.ArtSpectrum.Divider.State'",
            'serialiseState: serialiseDividerState',
            'parseState: parseDividerState',
            'menuOptions: dividerMenuOptions',
        ]:
            if token not in body:
                errors.append('Shared JSplitter protocol helper is missing: ' + token)

    for path in [
        project / 'jsplitter' / '02_main_columns.js',
        project / 'jsplitter' / '03_info_stack_tabs.js',
        project / 'jsplitter' / '06_display_waveform.js',
        samples / 'js' / 'panel.js',
        project / 'jscript' / 'js' / 'Panel_Display.js',
    ]:
        if not path.exists():
            continue
        body = text(path)
        for duplicate in ['function colourToHex(', 'function parseOpaqueColour(', 'function opaqueColour(']:
            if duplicate in body:
                errors.append(rel(path) + ' retains duplicate colour helper: ' + duplicate)

    for path in [
        project / 'jsplitter' / '01_root.js',
        project / 'jsplitter' / '02_main_columns.js',
        project / 'jsplitter' / '03_info_stack_tabs.js',
        project / 'jsplitter' / '04_art_spectrum.js',
        project / 'jsplitter' / '05_bottom_controls.js',
        project / 'jsplitter' / '06_display_waveform.js',
    ]:
        if not path.exists():
            continue
        body = text(path)
        for duplicate in [
            "var STARTUP_CONTROL_MESSAGE_VERSION = 'v1';",
            "var DIVIDER_MESSAGE_VERSION = 'v1';",
            'function parseStartupControlState(',
            'function parseDividerStateMessage(',
            'function serialiseDividerState(',
            'function signalStartupReady(',
        ]:
            if duplicate in body:
                errors.append(rel(path) + ' retains duplicate JSplitter protocol code: ' + duplicate)

    standalone_colour_entries = [
        samples / 'Last.fm Bio.txt',
        samples / 'Last.fm Artist Info + User Info.txt',
        samples / 'Album Notes.txt',
        samples / 'Properties.txt',
        project / 'jscript' / 'DarkOneJSP3 - Queue Viewer.txt',
    ]
    for path in standalone_colour_entries:
        if path.exists() and 'samples\\shared\\colour_utils.js' not in text(path):
            errors.append(rel(path) + ' does not import the standalone colour helper')
    display_entry = project / 'jscript' / 'DarkOneJSP3 - Display Panel.txt'
    if display_entry.exists() and 'DarkOneJSP3\\shared\\colour_utils.js' not in text(display_entry):
        errors.append(rel(display_entry) + ' does not import the project colour-helper mirror')

    optional_button_helper = project / 'jscript' / 'js' / 'Buttons_OptionalMenu.js'
    if optional_button_helper.exists():
        body = text(optional_button_helper)
        for token in [
            'var DARKONE_CONTROL_BUTTON_MENU = {',
            'function darkOneOptionalButtonEditId(buttonNames)',
            'function darkOneAppendOptionalButtonMenu(menu, buttonNames, buttonProperties)',
            'function darkOneConfigureOptionalButton(buttonIndex, buttonNames, buttonProperties)',
            'function darkOneHandleControlButtonMenuSelection(index, options)',
            'function darkOneShowControlButtonMenu(x, y, options)',
            "optionalFirstId: 101",
            "redetectId: 120",
            "guideId: 121",
        ]:
            if token not in body:
                errors.append('Shared optional-button menu helper is missing: ' + token)

    volume_knob = project / 'jscript' / 'js' / 'Object_Volumeknob.js'
    if volume_knob.exists():
        body = text(volume_knob)
        for token in [
            'getDelay: function() { return darkOneGetVolumeWriteInterval(); }',
            'DarkOnePerformance.createRepaintScheduler(window, {',
            'this.preview_volume = v;',
            'preview_repaint.request();',
            'Volume drag refresh rate',
            'DarkOneUiCadence.volumeModeForMenuId(q)',
            'volume_writer.reschedule();',
            'preview_repaint.reschedule();',
        ]:
            if token not in body:
                errors.append('Adaptive volume-knob cadence is missing: ' + token)

    control_right_panel = project / 'jscript' / 'js' / 'Panel_Control_Right.js'
    if control_right_panel.exists():
        body = text(control_right_panel)
        for token in [
            'DarkOneUiCadence.createVolumeOwner(window, {',
            'DARKONEJSP3.VOLUME.DRAG.REFRESH.MODE',
            'getDelay: darkOneGetVolumeDragInterval',
            'function darkOneGetVolumeWriteInterval()',
            'return Math.max(16, darkOneGetVolumeDragInterval());',
            'if (!v_drag) volume_knob_repaint.request();',
            'darkOneVolumeCadenceOwner.handleNotification(name, info)',
        ]:
            if token not in body:
                errors.append('Control Right volume-cadence ownership is missing: ' + token)

    display_system_path = project / 'jscript' / 'js' / 'Object_DisplaySystem.js'
    if display_system_path.exists():
        body = text(display_system_path)
        for token in [
            'DarkOneUiCadence.createVolumeFollower(window, {',
            'getDelay: function() { return darkOneDisplayVolumeCadence.getInterval(); }',
            'this.onVolumeCadenceChanged = function()',
        ]:
            if token not in body:
                errors.append('Display volume-cadence follower is missing: ' + token)
    display_panel_path = project / 'jscript' / 'js' / 'Panel_Display.js'
    if display_panel_path.exists():
        body = text(display_panel_path)
        for token in [
            'var menus = [];',
            'menus.push(a[i]);',
            '} finally {',
            'for (var j = menus.length - 1; j >= 0; j--)',
            'try { menus[j].Dispose(); } catch (e) {}',
        ]:
            if token not in body:
                errors.append('Display context-menu cleanup is missing: ' + token)

    control_entries = {
        project / 'jscript' / 'DarkOneJSP3 - Control Panel - Left.txt': '3.0.30-jsp3-3.8.5',
        project / 'jscript' / 'DarkOneJSP3 - Control Panel - Right.txt': '3.0.35-jsp3-3.8.5',
    }
    for path, expected_version in control_entries.items():
        if not path.exists():
            continue
        body = text(path)
        if 'DarkOneJSP3\\jscript\\js\\Buttons_OptionalMenu.js' not in body:
            errors.append(rel(path) + ' does not import the shared optional-button menu')
        if 'DarkOneJSP3\\shared\\colour_utils.js' not in body:
            errors.append(rel(path) + ' does not import the shared colour helper')
        if '@version "' + expected_version + '"' not in body:
            errors.append(rel(path) + ' has the wrong consolidated control-panel version')

    control_panels = [
        project / 'jscript' / 'js' / 'Panel_Control_Left.js',
        project / 'jscript' / 'js' / 'Panel_Control_Right.js',
    ]
    for path in control_panels:
        if not path.exists():
            continue
        body = text(path)
        if 'safeBitmapImage(imgPath + "buttons.png")' not in body or 'gr.DrawBitmap(g_btns,' not in body:
            errors.append(rel(path) + ' does not use a cached Direct2D button bitmap')
        if 'darkOneShowControlButtonMenu(x, y, {' not in body:
            errors.append(rel(path) + ' does not use the shared optional-button menu')
        for duplicate in [
            "Enter your main menu, context menu or trusted local JavaScript command here:",
            'Re-detect command types',
            'Command guide...',
            'Custom roundness...',
            'var round_values = [-1, 0, 20, 33, 60, 100];',
        ]:
            if duplicate in body:
                errors.append(rel(path) + ' retains duplicated optional-button menu logic: ' + duplicate)
    optional_commands = project / 'jscript' / 'js' / 'Buttons_Function_OptBtnCmd.js'
    if optional_commands.exists():
        body = text(optional_commands)
        for token in [
            "'darkonejsp3/tools/menu'",
            'function darkOneShowToolsLocalMenu(button)',
            'darkOneToolsMenu(x, y);',
        ]:
            if token not in body:
                errors.append('TOOLS optional-button command support is missing: ' + token)
    for path in [optional_button_helper, project / 'jscript' / 'js' / 'Panel_Display.js']:
        if path.exists() and 'DarkOne Tools...' in text(path):
            errors.append(rel(path) + ' still exposes DarkOne Tools from a right-click menu')
    left_control_panel = project / 'jscript' / 'js' / 'Panel_Control_Left.js'
    if left_control_panel.exists():
        body = text(left_control_panel)
        for token in [
            'appendExtraMenus: function (rootMenu)',
            'styleMenu.AppendTo(rootMenu, 0 | 16, "Button style")',
            'depthMenu.AppendTo(rootMenu, 0 | 16, "Button depth")',
            'handleExtraSelection: function (index)',
        ]:
            if token in body:
                errors.append('Control Left still exposes shared button appearance: ' + token)
    config_global = project / 'jscript' / 'js' / 'Config_Global_Script.js'
    if config_global.exists():
        body = text(config_global)
        for token in [
            'function darkOneAppendButtonsAppearanceMenu(parent, style, depth, roundness)',
            'function darkOneHandleButtonsAppearanceMenuSelection(id)',
            "buttons.AppendTo(m, MF_STRING, 'Buttons')",
            "style.AppendTo(parent, MF_STRING, 'Button style')",
            "depth.AppendTo(parent, MF_STRING, 'Button depth')",
            "roundness.AppendTo(parent, MF_STRING, 'Button roundness')",
            "darkOneSetSharedProperty('Buttons appearance preset', id - 9830)",
            "darkOneSetSharedProperty('Buttons depth preset', id - 9840)",
            "startup.AppendTo(m, MF_STRING, 'Startup')",
            "utilities.AppendTo(m, MF_STRING, 'Utilities')",
            "utilities.AppendMenuItem(MF_STRING, 9110, 'Open DarkOneJSP3 folder')",
            "utilities.AppendMenuItem(MF_STRING, 9122, 'Reload this panel')",
        ]:
            if token not in body:
                errors.append('DarkOne Tools shared Buttons appearance support is missing: ' + token)

    volume_knob = project / 'jscript' / 'js' / 'Object_Volumeknob.js'
    if volume_knob.exists():
        body = text(volume_knob)
        for token in [
            'getDelay: function() { return darkOneGetVolumeWriteInterval(); }',
            'DarkOnePerformance.createRepaintScheduler(window, {',
            'preview_repaint.request()',
            'this.preview_volume = v',
            'Volume drag refresh rate',
            'DarkOnePerformance.createValueCoalescer',
            'volume_writer.request(v)',
            'volume_writer.flush()',
            'volume_writer.cancel()',
            'v_drag ? this.active_colour : this.inactive_colour',
            'if (v_drag) {',
            'this.Repaint();',
        ]:
            if token not in body:
                errors.append('Volume knob drag coalescing is missing: ' + token)
        if 'if (fb.Volume != v) fb.Volume = v' in body:
            errors.append('Volume knob still writes every raw mouse-move value directly')
        if 'preview_repaint.stop()' in body:
            errors.append('Volume knob calls unsupported repaint-scheduler stop(); use cancel()')
        if 'v_change ? this.active_colour' in body:
            errors.append('Volume knob still uses the trailing volume-change state as its pressed highlight')
        for token in ['preview_repaint.cancel()', 'volume_writer.cancel()']:
            if token not in body:
                errors.append('Volume knob cleanup is missing: ' + token)

    right_control = project / 'jscript' / 'js' / 'Panel_Control_Right.js'
    if right_control.exists():
        body = text(right_control)
        for token in [
            'DarkOnePerformance.createRepaintScheduler',
            'if (!v_drag) volume_knob_repaint.request()',
        ]:
            if token not in body:
                errors.append('Control Right volume update coalescing is missing: ' + token)
        if 'v_timer = clearPanelTimer(v_timer)' in body:
            errors.append('Control Right still recreates its three-second volume timer for every callback')
        for forbidden in ['volume_change_deadline', 'v_change = true']:
            if forbidden in body:
                errors.append('Control Right still retains a delayed knob-selection state: ' + forbidden)

    display_system_source = project / 'jscript' / 'js' / 'Object_DisplaySystem.js'
    if display_system_source.exists():
        body = text(display_system_source)
        for token in [
            'DarkOnePerformance.createRepaintScheduler',
            'DarkOnePerformance.createTrailingDeadline',
            'this.drawVolumeMatrix = function(gr, volume)',
            'this.drawVolumeMatrix(gr, fb.Volume.toFixed(2) + " db")',
        ]:
            if token not in body:
                errors.append('Display volume rendering optimisation is missing: ' + token)
        for forbidden in ['new VolumeImage()', 'this.images[4]', 'function VolumeImage()']:
            if forbidden in body:
                errors.append('Display still rebuilds an off-screen volume bitmap while dragging: ' + forbidden)
        if 'valueColour = v_change ? ui_btntxtcol : this.Colours[8];' in body:
            errors.append('Display TIME label still inherits the temporary volume highlight')
        if not re.search(r'case\s+2:\s*valueColour\s*=\s*this\.Colours\[8\]\s*;', body):
            errors.append('Display TIME label is not bound solely to the playback-state colour')

        # Calls made through the shared configuration helper must exist on the
        # real DisplaySystem implementation. Runtime mocks must not invent APIs
        # that were removed by later rendering optimisations.
        config_global = project / 'jscript' / 'js' / 'Config_Global_Script.js'
        if config_global.exists():
            config_body = text(config_global)
            exported_methods = set(re.findall(r'this\.([A-Za-z_$][\w$]*)\s*=\s*function\s*\(', body))
            called_methods = set(re.findall(r'display_system\.([A-Za-z_$][\w$]*)\s*\(', config_body))
            missing_methods = sorted(called_methods - exported_methods)
            for method in missing_methods:
                errors.append('Config_Global_Script calls missing DisplaySystem method: ' + method)
            if 'resetRenderedImages' in config_body:
                errors.append('Config_Global_Script retains the removed composite-image cache API: resetRenderedImages')
