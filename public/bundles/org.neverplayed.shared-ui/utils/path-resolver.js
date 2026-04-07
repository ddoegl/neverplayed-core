/**
 * PathResolver: Standalone utility for resolving and interpolating paths 
 * within the UIFactory context and spec.
 */

/**
 * Resolves a value from a scope (state) based on a path expression.
 * Supports deep resolution (e.g., 'user.profile.name') and prefixes ('this.', 'uifValues.', 'values.').
 * 
 * @param {string} expr - The path or expression to resolve.
 * @param {Object} scope - The primary scope (usually the reactive state).
 * @returns {*} The resolved value or undefined.
 */
export function resolveValue(expr, scope) {
    if (typeof expr !== 'string') return expr;
    
    // 0. Expression Guard: If it contains operators or spaces, it's NOT a simple path
    if (/[?|&:<>=!+\-]/.test(expr) || expr.includes(' ')) return undefined;
    
    // 2. Resolve Path Helper
    const resolvePath = (obj, p, forcePrefix = null) => {
        if (!obj || !p) return undefined;
        let cleanPath = p;
        
        const hasThis = cleanPath.startsWith('this.');
        const hasUif = cleanPath.startsWith('uifValues.');
        const hasValues = cleanPath.startsWith('values.');

        if (forcePrefix === 'this' && !hasThis) return undefined;

        if (hasThis) cleanPath = cleanPath.substring(5);
        if (hasUif) cleanPath = cleanPath.substring(10);
        if (hasValues) cleanPath = cleanPath.substring(7);
        
        return cleanPath.split('.').reduce((acc, part) => {
            if (acc === undefined || acc === null) return undefined;
            return (acc[part] !== undefined) ? acc[part] : undefined;
        }, obj);
    };

    // --- SCOPE PRECEDENCE ---
    // 1. If prefixed with 'this.', it's EXCLUSIVELY local flow state
    if (expr.startsWith('this.')) {
        return resolvePath(scope.uifValues, expr);
    }

    // 2. Otherwise: Local -> Global -> Root Scope
    return resolvePath(scope.uifValues, expr) ?? 
           resolvePath(scope.globals, expr) ?? 
           resolvePath(scope, expr);
}

/**
 * Interpolates a string containing ${path} or {{path}} placeholders.
 * 
 * @param {string} str - The string to interpolate.
 * @param {Object} scope - The primary scope (reactive state).
 * @param {Object} extra - Optional extra values for local resolution.
 * @param {Function} fallbackResolver - Optional fallback resolver for keys.
 * @returns {string} The interpolated string.
 */
export function interpolate(str, scope, extra = {}, fallbackResolver = null) {
    if (!str) return "";
    // Regex that captures the entire expression inside ${} or {{}}
    return str.replace(/(?:\${(.*?)}|\{\{\s*(.*?)\s*\}\})/g, (_, k1, k2) => {
        const fullExpr = k1 || k2;
        
        // 1. Check extra params first (simple keys only)
        if (extra[fullExpr] !== undefined && extra[fullExpr] !== null) return extra[fullExpr];

        // 2. Resolve via resolveValue logic for deep or prefixed paths
        const val = resolveValue(fullExpr, scope);
        if (val !== undefined && val !== null) return val;
        
        // 3. Optional fallback (e.g. to complex evaluator)
        if (typeof fallbackResolver === 'function') {
            const fallbackVal = fallbackResolver(fullExpr);
            if (fallbackVal !== undefined && fallbackVal !== null) return fallbackVal;
        }
        
        return _; // Preserve original match (${...}) if no resolution found to allow multi-pass resolution.
    });
}
