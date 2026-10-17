#!/bin/bash
set -eo pipefail

# ==============================================================================
# OmniStack Forge - Sandbox Sentry Compilation Entrypoint
# Ephemeral, isolated build & deterministic typecheck verification
# ==============================================================================

ACTION="${1:-compile}"

run_deterministic_compilation() {
  local exit_code=0
  echo "[Sandbox Sentry] Initiating deterministic compilation verification pipeline..." >&2

  # Check for workspace project root
  if [ ! -f "package.json" ]; then
    echo "[Sandbox Sentry] Fatal: package.json not found in execution directory $(pwd)" >&2
    exit 1
  fi

  # Pass 1: Deterministic TypeScript Compilation Check (tsc --noEmit)
  if [ -f "tsconfig.json" ]; then
    echo "[Sandbox Sentry] Executing Pass 1: TypeScript type checking (tsc --noEmit)..." >&2
    if [ -f "./node_modules/.bin/tsc" ]; then
      ./node_modules/.bin/tsc --noEmit || exit_code=$?
    elif command -v tsc >/dev/null 2>&1; then
      tsc --noEmit || exit_code=$?
    else
      npx --no-install tsc --noEmit || exit_code=$?
    fi

    if [ $exit_code -ne 0 ]; then
      echo "[Sandbox Sentry] TypeScript compilation check FAILED with exit code: $exit_code" >&2
      exit $exit_code
    fi
    echo "[Sandbox Sentry] Deterministic Pass 1 PASSED: TypeScript type checking verified cleanly." >&2
  else
    echo "[Sandbox Sentry] Info: No tsconfig.json detected, skipping tsc pass." >&2
  fi

  # Pass 2: Deterministic Production Build Pass (npm run build)
  if grep -q '"build":' package.json; then
    echo "[Sandbox Sentry] Executing Pass 2: Production Build Pass (npm run build)..." >&2
    npm run build || exit_code=$?
    if [ $exit_code -ne 0 ]; then
      echo "[Sandbox Sentry] Production build pass FAILED with exit code: $exit_code" >&2
      exit $exit_code
    fi
    echo "[Sandbox Sentry] Deterministic Pass 2 PASSED: Project build completed successfully." >&2
  else
    echo "[Sandbox Sentry] Info: No 'build' script found in package.json, skipping build pass." >&2
  fi

  echo "[Sandbox Sentry] Verification pipeline complete: Code verified for downstream gates." >&2
  exit 0
}

case "$ACTION" in
  compile)
    run_deterministic_compilation
    ;;
  *)
    exec "$@"
    ;;
esac
