#!/usr/bin/env python3
"""PreToolUse guard: block tool calls that edit files under packages/engine/test/fixtures.

Kiro passes the hook context as JSON on stdin (hook_event_name, cwd, session_id, tool_name,
tool_input). Only path arguments of the tool are inspected, so text that merely mentions the
fixtures folder (for example in a spec file) does not trigger the block.

Exit 2 blocks the tool call and shows stderr. Exit 0 allows it. Golden fixtures are read-only
once committed (.kiro/steering/weaving-domain.md, .kiro/steering/tech.md).
"""

import json
import os
import sys

FIXTURES = os.path.join("packages", "engine", "test", "fixtures")
PATH_KEYS = ("path", "targetFile", "sourcePath", "destinationPath", "filePath")


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        print("block-engine-fixture-edits: could not read hook input; allowing the call", file=sys.stderr)
        return 0

    cwd = data.get("cwd") or os.getcwd()
    fixtures = os.path.normpath(os.path.join(cwd, FIXTURES))
    tool_input = data.get("tool_input") or {}

    for key in PATH_KEYS:
        value = tool_input.get(key)
        if not isinstance(value, str):
            continue
        target = os.path.normpath(os.path.join(cwd, value))
        if target == fixtures or target.startswith(fixtures + os.sep):
            print(
                f"Blocked: {data.get('tool_name', 'this tool')} would edit {value}. "
                "Files under packages/engine/test/fixtures are read-only golden fixtures.",
                file=sys.stderr,
            )
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
