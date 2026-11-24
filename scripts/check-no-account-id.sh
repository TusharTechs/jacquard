#!/usr/bin/env bash
# Confirms the AWS account id is nowhere in the repository's tracked or new unignored files, nor in
# recent commit messages (deploy-static 5.3). The id is read into a variable and never printed.
set -euo pipefail
cd "$(dirname "$0")/.."
ID="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)"
if [[ ! "$ID" =~ ^[0-9]{12}$ ]]; then echo "check-no-account-id: could not read the account id; skipped"; exit 2; fi
FILES=$( { git ls-files -z -co --exclude-standard | xargs -0 grep -l -F -- "$ID" 2>/dev/null || true; } | wc -l | tr -d ' ')
MSGS=$(git log -n 200 --format=%B | grep -c -F -- "$ID" || true)
CONSOLE=$( { git ls-files -z -co --exclude-standard | xargs -0 grep -l -E "console\.aws\.amazon\.com/amplify/(home|apps)" 2>/dev/null || true; } | wc -l | tr -d ' ')
echo "check-no-account-id: files with the id: $FILES; commit messages with it: $MSGS; files with an Amplify console URL: $CONSOLE"
[[ "$FILES" == "0" && "$MSGS" == "0" && "$CONSOLE" == "0" ]]
