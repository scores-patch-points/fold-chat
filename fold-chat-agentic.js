// fold-chat-agentic.js — "Agent +" starts the FOLD agent (agentic coding).
//
// The agent is NOT a terminal: it is a FOLD (fold-chat-folds.js) — a session on
// the left (the ask, each assembly's units and who filled them, follow-ups,
// edits, undos) and the artifact's canvas on the right (Preview · EOT · files).
// A fold is the artifact AND its whole making, as an append-only log. This
// module only wires the sidebar entry: "Agent +" starts one.
//
// (Replaces the earlier literal-terminal experiment, which was the wrong layer.)
export function mountAgentic() {
  const bind = () => {
    const s = document.getElementById("agStart");
    if (s && !s.dataset.agBound) {
      s.dataset.agBound = "1";
      s.onclick = () => {           // the same start the Folds "＋" uses
        const n = document.getElementById("foldsNew");
        if (n) n.click();
      };
    }
  };
  bind();
  setInterval(bind, 500);
}
