export default class Activator {
  start(_context) {
    console.log("Business Account Order: Bundle started (declarative mode)");
  }
  stop() {
    console.log("Business Account Order: Bundle stopped");
  }
}
