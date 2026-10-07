// B3 exploratory probe (post-hoc, NOT one of the pre-registered bars): does counselFor's lexical tie gate accept a MEANING FLIP of a real canon sentence?
// Each case: a verbatim canon sentence the module really quoted in the 2026-10-06 run, and an assertion that reverses its meaning by changing one or two words (no negation word, so the polarity check is blind).
// node eval/ants/B3-flip-probe.mjs   (no model; calls the module's exported tieGate directly)
import { tieGate } from "../../fold-chat-counsel.js";
import { functionWordsOf } from "../../fold-chat-snippets.js";
const fw = functionWordsOf("en");
const C = [
  ["What is virtue?", "Confucius", "The Master said, \"To subdue one's self and return to propriety, is perfect virtue.", "Confucius believes perfect virtue is found in indulging oneself and abandoning propriety."],
  ["What is virtue?", "Confucius", "The Master said, \"To subdue one's self and return to propriety, is perfect virtue.", "Confucius believes that to indulge one's self and return to vanity is perfect virtue."],
  ["Is suffering necessary?", "Mahavira", "All men who are ignorant of the Truth are subject to pain; in the endless Samsara they suffer in many ways.", "Mahavira states that all men who are ignorant of the Truth are free from pain."],
  ["Is it wrong to lie?", "Xunzi", "Thus the superior man looks at things rightly, but the small-minded man looks at things wrongly.", "Xunzi says the small-minded man looks at things rightly, but the superior man looks at things wrongly."],
  ["Is there a God?", "Sri Ramakrishna", "Sri Ramakrishna's sympathy for the poor sprang from his perception of God in all created beings.", "Sri Ramakrishna's contempt for the poor sprang from his perception of God in all created beings."],
  ["Is there a God?", "Sri Ramakrishna", "The pure mind then remains for ever immersed in the ecstasy of God-vision.", "The pure mind then remains for ever immersed in the terror of God-vision."],
  ["Can a person change?", "Xunzi", "Practice alters a person's inclinations; if kept up for a long time it alters his inmost being.", "Xunzi believes practice hardens a person's inclinations; if kept up for a long time it destroys his inmost being."],
  ["Is there a God?", "Mozi", "Therefore God and spirits will send judgment upon them and visit them with calamities and punish and desert them.", "Mozi holds that God and spirits will send blessings upon them and visit them with riches and reward and keep them."],
  ["What is justice?", "Xunzi", "The nature of man is evil; he needs to undergo the government of the Sage-Kings, the reforming action of the rules of proper conduct and justice.", "Xunzi says the nature of man is good; he needs to undergo the government of the Sage-Kings, the reforming action of the rules of proper conduct and justice."],
];
let acc = 0;
for (const [question, giver, sentence, assertion] of C) {
  const g = tieGate({ assertion, sentence, question, giver, fw });
  if (g.ok) acc++;
  console.log((g.ok ? "ACCEPTED " : "rejected ") + (g.ok ? g.kind : g.why).padEnd(24), "|", assertion);
}
console.log(`\n${acc} of ${C.length} meaning-flipped assertions would be TIED to the real sentence by the gate.`);
