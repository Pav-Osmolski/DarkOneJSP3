from __future__ import annotations

from pathlib import Path
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

from .context import ValidationContext

def _extract_js_function(source: str, name: str) -> str:
    marker = 'function ' + name + '('
    start = source.find(marker)
    if start < 0:
        raise ValueError('missing JavaScript function: ' + name)
    brace = source.find('{', start)
    if brace < 0:
        raise ValueError('missing JavaScript function body: ' + name)

    depth = 0
    quote = ''
    escaped = False
    line_comment = False
    block_comment = False
    index = brace
    while index < len(source):
        char = source[index]
        next_char = source[index + 1] if index + 1 < len(source) else ''
        if line_comment:
            if char == '\n':
                line_comment = False
        elif block_comment:
            if char == '*' and next_char == '/':
                block_comment = False
                index += 1
        elif quote:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == quote:
                quote = ''
        else:
            if char == '/' and next_char == '/':
                line_comment = True
                index += 1
            elif char == '/' and next_char == '*':
                block_comment = True
                index += 1
            elif char in {'"', "'"}:
                quote = char
            elif char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    return source[start:index + 1]
        index += 1
    raise ValueError('unterminated JavaScript function: ' + name)


def run(ctx: ValidationContext) -> None:
    root = ctx.root
    project = ctx.project
    samples = ctx.samples
    errors = ctx.errors
    rel = ctx.rel
    text = ctx.text
    registry_path = project / 'shared' / 'reset_defaults.js'
    info_stack = project / 'jsplitter' / '03_info_stack_tabs.js'

    # Resolve local JScript Panel preprocessor imports.
    import_re = re.compile(r'^//\s*@import\s+"([^"]+)"', re.M)
    entry_scripts = sorted(samples.glob('*.txt')) + sorted((project / 'jscript').glob('*.txt'))
    entry_scripts += sorted((project / 'jsplitter' / 'loaders').glob('*.txt'))
    for entry in entry_scripts:
        for value in import_re.findall(text(entry)):
            target: Path | None = None
            if value.startswith('%fb2k_component_path%helpers.txt'):
                target = root / 'user-components-x64' / 'foo_jscript_panel3' / 'helpers.txt'
            elif value.startswith('%fb2k_component_path%samples\\'):
                target = samples / value.split('%fb2k_component_path%samples\\', 1)[1].replace('\\', '/')
            elif value.startswith('%fb2k_profile_path%DarkOneJSP3\\'):
                target = project / value.split('%fb2k_profile_path%DarkOneJSP3\\', 1)[1].replace('\\', '/')
            elif value in {'lodash'}:
                continue
            if target is not None and not target.exists():
                errors.append(rel(entry) + ' imports missing file ' + rel(target))

    # Compatibility mirrors.
    sync_tool = project / 'tools' / 'sync_mirrors.py'
    if sync_tool.exists():
        result = subprocess.run([sys.executable, str(sync_tool), '--check', str(root)],
                                capture_output=True, text=True)
        if result.returncode:
            errors.append('Compatibility mirror check failed: ' +
                          (result.stdout + result.stderr).strip())

    # Real syntax and compilation checks.
    node = shutil.which('node')
    if not node:
        errors.append('Node.js is required for JavaScript syntax validation')
    else:
        for path in sorted(root.rglob('*.js')):
            result = subprocess.run([node, '--check', str(path)], capture_output=True, text=True)
            if result.returncode:
                errors.append('JavaScript syntax failed for ' + rel(path) + ': ' +
                              result.stderr.strip())
        with tempfile.TemporaryDirectory() as temp:
            temp_dir = Path(temp)
            for index, path in enumerate(entry_scripts):
                target = temp_dir / f'entry_{index}.js'
                target.write_text(text(path), encoding='utf-8')
                result = subprocess.run([node, '--check', str(target)],
                                        capture_output=True, text=True)
                if result.returncode:
                    errors.append('Entry-script syntax failed for ' + rel(path) + ': ' +
                                  result.stderr.strip())

        # Exercise demand-driven scheduling, hidden-panel recovery and bitmap lifecycle.
        performance_helper_smoke = f"""
    const fs = require('fs');
    const source = fs.readFileSync({json.dumps(str(project / 'shared' / 'performance_utils.js'))}, 'utf8');
    let visible = true;
    let sequence = 0;
    let tasks = [];
    const host = {{
        get IsVisible() {{ return visible; }},
        SetTimeout(fn, delay) {{ const id = ++sequence; tasks.push({{id, fn, delay}}); return id; }},
        ClearTimeout(id) {{ tasks = tasks.filter(task => task.id !== id); }}
    }};
    let fallbackDisposed = 0;
    const directBitmap = {{Width: 2, Height: 2}};
    const fallbackBitmap = {{Width: 3, Height: 3}};
    const utilsMock = {{
        LoadBitmap(path) {{ return path === 'direct' ? directBitmap : null; }},
        LoadImage(path) {{
            return {{CreateBitmap() {{ return fallbackBitmap; }}, Dispose() {{ fallbackDisposed++; }}}};
        }}
    }};
    const api = new Function('utils', source + '\\nreturn DarkOnePerformance;')(utilsMock);
    function assert(condition, message) {{ if (!condition) throw new Error(message); }}
    function runNext() {{ if (!tasks.length) throw new Error('No scheduled task'); const task = tasks.shift(); task.fn(); return task; }}

    let repaints = 0;
    const scheduler = api.createRepaintScheduler(host, {{delay: 8, hiddenDelay: 250, repaint() {{ repaints++; }}}});
    scheduler.request();
    scheduler.request();
    assert(tasks.length === 1, 'Repaint requests were not coalesced');
    runNext();
    assert(repaints === 1 && tasks.length === 0 && !scheduler.isPending(), 'Visible repaint did not become idle');
    visible = false;
    scheduler.request();
    runNext();
    assert(repaints === 1 && tasks.length === 1 && tasks[0].delay === 250, 'Hidden repaint retry failed');
    visible = true;
    runNext();
    assert(repaints === 2 && tasks.length === 0, 'Hidden repaint was not flushed when visible');

    let frames = 0;
    const loop = api.createFrameLoop(host, {{delay: 8, tick() {{ frames++; return frames < 3; }}}});
    loop.request();
    runNext(); runNext(); runNext();
    assert(frames === 3 && tasks.length === 0 && !loop.isRunning(), 'Frame loop did not stop when idle');

    let dynamicDelay = 8;
    let dynamicFrames = 0;
    const dynamicLoop = api.createFrameLoop(host, {{
        getDelay() {{ return dynamicDelay; }},
        tick() {{ dynamicFrames++; return dynamicFrames < 2; }}
    }});
    dynamicLoop.request();
    assert(tasks.length === 1 && tasks[0].delay === 8, 'Dynamic frame loop did not use the initial delay');
    dynamicDelay = 16;
    dynamicLoop.reschedule();
    assert(tasks.length === 1 && tasks[0].delay === 16, 'Active frame loop did not reschedule to the changed delay');
    runNext();
    assert(tasks.length === 1 && tasks[0].delay === 16, 'Changed frame-loop delay was not retained');
    runNext();
    assert(dynamicFrames === 2 && tasks.length === 0 && !dynamicLoop.isRunning(), 'Dynamic frame loop did not become idle');

    let disposed = 0;
    const bitmapObject = {{Width: 1, Height: 1, Dispose: function() {{}}}};
    const image = {{CreateBitmap: function() {{ return bitmapObject; }}, Dispose: function() {{ disposed++; }}}};
    const bitmap = api.toBitmap(image, true);
    assert(bitmap && disposed === 1, 'Image-to-bitmap conversion did not dispose its source');
    const existingBitmap = {{Width: 4, Height: 4}};
    assert(api.toBitmap(existingBitmap, false) === existingBitmap,
        'Existing bitmap fallback was not retained when CreateBitmap was unavailable');
    let directDisposeCount = 0;
    api.dispose({{Dispose() {{ directDisposeCount++; }}}});
    assert(directDisposeCount === 1, 'Native resource disposal was not attempted directly');
    assert(api.loadBitmap('direct') === directBitmap, 'Direct bitmap loading was not preferred');
    assert(api.loadBitmap('fallback') === fallbackBitmap && fallbackDisposed === 1,
        'Image fallback did not create a bitmap and dispose its source');
    assert(api.createProfiler({{}}, false, 'disabled', 10) === null, 'Disabled profiler created runtime overhead');
    let profilerCreated = 0;
    const profilerApi = api.createProfiler({{CreateProfiler() {{ profilerCreated++; return {{Reset() {{}}, Time: 0}}; }}}}, true, 'enabled', 10);
    assert(profilerApi && profilerCreated === 1, 'Native profiler creation was not attempted directly');
    """
        result = subprocess.run([node, '-e', performance_helper_smoke], capture_output=True, text=True)
        if result.returncode:
            errors.append('Performance-helper runtime smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Exercise the exact live refresh-rate setters and active timer restart paths.
        try:
            playlist_main_source = text(samples / 'jsplaylist' / 'main.js')
            manager_source = text(samples / 'smooth' / 'jsspm.js')
            playlist_rate_functions = '\n\n'.join(
                _extract_js_function(playlist_main_source, name)
                for name in [
                    'full_repaint',
                    'repaint_scroll_frame',
                    'stop_playlist_scroll_frame_if_idle',
                    'stop_smooth_scroll',
                    'get_free_scroll_max_px',
                    'stop_free_wheel_scroll',
                    'reset_free_wheel_scroll',
                    'apply_free_wheel_position',
                    'repaint_playlist_scrollbar_drag_frame',
                    'ensure_playlist_scrollbar_drag_frame',
                    'begin_playlist_scrollbar_drag',
                    'update_playlist_scrollbar_drag',
                    'playlist_scrollbar_drag_frame_tick',
                    'finish_playlist_scrollbar_drag',
                    'cancel_playlist_scrollbar_drag',
                    'start_smooth_scroll_timer',
                    'start_free_wheel_scroll_timer',
                    'playlist_scroll_frame_tick',
                    'ensure_playlist_scroll_frame',
                    'reschedule_active_playlist_scroll_timers',
                    'set_playlist_refresh_interval',
                ]
            )
            manager_rate_function = _extract_js_function(
                manager_source, 'set_playlist_manager_refresh_rate')
        except ValueError as exc:
            errors.append('Smooth-scroll refresh-rate runtime setup failed: ' + str(exc))
        else:
            smooth_scroll_rate_smoke = f"""
    function assert(condition, message) {{ if (!condition) throw new Error(message); }}
    let savedProperties = [];
    let repaintRestarts = 0;
    let repaintRequestArgs = [];
    let frameCreates = 0;
    let frameReschedules = 0;
    let frameRequests = 0;
    let frameStops = 0;
    let repaints = 0;
    let smoothTicks = 0;
    let freeTicks = 0;
    let listRebuilds = 0;
    let createdFrames = [];
    var need_repaint = false;
    var g_repaint_scheduler = {{request(delay) {{ repaintRequestArgs.push(delay); }}}};
    function newFrame(options) {{
        let running = false;
        const frame = {{
            options: options || null,
            request() {{ running = true; frameRequests++; }},
            reschedule() {{ frameReschedules++; }},
            stop() {{ running = false; frameStops++; }},
            isRunning() {{ return running; }}
        }};
        return frame;
    }}
    var DarkOnePerformance = {{createFrameLoop(host, options) {{
        frameCreates++;
        const frame = newFrame(options);
        createdFrames.push(frame);
        return frame;
    }}}};
    var window = {{
        IsVisible: true,
        Repaint() {{ repaints++; }},
        SetProperty(name, value) {{ savedProperties.push([name, value]); }}
    }};
    var properties = {{smoothscrolling: true}};
    var cRow = {{playlist_h: 20}};
    var cList = {{
        repaint_interval: 8,
        scroll_timer: true,
        free_scroll_timer: false,
        scroll_delta: 20,
        free_scroll_position: 0,
        free_scroll_target: 0,
        free_scroll_offset: 0,
        free_scroll_active: false,
        scrollbar_drag_active: false,
        scrollbar_drag_snap: true,
        scrollbar_drag_position: 0,
        scrollbar_drag_target: 0,
        scrollbar_drag_last_tick: 0
    }};
    var cScrollBar = {{timerID: false}};
    var p = {{
        list: {{
            offset: 0,
            totalRows: 200,
            totalRowVisible: 10,
            setItems() {{ listRebuilds++; }}
        }},
        scrollbar: {{setCursor() {{}}}}
    }};
    var g_playlist_scroll_frame = newFrame();
    var g_playlist_scrollbar_drag_frame = null;
    var g_playlist_scroll_frame_in_tick = false;
    function smooth_scroll_tick() {{ smoothTicks++; need_repaint = true; cList.scroll_timer = false; }}
    function free_wheel_scroll_tick() {{ freeTicks++; need_repaint = true; cList.free_scroll_timer = false; }}
    function start_repaint_timer() {{ repaintRestarts++; }}
    {playlist_rate_functions}
    assert(set_playlist_refresh_interval(16) === true, 'JS Playlist rate setter did not report a change');
    assert(cList.repaint_interval === 16, 'JS Playlist live rate was not updated');
    assert(savedProperties.length === 1 && savedProperties[0][0] === 'JSPLAYLIST.UI Refresh Interval (ms)' && savedProperties[0][1] === 16,
        'JS Playlist rate was not persisted');
    assert(frameReschedules === 1, 'JS Playlist active frame loop was not rescheduled');
    assert(repaintRestarts === 1, 'JS Playlist repaint scheduler was not rescheduled');
    assert(set_playlist_refresh_interval(16) === false, 'JS Playlist unchanged rate was not ignored');

    full_repaint();
    assert(need_repaint === true, 'JS Playlist full_repaint did not mark a pending paint');
    assert(repaintRequestArgs.length === 1 && repaintRequestArgs[0] === undefined,
        'JS Playlist full_repaint bypassed the configured repaint interval');

    need_repaint = false;
    g_playlist_scroll_frame_in_tick = false;
    repaint_scroll_frame();
    assert(need_repaint === true && repaintRequestArgs.length === 2,
        'JS Playlist outside-frame repaint was not coalesced through the interval-aware scheduler');

    need_repaint = false;
    cList.scroll_timer = true;
    cList.free_scroll_timer = false;
    assert(playlist_scroll_frame_tick() === false, 'JS Playlist completed row frame stayed active');
    assert(smoothTicks === 1 && freeTicks === 0 && repaints === 1,
        'JS Playlist row animation frame did not update and repaint directly');
    assert(repaintRequestArgs.length === 2,
        'JS Playlist animation frame incorrectly scheduled a second repaint timer');

    cList.scroll_timer = false;
    cList.free_scroll_timer = true;
    assert(playlist_scroll_frame_tick() === false, 'JS Playlist completed free-scroll frame stayed active');
    assert(freeTicks === 1 && repaints === 2,
        'JS Playlist free-scroll frame did not update and repaint directly');

    // Simulate mouse-position updates arriving every 16 ms. At an 8 ms
    // refresh rate the drag loop must render an intermediate frame; at 16 ms
    // it renders one frame over the same elapsed time. Both paths should reach
    // the same time-based position after 16 ms.
    let fakeNow = 0;
    Date.now = function () {{ return fakeNow; }};
    properties.smoothscrolling = true;
    cList.scroll_timer = false;
    cList.free_scroll_timer = false;
    cList.repaint_interval = 8;
    p.list.offset = 0;
    cList.free_scroll_position = 0;
    cList.free_scroll_active = false;
    begin_playlist_scrollbar_drag(true);
    update_playlist_scrollbar_drag(200, true);
    assert(g_playlist_scrollbar_drag_frame && g_playlist_scrollbar_drag_frame.isRunning(),
        'JS Playlist scrollbar drag did not start its demand-driven frame loop');
    const repaintBefore8 = repaints;
    fakeNow = 8;
    assert(playlist_scrollbar_drag_frame_tick() === true,
        'JS Playlist 8 ms scrollbar drag stopped before reaching its target');
    const positionAfter8 = cList.scrollbar_drag_position;
    fakeNow = 16;
    assert(playlist_scrollbar_drag_frame_tick() === true,
        'JS Playlist 8 ms scrollbar drag stopped on its second intermediate frame');
    const positionAfter16At8 = cList.scrollbar_drag_position;
    assert(repaints === repaintBefore8 + 2 && positionAfter8 > 0 && positionAfter8 < positionAfter16At8,
        'JS Playlist 8 ms scrollbar drag did not render two distinct intermediate positions');
    cancel_playlist_scrollbar_drag();

    cList.repaint_interval = 16;
    p.list.offset = 0;
    cList.free_scroll_position = 0;
    cList.free_scroll_offset = 0;
    cList.free_scroll_active = false;
    fakeNow = 0;
    begin_playlist_scrollbar_drag(true);
    update_playlist_scrollbar_drag(200, true);
    const repaintBefore16 = repaints;
    fakeNow = 16;
    assert(playlist_scrollbar_drag_frame_tick() === true,
        'JS Playlist 16 ms scrollbar drag stopped before reaching its target');
    const positionAfter16At16 = cList.scrollbar_drag_position;
    assert(repaints === repaintBefore16 + 1,
        'JS Playlist 16 ms scrollbar drag rendered more than one frame over 16 ms');
    assert(Math.abs(positionAfter16At8 - positionAfter16At16) < 0.01,
        'JS Playlist scrollbar drag response speed changed with refresh rate');

    finish_playlist_scrollbar_drag(200, true);
    assert(cList.scrollbar_drag_active === false && p.list.offset === 10 &&
        cList.free_scroll_offset === 0 && cList.free_scroll_active === false,
        'JS Playlist snapped scrollbar drag did not flush the exact final row');

    properties.smoothscrolling = false;
    p.list.offset = 0;
    cList.free_scroll_position = 0;
    cList.free_scroll_offset = 0;
    cList.free_scroll_active = false;
    begin_playlist_scrollbar_drag(false);
    const directRepaintBase = repaints;
    update_playlist_scrollbar_drag(205, false);
    assert(cList.scrollbar_drag_position === 205 && p.list.offset === 10 &&
        cList.free_scroll_offset === 5 && repaints === directRepaintBase + 1,
        'JS Playlist non-smooth scrollbar drag did not apply directly');
    finish_playlist_scrollbar_drag(205, false);
    assert(cList.free_scroll_active === true && cList.free_scroll_offset === 5,
        'JS Playlist unsnapped scrollbar drag did not preserve its final pixel offset');
    cancel_playlist_scrollbar_drag();

    g_playlist_scroll_frame = null;
    cList.scroll_timer = false;
    cList.free_scroll_timer = false;
    const frameCreatesBeforeRow = frameCreates;
    const frameRequestsBeforeRow = frameRequests;
    start_smooth_scroll_timer();
    assert(cList.scroll_timer === true && frameCreates === frameCreatesBeforeRow + 1 &&
        frameRequests === frameRequestsBeforeRow + 1,
        'JS Playlist row scrolling did not start the shared demand-driven frame loop');
    stop_smooth_scroll();
    assert(cList.scroll_timer === false, 'JS Playlist row scrolling did not stop cleanly');

    function clamp(value, minimum, maximum) {{ return Math.max(minimum, Math.min(maximum, value)); }}
    var ppt = {{refreshRate: 8}};
    var scroll = 100;
    var scroll_ = 0;
    var need_repaint = false;
    cScrollBar = {{timerID: false, repaint_timeout: false}};
    var timers = {{movePlaylist: false}};
    let managerReschedules = 0;
    let managerRequests = 0;
    var g_playlist_manager_frame = {{
        reschedule() {{ managerReschedules++; }},
        request() {{ managerRequests++; }}
    }};
    savedProperties = [];
    {manager_rate_function}
    assert(set_playlist_manager_refresh_rate(16) === true, 'Playlist Manager rate setter did not report a change');
    assert(ppt.refreshRate === 16, 'Playlist Manager live rate was not updated');
    assert(savedProperties.length === 1 && savedProperties[0][0] === 'SMOOTH.UI.REFRESH.INTERVAL.MS' && savedProperties[0][1] === 16,
        'Playlist Manager rate was not persisted');
    assert(managerReschedules === 1 && managerRequests === 1,
        'Playlist Manager active frame loop was not rescheduled and requested');
    assert(set_playlist_manager_refresh_rate(16) === false, 'Playlist Manager unchanged rate was not ignored');
    """
            result = subprocess.run([node, '-e', smooth_scroll_rate_smoke], capture_output=True, text=True)
            if result.returncode:
                errors.append('Smooth-scroll refresh-rate runtime smoke test failed: ' +
                              (result.stdout + result.stderr).strip())

        # Exercise JS Playlist title-format caching, invalidation and volatile-pattern safety.
        playlist_cache_smoke = f"""
    const fs = require('fs');
    const source = fs.readFileSync({json.dumps(str(samples / 'jsplaylist' / 'render_cache.js'))}, 'utf8');
    let evaluations = 0;
    let evaluatedPatterns = [];
    function get_tfo(pattern) {{
        return {{EvalActivePlaylistItem: function(index) {{
            evaluations++;
            evaluatedPatterns.push(pattern);
            return pattern + ':' + index;
        }}}};
    }}
    const Cache = new Function('get_tfo', source + '\\nreturn DarkOnePlaylistRenderCache;')(get_tfo);
    function assert(condition, message) {{ if (!condition) throw new Error(message); }}
    let nowMs = 1000000;
    const cache = new Cache({{enabled: true, maxEntries: 64, now() {{ return nowMs; }}}});
    assert(cache.configure('A', 'B', true) === true, 'Initial cache configuration was not applied');
    let first = cache.getConfigured(4, false);
    let initialEvaluations = evaluations;
    assert(cache.configure('A', 'B', true) === false, 'Unchanged cache configuration was rebuilt');
    let second = cache.getConfigured(4, false);
    assert(first === second && evaluations === initialEvaluations, 'Cached row was reevaluated');
    cache.invalidate(4);
    cache.getConfigured(4, false);
    assert(evaluations > initialEvaluations, 'Row invalidation did not force reevaluation');
    const sizeBeforeAbsentInvalidate = cache.stats().size;
    assert(cache.invalidate(9999) === false && cache.stats().size === sizeBeforeAbsentInvalidate,
        'Absent-row invalidation disturbed the cache');
    const afterInvalidate = evaluations;
    cache.get(4, 'C', 'B', true, false);
    assert(evaluations > afterInvalidate, 'Pattern change did not invalidate the cache');
    cache.get(5, 'C', 'B', true, false);
    const changedHandle = {{id: 5}};
    const activeHandles = {{GetItem(index) {{ return {{id: index}}; }}}};
    const changedHandles = {{Find(handle) {{ return handle.id === changedHandle.id ? 0 : -1; }}}};
    assert(cache.invalidateHandles(changedHandles, activeHandles) === 1,
        'Handle-based metadata invalidation did not target the changed cached row');
    cache.configure('%isplaying%', '', false);
    assert(cache.requiresCurrentRefresh(), 'Playing-row volatility was not detected');

    cache.configure('$year(%date%)', '', false);
    assert(!cache.stats().globalClockDynamic,
        'Stable date formatting was incorrectly classified as a live clock field');

    evaluations = 0;
    cache.configure('STATIC^^$now()', '', false);
    const clockFirst = cache.getConfigured(1, false);
    const clockAfterFirst = evaluations;
    const clockSecond = cache.getConfigured(1, false);
    assert(clockFirst === clockSecond && evaluations === clockAfterFirst,
        'Clock overlay was reevaluated more than once in the same second');
    nowMs += 1000;
    const clockThird = cache.getConfigured(1, false);
    assert(clockThird.primary[0] === clockFirst.primary[0] && evaluations === clockAfterFirst + 1 &&
        cache.stats().dynamicHits >= 1,
        'Clock field was not refreshed once over the cached static row');

    evaluations = 0;
    cache.configure('STATIC^^%isplaying%', '', false);
    const playingFirst = cache.getConfigured(7, true, 10);
    const playingAfterFirst = evaluations;
    const playingSecond = cache.getConfigured(7, true, 10);
    assert(playingFirst === playingSecond && evaluations === playingAfterFirst,
        'Playing-row values were reevaluated within one playback generation');
    const playingThird = cache.getConfigured(7, true, 11);
    assert(playingThird.primary[0] === playingFirst.primary[0] && evaluations === playingAfterFirst + 1,
        'Playing-row dynamic field did not refresh for the next playback generation');
    const nonPlayingFirst = cache.getConfigured(8, false);
    const nonPlayingAfterFirst = evaluations;
    const nonPlayingSecond = cache.getConfigured(8, false);
    assert(nonPlayingFirst === nonPlayingSecond && evaluations === nonPlayingAfterFirst,
        'Non-playing row with a playback field did not remain cached');

    evaluations = 0;
    evaluatedPatterns = [];
    const coupledPattern = '$puts(shared,STATIC)^^$if(%isplaying%,$get(shared),OFF)';
    cache.configure(coupledPattern, '', false);
    cache.getConfigured(7, true, 20);
    const coupledFirst = evaluations;
    cache.getConfigured(7, true, 20);
    assert(evaluations === coupledFirst, 'Coupled dynamic row ignored its playback generation cache');
    cache.getConfigured(7, true, 21);
    assert(evaluations === coupledFirst + 1 && evaluatedPatterns[evaluatedPatterns.length - 1] === coupledPattern &&
        cache.stats().coupledDynamic,
        'Cross-column $puts/$get state was not preserved during a dynamic refresh');

    for (let i = 0; i < 80; i++) cache.get(i, 'STATIC', '', false, false);
    assert(cache.stats().size <= 64, 'Render cache did not honour its entry limit');

    evaluations = 0;
    const frameCache = new Cache({{enabled: true, maxEntries: 128, now() {{ return 2000000; }}}});
    frameCache.configure('%title%^^%isplaying%', '%artist%', true);
    for (let frame = 0; frame < 120; frame++) {{
        const generation = Math.floor(frame / 60);
        for (let row = 0; row < 40; row++) frameCache.getConfigured(row, row === 7, generation);
    }}
    const frameStats = frameCache.stats();
    assert(evaluations < 300 && frameStats.hits > 4000 && frameStats.dynamicEvaluations === 2 &&
        frameStats.dynamicHits >= 118,
        'Visible-row cache did not substantially reduce repeated title-format evaluation');
    """
        result = subprocess.run([node, '-e', playlist_cache_smoke], capture_output=True, text=True)
        if result.returncode:
            errors.append('JS Playlist render-cache runtime smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Exercise the shared colour conversions, declarative menu mapping and
        # host-specific picker cancellation/fallback behaviour.
        colour_helper_smoke = f"""
    const fs = require('fs');
    const source = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
    let pickerCalls = [];
    let inputCalls = 0;
    const utilsMock = {{
        ColourPicker() {{ pickerCalls.push([...arguments]); return null; }},
        InputBox() {{ inputCalls++; return '#123456'; }}
    }};
    const factory = new Function('utils', source + '\\nreturn DarkOneColour;');
    const colour = factory(utilsMock);
    function assert(condition, message) {{ if (!condition) throw new Error(message); }}
    assert((colour.opaque(0x00123456) >>> 0) === 0xff123456, 'Opaque conversion failed');
    assert(colour.toHex(0xff123456) === '#123456', 'Hex conversion failed');
    assert((colour.parseOpaque('18, 52, 86') >>> 0) === 0xff123456, 'RGB parsing failed');
    assert((colour.parseOpaque('300, 0, 86') >>> 0) === 0xffff0056, 'RGB channel clamping failed');
    assert(colour.normaliseMode(4, [0, 1, 2, 4, 5, 3], 1) === 4, 'Sparse mode 4 was rejected');
    assert(colour.normaliseMode(99, [0, 1, 2, 4, 5, 3], 1) === 1, 'Invalid mode fallback failed');
    const options = [
        {{id: 10, mode: 0, label: 'Default'}},
        {{id: 12, mode: 2, label: 'Global'}},
        {{id: 11, mode: 1, custom: true}}
    ];
    const menu = {{
        items: [], radio: null,
        AppendMenuItem(flags, id, label) {{ this.items.push([flags, id, label]); }},
        CheckMenuRadioItem(minimum, maximum, selected) {{ this.radio = [minimum, maximum, selected]; }}
    }};
    colour.appendRadioOptions(menu, options, 1, 0xff123456, 0);
    assert(menu.radio.join(',') === '10,12,11', 'Declarative menu selected the wrong id');
    assert(menu.items[2][2] === 'Custom colour... (#123456)', 'Custom menu label is wrong');
    assert(colour.optionForId(options, 12).mode === 2, 'Menu id did not resolve to mode');
    assert(colour.pickJsplitter(0xff112233, 'Test', 'Prompt') === null,
        'Cancelling the JSplitter picker changed the colour');
    assert(inputCalls === 0 && pickerCalls[0].length === 2,
        'JSplitter cancel incorrectly opened fallback or used wrong signature');
    delete utilsMock.ColourPicker;
    assert((colour.pickJsplitter(0xff112233, 'Test', 'Prompt') >>> 0) === 0xff123456,
        'JSplitter text fallback failed when the native picker was unavailable');
    utilsMock.ColourPicker = function() {{ pickerCalls.push([...arguments]); return null; }};
    inputCalls = 0;
    assert(colour.pickJscript(0xff112233, 'Test', 'Prompt') === null,
        'Cancelling the JScript Panel picker changed the colour');
    assert(inputCalls === 0 && pickerCalls[pickerCalls.length - 1].length === 2 &&
        pickerCalls[pickerCalls.length - 1][1] === true,
        'JScript Panel cancel incorrectly opened fallback or used wrong signature');
    utilsMock.ColourPicker = function() {{ throw new Error('cancel'); }};
    inputCalls = 0;
    assert(colour.pickJscript(0xff112233, 'Test', 'Prompt') === null && inputCalls === 0,
        'JScript Panel picker exception incorrectly opened the text fallback');
    utilsMock.ColourPicker = function() {{ throw new Error('cancel'); }};
    assert(colour.pickJsplitter(0xff112233, 'Test', 'Prompt') === null && inputCalls === 0,
        'JSplitter picker exception incorrectly opened the text fallback');
    delete utilsMock.ColourPicker;
    assert((colour.pickJscript(0xff112233, 'Test', 'Prompt') >>> 0) === 0xff123456,
        'JScript Panel text fallback failed when the native picker was unavailable');
    """
        result = subprocess.run([node, '-e', colour_helper_smoke],
                                capture_output=True, text=True)
        if result.returncode:
            errors.append('Shared colour-helper runtime smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Exercise the shared startup/divider protocol independently from the
        # controller bridge tests so malformed messages and readiness re-queries
        # remain covered at the helper boundary.
        protocol_helper_smoke = f"""
    const fs = require('fs');
    const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
    const protocolSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'jsplitter_protocols.js'))}, 'utf8');
    const factory = new Function('utils', colourSource + '\\n' + protocolSource +
        '\\nreturn {{ DarkOneColour, DarkOneProtocol }};');
    const api = factory({{}});
    const startup = api.DarkOneProtocol.startup;
    const divider = api.DarkOneProtocol.divider;
    function assert(condition, message) {{ if (!condition) throw new Error(message); }}
    assert(startup.serialiseState({{transition: 2, minimumDelay: 5000,
        readinessTimeout: 7000}}) === 'v1|state|2|5000|7000',
        'Startup state serialisation changed');
    const state = startup.parseState('v1|state|9|-1|99999');
    assert(state && state.transition === 2 && state.minimumDelay === 0 &&
        state.readinessTimeout === 10000, 'Startup state clamping failed');
    assert(startup.parseState('v2|state|0|250|2000') === null,
        'Startup accepted an unsupported state version');
    assert(startup.serialiseCommand('set', 'minimum-delay', 9999) ===
        'v1|set|minimum-delay|5000', 'Startup command clamping failed');
    const command = startup.parseCommand('v1|set|readiness-timeout|7000');
    assert(command && command.key === 'readiness-timeout' && command.value === 7000,
        'Startup command parsing failed');
    assert(startup.parseCommand('v1|set|unknown|1') === null,
        'Startup accepted an unknown command key');
    assert(startup.parseCommand('v1|set|minimum-delay|not-a-number') === null,
        'Startup accepted a non-numeric command value');
    assert(startup.serialiseCommand('set', 'minimum-delay', Infinity) === null,
        'Startup serialised a non-finite command value');
    assert(startup.parseState('v1|state|0|Infinity|2000') === null,
        'Startup accepted a non-finite state value');
    const dividerMessage = divider.serialiseState(4, 0xff123456);
    assert(dividerMessage === 'v1|4|4279383126',
        'Divider state serialisation changed');
    const dividerState = divider.parseState(dividerMessage);
    assert(dividerState && dividerState.mode === 4 &&
        (dividerState.customColour >>> 0) === 0xff123456,
        'Divider state round-trip failed');
    assert(divider.parseState('v1|99|4278190080').mode === 1,
        'Divider invalid-mode fallback changed');
    assert(divider.parseState('v1|4|Infinity') === null,
        'Divider accepted a non-finite colour value');
    const options = divider.menuOptions(900);
    assert(options.map(item => item.id + ':' + item.mode).join(',') ===
        '900:0,901:1,902:2,903:4,905:5,904:3',
        'Divider menu mapping changed');
    const events = [];
    const readiness = startup.createReadinessBridge(
        {{NotifyOthers(name, data) {{ events.push([name, data]); }}}},
        'InfoStack'
    );
    assert(readiness.handle(startup.notifications.queryReady) === false &&
        events.length === 0, 'Unready controller answered a readiness query');
    readiness.signal();
    assert(readiness.isReady() && events.length === 1,
        'Readiness signal was not recorded');
    assert(readiness.handle(startup.notifications.queryReady) === true &&
        events.length === 2 && events[1][1] === 'InfoStack',
        'Ready controller did not repeat its readiness signal');
    """
        result = subprocess.run([node, '-e', protocol_helper_smoke],
                                capture_output=True, text=True)
        if result.returncode:
            errors.append('Shared JSplitter-protocol runtime smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Exercise the shared left/right optional-button menu independently from
        # the panel layouts. IDs and saved properties must remain compatible.
        optional_button_menu_smoke = f"""
    const fs = require('fs');
    const source = fs.readFileSync({json.dumps(str(project / 'jscript' / 'js' / 'Buttons_OptionalMenu.js'))}, 'utf8');
    const properties = new Map();
    let reloads = 0;
    let repaints = 0;
    let shownProperties = 0;
    let resetNames = null;
    let guideCalls = 0;
    let toolsCalls = [];
    let roundness = 33;
    let roundnessSet = null;
    let customRoundness = false;
    let refreshCalls = [];
    let inputValues = [];
    let popupMenus = [];
    let trackedIndex = 0;
    function createPopupMenu() {{
        const value = {{
            items: [], checked: [], separators: 0, children: [], disposed: false,
            AppendMenuItem(flags, id, label) {{ this.items.push([flags, id, label]); }},
            AppendMenuSeparator() {{ this.separators++; }},
            CheckMenuItem(id, checked) {{ if (checked) this.checked.push(id); }},
            CheckMenuRadioItem(minimum, maximum, selected) {{ this.radio = [minimum, maximum, selected]; }},
            AppendTo(parent, flags, label) {{ parent.children.push([flags, label, this]); }},
            TrackPopupMenu() {{ return trackedIndex; }},
            Dispose() {{ this.disposed = true; }}
        }};
        popupMenus.push(value);
        return value;
    }}
    const windowMock = {{
        GetProperty(name, fallback) {{ return properties.has(name) ? properties.get(name) : fallback; }},
        SetProperty(name, value) {{ properties.set(name, value); }},
        Reload() {{ reloads++; }},
        Repaint() {{ repaints++; }},
        ShowProperties() {{ shownProperties++; }},
        CreatePopupMenu: createPopupMenu
    }};
    const utilsMock = {{
        InputBox() {{
            if (!inputValues.length) throw new Error('cancel');
            const value = inputValues.shift();
            if (value instanceof Error) throw value;
            return value;
        }},
        MessageBox() {{ return 1; }}
    }};
    const factory = new Function(
        'window', 'utils', 'MB_OK', 'MB_ICONASTERISK',
        'resetOptionalButtonCommandStyles', 'showOptionalButtonCommandGuide',
        'darkOneToolsMenu', 'darkOneButtonRoundness', 'darkOneSetButtonRoundness',
        'darkOneInputButtonRoundness', 'buttonsOptions', 'buttonsSizes',
        'buttonsRefresh', source + '\\nreturn {{ DARKONE_CONTROL_BUTTON_MENU,' +
        'darkOneOptionalButtonEditId, darkOneAppendOptionalButtonMenu,' +
        'darkOneAppendButtonRoundnessMenu, darkOneConfigureOptionalButton,' +
        'darkOneHandleControlButtonMenuSelection, darkOneShowControlButtonMenu }};'
    );
    const api = factory(
        windowMock, utilsMock, 0, 64,
        names => {{ resetNames = names.slice(); }},
        () => {{ guideCalls++; }},
        (x, y) => {{ toolsCalls.push([x, y]); }},
        () => roundness,
        value => {{ roundnessSet = value; roundness = value; return true; }},
        () => customRoundness,
        () => refreshCalls.push('options'),
        () => refreshCalls.push('sizes'),
        () => refreshCalls.push('refresh')
    );
    function assert(condition, message) {{ if (!condition) throw new Error(message); }}
    function menu() {{
        return {{
            items: [], checked: [], separators: 0,
            AppendMenuItem(flags, id, label) {{ this.items.push([flags, id, label]); }},
            AppendMenuSeparator() {{ this.separators++; }},
            CheckMenuItem(id, checked) {{ if (checked) this.checked.push(id); }}
        }};
    }}
    const leftNames = Array.from({{length: 8}}, (_, i) => 'Button ' + String(i + 1).padStart(2, '0'));
    const rightNames = Array.from({{length: 10}}, (_, i) => 'Button ' + String(i + 1).padStart(2, '0'));
    const leftButtons = leftNames.map((name, i) => ({{Exists: i === 1, Text: i === 0 ? 'FIRST' : ''}}));
    let optionalMenu = menu();
    api.darkOneAppendOptionalButtonMenu(optionalMenu, leftNames, leftButtons);
    assert(api.darkOneOptionalButtonEditId(leftNames) === 109, 'Control Left edit id changed');
    assert(api.darkOneOptionalButtonEditId(rightNames) === 111, 'Control Right edit id changed');
    assert(optionalMenu.items[0][1] === 101 && optionalMenu.items[0][2] === 'FIRST',
        'Optional-button first item changed');
    assert(optionalMenu.items[1][0] === 8 && optionalMenu.items[8][1] === 109,
        'Optional-button checked/edit mapping changed');
    assert(optionalMenu.items[9][1] === 120 && optionalMenu.items[10][1] === 121,
        'Optional-button utility ids changed');
    let roundMenu = menu();
    api.darkOneAppendButtonRoundnessMenu(roundMenu);
    assert(roundMenu.items.map(item => item[1]).join(',') === '401,402,403,404,405,406,407',
        'Roundness menu ids changed');
    assert(roundMenu.checked.join(',') === '404', 'Current roundness check changed');

    inputValues = ['View/Console', 'ABCDEFGHIJKL'];
    api.darkOneConfigureOptionalButton(0, leftNames, leftButtons);
    assert(properties.get('Button 01') === true, 'Optional button was not enabled');
    assert(properties.get('Button 01 command string') === 'View/Console',
        'Optional command was not stored');
    assert(properties.get('Button 01 name (up to 10 letters)') === 'ABCDEFGHIJ',
        'Optional label truncation changed');
    assert(properties.get('Button 01 command style') === 0 && reloads === 1,
        'Optional command style/reload behaviour changed');

    leftButtons[0].Exists = true;
    properties.set('Button 01 command string', 'View/Console');
    api.darkOneConfigureOptionalButton(0, leftNames, leftButtons);
    assert(properties.get('Button 01') === false && reloads === 2,
        'Disabling an existing optional button changed');

    leftButtons[2].Exists = false;
    inputValues = [new Error('cancel')];
    api.darkOneConfigureOptionalButton(2, leftNames, leftButtons);
    assert(properties.get('Button 03') === false && reloads === 2,
        'Cancelled optional-button setup did not roll back');

    const options = {{buttonNames: leftNames, buttonProperties: leftButtons, x: 12, y: 34}};
    assert(api.darkOneHandleControlButtonMenuSelection(120, options),
        'Re-detect command menu id was not handled');
    assert(resetNames.length === 8, 'Re-detect did not receive every left button');
    assert(api.darkOneHandleControlButtonMenuSelection(121, options) && guideCalls === 1,
        'Command guide menu id changed');
    assert(api.darkOneHandleControlButtonMenuSelection(900, options) &&
        toolsCalls[0].join(',') === '12,34', 'DarkOne Tools menu id changed');
    refreshCalls = [];
    assert(api.darkOneHandleControlButtonMenuSelection(405, options) && roundnessSet === 60,
        'Roundness preset mapping changed');
    assert(refreshCalls.join(',') === 'options,sizes,refresh' && repaints === 1,
        'Roundness refresh sequence changed');
    refreshCalls = [];
    customRoundness = false;
    assert(api.darkOneHandleControlButtonMenuSelection(407, options) && refreshCalls.length === 0,
        'Cancelled custom roundness refreshed the panel');
    assert(api.darkOneHandleControlButtonMenuSelection(999, options) === false,
        'Unknown control-menu id was consumed');

    popupMenus = [];
    trackedIndex = 0;
    api.darkOneShowControlButtonMenu(5, 6, {{
        buttonNames: rightNames,
        buttonProperties: rightNames.map(() => ({{Exists: false, Text: ''}}))
    }});
    assert(popupMenus.length === 3 && popupMenus.every(item => item.disposed),
        'Shared right control menu did not dispose every popup');
    assert(popupMenus[0].children.map(item => item[1]).join(',') ===
        'Optional buttons,Button roundness', 'Shared right control menu order changed');
    assert(popupMenus[0].items.some(item => item[1] === 900),
        'Shared right control menu lost DarkOne Tools');

    popupMenus = [];
    trackedIndex = 999;
    let extraHandled = 0;
    api.darkOneShowControlButtonMenu(7, 8, {{
        buttonNames: leftNames,
        buttonProperties: leftButtons,
        appendExtraMenus(root) {{
            const extra = createPopupMenu();
            extra.AppendTo(root, 16, 'Button style');
            return [extra];
        }},
        handleExtraSelection(index) {{ if (index === 999) extraHandled++; }}
    }});
    assert(extraHandled === 1 && popupMenus.length === 4 &&
        popupMenus.every(item => item.disposed),
        'Shared left control menu did not delegate or dispose extra menus');
    assert(popupMenus[0].children.map(item => item[1]).join(',') ===
        'Optional buttons,Button style,Button roundness',
        'Shared left control menu extension order changed');
    """
        result = subprocess.run([node, '-e', optional_button_menu_smoke],
                                capture_output=True, text=True)
        if result.returncode:
            errors.append('Shared optional-button-menu runtime smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Exercise the InfoStack tab-colour modes. Existing Custom mode 1 must
        # remain intact while mode 2 follows Columns UI selected-item background.
        tab_colour_smoke = f"""
    const fs = require('fs');
    const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
    const protocolSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'jsplitter_protocols.js'))}, 'utf8');
    const infoColourSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / 'info_stack_colours.js'))}, 'utf8');
    const infoBridgeSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / 'info_stack_bridges.js'))}, 'utf8');
    const source = fs.readFileSync({json.dumps(str(project / 'jsplitter' / '03_info_stack_tabs.js'))}, 'utf8');
    const properties = new Map();
    const windowMock = {{
        GetProperty(name, fallback) {{ return properties.has(name) ? properties.get(name) : fallback; }},
        SetProperty(name, value) {{ properties.set(name, value); }},
        GetColourCUI(index) {{ return index === 4 ? 0xff556677 : 0xff112233; }},
        GetPanel() {{ return null; }}, NotifyOthers() {{}}, Repaint() {{}}, RepaintRect() {{}}, SetCursor() {{}}
    }};
    const DOJSP3Mock = {{
        titles: {{ playlistManager:'a', lastfmBio:'b', lastfmInfo:'c', albumNotes:'d', queue:'e', properties:'f' }},
        colours: {{ bar:0xff202020, separator:0xff181818, buttonNormal:0xff298fcc, buttonActive:0xffffffff, buttonHover:0xff888888 }},
        clamp(value, minimum, maximum) {{ return Math.max(minimum, Math.min(maximum, value)); }}
    }};
    const factory = new Function('window','fb','include','gdi','DOJSP3','utils','darkOneJsp3HandleReset',
        colourSource + '\\n' + protocolSource + '\\n' + infoColourSource + '\\n' + infoBridgeSource + '\\n' + source + '\\nreturn {{ tabColourMode, tabAccentColour, setTabColourMode }};');
    const controller = factory(windowMock, {{ProfilePath:''}}, function(){{}}, {{Font(){{return {{}};}}}}, DOJSP3Mock, {{}}, function(){{return false;}});
    if (controller.tabColourMode() !== 0 || (controller.tabAccentColour() >>> 0) !== 0xff298fcc)
        throw new Error('Default tab font accent changed');
    properties.set('DarkOneJSP3.InfoStack.TabCustomColour', 0xff123456);
    controller.setTabColourMode(1);
    if (controller.tabColourMode() !== 1 || (controller.tabAccentColour() >>> 0) !== 0xff123456)
        throw new Error('Legacy custom tab font mode no longer works');
    controller.setTabColourMode(2);
    if (controller.tabColourMode() !== 2 || (controller.tabAccentColour() >>> 0) !== 0xff556677)
        throw new Error('Tab font does not follow Columns UI selected-item background');
    """
        result = subprocess.run([node, '-e', tab_colour_smoke], capture_output=True, text=True)
        if result.returncode:
            errors.append('InfoStack tab-colour runtime smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Exercise display-accent mode compatibility and selected-item resolution.
        display_accent_smoke = f"""
    const fs = require('fs');
    const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
    const performanceSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'performance_utils.js'))}, 'utf8');
    let source = fs.readFileSync({json.dumps(str(project / 'jscript' / 'js' / 'Object_DisplaySystem.js'))}, 'utf8');
    const start = source.indexOf('function DisplaySystem()');
    if (start < 0) throw new Error('DisplaySystem constructor not found');
    source = source.slice(0,  source.indexOf('// ----- BASE IMAGE OBJECT -----')) + '\\n' + source.slice(start);
    const properties = new Map();
    let repaints = 0;
    const windowMock = {{
        GetProperty(name, fallback) {{ return properties.has(name) ? properties.get(name) : fallback; }},
        SetProperty(name, value) {{ properties.set(name, value); }},
        GetColourCUI(index) {{ return index === 4 ? 0xff556677 : 0xff112233; }},
        Repaint() {{ repaints++; }}
    }};
    const noopImage = {{ Dispose(){{}}, GetGraphics(){{return {{}};}}, ReleaseGraphics(){{}}, Width:1, Height:1 }};
    const factory = new Function('window','fb','safeGdiImage','utils','disposeImage','combColours','p_backcol','ui_btntxtcol',
        'tf_display_lossless','tf_display_lossy','tf_display_hires','tf_display_multich','tf_display_md5','tf_display_replaygain',
        'tf_display_tracknumber_exists','tf_display_totaltracks_exists','tf_display_tracknumber','tf_display_totaltracks','tf_display_bitrate',
        'imgPath','DWRITE_FONT_WEIGHT_BLACK','DWRITE_FONT_WEIGHT_NORMAL',
        'darkOneCreateFont','evalTitleFormat','TimeFmt','pad','pad_right','clearPanelTimer','section',
        colourSource + '\\n' + performanceSource + '\\n' + source + '\\nreturn {{ DisplaySystem, DARKONE_DISPLAY_ACCENT_DEFAULT, DARKONE_DISPLAY_ACCENT_CUSTOM, DARKONE_DISPLAY_ACCENT_COLUMNS_UI_SELECTED }};');
    const api = factory(windowMock, {{IsPlaying:false, PlaybackLength:0, PlaybackTime:0}}, function(){{return null;}},
        {{CreateImage(){{return noopImage;}}}}, function(){{}}, function(){{return 0xff000000;}}, 0xff000000, 0xffffffff,
        '', '', '', '', '', '', '', '', '', '', '', '', 900, 400, function(){{return {{}};}}, function(){{return ''; }}, function(){{return ''; }},
        function(){{return ''; }}, function(){{return ''; }}, function(v){{return v;}}, function(v){{return v;}}, function(){{return null;}},
        {{sac:0,pbo:1,pbt:2,vol:3,bit:4}});
    const display = new api.DisplaySystem();
    if (display.accent_mode !== 0 || (display.active_colour >>> 0) !== 0xff298fcc)
        throw new Error('Default display accent changed');
    display.setAccent(1, 0xff123456);
    if (display.accent_mode !== 1 || (display.active_colour >>> 0) !== 0xff123456)
        throw new Error('Legacy custom display accent no longer works');
    display.setAccent(2);
    if (display.accent_mode !== 2 || (display.active_colour >>> 0) !== 0xff556677)
        throw new Error('Display accent does not follow Columns UI selected-item background');
    let rebuilt = 0;
    let initialised = 0;
    display.InitImages = function() {{ rebuilt++; }};
    display.init = function() {{ initialised++; }};
    if (display.setDisplayStyle(1) !== true || display.display_style !== 1 || properties.get('Display Style') !== 1)
        throw new Error('Dot Matrix display style was not activated and persisted');
    if (rebuilt !== 1 || initialised !== 1 || repaints !== 1)
        throw new Error('Display style change did not rebuild, initialise and repaint exactly once');
    if (display.setDisplayStyle(1) !== false || rebuilt !== 1 || initialised !== 1 || repaints !== 1)
        throw new Error('Redundant display style selection performed unnecessary work');
    if (display.setDisplayStyle(0) !== true || display.display_style !== 0 || properties.get('Display Style') !== 0)
        throw new Error('Plain Font display style was not restored');
    """
        result = subprocess.run([node, '-e', display_accent_smoke], capture_output=True, text=True)
        if result.returncode:
            errors.append('Display accent runtime smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Exercise the opt-in information-page background modes, including the
        # explicit restoration of the historical Columns UI global background.
        page_background_smoke = f"""
    const fs = require('fs');
    const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
    const source = fs.readFileSync({json.dumps(str(samples / 'js' / 'panel.js'))}, 'utf8');
    function property(name, fallback) {{ this.name = name; this.value = fallback; }}
    const windowMock = {{
        IsDefaultUI: false,
        Width: 640,
        Height: 480,
        GetColourCUI(index) {{ return index === 3 ? 0xff445566 : 0xffffffff; }},
        GetColourDUI() {{ return 0xff000000; }},
        GetFontCUI() {{ return JSON.stringify({{Name: 'Segoe UI'}}); }},
        GetFontDUI() {{ return JSON.stringify({{Name: 'Segoe UI'}}); }},
        Repaint() {{}},
        CreatePopupMenu() {{ throw new Error('Menu should not be opened by colour smoke test'); }}
    }};
    const underscore = {{ invoke() {{}}, forEach() {{}}, first(a) {{ return a[0]; }}, last(a) {{ return a[a.length - 1]; }} }};
    const factory = new Function(
        'window', 'fb', '_p', '_scale', '_', 'RGB', 'blendColours',
        colourSource + '\\n' + source + '\\nreturn _panel;'
    );
    const Panel = factory(
        windowMock,
        {{ GetFocusItem() {{ return null; }} }},
        property,
        value => value,
        underscore,
        (r, g, b) => 0xff000000 + (r << 16) + (g << 8) + b,
        () => 0xff888888
    );
    const panel = new Panel({{ darkonejsp3_page_background: true }});
    if ((panel.page_background_colour() >>> 0) !== 0xff181818)
        throw new Error('Default information-page background is not DarkOne dark grey');
    panel.page_background.custom.value = 0xff123456;
    panel.page_background.mode.value = 4;
    if ((panel.page_background_colour() >>> 0) !== 0xff123456)
        throw new Error('Information-page custom mode no longer works');
    panel.page_background.mode.value = 5;
    if ((panel.page_background_colour() >>> 0) !== 0xff445566)
        throw new Error('Information page does not follow the Columns UI global background');
    """
        result = subprocess.run([node, '-e', page_background_smoke],
                                capture_output=True, text=True)
        if result.returncode:
            errors.append('Page-background runtime smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Exercise the InfoStack backing-colour mode range. Mode 4 was added after
        # the legacy custom mode 3 and must not be clamped back to mode 3.
        info_stack_background_smoke = f"""
    const fs = require('fs');
    const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
    const protocolSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'jsplitter_protocols.js'))}, 'utf8');
    const infoColourSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / 'info_stack_colours.js'))}, 'utf8');
    const infoBridgeSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / 'info_stack_bridges.js'))}, 'utf8');
    const source = fs.readFileSync({json.dumps(str(project / 'jsplitter' / '03_info_stack_tabs.js'))}, 'utf8');
    const properties = new Map();
    const windowMock = {{
        GetProperty(name, fallback) {{
            return properties.has(name) ? properties.get(name) : fallback;
        }},
        SetProperty(name, value) {{ properties.set(name, value); }},
        GetColourCUI(index) {{ return index === 3 ? 0xff445566 : 0xffffffff; }},
        GetPanel() {{ return null; }},
        NotifyOthers() {{}},
        Repaint() {{}},
        RepaintRect() {{}},
        SetCursor() {{}}
    }};
    const DOJSP3Mock = {{
        titles: {{
            playlistManager: 'a', lastfmBio: 'b', lastfmInfo: 'c',
            albumNotes: 'd', queue: 'e', properties: 'f'
        }},
        colours: {{
            bar: 0xff202020, separator: 0xff181818,
            buttonActive: 0xffffffff, buttonHover: 0xff888888
        }},
        clamp(value, minimum, maximum) {{
            return Math.max(minimum, Math.min(maximum, value));
        }}
    }};
    const factory = new Function(
        'window', 'fb', 'include', 'gdi', 'DOJSP3', 'utils',
        'darkOneJsp3HandleReset',
        colourSource + '\\n' + protocolSource + '\\n' + infoColourSource + '\\n' + infoBridgeSource + '\\n' + source + '\\nreturn {{ backgroundMode, backgroundColour }};'
    );
    const controller = factory(
        windowMock,
        {{ ProfilePath: '' }},
        function() {{}},
        {{ Font() {{ return {{}}; }} }},
        DOJSP3Mock,
        {{}},
        function() {{ return false; }}
    );
    if (controller.backgroundMode() !== 4 ||
            (controller.backgroundColour() >>> 0) !== 0xff181818)
        throw new Error('Default InfoStack backing is not DarkOne dark grey');
    properties.set('DarkOneJSP3.InfoStack.BackgroundColour', 0xff202020);
    properties.set('DarkOneJSP3.InfoStack.BackgroundMode', 4);
    if (controller.backgroundMode() !== 4 ||
            (controller.backgroundColour() >>> 0) !== 0xff181818)
        throw new Error('DarkOne dark grey was clamped to the stored custom colour');
    properties.set('DarkOneJSP3.InfoStack.BackgroundMode', 3);
    if (controller.backgroundMode() !== 3 ||
            (controller.backgroundColour() >>> 0) !== 0xff202020)
        throw new Error('Legacy custom InfoStack backing mode no longer works');
    properties.set('DarkOneJSP3.InfoStack.BackgroundMode', 5);
    if (controller.backgroundMode() !== 5 ||
            (controller.backgroundColour() >>> 0) !== 0xff445566)
        throw new Error('InfoStack backing does not follow the Columns UI global background');
    """
        result = subprocess.run([node, '-e', info_stack_background_smoke],
                                capture_output=True, text=True)
        if result.returncode:
            errors.append('InfoStack backing-colour runtime smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Exercise the waveform-host background range and colour resolution.
        waveform_background_smoke = f"""
    const fs = require('fs');
    const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
    const protocolSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'jsplitter_protocols.js'))}, 'utf8');
    const source = fs.readFileSync({json.dumps(str(project / 'jsplitter' / '06_display_waveform.js'))}, 'utf8');
    const properties = new Map();
    let repaintCount = 0;
    const windowMock = {{
        GetProperty(name, fallback) {{
            return properties.has(name) ? properties.get(name) : fallback;
        }},
        SetProperty(name, value) {{ properties.set(name, value); }},
        GetColourCUI(index) {{ return index === 3 ? 0xff445566 : 0xffffffff; }},
        Repaint() {{ repaintCount++; }}
    }};
    const DOJSP3Mock = {{
        colours: {{ bar: 0xff202020, separator: 0xff181818 }},
        clamp(value, minimum, maximum) {{
            return Math.max(minimum, Math.min(maximum, value));
        }}
    }};
    const factory = new Function(
        'window', 'fb', 'include', 'DOJSP3', 'darkOneJsp3HandleReset', 'utils',
        colourSource + '\\n' + protocolSource + '\\n' + source + '\\nreturn {{ backgroundMode, backgroundColour, on_colours_changed }};'
    );
    const controller = factory(
        windowMock,
        {{ ProfilePath: '', IsPlaying: false }},
        function() {{}},
        DOJSP3Mock,
        function() {{ return false; }},
        {{}}
    );
    if (controller.backgroundMode() !== 2 ||
            (controller.backgroundColour() >>> 0) !== 0xff202020)
        throw new Error('Default waveform host is not DarkOne grey');
    properties.set('DarkOneJSP3.DisplayWaveform.BackgroundColour', 0xff123456);
    properties.set('DarkOneJSP3.DisplayWaveform.BackgroundMode', 4);
    if (controller.backgroundMode() !== 4 ||
            (controller.backgroundColour() >>> 0) !== 0xff181818)
        throw new Error('Waveform DarkOne dark grey resolves to the custom colour');
    properties.set('DarkOneJSP3.DisplayWaveform.BackgroundMode', 3);
    if (controller.backgroundMode() !== 3 ||
            (controller.backgroundColour() >>> 0) !== 0xff123456)
        throw new Error('Waveform custom background mode no longer works');
    properties.set('DarkOneJSP3.DisplayWaveform.BackgroundMode', 5);
    if (controller.backgroundMode() !== 5 ||
            (controller.backgroundColour() >>> 0) !== 0xff445566)
        throw new Error('Waveform host does not follow the Columns UI background');
    controller.on_colours_changed();
    if (repaintCount !== 1)
        throw new Error('Waveform host does not repaint after a Columns UI colour change');
    """
        result = subprocess.run([node, '-e', waveform_background_smoke],
                                capture_output=True, text=True)
        if result.returncode:
            errors.append('Waveform background runtime smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Exercise upper-divider mode persistence, painting and notifications.
        divider_smoke = f"""
    const fs = require('fs');
    const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
    const protocolSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'jsplitter_protocols.js'))}, 'utf8');
    const source = fs.readFileSync({json.dumps(str(project / 'jsplitter' / '02_main_columns.js'))}, 'utf8');
    const properties = new Map();
    const notifications = [];
    const fills = [];
    const windowMock = {{
        GetProperty(name, fallback) {{
            return properties.has(name) ? properties.get(name) : fallback;
        }},
        SetProperty(name, value) {{ properties.set(name, value); }},
        GetColourCUI(index) {{ return index === 3 ? 0xff445566 : 0xffffffff; }},
        NotifyOthers(name, data) {{ notifications.push([name, data]); }},
        Repaint() {{}},
        CreatePopupMenu() {{ throw new Error('Menu should not be opened by paint smoke test'); }}
    }};
    const DOJSP3Mock = {{
        colours: {{ bar: 0xff202020, separator: 0xff181818 }},
        clamp(value, minimum, maximum) {{ return Math.max(minimum, Math.min(maximum, value)); }},
        idiv(value, divisor) {{ return Math.floor(value / divisor); }}
    }};
    const factory = new Function(
        'window', 'fb', 'include', 'utils', 'DOJSP3', 'darkOneJsp3HandleReset',
        colourSource + '\\n' + protocolSource + '\\n' + source + '\\nreturn {{ on_paint, on_notify_data, dividerMode, dividerColour, dividerState, parseDividerState: DarkOneProtocol.divider.parseState, isDividerPoint, setSize: function(w, h) {{ ww = w; wh = h; }} }};'
    );
    const controller = factory(
        windowMock,
        {{ ProfilePath: '' }},
        function() {{}},
        {{}},
        DOJSP3Mock,
        function() {{ return false; }}
    );
    const gr = {{ FillSolidRect(x, y, w, h, colour) {{ fills.push([x, y, w, h, colour >>> 0]); }} }};
    controller.setSize(1920, 900);
    controller.on_paint(gr);
    if (fills.length !== 3 || fills[1][4] !== 0xff000000 || fills[2][4] !== 0xff000000)
        throw new Error('Default upper dividers are not both black');
    fills.length = 0;
    controller.on_notify_data('DarkOneJSP3.ArtSpectrum.Divider.Set', 'v1|0|4278190080');
    controller.on_paint(gr);
    if (fills.length !== 0)
        throw new Error('Transparent divider mode still paints the host/dividers');
    fills.length = 0;
    controller.on_notify_data('DarkOneJSP3.ArtSpectrum.Divider.Set', 'v1|2|4278190080');
    controller.on_paint(gr);
    if (fills.length !== 3 || fills[1][4] !== 0xff202020 || fills[2][4] !== 0xff202020)
        throw new Error('DarkOne-grey divider mode did not paint both strips');
    fills.length = 0;
    controller.on_notify_data('DarkOneJSP3.ArtSpectrum.Divider.Set', 'v1|4|4279383126');
    controller.on_paint(gr);
    if (fills.length !== 3 || fills[1][4] !== 0xff181818 || fills[2][4] !== 0xff181818)
        throw new Error('DarkOne-dark-grey divider mode did not paint both strips');
    fills.length = 0;
    controller.on_notify_data('DarkOneJSP3.ArtSpectrum.Divider.Set', 'v1|3|4279383126');
    controller.on_paint(gr);
    if (fills.length !== 3 || fills[1][4] !== 0xff123456 || fills[2][4] !== 0xff123456)
        throw new Error('Custom divider colour did not paint both strips');
    fills.length = 0;
    controller.on_notify_data('DarkOneJSP3.ArtSpectrum.Divider.Set', 'v1|5|4279383126');
    controller.on_paint(gr);
    if (fills.length !== 3 || fills[1][4] !== 0xff445566 || fills[2][4] !== 0xff445566)
        throw new Error('Columns UI global background did not paint both divider strips');
    controller.on_notify_data('DarkOneJSP3.ArtSpectrum.Divider.Query', null);
    const stateEvents = notifications.filter(item => item[0] === 'DarkOneJSP3.ArtSpectrum.Divider.State');
    if (!stateEvents.length || typeof stateEvents[stateEvents.length - 1][1] !== 'string')
        throw new Error('Divider state query did not return a serialised state');
    const returnedState = controller.parseDividerState(stateEvents[stateEvents.length - 1][1]);
    if (!returnedState || returnedState.mode !== 5 ||
            (returnedState.customColour >>> 0) !== 0xff123456)
        throw new Error('Divider state query did not return the stored state');
    if (!controller.isDividerPoint(635) || controller.isDividerPoint(630))
        throw new Error('Divider context hit target was not expanded to ten pixels');
    """
        result = subprocess.run([node, '-e', divider_smoke], capture_output=True, text=True)
        if result.returncode:
            errors.append('Upper divider runtime smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Exercise the real JSplitter startup-control bridge and timing state.
        startup_bridge_smoke = f"""
    const fs = require('fs');
    const colourSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'colour_utils.js'))}, 'utf8');
    const protocolSource = fs.readFileSync({json.dumps(str(project / 'shared' / 'jsplitter_protocols.js'))}, 'utf8');
    const rootSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / '01_root.js'))}, 'utf8');
    const infoColourSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / 'info_stack_colours.js'))}, 'utf8');
    const infoBridgeSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / 'info_stack_bridges.js'))}, 'utf8');
    const infoSource = fs.readFileSync({json.dumps(str(project / 'jsplitter' / '03_info_stack_tabs.js'))}, 'utf8');
    const rootProperties = new Map();
    const infoProperties = new Map();
    const timers = new Map();
    let nextTimer = 1;
    let rootNotify = null;
    let infoNotify = null;
    const main = {{ visible: true, Show(value) {{ this.visible = Boolean(value); }}, Move() {{}} }};
    const controls = {{ visible: true, Show(value) {{ this.visible = Boolean(value); }}, Move() {{}} }};
    const infoChildren = Array.from({{length: 6}}, () => ({{Show() {{}}, Move() {{}}}}));
    function fakeSetTimeout(fn, delay) {{
        const id = nextTimer++;
        timers.set(id, {{fn, delay}});
        return id;
    }}
    function fakeClearTimeout(id) {{ timers.delete(id); }}
    function runTimerWithDelay(delay) {{
        const match = [...timers.entries()].find(item => item[1].delay === delay);
        if (!match) throw new Error('Missing timer with delay ' + delay);
        timers.delete(match[0]);
        match[1].fn();
    }}
    const DOJSP3 = {{
        colours: {{bar: 0xff202020, buttonNormal: 0xff298fcc,
            buttonHover: 0xff9b9b9b, buttonActive: 0xffffffff}},
        titles: {{main: 'main', controls: 'controls', infoStack: 'info',
            artSpectrum: 'art', playlist: 'playlist', playlistManager: 'p0',
            lastfmBio: 'p1', lastfmInfo: 'p2', albumNotes: 'p3',
            queue: 'p4', properties: 'p5'}},
        clamp(value, minimum, maximum) {{ return Math.max(minimum, Math.min(maximum, value)); }},
        idiv(value, divisor) {{ return Math.floor(value / divisor); }},
        mulDiv(value, multiplier, divisor) {{ return Math.round(value * multiplier / divisor); }},
        panel(title) {{ return title === 'main' ? main : controls; }},
        move(panel) {{ if (panel && panel.Move) panel.Move(); }},
        show(panel, visible) {{ if (panel) panel.Show(visible); }}
    }};
    const rootWindow = {{
        GetProperty(name, fallback) {{ return rootProperties.has(name) ? rootProperties.get(name) : fallback; }},
        SetProperty(name, value) {{ rootProperties.set(name, value); }},
        GetPanel(title) {{ return title === 'main' ? main : controls; }},
        NotifyOthers(name, data) {{ if (infoNotify) infoNotify(name, data); }},
        Repaint() {{}}, Reload() {{}}
    }};
    const infoWindow = {{
        Name: 'DOJSP3.InfoStack',
        GetProperty(name, fallback) {{ return infoProperties.has(name) ? infoProperties.get(name) : fallback; }},
        SetProperty(name, value) {{ infoProperties.set(name, value); }},
        GetPanel(title) {{
            const index = ['p0','p1','p2','p3','p4','p5'].indexOf(title);
            return index >= 0 ? infoChildren[index] : null;
        }},
        NotifyOthers(name, data) {{ if (rootNotify) rootNotify(name, data); }},
        Repaint() {{}}, RepaintRect() {{}}, SetCursor() {{}}, Reload() {{}}
    }};
    const rootFactory = new Function(
        'window','fb','include','utils','DOJSP3','darkOneJsp3HandleReset',
        'setTimeout','clearTimeout','console',
        colourSource + '\\n' + protocolSource + '\\n' + rootSource + '\\nreturn {{on_size,on_notify_data,startupTransition,startupMinimumDelay,startupSafetyTimeout}};'
    );
    const infoFactory = new Function(
        'window','fb','include','utils','DOJSP3','darkOneJsp3HandleReset','gdi',
        colourSource + '\\n' + protocolSource + '\\n' + infoColourSource + '\\n' + infoBridgeSource + '\\n' + infoSource + '\\nreturn {{on_notify_data,requestStartupControlState,sendStartupControlCommand,parseDividerState:DarkOneProtocol.divider.parseState,getState:function(){{return [startupMenuTransition,startupMenuMinimumDelay,startupMenuReadinessTimeout,startupMenuStateKnown];}}}};'
    );
    const root = rootFactory(rootWindow, {{ProfilePath:''}}, function(){{}}, {{}}, DOJSP3,
        function(){{return false;}}, fakeSetTimeout, fakeClearTimeout, console);
    const info = infoFactory(infoWindow, {{ProfilePath:'',ShowPopupMessage(){{}}}}, function(){{}},
        {{InputBox(){{return '0';}}}}, DOJSP3, function(){{return false;}},
        {{Font(){{return {{Height:12}};}}}});
    rootNotify = root.on_notify_data;
    infoNotify = info.on_notify_data;
    function assert(condition, message) {{ if (!condition) throw new Error(message); }}
    info.requestStartupControlState();
    assert(info.getState().join(',') === '0,250,2000,true', 'Initial root state did not reach InfoStack');
    const darkDividerState = info.parseDividerState('v1|4|4279383126');
    assert(darkDividerState && darkDividerState.mode === 4,
        'InfoStack clamped DarkOne-dark-grey divider mode 4');
    info.sendStartupControlCommand('set', 'transition', 1);
    info.sendStartupControlCommand('set', 'minimum-delay', 5000);
    info.sendStartupControlCommand('set', 'readiness-timeout', 7000);
    assert(root.startupTransition() === 1, 'Transition command did not update the root');
    assert(root.startupMinimumDelay() === 5000, 'Minimum hold did not update the root');
    assert(root.startupSafetyTimeout() === 7000, 'Readiness timeout did not update the root');
    assert(info.getState().slice(0,3).join(',') === '1,5000,7000', 'Root state did not synchronise back to InfoStack');
    root.on_size(1920, 1080);
    assert(main.visible === false && controls.visible === false, 'Black reveal did not hide root children');
    info.sendStartupControlCommand('preview');
    runTimerWithDelay(5000);
    runTimerWithDelay(150);
    assert(main.visible === true && controls.visible === true, 'Preview did not honour root timing/reveal');
    info.sendStartupControlCommand('restore');
    assert(root.startupTransition() === 0 && root.startupMinimumDelay() === 250 &&
        root.startupSafetyTimeout() === 2000, 'Startup defaults were not restored in the root');
    assert(info.getState().slice(0,3).join(',') === '0,250,2000', 'Restored root state did not synchronise to InfoStack');
    """
        result = subprocess.run([node, '-e', startup_bridge_smoke],
                                capture_output=True, text=True)
        if result.returncode:
            errors.append('Startup control bridge smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Execute the Panel Settings back-arrow factory at multiple UI scales.
        arrow_smoke = f"""
    const fs = require('fs');
    const source = fs.readFileSync({json.dumps(str(samples / 'jsplaylist' / 'settings.js'))}, 'utf8');
    const start = source.indexOf('function createSettingsBackArrow(colour, size) {{');
    if (start < 0) throw new Error('Back-arrow helper was not found');
    const open = source.indexOf('{{', start);
    let depth = 0;
    let end = -1;
    for (let i = open; i < source.length; i++) {{
        if (source[i] === '{{') depth++;
        else if (source[i] === '}}') {{
            depth--;
            if (depth === 0) {{ end = i + 1; break; }}
        }}
    }}
    if (end < 0) throw new Error('Back-arrow helper was not closed');
    const declaration = source.slice(start, end);
    function setAlpha(colour, alpha) {{
        return ((colour & 0x00ffffff) | (alpha << 24));
    }}
    function render(size, baseAlpha) {{
        const pixels = new Map();
        const image = {{
            width: size,
            height: size,
            GetGraphics() {{
                return {{
                    FillRectangle(x, y, w, h, colour) {{
                        if (w !== 1 || h !== 1)
                            throw new Error('Arrow rasteriser must write one pixel at a time');
                        if (![x, y, w, h, colour].every(Number.isFinite))
                            throw new Error('Arrow geometry contains a non-finite value');
                        if (x < 0 || y < 0 || x >= size || y >= size)
                            throw new Error('Arrow wrote outside its image');
                        const key = `${{x}},${{y}}`;
                        if (pixels.has(key))
                            throw new Error('Arrow wrote a destination pixel more than once');
                        pixels.set(key, colour >>> 0);
                    }}
                }};
            }},
            ReleaseGraphics() {{ this.released = true; }}
        }};
        const utils = {{ CreateImage(w, h) {{
            if (w !== size || h !== size)
                throw new Error('Arrow was not created at final size');
            return image;
        }} }};
        const create = new Function('utils', 'setAlpha',
            declaration + '; return createSettingsBackArrow;')(utils, setAlpha);
        const sourceColour = (((baseAlpha & 0xff) << 24) | 0x00e6e6e6) >>> 0;
        const result = create(sourceColour, size);
        if (result !== image || !image.released)
            throw new Error('Arrow image lifecycle failed');
        if (pixels.size < Math.round(size * size * 0.12))
            throw new Error('Arrow silhouette is unexpectedly sparse');

        const coords = [...pixels.keys()].map(key => key.split(',').map(Number));
        const xs = coords.map(point => point[0]);
        const ys = coords.map(point => point[1]);
        if (Math.min(...xs) > Math.floor(size * 0.12) ||
                Math.max(...xs) < Math.floor(size * 0.84) ||
                Math.min(...ys) > Math.floor(size * 0.20) ||
                Math.max(...ys) < Math.floor(size * 0.78))
            throw new Error('Arrow silhouette proportions are outside the expected bounds');

        let maxAlpha = 0;
        for (const value of pixels.values()) {{
            const alpha = (value >>> 24) & 0xff;
            if (alpha > baseAlpha)
                throw new Error('Arrow coverage increased source opacity');
            maxAlpha = Math.max(maxAlpha, alpha);
        }}
        if (maxAlpha !== baseAlpha)
            throw new Error('Arrow has no fully covered interior pixels');

        const centreY = Math.floor(size / 2);
        const centreRow = coords.filter(point => point[1] === centreY)
            .map(point => point[0]).sort((a, b) => a - b);
        if (centreRow.length < Math.floor(size * 0.65))
            throw new Error('Arrow shaft is too short');
        for (let i = 1; i < centreRow.length; i++) {{
            if (centreRow[i] !== centreRow[i - 1] + 1)
                throw new Error('Arrow centre row is not a single silhouette');
        }}
        return pixels;
    }}
    for (const size of [25, 38, 50]) {{
        const normal = render(size, 255);
        const hover = render(size, 200);
        if (normal.size !== hover.size)
            throw new Error('Normal and hover arrow geometry differs');
        for (const key of normal.keys()) {{
            if (!hover.has(key))
                throw new Error('Normal and hover arrow coverage differs');
        }}
    }}
    """
        result = subprocess.run([node, '-e', arrow_smoke],
                                capture_output=True, text=True)
        if result.returncode:
            errors.append('JS Playlist back-arrow smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Execute automatic tab-area geometry directly from the controller source.
        geometry_smoke = f"""
    const fs = require('fs');
    const source = fs.readFileSync({json.dumps(str(info_stack))}, 'utf8');
    const functionStart = source.indexOf('function automaticTabAreaHeight() {{');
    if (functionStart < 0)
        throw new Error('automaticTabAreaHeight source was not found');
    const bodyStart = source.indexOf('{{', functionStart);
    const bodyEnd = source.indexOf('\\n}}', bodyStart);
    if (bodyStart < 0 || bodyEnd < 0)
        throw new Error('automaticTabAreaHeight body was not found');
    const body = source.slice(bodyStart + 1, bodyEnd);
    const calculate = new Function(
        'ww', 'tabHeight', 'DOJSP3', 'window', 'FONT_PROPERTY',
        'automaticFontScale', body);
    const DOJSP3 = {{ idiv(a, b) {{ return Math.trunc(a / b); }} }};
    function area(scale, fixedFontSize) {{
        const window = {{ GetProperty() {{ return fixedFontSize; }} }};
        return calculate(
            1200, 20, DOJSP3, window, 'DarkOneJSP3.InfoStack.FontSize',
            function() {{ return scale; }});
    }}
    function assert(condition, message) {{
        if (!condition) throw new Error(message);
    }}
    const at50 = area(50, 0);
    const at100 = area(100, 0);
    const at200 = area(200, 0);
    assert(at50 < at100 && at100 < at200,
        'Automatic tab area does not follow font base scale');
    assert(at100 === 20 + Math.trunc(1200 / 40),
        'The established 100% tab-area geometry changed');
    assert(area(50, 18) === area(200, 18),
        'Fixed font sizing incorrectly follows automatic base scale');
    """
        result = subprocess.run([node, '-e', geometry_smoke],
                                capture_output=True, text=True)
        if result.returncode:
            errors.append('InfoStack automatic-area smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Execute managed AllMusic activation directly from the distributed source.
        allmusic_activation_smoke = f"""
    const fs = require('fs');
    const source = fs.readFileSync({json.dumps(str(samples / 'js' / 'allmusic.js'))}, 'utf8');
    function methodBody(signature) {{
        const start = source.indexOf(signature);
        if (start < 0) throw new Error('Missing method: ' + signature);
        const open = source.indexOf('{{', start);
        let depth = 0;
        let quote = '';
        let escaped = false;
        for (let i = open; i < source.length; i++) {{
            const ch = source[i];
            if (quote) {{
                if (escaped) escaped = false;
                else if (ch === '\\\\') escaped = true;
                else if (ch === quote) quote = '';
                continue;
            }}
            if (ch === \"'\" || ch === '\"' || ch === '`') {{ quote = ch; continue; }}
            if (ch === '{{') depth++;
            else if (ch === '}}') {{
                depth--;
                if (depth === 0) return source.slice(open + 1, i);
            }}
        }}
        throw new Error('Unclosed method: ' + signature);
    }}
    const activate = new Function('force', methodBody('this.activate_managed = function (force)'));
    const pending = new Function(methodBody('this.has_pending_work = function ()'));
    global.panel = {{
        metadb: {{}},
        tf(value) {{ return value.indexOf('artist') > -1 ? 'Test Artist' : 'Test Album'; }}
    }};
    global._tagged = value => String(value || '').length > 0;
    function provider(overrides) {{
        let callbacks = [];
        const value = {{
            managed: true,
            artist: 'Test Artist',
            album: 'Test Album',
            text: '',
            status_text: '',
            state: {{blocked: false}},
            resolved_album_url: '',
            review_url: '',
            terminal_state: '',
            history: {{stale: true}},
            last_request_url: 'stale',
            mb_fallback_started: true,
            request_kinds: {{}},
            scheduled_request_timers: {{}},
            has_pending_work: pending,
            reset() {{ throw new Error('Unexpected reset'); }},
            metadb_changed() {{ throw new Error('Unexpected identity reload'); }},
            blocked_message() {{ return 'blocked'; }},
            rebuild_text_layout() {{}},
            get() {{ this.request_kinds[1] = 'allmusic-search'; }},
            notify_terminal(success, reason) {{
                this.terminal_state = success ? 'success' : 'failure';
                callbacks.push({{success, reason}});
            }},
            callbacks
        }};
        return Object.assign(value, overrides || {{}});
    }}
    function assert(condition, message) {{ if (!condition) throw new Error(message); }}
    let p = provider();
    let state = activate.call(p, false);
    assert(state === 'pending', 'Idle same-album activation did not start work');
    assert(p.has_pending_work(), 'AllMusic activation did not register provider work');
    assert(!Object.prototype.hasOwnProperty.call(p.history, 'stale'),
        'Stale AllMusic search history was not cleared');
    assert(p.last_request_url === '', 'Stale AllMusic request URL was not cleared');

    p = provider({{text: 'Cached review', terminal_state: 'failure'}});
    state = activate.call(p, false);
    assert(state === 'success' && p.callbacks.length === 1 && p.callbacks[0].success,
        'Cached same-album review did not re-arm terminal success');

    p = provider({{request_kinds: {{7: 'allmusic-search'}}, get() {{ throw new Error('Pending work restarted'); }}}});
    state = activate.call(p, false);
    assert(state === 'pending', 'Existing AllMusic work was not preserved');

    p = provider({{
        state: {{blocked: true}},
        resolved_album_url: 'https://www.allmusic.com/album/test',
        history: {{}}
    }});
    state = activate.call(p, false);
    assert(state === 'failure' && p.callbacks[0].reason === 'saved browser-verification state',
        'Saved browser-verification state did not terminate the provider');

    p = provider({{history: {{}}, get() {{}}}});
    state = activate.call(p, false);
    assert(state === 'failure' && p.callbacks[0].reason === 'provider did not start a request',
        'Idle provider activation did not fail closed');
    """
        result = subprocess.run([node, '-e', allmusic_activation_smoke],
                                capture_output=True, text=True)
        if result.returncode:
            errors.append('AllMusic managed-activation smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Execute the shared reset registry and bridge in a mocked panel window.
        reset_smoke = f"""
    const fs = require('fs');
    const vm = require('vm');
    let properties = {{}};
    let reloads = 0;
    global.window = {{
        GetProperty(name, fallback) {{
            return Object.prototype.hasOwnProperty.call(properties, name)
                ? properties[name]
                : fallback;
        }},
        SetProperty(name, value) {{ properties[name] = value; }},
        Reload() {{ reloads++; }},
        Repaint() {{}}
    }};
    vm.runInThisContext(fs.readFileSync({json.dumps(str(registry_path))}, 'utf8'));
    vm.runInThisContext(fs.readFileSync(
        {json.dumps(str(samples / 'js' / 'darkonejsp3_reset.js'))}, 'utf8'));
    function assert(condition, message) {{
        if (!condition) throw new Error(message);
    }}
    function reset(values) {{ properties = Object.assign({{}}, values); reloads = 0; }}

    reset({{
        'DarkOneJSP3.InfoStack.FontSize': 31,
        'DarkOneJSP3.InfoStack.AutoFontScale': 145,
        'DarkOneJSP3.InfoStack.ActivePanel': 4
    }});
    darkOneJsp3ApplyRoleReset('info-stack', 'appearance');
    assert(properties['DarkOneJSP3.InfoStack.FontSize'] === 0,
        'InfoStack fixed font-size default failed');
    assert(properties['DarkOneJSP3.InfoStack.AutoFontScale'] === 100,
        'InfoStack automatic font-scale default failed');
    assert(properties['DarkOneJSP3.InfoStack.ActivePanel'] === 4,
        'InfoStack appearance reset changed active-panel behaviour');

    reset({{
        'JSPLAYLIST.Enable Smooth Scrolling': false,
        'JSPLAYLIST.UI Refresh Interval (ms)': 31,
        'JSPLAYLIST.Smooth Scroll Divisor': 7,
        'JSPLAYLIST.Playlist Wheel Throttle (ms)': 0,
        'JSPLAYLIST.Playlist Scroll Step': 9,
        'JSPLAYLIST.Snap Wheel Scrolling To Rows': false,
        'JSPLAYLIST.Snap Scrollbar Dragging To Rows': false,
        'JSPLAYLIST.Free Wheel Step (pixels)': 240
    }});
    assert(darkOneJsp3HandleSampleReset(
        'DarkOneJSP3.Reset.Properties', JSON.stringify({{version: 1, scope: 'behaviour'}}), 'js-playlist'),
        'JS Playlist reset notification was not handled');
    assert(properties['JSPLAYLIST.Enable Smooth Scrolling'] === true,
        'JS Playlist smooth-scrolling default failed');
    assert(properties['JSPLAYLIST.UI Refresh Interval (ms)'] === 8,
        'JS Playlist refresh default failed');
    assert(properties['JSPLAYLIST.Smooth Scroll Divisor'] === 2,
        'JS Playlist smoothness default failed');
    assert(properties['JSPLAYLIST.Playlist Wheel Throttle (ms)'] === 8,
        'JS Playlist wheel-throttle default failed');
    assert(properties['JSPLAYLIST.Playlist Scroll Step'] === 3,
        'JS Playlist row-step default failed');
    assert(properties['JSPLAYLIST.Snap Wheel Scrolling To Rows'] === true,
        'JS Playlist wheel-snap default failed');
    assert(properties['JSPLAYLIST.Snap Scrollbar Dragging To Rows'] === true,
        'JS Playlist scrollbar-snap default failed');
    assert(properties['JSPLAYLIST.Free Wheel Step (pixels)'] === 0,
        'JS Playlist free-wheel default failed');
    assert(reloads === 1, 'JS Playlist reset did not reload exactly once');

    reset({{
        'SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER': false,
        'SMOOTH.PLAYLIST.MANAGER.FILTER.WIDTH': 555,
        'SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT': 44,
        'SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS': false,
        'SMOOTH.UI.REFRESH.INTERVAL.MS': 25,
        'SMOOTH.SCROLL.SMOOTHNESS': 8,
        'SMOOTH.ROW.SCROLL.STEP': 9,
        'SMOOTH.PLAYLIST.MANAGER.REMEMBER.SCROLL': false,
        'SMOOTH.PLAYLIST.MANAGER.AUTO.SHOW.ACTIVE': false,
        'SMOOTH.PLAYLIST.MANAGER.SCROLL': 1234,
        'SMOOTH.PLAYLIST.MANAGER.SCROLL.STATE.V2': '{{"version":2}}'
    }});
    darkOneJsp3HandleSampleReset(
        'DarkOneJSP3.Reset.Properties', JSON.stringify({{version: 1, scope: 'behaviour'}}), 'playlist-manager');
    assert(properties['SMOOTH.UI.REFRESH.INTERVAL.MS'] === 8,
        'Playlist Manager refresh default failed');
    assert(properties['SMOOTH.SCROLL.SMOOTHNESS'] === 1.75,
        'Playlist Manager smoothness default failed');
    assert(properties['SMOOTH.ROW.SCROLL.STEP'] === 3,
        'Playlist Manager row-step default failed');
    assert(properties['SMOOTH.PLAYLIST.MANAGER.REMEMBER.SCROLL'] === true,
        'Playlist Manager remember-scroll default failed');
    assert(properties['SMOOTH.PLAYLIST.MANAGER.AUTO.SHOW.ACTIVE'] === true,
        'Playlist Manager auto-show default failed');
    assert(properties['SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER'] === false,
        'Behaviour reset changed Playlist Manager appearance');
    assert(properties['SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS'] === false,
        'Behaviour reset changed Playlist Manager row shading');
    assert(properties['SMOOTH.PLAYLIST.MANAGER.SCROLL'] === 1234,
        'Behaviour reset cleared Playlist Manager scroll state');
    assert(reloads === 1, 'Playlist Manager behaviour reset did not reload once');

    reset({{
        'SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER': false,
        'SMOOTH.PLAYLIST.MANAGER.FILTER.WIDTH': 555,
        'SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT': 44,
        'SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS': false,
        'SMOOTH.UI.REFRESH.INTERVAL.MS': 25,
        'SMOOTH.PLAYLIST.MANAGER.SCROLL': 1234,
        'SMOOTH.PLAYLIST.MANAGER.SCROLL.STATE.V2': '{{"version":2}}'
    }});
    darkOneJsp3HandleSampleReset(
        'DarkOneJSP3.Reset.Properties', {{scope: 'appearance'}}, 'playlist-manager');
    assert(properties['SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER'] === true,
        'Playlist Manager filter visibility default failed');
    assert(properties['SMOOTH.PLAYLIST.MANAGER.FILTER.WIDTH'] === 300,
        'Playlist Manager filter width default failed');
    assert(properties['SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT'] === 26,
        'Playlist Manager row-height default failed');
    assert(properties['SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS'] === true,
        'Playlist Manager alternating-row default failed');
    assert(properties['SMOOTH.UI.REFRESH.INTERVAL.MS'] === 25,
        'Appearance reset changed Playlist Manager behaviour');
    assert(properties['SMOOTH.PLAYLIST.MANAGER.SCROLL'] === 1234,
        'Appearance reset cleared Playlist Manager scroll state');
    assert(reloads === 1, 'Playlist Manager appearance reset did not reload once');

    reset({{
        'SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER': false,
        'SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS': false,
        'SMOOTH.UI.REFRESH.INTERVAL.MS': 25,
        'SMOOTH.PLAYLIST.MANAGER.SCROLL': 1234,
        'SMOOTH.PLAYLIST.MANAGER.SCROLL.STATE.V2': '{{"version":2}}'
    }});
    darkOneJsp3HandleSampleReset(
        'DarkOneJSP3.Reset.Properties', JSON.stringify({{version: 1, scope: 'all'}}), 'playlist-manager');
    assert(properties['SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER'] === true,
        'Full reset missed Playlist Manager appearance');
    assert(properties['SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS'] === true,
        'Full reset missed Playlist Manager alternating rows');
    assert(properties['SMOOTH.UI.REFRESH.INTERVAL.MS'] === 8,
        'Full reset missed Playlist Manager behaviour');
    assert(properties['SMOOTH.PLAYLIST.MANAGER.SCROLL'] === 0,
        'Full reset did not clear numeric Playlist Manager scroll');
    assert(properties['SMOOTH.PLAYLIST.MANAGER.SCROLL.STATE.V2'] === '',
        'Full reset did not clear row-aware Playlist Manager scroll state');
    assert(reloads === 1, 'Playlist Manager full reset did not reload once');
    """
        result = subprocess.run([node, '-e', reset_smoke], capture_output=True, text=True)
        if result.returncode:
            errors.append('Playlist reset smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Exercise the JSplitter-side reset parser with serialised and legacy payloads.
        jsplitter_reset_smoke = f"""
    const fs = require('fs');
    const vm = require('vm');
    let properties = {{
        'DarkOneJSP3.InfoStack.FontSize': 31,
        'DarkOneJSP3.InfoStack.ActivePanel': 4
    }};
    let reloads = 0;
    global.fb = {{ ProfilePath: '' }};
    global.window = {{
        GetPanel() {{ return null; }},
        GetProperty(name, fallback) {{
            return Object.prototype.hasOwnProperty.call(properties, name)
                ? properties[name]
                : fallback;
        }},
        SetProperty(name, value) {{ properties[name] = value; }},
        Reload() {{ reloads++; }},
        Repaint() {{}}
    }};
    global.include = function() {{
        vm.runInThisContext(fs.readFileSync(
            {json.dumps(str(registry_path))}, 'utf8'));
    }};
    global.DARKONEJSP3_RESET_ROLE = 'info-stack';
    vm.runInThisContext(fs.readFileSync(
        {json.dumps(str(project / 'jsplitter' / 'shared.js'))}, 'utf8'));
    function assert(condition, message) {{
        if (!condition) throw new Error(message);
    }}
    assert(darkOneJsp3ResetScope(JSON.stringify({{version: 1, scope: 'appearance'}})) === 'appearance',
        'JSplitter did not parse a serialised reset scope');
    assert(darkOneJsp3ResetScope({{scope: 'behaviour'}}) === 'behaviour',
        'JSplitter did not retain legacy object-payload compatibility');
    assert(darkOneJsp3HandleReset('DarkOneJSP3.Reset.Properties',
        JSON.stringify({{version: 1, scope: 'appearance'}})),
        'JSplitter did not handle a serialised reset notification');
    assert(properties['DarkOneJSP3.InfoStack.FontSize'] === 0,
        'JSplitter serialised reset did not restore appearance defaults');
    assert(properties['DarkOneJSP3.InfoStack.ActivePanel'] === 4,
        'JSplitter appearance reset changed behaviour state');
    assert(reloads === 1, 'JSplitter serialised reset did not reload exactly once');
    """
        result = subprocess.run([node, '-e', jsplitter_reset_smoke],
                                capture_output=True, text=True)
        if result.returncode:
            errors.append('JSplitter reset smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

        # Exercise scripted Queue Viewer selection, keyboard navigation and
        # source-item commands without relying on unsupported queue mutation APIs.
        queue_viewer_smoke = f"""
    const fs = require('fs');
    const source = fs.readFileSync({json.dumps(str(project / 'jscript' / 'js' / 'Queue_Viewer.js'))}, 'utf8');
    let pressed = {{}};
    let clipboard = '';
    let played = null;
    let focused = null;
    let propertiesRuns = 0;
    let explored = '';
    const sourceItems = [
        {{Path: 'C:/Music/a.flac'}},
        {{Path: 'C:/Music/b.flac'}},
        {{Path: 'C:/Music/c.flac'}},
        {{Path: 'C:/Music/d.flac'}}
    ];
    function HandleList(initial) {{
        this.items = initial ? initial.slice() : [];
        Object.defineProperty(this, 'Count', {{get: () => this.items.length}});
    }}
    HandleList.prototype.AddItem = function(handle) {{ this.items.push(handle); }};
    HandleList.prototype.GetItem = function(index) {{ return this.items[index]; }};
    HandleList.prototype.RunContextCommand = function(command) {{
        if (command === 'Properties') {{ propertiesRuns++; return true; }}
        return false;
    }};
    HandleList.prototype.Dispose = function() {{}};
    const playlistItems = new HandleList(sourceItems);
    const panel = {{
        list_objects: [], row_height: 20,
        fonts: {{normal: {{}}}}, colours: {{text: 1, highlight: 2}},
        m: {{AppendMenuItem() {{}}, AppendMenuSeparator() {{}}}}
    }};
    const windowMock = {{
        Name: 'Queue', RepaintRect() {{}}, Repaint() {{}}, SetCursor() {{}},
        SetTimeout() {{ return 1; }}, ClearTimeout() {{}}
    }};
    const plman = {{
        PlaylistCount: 1, ActivePlaylist: 0,
        GetPlaylistItemCount() {{ return sourceItems.length; }},
        GetPlaylistItems() {{ return playlistItems; }},
        ClearPlaylistSelection() {{}}, SetPlaylistSelectionSingle() {{}},
        SetPlaylistFocusItem(playlist, item) {{ focused = [playlist, item]; }},
        ExecutePlaylistDefaultAction(playlist, item) {{ played = [playlist, item]; }}
    }};
    const fb = {{
        CreateHandleList(handle) {{ return new HandleList(handle ? [handle] : []); }},
        TitleFormat() {{ return {{EvalPlaylistItem() {{ return ''; }}}}; }}
    }};
    const utils = {{
        IsKeyPressed(key) {{ return !!pressed[key]; }},
        SetClipboardText(value) {{ clipboard = value; }},
        IsFile(path) {{ return !!path; }}, InputBox() {{ return ''; }}
    }};
    function ScrollButton() {{
        this.lbtn_up = function() {{}};
        this.move = function() {{ return false; }};
        this.paint = function() {{}};
    }}
    function assert(condition, message) {{ if (!condition) throw new Error(message); }}
    const factory = new Function(
        'panel', 'window', 'plman', 'fb', 'utils', '_scale', '_sb', 'chars', '_',
        'setAlpha', 'EnableMenuIf', 'MF_STRING', 'VK_CONTROL', 'VK_SHIFT',
        'VK_UP', 'VK_DOWN', 'VK_HOME', 'VK_END', 'VK_PGUP', 'VK_PGDN',
        'VK_RETURN', 'VK_ESCAPE', 'IDC_ARROW', 'DWRITE_TEXT_ALIGNMENT_CENTER',
        'DWRITE_PARAGRAPH_ALIGNMENT_CENTER', 'DWRITE_WORD_WRAPPING_NO_WRAP',
        'DWRITE_TRIMMING_GRANULARITY_CHARACTER', 'DWRITE_TEXT_ALIGNMENT_LEADING',
        '_p', 'console', '_explorer', source + '\\nreturn _queue_viewer;'
    );
    const QueueViewer = factory(
        panel, windowMock, plman, fb, utils, value => value, ScrollButton,
        {{up: 'u', down: 'd'}}, {{bind: (fn, context) => fn.bind(context)}},
        colour => colour, () => 0, 0, 0x11, 0x10, 0x26, 0x28, 0x24, 0x23,
        0x21, 0x22, 0x0d, 0x1b, 0, 0, 0, 0, 0, 0,
        function(name, value) {{ this.value = value; }}, console,
        path => {{ explored = path; }}
    );
    const queue = new QueueViewer(0, 0, 200, 200);
    queue.rows = 4;
    queue.data = [
        {{queue_index: 1, playlist_index: 0, playlist_item_index: 0, text: 'A'}},
        {{queue_index: 2, playlist_index: 0, playlist_item_index: 1, text: 'B'}},
        {{queue_index: 3, playlist_index: 0, playlist_item_index: 2, text: 'C'}},
        {{queue_index: 4, playlist_index: 0, playlist_item_index: 3, text: 'D'}}
    ];
    queue.count = queue.data.length;
    queue.select_only(1);
    queue.toggle_selection(3);
    assert(queue.selected_indices.join(',') === '1,3', 'Ctrl-style queue selection failed');
    queue.anchor_index = 1;
    queue.select_range(2, false);
    assert(queue.selected_indices.join(',') === '1,2', 'Queue range selection failed');
    pressed[0x11] = true;
    queue.key_down(0x41);
    pressed = {{}};
    assert(queue.selected_indices.join(',') === '0,1,2,3', 'Queue Ctrl+A failed');
    queue.key_down(0x1b);
    assert(queue.selected_indices.length === 0, 'Queue Escape did not clear selection');
    queue.select_only(1);
    queue.key_down(0x28);
    assert(queue.selected_index === 2, 'Queue Down navigation failed');
    pressed[0x10] = true;
    queue.key_down(0x26);
    pressed = {{}};
    assert(queue.selected_indices.join(',') === '1,2', 'Queue Shift+Up range failed');
    queue.copy_titles();
    assert(clipboard === 'B\\r\\nC', 'Queue title copying failed');
    queue.copy_paths();
    assert(clipboard === 'C:/Music/b.flac\\r\\nC:/Music/c.flac', 'Queue path copying failed');
    queue.show_properties();
    assert(propertiesRuns === 1, 'Queue Properties command failed');
    queue.play_row(2);
    assert(played && played[1] === 2, 'Queue source playback failed');
    queue.focus_row(1);
    assert(focused && focused[1] === 1, 'Queue source navigation failed');
    queue.open_containing_folder();
    assert(explored === 'C:/Music/b.flac', 'Queue containing-folder command failed');
    const snapshot = queue.capture_selection();
    queue.selected_indices = [];
    queue.selected_index = -1;
    queue.restore_selection(snapshot);
    assert(queue.selected_indices.join(',') === '1,2', 'Queue selection restore failed');
    """
        result = subprocess.run([node, '-e', queue_viewer_smoke],
                                capture_output=True, text=True)
        if result.returncode:
            errors.append('Queue Viewer runtime smoke test failed: ' +
                          (result.stdout + result.stderr).strip())

    with tempfile.TemporaryDirectory() as cache:
        for path in sorted(project.rglob('*.py')):
            result = subprocess.run(
                [sys.executable, '-m', 'py_compile', str(path)],
                env={**os.environ, 'PYTHONPYCACHEPREFIX': cache},
                capture_output=True,
                text=True,
            )
            if result.returncode:
                errors.append('Python compilation failed for ' + rel(path) + ': ' +
                              result.stderr.strip())
