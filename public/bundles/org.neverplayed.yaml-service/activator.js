import { YAML_SERVICE } from "core-types";
import jsyaml from "https://esm.sh/js-yaml@4.1.0";

export default class Activator {
  start(context) {
    context.registerService(YAML_SERVICE, {
      load: (text) => jsyaml.load(text),
      dump: (obj) => jsyaml.dump(obj),
    });
  }

  stop(_context) {}
}
