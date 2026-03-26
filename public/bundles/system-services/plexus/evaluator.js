/**
 * Phase 1: Dynamic Evaluator (Layered Refactor)
 * Separates matching primitives (Layer 1) from domain composites (Layer 2).
 */

// Layer 1: Rule Primitives (The Matchers)
const Primitives = {
    matchAlways: (_block, _context) => [true],
    
    matchFeature: (_block, _context) => [true], // Simulated: in real system checks environment flags
    
    matchLicenseholder: (_block, _context) => [true], // Simulated: in real system checks license owner status
    
    matchRole: (block, context, _config) => {
        const active = context.activeBusinessFunction || [];
        const roles = Array.isArray(active) ? active : [active];
        const authorities = context.userAuthorities || {};
        const matches = [];
        
        const roleId = block.value; 
        if (!roleId) return false;

        // Normalize: handle singular/plural variations for better matching
        const searchIds = [roleId];
        if (roleId.endsWith('S')) searchIds.push(roleId.slice(0, -1));
        else searchIds.push(roleId + 'S');
        
        // 1. Check all matching labels in authorities (Live Mode enriched)
        // e.g., LEGALREP (managing-partner) -> 'bikevalue'
        Object.keys(authorities).forEach(authKey => {
            searchIds.forEach(sid => {
                if (authKey === sid || authKey.startsWith(`${sid} (`) || authKey.startsWith(`${sid}-`)) {
                    let val = authorities[authKey];
                    if (val === context.userId) val = true;
                    if (val) matches.push(val);
                }
            });
        });

        // 2. Fallbacks: Only grant wildcard 'true' if we did NOT find a specific scope in authorities
        // Otherwise, the wildcard 'true' will upgrade their scoped access to "All Customers"
        if (matches.length === 0) {
           if (roles.some(r => searchIds.includes(r))) {
               matches.push(true);
           }
        }
        
        // 3. (Integrated into searchIds mapping)

        // 4. Check explicit direct properties if still no match
        if (matches.length === 0 && searchIds.includes('ADMINISTRATOR') && context.administrator === true) {
            matches.push(true);
        }

        // 5. Role Aliases are omitted because mapping generic property names (like 'owner' or 'self') 
        // to `context[alias]` caused massive false positives (e.g. Robby having owner='rob').

        return matches.length > 0 ? matches : false;
    },

    matchProperty: (block, context) => {
        const val = context[block.key];
        if (Array.isArray(val)) {
            if (val.includes(block.value)) return [true];
            // Also handle case-insensitive or stringified comparison for robustness
            if (val.some(v => String(v).toLowerCase() === String(block.value).toLowerCase())) return [true];
        }
        if (val === block.value) return [true];
        if (String(val).toLowerCase() === String(block.value).toLowerCase()) return [true];
        return false;
    }
};

/**
 * Universal Matcher Engine
 * Evaluates a set of matchers (terms) against a context.
 */
export function evaluateMatchers(matchers, operator = 'AND', context, config) {
    // If no matchers, it's a global match (matchAlways equivalent)
    if (!Array.isArray(matchers) || matchers.length === 0) return [true];

    const results = [];
    for (const matcher of matchers) {
        const type = matcher.type || matcher.primitive;
        const primitiveFn = Primitives[type];
        if (!primitiveFn) {
            results.push(false);
            continue;
        }
        // Normalize matcher for primitive function
        const block = { ...matcher, primitive: type }; 
        const matched = primitiveFn(block, context, config);
        results.push(matched);
    }

    if (operator === 'AND') {
        const allMatched = results.every(r => r !== false);
        if (!allMatched) return false;
        
        // Combine results (prioritizing string authorities for scope matching)
        const combined = [];
        results.forEach(r => {
            if (Array.isArray(r)) combined.push(...r);
            else if (r !== false) combined.push(r);
        });
        return combined.length > 0 ? [...new Set(combined)] : [true];
    }

    return false;
}

export const SegmentationEngine = {
    evaluateMatchers,
    Primitives
};

// Layer 2: Domain Strategies (The Composites)
const Domains = {
    capabilities: (ruleBlocks, context, config, log, grantedKeys, categories) => {
        ruleBlocks.forEach(block => {
            const matchers = block.matchers || (block.primitive ? [{ ...block, type: block.primitive }] : []);
            const operator = block.operator || 'AND';

            const matchedList = evaluateMatchers(matchers, operator, context, config);
            const isMatch = matchedList !== false;
            
            const matchedLabel = isMatch ? `MATCH [${matchedList.join(', ')}]` : 'SKIP';
            log('trace', `  Capability: ${block.id || 'anonymous'} -> ${matchedLabel}`);

            if (isMatch) {
                const categoryName = `Strategy: ${block.id || 'anonymous'}`;
                const categoryEntry = {
                    category: categoryName,
                    permissions: []
                };
                categories.push(categoryEntry);

                const addPermission = (key, customers, source) => {
                    let perm = categoryEntry.permissions.find(p => p.key === key);
                    if (!perm) {
                        perm = { key, customers: [], sources: [] };
                        categoryEntry.permissions.push(perm);
                    }
                    if (customers && Array.isArray(customers)) {
                        customers.forEach(c => {
                            if (!perm.customers.includes(c)) perm.customers.push(c);
                        });
                    }
                    if (!perm.sources.includes(source)) perm.sources.push(source);
                };

                // 1. Direct Key Grants
                if (block.keys && Array.isArray(block.keys)) {
                    block.keys.forEach(k => {
                        const source = `Strategy: ${block.id || 'anonymous'}`;
                        if (!grantedKeys.has(k)) grantedKeys.set(k, new Set());
                        grantedKeys.get(k).add(source);
                        log('trace', `    + Directly Granted Key: ${k}`);
                        
                        addPermission(k, [], source);
                    });
                }

                // 2. Shaped Feature Attachments
                if (block.features && Array.isArray(block.features)) {
                    block.features.forEach(feat => {
                        const scope = feat.scope || 'ANY';
                        let scopeMatch = true;
                        let survivingAuthorities = [];

                        if (scope === 'OWN') {
                            const licenseMembers = config.licenseCustomers || [];
                            if (matchedList.includes(true)) {
                                survivingAuthorities = licenseMembers;
                            } else {
                                survivingAuthorities = matchedList.filter(a => typeof a === 'string' && licenseMembers.includes(a));
                            }
                            
                            scopeMatch = survivingAuthorities.length > 0;
                            if (!scopeMatch) {
                                log('trace', `    Feature Attachment: ${feat.id} -> SCOPE SKIP (None of [${matchedList.join(', ')}] in license members)`);
                            }
                        }

                        if (scopeMatch) {
                            const traceScope = scope === 'OWN' ? survivingAuthorities.join(', ') : scope;
                            const whitelistedKeys = feat.keys || [];

                            if (whitelistedKeys.length > 0) {
                                whitelistedKeys.forEach(k => {
                                    const source = `Strategy: ${block.id || 'anonymous'} > Feature: ${feat.id} (Scope: ${traceScope})`;
                                    if (!grantedKeys.has(k)) grantedKeys.set(k, new Set());
                                    grantedKeys.get(k).add(source);
                                    log('trace', `    Feature Attachment: ${feat.id} -> + Granted Key: ${k} (Scope: ${traceScope})`);

                                addPermission(k, scope === 'OWN' ? survivingAuthorities : [], source);
                            });
                        }
                    }
                });
            }
            }
        });
    },
    campaigns: (rules, context, config, log, _grantedKeys, _categories, results) => {
        const campaigns = config.campaigns || [];
        const strategies = rules || [];
        const assigned = [];
        results.campaigns = assigned;

        // Ensure we handle both array and object-based strategies
        const findStrategy = (id) => {
            if (Array.isArray(strategies)) return strategies.find(s => s.id === id);
            return strategies[id];
        };

        const rawChannels = context.channels || context.channel || ['business'];
        const userChannels = Array.isArray(rawChannels) ? rawChannels : [rawChannels];
        log('debug', `Campaign Eval: User=${context.userId}, Channels=[${userChannels.join(', ')}], campaigns=${campaigns.length}`);

        campaigns.forEach(camp => {
            const strategyName = camp.strategy;
            const strategy = findStrategy(strategyName);
            
            if (!strategy) {
                log('debug', `  Campaign ${camp.id}: Strategy [${strategyName}] NOT FOUND.`);
                return;
            }

            // Channel Filter
            const campChannels = Array.isArray(camp.channels) ? camp.channels : (camp.channels ? [camp.channels] : ['business']);
            const channelMatch = campChannels.some(c => userChannels.includes(c));
            
            log('debug', `Eval Campaign: ${camp.id} | Strategy: ${strategyName} | CampChannels: ${JSON.stringify(campChannels)} | UserChannels: ${JSON.stringify(userChannels)} | Match: ${channelMatch}`);

            if (!channelMatch) {
                log('debug', `  Campaign SKIP: ${camp.id} (Channel mismatch: User [${userChannels}] not in [${campChannels}])`);
                return;
            }

            const matchers = strategy.matchers || [];
            const operator = strategy.operator || 'AND';
            const matchedList = evaluateMatchers(matchers, operator, context, config);
            
            log('debug', `  Strategy matchers: ${JSON.stringify(matchers)} | Result: ${JSON.stringify(matchedList)}`);

            if (matchedList !== false) {
                const source = `Strategy: ${strategy.id || 'anonymous'} ([${matchers.map(m => m.type).join(', ')}])`;
                assigned.push({ ...camp, source });
                log('debug', `  Campaign GRANTED: ${camp.id} -> ${source}`);
            } else {
                log('debug', `  Campaign SKIP: ${camp.id} (Strategy ${strategyName} failed match)`);
            }
        });
    },
    topics: (rules, context, config, log, _grantedKeys, _categories, results) => {
        const topics = config.topics || [];
        const strategies = rules || [];
        const assigned = [];
        results.topics = assigned;

        strategies.forEach(strategy => {
            const matchers = strategy.matchers || [];
            const operator = strategy.operator || 'AND';
            const matchedList = evaluateMatchers(matchers, operator, context, config);
            
            if (matchedList !== false) {
                const source = `Strategy: ${strategy.id || 'anonymous'} ([${matchers.map(m => m.type).join(', ')}])`;
                topics.forEach(topic => {
                    const strategyId = (topic.strategy || 'global');
                    if (strategyId === strategy.id || (strategyId === 'global' && strategy.id === 'matchAlways')) {
                        assigned.push({ ...topic, source });
                        log('trace', `  Topic Granted: ${topic.id} -> ${source}`);
                    }
                });
            }
        });
    }
};

export function evaluateDynamic(config, context) {
    const grantedKeys = new Map();
    const categories = [];
    const results = {};
    const rules = config.rules;
    const logger = config.logger || console;
    const log = (level, msg) => logger[level] ? logger[level](msg) : console.log(`[${level.toUpperCase()}] ${msg}`);
    
    log('debug', `Starting Universal Dynamic Evaluation for Context: ${JSON.stringify(context)}`);

    // Process Domains (Layer 2 & 3)
    if (rules) {
        Object.keys(rules).forEach(domainKey => {
            const domainFn = Domains[domainKey];
            if (!domainFn) {
                log('debug', `Evaluation: Skipping unknown domain [${domainKey}]`);
                return;
            }

            log('trace', `Evaluating Domain: [${domainKey}]`);
            domainFn(rules[domainKey], context, config, log, grantedKeys, categories, results);
        });
    }

    // Layer 5: Post-Pipeline Enrichment (PERMISSIONBUNDLES)
    log('trace', `Evaluating Post-Pipeline Enrichment (PERMISSIONBUNDLES)`);
    if (config.licenses) {
        let bundlesToApply = [];
        config.licenses.forEach(license => {
            if (license.USERS) {
                const user = license.USERS.find(u => String(u.id) === String(context.userId));
                if (user && user.permissionbundles) {
                    bundlesToApply = [...bundlesToApply, ...user.permissionbundles];
                }
            }
        });

        if (bundlesToApply.length > 0) {
            config.licenses.forEach(license => {
                if (license.PERMISSIONBUNDLES) {
                    bundlesToApply.forEach(bundleName => {
                        const bundleDef = license.PERMISSIONBUNDLES.find(b => Object.keys(b)[0] === bundleName);
                        if (bundleDef) {
                            log('trace', `  Enriching with Bundle: ${bundleName}`);
                            const keys = bundleDef[bundleName];
                            if (Array.isArray(keys)) {
                                keys.forEach(k => {
                                    const source = `Bundle: ${bundleName}`;
                                    if (!grantedKeys.has(k)) grantedKeys.set(k, new Set());
                                    grantedKeys.get(k).add(source);
                                    log('trace', `    + Granted Key (from bundle): ${k}`);
                                });
                            }
                        }
                    });
                }
            });
        }
    }

    log('debug', `Evaluation Complete. Total Keys: ${grantedKeys.size}`);
    
    // Return structured result to avoid glue-code guesswork in UI
    const finalGrants = {};
    grantedKeys.forEach((sourcesSet, key) => {
        finalGrants[key] = Array.from(sourcesSet);
    });

    return {
        grantedKeys: finalGrants,
        categories: categories,
        ...results
    };
}

// Backward Compatibility Alias
export const evaluateCapabilitiesDynamic = evaluateDynamic;
