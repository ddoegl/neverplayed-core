/**
 * @file Activator for org.neverplayed.stratum-explorer
 * @module platform/bundles/org.neverplayed.stratum-explorer
 */

import { 
    STRATUM_SERVICE, 
    LOG_SERVICE, 
    PERSISTENCE_MANAGER_SERVICE 
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

        // 2. Load D3.js Optical Engine
        const d3 = await import(D3_CDN);
        this._logger.info("Stratum Explorer: D3.js Engine Hydrated.");

        // 3. Track Stratum Core
        context.trackService(`(objectClass=${STRATUM_SERVICE})`, {
            addingService: (ref) => {
                this._stratum = context.getService(ref);
                return this._stratum;
            },
            removedService: () => { this._stratum = null; }
        }).open();

        // 4. Initialize Explorer ViewModel
        Alpine.store('explorer', {
            nodes: [],
            links: [],
            activeNode: null,
            vaultKeys: [],
            visible: false,
            loadingVault: false,
            _lastValueHash: "",

            refreshTopology: () => {
                const stratum = this._stratum;
                if (!stratum) return;
                
                // Value-Based Guard: Only update if the multidimensional state shifted
                const currentHash = `${stratum.tenantId}|${stratum.identityId}|${stratum.realmId}|${stratum.tier}`;
                const store = Alpine.store('explorer');
                if (store._lastValueHash === currentHash && store.nodes.length > 0) {
                    this._logger.debug("Stratum Explorer: Ignoring static state pulse.");
                    return;
                }
                
                this._logger.info(`Stratum Explorer: Topology Shift -> ${currentHash}`);
                store._lastValueHash = currentHash;

                const strata = [
                    { id: 'tenant', label: 'Tenant', value: stratum.tenantId, type: 'WHO', color: '#2dd4bf' },
                    { id: 'identity', label: 'Identity', value: stratum.identityId, type: 'WHO', color: '#10b981' },
                    { id: 'realm', label: 'Realm', value: stratum.realmId, type: 'WHERE', color: '#a855f7' },
                    { id: 'tier', label: 'Tier', value: stratum.tier, type: 'HOW', color: stratum.tier === 'cloud' ? '#f59e0b' : '#38bdf8' }
                ];

                const connections = [
                    { source: 'tenant', target: 'identity' },
                    { source: 'identity', target: 'realm' },
                    { source: 'realm', target: 'tier' }
                ];

                store.nodes = strata;
                store.links = connections;
            },

            inspectVault: async (node) => {
                const store = Alpine.store('explorer');
                store.activeNode = node;
                store.loadingVault = true;
                store.vaultKeys = [];
                
                try {
                    const pmRef = context.getServiceReference(PERSISTENCE_MANAGER_SERVICE, "(implementation=selector-proxy)");
                    const pm = pmRef ? context.getService(pmRef) : null;
                    if (!pm) throw new Error("Persistence Manager not found");

                    const allKeys = await pm.listKeys("");
                    const matching = [];
                    
                    for (const key of allKeys) {
                        const probe = await pm.probe(key);
                        let isMatch = false;
                        
                        if (node.id === 'tier') isMatch = (probe.tier === node.value);
                        if (node.id === 'identity') isMatch = (probe.context.identityId === node.value);
                        if (node.id === 'tenant') isMatch = (probe.context.tenantId === node.value);
                        
                        if (isMatch || node.id === 'realm') { // Realm is ambient
                            const val = await pm.load(key);
                            matching.push({ key, value: val, probe });
                        }
                    }
                    store.vaultKeys = matching;
                } catch (err) {
                    this._logger.error("Vault Inspection failed:", err);
                } finally {
                    store.loadingVault = false;
                }
            }
        });

        // 5. D3 Optical Tracking Logic
        this._setupOpticalTracker(d3);

        // 6. Template Injection
        await this._injectTemplate();

        // 7. Periodic/Pulse Refresh
        this._shuntListener = () => {
            if (Alpine.store('explorer').visible) Alpine.store('explorer').refreshTopology();
        };
        globalThis.addEventListener('pm-context-shifted', this._shuntListener);

        this._logger.info("Stratum Explorer: Registered 🪐🛡️🔍");
    }

    _setupOpticalTracker(d3) {
        this._renderListener = (e) => {
            const { element } = e.detail;
            const store = Alpine.store('explorer');
            this._renderGraph(d3, element, store.nodes, store.links);
        };
        globalThis.addEventListener('explorer-render-request', this._renderListener);
    }

    _renderGraph(d3, container, nodes, links) {
        d3.select(container).selectAll("svg").remove();
        
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        const svg = d3.select(container)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", [0, 0, width, height])
            .attr("style", "max-width: 100%; height: auto;");

        // Force Simulation with higher initial alpha
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

        node.append("circle")
            .attr("r", 20)
            .attr("class", "hit-area");

        node.append("circle")
            .attr("r", 8)
            .attr("class", "visual")
            .attr("fill", d => d.color)
            .attr("stroke", "#1e293b");

        node.append("text")
            .attr("dy", -18)
            .attr("text-anchor", "middle")
            .attr("class", "node-label")
            .attr("fill", "#94a3b8")
            .style("font-size", "10px")
            .style("font-weight", "600")
            .style("text-transform", "uppercase")
            .text(d => d.label);

        node.append("text")
            .attr("dy", 24)
            .attr("text-anchor", "middle")
            .attr("class", "node-value")
            .attr("fill", "#f8fafc")
            .style("font-family", "monospace")
            .style("font-size", "12px")
            .text(d => d.value);

        simulation.on("tick", () => {
            link.attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        // Ensure simulation starts running
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
        if (this._shuntListener) {
            globalThis.removeEventListener('pm-context-shifted', this._shuntListener);
        }
        if (this._renderListener) {
            globalThis.removeEventListener('explorer-render-request', this._renderListener);
        }
        this._logger.info("Stratum Explorer: Stopped.");
    }
}
