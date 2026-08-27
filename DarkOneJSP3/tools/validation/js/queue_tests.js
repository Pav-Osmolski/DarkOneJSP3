"use strict";

// Registered with harness.js and executed in isolated VM contexts.

suite("Queue Viewer interaction", function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path("DarkOneJSP3/jscript/js/Queue_Viewer.js"), 'utf8');
    let pressed = {};
    let clipboard = '';
    let played = null;
    let focused = null;
    let propertiesRuns = 0;
    let explored = '';
    const sourceItems = [
        {Path: 'C:/Music/a.flac'},
        {Path: 'C:/Music/b.flac'},
        {Path: 'C:/Music/c.flac'},
        {Path: 'C:/Music/d.flac'}
    ];
    function HandleList(initial) {
        this.items = initial ? initial.slice() : [];
        Object.defineProperty(this, 'Count', {get: () => this.items.length});
    }
    HandleList.prototype.AddItem = function(handle) { this.items.push(handle); };
    HandleList.prototype.GetItem = function(index) { return this.items[index]; };
    HandleList.prototype.RunContextCommand = function(command) {
        if (command === 'Properties') { propertiesRuns++; return true; }
        return false;
    };
    HandleList.prototype.Dispose = function() {};
    const playlistItems = new HandleList(sourceItems);
    const panel = {
        list_objects: [], row_height: 20,
        fonts: {normal: {}}, colours: {text: 1, highlight: 2},
        m: {AppendMenuItem() {}, AppendMenuSeparator() {}}
    };
    const windowMock = {
        Name: 'Queue', RepaintRect() {}, Repaint() {}, SetCursor() {},
        SetTimeout() { return 1; }, ClearTimeout() {}
    };
    const plman = {
        PlaylistCount: 1, ActivePlaylist: 0,
        GetPlaylistItemCount() { return sourceItems.length; },
        GetPlaylistItems() { return playlistItems; },
        ClearPlaylistSelection() {}, SetPlaylistSelectionSingle() {},
        SetPlaylistFocusItem(playlist, item) { focused = [playlist, item]; },
        ExecutePlaylistDefaultAction(playlist, item) { played = [playlist, item]; }
    };
    const fb = {
        CreateHandleList(handle) { return new HandleList(handle ? [handle] : []); },
        TitleFormat() { return {EvalPlaylistItem() { return ''; }}; }
    };
    const utils = {
        IsKeyPressed(key) { return !!pressed[key]; },
        SetClipboardText(value) { clipboard = value; },
        IsFile(path) { return !!path; }, InputBox() { return ''; }
    };
    function ScrollButton() {
        this.lbtn_up = function() {};
        this.move = function() { return false; };
        this.paint = function() {};
    }
    function assert(condition, message) { if (!condition) throw new Error(message); }
    const factory = new Function(
        'panel', 'window', 'plman', 'fb', 'utils', '_scale', '_sb', 'chars', '_',
        'setAlpha', 'EnableMenuIf', 'MF_STRING', 'VK_CONTROL', 'VK_SHIFT',
        'VK_UP', 'VK_DOWN', 'VK_HOME', 'VK_END', 'VK_PGUP', 'VK_PGDN',
        'VK_RETURN', 'VK_ESCAPE', 'IDC_ARROW', 'DWRITE_TEXT_ALIGNMENT_CENTER',
        'DWRITE_PARAGRAPH_ALIGNMENT_CENTER', 'DWRITE_WORD_WRAPPING_NO_WRAP',
        'DWRITE_TRIMMING_GRANULARITY_CHARACTER', 'DWRITE_TEXT_ALIGNMENT_LEADING',
        '_p', 'console', '_explorer', source + '\nreturn _queue_viewer;'
    );
    const QueueViewer = factory(
        panel, windowMock, plman, fb, utils, value => value, ScrollButton,
        {up: 'u', down: 'd'}, {bind: (fn, context) => fn.bind(context)},
        colour => colour, () => 0, 0, 0x11, 0x10, 0x26, 0x28, 0x24, 0x23,
        0x21, 0x22, 0x0d, 0x1b, 0, 0, 0, 0, 0, 0,
        function(name, value) { this.value = value; }, console,
        path => { explored = path; }
    );
    const queue = new QueueViewer(0, 0, 200, 200);
    queue.rows = 4;
    queue.data = [
        {queue_index: 1, playlist_index: 0, playlist_item_index: 0, text: 'A'},
        {queue_index: 2, playlist_index: 0, playlist_item_index: 1, text: 'B'},
        {queue_index: 3, playlist_index: 0, playlist_item_index: 2, text: 'C'},
        {queue_index: 4, playlist_index: 0, playlist_item_index: 3, text: 'D'}
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
    pressed = {};
    assert(queue.selected_indices.join(',') === '0,1,2,3', 'Queue Ctrl+A failed');
    queue.key_down(0x1b);
    assert(queue.selected_indices.length === 0, 'Queue Escape did not clear selection');
    queue.select_only(1);
    queue.key_down(0x28);
    assert(queue.selected_index === 2, 'Queue Down navigation failed');
    pressed[0x10] = true;
    queue.key_down(0x26);
    pressed = {};
    assert(queue.selected_indices.join(',') === '1,2', 'Queue Shift+Up range failed');
    queue.copy_titles();
    assert(clipboard === 'B\r\nC', 'Queue title copying failed');
    queue.copy_paths();
    assert(clipboard === 'C:/Music/b.flac\r\nC:/Music/c.flac', 'Queue path copying failed');
    queue.show_properties();
    assert(propertiesRuns === 1, 'Queue Properties command failed');
    queue.play_row(2);
    assert(played && played[1] === 2, 'Queue source playback failed');
    queue.focus_row(1);
    assert(focused && focused[1] === 1, 'Queue source navigation failed');
    queue.open_containing_folder();
    assert(explored === 'C:/Music/b.flac', 'Queue containing-folder command failed');
    queue.lbtn_dblclk(10, 12 + (2 * panel.row_height) + 1);
    assert(focused && focused[1] === 2,
        'Standalone Queue Viewer double-click no longer focuses the source item');
    const snapshot = queue.capture_selection();
    queue.selected_indices = [];
    queue.selected_index = -1;
    queue.restore_selection(snapshot);
    assert(queue.selected_indices.join(',') === '1,2', 'Queue selection restore failed');
});

suite("Queue Viewer fallback scan", function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path("DarkOneJSP3/jscript/js/Queue_Viewer.js"), 'utf8');
    function assert(condition, message) { if (!condition) throw new Error(message); }
    let timers = new Map();
    let nextTimer = 1;
    let timerDelays = [];
    const windowMock = {
        Name: 'Queue', RepaintRect() {}, Repaint() {}, SetCursor() {},
        SetTimeout(fn, delay) {
            const id = nextTimer++;
            timers.set(id, fn);
            timerDelays.push(delay);
            return id;
        },
        ClearTimeout(id) { timers.delete(id); }
    };
    function runOneTimer() {
        const item = timers.entries().next();
        if (item.done) return false;
        const id = item.value[0];
        const fn = item.value[1];
        timers.delete(id);
        fn();
        return true;
    }
    function drainTimers(limit, onStep) {
        let count = 0;
        while (runOneTimer()) {
            count++;
            if (onStep) onStep();
            if (count > limit) throw new Error('Queue Viewer timer loop did not settle');
        }
    }
    const playlists = [[], [], []];
    for (let p = 0; p < 3; p++) {
        for (let i = 0; i < 40; i++) {
            playlists[p].push({
                Path: `C:/P${p}/${i}.flac`, SubSong: 0,
                text: `P${p}-${i}`, queue: ''
            });
        }
    }
    playlists[0][10].queue = '2';
    playlists[1][5].queue = '1,3';
    let getPlaylistItemsCalls = 0;
    let evaluatedPlaylists = [];
    function HandleList(items) {
        this.items = items || [];
        Object.defineProperty(this, 'Count', {get: () => this.items.length});
    }
    HandleList.prototype.GetItem = function(index) { return this.items[index]; };
    HandleList.prototype.AddItem = function(item) { this.items.push(item); };
    HandleList.prototype.Dispose = function() {};
    HandleList.prototype.RunContextCommand = function() { return true; };
    const plman = {
        PlaylistCount: 3,
        ActivePlaylist: 1,
        GetPlaylistItemCount(index) { return playlists[index].length; },
        GetPlaylistName(index) { return `Playlist ${index}`; },
        GetPlaylistItems(index) {
            getPlaylistItemsCalls++;
            return new HandleList(playlists[index]);
        },
        ClearPlaylistSelection() {}, SetPlaylistSelectionSingle() {},
        SetPlaylistFocusItem() {}, ExecutePlaylistDefaultAction() {}
    };
    function currentQueueTotal() {
        const seen = new Set();
        for (const playlist of playlists) {
            for (const item of playlist) {
                for (const value of String(item.queue || '').match(/\d+/g) || []) seen.add(Number(value));
            }
        }
        return seen.size;
    }
    const fb = {
        CreateHandleList(handle) { return new HandleList(handle ? [handle] : []); },
        TitleFormat(format) {
            return {EvalPlaylistItem(playlist, itemIndex) {
                const item = playlists[playlist][itemIndex];
                if (format === '[%queue_indexes%]') {
                    evaluatedPlaylists.push(playlist);
                    return item.queue;
                }
                if (format === '[%queue_total%]') return item.queue ? String(currentQueueTotal()) : '';
                if (format === '%path%|%subsong%') return item.Path + '|' + item.SubSong;
                return item.text;
            }};
        }
    };
    const panel = {
        list_objects: [], row_height: 20,
        fonts: {normal: {}}, colours: {text: 1, highlight: 2},
        m: {AppendMenuItem() {}, AppendMenuSeparator() {}}
    };
    const utils = {
        IsKeyPressed() { return false; }, SetClipboardText() {},
        IsFile() { return true; }, InputBox() { return ''; }
    };
    function ScrollButton() {
        this.lbtn_up = function() {};
        this.move = function() { return false; };
        this.paint = function() {};
    }
    const factory = new Function(
        'panel', 'window', 'plman', 'fb', 'utils', '_scale', '_sb', 'chars', '_',
        'setAlpha', 'EnableMenuIf', 'MF_STRING', 'VK_CONTROL', 'VK_SHIFT',
        'VK_UP', 'VK_DOWN', 'VK_HOME', 'VK_END', 'VK_PGUP', 'VK_PGDN',
        'VK_RETURN', 'VK_ESCAPE', 'IDC_ARROW', 'DWRITE_TEXT_ALIGNMENT_CENTER',
        'DWRITE_PARAGRAPH_ALIGNMENT_CENTER', 'DWRITE_WORD_WRAPPING_NO_WRAP',
        'DWRITE_TRIMMING_GRANULARITY_CHARACTER', 'DWRITE_TEXT_ALIGNMENT_LEADING',
        '_p', 'console', '_explorer', 'PlaybackQueueOrigin',
        source + '\nreturn _queue_viewer;'
    );
    const QueueViewer = factory(
        panel, windowMock, plman, fb, utils, value => value, ScrollButton,
        {up: 'u', down: 'd'}, {bind: (fn, context) => fn.bind(context)},
        colour => colour, () => 0, 0, 0x11, 0x10, 0x26, 0x28, 0x24, 0x23,
        0x21, 0x22, 0x0d, 0x1b, 0, 0, 0, 0, 0, 0,
        function(name, value) { this.value = value; }, console, () => {},
        {user_added: 0, user_removed: 1, playback_advance: 2}
    );
    const queue = new QueueViewer(0, 0, 200, 200);
    queue.rows = 5;
    queue.data = [{
        queue_index: 1, playlist_index: 0, playlist_item_index: 10,
        source_id: 'C:/P0/10.flac|0', text: 'old'
    }];
    queue.count = 1;
    queue.has_scanned = true;
    queue.dirty = false;
    const realNow = Date.now;
    let fakeNow = 0;
    Date.now = () => fakeNow++;
    queue.update(true);
    let progressiveResultSeen = false;
    drainTimers(10000, () => {
        if (queue.scanning && queue.count > 0) progressiveResultSeen = true;
    });
    Date.now = realNow;
    assert(getPlaylistItemsCalls === 0,
           'Queue Viewer full scan allocated complete playlist handle lists');
    assert(evaluatedPlaylists[0] === 0,
           'Queue Viewer did not prioritise the previous source playlist');
    assert(evaluatedPlaylists.indexOf(1) !== -1 && evaluatedPlaylists.indexOf(2) === -1,
           'Queue Viewer did not stop after %queue_total% confirmed all queue entries');
    assert(queue.data.map(row => row.queue_index).join(',') === '1,2,3',
           'Queue Viewer full discovery rows were incorrect');
    assert(progressiveResultSeen,
           'Queue Viewer did not publish queue rows before full-scan completion');
    assert(timerDelays.slice(1).every(delay => delay === 1),
           'Queue Viewer incremental scan did not use a 1 ms yield');
    assert(queue.playlist_snapshot.length === 3,
           'Queue Viewer did not retain its playlist topology snapshot');

    playlists[0][10].queue = '';
    playlists[1][5].queue = '1,2';
    evaluatedPlaylists = [];
    timerDelays = [];
    queue.playback_queue_changed(1);
    assert(!queue.dirty && timers.size === 0,
           'Queue removal did not use the targeted refresh path');
    assert(queue.data.map(row => row.queue_index).join(',') === '1,2',
           'Queue removal targeted refresh produced incorrect rows');
    assert(evaluatedPlaylists.length === 2,
           'Queue removal scanned more than the two unique cached sources');

    playlists[1][5].queue = '1';
    evaluatedPlaylists = [];
    queue.playback_queue_changed(2);
    assert(!queue.dirty && queue.data.map(row => row.queue_index).join(',') === '1',
           'Playback advance did not update cached sources immediately');
    assert(evaluatedPlaylists.length === 1,
           'Playback advance did not deduplicate cached source locations');

    playlists[2][3].queue = '2';
    evaluatedPlaylists = [];
    queue.playback_queue_changed(0);
    assert(queue.dirty, 'User-added queue item did not require discovery');
    queue.on_visible_paint();
    Date.now = () => fakeNow++;
    drainTimers(10000);
    Date.now = realNow;
    assert(queue.data.map(row => row.queue_index).join(',') === '1,2',
           'User-added queue item was not discovered by a full scan');

    playlists[1][5].Path = 'C:/P1/replaced.flac';
    queue.playback_queue_changed(1);
    assert(queue.dirty,
           'Stale cached source identity did not fall back to a full scan');

    queue.on_visible_paint();
    Date.now = () => fakeNow++;
    assert(runOneTimer(), 'Queue Viewer did not start the stale-cache recovery scan');
    playlists[2].push({Path: 'C:/P2/new.flac', SubSong: 0, text: 'new', queue: ''});
    drainTimers(10000);
    Date.now = realNow;
    assert(queue.dirty && !queue.scanning,
           'Playlist changes during a scan were not rejected for a clean restart');
    queue.on_visible_paint();
    Date.now = () => fakeNow++;
    drainTimers(10000);
    Date.now = realNow;
    assert(!queue.dirty && queue.playlist_snapshot[2].slice(-2) === '41',
           'Queue Viewer did not recover with a fresh playlist snapshot');

    assert(!queue.bridge_mode && !queue.bridge_writable && !queue.remove_selected_from_queue(),
           'Standalone Queue Viewer unexpectedly exposed writable queue mutations');
});

suite("Queue Viewer direct bridge", function () {
    const fs = require('fs');
    const protocolSource = fs.readFileSync(__path("DarkOneJSP3/shared/queue_bridge.js"), 'utf8');
    const queueSource = fs.readFileSync(__path("DarkOneJSP3/jscript/js/Queue_Viewer.js"), 'utf8');
    function assert(condition, message) { if (!condition) throw new Error(message); }
    let timers = new Map();
    let nextTimer = 1;
    const windowMock = {
        Name: 'Queue', RepaintRect() {}, Repaint() {}, SetCursor() {},
        SetTimeout(fn, delay) { const id = nextTimer++; timers.set(id, {fn, delay}); return id; },
        ClearTimeout(id) { timers.delete(id); }
    };
    function runOneTimer() {
        const item = timers.entries().next();
        if (item.done) return false;
        timers.delete(item.value[0]);
        item.value[1].fn();
        return true;
    }
    function drainTimers(limit) {
        let count = 0;
        while (runOneTimer()) if (++count > limit) throw new Error('Bridge timer loop did not settle');
    }
    const playlists = [[
        {Path:'C:/Music/a.flac', SubSong:0, text:'Artist A - A'},
        {Path:'C:/Music/b.flac', SubSong:0, text:'Artist B - B'}
    ]];
    let queueIndexEvaluations = 0;
    const plman = {
        PlaylistCount: 1, ActivePlaylist: 0,
        GetPlaylistItemCount(index) { return playlists[index].length; },
        GetPlaylistName() { return 'Main'; },
        GetPlaylistItems() { throw new Error('Bridge path must not allocate playlist lists'); },
        ClearPlaylistSelection() {}, SetPlaylistSelectionSingle() {},
        SetPlaylistFocusItem() {}, ExecutePlaylistDefaultAction() {}
    };
    function HandleList() { this.items=[]; Object.defineProperty(this,'Count',{get:()=>this.items.length}); }
    HandleList.prototype.AddItem=function(item){this.items.push(item);};
    HandleList.prototype.GetItem=function(index){return this.items[index];};
    HandleList.prototype.Dispose=function(){};
    HandleList.prototype.RunContextCommand=function(){return true;};
    const fb = {
        ProfilePath: 'P:/',
        CreateHandleList() { return new HandleList(); },
        TitleFormat(format) { return {EvalPlaylistItem(playlist, itemIndex) {
            const item = playlists[playlist][itemIndex];
            if (format === '[%queue_indexes%]') { queueIndexEvaluations++; return ''; }
            if (format === '[%queue_total%]') return '';
            if (format === '%path%|%subsong%') return item.Path + '|' + item.SubSong;
            return item.text;
        }}; }
    };
    let bridgeText = '';
    let commandText = '';
    let resultText = '';
    const utils = {
        IsKeyPressed() { return false; }, SetClipboardText() {}, CreateFolder() { return true; },
        IsFile(path) { return path === 'P:/js_data\\darkonejsp3.queue-state.json' ||
            (path === 'P:/js_data\\darkonejsp3.queue-command-result.json' && !!resultText); },
        ReadTextFile(path, codepage) {
            if (path === 'P:/js_data\\darkonejsp3.queue-command-result.json') return resultText;
            return bridgeText;
        },
        WriteTextFile(path, content) {
            if (path === 'P:/js_data\\darkonejsp3.queue-command.json') { commandText = content; return true; }
            return false;
        },
        InputBox() { return ''; }
    };
    const panel = {list_objects:[],row_height:20,fonts:{normal:{}},colours:{text:1,highlight:2},m:{AppendMenuItem(){},AppendMenuSeparator(){}}};
    function ScrollButton() { this.lbtn_up=function(){}; this.move=function(){return false;}; this.paint=function(){}; }
    const factory = new Function(
        'panel','window','plman','fb','utils','_scale','_sb','chars','_','setAlpha','EnableMenuIf','MF_STRING',
        'VK_CONTROL','VK_SHIFT','VK_UP','VK_DOWN','VK_HOME','VK_END','VK_PGUP','VK_PGDN','VK_RETURN','VK_ESCAPE',
        'IDC_ARROW','DWRITE_TEXT_ALIGNMENT_CENTER','DWRITE_PARAGRAPH_ALIGNMENT_CENTER','DWRITE_WORD_WRAPPING_NO_WRAP',
        'DWRITE_TRIMMING_GRANULARITY_CHARACTER','DWRITE_TEXT_ALIGNMENT_LEADING','_p','console','_explorer','PlaybackQueueOrigin',
        protocolSource + '\nvar DARKONEJSP3_QUEUE_BRIDGE_ENABLED = true;\n' + queueSource + '\nreturn _queue_viewer;'
    );
    const QueueViewer = factory(panel,windowMock,plman,fb,utils,v=>v,ScrollButton,{up:'u',down:'d'},{bind:(fn,c)=>fn.bind(c)},
        c=>c,()=>0,0,0x11,0x10,0x26,0x28,0x24,0x23,0x21,0x22,0x0d,0x1b,0,0,0,0,0,0,
        function(name,value){this.value=value;},console,()=>{},{user_added:0,user_removed:1,playback_advance:2});
    function state(generation, entries, available=true, writable=true) {
        return JSON.stringify({version:'v2',session:'session-a',generation,available,writable,
            capabilities:['remove','removeMany','clear','moveUp','moveDown','moveTop','moveBottom','skipTo'],entries});
    }
    bridgeText = state(1,[
        {queueIndex:1,playlistIndex:0,playlistItemIndex:1,sourceId:'C:/Music/b.flac|0'},
        {queueIndex:2,playlistIndex:-1,playlistItemIndex:-1,sourceId:'C:/Detached/c.flac|0'}
    ]);
    const queue = new QueueViewer(0,0,200,200);
    queue.rows=5;
    queue.on_visible_paint();
    drainTimers(20);
    assert(queue.bridge_mode && queue.count === 2, 'Queue Viewer did not enter direct bridge mode');
    assert(queueIndexEvaluations === 0, 'Direct bridge unexpectedly evaluated %queue_indexes%');
    assert(queue.data[0].text === 'Artist B - B', 'Bridge did not format a valid playlist source');
    assert(queue.data[1].text === 'c.flac', 'Bridge did not preserve a detached queue item');
    assert(!queue.source_row_valid(1), 'Detached bridge item was incorrectly treated as a live playlist source');

    bridgeText = state(2,[{queueIndex:1,playlistIndex:0,playlistItemIndex:0,sourceId:'C:/Music/a.flac|0'}]);
    queue.playback_queue_changed(1);
    drainTimers(20);
    assert(queue.count === 1 && queue.data[0].text === 'Artist A - A', 'Queue removal did not refresh from direct bridge');
    assert(queueIndexEvaluations === 0, 'Queue removal fell back to playlist scanning');

    // Simulate callback ordering where JScript Panel observes the event before
    // JSplitter has written its next generation. The consumer must retry briefly,
    // not launch a 38k-item discovery scan.
    queue.playback_queue_changed(0);
    assert(runOneTimer(), 'Bridge refresh did not perform its first generation check');
    assert(timers.size === 1, 'Bridge refresh did not schedule a generation retry');
    bridgeText = state(3,[
        {queueIndex:1,playlistIndex:0,playlistItemIndex:0,sourceId:'C:/Music/a.flac|0'},
        {queueIndex:2,playlistIndex:0,playlistItemIndex:1,sourceId:'C:/Music/b.flac|0'}
    ]);
    drainTimers(20);
    assert(queue.count === 2 && queue.bridge_mode, 'Bridge generation retry did not consume the JSplitter update');
    assert(queueIndexEvaluations === 0 && !queue.scanning, 'Bridge generation race triggered a fallback scan');

    queue.select_only(0, false);
    assert(queue.remove_selected_from_queue(), 'Writable bridge did not accept remove command');
    const removeCommand = JSON.parse(commandText);
    assert(removeCommand && removeCommand.action === 'remove' &&
        removeCommand.queueIndexes.join(',') === '1' && removeCommand.generation === 3,
        'Queue Viewer serialised the remove command incorrectly');
    resultText = JSON.stringify({version:'v2',id:removeCommand.id,session:'session-a',accepted:true,generation:4,message:''});
    assert(runOneTimer(), 'Queue Viewer did not consume the writable command acknowledgement');
    assert(runOneTimer(), 'Queue Viewer did not check the acknowledged bridge generation');
    assert(queue.count === 2 && queue.bridge_generation === 3 && timers.size === 1,
        'Queue Viewer accepted stale bridge state before the acknowledged generation was published');
    bridgeText = state(4,[
        {queueIndex:1,playlistIndex:0,playlistItemIndex:1,sourceId:'C:/Music/b.flac|0'}
    ]);
    drainTimers(30);
    assert(queue.count === 1 && queue.data[0].text === 'Artist B - B' && queue.bridge_generation === 4,
        'Queue Viewer did not wait for and consume the acknowledged authoritative generation');
    assert(queueIndexEvaluations === 0, 'Writable command path triggered fallback queue scanning');

    queue.select_only(0, false);
    const realSkipToQueueRow = queue.skip_to_queue_row;
    let contextSkipRow = -1;
    queue.skip_to_queue_row = function(index) { contextSkipRow = index; return true; };
    queue.rbtn_up_done(1408);
    queue.skip_to_queue_row = realSkipToQueueRow;
    assert(contextSkipRow === 0, 'Skip to this track context command targeted the wrong queue row');

    bridgeText = state(5,[
        {queueIndex:1,playlistIndex:0,playlistItemIndex:1,sourceId:'C:/Music/b.flac|0'},
        {queueIndex:2,playlistIndex:-1,playlistItemIndex:-1,sourceId:'C:/Detached/c.flac|0'}
    ]);
    queue.playback_queue_changed(0);
    drainTimers(30);
    assert(queue.count === 2 && queue.bridge_generation === 5,
        'Queue Viewer did not prepare the skip-to-track test generation');
    assert(queue.lbtn_dblclk(10, 12 + panel.row_height + 1),
        'Queue Viewer double-click did not request skip-to-track');
    const skipCommand = JSON.parse(commandText);
    assert(skipCommand.action === 'skipTo' && skipCommand.queueIndexes.join(',') === '2' &&
        skipCommand.generation === 5,
        'Queue Viewer serialised double-click skip-to-track incorrectly');
    resultText = JSON.stringify({version:'v2',id:skipCommand.id,session:'session-a',
        accepted:true,generation:6,message:''});
    bridgeText = state(6,[]);
    drainTimers(30);
    assert(queue.count === 0 && queue.bridge_generation === 6,
        'Queue Viewer did not consume the authoritative state after skip-to-track');
});
