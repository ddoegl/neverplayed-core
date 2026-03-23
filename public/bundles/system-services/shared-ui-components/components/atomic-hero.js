import { AtomicComponentBase } from "./atomic-component-base.js";
import { marked } from "https://esm.sh/marked@12.0.1";

/**
 * atomic-hero: A premium hero component with markdown support and reactive segments.
 * Kind: hero
 */
class AtomicHero extends AtomicComponentBase {
    render() {
        if (!this._spec) return;

        const variant = this._spec.variant || "indigo";
        const icon = this.interp(this._spec.icon || "fas fa-star");
        
        let container = this.querySelector('.uif-hero');
        if (!container) {
            this.innerHTML = `
                <div class="uif-hero p-8 rounded-3xl bg-gradient-to-br from-${variant}-600 to-${variant}-800 text-white mb-8 relative overflow-hidden shadow-xl border-t border-white/20 transition-all duration-500">
                    <div class="relative z-10 flex items-center gap-6">
                        <div class="bg-white/20 p-5 rounded-3xl backdrop-blur-md border border-white/30 shadow-inner">
                            <i class="uif-hero-icon text-4xl"></i>
                        </div>
                        <div>
                            <h1 class="uif-hero-title text-3xl font-black tracking-tight leading-tight"></h1>
                            <p class="uif-hero-subtitle text-white/80 font-medium mt-1 leading-relaxed"></p>
                        </div>
                    </div>
                    <div class="absolute -right-8 -top-8 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
                    <div class="absolute -left-12 -bottom-12 w-32 h-32 bg-black/10 rounded-full blur-2xl"></div>
                </div>
            `;
            container = this.querySelector('.uif-hero');
        }

        // 1. Update Variant & Icon (Non-destructive)
        container.className = `uif-hero p-8 rounded-3xl bg-gradient-to-br from-${variant}-600 to-${variant}-800 text-white mb-8 relative overflow-hidden shadow-xl border-t border-white/20 transition-all duration-500`;
        const iconEl = container.querySelector('.uif-hero-icon');
        if (iconEl && !iconEl.classList.contains(icon)) {
            iconEl.className = `uif-hero-icon ${icon} text-4xl`;
        }

        // 2. Robust Reactive Text for Title & Subtitle (Mask-and-Restore Pattern)
        const renderText = (el, val) => {
            if (!el) return;
            const segments = [];
            const masked = (val || "").replace(/(?:\${(this\.)?(.+?)}|\{\{\s*(this\.)?(.+?)\s*\}\})/g, (_, _p1, k1, _p2, k2) => {
                const id = `h-r-${Math.random().toString(36).slice(2, 9)}`;
                const path = k1 || k2;
                segments.push({ id, path });
                return `[[[${id}]]]`;
            });

            let html = "";
            try {
                html = marked.parse(masked);
            } catch (_e) { html = masked; }

            segments.forEach(seg => {
                html = html.replace(`[[[${seg.id}]]]`, `<span id="${seg.id}"></span>`);
            });

            el.innerHTML = html;

            segments.forEach(seg => {
                const span = el.querySelector(`#${seg.id}`);
                if (span) {
                    span.removeAttribute('id');
                    span.className = "uif-reactive font-bold text-white/90";
                    // Using the base class 'resolve' method which points to uifResolve
                    const res = this.resolve(seg.path);
                    const label = (res !== undefined && res !== null && res !== "") ? res : "";
                    span.innerText = label;
                    if (!label) span.classList.add('uif-pending');
                }
            });
        };

        renderText(container.querySelector('.uif-hero-title'), this._spec.title);
        renderText(container.querySelector('.uif-hero-subtitle'), this._spec.subtitle);
    }
}

if (!customElements.get("atomic-hero")) {
    customElements.define("atomic-hero", AtomicHero);
}
export default AtomicHero;
