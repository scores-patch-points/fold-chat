# Draft GLAUCA-EOT entries (append after review; never rewrite)

### GL-FD-01 — A fold is its log: the artifact is a replay of set-down assemblies
- status: proposed (2026-10-06)
- evidence: fold-chat-folds.js `rebuild()` (every ok, non-ask log entry is re-submitted to a fresh kernel in order); fold-blocks-kernel.js `submit()` (one assembly, checked alone, commits whole or not at all)
- falsifying control: a fold whose reopened artifact differs from the artifact at close, or a log entry that changed state without passing a checkpoint, contradicts this.

### GL-FD-02 — The unit is the slot; a record is its cells
- status: proposed
- evidence: fold-blocks-weave.js `unitsOf()` (one unit per `name.prop`; a room row expands to one unit per schema field); measured: whole-assembly draws by gemma-2-2b re-typed parts (`look : minimalist`) and repeated rows 3/3; per-slot draws set down look 4/4 in 4.8s
- falsifying control: a draw that carries more than one unit, or a passing unit redrawn because a sibling failed, contradicts this.

### GL-FD-03 — Fill order in the browser: library → box → hunt → mouth
- status: proposed (mirrors GL-EN-02 at slot grain)
- evidence: fold-blocks-weave.js `fillUnit()`; tests "weave: law order", "weave: a widget's formula, arguments and label are box-owned"
- falsifying control: a mouth draw for a slot the library, a box rule or the request already satisfied.

### GL-FD-04 — An invented figure is cut, not redrawn
- status: proposed (sharpens GL-EN-12)
- evidence: fold-blocks-weave.js `probe()` (figures not in the request or the standing material), `mouthFill()` (a record cell's invented figure becomes `—`, a named gap); measured: gemma invented "10am to 2pm" opening hours for a volunteer guide before this gate
- falsifying control: a shipped value carrying a figure the material never stated.

### GL-FD-05 — A literal edit is box-owned
- status: proposed
- evidence: fold-blocks-make.js `followUp()` literal branch; measured: 'change "discover" to "uncover"' asked of the mouth returned no change 3/3; box-owned, 0 draws, applied
- falsifying control: a quoted from→to request sent to the mouth.

### GL-FD-06 — Three walls promote a shape to a standing rule (hand-set count, as GL-LD-07)
- status: proposed, open
- evidence: fold-blocks-weave.js `createMemory().count()` with DECLARED.promoteAfter = 3
- falsifying control: a promoted shape asked of the mouth again; a count with no null-and-budget derivation is the open finding.
