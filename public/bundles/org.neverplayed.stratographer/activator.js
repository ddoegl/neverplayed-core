/**
 * @file Activator for org.neverplayed.stratographer
 * @module platform/bundles/org.neverplayed.stratographer
 * v2.6.5 - Restored Explorer Store, Sensing integration, and D3 Optical Tracker.
 */

import { 
    STRATUM_SERVICE, 
    FLOW_SERVICE,
    REALM_MANAGER_SERVICE, 
    LOG_SERVICE,
    PERSISTENCE_MANAGER_SERVICE,
    PLEXUS_SENSOR_SERVICE,
    PERCEIVER_SERVICE,
    PERCEIVER_CHANGED_TOPIC,
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC,
    BUNDLE_TYPE_ADMIN,
    SESSION_SERVICE,
    STRATUM_CHANGED_TOPIC,
    BEING_SERVICE,
    REALM_COGNITION_SERVICE,
    SESSION_CHANGED_TOPIC
} from "../../core-types.js";
import _Alpine from "https://esm.sh/alpinejs@3.13.5";

const Alpine = globalThis.Alpine || _Alpine;
const D3_CDN = "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";

export default class Activator {
    _logger = console;
    _stratum = null;
    _realmManager = null;
    _perceiver = null;
    _sensor = null;
    _beingService = null;
    _cognitionServices = null;
    _renderListener = null;
    _shuntListener = null;

    start(context) {
        const self = this;

        // 1. Logger Integration
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                this._logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
                this._logger.info("Stratographer: Connected to Logger.");
                return logAdmin;
            }
        }).open();

        // 2. Track Stratum Core
        context.trackService(`(objectClass=${STRATUM_SERVICE})`, {
            addingService: (ref) => {
                this._stratum = context.getService(ref);
                return this._stratum;
            },
            removedService: () => { this._stratum = null; }
        }).open();

        // 3. Track Realm Manager
        context.trackService(`(objectClass=${REALM_MANAGER_SERVICE})`, {
            addingService: (ref) => {
                this._realmManager = context.getService(ref);
                return this._realmManager;
            },
            removedService: () => { this._realmManager = null; }
        }).open();

        // 4. Track Perceiver Service
        context.trackService(`(objectClass=${PERCEIVER_SERVICE})`, {
            addingService: (ref) => {
                this._perceiver = context.getService(ref);
                const store = Alpine.store('explorer');
                if (store) store.refreshTopology();
                return this._perceiver;
            },
            removedService: () => { this._perceiver = null; }
        }).open();

        // 5. Track Plexus Sensor
        context.trackService(`(objectClass=${PLEXUS_SENSOR_SERVICE})`, {
            addingService: (ref) => {
                this._sensor = context.getService(ref);
                return this._sensor;
            },
            removedService: () => { this._sensor = null; }
        }).open();

        // Track Being Service
        context.trackService(`(objectClass=${BEING_SERVICE})`, {
            addingService: (ref) => {
                this._beingService = context.getService(ref);
                const store = Alpine.store('explorer');
                if (store) store.refreshTopology();
                return this._beingService;
            },
            removedService: () => { 
                this._beingService = null; 
            }
        }).open();

        // Track Realm Cognition Services
        this._cognitionServices = new Map();
        context.trackService(`(objectClass=${REALM_COGNITION_SERVICE})`, {
            addingService: (ref) => {
                const service = context.getService(ref);
                const realmId = ref.getProperty("realm.id");
                if (realmId && service) {
                    this._cognitionServices.set(realmId, service);
                }
                const store = Alpine.store('explorer');
                if (store) store.refreshTopology();
                return service;
            },
            removedService: (ref) => {
                const realmId = ref.getProperty("realm.id");
                if (realmId) {
                    this._cognitionServices.delete(realmId);
                }
                const store = Alpine.store('explorer');
                if (store) store.refreshTopology();
            }
        }).open();

        // 6. Register as EventHandler for Perceiver and Stratum Changes
        this._eventRegistration = context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (event) => {
                const store = Alpine.store('explorer');
                if (store) {
                    store._grounding = self._perceiver?.getContext().observerMode || "idealist";
                    store.senses = self._perceiver?.getEnrichedSenses?.() || [];
                    store.refreshTopology();
                }
                if (typeof globalThis.dispatchEvent === 'function') {
                    globalThis.dispatchEvent(new CustomEvent('stratum-changed'));
                }
            }
        }, {
            [EVENT_TOPIC]: [PERCEIVER_CHANGED_TOPIC, STRATUM_CHANGED_TOPIC, SESSION_CHANGED_TOPIC]
        });

        // 8. Register Reactive Store
        this._setupExplorerStore(context);
        this._setupOpticalTracker(null);

        // 9. Hydrate D3.js
        (async () => {
            try {
                const d3 = await import(D3_CDN).then(m => m.default || m);
                this._logger.info("Stratographer: D3.js Engine Hydrated.");
                this._setupOpticalTracker(d3); 
            } catch (err) {
                this._logger.error("Stratographer: D3 Hydration Failed!", err);
            }
        })();

        // 10. Register Alpine HUD Component
        this._setupAlpineHUD();

        // 11. Register Flow Service
        context.registerService(FLOW_SERVICE, this, {
            "flow.id": "org.neverplayed.stratographer",
            "flow.title": "Stratographer",
            "flow.icon": "fas fa-map-marked-alt",
            "flowType": BUNDLE_TYPE_ADMIN,
            "sidebar": true,
            "capability": "sys:forensics"
        });

        // 12. Inject Minimal HUD template
        this._injectHUD();

        this._logger.info("Stratographer: Registered 🪐🛡️🔍");
    }

    _setupExplorerStore(context) {
        const self = this;
        Alpine.store('explorer', {
            nodes: [],
            links: [],
            activeNode: null,
            vaultKeys: [],
            loadingVault: false,
            perceptualTrace: null,
            activeNodeTraceMakers: [],
            realmCognition: null,
            _lastValueHash: "",
            visible: false,
            _grounding: self._perceiver?.getContext().observerMode || "idealist",
            senses: self._perceiver?.getEnrichedSenses?.() || [],
            
            get grounding() {
                return this._grounding;
            },

            set grounding(val) {
                this._grounding = val;
                const sessionRef = context.getServiceReference(SESSION_SERVICE);
                if (sessionRef) {
                    const session = context.getService(sessionRef);
                    if (typeof session.shiftGrounding === 'function') {
                        session.shiftGrounding(val);
                        self._logger?.info(`Stratographer: Triggered grounding shift to ${val}`);
                    }
                }
            },

            refreshTopology: async () => {
                const stratum = self._stratum;
                const perceiver = self._perceiver?.getContext();
                if (!stratum || !perceiver) return;
                
                const beingId = perceiver.being?.id || 'guest';
                const realmId = (typeof perceiver.realm === 'object' && perceiver.realm !== null) ? perceiver.realm.id : perceiver.realm;
                
                const occupants = stratum.occupants || stratum.residents || [];
                const traceMakers = (typeof stratum.getTraceMakers === 'function') ? await stratum.getTraceMakers() : [];
                
                const currentHash = `${stratum.tenantId}|${realmId}|${beingId}|${stratum.tier}|${perceiver.observerMode}|${JSON.stringify(perceiver.surrogate)}|${occupants.join(',')}|${traceMakers.join(',')}`;
                
                const store = Alpine.store('explorer');
                if (store._lastValueHash === currentHash && store.nodes.length > 0) return;
                
                self._logger.debug(`Stratographer: Topology Shift (${perceiver.observerMode}) -> ${currentHash}`);
                store._lastValueHash = currentHash;

                if (perceiver.observerMode === 'realist') {
                    const hierarchy = await stratum.getHierarchy();
                    const knownBeings = self._beingService ? self._beingService.getKnownBeings() : [];
                    
                    const beingsToRender = new Map();
                    
                    knownBeings.forEach(being => {
                        const home = self._beingService.getBeingHome(being.id);
                        const isHome = home === realmId;
                        
                        const isOccupant = occupants.includes(being.id);
                        const isTraceMaker = traceMakers.includes(being.id);
                        const isActiveObserver = being.id === beingId;
                        
                        if (isActiveObserver) {
                            const hasTraces = traceMakers.includes(being.id);
                            beingsToRender.set(being.id, {
                                state: 'observer',
                                color: '#10b981',
                                label: hasTraces ? 'Observer (with traces)' : 'Observer',
                                opacity: 1.0,
                                strokeStyle: 'solid',
                                borderType: hasTraces ? 'double-trace' : 'double',
                                value: being.id
                            });
                        } else if (isOccupant) {
                            if (isHome) {
                                beingsToRender.set(being.id, {
                                    state: 'resident',
                                    color: '#a855f7',
                                    label: 'Resident',
                                    opacity: 1.0,
                                    strokeStyle: 'solid',
                                    borderType: 'thick',
                                    value: being.id
                                });
                            } else {
                                beingsToRender.set(being.id, {
                                    state: 'visitor',
                                    color: '#22d3ee',
                                    label: 'Visitor',
                                    opacity: 1.0,
                                    strokeStyle: 'solid',
                                    borderType: 'standard',
                                    value: being.id
                                });
                            }
                        } else if (isTraceMaker) {
                            beingsToRender.set(being.id, {
                                state: 'trace-maker',
                                color: '#f59e0b',
                                label: 'Trace-Maker',
                                opacity: 0.6,
                                strokeStyle: 'dashed',
                                borderType: 'standard',
                                value: being.id
                            });
                        } else if (isHome) {
                            beingsToRender.set(being.id, {
                                state: 'offline-resident',
                                color: '#64748b',
                                label: 'Offline Resident',
                                opacity: 1.0,
                                strokeStyle: 'dotted',
                                borderType: 'standard',
                                value: being.id
                            });
                        }
                    });

                    // Dynamic/test occupants
                    occupants.forEach(id => {
                        if (!beingsToRender.has(id)) {
                            const isActiveObserver = id === beingId;
                            if (isActiveObserver) {
                                const hasTraces = traceMakers.includes(id);
                                beingsToRender.set(id, {
                                    state: 'observer',
                                    color: '#10b981',
                                    label: hasTraces ? 'Observer (with traces)' : 'Observer',
                                    opacity: 1.0,
                                    strokeStyle: 'solid',
                                    borderType: hasTraces ? 'double-trace' : 'double',
                                    value: id
                                });
                            } else {
                                beingsToRender.set(id, {
                                    state: 'visitor',
                                    color: '#22d3ee',
                                    label: 'Visitor',
                                    opacity: 1.0,
                                    strokeStyle: 'solid',
                                    borderType: 'standard',
                                    value: id
                                });
                            }
                        }
                    });

                    // Dynamic/test trace-makers
                    traceMakers.forEach(id => {
                        if (!beingsToRender.has(id)) {
                            beingsToRender.set(id, {
                                state: 'trace-maker',
                                color: '#f59e0b',
                                label: 'Trace-Maker',
                                opacity: 0.6,
                                strokeStyle: 'dashed',
                                borderType: 'standard',
                                value: id
                            });
                        }
                    });

                    // Active observer fallback
                    if (!beingsToRender.has(beingId) && beingId !== 'guest') {
                        const hasTraces = traceMakers.includes(beingId);
                        beingsToRender.set(beingId, {
                            state: 'observer',
                            color: '#10b981',
                            label: hasTraces ? 'Observer (with traces)' : 'Observer',
                            opacity: 1.0,
                            strokeStyle: 'solid',
                            borderType: hasTraces ? 'double-trace' : 'double',
                            value: beingId
                        });
                    }

                    const nodes = [];
                    const links = [];

                    nodes.push({ id: 'tenant', label: 'Tenant', value: stratum.tenantId, type: 'WHO', color: '#2dd4bf' });
                    let lastRealmNodeId = 'tenant';
                    let foundActiveRealm = false;
                    
                    hierarchy.forEach((realm, idx) => {
                         const nodeId = `realm:${realm.id}`;
                         if (realm.id === realmId) foundActiveRealm = true;
                         nodes.push({ id: nodeId, label: idx === 0 ? 'Bedrock' : 'Soil', value: realm.title || realm.id, type: 'WHERE', color: '#a855f7', realmId: realm.id });
                         links.push({ source: lastRealmNodeId, target: nodeId });
                         lastRealmNodeId = nodeId;
                    });

                    if (!foundActiveRealm) {
                         const nodeId = `realm:${realmId}`;
                         nodes.push({ id: nodeId, label: 'Active Realm', value: realmId, type: 'WHERE', color: '#a855f7', realmId: realmId });
                         links.push({ source: lastRealmNodeId, target: nodeId });
                    }

                    const activeRealmNodeId = `realm:${realmId}`;
                    beingsToRender.forEach((props, identId) => {
                         const nodeId = `identity:${identId}`;
                         nodes.push({ 
                            id: nodeId, 
                            label: props.label, 
                            value: props.value, 
                            type: 'WHO', 
                            color: props.color, 
                            identityId: identId,
                            ontologicalState: props.state,
                            opacity: props.opacity,
                            strokeStyle: props.strokeStyle,
                            borderType: props.borderType
                         });
                         links.push({ source: activeRealmNodeId, target: nodeId });
                    });

                    nodes.push({ id: 'tier', label: 'Tier', value: stratum.tier, type: 'HOW', color: stratum.tier === 'cloud' ? '#f59e0b' : '#38bdf8' });
                    links.push({ source: `identity:${beingId}`, target: 'tier' });

                    store.nodes = nodes;
                    store.links = links;
                } else {
                    const hasTraces = traceMakers.includes(beingId);
                    const strata = [
                        { id: 'tenant', label: 'Tenant', value: stratum.tenantId, type: 'WHO', color: '#2dd4bf' },
                        { id: 'realm', label: 'Realm', value: realmId, type: 'WHERE', color: '#a855f7', realmId: realmId },
                        { 
                            id: 'identity', 
                            label: hasTraces ? 'Observer (with traces)' : 'Observer', 
                            value: beingId, 
                            type: 'WHO', 
                            color: '#10b981', 
                            identityId: beingId, 
                            ontologicalState: 'observer',
                            opacity: 1.0,
                            strokeStyle: 'solid',
                            borderType: hasTraces ? 'double-trace' : 'double'
                        },
                        { id: 'tier', label: 'Tier', value: stratum.tier, type: 'HOW', color: stratum.tier === 'cloud' ? '#f59e0b' : '#38bdf8' }
                    ];
                    const connections = [ { source: 'tenant', target: 'identity' }, { source: 'identity', target: 'realm' }, { source: 'realm', target: 'tier' } ];
                    store.nodes = [ strata[0], strata[2], strata[1], strata[3] ];
                    store.links = connections;
                }

                // Resolve predictionError for all nodes representing a realm
                store.nodes.forEach(node => {
                    if (node.id === 'realm' || node.id.startsWith('realm:')) {
                        const rId = node.realmId || node.value;
                        const service = self._cognitionServices?.get(rId);
                        node.predictionError = service ? service.getPredictionError() : 0.0;
                    } else {
                        node.predictionError = 0.0;
                    }
                });
            },

            inspectVault: async (node) => {
                const store = Alpine.store('explorer');
                store.activeNode = node;
                store.loadingVault = true;
                store.vaultKeys = [];
                store.perceptualTrace = null;
                store.activeNodeTraceMakers = [];

                if (node.id === 'realm' || node.id.startsWith('realm:')) {
                    const rId = node.realmId || node.value;
                    const service = self._cognitionServices?.get(rId);
                    store.realmCognition = {
                        predictionError: service ? service.getPredictionError() : 0.0,
                        activeSurrogate: 'sovereign-guard',
                        lightCone: 'Session (Lazy Horizon) / Spatial Bedrock'
                    };
                    const reified = [];
                    if (globalThis.document) {
                        const elements = globalThis.document.querySelectorAll("#core-realm-reifications [data-mark]");
                        elements.forEach(el => {
                            const pid = el.id.replace("reified-", "");
                            const isSensible = el.style.display !== "none";
                            reified.push({ pid, isSensible });
                        });
                    }
                    store.reifiedComponents = reified;
                } else {
                    store.realmCognition = null;
                    store.reifiedComponents = [];
                }

                if (node.id.startsWith('realm:')) {
                    const currentRealmId = self._stratum?.realmId;
                    if (node.realmId === currentRealmId) {
                        if (self._stratum && typeof self._stratum.getTraceMakers === 'function') {
                            try {
                                store.activeNodeTraceMakers = await self._stratum.getTraceMakers();
                            } catch (e) {
                                self._logger.error("Failed to fetch active node trace makers", e);
                            }
                        }
                    }
                }

                try {
                    const pmRef = context.getServiceReference(PERSISTENCE_MANAGER_SERVICE, "(implementation=selector-proxy)");
                    const pm = pmRef ? context.getService(pmRef) : null;
                    if (!pm) throw new Error("Persistence Manager not found");

                    const allKeys = await pm.listKeys("");
                    const matching = [];
                    for (const key of allKeys) {
                        const probe = await pm.probe(key);
                        if (!probe) continue;

                        let isMatch = false;
                        if (node.id === 'tier') isMatch = (probe.physicalTier === node.value);
                        else if (node.id === 'identity' || node.id.startsWith('identity:')) {
                            const targetId = node.identityId || node.value;
                            isMatch = (probe.effectiveContext?.identityId === targetId);
                        }
                        else if (node.id === 'tenant') isMatch = (probe.effectiveContext?.tenantId === node.value);
                        else if (node.id.startsWith('realm:')) {
                            isMatch = (probe.effectiveContext?.realmId === node.realmId);
                        }
                        
                        if (isMatch) matching.push({ key, value: await pm.load(key), probe });
                    }
                    store.vaultKeys = matching;

                    if (self._sensor) {
                        // Synthesize the mark for this node type so the sensor can evaluate it.
                        // For identity/resident nodes, we look at the vault keys to find stigmergic marks
                        // (e.g. identity.personhood:* traces) and collect their matchers.
                        let synthMark = null;
                        if (node.id === 'identity' || node.id.startsWith('identity:')) {
                            // Collect all distinct matchers from the matching vault keys
                            const matchers = [];
                            for (const { probe } of matching) {
                                if (probe.physicalTier) {
                                    // Find the logical key's derived mark from the PM
                                    // Prefer stigmergic $stigmergy metadata from the value
                                }
                            }
                            // Probe the personhood trace key directly for this identity
                            const targetId = node.identityId || node.value;
                            const personhoodKey = `identity.personhood:${targetId}`;
                            const pTrace = await pm.probe(personhoodKey);
                            if (pTrace) {
                                // Load the value to extract the stigmergy matcher
                                const pVal = await pm.load(personhoodKey);
                                if (pVal?.$stigmergy?.matcher) {
                                    matchers.push({ type: 'matchSense', value: pVal.$stigmergy.matcher });
                                } else {
                                    // Fallback: use the standard SensePersonhood mark
                                    matchers.push({ type: 'matchSense', value: 'SensePersonhood' });
                                }
                                synthMark = { matchers };
                            }
                        }

                        if (synthMark) {
                            // sense() with the synthesized mark descriptor so recoverTrace captures it
                            self._sensor.sense({ id: node.id, label: node.label, mark: synthMark });
                        } else {
                            self._sensor.sense({ id: node.id, label: node.label });
                        }
                        const traceInfo = self._sensor.recoverTrace(node.id);
                        store.perceptualTrace = traceInfo;
                    }
                } catch (err) { 
                    self._logger.error("Vault Scan Failed:", err.message); 
                } finally { 
                    store.loadingVault = false; 
                }
            }
        });
    }

    _setupOpticalTracker(d3) {
        if (this._renderListener) globalThis.removeEventListener('explorer-render-request', this._renderListener);
        this._renderListener = (e) => {
            const { element } = e.detail;
            const store = Alpine.store('explorer');
            if (!store) return;
            const render = (w, h) => {
                const width = w || Math.floor(element.clientWidth);
                const height = h || Math.floor(element.clientHeight);
                if (width > 0 && height > 0) {
                    const stateHash = `${store._lastValueHash}|${width}x${height}`;
                    if (element._lastRenderHash === stateHash) return;
                    element._lastRenderHash = stateHash;
                    if (d3) this._renderGraph(d3, element, store.nodes, store.links, width, height);
                }
            };
            if (!element._stratObs) {
                element._stratObs = new ResizeObserver(entries => {
                    const entry = entries[0];
                    render(Math.floor(entry.contentRect.width), Math.floor(entry.contentRect.height));
                });
                element._stratObs.observe(element);
            }
            render();
        };
        globalThis.addEventListener('explorer-render-request', this._renderListener);
    }

    _renderGraph(d3, container, nodes, links, width, height) {
        d3.select(container).selectAll("svg").remove();
        const svg = d3.select(container).append("svg").attr("width", "100%").attr("height", "100%").attr("viewBox", [0, 0, width, height]).attr("style", "max-width: 100%; height: auto;");
        const simulation = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id(d => d.id).distance(120)).force("charge", d3.forceManyBody().strength(-800)).force("center", d3.forceCenter(width / 2, height / 2));
        const link = svg.append("g").attr("stroke", "rgba(148, 163, 184, 0.2)").attr("stroke-width", 1.5).selectAll("line").data(links).join("line");
        const node = svg.append("g")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .attr("class", "node-group")
            .style("cursor", "pointer")
            .style("opacity", d => d.opacity !== undefined ? d.opacity : 1)
            .on("click", (_e, d) => { Alpine.store('explorer').inspectVault(d); })
            .call(d3.drag()
                .on("start", (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
                .on("end", (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
            );

        // Double border outer ring for observer state
        node.filter(d => d.borderType === 'double' || d.borderType === 'double-trace')
            .append("circle")
            .attr("r", 12)
            .attr("fill", "none")
            .attr("stroke", d => d.borderType === 'double-trace' ? '#f59e0b' : d.color)
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", d => d.borderType === 'double-trace' ? '3,3' : null);

        // Pulse ring for realm prediction error or cognition state
        const realmNode = node.filter(d => d.id === 'realm' || d.id.startsWith('realm:'));
        const pulseCircle = realmNode.append("circle")
            .attr("r", 16)
            .attr("fill", "none")
            .attr("stroke", "#a855f7")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", d => d.predictionError > 0 ? "4,4" : null)
            .attr("class", "cognition-ring");

        pulseCircle.append("animate")
            .attr("attributeName", "r")
            .attr("values", "14;18;14")
            .attr("dur", "2s")
            .attr("repeatCount", "indefinite");
        
        pulseCircle.append("animate")
            .attr("attributeName", "stroke-opacity")
            .attr("values", "1;0.4;1")
            .attr("dur", "2s")
            .attr("repeatCount", "indefinite");

        node.append("circle")
            .attr("r", 8)
            .attr("class", "visual")
            .attr("fill", d => d.color)
            .attr("stroke", d => {
                if (d.borderType === 'thick') return "#f8fafc";
                return "#1e293b";
            })
            .attr("stroke-width", d => {
                if (d.borderType === 'thick') return 2.5;
                return 1.5;
            })
            .attr("stroke-dasharray", d => {
                if (d.strokeStyle === 'dashed') return "3,3";
                if (d.strokeStyle === 'dotted') return "1,3";
                return null;
            });

        node.append("text").attr("dy", -18).attr("text-anchor", "middle").attr("fill", "#94a3b8").style("font-size", "10px").style("font-weight", "600").style("text-transform", "uppercase").text(d => d.label);
        node.append("text").attr("dy", 24).attr("text-anchor", "middle").attr("fill", "#f8fafc").style("font-family", "monospace").style("font-size", "12px").text(d => d.value);
        simulation.on("tick", () => {
            link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });
    }

    /**
     * Protocol: launch (Flow Service Handshake)
     */
    async launch(options = {}) {
        this._logger.info("Stratographer Dashboard: Launching...");
        const self = this;

        // Ensure topology is fresh before rendering
        const explorerStore = Alpine.store('explorer');
        if (explorerStore) {
            await explorerStore.refreshTopology();
        }

        const templatePath = `./bundles/org.neverplayed.stratographer/templates/dashboard.html`;
        
        try {
            const resp = await fetch(templatePath);
            const html = await resp.text();
            
            const stage = document.querySelector("#flow-active-stage");
            if (!stage) throw new Error("Stage #flow-active-stage not found.");
            
            stage.innerHTML = html;
            
            Alpine.data("stratographerDashboard", () => ({
                jumpTarget: self._stratum?.toURI() || "",
                identityId: self._stratum?.identityId || "unknown",
                realmId: self._stratum?.realmId || "unknown",
                tenantId: self._stratum?.tenantId || "unknown",
                tier: self._stratum?.tier || "local",
                realms: [],
                inhabitants: [],
                activeRealm: { id: self._stratum?.realmId || "unknown" },

                async init() {
                    if (self._realmManager) {
                        this.realms = await self._realmManager.getRealms();
                        this.activeRealm = this.realms.find(r => r.id === this.realmId) || { id: this.realmId };
                    }
                    this._syncInhabitants();
                    
                    const syncUI = () => {
                        this.identityId = self._stratum?.identityId;
                        this.realmId = self._stratum?.realmId;
                        this.tenantId = self._stratum?.tenantId;
                        this.tier = self._stratum?.tier;
                        this.jumpTarget = self._stratum?.toURI();
                        this.activeRealm = this.realms.find(r => r.id === this.realmId) || { id: this.realmId };
                        this._syncInhabitants();
                    };

                    self._dashboardSyncUI = syncUI;
                    globalThis.addEventListener('stratum-changed', self._dashboardSyncUI);

                    this.$watch('$store.explorer.grounding', () => {
                        this.jumpTarget = self._stratum?.toURI();
                    });

                    this.$nextTick(() => {
                        const store = Alpine.store('explorer');
                        if (store && typeof store.refreshTopology === 'function') {
                            store.refreshTopology();
                        }
                        const container = stage.querySelector('[x-ref="graphContainer"]');
                        if (container) {
                            globalThis.dispatchEvent(new CustomEvent('explorer-render-request', { 
                                detail: { element: container } 
                            }));
                        }
                    });
                },

                async _syncInhabitants() {
                    if (!self._stratum) return;
                    const forensic = await self._stratum.getInhabitants();
                    const local = self._stratum.occupants || self._stratum.residents || [];
                    this.inhabitants = Array.from(new Set([...forensic, ...local])).filter(i => i !== 'guest');
                },

                copyURI() {
                    const uri = self._stratum?.toURI();
                    if (uri) {
                        navigator.clipboard.writeText(uri);
                        self._logger.info(`Stratum URI copied: ${uri}`);
                    }
                },

                async jump() {
                    if (!this.jumpTarget) return;
                    self._logger.info(`Stratographer Jump requested: ${this.jumpTarget}`);
                    
                    try {
                        await self._stratum.jump(this.jumpTarget);
                        self._logger.info("Stratographer Jump: Institutional protocol executed successfully.");
                        
                        const store = Alpine.store('explorer');
                        if (store) await store.refreshTopology();
                    } catch (err) {
                        self._logger.warn(`Stratographer Jump Failed: ${err.message}`);
                        alert(`Jump Failed: ${err.message}`);
                    }
                },

                async switchTo(id) {
                    if (self._realmManager) {
                        try {
                            await self._realmManager.switchRealm(id);
                            const store = Alpine.store('explorer');
                            if (store) await store.refreshTopology();
                        } catch (err) {
                            self._logger.warn(`Stratographer Realm Switch Failed: ${err.message}`);
                            alert(`Switch Failed: ${err.message}`);
                        }
                    }
                }
            }));

            const dashboardEl = stage.querySelector("#stratographer-dashboard");
            if (dashboardEl) {
                dashboardEl.setAttribute("x-data", "stratographerDashboard");
            }
            
        } catch (err) {
            this._logger.error("Stratographer Launch Failed:", err);
        }
    }

    _setupAlpineHUD() {
        const self = this;
        Alpine.data("stratographerHUD", () => ({
            get identityId() { return self._stratum?.identityId || "guest"; },
            get tier() { return self._stratum?.tier || "local"; },

            copyURI() {
                const uri = self._stratum?.toURI();
                if (uri) navigator.clipboard.writeText(uri);
            },

            openDashboard() {
                self._logger?.info("Igniting Stratographer Flow...");
                globalThis.dispatchEvent(new CustomEvent("shell-launch-flow", { detail: { id: "org.neverplayed.stratographer" } }));
            }
        }));
    }

    async _injectHUD() {
        const templatePath = `./bundles/org.neverplayed.stratographer/templates/stratum-hud.html`;
        try {
            const resp = await fetch(templatePath);
            const _html = await resp.text();
            const div = document.createElement('div');
            div.innerHTML = _html;
            document.body.appendChild(div.firstElementChild);
        } catch (err) {
            this._logger.error("Failed to inject Stratographer HUD", err);
        }
    }

    stop() {
        if (this._eventRegistration) {
            try { this._eventRegistration.unregister(); } catch(e) {}
        }
        if (this._dashboardSyncUI) {
            globalThis.removeEventListener('stratum-changed', this._dashboardSyncUI);
        }
        if (this._renderListener) globalThis.removeEventListener('explorer-render-request', this._renderListener);
        this._logger.info("Stratographer: Stopped.");
    }
}
