"use strict";

// Registered with harness.js and executed in isolated VM contexts.

suite("performance helper lifecycle", function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path("DarkOneJSP3/shared/performance_utils.js"), 'utf8');
    let visible = true;
    let sequence = 0;
    let tasks = [];
    const host = {
        get IsVisible() { return visible; },
        SetTimeout(fn, delay) { const id = ++sequence; tasks.push({id, fn, delay}); return id; },
        ClearTimeout(id) { tasks = tasks.filter(task => task.id !== id); }
    };
    let fallbackDisposed = 0;
    const directBitmap = {Width: 2, Height: 2};
    const fallbackBitmap = {Width: 3, Height: 3};
    const utilsMock = {
        LoadBitmap(path) { return path === 'direct' ? directBitmap : null; },
        LoadImage(path) {
            return {CreateBitmap() { return fallbackBitmap; }, Dispose() { fallbackDisposed++; }};
        }
    };
    const api = new Function('utils', source + '\nreturn DarkOnePerformance;')(utilsMock);
    function assert(condition, message) { if (!condition) throw new Error(message); }
    function runNext() { if (!tasks.length) throw new Error('No scheduled task'); const task = tasks.shift(); task.fn(); return task; }

    let repaints = 0;
    const scheduler = api.createRepaintScheduler(host, {delay: 8, hiddenDelay: 250, repaint() { repaints++; }});
    assert(typeof scheduler.cancel === 'function' && typeof scheduler.stop === 'undefined', 'Repaint scheduler cleanup API must use cancel(), not stop()');
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
    const loop = api.createFrameLoop(host, {delay: 8, tick() { frames++; return frames < 3; }});
    loop.request();
    runNext(); runNext(); runNext();
    assert(frames === 3 && tasks.length === 0 && !loop.isRunning(), 'Frame loop did not stop when idle');

    let dynamicDelay = 8;
    let dynamicFrames = 0;
    const dynamicLoop = api.createFrameLoop(host, {
        getDelay() { return dynamicDelay; },
        tick() { dynamicFrames++; return dynamicFrames < 2; }
    });
    dynamicLoop.request();
    assert(tasks.length === 1 && tasks[0].delay === 8, 'Dynamic frame loop did not use the initial delay');
    dynamicDelay = 16;
    dynamicLoop.reschedule();
    assert(tasks.length === 1 && tasks[0].delay === 16, 'Active frame loop did not reschedule to the changed delay');
    runNext();
    assert(tasks.length === 1 && tasks[0].delay === 16, 'Changed frame-loop delay was not retained');
    runNext();
    assert(dynamicFrames === 2 && tasks.length === 0 && !dynamicLoop.isRunning(), 'Dynamic frame loop did not become idle');

    let valueClock = 1000;
    let appliedValues = [];
    const valueCoalescer = api.createValueCoalescer(host, {
        delay: 16,
        now() { return valueClock; },
        apply(value) { appliedValues.push(value); }
    });
    valueCoalescer.request(-10);
    assert(appliedValues.join(',') === '-10' && tasks.length === 0,
        'First coalesced value was not applied immediately');
    valueClock = 1004;
    valueCoalescer.request(-20);
    valueClock = 1006;
    valueCoalescer.request(-30);
    assert(tasks.length === 1 && tasks[0].delay === 12,
        'Rapid values were not coalesced behind one interval timer');
    valueClock = 1016;
    runNext();
    assert(appliedValues.join(',') === '-10,-30' && !valueCoalescer.isPending(),
        'Coalescer did not apply only the latest pending value');
    valueClock = 1018;
    valueCoalescer.request(-40);
    assert(tasks.length === 1, 'Later coalesced value was not delayed');
    valueCoalescer.flush();
    assert(appliedValues.join(',') === '-10,-30,-40' && tasks.length === 0,
        'Coalescer flush did not apply the exact final value');

    let deadlineClock = 2000;
    let deadlineExpirations = 0;
    const trailingDeadline = api.createTrailingDeadline(host, {
        delay: 3000,
        now() { return deadlineClock; },
        onExpire() { deadlineExpirations++; }
    });
    trailingDeadline.touch();
    assert(tasks.length === 1 && tasks[0].delay === 3000,
        'Trailing deadline did not create its initial timer');
    deadlineClock = 4000;
    trailingDeadline.touch();
    assert(tasks.length === 1, 'Trailing deadline recreated its timer on every touch');
    deadlineClock = 5000;
    runNext();
    assert(tasks.length === 1 && tasks[0].delay === 2000 && deadlineExpirations === 0,
        'Extended trailing deadline did not reschedule only at expiry');
    deadlineClock = 7000;
    runNext();
    assert(deadlineExpirations === 1 && !trailingDeadline.isPending(),
        'Trailing deadline did not expire after the final touch');

    let disposed = 0;
    const bitmapObject = {Width: 1, Height: 1, Dispose: function() {}};
    const image = {CreateBitmap: function() { return bitmapObject; }, Dispose: function() { disposed++; }};
    const bitmap = api.toBitmap(image, true);
    assert(bitmap && disposed === 1, 'Image-to-bitmap conversion did not dispose its source');
    const existingBitmap = {Width: 4, Height: 4};
    assert(api.toBitmap(existingBitmap, false) === existingBitmap,
        'Existing bitmap fallback was not retained when CreateBitmap was unavailable');
    let directDisposeCount = 0;
    api.dispose({Dispose() { directDisposeCount++; }});
    assert(directDisposeCount === 1, 'Native resource disposal was not attempted directly');
    let uniqueDisposeCount = 0;
    const sharedResource = {Dispose() { uniqueDisposeCount++; }};
    api.disposeUnique([sharedResource, sharedResource, null]);
    assert(uniqueDisposeCount === 1, 'disposeUnique() did not de-duplicate shared native resources');
    assert(api.loadBitmap('direct') === directBitmap, 'Direct bitmap loading was not preferred');
    assert(api.loadBitmap('fallback') === fallbackBitmap && fallbackDisposed === 1,
        'Image fallback did not create a bitmap and dispose its source');
    assert(api.createProfiler({}, false, 'disabled', 10) === null, 'Disabled profiler created runtime overhead');
    let profilerCreated = 0;
    let profilerResets = 0;
    const profilerApi = api.createProfiler({CreateProfiler() { profilerCreated++; return {Reset() { profilerResets++; }, Time: 0}; }}, true, 'enabled', 10);
    assert(profilerApi && profilerCreated === 1, 'Native profiler creation was not attempted directly');
    profilerApi.begin();
    assert(profilerResets === 1, 'Native profiler Reset was not attempted directly');
});

suite("UI cadence protocol", function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path("DarkOneJSP3/shared/ui_cadence.js"), 'utf8');
    const api = new Function(source + '\nreturn DarkOneUiCadence;')();
    function assert(condition, message) { if (!condition) throw new Error(message); }
    const listeners = [];
    function createHost(name) {
        const properties = new Map();
        const host = {
            name,
            GetProperty(key, fallback) { return properties.has(key) ? properties.get(key) : fallback; },
            SetProperty(key, value) { properties.set(key, value); },
            NotifyOthers(notification, payload) {
                listeners.forEach(entry => { if (entry.host !== host) entry.handle(notification, payload); });
            }
        };
        return host;
    }
    const controlHost = createHost('control');
    const displayHost = createHost('display');
    const playlistHost = createHost('playlist');
    const managerHost = createHost('manager');
    let playlistInterval = 8;
    let managerInterval = 16;
    let ownerChanges = [];
    let followerChanges = [];
    const owner = api.createVolumeOwner(controlHost, {
        propertyName: 'DARKONEJSP3.VOLUME.DRAG.REFRESH.MODE',
        fallback: 16,
        onChange(value) { ownerChanges.push(value); }
    });
    const follower = api.createVolumeFollower(displayHost, {
        fallback: 16,
        onChange(value) { followerChanges.push(value); }
    });
    const playlist = api.createSourceReporter(playlistHost, {
        source: api.sources.jsPlaylist,
        getInterval() { return playlistInterval; }
    });
    const manager = api.createSourceReporter(managerHost, {
        source: api.sources.playlistManager,
        getInterval() { return managerInterval; }
    });
    listeners.push(
        {host: controlHost, handle: owner.handleNotification},
        {host: displayHost, handle: follower.handleNotification},
        {host: playlistHost, handle: playlist.handleNotification},
        {host: managerHost, handle: manager.handleNotification}
    );
    owner.start();
    follower.start();
    playlist.start();
    manager.start();
    assert(owner.getInterval() === 8 && follower.getInterval() === 8,
        'Automatic volume cadence did not follow the fastest reported panel interval');
    playlistInterval = 12;
    playlist.announce();
    assert(owner.getInterval() === 12 && follower.getInterval() === 12,
        'Automatic volume cadence did not update after a source interval change');
    assert(owner.setMode(16) && owner.getMode() === 16 && owner.getInterval() === 16 && follower.getInterval() === 16,
        'Manual volume cadence did not override automatic source resolution');
    playlistInterval = 8;
    playlist.announce();
    assert(owner.getInterval() === 16 && follower.getInterval() === 16,
        'Manual volume cadence was incorrectly changed by a source announcement');
    assert(owner.setMode(api.volumeModeAuto) && owner.getInterval() === 8 && follower.getInterval() === 8,
        'Returning to Automatic did not restore fastest-source resolution');
    playlist.dispose();
    assert(owner.getInterval() === 16 && follower.getInterval() === 16,
        'Unavailable fastest source was not removed from automatic resolution');
    manager.dispose();
    assert(owner.getInterval() === 16 && follower.getInterval() === 16,
        'Automatic cadence did not retain the safe fallback with no sources');
    assert(api.volumeModeForMenuId(20) === 0 && api.volumeModeForMenuId(24) === 16,
        'Volume cadence menu IDs no longer preserve their mappings');
    assert(ownerChanges.length > 0 && followerChanges.length > 0,
        'Volume cadence changes were not propagated to consumers');
});

suite("smooth-scroll refresh rate", function () {
    function assert(condition, message) { if (!condition) throw new Error(message); }
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
    var g_repaint_scheduler = {request(delay) { repaintRequestArgs.push(delay); }};
    function newFrame(options) {
        let running = false;
        const frame = {
            options: options || null,
            request() { running = true; frameRequests++; },
            reschedule() { frameReschedules++; },
            stop() { running = false; frameStops++; },
            isRunning() { return running; }
        };
        return frame;
    }
    var DarkOnePerformance = {createFrameLoop(host, options) {
        frameCreates++;
        const frame = newFrame(options);
        createdFrames.push(frame);
        return frame;
    }};
    var window = {
        IsVisible: true,
        Repaint() { repaints++; },
        SetProperty(name, value) { savedProperties.push([name, value]); }
    };
    var properties = {smoothscrolling: true};
    var cRow = {playlist_h: 20};
    var cList = {
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
    };
    var cScrollBar = {timerID: false};
    /*__PLAYLIST_VIEWPORT_FUNCTION__*/
    var p = {
        list: {
            offset: 0,
            totalRows: 200,
            totalRowVisible: 10,
            totalRowToLoad: 11,
            loadedRowCount: 11,
            h: 205,
            getViewportRowsToLoad(pixelShift, offsetOverride) {
                const offset = typeof offsetOverride === 'number' ? offsetOverride : this.offset;
                const remaining = Math.max(0, this.totalRows - Math.max(0, offset || 0));
                return Math.min(remaining, get_playlist_viewport_row_load_count(
                    this.h, cRow.playlist_h, this.totalRowToLoad, pixelShift));
            },
            setItems(forceFocus, viewportShift) {
                listRebuilds++;
                this.loadedRowCount = this.getViewportRowsToLoad(viewportShift, this.offset);
            }
        },
        scrollbar: {setCursor() {}}
    };
    var g_playlist_scroll_frame = newFrame();
    var g_playlist_scrollbar_drag_frame = null;
    var g_playlist_scroll_frame_in_tick = false;
    function smooth_scroll_tick() { smoothTicks++; need_repaint = true; cList.scroll_timer = false; }
    function free_wheel_scroll_tick() { freeTicks++; need_repaint = true; cList.free_scroll_timer = false; }
    function start_repaint_timer() { repaintRestarts++; }
    /*__PLAYLIST_RATE_FUNCTIONS__*/
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

    // A fractional top offset can expose a second partial row at the bottom.
    // Expand the demand-loaded row set only when that extra row intersects.
    assert(get_playlist_viewport_row_load_count(205, 20, 11, 0) === 11,
        'JS Playlist aligned viewport requested an unnecessary second overflow row');
    assert(get_playlist_viewport_row_load_count(205, 20, 11, 15) === 11,
        'JS Playlist boundary-aligned fractional viewport over-allocated rows');
    assert(get_playlist_viewport_row_load_count(205, 20, 11, 16) === 12,
        'JS Playlist fractional viewport did not request the second intersecting bottom row');
    assert(get_playlist_viewport_row_load_count(200, 20, 11, 19) === 11,
        'JS Playlist exact-row-height viewport unnecessarily expanded its row set');

    p.list.offset = 10;
    p.list.loadedRowCount = 11;
    cList.free_scroll_position = 200;
    cList.free_scroll_offset = 0;
    cList.free_scroll_active = false;
    const rebuildsBeforeViewportExpansion = listRebuilds;
    apply_free_wheel_position(216, true, true);
    assert(p.list.offset === 10 && p.list.loadedRowCount === 12 &&
        listRebuilds === rebuildsBeforeViewportExpansion + 1,
        'JS Playlist did not expand the loaded row set when fractional scrolling exposed another bottom row');

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
    Date.now = function () { return fakeNow; };
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

    function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
    var ppt = {refreshRate: 8};
    var scroll = 100;
    var scroll_ = 0;
    var need_repaint = false;
    cScrollBar = {timerID: false, repaint_timeout: false};
    var timers = {movePlaylist: false};
    let managerReschedules = 0;
    let managerRequests = 0;
    var g_playlist_manager_frame = {
        reschedule() { managerReschedules++; },
        request() { managerRequests++; }
    };
    savedProperties = [];
    /*__MANAGER_RATE_FUNCTIONS__*/
    assert(set_playlist_manager_refresh_rate(16) === true, 'Playlist Manager rate setter did not report a change');
    assert(ppt.refreshRate === 16, 'Playlist Manager live rate was not updated');
    assert(savedProperties.length === 1 && savedProperties[0][0] === 'SMOOTH.UI.REFRESH.INTERVAL.MS' && savedProperties[0][1] === 16,
        'Playlist Manager rate was not persisted');
    assert(managerReschedules === 1 && managerRequests === 1,
        'Playlist Manager active frame loop was not rescheduled and requested');
    assert(set_playlist_manager_refresh_rate(16) === false, 'Playlist Manager unchanged rate was not ignored');
});

suite("JS Playlist render cache", function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path("user-components-x64/foo_jscript_panel3/samples/jsplaylist/render_cache.js"), 'utf8');
    let evaluations = 0;
    let evaluatedPatterns = [];
    function get_tfo(pattern) {
        return {EvalActivePlaylistItem: function(index) {
            evaluations++;
            evaluatedPatterns.push(pattern);
            return pattern + ':' + index;
        }};
    }
    const Cache = new Function('get_tfo', source + '\nreturn DarkOnePlaylistRenderCache;')(get_tfo);
    function assert(condition, message) { if (!condition) throw new Error(message); }
    let nowMs = 1000000;
    const cache = new Cache({enabled: true, maxEntries: 64, now() { return nowMs; }});
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
    const changedHandle = {id: 5};
    const activeHandles = {GetItem(index) { return {id: index}; }};
    const changedHandles = {Find(handle) { return handle.id === changedHandle.id ? 0 : -1; }};
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
    const frameCache = new Cache({enabled: true, maxEntries: 128, now() { return 2000000; }});
    frameCache.configure('%title%^^%isplaying%', '%artist%', true);
    for (let frame = 0; frame < 120; frame++) {
        const generation = Math.floor(frame / 60);
        for (let row = 0; row < 40; row++) frameCache.getConfigured(row, row === 7, generation);
    }
    const frameStats = frameCache.stats();
    assert(evaluations < 300 && frameStats.hits > 4000 && frameStats.dynamicEvaluations === 2 &&
        frameStats.dynamicHits >= 118,
        'Visible-row cache did not substantially reduce repeated title-format evaluation');
});

suite("Display direct rendering", function () {
    const fs = require('fs');
    const colourSource = fs.readFileSync(__path("DarkOneJSP3/shared/colour_utils.js"), 'utf8');
    const source = fs.readFileSync(__path("DarkOneJSP3/jscript/js/Object_DisplaySystem.js"), 'utf8');
    const properties = new Map();
    let repaints = 0;
    let repaintRects = 0;
    let fontCreations = 0;
    let bitmapConversions = 0;
    let mutableImageCreations = 0;
    let matrixDraws = 0;
    const drawnLabels = [];
    function makeImage(width, height) {
        return {
            Width: width, Height: height, Path: 'mock.png',
            GetGraphics() { return { DrawImage() {}, FillRectangle() {}, DrawImageWithMask() {} }; },
            ReleaseGraphics() {}, ApplyEffect() {}, Dispose() {}
        };
    }
    const windowMock = {
        GetProperty(name, fallback) { return properties.has(name) ? properties.get(name) : fallback; },
        SetProperty(name, value) { properties.set(name, value); },
        GetColourCUI(index) { return index === 4 ? 0xff556677 : 0xff112233; },
        Repaint() { repaints++; }, RepaintRect() { repaintRects++; }, NotifyOthers() {},
        SetTimeout(fn) { return 1; }, ClearTimeout() {}
    };
    const fbMock = {
        IsPlaying: false, IsPaused: false, PlaybackLength: 0, PlaybackTime: 0,
        Volume: -12.5, StopAfterCurrent: false,
        TitleFormat() { return { Eval() { return ''; } }; }
    };
    const performanceMock = {
        toBitmap(image) { if (!image) return null; bitmapConversions++; return {Width:image.Width,Height:image.Height,Dispose(){}}; },
        createRepaintScheduler() { return {request(){},reschedule(){},cancel(){}}; },
        createTrailingDeadline() { return {touch(){},cancel(){}}; }
    };
    const cadenceMock = { createVolumeFollower() { return {getInterval(){return 16;},dispose(){}}; } };
    const factory = new Function(
        'window','fb','plman','safeGdiImage','utils','disposeImage','combColours','p_backcol','ui_btntxtcol',
        'DarkOneUiCadence','DarkOnePerformance','DarkOneColour','imgPath','console',
        'DWRITE_FONT_WEIGHT_BLACK','DWRITE_FONT_WEIGHT_NORMAL','darkOneCreateFont','darkOneCalcTextWidth','darkOneDrawText',
        'TimeFmt','pad','pad_right','ww','wh',
        colourSource + '\n' + source + '\nreturn {display_system, DisplaySystem, DARKONE_DISPLAY_ACCENT_DEFAULT, DARKONE_DISPLAY_ACCENT_CUSTOM, DARKONE_DISPLAY_ACCENT_COLUMNS_UI_SELECTED};'
    );
    const api = factory(
        windowMock, fbMock, {PlaybackOrder:0}, () => makeImage(1500, 400),
        {CreateImage(width,height){mutableImageCreations++;return makeImage(width,height);}},
        image => {if(image&&image.Dispose)image.Dispose();}, () => 0xff010101, 0xff202020, 0xffffffff,
        cadenceMock, performanceMock,
        {normaliseMode(mode,allowed,fallback){return allowed.indexOf(Number(mode))>=0?Number(mode):fallback;},columnsUi(){return 0xff556677;}},
        '', console, 900, 400,
        (name,size,style,weight) => {fontCreations++;return {Name:name,Size:size,Weight:weight,Height:size};},
        (text,font) => String(text).length * (font ? font.Size : 1),
        (gr,text,font,colour,x,y,w,h,flags) => drawnLabels.push({text:String(text),colour:colour >>> 0}),
        value => String(value), (value,length) => String(value).padStart(length,' '),
        (value,length) => String(value).padEnd(length,' '), () => {}, 400, 80
    );
    const display = api.display_system;
    if (display.accent_mode !== 0 || (display.active_colour >>> 0) !== 0xff298fcc)
        throw new Error('Default display accent changed');
    display.setAccent(1, 0xff123456);
    if (display.accent_mode !== 1 || (display.active_colour >>> 0) !== 0xff123456)
        throw new Error('Legacy custom display accent no longer works');
    display.setAccent(2);
    if (display.accent_mode !== 2 || (display.active_colour >>> 0) !== 0xff556677)
        throw new Error('Display accent does not follow Columns UI selected-item background');

    display.initPos();
    const fontsAfterFirstLayout = fontCreations;
    display.initPos();
    if (fontCreations !== fontsAfterFirstLayout)
        throw new Error('Unchanged display layout recreated fonts');

    let initialised = 0;
    display.init = function() { initialised++; };
    const repaintBeforeStyle = repaints;
    if (display.setDisplayStyle(1) !== true || display.display_style !== 1 || properties.get('Display Style') !== 1)
        throw new Error('Dot Matrix display style was not activated and persisted');
    if (initialised !== 1 || repaints !== repaintBeforeStyle + 1)
        throw new Error('Display style change did not initialise and repaint exactly once');
    if (display.setDisplayStyle(1) !== false || initialised !== 1 || repaints !== repaintBeforeStyle + 1)
        throw new Error('Redundant display style selection performed unnecessary work');

    display.pxSize = 1;
    display.img_y = 0;
    display.img_h = 20;
    const graph = {DrawBitmap(){matrixDraws++;},DrawRectangle(){}};
    const imagesBeforeDraw = mutableImageCreations;
    const conversionsBeforeDraw = bitmapConversions;
    display.drawTrackNumberMatrix(graph, '0012', 0);
    display.drawTimeMatrix(graph, '01:23:45', 0);
    display.drawBitrateMatrix(graph, '320  ', 0);
    if (matrixDraws !== 4 + 8 + 3)
        throw new Error('Direct Dot Matrix sprite draw count changed: ' + matrixDraws);
    if (mutableImageCreations !== imagesBeforeDraw || bitmapConversions !== conversionsBeforeDraw)
        throw new Error('Dot Matrix value painting rebuilt mutable images or bitmaps');

    function labelColour(label) {
        const match = drawnLabels.find(item => item.text === label);
        if (!match) throw new Error('Display label was not drawn: ' + label);
        return match.colour;
    }

    // A volume change may temporarily replace the numeric readout, but while
    // playback is stopped it must not activate TIME or TIME REMAINING.
    fbMock.IsPlaying = false;
    display.setColours();
    display.VolumeChange(fbMock.Volume);
    drawnLabels.length = 0;
    display.draw(graph);
    if (labelColour('TIME') !== (display.inactive_colour >>> 0))
        throw new Error('Stopped volume change activated TIME');
    if (labelColour('VOLUME') !== (0xffffffff >>> 0))
        throw new Error('Stopped volume change did not activate VOLUME');

    display.NotifyData('remTime', true);
    drawnLabels.length = 0;
    display.draw(graph);
    if (labelColour('TIME REMAINING') !== (display.inactive_colour >>> 0))
        throw new Error('Stopped volume change activated TIME REMAINING');
    if (labelColour('VOLUME') !== (0xffffffff >>> 0))
        throw new Error('Stopped remaining-time volume change did not activate VOLUME');

    // During playback the normal time label remains active while VOLUME is
    // temporarily active, preserving the established playing-state behaviour.
    fbMock.IsPlaying = true;
    display.setColours();
    display.NotifyData('remTime', false);
    drawnLabels.length = 0;
    display.draw(graph);
    if (labelColour('TIME') !== (0xffffffff >>> 0) ||
        labelColour('VOLUME') !== (0xffffffff >>> 0))
        throw new Error('Playing volume label state changed unexpectedly');
});

suite("page background modes", function () {
    const fs = require('fs');
    const colourSource = fs.readFileSync(__path("user-components-x64/foo_jscript_panel3/samples/shared/colour_utils.js"), 'utf8');
    const source = fs.readFileSync(__path("user-components-x64/foo_jscript_panel3/samples/js/panel.js"), 'utf8');
    function property(name, fallback) { this.name = name; this.value = fallback; }
    const windowMock = {
        IsDefaultUI: false,
        Width: 640,
        Height: 480,
        GetColourCUI(index) { return index === 3 ? 0xff445566 : 0xffffffff; },
        GetColourDUI() { return 0xff000000; },
        GetFontCUI() { return JSON.stringify({Name: 'Segoe UI'}); },
        GetFontDUI() { return JSON.stringify({Name: 'Segoe UI'}); },
        Repaint() {},
        CreatePopupMenu() { throw new Error('Menu should not be opened by colour smoke test'); }
    };
    const underscore = { invoke() {}, forEach() {}, first(a) { return a[0]; }, last(a) { return a[a.length - 1]; } };
    const factory = new Function(
        'window', 'fb', '_p', '_scale', '_', 'RGB', 'blendColours',
        colourSource + '\n' + source + '\nreturn _panel;'
    );
    const Panel = factory(
        windowMock,
        { GetFocusItem() { return null; } },
        property,
        value => value,
        underscore,
        (r, g, b) => 0xff000000 + (r << 16) + (g << 8) + b,
        () => 0xff888888
    );
    const panel = new Panel({ enhanced_page_background: true });
    if ((panel.page_background_colour() >>> 0) !== 0xff181818)
        throw new Error('Default information-page background is not DarkOne dark grey');
    panel.page_background.custom.value = 0xff123456;
    panel.page_background.mode.value = 4;
    if ((panel.page_background_colour() >>> 0) !== 0xff123456)
        throw new Error('Information-page custom mode no longer works');
    panel.page_background.mode.value = 5;
    if ((panel.page_background_colour() >>> 0) !== 0xff445566)
        throw new Error('Information page does not follow the Columns UI global background');
});

suite("generic panel menu dispatch", function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path("user-components-x64/foo_jscript_panel3/samples/js/panel.js"), 'utf8');
    function property(name, fallback) { this.name = name; this.value = fallback; }
    function menuFactory() {
        return {
            AppendMenuItem() {}, AppendMenuSeparator() {}, CheckMenuRadioItem() {},
            AppendTo() {}, Dispose() {}, TrackPopupMenu() { return 1001; }
        };
    }
    const windowMock = {
        IsDefaultUI: false, Width: 640, Height: 480, IsDark: true,
        GetColourCUI() { return 0xff202020; }, GetColourDUI() { return 0xff202020; },
        GetFontCUI() { return JSON.stringify({Name: 'Segoe UI'}); },
        GetFontDUI() { return JSON.stringify({Name: 'Segoe UI'}); },
        CreatePopupMenu: menuFactory, Repaint() {}, ShowConfigure() {},
    };
    const underscore = { invoke() {}, forEach() {}, first(a) { return a[0]; }, last(a) { return a[a.length - 1]; } };
    const factory = new Function(
        'window', 'fb', '_p', '_scale', '_', 'RGB', 'blendColours', 'MF_STRING',
        source + '\nreturn _panel;'
    );
    const Panel = factory(
        windowMock, { GetFocusItem() { return null; } }, property, value => value,
        underscore, (r, g, b) => 0xff000000 + (r << 16) + (g << 8) + b,
        () => 0xff888888, 0
    );
    const panel = new Panel();
    let dispatched = 0;
    const object = { rbtn_up() {}, rbtn_up_done(id) { if (id === 1001) dispatched++; } };
    panel.rbtn_up(0, 0, object);
    if (dispatched !== 1) throw new Error('Generic object menu command was not dispatched');
});

suite("bottom-area cross-host state", function () {
    const fs = require('fs');
    const colourSource = fs.readFileSync(__path("DarkOneJSP3/shared/colour_utils.js"), 'utf8');
    const protocolSource = fs.readFileSync(__path("DarkOneJSP3/shared/jsplitter_protocols.js"), 'utf8');
    const resetSource = fs.readFileSync(__path("DarkOneJSP3/shared/reset_defaults.js"), 'utf8');
    const viewBridgeSource = fs.readFileSync(__path("DarkOneJSP3/shared/view_bridge.js"), 'utf8');
    const hostSource = fs.readFileSync(__path("DarkOneJSP3/jsplitter/05_bottom_controls.js"), 'utf8');
    const configSource = fs.readFileSync(__path("DarkOneJSP3/jscript/js/Config_Global_Script.js"), 'utf8');
    const bottomStart = configSource.indexOf('// Shared bottom-area appearance.');
    const bottomEnd = configSource.indexOf('function repeat(', bottomStart);
    if (bottomStart < 0 || bottomEnd < 0) throw new Error('JScript bottom-area compatibility block is missing');
    const bottomSource = configSource.slice(bottomStart, bottomEnd);
    function extractFunction(source, name) {
        const marker = 'function ' + name + '(';
        const start = source.indexOf(marker);
        if (start < 0) throw new Error('Missing function: ' + name);
        const brace = source.indexOf('{', start);
        let depth = 0;
        let quote = null;
        let escaped = false;
        let lineComment = false;
        let blockComment = false;
        for (let i = brace; i < source.length; i++) {
            const ch = source[i];
            const next = source[i + 1];
            if (quote) {
                if (escaped) escaped = false;
                else if (ch === '\\') escaped = true;
                else if (ch === quote) quote = null;
                continue;
            }
            if (lineComment) {
                if (ch === '\n') lineComment = false;
                continue;
            }
            if (blockComment) {
                if (ch === '*' && next === '/') { blockComment = false; i++; }
                continue;
            }
            if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
            if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
            if (ch === '"' || ch === "'") { quote = ch; continue; }
            if (ch === '{') depth++;
            else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
        }
        throw new Error('Unterminated function: ' + name);
    }
    const toolsMenuSource = extractFunction(configSource, 'darkOneToolsMenu');
    const toolsSupportStart = configSource.indexOf('var DARKONE_TOOLS_STARTUP_IDS');
    const toolsMenuStart = configSource.indexOf('function darkOneToolsMenu(x, y)');
    if (toolsSupportStart < 0 || toolsMenuStart <= toolsSupportStart)
        throw new Error('DarkOne Tools Startup support block is missing');
    const toolsSupportSource = configSource.slice(toolsSupportStart, toolsMenuStart);
    const weightMenuSource = extractFunction(configSource, 'darkOneAppendWeightMenu');
    const settingCategorySource = extractFunction(configSource, 'darkOneSettingCategory');
    const settingsResultSource = extractFunction(configSource, 'darkOneSettingsResult');
    const applySharedValuesSource = extractFunction(configSource, 'darkOneApplySharedValues');
    const handleNotifySource = extractFunction(configSource, 'darkOneHandleNotify');

    const files = Object.create(null);
    const NEW_STATE = 'P:\\js_data\\darkonejsp3.bottom-area-state.txt';
    const COMMIT_COMMAND = 'P:\\js_data\\darkonejsp3.bottom-area-command.txt';
    const GEOMETRY_STATE = 'P:\\js_data\\darkonejsp3.bottom-area-geometry.txt';
    const LEGACY_STATE = 'P:\\DarkOneJSP3\\shared\\bottom-area-state.txt';
    const RESET_COMMAND = 'P:\\js_data\\darkonejsp3.reset-command.txt';
    let failWrites = 0;
    let failWritePath = '';
    let bottomPickerCalls = 0;
    let bottomPickerResult = (0xff556677 | 0);
    let bottomPickerError = null;
    const logs = [];
    const readCounts = Object.create(null);
    const isFileCounts = Object.create(null);
    function fileUtils() {
        return {
            CreateFolder() { return true; },
            IsFile(path) {
                isFileCounts[path] = (isFileCounts[path] || 0) + 1;
                return Object.prototype.hasOwnProperty.call(files, path);
            },
            ReadTextFile(path) {
                readCounts[path] = (readCounts[path] || 0) + 1;
                if (!Object.prototype.hasOwnProperty.call(files, path)) throw new Error('missing');
                return files[path];
            },
            WriteTextFile(path, content) {
                if (arguments.length !== 2)
                    throw new Error('Runtime persistence must use the canonical two-argument WriteTextFile call');
                if (failWrites > 0 && (!failWritePath || path === failWritePath)) { failWrites--; return false; }
                files[path] = String(content);
                return true;
            },
            RemovePath(path) { delete files[path]; return true; },
            ColourPicker() {
                const args = [...arguments];
                const nativeColour = Number(args[args.length - 1]);
                if (!Number.isInteger(nativeColour) || nativeColour < -2147483648 || nativeColour > 2147483647)
                    throw new Error('Overflow');
                bottomPickerCalls++;
                if (bottomPickerError) throw bottomPickerError;
                return bottomPickerResult === '__DEFAULT__' ? nativeColour : bottomPickerResult;
            },
            MessageBox() { return 1; }
        };
    }

    function makePanel(initialProperties, panelRole) {
        panelRole = panelRole || 'control-left';
        const properties = new Map(Object.entries(initialProperties || {}));
        const notifications = [];
        const timers = [];
        let repaints = 0;
        let intervalCalls = 0;
        let appearanceApplications = 0;
        let jsonStringifyCalls = 0;
        let popupCommand = 0;
        let popupMenus = [];
        let popupCreateCalls = 0;
        let failPopupCreateAt = 0;
        let failPopupAppendAt = 0;
        function createPopupMenu() {
            popupCreateCalls++;
            if (failPopupCreateAt && popupCreateCalls === failPopupCreateAt)
                throw new Error('simulated DarkOne Tools construction failure');
            const popupNumber = popupCreateCalls;
            const menu = {
                disposed: 0,
                items: [],
                children: [],
                entries: [],
                AppendMenuItem(flags, id, label) {
                    if (failPopupAppendAt === popupNumber)
                        throw new Error('simulated native popup append failure');
                    this.items.push([flags, id, label]);
                    this.entries.push('item:' + label);
                },
                AppendMenuSeparator() { this.entries.push('separator'); },
                CheckMenuRadioItem(minimum, maximum, selected) { this.radio = [minimum, maximum, selected]; },
                CheckMenuItem(id, checked) { if (checked) this.checked = id; },
                AppendTo(parent, flags, label) {
                    parent.children.push([this, label]);
                    parent.entries.push('child:' + label);
                },
                TrackPopupMenu() { return popupCommand; },
                Dispose() { this.disposed++; }
            };
            popupMenus.push(menu);
            return menu;
        }
        const windowMock = {
            GetProperty(name, fallback) { return properties.has(name) ? properties.get(name) : fallback; },
            SetProperty(name, value) { properties.set(name, value); },
            NotifyOthers(name, data) { notifications.push([name, data]); },
            Repaint() { repaints++; },
            SetInterval() { intervalCalls++; throw new Error('JScript panels must not poll the runtime file'); },
            ClearInterval() {},
            SetTimeout(fn, delay) { timers.push([fn, delay]); return timers.length; },
            ClearTimeout(id) { if (id > 0 && id <= timers.length) timers[id - 1] = null; },
            CreatePopupMenu: createPopupMenu,
            Reload() {}, ShowProperties() {}, ShowConfigure() {}
        };
        function applyValues(values) {
            const names = [];
            Object.keys(values).forEach(name => { windowMock.SetProperty(name, values[name]); names.push(name); });
            return { handled: true, all: false, names, categories: { bottom: true } };
        }
        const factory = new Function(
            'window', 'fb', 'utils', 'MF_STRING', 'MF_GRAYED', 'MB_OK', 'MB_ICONEXCLAMATION',
            'ui_backcol', 'p_backcol', 'ww', 'wh', 'console', 'darkOneApplySharedValues',
            'buttonsColours', 'display_system', 'panelRole', 'JSON',
            'var DARKONEJSP3_RESET_ROLE=panelRole;\n' +
            resetSource + '\n' + viewBridgeSource + '\n' + bottomSource + '\n' +
            'function darkOneButtonRoundness(){return Number(window.GetProperty("DARKONEJSP3.BUTTON.ROUNDNESS",-1));}\n' +
            'function darkOneSetSharedProperty(name,value){window.SetProperty(name,value);window.NotifyOthers("DarkOneJSP3.Settings.Batch",JSON.stringify({values:{[name]:value}}));}\n' +
            'function darkOneSetButtonRoundness(value){darkOneSetSharedProperty("DARKONEJSP3.BUTTON.ROUNDNESS",value);return true;}\n' +
            'function darkOneInputButtonRoundness(){return false;}\n' +
            'function buttonsOptions(){} function buttonsSizes(){} function buttonsRefresh(){}\n' +
            'function darkOneControlFontName(){return "Segoe UI";}\n' +
            'function darkOneControlFontWeight(){return 400;}\n' +
            'function darkOneDisplayLabelFontName(){return "Segoe UI";}\n' +
            'function darkOneDisplayLabelFontWeight(){return 400;}\n' +
            'function darkOneDisplayValueFontName(){return "Segoe UI";}\n' +
            'function darkOneDisplayValueFontWeight(){return 400;}\n' +
            'var DWRITE_FONT_WEIGHT_NORMAL=400,DWRITE_FONT_WEIGHT_MEDIUM=500,DWRITE_FONT_WEIGHT_SEMI_BOLD=600,DWRITE_FONT_WEIGHT_BOLD=700,DWRITE_FONT_WEIGHT_BLACK=900;\n' +
            settingCategorySource + '\n' + settingsResultSource + '\n' +
            applySharedValuesSource + '\n' + handleNotifySource + '\n' +
            weightMenuSource + '\n' + toolsSupportSource + '\n' + toolsMenuSource +
            '\nreturn {state:darkOneBottomAreaState,serialise:darkOneBottomAreaSerialiseState,parse:darkOneBottomAreaParseState,parseCommit:darkOneBottomAreaParseCommit,apply:darkOneApplyBottomAreaState,scheduleCommit:darkOneScheduleBottomAreaCommit,backgroundColour:darkOneBottomBackgroundColour,paint:darkOnePaintBottomAreaBackground,send:darkOneSendBottomAreaState,readFile:darkOneReadBottomAreaStateFile,request:darkOneRequestBottomAreaState,dispose:darkOneDisposeBottomAreaBridge,writeReset:darkOneWriteResetCommand,handleMenu:darkOneHandleBottomAreaMenuSelection,handleNotify:darkOneHandleNotify,toolsMenu:darkOneToolsMenu,viewBridge:DarkOneViewBridge};'
        );
        const api = factory(
            windowMock,
            { ProfilePath: 'P:\\' },
            fileUtils(),
            0, 1, 0, 0,
            0xff445566,
            0xff202020,
            320,
            120,
            { log(message) { logs.push(String(message)); } },
            applyValues,
            function() { appearanceApplications++; },
            {
                InitColours() { appearanceApplications++; },
                setColours() { appearanceApplications++; }
            },
            panelRole,
            {
                parse: JSON.parse,
                stringify(value) {
                    jsonStringifyCalls++;
                    return JSON.stringify(value);
                }
            }
        );
        return {
            api,
            properties,
            notifications,
            runTimers() {
                const pending = timers.splice(0, timers.length);
                pending.forEach(item => { if (item) item[0](); });
            },
            get repaints() { return repaints; },
            get intervalCalls() { return intervalCalls; },
            setPopupCommand(value) {
                popupCommand = value;
                popupMenus = [];
                popupCreateCalls = 0;
                failPopupCreateAt = 0;
                failPopupAppendAt = 0;
            },
            failPopupConstructionAt(value) {
                popupMenus = [];
                popupCreateCalls = 0;
                failPopupCreateAt = value;
            },
            failPopupAppendAt(value) {
                popupMenus = [];
                popupCreateCalls = 0;
                failPopupCreateAt = 0;
                failPopupAppendAt = value;
            },
            get popupMenus() { return popupMenus; },
            get appearanceApplications() { return appearanceApplications; },
            get jsonStringifyCalls() { return jsonStringifyCalls; }
        };
    }

    files[GEOMETRY_STATE] = 'v1|300|27';

    // Legacy state is migrated out of DarkOneJSP3/shared into js_data.
    files[LEGACY_STATE] = 'v1|1|4278190080|4|4278190080';
    const migratingPanel = makePanel();
    migratingPanel.api.request();
    if (migratingPanel.intervalCalls !== 0)
        throw new Error('JScript panel started a continuous state-file poller');
    if (files[NEW_STATE] !== 'v5|v1-migration|1|4278190080|0|4|4278190080|1|0')
        throw new Error('Legacy bottom-area state was not migrated into js_data');
    if (migratingPanel.api.parse('v2|2|4279383126|1|4|4284826401') !== null ||
            migratingPanel.api.parse('v3|2|4279383126|1|4|4284826401|0') !== null ||
            migratingPanel.api.parse('v4|2|4279383126|1|4|4284826401|0|0') !== null)
        throw new Error('JScript parser accepted an unpublished bottom-area state');
    const legacyCommitNow = Date.now();
    if (migratingPanel.api.parseCommit(
            'v1|legacy|' + legacyCommitNow + '|' + legacyCommitNow +
                '|2|4279383126|4|4284826401',
            legacyCommitNow) !== null || migratingPanel.api.parseCommit(
            'v2|legacy|' + legacyCommitNow + '|' + legacyCommitNow +
                '|2|4279383126|1|4|4284826401',
            legacyCommitNow) !== null || migratingPanel.api.parseCommit(
            'v3|legacy|' + legacyCommitNow + '|' + legacyCommitNow +
                '|2|4279383126|1|4|4284826401|0',
            legacyCommitNow) !== null || migratingPanel.api.parseCommit(
            'v4|legacy|' + legacyCommitNow + '|' + legacyCommitNow +
                '|2|4279383126|1|4|4284826401|0|0',
            legacyCommitNow) !== null)
        throw new Error('JScript parser accepted an obsolete transient bottom-area commit');
    delete files[LEGACY_STATE];

    // A saved mode must be resolved before the first paint even when the panel's
    // persisted properties already match the state file. Repeated on_size-style
    // initialisation requests must not reread the file or query peers again.
    files[NEW_STATE] = 'v1|1|4278190080|4|4278190080';
    const firstPaintPanel = makePanel({
        'DARKONEJSP3.BOTTOM.BACKGROUND.MODE': 1,
        'DARKONEJSP3.BOTTOM.BACKGROUND.CUSTOM.COLOUR': 0xff000000,
        'DARKONEJSP3.BOTTOM.DIVIDER.MODE': 4,
        'DARKONEJSP3.BOTTOM.DIVIDER.CUSTOM.COLOUR': 0xff000000
    });
    const readsBeforeFirstInit = readCounts[NEW_STATE] || 0;
    if (!firstPaintPanel.api.request())
        throw new Error('First bottom-area initialisation request was rejected');
    const firstPaintFills = [];
    firstPaintPanel.api.paint({ FillRectangle(x,y,w,h,colour) { firstPaintFills.push(colour >>> 0); } });
    if (firstPaintFills.length !== 1 || firstPaintFills[0] !== 0xff000000)
        throw new Error('Saved Black background was not applied before the first JScript paint');
    if (firstPaintPanel.appearanceApplications !== 3 || firstPaintPanel.repaints !== 1)
        throw new Error('First bottom-area initialisation did not resolve appearance exactly once');
    const firstQueryCount = firstPaintPanel.notifications.filter(
        item => item[0] === 'DarkOneJSP3.BottomArea.Query').length;
    firstPaintPanel.api.request();
    firstPaintPanel.api.request();
    if ((readCounts[NEW_STATE] || 0) !== readsBeforeFirstInit + 1)
        throw new Error('Repeated panel resize requests reread the bottom-area state file');
    if (firstPaintPanel.notifications.filter(
            item => item[0] === 'DarkOneJSP3.BottomArea.Query').length !== firstQueryCount)
        throw new Error('Repeated panel resize requests queried peers again');

    const panelA = makePanel();
    const panelB = makePanel();
    const missingDepthPropertyPanel = makePanel({
        'DARKONEJSP3.BOTTOM.BACKGROUND.LINEAR.GRADIENT': true
    });
    if (missingDepthPropertyPanel.api.state().depthMode !== 0)
        throw new Error('Missing bottom-area depth did not recover to Flat');
    panelA.api.request();
    panelB.api.request();
    if (panelA.intervalCalls || panelB.intervalCalls)
        throw new Error('JScript panels retain redundant continuous file pollers');

    // Exercise the real DarkOne Tools hierarchy and command dispatcher. Each
    // native popup must be disposed exactly once for selection, cancellation
    // and picker failure, while state changes only for a valid new colour.
    function assertMenusDisposedOnce(panel, label) {
        if (panel.popupMenus.length !== 21 || panel.popupMenus.some(menu => menu.disposed !== 1))
            throw new Error(label + ' did not dispose every DarkOne Tools popup exactly once');
    }

    bottomPickerCalls = 0;
    bottomPickerError = null;
    bottomPickerResult = (0xff556677 | 0);
    const pickerPanel = makePanel();
    pickerPanel.api.request();
    pickerPanel.setPopupCommand(9834);
    if (!pickerPanel.api.toolsMenu(10, 20) ||
            pickerPanel.properties.get('Buttons appearance preset') !== 4)
        throw new Error('DarkOne Tools did not apply shared Button style');
    if (pickerPanel.popupMenus[0].children.slice(0, 2).map(item => item[1]).join(',') !==
            'Appearance,Buttons' ||
            pickerPanel.popupMenus[1].children.map(item => item[1]).join(',') !==
            'Bottom area background,Bottom area side divider colour,Bottom area depth' ||
            pickerPanel.popupMenus[1].items.map(item => item[2]).join(',') !==
            'Background linear gradient,Bottom side dividers' ||
            pickerPanel.popupMenus[1].entries.join(',') !==
            'child:Bottom area background,child:Bottom area side divider colour,child:Bottom area depth,item:Background linear gradient,separator,item:Bottom side dividers' ||
            pickerPanel.popupMenus[1].checked !== 9828 ||
            pickerPanel.popupMenus[8].items.map(item => item[2]).join(',') !==
            'Flat,Soft' || pickerPanel.popupMenus[8].radio.join(',') !== '9829,9830,9829' ||
            pickerPanel.popupMenus[2].children.map(item => item[1]).join(',') !==
            'Button style,Button depth,Button roundness')
        throw new Error('DarkOne Tools top-level Buttons hierarchy changed');
    if (pickerPanel.popupMenus[0].children.map(item => item[1]).join(',') !==
            'Appearance,Buttons,Fonts,High-DPI / scaling,Startup,Reset DarkOneJSP3,Utilities')
        throw new Error('DarkOne Tools top-level hierarchy/order changed');
    if (pickerPanel.popupMenus[17].items.map(item => item[2]).join(',') !==
            'Renderer: Direct2D + DirectWrite (JSP3),Open DarkOneJSP3 folder,Open JScript Panel js_data cache,Open JScript Panel 3 component folder,Panel properties,Configure script...,Reload this panel')
        throw new Error('DarkOne Tools Utilities grouping changed');
    const styleLabels = pickerPanel.popupMenus[3].items.map(item => item[2]).join(',');
    if (styleLabels !== 'Standard,Thick,Round,Round (Alt),Round (Alt + Narrow)')
        throw new Error('DarkOne Tools descriptive Button style labels changed');
    const commandIds = pickerPanel.popupMenus.flatMap(menu =>
        menu.items.map(item => item[1]).filter(id => id > 0));
    if (new Set(commandIds).size !== commandIds.length)
        throw new Error('DarkOne Tools contains a duplicate command id');
    const styleBatch = pickerPanel.notifications.filter(
        item => item[0] === 'DarkOneJSP3.Settings.Batch').pop();
    if (!styleBatch || JSON.parse(styleBatch[1]).values['Buttons appearance preset'] !== 4)
        throw new Error('Button style did not publish the shared settings batch');
    const stylePeer = makePanel();
    const stylePeerChange = stylePeer.api.handleNotify(styleBatch[0], styleBatch[1]);
    if (stylePeer.properties.get('Buttons appearance preset') !== 4 ||
            !stylePeerChange || !stylePeerChange.categories.controls)
        throw new Error('Peer control panel did not apply/classify shared Button style');
    assertMenusDisposedOnce(pickerPanel, 'Button style selection');

    pickerPanel.api.handleMenu(9802);
    pickerPanel.runTimers();
    pickerPanel.setPopupCommand(9827);
    if (!pickerPanel.api.toolsMenu(10, 20) ||
            pickerPanel.api.state().backgroundLinearGradient !== true)
        throw new Error('DarkOne Tools did not enable Background linear gradient');
    pickerPanel.runTimers();
    const gradientFills = [];
    pickerPanel.api.paint({
        FillRectangle(x, y, w, h, colour) { gradientFills.push([x, y, w, h, colour]); }
    });
    const gradientBrush = gradientFills.length ? JSON.parse(gradientFills[0][4]) : null;
    if (gradientFills.length !== 1 || !gradientBrush ||
            (gradientBrush.Stops[0][1] >>> 0) !== 0xff202020 ||
            (gradientBrush.Stops[1][1] >>> 0) !== 0xff1c1c1c)
        throw new Error('Flat depth painted a highlight over the continuous gradient');

    pickerPanel.setPopupCommand(9830);
    if (!pickerPanel.api.toolsMenu(10, 20) ||
            pickerPanel.api.state().depthMode !== 1)
        throw new Error('DarkOne Tools did not select Soft Bottom area depth');
    pickerPanel.runTimers();
    gradientFills.length = 0;
    pickerPanel.api.paint({
        FillRectangle(x, y, w, h, colour) { gradientFills.push([x, y, w, h, colour]); }
    });
    if (gradientFills.length !== 4 || gradientFills[1][1] !== 0 ||
            gradientFills[1][3] !== 1 ||
            (gradientFills[1][4] >>> 0) !== 0xff000000 ||
            gradientFills[2][1] !== 1 || gradientFills[2][3] !== 1 ||
            (gradientFills[2][4] >>> 0) !== 0xff0f0f0f ||
            gradientFills[3][1] !== 2 || gradientFills[3][3] !== 2 ||
            (gradientFills[3][4] >>> 0) !== 0xff262626)
        throw new Error('Soft depth did not paint its exact four-row edge');

    pickerPanel.api.handleMenu(9827);
    pickerPanel.runTimers();
    gradientFills.length = 0;
    pickerPanel.api.paint({
        FillRectangle(x, y, w, h, colour) { gradientFills.push([x, y, w, h, colour]); }
    });
    if (gradientFills.length !== 4 || (gradientFills[0][4] >>> 0) !== 0xff202020 ||
            (gradientFills[1][4] >>> 0) !== 0xff000000 ||
            (gradientFills[2][4] >>> 0) !== 0xff0f0f0f ||
            gradientFills[3][1] !== 2 || gradientFills[3][3] !== 2 ||
            (gradientFills[3][4] >>> 0) !== 0xff262626)
        throw new Error('Soft depth remained incorrectly coupled to the gradient toggle');
    pickerPanel.api.handleMenu(9827);
    pickerPanel.runTimers();
    const displayGradientPanel = makePanel({}, 'display');
    displayGradientPanel.api.request();
    const displayGradientFills = [];
    displayGradientPanel.api.paint({
        FillRectangle(x, y, w, h, colour) {
            displayGradientFills.push([x, y, w, h, colour]);
        }
    });
    const displayGradientBrush = displayGradientFills.length
        ? JSON.parse(displayGradientFills[0][4])
        : null;
    if (displayGradientFills.length !== 1 || !displayGradientBrush ||
            (displayGradientBrush.Stops[0][1] >>> 0) !== 0xff1f1f1f ||
            (displayGradientBrush.Stops[1][1] >>> 0) !== 0xff1b1b1b)
        throw new Error('Display panel restarted the gradient or painted a nested top border');

    pickerPanel.setPopupCommand(9828);
    if (!pickerPanel.api.toolsMenu(10, 20) ||
            pickerPanel.api.state().sideDividersVisible !== false)
        throw new Error('DarkOne Tools did not disable Bottom side dividers');
    pickerPanel.runTimers();
    assertMenusDisposedOnce(pickerPanel, 'Background gradient selection');

    pickerPanel.setPopupCommand(9842);
    if (!pickerPanel.api.toolsMenu(10, 20) ||
            pickerPanel.properties.get('Buttons depth preset') !== 2)
        throw new Error('DarkOne Tools did not apply shared Button depth');
    const depthBatch = pickerPanel.notifications.filter(
        item => item[0] === 'DarkOneJSP3.Settings.Batch').pop();
    if (!depthBatch || JSON.parse(depthBatch[1]).values['Buttons depth preset'] !== 2)
        throw new Error('Button depth did not publish the shared settings batch');
    const depthPeer = makePanel();
    const depthPeerChange = depthPeer.api.handleNotify(depthBatch[0], depthBatch[1]);
    if (depthPeer.properties.get('Buttons depth preset') !== 2 ||
            !depthPeerChange || !depthPeerChange.categories.controls)
        throw new Error('Peer control panel did not apply/classify shared Button depth');
    assertMenusDisposedOnce(pickerPanel, 'Button depth selection');

    pickerPanel.setPopupCommand(9854);
    if (!pickerPanel.api.toolsMenu(10, 20) ||
            pickerPanel.properties.get('DARKONEJSP3.BUTTON.ROUNDNESS') !== 60)
        throw new Error('DarkOne Tools did not apply shared Button roundness');
    assertMenusDisposedOnce(pickerPanel, 'Button roundness selection');

    const malformedPanel = makePanel({
        'Buttons appearance preset': 'not-a-number',
        'Buttons depth preset': 'not-a-number'
    });
    malformedPanel.setPopupCommand(0);
    if (malformedPanel.api.toolsMenu(10, 20))
        throw new Error('Cancelling DarkOne Tools unexpectedly reported a handled command');
    if (malformedPanel.popupMenus[3].radio.join(',') !== '9831,9835,9831' ||
            malformedPanel.popupMenus[4].radio.join(',') !== '9840,9843,9840')
        throw new Error('Malformed Button style/depth properties were not normalised to defaults');
    assertMenusDisposedOnce(malformedPanel, 'Malformed preset cancellation');

    const partialMenuPanel = makePanel();
    partialMenuPanel.failPopupConstructionAt(4);
    let toolsConstructionFailed = false;
    try { partialMenuPanel.api.toolsMenu(10, 20); }
    catch (e) { toolsConstructionFailed = true; }
    if (!toolsConstructionFailed || partialMenuPanel.popupMenus.length !== 3 ||
            partialMenuPanel.popupMenus.some(menu => menu.disposed !== 1))
        throw new Error('Partial DarkOne Tools construction leaked an earlier popup');

    const partialWeightPanel = makePanel();
    partialWeightPanel.failPopupAppendAt(19);
    let weightConstructionFailed = false;
    try { partialWeightPanel.api.toolsMenu(10, 20); }
    catch (e) { weightConstructionFailed = true; }
    if (!weightConstructionFailed || partialWeightPanel.popupMenus.length !== 19 ||
            partialWeightPanel.popupMenus.some(menu => menu.disposed !== 1))
        throw new Error('Partially populated font-weight menu leaked its native popup');

    files['P:\\js_data\\darkonejsp3.startup-menu-state.json'] = JSON.stringify({
        version: 'v1',
        issuedAt: Date.now(),
        state: {transition: 1, minimumDelay: 300, readinessTimeout: 2500}
    });
    pickerPanel.setPopupCommand(0);
    pickerPanel.api.toolsMenu(10, 20);
    if (pickerPanel.popupMenus[15].radio.join(',') !== '9860,9862,9861' ||
            pickerPanel.popupMenus[14].items.find(item => item[1] === 9865)[0] !== 0)
        throw new Error('DarkOne Tools did not render the current root-owned Startup state');
    assertMenusDisposedOnce(pickerPanel, 'Startup state display');

    pickerPanel.setPopupCommand(9862);
    if (!pickerPanel.api.toolsMenu(10, 20))
        throw new Error('DarkOne Tools did not handle the Startup transition command');
    const startupPayload = files['P:\\js_data\\darkonejsp3.view-command.txt'];
    const startupCommand = pickerPanel.api.viewBridge.parse(startupPayload, Date.now());
    if (!startupCommand || startupCommand.command !== 'startup-set:transition:2')
        throw new Error('DarkOne Tools did not bridge only the selected Startup action');
    assertMenusDisposedOnce(pickerPanel, 'Startup transition selection');

    files['P:\\js_data\\darkonejsp3.startup-menu-state.json'] = JSON.stringify({
        version: 'v1', issuedAt: Date.now(),
        state: {transition: 'invalid', minimumDelay: -10, readinessTimeout: 99999}
    });
    const malformedStartupPanel = makePanel();
    malformedStartupPanel.setPopupCommand(0);
    malformedStartupPanel.api.toolsMenu(10, 20);
    if (malformedStartupPanel.popupMenus[15].radio.join(',') !== '9860,9862,9860' ||
            malformedStartupPanel.popupMenus[14].items.find(item => item[1] === 9863)[2] !==
                'Minimum black hold... (250 ms)' ||
            malformedStartupPanel.popupMenus[14].items.find(item => item[1] === 9865)[0] !== 1)
        throw new Error('Malformed root-owned Startup state did not recover to safe TOOLS defaults');
    assertMenusDisposedOnce(malformedStartupPanel, 'Malformed Startup state recovery');

    pickerPanel.setPopupCommand(9806);
    if (!pickerPanel.api.toolsMenu(10, 20))
        throw new Error('Bottom background Set custom colour command was not handled through DarkOne Tools');
    if (bottomPickerCalls !== 1 || pickerPanel.api.state().backgroundMode !== 3 ||
            (pickerPanel.api.state().backgroundCustomColour >>> 0) !== 0xff556677)
        throw new Error('DarkOne Tools background picker did not apply the selected colour');
    assertMenusDisposedOnce(pickerPanel, 'Background custom edit');

    // Reproduce the real regression: switch to a preset, then re-select the saved
    // Custom radio option without changing RGB/HSL. No picker is needed and the
    // stored custom colour must be restored immediately.
    pickerPanel.setPopupCommand(9802);
    pickerPanel.api.toolsMenu(10, 20);
    const callsBeforeRestore = bottomPickerCalls;
    pickerPanel.setPopupCommand(9805);
    pickerPanel.api.toolsMenu(10, 20);
    if (bottomPickerCalls !== callsBeforeRestore || pickerPanel.api.state().backgroundMode !== 3 ||
            (pickerPanel.api.state().backgroundCustomColour >>> 0) !== 0xff556677)
        throw new Error('Saved bottom background custom colour was not restored by the Custom radio option');

    bottomPickerResult = (0xff667788 | 0);
    pickerPanel.setPopupCommand(9826);
    if (!pickerPanel.api.toolsMenu(10, 20))
        throw new Error('Bottom divider Set custom colour command was not handled through DarkOne Tools');
    if (bottomPickerCalls !== callsBeforeRestore + 1 || pickerPanel.api.state().dividerMode !== 3 ||
            (pickerPanel.api.state().dividerCustomColour >>> 0) !== 0xff667788)
        throw new Error('DarkOne Tools divider picker did not apply the selected colour');
    assertMenusDisposedOnce(pickerPanel, 'Divider custom edit');

    pickerPanel.setPopupCommand(9823);
    pickerPanel.api.toolsMenu(10, 20);
    const dividerCallsBeforeRestore = bottomPickerCalls;
    pickerPanel.setPopupCommand(9825);
    pickerPanel.api.toolsMenu(10, 20);
    if (bottomPickerCalls !== dividerCallsBeforeRestore || pickerPanel.api.state().dividerMode !== 3 ||
            (pickerPanel.api.state().dividerCustomColour >>> 0) !== 0xff667788)
        throw new Error('Saved divider custom colour was not restored by the Custom radio option');

    const beforeCancel = JSON.stringify(pickerPanel.api.state());
    bottomPickerResult = '__DEFAULT__';
    pickerPanel.setPopupCommand(9806);
    if (!pickerPanel.api.toolsMenu(10, 20))
        throw new Error('Cancelled background custom edit was not handled');
    if (JSON.stringify(pickerPanel.api.state()) !== beforeCancel)
        throw new Error('Cancelling the native picker changed the bottom-area mode or colour');
    assertMenusDisposedOnce(pickerPanel, 'Cancelled custom edit');

    const beforeFailure = JSON.stringify(pickerPanel.api.state());
    bottomPickerResult = (0xff778899 | 0);
    bottomPickerError = new Error('simulated picker failure');
    pickerPanel.setPopupCommand(9826);
    if (!pickerPanel.api.toolsMenu(10, 20))
        throw new Error('Failed divider custom edit was not handled');
    if (JSON.stringify(pickerPanel.api.state()) !== beforeFailure)
        throw new Error('Picker failure changed the bottom-area mode or colour');
    if (!logs.some(line => line.indexOf('ColourPicker failed') !== -1 &&
            line.indexOf('bottom area side dividers') !== -1))
        throw new Error('Bottom-area picker failure lacked contextual console diagnostics');
    assertMenusDisposedOnce(pickerPanel, 'Failed custom edit');
    bottomPickerError = null;

    // Restore the migrated baseline before exercising the isolated JSplitter host.
    // Menu tests above intentionally have no JSplitter peer, so discard their
    // short-lived coordination command before simulating a fresh host startup.
    delete files[COMMIT_COMMAND];
    files[NEW_STATE] = 'v1|1|4278190080|4|4278190080';
    files[LEGACY_STATE] = 'v1|2|4278190080|4|4278190080';

    const hostProperties = new Map();
    const hostNotifications = [];
    let hostRepaints = 0;
    let hostReloads = 0;
    const hostPropertyCounter = {count: 0};
    let hostIntervalCalls = 0;
    let hostNow = Date.now();
    function HostDate() {}
    HostDate.prototype.getTime = function () { return hostNow; };
    const hostTimeouts = [];
    function hostSetTimeout(fn, delay) { hostTimeouts.push({fn, delay, active:true}); return hostTimeouts.length; }
    function hostClearTimeout(id) { if (id > 0 && id <= hostTimeouts.length) hostTimeouts[id - 1].active = false; }
    const hostWindow = {
        GetProperty(name, fallback) {
            hostPropertyCounter.count++;
            return hostProperties.has(name) ? hostProperties.get(name) : fallback;
        },
        SetProperty(name, value) { hostProperties.set(name, value); },
        GetColourCUI(index) { return index === 3 ? 0xff445566 : 0xffffffff; },
        NotifyOthers(name, data) { hostNotifications.push([name, data]); },
        Repaint() { hostRepaints++; },
        Reload() { hostReloads++; },
        GetPanel() { return null; }
    };
    const hostGradientCalls = [];
    const DOJSP3Mock = {
        colours: { bar: 0xff202020, separator: 0xff181818, quickSearchBorder: 0xff696969, quickSearchFill: 0xff1e1e1e },
        titles: { controlsLeft:'l',quickSearch:'q',displayStack:'d',controlsRight:'r' },
        idiv(value, divisor) { return Math.floor(value / divisor); },
        mulDiv(value, multiplier, divisor) { return Math.round(value * multiplier / divisor); },
        clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); },
        panel() { return null; }, move() {}, show() {},
        fillVerticalGradient(gr, x, y, width, height, topColour, bottomColour) {
            hostGradientCalls.push([x, y, width, height, topColour >>> 0, bottomColour >>> 0]);
            gr.FillSolidRect(x, y, width, height, topColour);
        }
    };
    const hostFactory = new Function(
        'window', 'fb', 'include', 'DOJSP3', 'utils', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'console',
        'darkOneJsp3ResetScope', 'DarkOneViewBridge', 'Date', 'propertyCounter',
        colourSource + '\n' + protocolSource + '\n' + resetSource + '\n' + hostSource +
        '\nreturn {Protocol:BOTTOM_AREA_PROTOCOL,paint:on_paint,state:bottomAreaState,backgroundColour:bottomBackgroundColour,dividerColour:bottomDividerColour,syncFile:syncBottomAreaStateFile,syncCommit:syncBottomAreaCommitFile,syncReset:syncResetCommandFile,syncQuick:syncQuickSearchLayoutCommand,syncView:syncViewCommandFile,ensure:ensureRuntimeBridge,layout:layoutBottomControls,dispose:disposeRuntimeBridge,propertyReads:function(){return propertyCounter.count;},resetPropertyReads:function(){propertyCounter.count=0;},setSize:function(w,h){ww=w;wh=h;qsX=10;qsY=20;qsW=100;qsH=30;}};'
    );
    const host = hostFactory(
        hostWindow,
        { ProfilePath: 'P:\\' },
        function() {},
        DOJSP3Mock,
        fileUtils(),
        function() { hostIntervalCalls++; throw new Error('Bottom Controls must use one ordered timeout scheduler'); },
        function() {},
        hostSetTimeout,
        hostClearTimeout,
        { log(message) { logs.push(String(message)); } },
        function(data) {
            try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return null; }
            return data && (data.scope === 'appearance' || data.scope === 'behaviour' || data.scope === 'all') ? data.scope : null;
        },
        {
            commandFile: 'P:\js_data\darkonejsp3.view-command.txt',
            notification: 'DarkOneJSP3.View.Command',
            parse(data) {
                data = String(data || '');
                if (data === 'valid-view') return {id:'view-1', command:'layout-toggle'};
                return null;
            },
            serialiseNotification(command) { return command ? 'v1|' + command : null; }
        },
        HostDate,
        hostPropertyCounter
    );
    hostProperties.set('DARKONEJSP3.BOTTOM.BACKGROUND.LINEAR.GRADIENT', true);
    if (host.state().depthMode !== 0)
        throw new Error('Bottom Controls coupled a missing depth property to the gradient');
    hostProperties.delete('DARKONEJSP3.BOTTOM.BACKGROUND.LINEAR.GRADIENT');
    host.setSize(1920, 300);
    delete files[GEOMETRY_STATE];
    host.ensure();
    if (host.state().backgroundLinearGradient !== false ||
            host.state().sideDividersVisible !== true || host.state().depthMode !== 0)
        throw new Error('Bottom Controls did not apply public v1 state with release defaults');
    if (files[NEW_STATE] !== 'v5|v1-migration|1|4278190080|0|4|4278190080|1|0' ||
            Object.prototype.hasOwnProperty.call(files, LEGACY_STATE))
        throw new Error('Bottom Controls did not canonicalise v1 state and retire the legacy source');
    host.layout();
    if (files[GEOMETRY_STATE] !== 'v1|300|27')
        throw new Error('Bottom Controls did not publish the owning gradient coordinate space');
    if (hostIntervalCalls !== 0)
        throw new Error('Bottom Controls retained an overlapping interval poller');
    if (!hostTimeouts.some(item => item.active && item.delay === 25 && item.fn.name === 'poll'))
        throw new Error('Bottom Controls did not start its ordered 25 ms runtime scheduler');
    function runHostPollTick() {
        const item = hostTimeouts.find(timer => timer.active && timer.delay === 25 && timer.fn.name === 'poll');
        if (!item) throw new Error('Bottom Controls runtime scheduler stopped');
        item.active = false;
        item.fn();
    }
    function runLatestHostApplyTimer() {
        const item = [...hostTimeouts].reverse().find(timer => timer.active && timer.fn.name !== 'poll');
        if (!item) return false;
        item.active = false;
        item.fn();
        return true;
    }
    const resetReadsAfterEnsure = readCounts[RESET_COMMAND] || 0;
    const stateReadsAfterEnsure = readCounts[NEW_STATE] || 0;
    const resetChecksAfterEnsure = isFileCounts[RESET_COMMAND] || 0;
    for (let i = 0; i < 19; i++) runHostPollTick();
    if ((readCounts[NEW_STATE] || 0) !== stateReadsAfterEnsure)
        throw new Error('Canonical bottom-area state was polled before its 500 ms fallback tick');
    if ((readCounts[RESET_COMMAND] || 0) !== resetReadsAfterEnsure)
        throw new Error('Absent factory-reset commands triggered file reads');
    runHostPollTick();
    if ((readCounts[NEW_STATE] || 0) !== stateReadsAfterEnsure + 1)
        throw new Error('Canonical bottom-area state was not checked at 500 ms');
    if ((isFileCounts[RESET_COMMAND] || 0) !== resetChecksAfterEnsure + 1)
        throw new Error('Factory-reset command was not checked at 500 ms');

    const VIEW_COMMAND = 'P:\js_data\darkonejsp3.view-command.txt';
    files[VIEW_COMMAND] = 'expired-view';
    if (host.syncView()) throw new Error('An invalid/expired view command was processed');
    if (Object.prototype.hasOwnProperty.call(files, VIEW_COMMAND))
        throw new Error('Invalid/expired view command file was not acknowledged and removed');
    files[VIEW_COMMAND] = '';
    host.syncView();
    if (Object.prototype.hasOwnProperty.call(files, VIEW_COMMAND))
        throw new Error('Empty view command file was not retired');
    files[VIEW_COMMAND] = 'valid-view';
    if (!host.syncView()) throw new Error('A valid view command was not relayed');
    if (Object.prototype.hasOwnProperty.call(files, VIEW_COMMAND))
        throw new Error('Processed view command file was not acknowledged and removed');
    const viewEvent = hostNotifications.filter(item => item[0] === 'DarkOneJSP3.View.Command').pop();
    if (!viewEvent || viewEvent[1] !== 'v1|layout-toggle')
        throw new Error('Valid view command was not rebroadcast correctly');

    files[RESET_COMMAND] = 'malformed-reset';
    if (host.syncReset()) throw new Error('A malformed reset command was processed');
    if (Object.prototype.hasOwnProperty.call(files, RESET_COMMAND))
        throw new Error('Malformed reset command file was not retired');
    files[RESET_COMMAND] = '';
    host.syncReset();
    if (Object.prototype.hasOwnProperty.call(files, RESET_COMMAND))
        throw new Error('Empty reset command file was not retired');
    const QUICKSEARCH_COMMAND = NEW_STATE.replace(
        'darkonejsp3.bottom-area-state.txt',
        'darkonejsp3.quicksearch-layout-command.txt'
    );
    files[QUICKSEARCH_COMMAND] = 'v2|obsolete|2|44|24';
    if (host.syncQuick()) throw new Error('An obsolete Quick Search command was processed');
    if (Object.prototype.hasOwnProperty.call(files, QUICKSEARCH_COMMAND))
        throw new Error('Obsolete Quick Search command file was not retired');
    files[QUICKSEARCH_COMMAND] = '';
    host.syncQuick();
    if (Object.prototype.hasOwnProperty.call(files, QUICKSEARCH_COMMAND))
        throw new Error('Empty Quick Search command file was not retired');
    files[QUICKSEARCH_COMMAND] = 'v3|current|0|55|32';
    if (!host.syncQuick() || hostProperties.get('DARKONEJSP3.QUICKSEARCH.LAYOUT.LINES') !== 0 ||
            hostProperties.get('DARKONEJSP3.QUICKSEARCH.LAYOUT.WIDTH.PERCENT') !== 55 ||
            hostProperties.get('DARKONEJSP3.QUICKSEARCH.LAYOUT.LINE.PIXELS') !== 32)
        throw new Error('Current Quick Search layout command was not applied');

    // Obsolete transient commits are deliberately rejected. The command is
    // acknowledged once and the durable v5 state remains the recovery path.
    const obsoleteCommitNow = Date.now();
    files[COMMIT_COMMAND] = 'v3|obsolete|' + obsoleteCommitNow + '|' +
        obsoleteCommitNow + '|1|4278190080|1|4|4278190080|0';
    files[NEW_STATE] = 'v5|recovery-state|2|4278190080|0|4|4278190080|1|0';
    if (host.syncCommit())
        throw new Error('Bottom Controls processed an obsolete transient commit');
    if (Object.prototype.hasOwnProperty.call(files, COMMIT_COMMAND))
        throw new Error('Obsolete transient commit was not acknowledged and removed');
    files[COMMIT_COMMAND] = '';
    host.syncCommit();
    if (Object.prototype.hasOwnProperty.call(files, COMMIT_COMMAND))
        throw new Error('Empty bottom-area commit file was not retired');
    const recoveredCanonical = host.syncFile(false);
    if ((host.backgroundColour() >>> 0) !== 0xff202020)
        throw new Error('Bottom Controls did not recover through canonical v5 state: changed=' +
            recoveredCanonical + ', colour=' + (host.backgroundColour() >>> 0).toString(16));
    files[NEW_STATE] = 'v5|baseline-state|1|4278190080|0|4|4278190080|1|0';
    if (!host.syncFile(false) || (host.backgroundColour() >>> 0) !== 0xff000000)
        throw new Error('Bottom Controls did not restore the test baseline after recovery');

    const fills = [];
    const gr = { FillSolidRect(x,y,w,h,colour) { fills.push([x,y,w,h,colour>>>0]); } };
    host.resetPropertyReads();
    host.paint(gr);
    if (host.propertyReads() !== 7)
        throw new Error('Bottom Controls paint reread the seven-field appearance state');
    if (fills.length !== 5 || fills[0][4] !== 0xff000000 ||
            fills[1][4] !== 0xff181818 || fills[2][4] !== 0xff181818)
        throw new Error('Migrated bottom background/dividers are incorrect');

    // The visibility toggle suppresses both host-owned divider strips without
    // changing their saved colour. Re-enabling it must restore those strips.
    panelA.api.send({
        backgroundMode: 1,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: false,
        dividerMode: 4,
        dividerCustomColour: 0xff765432,
        sideDividersVisible: false,
        depthMode: 0
    });
    panelA.runTimers();
    if (!host.syncCommit())
        throw new Error('Bottom Controls did not consume the disabled-divider commit');
    runLatestHostApplyTimer();
    fills.length = 0;
    host.paint(gr);
    if (fills.length !== 3 || fills[0][4] !== 0xff000000 ||
            fills[1][4] !== 0xff696969 || fills[2][4] !== 0xff1e1e1e)
        throw new Error('Bottom side dividers remained visible after being disabled');
    if (host.state().dividerMode !== 4 ||
            (host.state().dividerCustomColour >>> 0) !== 0xff765432)
        throw new Error('Disabling Bottom side dividers discarded their colour settings');
    panelA.api.send({
        backgroundMode: 1,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: false,
        dividerMode: 4,
        dividerCustomColour: 0xff765432,
        sideDividersVisible: true,
        depthMode: 0
    });
    panelA.runTimers();
    if (!host.syncCommit())
        throw new Error('Bottom Controls did not consume the enabled-divider commit');
    runLatestHostApplyTimer();
    fills.length = 0;
    host.paint(gr);
    if (fills.length !== 5 || fills[1][4] !== 0xff181818 ||
            fills[2][4] !== 0xff181818)
        throw new Error('Bottom side dividers were not restored with their saved colour');

    // Every shared background mode must resolve identically in the JScript
    // panels and the Bottom Controls JSplitter host. This specifically guards
    // DarkOne grey (#202020) from falling through the inherited #181818 path.
    const sharedModeMatrix = [
        [0, 0xff181818],
        [1, 0xff000000],
        [2, 0xff202020],
        [3, 0xff123456],
        [4, 0xff181818],
        [5, 0xff445566]
    ];
    sharedModeMatrix.forEach(function(entry) {
        const mode = entry[0];
        const expected = entry[1] >>> 0;
        panelA.api.send({
            backgroundMode: mode,
            backgroundCustomColour: 0xff123456,
            backgroundLinearGradient: false,
            dividerMode: 4,
            dividerCustomColour: 0xff765432,
            sideDividersVisible: true,
            depthMode: 0
        });
        if ((panelA.api.backgroundColour() >>> 0) !== expected)
            throw new Error('JScript bottom mode ' + mode + ' resolved incorrectly');
        panelA.runTimers();
        if (!host.syncCommit())
            throw new Error('Bottom Controls did not consume mode ' + mode + ' commit');
        runLatestHostApplyTimer();
        if ((host.backgroundColour() >>> 0) !== expected)
            throw new Error('Bottom Controls mode ' + mode + ' resolved differently from JScript');
        fills.length = 0;
        host.paint(gr);
        if (!fills.length || (fills[0][4] >>> 0) !== expected)
            throw new Error('Bottom Controls mode ' + mode + ' did not paint its expected backing');
    });

    panelA.api.send({
        backgroundMode: 2,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: true,
        dividerMode: 4,
        dividerCustomColour: 0xff765432,
        sideDividersVisible: true,
        depthMode: 1
    });
    panelA.runTimers();
    const gradientStringifiesBeforePaint = panelA.jsonStringifyCalls;
    const jscriptGradientFills = [];
    const jscriptGradientGraphics = {
        FillRectangle(x, y, w, h, colour) {
            jscriptGradientFills.push([x, y, w, h, colour]);
        }
    };
    panelA.api.paint(jscriptGradientGraphics);
    const gradientStringifiesAfterFirstPaint = panelA.jsonStringifyCalls;
    panelA.api.paint(jscriptGradientGraphics);
    if (gradientStringifiesAfterFirstPaint !== gradientStringifiesBeforePaint + 1 ||
            panelA.jsonStringifyCalls !== gradientStringifiesAfterFirstPaint)
        throw new Error('JScript bottom gradient brush was rebuilt on an unchanged repaint');
    if (!host.syncCommit()) throw new Error('Bottom Controls did not consume the gradient commit');
    runLatestHostApplyTimer();
    hostGradientCalls.length = 0;
    fills.length = 0;
    host.paint(gr);
    if (hostGradientCalls.length !== 1 || hostGradientCalls[0][4] !== 0xff202020 ||
            hostGradientCalls[0][5] !== 0xff161616 ||
            !fills.some(item => item[1] === 0 && item[3] === 1 && item[4] === 0xff000000) ||
            !fills.some(item => item[1] === 1 && item[3] === 1 && item[4] === 0xff0f0f0f) ||
            !fills.some(item => item[1] === 2 && item[3] === 2 && item[4] === 0xff262626))
        throw new Error('Bottom Controls did not paint the shared gradient and Soft depth highlight');
    panelA.api.send({
        backgroundMode: 2,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: false,
        dividerMode: 4,
        dividerCustomColour: 0xff765432,
        sideDividersVisible: true,
        depthMode: 0
    });
    panelA.runTimers();
    host.syncCommit();
    runLatestHostApplyTimer();

    // Divider-only changes update shared menu properties and persistence but
    // must not rebuild buttons, Display colour caches or repaint JScript panels.
    panelA.api.send({
        backgroundMode: 3,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: false,
        dividerMode: 4,
        dividerCustomColour: 0xff765432,
        sideDividersVisible: true,
        depthMode: 0
    });
    const dividerOnlyRepaints = panelA.repaints;
    const dividerOnlyAppearance = panelA.appearanceApplications;
    panelA.api.send({
        backgroundMode: 3,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: false,
        dividerMode: 1,
        dividerCustomColour: 0xff765432,
        sideDividersVisible: true,
        depthMode: 0
    });
    if (panelA.api.state().dividerMode !== 1)
        throw new Error('Divider-only state did not update the JScript menu properties');
    if (panelA.repaints !== dividerOnlyRepaints ||
            panelA.appearanceApplications !== dividerOnlyAppearance)
        throw new Error('Divider-only state rebuilt JScript visual resources');

    panelA.api.send({
        backgroundMode: 2,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: false,
        dividerMode: 1,
        dividerCustomColour: 0xff765432,
        sideDividersVisible: true,
        depthMode: 0
    });

    const customState = {
        backgroundMode: 3,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: false,
        dividerMode: 5,
        dividerCustomColour: 0xff765432,
        sideDividersVisible: true,
        depthMode: 0
    };
    const panelARepaints = panelA.repaints;
    panelA.api.send(customState);
    if (!files[NEW_STATE] || panelA.api.parse(files[NEW_STATE]).backgroundMode !== 3)
        throw new Error('JScript panel did not persist the shared bottom-area state');
    if (!files[COMMIT_COMMAND] || !panelA.api.parseCommit(files[COMMIT_COMMAND], Date.now()))
        throw new Error('JScript panel did not publish a coordinated bottom-area commit');
    if (panelA.repaints !== panelARepaints)
        throw new Error('Initiating panel repainted before the coordinated apply time');

    const commitEvent = panelA.notifications.filter(item => item[0] === 'DarkOneJSP3.BottomArea.Commit').pop();
    if (!commitEvent) throw new Error('JScript panel did not broadcast the coordinated peer commit');
    const panelBRepaints = panelB.repaints;
    panelB.api.scheduleCommit(commitEvent[1]);
    if (panelB.repaints !== panelBRepaints)
        throw new Error('Peer panel repainted before the coordinated apply time');
    panelA.runTimers();
    panelB.runTimers();
    if ((panelA.api.backgroundColour() >>> 0) !== 0xff123456 ||
            (panelB.api.backgroundColour() >>> 0) !== 0xff123456)
        throw new Error('Coordinated JScript panels did not resolve the committed colour');
    if (panelA.repaints !== panelARepaints + 1 || panelB.repaints !== panelBRepaints + 1)
        throw new Error('Coordinated JScript panels did not repaint exactly once at commit time');

    const commitRelayCountBefore = hostNotifications.filter(
        item => item[0] === 'DarkOneJSP3.BottomArea.Commit').length;
    const hostRepaintsBeforeCommit = hostRepaints;
    if (!host.syncCommit()) throw new Error('Bottom Controls did not consume the coordinated colour commit');
    const relayedCommit = hostNotifications.filter(
        item => item[0] === 'DarkOneJSP3.BottomArea.Commit').pop();
    if (!relayedCommit || hostNotifications.filter(
            item => item[0] === 'DarkOneJSP3.BottomArea.Commit').length !==
            commitRelayCountBefore + 1 ||
            !panelA.api.parseCommit(relayedCommit[1], Date.now()))
        throw new Error('Bottom Controls did not relay the coordinated commit inside JSplitter');
    if (hostRepaints !== hostRepaintsBeforeCommit)
        throw new Error('Bottom Controls repainted before the coordinated apply time');
    if (!runLatestHostApplyTimer()) throw new Error('Bottom Controls did not schedule the coordinated apply timer');
    if (hostRepaints !== hostRepaintsBeforeCommit + 1)
        throw new Error('Bottom Controls did not repaint exactly once at the coordinated apply time');
    fills.length = 0;
    host.paint(gr);
    if (fills.length !== 5 || fills[0][4] !== 0xff123456 ||
            fills[1][4] !== 0xff445566 || fills[2][4] !== 0xff445566)
        throw new Error('File-backed custom background / divider state did not paint correctly');
    if (fills[0][0] !== 0 || fills[0][1] !== 0 || fills[0][2] !== 1920 || fills[0][3] !== 300)
        throw new Error('The JSplitter backing does not cover the full bottom area');

    // Rapid changes must supersede rather than paint an intermediate colour.
    const rapidRepaints = panelA.repaints;
    panelA.api.send({
        backgroundMode: 1,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: false,
        dividerMode: 5,
        dividerCustomColour: 0xff765432,
        sideDividersVisible: true,
        depthMode: 0
    });
    panelA.api.send({
        backgroundMode: 4,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: false,
        dividerMode: 5,
        dividerCustomColour: 0xff765432,
        sideDividersVisible: true,
        depthMode: 0
    });
    panelA.runTimers();
    const rapidPaint = [];
    panelA.api.paint({ FillRectangle(x,y,w,h,colour) { rapidPaint.push(colour>>>0); } });
    if (panelA.repaints !== rapidRepaints + 1 || rapidPaint[0] !== 0xff181818)
        throw new Error('Rapid JScript colour commits painted an intermediate background');
    if (!host.syncCommit()) throw new Error('Bottom Controls did not consume the superseding rapid commit');
    runLatestHostApplyTimer();
    if ((host.backgroundColour() >>> 0) !== 0xff181818)
        throw new Error('Bottom Controls applied an obsolete rapid colour commit');

    // A false canonical-state WriteTextFile return must be logged and retried.
    // The short-lived commit file still succeeds, preserving coordinated visual
    // delivery while persistence receives its independent retry.
    failWrites = 1;
    failWritePath = NEW_STATE;
    panelA.api.send({
        backgroundMode: 1,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: false,
        dividerMode: 4,
        dividerCustomColour: 0xff765432,
        sideDividersVisible: true,
        depthMode: 0
    });
    failWritePath = '';
    if (!logs.some(line => line.indexOf(NEW_STATE) >= 0 && line.indexOf('returned false') >= 0))
        throw new Error('A false bottom-area state write was not diagnosed with its path');
    if (!host.syncCommit())
        throw new Error('Bottom Controls did not consume a commit whose canonical write failed');
    runLatestHostApplyTimer();
    host.syncFile(false);
    if ((host.backgroundColour() >>> 0) !== 0xff000000)
        throw new Error('Stale canonical state rolled back an applied bottom-area commit');
    hostNow += 2001;
    host.syncFile(false);
    var repairedState = panelA.api.parse(files[NEW_STATE]);
    if (!repairedState || repairedState.revision === 'state' ||
            repairedState.backgroundMode !== 1 ||
            (repairedState.backgroundCustomColour >>> 0) !== 0xff123456 ||
            repairedState.dividerMode !== 4 ||
            (repairedState.dividerCustomColour >>> 0) !== 0xff765432 ||
            (host.backgroundColour() >>> 0) !== 0xff000000)
        throw new Error('Bottom Controls did not repair canonical state after the persistence deadline: ' +
            String(files[NEW_STATE]) + ' / ' + JSON.stringify(repairedState));
    panelA.runTimers();
    repairedState = panelA.api.parse(files[NEW_STATE]);
    if (!repairedState || repairedState.backgroundMode !== 1 ||
            repairedState.revision === 'state')
        throw new Error('The failed bottom-area state write was not retried successfully');

    const revisionBase = hostNow;
    const olderCommit = host.Protocol.commit(
        String(revisionBase) + '-older',
        revisionBase,
        revisionBase,
        host.Protocol.state(1, 0xff000000, false, 4, 0xff000000, true, 0)
    );
    files[COMMIT_COMMAND] = host.Protocol.serialiseCommit(olderCommit);
    if (!host.syncCommit())
        throw new Error('Bottom Controls did not accept the revision-order test commit');
    files[NEW_STATE] = host.Protocol.serialiseState(
        host.Protocol.state(
            2, 0xff000000, false, 4, 0xff000000, true, 0,
            String(revisionBase + 1) + '-newer'
        )
    );
    hostNow += 2001;
    host.syncFile(false);
    if ((host.backgroundColour() >>> 0) !== 0xff202020)
        throw new Error('A newer canonical revision was overwritten by an older commit repair');

    // If the coordination command itself cannot be written, the initiator must
    // fall back to the legacy immediate repaint path rather than silently doing nothing.
    failWrites = 1;
    failWritePath = COMMIT_COMMAND;
    const fallbackRepaints = panelA.repaints;
    panelA.api.send({
        backgroundMode: 2,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: false,
        dividerMode: 4,
        dividerCustomColour: 0xff765432,
        sideDividersVisible: true,
        depthMode: 0
    });
    failWritePath = '';
    if (panelA.repaints !== fallbackRepaints + 1)
        throw new Error('Failed commit publication did not fall back to immediate repaint');
    if (!logs.some(line => line.indexOf(COMMIT_COMMAND) >= 0 && line.indexOf('returned false') >= 0))
        throw new Error('A false bottom-area commit write was not diagnosed with its path');
    host.syncFile(false);

    // Cross-host factory reset: JScript writes a short-lived command, Bottom
    // Controls consumes it, resets its own role and rebroadcasts within JSplitter.
    hostProperties.set('DARKONEJSP3.BOTTOM.BACKGROUND.MODE', 1);
    hostProperties.set('DARKONEJSP3.BOTTOM.BACKGROUND.LINEAR.GRADIENT', true);
    hostProperties.set('DARKONEJSP3.BOTTOM.DIVIDER.MODE', 1);
    hostProperties.set('DARKONEJSP3.BOTTOM.SIDE.DIVIDERS', false);
    hostProperties.set('DARKONEJSP3.BOTTOM.DEPTH', 1);
    if (!panelA.api.writeReset('appearance') || !files[RESET_COMMAND])
        throw new Error('JScript factory reset did not write the reset command');
    const resetEventsBefore = hostNotifications.length;
    if (!host.syncReset()) throw new Error('Bottom Controls did not consume the reset command');
    if (hostProperties.get('DARKONEJSP3.BOTTOM.BACKGROUND.MODE') !== 2 ||
            hostProperties.get('DARKONEJSP3.BOTTOM.BACKGROUND.LINEAR.GRADIENT') !== false ||
            hostProperties.get('DARKONEJSP3.BOTTOM.DIVIDER.MODE') !== 4 ||
            hostProperties.get('DARKONEJSP3.BOTTOM.SIDE.DIVIDERS') !== true ||
            hostProperties.get('DARKONEJSP3.BOTTOM.DEPTH') !== 0)
        throw new Error('Bottom Controls did not restore its reset defaults');
    const resetEvent = hostNotifications.slice(resetEventsBefore).find(item => item[0] === 'DarkOneJSP3.Reset.Properties');
    if (!resetEvent || JSON.parse(resetEvent[1]).scope !== 'appearance')
        throw new Error('Bottom Controls did not rebroadcast reset inside JSplitter');
    if (hostReloads !== 1) throw new Error('Bottom Controls reset did not reload exactly once');
    if (Object.prototype.hasOwnProperty.call(files, RESET_COMMAND))
        throw new Error('Processed factory-reset command file was not acknowledged and removed');
    if (host.syncReset()) throw new Error('The same reset command was processed twice');

    const now = Date.now();
    files[RESET_COMMAND] = 'v1|stale|' + String(now - 60000) + '|all';
    if (host.syncReset()) throw new Error('An expired reset command was processed');
    if (Object.prototype.hasOwnProperty.call(files, RESET_COMMAND))
        throw new Error('Expired reset command file was not retired');

    const restartedPanel = makePanel();
    restartedPanel.api.request();
    const restartedState = restartedPanel.api.state();
    if (restartedState.backgroundMode !== 2 ||
            restartedState.backgroundLinearGradient !== false ||
            restartedState.dividerMode !== 4 ||
            restartedState.sideDividersVisible !== true || restartedState.depthMode !== 0)
        throw new Error('Reset bottom-area defaults did not survive a simulated restart');

    panelA.api.send({
        backgroundMode: 0,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: false,
        dividerMode: 0,
        dividerCustomColour: 0xff765432,
        sideDividersVisible: true,
        depthMode: 0
    });
    if ((panelA.api.backgroundColour() >>> 0) !== 0xff181818)
        throw new Error('JScript inherited bottom background does not resolve to #181818');
    const panelFills = [];
    panelA.runTimers();
    panelA.api.paint({ FillRectangle(x,y,w,h,colour) { panelFills.push([x,y,w,h,colour>>>0]); } });
    if (panelFills.length !== 1 || panelFills[0][0] !== 0 || panelFills[0][1] !== 0 ||
            panelFills[0][2] !== 320 || panelFills[0][3] !== 120 ||
            panelFills[0][4] !== 0xff181818)
        throw new Error('JScript inherited bottom background does not paint its complete panel surface');
    host.syncCommit();
    runLatestHostApplyTimer();
    fills.length = 0;
    host.paint(gr);
    if (fills.length !== 3 || fills[0][4] !== 0xff181818 ||
            fills[1][4] !== 0xff696969 || fills[2][4] !== 0xff1e1e1e)
        throw new Error('Inherited bottom background does not paint #181818 while transparent dividers reveal it');
    if (hostRepaints < 3) throw new Error('File state changes did not repaint the JSplitter host');
    host.dispose();
    firstPaintPanel.api.dispose();
    panelA.api.dispose();
    panelB.api.dispose();
    missingDepthPropertyPanel.api.dispose();
    restartedPanel.api.dispose();
});

suite("JSplitter gradient run cache", function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path("DarkOneJSP3/jsplitter/shared.js"), 'utf8');
    let blendCalls = 0;
    const colour = {
        blend(top, bottom, amount) {
            blendCalls++;
            const topChannel = top & 0xff;
            const bottomChannel = bottom & 0xff;
            const channel = Math.round(topChannel + (bottomChannel - topChannel) * amount);
            return (0xff000000 | channel * 0x10000 | channel * 0x100 | channel) >>> 0;
        }
    };
    const factory = new Function(
        'include', 'DarkOneColour', 'window', 'fb', 'utils',
        source + '\nreturn DOJSP3;'
    );
    const api = factory(function(){}, colour, {GetPanel(){return null;}}, {}, {});
    const fills = [];
    const gr = {FillSolidRect(x,y,w,h,c){fills.push([x,y,w,h,c]);}};
    api.fillVerticalGradient(gr, 0, 0, 100, 120, 0xff202020, 0xff161616);
    const firstBlendCalls = blendCalls;
    api.fillVerticalGradient(gr, 0, 0, 200, 120, 0xff202020, 0xff161616);
    if (firstBlendCalls !== 120 || blendCalls !== firstBlendCalls)
        throw new Error('JSplitter recomputed unchanged gradient row colours');
    api.fillVerticalGradient(gr, 0, 0, 200, 121, 0xff202020, 0xff161616);
    if (blendCalls !== firstBlendCalls + 121)
        throw new Error('JSplitter gradient cache did not invalidate after geometry changed');
});

suite("startup control bridge", function () {
    const fs = require('fs');
    const colourSource = fs.readFileSync(__path("DarkOneJSP3/shared/colour_utils.js"), 'utf8');
    const protocolSource = fs.readFileSync(__path("DarkOneJSP3/shared/jsplitter_protocols.js"), 'utf8');
    const queueBridgeSource = fs.readFileSync(__path("DarkOneJSP3/shared/queue_bridge.js"), 'utf8');
    const viewBridgeSource = fs.readFileSync(__path("DarkOneJSP3/shared/view_bridge.js"), 'utf8');
    const rootSource = fs.readFileSync(__path("DarkOneJSP3/jsplitter/01_root.js"), 'utf8');
    const rootProperties = new Map();
    const timers = new Map();
    let nextTimer = 1;
    const main = { visible: true, Show(value) { this.visible = Boolean(value); }, Move() {} };
    const controls = { visible: true, Show(value) { this.visible = Boolean(value); }, Move() {} };
    function fakeSetTimeout(fn, delay) {
        const id = nextTimer++;
        timers.set(id, {fn, delay});
        return id;
    }
    function fakeClearTimeout(id) { timers.delete(id); }
    function runTimerWithDelay(delay) {
        const match = [...timers.entries()].find(item => item[1].delay === delay);
        if (!match) throw new Error('Missing timer with delay ' + delay);
        timers.delete(match[0]);
        match[1].fn();
    }
    function runAllTimersWithDelay(delay) {
        const matches = [...timers.entries()].filter(item => item[1].delay === delay);
        if (!matches.length) throw new Error('Missing timer with delay ' + delay);
        matches.forEach(match => timers.delete(match[0]));
        matches.forEach(match => match[1].fn());
    }
    const DOJSP3 = {
        colours: {bar: 0xff202020, buttonNormal: 0xff298fcc,
            buttonHover: 0xff9b9b9b, buttonActive: 0xffffffff},
        titles: {main: 'main', controls: 'controls', infoStack: 'info',
            artSpectrum: 'art', playlist: 'playlist', playlistManager: 'p0',
            lastfmBio: 'p1', lastfmInfo: 'p2', albumNotes: 'p3',
            queue: 'p4', properties: 'p5'},
        clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); },
        idiv(value, divisor) { return Math.floor(value / divisor); },
        mulDiv(value, multiplier, divisor) { return Math.round(value * multiplier / divisor); },
        panel(title) { return title === 'main' ? main : controls; },
        move(panel) { if (panel && panel.Move) panel.Move(); },
        show(panel, visible) { if (panel) panel.Show(visible); }
    };
    const rootWindow = {
        GetProperty(name, fallback) { return rootProperties.has(name) ? rootProperties.get(name) : fallback; },
        SetProperty(name, value) { rootProperties.set(name, value); },
        GetPanel(title) { return title === 'main' ? main : controls; },
        NotifyOthers() {},
        Repaint() {}, Reload() {}
    };
    const rootFactory = new Function(
        'window','fb','plman','include','utils','DOJSP3','darkOneJsp3HandleReset',
        'setTimeout','clearTimeout','console',
        colourSource + '\n' + protocolSource + '\n' + viewBridgeSource + '\n' + queueBridgeSource + '\n' + rootSource +
        '\nreturn {on_size,on_notify_data,on_playback_queue_changed,startupTransition,startupMinimumDelay,startupSafetyTimeout,viewBridge:DarkOneViewBridge};'
    );
    const bridgeWrites = new Map();
    const queueStatePath = 'js_data\\darkonejsp3.queue-state.json';
    let stateWriteFailures = 0;
    let stateWriteAttempts = 0;
    let rootQueueContents = [];
    let nextCalls = 0;
    let nextFailure = false;
    const rootFb = {ProfilePath:'', TitleFormat() { return {EvalWithMetadb(handle) {
        return String(handle.Path || '') + '|' + String(handle.SubSong || 0);
    }}; }, Next() {
        nextCalls++;
        if (nextFailure) {
            nextFailure = false;
            throw new Error('simulated playback advance failure');
        }
        if (rootQueueContents.length) rootQueueContents.shift();
    }};
    const sourceHandles = new Map();
    function sourceKey(p, i) { return p + ':' + i; }
    let playlistQueueAdds = 0;
    let detachedQueueAdds = 0;
    let queueAddAttempts = 0;
    let queueAddFailureAt = 0;
    let queueAddFailureAt2 = 0;
    function maybeFailQueueAdd() {
        queueAddAttempts++;
        if ((queueAddFailureAt && queueAddAttempts === queueAddFailureAt) ||
                (queueAddFailureAt2 && queueAddAttempts === queueAddFailureAt2)) {
            if (queueAddAttempts === queueAddFailureAt) queueAddFailureAt = 0;
            if (queueAddAttempts === queueAddFailureAt2) queueAddFailureAt2 = 0;
            throw new Error('simulated queue reconstruction failure');
        }
    }
    const rootPlman = {
        PlaylistCount: 10,
        PlaylistItemCount() { return 100; },
        GetPlaybackQueueContents() { return rootQueueContents.slice(); },
        RemoveItemFromPlaybackQueue(index) { rootQueueContents.splice(index, 1); },
        RemoveItemsFromPlaybackQueue(indexes) {
            const remove = new Set(indexes);
            rootQueueContents = rootQueueContents.filter((item, index) => !remove.has(index));
        },
        FlushPlaybackQueue() {
            // Model native playback-queue wrappers as live objects whose source
            // coordinates cease to be reliable once the queue is flushed.
            rootQueueContents.forEach(item => {
                item.PlaylistIndex = -1;
                item.PlaylistItemIndex = -1;
            });
            rootQueueContents = [];
        },
        AddPlaylistItemToPlaybackQueue(playlist, item) {
            maybeFailQueueAdd();
            playlistQueueAdds++;
            rootQueueContents.push({PlaylistIndex:playlist,PlaylistItemIndex:item,
                Handle:sourceHandles.get(sourceKey(playlist,item))});
        },
        AddItemToPlaybackQueue(handle) {
            maybeFailQueueAdd();
            detachedQueueAdds++;
            rootQueueContents.push({PlaylistIndex:-1,PlaylistItemIndex:-1,Handle:handle});
        }
    };
    const rootUtils = {
        CreateFolder() { return true; },
        IsFile(path) { return bridgeWrites.has(path); },
        ReadTextFile(path) { return bridgeWrites.get(path) || ''; },
        RemovePath(path) { return bridgeWrites.delete(path); },
        WriteTextFile(path, content) {
            if (path === queueStatePath) {
                stateWriteAttempts++;
                if (stateWriteFailures > 0) { stateWriteFailures--; return false; }
            }
            bridgeWrites.set(path, content);
            return true;
        }
    };
    const root = rootFactory(rootWindow, rootFb, rootPlman, function(){}, rootUtils, DOJSP3,
        function(){return false;}, fakeSetTimeout, fakeClearTimeout, console);
    function assert(condition, message) { if (!condition) throw new Error(message); }
    const startupStatePath = 'js_data\\darkonejsp3.startup-menu-state.json';
    assert(bridgeWrites.size === 2,
        'Root did not publish exactly one Startup state and one queue state during startup');
    const initialStartupState = JSON.parse(bridgeWrites.get(startupStatePath)).state;
    assert(initialStartupState.transition === 0 && initialStartupState.minimumDelay === 250 &&
        initialStartupState.readinessTimeout === 2000,
        'Root startup state file did not publish the defaults');
    const initialQueueState = JSON.parse(bridgeWrites.get(queueStatePath));
    assert(initialQueueState.available === true && initialQueueState.writable === true &&
        initialQueueState.capabilities.includes('removeMany') &&
        initialQueueState.capabilities.includes('skipTo') && initialQueueState.entries.length === 0,
        'Root startup writable queue bridge state was invalid');
    rootQueueContents = [
        {PlaylistIndex:4, PlaylistItemIndex:7, Handle:{Path:'C:/Music/a.flac',SubSong:0}},
        {PlaylistIndex:0xffffffff, PlaylistItemIndex:0xffffffff, Handle:{Path:'C:/Detached/b.flac',SubSong:2}}
    ];
    sourceHandles.set(sourceKey(4,7), rootQueueContents[0].Handle);
    root.on_playback_queue_changed(0);
    const populatedQueueState = JSON.parse(bridgeWrites.get(queueStatePath));
    assert(populatedQueueState.entries.length === 2 &&
        populatedQueueState.entries[0].queueIndex === 1 &&
        populatedQueueState.entries[0].playlistIndex === 4 &&
        populatedQueueState.entries[0].playlistItemIndex === 7 &&
        populatedQueueState.entries[0].sourceId === 'C:/Music/a.flac|0',
        'Root did not serialise direct queue source data correctly');
    assert(populatedQueueState.entries[1].playlistIndex === -1 &&
        populatedQueueState.entries[1].playlistItemIndex === -1 &&
        populatedQueueState.entries[1].sourceId === 'C:/Detached/b.flac|2',
        'Root did not normalise detached direct queue items');
    const beforeRetryGeneration = populatedQueueState.generation;
    const attemptsBeforeRetry = stateWriteAttempts;
    rootQueueContents = [
        {PlaylistIndex:4, PlaylistItemIndex:7, Handle:{Path:'C:/Music/a.flac',SubSong:0}}
    ];
    stateWriteFailures = 1;
    root.on_playback_queue_changed(0);
    const failedState = JSON.parse(bridgeWrites.get(queueStatePath));
    assert(failedState.generation === beforeRetryGeneration,
        'Failed queue-state write incorrectly appeared as a published generation');
    runAllTimersWithDelay(50);
    const retriedState = JSON.parse(bridgeWrites.get(queueStatePath));
    assert(retriedState.generation === beforeRetryGeneration + 1 && retriedState.entries.length === 1,
        'Queue bridge did not retry the failed state publication without skipping generations');
    assert(stateWriteAttempts === attemptsBeforeRetry + 2,
        'Queue bridge state retry performed an unexpected number of writes');

    rootQueueContents = [
        {PlaylistIndex:4, PlaylistItemIndex:7, Handle:{Path:'C:/Music/a.flac',SubSong:0}},
        {PlaylistIndex:0xffffffff, PlaylistItemIndex:0xffffffff, Handle:{Path:'C:/Detached/b.flac',SubSong:2}}
    ];
    root.on_playback_queue_changed(0);
    const commandPath = 'js_data\\darkonejsp3.queue-command.json';
    const resultPath = 'js_data\\darkonejsp3.queue-command-result.json';
    const currentBeforeRemove = JSON.parse(bridgeWrites.get(queueStatePath));
    bridgeWrites.set(commandPath, JSON.stringify({version:'v2',id:'remove-1',session:currentBeforeRemove.session,
        generation:currentBeforeRemove.generation,action:'remove',queueIndexes:[1]}));
    runTimerWithDelay(50);
    assert(rootQueueContents.length === 1 && rootQueueContents[0].Handle.Path === 'C:/Detached/b.flac',
        'Root writable bridge did not remove the requested queue occurrence');
    const removeResult = JSON.parse(bridgeWrites.get(resultPath));
    assert(removeResult.accepted === true && removeResult.id === 'remove-1',
        'Root writable bridge did not acknowledge the removal');
    assert(!bridgeWrites.has(commandPath),
        'Root writable bridge did not remove the processed command file');

    rootQueueContents = [
        {PlaylistIndex:1, PlaylistItemIndex:1, Handle:{Path:'C:/Music/one.flac',SubSong:0}},
        {PlaylistIndex:1, PlaylistItemIndex:2, Handle:{Path:'C:/Music/two.flac',SubSong:0}},
        {PlaylistIndex:-1, PlaylistItemIndex:-1, Handle:{Path:'C:/Detached/three.flac',SubSong:0}}
    ];
    sourceHandles.set(sourceKey(1,1), rootQueueContents[0].Handle);
    sourceHandles.set(sourceKey(1,2), rootQueueContents[1].Handle);
    root.on_playback_queue_changed(0);
    const reorderState = JSON.parse(bridgeWrites.get('js_data\\darkonejsp3.queue-state.json'));
    bridgeWrites.set(commandPath, JSON.stringify({version:'v2',id:'move-bottom',session:reorderState.session,
        generation:reorderState.generation,action:'moveBottom',queueIndexes:[1]}));
    runTimerWithDelay(50);
    assert(rootQueueContents.map(item => item.Handle.Path).join(',') ===
        'C:/Music/two.flac,C:/Detached/three.flac,C:/Music/one.flac',
        'Root writable bridge did not preserve order/handles while moving an item to the bottom');
    assert(rootQueueContents[0].PlaylistIndex === 1 && rootQueueContents[0].PlaylistItemIndex === 2 &&
        rootQueueContents[2].PlaylistIndex === 1 && rootQueueContents[2].PlaylistItemIndex === 1,
        'Root writable bridge lost playlist-backed queue source coordinates during reorder');
    assert(rootQueueContents[1].PlaylistIndex === -1 && rootQueueContents[1].PlaylistItemIndex === -1,
        'Root writable bridge incorrectly attached a detached queue entry during reorder');
    assert(playlistQueueAdds === 2 && detachedQueueAdds === 1,
        'Root writable bridge did not restore playlist-backed entries through AddPlaylistItemToPlaybackQueue');
    const movedState = JSON.parse(bridgeWrites.get('js_data\\darkonejsp3.queue-state.json'));
    bridgeWrites.set(commandPath, JSON.stringify({version:'v2',id:'stale',session:movedState.session,
        generation:movedState.generation - 1,action:'clear',queueIndexes:[]}));
    runTimerWithDelay(50);
    const staleResult = JSON.parse(bridgeWrites.get(resultPath));
    assert(staleResult.accepted === false && rootQueueContents.length === 3,
        'Root writable bridge did not reject a stale-generation command');

    bridgeWrites.set(commandPath, '{malformed');
    runTimerWithDelay(50);
    assert(!bridgeWrites.has(commandPath),
        'Malformed queue command file was not retired after one poll');
    bridgeWrites.set(commandPath, '');
    runTimerWithDelay(50);
    assert(!bridgeWrites.has(commandPath),
        'Empty queue command file was not retired after one poll');

    rootQueueContents = [
        {PlaylistIndex:7,PlaylistItemIndex:1,Handle:{Path:'C:/Skip/a.flac',SubSong:0}},
        {PlaylistIndex:-1,PlaylistItemIndex:-1,Handle:{Path:'C:/Skip/b.flac',SubSong:0}},
        {PlaylistIndex:7,PlaylistItemIndex:3,Handle:{Path:'C:/Skip/c.flac',SubSong:0}},
        {PlaylistIndex:-1,PlaylistItemIndex:-1,Handle:{Path:'C:/Skip/d.flac',SubSong:0}}
    ];
    sourceHandles.set(sourceKey(7,1), rootQueueContents[0].Handle);
    sourceHandles.set(sourceKey(7,3), rootQueueContents[2].Handle);
    root.on_playback_queue_changed(0);
    const skipState = JSON.parse(bridgeWrites.get(queueStatePath));
    const nextCallsBeforeSkip = nextCalls;
    bridgeWrites.set(commandPath, JSON.stringify({version:'v2',id:'skip-third',
        session:skipState.session,generation:skipState.generation,
        action:'skipTo',queueIndexes:[3]}));
    runTimerWithDelay(50);
    const skipResult = JSON.parse(bridgeWrites.get(resultPath));
    assert(skipResult.accepted === true && nextCalls === nextCallsBeforeSkip + 1,
        'Skip-to-track command did not advance playback through fb.Next()');
    assert(rootQueueContents.length === 1 && rootQueueContents[0].Handle.Path === 'C:/Skip/d.flac',
        'Skip-to-track did not consume only the target and preceding queue entries');

    const nextCallsBeforeStaleSkip = nextCalls;
    const afterSkipState = JSON.parse(bridgeWrites.get(queueStatePath));
    bridgeWrites.set(commandPath, JSON.stringify({version:'v2',id:'skip-stale',
        session:afterSkipState.session,generation:afterSkipState.generation - 1,
        action:'skipTo',queueIndexes:[1]}));
    runTimerWithDelay(50);
    const staleSkipResult = JSON.parse(bridgeWrites.get(resultPath));
    assert(staleSkipResult.accepted === false && nextCalls === nextCallsBeforeStaleSkip &&
        rootQueueContents.length === 1,
        'Stale skip-to-track command changed playback or the queue');

    rootQueueContents = [
        {PlaylistIndex:8,PlaylistItemIndex:1,Handle:{Path:'C:/SkipRollback/a.flac',SubSong:0}},
        {PlaylistIndex:-1,PlaylistItemIndex:-1,Handle:{Path:'C:/SkipRollback/b.flac',SubSong:0}},
        {PlaylistIndex:8,PlaylistItemIndex:3,Handle:{Path:'C:/SkipRollback/c.flac',SubSong:0}}
    ];
    sourceHandles.set(sourceKey(8,1), rootQueueContents[0].Handle);
    sourceHandles.set(sourceKey(8,3), rootQueueContents[2].Handle);
    root.on_playback_queue_changed(0);
    const failedSkipState = JSON.parse(bridgeWrites.get(queueStatePath));
    nextFailure = true;
    bridgeWrites.set(commandPath, JSON.stringify({version:'v2',id:'skip-rollback',
        session:failedSkipState.session,generation:failedSkipState.generation,
        action:'skipTo',queueIndexes:[3]}));
    runTimerWithDelay(50);
    const failedSkipResult = JSON.parse(bridgeWrites.get(resultPath));
    assert(failedSkipResult.accepted === false &&
        failedSkipResult.message.indexOf('The original queue was restored.') !== -1,
        'Failed skip-to-track did not report successful queue rollback');
    assert(rootQueueContents.map(item => item.Handle.Path).join(',') ===
        'C:/SkipRollback/a.flac,C:/SkipRollback/b.flac,C:/SkipRollback/c.flac',
        'Failed skip-to-track did not restore the original queue');

    rootQueueContents = [
        {PlaylistIndex:6, PlaylistItemIndex:1, Handle:{Path:'C:/Rollback/one.flac',SubSong:0}},
        {PlaylistIndex:6, PlaylistItemIndex:2, Handle:{Path:'C:/Rollback/two.flac',SubSong:0}},
        {PlaylistIndex:-1, PlaylistItemIndex:-1, Handle:{Path:'C:/Rollback/three.flac',SubSong:0}}
    ];
    sourceHandles.set(sourceKey(6,1), rootQueueContents[0].Handle);
    sourceHandles.set(sourceKey(6,2), rootQueueContents[1].Handle);
    root.on_playback_queue_changed(0);
    const rollbackState = JSON.parse(bridgeWrites.get(queueStatePath));
    queueAddAttempts = 0;
    queueAddFailureAt = 2;
    bridgeWrites.set(commandPath, JSON.stringify({version:'v2',id:'rollback-reorder',
        session:rollbackState.session,generation:rollbackState.generation,
        action:'moveBottom',queueIndexes:[1]}));
    runTimerWithDelay(50);
    const rollbackResult = JSON.parse(bridgeWrites.get(resultPath));
    const rollbackPublished = JSON.parse(bridgeWrites.get(queueStatePath));
    assert(rollbackResult.accepted === false &&
        rollbackResult.message.indexOf('original queue was restored') !== -1,
        'Failed queue reconstruction did not report a successful rollback');
    assert(rootQueueContents.map(item => item.Handle.Path).join(',') ===
        'C:/Rollback/one.flac,C:/Rollback/two.flac,C:/Rollback/three.flac',
        'Failed queue reconstruction did not restore the original order');
    assert(rollbackPublished.generation > rollbackState.generation &&
        rollbackPublished.entries.map(item => item.sourceId).join(',') ===
            'C:/Rollback/one.flac|0,C:/Rollback/two.flac|0,C:/Rollback/three.flac|0',
        'Failed queue reconstruction did not publish authoritative restored state');

    rootQueueContents = [
        {PlaylistIndex:6, PlaylistItemIndex:1, Handle:{Path:'C:/Rollback/one.flac',SubSong:0}},
        {PlaylistIndex:6, PlaylistItemIndex:2, Handle:{Path:'C:/Rollback/two.flac',SubSong:0}},
        {PlaylistIndex:-1, PlaylistItemIndex:-1, Handle:{Path:'C:/Rollback/three.flac',SubSong:0}}
    ];
    root.on_playback_queue_changed(0);
    const failedRollbackState = JSON.parse(bridgeWrites.get(queueStatePath));
    queueAddAttempts = 0;
    queueAddFailureAt = 2;
    queueAddFailureAt2 = 5;
    bridgeWrites.set(commandPath, JSON.stringify({version:'v2',id:'failed-rollback',
        session:failedRollbackState.session,generation:failedRollbackState.generation,
        action:'moveBottom',queueIndexes:[1]}));
    runTimerWithDelay(50);
    const failedRollbackResult = JSON.parse(bridgeWrites.get(resultPath));
    const failedRollbackPublished = JSON.parse(bridgeWrites.get(queueStatePath));
    assert(failedRollbackResult.accepted === false &&
        failedRollbackResult.message.indexOf('rollback also failed') !== -1,
        'Queue bridge did not report a failed rollback');
    assert(failedRollbackPublished.entries.length === rootQueueContents.length &&
        failedRollbackPublished.entries.map(item => item.sourceId).join(',') ===
            rootQueueContents.map(item => item.Handle.Path + '|0').join(','),
        'Failed rollback did not publish the actual partial queue state');


    function setMixedQueue() {
        rootQueueContents = [
            {PlaylistIndex:2,PlaylistItemIndex:10,Handle:{Path:'C:/Move/a.flac',SubSong:0}},
            {PlaylistIndex:-1,PlaylistItemIndex:-1,Handle:{Path:'C:/Move/b.flac',SubSong:0}},
            {PlaylistIndex:2,PlaylistItemIndex:11,Handle:{Path:'C:/Move/c.flac',SubSong:0}},
            {PlaylistIndex:-1,PlaylistItemIndex:-1,Handle:{Path:'C:/Move/d.flac',SubSong:0}},
            {PlaylistIndex:3,PlaylistItemIndex:5,Handle:{Path:'C:/Move/e.flac',SubSong:0}}
        ];
        sourceHandles.set(sourceKey(2,10), rootQueueContents[0].Handle);
        sourceHandles.set(sourceKey(2,11), rootQueueContents[2].Handle);
        sourceHandles.set(sourceKey(3,5), rootQueueContents[4].Handle);
        playlistQueueAdds = 0;
        detachedQueueAdds = 0;
        root.on_playback_queue_changed(0);
    }
    function assertMixedSources(label) {
        const expected = {
            'C:/Move/a.flac':'2:10', 'C:/Move/b.flac':'-1:-1',
            'C:/Move/c.flac':'2:11', 'C:/Move/d.flac':'-1:-1',
            'C:/Move/e.flac':'3:5'
        };
        rootQueueContents.forEach(item => {
            const actual = item.PlaylistIndex + ':' + item.PlaylistItemIndex;
            assert(actual === expected[item.Handle.Path], label + ' changed source association for ' + item.Handle.Path);
        });
        assert(playlistQueueAdds === 3 && detachedQueueAdds === 2,
            label + ' did not rebuild playlist-backed/detached entries through the correct APIs');
    }
    function sendCurrentQueueCommand(id, action, queueIndexes) {
        const current = JSON.parse(bridgeWrites.get(queueStatePath));
        bridgeWrites.set(commandPath, JSON.stringify({version:'v2',id:id,session:current.session,
            generation:current.generation,action:action,queueIndexes:queueIndexes}));
        runTimerWithDelay(50);
        assert(!bridgeWrites.has(commandPath), id + ' left a processed command file behind');
        return JSON.parse(bridgeWrites.get(resultPath));
    }

    setMixedQueue();
    assert(sendCurrentQueueCommand('move-up','moveUp',[2,3]).accepted === true,
        'Move-up command was not accepted');
    assert(rootQueueContents.map(item => item.Handle.Path).join(',') ===
        'C:/Move/b.flac,C:/Move/c.flac,C:/Move/a.flac,C:/Move/d.flac,C:/Move/e.flac',
        'Move up did not preserve adjacent selected-row order');
    assertMixedSources('Move up');

    setMixedQueue();
    assert(sendCurrentQueueCommand('move-down','moveDown',[2,3]).accepted === true,
        'Move-down command was not accepted');
    assert(rootQueueContents.map(item => item.Handle.Path).join(',') ===
        'C:/Move/a.flac,C:/Move/d.flac,C:/Move/b.flac,C:/Move/c.flac,C:/Move/e.flac',
        'Move down did not preserve adjacent selected-row order');
    assertMixedSources('Move down');

    setMixedQueue();
    assert(sendCurrentQueueCommand('move-top','moveTop',[2,4]).accepted === true,
        'Move-to-top command was not accepted');
    assert(rootQueueContents.map(item => item.Handle.Path).join(',') ===
        'C:/Move/b.flac,C:/Move/d.flac,C:/Move/a.flac,C:/Move/c.flac,C:/Move/e.flac',
        'Move to top did not preserve selected-row relative order');
    assertMixedSources('Move to top');

    setMixedQueue();
    assert(sendCurrentQueueCommand('move-bottom-all','moveBottom',[1,3]).accepted === true,
        'Move-to-bottom command was not accepted');
    assert(rootQueueContents.map(item => item.Handle.Path).join(',') ===
        'C:/Move/b.flac,C:/Move/d.flac,C:/Move/e.flac,C:/Move/a.flac,C:/Move/c.flac',
        'Move to bottom did not preserve selected-row relative order');
    assertMixedSources('Move to bottom');


    rootQueueContents = [
        {PlaylistIndex:-1,PlaylistItemIndex:-1,Handle:{Path:'C:/Q/a.flac',SubSong:0}},
        {PlaylistIndex:-1,PlaylistItemIndex:-1,Handle:{Path:'C:/Q/dup.flac',SubSong:0}},
        {PlaylistIndex:-1,PlaylistItemIndex:-1,Handle:{Path:'C:/Q/c.flac',SubSong:0}},
        {PlaylistIndex:-1,PlaylistItemIndex:-1,Handle:{Path:'C:/Q/dup.flac',SubSong:0}}
    ];
    root.on_playback_queue_changed(0);
    const multiState = JSON.parse(bridgeWrites.get('js_data\\darkonejsp3.queue-state.json'));
    bridgeWrites.set(commandPath, JSON.stringify({version:'v2',id:'remove-many',session:multiState.session,
        generation:multiState.generation,action:'removeMany',queueIndexes:[2,4]}));
    runTimerWithDelay(50);
    assert(rootQueueContents.map(item => item.Handle.Path).join(',') === 'C:/Q/a.flac,C:/Q/c.flac',
        'Root writable bridge did not remove the exact selected duplicate queue occurrences');
    const clearState = JSON.parse(bridgeWrites.get('js_data\\darkonejsp3.queue-state.json'));
    bridgeWrites.set(commandPath, JSON.stringify({version:'v2',id:'clear-all',session:clearState.session,
        generation:clearState.generation,action:'clear',queueIndexes:[]}));
    runTimerWithDelay(50);
    assert(rootQueueContents.length === 0, 'Root writable bridge did not clear the playback queue');

    function sendStartupAction(action, key, value) {
        const command = root.viewBridge.startupActionCommand(action, key, value);
        const notification = root.viewBridge.serialiseNotification(command, null);
        root.on_notify_data(root.viewBridge.notification, notification);
    }
    sendStartupAction('set', 'transition', 1);
    sendStartupAction('set', 'minimum-delay', 5000);
    sendStartupAction('set', 'readiness-timeout', 7000);
    assert(root.startupTransition() === 1, 'Transition command did not update the root');
    assert(root.startupMinimumDelay() === 5000, 'Minimum hold did not update the root');
    assert(root.startupSafetyTimeout() === 7000, 'Readiness timeout did not update the root');
    const changedStartupState = JSON.parse(bridgeWrites.get(startupStatePath)).state;
    assert([changedStartupState.transition, changedStartupState.minimumDelay,
        changedStartupState.readinessTimeout].join(',') === '1,5000,7000',
        'Changed root Startup state was not republished for TOOLS');
    root.on_size(1920, 1080);
    assert(main.visible === false && controls.visible === false, 'Black reveal did not hide root children');
    sendStartupAction('preview');
    runTimerWithDelay(5000);
    runTimerWithDelay(150);
    assert(main.visible === true && controls.visible === true, 'Preview did not honour root timing/reveal');
    sendStartupAction('restore');
    assert(root.startupTransition() === 0 && root.startupMinimumDelay() === 250 &&
        root.startupSafetyTimeout() === 2000, 'Startup defaults were not restored in the root');
    const restoredStartupState = JSON.parse(bridgeWrites.get(startupStatePath)).state;
    assert([restoredStartupState.transition, restoredStartupState.minimumDelay,
        restoredStartupState.readinessTimeout].join(',') === '0,250,2000',
        'Restored root Startup state was not republished for TOOLS');
});

suite("JS Playlist settings back arrow", function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path("user-components-x64/foo_jscript_panel3/samples/jsplaylist/settings.js"), 'utf8');
    const start = source.indexOf('function createSettingsBackArrow(colour, size) {');
    if (start < 0) throw new Error('Back-arrow helper was not found');
    const open = source.indexOf('{', start);
    let depth = 0;
    let end = -1;
    for (let i = open; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) { end = i + 1; break; }
        }
    }
    if (end < 0) throw new Error('Back-arrow helper was not closed');
    const declaration = source.slice(start, end);
    function setAlpha(colour, alpha) {
        return ((colour & 0x00ffffff) | (alpha << 24));
    }
    function render(size, baseAlpha) {
        const pixels = new Map();
        const image = {
            width: size,
            height: size,
            GetGraphics() {
                return {
                    FillRectangle(x, y, w, h, colour) {
                        if (w !== 1 || h !== 1)
                            throw new Error('Arrow rasteriser must write one pixel at a time');
                        if (![x, y, w, h, colour].every(Number.isFinite))
                            throw new Error('Arrow geometry contains a non-finite value');
                        if (x < 0 || y < 0 || x >= size || y >= size)
                            throw new Error('Arrow wrote outside its image');
                        const key = `${x},${y}`;
                        if (pixels.has(key))
                            throw new Error('Arrow wrote a destination pixel more than once');
                        pixels.set(key, colour >>> 0);
                    }
                };
            },
            ReleaseGraphics() { this.released = true; }
        };
        const utils = { CreateImage(w, h) {
            if (w !== size || h !== size)
                throw new Error('Arrow was not created at final size');
            return image;
        } };
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
        for (const value of pixels.values()) {
            const alpha = (value >>> 24) & 0xff;
            if (alpha > baseAlpha)
                throw new Error('Arrow coverage increased source opacity');
            maxAlpha = Math.max(maxAlpha, alpha);
        }
        if (maxAlpha !== baseAlpha)
            throw new Error('Arrow has no fully covered interior pixels');

        const centreY = Math.floor(size / 2);
        const centreRow = coords.filter(point => point[1] === centreY)
            .map(point => point[0]).sort((a, b) => a - b);
        if (centreRow.length < Math.floor(size * 0.65))
            throw new Error('Arrow shaft is too short');
        for (let i = 1; i < centreRow.length; i++) {
            if (centreRow[i] !== centreRow[i - 1] + 1)
                throw new Error('Arrow centre row is not a single silhouette');
        }
        return pixels;
    }
    for (const size of [25, 38, 50]) {
        const normal = render(size, 255);
        const hover = render(size, 200);
        if (normal.size !== hover.size)
            throw new Error('Normal and hover arrow geometry differs');
        for (const key of normal.keys()) {
            if (!hover.has(key))
                throw new Error('Normal and hover arrow coverage differs');
        }
    }
});

suite("InfoStack automatic tab geometry", function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path("DarkOneJSP3/jsplitter/03_info_stack_tabs.js"), 'utf8');
    const functionStart = source.indexOf('function automaticTabAreaHeight() {');
    if (functionStart < 0)
        throw new Error('automaticTabAreaHeight source was not found');
    const bodyStart = source.indexOf('{', functionStart);
    const bodyEnd = source.indexOf('\n}', bodyStart);
    if (bodyStart < 0 || bodyEnd < 0)
        throw new Error('automaticTabAreaHeight body was not found');
    const body = source.slice(bodyStart + 1, bodyEnd);
    const calculate = new Function(
        'ww', 'tabHeight', 'DOJSP3', 'window', 'FONT_PROPERTY',
        'automaticFontScale', body);
    const DOJSP3 = { idiv(a, b) { return Math.trunc(a / b); } };
    function area(scale, fixedFontSize) {
        const window = { GetProperty() { return fixedFontSize; } };
        return calculate(
            1200, 20, DOJSP3, window, 'DarkOneJSP3.InfoStack.FontSize',
            function() { return scale; });
    }
    function assert(condition, message) {
        if (!condition) throw new Error(message);
    }
    const at50 = area(50, 0);
    const at100 = area(100, 0);
    const at200 = area(200, 0);
    assert(at50 < at100 && at100 < at200,
        'Automatic tab area does not follow font base scale');
    assert(at100 === 20 + Math.trunc(1200 / 40),
        'The established 100% tab-area geometry changed');
    assert(area(50, 18) === area(200, 18),
        'Fixed font sizing incorrectly follows automatic base scale');
});

suite("AllMusic managed activation", function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path("user-components-x64/foo_jscript_panel3/samples/js/allmusic.js"), 'utf8');
    function methodBody(signature) {
        const start = source.indexOf(signature);
        if (start < 0) throw new Error('Missing method: ' + signature);
        const open = source.indexOf('{', start);
        let depth = 0;
        let quote = '';
        let escaped = false;
        for (let i = open; i < source.length; i++) {
            const ch = source[i];
            if (quote) {
                if (escaped) escaped = false;
                else if (ch === '\\') escaped = true;
                else if (ch === quote) quote = '';
                continue;
            }
            if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) return source.slice(open + 1, i);
            }
        }
        throw new Error('Unclosed method: ' + signature);
    }
    const activate = new Function('force', methodBody('this.activate_managed = function (force)'));
    const pending = new Function(methodBody('this.has_pending_work = function ()'));
    global.panel = {
        metadb: {},
        tf(value) { return value.indexOf('artist') > -1 ? 'Test Artist' : 'Test Album'; }
    };
    global._tagged = value => String(value || '').length > 0;
    function provider(overrides) {
        let callbacks = [];
        const value = {
            managed: true,
            artist: 'Test Artist',
            album: 'Test Album',
            text: '',
            status_text: '',
            state: {blocked: false},
            resolved_album_url: '',
            review_url: '',
            terminal_state: '',
            history: {stale: true},
            last_request_url: 'stale',
            mb_fallback_started: true,
            request_kinds: {},
            scheduled_request_timers: {},
            has_pending_work: pending,
            reset() { throw new Error('Unexpected reset'); },
            metadb_changed() { throw new Error('Unexpected identity reload'); },
            blocked_message() { return 'blocked'; },
            rebuild_text_layout() {},
            get() { this.request_kinds[1] = 'allmusic-search'; },
            notify_terminal(success, reason) {
                this.terminal_state = success ? 'success' : 'failure';
                callbacks.push({success, reason});
            },
            callbacks
        };
        return Object.assign(value, overrides || {});
    }
    function assert(condition, message) { if (!condition) throw new Error(message); }
    let p = provider();
    let state = activate.call(p, false);
    assert(state === 'pending', 'Idle same-album activation did not start work');
    assert(p.has_pending_work(), 'AllMusic activation did not register provider work');
    assert(!Object.prototype.hasOwnProperty.call(p.history, 'stale'),
        'Stale AllMusic search history was not cleared');
    assert(p.last_request_url === '', 'Stale AllMusic request URL was not cleared');

    p = provider({text: 'Cached review', terminal_state: 'failure'});
    state = activate.call(p, false);
    assert(state === 'success' && p.callbacks.length === 1 && p.callbacks[0].success,
        'Cached same-album review did not re-arm terminal success');

    p = provider({request_kinds: {7: 'allmusic-search'}, get() { throw new Error('Pending work restarted'); }});
    state = activate.call(p, false);
    assert(state === 'pending', 'Existing AllMusic work was not preserved');

    p = provider({
        state: {blocked: true},
        resolved_album_url: 'https://www.allmusic.com/album/test',
        history: {}
    });
    state = activate.call(p, false);
    assert(state === 'failure' && p.callbacks[0].reason === 'saved browser-verification state',
        'Saved browser-verification state did not terminate the provider');

    p = provider({history: {}, get() {}});
    state = activate.call(p, false);
    assert(state === 'failure' && p.callbacks[0].reason === 'provider did not start a request',
        'Idle provider activation did not fail closed');
});

suite("Album Art wheel debounce", function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path('user-components-x64/foo_jscript_panel3/samples/js/albumart.js'), 'utf8');
    let nextTimer = 1;
    const timers = new Map();
    let lastDelay = 0;
    let loads = [];
    let idWrites = 0;
    let bitmapDisposals = 0;
    let bitmapCreations = 0;
    let imageDisposals = 0;
    let blurCalls = 0;
    const windowMock = {
        SetTimeout(fn, delay) {
            const id = nextTimer++;
            lastDelay = delay;
            timers.set(id, fn);
            return id;
        },
        ClearTimeout(id) { timers.delete(id); },
        Repaint() {}
    };
    function runTimers() {
        const pending = Array.from(timers.entries());
        timers.clear();
        pending.forEach(entry => entry[1]());
    }
    function Property(name, value) {
        this._value = value;
        Object.defineProperty(this, 'value', {
            get: () => this._value,
            set: value => {
                if (name === '2K3.ARTREADER.ID') idWrites++;
                this._value = value;
            }
        });
        Object.defineProperty(this, 'enabled', {get: () => !!this._value});
        this.toggle = () => { this.value = !this.value; };
    }
    function makeImage(id) {
        return {
            Width: 100,
            Height: 100,
            Path: 'art-' + id + '.jpg',
            CreateBitmap() { bitmapCreations++; return {Width:100,Height:100,Dispose() { bitmapDisposals++; }}; },
            StackBlur() { blurCalls++; },
            Dispose() { imageDisposals++; }
        };
    }
    const panel = {
        display_objects: [],
        text_objects: [],
        metadb: {
            Path: 'track.flac',
            GetAlbumArt(id) { loads.push(id); return makeImage(id); },
            GetAlbumArtEmbedded(id) { return makeImage(id); },
            ShowAlbumArtViewer() {},
            ShowAlbumArtViewer2() {}
        }
    };
    const utils = {
        ReadUTF8() { return ''; },
        IsFile() { return false; },
        Run() {}
    };
    const fb = {ComponentPath: '', GetAlbumArtStub(id) { return makeImage(id); }};
    const lodash = {
        startsWith(value, prefix) { return String(value).indexOf(prefix) === 0; },
        forEach(values, callback, context) {
            for (let i = 0; i < values.length; i++) {
                if (callback.call(context, values[i], i) === false) break;
            }
        },
        capitalize(value) { return value; }
    };
    function assert(condition, message) { if (!condition) throw new Error(message); }
    const factory = new Function(
        'panel', 'window', 'utils', 'fb', '_p', 'image', '_tt',
        'VK_LEFT', 'VK_UP', 'VK_RIGHT', 'VK_DOWN', 'AlbumArtType',
        'CRLF', '_stringToArray', '_', 'RGB', '_drawImage', '_explorer',
        'MF_STRING', 'MF_GRAYED', 'CheckMenuIf', 'EnableMenuIf',
        source + '\nreturn _albumart;'
    );
    const AlbumArt = factory(
        panel, windowMock, utils, fb, Property,
        {full: 3, full_top_align: 4}, () => {},
        0x25, 0x26, 0x27, 0x28,
        {embedded: 0, default: 1, stub: 2}, '\r\n',
        value => String(value).split('_'), lodash,
        () => 0, () => {}, () => {}, 0, 1, () => 0, () => 0
    );
    const albumart = new AlbumArt(0, 0, 100, 100);
    albumart.mx = 50;
    albumart.my = 50;
    albumart.metadb_changed();
    assert(loads.join(',') === '0', 'Initial Album Art load failed');

    albumart.wheel(-1);
    albumart.wheel(-1);
    albumart.wheel(-1);
    assert(albumart.properties.id.value === 0, 'Wheel burst wrote the property before settling');
    assert(idWrites === 0, 'Wheel burst persisted intermediate artwork IDs');
    assert(loads.join(',') === '0', 'Wheel burst decoded intermediate artwork');
    assert(timers.size === 1, 'Wheel burst did not coalesce to one timer');
    assert(lastDelay === 80, 'Album Art wheel debounce is not 80 ms');
    runTimers();
    assert(albumart.properties.id.value === 3, 'Wheel burst committed the wrong final artwork ID');
    assert(idWrites === 1, 'Wheel burst did not persist exactly one final ID');
    assert(loads.join(',') === '0,3', 'Wheel burst did not decode only the final artwork');

    albumart.wheel(-1);
    assert(timers.size === 1 && albumart.pending_id === 4, 'Pending wheel selection was not staged');
    albumart.key_down(0x27);
    assert(timers.size === 0, 'Keyboard selection did not cancel pending wheel work');
    assert(albumart.properties.id.value === 0, 'Keyboard selection did not apply immediately');
    assert(loads[loads.length - 1] === 0, 'Keyboard selection did not load immediately');

    albumart.wheel(-1);
    assert(timers.size === 1, 'Track-change cancellation test did not stage a timer');
    albumart.metadb_changed();
    assert(timers.size === 0 && albumart.pending_id === -1,
           'Metadata change did not cancel pending wheel work');
    const loadsAfterMetadataChange = loads.length;
    runTimers();
    assert(loads.length === loadsAfterMetadataChange,
           'Cancelled wheel work ran after metadata change');

    for (let i = 0; i < 5; i++) albumart.wheel(-1);
    const loadsBeforeNoopCommit = loads.length;
    runTimers();
    assert(loads.length === loadsBeforeNoopCommit,
           'A full wheel cycle unnecessarily reloaded the current artwork');

    albumart.wheel(-1);
    const disposalsBeforeUnload = bitmapDisposals;
    albumart.dispose();
    assert(timers.size === 0 && albumart.pending_id === -1,
           'Album Art dispose did not clear pending wheel work');
    assert(bitmapDisposals === disposalsBeforeUnload + 1 &&
           albumart.bitmap.normal === null && albumart.bitmap.blur === null,
           'Album Art unload did not dispose its active Direct2D bitmaps');


    // Blur generation must be lazy: metadata changes create only the normal bitmap,
    // paint-time demand schedules one trailing blur, and unload cancels pending work.
    panel.text_objects = [{name: 'allmusic'}];
    const reviewArt = new AlbumArt(0, 0, 100, 100);
    reviewArt.metadb_changed();
    assert(reviewArt.bitmap.normal && !reviewArt.bitmap.blur && reviewArt.blur_source,
           'Review Album Art did not retain a lazy blur source');
    assert(blurCalls === 0, 'Album Art blurred synchronously during metadata change');
    const creationsBeforeBlur = bitmapCreations;
    // Legacy stored review entries rely on albumart.paint() itself to request
    // the blurred backing; repeated paints must still coalesce to one task.
    reviewArt.paint({});
    reviewArt.paint({});
    assert(timers.size === 1 && lastDelay === 1,
           'Repeated blur demand did not coalesce to one deferred task');
    runTimers();
    assert(blurCalls === 1 && bitmapCreations === creationsBeforeBlur + 1 && reviewArt.bitmap.blur,
           'Deferred Album Art blur was not generated exactly once');
    const reviewBitmapDisposals = bitmapDisposals;
    reviewArt.dispose();
    assert(bitmapDisposals === reviewBitmapDisposals + 2 &&
           reviewArt.bitmap.normal === null && reviewArt.bitmap.blur === null,
           'Review Album Art did not dispose normal and blurred bitmaps');

    const cancelledBlur = new AlbumArt(0, 0, 100, 100);
    cancelledBlur.metadb_changed();
    cancelledBlur.ensure_blur();
    const blurBeforeCancel = blurCalls;
    cancelledBlur.dispose();
    runTimers();
    assert(blurCalls === blurBeforeCancel && cancelledBlur.blur_source === null,
           'Album Art unload did not cancel pending lazy blur work');
});
