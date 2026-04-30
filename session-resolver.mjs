// session-resolver.mjs — Resolves human-friendly session names from workspace metadata.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolves a human-friendly session name from the Copilot session.
 * 
 * Strategy:
 * 1. If session.workspacePath exists, read workspace.yaml and extract the "name" field
 * 2. Fallback to "unnamed" if workspacePath is unavailable or file read fails
 * 
 * @param {Object} session - The CopilotSession instance from joinSession()
 * @returns {string} Session name (e.g., "Build Subagent Logging Extension") or "unnamed"
 */
export function resolveSessionName(session) {
    if (!session.workspacePath) {
        return 'unnamed';
    }

    try {
        const workspaceYaml = readFileSync(join(session.workspacePath, 'workspace.yaml'), 'utf-8');
        // Simple YAML parsing: look for "name: <value>" line
        const match = workspaceYaml.match(/^name:\s*(.+)$/m);
        return match ? match[1].trim() : 'unnamed';
    } catch {
        return 'unnamed';
    }
}

/**
 * Builds a session context object for log grouping.
 * 
 * @param {Object} session - The CopilotSession instance from joinSession()
 * @returns {{ sessionId: string, name: string }} Session context with ID and name
 */
export function buildSessionContext(session) {
    return {
        sessionId: session.sessionId,
        name: resolveSessionName(session),
    };
}
