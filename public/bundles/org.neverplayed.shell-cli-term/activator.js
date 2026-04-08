/**
 * @file Activator for org.neverplayed.shell-cli-term
 * @module platform/bundles/org.neverplayed.shell-cli-term
 */

import { SHELL_CLI_SERVICE } from "core-types";
import { BaseActivator } from "osgi-base";
import readline from "node:readline";
import process from "node:process";

export default class Activator extends BaseActivator {
    onStart(context) {
        if (!this.isHeadless) return;

        context.trackService(`(objectClass=${SHELL_CLI_SERVICE})`, {
            addingService: (ref) => {
                const shellService = context.getService(ref);
                this.startTerminal(shellService);
                return shellService;
            }
        }).open();
    }

    async startTerminal(shellService) {
        this.active = true;
        this.logger.info("Terminal Shell: Interactive session starting...");
        
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: "neverplayed> ",
            terminal: true
        });

        // 1. Subscribe to output to print it to stdout
        shellService.subscribe(entry => {
            if (entry.type === 'input') return;
            
            if (entry.type === 'clear') {
                // Clear screen and scrollback, then move cursor to 1,1
                process.stdout.write('\x1bc');
                rl.prompt(true);
                return;
            }

            const reset = "\x1b[0m";
            let content = entry.content;
            let color = entry.type === 'error' ? "\x1b[31m" : "\x1b[36m"; // Default cyan or red
            let bold = "";

            if (typeof content === 'object' && content !== null) {
                if (content.text) {
                    const colorMap = {
                        blue: "\x1b[34m",
                        green: "\x1b[32m",
                        yellow: "\x1b[33m",
                        red: "\x1b[31m",
                        cyan: "\x1b[36m",
                        magenta: "\x1b[35m",
                        gray: "\x1b[90m"
                    };
                    color = colorMap[content.color] || color;
                    bold = content.bold ? "\x1b[1m" : "";
                    content = content.text;
                } else {
                    content = JSON.stringify(content, null, 2);
                }
            } else {
                // Strip HTML only if it looks like there's any (light safety net)
                content = String(content);
                if (content.includes('<') && content.includes('>')) {
                    content = content.replace(/<[^>]*>/g, '');
                }
            }
            
            content = content.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join('\n');

            // Move to start of line, clear it, print log, then redraw prompt
            const output = `\r\x1b[K${bold}${color}${content}${reset}\n`;
            process.stdout.write(output);
            rl.prompt(true);
        });

        rl.on('line', async (line) => {
            const input = line.trim();
            if (input === '/exit' || input === '/quit') {
                rl.close();
                return;
            }
            if (input) {
                await shellService.execute(input);
            }
            rl.prompt();
        });

        rl.on('close', () => {
            this.active = false;
            this.logger.info("Terminal Shell: Interactive session closed.");
        });

        // Use a small delay for clean start
        await new Promise(r => setTimeout(r, 500));
        rl.prompt();
    }

    stop(_context) {
        this.active = false;
    }
}
