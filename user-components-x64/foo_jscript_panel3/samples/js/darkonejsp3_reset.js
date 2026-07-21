"use strict";

// DarkOneJSP3 reset bridge for participating customised sample entry points.
// Keep this project-specific helper out of generic sample modules.
function darkOneJsp3SampleResetScope(info) {
    if (typeof info === "string") {
        try {
            var payload = JSON.parse(info);
            if (payload && payload.scope) return String(payload.scope);
        } catch (e) {
            if (info === "appearance" || info === "behaviour" || info === "all") return info;
        }
    }
    return info && info.scope ? String(info.scope) : "all";
}

function darkOneJsp3HandleSampleReset(name, info, roles) {
    if (name !== "DarkOneJSP3.Reset.Properties") return false;

    var scope = darkOneJsp3SampleResetScope(info);
    var list = Object.prototype.toString.call(roles) === "[object Array]"
        ? roles
        : [roles];

    for (var i = 0; i < list.length; i++) {
        if (typeof list[i] === "string" && list[i]) {
            darkOneJsp3ApplyRoleReset(list[i], scope);
        }
    }

    try {
        window.Reload();
    } catch (e) {
        window.Repaint();
    }
    return true;
}
