/**
 * Plexus Core: Stateless Perception Matching Engine
 * v2.6.5 - Unified Capability & Stigmergic Matching
 */

export const Primitives = {
    matchAlways: () => [true],
    
    matchPersona: (block, context) => {
        const personaLevel = context.surrogate?.level || "unknown";
        if (personaLevel === block.value) return [true];
        return false;
    },

    matchSense: (block, context) => {
        const senses = context.surrogate?.senses || [];
        if (senses.includes(block.value)) return [true];
        return false;
    },

    matchRealm: (block, context) => {
        const realmId = (typeof context.realm === 'object') ? context.realm?.id : context.realm;
        if (realmId === block.value) return [true];
        return false;
    },

    matchProperty: (block, context) => {
        const val = context[block.key];
        if (Array.isArray(val)) {
            if (val.includes(block.value)) return [true];
            if (val.some(v => String(v).toLowerCase() === String(block.value).toLowerCase())) return [true];
        }
        if (val === block.value) return [true];
        if (String(val).toLowerCase() === String(block.value).toLowerCase()) return [true];
        return false;
    },

    matchPropertyEmpty: (block, context) => {
        const val = context[block.key];
        return (!val || (Array.isArray(val) && val.length === 0)) ? [true] : false;
    },

    matchPropertyNotEmpty: (block, context) => {
        const val = context[block.key];
        return (val && (!Array.isArray(val) || val.length > 0)) ? [true] : false;
    },

    matchAttribute: (block, context, config = {}) => {
        const val = context[block.key] !== undefined ? context[block.key] : context.attributes?.[block.key];
        config.logger?.debug(`Plexus: [matchAttribute] key=${block.key}, required=${block.value}, actual=${val}`);
        return val === block.value ? [true] : false;
    },

    // Legacy support for role-based matching
    matchRole: (block, context) => {
        const active = context.activeBusinessFunction || [];
        const roles = Array.isArray(active) ? active : [active];
        if (roles.includes(block.value)) return [true];
        return false;
    },

    // Capability Matchers (Migrated from Limes)
    matchPermission: (block, context, config = {}) => {
        if (!context.grantedKeys) return false;
        const normalized = String(block.value).toLowerCase().replace(/:/g, '_');
        const allowed = Object.keys(context.grantedKeys).some(k => k.toLowerCase().replace(/:/g, '_') === normalized);
        config.logger?.debug(`Plexus: [matchPermission] key=${block.value} (${normalized}) -> allowed=${allowed}`);
        return allowed ? [true] : false;
    },

    matchScopeIntersection: (block, context, config = {}) => {
        const permissionKey = block.permission || block.value;
        const contextProperty = block.property;
        if (!permissionKey) return false;

        const normalizedKey = String(permissionKey).toLowerCase();
        const permissionsFound = [];
        for (const cat of (context.capabilities || [])) {
            const p = (cat.permissions || []).find(p => p.key.toLowerCase() === normalizedKey);
            if (p) permissionsFound.push(p);
        }

        if (permissionsFound.length === 0) return false;

        const match = permissionsFound.some(foundPerm => {
            if (!foundPerm.customers || foundPerm.customers.length === 0) return true;
            let requiredScope = context[contextProperty];
            if (!requiredScope && contextProperty === 'customers') {
                requiredScope = context.metadata?.companyId || context.metadata?.customerId || context.metadata?.targetPersonId;
            }
            if (!requiredScope) return false;
            if (Array.isArray(requiredScope)) return requiredScope.some(id => foundPerm.customers.includes(id));
            return foundPerm.customers.includes(requiredScope);
        });

        config.logger?.debug(`Plexus: [matchScopeIntersection] key=${permissionKey}, prop=${contextProperty} -> match=${match}`);
        return match ? [true] : false;
    },

    matchNever: () => false
};

/**
 * Universal Matcher Engine
 * Evaluates a set of matchers (terms) against a context.
 */
export function evaluateMatchers(matchers, operator = 'AND', context, config = {}) {
    if (!Array.isArray(matchers) || matchers.length === 0) return [true];

    const results = [];
    for (const matcher of matchers) {
        let type = matcher.type || matcher.primitive;
        
        // Synthetic Type Inference (SDN-0195)
        if (!type) {
            if (matcher.persona) { type = 'matchPersona'; matcher.value = matcher.persona; }
            else if (matcher.sense) { type = 'matchSense'; matcher.value = matcher.sense; }
            else if (matcher.realm) { type = 'matchRealm'; matcher.value = matcher.realm; }
            else if (matcher.property) { type = 'matchProperty'; matcher.value = matcher.value; matcher.key = matcher.property; }
            else if (matcher.always) { type = 'matchAlways'; }
        }

        const primitiveFn = Primitives[type];
        if (!primitiveFn) {
            config.logger?.warn(`Plexus: Unknown primitive type: ${type}`);
            results.push(false);
            continue;
        }

        const matched = primitiveFn(matcher, context, config);
        results.push(matched);
    }

    if (operator === 'AND') {
        const allMatched = results.every(r => r !== false);
        if (!allMatched) return false;
        
        const combined = [];
        results.forEach(r => {
            if (Array.isArray(r)) combined.push(...r);
            else if (r !== false) combined.push(r);
        });
        return combined.length > 0 ? [...new Set(combined)] : [true];
    }

    if (operator === 'OR') {
        const someMatched = results.some(r => r !== false);
        if (!someMatched) return false;
        
        const combined = [];
        results.filter(r => r !== false).forEach(r => {
            if (Array.isArray(r)) combined.push(...r);
            else combined.push(r);
        });
        return combined.length > 0 ? [...new Set(combined)] : [true];
    }

    return false;
}

export const SegmentationEngine = {
    evaluateMatchers,
    Primitives
};
