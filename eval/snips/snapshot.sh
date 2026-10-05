#!/bin/sh
# Re-create the app snapshot the study imports from (eval/snips/app). The study itself ran against a scratchpad copy taken 2026-10-05
# (symlinked here); this does the same into a real directory.
set -e
here=$(cd "$(dirname "$0")" && pwd)
rm -f "$here/app" 2>/dev/null || true
rsync -a --exclude node_modules --exclude .git --exclude eval --exclude docs --exclude experiments "$here/../../" "$here/app/"
