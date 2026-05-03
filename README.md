# Subagent Inspector

A GitHub Copilot CLI extension that captures full context, conversation history, and logs of all subagent invocations with session-based organization.

## ✨ Features

- 📝 **Automatic Logging**: Captures every subagent invocation with complete context
- 🗂️ **Session-Based Organization**: Groups logs by parent session for easy tracking
- 🔍 **Interactive Browsing**: View logs directly in Copilot CLI with `/subagent-logs` command
- 📊 **Dual Format Output**: JSON for programmatic access, Markdown for human reading
- 🧪 **Fully Tested**: 74 passing tests with comprehensive coverage

## 📦 Installation

### Option 1: npm (Recommended)

**Global install (auto-configures):**
```bash
npm install -g @your-org/copilot-subagent-inspector
```

The postinstall script automatically copies the extension to `~/.copilot/extensions/subagent-inspector/`.

**Then restart Copilot CLI:**
```
/restart
```

### Option 2: Git Clone

**Mac/Linux:**
```bash
git clone YOUR-REPO-URL ~/.copilot/extensions/subagent-inspector
```

**Windows PowerShell:**
```powershell
git clone YOUR-REPO-URL "$env:USERPROFILE\.copilot\extensions\subagent-inspector"
```

Then restart Copilot CLI:
```
/restart
```

### Option 3: Manual Install

1. Download this repository as a zip file
2. Extract to:
   - Mac/Linux: `~/.copilot/extensions/subagent-inspector/`
   - Windows: `%USERPROFILE%\.copilot\extensions\subagent-inspector\`
3. Run `/restart` in Copilot CLI

## 🚀 Usage

### Automatic Capture
Once installed, all subagent invocations are automatically logged. No configuration needed!

### Viewing Logs

**List sessions:**
```
/subagent-logs
```

**List logs in a specific session:**
```
/subagent-logs session-c46c6781
```

**View a specific log:**
```
/subagent-logs 2026-05-03T10-30
```

## 📁 Log Organization

Logs are organized by session in:
```
~/.copilot/subagent-logs/
  └── session-c46c6781-Build-Feature/
      ├── 2026-05-03T10-30-15-explore-toolu_abc.json
      ├── 2026-05-03T10-30-15-explore-toolu_abc.md
      ├── 2026-05-03T10-45-22-task-toolu_xyz.json
      └── 2026-05-03T10-45-22-task-toolu_xyz.md
```

Session folder naming: `session-{shortId}-{session-name}`

## 📋 Captured Data

Each log includes:
- **Invocation context**: Prompt, agent type, model
- **Available tools**: Complete tool list the subagent received
- **System prompts**: Agent-specific instructions
- **Full conversation**: User/assistant messages with timestamps
- **Tool executions**: All tool calls and results
- **Permissions**: Permission requests and grants
- **Errors**: Any errors that occurred
- **Status**: Completed, failed, or partial

## 🧪 Testing

Run the test suite:
```bash
cd ~/.copilot/extensions/subagent-inspector
node --test
```

All 74 tests should pass ✅

## 📖 Log Schema

### JSON Schema (v1.0)
```json
{
  "schemaVersion": "1.0",
  "meta": {
    "agentId": "string",
    "agentName": "string",
    "agentDisplayName": "string",
    "model": "string",
    "status": "completed|failed|partial",
    "startedAt": "ISO8601",
    "finishedAt": "ISO8601",
    "failureReason": "string|null"
  },
  "invocationArgs": { /* task tool arguments */ },
  "availableTools": ["tool-name", ...],
  "systemPrompts": ["prompt text", ...],
  "conversation": [
    {
      "type": "user_message|assistant_message|tool_call|permission|error",
      "timestamp": "ISO8601",
      "data": { /* event-specific fields */ }
    }
  ]
}
```

## 🔄 Updates

### NPM Installation
```bash
npm update -g @your-org/copilot-subagent-inspector
```

### Git Installation
```bash
cd ~/.copilot/extensions/subagent-inspector
git pull
```

Then restart Copilot CLI with `/restart`.

## 🐛 Troubleshooting

**Extension not loading?**
- Verify installation path: `~/.copilot/extensions/subagent-inspector/extension.mjs` must exist
- Run `/env` in Copilot CLI to see loaded extensions
- Check for errors in the Copilot CLI output

**Logs not appearing?**
- Spawn a test subagent to trigger logging
- Check `~/.copilot/subagent-logs/` directory exists
- Verify write permissions on the log directory

**Session folders not created?**
- Requires Copilot CLI with infinite sessions enabled
- Falls back to flat structure if session workspace unavailable

## 📄 License

MIT

## 🤝 Contributing

Issues and pull requests welcome!

## 📚 Version History

### v1.1.0 (2026-05-03)
- ✨ Session-based log grouping
- 🔍 Enhanced `/subagent-logs` command with session navigation
- 📝 Backward compatibility with flat logs

### v1.0.0 (2026-04-29)
- 🎉 Initial release
- 📝 JSON + Markdown logging
- 🔧 `/subagent-logs` slash command
- ✅ Full test coverage
