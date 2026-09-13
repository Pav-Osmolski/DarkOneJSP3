"use strict";

// Reset bridge for the standalone enhanced sample suite. Both the neutral
// notification and the original DarkOneJSP3 notification remain supported.
var JSP3_ENHANCED_RESET_NOTIFICATION = "JSP3Enhanced.Reset.Properties";
var JSP3_ENHANCED_LEGACY_RESET_NOTIFICATION = "DarkOneJSP3.Reset.Properties";

function jsp3EnhancedNormaliseResetScope(value) {
    value = String(value == null ? "" : value).toLowerCase();
    return value === "appearance" || value === "behaviour" || value === "all"
        ? value
        : null;
}

function jsp3EnhancedSampleResetScope(info) {
    if (info == null || info === "") return "all";

    if (typeof info === "string") {
        try {
            var payload = JSON.parse(info);
            if (payload && typeof payload === "object") {
                return Object.prototype.hasOwnProperty.call(payload, "scope")
                    ? jsp3EnhancedNormaliseResetScope(payload.scope)
                    : "all";
            }
        } catch (e) {}
        return jsp3EnhancedNormaliseResetScope(info);
    }

    if (typeof info === "object") {
        return Object.prototype.hasOwnProperty.call(info, "scope")
            ? jsp3EnhancedNormaliseResetScope(info.scope)
            : "all";
    }
    return null;
}

function jsp3EnhancedHasResetRole(role) {
    return typeof JSP3_ENHANCED_RESET_REGISTRY !== "undefined" &&
        Object.prototype.hasOwnProperty.call(JSP3_ENHANCED_RESET_REGISTRY, role);
}

function jsp3EnhancedThemeTiming(roles, phase) {
    try {
        if (window.GetProperty("DARKONEJSP3.THEME.DEBUG.TIMING", false))
            console.log("[Theme timing] " + new Date().getTime() + " " + roles.join(",") + " " + phase);
    } catch (e) {}
}

function jsp3EnhancedHandleSampleReset(name, info, roles) {
    if (typeof DARKONEJSP3_THEME_CAPTURE_QUERY_NOTIFICATION !== "undefined" &&
            name === DARKONEJSP3_THEME_CAPTURE_QUERY_NOTIFICATION) {
        var captureRequest = jsp3EnhancedThemeCaptureRequest(info);
        if (!captureRequest) return true;
        var captureRoles = Object.prototype.toString.call(roles) === "[object Array]"
            ? roles : [roles];
        for (var captureIndex = 0; captureIndex < captureRoles.length; captureIndex++) {
            var captureRole = captureRoles[captureIndex];
            if (typeof captureRole !== "string" || !captureRole) continue;
            try {
                var captureValues = jsp3EnhancedCaptureTheme(captureRequest.theme, captureRole);
                if (!captureValues || !Object.keys(captureValues).length) continue;
                var capturePayload = JSON.stringify({
                    version: 1,
                    id: captureRequest.id,
                    role: captureRole,
                    values: captureValues
                });
                if (capturePayload.length <= 65536) {
                    window.NotifyOthers(DARKONEJSP3_THEME_CAPTURE_RESPONSE_NOTIFICATION, capturePayload);
                }
            } catch (captureError) {}
        }
        return true;
    }
    if (typeof DARKONEJSP3_THEME_NOTIFICATION !== "undefined" &&
            name === DARKONEJSP3_THEME_NOTIFICATION) {
        var themeRoles = Object.prototype.toString.call(roles) === "[object Array]"
            ? roles
            : [roles];
        var changed = false;
        jsp3EnhancedThemeTiming(themeRoles, "apply-received");
        for (var themeIndex = 0; themeIndex < themeRoles.length; themeIndex++) {
            if (typeof themeRoles[themeIndex] === "string" && themeRoles[themeIndex]) {
                try {
                    if (jsp3EnhancedApplyTheme(info, themeRoles[themeIndex])) changed = true;
                } catch (themeError) {
                    try { console.log("[DarkOneJSP3] Theme rejected: " + themeError.message); } catch (e0) {}
                    return true;
                }
            }
        }
        if (changed) {
            jsp3EnhancedThemeTiming(themeRoles, "properties-applied");
            if (typeof jsp3EnhancedRefreshTheme === "function") {
                try {
                    if (jsp3EnhancedRefreshTheme(themeRoles) === true) {
                        jsp3EnhancedThemeTiming(themeRoles, "live-refreshed");
                        return true;
                    }
                }
                catch (refreshError) {
                    try { console.log("[DarkOneJSP3] Live theme refresh failed: " + refreshError.message); } catch (logError) {}
                }
            }
            jsp3EnhancedThemeTiming(themeRoles, "reload-requested");
            try { window.Reload(); } catch (themeReloadError) { window.Repaint(); }
        } else window.Repaint();
        return true;
    }
    if (name !== JSP3_ENHANCED_RESET_NOTIFICATION &&
            name !== JSP3_ENHANCED_LEGACY_RESET_NOTIFICATION) return false;

    var scope = jsp3EnhancedSampleResetScope(info);
    if (!scope) return false;

    var list = Object.prototype.toString.call(roles) === "[object Array]"
        ? roles
        : [roles];
    var handled = false;

    for (var i = 0; i < list.length; i++) {
        if (typeof list[i] === "string" && list[i] &&
                jsp3EnhancedHasResetRole(list[i])) {
            jsp3EnhancedApplyRoleReset(list[i], scope);
            handled = true;
        }
    }

    if (!handled) return false;
    try {
        window.Reload();
    } catch (e) {
        window.Repaint();
    }
    return true;
}

// Backwards-compatible function aliases used by existing DarkOneJSP3 panels
// and third-party layouts that imported the former bridge directly.
function darkOneJsp3SampleResetScope(info) {
    return jsp3EnhancedSampleResetScope(info);
}
function darkOneJsp3HandleSampleReset(name, info, roles) {
    return jsp3EnhancedHandleSampleReset(name, info, roles);
}
