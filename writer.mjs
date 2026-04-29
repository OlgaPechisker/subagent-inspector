// writer.mjs — File I/O for subagent log persistence.

import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { toLogObject, toMarkdown } from './formatter.mjs';

export const DEFAULT_LOG_DIR = join(homedir(), '.copilot', 'subagent-logs');

export function ensureLogDir(logDir = DEFAULT_LOG_DIR) {
    mkdirSync(logDir, { recursive: true });
}

export function buildFileName(trace) {
    const ts = (trace.startedAt ?? new Date().toISOString())
        .replace(/:/g, '-')
        .replace(/\..+$/, '');
    const safeName = (trace.agentName ?? 'unknown').replace(/[^a-zA-Z0-9-_]/g, '-');
    const shortId = (trace.agentId ?? 'unknown').slice(0, 8);
    return `${ts}-${safeName}-${shortId}`;
}

export function writeLog(trace, logDir = DEFAULT_LOG_DIR) {
    ensureLogDir(logDir);
    const base = join(logDir, buildFileName(trace));
    const jsonPath = `${base}.json`;
    const mdPath = `${base}.md`;
    // Note: writes are not atomic. A failed .md write will leave an orphaned .json.
    // The error is intentionally propagated — there is no meaningful recovery here.
    writeFileSync(jsonPath, JSON.stringify(toLogObject(trace), null, 2), 'utf-8');
    writeFileSync(mdPath, toMarkdown(trace), 'utf-8');
    return { jsonPath, mdPath };
}

/**
 * Synchronous alias for writeLog. Use this variant in process shutdown contexts
 * (beforeExit, SIGTERM handlers) where async I/O would be abandoned before
 * completion. Because writeLog uses writeFileSync internally, both variants
 * are synchronous — but this name signals intent to callers.
 */
export const writeLogSync = writeLog;

export function listRecentLogs(count = 10, logDir = DEFAULT_LOG_DIR) {
    if (!existsSync(logDir)) return [];
    let files;
    try {
        files = readdirSync(logDir);
    } catch {
        return [];
    }
    return files
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, count)
        .map(name => ({ name, path: join(logDir, name) }));
}

export function readLogMarkdown(prefix, logDir = DEFAULT_LOG_DIR) {
    if (!existsSync(logDir)) return null;
    let files;
    try {
        files = readdirSync(logDir);
    } catch {
        return null;
    }
    const match = files
        .filter(f => f.endsWith('.md'))
        .find(f => f.startsWith(prefix));
    if (!match) return null;
    return readFileSync(join(logDir, match), 'utf-8');
}
