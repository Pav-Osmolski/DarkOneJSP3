/*
 * Enhanced JS Playlist row-render cache
 * Version: 0.1.0
 *
 * Caches title-format output independently of transient oItem instances so
 * smooth scrolling does not reevaluate every visible row on every frame.
 * Playback/clock-dependent fields are refreshed individually over a cached
 * static row rather than forcing the complete combined pattern to run again.
 */

var DARKONE_JSPLAYLIST_RENDER_CACHE_VERSION = "0.1.1";

function DarkOnePlaylistRenderCache(options) {
    options = options || {};
    this.maxEntries = Math.max(64, Math.min(4096, Math.round(Number(options.maxEntries) || 768)));
    this.enabled = options.enabled !== false;
    this.now = typeof options.now === "function" ? options.now : function () { return new Date().getTime(); };
    this.entries = Object.create(null);
    this.order = [];
    this.patternKey = "";
    this.primaryPattern = "";
    this.secondaryPattern = "";
    this.primaryFields = [];
    this.secondaryFields = [];
    this.primaryCurrentFields = [];
    this.secondaryCurrentFields = [];
    this.primaryGlobalFields = [];
    this.secondaryGlobalFields = [];
    this.primaryCurrentAndGlobalFields = [];
    this.secondaryCurrentAndGlobalFields = [];
    this.primaryCoupledDynamic = false;
    this.secondaryCoupledDynamic = false;
    this.lovedSync = false;
    this.currentRowDynamic = false;
    this.globalClockDynamic = false;
    this.hits = 0;
    this.misses = 0;
    this.dynamicEvaluations = 0;
    this.dynamicHits = 0;

    this.collectDynamicFields = function (fields, expression) {
        var indexes = [];
        for (var i = 0; i < fields.length; i++) {
            if (expression.test(fields[i])) indexes.push(i);
        }
        return indexes;
    };

    this.mergeIndexes = function (first, second) {
        var result = first.slice(0);
        for (var i = 0; i < second.length; i++) {
            if (result.indexOf(second[i]) < 0) result.push(second[i]);
        }
        return result;
    };

    this.configure = function (primary, secondary, lovedSync) {
        primary = String(primary || "");
        secondary = String(secondary || "");
        lovedSync = lovedSync === true;
        var key = [primary, secondary, lovedSync ? 1 : 0].join("\u001f");
        if (key === this.patternKey) return false;

        this.patternKey = key;
        this.primaryPattern = primary;
        this.secondaryPattern = secondary;
        this.primaryFields = primary.split("^^");
        this.secondaryFields = secondary ? secondary.split("^^") : [];
        this.lovedSync = lovedSync;
        this.invalidateAll();

        var currentExpression = /%(?:isplaying|ispaused|playback_[^%]+|_*bitrate(?:_dynamic)?|_time_(?:elapsed|remaining)|_is(?:playing|paused))%/i;
        var clockExpression = /\$now\s*\(/i;
        var crossFieldExpression = /\$(?:puts|get)\s*\(/i;
        this.primaryCurrentFields = this.collectDynamicFields(this.primaryFields, currentExpression);
        this.secondaryCurrentFields = this.collectDynamicFields(this.secondaryFields, currentExpression);
        this.primaryGlobalFields = this.collectDynamicFields(this.primaryFields, clockExpression);
        this.secondaryGlobalFields = this.collectDynamicFields(this.secondaryFields, clockExpression);
        this.primaryCurrentAndGlobalFields = this.mergeIndexes(this.primaryGlobalFields, this.primaryCurrentFields);
        this.secondaryCurrentAndGlobalFields = this.mergeIndexes(this.secondaryGlobalFields, this.secondaryCurrentFields);
        this.primaryCoupledDynamic = this.primaryCurrentAndGlobalFields.length > 0 && crossFieldExpression.test(primary);
        this.secondaryCoupledDynamic = this.secondaryCurrentAndGlobalFields.length > 0 && crossFieldExpression.test(secondary);
        this.currentRowDynamic = this.primaryCurrentFields.length > 0 || this.secondaryCurrentFields.length > 0;
        this.globalClockDynamic = this.primaryGlobalFields.length > 0 || this.secondaryGlobalFields.length > 0;
        return true;
    };

    this.setEnabled = function (enabled) {
        enabled = enabled !== false;
        if (this.enabled !== enabled) {
            this.enabled = enabled;
            this.invalidateAll();
        }
    };

    this.setMaxEntries = function (value) {
        value = Math.max(64, Math.min(4096, Math.round(Number(value) || 768)));
        if (value !== this.maxEntries) {
            this.maxEntries = value;
            this.trim();
        }
    };

    this.makeEntry = function (trackIndex) {
        var result = {
            primary: get_tfo(this.primaryPattern).EvalActivePlaylistItem(trackIndex).split("^^"),
            secondary: this.secondaryPattern ? get_tfo(this.secondaryPattern).EvalActivePlaylistItem(trackIndex).split("^^") : [],
            loved: null,
            dynamicKey: "",
            dynamicResult: null
        };
        if (this.lovedSync) {
            result.loved = get_tfo("$if2(%lfm_loved%,0)").EvalActivePlaylistItem(trackIndex);
        }
        return result;
    };

    this.refreshFields = function (values, fields, indexes, trackIndex, combinedPattern, coupled) {
        if (!indexes.length) return values;

        // $puts/$get can deliberately share state between column expressions.
        // Preserve that behaviour by refreshing the complete combined pattern
        // whenever a dynamic field participates in such a dependency.
        if (coupled) {
            this.dynamicEvaluations++;
            return get_tfo(combinedPattern).EvalActivePlaylistItem(trackIndex).split("^^");
        }

        var result = values.slice(0);
        for (var i = 0; i < indexes.length; i++) {
            var fieldIndex = indexes[i];
            result[fieldIndex] = get_tfo(fields[fieldIndex]).EvalActivePlaylistItem(trackIndex);
            this.dynamicEvaluations++;
        }
        return result;
    };

    this.getConfigured = function (trackIndex, refreshCurrentFields, currentGeneration) {
        if (!this.enabled) {
            this.misses++;
            return this.makeEntry(trackIndex);
        }

        var key = String(trackIndex);
        var entry = this.entries[key];
        if (entry) {
            this.hits++;
        } else {
            this.misses++;
            entry = this.makeEntry(trackIndex);
            this.entries[key] = entry;
            this.order.push(key);
            this.trim();
        }

        var primaryIndexes = refreshCurrentFields === true
            ? this.primaryCurrentAndGlobalFields
            : this.primaryGlobalFields;
        var secondaryIndexes = refreshCurrentFields === true
            ? this.secondaryCurrentAndGlobalFields
            : this.secondaryGlobalFields;
        if (!primaryIndexes.length && !secondaryIndexes.length) return entry;

        var dynamicKey = "";
        if (this.globalClockDynamic) {
            dynamicKey += "clock:" + Math.floor(Number(this.now()) / 1000);
        }
        if (refreshCurrentFields === true && this.currentRowDynamic) {
            // A supplied generation allows repeated scroll frames to reuse the
            // same playback values until the next playback callback. Callers
            // without a generation retain conservative refresh-on-every-call
            // behaviour.
            dynamicKey += "|current:" + (currentGeneration == null
                ? "uncached:" + this.dynamicEvaluations
                : String(currentGeneration));
        }

        if (entry.dynamicResult && entry.dynamicKey === dynamicKey) {
            this.dynamicHits++;
            return entry.dynamicResult;
        }

        entry.dynamicResult = {
            primary: this.refreshFields(entry.primary, this.primaryFields, primaryIndexes, trackIndex,
                this.primaryPattern, this.primaryCoupledDynamic),
            secondary: this.refreshFields(entry.secondary, this.secondaryFields, secondaryIndexes, trackIndex,
                this.secondaryPattern, this.secondaryCoupledDynamic),
            loved: entry.loved
        };
        entry.dynamicKey = dynamicKey;
        return entry.dynamicResult;
    };

    this.get = function (trackIndex, primary, secondary, lovedSync, refreshCurrentFields, currentGeneration) {
        this.configure(primary, secondary, lovedSync);
        return this.getConfigured(trackIndex, refreshCurrentFields, currentGeneration);
    };

    this.trim = function () {
        while (this.order.length > this.maxEntries) {
            var key = this.order.shift();
            delete this.entries[key];
        }
    };

    this.invalidate = function (trackIndex) {
        var key = String(trackIndex);
        if (!Object.prototype.hasOwnProperty.call(this.entries, key)) return false;
        delete this.entries[key];
        var index = this.order.indexOf(key);
        if (index >= 0) this.order.splice(index, 1);
        return true;
    };

    this.invalidateAll = function () {
        this.entries = Object.create(null);
        this.order = [];
    };

    this.invalidateHandles = function (changedHandles, activeHandles) {
        if (!changedHandles || !activeHandles) {
            this.invalidateAll();
            return -1;
        }

        var keys = this.order.slice(0);
        var invalidated = 0;
        for (var i = 0; i < keys.length; i++) {
            var trackIndex = Number(keys[i]);
            var activeHandle = null;
            try {
                // JSP3 native wrapper methods can report typeof == "unknown".
                // Call GetItem()/Find() directly and use the exception path as
                // the capability guard instead of forcing a full cache flush.
                activeHandle = activeHandles.GetItem(trackIndex);
                if (changedHandles.Find(activeHandle) >= 0 && this.invalidate(trackIndex)) {
                    invalidated++;
                }
            } catch (e) {
                this.invalidateAll();
                return -1;
            } finally {
                if (activeHandle) {
                    try { activeHandle.Dispose(); } catch (e2) {}
                }
            }
        }
        return invalidated;
    };

    this.requiresCurrentRefresh = function () {
        return this.currentRowDynamic;
    };

    this.stats = function () {
        return {
            hits: this.hits,
            misses: this.misses,
            dynamicEvaluations: this.dynamicEvaluations,
            dynamicHits: this.dynamicHits,
            size: this.order.length,
            enabled: this.enabled,
            currentRowDynamic: this.currentRowDynamic,
            globalClockDynamic: this.globalClockDynamic,
            coupledDynamic: this.primaryCoupledDynamic || this.secondaryCoupledDynamic
        };
    };
}
