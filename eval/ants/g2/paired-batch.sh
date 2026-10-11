#!/bin/zsh
# Paired live runs with the open-web search RELAY stubbed by recorded real results (SEARCH_STUB, see repro.mjs): the SAME scenario on the current page (8815, BEFORE) and
# on the scratch tree with wire.diff applied (8841, AFTER). The model transport is gemma2:2b (control) or a canned reply / HTTP status (fulfill:*), the pages are fetched live.
cd /Users/mlacy/Documents/3.0/the-fold
S=/private/tmp/claude-501/-Users-mlacy-Documents-3-0-the-fold/0c804cde-75c0-4276-bf91-3cc3a46d1c35/scratchpad
for spec in "network natural" "fulfill:stub natural" "fulfill:refusal natural" "fulfill:empty natural" "fulfill:question natural" "fulfill:tutorial natural" "fulfill:http429 natural" "fulfill:http403 natural" "network meta" "control natural"; do
  v=${spec% *}; st=${spec#* }
  (SEARCH_STUB=$st TRACE=1 timeout 480 node eval/ants/g2/repro.mjs $v > $S/before-$v-$st.out 2>&1 &)
  SEARCH_STUB=$st TRACE=1 PATCHED=1 FOLD_URL=http://127.0.0.1:8841/ timeout 480 node eval/ants/g2/repro.mjs $v > $S/after-$v-$st.out 2>&1
  sleep 5
  for w in before after; do echo "######## $w $v (search stub: $st)"; sed -n '/write me an essay on this/,$p' $S/$w-$v-$st.out | grep -v "^  void:\|^  process:\|^  trace:" | cut -c1-1100; done
done
echo "######## DONE"
