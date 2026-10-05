#!/bin/zsh
# Same sequence as run-all.sh, against a second build snapshot (eval/.app-cur) into eval/raw-cur.
# The model is passed EXPLICITLY so an autoPick fallback to a sealed model can never contaminate the "local" column.
# (Frontier pass: only possible while the bridge lists claude-sonnet-4-6; on 2026-10-05 ~19:00 it stopped listing sealed models.)
cd "$(dirname "$0")/.."
node eval/run.mjs --appdir .app-cur --rawdir raw-cur --label cur --model gemma2:2b
[ -n "$FRONTIER" ] && node eval/run.mjs --appdir .app-cur --rawdir raw-cur --label curf --model claude-sonnet-4-6 --only frontier
