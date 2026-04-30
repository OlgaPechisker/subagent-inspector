import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, existsSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildFileName, buildSessionFolderName, ensureLogDir, writeLog, writeLogSync, listRecentLogs, listSessionLogs, readLogMarkdown } from '../writer.mjs';

function makeFakeTrace(overrides = {}) {
    return {
        agentId: 'abc12345-x',
        agentName: 'explore',
        agentDisplayName: 'Explorer',
        agentDescription: 'Test agent',
        toolCallId: 'tc-1',
        startedAt: '2026-04-29T10:00:00.000Z',
        invocationArgs: null,
        availableTools: ['grep'],
        systemPrompts: [],
        toolCalls: [],
        messages: [],
        permissions: [],
        errors: [],
        completedAt: '2026-04-29T10:00:05.000Z',
        status: 'completed',
        model: 'claude-haiku-4.5',
        durationMs: 5000,
        totalToolCalls: 0,
        failureReason: null,
        ...overrides,
    };
}

describe('buildFileName', () => {
    it('returns a string with timestamp, agentName, and agentId prefix', () => {
        const trace = makeFakeTrace();
        const name = buildFileName(trace);
        assert.ok(name.includes('explore'), 'should contain agentName');
        assert.ok(name.includes('abc12345'), 'should contain first 8 chars of agentId');
        assert.ok(name.startsWith('2026-04-29T10-00-00'), 'should start with ISO timestamp (colons replaced)');
    });

    it('sanitizes special characters in agentName', () => {
        const name = buildFileName(makeFakeTrace({ agentName: 'my agent!!' }));
        assert.ok(!name.includes('!'), 'should not contain !');
    });

    it('falls back to "unknown" when agentName is null', () => {
        const name = buildFileName(makeFakeTrace({ agentName: null }));
        assert.ok(name.includes('unknown'), 'should use fallback name');
    });
});

describe('buildSessionFolderName', () => {
    it('returns session-{shortId}-{safeName} format', () => {
        const sessionContext = { sessionId: 'abc12345-def6-7890-gh12-ijklmnopqrst', name: 'Build Extension' };
        const folderName = buildSessionFolderName(sessionContext);
        assert.equal(folderName, 'session-abc12345-Build-Extension');
    });

    it('sanitizes special characters in session name', () => {
        const sessionContext = { sessionId: 'xyz789', name: 'My Session! @#$%' };
        const folderName = buildSessionFolderName(sessionContext);
        assert.equal(folderName, 'session-xyz789-My-Session------');
    });

    it('uses "unnamed" when session name is null', () => {
        const sessionContext = { sessionId: 'abc12345', name: null };
        const folderName = buildSessionFolderName(sessionContext);
        assert.equal(folderName, 'session-abc12345-unnamed');
    });

    it('handles missing sessionId gracefully', () => {
        const sessionContext = { sessionId: null, name: 'Test' };
        const folderName = buildSessionFolderName(sessionContext);
        assert.equal(folderName, 'session-unknown-Test');
    });
});

describe('ensureLogDir', () => {
    let tmpDir;
    afterEach(() => { if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true }); });

    it('creates the directory if it does not exist', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        assert.ok(!existsSync(tmpDir));
        ensureLogDir(tmpDir);
        assert.ok(existsSync(tmpDir));
    });

    it('is idempotent when directory already exists', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        mkdirSync(tmpDir);
        assert.doesNotThrow(() => ensureLogDir(tmpDir));
    });
});

describe('writeLog', () => {
    let tmpDir;
    afterEach(() => { if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true }); });

    it('writes a .json and .md file and returns their paths', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        const { jsonPath, mdPath } = writeLog(makeFakeTrace(), null, tmpDir);
        assert.ok(existsSync(jsonPath), 'json file should exist');
        assert.ok(existsSync(mdPath), 'md file should exist');
        assert.ok(jsonPath.endsWith('.json'));
        assert.ok(mdPath.endsWith('.md'));
    });

    it('json file contains valid JSON with schemaVersion "1.0"', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        const { jsonPath } = writeLog(makeFakeTrace(), null, tmpDir);
        const parsed = JSON.parse(readFileSync(jsonPath, 'utf-8'));
        assert.equal(parsed.schemaVersion, '1.0');
        assert.equal(parsed.meta.agentName, 'explore');
    });

    it('writes to session folder when sessionContext provided', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        const sessionContext = { sessionId: 'abc12345-x', name: 'Test Session' };
        const { jsonPath, mdPath } = writeLog(makeFakeTrace(), sessionContext, tmpDir);
        
        assert.ok(jsonPath.includes('session-abc12345-Test-Session'), 'should include session folder');
        assert.ok(existsSync(jsonPath), 'json file should exist in session folder');
        assert.ok(existsSync(mdPath), 'md file should exist in session folder');
    });

    it('creates session folder if it does not exist', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        const sessionContext = { sessionId: 'xyz789', name: 'New Session' };
        const sessionDir = join(tmpDir, 'session-xyz789-New-Session');
        
        assert.ok(!existsSync(sessionDir), 'session folder should not exist initially');
        writeLog(makeFakeTrace(), sessionContext, tmpDir);
        assert.ok(existsSync(sessionDir), 'session folder should be created');
    });

    it('writeLogSync is the same function reference as writeLog', () => {
        assert.strictEqual(writeLogSync, writeLog);
    });
});

describe('listRecentLogs', () => {
    let tmpDir;
    afterEach(() => { if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true }); });

    it('returns empty sessions and flatLogs when directory does not exist', () => {
        const result = listRecentLogs(10, '/nonexistent/path/si-logs');
        assert.deepEqual(result, { sessions: [], flatLogs: [] });
    });

    it('returns flat logs when no session directories exist', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        mkdirSync(tmpDir);
        writeFileSync(join(tmpDir, '2026-04-29T09-00-00-explore-aaaa.json'), '{}');
        writeFileSync(join(tmpDir, '2026-04-29T10-00-00-task-bbbb.json'), '{}');
        writeFileSync(join(tmpDir, '2026-04-29T11-00-00-general-cccc.json'), '{}');
        const result = listRecentLogs(2, tmpDir);
        assert.equal(result.sessions.length, 0);
        assert.equal(result.flatLogs.length, 2);
        assert.ok(result.flatLogs[0].name.includes('general'), 'newest first');
    });

    it('returns sessions when session directories exist', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        mkdirSync(tmpDir);
        const sessionDir = join(tmpDir, 'session-abc12345-Test-Session');
        mkdirSync(sessionDir);
        writeFileSync(join(sessionDir, '2026-04-29T10-00-00-explore-x.json'), '{}');
        writeFileSync(join(sessionDir, '2026-04-29T11-00-00-task-y.json'), '{}');
        
        const result = listRecentLogs(10, tmpDir);
        assert.equal(result.sessions.length, 1);
        assert.equal(result.sessions[0].name, 'session-abc12345-Test-Session');
        assert.equal(result.sessions[0].logCount, 2);
    });

    it('returns both sessions and flat logs', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        mkdirSync(tmpDir);
        
        const sessionDir = join(tmpDir, 'session-xyz789-Other');
        mkdirSync(sessionDir);
        writeFileSync(join(sessionDir, '2026-log.json'), '{}');
        
        writeFileSync(join(tmpDir, '2026-flat-log.json'), '{}');
        
        const result = listRecentLogs(10, tmpDir);
        assert.equal(result.sessions.length, 1);
        assert.equal(result.flatLogs.length, 1);
    });
});

describe('readLogMarkdown', () => {
    let tmpDir;
    afterEach(() => { if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true }); });

    it('returns null when no matching file exists', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        mkdirSync(tmpDir);
        assert.equal(readLogMarkdown('2026-nonexistent', tmpDir), null);
    });

    it('returns file content for a prefix match', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        mkdirSync(tmpDir);
        writeFileSync(join(tmpDir, '2026-04-29T10-00-00-explore-abc12345.md'), '# My Log\nContent here.');
        const content = readLogMarkdown('2026-04-29T10-00-00-explore', tmpDir);
        assert.ok(content.includes('# My Log'));
    });

    it('searches session directories when no flat log matches', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        mkdirSync(tmpDir);
        const sessionDir = join(tmpDir, 'session-xyz-Test');
        mkdirSync(sessionDir);
        writeFileSync(join(sessionDir, '2026-04-29T11-00-00-task-y.md'), '# Session Log\nIn session.');
        const content = readLogMarkdown('2026-04-29T11-00-00-task', tmpDir);
        assert.ok(content.includes('# Session Log'));
    });
});

describe('listSessionLogs', () => {
    let tmpDir;
    afterEach(() => { if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true }); });

    it('returns null when no matching session directory exists', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        mkdirSync(tmpDir);
        const result = listSessionLogs('session-nonexistent', tmpDir);
        assert.equal(result, null);
    });

    it('returns logs in matching session directory', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        mkdirSync(tmpDir);
        const sessionDir = join(tmpDir, 'session-abc12345-Test');
        mkdirSync(sessionDir);
        writeFileSync(join(sessionDir, '2026-04-29T10-00-00-explore-x.json'), '{}');
        writeFileSync(join(sessionDir, '2026-04-29T11-00-00-task-y.json'), '{}');
        
        const result = listSessionLogs('session-abc12345', tmpDir);
        assert.equal(result.sessionName, 'session-abc12345-Test');
        assert.equal(result.logs.length, 2);
        assert.ok(result.logs[0].name.includes('task'), 'newest first');
    });

    it('matches session by prefix', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        mkdirSync(tmpDir);
        const sessionDir = join(tmpDir, 'session-xyz789-Other-Session');
        mkdirSync(sessionDir);
        writeFileSync(join(sessionDir, 'log.json'), '{}');
        
        const result = listSessionLogs('session-xyz', tmpDir);
        assert.equal(result.sessionName, 'session-xyz789-Other-Session');
        assert.equal(result.logs.length, 1);
    });
});
