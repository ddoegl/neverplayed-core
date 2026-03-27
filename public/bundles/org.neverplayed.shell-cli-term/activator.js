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
            const color = entry.type === 'error' ? "\x1b[31m" : "\x1b[36m";
            const reset = "\x1b[0m";
            
            let cleanContent = entry.content.replace(/<[^>]*>/g, '');
            cleanContent = cleanContent.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join('\n');

            // Move to start of line, clear it, print log, then redraw prompt
            Deno.stdout.writeSync(new TextEncoder().encode(`\r\x1b[K${color}${cleanContent}${reset}\n`));
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
