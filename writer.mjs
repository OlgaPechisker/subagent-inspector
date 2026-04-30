// writer.mjs — File I/O for subagent log persistence.

import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
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

export function buildSessionFolderName(sessionContext) {
    const sessionIdShort = (sessionContext.sessionId ?? 'unknown').slice(0, 8);
    const safeName = (sessionContext.name ?? 'unnamed').replace(/[^a-zA-Z0-9-_]/g, '-');
    return `session-${sessionIdShort}-${safeName}`;
}

export function writeLog(trace, sessionContext = null, logDir = DEFAULT_LOG_DIR) {
    // Determine target directory: session-scoped if sessionContext provided, else flat
    let targetDir = logDir;
    if (sessionContext) {
        const sessionFolder = buildSessionFolderName(sessionContext);
        targetDir = join(logDir, sessionFolder);
    }
    
    ensureLogDir(targetDir);
    const base = join(targetDir, buildFileName(trace));
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
    if (!existsSync(logDir)) return { sessions: [], flatLogs: [] };
    
    let entries;
    try {
        entries = readdirSync(logDir);
    } catch {
        return { sessions: [], flatLogs: [] };
    }
    
    const sessions = [];
    const flatLogs = [];
    
    // Separate session directories from flat log files
    for (const entry of entries) {
        const fullPath = join(logDir, entry);
        try {
            if (statSync(fullPath).isDirectory() && entry.startsWith('session-')) {
                const sessionLogs = readdirSync(fullPath)
                    .filter(f => f.endsWith('.json'))
                    .map(f => ({ name: f, path: join(fullPath, f) }));
                sessions.push({ name: entry, path: fullPath, logCount: sessionLogs.length });
            } else if (entry.endsWith('.json')) {
                flatLogs.push({ name: entry, path: fullPath });
            }
        } catch {
            // Ignore entries we can't stat
        }
    }
    
    // Sort sessions by name (newest first based on timestamp in name)
    sessions.sort((a, b) => b.name.localeCompare(a.name));
    
    // Sort flat logs newest first
    flatLogs.sort((a, b) => b.name.localeCompare(a.name));
    
    // Limit results
    return {
        sessions: sessions.slice(0, count),
        flatLogs: flatLogs.slice(0, count),
    };
}

export function listSessionLogs(sessionPrefix, logDir = DEFAULT_LOG_DIR) {
    if (!existsSync(logDir)) return null;
    
    let entries;
    try {
        entries = readdirSync(logDir);
    } catch {
        return null;
    }
    
    // Find matching session directory
    const sessionDirs = entries.filter(f => {
        try {
            const fullPath = join(logDir, f);
            return statSync(fullPath).isDirectory() && 
                   f.startsWith('session-') && 
                   f.startsWith(sessionPrefix);
        } catch {
            return false;
        }
    });
    
    if (sessionDirs.length === 0) return null;
    
    // Use first match
    const sessionDir = sessionDirs[0];
    const sessionPath = join(logDir, sessionDir);
    
    let files;
    try {
        files = readdirSync(sessionPath);
    } catch {
        return null;
    }
    
    const logs = files
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .map(name => ({ name, path: join(sessionPath, name) }));
    
    return { sessionName: sessionDir, logs };
}

export function readLogMarkdown(prefix, logDir = DEFAULT_LOG_DIR) {
    if (!existsSync(logDir)) return null;
    
    let files;
    try {
        files = readdirSync(logDir);
    } catch {
        return null;
    }
    
    // First try flat logs
    let match = files
        .filter(f => {
            try {
                return f.endsWith('.md') && !statSync(join(logDir, f)).isDirectory();
            } catch {
                return false;
            }
        })
        .find(f => f.startsWith(prefix));
    
    if (match) return readFileSync(join(logDir, match), 'utf-8');
    
    // Then try session subdirectories
    const sessionDirs = files.filter(f => {
        try {
            const fullPath = join(logDir, f);
            return statSync(fullPath).isDirectory() && f.startsWith('session-');
        } catch {
            return false;
        }
    });
    
    for (const sessionDir of sessionDirs) {
        const sessionPath = join(logDir, sessionDir);
        let sessionFiles;
        try {
            sessionFiles = readdirSync(sessionPath);
        } catch {
            continue;
        }
        
        match = sessionFiles
            .filter(f => f.endsWith('.md'))
            .find(f => f.startsWith(prefix));
        
        if (match) return readFileSync(join(sessionPath, match), 'utf-8');
    }
    
    return null;
}
