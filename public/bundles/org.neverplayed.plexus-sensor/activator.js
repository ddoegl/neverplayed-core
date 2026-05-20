import { 
    PLEXUS_ENGINE_SERVICE, 
    PERCEIVER_SERVICE, 
    PERCEIVER_CHANGED_TOPIC,
    PLEXUS_SENSOR_SERVICE,
    LOG_SERVICE
} from "core-types";

export default class Activator {
    start(context) {
        this._context = context;
        this.logger = console;

        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this.logger = svc.getLogger("plexus-sensor");
            }
        }).open();

        this._engine = null;
        this._perceiver = null;
        this._traceBuffer = []; 
        this._stateCache = new Map(); 

        // Track Engine
        context.trackService(`(objectClass=${PLEXUS_ENGINE_SERVICE})`, {
            addingService: (ref) => {
                this._engine = context.getService(ref);
                this._probeNow(true);
                return this._engine;
            },
            removedService: () => { this._engine = null; }
        }).open();

        // Track Perceiver
        context.trackService(`(objectClass=${PERCEIVER_SERVICE})`, {
            addingService: (ref) => {
                this._perceiver = context.getService(ref);
                this._probeNow(true);
                return this._perceiver;
            },
            removedService: () => { this._perceiver = null; }
        }).open();

        // 4. Reactive Listeners for Perceiver Shift
        context.registerService("@pandino/event-admin/EventHandler", {
            handleEvent: () => this._probeNow(true)
        }, {
            "event.topics": [PERCEIVER_CHANGED_TOPIC]
        });

        // 5. DOM Evolution Watcher (MutationObserver) - Using 'data-mark'
        this._observer = new MutationObserver((mutations) => {
            let needsProbe = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1 && (node.matches?.('[data-mark]') || node.querySelector?.('[data-mark]'))) {
                            needsProbe = true;
                            break;
                        }
                    }
                } else if (mutation.type === 'attributes' && (mutation.attributeName === 'data-mark')) {
                    needsProbe = true;
                }
                if (needsProbe) break;
            }
            if (needsProbe) this._probeNow(false);
        });
        this._observer.observe(document.body, { 
            childList: true, 
            subtree: true, 
            attributes: true, 
            attributeFilter: ['data-mark'] 
        });

        // 6. Register Sensor Service
        context.registerService(PLEXUS_SENSOR_SERVICE, {
            sense: (entity, observerContext) => this.sense(entity, observerContext),
            probeDOM: (container) => this._probeDOM(container),
            recoverTrace: (entityId) => {
                if (!entityId) return this._traceBuffer[0] || null;
                return this._traceBuffer.find(t => t.id === entityId) || null;
            },
            getTraceBuffer: () => [...this._traceBuffer]
        });

        this.logger.info("Plexus Sensor: Active (Stigmergic Mode) 📡");
    }

    _probeNow(forceBroadcast = false) {
        this._probeDOM(document.body, forceBroadcast);
    }

    _probeDOM(container = document.body, forceBroadcast = false) {
        if (!this._engine || !this._perceiver) return;
        const elements = container.querySelectorAll('[data-mark]');
        elements.forEach(el => {
            const markData = this._extractMark(el);
            const cacheKey = el.id || markData.id || 'anon';
            
            const prevResult = this._stateCache.get(cacheKey);
            const isSensible = this.sense(markData, null, !forceBroadcast && (prevResult !== undefined));

            if (isSensible) {
                el.style.display = "";
                el.removeAttribute('aria-hidden');
            } else {
                el.style.display = "none";
                el.setAttribute('aria-hidden', 'true');
            }

            if (isSensible !== prevResult || forceBroadcast) {
                this._stateCache.set(cacheKey, isSensible);
            }
        });
    }

    sense(entity, observerContext, skipBroadcast = false) {
        const mark = this._getMark(entity);
        if (!mark) return true; 

        const ctx = observerContext || this._perceiver?.getContext();
        if (!ctx) return false;

        // Use enriched senses from all Knowledge Providers so that dynamically
        // granted senses (e.g. SensePersonhood for PERSONADMIN in governance)
        // are present during Plexus evaluation. getContext() only returns raw
        // state with senses: [] — providers never run unless asked.
        const enrichedSenses = observerContext
            ? (ctx.surrogate?.senses || [])
            : (this._perceiver?.getEnrichedSenses() || ctx.surrogate?.senses || []);

        const evaluationContext = {
            ...ctx.being,
            surrogate: { ...ctx.surrogate, senses: enrichedSenses },
            realm: ctx.realm
        };

        const matched = this._engine?.evaluate(mark.matchers, mark.operator || 'AND', evaluationContext);
        const isSensible = matched !== false;

        if (!skipBroadcast) {
            this._bufferTrace(entity, mark, { ...ctx, surrogate: { ...ctx.surrogate, senses: enrichedSenses } }, isSensible, matched);
        }

        return isSensible;
    }

    _getMark(entity) {
        if (!entity) return null;
        return entity.mark || entity.sensing || entity.visibility || null;
    }

    _extractMark(el) {
        try {
            const raw = el.getAttribute('data-mark');
            if (!raw) return {};
            const matchers = JSON.parse(raw);
            return { 
                id: el.id || 'anonymous-mark',
                mark: { 
                    matchers: Array.isArray(matchers) ? matchers : [matchers],
                    operator: el.getAttribute('data-mark-operator') || 'AND'
                } 
            };
        } catch (e) {
            return {};
        }
    }

    _bufferTrace(entity, mark, context, result, rawMatches) {
        const id = entity.id || 'anonymous';

        // Derive human-readable match labels from the mark's matchers,
        // since evaluateMatchers() returns [true] rather than matched values.
        let matches = [];
        if (result !== false && mark?.matchers) {
            matches = mark.matchers
                .map(m => m.value || m.sense || m.persona || m.realm || m.type || String(m))
                .filter(Boolean);
        } else if (Array.isArray(rawMatches)) {
            matches = rawMatches.filter(m => m !== true && m !== false).map(String);
        }

        const entry = {
            id,
            timestamp: Date.now(),
            mark,
            context: { 
                persona: context.being?.id, 
                grounding: context.surrogate?.grounding, 
                realm: (typeof context.realm === 'object' && context.realm !== null) ? context.realm.id : context.realm
            },
            result,
            matches
        };
        this._traceBuffer.unshift(entry);
        if (this._traceBuffer.length > 100) this._traceBuffer.pop();

        globalThis.dispatchEvent(new CustomEvent('plexus-perceptual-update', { detail: entry }));
    }

    stop() {
        if (this._observer) this._observer.disconnect();
    }
}
