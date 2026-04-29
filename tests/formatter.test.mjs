import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toLogObject, toMarkdown, toTimelineSummary } from '../formatter.mjs';

function makeTrace(overrides = {}) {
    return {
        agentId: 'abc12345',
        agentName: 'explore',
        agentDisplayName: 'Explorer',
        agentDescription: 'Explores the codebase',
        toolCallId: 'tc-1',
        startedAt: '2026-04-29T10:00:00.000Z',
        invocationArgs: { prompt: 'Analyze all tests', agent_type: 'explore', mode: 'sync' },
        availableTools: ['grep', 'glob', 'view'],
        systemPrompts: [{ timestamp: '2026-04-29T10:00:00.100Z', content: 'You are a fast exploration agent.' }],
        toolCalls: [
            { toolCallId: 'tc-a', toolName: 'grep', args: { pattern: 'test' }, result: '3 matches', success: true, error: null, startedAt: '2026-04-29T10:00:01.000Z', completedAt: '2026-04-29T10:00:01.200Z', durationMs: 200 },
        ],
        messages: [
            { timestamp: '2026-04-29T10:00:02.000Z', content: 'Found 3 test files.', toolRequests: null },
        ],
        permissions: [
            { requestId: 'r1', requestedAt: '2026-04-29T10:00:00.500Z', kind: 'shell', completedAt: '2026-04-29T10:00:00.600Z', decision: 'approved' },
        ],
        errors: [],
        completedAt: '2026-04-29T10:00:05.000Z',
        status: 'completed',
        model: 'claude-haiku-4.5',
        durationMs: 5000,
        totalToolCalls: 1,
        failureReason: null,
        ...overrides,
    };
}

describe('toLogObject', () => {
    it('returns an object with schemaVersion "1.0"', () => {
        const obj = toLogObject(makeTrace());
        assert.equal(obj.schemaVersion, '1.0');
    });

    it('includes meta with agentId, model, status', () => {
        const obj = toLogObject(makeTrace());
        assert.equal(obj.meta.agentId, 'abc12345');
        assert.equal(obj.meta.model, 'claude-haiku-4.5');
        assert.equal(obj.meta.status, 'completed');
    });

    it('includes invocationArgs, availableTools, systemPrompts', () => {
        const obj = toLogObject(makeTrace());
        assert.deepEqual(obj.availableTools, ['grep', 'glob', 'view']);
        assert.equal(obj.systemPrompts[0].content, 'You are a fast exploration agent.');
        assert.equal(obj.invocationArgs.prompt, 'Analyze all tests');
    });

    it('conversation is sorted chronologically', () => {
        const obj = toLogObject(makeTrace());
        const types = obj.conversation.map(e => e.type);
        // permission (10:00:00.500) < tool_call (10:00:01) < assistant_message (10:00:02)
        assert.deepEqual(types, ['permission', 'tool_call', 'assistant_message']);
    });

    it('uses "partial" status when trace.status is null', () => {
        const obj = toLogObject(makeTrace({ status: null }));
        assert.equal(obj.meta.status, 'partial');
    });
});

describe('toMarkdown', () => {
    it('starts with a heading containing agentDisplayName', () => {
        const md = toMarkdown(makeTrace());
        assert.ok(md.startsWith('# Subagent Log: Explorer'));
    });

    it('includes status emoji for completed', () => {
        const md = toMarkdown(makeTrace());
        assert.ok(md.includes('✅ completed'));
    });

    it('includes status emoji for failed', () => {
        const md = toMarkdown(makeTrace({ status: 'failed', failureReason: 'Timeout' }));
        assert.ok(md.includes('❌ failed'));
    });

    it('includes invocation prompt section', () => {
        const md = toMarkdown(makeTrace());
        assert.ok(md.includes('Analyze all tests'));
    });

    it('includes available tools', () => {
        const md = toMarkdown(makeTrace());
        assert.ok(md.includes('grep, glob, view'));
    });

    it('includes system prompt excerpt', () => {
        const md = toMarkdown(makeTrace());
        assert.ok(md.includes('You are a fast exploration agent.'));
    });

    it('includes tool call in work log with 🔧 emoji', () => {
        const md = toMarkdown(makeTrace());
        assert.ok(md.includes('🔧'));
        assert.ok(md.includes('grep'));
    });

    it('includes assistant message with 💬 emoji', () => {
        const md = toMarkdown(makeTrace());
        assert.ok(md.includes('💬'));
        assert.ok(md.includes('Found 3 test files'));
    });
});

describe('toTimelineSummary', () => {
    it('includes agent name, status emoji, tool count, and json path', () => {
        const summary = toTimelineSummary(makeTrace(), '/path/to/log.json');
        assert.ok(summary.includes('[subagent-inspector]'));
        assert.ok(summary.includes('explore'));
        assert.ok(summary.includes('✅'));
        assert.ok(summary.includes('/path/to/log.json'));
    });

    it('shows ❌ for failed traces', () => {
        const summary = toTimelineSummary(makeTrace({ status: 'failed' }), '/log.json');
        assert.ok(summary.includes('❌'));
    });
});
