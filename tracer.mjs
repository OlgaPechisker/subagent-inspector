// tracer.mjs — Pure state functions for subagent trace accumulation. No I/O.

const PENDING_TTL_MS = 5 * 60 * 1000;

export function createTrace(event) {
    return {
        agentId: event.agentId,
        agentName: event.data.agentName,
        agentDisplayName: event.data.agentDisplayName,
        agentDescription: event.data.agentDescription,
        toolCallId: event.data.toolCallId,
        startedAt: event.timestamp,
        invocationArgs: null,
        availableTools: null,
        systemPrompts: [],
        toolCalls: [],
        messages: [],
        permissions: [],
        errors: [],
        completedAt: null,
        status: null,
        model: null,
        durationMs: null,
        totalToolCalls: null,
        failureReason: null,
    };
}

export function routeEvent(traces, event) {
    const agentId = event.agentId;
    if (!agentId) return;
    const trace = traces.get(agentId);
    if (!trace) return;

    switch (event.type) {
        case 'subagent.selected':
            trace.availableTools = event.data.tools;
            break;
        case 'system.message':
            trace.systemPrompts.push({ timestamp: event.timestamp, content: event.data.content });
            break;
        case 'tool.execution_start':
            trace.toolCalls.push({
                toolCallId: event.data.toolCallId,
                toolName: event.data.toolName,
                args: event.data.arguments ?? null,
                result: null,
                success: null,
                error: null,
                startedAt: event.timestamp,
                completedAt: null,
                durationMs: null,
            });
            break;
        case 'tool.execution_complete': {
            const call = trace.toolCalls.find(c => c.toolCallId === event.data.toolCallId);
            if (call) {
                call.result = event.data.result?.content ?? null;
                call.success = event.data.success;
                call.error = event.data.error?.message ?? null;
                call.completedAt = event.timestamp;
                if (call.startedAt) {
                    call.durationMs = new Date(event.timestamp).getTime() - new Date(call.startedAt).getTime();
                }
            } else {
                trace.toolCalls.push({
                    toolCallId: event.data.toolCallId,
                    toolName: event.data.toolName ?? 'unknown',
                    args: null,
                    result: event.data.result?.content ?? null,
                    success: event.data.success,
                    error: event.data.error?.message ?? null,
                    startedAt: null,
                    completedAt: event.timestamp,
                    durationMs: null,
                });
            }
            break;
        }
        case 'assistant.message':
            trace.messages.push({
                timestamp: event.timestamp,
                content: event.data.content,
                toolRequests: event.data.toolRequests ?? null,
            });
            break;
        case 'permission.requested':
            trace.permissions.push({
                requestId: event.data.requestId,
                requestedAt: event.timestamp,
                kind: event.data.permissionRequest?.kind ?? 'unknown',
                completedAt: null,
                decision: null,
            });
            break;
        case 'permission.completed': {
            const perm = trace.permissions.find(p => p.requestId === event.data.requestId);
            if (perm) {
                perm.completedAt = event.timestamp;
                perm.decision = event.data.result?.kind ?? null;
            }
            break;
        }
        case 'session.error':
            trace.errors.push({
                timestamp: event.timestamp,
                errorType: event.data.errorType,
                message: event.data.message,
                stack: event.data.stack ?? null,
            });
            break;
        case 'subagent.completed':
            trace.completedAt = event.timestamp;
            trace.status = 'completed';
            trace.model = event.data.model ?? null;
            trace.durationMs = event.data.durationMs ?? null;
            trace.totalToolCalls = event.data.totalToolCalls ?? null;
            break;
        case 'subagent.failed':
            trace.completedAt = event.timestamp;
            trace.status = 'failed';
            trace.model = event.data.model ?? null;
            trace.durationMs = event.data.durationMs ?? null;
            trace.totalToolCalls = event.data.totalToolCalls ?? null;
            trace.failureReason = event.data.error ?? null;
            break;
    }
}

export function linkInvocation(traces, pendingInvocations, agentId, toolCallId) {
    const pending = pendingInvocations.get(toolCallId);
    if (!pending) return;
    const trace = traces.get(agentId);
    if (trace) trace.invocationArgs = pending.args;
    pendingInvocations.delete(toolCallId);
}

export function cleanupPendingInvocations(pendingInvocations) {
    const now = Date.now();
    for (const [id, entry] of pendingInvocations) {
        if (now - entry.timestamp > PENDING_TTL_MS) pendingInvocations.delete(id);
    }
}
