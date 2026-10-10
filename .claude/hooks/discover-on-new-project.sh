#!/usr/bin/env bash
# SessionStart hook: on a project's first session (no discovery report yet), build one in the
# background so session start is never blocked. Re-run any time with /discover.
set -u
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
REPORT="docs/DISCOVERY.md"
[ -f "$REPORT" ] && exit 0
[ -f package.json ] && [ -d node_modules ] || exit 0
mkdir -p .claude/logs
nohup npm run -s discover -- --out "$REPORT" > .claude/logs/discover.log 2>&1 &
echo "Building $REPORT in the background (research, MCP servers, repos, tools, legal). Run /discover to refresh."
