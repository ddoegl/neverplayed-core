import { ENV_SERVICE } from "../../../shared-types.js";

export default class Activator {
  start(_context) {
    console.log("Activator: Starting space-time environment...");
    _context.registerService(ENV_SERVICE, {
      id: "space-time",
      name: "Space-Time Reality",
      type: "space-time",
      icon: "fas fa-user-astronaut",
      onActivate: (session) => {
        session.environment = "space-time";
        console.log("Environment switched to: Space-Time Reality");
      }
    }, { "env.id": "space-time" });
  }

  stop(_context) {}
}
