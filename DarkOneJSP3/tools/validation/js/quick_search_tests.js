"use strict";

// Registered with harness.js and executed in isolated VM contexts.

suite("scripted Quick Search state", function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path("DarkOneJSP3/jscript/js/Quick_Search.js"), 'utf8');
    const colourSource = fs.readFileSync(__path("DarkOneJSP3/shared/colour_utils.js"), 'utf8');
    const protocolSource = fs.readFileSync(__path("DarkOneJSP3/shared/jsplitter_protocols.js"), 'utf8');
    function assert(condition, message) { if (!condition) throw new Error(message); }
    String.prototype.calc_width2 = function() { return this.length * 8; };
    const properties = new Map();
    const writes = [];
    const quickTimers = [];
    function quickSetTimeout(fn, delay) { quickTimers.push({fn, delay, active:true}); return quickTimers.length; }
    function quickClearTimeout(id) { if (id > 0 && id <= quickTimers.length) quickTimers[id - 1].active = false; }
    const windowMock = {
        Name: 'Quick Search test', IsDefaultUI: false, Width: 300, Height: 60,
        GetProperty(name, fallback) { return properties.has(name) ? properties.get(name) : fallback; },
        SetProperty(name, value) { properties.set(name, value); },
        GetColourCUI(index) { return index === 3 ? 0xff1e1e1e : 0xffdcdcdc; },
        GetFontCUI() { return JSON.stringify({Name:'Segoe UI',Size:12,Weight:400,Style:0,Stretch:5}); },
        Repaint() {}, RepaintRect() {}, SetCursor() {},
        SetTimeout: quickSetTimeout, ClearTimeout: quickClearTimeout,
        ClearInterval() {}, SetInterval() { return 1; }
    };
    const utilsMock = {
        IsFile() { return false; }, CreateFolder() { return true; },
        ReadTextFile() { throw new Error('no runtime state file'); },
        WriteTextFile(path, content) { writes.push([path, content]); return true; },
        CreateTextLayout() { return {CalcTextHeight() { return 18; }, Dispose() {}}; },
        IsKeyPressed() { return false; }
    };
    function HandleList(items) { this.items = items || []; Object.defineProperty(this, 'Count', {get:()=>this.items.length}); }
    HandleList.prototype.GetItem = function(index) { return this.items[index]; };
    HandleList.prototype.AddItem = function(item) { this.items.push(item); };
    HandleList.prototype.GetQueryItems = function(query) { return new HandleList(this.items.slice()); };
    HandleList.prototype.Dispose = function() {};
    let nextPlaylistGuid = 4;
    const playlists = [
        {name:'Quick Search',guid:'guid-1',items:['old'],lock:null},
        {name:'Other Results',guid:'guid-2',items:[],lock:null},
        {name:'External',guid:'guid-3',items:[],lock:{owner:'JScript Panel 3',mask:31}}
    ];
    const plmanMock = {
        ActivePlaylist: 0,
        get PlaylistCount() { return playlists.length; },
        GetPlaylistName(index) { return playlists[index].name; },
        GetGUID(index) { return playlists[index].guid; },
        FindByGUID(guid) { return playlists.findIndex(p => p.guid === guid); },
        IsPlaylistLocked(index) { return !!playlists[index].lock; },
        GetPlaylistLockName(index) { return playlists[index].lock ? playlists[index].lock.owner : ''; },
        GetPlaylistLockFilterMask(index) { return playlists[index].lock ? playlists[index].lock.mask : 0; },
        AddPlaylistLock(index, mask) { if (playlists[index].lock) return false; playlists[index].lock={owner:'JScript Panel 3',mask}; return true; },
        RemovePlaylistLock(index) { if (!playlists[index].lock || playlists[index].lock.owner !== 'JScript Panel 3') return false; playlists[index].lock=null; return true; },
        CreatePlaylist(index, name) { playlists.splice(index,0,{name,guid:'guid-'+(nextPlaylistGuid++),items:[],lock:null}); return index; },
        ClearPlaylist(index) { if (playlists[index].lock && (playlists[index].lock.mask & 2)) throw new Error('locked remove'); playlists[index].items=[]; },
        InsertPlaylistItems(index, base, handles) { if (playlists[index].lock && (playlists[index].lock.mask & 1)) throw new Error('locked add'); playlists[index].items = handles.items.slice(); },
        UndoBackup() {}, ClearPlaylistSelection() {}, SetPlaylistSelectionSingle() {}, SetPlaylistFocusItem() {},
        IsAutoPlaylist() { return false; }
    };
    const fbMock = {ProfilePath:'P:/', CreateHandleList() { return new HandleList(); }, GetLibraryItems() { return new HandleList(); }};
    function RGB(r,g,b) { return (0xff000000 | (r<<16) | (g<<8) | b); }
    function setAlpha(value) { return value; }
    function blendColours(value) { return value; }
    const cInputbox = {cursor_state:false,cursor_interval:false};
    function oInputbox(w,h,text,empty,func) {
        this.w=w; this.h=h; this.text=text; this.empty_text=empty; this.default_text=text; this.func=func;
        this.Cpos=0; this.SelBegin=0; this.SelEnd=0; this.offset=0; this.edit=false;
        this.on_key_down=function(){}; this.on_char=function(){}; this.check=function(){};
        this.resetCursorTimer=function(){}; this.GetCx=function(pos){return pos*8;}; this.CalcText=function(){};
    }
    const factory = new Function(
        'window','plman','fb','utils','RGB','setAlpha','blendColours','oInputbox','cInputbox','console',
        colourSource + '\n' + protocolSource + '\n' +
        'var g_font_12 = JSON.stringify({Name:"Segoe UI",Size:12,Weight:400,Style:0,Stretch:5});' + source + '\nreturn { QuickSearch: DarkOneQuickSearch, Protocol: DarkOneProtocol };'
    );
    const quickApi = factory(windowMock,plmanMock,fbMock,utilsMock,RGB,setAlpha,blendColours,oInputbox,cInputbox,console);
    const QuickSearch = quickApi.QuickSearch;
    const qs = new QuickSearch();
    assert(qs.queryFilter(new HandleList(['extended']), '%artist% IS x').Count === 1,
        'Extended query path did not use IMetadbHandleList.GetQueryItems');

    // Recommended lock defaults must protect the reusable Standard results
    // playlist while still allowing Quick Search itself to refresh it.
    qs.setStandardLockMask(31);
    assert(qs.outputPlaylistName(0, 'radiohead') === 'Quick Search',
        'Append-query naming leaked into the reusable Standard results playlist');
    assert(qs.outputPlaylistName(1, 'radiohead') === 'Search Results [radiohead]',
        'New playlist query suffix naming regressed');
    assert(playlists[0].lock && playlists[0].lock.mask === 31, 'Quick Search did not apply the recommended Standard-results lock');
    assert(qs.properties.standardLockOwned && qs.properties.standardLockTarget === 'Quick Search' && qs.properties.standardLockGuid === 'guid-1',
        'Quick Search did not persist GUID-backed Standard lock ownership');
    qs.setStandardLockMask(15);
    assert(playlists[0].lock && playlists[0].lock.mask === 15 && qs.properties.standardLockOwned,
        'Changing the Standard lock mask did not replace the owned lock safely');
    qs.setStandardLockMask(31);
    assert(playlists[0].lock && playlists[0].lock.mask === 31 && qs.properties.standardLockOwned,
        'Restoring the recommended Standard lock mask failed');
    qs.feedPlaylist(new HandleList(['a','b']), 'Quick Search', false);
    assert(playlists[0].items.join(',') === 'a,b' && playlists[0].lock && playlists[0].lock.mask === 31, 'Locked Standard results playlist could not refresh safely');
    assert(playlists.filter(p => p.name === 'Quick Search').length === 1, 'Standard results refresh created a duplicate target playlist');
    // A same-playlist lock that is still reported as JScript Panel 3 but no
    // longer has our expected mask may have been replaced by another JSP3 panel.
    // Never remove or claim it.
    playlists[0].lock = {owner:'JScript Panel 3',mask:1};
    qs.syncStandardPlaylistLock();
    assert(playlists[0].lock && playlists[0].lock.mask === 1 && !qs.properties.standardLockOwned,
        'Quick Search claimed or replaced a mismatched JSP3 lock on its former playlist');
    playlists[0].lock = null;
    qs.setStandardLockMask(31);
    assert(playlists[0].lock && playlists[0].lock.mask === 31 && qs.properties.standardLockOwned,
        'Quick Search did not recover its Standard lock after the external lock was removed');
    // A valid zero-match Standard search must clear stale results rather than
    // leaving the previous successful search visible.
    qs.searchHandles = function() { return new HandleList([]); };
    qs.input.text = 'definitely-no-match';
    qs.input.default_text = qs.input.text;
    qs.save('resultMode', 0);
    assert(qs.execute({}) === true, 'Zero-match Standard search was treated as an execution failure');
    assert(playlists[0].items.length === 0 && playlists[0].lock && playlists[0].lock.mask === 31,
        'Zero-match Standard search left stale results or lost its lock');

    // Result modes are persistent configuration, not one-shot commands.
    qs.setResultMode(1);
    assert(qs.properties.resultMode === 1 && properties.get('DARKONEJSP3.QUICKSEARCH.RESULT.MODE') === 1, 'New playlist result mode did not persist');
    qs.feedPlaylist(new HandleList(['c']), 'Search Results [c]', true);
    assert(qs.properties.resultMode === 1, 'Creating a new playlist reset the saved Results mode');

    // Global factory-reset scopes must not collapse into a destructive complete
    // Quick Search reset. Appearance leaves behaviour/user data alone; behaviour
    // leaves appearance and user data alone.
    qs.properties.history = [{text:'keep me'}];
    qs.save('showPlaceholder', false);
    qs.resetConfiguration('appearance');
    assert(qs.properties.showPlaceholder === true && qs.properties.resultMode === 1,
        'Appearance-only Quick Search reset changed Results behaviour');
    assert(qs.properties.history.length === 1, 'Appearance-only Quick Search reset cleared user history');
    qs.save('showPlaceholder', false);
    qs.resetConfiguration('behaviour');
    assert(qs.properties.resultMode === 0 && qs.properties.showPlaceholder === false,
        'Behaviour-only Quick Search reset changed appearance state');
    assert(qs.properties.history.length === 1, 'Behaviour-only Quick Search reset cleared user history');

    // Changing the target must release the exact old Quick Search-owned lock and
    // must not transfer a generic JScript Panel 3 ownership flag to another lock.
    qs.releaseOwnedStandardLockForTarget('Quick Search');
    qs.save('targetPlaylist', 'Other Results');
    qs.syncStandardPlaylistLock();
    let quickIndex = playlists.findIndex(p => p.name === 'Quick Search');
    let otherIndex = playlists.findIndex(p => p.name === 'Other Results');
    let externalIndex = playlists.findIndex(p => p.name === 'External');
    assert(quickIndex >= 0 && otherIndex >= 0 && !playlists[quickIndex].lock && playlists[otherIndex].lock && playlists[otherIndex].lock.mask === 31,
        'Changing target playlist left the old Quick Search lock behind');
    assert(qs.properties.standardLockTarget === 'Other Results' && qs.properties.standardLockGuid === 'guid-2',
        'Standard lock ownership identity did not follow the configured target');
    // If renaming is explicitly allowed by the configured lock mask, the stable
    // playlist GUID must still let Quick Search release its old managed lock.
    playlists[otherIndex].name = 'Renamed Results';
    qs.save('targetPlaylist', 'Quick Search');
    qs.syncStandardPlaylistLock();
    otherIndex = playlists.findIndex(p => p.name === 'Renamed Results');
    quickIndex = playlists.findIndex(p => p.name === 'Quick Search');
    assert(otherIndex >= 0 && !playlists[otherIndex].lock && playlists[quickIndex].lock,
        'GUID-backed lock ownership stranded a lock after the Standard playlist was renamed');
    qs.releaseOwnedStandardLockForTarget('Quick Search');
    qs.save('targetPlaylist', 'External');
    qs.syncStandardPlaylistLock();
    externalIndex = playlists.findIndex(p => p.name === 'External');
    assert(externalIndex >= 0 && playlists[externalIndex].lock && playlists[externalIndex].lock.owner === 'JScript Panel 3' && playlists[externalIndex].lock.mask === 31,
        'Quick Search altered a JScript Panel lock it did not own');
    assert(!qs.properties.standardLockOwned && qs.properties.standardLockTarget === '', 'External lock was incorrectly claimed as Quick Search-owned');

    // Reset must also clean up a custom target lock before returning to defaults.
    qs.save('targetPlaylist', 'Renamed Results');
    qs.syncStandardPlaylistLock();
    otherIndex = playlists.findIndex(p => p.name === 'Renamed Results');
    assert(otherIndex >= 0 && playlists[otherIndex].lock, 'Pre-reset custom target lock was not established');
    qs.resetConfiguration();
    otherIndex = playlists.findIndex(p => p.name === 'Renamed Results');
    quickIndex = playlists.findIndex(p => p.name === 'Quick Search');
    assert(otherIndex >= 0 && !playlists[otherIndex].lock, 'Reset left a Quick Search-owned lock on the previous target playlist');
    assert(qs.properties.targetPlaylist === 'Quick Search' && quickIndex >= 0 && playlists[quickIndex].lock && playlists[quickIndex].lock.mask === 31,
        'Reset did not restore and protect the default Standard results playlist');

    // The final fixed-file custom PNG model must contain no external-process or
    // file-dialog machinery, and unavailable custom artwork must fall back cleanly.
    assert(source.indexOf('quicksearch.png') !== -1 && source.indexOf('RunCmdAsync') === -1 && source.indexOf('powershell') === -1,
        'Quick Search custom PNG path regressed to external file-picker machinery');
    assert(qs.properties.lines === 2 && qs.properties.showPlaceholder === true, 'Quick Search reset/default appearance values regressed');
    // Shared background palette: Transparent must follow the live Bottom-area
    // backing while Error retains its separate semantic default.
    qs.setBackgroundColourMode('normalBackgroundMode', quickApi.Protocol.bottomArea.modes.transparent, false);
    qs.parentBackgroundChanged(quickApi.Protocol.bottomArea.serialiseState(
        quickApi.Protocol.bottomArea.state(
            3, 0xff123456, false, 4, 0xff000000, true, 0
        )
    ));
    assert((qs.colours.background >>> 0) === 0xff123456,
        'Quick Search Transparent normal background did not inherit the live Bottom-area custom colour');
    qs.setBackgroundColourMode('errorBackgroundMode', quickApi.Protocol.bottomArea.modes.transparent, true);
    qs.lastSuccess = false;
    qs.applyInputColours();
    assert((qs.colours.errorBackground >>> 0) === 0xff123456,
        'Quick Search Transparent error background did not inherit the live Bottom-area custom colour');
    const qsCommit = quickApi.Protocol.bottomArea.commit(
        'quick-sync', Date.now(), Date.now() + 50,
        quickApi.Protocol.bottomArea.state(
            1, 0xff000000, false, 4, 0xff000000, true, 0
        )
    );
    qs.parentBackgroundCommit(quickApi.Protocol.bottomArea.serialiseCommit(qsCommit));
    assert((qs.colours.background >>> 0) === 0xff123456,
        'Quick Search exposed inherited parent colour before coordinated applyAt');
    const quickApplyTimer = [...quickTimers].reverse().find(item => item.active);
    assert(!!quickApplyTimer, 'Quick Search did not schedule coordinated inherited-background apply');
    quickApplyTimer.active = false;
    quickApplyTimer.fn();
    assert((qs.colours.background >>> 0) === 0xff000000,
        'Quick Search did not adopt inherited parent colour at coordinated apply time');
    qs.setBackgroundColourMode('errorBackgroundMode', 6, true);
    assert((qs.colours.errorBackground >>> 0) === 0xff581f1f,
        'Quick Search semantic Error background default changed');
});

suite("JS Playlist Quick Search bridge", function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path('user-components-x64/foo_jscript_panel3/samples/jsplaylist/playlist.js'), 'utf8').split('function oGroup', 1)[0];
    function assert(condition, message) { if (!condition) throw new Error(message); }
    let fileText = '';
    let notified = null;
    const fb = {ProfilePath:'P:/profile/'};
    const utils = {
        IsFile() { return !!fileText; },
        ReadTextFile() { return fileText; }
    };
    const values = {'%artist%':'Radiohead','%album%':'','%title%':'Everything in Its Right Place'};
    function get_tfo(expression) { return {EvalWithMetadb() { return values[expression] || ''; }}; }
    const window = {NotifyOthers(name, payload) { notified = {name:name,payload:payload}; }};
    const factory = new Function('fb','utils','get_tfo','window', source + '\nreturn {tags:jsplaylist_quicksearch_context_tags,value:jsplaylist_quicksearch_context_value,notify:jsplaylist_quicksearch_notify};');
    const bridge = factory(fb,utils,get_tfo,window);
    assert(bridge.tags().length === 0, 'Standalone JS Playlist exposed Quick Search context items without a bridge file');
    fileText = '{bad json';
    assert(bridge.tags().length === 0, 'Malformed Quick Search context bridge data was accepted');
    fileText = JSON.stringify([
        {name:'Artist',value:'%artist%'},
        {name:'artist',value:'%title%'},
        {name:'Fallback',value:'%album%|%title%'},
        {name:'',value:'%genre%'}
    ]);
    const tags = bridge.tags();
    assert(tags.length === 2 && tags[0].name === 'Artist' && tags[1].name === 'Fallback',
        'Quick Search context tags were not sanitised/deduplicated');
    assert(bridge.value({}, tags[0]) === 'Radiohead', 'Single-field Search for same value did not evaluate');
    assert(bridge.value({}, tags[1]) === 'Everything in Its Right Place',
        'Multi-field Search for same did not select the first non-empty configured expression');
    assert(bridge.notify(tags[0], 'Radiohead'), 'Search for same notification failed');
    assert(notified && notified.name === 'DarkOneJSP3.QuickSearch.SearchForSame', 'Search for same used the wrong notification');
    const payload = JSON.parse(notified.payload);
    assert(payload.text === 'Radiohead' && payload.tagName === 'Artist', 'Search for same payload was malformed');
});
