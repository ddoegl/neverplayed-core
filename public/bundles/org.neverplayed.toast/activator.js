/**
 * @file Activator for org.neverplayed.toast
 * v1.0.0 — Dedicated Toast Notification Bundle
 *
 * Extracted from org.neverplayed.shared-ui.
 * Provides the INTERACTOR_SERVICE with a native glassmorphic notification HUD.
 * Extends AlpineActivator for template rendering and store management.
 *
 * Implements patterns: ADR-0016 (Inhabitant Sovereignty), ADR-0026 (Reactive Resolution).
 */

import { INTERACTOR_SERVICE, LOG_SERVICE } from "core-types";
import { AlpineActivator } from "alpine-base";
import Alpine from "alpinejs";

export default class Activator extends AlpineActivator {

    async onStart(context) {
        // 1. ─── Mount Point ───────────────────────────────────────────────
        const MOUNT_ID = "toast-mount-point";
        if (!document.getElementById(MOUNT_ID)) {
            const el = document.createElement("div");
            el.id = MOUNT_ID;
            document.body.appendChild(el);
            this.logger?.debug(`[Toast] Mount point #${MOUNT_ID} created.`);
        }

        // 2. ─── Notifications Alpine Store ────────────────────────────────
        this.initStore("notifications", {
            toasts: [],

            /**
             * Push a new toast notification.
             * @param {Object} toast - { message, type?, duration? }
             * @returns {string} The generated toast ID.
             */
            push(toast) {
                const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                const duration = toast.duration ?? 5000;
                const entry = {
                    id,
                    message: toast.message ?? "Notification",
                    type: toast.type ?? "info",
                    visible: true,
                };
                this.toasts.push(entry);

                if (duration > 0) {
                    setTimeout(() => this.dismiss(id), duration);
                }
                return id;
            },

            /**
             * Dismiss a toast by ID (fade-out then remove).
             * @param {string} id
             */
            dismiss(id) {
                const toast = this.toasts.find(t => t.id === id);
                if (toast) {
                    toast.visible = false;
                    // Allow transition to finish before purging
                    setTimeout(() => {
                        this.toasts = this.toasts.filter(t => t.id !== id);
                    }, 400);
                }
            },
        });

        // 3. ─── Render Glassmorphic Toast HUD ────────────────────────────
        await this.render(
            `#${MOUNT_ID}`,
            "templates/toast.html",
            () => ({
                get toasts() { return Alpine.store("notifications")?.toasts ?? []; },
                dismiss(id) { Alpine.store("notifications")?.dismiss(id); },
            })
        );

        // 4. ─── Register INTERACTOR_SERVICE ──────────────────────────────
        const store = Alpine.store("notifications");

        context.registerService(INTERACTOR_SERVICE, {
            /**
             * Push a toast notification.
             * @param {string} message
             * @param {"info"|"success"|"warning"|"error"} type
             * @param {number} duration - Auto-dismiss ms (0 = sticky)
             */
            notify: (message, type = "info", duration = 5000) => {
                store?.push({ message, type, duration });
            },

            confirm: (message) => Promise.resolve(globalThis.confirm(message)),
            prompt:  (message, defaultValue) => Promise.resolve(globalThis.prompt(message, defaultValue)),
            alert:   (message) => Promise.resolve(globalThis.alert(message)),
        });

        this.logger?.info("Toast Bundle: Interactor service registered and HUD mounted. 🔔");
    }

    stop(_context) {
        this.logger?.info("Toast Bundle: Stopped.");
    }
}
