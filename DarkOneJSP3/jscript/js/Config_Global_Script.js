// =========================================================================================================
// DarkOneJSP3 global configuration - native JScript Panel 3 / Direct2D / DirectWrite
// Target: JScript Panel 3.8.5
// Original DarkOne4Mod code by tedGo; DarkOne2021 and JSP2 optimisation history preserved.
// =========================================================================================================

var configName = "DarkOneJSP3";
var configPath = fb.ProfilePath + configName + "\\";
var imgPath = configPath + "images\\";
var sysWidth = utils.GetSystemMetrics(0);
var ui_type = window.IsDefaultUI ? 1 : 0;
var p_backcol = RGBA(32, 32, 32, 255);
var ww = 0, wh = 0;
var ui_backcol = 0, ui_textcol = 0, ui_btntxtcol = 0;

function combColours(a, b, e) {
    a = toRGB(a);
    b = toRGB(b);
    return 0xff000000 | Math.round(a[0] + e * (b[0] - a[0])) << 16 | Math.round(a[1] + e * (b[1] - a[1])) << 8 | Math.round(a[2] + e * (b[2] - a[2]));
}

function get_colours() {
    ui_backcol = ui_type == 0 ? window.GetColourCUI(3) : window.GetColourDUI(1);
    ui_textcol = ui_type == 0 ? window.GetColourCUI(0) : window.GetColourDUI(0);
    ui_btntxtcol = ui_type == 0 ? window.GetColourCUI(2) : window.GetColourDUI(0);
}
get_colours();

// Shared bottom-area appearance. These helpers deliberately live in the
// long-standing global configuration import so older saved control/display
// entries receive the feature without requiring a new @import line.
var DARKONE_RUNTIME_DATA_DIR = fb.ProfilePath + 'js_data\\';
var DARKONE_BOTTOM_AREA_PROTOCOL_VERSION = 'v5';
var DARKONE_BOTTOM_AREA_STATE_FILE = DARKONE_RUNTIME_DATA_DIR + 'darkonejsp3.bottom-area-state.txt';
var DARKONE_BOTTOM_AREA_COMMIT_FILE = DARKONE_RUNTIME_DATA_DIR + 'darkonejsp3.bottom-area-command.txt';
var DARKONE_BOTTOM_AREA_GEOMETRY_FILE = DARKONE_RUNTIME_DATA_DIR + 'darkonejsp3.bottom-area-geometry.txt';
var DARKONE_BOTTOM_AREA_GEOMETRY_VERSION = 'v1';
var DARKONE_BOTTOM_AREA_COMMIT_VERSION = 'v5';
var DARKONE_BOTTOM_AREA_COMMIT_DELAY = 50;
var DARKONE_BOTTOM_AREA_COMMIT_MAX_AGE = 5000;
var DARKONE_BOTTOM_AREA_COMMIT_MAX_LEAD = 1000;
var DARKONE_BOTTOM_AREA_LEGACY_STATE_FILE = fb.ProfilePath + 'DarkOneJSP3\\shared\\bottom-area-state.txt';
var DARKONE_RESET_COMMAND_FILE = DARKONE_RUNTIME_DATA_DIR + 'darkonejsp3.reset-command.txt';
var DARKONE_BOTTOM_AREA_STATE_RETRY_DELAY = 250;
var DARKONE_BOTTOM_AREA_STATE_RETRY_LIMIT = 8;
var darkOneBottomAreaStateRetryTimer = null;
var darkOneBottomAreaStateRetryAttempt = 0;
var darkOneBottomAreaStateRetrySerialised = '';
var darkOneBottomAreaCommitTimer = null;
var darkOneBottomAreaPendingCommitId = '';
var darkOneBottomAreaCommitSequence = 0;
var darkOneBottomAreaInitialised = false;
var darkOneBottomAreaPaintGradient = false;
var darkOneBottomAreaPaintDepthMode = 0;
var darkOneBottomAreaGradientHeight = 1;
var darkOneBottomAreaGradientOffsetY = 0;
var darkOneBottomAreaGradientBrushKey = '';
var darkOneBottomAreaGradientBrush = '';
var darkOneBottomAreaHighlightColour = 0xff262626;
var darkOneResetCommandSequence = 0;
var DARKONE_BOTTOM_AREA_NOTIFICATIONS = Object.freeze({
    query : 'DarkOneJSP3.BottomArea.Query',
    state : 'DarkOneJSP3.BottomArea.State',
    commit : 'DarkOneJSP3.BottomArea.Commit'
});
var DARKONE_BOTTOM_MODE_TRANSPARENT = 0;
var DARKONE_BOTTOM_MODE_BLACK = 1;
var DARKONE_BOTTOM_MODE_DARKONE = 2;
var DARKONE_BOTTOM_MODE_CUSTOM = 3;
var DARKONE_BOTTOM_MODE_DARKONE_DARK = 4;
var DARKONE_BOTTOM_MODE_COLUMNS_UI = 5;
var DARKONE_BOTTOM_MODE_VALUES = [0, 1, 2, 3, 4, 5];
var DARKONE_BOTTOM_BACKGROUND_MODE_PROPERTY = 'DARKONEJSP3.BOTTOM.BACKGROUND.MODE';
var DARKONE_BOTTOM_BACKGROUND_CUSTOM_PROPERTY = 'DARKONEJSP3.BOTTOM.BACKGROUND.CUSTOM.COLOUR';
var DARKONE_BOTTOM_BACKGROUND_GRADIENT_PROPERTY = 'DARKONEJSP3.BOTTOM.BACKGROUND.LINEAR.GRADIENT';
var DARKONE_BOTTOM_DIVIDER_MODE_PROPERTY = 'DARKONEJSP3.BOTTOM.DIVIDER.MODE';
var DARKONE_BOTTOM_DIVIDER_CUSTOM_PROPERTY = 'DARKONEJSP3.BOTTOM.DIVIDER.CUSTOM.COLOUR';
var DARKONE_BOTTOM_SIDE_DIVIDERS_PROPERTY = 'DARKONEJSP3.BOTTOM.SIDE.DIVIDERS';
var DARKONE_BOTTOM_DEPTH_PROPERTY = 'DARKONEJSP3.BOTTOM.DEPTH';
var DARKONE_BOTTOM_BACKGROUND_DEFAULT = DARKONE_BOTTOM_MODE_DARKONE;
var DARKONE_BOTTOM_DIVIDER_DEFAULT = DARKONE_BOTTOM_MODE_DARKONE_DARK;
var DARKONE_BOTTOM_CUSTOM_DEFAULT = 0xff000000;
var DARKONE_BOTTOM_BACKGROUND_GRADIENT_DEFAULT = false;
var DARKONE_BOTTOM_BACKGROUND_GRADIENT_MENU_ID = 9827;
var DARKONE_BOTTOM_SIDE_DIVIDERS_DEFAULT = true;
var DARKONE_BOTTOM_SIDE_DIVIDERS_MENU_ID = 9828;
var DARKONE_BOTTOM_DEPTH_FLAT = 0;
var DARKONE_BOTTOM_DEPTH_SOFT = 1;
var DARKONE_BOTTOM_DEPTH_VALUES = [DARKONE_BOTTOM_DEPTH_FLAT, DARKONE_BOTTOM_DEPTH_SOFT];
var DARKONE_BOTTOM_DEPTH_DEFAULT = DARKONE_BOTTOM_DEPTH_FLAT;
var DARKONE_BOTTOM_DEPTH_FIRST_MENU_ID = 9829;
var DARKONE_BOTTOM_DEPTH_LAST_MENU_ID = 9830;
var DARKONE_VOLUME_KNOB_INDICATOR_MODE_PROPERTY = 'DARKONEJSP3.VOLUME.KNOB.INDICATOR.MODE';
var DARKONE_VOLUME_KNOB_INDICATOR_PROPERTY = 'DARKONEJSP3.VOLUME.KNOB.INDICATOR.COLOUR';
var DARKONE_VOLUME_KNOB_INDICATOR_DEFAULT = 0xff404040;
var DARKONE_VOLUME_KNOB_INDICATOR_MODE_DEFAULT = 0;
var DARKONE_VOLUME_KNOB_INDICATOR_MODE_CUSTOM = 1;

function darkOneBottomMenuOptions(baseId, transparentLabel) {
    return [
        { id : baseId, mode : DARKONE_BOTTOM_MODE_TRANSPARENT, label : transparentLabel },
        { id : baseId + 1, mode : DARKONE_BOTTOM_MODE_BLACK, label : 'Black' },
        { id : baseId + 2, mode : DARKONE_BOTTOM_MODE_DARKONE, label : 'DarkOne grey' },
        { id : baseId + 3, mode : DARKONE_BOTTOM_MODE_DARKONE_DARK, label : 'DarkOne dark grey' },
        { id : baseId + 4, mode : DARKONE_BOTTOM_MODE_COLUMNS_UI, label : 'Columns UI global background' },
        { id : baseId + 5, mode : DARKONE_BOTTOM_MODE_CUSTOM, custom : true }
    ];
}
var DARKONE_BOTTOM_BACKGROUND_MENU_OPTIONS = darkOneBottomMenuOptions(
    9800,
    'Transparent / inherit parent'
);
var DARKONE_BOTTOM_DIVIDER_MENU_OPTIONS = darkOneBottomMenuOptions(
    9820,
    'Transparent / inherit background'
);

function darkOneBottomOpaque(colour) {
    return 0xff000000 + ((Number(colour) >>> 0) & 0x00ffffff);
}
function darkOneVolumeKnobIndicatorCustomColour() {
    return darkOneBottomOpaque(window.GetProperty(
        DARKONE_VOLUME_KNOB_INDICATOR_PROPERTY,
        DARKONE_VOLUME_KNOB_INDICATOR_DEFAULT
    ));
}
function darkOneVolumeKnobIndicatorMode() {
    return Number(window.GetProperty(
        DARKONE_VOLUME_KNOB_INDICATOR_MODE_PROPERTY,
        DARKONE_VOLUME_KNOB_INDICATOR_MODE_DEFAULT
    )) === DARKONE_VOLUME_KNOB_INDICATOR_MODE_CUSTOM
        ? DARKONE_VOLUME_KNOB_INDICATOR_MODE_CUSTOM
        : DARKONE_VOLUME_KNOB_INDICATOR_MODE_DEFAULT;
}
function darkOneVolumeKnobIndicatorColour() {
    return darkOneVolumeKnobIndicatorMode() === DARKONE_VOLUME_KNOB_INDICATOR_MODE_CUSTOM
        ? darkOneVolumeKnobIndicatorCustomColour()
        : DARKONE_VOLUME_KNOB_INDICATOR_DEFAULT;
}
function darkOneBottomHex(colour) {
    var value = ((Number(colour) >>> 0) & 0x00ffffff).toString(16).toUpperCase();
    while (value.length < 6) value = '0' + value;
    return '#' + value;
}
function darkOneBottomParseColour(value) {
    value = String(value || '').replace(/^\s+|\s+$/g, '');
    var match = value.match(/^#?([0-9a-f]{6})$/i);
    if (match) return 0xff000000 + parseInt(match[1], 16);
    match = value.match(/^\s*(\d{1,3})\s*[,; ]\s*(\d{1,3})\s*[,; ]\s*(\d{1,3})\s*$/);
    if (!match) return null;
    function channel(number) { return Math.max(0, Math.min(255, parseInt(number, 10))); }
    return 0xff000000 + channel(match[1]) * 0x10000 + channel(match[2]) * 0x100 + channel(match[3]);
}
function darkOneBottomNormaliseMode(value, fallback) {
    value = Math.round(Number(value));
    return DARKONE_BOTTOM_MODE_VALUES.indexOf(value) >= 0 ? value : fallback;
}
function darkOneBottomNormaliseBoolean(value, fallback) {
    if (value === true || value === 1 || value === '1' || value === 'true') return true;
    if (value === false || value === 0 || value === '0' || value === 'false') return false;
    return Boolean(fallback);
}
function darkOneBottomNormaliseDepth(value, fallback) {
    value = Math.round(Number(value));
    return DARKONE_BOTTOM_DEPTH_VALUES.indexOf(value) >= 0 ? value : fallback;
}
function darkOneBottomNormaliseRevision(value, fallback) {
    value = String(value || '');
    if (/^[A-Za-z0-9._-]{1,128}$/.test(value)) return value;
    return typeof fallback !== 'undefined' ? String(fallback) : 'state';
}
function darkOneBottomBackgroundMode() {
    return darkOneBottomNormaliseMode(
        window.GetProperty(DARKONE_BOTTOM_BACKGROUND_MODE_PROPERTY, DARKONE_BOTTOM_BACKGROUND_DEFAULT),
        DARKONE_BOTTOM_BACKGROUND_DEFAULT
    );
}
function darkOneBottomDividerMode() {
    return darkOneBottomNormaliseMode(
        window.GetProperty(DARKONE_BOTTOM_DIVIDER_MODE_PROPERTY, DARKONE_BOTTOM_DIVIDER_DEFAULT),
        DARKONE_BOTTOM_DIVIDER_DEFAULT
    );
}
function darkOneBottomBackgroundCustomColour() {
    return darkOneBottomOpaque(window.GetProperty(
        DARKONE_BOTTOM_BACKGROUND_CUSTOM_PROPERTY,
        DARKONE_BOTTOM_CUSTOM_DEFAULT
    ));
}
function darkOneBottomBackgroundLinearGradient() {
    return darkOneBottomNormaliseBoolean(
        window.GetProperty(
            DARKONE_BOTTOM_BACKGROUND_GRADIENT_PROPERTY,
            DARKONE_BOTTOM_BACKGROUND_GRADIENT_DEFAULT
        ),
        DARKONE_BOTTOM_BACKGROUND_GRADIENT_DEFAULT
    );
}
function darkOneBottomDividerCustomColour() {
    return darkOneBottomOpaque(window.GetProperty(
        DARKONE_BOTTOM_DIVIDER_CUSTOM_PROPERTY,
        DARKONE_BOTTOM_CUSTOM_DEFAULT
    ));
}
function darkOneBottomSideDividersVisible() {
    return darkOneBottomNormaliseBoolean(
        window.GetProperty(
            DARKONE_BOTTOM_SIDE_DIVIDERS_PROPERTY,
            DARKONE_BOTTOM_SIDE_DIVIDERS_DEFAULT
        ),
        DARKONE_BOTTOM_SIDE_DIVIDERS_DEFAULT
    );
}
function darkOneBottomDepthMode() {
    return darkOneBottomNormaliseDepth(
        window.GetProperty(DARKONE_BOTTOM_DEPTH_PROPERTY, DARKONE_BOTTOM_DEPTH_DEFAULT),
        DARKONE_BOTTOM_DEPTH_DEFAULT
    );
}
function darkOneBottomAreaState() {
    return {
        revision : 'state',
        backgroundMode : darkOneBottomBackgroundMode(),
        backgroundCustomColour : darkOneBottomBackgroundCustomColour(),
        backgroundLinearGradient : darkOneBottomBackgroundLinearGradient(),
        dividerMode : darkOneBottomDividerMode(),
        dividerCustomColour : darkOneBottomDividerCustomColour(),
        sideDividersVisible : darkOneBottomSideDividersVisible(),
        depthMode : darkOneBottomDepthMode()
    };
}
function darkOneBottomAreaSerialiseState(state) {
    state = state || darkOneBottomAreaState();
    return DARKONE_BOTTOM_AREA_PROTOCOL_VERSION + '|' +
        darkOneBottomNormaliseRevision(state.revision, 'state') + '|' +
        String(darkOneBottomNormaliseMode(state.backgroundMode, DARKONE_BOTTOM_BACKGROUND_DEFAULT)) + '|' +
        String(darkOneBottomOpaque(state.backgroundCustomColour) >>> 0) + '|' +
        (darkOneBottomNormaliseBoolean(state.backgroundLinearGradient, false) ? '1' : '0') + '|' +
        String(darkOneBottomNormaliseMode(state.dividerMode, DARKONE_BOTTOM_DIVIDER_DEFAULT)) + '|' +
        String(darkOneBottomOpaque(state.dividerCustomColour) >>> 0) + '|' +
        (darkOneBottomNormaliseBoolean(state.sideDividersVisible, true) ? '1' : '0') + '|' +
        String(darkOneBottomNormaliseDepth(state.depthMode, DARKONE_BOTTOM_DEPTH_DEFAULT));
}
function darkOneBottomAreaParseState(data) {
    if (data && typeof data == 'object') {
        return {
            revision : darkOneBottomNormaliseRevision(data.revision, 'state'),
            backgroundMode : darkOneBottomNormaliseMode(data.backgroundMode, DARKONE_BOTTOM_BACKGROUND_DEFAULT),
            backgroundCustomColour : darkOneBottomOpaque(data.backgroundCustomColour),
            backgroundLinearGradient : darkOneBottomNormaliseBoolean(
                data.backgroundLinearGradient,
                DARKONE_BOTTOM_BACKGROUND_GRADIENT_DEFAULT
            ),
            dividerMode : darkOneBottomNormaliseMode(data.dividerMode, DARKONE_BOTTOM_DIVIDER_DEFAULT),
            dividerCustomColour : darkOneBottomOpaque(data.dividerCustomColour),
            sideDividersVisible : darkOneBottomNormaliseBoolean(
                data.sideDividersVisible,
                DARKONE_BOTTOM_SIDE_DIVIDERS_DEFAULT
            ),
            depthMode : darkOneBottomNormaliseDepth(
                data.depthMode,
                DARKONE_BOTTOM_DEPTH_DEFAULT
            )
        };
    }
    var parts = String(data || '').split('|');
    var legacyV1 = parts.length === 5 && parts[0] === 'v1';
    if (!legacyV1 &&
            (parts.length !== 9 || parts[0] !== DARKONE_BOTTOM_AREA_PROTOCOL_VERSION)) return null;
    var revision = legacyV1 ? 'v1-migration' :
        darkOneBottomNormaliseRevision(parts[1], '');
    if (!revision) return null;
    var offset = legacyV1 ? 0 : 1;
    var backgroundMode = Number(parts[1 + offset]);
    var backgroundCustomColour = Number(parts[2 + offset]);
    var backgroundLinearGradient = legacyV1 ? false : parts[4];
    var dividerMode = Number(parts[legacyV1 ? 3 : 5]);
    var dividerCustomColour = Number(parts[legacyV1 ? 4 : 6]);
    var sideDividersVisible = legacyV1 ? true : parts[7];
    var depthMode = legacyV1 ? DARKONE_BOTTOM_DEPTH_FLAT : parts[8];
    if (!isFinite(backgroundMode) || !isFinite(backgroundCustomColour) ||
            !isFinite(dividerMode) || !isFinite(dividerCustomColour)) return null;
    return {
        revision : revision,
        backgroundMode : darkOneBottomNormaliseMode(backgroundMode, DARKONE_BOTTOM_BACKGROUND_DEFAULT),
        backgroundCustomColour : darkOneBottomOpaque(backgroundCustomColour),
        backgroundLinearGradient : darkOneBottomNormaliseBoolean(
            backgroundLinearGradient,
            DARKONE_BOTTOM_BACKGROUND_GRADIENT_DEFAULT
        ),
        dividerMode : darkOneBottomNormaliseMode(dividerMode, DARKONE_BOTTOM_DIVIDER_DEFAULT),
        dividerCustomColour : darkOneBottomOpaque(dividerCustomColour),
        sideDividersVisible : darkOneBottomNormaliseBoolean(
            sideDividersVisible,
            DARKONE_BOTTOM_SIDE_DIVIDERS_DEFAULT
        ),
        depthMode : darkOneBottomNormaliseDepth(
            depthMode,
            DARKONE_BOTTOM_DEPTH_DEFAULT
        )
    };
}

function darkOneBottomAreaCommit(id, issuedAt, applyAt, state) {
    id = String(id || '');
    issuedAt = Math.round(Number(issuedAt));
    applyAt = Math.round(Number(applyAt));
    state = darkOneBottomAreaParseState(state);
    if (!/^[A-Za-z0-9._-]{1,128}$/.test(id) ||
            !isFinite(issuedAt) || !isFinite(applyAt) || !state ||
            applyAt < issuedAt ||
            applyAt - issuedAt > DARKONE_BOTTOM_AREA_COMMIT_MAX_LEAD) return null;
    state.revision = id;
    return { id : id, issuedAt : issuedAt, applyAt : applyAt, state : state };
}
function darkOneBottomAreaSerialiseCommit(commit) {
    commit = commit && darkOneBottomAreaCommit(
        commit.id,
        commit.issuedAt,
        commit.applyAt,
        commit.state
    );
    if (!commit) return '';
    var state = commit.state;
    return DARKONE_BOTTOM_AREA_COMMIT_VERSION + '|' + commit.id + '|' +
        String(commit.issuedAt) + '|' + String(commit.applyAt) + '|' +
        String(state.backgroundMode) + '|' + String(state.backgroundCustomColour >>> 0) + '|' +
        (state.backgroundLinearGradient ? '1' : '0') + '|' +
        String(state.dividerMode) + '|' + String(state.dividerCustomColour >>> 0) + '|' +
        (state.sideDividersVisible ? '1' : '0') + '|' + String(state.depthMode);
}
function darkOneBottomAreaParseCommit(data, now) {
    if (data && typeof data == 'object') {
        var objectCommit = darkOneBottomAreaCommit(
            data.id,
            data.issuedAt,
            data.applyAt,
            data.state || data
        );
        if (!objectCommit) return null;
        now = Math.round(Number(now));
        if (isFinite(now) &&
                (objectCommit.issuedAt > now + DARKONE_BOTTOM_AREA_COMMIT_MAX_AGE ||
                 now - objectCommit.issuedAt > DARKONE_BOTTOM_AREA_COMMIT_MAX_AGE)) return null;
        return objectCommit;
    }
    var parts = String(data || '').split('|');
    if (parts.length !== 11 || parts[0] !== DARKONE_BOTTOM_AREA_COMMIT_VERSION) return null;
    var commit = darkOneBottomAreaCommit(
        parts[1],
        Number(parts[2]),
        Number(parts[3]),
        {
            backgroundMode : Number(parts[4]),
            backgroundCustomColour : Number(parts[5]),
            backgroundLinearGradient : parts[6],
            dividerMode : Number(parts[7]),
            dividerCustomColour : Number(parts[8]),
            sideDividersVisible : parts[9],
            depthMode : parts[10]
        }
    );
    if (!commit) return null;
    now = Math.round(Number(now));
    if (isFinite(now) &&
            (commit.issuedAt > now + DARKONE_BOTTOM_AREA_COMMIT_MAX_AGE ||
             now - commit.issuedAt > DARKONE_BOTTOM_AREA_COMMIT_MAX_AGE)) return null;
    return commit;
}
function darkOneCreateBottomAreaCommit(state) {
    state = darkOneBottomAreaParseState(state) || darkOneBottomAreaState();
    var issuedAt = new Date().getTime();
    darkOneBottomAreaCommitSequence++;
    return darkOneBottomAreaCommit(
        String(issuedAt) + '-' + String(darkOneBottomAreaCommitSequence) + '-' +
            String(Math.floor(Math.random() * 0x1000000)),
        issuedAt,
        issuedAt + DARKONE_BOTTOM_AREA_COMMIT_DELAY,
        state
    );
}

function darkOneBottomBackgroundColour() {
    var mode = darkOneBottomBackgroundMode();
    if (mode === DARKONE_BOTTOM_MODE_BLACK) return 0xff000000;
    if (mode === DARKONE_BOTTOM_MODE_DARKONE) return 0xff202020;
    if (mode === DARKONE_BOTTOM_MODE_DARKONE_DARK) return 0xff181818;
    if (mode === DARKONE_BOTTOM_MODE_COLUMNS_UI) return darkOneBottomOpaque(ui_backcol || 0xff202020);
    if (mode === DARKONE_BOTTOM_MODE_CUSTOM) return darkOneBottomBackgroundCustomColour();
    // Native JScript Panel and JSplitter child windows do not alpha-compose
    // reliably across component hosts. Only Transparent / inherit parent reaches
    // this fallback and resolves to the established recessed DarkOne backing.
    return 0xff181818;
}
function darkOneBottomScaleBrightness(colour, factor) {
    colour = Number(colour) >>> 0;
    factor = Number(factor);
    if (!isFinite(factor)) factor = 1;
    var red = Math.max(0, Math.min(255, Math.round(((colour >>> 16) & 0xff) * factor)));
    var green = Math.max(0, Math.min(255, Math.round(((colour >>> 8) & 0xff) * factor)));
    var blue = Math.max(0, Math.min(255, Math.round((colour & 0xff) * factor)));
    return 0xff000000 +
        red * 0x10000 + green * 0x100 + blue;
}
function darkOneBottomBlendColour(colour1, colour2, amount) {
    colour1 = Number(colour1) >>> 0;
    colour2 = Number(colour2) >>> 0;
    amount = Math.max(0, Math.min(1, Number(amount) || 0));
    var red1 = (colour1 >>> 16) & 0xff;
    var green1 = (colour1 >>> 8) & 0xff;
    var blue1 = colour1 & 0xff;
    var red = Math.round(red1 + amount * (((colour2 >>> 16) & 0xff) - red1));
    var green = Math.round(green1 + amount * (((colour2 >>> 8) & 0xff) - green1));
    var blue = Math.round(blue1 + amount * ((colour2 & 0xff) - blue1));
    return 0xff000000 + red * 0x10000 + green * 0x100 + blue;
}
function darkOneReadBottomAreaGeometry() {
    var height = Math.max(1, Math.round(Number(wh)) || 1);
    var displayTop = 0;
    try {
        var parts = String(utils.ReadTextFile(
            DARKONE_BOTTOM_AREA_GEOMETRY_FILE,
            65001
        ) || '').split('|');
        if (parts.length === 3 && parts[0] === DARKONE_BOTTOM_AREA_GEOMETRY_VERSION) {
            var parsedHeight = Math.round(Number(parts[1]));
            var parsedDisplayTop = Math.round(Number(parts[2]));
            if (isFinite(parsedHeight) && parsedHeight >= 1 && isFinite(parsedDisplayTop)) {
                height = parsedHeight;
                displayTop = Math.max(0, Math.min(height - 1, parsedDisplayTop));
            }
        }
    } catch (e) {}
    var role = typeof DARKONEJSP3_RESET_ROLE == 'string'
        ? DARKONEJSP3_RESET_ROLE
        : '';
    var offsetY = role === 'display' ? displayTop : 0;
    if (height !== darkOneBottomAreaGradientHeight ||
            offsetY !== darkOneBottomAreaGradientOffsetY) {
        darkOneBottomAreaGradientHeight = height;
        darkOneBottomAreaGradientOffsetY = offsetY;
        darkOneBottomAreaGradientBrushKey = '';
        darkOneBottomAreaGradientBrush = '';
    }
}
function darkOneBottomAreaBrush() {
    var key = String(p_backcol >>> 0) + '|' + String(wh) + '|' +
        String(darkOneBottomAreaGradientHeight) + '|' +
        String(darkOneBottomAreaGradientOffsetY);
    if (key === darkOneBottomAreaGradientBrushKey && darkOneBottomAreaGradientBrush) {
        return darkOneBottomAreaGradientBrush;
    }
    var darker = darkOneBottomScaleBrightness(p_backcol, 0.7);
    var denominator = Math.max(1, darkOneBottomAreaGradientHeight - 1);
    var topAmount = Math.max(0, Math.min(
        1,
        darkOneBottomAreaGradientOffsetY / denominator
    ));
    var bottomAmount = Math.max(0, Math.min(
        1,
        (darkOneBottomAreaGradientOffsetY + Math.max(0, wh - 1)) / denominator
    ));
    darkOneBottomAreaGradientBrushKey = key;
    darkOneBottomAreaGradientBrush = JSON.stringify({
        Start : [0, 0],
        End : [0, Math.max(1, wh)],
        Stops : [
            [0, darkOneBottomBlendColour(p_backcol, darker, topAmount)],
            [1, darkOneBottomBlendColour(p_backcol, darker, bottomAmount)]
        ]
    });
    return darkOneBottomAreaGradientBrush;
}
function darkOnePaintBottomAreaBackground(gr) {
    // Transparent / inherit parent is resolved to the common #181818 parent
    // tone rather than skipping paint and exposing component-specific backings.
    if (!darkOneBottomAreaPaintGradient) {
        gr.FillRectangle(0, 0, ww, wh, p_backcol);
    } else {
        gr.FillRectangle(0, 0, ww, wh, darkOneBottomAreaBrush());
    }
    var role = typeof DARKONEJSP3_RESET_ROLE == 'string'
        ? DARKONEJSP3_RESET_ROLE
        : '';
    if (darkOneBottomAreaPaintDepthMode === DARKONE_BOTTOM_DEPTH_SOFT &&
            (role === 'control-left' || role === 'control-right') &&
            ww > 0 && wh > 0) {
        gr.FillRectangle(0, 0, ww, 1, 0xff000000);
        if (wh > 1) gr.FillRectangle(0, 1, ww, 1, 0xff0f0f0f);
        var highlightHeight = Math.min(2, Math.max(0, wh - 2));
        if (highlightHeight > 0) {
            gr.FillRectangle(
                0,
                2,
                ww,
                highlightHeight,
                darkOneBottomAreaHighlightColour
            );
        }
    }
}
function darkOneApplyBottomAreaAppearance() {
    p_backcol = darkOneBottomBackgroundColour();
    darkOneBottomAreaPaintGradient = darkOneBottomBackgroundLinearGradient();
    darkOneBottomAreaPaintDepthMode = darkOneBottomDepthMode();
    darkOneBottomAreaHighlightColour = darkOneBottomScaleBrightness(p_backcol, 1.2);
    darkOneBottomAreaGradientBrushKey = '';
    darkOneBottomAreaGradientBrush = '';
    if (typeof buttonsColours == 'function') buttonsColours();
    if (typeof volknob != 'undefined' && volknob && typeof vknbOpt != 'undefined') {
        volknob.line_normal = vknbOpt.line_normal;
        volknob.line_hover = vknbOpt.line_normal;
        volknob.inactive_colour = vknbOpt.inactive_colour;
        volknob.active_colour = vknbOpt.active_colour;
    }
    if (typeof display_system != 'undefined' && display_system) {
        display_system.InitColours();
        display_system.setColours();
    }
    try { window.Repaint(); } catch (e) {}
}
function darkOneApplyBottomAreaState(state, repaint) {
    state = darkOneBottomAreaParseState(state);
    if (!state) return false;

    var current = darkOneBottomAreaState();
    var backgroundChanged = current.backgroundMode !== state.backgroundMode ||
        (current.backgroundCustomColour >>> 0) !== (state.backgroundCustomColour >>> 0) ||
        current.backgroundLinearGradient !== state.backgroundLinearGradient ||
        current.depthMode !== state.depthMode;
    var dividerChanged = current.dividerMode !== state.dividerMode ||
        (current.dividerCustomColour >>> 0) !== (state.dividerCustomColour >>> 0) ||
        current.sideDividersVisible !== state.sideDividersVisible;

    var values = {};
    values[DARKONE_BOTTOM_BACKGROUND_MODE_PROPERTY] = state.backgroundMode;
    values[DARKONE_BOTTOM_BACKGROUND_CUSTOM_PROPERTY] = state.backgroundCustomColour;
    values[DARKONE_BOTTOM_BACKGROUND_GRADIENT_PROPERTY] = state.backgroundLinearGradient;
    values[DARKONE_BOTTOM_DIVIDER_MODE_PROPERTY] = state.dividerMode;
    values[DARKONE_BOTTOM_DIVIDER_CUSTOM_PROPERTY] = state.dividerCustomColour;
    values[DARKONE_BOTTOM_SIDE_DIVIDERS_PROPERTY] = state.sideDividersVisible;
    values[DARKONE_BOTTOM_DEPTH_PROPERTY] = state.depthMode;
    var result = darkOneApplySharedValues(values);
    result.backgroundChanged = backgroundChanged;
    result.dividerChanged = dividerChanged;
    result.changed = backgroundChanged || dividerChanged;

    // The three JScript panels do not draw the host-owned side dividers.
    // Store divider changes for their shared menu state, but rebuild visual
    // resources only when the background itself changes.
    if (backgroundChanged && repaint !== false) darkOneApplyBottomAreaAppearance();
    return result;
}
function darkOneEnsureRuntimeDataFolder() {
    try { utils.CreateFolder(DARKONE_RUNTIME_DATA_DIR); } catch (e) {}
}
function darkOneLogRuntimeWriteFailure(label, path, detail) {
    try {
        console.log('[DarkOneJSP3] Unable to write ' + label + ' at "' + path + '": ' + detail);
    } catch (e) {}
}
function darkOneTryWriteRuntimeFile(path, content, label) {
    darkOneEnsureRuntimeDataFolder();
    try {
        var result = utils.WriteTextFile(path, String(content));
        if (result === false) {
            darkOneLogRuntimeWriteFailure(label, path, 'utils.WriteTextFile returned false');
            return false;
        }
        return true;
    } catch (e) {
        darkOneLogRuntimeWriteFailure(label, path, String(e));
    }
    return false;
}
function darkOneReadBottomAreaStatePath(path) {
    try {
        var raw = String(utils.ReadTextFile(path, 65001) || '');
        var state = darkOneBottomAreaParseState(raw);
        return state ? {
            state : state,
            raw : raw,
            serialised : darkOneBottomAreaSerialiseState(state)
        } : null;
    } catch (e) {}
    return null;
}
function darkOneReadBottomAreaStateFile() {
    var current = darkOneReadBottomAreaStatePath(DARKONE_BOTTOM_AREA_STATE_FILE);
    if (current) {
        if (current.raw !== current.serialised) {
            darkOneWriteBottomAreaStateFile(current.state);
        }
        return current;
    }
    var legacy = darkOneReadBottomAreaStatePath(DARKONE_BOTTOM_AREA_LEGACY_STATE_FILE);
    if (!legacy) return null;
    // Migrate the public v1.0.17 state into the current js_data location.
    darkOneWriteBottomAreaStateFile(legacy.state);
    return legacy;
}
function darkOneCancelBottomAreaStateRetry() {
    if (darkOneBottomAreaStateRetryTimer) {
        try { window.ClearTimeout(darkOneBottomAreaStateRetryTimer); } catch (e) {}
    }
    darkOneBottomAreaStateRetryTimer = null;
    darkOneBottomAreaStateRetryAttempt = 0;
    darkOneBottomAreaStateRetrySerialised = '';
}
function darkOneRetryBottomAreaStateWrite() {
    darkOneBottomAreaStateRetryTimer = null;
    if (!darkOneBottomAreaStateRetrySerialised) return;
    if (darkOneTryWriteRuntimeFile(
            DARKONE_BOTTOM_AREA_STATE_FILE,
            darkOneBottomAreaStateRetrySerialised,
            'shared bottom-area state retry')) {
        var state = darkOneBottomAreaParseState(darkOneBottomAreaStateRetrySerialised);
        darkOneBottomAreaStateRetryAttempt = 0;
        darkOneBottomAreaStateRetrySerialised = '';
        if (state) darkOneBroadcastBottomAreaState(state);
        return;
    }
    darkOneBottomAreaStateRetryAttempt++;
    if (darkOneBottomAreaStateRetryAttempt >= DARKONE_BOTTOM_AREA_STATE_RETRY_LIMIT) {
        darkOneLogRuntimeWriteFailure(
            'shared bottom-area state retry limit',
            DARKONE_BOTTOM_AREA_STATE_FILE,
            'canonical state remains held by the active commit'
        );
        darkOneBottomAreaStateRetrySerialised = '';
        return;
    }
    try {
        darkOneBottomAreaStateRetryTimer = window.SetTimeout(
            darkOneRetryBottomAreaStateWrite,
            DARKONE_BOTTOM_AREA_STATE_RETRY_DELAY
        );
    } catch (e) {
        darkOneLogRuntimeWriteFailure(
            'shared bottom-area state retry',
            DARKONE_BOTTOM_AREA_STATE_FILE,
            String(e)
        );
    }
}
function darkOneScheduleBottomAreaStateRetry(serialised) {
    darkOneCancelBottomAreaStateRetry();
    darkOneBottomAreaStateRetrySerialised = String(serialised || '');
    darkOneBottomAreaStateRetryAttempt = 0;
    try {
        darkOneBottomAreaStateRetryTimer = window.SetTimeout(
            darkOneRetryBottomAreaStateWrite,
            DARKONE_BOTTOM_AREA_STATE_RETRY_DELAY
        );
    } catch (e) {
        darkOneLogRuntimeWriteFailure(
            'shared bottom-area state retry',
            DARKONE_BOTTOM_AREA_STATE_FILE,
            String(e)
        );
    }
}
function darkOneWriteBottomAreaStateFile(state) {
    state = darkOneBottomAreaParseState(state) || darkOneBottomAreaState();
    var serialised = darkOneBottomAreaSerialiseState(state);
    darkOneCancelBottomAreaStateRetry();
    if (darkOneTryWriteRuntimeFile(
            DARKONE_BOTTOM_AREA_STATE_FILE,
            serialised,
            'shared bottom-area state')) {
        return true;
    }
    darkOneScheduleBottomAreaStateRetry(serialised);
    return false;
}
function darkOneBroadcastBottomAreaState(state) {
    state = darkOneBottomAreaParseState(state) || darkOneBottomAreaState();
    try {
        window.NotifyOthers(
            DARKONE_BOTTOM_AREA_NOTIFICATIONS.state,
            darkOneBottomAreaSerialiseState(state)
        );
    } catch (e) {}
}
function darkOneCancelBottomAreaCommit() {
    if (darkOneBottomAreaCommitTimer) {
        try { window.ClearTimeout(darkOneBottomAreaCommitTimer); } catch (e) {}
    }
    darkOneBottomAreaCommitTimer = null;
    darkOneBottomAreaPendingCommitId = '';
}
function darkOneApplyScheduledBottomAreaCommit(commit) {
    if (!commit || commit.id !== darkOneBottomAreaPendingCommitId) return false;
    darkOneBottomAreaCommitTimer = null;
    darkOneBottomAreaPendingCommitId = '';
    // State properties were staged when the commit was received. Resolve all
    // dependent colours and repaint only at the shared target time so the
    // three JSP3 bottom panels change in the same visual frame as JSplitter.
    // Comparing against p_backcol also handles rapid superseding commits: the
    // properties may already match while the previous colour was never painted.
    var nextBackground = darkOneBottomBackgroundColour();
    var nextGradient = darkOneBottomBackgroundLinearGradient();
    var nextDepth = darkOneBottomDepthMode();
    if ((p_backcol >>> 0) !== (nextBackground >>> 0) ||
            darkOneBottomAreaPaintGradient !== nextGradient ||
            darkOneBottomAreaPaintDepthMode !== nextDepth) {
        darkOneApplyBottomAreaAppearance();
    }
    return true;
}
function darkOneScheduleBottomAreaCommit(commit) {
    commit = darkOneBottomAreaParseCommit(commit, new Date().getTime());
    if (!commit) return false;
    darkOneCancelBottomAreaCommit();
    darkOneBottomAreaPendingCommitId = commit.id;
    darkOneApplyBottomAreaState(commit.state, false);
    var delay = Math.max(0, commit.applyAt - new Date().getTime());
    if (delay <= 0) return darkOneApplyScheduledBottomAreaCommit(commit);
    try {
        darkOneBottomAreaCommitTimer = window.SetTimeout(function () {
            darkOneApplyScheduledBottomAreaCommit(commit);
        }, delay);
        return true;
    } catch (e) {
        return darkOneApplyScheduledBottomAreaCommit(commit);
    }
}
function darkOneBroadcastBottomAreaCommit(commit) {
    var serialised = darkOneBottomAreaSerialiseCommit(commit);
    if (!serialised) return false;
    try {
        window.NotifyOthers(DARKONE_BOTTOM_AREA_NOTIFICATIONS.commit, serialised);
        return true;
    } catch (e) {}
    return false;
}
function darkOneSendBottomAreaState(state) {
    state = darkOneBottomAreaParseState(state) || darkOneBottomAreaState();
    var commit = darkOneCreateBottomAreaCommit(state);
    var serialisedCommit = darkOneBottomAreaSerialiseCommit(commit);
    // Publish the short-lived command before the canonical state. Bottom
    // Controls sees the command marker and defers its own repaint to applyAt,
    // preventing the state-file fallback from exposing an intermediate frame.
    var commandWritten = serialisedCommit && darkOneTryWriteRuntimeFile(
        DARKONE_BOTTOM_AREA_COMMIT_FILE,
        serialisedCommit,
        'shared bottom-area commit'
    );
    darkOneWriteBottomAreaStateFile(commit.state);
    if (commandWritten) {
        darkOneScheduleBottomAreaCommit(commit);
        darkOneBroadcastBottomAreaCommit(commit);
        return;
    }
    // If the short-lived coordination command cannot be written, retain the
    // older immediate path rather than making the colour menu appear broken.
    darkOneCancelBottomAreaCommit();
    darkOneApplyBottomAreaState(state);
    darkOneBroadcastBottomAreaState(state);
}
function darkOneInitialiseBottomAreaState(queryPeers) {
    if (darkOneBottomAreaInitialised) return false;
    darkOneBottomAreaInitialised = true;

    var fileState = darkOneReadBottomAreaStateFile();
    if (fileState) {
        // Do not depend on property differences or on_colours_changed callback
        // ordering: resolve the first visible background unconditionally below.
        darkOneApplyBottomAreaState(fileState.state, false);
    } else {
        darkOneWriteBottomAreaStateFile(darkOneBottomAreaState());
    }

    if (queryPeers !== false) {
        // Query same-component peers once. Continuous disk polling is deliberately
        // reserved for the Bottom Controls JSplitter host.
        try { window.NotifyOthers(DARKONE_BOTTOM_AREA_NOTIFICATIONS.query, DARKONE_BOTTOM_AREA_PROTOCOL_VERSION); } catch (e) {}
    }

    // p_backcol starts at DarkOne grey. Explicitly resolve the saved mode before
    // the first paint even when window properties already match the state file.
    darkOneApplyBottomAreaAppearance();
    return true;
}
function darkOneRequestBottomAreaState() {
    darkOneReadBottomAreaGeometry();
    return darkOneInitialiseBottomAreaState(true);
}
function darkOneDisposeBottomAreaBridge() {
    darkOneCancelBottomAreaStateRetry();
    darkOneCancelBottomAreaCommit();
}
function darkOneBottomAreaDefaultState() {
    return {
        backgroundMode : DARKONE_BOTTOM_BACKGROUND_DEFAULT,
        backgroundCustomColour : DARKONE_BOTTOM_CUSTOM_DEFAULT,
        backgroundLinearGradient : DARKONE_BOTTOM_BACKGROUND_GRADIENT_DEFAULT,
        dividerMode : DARKONE_BOTTOM_DIVIDER_DEFAULT,
        dividerCustomColour : DARKONE_BOTTOM_CUSTOM_DEFAULT,
        sideDividersVisible : DARKONE_BOTTOM_SIDE_DIVIDERS_DEFAULT,
        depthMode : DARKONE_BOTTOM_DEPTH_DEFAULT
    };
}
function darkOneApplyBottomAreaDefaultsLocally() {
    darkOneApplyBottomAreaState(darkOneBottomAreaDefaultState(), false);
    darkOneApplyBottomAreaAppearance();
}
function darkOneResetBottomAreaDefaults() {
    darkOneSendBottomAreaState(darkOneBottomAreaDefaultState());
}
function darkOneCreateResetCommand(scope) {
    scope = darkOneJsp3ResetCommandScope(scope);
    if (!scope) return null;
    var issuedAt = new Date().getTime();
    darkOneResetCommandSequence++;
    var commandId = String(issuedAt) + '-' + String(darkOneResetCommandSequence) + '-' +
        String(Math.floor(Math.random() * 0x1000000));
    return darkOneJsp3SerialiseResetCommand(commandId, issuedAt, scope);
}
function darkOneWriteResetCommand(scope) {
    var command = darkOneCreateResetCommand(scope);
    if (!command) return false;
    if (darkOneTryWriteRuntimeFile(
            DARKONE_RESET_COMMAND_FILE,
            command,
            'factory-reset command')) return true;
    // One immediate retry gives transient file locks a second chance before the
    // initiating panel reloads and its timers are destroyed.
    if (darkOneTryWriteRuntimeFile(
            DARKONE_RESET_COMMAND_FILE,
            command,
            'factory-reset command retry')) return true;
    try {
        utils.MessageBox(
            'The factory-reset command could not be written to:\n\n' +
                DARKONE_RESET_COMMAND_FILE +
                '\n\nJScript Panel settings will still reset, but JSplitter-owned settings may remain unchanged. Check folder permissions and the foobar2000 console.',
            'DarkOneJSP3 reset warning',
            MB_OK | MB_ICONEXCLAMATION
        );
    } catch (e) {}
    return false;
}
function darkOneNormaliseBottomPickerChoice(value) {
    if (value === null || typeof value === 'undefined') return null;
    var number = Number(value);
    if (!isFinite(number) || Math.floor(number) !== number) return null;
    if (number < -2147483648 || number > 4294967295) return null;
    return darkOneBottomOpaque(number);
}
function darkOnePickBottomAreaColour(current, title) {
    current = darkOneBottomOpaque(current);
    if (typeof DarkOneColour !== 'undefined' &&
            typeof DarkOneColour.pickJscript !== 'undefined') {
        return DarkOneColour.pickJscript(
            current,
            title,
            'Enter a colour as #RRGGBB or R,G,B.'
        );
    }
    try {
        if (typeof utils !== 'undefined' &&
                typeof utils.ColourPicker !== 'undefined') {
            var chosen = darkOneNormaliseBottomPickerChoice(
                utils.ColourPicker(Number(current) | 0)
            );
            return chosen !== null && chosen !== current ? chosen : null;
        }
    } catch (e) {
        try {
            console.log('[DarkOneJSP3] JScript Panel ColourPicker failed (' +
                title + '): ' + (e && e.message ? e.message : String(e)));
        } catch (e2) {}
        return null;
    }
    try {
        return darkOneBottomParseColour(utils.InputBox(
            'Enter a colour as #RRGGBB or R,G,B.',
            title,
            darkOneBottomHex(current)
        ));
    } catch (e3) {}
    return null;
}
function darkOneAppendBottomColourOptions(menu, options, selectedMode, customColour) {
    var first = options[0].id;
    var last = options[options.length - 1].id;
    var selectedId = first;
    for (var i = 0; i < options.length; i++) {
        var option = options[i];
        menu.AppendMenuItem(
            MF_STRING,
            option.id,
            option.custom ? 'Custom colour (' + darkOneBottomHex(customColour) + ')' : option.label
        );
        if (option.mode === selectedMode) selectedId = option.id;
    }
    menu.CheckMenuRadioItem(first, last, selectedId);
}
function darkOneAppendBottomAreaAppearanceMenu(appearance, background, divider, depth) {
    darkOneAppendBottomColourOptions(
        background,
        DARKONE_BOTTOM_BACKGROUND_MENU_OPTIONS,
        darkOneBottomBackgroundMode(),
        darkOneBottomBackgroundCustomColour()
    );
    background.AppendMenuSeparator();
    background.AppendMenuItem(MF_STRING, 9806, 'Set custom colour...');
    background.AppendTo(appearance, MF_STRING, 'Bottom area background');
    darkOneAppendBottomColourOptions(
        divider,
        DARKONE_BOTTOM_DIVIDER_MENU_OPTIONS,
        darkOneBottomDividerMode(),
        darkOneBottomDividerCustomColour()
    );
    divider.AppendMenuSeparator();
    divider.AppendMenuItem(MF_STRING, 9826, 'Set custom colour...');
    divider.AppendTo(appearance, MF_STRING, 'Bottom area side divider colour');
    depth.AppendMenuItem(MF_STRING, DARKONE_BOTTOM_DEPTH_FIRST_MENU_ID, 'Flat');
    depth.AppendMenuItem(MF_STRING, DARKONE_BOTTOM_DEPTH_LAST_MENU_ID, 'Soft');
    depth.CheckMenuRadioItem(
        DARKONE_BOTTOM_DEPTH_FIRST_MENU_ID,
        DARKONE_BOTTOM_DEPTH_LAST_MENU_ID,
        DARKONE_BOTTOM_DEPTH_FIRST_MENU_ID + darkOneBottomDepthMode()
    );
    depth.AppendTo(appearance, MF_STRING, 'Bottom area depth');
    appearance.AppendMenuItem(
        MF_STRING,
        DARKONE_BOTTOM_BACKGROUND_GRADIENT_MENU_ID,
        'Background linear gradient'
    );
    appearance.CheckMenuItem(
        DARKONE_BOTTOM_BACKGROUND_GRADIENT_MENU_ID,
        darkOneBottomBackgroundLinearGradient()
    );
    appearance.AppendMenuSeparator();
    appearance.AppendMenuItem(
        MF_STRING,
        DARKONE_BOTTOM_SIDE_DIVIDERS_MENU_ID,
        'Bottom side dividers'
    );
    appearance.CheckMenuItem(
        DARKONE_BOTTOM_SIDE_DIVIDERS_MENU_ID,
        darkOneBottomSideDividersVisible()
    );
}

var DARKONE_BUTTON_STYLE_LABELS = [
    'Standard',
    'Thick',
    'Round',
    'Round (Alt)',
    'Round (Alt + Narrow)'
];
var DARKONE_BUTTON_DEPTH_LABELS = ['Flat', 'Soft', 'Medium', 'Strong'];
var DARKONE_BUTTON_ROUNDNESS_VALUES = [-1, 0, 20, 33, 60, 100];
var DARKONE_BUTTON_ROUNDNESS_LABELS = [
    'Automatic / follow button style',
    'Square (0%)',
    'Subtle (20%)',
    'Classic DarkOne (33%)',
    'Rounded (60%)',
    'Maximum / pill (100%)'
];

function darkOneButtonStylePreset() {
    var value = Math.round(Number(window.GetProperty('Buttons appearance preset', 1)));
    return isFinite(value) ? Math.max(1, Math.min(5, value)) : 1;
}

function darkOneButtonDepthPreset() {
    var value = Math.round(Number(window.GetProperty('Buttons depth preset', 0)));
    return isFinite(value) ? Math.max(0, Math.min(3, value)) : 0;
}

function darkOneAppendButtonsAppearanceMenu(parent, style, depth, roundness) {
    var stylePreset = darkOneButtonStylePreset();
    var depthPreset = darkOneButtonDepthPreset();
    var roundnessValue = darkOneButtonRoundness();

    for (var i = 0; i < DARKONE_BUTTON_STYLE_LABELS.length; i++)
        style.AppendMenuItem(MF_STRING, 9831 + i, DARKONE_BUTTON_STYLE_LABELS[i]);
    style.CheckMenuRadioItem(9831, 9835, 9830 + stylePreset);
    style.AppendTo(parent, MF_STRING, 'Button style');

    for (var j = 0; j < DARKONE_BUTTON_DEPTH_LABELS.length; j++)
        depth.AppendMenuItem(MF_STRING, 9840 + j, DARKONE_BUTTON_DEPTH_LABELS[j]);
    depth.CheckMenuRadioItem(9840, 9843, 9840 + depthPreset);
    depth.AppendTo(parent, MF_STRING, 'Button depth');

    for (var k = 0; k < DARKONE_BUTTON_ROUNDNESS_VALUES.length; k++) {
        roundness.AppendMenuItem(MF_STRING, 9850 + k, DARKONE_BUTTON_ROUNDNESS_LABELS[k]);
        if (roundnessValue == DARKONE_BUTTON_ROUNDNESS_VALUES[k])
            roundness.CheckMenuItem(9850 + k, true);
    }
    roundness.AppendMenuSeparator();
    roundness.AppendMenuItem(MF_STRING, 9856, 'Custom roundness...');
    if (DARKONE_BUTTON_ROUNDNESS_VALUES.indexOf(roundnessValue) == -1)
        roundness.CheckMenuItem(9856, true);
    roundness.AppendTo(parent, MF_STRING, 'Button roundness');
}

function darkOneRefreshControlButtonAppearance() {
    if (typeof buttonsOptions == 'function') buttonsOptions();
    if (typeof buttonsSizes == 'function') buttonsSizes();
    if (typeof buttonsRefresh == 'function') buttonsRefresh();
    window.Repaint();
}

function darkOneHandleButtonsAppearanceMenuSelection(id) {
    if (id >= 9831 && id <= 9835) {
        darkOneSetSharedProperty('Buttons appearance preset', id - 9830);
        darkOneRefreshControlButtonAppearance();
        return true;
    }
    if (id >= 9840 && id <= 9843) {
        darkOneSetSharedProperty('Buttons depth preset', id - 9840);
        darkOneRefreshControlButtonAppearance();
        return true;
    }
    if (id >= 9850 && id <= 9855) {
        darkOneSetButtonRoundness(DARKONE_BUTTON_ROUNDNESS_VALUES[id - 9850]);
        darkOneRefreshControlButtonAppearance();
        return true;
    }
    if (id == 9856) {
        if (darkOneInputButtonRoundness()) darkOneRefreshControlButtonAppearance();
        return true;
    }
    return false;
}
function darkOneBottomOptionForId(options, id) {
    for (var i = 0; i < options.length; i++) if (options[i].id === id) return options[i];
    return null;
}
function darkOneHandleBottomAreaMenuSelection(id) {
    var option = darkOneBottomOptionForId(DARKONE_BOTTOM_BACKGROUND_MENU_OPTIONS, id);
    var state;
    var chosen;
    if (option) {
        state = darkOneBottomAreaState();
        state.backgroundMode = option.mode;
        darkOneSendBottomAreaState(state);
        return true;
    }
    if (id === 9806) {
        state = darkOneBottomAreaState();
        chosen = darkOnePickBottomAreaColour(
            state.backgroundCustomColour,
            'DarkOneJSP3 bottom area background'
        );
        if (chosen === null) return true;
        state.backgroundCustomColour = chosen;
        state.backgroundMode = DARKONE_BOTTOM_MODE_CUSTOM;
        darkOneSendBottomAreaState(state);
        return true;
    }
    option = darkOneBottomOptionForId(DARKONE_BOTTOM_DIVIDER_MENU_OPTIONS, id);
    if (option) {
        state = darkOneBottomAreaState();
        state.dividerMode = option.mode;
        darkOneSendBottomAreaState(state);
        return true;
    }
    if (id === 9826) {
        state = darkOneBottomAreaState();
        chosen = darkOnePickBottomAreaColour(
            state.dividerCustomColour,
            'DarkOneJSP3 bottom area side dividers'
        );
        if (chosen === null) return true;
        state.dividerCustomColour = chosen;
        state.dividerMode = DARKONE_BOTTOM_MODE_CUSTOM;
        darkOneSendBottomAreaState(state);
        return true;
    }
    if (id === DARKONE_BOTTOM_BACKGROUND_GRADIENT_MENU_ID) {
        state = darkOneBottomAreaState();
        state.backgroundLinearGradient = !state.backgroundLinearGradient;
        darkOneSendBottomAreaState(state);
        return true;
    }
    if (id === DARKONE_BOTTOM_SIDE_DIVIDERS_MENU_ID) {
        state = darkOneBottomAreaState();
        state.sideDividersVisible = !state.sideDividersVisible;
        darkOneSendBottomAreaState(state);
        return true;
    }
    if (id >= DARKONE_BOTTOM_DEPTH_FIRST_MENU_ID &&
            id <= DARKONE_BOTTOM_DEPTH_LAST_MENU_ID) {
        state = darkOneBottomAreaState();
        state.depthMode = id - DARKONE_BOTTOM_DEPTH_FIRST_MENU_ID;
        darkOneSendBottomAreaState(state);
        return true;
    }
    return false;
}

function repeat(str, num) {
    num = Number(num);
    var result = '';
    while (true) {
        if (num & 1) result += str;
        num >>>= 1;
        if (num <= 0) break;
        str += str;
    }
    return result;
}
function pad(x, y, z) {
    z || (z = ' '); x = x == null ? "" : String(x);
    return x.length < y ? x + repeat(z, y - x.length) : x;
}
function pad_right(x, y, z) {
    z || (z = ' '); x = x == null ? "" : String(x);
    return x.length < y ? repeat(z, y - x.length) + x : x;
}
function TimeFmt(t) {
    function zpad(n) { var str = n.toString(); return str.length < 2 ? "0" + str : str; }
    t = Number(t);
    if (!isFinite(t) || t < 0) t = 0;
    t = Math.floor(t);
    var h = Math.floor(t / 3600); t -= h * 3600;
    var m = Math.floor(t / 60); t -= m * 60;
    return zpad(h) + ":" + zpad(m) + ":" + zpad(t);
}

// JSP3 image lifecycle. The old helper name is retained to minimise needless churn in theme code.
function safeGdiImage(path) {
    try { return utils.LoadImage(path); } catch (e) { return null; }
}
function safeBitmapImage(path) {
    return DarkOnePerformance.loadBitmap(path);
}
function disposeImage(img) {
    if (img) { try { img.Dispose(); } catch (e) {} }
}
// DirectWrite font strings and drawing adapters for the small subset of legacy GDI flags used by DarkOne.
function darkOneCreateFont(name, size, style, weight) {
    style = Number(style) || 0;
    var resolved_weight = Number(weight);
    if (isNaN(resolved_weight)) {
        // GDI selected the heavy face automatically when the family was named
        // "Arial Black". DirectWrite needs the weight made explicit to reproduce it.
        resolved_weight = /(?:black|heavy)/i.test(String(name || ''))
            ? DWRITE_FONT_WEIGHT_BLACK
            : (style & 1) ? DWRITE_FONT_WEIGHT_BOLD : DWRITE_FONT_WEIGHT_NORMAL;
    }
    resolved_weight = Math.max(DWRITE_FONT_WEIGHT_THIN, Math.min(DWRITE_FONT_WEIGHT_ULTRA_BLACK, Math.round(resolved_weight)));
    return JSON.stringify({
        Name : name,
        Size : Math.max(1, Math.round(size)),
        Weight : resolved_weight,
        Style : (style & 2) ? DWRITE_FONT_STYLE_ITALIC : DWRITE_FONT_STYLE_NORMAL,
        Stretch : DWRITE_FONT_STRETCH_NORMAL
    });
}
function darkOneFontSize(font) {
    try { return Number(JSON.parse(font).Size) || 12; } catch (e) { return 12; }
}
function darkOneCalcTextWidth(text, font) {
    try { return utils.CalcTextWidth2(String(text || ''), font); } catch (e) { return 0; }
}
var darkOneTextHeightCache = {};
function darkOneCalcTextHeight(text, font) {
    text = String(text || 'Ag');
    var key = font + '\n' + text;
    if (darkOneTextHeightCache.hasOwnProperty(key)) return darkOneTextHeightCache[key];
    var height = 0;
    var layout = null;
    try {
        layout = utils.CreateTextLayout2(text, '[' + font + ']', DWRITE_TEXT_ALIGNMENT_LEADING, DWRITE_PARAGRAPH_ALIGNMENT_NEAR, DWRITE_WORD_WRAPPING_NO_WRAP, DWRITE_TRIMMING_GRANULARITY_NONE);
        height = Math.ceil(layout.CalcTextHeight(4096));
    } catch (e) {
        height = Math.ceil(darkOneFontSize(font) * 1.28);
    } finally {
        if (layout) { try { layout.Dispose(); } catch (e2) {} }
    }
    height = Math.max(1, height);
    darkOneTextHeightCache[key] = height;
    return height;
}
function darkOneDrawText(gr, text, font, colour, x, y, w, h, flags) {
    flags = flags || 0;
    var horizontal = (flags & 2) ? DWRITE_TEXT_ALIGNMENT_TRAILING : (flags & 1) ? DWRITE_TEXT_ALIGNMENT_CENTER : DWRITE_TEXT_ALIGNMENT_LEADING;
    var vertical = (flags & 4) ? DWRITE_PARAGRAPH_ALIGNMENT_CENTER : DWRITE_PARAGRAPH_ALIGNMENT_NEAR;
    gr.WriteTextSimple(String(text == null ? '' : text), font, colour, x, y, Math.max(0, w), Math.max(0, h), horizontal, vertical, DWRITE_WORD_WRAPPING_NO_WRAP, DWRITE_TRIMMING_GRANULARITY_CHARACTER);
}
function darkOneFillEllipse(gr, x, y, w, h, colour) {
    gr.FillEllipse(x + w / 2, y + h / 2, Math.max(0, w / 2), Math.max(0, h / 2), colour);
}
function darkOneDrawEllipse(gr, x, y, w, h, line_width, colour) {
    gr.DrawEllipse(x + w / 2, y + h / 2, Math.max(0, w / 2), Math.max(0, h / 2), Math.max(0.5, line_width), colour);
}

// DarkOneJSP3 settings use the current namespace only.
function darkOneNumberProperty(name, defaultValue, minValue, maxValue) {
    var raw = window.GetProperty(name, null);
    var value = Number(raw == null ? defaultValue : raw);
    if (isNaN(value)) value = defaultValue;
    return Math.max(minValue, Math.min(maxValue, value));
}
function darkOneFontScale() { return darkOneNumberProperty("DARKONEJSP3.FONT.SCALE", 1.0, 0.75, 1.75); }
function darkOneButtonHitboxScale() { return darkOneNumberProperty("DARKONEJSP3.BUTTON.HITBOX.SCALE", 1.0, 0.85, 1.35); }
function darkOneIconScale() { return darkOneNumberProperty("DARKONEJSP3.ICON.SCALE", 1.0, 0.75, 1.5); }
function darkOneDisplayFontScale() { return darkOneNumberProperty("DARKONEJSP3.DISPLAY.FONT.SCALE", 1.0, 0.75, 1.5); }

// Button roundness is expressed as a percentage of the maximum possible corner
// radius. -1 preserves the original appearance-preset behaviour exactly.
function darkOneButtonRoundness() { return darkOneNumberProperty("DARKONEJSP3.BUTTON.ROUNDNESS", -1, -1, 100); }
function darkOneSetButtonRoundness(value) {
    value = Number(value);
    if (isNaN(value)) return false;
    value = value < 0 ? -1 : Math.max(0, Math.min(100, value));
    darkOneSetSharedProperty("DARKONEJSP3.BUTTON.ROUNDNESS", value);
    return true;
}
function darkOneInputButtonRoundness() {
    try {
        var current = darkOneButtonRoundness();
        var shown = current < 0 ? 33 : current;
        var value = Number(utils.InputBox(
            "Enter button corner roundness from 0 to 100.\n\n0 = square\n33 = classic DarkOne rounded\n100 = maximum / pill\n\nUse the menu's Automatic option to restore appearance-preset behaviour.",
            "DarkOneJSP3 button roundness",
            shown
        ));
        return !isNaN(value) && darkOneSetButtonRoundness(value);
    } catch (e) {
        return false;
    }
}

var DARKONEJSP3_FONT_DEFAULTS = Object.freeze({
    controlName : "Arial Black",
    controlWeight : DWRITE_FONT_WEIGHT_BLACK,
    displayLabelName : "Arial Black",
    displayLabelWeight : DWRITE_FONT_WEIGHT_BLACK,
    displayValueName : "Microsoft Sans Serif",
    displayValueWeight : DWRITE_FONT_WEIGHT_NORMAL
});

function darkOneStringProperty(name, defaultValue) {
    var raw = window.GetProperty(name, null);
    raw = raw == null ? defaultValue : String(raw).trim();
    return raw || defaultValue;
}
function darkOneFontNameProperty(name, defaultValue) {
    var value = darkOneStringProperty(name, defaultValue);
    try {
        if (!utils.CheckFont(value)) value = defaultValue;
    } catch (e) {
        value = defaultValue;
    }
    return value;
}
function darkOneFontWeightProperty(name, defaultValue) {
    return Math.round(darkOneNumberProperty(name, defaultValue, DWRITE_FONT_WEIGHT_THIN, DWRITE_FONT_WEIGHT_ULTRA_BLACK));
}
function darkOneControlFontName() { return darkOneFontNameProperty("DARKONEJSP3.CONTROL.FONT.NAME", DARKONEJSP3_FONT_DEFAULTS.controlName); }
function darkOneControlFontWeight() { return darkOneFontWeightProperty("DARKONEJSP3.CONTROL.FONT.WEIGHT", DARKONEJSP3_FONT_DEFAULTS.controlWeight); }
function darkOneDisplayLabelFontName() { return darkOneFontNameProperty("DARKONEJSP3.DISPLAY.LABEL.FONT.NAME", DARKONEJSP3_FONT_DEFAULTS.displayLabelName); }
function darkOneDisplayLabelFontWeight() { return darkOneFontWeightProperty("DARKONEJSP3.DISPLAY.LABEL.FONT.WEIGHT", DARKONEJSP3_FONT_DEFAULTS.displayLabelWeight); }
function darkOneDisplayLabelFontScale() { return darkOneNumberProperty("DARKONEJSP3.DISPLAY.LABEL.FONT.SCALE", 1.0, 0.6, 2.0); }
function darkOneDisplayValueFontName() { return darkOneFontNameProperty("DARKONEJSP3.DISPLAY.VALUE.FONT.NAME", DARKONEJSP3_FONT_DEFAULTS.displayValueName); }
function darkOneDisplayValueFontWeight() { return darkOneFontWeightProperty("DARKONEJSP3.DISPLAY.VALUE.FONT.WEIGHT", DARKONEJSP3_FONT_DEFAULTS.displayValueWeight); }
function darkOneDisplayValueFontScale() { return darkOneNumberProperty("DARKONEJSP3.DISPLAY.VALUE.FONT.SCALE", 1.0, 0.6, 2.0); }

function darkOneQuote(value) { return '"' + String(value || '').replace(/"/g, '""') + '"'; }
function darkOneOpenFolder(folder) {
    try { utils.Run('explorer', darkOneQuote(folder)); return true; } catch (e) { return false; }
}
function darkOneSettingCategory(name) {
    name = String(name || '');
    if (name.indexOf('DARKONEJSP3.BOTTOM.') === 0) return 'bottom';
    if (name.indexOf('DARKONEJSP3.DISPLAY.') === 0) return 'display';
    if (name.indexOf('DARKONEJSP3.CONTROL.') === 0 ||
        name === 'DARKONEJSP3.FONT.SCALE' ||
        name === 'DARKONEJSP3.BUTTON.HITBOX.SCALE' ||
        name === 'DARKONEJSP3.BUTTON.ROUNDNESS' ||
        name === 'DARKONEJSP3.ICON.SCALE' ||
        name === 'Buttons appearance preset' ||
        name === 'Buttons depth preset') return 'controls';
    return 'all';
}
function darkOneSettingsResult(names, forceAll) {
    var result = {
        handled : true,
        all : Boolean(forceAll),
        names : [],
        categories : {}
    };
    for (var i = 0; i < names.length; i++) {
        var name = String(names[i] || '');
        if (!name) continue;
        result.names.push(name);
        var category = darkOneSettingCategory(name);
        result.categories[category] = true;
        if (category === 'all') result.all = true;
    }
    return result;
}
function darkOneNotifyAffects(change, category) {
    if (!change) return false;
    if (change === true || change.all) return true;
    return Boolean(change.categories && change.categories[category]);
}
function darkOneNotifyMatches(change, prefix) {
    if (!change) return false;
    if (change === true || change.all) return true;
    prefix = String(prefix || '');
    for (var i = 0; i < change.names.length; i++) {
        if (change.names[i].indexOf(prefix) === 0) return true;
    }
    return false;
}
function darkOneApplySharedValues(values) {
    var names = [];
    for (var name in values) {
        if (!Object.prototype.hasOwnProperty.call(values, name)) continue;
        var normalised = String(name || '');
        if (!normalised) continue;
        window.SetProperty(normalised, values[name]);
        names.push(normalised);
    }
    return darkOneSettingsResult(names, false);
}
function darkOneSetSharedProperties(values) {
    var payload = {};
    for (var name in values) {
        if (!Object.prototype.hasOwnProperty.call(values, name)) continue;
        var normalised = String(name || '');
        if (!normalised) continue;
        payload[normalised] = values[name];
        window.SetProperty(normalised, values[name]);
    }
    try {
        window.NotifyOthers('DarkOneJSP3.Settings.Batch', JSON.stringify({ values : payload }));
    } catch (e) {}
}
function darkOneSetSharedProperty(name, value) {
    var values = {};
    values[name] = value;
    darkOneSetSharedProperties(values);
}
function darkOneHandleNotify(name, info) {
    if (name == DARKONE_BOTTOM_AREA_NOTIFICATIONS.commit) {
        var peerCommit = darkOneBottomAreaParseCommit(info, new Date().getTime());
        if (!peerCommit) return false;
        darkOneScheduleBottomAreaCommit(peerCommit);
        return false;
    }
    if (name == DARKONE_BOTTOM_AREA_NOTIFICATIONS.state) {
        var peerState = darkOneBottomAreaParseState(info);
        if (!peerState) return false;
        darkOneCancelBottomAreaCommit();
        return darkOneApplyBottomAreaState(peerState);
    }
    if (name == DARKONE_BOTTOM_AREA_NOTIFICATIONS.query) {
        // A peer may query before this panel's first on_size callback. Initialise
        // once without recursively querying peers, then answer from local state.
        darkOneInitialiseBottomAreaState(false);
        darkOneBroadcastBottomAreaState(darkOneBottomAreaState());
        return false;
    }

    if (name == 'DarkOneJSP3.Settings.Batch') {
        try {
            var batch = typeof info == 'string' ? JSON.parse(info) : info;
            var values = batch && batch.values && typeof batch.values == 'object' ? batch.values : {};
            return darkOneApplySharedValues(values);
        } catch (e) {
            return darkOneSettingsResult([], true);
        }
    }

    if (name == 'DarkOneJSP3.Settings.Changed') {
        return darkOneSettingsResult([], true);
    }
    return false;
}
function darkOneSetNumberProperty(name, title, defaultValue, minValue, maxValue) {
    try {
        var current = darkOneNumberProperty(name, defaultValue, minValue, maxValue);
        var value = Number(utils.InputBox('Enter a value between ' + minValue + ' and ' + maxValue + '. Default: ' + defaultValue, title, current));
        if (!isNaN(value)) {
            darkOneSetSharedProperty(name, Math.max(minValue, Math.min(maxValue, value)));
            window.Reload();
        }
    } catch (e) {}
}
function darkOneSetFontFamilyProperty(name, title, currentValue) {
    try {
        var value = String(utils.InputBox(
            'Enter an installed DirectWrite font family.\n\nExamples: Arial Black, Segoe UI, Bahnschrift, Microsoft Sans Serif',
            title,
            currentValue
        )).trim();
        if (!value) return;
        if (!utils.CheckFont(value)) {
            utils.MessageBox('"' + value + '" is not available to DirectWrite.\n\nThe existing font has not been changed.', title, MB_OK);
            return;
        }
        darkOneSetSharedProperty(name, value);
        window.Reload();
    } catch (e) {}
}
function darkOneSetFontWeightProperty(name, value) {
    darkOneSetSharedProperty(name, value);
    window.Reload();
}
function darkOneAppendWeightMenu(parent, title, baseId, currentWeight, disposableMenus) {
    var menu = window.CreatePopupMenu();
    // Register ownership immediately so a later native append/check failure
    // cannot leak this wrapper during partial menu construction.
    disposableMenus.push(menu);
    var weights = [
        [DWRITE_FONT_WEIGHT_NORMAL, 'Regular (400)'],
        [DWRITE_FONT_WEIGHT_MEDIUM, 'Medium (500)'],
        [DWRITE_FONT_WEIGHT_SEMI_BOLD, 'Semi-bold (600)'],
        [DWRITE_FONT_WEIGHT_BOLD, 'Bold (700)'],
        [DWRITE_FONT_WEIGHT_BLACK, 'Black (900)']
    ];
    for (var i = 0; i < weights.length; i++) {
        menu.AppendMenuItem(MF_STRING, baseId + i, weights[i][1]);
        if (Number(currentWeight) == weights[i][0]) menu.CheckMenuItem(baseId + i, true);
    }
    menu.AppendTo(parent, MF_STRING, title);
}
function darkOneResetControlFont() {
    darkOneSetSharedProperties({
        'DARKONEJSP3.CONTROL.FONT.NAME' : DARKONEJSP3_FONT_DEFAULTS.controlName,
        'DARKONEJSP3.CONTROL.FONT.WEIGHT' : DARKONEJSP3_FONT_DEFAULTS.controlWeight,
        'DARKONEJSP3.FONT.SCALE' : 1.0
    });
    window.Reload();
}
function darkOneResetDisplayLabelFont() {
    darkOneSetSharedProperties({
        'DARKONEJSP3.DISPLAY.LABEL.FONT.NAME' : DARKONEJSP3_FONT_DEFAULTS.displayLabelName,
        'DARKONEJSP3.DISPLAY.LABEL.FONT.WEIGHT' : DARKONEJSP3_FONT_DEFAULTS.displayLabelWeight,
        'DARKONEJSP3.DISPLAY.LABEL.FONT.SCALE' : 1.0
    });
    window.Reload();
}
function darkOneResetDisplayValueFont() {
    darkOneSetSharedProperties({
        'DARKONEJSP3.DISPLAY.VALUE.FONT.NAME' : DARKONEJSP3_FONT_DEFAULTS.displayValueName,
        'DARKONEJSP3.DISPLAY.VALUE.FONT.WEIGHT' : DARKONEJSP3_FONT_DEFAULTS.displayValueWeight,
        'DARKONEJSP3.DISPLAY.VALUE.FONT.SCALE' : 1.0
    });
    window.Reload();
}
function darkOneResetAllFonts() {
    darkOneSetSharedProperties({
        'DARKONEJSP3.CONTROL.FONT.NAME' : DARKONEJSP3_FONT_DEFAULTS.controlName,
        'DARKONEJSP3.CONTROL.FONT.WEIGHT' : DARKONEJSP3_FONT_DEFAULTS.controlWeight,
        'DARKONEJSP3.FONT.SCALE' : 1.0,
        'DARKONEJSP3.DISPLAY.LABEL.FONT.NAME' : DARKONEJSP3_FONT_DEFAULTS.displayLabelName,
        'DARKONEJSP3.DISPLAY.LABEL.FONT.WEIGHT' : DARKONEJSP3_FONT_DEFAULTS.displayLabelWeight,
        'DARKONEJSP3.DISPLAY.LABEL.FONT.SCALE' : 1.0,
        'DARKONEJSP3.DISPLAY.VALUE.FONT.NAME' : DARKONEJSP3_FONT_DEFAULTS.displayValueName,
        'DARKONEJSP3.DISPLAY.VALUE.FONT.WEIGHT' : DARKONEJSP3_FONT_DEFAULTS.displayValueWeight,
        'DARKONEJSP3.DISPLAY.VALUE.FONT.SCALE' : 1.0,
        'DARKONEJSP3.DISPLAY.FONT.SCALE' : 1.0
    });
    window.Reload();
}

// Coordinated DarkOneJSP3 factory-reset support. Cache files are intentionally preserved.
function darkOneNormaliseResetScope(value) {
    value = String(value == null ? '' : value).toLowerCase();
    return value == 'appearance' || value == 'behaviour' || value == 'all'
        ? value
        : null;
}
function darkOneResetScope(info) {
    if (info == null || info === '') return 'all';
    if (typeof info == 'string') {
        try {
            var payload = JSON.parse(info);
            if (payload && typeof payload == 'object') {
                return Object.prototype.hasOwnProperty.call(payload, 'scope')
                    ? darkOneNormaliseResetScope(payload.scope)
                    : 'all';
            }
        } catch (e) {}
        return darkOneNormaliseResetScope(info);
    }
    if (typeof info == 'object') {
        return Object.prototype.hasOwnProperty.call(info, 'scope')
            ? darkOneNormaliseResetScope(info.scope)
            : 'all';
    }
    return null;
}
function darkOneApplyResetDefaults(scope) {
    var role = typeof DARKONEJSP3_RESET_ROLE == 'string' ? DARKONEJSP3_RESET_ROLE : '';
    if (!role || !DARKONEJSP3_RESET_REGISTRY[role]) return false;
    return darkOneJsp3ApplyRoleReset(role, scope || 'all');
}
function darkOneHandleResetNotification(name, info) {
    if (name !== 'DarkOneJSP3.Reset.Properties') return false;
    var scope = darkOneResetScope(info);
    var role = typeof DARKONEJSP3_RESET_ROLE == 'string' ? DARKONEJSP3_RESET_ROLE : '';
    if (!scope || !role || !DARKONEJSP3_RESET_REGISTRY[role]) return false;
    darkOneJsp3ApplyRoleReset(role, scope);
    if ((scope == 'appearance' || scope == 'all') &&
            typeof darkOneApplyBottomAreaDefaultsLocally == 'function') {
        darkOneApplyBottomAreaDefaultsLocally();
    }
    try { window.Reload(); } catch (e) { window.Repaint(); }
    return true;
}
function darkOneConfirmFactoryReset(scope) {
    var label = scope === 'appearance' ? 'appearance settings' : scope === 'behaviour' ? 'behaviour settings' : 'all DarkOneJSP3 settings';
    var result = utils.MessageBox(
        'Reset ' + label + ' across every DarkOneJSP3 panel?\n\nAlbum Notes caches and downloaded data will be preserved. Foobar2000 panels will reload.',
        'Reset DarkOneJSP3',
        MB_YESNO | MB_ICONQUESTION
    );
    if (result !== IDYES) return false;
    darkOneWriteResetCommand(scope);
    darkOneApplyResetDefaults(scope);
    if ((scope == 'appearance' || scope == 'all') &&
            typeof darkOneResetBottomAreaDefaults == 'function') {
        darkOneResetBottomAreaDefaults();
    }
    try { window.NotifyOthers(DARKONEJSP3_RESET_NOTIFICATION, JSON.stringify({ version : 1, scope : scope })); } catch (e) {}
    try { window.Reload(); } catch (e2) { window.Repaint(); }
    return true;
}

// DarkOne Tools menu v0.2.3: Appearance now includes independent Flat/Soft
// Bottom area depth above the optional Background linear gradient.
//
// v0.2.0: Startup now uses a dedicated root-owned bridge,
// while renderer, folder and panel maintenance actions live under Utilities.
var DARKONE_TOOLS_STARTUP_IDS = Object.freeze({
    transitionFirst: 9860,
    transitionLast: 9862,
    minimumDelay: 9863,
    readinessTimeout: 9864,
    preview: 9865,
    restore: 9866
});

function darkOneToolsStartupState() {
    var state = DarkOneViewBridge.readStartupState();
    return state || {
        transition: 0,
        minimumDelay: 250,
        readinessTimeout: 2000
    };
}

function darkOneAppendToolsStartupMenu(menu, transitionMenu, state) {
    transitionMenu.AppendMenuItem(MF_STRING, 9860, 'Off');
    transitionMenu.AppendMenuItem(MF_STRING, 9861, 'Black reveal');
    transitionMenu.AppendMenuItem(MF_STRING, 9862, 'Staged reveal');
    transitionMenu.CheckMenuRadioItem(
        DARKONE_TOOLS_STARTUP_IDS.transitionFirst,
        DARKONE_TOOLS_STARTUP_IDS.transitionLast,
        DARKONE_TOOLS_STARTUP_IDS.transitionFirst + state.transition
    );
    transitionMenu.AppendTo(menu, MF_STRING, 'Transition');
    menu.AppendMenuItem(
        MF_STRING,
        DARKONE_TOOLS_STARTUP_IDS.minimumDelay,
        'Minimum black hold... (' + state.minimumDelay + ' ms)'
    );
    menu.AppendMenuItem(
        MF_STRING,
        DARKONE_TOOLS_STARTUP_IDS.readinessTimeout,
        'Layout-readiness timeout... (' + state.readinessTimeout + ' ms)'
    );
    menu.AppendMenuSeparator();
    menu.AppendMenuItem(
        state.transition === 0 ? MF_GRAYED : MF_STRING,
        DARKONE_TOOLS_STARTUP_IDS.preview,
        'Preview startup transition'
    );
    menu.AppendMenuItem(
        MF_STRING,
        DARKONE_TOOLS_STARTUP_IDS.restore,
        'Restore startup defaults'
    );
}

function darkOneSendToolsStartupCommand(action, key, value) {
    var command = DarkOneViewBridge.startupActionCommand(action, key, value);
    if (command && DarkOneViewBridge.writeCommand(command, null)) return true;
    utils.MessageBox(
        'DarkOneJSP3 could not publish the Startup command. Please try again.',
        'DarkOneJSP3 Startup',
        MB_OK | MB_ICONEXCLAMATION
    );
    return false;
}

function darkOneSetToolsStartupTiming(key, title, current, minimum, maximum) {
    try {
        var entered = Math.round(Number(utils.InputBox(
            'Enter a value from ' + minimum + ' to ' + maximum + ' milliseconds.',
            title,
            String(current)
        )));
        if (!isFinite(entered) || entered < minimum || entered > maximum) {
            utils.MessageBox(
                'Enter a value from ' + minimum + ' to ' + maximum + ' milliseconds.',
                title,
                MB_OK | MB_ICONEXCLAMATION
            );
            return true;
        }
        darkOneSendToolsStartupCommand('set', key, entered);
    } catch (e) {}
    return true;
}

function darkOneHandleToolsStartupMenuSelection(id, state) {
    if (id >= DARKONE_TOOLS_STARTUP_IDS.transitionFirst &&
            id <= DARKONE_TOOLS_STARTUP_IDS.transitionLast) {
        darkOneSendToolsStartupCommand(
            'set',
            'transition',
            id - DARKONE_TOOLS_STARTUP_IDS.transitionFirst
        );
        return true;
    }
    if (id === DARKONE_TOOLS_STARTUP_IDS.minimumDelay) {
        return darkOneSetToolsStartupTiming(
            'minimum-delay',
            'DarkOneJSP3 minimum black hold',
            state.minimumDelay,
            0,
            5000
        );
    }
    if (id === DARKONE_TOOLS_STARTUP_IDS.readinessTimeout) {
        return darkOneSetToolsStartupTiming(
            'readiness-timeout',
            'DarkOneJSP3 layout-readiness timeout',
            state.readinessTimeout,
            500,
            10000
        );
    }
    if (id === DARKONE_TOOLS_STARTUP_IDS.preview) {
        darkOneSendToolsStartupCommand('preview');
        return true;
    }
    if (id === DARKONE_TOOLS_STARTUP_IDS.restore) {
        darkOneSendToolsStartupCommand('restore');
        return true;
    }
    return false;
}

function darkOneToolsMenu(x, y) {
    var menus = [];
    var idx = 0;
    var bottomAreaHandled = false;
    var startupState = darkOneToolsStartupState();

    try {
    var m = window.CreatePopupMenu(); menus.push(m);
    var appearance = window.CreatePopupMenu(); menus.push(appearance);
    var buttons = window.CreatePopupMenu(); menus.push(buttons);
    var buttonStyle = window.CreatePopupMenu(); menus.push(buttonStyle);
    var buttonDepth = window.CreatePopupMenu(); menus.push(buttonDepth);
    var buttonRoundness = window.CreatePopupMenu(); menus.push(buttonRoundness);
    var bottomBackground = window.CreatePopupMenu(); menus.push(bottomBackground);
    var bottomDivider = window.CreatePopupMenu(); menus.push(bottomDivider);
    var bottomDepth = window.CreatePopupMenu(); menus.push(bottomDepth);
    var fonts = window.CreatePopupMenu(); menus.push(fonts);
    var control = window.CreatePopupMenu(); menus.push(control);
    var labels = window.CreatePopupMenu(); menus.push(labels);
    var values = window.CreatePopupMenu(); menus.push(values);
    var sc = window.CreatePopupMenu(); menus.push(sc);
    var startup = window.CreatePopupMenu(); menus.push(startup);
    var startupTransition = window.CreatePopupMenu(); menus.push(startupTransition);
    var reset = window.CreatePopupMenu(); menus.push(reset);
    var utilities = window.CreatePopupMenu(); menus.push(utilities);

    darkOneAppendButtonsAppearanceMenu(buttons, buttonStyle, buttonDepth, buttonRoundness);
    darkOneAppendBottomAreaAppearanceMenu(
        appearance,
        bottomBackground,
        bottomDivider,
        bottomDepth
    );
    appearance.AppendTo(m, MF_STRING, 'Appearance');
    buttons.AppendTo(m, MF_STRING, 'Buttons');

    control.AppendMenuItem(MF_GRAYED, 0, 'Current: ' + darkOneControlFontName());
    control.AppendMenuItem(MF_STRING, 9201, 'Set font family...');
    darkOneAppendWeightMenu(control, 'Weight', 9210, darkOneControlFontWeight(), menus);
    control.AppendMenuItem(MF_STRING, 9202, 'Size scale...');
    control.AppendMenuSeparator();
    control.AppendMenuItem(MF_STRING, 9203, 'Restore default');
    control.AppendTo(fonts, MF_STRING, 'Control-panel labels');

    labels.AppendMenuItem(MF_GRAYED, 0, 'Current: ' + darkOneDisplayLabelFontName());
    labels.AppendMenuItem(MF_STRING, 9301, 'Set font family...');
    darkOneAppendWeightMenu(labels, 'Weight', 9310, darkOneDisplayLabelFontWeight(), menus);
    labels.AppendMenuItem(MF_STRING, 9302, 'Size scale...');
    labels.AppendMenuSeparator();
    labels.AppendMenuItem(MF_STRING, 9303, 'Restore default');
    labels.AppendTo(fonts, MF_STRING, 'Display captions');

    values.AppendMenuItem(MF_GRAYED, 0, 'Current: ' + darkOneDisplayValueFontName());
    values.AppendMenuItem(MF_STRING, 9401, 'Set font family...');
    darkOneAppendWeightMenu(values, 'Weight', 9410, darkOneDisplayValueFontWeight(), menus);
    values.AppendMenuItem(MF_STRING, 9402, 'Size scale...');
    values.AppendMenuSeparator();
    values.AppendMenuItem(MF_STRING, 9403, 'Restore default');
    values.AppendTo(fonts, MF_STRING, 'Display values');

    fonts.AppendMenuSeparator();
    fonts.AppendMenuItem(MF_STRING, 9500, 'Reset all font defaults');
    fonts.AppendTo(m, MF_STRING, 'Fonts');

    sc.AppendMenuItem(MF_STRING, 9101, 'Control font scale...');
    sc.AppendMenuItem(MF_STRING, 9102, 'Button hitbox scale...');
    sc.AppendMenuItem(MF_STRING, 9103, 'Icon scale...');
    sc.AppendMenuItem(MF_STRING, 9104, 'Display master font scale...');
    sc.AppendMenuSeparator();
    sc.AppendMenuItem(MF_STRING, 9105, 'Reset scaling defaults');
    sc.AppendTo(m, MF_STRING, 'High-DPI / scaling');

    darkOneAppendToolsStartupMenu(startup, startupTransition, startupState);
    startup.AppendTo(m, MF_STRING, 'Startup');

    m.AppendMenuSeparator();
    reset.AppendMenuItem(MF_STRING, 9700, 'Reset this panel');
    reset.AppendMenuSeparator();
    reset.AppendMenuItem(MF_STRING, 9701, 'Reset appearance settings...');
    reset.AppendMenuItem(MF_STRING, 9702, 'Reset behaviour settings...');
    reset.AppendMenuSeparator();
    reset.AppendMenuItem(MF_STRING, 9703, 'Reset all DarkOneJSP3 settings...');
    reset.AppendTo(m, MF_STRING, 'Reset DarkOneJSP3');

    m.AppendMenuSeparator();
    utilities.AppendMenuItem(MF_GRAYED, 0, 'Renderer: Direct2D + DirectWrite (JSP3)');
    utilities.AppendMenuSeparator();
    utilities.AppendMenuItem(MF_STRING, 9110, 'Open DarkOneJSP3 folder');
    utilities.AppendMenuItem(MF_STRING, 9111, 'Open JScript Panel js_data cache');
    utilities.AppendMenuItem(MF_STRING, 9112, 'Open JScript Panel 3 component folder');
    utilities.AppendMenuSeparator();
    utilities.AppendMenuItem(MF_STRING, 9120, 'Panel properties');
    utilities.AppendMenuItem(MF_STRING, 9121, 'Configure script...');
    utilities.AppendMenuItem(MF_STRING, 9122, 'Reload this panel');
    utilities.AppendTo(m, MF_STRING, 'Utilities');

    idx = m.TrackPopupMenu(x, y);
    // Route every bottom-area command through one path. The native picker
    // remains inside the popup lifetime used by the confirmed live fix,
    // while finally guarantees every native menu is disposed on success,
    // cancellation or any later exception. Menu construction itself is also
    // covered so a partial native-menu failure cannot leak earlier wrappers.
    bottomAreaHandled = darkOneHandleBottomAreaMenuSelection(idx);
    } finally {
        for (var i = menus.length - 1; i >= 0; i--) {
            try { menus[i].Dispose(); } catch (disposeError) {}
        }
    }

    if (bottomAreaHandled) return true;
    if (darkOneHandleButtonsAppearanceMenuSelection(idx)) return true;
    if (darkOneHandleToolsStartupMenuSelection(idx, startupState)) return true;

    var weightMap = {
        9210 : DWRITE_FONT_WEIGHT_NORMAL,
        9211 : DWRITE_FONT_WEIGHT_MEDIUM,
        9212 : DWRITE_FONT_WEIGHT_SEMI_BOLD,
        9213 : DWRITE_FONT_WEIGHT_BOLD,
        9214 : DWRITE_FONT_WEIGHT_BLACK,
        9310 : DWRITE_FONT_WEIGHT_NORMAL,
        9311 : DWRITE_FONT_WEIGHT_MEDIUM,
        9312 : DWRITE_FONT_WEIGHT_SEMI_BOLD,
        9313 : DWRITE_FONT_WEIGHT_BOLD,
        9314 : DWRITE_FONT_WEIGHT_BLACK,
        9410 : DWRITE_FONT_WEIGHT_NORMAL,
        9411 : DWRITE_FONT_WEIGHT_MEDIUM,
        9412 : DWRITE_FONT_WEIGHT_SEMI_BOLD,
        9413 : DWRITE_FONT_WEIGHT_BOLD,
        9414 : DWRITE_FONT_WEIGHT_BLACK
    };

    if (weightMap.hasOwnProperty(idx)) {
        var property = idx < 9300 ? 'DARKONEJSP3.CONTROL.FONT.WEIGHT' : idx < 9400 ? 'DARKONEJSP3.DISPLAY.LABEL.FONT.WEIGHT' : 'DARKONEJSP3.DISPLAY.VALUE.FONT.WEIGHT';
        darkOneSetFontWeightProperty(property, weightMap[idx]);
        return true;
    }

    switch (idx) {
    case 9101: darkOneSetNumberProperty('DARKONEJSP3.FONT.SCALE', 'DarkOneJSP3 control font scale', 1.0, 0.75, 1.75); break;
    case 9102: darkOneSetNumberProperty('DARKONEJSP3.BUTTON.HITBOX.SCALE', 'DarkOneJSP3 button hitbox scale', 1.0, 0.85, 1.35); break;
    case 9103: darkOneSetNumberProperty('DARKONEJSP3.ICON.SCALE', 'DarkOneJSP3 icon scale', 1.0, 0.75, 1.5); break;
    case 9104: darkOneSetNumberProperty('DARKONEJSP3.DISPLAY.FONT.SCALE', 'DarkOneJSP3 display master font scale', 1.0, 0.75, 1.5); break;
    case 9105:
        darkOneSetSharedProperties({
            'DARKONEJSP3.FONT.SCALE' : 1.0,
            'DARKONEJSP3.BUTTON.HITBOX.SCALE' : 1.0,
            'DARKONEJSP3.ICON.SCALE' : 1.0,
            'DARKONEJSP3.DISPLAY.FONT.SCALE' : 1.0
        });
        window.Reload();
        break;
    case 9201: darkOneSetFontFamilyProperty('DARKONEJSP3.CONTROL.FONT.NAME', 'DarkOneJSP3 control-panel font', darkOneControlFontName()); break;
    case 9202: darkOneSetNumberProperty('DARKONEJSP3.FONT.SCALE', 'DarkOneJSP3 control-panel font scale', 1.0, 0.75, 1.75); break;
    case 9203: darkOneResetControlFont(); break;
    case 9301: darkOneSetFontFamilyProperty('DARKONEJSP3.DISPLAY.LABEL.FONT.NAME', 'DarkOneJSP3 display-caption font', darkOneDisplayLabelFontName()); break;
    case 9302: darkOneSetNumberProperty('DARKONEJSP3.DISPLAY.LABEL.FONT.SCALE', 'DarkOneJSP3 display-caption font scale', 1.0, 0.6, 2.0); break;
    case 9303: darkOneResetDisplayLabelFont(); break;
    case 9401: darkOneSetFontFamilyProperty('DARKONEJSP3.DISPLAY.VALUE.FONT.NAME', 'DarkOneJSP3 display-value font', darkOneDisplayValueFontName()); break;
    case 9402: darkOneSetNumberProperty('DARKONEJSP3.DISPLAY.VALUE.FONT.SCALE', 'DarkOneJSP3 display-value font scale', 1.0, 0.6, 2.0); break;
    case 9403: darkOneResetDisplayValueFont(); break;
    case 9500: darkOneResetAllFonts(); break;
    case 9700:
        darkOneApplyResetDefaults('all');
        window.Reload();
        break;
    case 9701: darkOneConfirmFactoryReset('appearance'); break;
    case 9702: darkOneConfirmFactoryReset('behaviour'); break;
    case 9703: darkOneConfirmFactoryReset('all'); break;
    case 9110: darkOneOpenFolder(configPath); break;
    case 9111: darkOneOpenFolder(fb.ProfilePath + 'js_data\\'); break;
    case 9112: darkOneOpenFolder(fb.ComponentPath); break;
    case 9120: window.ShowProperties(); break;
    case 9121: window.ShowConfigure(); break;
    case 9122: window.Reload(); break;
    }
    return idx != 0;
}
