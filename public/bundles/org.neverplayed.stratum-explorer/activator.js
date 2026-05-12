/**
 * @file Activator for org.neverplayed.stratum-explorer
 * @module platform/bundles/org.neverplayed.stratum-explorer
 */

import { 
    STRATUM_SERVICE, 
    LOG_SERVICE, 
    PERSISTENCE_MANAGER_SERVICE,
    PLEXUS_SENSOR_SERVICE
} from "../../core-types.js";
import Alpine from "https://esm.sh/alpinejs@3.13.5";

const D3_CDN = "https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm";

export default class Activator {
    _logger = console;
    _stratum = null;

    async start(context) {
        // 1. Logger Integration
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const logAdmin = context.getService(ref);
                this._logger = logAdmin.getLogger(context.getBundle().getSymbolicName());
                this._logger.info("Stratum Explorer: Connected to Logger.");
                return logAdmin;
            }
        }).open();

        // 2. Pre-Emptive Registration (ADR: Register store before async hydration)
        this._setupExplorerStore(context);
        this._setupOpticalTracker(null); // Register listener immediately

        // 3. Hydrate D3.js and Finalize Tracker
        try {
            const d3 = await import(D3_CDN).then(m => m.default || m);
            this._logger.info("Stratum Explorer: D3.js Engine Hydrated.");
            this._setupOpticalTracker(d3); 
        } catch (err) {
            this._logger.error("Stratum Explorer: D3 Hydration Failed!", err);
        }

        // 4. Track Stratum Core
        context.trackService(`(objectClass=${STRATUM_SERVICE})`, {
            addingService: (ref) => {
                this._stratum = context.getService(ref);
                return this._stratum;
            },
            removedService: () => { this._stratum = null; }
        }).open();

        // 5. Periodic/Pulse Refresh
        this._shuntListener = () => {
            const store = Alpine.store('explorer');
            if (store) store.refreshTopology();
        };
        globalThis.addEventListener('pm-context-shifted', this._shuntListener);

        // 6. Template Injection (Legacy Support)
        await this._injectTemplate();

        this._logger.info("Stratum Explorer: Operational 👁️🪐");
    }

    _setupExplorerStore(context) {
        const self = this;
        
        // Track for Alpine Inspector
        globalThis.__ALPINO_STORES__ = globalThis.__ALPINO_STORES__ || new Set();
        globalThis.__ALPINO_STORES__.add('explorer');
        
        Alpine.store('explorer', {
            nodes: [],
            links: [],
            activeNode: null,
            vaultKeys: [],
            loadingVault: false,
            _lastValueHash: "",
            
            get perspective() {
                return self._stratum?.perspective || "idealist";
            },

            set perspective(val) {
                if (self._stratum) {
                    self._stratum.perspective = val;
                    this.refreshTopology();
                }
            },

            refreshTopology: async () => {
                const stratum = self._stratum;
                if (!stratum) return;
                
                const currentHash = `${stratum.tenantId}|${stratum.realmId}|${stratum.identityId}|${stratum.tier}|${stratum.perspective}`;
                const store = Alpine.store('explorer');
                if (store._lastValueHash === currentHash && store.nodes.length > 0) return;
                
                self._logger.debug(`Stratum Explorer: Topology Shift (${stratum.perspective}) -> ${currentHash}`);
                store._lastValueHash = currentHash;

                if (stratum.perspective === 'realist') {
                    const hierarchy = await stratum.getHierarchy();
                    // Merge Forensic and Local Residents, ensuring active identity is included
                    const forensic = stratum.inhabitants || [];
                    const local = stratum.residents || [];
                    const inhabitantIdsSet = new Set([...forensic, ...local, stratum.identityId]);
                    const inhabitantIds = Array.from(inhabitantIdsSet).filter(i => i !== 'guest' || i === stratum.identityId);
                    
                    const nodes = [];
                    const links = [];

                    nodes.push({ id: 'tenant', label: 'Tenant', value: stratum.tenantId, type: 'WHO', color: '#2dd4bf' });
                    let lastRealmNodeId = 'tenant';
                    let foundActiveRealm = false;
                    
                    hierarchy.forEach((realm, idx) => {
                         const nodeId = `realm:${realm.id}`;
                         if (realm.id === stratum.realmId) foundActiveRealm = true;
                         nodes.push({ id: nodeId, label: idx === 0 ? 'Bedrock' : 'Soil', value: realm.title || realm.id, type: 'WHERE', color: '#a855f7', realmId: realm.id });
                         links.push({ source: lastRealmNodeId, target: nodeId });
                         lastRealmNodeId = nodeId;
                    });

                    if (!foundActiveRealm) {
                         const nodeId = `realm:${stratum.realmId}`;
                         nodes.push({ id: nodeId, label: 'Active Realm', value: stratum.realmId, type: 'WHERE', color: '#a855f7', realmId: stratum.realmId });
                         links.push({ source: lastRealmNodeId, target: nodeId });
                    }

                    const activeRealmNodeId = `realm:${stratum.realmId}`;
                    inhabitantIds.forEach(identId => {
                         const nodeId = `identity:${identId}`;
                         const isActive = identId === stratum.identityId;
                         // Active = Emerald (#10b981), Others = Cyan (#22d3ee)
                         nodes.push({ 
                            id: nodeId, 
                            label: isActive ? 'Active' : 'Resident', 
                            value: identId, 
                            type: 'WHO', 
                            color: isActive ? '#10b981' : '#22d3ee', 
                            identityId: identId,
                            sensing: { matchers: [{ persona: 'advanced' }] } // Identities sensed by advanced persona
                         });
                         links.push({ source: activeRealmNodeId, target: nodeId });
                    });

                    // Focal Point: Connect active identity to the HOW (Tier)
                    nodes.push({ id: 'tier', label: 'Tier', value: stratum.tier, type: 'HOW', color: stratum.tier === 'cloud' ? '#f59e0b' : '#38bdf8' });
                    links.push({ source: `identity:${stratum.identityId}`, target: 'tier' });

                    store.nodes = nodes;
                    store.links = links;
                } else {
                    const strata = [
                        { id: 'tenant', label: 'Tenant', value: stratum.tenantId, type: 'WHO', color: '#2dd4bf' },
                        { 
                            id: 'realm', 
                            label: 'Realm', 
                            value: stratum.realmId, 
                            type: 'WHERE', 
                            color: '#a855f7',
                            sensing: { matchers: [{ realm: stratum.realmId }] }
                        },
                        { 
                            id: 'identity', 
                            label: 'Identity', 
                            value: stratum.identityId, 
                            type: 'WHO', 
                            color: '#10b981',
                            sensing: { matchers: [{ persona: 'advanced' }] }
                        },
                        { id: 'tier', label: 'Tier', value: stratum.tier, type: 'HOW', color: stratum.tier === 'cloud' ? '#f59e0b' : '#38bdf8' }
                    ];
                    const connections = [ { source: 'tenant', target: 'identity' }, { source: 'identity', target: 'realm' }, { source: 'realm', target: 'tier' } ];
                    store.nodes = [ strata[0], strata[2], strata[1], strata[3] ];
                    store.links = connections;
                }
            },

            inspectVault: async (node) => {
                const store = Alpine.store('explorer');
                store.activeNode = node;
                store.loadingVault = true;
                store.vaultKeys = [];
                store.perceptualTrace = null;

                try {
                    const pmRef = context.getServiceReference(PERSISTENCE_MANAGER_SERVICE, "(implementation=selector-proxy)");
                    const pm = pmRef ? context.getService(pmRef) : null;
                    if (!pm) throw new Error("Persistence Manager not found");

                    const allKeys = await pm.listKeys("");
                    const matching = [];
                    for (const key of allKeys) {
                        const probe = await pm.probe(key);
                        let isMatch = false;
                        if (node.id === 'tier') isMatch = (probe.physicalTier === node.value);
                        else if (node.id === 'identity' || node.id.startsWith('identity:')) {
                            const targetId = node.identityId || node.value;
                            isMatch = (probe.effectiveContext.identityId === targetId);
                        }
                        else if (node.id === 'tenant') isMatch = (probe.effectiveContext.tenantId === node.value);
                        else if (node.id.startsWith('realm:')) {
                            isMatch = (probe.effectiveContext.realmId === node.realmId);
                        }
                        
                        if (isMatch) matching.push({ key, value: await pm.load(key), probe });
                    }
                    store.vaultKeys = matching;

                    // Perceptual Trace Recovery Integration (On-Demand Probe)
                    if (self._sensor) {
                        const traceInfo = self._sensor.probe(node);
                        store.perceptualTrace = traceInfo;
                        self._logger.info(`🪐 Master Cockpit: Perceptual Probe for '${node.id}':`, traceInfo);
                    }
                } catch (err) { 
                    self._logger.error("Vault Scan Failed:", err.message); 
                } finally { 
                    store.loadingVault = false; 
                }
            }
        });

        // Track Plexus Sensor for Perceptual Trace Recovery
        context.trackService(`(objectClass=${PLEXUS_SENSOR_SERVICE})`, {
            addingService: (ref) => {
                this._sensor = context.getService(ref);
                this._logger.info("🪐 Master Cockpit: Plexus Sensor Service Connected.");
                return this._sensor;
            },
            removedService: () => { this._sensor = null; }
        }).open();
    }

    _setupOpticalTracker(d3) {
        if (this._renderListener) {
            globalThis.removeEventListener('explorer-render-request', this._renderListener);
        }

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
                    if (d3) {
                        this._logger.info(`Stratum Explorer: Optical Render (${width}x${height})`);
                        this._renderGraph(d3, element, store.nodes, store.links, width, height);
                    } else {
                        this._logger.debug("Stratum Explorer: Waiting for D3 hydration...");
                    }
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
        
        const svg = d3.select(container)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", [0, 0, width, height])
            .attr("style", "max-width: 100%; height: auto;");

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(120))
            .force("charge", d3.forceManyBody().strength(-800))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("x", d3.forceX(width / 2).strength(0.1))
            .force("y", d3.forceY(height / 2).strength(0.1));

        const link = svg.append("g")
            .attr("stroke", "rgba(148, 163, 184, 0.2)")
            .attr("stroke-width", 1.5)
            .selectAll("line")
            .data(links)
            .join("line");

        const node = svg.append("g")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .attr("class", "node-group")
            .style("cursor", "pointer")
            .on("click", (_e, d) => {
                Alpine.store('explorer').inspectVault(d);
            })
            .call(d3.drag()
                .on("start", (e, d) => {
                    if (!e.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x; d.fy = d.y;
                })
                .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
                .on("end", (e, d) => {
                    if (!e.active) simulation.alphaTarget(0);
                    d.fx = null; d.fy = null;
                }));

        node.append("circle").attr("r", 20).attr("class", "hit-area").attr("fill", "transparent");
        node.append("circle").attr("r", 8).attr("class", "visual").attr("fill", d => d.color).attr("stroke", "#1e293b");

        node.append("text").attr("dy", -18).attr("text-anchor", "middle").attr("fill", "#94a3b8").style("font-size", "10px").style("font-weight", "600").style("text-transform", "uppercase").text(d => d.label);
        node.append("text").attr("dy", 24).attr("text-anchor", "middle").attr("fill", "#f8fafc").style("font-family", "monospace").style("font-size", "12px").text(d => d.value);

        simulation.on("tick", () => {
            link.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y);
            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        simulation.alpha(1).restart();
    }

    async _injectTemplate() {
        const path = `./bundles/org.neverplayed.stratum-explorer/templates/explorer.html`;
        try {
            const resp = await fetch(path);
            const html = await resp.text();
            const div = document.createElement('div');
            div.innerHTML = html;
            document.body.appendChild(div.firstElementChild);
        } catch (_e) { this._logger.error("Failed to inject Explorer template"); }
    }

    stop() {
        if (this._shuntListener) globalThis.removeEventListener('pm-context-shifted', this._shuntListener);
        if (this._renderListener) globalThis.removeEventListener('explorer-render-request', this._renderListener);
        this._logger.info("Stratum Explorer: Stopped.");
    }
}
