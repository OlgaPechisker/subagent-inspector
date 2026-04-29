// formatter.mjs — Pure serialization functions. No I/O, no SDK imports.

export function toLogObject(trace) {
    return {
        schemaVersion: '1.0',
        capturedAt: new Date().toISOString(),
        meta: {
            agentId: trace.agentId,
            agentName: trace.agentName,
            agentDisplayName: trace.agentDisplayName,
            agentDescription: trace.agentDescription,
            toolCallId: trace.toolCallId,
            model: trace.model,
            status: trace.status ?? 'partial',
            durationMs: trace.durationMs,
            totalToolCalls: trace.totalToolCalls,
            failureReason: trace.failureReason,
            startedAt: trace.startedAt,
            completedAt: trace.completedAt,
        },
        invocationArgs: trace.invocationArgs,
        availableTools: trace.availableTools,
        systemPrompts: trace.systemPrompts,
        conversation: buildConversation(trace),
    };
}

function buildConversation(trace) {
    const entries = [
        ...(trace.toolCalls ?? []).map(c => ({
            type: 'tool_call',
            timestamp: c.startedAt ?? c.completedAt,
            toolName: c.toolName,
            toolCallId: c.toolCallId,
            args: c.args,
            success: c.success,
            result: c.result,
            error: c.error,
            durationMs: c.durationMs,
        })),
        ...(trace.messages ?? []).map(m => ({
            type: 'assistant_message',
            timestamp: m.timestamp,
            content: m.content,
            toolRequests: m.toolRequests ?? null,
        })),
        ...(trace.permissions ?? []).map(p => ({
            type: 'permission',
            timestamp: p.requestedAt,
            kind: p.kind,
            requestId: p.requestId,
            decision: p.decision,
        })),
        ...(trace.errors ?? []).map(e => ({
            type: 'error',
            timestamp: e.timestamp,
            errorType: e.errorType,
            message: e.message,
        })),
    ];
    return entries.sort((a, b) => {
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
}

export function toMarkdown(trace) {
    const status = trace.status === 'completed' ? '✅ completed' :
                   trace.status === 'failed'    ? '❌ failed' : '⚠️ partial';
    const dur = trace.durationMs != null ? `${(trace.durationMs / 1000).toFixed(1)}s` : 'unknown';
    const calls = trace.totalToolCalls ?? trace.toolCalls?.length ?? 0;

    let md = `# Subagent Log: ${trace.agentDisplayName ?? trace.agentName ?? 'Unknown'}\n\n`;
    md += `**Status:** ${status} | **Duration:** ${dur} | **Model:** ${trace.model ?? 'unknown'}\n`;
    md += `**Tool calls:** ${calls} | **Agent:** ${trace.agentName}\n\n`;

    if (trace.invocationArgs?.prompt) {
        md += `## Invocation\n\n> ${trace.invocationArgs.prompt.replace(/\n/g, '\n> ')}\n\n`;
    }

    if (trace.availableTools != null) {
        md += `## Available Tools\n\n${trace.availableTools.length ? trace.availableTools.join(', ') : '(none)'}\n\n`;
    }

    if (trace.systemPrompts?.length > 0) {
        const raw = trace.systemPrompts[0].content;
        const excerpt = raw.slice(0, 1000);
        md += `## System Prompt (first 1000 chars)\n\n\`\`\`\n${excerpt}${raw.length > 1000 ? '\n...' : ''}\n\`\`\`\n\n`;
    }

    const conversation = buildConversation(trace);
    if (conversation.length > 0) {
        md += `## Work Log\n\n`;
        let n = 1;
        for (const entry of conversation) {
            if (entry.type === 'tool_call') {
                const argsStr = entry.args ? JSON.stringify(entry.args).slice(0, 80) : '';
                const icon = entry.success === false ? '❌' : '🔧';
                const durStr = entry.durationMs != null ? ` (${entry.durationMs}ms)` : '';
                md += `${n++}. ${icon} **${entry.toolName}**${argsStr ? ` \`${argsStr}\`` : ''}${durStr}\n`;
            } else if (entry.type === 'assistant_message') {
                if (!entry.content && entry.toolRequests?.length) {
                    const summary = entry.toolRequests
                        .map(r => r.intentionSummary ?? r.toolTitle ?? r.name)
                        .join('; ');
                    md += `${n++}. 💬 *(requesting: ${summary})*\n`;
                } else {
                    const snippet = entry.content.slice(0, 120).replace(/\n/g, ' ');
                    md += `${n++}. 💬 ${snippet}${entry.content.length > 120 ? '...' : ''}\n`;
                }
            } else if (entry.type === 'permission') {
                const icon = entry.decision?.startsWith('approved') ? '✅' : '❌';
                md += `${n++}. 🔐 Permission: **${entry.kind}** → ${icon} ${entry.decision ?? 'pending'}\n`;
            } else if (entry.type === 'error') {
                md += `${n++}. ❌ Error (${entry.errorType}): ${entry.message.slice(0, 100)}\n`;
            }
        }
    }

    return md;
}

export function toTimelineSummary(trace, jsonPath) {
    const icon = trace.status === 'completed' ? '✅'
               : trace.status === 'failed'    ? '❌' : '⚠️';
    const dur = trace.durationMs != null ? ` in ${(trace.durationMs / 1000).toFixed(1)}s` : '';
    const calls = trace.totalToolCalls ?? trace.toolCalls?.length ?? 0;
    return `[subagent-inspector] ${trace.agentName} ${icon} ${calls} tool calls${dur} → ${jsonPath}`;
}
