#!/usr/bin/env bash
# Runs the Wally Dashboard test suite against a local copy of index.html.
#
#   ./tests/run.sh              # everything
#   ./tests/run.sh roster obs   # only tests whose name matches
#
# Needs: python3, playwright + chromium (see README.md).
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$DIR")"
PORT="${WALLY_TEST_PORT:-8899}"
export WALLY_TEST_PORT="$PORT"
export PATH="$PATH:$HOME/Library/Python/3.9/bin"

if [ ! -f "$ROOT/index.html" ]; then
    echo "index.html not found in $ROOT" >&2; exit 1
fi

# Reuse a server already on the port; otherwise start one and clean it up on exit.
OWN_SERVER=0
if ! curl -sf "http://localhost:$PORT/index.html" -o /dev/null 2>/dev/null; then
    ( cd "$ROOT" && python3 -m http.server "$PORT" >/dev/null 2>&1 ) &
    SERVER_PID=$!
    OWN_SERVER=1
    trap '[ "$OWN_SERVER" = 1 ] && kill '"$SERVER_PID"' 2>/dev/null' EXIT
    for _ in $(seq 1 30); do
        curl -sf "http://localhost:$PORT/index.html" -o /dev/null 2>/dev/null && break
        sleep 0.2
    done
fi

if [ $# -gt 0 ]; then
    FILES=""
    for pat in "$@"; do FILES="$FILES $(ls "$DIR"/test_*"$pat"*.py 2>/dev/null)"; done
    FILES=$(echo $FILES | tr ' ' '\n' | sort -u)
else
    FILES=$(ls "$DIR"/test_*.py)
fi
[ -z "$FILES" ] && { echo "no tests matched"; exit 1; }

pass=0; fail=0; failed=""
for f in $FILES; do
    name=$(basename "$f" .py)
    out=$(cd "$DIR" && python3 "$f" 2>&1)
    if echo "$out" | grep -q "ALL PASS"; then
        pass=$((pass+1)); printf '  \033[32mPASS\033[0m  %s\n' "$name"
    else
        fail=$((fail+1)); failed="$failed $name"
        printf '  \033[31mFAIL\033[0m  %s\n' "$name"
        echo "$out" | sed 's/^/        /'
    fi
done

echo
echo "$pass passed, $fail failed"
[ -n "$failed" ] && echo "failed:$failed"
[ "$fail" -eq 0 ]
