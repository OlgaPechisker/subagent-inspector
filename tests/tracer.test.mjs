import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTrace, routeEvent, linkInvocation, cleanupPendingInvocations } from '../tracer.mjs';

const makeStartEvent = (agentId = 'agent-1', toolCallId = 'tc-1') => ({
    type: 'subagent.started',
    agentId,
    timestamp: '2026-04-29T10:00:00.000Z',
    data: { agentName: 'explore', agentDisplayName: 'Explorer', agentDescription: 'Explores the codebase', toolCallId },
});

describe('createTrace', () => {
    it('creates a trace with correct fields from a started event', () => {
        const event = makeStartEvent();
        const trace = createTrace(event);
        assert.equal(trace.agentId, 'agent-1');
        assert.equal(trace.agentName, 'explore');
        assert.equal(trace.toolCallId, 'tc-1');
        assert.equal(trace.startedAt, '2026-04-29T10:00:00.000Z');
        assert.deepEqual(trace.toolCalls, []);
        assert.deepEqual(trace.messages, []);
        assert.equal(trace.status, null);
    });
});

describe('routeEvent', () => {
    it('ignores events without agentId', () => {
        const traces = new Map();
        routeEvent(traces, { type: 'assistant.message', data: { content: 'hi' } });
        assert.equal(traces.size, 0);
    });

    it('ignores events for unknown agentId', () => {
        const traces = new Map();
        routeEvent(traces, { type: 'assistant.message', agentId: 'ghost', data: { content: 'hi' } });
        assert.equal(traces.size, 0);
    });

    it('routes subagent.selected to availableTools', () => {
        const traces = new Map([['a1', createTrace(makeStartEvent('a1'))]]);
        routeEvent(traces, { type: 'subagent.selected', agentId: 'a1', data: { tools: ['grep', 'view'] } });
        assert.deepEqual(traces.get('a1').availableTools, ['grep', 'view']);
    });

    it('routes system.message to systemPrompts', () => {
        const traces = new Map([['a1', createTrace(makeStartEvent('a1'))]]);
        routeEvent(traces, { type: 'system.message', agentId: 'a1', timestamp: 't1', data: { content: 'You are...' } });
        assert.equal(traces.get('a1').systemPrompts.length, 1);
        assert.equal(traces.get('a1').systemPrompts[0].content, 'You are...');
    });

    it('pairs tool.execution_start with tool.execution_complete', () => {
        const traces = new Map([['a1', createTrace(makeStartEvent('a1'))]]);
        routeEvent(traces, { type: 'tool.execution_start', agentId: 'a1', timestamp: '2026-04-29T10:00:01.000Z', data: { toolCallId: 'tc-99', toolName: 'grep', arguments: { pattern: 'test' } } });
        routeEvent(traces, { type: 'tool.execution_complete', agentId: 'a1', timestamp: '2026-04-29T10:00:01.200Z', data: { toolCallId: 'tc-99', success: true, result: { content: 'match found' } } });
        const call = traces.get('a1').toolCalls[0];
        assert.equal(call.toolName, 'grep');
        assert.equal(call.success, true);
        assert.equal(call.result, 'match found');
        assert.equal(call.durationMs, 200);
    });

    it('stores orphan tool.execution_complete when no matching start', () => {
        const traces = new Map([['a1', createTrace(makeStartEvent('a1'))]]);
        routeEvent(traces, { type: 'tool.execution_complete', agentId: 'a1', timestamp: 't1', data: { toolCallId: 'orphan', toolName: 'view', success: false, error: { message: 'not found' }, result: null } });
        const call = traces.get('a1').toolCalls[0];
        assert.equal(call.toolCallId, 'orphan');
        assert.equal(call.success, false);
        assert.equal(call.startedAt, null);
    });

    it('routes assistant.message to messages', () => {
        const traces = new Map([['a1', createTrace(makeStartEvent('a1'))]]);
        routeEvent(traces, { type: 'assistant.message', agentId: 'a1', timestamp: 't1', data: { content: 'Done!', messageId: 'm1' } });
        assert.equal(traces.get('a1').messages[0].content, 'Done!');
    });

    it('pairs permission.requested with permission.completed', () => {
        const traces = new Map([['a1', createTrace(makeStartEvent('a1'))]]);
        routeEvent(traces, { type: 'permission.requested', agentId: 'a1', timestamp: 't1', data: { requestId: 'r1', permissionRequest: { kind: 'shell' } } });
        routeEvent(traces, { type: 'permission.completed', agentId: 'a1', timestamp: 't2', data: { requestId: 'r1', result: { kind: 'approved' } } });
        const perm = traces.get('a1').permissions[0];
        assert.equal(perm.kind, 'shell');
        assert.equal(perm.decision, 'approved');
    });

    it('routes session.error to errors', () => {
        const traces = new Map([['a1', createTrace(makeStartEvent('a1'))]]);
        routeEvent(traces, { type: 'session.error', agentId: 'a1', timestamp: 't1', data: { errorType: 'model_call', message: 'Timeout', stack: null } });
        assert.equal(traces.get('a1').errors[0].errorType, 'model_call');
    });

    it('finalizes trace on subagent.completed', () => {
        const traces = new Map([['a1', createTrace(makeStartEvent('a1'))]]);
        routeEvent(traces, { type: 'subagent.completed', agentId: 'a1', timestamp: 't2', data: { agentName: 'explore', agentDisplayName: 'Explorer', toolCallId: 'tc-1', model: 'claude-haiku', durationMs: 5000, totalToolCalls: 3 } });
        const t = traces.get('a1');
        assert.equal(t.status, 'completed');
        assert.equal(t.model, 'claude-haiku');
        assert.equal(t.durationMs, 5000);
    });

    it('finalizes trace on subagent.failed with error', () => {
        const traces = new Map([['a1', createTrace(makeStartEvent('a1'))]]);
        routeEvent(traces, { type: 'subagent.failed', agentId: 'a1', timestamp: 't2', data: { agentName: 'explore', agentDisplayName: 'Explorer', toolCallId: 'tc-1', error: 'Context limit exceeded', durationMs: 2000, totalToolCalls: 1 } });
        const t = traces.get('a1');
        assert.equal(t.status, 'failed');
        assert.equal(t.failureReason, 'Context limit exceeded');
    });
});

describe('linkInvocation', () => {
    it('links pending args to a trace and removes from pending', () => {
        const traces = new Map([['a1', createTrace(makeStartEvent('a1', 'tc-link'))]]);
        const pending = new Map([['tc-link', { args: { prompt: 'Analyze tests', agent_type: 'explore' }, timestamp: Date.now() }]]);
        linkInvocation(traces, pending, 'a1', 'tc-link');
        assert.deepEqual(traces.get('a1').invocationArgs, { prompt: 'Analyze tests', agent_type: 'explore' });
        assert.equal(pending.has('tc-link'), false);
    });

    it('no-ops when toolCallId not in pending', () => {
        const traces = new Map([['a1', createTrace(makeStartEvent('a1', 'tc-x'))]]);
        const pending = new Map();
        linkInvocation(traces, pending, 'a1', 'tc-x');
        assert.equal(traces.get('a1').invocationArgs, null);
    });
});

describe('cleanupPendingInvocations', () => {
    it('removes entries older than 5 minutes', () => {
        const pending = new Map([
            ['old', { args: {}, timestamp: Date.now() - 6 * 60 * 1000 }],
            ['fresh', { args: {}, timestamp: Date.now() }],
        ]);
        cleanupPendingInvocations(pending);
        assert.equal(pending.has('old'), false);
        assert.equal(pending.has('fresh'), true);
    });
});
