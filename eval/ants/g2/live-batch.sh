#!/bin/zsh
cd /Users/mlacy/Documents/3.0/the-fold
for v in fulfill:refusal fulfill:empty fulfill:question fulfill:tutorial fulfill:http429 fulfill:http403 fulfill:http504; do
  echo "######## $v"; timeout 420 node eval/ants/g2/repro.mjs $v 2>&1 | sed -n '/write me an essay/,$p' | cut -c1-900
done
