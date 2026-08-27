from __future__ import annotations

from .context import ValidationContext


def run(ctx: ValidationContext) -> None:
    project = ctx.project
    samples = ctx.samples
    errors = ctx.errors
    rel = ctx.rel
    text = ctx.text
    js_playlist_rows = samples / 'jsplaylist' / 'playlist.js'
    volume_knob = project / 'jscript' / 'js' / 'Object_Volumeknob.js'
    control_panels = [
        project / 'jscript' / 'js' / 'Panel_Control_Left.js',
        project / 'jscript' / 'js' / 'Panel_Control_Right.js',
    ]
    right_control = project / 'jscript' / 'js' / 'Panel_Control_Right.js'
    # v0.9.30 rendering and allocation hot-path invariants.
    if js_playlist_rows.exists():
        body = text(js_playlist_rows)
        for token in [
            'var is_item_selected = this.type == 0 && this.is_selected;',
            'this.refreshSelectionCache = function ()',
            'this.allowItemReuse = true;',
            'reusable[oldKey] = oldItem;',
            'item = reusable[key];',
            'paintState.columns = this.buildPaintColumns();',
            'var cacheKey = p.headerBar.columnsVersion',
            'if (this.paintColumnsKey == cacheKey) return this.paintColumns;',
            'this.group_width_font_key',
        ]:
            if token not in body:
                errors.append('JS Playlist hot-path cache/reuse optimisation is missing: ' + token)
        draw_start = body.find('this.draw = function (gr) {', body.find('function oList'))
        draw_end = body.find('\n\tthis.isHoverObject', draw_start)
        draw_body = body[draw_start:draw_end] if draw_start >= 0 and draw_end > draw_start else ''
        for forbidden in ['plman.IsPlaylistItemSelected(', 'plman.GetPlayingItemLocation(']:
            if forbidden in draw_body:
                errors.append('JS Playlist draw path retains a native per-frame call: ' + forbidden)
        item_check_start = body.find('this.check = function (event, x, y)', body.find('function oItem'))
        item_check_end = body.find('\nfunction oList', item_check_start)
        item_check_body = body[item_check_start:item_check_end] if item_check_start >= 0 and item_check_end > item_check_start else ''
        if 'plman.IsPlaylistItemSelected(' in item_check_body:
            errors.append('JS Playlist mouse path retains per-row native selection lookups')

    playlist_main = samples / 'jsplaylist' / 'main.js'
    if playlist_main.exists():
        body = text(playlist_main)
        for token in [
            'var g_playlist_paint_state = {',
            'function update_playlist_playback_state()',
            'g_playlist_paint_state.playingPlaylist =',
            'if (p.list) p.list.refreshSelectionCache();',
        ]:
            if token not in body:
                errors.append('JS Playlist playback/selection state cache is missing: ' + token)

    button_common = project / 'jscript' / 'js' / 'Buttons_CommonButtonOptions.js'
    text_button = project / 'jscript' / 'js' / 'Object_Textbutton.js'
    if button_common.exists():
        body = text(button_common)
        for token in [
            'btn_font_key',
            'if (font_key != btn_font_key || !btn_font)',
            'appPreset = typeof darkOneButtonStylePreset == "function"',
            '? darkOneButtonStylePreset()',
            'depthPreset = typeof darkOneButtonDepthPreset == "function"',
            '? darkOneButtonDepthPreset()',
        ]:
            if token not in body:
                errors.append('Control-button rebuild safeguard is missing: ' + token)
    if text_button.exists() and 'this.updateLayout = function(x, y, w, h, size_options)' not in text(text_button):
        errors.append('TextButton geometry reuse is missing')
    for path in control_panels:
        if path.exists():
            body = text(path)
            for token in ['function buttonsLayout()', 'if (Buttons.a_0) buttonsLayout();']:
                if token not in body:
                    errors.append(rel(path) + ' does not reuse existing button objects during resize: ' + token)
    if volume_knob.exists() and 'this.updateLayout = function(x, y, w, h)' not in text(volume_knob):
        errors.append('Volume knob geometry reuse is missing')
    if right_control.exists():
        body = text(right_control)
        for token in ['if (volknob) volknob.dispose();', 'volknob.updateLayout(']:
            if token not in body:
                errors.append('Control Right volume-knob lifecycle optimisation is missing: ' + token)

    queue_source = project / 'jscript' / 'js' / 'Queue_Viewer.js'
    if queue_source.exists():
        body = text(queue_source)
        for token in [
            'this.selected_lookup = {};',
            'this.rebuild_selection_lookup = function ()',
            'return !!this.selected_lookup[index];',
            'this.refresh_known_queue_sources = function ()',
            'this.playlist_snapshot_matches = function ()',
            'this.build_scan_playlist_order = function (playlist_count)',
            'this.publish_scan_data = function (state, force)',
            'var budgetMs = 5;',
            'var batchSize = 16;',
            '}, 1);',
            "this.source_id_tfo = fb.TitleFormat('%path%|%subsong%');",
            "this.queue_total_tfo = fb.TitleFormat('[%queue_total%]');",
            'this.request_bridge_refresh = function (force_log, delay, require_new, minimum_generation)',
            'this.apply_bridge_state = function (state, force_log)',
            'state.early_complete = true;',
        ]:
            if token not in body:
                errors.append('Queue Viewer scan/selection optimisation is missing: ' + token)
        if 'return this.selected_indices.indexOf(index) !== -1;' in body:
            errors.append('Queue Viewer retains linear per-row selection lookup')
        scan_start = body.find('this.scan_chunk = function (generation)')
        scan_end = body.find('this.finish_scan = function (generation)', scan_start)
        scan_body = body[scan_start:scan_end] if scan_start >= 0 and scan_end > scan_start else ''
        if 'GetPlaylistItems(' in scan_body:
            errors.append('Queue Viewer full scan still allocates playlist handle lists')
        if 'release_scan_items' in body:
            errors.append('Queue Viewer retains obsolete scan handle-list disposal code')
        if 'this.playback_queue_changed = function (origin)' not in body:
            errors.append('Queue Viewer discards playback queue change origins')

    queue_bridge = project / 'shared' / 'queue_bridge.js'
    root_controller = project / 'jsplitter' / '01_root.js'
    if queue_bridge.exists():
        body = text(queue_bridge)
        for token in ["var VERSION = 'v2';", "var FILE_NAME = 'darkonejsp3.queue-state.json';",
                      "var COMMAND_FILE_NAME = 'darkonejsp3.queue-command.json';",
                      "var RESULT_FILE_NAME = 'darkonejsp3.queue-command-result.json';",
                      'function serialise(value)', 'function parse(value)',
                      'function serialiseCommand(value)', 'function parseCommand(value)',
                      'function serialiseResult(value)', 'function parseResult(value)', 'function token(value)']:
            if token not in body:
                errors.append('Direct queue bridge protocol is incomplete: ' + token)
    if root_controller.exists():
        body = text(root_controller)
        for token in ['plman.GetPlaybackQueueContents()', 'function on_playback_queue_changed(origin)',
                      'writeQueueBridgeState()', 'initialiseQueueBridge();',
                      'initialiseQueueCommandBridge();', 'plman.RemoveItemFromPlaybackQueue(',
                      'plman.RemoveItemsFromPlaybackQueue(', 'plman.FlushPlaybackQueue()',
                      'function queueBridgeSnapshotItem(item)', 'RestorePlaylistSource:',
                      'function queueBridgeSnapshotRows(contents)',
                      'function queueBridgePlaylistItemCount(playlistIndex)',
                      'return plman.PlaylistItemCount(playlistIndex);',
                      'plman.AddPlaylistItemToPlaybackQueue(', 'plman.AddItemToPlaybackQueue(',
                      'QUEUE_BRIDGE_COMMAND_FILE', 'QUEUE_BRIDGE_RESULT_FILE',
                      'utils.WriteTextFile(', 'QUEUE_BRIDGE_STATE_FILE',
                      'function acknowledgeQueueBridgeCommandFile()',
                      'utils.RemovePath(QUEUE_BRIDGE_COMMAND_FILE)',
                      'QUEUE_BRIDGE_STATE_RETRY_LIMIT', 'queueBridgePublishedGeneration',
                      'var QUEUE_BRIDGE_COMMAND_POLL_MS = 50;',
                      "case 'skipTo':", 'fb.Next();',
                      'Skip to track requires exactly one playback queue entry.',
                      'The original queue was restored.',
                      'writeQueueBridgeState();']:
            if token not in body:
                errors.append('JSplitter root direct queue bridge is incomplete: ' + token)
        guard_start = body.find('function queueBridgeCanRestorePlaylistSource(item)')
        guard_end = body.find('function queueBridgeRestoreQueue(rows)', guard_start)
        guard_body = body[guard_start:guard_end] if guard_start >= 0 and guard_end > guard_start else ''
        if 'plman.GetPlaylistItemCount(' in guard_body:
            errors.append('JSplitter queue restore guard uses the JSP3 GetPlaylistItemCount API instead of the JSplitter/SMP PlaylistItemCount API')

    shared_jsplitter = project / 'jsplitter' / 'shared.js'
    if shared_jsplitter.exists():
        body = text(shared_jsplitter)
        for token in [
            'var darkOneGradientRunCacheKey',
            'function darkOneVerticalGradientRuns(height, topColour, bottomColour)',
            'if (key === darkOneGradientRunCacheKey) return darkOneGradientRunCache;',
        ]:
            if token not in body:
                errors.append('JSplitter gradient hot-path cache is missing: ' + token)
        for obsolete in ['quickSearchFill:', 'quickSearchBorder:']:
            if obsolete in body:
                errors.append('JSplitter shared colours retain obsolete parent-owned Quick Search frame state: ' + obsolete)

    global_config = project / 'jscript' / 'js' / 'Config_Global_Script.js'
    if global_config.exists():
        body = text(global_config)
        for token in [
            'var darkOneBottomAreaGradientBrushKey',
            'function darkOneBottomAreaBrush()',
            'if (key === darkOneBottomAreaGradientBrushKey && darkOneBottomAreaGradientBrush)',
        ]:
            if token not in body:
                errors.append('JScript bottom-gradient brush cache is missing: ' + token)

    quick_search_wrapper = project / 'jscript' / 'DarkOneJSP3 - Quick Search.txt'
    quick_search_source = project / 'jscript' / 'js' / 'Quick_Search.js'
    if quick_search_wrapper.exists():
        body = text(quick_search_wrapper)
        for token in [
            '// @version "0.1.20"',
            'DarkOneJSP3\\jscript\\js\\Quick_Search.js',
            'samples\\jsplaylist\\inputbox.js',
            'quickSearch.resetConfiguration(scope);',
        ]:
            if token not in body:
                errors.append('Quick Search wrapper is incomplete: ' + token)
        if '-test' in body:
            errors.append('Quick Search wrapper still carries a test-build version marker')
    if quick_search_source.exists():
        body = text(quick_search_source)
        for token in [
            "var DARKONE_QUICKSEARCH_CUSTOM_ICON = DARKONE_QUICKSEARCH_IMAGE_FOLDER + 'quicksearch.png';",
            "'Custom PNG (unavailable)'",
            'this.input.quickSearchTextBand = function ()',
            'this.standardPlaylistLockOwnedByQuickSearch = function (index)',
            'this.releaseOwnedStandardLockForTarget = function (targetName)',
            'this.outputPlaylistName = function (resultMode, text)',
            'resultMode === QS_RESULT_STANDARD || handles.Count',
            'plman.GetGUID(index)',
            'plman.FindByGUID(this.properties.standardLockGuid)',
            "standardLockTarget: String(window.GetProperty('DARKONEJSP3.QUICKSEARCH.RESULT.STANDARD.LOCK.TARGET'",
            "standardLockGuid: String(window.GetProperty('DARKONEJSP3.QUICKSEARCH.RESULT.STANDARD.LOCK.GUID'",
            'var QS_LOCK_RECOMMENDED = QS_LOCK_ADD | QS_LOCK_REMOVE | QS_LOCK_REORDER | QS_LOCK_REPLACE | QS_LOCK_RENAME;',
            "scope !== 'appearance' && scope !== 'behaviour' && scope !== 'all'",
            'Tag definitions, history and favourites are user data',
            'var QS_BACKGROUND_PROTOCOL = DarkOneProtocol.bottomArea;',
            'this.parentBackgroundChanged = function (data)',
            'this.resolveSharedBackground = function (mode, customColour, columnsUiBackground, inheritedBackground, allowErrorDefault)',
            'QS_ERROR_BACKGROUND_DEFAULT',
            "borderMode: Math.round(quickSearchClamp(window.GetProperty('DARKONEJSP3.QUICKSEARCH.COLOUR.BORDER.MODE'",
            "borderCustom: DarkOneColour.opaque(window.GetProperty('DARKONEJSP3.QUICKSEARCH.COLOUR.BORDER.CUSTOM'",
            "this.appendColourChoiceMenu(colourMenu, 870, 'Border'",
            'this.frameColours = function ()',
            'this.fillFrameRing = function (gr, inset, thickness, colour)',
            'this.paintFrame = function (gr)',
            "frameMenu.AppendMenuItem(MF_STRING, 851, 'Enabled')",
            "frameMenu.AppendTo(visualMenu, MF_STRING, 'Frame')",
        ]:
            if token not in body:
                errors.append('Scripted Quick Search hardening is missing: ' + token)
        if 'utils.RemovePath(DARKONE_QUICKSEARCH_CONTEXT_FILE)' not in body:
            errors.append('Scripted Quick Search does not remove its Search-for-same bridge file on unload')
        for forbidden in ['RunCmdAsync', 'powershell', 'Set custom PNG path', 'Reset New Playlist mode after execution',
                          'fb.GetQueryItems', 'gr.DrawRectangle(0, 0, this.w - 1']:
            if forbidden.lower() in body.lower():
                errors.append('Scripted Quick Search retains obsolete prototype code: ' + forbidden)

    optional_button_source = project / 'jscript' / 'js' / 'Buttons_Function_OptBtnCmd.js'
    if optional_button_source.exists():
        body = text(optional_button_source)
        for token in [
                'var DARKONE_INFOSTACK_TAB_COLOUR_OPTIONS = [',
                'var DARKONE_INFOSTACK_BACKGROUND_OPTIONS = [',
                'var DARKONE_INFOSTACK_DIVIDER_OPTIONS = [']:
            if token not in body:
                errors.append('INFOSTACK local-menu static option descriptor is missing: ' + token)
        local_menu_start = body.find('function darkOneShowInfoStackLocalMenu(button)')
        local_menu_end = body.find('\nfunction ', local_menu_start + 20)
        local_menu_body = body[local_menu_start:local_menu_end] if local_menu_start >= 0 and local_menu_end > local_menu_start else ''
        for forbidden in ['var tabColourOptions = [', 'var backgroundOptions = [', 'var dividerOptions = [']:
            if forbidden in local_menu_body:
                errors.append('INFOSTACK local menu rebuilds static option descriptors per popup: ' + forbidden)

    manager_source = samples / 'smooth' / 'jsspm.js'
    if manager_source.exists():
        body = text(manager_source)
        draw_start = body.find('this.draw = function (gr)')
        draw_end = body.find('\n\tthis.', draw_start + 20)
        draw_body = body[draw_start:draw_end] if draw_start >= 0 and draw_end > draw_start else ''
        if 'plman.PlaylistCount' in draw_body:
            errors.append('Smooth Playlist Manager draw path still reads PlaylistCount')
        if 'var total = this.playlistCountSnapshot;' not in body:
            errors.append('Smooth Playlist Manager does not use its callback-maintained playlist count')

    info_stack = project / 'jsplitter' / '03_info_stack_tabs.js'
    if info_stack.exists():
        body = text(info_stack)
        for token in [
            'var infoStackRenderModel = {',
            'function rebuildInfoStackRenderModel()',
            'var visible = infoStackRenderModel.visible;',
            'var rects = infoStackRenderModel.rects;',
            'var infoStackFontKey =',
            'if (!force && key === infoStackFontKey) return false;',
            'var infoStackMenuStateKey = null;',
            'if (key === infoStackMenuStateKey) return false;',
            'infoStackMenuStateKey = key;',
            'legacy infostack-menu transport is deliberately ignored here',
        ]:
            if token not in body:
                errors.append('InfoStack render-model/font cache is missing: ' + token)
        paint_start = body.find('function on_paint(gr)')
        paint_end = body.find('\nfunction ', paint_start + 10)
        paint_body = body[paint_start:paint_end] if paint_start >= 0 and paint_end > paint_start else ''
        for forbidden in ['visibleIndexes()', 'tabLabel(', 'backgroundColour()', 'tabAccentColour()']:
            if forbidden in paint_body:
                errors.append('InfoStack paint path retains uncached property/layout work: ' + forbidden)

        notify_start = body.find('function on_notify_data(name, data)')
        notify_body = body[notify_start:] if notify_start >= 0 else ''
        if 'showInfoStackMenu(' in notify_body:
            errors.append('InfoStack notification path can still open a cross-panel popup menu')

    albumart_source = samples / 'js' / 'albumart.js'
    if albumart_source.exists():
        body = text(albumart_source)
        for token in [
            'this.ensure_blur = function ()',
            'if (this.is_review_panel)\n\t\t\tthis.ensure_blur();',
            'this.cancel_blur_generation = function ()',
            'this.blur_source = img;',
            'source.StackBlur(120);',
            'this.cancel_blur_generation();',
        ]:
            if token not in body:
                errors.append('Album Art lazy-blur lifecycle is missing: ' + token)
        metadb_start = body.find('this.metadb_changed = function ()')
        metadb_end = body.find('\n\tthis.move = function', metadb_start)
        metadb_body = body[metadb_start:metadb_end] if metadb_start >= 0 and metadb_end > metadb_start else ''
        if 'img.StackBlur(' in metadb_body:
            errors.append('Album Art still performs blur generation synchronously during metadata changes')
    text_display = samples / 'js' / 'text_display.js'
    if text_display.exists() and 'albumart.ensure_blur();' not in text(text_display):
        errors.append('Text Display does not request Album Art blur lazily')
