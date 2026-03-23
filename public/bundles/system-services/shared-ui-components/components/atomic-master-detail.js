import { AtomicComponentBase } from "./atomic-component-base.js";

/**
 * atomic-master-detail: A layout component implementing the Master-Detail pattern.
 * Provides a fixed-width sidebar for navigation (Master) and a fluid content area (Detail).
 */
export class AtomicMasterDetail extends AtomicComponentBase {
    connectedCallback() {
        this.render();
    }

    render() {
        if (this._initialized) return;

        const sidebarTitle = this.getAttribute('sidebar-title') || "Directory";
        const sidebarWidth = this.getAttribute('sidebar-width') || "w-72";
        const sidebarBg = this.getAttribute('sidebar-bg') || "bg-gray-50";
        
        // Capture children before clearing
        const children = Array.from(this.childNodes);
        this.innerHTML = "";

        this.className = "flex flex-row h-full overflow-hidden bg-white rounded-3xl border border-gray-100 shadow-inner";
        
        this.innerHTML = `
            <!-- Sidebar / Directory (Master) -->
            <div class="${sidebarWidth} border-r border-gray-200 ${sidebarBg} flex flex-col h-full shrink-0">
                <div class="p-5 flex justify-between items-center border-b border-gray-200 bg-white">
                    <h3 class="text-gray-400 font-black text-[10px] uppercase tracking-widest m-0">
                        ${sidebarTitle}
                    </h3>
                    <div data-id="sidebar-actions" class="flex items-center gap-2"></div>
                </div>
                <div data-id="sidebar-content" class="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scroll">
                    <!-- Sidebar content goes here -->
                </div>
                <div data-id="sidebar-footer" class="p-4 border-t border-gray-100 bg-gray-50/50">
                    <!-- Optional footer -->
                </div>
            </div>

            <!-- Main Content Area (Detail) -->
            <div class="flex-1 flex flex-col h-full overflow-hidden bg-white relative">
                <header class="h-14 border-b border-gray-100 flex items-center justify-between px-6 bg-gray-50/30 shrink-0">
                    <div data-id="header-context"></div>
                    <div data-id="header-actions" class="flex items-center gap-3"></div>
                </header>
                <div data-id="main-content" class="flex-1 flex flex-col overflow-y-auto p-8 custom-scroll scroll-smooth">
                    <!-- Main content goes here -->
                </div>
            </div>
        `;

        // Move children to their target containers based on 'slot' attribute
        children.forEach(child => {
            if (child.nodeType !== Node.ELEMENT_NODE) return;
            const slotName = child.getAttribute('slot');
            if (slotName) {
                const target = this.querySelector(`[data-id="${slotName}"]`);
                if (target) {
                    target.appendChild(child);
                } else {
                    this.querySelector('[data-id="main-content"]').appendChild(child);
                }
            } else {
                this.querySelector('[data-id="main-content"]').appendChild(child);
            }
        });

        this._initialized = true;
    }
}

if (!customElements.get("atomic-master-detail")) {
    customElements.define("atomic-master-detail", AtomicMasterDetail);
}
