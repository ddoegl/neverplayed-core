/**
 * @file Activator for org.neverplayed.event-monitor
 * @module platform/bundles/org.neverplayed.event-monitor
 */

import { FLOW_SERVICE, EVENT_HANDLER_INTERFACE, EVENT_TOPIC, EVENT_MONITOR_PID, LOG_LEVEL_PROP } from "core-types";
import { AlpineActivator } from "alpine-base";

export default class Activator extends AlpineActivator {
    onStart(context) {
        const verbosity = this.config[LOG_LEVEL_PROP] || "INFO";
        
        // 1. Setup reactive history store
        const state = this.initStore('event_monitor', { history: [] });

        // 2. Register Event Handler
        context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (event) => {
                const topic = event.getTopic();
                const data = event.getProperty('data') || {};
                if (!event.getProperty('data')) {
                    event.getPropertyNames().forEach(k => data[k] = event.getProperty(k));
                }
                
                const safeJson = (obj) => {
                    const cache = new Set();
                    return JSON.stringify(obj, (_k, v) => {
                        if (typeof v === 'object' && v !== null) {
                            if (cache.has(v)) return '[Circular]';
                            cache.add(v);
                        }
                        return v;
                    }, 2);
                };
                
                const logMsg = `[${new Date().toLocaleTimeString()}] Topic: ${topic} | Data: ${safeJson(data)}`;
                state.history.unshift(logMsg);
                if (state.history.length > 100) state.history.pop();

                if (verbosity === "DEBUG") this.logger.debug(logMsg);
                else this.logger.info(logMsg);
            }
        }, { [EVENT_TOPIC]: ["backoffice/invitations/*", "backoffice/cases/*", "org/neverplayed/config/*", "org/neverplayed/realm/*", "org/neverplayed/session/*", "org/neverplayed/perceiver/*", "org/neverplayed/world/*"] });

        // 3. Register Flow UI
        const getFlowProps = () => ({
            ...this.config, 
            "flow.id": EVENT_MONITOR_PID, 
            "sidebar": this.config.sidebar !== undefined ? this.config.sidebar : true,
            "icon": this.config.icon || "fas fa-satellite",
            "title": this.config.title || "Event Monitor"
        });

        const registration = context.registerService(FLOW_SERVICE, {
            id: EVENT_MONITOR_PID,
            title: this.config.title || "Event Monitor",
            icon: this.config.icon || "fas fa-satellite",
            launch: async (target) => {
                if (!target.id) target.id = `flow-target-${EVENT_MONITOR_PID.replace(/\./g, '_')}`;
                await this.render(`#${target.id}`, 'templates/monitor.html', () => ({
                    get logs() { return state.history; },
                    verbosity
                }));
            }
        }, getFlowProps());

        globalThis.addEventListener('config-updated', (ev) => {
            if (ev.detail?.pid === this.bsn || ev.detail?.pid === EVENT_MONITOR_PID) {
                registration.setProperties(getFlowProps());
            }
        });
    }
}
