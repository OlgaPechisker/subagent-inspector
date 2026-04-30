import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSessionName, buildSessionContext } from '../session-resolver.mjs';

describe('resolveSessionName', () => {
    it('returns "unnamed" when workspacePath is undefined', () => {
        const session = { sessionId: 'abc-123', workspacePath: undefined };
        assert.equal(resolveSessionName(session), 'unnamed');
    });

    it('returns "unnamed" when workspacePath is null', () => {
        const session = { sessionId: 'abc-123', workspacePath: null };
        assert.equal(resolveSessionName(session), 'unnamed');
    });

    it('returns the session name from workspace.yaml when available', () => {
        const session = {
            sessionId: 'c46c6781-caf2-4dd6-92b3-254360d027fe',
            workspacePath: 'C:\\Users\\opechisker\\.copilot\\session-state\\c46c6781-caf2-4dd6-92b3-254360d027fe',
        };
        const name = resolveSessionName(session);
        assert.equal(name, 'Build Subagent Logging Extension');
    });

    it('returns "unnamed" when workspace.yaml file is missing', () => {
        const session = {
            sessionId: 'fake-id',
            workspacePath: 'C:\\nonexistent\\path',
        };
        assert.equal(resolveSessionName(session), 'unnamed');
    });
});

describe('buildSessionContext', () => {
    it('returns object with sessionId and name', () => {
        const session = {
            sessionId: 'c46c6781-caf2-4dd6-92b3-254360d027fe',
            workspacePath: 'C:\\Users\\opechisker\\.copilot\\session-state\\c46c6781-caf2-4dd6-92b3-254360d027fe',
        };
        const ctx = buildSessionContext(session);
        assert.equal(ctx.sessionId, 'c46c6781-caf2-4dd6-92b3-254360d027fe');
        assert.equal(ctx.name, 'Build Subagent Logging Extension');
    });

    it('uses "unnamed" when workspacePath unavailable', () => {
        const session = { sessionId: 'xyz-789', workspacePath: null };
        const ctx = buildSessionContext(session);
        assert.equal(ctx.sessionId, 'xyz-789');
        assert.equal(ctx.name, 'unnamed');
    });
});
