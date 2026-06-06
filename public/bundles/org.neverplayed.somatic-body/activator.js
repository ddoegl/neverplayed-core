/**
 * @file Activator for org.neverplayed.somatic-body
 * @module domain/bundles/org.neverplayed.somatic-body
 *
 * Implements the OSGi Activator for the Somatic Body service, registering
 * the Muscle Registry and handling efferent/afferent feedback loops.
 */

import { 
    LOG_SERVICE,
    EVENT_ADMIN_SERVICE,
    EVENT_FACTORY_SERVICE,
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC,
    SOMATIC_MUSCLE_REGISTRY_SERVICE,
    STRATUM_SERVICE
} from "core-types";

export default class Activator {
    start(context) {
        this.context = context;
        this.logger = console;
        this.eventAdmin = null;
        this.eventFactory = null;

        // Setup Logger
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this.logger = svc.getLogger("somatic-body");
            }
        }).open();

        // Track EventAdmin
        context.trackService(`(objectClass=${EVENT_ADMIN_SERVICE})`, {
            addingService: (ref) => {
                this.eventAdmin = context.getService(ref);
                return this.eventAdmin;
            },
            removedService: () => { this.eventAdmin = null; }
        }).open();

        // Track EventFactory
        context.trackService(`(objectClass=${EVENT_FACTORY_SERVICE})`, {
            addingService: (ref) => {
                this.eventFactory = context.getService(ref);
                return this.eventFactory;
            },
            removedService: () => { this.eventFactory = null; }
        }).open();

        // Muscle database state: tension (0-100), fatigue (0-100), title
        this.muscles = new Map([
            ["beckenboden", { id: "beckenboden", title: "Pelvic Floor", tension: 0.0, fatigue: 0.0 }],
            ["gluteus-medius", { id: "gluteus-medius", title: "Gluteus Medius", tension: 0.0, fatigue: 0.0 }],
            ["quadriceps", { id: "quadriceps", title: "Quadriceps", tension: 0.0, fatigue: 0.0 }],
            ["ischiocrurale", { id: "ischiocrurale", title: "Ischiocrurale", tension: 0.0, fatigue: 0.0 }],
            ["deltoideus", { id: "deltoideus", title: "Deltoideus", tension: 0.0, fatigue: 0.0 }],
            ["pectoralis", { id: "pectoralis", title: "Pectoralis Major", tension: 0.0, fatigue: 0.0 }],
            ["latissimus", { id: "latissimus", title: "Latissimus Dorsi", tension: 0.0, fatigue: 0.0 }],
            ["rhomboiden", { id: "rhomboiden", title: "Rhomboids", tension: 0.0, fatigue: 0.0 }],
            ["abdominalis", { id: "abdominalis", title: "Rectus Abdominis", tension: 0.0, fatigue: 0.0 }],
            ["erector-spinae", { id: "erector-spinae", title: "Erector Spinae", tension: 0.0, fatigue: 0.0 }]
        ]);

        // Register MuscleRegistry Service
        context.registerService(SOMATIC_MUSCLE_REGISTRY_SERVICE, {
            getMuscles: () => Array.from(this.muscles.values()),
            getMuscle: (id) => this.muscles.get(id) || null,
            exertForce: (id, tension) => this.exertForce(id, tension),
            rest: (id) => this.exertForce(id, 0.0),
            applyFatigue: (id, fatigueInc) => {
                const m = this.muscles.get(id);
                if (m) {
                    m.fatigue = Math.min(100, Math.max(0, m.fatigue + fatigueInc));
                    this._triggerStratumUpdate();
                }
            }
        });

        // Register EventHandler for external gym machine weights stimulation (Afferent Loop)
        context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (event) => {
                const muscleId = event.getProperty("muscleId");
                const load = event.getProperty("load") || 0.0;
                
                if (muscleId && this.muscles.has(muscleId)) {
                    const muscle = this.muscles.get(muscleId);
                    
                    // Proprioception Reflex: muscle reacts to load pressure by raising passive/active tension
                    // to match the load threshold, up to fatigue limits.
                    const maxPossibleTension = Math.max(0, 100 - muscle.fatigue);
                    const reactiveTension = Math.min(maxPossibleTension, load * 1.1); // minor eccentric overload reflex
                    
                    if (Math.abs(muscle.tension - reactiveTension) > 1.0) {
                        muscle.tension = Number(reactiveTension.toFixed(1));
                        this.logger.info(`Proprioception: ${muscle.title} contracted to ${muscle.tension}% under external load of ${load}kg.`);
                        
                        this._broadcastContraction(muscleId, muscle.tension);
                        this._triggerStratumUpdate();
                    }
                }
            }
        }, {
            [EVENT_TOPIC]: ["org/neverplayed/gym/LOAD_PRESSURE"]
        });

        this.logger.info("Somatic Body: Muscle Systems Online 🏃🧬");
    }

    exertForce(id, tension) {
        if (!this.muscles.has(id)) return;
        const m = this.muscles.get(id);
        const limit = 100 - m.fatigue;
        m.tension = Math.min(limit, Math.max(0.0, tension));
        
        // Exertion slowly increments fatigue
        if (m.tension > 10.0) {
            m.fatigue = Math.min(100.0, Number((m.fatigue + (m.tension * 0.02)).toFixed(2)));
        } else {
            // Resting slowly decays fatigue
            m.fatigue = Math.max(0.0, Number((m.fatigue - 0.5).toFixed(2)));
        }

        this.logger.info(`Somatic Exertion: ${m.title} active at ${m.tension}% (Fatigue: ${m.fatigue}%)`);
        
        this._broadcastContraction(id, m.tension);
        this._triggerStratumUpdate();
    }

    _broadcastContraction(muscleId, tension) {
        if (this.eventAdmin && this.eventFactory) {
            const event = this.eventFactory.build("org/neverplayed/somatic/CONTRACTION", {
                muscleId: muscleId,
                tension: tension,
                timestamp: Date.now()
            });
            this.eventAdmin.postEvent(event);
        }
    }

    _triggerStratumUpdate() {
        const ref = this.context.getServiceReference(STRATUM_SERVICE);
        if (ref) {
            const stratum = this.context.getService(ref);
            if (stratum && typeof stratum.triggerUpdate === 'function') {
                stratum.triggerUpdate();
            }
        }
    }

    stop() {
        this.logger.info("Somatic Body: Muscle Systems Offline.");
    }
}
