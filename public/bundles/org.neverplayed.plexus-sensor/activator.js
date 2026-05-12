import { 
    PLEXUS_ENGINE_SERVICE, 
    SESSION_SERVICE, 
    PLEXUS_SENSOR_SERVICE,
    LOG_SERVICE,
    REALM_MANAGER_SERVICE
} from "core-types";

export default class Activator {
    start(context) {
        this._context = context;
        this.loggerReference = context.getServiceReference(LOG_SERVICE);
        this.logger = this.loggerReference ? context.getService(this.loggerReference) : console;

        this._engine = null;
        this._session = null;
        this._realmManager = null;
        this._traceBuffer = []; // Perceptual Log for Trace Recovery
        this._stateCache = new Map(); // Performance Cache

        // Track Engine
        context.trackService(`(objectClass=${PLEXUS_ENGINE_SERVICE})`, {
            addingService: (ref) => {
                this._engine = context.getService(ref);
                this._probeNow(true); // Initial probe when engine arrives
                return this._engine;
            },
            removedService: () => { this._engine = null; }
        }).open();

        // Track Session
        context.trackService(`(objectClass=${SESSION_SERVICE})`, {
            addingService: (ref) => {
                this._session = context.getService(ref);
                return this._session;
            },
            removedService: () => { this._session = null; }
        }).open();

        // Track Realm Manager
        context.trackService(`(objectClass=${REALM_MANAGER_SERVICE})`, {
            addingService: (ref) => {
                this._realmManager = context.getService(ref);
                return this._realmManager;
            },
            removedService: () => { this._realmManager = null; }
        }).open();

        // 4. Reactive Listeners for Perceptual Shift
        globalThis.addEventListener('realm-switched', () => this._probeNow(true));
        globalThis.addEventListener('session-changed', () => this._probeNow(true));

        // 5. DOM Evolution Watcher (MutationObserver)
        this._observer = new MutationObserver((mutations) => {
            let needsProbe = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1 && (node.matches?.('[data-sensing], [data-trace-matchers]') || node.querySelector?.('[data-sensing], [data-trace-matchers]'))) {
                            needsProbe = true;
                            break;
                        }
                    }
                } else if (mutation.type === 'attributes' && (mutation.attributeName === 'data-sensing' || mutation.attributeName === 'data-trace-matchers')) {
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
            attributeFilter: ['data-sensing', 'data-trace-matchers'] 
        });

        // 6. Register Sensor Service
        context.registerService(PLEXUS_SENSOR_SERVICE, {
            sense: (entity, observerContext) => this.sense(entity, observerContext),
            probeDOM: (container) => this._probeDOM(container),
            probeRegistry: (filter) => {
                const refs = context.getServiceReferences(null, filter) || [];
                return refs.filter(ref => {
                    const trace = ref.getProperty("plexus.sensing");
                    if (!trace) return true;
                    return this.sense({ sensing: trace });
                });
            },
            recoverTrace: (entityId) => {
                if (!entityId) return this._traceBuffer[0] || null;
                return this._traceBuffer.find(t => t.id === entityId) || null;
            },
            probe: (entity, observerContext) => {
                const trace = this._getTrace(entity);
                if (!trace) return null;
                const ctx = observerContext || this._getPerceiverContext();
                if (!ctx) return null;
                const matcherEngine = this._engine?.getMatcherEngine();
                if (!matcherEngine) return null;
                const matched = matcherEngine.evaluate(trace.matchers, trace.operator || 'AND', ctx);
                const isSensible = matched !== false;
                
                // Return a "synthetic" trace entry for on-demand recovery
                return {
                    id: entity.id || 'anonymous',
                    timestamp: Date.now(),
                    trace,
                    context: { 
                        userId: ctx.id || ctx.userId, 
                        persona: ctx.level || ctx.surrogate?.level, 
                        realm: ctx.realm?.id 
                    },
                    result: isSensible,
                    matches: matched
                };
            },
            getTraceBuffer: () => [...this._traceBuffer]
        });
    }

    _probeNow(forceBroadcast = false) {
        this._probeDOM(document.body, forceBroadcast);
    }

    _probeDOM(container = document.body, forceBroadcast = false) {
        if (!this._engine) return;
        const elements = container.querySelectorAll('[data-sensing], [data-trace-matchers]');
        elements.forEach(el => {
            const traceData = this._extractDOMTrace(el);
            const cacheKey = el.id || traceData.id || 'anon';
            
            // Check cache to avoid redundant sensing logic
            const prevResult = this._stateCache.get(cacheKey);
            const isSensible = this.sense(traceData, null, !forceBroadcast && (prevResult !== undefined));

            if (isSensible) {
                el.style.display = "";
                el.removeAttribute('aria-hidden');
            } else {
                el.style.display = "none";
                el.setAttribute('aria-hidden', 'true');
            }

            // Update cache and broadcast ONLY on change or forced request
            if (isSensible !== prevResult || forceBroadcast) {
                this._stateCache.set(cacheKey, isSensible);
            }
        });
    }

    sense(entity, observerContext, skipBroadcast = false) {
        const trace = this._getTrace(entity);
        if (!trace) return true; // Rule: Sovereignty of the Unmarked

        const ctx = observerContext || this._getPerceiverContext();
        if (!ctx) return false;

        const matcherEngine = this._engine?.getMatcherEngine();
        if (!matcherEngine) return false;

        const matched = matcherEngine.evaluate(trace.matchers, trace.operator || 'AND', ctx);
        const isSensible = matched !== false;

        // Trace Buffering & Broadcast (Throttled by skipBroadcast)
        if (!skipBroadcast) {
            this._bufferTrace(entity, trace, ctx, isSensible, matched);
        }

        return isSensible;
    }

    _getTrace(entity) {
        if (!entity) return null;
        // Support both direct objects and metadata wrappers
        return entity.sensing || entity.visibility || null;
    }

    _extractDOMTrace(el) {
        try {
            const raw = el.getAttribute('data-sensing') || el.getAttribute('data-trace-matchers');
            if (!raw) return {};
            const matchers = JSON.parse(raw);
            return { 
                id: el.id || 'anonymous-element',
                sensing: { 
                    matchers: Array.isArray(matchers) ? matchers : [matchers],
                    operator: el.getAttribute('data-trace-operator') || 'AND'
                } 
            };
        } catch (e) {
            return {};
        }
    }

    _getPerceiverContext() {
        if (!this._session || !this._session.currentUser) {
            return null;
        }
        
        const user = this._session.currentUser;
        const realmId = this._session.activeRealmId || "unknown";
        
        return this._engine?.getMatcherEngine()?.normalizeContext(
            user, 
            null, 
            [], 
            { 
                id: user.surrogateId || user.id, 
                level: user.level || "advanced",
                attributes: user.attributes || {}
            },
            { id: realmId }
        );
    }

    _bufferTrace(entity, trace, context, result, matches) {
        const id = entity.id || 'anonymous';
        const entry = {
            id,
            timestamp: Date.now(),
            trace,
            context: { 
                userId: context.id || context.userId, 
                persona: context.level || context.surrogate?.level, 
                realm: context.realm?.id 
            },
            result,
            matches
        };
        // Circular buffer of 100 entries
        this._traceBuffer.unshift(entry);
        if (this._traceBuffer.length > 100) this._traceBuffer.pop();

        // High-Priority Forensic Broadcast
        globalThis.dispatchEvent(new CustomEvent('plexus-perceptual-update', { detail: entry }));
    }

    stop() {
        if (this._observer) this._observer.disconnect();
    }
}
