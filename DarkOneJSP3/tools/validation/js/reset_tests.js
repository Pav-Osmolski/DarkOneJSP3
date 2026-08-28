"use strict";

// Registered with harness.js and executed in isolated VM contexts.

suite("shared startup/divider protocol", function () {
    const fs = require('fs');
    const colourSource = fs.readFileSync(__path("DarkOneJSP3/shared/colour_utils.js"), 'utf8');
    const protocolSource = fs.readFileSync(__path("DarkOneJSP3/shared/jsplitter_protocols.js"), 'utf8');
    const factory = new Function('utils', colourSource + '\n' + protocolSource +
        '\nreturn { DarkOneColour, DarkOneProtocol };');
    const api = factory({});
    const startup = api.DarkOneProtocol.startup;
    const divider = api.DarkOneProtocol.divider;
    const bottomArea = api.DarkOneProtocol.bottomArea;
    function assert(condition, message) { if (!condition) throw new Error(message); }
    assert(startup.serialiseState({transition: 2, minimumDelay: 5000,
        readinessTimeout: 7000}) === 'v1|state|2|5000|7000',
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
        '900:0,901:1,902:2,903:4,904:5,905:3',
        'Divider menu mapping changed');
    const currentState = bottomArea.state(
        2, 0xff123456, true, 4, 0xff654321, false, 0
    );
    const currentMessage = bottomArea.serialiseState(currentState);
    assert(currentMessage === 'v5|state|2|4279383126|1|4|4284826401|0|0',
        'Bottom-area v5 state serialisation changed');
    assert(bottomArea.parseState(currentMessage).backgroundLinearGradient === true &&
        bottomArea.parseState(currentMessage).sideDividersVisible === false &&
        bottomArea.parseState(currentMessage).depthMode === 0,
        'Bottom-area v5 state did not round-trip');
    const legacyBottomState = bottomArea.parseState('v1|2|4279383126|4|4284826401');
    assert(legacyBottomState && legacyBottomState.backgroundLinearGradient === false &&
        legacyBottomState.dividerMode === 4 &&
        legacyBottomState.sideDividersVisible === true &&
        legacyBottomState.depthMode === 0,
        'Bottom-area v1 state did not migrate with safe feature defaults');
    assert(bottomArea.parseState('v2|2|4279383126|1|4|4284826401') === null &&
        bottomArea.parseState('v3|2|4279383126|1|4|4284826401|0') === null &&
        bottomArea.parseState('v4|2|4279383126|1|4|4284826401|0|0') === null,
        'Bottom-area state parser accepted an unpublished test protocol');
    assert(bottomArea.parseState('v5|bad revision|2|4279383126|1|4|4284826401|0|0') === null,
        'Bottom-area state parser accepted an unsafe revision');
    assert(bottomArea.parseState({
        backgroundMode: 2,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: 'invalid',
        dividerMode: 4,
        dividerCustomColour: 0xff654321,
        sideDividersVisible: 'invalid',
        depthMode: 'invalid'
    }).backgroundLinearGradient === false && bottomArea.parseState({
        backgroundMode: 2,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: false,
        dividerMode: 4,
        dividerCustomColour: 0xff654321,
        sideDividersVisible: 'invalid'
    }).sideDividersVisible === true && bottomArea.parseState({
        backgroundMode: 2,
        backgroundCustomColour: 0xff123456,
        backgroundLinearGradient: false,
        dividerMode: 4,
        dividerCustomColour: 0xff654321,
        sideDividersVisible: true,
        depthMode: 'invalid'
    }).depthMode === 0,
        'Malformed bottom-area booleans did not recover to safe defaults');
    const currentCommit = bottomArea.commit(
        'current', Date.now(), Date.now() + 50, currentState
    );
    const currentCommitMessage = bottomArea.serialiseCommit(currentCommit);
    const parsedCurrentCommit = bottomArea.parseCommit(currentCommitMessage, Date.now());
    assert(parsedCurrentCommit && parsedCurrentCommit.id === 'current' &&
        parsedCurrentCommit.state.backgroundLinearGradient === true &&
        parsedCurrentCommit.state.sideDividersVisible === false &&
        parsedCurrentCommit.state.depthMode === 0 &&
        parsedCurrentCommit.state.revision === 'current',
        'Bottom-area v5 commit did not round-trip');
    const scheduleNow = Date.now();
    assert(bottomArea.commit('backwards', scheduleNow, scheduleNow - 1, currentState) === null &&
        bottomArea.commit('too-far', scheduleNow, scheduleNow + 1001, currentState) === null &&
        bottomArea.commit('bad|id', scheduleNow, scheduleNow + 50, currentState) === null,
        'Bottom-area commit accepted an invalid applyAt schedule');
    assert(bottomArea.parseCommit(
        'v1|legacy|' + Date.now() + '|' + Date.now() + '|2|4279383126|4|4284826401',
        Date.now()
    ) === null && bottomArea.parseCommit(
        'v2|legacy-v2|' + Date.now() + '|' + Date.now() +
            '|2|4279383126|1|4|4284826401',
        Date.now()
    ) === null && bottomArea.parseCommit(
        'v3|legacy-v3|' + Date.now() + '|' + Date.now() +
            '|2|4279383126|1|4|4284826401|0',
        Date.now()
    ) === null && bottomArea.parseCommit(
        'v4|legacy-v4|' + Date.now() + '|' + Date.now() +
            '|2|4279383126|1|4|4284826401|0|0',
        Date.now()
    ) === null,
        'Bottom-area commit parser accepted an obsolete transient protocol');
    const events = [];
    const readiness = startup.createReadinessBridge(
        {NotifyOthers(name, data) { events.push([name, data]); }},
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
});

suite("sample reset registry", function () {
    const fs = require('fs');
    const vm = require('vm');
    let properties = {};
    let reloads = 0;
    global.window = {
        GetProperty(name, fallback) {
            return Object.prototype.hasOwnProperty.call(properties, name)
                ? properties[name]
                : fallback;
        },
        SetProperty(name, value) { properties[name] = value; },
        Reload() { reloads++; },
        Repaint() {}
    };
    vm.runInThisContext(fs.readFileSync(__path("DarkOneJSP3/shared/reset_defaults.js"), 'utf8'));
    function assert(condition, message) {
        if (!condition) throw new Error(message);
    }
    function reset(values) { properties = Object.assign({}, values); reloads = 0; }

    reset({
        'DarkOneJSP3.InfoStack.FontSize': 31,
        'DarkOneJSP3.InfoStack.AutoFontScale': 145,
        'DarkOneJSP3.InfoStack.ActivePanel': 4
    });
    darkOneJsp3ApplyRoleReset('info-stack', 'appearance');
    assert(properties['DarkOneJSP3.InfoStack.FontSize'] === 0,
        'InfoStack fixed font-size default failed');
    assert(properties['DarkOneJSP3.InfoStack.AutoFontScale'] === 100,
        'InfoStack automatic font-scale default failed');
    assert(properties['DarkOneJSP3.InfoStack.ActivePanel'] === 4,
        'InfoStack appearance reset changed active-panel behaviour');

    reset({
        'DARKONEJSP3.VOLUME.KNOB.INDICATOR.MODE': 1,
        'DARKONEJSP3.VOLUME.KNOB.INDICATOR.COLOUR': 0xff123456
    });
    darkOneJsp3ApplyRoleReset('control-right', 'appearance');
    assert(properties['DARKONEJSP3.VOLUME.KNOB.INDICATOR.MODE'] === 0 &&
        properties['DARKONEJSP3.VOLUME.KNOB.INDICATOR.COLOUR'] === 0xff404040,
        'Control Right appearance reset missed the volume knob indicator colour');

    vm.runInThisContext(fs.readFileSync(__path("user-components-x64/foo_jscript_panel3/samples/shared/sample_defaults.js"), 'utf8'));
    vm.runInThisContext(fs.readFileSync(
        __path("user-components-x64/foo_jscript_panel3/samples/js/jsp3_enhanced_reset.js"), 'utf8'));

    reset({
        'DARKONEJSP3.PAGE.COLOURS.DYNAMIC.ENABLED': true,
        'DARKONEJSP3.PAGE.TEXT.MODE': 1,
        'DARKONEJSP3.PAGE.TEXT.CUSTOM.COLOUR': 0xff123456,
        'DARKONEJSP3.PAGE.SELECTED.BACKGROUND.MODE': 1,
        'DARKONEJSP3.PAGE.SELECTED.BACKGROUND.CUSTOM.COLOUR': 0xff654321,
        'DARKONEJSP3.PAGE.WALLPAPER.MODE': 2,
        'DARKONEJSP3.PAGE.WALLPAPER.PATH': 'C:\\wallpaper.jpg',
        'DARKONEJSP3.PAGE.WALLPAPER.BLURRED': true
    });
    assert(jsp3EnhancedHandleSampleReset(
        'JSP3Enhanced.Reset.Properties', {scope: 'appearance'}, 'queue-viewer'),
        'Queue Viewer appearance reset notification was not handled');
    assert(properties['DARKONEJSP3.PAGE.COLOURS.DYNAMIC.ENABLED'] === false &&
        properties['DARKONEJSP3.PAGE.TEXT.MODE'] === 0 &&
        properties['DARKONEJSP3.PAGE.TEXT.CUSTOM.COLOUR'] === 0xffdcdcdc &&
        properties['DARKONEJSP3.PAGE.SELECTED.BACKGROUND.MODE'] === 0 &&
        properties['DARKONEJSP3.PAGE.SELECTED.BACKGROUND.CUSTOM.COLOUR'] === 0xff303030 &&
        properties['DARKONEJSP3.PAGE.WALLPAPER.MODE'] === 0 &&
        properties['DARKONEJSP3.PAGE.WALLPAPER.PATH'] === '' &&
        properties['DARKONEJSP3.PAGE.WALLPAPER.BLURRED'] === false,
        'Queue Viewer page-appearance defaults were not restored');
    assert(reloads === 1, 'Queue Viewer appearance reset did not reload exactly once');

    reset({
        'JSPLAYLIST.Enable Smooth Scrolling': false,
        'JSPLAYLIST.UI Refresh Interval (ms)': 31,
        'JSPLAYLIST.Smooth Scroll Divisor': 7,
        'JSPLAYLIST.Playlist Wheel Throttle (ms)': 0,
        'JSPLAYLIST.Playlist Scroll Step': 9,
        'JSPLAYLIST.Snap Wheel Scrolling To Rows': false,
        'JSPLAYLIST.Snap Scrollbar Dragging To Rows': false,
        'JSPLAYLIST.Free Wheel Step (pixels)': 240
    });
    assert(jsp3EnhancedHandleSampleReset(
        'JSP3Enhanced.Reset.Properties', JSON.stringify({version: 1, scope: 'behaviour'}), 'js-playlist'),
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

    reset({
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
        'SMOOTH.PLAYLIST.MANAGER.SCROLL.STATE.V2': '{"version":2}'
    });
    jsp3EnhancedHandleSampleReset(
        'DarkOneJSP3.Reset.Properties', JSON.stringify({version: 1, scope: 'behaviour'}), 'playlist-manager');
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

    reset({
        'SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER': false,
        'SMOOTH.PLAYLIST.MANAGER.FILTER.WIDTH': 555,
        'SMOOTH.PLAYLIST.MANAGER.ROW.HEIGHT': 44,
        'SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS': false,
        'SMOOTH.UI.REFRESH.INTERVAL.MS': 25,
        'SMOOTH.PLAYLIST.MANAGER.SCROLL': 1234,
        'SMOOTH.PLAYLIST.MANAGER.SCROLL.STATE.V2': '{"version":2}'
    });
    jsp3EnhancedHandleSampleReset(
        'DarkOneJSP3.Reset.Properties', {scope: 'appearance'}, 'playlist-manager');
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

    reset({
        'SMOOTH.PLAYLIST.MANAGER.SHOW.FILTER': false,
        'SMOOTH.PLAYLIST.MANAGER.ALTERNATING.ROWS': false,
        'SMOOTH.UI.REFRESH.INTERVAL.MS': 25,
        'SMOOTH.PLAYLIST.MANAGER.SCROLL': 1234,
        'SMOOTH.PLAYLIST.MANAGER.SCROLL.STATE.V2': '{"version":2}'
    });
    jsp3EnhancedHandleSampleReset(
        'DarkOneJSP3.Reset.Properties', JSON.stringify({version: 1, scope: 'all'}), 'playlist-manager');
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

    reset({'JSPLAYLIST.UI Refresh Interval (ms)': 31});
    assert(jsp3EnhancedSampleResetScope({scope: 'preview'}) === null,
        'Unknown reset scope was not rejected');
    assert(!jsp3EnhancedHandleSampleReset(
        'DarkOneJSP3.Reset.Properties', {scope: 'preview'}, 'js-playlist'),
        'Malformed reset scope was incorrectly handled');
    assert(properties['JSPLAYLIST.UI Refresh Interval (ms)'] === 31 && reloads === 0,
        'Malformed reset scope changed properties or reloaded the panel');
    assert(!jsp3EnhancedHandleSampleReset(
        'DarkOneJSP3.Reset.Properties', {scope: 'all'}, 'unknown-role'),
        'Unknown reset role was incorrectly handled');
    assert(reloads === 0, 'Unknown reset role reloaded the panel');
});

suite("legacy saved-entry reset", function () {
    const fs = require('fs');
    const vm = require('vm');
    const roles = {"lastfm-bio": ["DARKONEJSP3.PAGE.BACKGROUND.MODE", 3], "lastfm-info": ["DARKONEJSP3.PAGE.BACKGROUND.MODE", 3], "properties": ["DARKONEJSP3.PAGE.BACKGROUND.MODE", 3], "queue-viewer": ["DARKONEJSP3.QUEUE.TF", "%artist% - %title%"], "js-playlist": ["JSPLAYLIST.UI Refresh Interval (ms)", 8], "playlist-manager": ["SMOOTH.UI.REFRESH.INTERVAL.MS", 8], "musicbrainz": ["DARKONEJSP3.MUSICBRAINZ.MODE", 0], "album-notes": ["DARKONEJSP3.ALBUM.NOTES.MODE", 0]};
    let properties = {};
    let reloads = 0;
    global.window = {
        GetProperty(name, fallback) {
            return Object.prototype.hasOwnProperty.call(properties, name)
                ? properties[name]
                : fallback;
        },
        SetProperty(name, value) { properties[name] = value; },
        Reload() { reloads++; },
        Repaint() {}
    };
    vm.runInThisContext(fs.readFileSync(__path("DarkOneJSP3/shared/reset_defaults.js"), 'utf8'));
    vm.runInThisContext(fs.readFileSync(
        __path("user-components-x64/foo_jscript_panel3/samples/js/darkonejsp3_reset.js"), 'utf8'));
    function assert(condition, message) { if (!condition) throw new Error(message); }
    for (const role of Object.keys(roles)) {
        const property = roles[role][0];
        const expected = roles[role][1];
        properties = {};
        properties[property] = expected === true ? false : expected === false ? true : '__non_default__';
        reloads = 0;
        assert(darkOneJsp3HandleSampleReset(
            'DarkOneJSP3.Reset.Properties', JSON.stringify({version: 1, scope: 'all'}), role),
            'Legacy adapter did not handle role ' + role);
        assert(properties[property] === expected, 'Legacy adapter did not reset role ' + role);
        assert(reloads === 1, 'Legacy adapter did not reload exactly once for role ' + role);
    }
});

suite("project JScript reset receiver", function () {
    let applied = [];
    let reloads = 0;
    let localBottomResets = 0;
    let coordinatedBottomResets = 0;
    let resetCommands = 0;
    const notifications = [];
    const IDYES = 6, MB_YESNO = 4, MB_ICONQUESTION = 32;
    const DARKONEJSP3_RESET_NOTIFICATION = 'DarkOneJSP3.Reset.Properties';
    const utils = {MessageBox() { return IDYES; }};
    function darkOneApplyBottomAreaDefaultsLocally() { localBottomResets++; }
    function darkOneResetBottomAreaDefaults() { coordinatedBottomResets++; }
    function darkOneWriteResetCommand() { resetCommands++; return true; }
    global.DARKONEJSP3_RESET_ROLE = 'display';
    global.DARKONEJSP3_RESET_REGISTRY = {display: {appearance: {}, behaviour: {}}};
    global.darkOneJsp3ApplyRoleReset = function(role, scope) { applied.push([role, scope]); return true; };
    global.window = {
        Reload() { reloads++; }, Repaint() {},
        NotifyOthers(name, data) { notifications.push([name, data]); }
    };
    /*__CONFIG_RESET_FUNCTIONS__*/
    function assert(condition, message) { if (!condition) throw new Error(message); }
    assert(darkOneResetScope(JSON.stringify({version: 1, scope: 'appearance'})) === 'appearance',
        'Project JScript receiver did not parse a serialised scope');
    assert(darkOneResetScope({scope: 'behaviour'}) === 'behaviour',
        'Project JScript receiver did not retain object-payload compatibility');
    assert(darkOneResetScope({scope: 'preview'}) === null,
        'Project JScript receiver did not reject an unknown scope');
    assert(!darkOneHandleResetNotification(
        'DarkOneJSP3.Reset.Properties', {scope: 'preview'}),
        'Project JScript receiver handled an invalid scope');
    assert(applied.length === 0 && reloads === 0,
        'Project JScript invalid scope applied defaults or reloaded');
    assert(darkOneHandleResetNotification(
        'DarkOneJSP3.Reset.Properties', {scope: 'appearance'}),
        'Project JScript receiver did not handle a valid reset');
    assert(applied.length === 1 && applied[0][0] === 'display' && applied[0][1] === 'appearance',
        'Project JScript receiver applied the wrong role or scope');
    assert(localBottomResets === 1 && coordinatedBottomResets === 0,
        'Peer reset published a duplicate coordinated bottom-area commit');
    assert(reloads === 1, 'Project JScript receiver did not reload exactly once');

    applied = [];
    reloads = 0;
    localBottomResets = 0;
    assert(darkOneConfirmFactoryReset('appearance'),
        'Project JScript reset initiator rejected a confirmed reset');
    assert(resetCommands === 1 && coordinatedBottomResets === 1 &&
        notifications.length === 1 && localBottomResets === 0,
        'Reset initiator did not publish exactly one coordinated bottom-area commit');
    assert(applied.length === 1 && reloads === 1,
        'Reset initiator did not apply its role and reload exactly once');
});

suite("JSplitter reset receiver", function () {
    const fs = require('fs');
    const vm = require('vm');
    let properties = {
        'DarkOneJSP3.InfoStack.FontSize': 31,
        'DarkOneJSP3.InfoStack.ActivePanel': 4
    };
    let reloads = 0;
    global.fb = { ProfilePath: '' };
    global.window = {
        GetPanel() { return null; },
        GetProperty(name, fallback) {
            return Object.prototype.hasOwnProperty.call(properties, name)
                ? properties[name]
                : fallback;
        },
        SetProperty(name, value) { properties[name] = value; },
        Reload() { reloads++; },
        Repaint() {}
    };
    global.include = function() {
        vm.runInThisContext(fs.readFileSync(
            __path("DarkOneJSP3/shared/reset_defaults.js"), 'utf8'));
    };
    global.DARKONEJSP3_RESET_ROLE = 'info-stack';
    vm.runInThisContext(fs.readFileSync(
        __path("DarkOneJSP3/jsplitter/shared.js"), 'utf8'));
    function assert(condition, message) {
        if (!condition) throw new Error(message);
    }
    assert(darkOneJsp3ResetScope(JSON.stringify({version: 1, scope: 'appearance'})) === 'appearance',
        'JSplitter did not parse a serialised reset scope');
    assert(darkOneJsp3ResetScope({scope: 'behaviour'}) === 'behaviour',
        'JSplitter did not retain legacy object-payload compatibility');
    assert(darkOneJsp3ResetScope({scope: 'preview'}) === null,
        'JSplitter did not reject an unknown reset scope');
    assert(!darkOneJsp3HandleReset('DarkOneJSP3.Reset.Properties', {scope: 'preview'}),
        'JSplitter handled an invalid reset scope');
    assert(properties['DarkOneJSP3.InfoStack.FontSize'] === 31 && reloads === 0,
        'JSplitter invalid scope changed properties or reloaded');
    assert(darkOneJsp3HandleReset('DarkOneJSP3.Reset.Properties',
        JSON.stringify({version: 1, scope: 'appearance'})),
        'JSplitter did not handle a serialised reset notification');
    assert(properties['DarkOneJSP3.InfoStack.FontSize'] === 0,
        'JSplitter serialised reset did not restore appearance defaults');
    assert(properties['DarkOneJSP3.InfoStack.ActivePanel'] === 4,
        'JSplitter appearance reset changed behaviour state');
    assert(reloads === 1, 'JSplitter serialised reset did not reload exactly once');

    DARKONEJSP3_RESET_ROLE = 'display-waveform';
    properties = {
        'DarkOneJSP3.DisplayWaveform.BackgroundMode': 1,
        'DarkOneJSP3.DisplayWaveform.BackgroundColour': 0xff123456,
        'DarkOneJSP3.DisplayWaveform.HideWhenStopped': false,
        'DarkOneJSP3.DisplayWaveform.NewTrackRevealDelay': 999
    };
    reloads = 0;
    assert(darkOneJsp3HandleReset('DarkOneJSP3.Reset.Properties', {scope: 'appearance'}),
        'Waveform appearance reset was not handled');
    assert(properties['DarkOneJSP3.DisplayWaveform.BackgroundMode'] === 6,
        'Waveform appearance reset did not restore Automatic background');
    assert(properties['DarkOneJSP3.DisplayWaveform.HideWhenStopped'] === false &&
        properties['DarkOneJSP3.DisplayWaveform.NewTrackRevealDelay'] === 999,
        'Waveform appearance reset changed behavioural settings');

    properties['DarkOneJSP3.DisplayWaveform.BackgroundMode'] = 1;
    properties['DarkOneJSP3.DisplayWaveform.HideWhenStopped'] = false;
    properties['DarkOneJSP3.DisplayWaveform.NewTrackRevealDelay'] = 999;
    assert(darkOneJsp3HandleReset('DarkOneJSP3.Reset.Properties', {scope: 'behaviour'}),
        'Waveform behaviour reset was not handled');
    assert(properties['DarkOneJSP3.DisplayWaveform.BackgroundMode'] === 1,
        'Waveform behaviour reset changed the fixed host background');
    assert(properties['DarkOneJSP3.DisplayWaveform.HideWhenStopped'] === true &&
        properties['DarkOneJSP3.DisplayWaveform.NewTrackRevealDelay'] === 200,
        'Waveform behaviour reset did not restore blanking and reveal delay');
});
