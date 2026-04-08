const y = Object.defineProperty;
const F = (a, t, e) => t in a ? y(a, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : a[t] = e;
const n = (a, t, e) => (F(a, typeof t != "symbol" ? t + "" : t, e), e);
// @ts-ignore: vendor characterization
import { OBJECTCLASS as v, SERVICE_ID as h, SERVICE_PID as E, BUNDLE_SYMBOLICNAME as b, FRAMEWORK_LOGGER as _, FRAMEWORK_EVALUATE_FILTER as D, SERVICE_LISTENER_INTERFACE_KEY as O } from "@pandino/pandino-api";
// @ts-ignore: vendor characterization
import { EVENT_HANDLER_INTERFACE_KEY as k, EVENT_FILTER as g, EVENT_TOPIC as o, EVENT as p, BUNDLE_SYMBOLICNAME as N, BUNDLE_EVENT_INTERFACE_KEY as w, FRAMEWORK_EVENT_INTERFACE_KEY as C, BUNDLE_ID as M, MESSAGE as P, TIMESTAMP as B, SERVICE as I, SERVICE_OBJECTCLASS as L, LOG_EVENT_INTERFACE_KEY as V, SERVICE_EVENT_INTERFACE_KEY as G, EVENT_ADMIN_INTERFACE_KEY as U, EVENT_FACTORY_INTERFACE_KEY as K } from "@pandino/event-api";
// @ts-ignore: vendor characterization
import { LOG_READER_SERVICE_INTERFACE_KEY as f } from "@pandino/log-api";
class R {
  constructor(_t) {
    n(this, "className");
    this.className = _t;
  }
  match(_t) {
    return this.className === _t;
  }
}
const S = "/", m = "/";
class Y {
  match(_t) {
    return !0;
  }
}
class A {
  constructor(t, e) {
    n(this, "packageName");
    n(this, "sep");
    this.packageName = t, this.sep = e;
  }
  match(t) {
    const e = t.lastIndexOf(this.sep);
    return e > -1 && t.substring(0, e) === this.packageName;
  }
}
class T {
  constructor(t, e) {
    n(this, "packageName");
    n(this, "sep");
    this.packageName = t, this.sep = e;
  }
  match(t) {
    const e = t.lastIndexOf(this.sep);
    return e > -1 && t.substring(0, e + 1).startsWith(this.packageName);
  }
}
class W {
  static createEventTopicMatchers(t = []) {
    const e = [];
    for (let i = 0; i < t.length; i++) {
      let r = t[i];
      if (r != null && (r = r.trim()), r != null && r.length > 0)
        if (r.endsWith("."))
          e.push(new A(r.substring(0, r.length - 1), S));
        else if (r.endsWith("*")) {
          if (r === "*")
            return [new Y()];
          e.push(new T(r.substring(0, r.length - 1), S));
        } else
          e.push(new R(r));
    }
    return e.length > 0 ? e : [];
  }
  static createPackageMatchers(t = []) {
    const e = [];
    for (let i = 0; i < t.length; i++) {
      let r = t[i];
      r != null && (r = r.trim()), r != null && r.length > 0 && (r.endsWith(".") ? e[i] = new A(r.substring(0, r.length - 1), m) : r.endsWith("*") ? e[i] = new T(r.substring(0, r.length - 1), m) : e[i] = new R(r));
    }
    return e;
  }
}
class $ {
  constructor(t, e, i) {
    n(this, "regs", []);
    n(this, "context");
    n(this, "logger");
    // @ts-ignore: vendor bypass
    n(this, "evaluateFilter");
    this.context = t, this.logger = e, this.evaluateFilter = i;
  }
  serviceChanged(t) {
    const e = t.getServiceReference();
    if (e.hasObjectClass(k)) {
      const i = this.context.getService(e);
      i && typeof i.handleEvent == "function" && (t.getType() === "REGISTERED" ? this.eventHandlerRegistered(e) : t.getType() === "UNREGISTERING" && this.eventHandlerUnregistering(e));
    }
  }
  postEvent(t) {
    for (const e of this.regs) {
      const i = typeof e[g] == "string" ? e[g] : void 0;
      if (!i || t.matches(i)) {
        const r = Array.isArray(e[o]) ? e[o] : [e[o]];
        W.createEventTopicMatchers(r).some((c) => c.match(t.getTopic())) && setTimeout(() => {
          e.service.handleEvent(t);
        }, 0);
      }
    }
  }
  getRegistrations() {
    return this.regs;
  }
  eventHandlerRegistered(t) {
    const e = t.getProperties(), i = this.context.getService(t);
    if (typeof e[o] != "string" && !Array.isArray(e[o])) {
      this.logger.warn(`Skipping registration of Event Handler, invalid topic format: ${e[o]}!`);
      return;
    }
    if (i && !this.regs.find((r) => r.reference === t)) {
      const r = {
        [o]: e[o],
        reference: t,
        service: i
      };
      e[g] !== null && e[g] !== void 0 && (r[g] = e[g]), this.logger.debug(`Registering new event handler for topic(s): ${e[o]}.`), this.regs.push(r);
    }
  }
  eventHandlerUnregistering(t) {
    const e = this.regs.findIndex((i) => i.reference === t);
    e > -1 && this.regs.splice(e, 1);
  }
}
class d {
  constructor(t, e, i) {
    n(this, "topic");
    n(this, "properties");
    n(this, "filterEvaluator");
    d.validateTopicName(t), this.topic = t, this.properties = e, this.filterEvaluator = i;
  }
  containsProperty(t) {
    return o === t ? !0 : Object.keys(this.properties).includes(t);
  }
  equals(t) {
    return t === this ? !0 : t instanceof d ? t.getTopic() === this.topic : !1;
  }
  getProperty(t) {
    return o === t ? this.topic : this.properties[t];
  }
  getPropertyNames() {
    return [...Object.keys(this.properties), o];
  }
  getTopic() {
    return this.topic;
  }
  matches(t) {
    return this.filterEvaluator(
      {
        ...this.properties,
        [o]: this.topic
      },
      t
    );
  }
  static validateTopicName(t) {
    const e = t.split("");
    const i = e.length;
    if (i === 0)
      throw new Error("empty topic");
    for (let r = 0; r < i; r++) {
      const s = e[r];
      if (s === "/") {
        if (r === 0 || r === i - 1)
          throw new Error("invalid topic: " + t);
        if (e[r - 1] === "/")
          throw new Error("invalid topic: " + t);
        continue;
      }
      if (!("A" <= s && s <= "Z") && !("a" <= s && s <= "z") && !("0" <= s && s <= "9") && !(s === "_" || s === "-" || s === "@"))
        throw new Error("invalid topic: " + t);
    }
  }
}
class H {
  constructor(t) {
    this.filterEvaluator = t;
  }
  build(t, e) {
    return new d(t, e, this.filterEvaluator);
  }
}
class u {
  constructor(t) {
    n(this, "admin");
    this.admin = t;
  }
  getEventAdmin() {
    return this.admin;
  }
}
class j extends u {
  constructor(e, i, r) {
    super(i);
    n(this, "eventFactory");
    this.eventFactory = r, e.addBundleListener(this);
  }
  destroy(e) {
    e.removeBundleListener(this);
  }
  bundleChanged(e) {
    const i = {
      [p]: e,
      [N]: e.getBundle().getSymbolicName(),
      "bundle.id": e.getBundle().getBundleId(),
      bundle: e.getBundle()
    };
    let r = `${w}/`;
    switch (e.getType()) {
      case "INSTALLED":
        r += "INSTALLED";
        break;
      case "STARTED":
        r += "STARTED";
        break;
      case "STOPPED":
        r += "STOPPED";
        break;
      case "UPDATED":
        r += "UPDATED";
        break;
      case "UNINSTALLED":
        r += "UNINSTALLED";
        break;
      case "RESOLVED":
        r += "RESOLVED";
        break;
      case "UNRESOLVED":
        r += "UNRESOLVED";
        break;
      default:
        return;
    }
    try {
      this.getEventAdmin().postEvent(this.eventFactory.build(r, i));
    } catch {
      /* empty */
    }
  }
}
class J extends u {
  constructor(e, i, r) {
    super(i);
    n(this, "eventFactory");
    this.eventFactory = r, e.addFrameworkListener(this);
  }
  destroy(e) {
    e.removeFrameworkListener(this);
  }
  frameworkEvent(e) {
    const i = {
      [p]: e,
      [N]: e.getBundle().getSymbolicName(),
      "bundle.id": e.getBundle().getBundleId(),
      bundle: e.getBundle()
    };
    let r = `${C}/`;
    switch (e.getType()) {
      case "STARTED":
        r += "STARTED";
        break;
      case "ERROR":
        r += "ERROR";
        break;
      default:
        return;
    }
    try {
      this.getEventAdmin().postEvent(this.eventFactory.build(r, i));
    } catch {
      /* empty */
    }
  }
}
class q extends u {
  constructor(e, i, r) {
    super(i);
    n(this, "eventFactory");
    n(this, "context");
    // @ts-ignore: vendor characterization
    n(this, "logListener");
    this.context = e, this.eventFactory = r;
    try {
      e.addServiceListener(this, `(${v}=${f})`);
      const s = e.getServiceReferences(f);
      if (s && s.length)
        for (let c = 0; c < s.length; c++) {
          const l = e.getService(s[c]);
          l && l.addLogListener(this.getLogListener());
        }
    } catch {
      /* empty */
    }
  }
  destroy(e) {
    e.removeServiceListener(this);
  }
  serviceChanged(e) {
    if (e.getType() === "REGISTERED") {
      const i = this.context.getService(e.getServiceReference());
      i && i.addLogListener(this.getLogListener());
    }
  }
  getLogListener() {
    return this.logListener ? this.logListener : (this.logListener = {
      logged: (e) => {
        const i = {};
        const r = e.getBundle();
        r && (i[M] = r.getBundleId(), i.bundle = r, i[b] = r.getSymbolicName()), i["log.entry"] = e, i["log.level"] = e.getLevel(), i[P] = e.getMessage() ? e.getMessage() : "", i[B] = e.getTime();
        const s = e.getServiceReference();
        if (s) {
          i[I] = s, i[h] = s.getProperty(h), i[L] = s.getProperty(v);
          const l = s.getProperty(E);
          l && (i[E] = l);
        }
        let c = `${V}/`;
        switch (e.getLevel()) {
          case "ERROR":
            c += "ERROR";
            break;
          case "WARNING":
            c += "WARNING";
            break;
          case "INFO":
            c += "INFO";
            break;
          case "DEBUG":
            c += "DEBUG";
            break;
          default:
            c += "OTHER";
            break;
        }
        try {
          this.getEventAdmin().postEvent(this.eventFactory.build(c.toString(), i));
        } catch {
          /* empty */
        }
      }
    }, this.logListener);
  }
}
class z extends u {
  constructor(e, i, r) {
    super(i);
    n(this, "eventFactory");
    this.eventFactory = r, e.addServiceListener(this);
  }
  destroy(e) {
    e.removeServiceListener(this);
  }
  serviceChanged(e) {
    const i = {
      [p]: e,
      [I]: e.getServiceReference(),
      [h]: e.getServiceReference().getProperty(h),
      [L]: e.getServiceReference().getProperty(v)
    };
    const r = e.getServiceReference().getProperty(E);
    r && (i[E] = r);
    let s = `${G}/`;
    switch (e.getType()) {
      case "REGISTERED":
        s += "REGISTERED";
        break;
      case "MODIFIED":
        s += "MODIFIED";
        break;
      case "UNREGISTERING":
        s += "UNREGISTERING";
        break;
      default:
        return;
    }
    try {
      this.getEventAdmin().postEvent(this.eventFactory.build(s.toString(), i));
    } catch {
      /* empty */
    }
  }
}
class ee {
  constructor() {
    n(this, "eventAdminRegistration");
    n(this, "eventFactoryRegistration");
    n(this, "loggerRef");
    n(this, "logger");
    n(this, "evaluateFilterService");
    n(this, "evaluateFilter");
    n(this, "eventAdmin");
    n(this, "adapters", []);
  }
  start(t) {
    this.loggerRef = t.getServiceReference(_), this.logger = t.getService(this.loggerRef), this.evaluateFilterService = t.getServiceReference(D), this.evaluateFilter = t.getService(this.evaluateFilterService), this.eventAdmin = new $(t, this.logger, this.evaluateFilter);
    const e = new H(this.evaluateFilter);
    this.eventAdminRegistration = t.registerService(
      [U, O],
      this.eventAdmin
    ), this.eventFactoryRegistration = t.registerService(K, e), t.addServiceListener(this.eventAdmin), this.adapters.push(new j(t, this.eventAdmin, e)), this.adapters.push(new J(t, this.eventAdmin, e)), this.adapters.push(new q(t, this.eventAdmin, e)), this.adapters.push(new z(t, this.eventAdmin, e));
  }
  stop(t) {
    this.adapters.forEach((e) => e.destroy(t)), this.eventAdmin && t.removeServiceListener(this.eventAdmin), this.loggerRef && t.ungetService(this.loggerRef), this.evaluateFilterService && t.ungetService(this.evaluateFilterService), this.eventAdminRegistration && this.eventAdminRegistration.unregister(), this.eventFactoryRegistration && this.eventFactoryRegistration.unregister();
  }
}
export {
  ee as default
};