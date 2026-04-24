import { Window } from "npm:happy-dom";

/**
 * Institutional TDD Globals Utility
 * 
 * Centralizes HappyDOM setup, specialized Fetch polyfills, 
 * and Headless Identity provisioning for the Never Played test ecosystem.
 */

export function setupGlobalEnvironment() {
    const window = new Window();
    const document = window.document;

    // deno-lint-ignore no-explicit-any
    const g = globalThis as any;
    const originalFetch = g.fetch;
    const originalAddEventListener = g.addEventListener;
    const originalRemoveEventListener = g.removeEventListener;
    const originalDispatchEvent = g.dispatchEvent;

    Object.assign(g, {
        window,
        document,
        location: { href: "http://localhost/", hostname: "localhost" },
        Node: window.Node,
        Element: window.Element,
        HTMLElement: window.HTMLElement,
        HTMLSpanElement: window.HTMLSpanElement,
        HTMLButtonElement: window.HTMLButtonElement,
        MutationObserver: window.MutationObserver,
        CustomEvent: window.CustomEvent,
        ShadowRoot: window.ShadowRoot,
        DocumentFragment: window.DocumentFragment,
        NodeList: window.NodeList,
        HTMLCollection: window.HTMLCollection,
        requestAnimationFrame: window.requestAnimationFrame.bind(window),
        cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
        navigator: window.navigator,
        self: window,
        customElements: window.customElements,
        localStorage: window.localStorage,
        // deno-lint-ignore no-explicit-any
        CSSStyleSheet: (window as any).CSSStyleSheet,

        // Cross-platform Event Handling
        addEventListener: (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
            try { 
                // deno-lint-ignore no-explicit-any
                (window.addEventListener as any)(type, listener, options); 
            } catch (_e) { /* ignore */ }
            return originalAddEventListener?.call(g, type, listener, options);
        },
        removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
            try { 
                // deno-lint-ignore no-explicit-any
                (window.removeEventListener as any)(type, listener, options); 
            } catch (_e) { /* ignore */ }
            return originalRemoveEventListener?.call(g, type, listener, options);
        },
        dispatchEvent: (event: Event) => {
            try {
                // deno-lint-ignore no-explicit-any
                const result = window.dispatchEvent(event as any);
                if (result) return result;
            } catch (_e) { /* fallback to Deno */ }
            return originalDispatchEvent?.call(g, event);
        },

        // Sovereign Fetch Polyfill: Handles local filesystem and internal localhost routing
        fetch: async (input: string | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : input.toString();
            
            if (url.startsWith('http') && !url.startsWith('http://localhost/')) {
                return originalFetch(input, init);
            }

            let path = url;
            if (path.startsWith('http://localhost/')) {
                path = path.slice('http://localhost/'.length);
            }
            path = path.startsWith('./') ? path.slice(2) : path;
            if (path.startsWith('/')) path = path.slice(1);

            const candidates = [
                Deno.cwd() + "/public/" + path,
                Deno.cwd() + "/public/bundles/" + path,
                Deno.cwd() + "/public/domain-objects/" + path,
                Deno.cwd() + "/" + path,
            ];

            for (const fullPath of candidates) {
                try {
                    const content = await Deno.readFile(fullPath);
                    let contentType = 'text/plain';
                    if (url.endsWith('.json')) contentType = 'application/json';
                    else if (url.endsWith('.yaml') || url.endsWith('.yml')) contentType = 'text/yaml';
                    else if (url.endsWith('.js')) contentType = 'application/javascript';
                    else if (url.endsWith('.html')) contentType = 'text/html';
                    
                    return new Response(content, { 
                        status: 200, 
                        headers: { 'content-type': contentType } 
                    });
                } catch (_e) { /* check next candidate */ }
            }
            return new Response("Not Found", { status: 404 });
        }
    });

    console.log("Harness: Global Browser Environment Setup 🐚✅");
}

/**
 * Provision a headless identity user for Auth Shield bypass.
 */
export function setupHeadlessUser(user: { email: string; uid?: string; isSuperuser?: boolean; primary?: boolean; attributes?: Record<string, unknown> }) {
    const userData = {
        ...user,
        uid: user.uid || "test-harness-uid-" + Math.random().toString(36).substring(7),
        attributes: user.attributes || { "neverplayed-admin": user.isSuperuser || false }
    };
    // deno-lint-ignore no-explicit-any
    (globalThis as any).NEVERPLAYED_HEADLESS_USER = userData;
    
    // Rule 27: Liquid Identity Pulse (SDN-0140)
    // Dispatches a pulse to notify running activators of the identity shift
    globalThis.dispatchEvent(new CustomEvent('headless-user-provided', { detail: userData }));

    console.log(`Harness: Identity Provisioned for ${user.email} 👤✅`);
}

export interface MockPersistenceProvider {
    tier: string;
    implementation: string;
    type: string;
    _store: Map<string, unknown>;
    load(key: string): unknown;
    store(key: string, val: unknown): Promise<void>;
    clear(): Promise<void>;
    waitReady(): Promise<void>;
    listKeys(prefix?: string): string[];
}

/**
 * Create a standardized, map-backed Persistence Provider for isolated testing.
 */
export function createMockPersistenceProvider(tier: string, implementation = "mock-provider"): MockPersistenceProvider {
    const _store = new Map<string, unknown>();
    return {
        tier,
        implementation,
        type: "provider",
        _store, // Internal storage exposed for test verification
        load: (key: string) => _store.get(key) ?? null,
        store: (key: string, val: unknown) => {
            _store.set(key, val);
            return Promise.resolve();
        },
        clear: () => {
            _store.clear();
            return Promise.resolve();
        },
        waitReady: () => Promise.resolve(),
        listKeys: (prefix = "") => Array.from(_store.keys()).filter(k => k.startsWith(prefix))
    };
}

/**
 * Shared utility for the "Identity Shield" logic.
 * Verifies if a service reference should be tracked by the Persistence Selector.
 */
export function shouldTrackPersistenceProvider(props: Record<string, unknown>): boolean {
    const isProvider = props.type === "provider";
    const isSelector = props.implementation === "selector-proxy";
    return isProvider && !isSelector;
}

// Auto-Initialize Global Environment upon import
setupGlobalEnvironment();
