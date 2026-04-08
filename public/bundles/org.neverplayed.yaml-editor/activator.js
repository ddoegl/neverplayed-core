/**
 * @file Activator for org.neverplayed.yaml-editor
 * @module platform/bundles/org.neverplayed.yaml-editor
 */

import { YAML_SERVICE, YAML_EDITOR_SERVICE } from "core-types";
import { BaseActivator } from "osgi-base";

export default class Activator extends BaseActivator {
  async onStart(context) {
    const yamlRef = context.getServiceReference(YAML_SERVICE);
    const yaml = context.getService(yamlRef);

    // 1. Setup standalone Alpine Store
    Alpine.store("yamlEditor", {
      active: false,
      title: "Edit YAML",
      content: "",
      onSave: null,
      onCancel: null,
      save() {
        try {
          const parsed = yaml.load(this.content);
          if (this.onSave) this.onSave(parsed);
          this.active = false;
        } catch (e) {
          alert("Invalid YAML: " + e.message);
        }
      },
      cancel() {
        if (this.onCancel) this.onCancel();
        this.active = false;
      }
    });

    const store = Alpine.store("yamlEditor");

    // 2. Fetch and register the UI template directly on the document body
    try {
      const res = await fetch("./bundles/org.neverplayed.yaml-editor/templates/editor.html");
      const html = await res.text();
      
      const mountPoint = document.createElement("div");
      mountPoint.id = "yaml-editor-mount";
      mountPoint.innerHTML = html;
      document.body.appendChild(mountPoint);

    } catch (e) {
      console.error("YAML Editor: Failed to load UI template", e);
    }

    // 3. Register standard OSGi abstraction over the Alpine state
    context.registerService(YAML_EDITOR_SERVICE, {
      edit: ({ title, data, onSave, onCancel }) => {
        store.title = title || "Edit YAML";
        store.content = yaml.dump(JSON.parse(JSON.stringify(data)));
        store.onSave = onSave;
        store.onCancel = onCancel;
        store.active = true;
      },
      close: () => {
        store.active = false;
      }
    });
  }

  onStop(_context) {
    const mountPoint = document.getElementById("yaml-editor-mount");
    if (mountPoint) mountPoint.remove();
  }
}
