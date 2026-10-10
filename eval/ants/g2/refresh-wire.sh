#!/bin/zsh
# Rebuild BOTH diffs from the CURRENT fold-chat.js (never edited): wire.diff (standalone) and wire-on-g1.diff (to be applied AFTER eval/ants/g1/wire.diff), verify each applies cleanly,
# and refresh the scratch tree (current files + wire.diff applied) that the patched page is served from (FOLD_PORT 8841).
cd /Users/mlacy/Documents/3.0/the-fold
S=/private/tmp/claude-501/-Users-mlacy-Documents-3-0-the-fold/0c804cde-75c0-4276-bf91-3cc3a46d1c35/scratchpad
python3 eval/ants/g2/make-wire-diff.py standalone || exit 1
(diff -u --label a/fold-chat.js --label b/fold-chat.js fold-chat.js $S/wire/fold-chat.js > eval/ants/g2/wire.diff; true)
git apply --check eval/ants/g2/wire.diff || exit 2
python3 eval/ants/g2/make-wire-diff.py on-g1 || exit 3
(diff -u --label a/fold-chat.js --label b/fold-chat.js $S/wireg1/fold-chat.js $S/wireg1/fold-chat.out.js > eval/ants/g2/wire-on-g1.diff; true)
rm -rf $S/chk && mkdir -p $S/chk && cp fold-chat.js $S/chk/ && (cd $S/chk && patch -p1 -s < /Users/mlacy/Documents/3.0/the-fold/eval/ants/g1/wire.diff && patch -p1 --dry-run < /Users/mlacy/Documents/3.0/the-fold/eval/ants/g2/wire-on-g1.diff >/dev/null && patch -p1 -s < /Users/mlacy/Documents/3.0/the-fold/eval/ants/g2/wire-on-g1.diff && node --check fold-chat.js) || exit 4
cp fold-chat.js $S/tree/fold-chat.js && (cd $S/tree && patch -p1 -s < /Users/mlacy/Documents/3.0/the-fold/eval/ants/g2/wire.diff)
cp fold-chat-genvoid.js fold-chat-gaps.js fold-chat-channels.js index.html $S/tree/ 2>/dev/null
echo "wire.diff: $(wc -l < eval/ants/g2/wire.diff) lines, git apply --check clean on the current fold-chat.js"
echo "wire-on-g1.diff: $(wc -l < eval/ants/g2/wire-on-g1.diff) lines, applies after g1/wire.diff (patched file passes node --check)"
