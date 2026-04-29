import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, existsSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildFileName, ensureLogDir, writeLog, writeLogSync, listRecentLogs, readLogMarkdown } from '../writer.mjs';

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
        const { jsonPath, mdPath } = writeLog(makeFakeTrace(), tmpDir);
        assert.ok(existsSync(jsonPath), 'json file should exist');
        assert.ok(existsSync(mdPath), 'md file should exist');
        assert.ok(jsonPath.endsWith('.json'));
        assert.ok(mdPath.endsWith('.md'));
    });

    it('json file contains valid JSON with schemaVersion "1.0"', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        const { jsonPath } = writeLog(makeFakeTrace(), tmpDir);
        const parsed = JSON.parse(readFileSync(jsonPath, 'utf-8'));
        assert.equal(parsed.schemaVersion, '1.0');
        assert.equal(parsed.meta.agentName, 'explore');
    });

    it('writeLogSync is the same function reference as writeLog', () => {
        assert.strictEqual(writeLogSync, writeLog);
    });
});

describe('listRecentLogs', () => {
    let tmpDir;
    afterEach(() => { if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true }); });

    it('returns empty array when directory does not exist', () => {
        const result = listRecentLogs(10, '/nonexistent/path/si-logs');
        assert.deepEqual(result, []);
    });

    it('returns at most count items, sorted newest first', () => {
        tmpDir = join(tmpdir(), `si-test-${Date.now()}`);
        mkdirSync(tmpDir);
        writeFileSync(join(tmpDir, '2026-04-29T09-00-00-explore-aaaa.json'), '{}');
        writeFileSync(join(tmpDir, '2026-04-29T10-00-00-task-bbbb.json'), '{}');
        writeFileSync(join(tmpDir, '2026-04-29T11-00-00-general-cccc.json'), '{}');
        const result = listRecentLogs(2, tmpDir);
        assert.equal(result.length, 2);
        assert.ok(result[0].name.includes('general'), 'newest first');
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
});
