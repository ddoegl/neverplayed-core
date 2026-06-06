/**
 * @file Activator for org.neverplayed.gym
 * @module domain/bundles/org.neverplayed.gym
 *
 * Implements the OSGi Activator for the Gym machinery service, registering
 * the Machine Registry and Realm Cognition services.
 */

import { 
    LOG_SERVICE,
    EVENT_ADMIN_SERVICE,
    EVENT_FACTORY_SERVICE,
    EVENT_HANDLER_INTERFACE,
    EVENT_TOPIC,
    REALM_COGNITION_SERVICE,
    REALM_GYM,
    GYM_MACHINE_REGISTRY_SERVICE,
    STRATUM_SERVICE
} from "core-types";

export default class Activator {
    start(context) {
        this.context = context;
        this.logger = console;
        this.eventAdmin = null;
        this.eventFactory = null;
        this.activeMachineId = null;

        // Setup Logger
        context.trackService(`(objectClass=${LOG_SERVICE})`, {
            addingService: (ref) => {
                const svc = context.getService(ref);
                this.logger = svc.getLogger("gym");
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

        // Kieser Training Machinery Database
        this.machines = new Map([
            ["machine-a5", { id: "machine-a5", title: "Beckenbodentrainer A5", muscleId: "beckenboden", weightKg: 30, carriageState: "resting" }],
            ["machine-a3", { id: "machine-a3", title: "Abduktorenmaschine A3", muscleId: "gluteus-medius", weightKg: 50, carriageState: "resting" }],
            ["machine-b6", { id: "machine-b6", title: "Beinpresse B6", muscleId: "quadriceps", weightKg: 120, carriageState: "resting" }],
            ["machine-b1", { id: "machine-b1", title: "Beinstrecker B1", muscleId: "quadriceps", weightKg: 60, carriageState: "resting" }],
            ["machine-b7", { id: "machine-b7", title: "Beinbeuger B7", muscleId: "ischiocrurale", weightKg: 55, carriageState: "resting" }],
            ["machine-e1", { id: "machine-e1", title: "Schulterpresse E1", muscleId: "deltoideus", weightKg: 40, carriageState: "resting" }],
            ["machine-d6", { id: "machine-d6", title: "Brustpresse D6", muscleId: "pectoralis", weightKg: 65, carriageState: "resting" }],
            ["machine-c3", { id: "machine-c3", title: "Überzug/Armzug C3", muscleId: "latissimus", weightKg: 70, carriageState: "resting" }],
            ["machine-c7", { id: "machine-c7", title: "Rudermaschine C7", muscleId: "rhomboiden", weightKg: 60, carriageState: "resting" }],
            ["machine-f2.1", { id: "machine-f2.1", title: "Bauchmaschine F2.1", muscleId: "abdominalis", weightKg: 45, carriageState: "resting" }],
            ["machine-f3.1", { id: "machine-f3.1", title: "Rückenstrecker F3.1", muscleId: "erector-spinae", weightKg: 80, carriageState: "resting" }],
            ["machine-j9", { id: "machine-j9", title: "Kabelzugstation J9", muscleId: "quadriceps", weightKg: 20, carriageState: "resting" }]
        ]);

        this.somaticTension = 0.0;
        this.predictionError = 0.0;

        // Register GymMachineService
        context.registerService(GYM_MACHINE_REGISTRY_SERVICE, {
            getMachines: () => Array.from(this.machines.values()),
            getMachine: (id) => this.machines.get(id) || null,
            getActiveMachineId: () => this.activeMachineId,
            selectMachine: (id) => {
                if (id && !this.machines.has(id)) return;
                this.activeMachineId = id;
                this.somaticTension = 0.0;
                this.predictionError = 0.0;
                
                if (id) {
                    const m = this.machines.get(id);
                    m.carriageState = "resting";
                    this.logger.info(`Gym Goer seated at: ${m.title}`);
                } else {
                    this.logger.info("Gym Goer stood up from machine.");
                }
                this._broadcastLoadPressure();
                this._triggerStratumUpdate();
            },
            setWeight: (id, weightKg) => {
                const m = this.machines.get(id);
                if (m) {
                    m.weightKg = weightKg;
                    this.logger.info(`Weight stack on ${m.title} adjusted to ${weightKg}kg.`);
                    this._broadcastLoadPressure();
                    this._triggerStratumUpdate();
                }
            }
        });

        // Register RealmCognitionService for TAME Homeostatic Loop
        context.registerService(REALM_COGNITION_SERVICE, {
            getPredictionError: () => Number(this.predictionError.toFixed(2)),
            getReifiedPids: () => ["gym.active-machine", "gym.weight-stack", "gym.lever-carriage"],
            getHomeostaticStatus: () => this.predictionError < 0.2 ? "STABLE" : "UNSTABLE"
        }, {
            "realm.id": REALM_GYM
        });

        // Register EventHandler for muscle contraction (Efferent Feedback Loop)
        context.registerService(EVENT_HANDLER_INTERFACE, {
            handleEvent: (event) => {
                const muscleId = event.getProperty("muscleId");
                const tension = event.getProperty("tension") || 0.0;
                
                if (this.activeMachineId) {
                    const activeMachine = this.machines.get(this.activeMachineId);
                    
                    if (activeMachine.muscleId === muscleId) {
                        this.somaticTension = tension;
                        
                        // Dynamic Biomechanical lever calculation
                        const weightFactor = activeMachine.weightKg;
                        
                        // Overcoming threshold: e.g. lifting requires tension > 0.7 * weightKg
                        const threshold = weightFactor * 0.7;
                        
                        if (tension >= threshold) {
                            activeMachine.carriageState = "contracted";
                            this.predictionError = 0.0; // Homeostatic match!
                        } else if (tension > 5.0) {
                            activeMachine.carriageState = "exerting";
                            // Prediction Error grows if we are trying but failing to overcome load
                            this.predictionError = Math.max(0.0, (threshold - tension) / 100);
                        } else {
                            activeMachine.carriageState = "resting";
                            this.predictionError = 0.0; // resting states do not generate prediction errors
                        }
                        
                        this._triggerStratumUpdate();
                    }
                }
            }
        }, {
            [EVENT_TOPIC]: ["org/neverplayed/somatic/CONTRACTION"]
        });

        // Loop to continuously assert load pressure to the active occupant (stigmergic stimulation)
        this.loadPressureTimer = setInterval(() => {
            this._broadcastLoadPressure();
        }, 1000);

        this.logger.info("Gym Machinery: Biomechanical Systems Active 🏋️✨");
    }

    _broadcastLoadPressure() {
        if (!this.activeMachineId || !this.eventAdmin || !this.eventFactory) return;
        const activeMachine = this.machines.get(this.activeMachineId);
        
        const event = this.eventFactory.build("org/neverplayed/gym/LOAD_PRESSURE", {
            muscleId: activeMachine.muscleId,
            load: activeMachine.weightKg,
            timestamp: Date.now()
        });
        this.eventAdmin.postEvent(event);
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
        if (this.loadPressureTimer) clearInterval(this.loadPressureTimer);
        this.logger.info("Gym Machinery: Biomechanical Systems Offline.");
    }
}
