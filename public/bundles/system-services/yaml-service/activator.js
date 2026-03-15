import { YAML_SERVICE } from "../../../shared-types.js";
import jsyaml from "https://esm.sh/js-yaml@4.1.0";

export default class Activator {
  async start(context) {
    context.registerService(YAML_SERVICE, {
      load: (text) => jsyaml.load(text),
      dump: (obj) => jsyaml.dump(obj),
    });
  }

  async stop(context) {}
}
