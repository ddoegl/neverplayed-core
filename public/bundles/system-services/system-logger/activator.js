export default class Activator {
  start(context) {
    const logger = {
      log: (msg) => console.log(`[Pandino Logger] ${msg}`),
      info: (msg) => console.info(`%c[INFO]%c ${msg}`, 'color: #3b82f6', 'color: inherit'),
      debug: (msg) => console.debug(`%c[DEBUG]%c ${msg}`, 'color: #8b5cf6', 'color: inherit'),
      trace: (msg) => console.trace(`%c[TRACE]%c ${msg}`, 'color: #a855f7', 'color: inherit'),
      warn: (msg) => console.warn(`%c[WARN]%c ${msg}`, 'color: #eab308; font-weight: bold', 'color: inherit'),
      error: (msg, err) => {
        console.error(`%c[ERROR]%c ${msg}`, 'color: #ef4444; font-weight: bold', 'color: inherit');
        if (err) console.error(err);
      }
    };

    console.log("[System Logger] Registering @pandino/pandino/Logger service...");
    this.registration = context.registerService('@pandino/pandino/Logger', logger);
  }

  stop(_context) {
    if (this.registration) {
      this.registration.unregister();
    }
    console.log("[System Logger] Unregistered.");
  }
}
