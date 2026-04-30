// commander.mjs — /subagent-logs slash command implementation.

import { listRecentLogs, listSessionLogs, readLogMarkdown } from './writer.mjs';

/**
 * Creates the /subagent-logs command definition.
 * @param {object} sessionRef - Object with { current: CopilotSession } — use a ref so the
 *                              command closure can access the session after joinSession() returns.
 * @param {string} logDir
 */
export function createSlashCommand(sessionRef, logDir) {
    return {
        name: 'subagent-logs',
        description: 'List recent subagent logs or view one. Usage: /subagent-logs [session-prefix|log-prefix]',
        handler: async (context) => {
            const session = sessionRef.current;
            if (!session) {
                console.error('[subagent-inspector] /subagent-logs handler invoked before session was initialized');
                return;
            }
            const prefix = context.args.trim();

            if (prefix) {
                // Check if prefix matches a session directory
                const sessionLogs = listSessionLogs(prefix, logDir);
                if (sessionLogs) {
                    if (sessionLogs.logs.length === 0) {
                        await session.log(`Session "${sessionLogs.sessionName}" has no logs yet.`);
                        return;
                    }
                    const list = sessionLogs.logs.map((l, i) => `${i + 1}. ${l.name.replace(/\.json$/, '')}`).join('\n');
                    await session.log(`Logs in ${sessionLogs.sessionName} (${sessionLogs.logs.length}):\n${list}`);
                    return;
                }
                
                // Try to read as log file prefix
                const content = readLogMarkdown(prefix, logDir);
                if (!content) {
                    await session.log(`No session or log found matching prefix "${prefix}"`, { level: 'warning' });
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
                // List sessions and flat logs
                const { sessions, flatLogs } = listRecentLogs(10, logDir);
                if (sessions.length === 0 && flatLogs.length === 0) {
                    await session.log('No subagent logs found in ' + logDir);
                    return;
                }
                
                let output = 'Recent subagent logs — use a prefix to view:\n\n';
                
                if (sessions.length > 0) {
                    output += 'Sessions:\n';
                    output += sessions.map((s, i) => `  ${i + 1}. ${s.name} (${s.logCount} logs)`).join('\n');
                    output += '\n\n';
                }
                
                if (flatLogs.length > 0) {
                    output += flatLogs.length > 0 && sessions.length > 0 ? 'Flat logs (legacy):\n' : 'Logs:\n';
                    output += flatLogs.map((l, i) => `  ${i + 1}. ${l.name.replace(/\.json$/, '')}`).join('\n');
                }
                
                await session.log(output.trimEnd());
            }
        },
    };
}
