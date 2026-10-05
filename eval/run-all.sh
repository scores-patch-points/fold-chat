#!/bin/zsh
# Full evaluation: default model (all cases), a sealed frontier model (subset), then flakiness repeats.
cd "$(dirname "$0")/.."
node eval/run.mjs --label default --reps 1
node eval/run.mjs --label frontier --model claude-sonnet-4-6 --only frontier
node eval/run.mjs --label default --only repeat --reps 3
