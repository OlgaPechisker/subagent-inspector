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
    const safeName = trace.agentName.replace(/[^a-zA-Z0-9-_]/g, '-');
    const shortId = (trace.agentId ?? 'unknown').slice(0, 8);
    return `${ts}-${safeName}-${shortId}`;
}

export function writeLog(trace, logDir = DEFAULT_LOG_DIR) {
    ensureLogDir(logDir);
    const base = join(logDir, buildFileName(trace));
    const jsonPath = `${base}.json`;
    const mdPath = `${base}.md`;
    writeFileSync(jsonPath, JSON.stringify(toLogObject(trace), null, 2), 'utf-8');
    writeFileSync(mdPath, toMarkdown(trace), 'utf-8');
    return { jsonPath, mdPath };
}

// Alias — same as writeLog but named for clarity in shutdown contexts
export const writeLogSync = writeLog;

export function listRecentLogs(count = 10, logDir = DEFAULT_LOG_DIR) {
    if (!existsSync(logDir)) return [];
    return readdirSync(logDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, count)
        .map(name => ({ name, path: join(logDir, name) }));
}

export function readLogMarkdown(prefix, logDir = DEFAULT_LOG_DIR) {
    if (!existsSync(logDir)) return null;
    const match = readdirSync(logDir)
        .filter(f => f.endsWith('.md'))
        .find(f => f.startsWith(prefix));
    if (!match) return null;
    return readFileSync(join(logDir, match), 'utf-8');
}
