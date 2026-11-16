#!/usr/bin/env python3
"""PreToolUse guard: block edits, moves and deletes of files that already exist under
packages/engine/test/fixtures. Creating a new file there is allowed.

Kiro passes the hook context as JSON on stdin (hook_event_name, cwd, session_id, tool_name,
tool_input). Only the path arguments of the tool are inspected, so text that merely mentions the
fixtures folder (for example in a spec file) does not trigger the block.

A path argument is blocked when it points at something that already exists at or under the
fixtures folder. That covers overwriting or editing an existing file (fs_write, fs_append,
str_replace, semantic_rename), deleting one (delete_file), and moving one away or onto one
(smart_relocate, through sourcePath and destinationPath). A path that does not exist yet is a
create, and is allowed.

Exit 2 blocks the tool call and shows stderr. Exit 0 allows it. This guard covers the
file-editing tools only; shell commands are covered by a rule in .kiro/steering/tech.md.
Golden fixtures are read-only once committed (.kiro/steering/weaving-domain.md).
"""

import datetime
import json
import os
import sys

FIXTURES = os.path.join("packages", "engine", "test", "fixtures")
PATH_KEYS = ("path", "targetFile", "sourcePath", "destinationPath", "filePath")

# Evidence that the hook ran: .kiro/hook-runs.log, next to this script's folder. Ignored by git.
RUN_LOG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "hook-runs.log")


def log_run(line: str) -> None:
    """Appends one line to the run log. A logging failure never changes the guard's decision."""
    try:
        with open(RUN_LOG, "a", encoding="utf-8") as log:
            log.write(line + "\n")
    except OSError:
        pass


def utc_now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def main() -> int:
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        data = None
    tool_name = data.get("tool_name", "unknown tool") if isinstance(data, dict) else "unreadable input"
    log_run(f"{utc_now()} guard fired: {tool_name}")

    if not isinstance(data, dict):
        print("block-engine-fixture-edits: could not read hook input; allowing the call", file=sys.stderr)
        log_run(f"{utc_now()} allowed")
        return 0

    decision = decide(data)
    log_run(f"{utc_now()} {'blocked' if decision == 2 else 'allowed'}")
    return decision


def decide(data: dict) -> int:
    """Returns 2 to block the call, 0 to allow it."""
    cwd = data.get("cwd") or os.getcwd()
    fixtures = os.path.normpath(os.path.join(cwd, FIXTURES))
    tool_input = data.get("tool_input") or {}

    for key in PATH_KEYS:
        value = tool_input.get(key)
        if not isinstance(value, str):
            continue
        target = os.path.normpath(os.path.join(cwd, value))
        under_fixtures = target == fixtures or target.startswith(fixtures + os.sep)
        if under_fixtures and os.path.lexists(target):
            print(
                f"Blocked: {data.get('tool_name', 'this tool')} would change {value}, which already "
                "exists under packages/engine/test/fixtures. Existing golden fixtures are read-only. "
                "Creating a new file there is allowed.",
                file=sys.stderr,
            )
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
