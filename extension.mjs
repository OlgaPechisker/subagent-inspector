// extension.mjs — Entry point. Wires joinSession(), hooks, event routing, and shutdown handling.

import { joinSession } from '@github/copilot-sdk/extension';
import { createTrace, routeEvent, linkInvocation, cleanupPendingInvocations } from './tracer.mjs';
import { toTimelineSummary } from './formatter.mjs';
import { writeLogSync, DEFAULT_LOG_DIR } from './writer.mjs';
import { createSlashCommand } from './commander.mjs';
import { buildSessionContext } from './session-resolver.mjs';

const traces = new Map();             // Map<agentId, SubagentTrace>
const pendingInvocations = new Map(); // Map<toolCallId, { args, timestamp }>

// Lazy session reference for the slash command (avoids chicken-and-egg with joinSession)
const sessionRef = { current: null };

// Clean up expired pending invocations every minute
const cleanupInterval = setInterval(() => cleanupPendingInvocations(pendingInvocations), 60_000);
cleanupInterval.unref(); // don't keep the process alive just for this

const session = await joinSession({
    commands: [createSlashCommand(sessionRef, DEFAULT_LOG_DIR)],
});

// Assign the real session to the ref so the slash command handler can use it
sessionRef.current = session;

// Capture session context for log grouping
const sessionContext = buildSessionContext(session);

// Log startup notification (fire-and-forget; ephemeral so it disappears from history)
session.log('[subagent-inspector] Loaded — watching for subagent invocations', { ephemeral: true }).catch(() => {});

// Main event handler
session.on((event) => {
    // Capture task tool invocations from the ROOT agent (no agentId) to record invocation args.
    // tool.execution_start fires for the parent session's task tool calls.
    if (event.type === 'tool.execution_start' && !event.agentId && event.data?.toolName === 'task' && event.data?.toolCallId) {
        pendingInvocations.set(event.data.toolCallId, {
            args: event.data.arguments ?? {},
            timestamp: Date.now(),
        });
        return;
    }

    if (event.type === 'subagent.started') {
        if (!event.agentId || !event.data) return;
        const trace = createTrace(event);
        traces.set(event.agentId, trace);
        linkInvocation(traces, pendingInvocations, event.agentId, event.data.toolCallId);
        return;
    }

    if (event.type === 'subagent.completed' || event.type === 'subagent.failed') {
        if (!event.agentId) return;
        routeEvent(traces, event);
        const trace = traces.get(event.agentId);
        if (trace) {
            try {
                const { jsonPath } = writeLogSync(trace, sessionContext, DEFAULT_LOG_DIR);
                session.log(toTimelineSummary(trace, jsonPath)).catch(() => {});
            } catch (err) {
                session.log(`[subagent-inspector] Failed to write log: ${err.message}`, { level: 'warning' }).catch(() => {});
            }
            traces.delete(event.agentId);
        }
        return;
    }

    // Route subagent-scoped events only (root events have no agentId)
    if (event.agentId) routeEvent(traces, event);
});

// Flush any in-flight traces on exit (synchronous writes only)
function flushPartialTraces() {
    for (const trace of traces.values()) {
        if (!trace.status) {
            trace.status = 'partial';
            try { writeLogSync(trace, sessionContext, DEFAULT_LOG_DIR); } catch {}
        }
    }
}

process.on('exit', flushPartialTraces);
process.on('SIGTERM', () => {
    flushPartialTraces();
    process.exit(0);
});
