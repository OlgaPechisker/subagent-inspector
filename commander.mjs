// commander.mjs — /subagent-logs slash command implementation.

import { listRecentLogs, readLogMarkdown } from './writer.mjs';

/**
 * Creates the /subagent-logs command definition.
 * @param {object} sessionRef - Object with { current: CopilotSession } — use a ref so the
 *                              command closure can access the session after joinSession() returns.
 * @param {string} logDir
 */
export function createSlashCommand(sessionRef, logDir) {
    return {
        name: 'subagent-logs',
        description: 'List recent subagent logs or view one. Usage: /subagent-logs [prefix]',
        handler: async (context) => {
            const session = sessionRef.current;
            if (!session) {
                console.error('[subagent-inspector] /subagent-logs handler invoked before session was initialized');
                return;
            }
            const prefix = context.args.trim();

            if (prefix) {
                const content = readLogMarkdown(prefix, logDir);
                if (!content) {
                    await session.log(`No log found matching prefix "${prefix}"`, { level: 'warning' });
                    return;
                }
                // Post in ≤800-char chunks; guard against individual lines > 800 chars
                const lines = content.split('\n');
                let chunk = '';
                for (const line of lines) {
                    if (chunk && (chunk + line + '\n').length > 800) {
                        if (chunk.trim()) await session.log(chunk.trimEnd());
                        chunk = '';
                    }
                    if ((line + '\n').length > 800) {
                        // Force-split lines that are themselves over the limit
                        let rem = line;
                        while (rem.length > 799) {
                            await session.log(rem.slice(0, 799));
                            rem = rem.slice(799);
                        }
                        chunk = rem + '\n';
                    } else {
                        chunk += line + '\n';
                    }
                }
                if (chunk.trim()) await session.log(chunk.trimEnd());
            } else {
                const logs = listRecentLogs(10, logDir);
                if (logs.length === 0) {
                    await session.log('No subagent logs found in ' + logDir);
                    return;
                }
                const list = logs.map((l, i) => `${i + 1}. ${l.name.replace(/\.json$/, '')}`).join('\n');
                await session.log(`Recent subagent logs — use a prefix to view one (${logDir}):\n${list}`);
            }
        },
    };
}
