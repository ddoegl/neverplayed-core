import { YAML_SERVICE, YAML_EDITOR_SERVICE } from "shared-types";

export default class Activator {
  async start(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    // Fetch and register the UI template into the host shell
    try {
      const res = await fetch("./bundles/system-services/backoffice-yaml-editor/templates/editor.html");
      const html = await res.text();
      if (globalThis.backofficeState) {
        if (!globalThis.backofficeState.pluginOverlays) {
          globalThis.backofficeState.pluginOverlays = [];
        }
        globalThis.backofficeState.pluginOverlays.push(html);
      }
    } catch (e) {
      console.error("YAML Editor: Failed to load UI template", e);
    }

    context.registerService(YAML_EDITOR_SERVICE, {
      /**
       * Opens the YAML editor for the given data object.
       * Handles YAML dump/load internally using YAML_SERVICE.
       */
      edit: ({ title, data, onSave, onCancel }) => {
        if (!globalThis.backofficeState) return;
        
        globalThis.backofficeState.yamlEditor = {
          active: true,
          title: title || "Edit YAML",
          content: yaml.dump(JSON.parse(JSON.stringify(data))), // Clone and dump
          save: () => {
            try {
              const parsed = yaml.load(globalThis.backofficeState.yamlEditor.content);
              if (onSave) onSave(parsed);
              globalThis.backofficeState.yamlEditor.active = false;
            } catch (e) {
              alert("Invalid YAML: " + e.message);
            }
          },
          cancel: () => {
            if (onCancel) onCancel();
            globalThis.backofficeState.yamlEditor.active = false;
          }
        };
      },

      close: () => {
        if (globalThis.backofficeState?.yamlEditor) {
          globalThis.backofficeState.yamlEditor.active = false;
        }
      }
    });
  }

  stop(_context) {
    if (globalThis.backofficeState && globalThis.backofficeState.pluginOverlays) {
      globalThis.backofficeState.pluginOverlays = globalThis.backofficeState.pluginOverlays.filter(
        (ov) => !ov.includes("<!-- YAML Editor Overlay (Modular) -->")
      );
    }
  }
}
