#!/usr/bin/env bash
# Deploys apps/web as a static site on AWS Amplify Hosting, manual deployment, no Git connection
# (deploy-static Requirement 2). Builds, tests, zips apps/web/dist, creates a deployment, uploads the
# zip, starts the deployment, waits for it and prints the public URL.
#
# Idempotent: the app id is kept in .deploy/amplify-app-id (gitignored); a rerun reuses the app
# named "jacquard" and its "main" branch and only adds a deployment. It creates nothing else.
#
# Privacy (Requirement 5): every AWS call selects only the fields it needs with --query, so no ARN
# or account id is printed. The zip upload URL is a presigned URL and is never printed.
set -euo pipefail

REGION="us-west-2"
APP_NAME="jacquard"
BRANCH="main"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="$ROOT/.deploy"
APP_ID_FILE="$STATE_DIR/amplify-app-id"

say() { printf '%s\n' "deploy-web: $*"; }
aws_q() { aws --region "$REGION" --output text "$@"; }

cd "$ROOT"
command -v aws >/dev/null || { say "the AWS CLI is not installed"; exit 1; }

if [[ "${SKIP_CHECKS:-0}" != "1" ]]; then
  say "typecheck and tests"
  pnpm typecheck >/dev/null
  pnpm test >/dev/null
fi

say "build (static: no VITE_API_BASE)"
( cd apps/web && env -u VITE_API_BASE pnpm vite build --logLevel warn )
[[ -f apps/web/dist/index.html ]] || { say "apps/web/dist/index.html is missing"; exit 1; }

ZIP="$(mktemp -d)/site.zip"
# Zip the contents of dist, not the folder: index.html at the root of the archive.
( cd apps/web/dist && zip -q -r -X "$ZIP" . )
say "zipped $(du -h "$ZIP" | cut -f1) of build output"

mkdir -p "$STATE_DIR"
APP_ID=""
if [[ -s "$APP_ID_FILE" ]]; then
  APP_ID="$(tr -d '[:space:]' < "$APP_ID_FILE")"
  if ! aws_q amplify get-app --app-id "$APP_ID" --query 'app.appId' >/dev/null 2>&1; then
    say "the saved app id no longer exists; looking the app up by name"
    APP_ID=""
  fi
fi
if [[ -z "$APP_ID" ]]; then
  APP_ID="$(aws_q amplify list-apps --query "apps[?name=='$APP_NAME'].appId | [0]")"
  [[ "$APP_ID" == "None" ]] && APP_ID=""
fi
if [[ -z "$APP_ID" ]]; then
  say "creating the Amplify app '$APP_NAME' (platform WEB, no repository)"
  APP_ID="$(aws_q amplify create-app --name "$APP_NAME" --platform WEB --query 'app.appId')"
fi
printf '%s\n' "$APP_ID" > "$APP_ID_FILE"

if ! aws_q amplify get-branch --app-id "$APP_ID" --branch-name "$BRANCH" --query 'branch.branchName' >/dev/null 2>&1; then
  say "creating the branch '$BRANCH'"
  aws_q amplify create-branch --app-id "$APP_ID" --branch-name "$BRANCH" --stage PRODUCTION --query 'branch.branchName' >/dev/null
fi

# A job can only start when the branch has none pending or running.
PENDING="$(aws_q amplify list-jobs --app-id "$APP_ID" --branch-name "$BRANCH" --max-items 5 --query "jobSummaries[?status=='PENDING' || status=='RUNNING'].jobId | join(' ', @)" | head -1)"
if [[ -n "$PENDING" && "$PENDING" != "None" ]]; then
  for job in $PENDING; do
    say "stopping an unfinished job ($job) from an earlier run"
    aws_q amplify stop-job --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$job" --query 'jobSummary.status' >/dev/null || true
  done
fi

read -r JOB_ID UPLOAD_URL < <(aws_q amplify create-deployment --app-id "$APP_ID" --branch-name "$BRANCH" --query '[jobId, zipUploadUrl]')
say "uploading (job $JOB_ID)"
curl --fail --silent --show-error --upload-file "$ZIP" -H "Content-Type: application/zip" "$UPLOAD_URL" >/dev/null
aws_q amplify start-deployment --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID" --query 'jobSummary.status' >/dev/null

STATUS="PENDING"
for _ in $(seq 1 90); do
  STATUS="$(aws_q amplify get-job --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID" --query 'job.summary.status')"
  case "$STATUS" in
    SUCCEED) break ;;
    FAILED|CANCELLED) say "deployment $JOB_ID ended with $STATUS"; exit 1 ;;
  esac
  sleep 5
done
[[ "$STATUS" == "SUCCEED" ]] || { say "deployment $JOB_ID did not finish in time (last status $STATUS)"; exit 1; }
rm -f "$ZIP"

URL="https://$BRANCH.$APP_ID.amplifyapp.com"
say "deployed: $URL"
printf '%s\n' "$URL"
