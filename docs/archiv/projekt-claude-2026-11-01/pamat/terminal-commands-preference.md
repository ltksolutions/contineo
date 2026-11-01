---
name: terminal-commands-preference
description: User wants ready-to-run bash commands whenever something must be run in their terminal
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6c79673a-d79b-41c7-ac1a-4688b5eb4f4d
sources: [cowork-import]
imported_at: 2026-09-15T09:36:09Z
---

When a step requires running something in the terminal (git, npm, file ops, lock cleanup, etc.), always prepare copy-paste-ready bash commands automatically — don't just describe the action.

**Why:** User runs commands himself in Terminal (e.g. git commit/push fails from the sandbox due to mounted-FS lock permissions), so he needs the exact commands.

**How to apply:** Give a single copy-paste block with absolute paths or a clear `cd` first. Group related steps. Keep them safe and minimal. Communicate in Slovak (see [[communicate-in-slovak]]).
