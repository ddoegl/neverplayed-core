/**
 * Phase 2: Compilation Engine (Layered Refactor)
 * Transforms declarative YAML into a highly-optimized single flat JS function.
 */

export function compileEvaluator(config) {
    const { rules, licenses, _catalog } = config;
    const roleAliases = config.roleAliases || {};
    const licenseMembers = config.licenseCustomers || [];
    
    let fnBody = `const granted = new Set();\n`;
    fnBody += `const log = (msg) => { if (logger && logger.trace) logger.trace(msg); };\n`;
    fnBody += `if (logger && logger.debug) logger.debug('Starting Layered Compiled Evaluation for Context: ' + JSON.stringify(context));\n`;

    // Process Domains (Layer 2 & 3)
    if (rules) {
        Object.keys(rules).forEach(domainKey => {
            const domainBlocks = rules[domainKey];
            if (!Array.isArray(domainBlocks)) return;

            fnBody += `\n// Evaluating Domain: [${domainKey}]\n`;
            
            domainBlocks.forEach(block => {
                fnBody += `{\n`; // Start Block Scope
                
                const matchers = block.matchers || (block.primitive ? [{ ...block, type: block.primitive }] : []);
                const operator = block.operator || 'AND';

                // Activation Check
                const activePrimitives = config.activePrimitives || null;
                if (activePrimitives) {
                    const hasForbidden = matchers.some(m => !activePrimitives.includes(m.type || m.primitive));
                    if (hasForbidden) {
                        fnBody += `  log('  Capability: ${block.id || 'anonymous'} -> SKIP (Matcher Type Deactivated)');\n`;
                        fnBody += `}\n`;
                        return;
                    }
                }

                fnBody += `  const matchedValues = ((() => {\n`;
                fnBody += `    const results = [];\n`;
                
                matchers.forEach((m, mIdx) => {
                    const type = m.type || m.primitive;
                    let mCode = 'false';
                    switch (type) {
                        case 'matchAlways': mCode = `[true]`; break;
                        case 'matchFeature': mCode = `[true]`; break;
                        case 'matchLicenseholder': mCode = `[true]`; break;
                        case 'matchRole': {
                            const roleId = m.value;
                            const searchIds = [roleId];
                            if (roleId.endsWith('S')) searchIds.push(roleId.slice(0, -1));
                            else searchIds.push(roleId + 'S');
                            mCode = `((() => {
                                const auths = context.userAuthorities || {};
                                const sIds = ${JSON.stringify(searchIds)};
                                const active = Array.isArray(context.activeBusinessFunction) ? context.activeBusinessFunction : (context.activeBusinessFunction ? [context.activeBusinessFunction] : []);
                                const ms = [];
                                active.forEach(r => sIds.forEach(s => { if(r === s || r.startsWith(s + ' (')) { const v = auths[r]; if(v) ms.push(v); } }));
                                if(active.some(r => sIds.includes(r))) ms.push(true);
                                if(sIds.includes('ADMINISTRATOR') && context.administrator === true) ms.push(true);
                                ${searchIds.flatMap(s => (roleAliases[s]||[]).map(a => `if(context['${a}']) ms.push(true);`)).join('\n')}
                                return ms.length > 0 ? ms : false;
                            })())`;
                            break;
                        }
                        case 'matchProperty':
                            mCode = `(context['${m.key}'] === '${m.value}' ? [true] : false)`;
                            break;
                    }
                    fnBody += `    const res${mIdx} = ${mCode};\n`;
                    fnBody += `    if (res${mIdx} === false) return [];\n`;
                    fnBody += `    results.push(res${mIdx});\n`;
                });

                if (operator === 'AND') {
                   fnBody += `    const combined = [];\n`;
                   fnBody += `    results.forEach(r => { if(Array.isArray(r)) combined.push(...r); else combined.push(r); });\n`;
                   fnBody += `    return combined.length > 0 ? [...new Set(combined)] : [true];\n`;
                } else {
                   fnBody += `    return [];\n`; // Default fallback for unsupported operators
                }
                fnBody += `  })());\n`;

                fnBody += `  if (matchedValues.length > 0) {\n`;
                fnBody += `    log('  Capability: ${block.id || 'anonymous'} -> MATCH');\n`;

                const blockKeys = block.keys || [];
                if (blockKeys.length > 0) {
                    [...new Set(blockKeys)].forEach(k => {
                        fnBody += `    granted.add('${k}');\n`;
                        fnBody += `    log('    + Directly Granted Key: ${k}');\n`;
                    });
                }

                if (block.features && Array.isArray(block.features)) {
                    block.features.forEach(feat => {
                        const scope = feat.scope || 'ANY';
                        let scopeCondition = 'true';
                        
                        if (scope === 'OWN') {
                            fnBody += `    const scopeMembers_${feat.id} = [${licenseMembers.map(m => `'${m}'`).join(',')}];\n`;
                            fnBody += `    const survivingAuths_${feat.id} = matchedValues.filter(a => typeof a === 'string' && scopeMembers_${feat.id}.includes(a));\n`;
                            scopeCondition = `survivingAuths_${feat.id}.length > 0`;
                        }
                        
                        fnBody += `    if (${scopeCondition}) {\n`;
                        const whitelistedKeys = feat.keys || [];

                        if (whitelistedKeys.length > 0) {
                            [...new Set(whitelistedKeys)].forEach(k => {
                                fnBody += `      granted.add('${k}');\n`;
                                if (scope === 'OWN') {
                                    fnBody += `      log('    Feature Attachment: ${feat.id} -> + Granted Key: ${k} (Scope: ' + survivingAuths_${feat.id}.join(', ') + ')');\n`;
                                } else {
                                    fnBody += `      log('    Feature Attachment: ${feat.id} -> + Granted Key: ${k} (Scope: ${scope})');\n`;
                                }
                            });
                        }
                        fnBody += `    }\n`;
                    });
                }

                fnBody += `  }\n`;
                fnBody += `}\n`; // End Block Scope
            });
        });
    }

    // Phase 5: Fast lookup for Post-Pipeline Enrichment (PERMISSIONBUNDLES)
    const userBundleMap = {}; 
    if (licenses) {
        licenses.forEach(license => {
            if (!license.USERS || !license.PERMISSIONBUNDLES) return;
            const parsedBundles = {};
            license.PERMISSIONBUNDLES.forEach(b => {
                const name = Object.keys(b)[0];
                parsedBundles[name] = b[name];
            });
            license.USERS.forEach(user => {
                if (user.permissionbundles) {
                    userBundleMap[user.id] = [];
                    user.permissionbundles.forEach(name => {
                        if (parsedBundles[name]) {
                            parsedBundles[name].forEach(k => userBundleMap[user.id].push(k));
                        }
                    });
                }
            });
        });
    }
    
    fnBody += `\n// Fast lookup table for user enrichment\n`;
    fnBody += `const userOverrides = ${JSON.stringify(userBundleMap)};\n`;
    fnBody += `if (context.userId && userOverrides[context.userId]) {\n`;
    fnBody += `  log('  Matched Post-Pipeline Enrichment for userId: ' + context.userId);\n`;
    fnBody += `  userOverrides[context.userId].forEach(k => {\n`;
    fnBody += `    granted.add(k);\n`;
    fnBody += `    log('    + Granted Key [bundle]: ' + k);\n`;
    fnBody += `  });\n`;
    fnBody += `}\n`;

    fnBody += `\nif (logger && logger.debug) logger.debug('Compiled Evaluation Complete. Total Keys: ' + granted.size);\n`;
    fnBody += `return granted;`;

    return new Function('context', 'logger', fnBody);
}
