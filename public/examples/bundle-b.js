export default class Activator {
  async start(context) {
    this.loggerReference = context.getServiceReference('@pandino/pandino/Logger');
    this.logger = context.getService(this.loggerReference);

    this.logger.log('Bundle B - Activator');

    context.registerService('org.neverplayed.bundle-b/StringInverter', stringInverterImpl);
  }

  async stop(context) {
    context.ungetService(this.loggerReference);
  }
}

export const stringInverterImpl = (str) => {
  return str.split('').reverse().join('');
};