"use strict";

// Registered with harness.js and executed in isolated VM contexts.

suite("native colour helper", function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path("DarkOneJSP3/shared/colour_utils.js"), 'utf8');
    let pickerCalls = [];
    let inputCalls = 0;
    let logs = [];
    let pickerResult = null;
    let pickerError = null;
    const utilsMock = {
        ColourPicker() {
            const args = [...arguments];
            const nativeColour = Number(args[args.length - 1]);
            if (!Number.isInteger(nativeColour) || nativeColour < -2147483648 || nativeColour > 2147483647)
                throw new Error('Overflow');
            pickerCalls.push(args);
            if (pickerError) throw pickerError;
            return pickerResult === '__DEFAULT__' ? nativeColour : pickerResult;
        },
        InputBox() { inputCalls++; return '#123456'; }
    };
    const consoleMock = {log(message) { logs.push(String(message)); }};
    const factory = new Function('utils', 'console', source + '\nreturn DarkOneColour;');
    const colour = factory(utilsMock, consoleMock);
    function assert(condition, message) { if (!condition) throw new Error(message); }
    assert(source.indexOf('utils.ColourPicker(current, true)') === -1,
        'Shared helper still contains the unsupported two-argument JScript Panel picker call');
    assert(source.indexOf('utils.ColourPicker(this.nativeSigned(current))') !== -1,
        'Shared helper omits signed JScript Panel picker conversion');
    assert(source.indexOf('utils.ColourPicker(0, this.nativeSigned(current))') !== -1,
        'Shared helper omits signed JSplitter picker conversion');
    assert((colour.opaque(0x00123456) >>> 0) === 0xff123456, 'Opaque conversion failed');
    assert(colour.toHex(0xff123456) === '#123456', 'Hex conversion failed');
    assert((colour.parseOpaque('18, 52, 86') >>> 0) === 0xff123456, 'RGB parsing failed');
    assert((colour.parseOpaque('300, 0, 86') >>> 0) === 0xffff0056, 'RGB channel clamping failed');
    assert((colour.normalisePickerChoice(-15654349) >>> 0) === 0xff112233,
        'Signed native picker result was rejected');
    assert((colour.normalisePickerChoice(0xff112233) >>> 0) === 0xff112233,
        'Unsigned native picker result was rejected');
    [Infinity, -Infinity, NaN, 1.5, -2147483649, 4294967296, 'not-a-colour'].forEach(value =>
        assert(colour.normalisePickerChoice(value) === null,
            'Invalid native picker result was accepted: ' + String(value)));
    assert(colour.normaliseMode(4, [0, 1, 2, 4, 5, 3], 1) === 4, 'Sparse mode 4 was rejected');
    assert(colour.normaliseMode(99, [0, 1, 2, 4, 5, 3], 1) === 1, 'Invalid mode fallback failed');
    const options = [
        {id: 10, mode: 0, label: 'Default'},
        {id: 12, mode: 2, label: 'Global'},
        {id: 11, mode: 1, custom: true}
    ];
    const menu = {
        items: [], radio: null,
        AppendMenuItem(flags, id, label) { this.items.push([flags, id, label]); },
        CheckMenuRadioItem(minimum, maximum, selected) { this.radio = [minimum, maximum, selected]; }
    };
    colour.appendRadioOptions(menu, options, 1, 0xff123456, 0);
    assert(menu.radio.join(',') === '10,12,11', 'Declarative menu selected the wrong id');
    assert(menu.items[2][2] === 'Custom colour (#123456)', 'Custom menu label is wrong');
    assert(colour.optionForId(options, 12).mode === 2, 'Menu id did not resolve to mode');

    pickerResult = '__DEFAULT__';
    assert(colour.pickJsplitter(0xff112233, 'Divider test', 'Prompt') === null,
        'Unchanged JSplitter picker result did not preserve the current mode');
    assert(pickerCalls[0].length === 2 && pickerCalls[0][1] < 0 &&
        (pickerCalls[0][1] >>> 0) === 0xff112233,
        'JSplitter picker did not receive the required signed 32-bit colour');
    pickerResult = (0xff445566 | 0);
    assert((colour.pickJsplitter(0xff112233, 'Divider test', 'Prompt') >>> 0) === 0xff445566,
        'JSplitter picker did not normalise its selected colour');

    pickerResult = '__DEFAULT__';
    assert(colour.pickJscript(0xff112233, 'Panel test', 'Prompt') === null,
        'Unchanged JScript Panel picker result did not preserve the current mode');
    assert(pickerCalls[pickerCalls.length - 1].length === 1 &&
        pickerCalls[pickerCalls.length - 1][0] < 0 &&
        (pickerCalls[pickerCalls.length - 1][0] >>> 0) === 0xff112233,
        'JScript Panel picker did not receive the required signed 32-bit colour');
    pickerResult = (0xff667788 | 0);
    assert((colour.pickJscript(0xff112233, 'Panel test', 'Prompt') >>> 0) === 0xff667788,
        'JScript Panel picker did not normalise its selected colour');

    pickerResult = Infinity;
    assert(colour.pickJscript(0xff112233, 'Invalid result', 'Prompt') === null,
        'Non-finite JScript Panel picker result changed the colour');
    pickerError = new Error('native failure');
    logs = [];
    assert(colour.pickJscript(0xff112233, 'Display accent', 'Prompt') === null,
        'JScript Panel picker exception changed the colour');
    assert(logs.some(line => line.indexOf('JScript Panel ColourPicker failed (Display accent): native failure') !== -1),
        'JScript Panel picker failure lacked contextual diagnostics');
    pickerError = new Error('splitter failure');
    logs = [];
    assert(colour.pickJsplitter(0xff112233, 'InfoStack background', 'Prompt') === null,
        'JSplitter picker exception changed the colour');
    assert(logs.some(line => line.indexOf('JSplitter ColourPicker failed (InfoStack background): splitter failure') !== -1),
        'JSplitter picker failure lacked contextual diagnostics');
    pickerError = null;

    delete utilsMock.ColourPicker;
    inputCalls = 0;
    assert((colour.pickJscript(0xff112233, 'Test', 'Prompt') >>> 0) === 0xff123456,
        'JScript Panel text fallback failed when the native picker was unavailable');
    assert((colour.pickJsplitter(0xff112233, 'Test', 'Prompt') >>> 0) === 0xff123456,
        'JSplitter text fallback failed when the native picker was unavailable');
    assert(inputCalls === 2, 'Text fallback was not used exactly once per unavailable native picker');

    // JScript Panel 3 may report native COM methods as typeof "unknown".
    const unknownTypeSource = source.replace(/typeof utils\.ColourPicker/g, "'unknown'");
    pickerCalls = [];
    inputCalls = 0;
    pickerResult = (0xff445566 | 0);
    utilsMock.ColourPicker = function() {
        const args = [...arguments];
        const nativeColour = Number(args[args.length - 1]);
        if (nativeColour < -2147483648 || nativeColour > 2147483647) throw new Error('Overflow');
        pickerCalls.push(args);
        return pickerResult;
    };
    const unknownTypeColour = new Function('utils', 'console', unknownTypeSource + '\nreturn DarkOneColour;')(utilsMock, consoleMock);
    assert((unknownTypeColour.pickJscript(0xff112233, 'Test', 'Prompt') >>> 0) === 0xff445566,
        'JScript Panel native picker reported as unknown was not invoked');
    assert((unknownTypeColour.pickJsplitter(0xff112233, 'Test', 'Prompt') >>> 0) === 0xff445566,
        'JSplitter native picker reported as unknown was not invoked');
    assert(inputCalls === 0 && pickerCalls.length === 2,
        'Unknown-type native picker incorrectly fell back to text entry');
});

suite("optional-button menu", function () {
    const fs = require('fs');
    const source = fs.readFileSync(__path("DarkOneJSP3/jscript/js/Buttons_OptionalMenu.js"), 'utf8');
    const properties = new Map();
    let reloads = 0;
    let repaints = 0;
    let shownProperties = 0;
    let resetNames = null;
    let guideCalls = 0;
    let inputValues = [];
    let popupMenus = [];
    let trackedIndex = 0;
    let popupCreateCalls = 0;
    let failPopupCreateAt = 0;
    function createPopupMenu() {
        popupCreateCalls++;
        if (failPopupCreateAt && popupCreateCalls === failPopupCreateAt)
            throw new Error('simulated popup construction failure');
        const value = {
            items: [], checked: [], separators: 0, children: [], disposed: false,
            AppendMenuItem(flags, id, label) { this.items.push([flags, id, label]); },
            AppendMenuSeparator() { this.separators++; },
            CheckMenuItem(id, checked) { if (checked) this.checked.push(id); },
            CheckMenuRadioItem(minimum, maximum, selected) { this.radio = [minimum, maximum, selected]; },
            AppendTo(parent, flags, label) { parent.children.push([flags, label, this]); },
            TrackPopupMenu() { return trackedIndex; },
            Dispose() { this.disposed = true; }
        };
        popupMenus.push(value);
        return value;
    }
    const windowMock = {
        GetProperty(name, fallback) { return properties.has(name) ? properties.get(name) : fallback; },
        SetProperty(name, value) { properties.set(name, value); },
        Reload() { reloads++; },
        Repaint() { repaints++; },
        ShowProperties() { shownProperties++; },
        CreatePopupMenu: createPopupMenu
    };
    const utilsMock = {
        InputBox() {
            if (!inputValues.length) throw new Error('cancel');
            const value = inputValues.shift();
            if (value instanceof Error) throw value;
            return value;
        },
        MessageBox() { return 1; }
    };
    const factory = new Function(
        'window', 'utils', 'MB_OK', 'MB_ICONASTERISK',
        'resetOptionalButtonCommandStyles', 'showOptionalButtonCommandGuide',
        source + '\nreturn { DARKONE_CONTROL_BUTTON_MENU,' +
        'darkOneOptionalButtonEditId, darkOneAppendOptionalButtonMenu,' +
        'darkOneConfigureOptionalButton,' +
        'darkOneHandleControlButtonMenuSelection, darkOneShowControlButtonMenu };'
    );
    const api = factory(
        windowMock, utilsMock, 0, 64,
        names => { resetNames = names.slice(); },
        () => { guideCalls++; }
    );
    function assert(condition, message) { if (!condition) throw new Error(message); }
    function menu() {
        return {
            items: [], checked: [], separators: 0,
            AppendMenuItem(flags, id, label) { this.items.push([flags, id, label]); },
            AppendMenuSeparator() { this.separators++; },
            CheckMenuItem(id, checked) { if (checked) this.checked.push(id); }
        };
    }
    const leftNames = Array.from({length: 8}, (_, i) => 'Button ' + String(i + 1).padStart(2, '0'));
    const rightNames = Array.from({length: 10}, (_, i) => 'Button ' + String(i + 1).padStart(2, '0'));
    const leftButtons = leftNames.map((name, i) => ({Exists: i === 1, Text: i === 0 ? 'FIRST' : ''}));
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

    const options = {buttonNames: leftNames, buttonProperties: leftButtons, x: 12, y: 34};
    assert(api.darkOneHandleControlButtonMenuSelection(120, options),
        'Re-detect command menu id was not handled');
    assert(resetNames.length === 8, 'Re-detect did not receive every left button');
    assert(api.darkOneHandleControlButtonMenuSelection(121, options) && guideCalls === 1,
        'Command guide menu id changed');
    assert(api.darkOneHandleControlButtonMenuSelection(900, options) === false,
        'Control-panel context menu still handles DarkOne Tools');
    assert(api.darkOneHandleControlButtonMenuSelection(405, options) === false,
        'Control-panel context menu still handles shared button roundness');
    assert(api.darkOneHandleControlButtonMenuSelection(999, options) === false,
        'Unknown control-menu id was consumed');

    popupMenus = [];
    trackedIndex = 0;
    api.darkOneShowControlButtonMenu(5, 6, {
        buttonNames: rightNames,
        buttonProperties: rightNames.map(() => ({Exists: false, Text: ''}))
    });
    assert(popupMenus.length === 2 && popupMenus.every(item => item.disposed),
        'Shared right control menu did not dispose every popup');
    assert(popupMenus[0].children.map(item => item[1]).join(',') ===
        'Optional buttons', 'Shared right control menu order changed');
    assert(!popupMenus[0].items.some(item => item[1] === 900),
        'Shared right control menu still exposes DarkOne Tools');

    // A native failure during submenu construction must still release every
    // wrapper that was created successfully before the exception.
    popupMenus = [];
    popupCreateCalls = 0;
    failPopupCreateAt = 2;
    let partialFailureThrown = false;
    try {
        api.darkOneShowControlButtonMenu(5, 6, {
            buttonNames: leftNames,
            buttonProperties: leftButtons
        });
    } catch (e) { partialFailureThrown = true; }
    assert(partialFailureThrown && popupMenus.length === 1 && popupMenus[0].disposed,
        'Partial control-menu construction leaked an earlier popup');
});

suite("InfoStack tab colours", function () {
    const fs = require('fs');
    const colourSource = fs.readFileSync(__path("DarkOneJSP3/shared/colour_utils.js"), 'utf8');
    const protocolSource = fs.readFileSync(__path("DarkOneJSP3/shared/jsplitter_protocols.js"), 'utf8');
    const infoColourSource = fs.readFileSync(__path("DarkOneJSP3/jsplitter/info_stack_colours.js"), 'utf8');
    const infoBridgeSource = fs.readFileSync(__path("DarkOneJSP3/jsplitter/info_stack_bridges.js"), 'utf8');
    const source = fs.readFileSync(__path("DarkOneJSP3/jsplitter/03_info_stack_tabs.js"), 'utf8');
    const properties = new Map();
    const windowMock = {
        GetProperty(name, fallback) { return properties.has(name) ? properties.get(name) : fallback; },
        SetProperty(name, value) { properties.set(name, value); },
        GetColourCUI(index) { return index === 4 ? 0xff556677 : 0xff112233; },
        GetPanel() { return null; }, NotifyOthers() {}, Repaint() {}, RepaintRect() {}, SetCursor() {}
    };
    const DOJSP3Mock = {
        titles: { playlistManager:'a', lastfmBio:'b', lastfmInfo:'c', albumNotes:'d', queue:'e', properties:'f' },
        colours: { bar:0xff202020, separator:0xff181818, buttonNormal:0xff298fcc, buttonActive:0xffffffff, buttonHover:0xff888888 },
        clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
    };
    const factory = new Function('window','fb','include','gdi','DOJSP3','utils','darkOneJsp3HandleReset',
        colourSource + '\n' + protocolSource + '\n' + infoColourSource + '\n' + infoBridgeSource + '\n' + source + '\nreturn { tabColourMode, tabAccentColour, setTabColourMode };');
    const controller = factory(windowMock, {ProfilePath:''}, function(){}, {Font(){return {};}}, DOJSP3Mock, {}, function(){return false;});
    if (controller.tabColourMode() !== 0 || (controller.tabAccentColour() >>> 0) !== 0xff298fcc)
        throw new Error('Default tab font accent changed');
    properties.set('DarkOneJSP3.InfoStack.TabCustomColour', 0xff123456);
    controller.setTabColourMode(1);
    if (controller.tabColourMode() !== 1 || (controller.tabAccentColour() >>> 0) !== 0xff123456)
        throw new Error('Legacy custom tab font mode no longer works');
    controller.setTabColourMode(2);
    if (controller.tabColourMode() !== 2 || (controller.tabAccentColour() >>> 0) !== 0xff556677)
        throw new Error('Tab font does not follow Columns UI selected-item background');
});

suite("InfoStack button menu", function () {
    const fs = require('fs');
    const colourSource = fs.readFileSync(__path("DarkOneJSP3/shared/colour_utils.js"), 'utf8');
    const protocolSource = fs.readFileSync(__path("DarkOneJSP3/shared/jsplitter_protocols.js"), 'utf8');
    const viewBridgeSource = fs.readFileSync(__path("DarkOneJSP3/shared/view_bridge.js"), 'utf8');
    const infoColourSource = fs.readFileSync(__path("DarkOneJSP3/jsplitter/info_stack_colours.js"), 'utf8');
    const infoBridgeSource = fs.readFileSync(__path("DarkOneJSP3/jsplitter/info_stack_bridges.js"), 'utf8');
    const source = fs.readFileSync(__path("DarkOneJSP3/jsplitter/03_info_stack_tabs.js"), 'utf8');
    const properties = new Map();
    let stateWrites = 0;
    let popupTracks = 0;
    const createdMenus = [];
    const panels = Array.from({length: 6}, () => ({visible:false, bounds:null, Show(v){this.visible=!!v;}, Move(x,y,w,h){this.bounds=[x,y,w,h];}}));
    const popup = { items:[], separators:0, checks:[], radio:null, children:[],
        AppendMenuItem(flags,id,label){this.items.push([flags,id,label]);}, AppendMenuSeparator(){this.separators++;},
        CheckMenuItem(id,v){this.checks.push([id,!!v]);}, CheckMenuRadioItem(a,b,c){this.radio=[a,b,c];},
        AppendTo(parent,flags,label){parent.children.push(label);}, TrackPopupMenu(x,y){popupTracks++;this.xy=[x,y]; return global.popupId || 0;} };
    const windowMock = { Name:'DOJSP3.InfoStack', Width:600, Height:300,
        GetProperty(name,fallback){return properties.has(name)?properties.get(name):fallback;},
        SetProperty(name,value){properties.set(name,value);}, GetPanel(title){const i=['a','b','c','d','e','f'].indexOf(title); return i>=0?panels[i]:null;},
        NotifyOthers(){}, Repaint(){}, RepaintRect(){}, SetCursor(){}, GetColourCUI(){return 0xff202020;},
        CreatePopupMenu(){const m=Object.create(popup); m.items=[];m.checks=[];m.children=[];m.separators=0;createdMenus.push(m);return m;} };
    const DOJSP3Mock = {titles:{playlistManager:'a',lastfmBio:'b',lastfmInfo:'c',albumNotes:'d',queue:'e',properties:'f'},
        colours:{bar:0xff202020,separator:0xff181818,buttonNormal:0xff298fcc,buttonActive:0xffffffff,buttonHover:0xff888888},
        clamp(v,a,b){return Math.max(a,Math.min(b,v));}, idiv(v,d){return Math.floor(v/d);},
        panel(title){return windowMock.GetPanel(title);}, move(p,x,y,w,h){if(p)p.Move(x,y,w,h);}, show(p,v){if(p)p.Show(v);} };
    const factory = new Function('window','fb','include','gdi','DOJSP3','utils','darkOneJsp3HandleReset',
        colourSource+'\n'+protocolSource+'\n'+viewBridgeSource+'\n'+infoColourSource+'\n'+infoBridgeSource+'\n'+source+
        '\nreturn {on_size,on_notify_data,showInfoStackMenu,isTabStripVisible,setTabStripVisible,bridge:DarkOneViewBridge,getLayout:function(){return [tabY,tabAreaHeight,contentHeight];}};');
    const utilsMock = {InputBox(){return '0';},CreateFolder(){},WriteTextFile(path,data){if(path.indexOf('infostack-menu-state')>=0)stateWrites++;return true;}};
    const c = factory(windowMock,{ProfilePath:'',ShowPopupMessage(){}},function(){},{Font(){return {Height:16};}},DOJSP3Mock,utilsMock,function(){return false;});
    c.on_size(600,300);
    if (stateWrites !== 1) throw new Error('Initial InfoStack menu-state snapshot was not published exactly once');
    c.on_size(600,300);
    if (stateWrites !== 1) throw new Error('Unchanged InfoStack resize republished menu state');
    if (!c.isTabStripVisible() || c.getLayout()[1] <= 0 || c.getLayout()[2] >= 300) throw new Error('InfoStack tab strip default/layout is invalid');
    c.setTabStripVisible(false);
    if (stateWrites !== 2) throw new Error('InfoStack state change did not publish exactly once');
    if (c.isTabStripVisible() || c.getLayout().join(',') !== '300,0,300') throw new Error('Hidden InfoStack tab strip did not give content the full host height');
    global.popupId=250; c.showInfoStackMenu(100,299,0);
    if (stateWrites !== 3) throw new Error('InfoStack menu action did not publish exactly one changed snapshot');
    if (!c.isTabStripVisible()) throw new Error('Show tab strip menu command did not restore the strip');
    if (createdMenus[0].children.join(',') !== 'Tab settings,Appearance')
        throw new Error('InfoStack tab-strip menu still exposes Startup or changed its configuration grouping');
    global.popupId=0; c.showInfoStackMenu(100,299,0);
    if (stateWrites !== 3) throw new Error('Cancelled InfoStack menu rewrote an unchanged snapshot');
    const tracksBeforeLegacyCommand = popupTracks;
    c.on_notify_data('DarkOneJSP3.View.Command','v1|infostack-menu|500');
    if (popupTracks !== tracksBeforeLegacyCommand) throw new Error('Legacy cross-panel InfoStack command still opens a popup');
    if (stateWrites !== 3) throw new Error('Ignored legacy InfoStack popup command republished menu state');
    const serialised = c.bridge.serialise('infostack-menu','id',1000,750);
    const parsed = c.bridge.parse(serialised,1000);
    if (!parsed || parsed.anchorX !== 750) throw new Error('InfoStack button anchor was lost in the view-command file payload');
    const notification = c.bridge.parseNotificationData(c.bridge.serialiseNotification('infostack-menu',625));
    if (!notification || notification.command !== 'infostack-menu' || notification.anchorX !== 625) throw new Error('InfoStack menu notification anchor was not preserved');
    if (c.bridge.commandForButtonPath('DarkOneJSP3/InfoStack/Menu') !== 'infostack-menu') throw new Error('InfoStack optional-button command path does not resolve');
    const actionCommand = c.bridge.infoStackActionCommand(250);
    if (actionCommand !== 'infostack-action:250' || c.bridge.infoStackActionFromCommand(actionCommand) !== 250)
        throw new Error('InfoStack selected-action command did not round-trip');
    if (c.bridge.infoStackActionCommand(1000) !== null ||
            c.bridge.infoStackActionFromCommand('infostack-action:1013') !== null)
        throw new Error('InfoStack selected-action bridge still accepts removed Startup ids');
    const actionNotification = c.bridge.parseNotificationData(c.bridge.serialiseNotification(actionCommand, null));
    if (!actionNotification || actionNotification.command !== actionCommand) throw new Error('InfoStack selected action was lost in notification transport');
    const statePayload = c.bridge.serialiseInfoStackState({activeIndex:3,labels:['a','b','c','d','e','f']}, 1000);
    const stateParsed = c.bridge.parseInfoStackState(statePayload);
    if (!stateParsed || stateParsed.activeIndex !== 3 || stateParsed.labels[3] !== 'd') throw new Error('InfoStack menu state snapshot did not round-trip');
    const startupAction = c.bridge.startupActionCommand('set', 'readiness-timeout', 12000);
    const parsedStartupAction = c.bridge.parseStartupActionCommand(startupAction);
    if (startupAction !== 'startup-set:readiness-timeout:10000' || !parsedStartupAction ||
            parsedStartupAction.value !== 10000)
        throw new Error('TOOLS Startup action did not clamp and round-trip');
    const startupStatePayload = c.bridge.serialiseStartupState({
        transition: 2, minimumDelay: 5000, readinessTimeout: 7000
    }, 1000);
    const startupStateParsed = c.bridge.parseStartupState(startupStatePayload);
    if (!startupStateParsed || startupStateParsed.transition !== 2 ||
            startupStateParsed.minimumDelay !== 5000 || startupStateParsed.readinessTimeout !== 7000)
        throw new Error('Root-owned TOOLS Startup state did not round-trip');
    if (c.bridge.parseStartupState('{"version":"v2","state":{"transition":0,"minimumDelay":250,"readinessTimeout":2000}}') !== null ||
            c.bridge.parseStartupActionCommand('startup-set:unknown:1') !== null)
        throw new Error('TOOLS Startup bridge accepted an unsupported state or command');
});

suite("InfoStack local popup ownership", function () {
    const fs = require('fs');
    const colourSource = fs.readFileSync(__path("DarkOneJSP3/shared/colour_utils.js"), 'utf8');
    const bridgeSource = fs.readFileSync(__path("DarkOneJSP3/shared/view_bridge.js"), 'utf8');
    const buttonSource = fs.readFileSync(__path("DarkOneJSP3/jscript/js/Buttons_Function_OptBtnCmd.js"), 'utf8');
    let written = '';
    const state = {activeIndex:2,visible:[true,true,true,true,true,true],labels:['A','B','Custom Last.fm','D','E','F'],
        tabStripVisible:false,fixedFontSize:0,automaticFontScale:125,tabAreaHeight:0,tabColourMode:2,tabCustomColour:0xff123456,
        backgroundMode:4,backgroundCustomColour:0xff181818,dividerMode:1,dividerCustomColour:0xff000000};
    const stateRaw = JSON.stringify({version:'v1',issuedAt:Date.now(),state});
    const menus = [];
    function popup() { return {items:[],checks:[],children:[],disposed:false,
        AppendMenuItem(flags,id,label){this.items.push([flags,id,label]);}, AppendMenuSeparator(){},
        CheckMenuItem(id,v){this.checks.push([id,!!v]);}, CheckMenuRadioItem(a,b,c){this.radio=[a,b,c];},
        AppendTo(parent,flags,label){parent.children.push(label);}, TrackPopupMenu(){this.tracked=true;return 104;},
        Dispose(){this.disposed=true;} }; }
    const windowMock = {Width:500,CreatePopupMenu(){const m=popup();menus.push(m);return m;},GetColourCUI(){return 0xff202020;},
        GetProperty(n,f){return f;},SetProperty(){}};
    const fbMock = {ProfilePath:'P:/'};
    const utilsMock = {CreateFolder(){},ReadTextFile(path){return path.indexOf('infostack-menu-state')>=0?stateRaw:'';},
        WriteTextFile(path,data){written=data;return true;},MessageBox(){throw new Error('Unexpected error dialog');}};
    const factory = new Function('window','fb','utils','MB_OK','MB_ICONEXCLAMATION', colourSource+'\n'+bridgeSource+'\n'+buttonSource+
        '\nreturn {show:darkOneShowInfoStackLocalMenu,bridge:DarkOneViewBridge};');
    const api = factory(windowMock,fbMock,utilsMock,0,0);
    api.show({x:100,y:10,w:80,h:20});
    if (!menus.length || !menus[0].tracked || !menus.every(m=>m.disposed)) throw new Error('INFOSTACK local popup was not tracked/disposed by the button panel');
    if (!menus[0].items.some(item=>item[1]===102 && item[2]==='Custom Last.fm')) throw new Error('INFOSTACK local popup did not use the live state snapshot labels');
    if (menus[0].children.join(',') !== 'Tab settings,Appearance') throw new Error('INFOSTACK local popup still exposes Startup');
    const parsed = api.bridge.parse(written,Date.now());
    if (!parsed || parsed.command !== 'infostack-action:104' || parsed.anchorX !== null) throw new Error('INFOSTACK local popup did not bridge only its selected action');
});

suite("InfoStack background modes", function () {
    const fs = require('fs');
    const colourSource = fs.readFileSync(__path("DarkOneJSP3/shared/colour_utils.js"), 'utf8');
    const protocolSource = fs.readFileSync(__path("DarkOneJSP3/shared/jsplitter_protocols.js"), 'utf8');
    const infoColourSource = fs.readFileSync(__path("DarkOneJSP3/jsplitter/info_stack_colours.js"), 'utf8');
    const infoBridgeSource = fs.readFileSync(__path("DarkOneJSP3/jsplitter/info_stack_bridges.js"), 'utf8');
    const source = fs.readFileSync(__path("DarkOneJSP3/jsplitter/03_info_stack_tabs.js"), 'utf8');
    const properties = new Map();
    const windowMock = {
        GetProperty(name, fallback) {
            return properties.has(name) ? properties.get(name) : fallback;
        },
        SetProperty(name, value) { properties.set(name, value); },
        GetColourCUI(index) { return index === 3 ? 0xff445566 : 0xffffffff; },
        GetPanel() { return null; },
        NotifyOthers() {},
        Repaint() {},
        RepaintRect() {},
        SetCursor() {}
    };
    const DOJSP3Mock = {
        titles: {
            playlistManager: 'a', lastfmBio: 'b', lastfmInfo: 'c',
            albumNotes: 'd', queue: 'e', properties: 'f'
        },
        colours: {
            bar: 0xff202020, separator: 0xff181818,
            buttonActive: 0xffffffff, buttonHover: 0xff888888
        },
        clamp(value, minimum, maximum) {
            return Math.max(minimum, Math.min(maximum, value));
        }
    };
    const factory = new Function(
        'window', 'fb', 'include', 'gdi', 'DOJSP3', 'utils',
        'darkOneJsp3HandleReset',
        colourSource + '\n' + protocolSource + '\n' + infoColourSource + '\n' + infoBridgeSource + '\n' + source + '\nreturn { backgroundMode, backgroundColour };'
    );
    const controller = factory(
        windowMock,
        { ProfilePath: '' },
        function() {},
        { Font() { return {}; } },
        DOJSP3Mock,
        {},
        function() { return false; }
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
});

suite("Waveform background modes", function () {
    const fs = require('fs');
    const colourSource = fs.readFileSync(__path("DarkOneJSP3/shared/colour_utils.js"), 'utf8');
    const protocolSource = fs.readFileSync(__path("DarkOneJSP3/shared/jsplitter_protocols.js"), 'utf8');
    const source = fs.readFileSync(__path("DarkOneJSP3/jsplitter/06_display_waveform.js"), 'utf8');
    const properties = new Map();
    const initialBottomState = 'v1|1|4278190080|4|4278190080';
    let repaintCount = 0;
    const fills = [];
    const waveformTimers = [];
    function waveformSetTimeout(fn, delay) { waveformTimers.push({fn, delay, active:true}); return waveformTimers.length; }
    function waveformClearTimeout(id) { if (id > 0 && id <= waveformTimers.length) waveformTimers[id - 1].active = false; }
    const windowMock = {
        GetProperty(name, fallback) {
            return properties.has(name) ? properties.get(name) : fallback;
        },
        SetProperty(name, value) { properties.set(name, value); },
        GetColourCUI(index) { return index === 3 ? 0xff445566 : 0xffffffff; },
        NotifyOthers() {},
        Repaint() { repaintCount++; }
    };
    const DOJSP3Mock = {
        colours: { bar: 0xff202020, separator: 0xff181818 },
        clamp(value, minimum, maximum) {
            return Math.max(minimum, Math.min(maximum, value));
        }
    };
    const utilsMock = {
        ReadTextFile() { return initialBottomState; }
    };
    const factory = new Function(
        'window', 'fb', 'include', 'DOJSP3', 'darkOneJsp3HandleReset', 'utils', 'setTimeout', 'clearTimeout',
        colourSource + '\n' + protocolSource + '\n' + source +
        '\nreturn { Protocol:DarkOneProtocol, backgroundMode, backgroundColour, applySharedBottomAreaState, configureWaveformPseudoTransparency, on_notify_data, on_colours_changed, on_paint, setSize:function(w,h){ww=w;wh=h;} };'
    );
    const controller = factory(
        windowMock,
        { ProfilePath: '', IsPlaying: false },
        function() {},
        DOJSP3Mock,
        function() { return false; },
        utilsMock,
        waveformSetTimeout,
        waveformClearTimeout
    );
    controller.setSize(640, 300);
    const pseudoTransparentWaveform = { SupportPseudoTransparency: false };
    if (!controller.configureWaveformPseudoTransparency(pseudoTransparentWaveform) ||
            pseudoTransparentWaveform.SupportPseudoTransparency !== true)
        throw new Error('Waveform child was not opted into JSplitter pseudo-transparency support');
    if (controller.backgroundMode() !== 6 ||
            (controller.backgroundColour() >>> 0) !== 0xff000000)
        throw new Error('Default waveform host does not automatically follow the bottom background');

    const automaticModeMatrix = [
        [0, 0xff181818],
        [1, 0xff000000],
        [2, 0xff202020],
        [3, 0xff123456],
        [4, 0xff181818],
        [5, 0xff445566]
    ];
    automaticModeMatrix.forEach(function(entry) {
        const mode = entry[0];
        const expected = entry[1] >>> 0;
        controller.on_notify_data(
            'DarkOneJSP3.BottomArea.State',
            'v1|' + mode + '|' + (0xff123456 >>> 0) + '|4|' + (0xff000000 >>> 0)
        );
        if ((controller.backgroundColour() >>> 0) !== expected)
            throw new Error('Automatic waveform host mode ' + mode +
                ' resolved to ' + (controller.backgroundColour() >>> 0).toString(16) +
                ' instead of ' + expected.toString(16));
    });

    properties.set('DarkOneJSP3.DisplayWaveform.BackgroundColour', 0xff123456);
    properties.set('DarkOneJSP3.DisplayWaveform.BackgroundMode', 4);
    if (controller.backgroundMode() !== 4 ||
            (controller.backgroundColour() >>> 0) !== 0xff181818)
        throw new Error('Waveform DarkOne dark grey mode no longer works');
    properties.set('DarkOneJSP3.DisplayWaveform.BackgroundMode', 3);
    if (controller.backgroundMode() !== 3 ||
            (controller.backgroundColour() >>> 0) !== 0xff123456)
        throw new Error('Waveform custom background mode no longer works');
    properties.set('DarkOneJSP3.DisplayWaveform.BackgroundMode', 5);
    if (controller.backgroundMode() !== 5 ||
            (controller.backgroundColour() >>> 0) !== 0xff445566)
        throw new Error('Waveform fixed Columns UI background mode no longer works');

    properties.set('DarkOneJSP3.DisplayWaveform.BackgroundMode', 6);
    const beforeNotification = repaintCount;
    controller.on_notify_data('DarkOneJSP3.BottomArea.State', 'v1|3|4279383126|4|4278190080');
    if ((controller.backgroundColour() >>> 0) !== 0xff123456)
        throw new Error('Automatic waveform host did not adopt the shared custom background');
    if (repaintCount !== beforeNotification + 1)
        throw new Error('Automatic waveform host did not repaint exactly once after shared state changed');

    controller.on_notify_data('DarkOneJSP3.BottomArea.State', 'v1|0|4278190080|4|4278190080');
    if ((controller.backgroundColour() >>> 0) !== 0xff181818)
        throw new Error('Automatic inherited waveform host does not resolve to #181818');
    fills.length = 0;
    controller.on_paint({ FillSolidRect(x,y,w,h,colour) { fills.push([x,y,w,h,colour>>>0]); } });
    if (fills.length !== 1 || fills[0][4] !== 0xff181818)
        throw new Error('Automatic inherited waveform host does not paint the uniform parent tone');

    properties.set('DarkOneJSP3.DisplayWaveform.BackgroundMode', 0);
    fills.length = 0;
    if ((controller.backgroundColour() >>> 0) !== 0xff181818)
        throw new Error('Fixed inherited waveform host does not resolve to #181818');
    controller.on_paint({ FillSolidRect(x,y,w,h,colour) { fills.push([x,y,w,h,colour>>>0]); } });
    if (fills.length !== 1 || fills[0][4] !== 0xff181818)
        throw new Error('Fixed inherited waveform host does not paint its full resolved backing');

    properties.set('DarkOneJSP3.DisplayWaveform.BackgroundMode', 6);
    controller.on_notify_data('DarkOneJSP3.BottomArea.State', 'v1|5|4278190080|4|4278190080');
    if ((controller.backgroundColour() >>> 0) !== 0xff445566)
        throw new Error('Automatic waveform host does not follow the shared Columns UI mode');

    const waveformCommit = controller.Protocol.bottomArea.commit(
        'waveform-sync', Date.now(), Date.now() + 50,
        controller.Protocol.bottomArea.state(1, 0xff000000, 4, 0xff000000)
    );
    const beforeCommitRepaint = repaintCount;
    controller.on_notify_data(
        controller.Protocol.bottomArea.notifications.commit,
        controller.Protocol.bottomArea.serialiseCommit(waveformCommit)
    );
    if ((controller.backgroundColour() >>> 0) !== 0xff445566 || repaintCount !== beforeCommitRepaint)
        throw new Error('Waveform host exposed a coordinated background before applyAt');
    const waveformApplyTimer = [...waveformTimers].reverse().find(item => item.active);
    if (!waveformApplyTimer) throw new Error('Waveform host did not schedule coordinated background apply');
    waveformApplyTimer.active = false;
    waveformApplyTimer.fn();
    if ((controller.backgroundColour() >>> 0) !== 0xff000000 || repaintCount !== beforeCommitRepaint + 1)
        throw new Error('Waveform host did not apply the coordinated background exactly once');

    const beforeColoursChanged = repaintCount;
    controller.on_colours_changed();
    if (repaintCount !== beforeColoursChanged + 1)
        throw new Error('Waveform host does not repaint after a Columns UI colour change');
});

suite("upper-divider state", function () {
    const fs = require('fs');
    const colourSource = fs.readFileSync(__path("DarkOneJSP3/shared/colour_utils.js"), 'utf8');
    const protocolSource = fs.readFileSync(__path("DarkOneJSP3/shared/jsplitter_protocols.js"), 'utf8');
    const source = fs.readFileSync(__path("DarkOneJSP3/jsplitter/02_main_columns.js"), 'utf8');
    const properties = new Map();
    const notifications = [];
    const fills = [];
    const operations = [];
    let repaints = 0;
    const panels = {
        Info: { name: 'Info', Width: 638, visible: true },
        Art: { name: 'Art', Width: 638, visible: true },
        Playlist: { name: 'Playlist', Width: 638, visible: true }
    };
    const windowMock = {
        GetProperty(name, fallback) {
            return properties.has(name) ? properties.get(name) : fallback;
        },
        SetProperty(name, value) { properties.set(name, value); },
        GetColourCUI(index) { return index === 3 ? 0xff445566 : 0xffffffff; },
        NotifyOthers(name, data) {
            notifications.push([name, data]);
            if (name === 'DarkOneJSP3.ArtSpectrum.PrepareLayout')
                operations.push(['prepare', String(data)]);
        },
        Repaint() { repaints++; },
        CreatePopupMenu() { throw new Error('Menu should not be opened by paint smoke test'); }
    };
    const DOJSP3Mock = {
        colours: { bar: 0xff202020, separator: 0xff181818 },
        titles: { infoStack: 'Info', artSpectrum: 'Art', playlist: 'Playlist' },
        clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); },
        idiv(value, divisor) { return Math.floor(value / divisor); },
        panel(name) { return panels[name] || null; },
        move(panel, x, y, width, height) {
            panel.Width = width;
            operations.push(['move', panel.name, x, y, width, height]);
        },
        show(panel, visible) {
            if (!panel) return;
            panel.visible = Boolean(visible);
            operations.push(['show', panel.name, Boolean(visible)]);
        }
    };
    const factory = new Function(
        'window', 'fb', 'include', 'utils', 'DOJSP3', 'darkOneJsp3HandleReset', 'DarkOneViewBridge',
        colourSource + '\n' + protocolSource + '\n' + source + '\nreturn { on_paint, on_notify_data, dividerMode, dividerColour, dividerState, parseDividerState: DarkOneProtocol.divider.parseState, isDividerPoint, dividerMetrics, setMainLayoutMode, setSize: function(w, h) { ww = w; wh = h; } };'
    );
    const controller = factory(
        windowMock,
        { ProfilePath: '' },
        function() {},
        {},
        DOJSP3Mock,
        function() { return false; },
        {
            notification: 'DarkOneJSP3.View.Command',
            commands: { layoutToggle: 'layout-toggle' },
            parseNotification() { return null; }
        }
    );
    const gr = { FillSolidRect(x, y, w, h, colour) { fills.push([x, y, w, h, colour >>> 0]); } };
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

    // Visualiser state must never control standard divider visibility. Art-only
    // repaints the parent so both host-owned divider strips are restored.
    properties.set('DARKONEJSP3.MAIN.LAYOUT.MODE', 0);
    fills.length = 0;
    const repaintsBeforeArtOnly = repaints;
    controller.on_notify_data('DarkOneJSP3.ArtSpectrum.Mode.State', 'art-only');
    if (repaints <= repaintsBeforeArtOnly)
        throw new Error('Art-only mode did not repaint the standard host dividers');
    controller.on_paint(gr);
    if (fills.length !== 3)
        throw new Error('Standard layout lost a side divider when Spectrum was hidden');

    // Alternate layout owns only the right divider between ArtSpectrum and
    // Playlist. There is no left divider because ArtSpectrum starts at x=0.
    properties.set('DARKONEJSP3.MAIN.LAYOUT.MODE', 1);
    fills.length = 0;
    controller.on_paint(gr);
    if (fills.length !== 2 || fills[1][0] !== 900)
        throw new Error('Alternate layout did not paint exactly its right divider');

    // Layout transitions must hide ArtSpectrum, prepare final child geometry,
    // move the host/siblings, then reveal ArtSpectrum in the same callback.
    properties.set('DARKONEJSP3.MAIN.LAYOUT.MODE', 0);
    operations.length = 0;
    controller.setMainLayoutMode(1);
    const hideArt = operations.findIndex(item => item[0] === 'show' && item[1] === 'Art' && item[2] === false);
    const prepare = operations.findIndex(item => item[0] === 'prepare');
    const moveArt = operations.findIndex(item => item[0] === 'move' && item[1] === 'Art');
    const movePlaylist = operations.findIndex(item => item[0] === 'move' && item[1] === 'Playlist');
    const showArt = operations.findIndex(item => item[0] === 'show' && item[1] === 'Art' && item[2] === true);
    if (!(hideArt >= 0 && prepare > hideArt && moveArt > prepare &&
            movePlaylist > moveArt && showArt > movePlaylist))
        throw new Error('Alternate layout transition exposes intermediate ArtSpectrum geometry');
});
