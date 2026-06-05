export class SensoryEnvelopeCompiler {
    constructor(context) {
        this.context = context;
    }

    compile(beingId, realmId, rawEnvironment) {
        const perceiverRef = this.context.getServiceReference("org.neverplayed.perceiver.PerceiverService");
        const perceiver = perceiverRef ? this.context.getService(perceiverRef) : null;
        const activeSenses = perceiver ? perceiver.getEnrichedSenses() : [];
        const selfAware = activeSenses.includes("SelfAwareness");
        
        const sensoryEnvelope = [];

        // 1. Filter occupants in the space
        const occupants = rawEnvironment.occupants || [];
        occupants.forEach(occ => {
            if (selfAware && occ.id === beingId) {
                sensoryEnvelope.push(`[Proprioception] I am present in this space.`);
            } else if (activeSenses.includes("Primordial")) {
                sensoryEnvelope.push(`[Sensation] Occupant Node: "${occ.id}" is present.`);
            }
        });

        // 2. Filter stigmergic marks on the soil
        const marks = rawEnvironment.marks || [];
        marks.forEach(mark => {
            // Check if user has the senses required to perceive this mark
            const canSense = !mark.matchers || mark.matchers.every(matcher => {
                if (matcher.type === 'matchProperty' && matcher.key === 'senses') {
                    return activeSenses.includes(matcher.value);
                }
                if (matcher.type === 'matchSense') {
                    return activeSenses.includes(matcher.value);
                }
                return true; 
            });

            if (canSense) {
                const isSelf = selfAware && mark.source === beingId;
                if (mark.type === 'language' && activeSenses.includes("Language")) {
                    if (isSelf) {
                        sensoryEnvelope.push(`[Auditory Sensation] I hear the echo of my own voice: "${mark.payload}"`);
                    } else {
                        sensoryEnvelope.push(`[Auditory Sensation] Language Trace from "${mark.source}": "${mark.payload}"`);
                    }
                } else if (mark.type === 'forensic' && activeSenses.includes("ForensicVision")) {
                    if (isSelf) {
                        sensoryEnvelope.push(`[Visual Sensation] I see the forensic trace of my own movement left at ${new Date(mark.timestamp).toLocaleTimeString()}`);
                    } else {
                        sensoryEnvelope.push(`[Visual Sensation] Forensic Trace left by "${mark.source}" at ${new Date(mark.timestamp).toLocaleTimeString()}`);
                    }
                } else if (activeSenses.includes("Primordial")) {
                    if (isSelf) {
                        sensoryEnvelope.push(`[Visceral Sensation] I detect a mark of structure type "${mark.type}" that I left.`);
                    } else {
                        sensoryEnvelope.push(`[Visceral Sensation] Unidentified mark of structure type "${mark.type}" detected.`);
                    }
                }
            }
        });

        return sensoryEnvelope.join("\n");
    }
}
