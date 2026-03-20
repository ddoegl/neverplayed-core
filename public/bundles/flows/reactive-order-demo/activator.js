export default class Activator {
    start(_context) {
        console.log("Reactive Order Demo: Bundle started (declarative mode)");
    }
    stop() {
        console.log("Reactive Order Demo: Bundle stopped");
    }
}
