"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(process.argv[2]);
const bundle = path.resolve(process.argv[3]);
const timeoutMs = Number(process.argv[4] || 15000);
const expectedCount = Number(process.argv[5] || 31);
const tests = [];
const testNames = new Set();

global.suite = function (name, callback) {
    if (typeof name !== "string" || !name || typeof callback !== "function") {
        throw new Error("Invalid runtime-suite registration");
    }
    if (testNames.has(name)) {
        throw new Error("Duplicate runtime-suite name: " + name);
    }
    testNames.add(name);
    tests.push({name, source: "(" + callback.toString() + ")();"});
};

vm.runInThisContext(fs.readFileSync(bundle, "utf8"), {filename: bundle});
delete global.suite;

const failures = [];
if (tests.length !== expectedCount) {
    failures.push({
        name: "runtime-suite registry",
        message: "Expected " + expectedCount + " suites, registered " + tests.length,
    });
}
for (const test of failures.length ? [] : tests) {
    let context;
    const localRequire = function (name) {
        if (name !== "vm") return require(name);
        const facade = Object.create(vm);
        facade.runInThisContext = function (source, options) {
            return vm.runInContext(source, context, options);
        };
        return facade;
    };
    context = vm.createContext({
        Buffer,
        console,
        process,
        require: localRequire,
        setInterval,
        clearInterval,
        setTimeout,
        clearTimeout,
        __path(relative) {
            return path.join(root, String(relative));
        },
    });
    context.global = context;
    context.globalThis = context;

    try {
        const script = new vm.Script(test.source, {
            filename: "runtime-suite:" + test.name,
        });
        script.runInContext(context, {timeout: timeoutMs});
    } catch (error) {
        failures.push({
            name: test.name,
            message: String(error && error.stack || error),
        });
    }
}

if (failures.length) {
    process.stdout.write(JSON.stringify(failures));
    process.exitCode = 1;
}
