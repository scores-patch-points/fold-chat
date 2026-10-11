#!/bin/zsh
# The COMBINED wiring (g1/wire.diff then g2/wire-on-g1.diff) on a scratch tree served at :8842, same scenarios; search relay stubbed (SEARCH_STUB) as in paired-batch.sh.
cd /Users/mlacy/Documents/3.0/the-fold
for spec in "empty natural" "network natural" "fulfill:stub natural" "fulfill:tutorial natural" "network meta" "control natural"; do
  v=${spec% *}; st=${spec#* }
  echo "######## ON-G1 $v (search stub: $st)"
  SEARCH_STUB=$st TRACE=1 PATCHED=1 PATCHED_PORT=8842 FOLD_URL=http://127.0.0.1:8842/ timeout 700 node eval/ants/g2/repro.mjs $v 2>&1 | sed -n '/write me an essay on this/,$p' | grep -v "^  process:\|^  trace:\|stubbed" | cut -c1-1100
done
echo "######## DONE"
