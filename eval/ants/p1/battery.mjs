// eval/ants/p1/battery.mjs — the P1 ladder: 15 rungs x 9 questions over REAL cached Wikipedia pages. Ground truth is CODE (regex / set / number), never a model.
// Fields:  id, rung, q, pages[titles], needs[[title|null, /re/]]  evidence a page MUST carry for the question to be answerable (validated by `node battery.mjs`);
//          gold[/re/..]  every one must match the arm's STATED answer;  forbid[/re/..] none may match;  cmp {win,lose,kind}  comparison grader;  opts {gold,wrong[]} exception grader;
//          conv  the asked unit is NOT stated on the page (a conversion is needed);  coref {ent,attr}  the entity and the attribute must be bound in ONE snip / one stated answer;
//          answerable:false  the right output is a typed gap;  keys[/re/..] summary key facts (R12);  agree/vals (R13).
import { page } from "./corpus.mjs";
const Q = (id, rung, q, pages, o = {}) => ({ id, rung, q, pages, answerable: true, ...o });
const N = (t, re) => [t, re];
export const BATTERY = [
  // ── R1 single stated fact ──
  Q("r1-1", 1, "What is the capital of Australia?", ["Canberra"], { needs: [N("Canberra", /capital city of Australia/)], gold: [/Canberra/] }),
  Q("r1-2", 1, "Who wrote Don Quixote?", ["Don Quixote"], { needs: [N("Don Quixote", /novel by Miguel de Cervantes/)], gold: [/Cervantes/] }),
  Q("r1-3", 1, "In what year did Apollo 11 land on the Moon?", ["Apollo 11"], { needs: [N("Apollo 11", /July 16–24, 1969/)], gold: [/1969/] }),
  Q("r1-4", 1, "Who painted the Mona Lisa?", ["Mona Lisa"], { needs: [N("Mona Lisa", /painting by the Italian artist Leonardo da Vinci/)], gold: [/Leonardo/] }),
  Q("r1-5", 1, "What city is the Louvre in?", ["Louvre"], { needs: [N("Louvre", /national art museum in Paris/)], gold: [/Paris/] }),
  Q("r1-6", 1, "Who discovered penicillin?", ["Penicillin"], { needs: [N("Penicillin", /discovered in 1928 by the Scottish physician Alexander Fleming/)], gold: [/Fleming/] }),
  Q("r1-7", 1, "On what date did the Berlin Wall fall?", ["Fall of the Berlin Wall"], { needs: [N("Fall of the Berlin Wall", /fell on 9 November 1989/)], gold: [/9 November 1989|November 9,? 1989/] }),
  Q("r1-8", 1, "What is the chemical symbol for gold?", ["Gold"], { needs: [N("Gold", /chemical symbol is Au/)], gold: [/\bAu\b/] }),
  Q("r1-9", 1, "Who was the 16th president of the United States?", ["Abraham Lincoln"], { needs: [N("Abraham Lincoln", /was the 16th president of the United States/)], gold: [/Lincoln/] }),
  Q("r1-10", 1, "Who developed the theory of relativity?", ["Albert Einstein"], { needs: [N("Albert Einstein", /best known for developing the theory of relativity/)], gold: [/Einstein/] }),
  // ── R2 a figure with a unit (and a conversion) ──
  Q("r2-1", 2, "How tall is Mount Everest in feet?", ["Mount Everest"], { needs: [N("Mount Everest", /29,031 ft/)], gold: [/29,0[0-9]{2}|29,03[12]|29031|29032/] }),
  Q("r2-2", 2, "How tall is the Eiffel Tower in metres?", ["Eiffel Tower"], { needs: [N("Eiffel Tower", /330 metres \(1,083 ft\) tall/)], gold: [/\b330\b/] }),
  Q("r2-3", 2, "How deep is the Mariana Trench in kilometres?", ["Mariana Trench"], { conv: true, needs: [N("Mariana Trench", /10,935 ± 6 meters/)], gold: [/10\.9/] }),
  Q("r2-4", 2, "What is the speed of light in kilometres per second?", ["Speed of light"], { conv: true, needs: [N("Speed of light", /299792458/)], gold: [/299,?792/] }),
  Q("r2-5", 2, "How long is the Nile in miles?", ["Nile"], { needs: [N("Nile", /7,088 kilometers \(4,404 mi\)/)], gold: [/4,404/] }),
  Q("r2-6", 2, "How far is the Moon from Earth in miles?", ["Lunar distance"], { needs: [N("Lunar distance", /238,854 mi|239,000 mi/)], gold: [/23[89],\d{3}|238,854|239,000/] }),
  Q("r2-7", 2, "How long is the Great Wall of China in kilometres?", ["Great Wall of China"], { needs: [N("Great Wall of China", /21,196\.18 km/)], gold: [/21,196/] }),
  Q("r2-8", 2, "How many feet deep is the Mariana Trench at its deepest?", ["Mariana Trench"], { needs: [N("Mariana Trench", /35,876/)], gold: [/35,876/] }),
  Q("r2-9", 2, "At what temperature in Fahrenheit does water boil?", ["Fahrenheit"], { needs: [N("Fahrenheit", /boiling point of water was defined to be 212 °F/)], gold: [/\b212\b/] }),
  Q("r2-10", 2, "How tall is the Eiffel Tower in kilometres?", ["Eiffel Tower"], { conv: true, needs: [N("Eiffel Tower", /330 metres/)], gold: [/0\.33/] }),
  Q("r2-11", 2, "How tall is Mount Everest in kilometres?", ["Mount Everest"], { conv: true, needs: [N("Mount Everest", /8,848\.86 m/)], gold: [/8\.8[45]/] }),
  // ── R3 definition ──
  Q("r3-1", 3, "What is photosynthesis?", ["Photosynthesis"], { needs: [N("Photosynthesis", /convert light energy.{0,40}into the chemical energy/)], gold: [/light energy/, /chemical energy/] }),
  Q("r3-2", 3, "What is a black hole?", ["Black hole"], { needs: [N("Black hole", /so compact that its gravity prevents anything, including light, from escaping/)], gold: [/gravity/, /light/] }),
  Q("r3-3", 3, "What is mitosis?", ["Mitosis"], { needs: [N("Mitosis", /replicated chromosomes are separated into two new nuclei/)], gold: [/replicated chromosomes/, /two new nuclei/] }),
  Q("r3-4", 3, "What is meiosis?", ["Meiosis"], { needs: [N("Meiosis", /special type of cell division of germ cells/)], gold: [/cell division/, /gametes|sperm or egg/] }),
  Q("r3-5", 3, "What is Python?", ["Python (programming language)"], { needs: [N("Python (programming language)", /high-level, general-purpose programming language/)], gold: [/programming language/] }),
  Q("r3-6", 3, "What is the Solar System?", ["Solar System"], { needs: [N("Solar System", /gravitationally bound system of the Sun/)], gold: [/gravitationally bound/, /Sun/] }),
  Q("r3-7", 3, "What is gold?", ["Gold"], { needs: [N("Gold", /Gold is a chemical element/)], gold: [/chemical element/, /\b79\b/] }),
  Q("r3-8", 3, "What are tides?", ["Tide"], { needs: [N("Tide", /periodic rise and fall of sea level/)], gold: [/rise and fall/, /sea level/] }),
  Q("r3-9", 3, "What is a bacteriophage?", ["Bacteriophage"], { needs: [N("Bacteriophage", /is a virus that infects and replicates within bacteria/)], gold: [/virus/, /bacteria/] }),
  Q("r3-10", 3, "What is a haiku?", ["Haiku"], { needs: [N("Haiku", /short-form poetry that originated in Japan/)], gold: [/short-form poetry/, /Japan/] }),
  // ── R4 list ──
  Q("r4-1", 4, "Name the four largest moons of Jupiter.", ["Jupiter"], { needs: [N("Jupiter", /Io, Europa, Ganymede, and Callisto/)], gold: [/\bIo\b/, /Europa/, /Ganymede/, /Callisto/] }),
  Q("r4-2", 4, "Who were the crew of Apollo 11?", ["Apollo 11"], { needs: [N("Apollo 11", /Neil Armstrong, Command Module Pilot Michael Collins, and Lunar Module Pilot Edwin "Buzz" Aldrin/)], gold: [/Armstrong/, /Collins/, /Aldrin/] }),
  Q("r4-3", 4, "What are the four nucleobases of DNA?", ["DNA"], { needs: [N("DNA", /cytosine \[C\], guanine \[G\], adenine \[A\] or thymine \[T\]/)], gold: [/cytosine/i, /guanine/i, /adenine/i, /thymine/i] }),
  Q("r4-4", 4, "What are the four principal linguistic regions of Switzerland?", ["Switzerland"], { needs: [N("Switzerland", /German, French, Italian, and Romansh/)], gold: [/German/, /French/, /Italian/, /Romansh/] }),
  Q("r4-5", 4, "Name the terrestrial planets.", ["Solar System"], { needs: [N("Solar System", /terrestrial planets – Mercury, Venus, Earth and Mars/)], gold: [/Mercury/, /Venus/, /Earth/, /Mars/] }),
  Q("r4-6", 4, "What are the stages of mitosis?", ["Mitosis"], { needs: [N("Mitosis", /preprophase \(specific to plant cells\), prophase, prometaphase, metaphase, anaphase, and telophase/)], gold: [/prophase/, /prometaphase/, /metaphase/, /anaphase/, /telophase/] }),
  Q("r4-7", 4, "Which Nobel Prizes did Marie Curie win?", ["Marie Curie"], { needs: [N("Marie Curie", /1903 Nobel Prize in Physics/), N("Marie Curie", /1911 Nobel Prize in Chemistry/)], gold: [/Physics/, /Chemistry/] }),
  Q("r4-8", 4, "Which countries border Switzerland?", ["Switzerland"], { needs: [N("Switzerland", /Germany to the north, France to the west, Austria and Liechtenstein to the east, and Italy to the south/)], gold: [/Germany/, /France/, /Austria/, /Liechtenstein/, /Italy/] }),
  Q("r4-9", 4, "Who were Booth's conspirators in the plot to kidnap Lincoln?", ["Assassination of Abraham Lincoln"], { needs: [N("Assassination of Abraham Lincoln", /Lewis Powell, David Herold, and George Atzerodt/)], gold: [/Powell/, /Herold/, /Atzerodt/] }),
  Q("r4-10", 4, "Name the gas giants and ice giants of the outer Solar System.", ["Solar System"], { needs: [N("Solar System", /two gas giants \(Jupiter and Saturn\) and two ice giants \(Uranus and Neptune\)/)], gold: [/Jupiter/, /Saturn/, /Uranus/, /Neptune/] }),
  // ── R5 attribute of a named entity across two sentences (the attribute sentence says He/She, not the name) ──
  Q("r5-1", 5, "When did Napoleon invade Egypt?", ["Napoleon"], { needs: [N("Napoleon", /He led an invasion of Egypt and Syria in 1798/)], gold: [/1798/], coref: { ent: /Napoleon/, attr: /1798/ } }),
  Q("r5-2", 5, "In what year did Marie Curie become the first woman to be a professor at the University of Paris?", ["Marie Curie"], { needs: [N("Marie Curie", /She was, in 1906, the first woman to become a professor/)], gold: [/1906/], coref: { ent: /Curie/, attr: /1906/ } }),
  Q("r5-3", 5, "When did Alexander Fleming discover lysozyme?", ["Alexander Fleming"], { needs: [N("Alexander Fleming", /He also discovered the enzyme lysozyme from his nasal discharge in 1922/)], gold: [/1922/], coref: { ent: /Fleming/, attr: /1922/ } }),
  Q("r5-4", 5, "When was Cervantes captured by Barbary pirates?", ["Miguel de Cervantes"], { needs: [N("Miguel de Cervantes", /He served as a soldier until 1575, when he was captured by Barbary pirates/)], gold: [/1575/], coref: { ent: /Cervantes/, attr: /1575/ } }),
  Q("r5-5", 5, "What prize did Einstein receive in 1921?", ["Albert Einstein"], { needs: [N("Albert Einstein", /He received the 1921 Nobel Prize in Physics/)], gold: [/Nobel Prize in Physics/], coref: { ent: /Einstein/, attr: /Nobel Prize in Physics/ } }),
  Q("r5-6", 5, "In what year did Marie Curie win the Nobel Prize in Chemistry?", ["Marie Curie"], { needs: [N("Marie Curie", /She won the 1911 Nobel Prize in Chemistry/)], gold: [/1911/], coref: { ent: /Curie/, attr: /1911/ } }),
  Q("r5-7", 5, "When did Napoleon win the Battle of Marengo?", ["Napoleon"], { needs: [N("Napoleon", /He won the Battle of Marengo in 1800/)], gold: [/1800/], coref: { ent: /Napoleon/, attr: /1800/ } }),
  Q("r5-8", 5, "When did Lincoln reach a national audience?", ["Abraham Lincoln"], { needs: [N("Abraham Lincoln", /He reached a national audience in the 1858 Senate campaign debates/)], gold: [/1858/], coref: { ent: /Lincoln/, attr: /1858/ } }),
  Q("r5-9", 5, "Who did Fleming share the 1945 Nobel Prize with?", ["Alexander Fleming"], { needs: [N("Alexander Fleming", /He shared the 1945 Nobel Prize in Physiology or Medicine with Howard Florey and Ernst Chain/)], gold: [/Florey/, /Chain/], coref: { ent: /Fleming/, attr: /Florey/ } }),
  // ── R6 comparison of two entities ──
  Q("r6-1", 6, "Which is taller, Mount Everest or the Eiffel Tower?", ["Mount Everest", "Eiffel Tower"], { needs: [N("Mount Everest", /8,848\.86 m/), N("Eiffel Tower", /330 metres/)], gold: [/Everest/], cmp: { win: /Everest/, lose: /Eiffel/, kind: "size" } }),
  Q("r6-2", 6, "Which is longer, the Nile or the Great Wall of China?", ["Nile", "Great Wall of China"], { needs: [N("Nile", /7,088 kilometers/), N("Great Wall of China", /21,196\.18 km/)], gold: [/Great Wall/], cmp: { win: /Great Wall/, lose: /Nile/, kind: "size" } }),
  Q("r6-3", 6, "Who was born first, Leonardo da Vinci or Napoleon?", ["Leonardo da Vinci", "Napoleon"], { needs: [N("Leonardo da Vinci", /15 April 1452/), N("Napoleon", /15 August 1769/)], gold: [/Leonardo/], cmp: { win: /Leonardo/, lose: /Napoleon/, kind: "first" } }),
  Q("r6-4", 6, "Who was born first, Albert Einstein or Marie Curie?", ["Albert Einstein", "Marie Curie"], { needs: [N("Albert Einstein", /14 March 1879/), N("Marie Curie", /7 November 1867/)], gold: [/Curie/], cmp: { win: /Curie/, lose: /Einstein/, kind: "first" } }),
  Q("r6-5", 6, "Who lived longer, Alexander Fleming or Marie Curie?", ["Alexander Fleming", "Marie Curie"], { needs: [N("Alexander Fleming", /6 August 1881 – 11 March 1955/), N("Marie Curie", /7 November 1867 – 4 July 1934/)], gold: [/Fleming/], cmp: { win: /Fleming/, lose: /Curie/, kind: "size" } }),
  Q("r6-6", 6, "Which has more people, Canberra or Iceland?", ["Canberra", "Iceland"], { needs: [N("Canberra", /population of 484,630/), N("Iceland", /roughly 395,000 residents/)], gold: [/Canberra/], cmp: { win: /Canberra/, lose: /Iceland/, kind: "size" } }),
  Q("r6-7", 6, "Who died first, Abraham Lincoln or Miguel de Cervantes?", ["Abraham Lincoln", "Miguel de Cervantes"], { needs: [N("Abraham Lincoln", /April 15, 1865/), N("Miguel de Cervantes", /22 April 1616/)], gold: [/Cervantes/], cmp: { win: /Cervantes/, lose: /Lincoln/, kind: "first" } }),
  Q("r6-8", 6, "Which is older, the Eiffel Tower or the Statue of Liberty?", ["Eiffel Tower", "Statue of Liberty"], { needs: [N("Eiffel Tower", /1889/), N("Statue of Liberty", /dedicated on October 28, 1886/)], gold: [/Statue of Liberty/], cmp: { win: /Statue of Liberty/, lose: /Eiffel/, kind: "size" } }),
  Q("r6-9", 6, "Who was born first, Mahatma Gandhi or Albert Einstein?", ["Mahatma Gandhi", "Albert Einstein"], { needs: [N("Mahatma Gandhi", /2 October 1869/), N("Albert Einstein", /14 March 1879/)], gold: [/Gandhi/], cmp: { win: /Gandhi/, lose: /Einstein/, kind: "first" } }),
  // ── R7 multi-hop across TWO pages (the question names only the first entity indirectly) ──
  Q("r7-1", 7, "In which city is the museum that holds the Mona Lisa?", ["Mona Lisa", "Louvre"], { needs: [N("Mona Lisa", /on display at the Louvre/), N("Louvre", /museum in Paris/)], gold: [/Paris/] }),
  Q("r7-2", 7, "In what year did the engineer whose company built the Eiffel Tower die?", ["Eiffel Tower", "Gustave Eiffel"], { needs: [N("Eiffel Tower", /Gustave Eiffel, whose company designed and built the tower/), N("Gustave Eiffel", /27 December 1923/)], gold: [/1923/] }),
  Q("r7-3", 7, "In what year was the author of Don Quixote born?", ["Don Quixote", "Miguel de Cervantes"], { needs: [N("Don Quixote", /novel by Miguel de Cervantes/), N("Miguel de Cervantes", /1547/)], gold: [/1547/] }),
  Q("r7-4", 7, "Which Nobel Prize did the discoverer of penicillin share in 1945?", ["Penicillin", "Alexander Fleming"], { needs: [N("Penicillin", /Alexander Fleming/), N("Alexander Fleming", /1945 Nobel Prize in Physiology or Medicine/)], gold: [/Physiology or Medicine/] }),
  Q("r7-5", 7, "At which theatre was the 16th president of the United States shot?", ["Abraham Lincoln", "Assassination of Abraham Lincoln"], { needs: [N("Abraham Lincoln", /16th president/), N("Assassination of Abraham Lincoln", /shot at Ford's Theatre/)], gold: [/Ford's Theatre/] }),
  Q("r7-6", 7, "In what year was the painter of the Mona Lisa born?", ["Mona Lisa", "Leonardo da Vinci"], { needs: [N("Mona Lisa", /painting by the Italian artist Leonardo da Vinci/), N("Leonardo da Vinci", /15 April 1452/)], gold: [/1452/] }),
  Q("r7-7", 7, "How tall is the tower named after the engineer who built the Statue of Liberty's metal framework?", ["Statue of Liberty", "Eiffel Tower"], { needs: [N("Statue of Liberty", /metal framework built by Gustave Eiffel/), N("Eiffel Tower", /330 metres/)], gold: [/\b330\b|1,083/] }),
  Q("r7-8", 7, "In what year was the man who built the Statue of Liberty's framework born?", ["Statue of Liberty", "Gustave Eiffel"], { needs: [N("Statue of Liberty", /metal framework built by Gustave Eiffel/), N("Gustave Eiffel", /15 December 1832/)], gold: [/1832/] }),
  // ── R8 aggregation / arithmetic over facts ──
  Q("r8-1", 8, "How many years passed between the Apollo 11 landing and the fall of the Berlin Wall?", ["Apollo 11", "Fall of the Berlin Wall"], { needs: [N("Apollo 11", /1969/), N("Fall of the Berlin Wall", /9 November 1989/)], gold: [/\b20\b|twenty/] }),
  Q("r8-2", 8, "How many years did Marie Curie live?", ["Marie Curie"], { needs: [N("Marie Curie", /7 November 1867 – 4 July 1934/)], gold: [/\b66\b|sixty-six/] }),
  Q("r8-3", 8, "How many years did Alexander Fleming live?", ["Alexander Fleming"], { needs: [N("Alexander Fleming", /6 August 1881 – 11 March 1955/)], gold: [/\b73\b|seventy-three/] }),
  Q("r8-4", 8, "How many metres taller is Mount Everest than the Eiffel Tower?", ["Mount Everest", "Eiffel Tower"], { needs: [N("Mount Everest", /8,848\.86 m/), N("Eiffel Tower", /330 metres/)], gold: [/8,?518/] }),
  Q("r8-5", 8, "How many years before the Eiffel Tower was finished was Lincoln assassinated?", ["Eiffel Tower", "Assassination of Abraham Lincoln"], { needs: [N("Eiffel Tower", /1889/), N("Assassination of Abraham Lincoln", /April 14, 1865/)], gold: [/\b24\b|twenty-four/] }),
  Q("r8-6", 8, "How old was Albert Einstein when he died?", ["Albert Einstein"], { needs: [N("Albert Einstein", /14 March 1879 – 18 April 1955/)], gold: [/\b76\b|seventy-six/] }),
  Q("r8-7", 8, "How many years separate the two Nobel Prizes Marie Curie won?", ["Marie Curie"], { needs: [N("Marie Curie", /1903 Nobel Prize in Physics/), N("Marie Curie", /1911 Nobel Prize in Chemistry/)], gold: [/\b8\b|eight/] }),
  Q("r8-8", 8, "What is the combined population of Canberra and Iceland?", ["Canberra", "Iceland"], { needs: [N("Canberra", /484,630/), N("Iceland", /395,000/)], gold: [/879,?6/] }),
  Q("r8-9", 8, "How many years after the first part of Don Quixote was the second part published?", ["Don Quixote"], { needs: [N("Don Quixote", /published in two parts in 1605 and 1615/)], gold: [/\b10\b|ten/] }),
  // ── R9 temporal order ──
  Q("r9-1", 9, "Which came first, Marie Curie's Nobel Prize in Physics or her Nobel Prize in Chemistry?", ["Marie Curie"], { needs: [N("Marie Curie", /1903 Nobel Prize in Physics/), N("Marie Curie", /1911 Nobel Prize in Chemistry/)], gold: [/Physics/], cmp: { win: /Physics/, lose: /Chemistry/, kind: "first" } }),
  Q("r9-2", 9, "Which came first, the Apollo 11 landing or the fall of the Berlin Wall?", ["Apollo 11", "Fall of the Berlin Wall"], { needs: [N("Apollo 11", /1969/), N("Fall of the Berlin Wall", /1989/)], gold: [/Apollo/], cmp: { win: /Apollo/, lose: /Berlin/, kind: "first" } }),
  Q("r9-3", 9, "Which came first, Lincoln's assassination or the completion of the Eiffel Tower?", ["Assassination of Abraham Lincoln", "Eiffel Tower"], { needs: [N("Assassination of Abraham Lincoln", /April 14, 1865/), N("Eiffel Tower", /1889/)], gold: [/assassination|Lincoln/i], cmp: { win: /assassination|Lincoln/i, lose: /Eiffel/, kind: "first" } }),
  Q("r9-4", 9, "Which came first, the first part of Don Quixote or the birth of Napoleon?", ["Don Quixote", "Napoleon"], { needs: [N("Don Quixote", /1605/), N("Napoleon", /15 August 1769/)], gold: [/Don Quixote/], cmp: { win: /Quixote/, lose: /Napoleon/, kind: "first" } }),
  Q("r9-5", 9, "Which came first, the dedication of the Statue of Liberty or the completion of the Eiffel Tower?", ["Statue of Liberty", "Eiffel Tower"], { needs: [N("Statue of Liberty", /October 28, 1886/), N("Eiffel Tower", /1889/)], gold: [/Statue/], cmp: { win: /Statue/, lose: /Eiffel/, kind: "first" } }),
  Q("r9-6", 9, "Who was born first, Albert Einstein or Alexander Fleming?", ["Albert Einstein", "Alexander Fleming"], { needs: [N("Albert Einstein", /14 March 1879/), N("Alexander Fleming", /6 August 1881/)], gold: [/Einstein/], cmp: { win: /Einstein/, lose: /Fleming/, kind: "first" } }),
  Q("r9-7", 9, "Which did Fleming discover first, penicillin or lysozyme?", ["Alexander Fleming"], { needs: [N("Alexander Fleming", /discovery in 1928 of what was later named benzylpenicillin/), N("Alexander Fleming", /lysozyme from his nasal discharge in 1922/)], gold: [/lysozyme/], cmp: { win: /lysozyme/, lose: /penicillin/i, kind: "first" } }),
  Q("r9-8", 9, "Which came first, Napoleon's invasion of Egypt or the Battle of Marengo?", ["Napoleon"], { needs: [N("Napoleon", /invasion of Egypt and Syria in 1798/), N("Napoleon", /Battle of Marengo in 1800/)], gold: [/Egypt/], cmp: { win: /Egypt/, lose: /Marengo/, kind: "first" } }),
  Q("r9-9", 9, "Who died first, Mahatma Gandhi or Albert Einstein?", ["Mahatma Gandhi", "Albert Einstein"], { needs: [N("Mahatma Gandhi", /30 January 1948/), N("Albert Einstein", /18 April 1955/)], gold: [/Gandhi/], cmp: { win: /Gandhi/, lose: /Einstein/, kind: "first" } }),
  // ── R10 negation / exception (opts: the answer is the option NOT supported by the page) ──
  Q("r10-1", 10, "Which of these is not a moon of Jupiter: Io, Europa, Titan, Callisto?", ["Jupiter"], { needs: [N("Jupiter", /Io, Europa, Ganymede, and Callisto/)], opts: { gold: /Titan/, wrong: [/Io/, /Europa/, /Callisto/] }, gold: [/Titan/] }),
  Q("r10-2", 10, "Which of these was not on the Apollo 11 crew: Armstrong, Collins, Aldrin, Lovell?", ["Apollo 11"], { needs: [N("Apollo 11", /Armstrong, Command Module Pilot Michael Collins/)], opts: { gold: /Lovell/, wrong: [/Armstrong/, /Collins/, /Aldrin/] }, gold: [/Lovell/] }),
  Q("r10-3", 10, "Which of these is not one of Switzerland's four principal linguistic regions: German, French, Spanish, Italian?", ["Switzerland"], { needs: [N("Switzerland", /German, French, Italian, and Romansh/)], opts: { gold: /Spanish/, wrong: [/German/, /French/, /Italian/] }, gold: [/Spanish/] }),
  Q("r10-4", 10, "Which of these is not one of the four nucleobases of DNA: adenine, uracil, guanine, cytosine?", ["DNA"], { needs: [N("DNA", /cytosine \[C\], guanine \[G\], adenine \[A\] or thymine \[T\]/)], opts: { gold: /uracil/i, wrong: [/adenine/i, /guanine/i, /cytosine/i] }, gold: [/uracil/i] }),
  Q("r10-5", 10, "Which of these is not a terrestrial planet: Mercury, Venus, Jupiter, Mars?", ["Solar System"], { needs: [N("Solar System", /terrestrial planets – Mercury, Venus, Earth and Mars/)], opts: { gold: /Jupiter/, wrong: [/Mercury/, /Venus/, /Mars/] }, gold: [/Jupiter/] }),
  Q("r10-6", 10, "Which of these did Marie Curie not win a Nobel Prize in: Physics, Chemistry, Medicine?", ["Marie Curie"], { needs: [N("Marie Curie", /1903 Nobel Prize in Physics/), N("Marie Curie", /1911 Nobel Prize in Chemistry/)], opts: { gold: /Medicine/, wrong: [/Physics/, /Chemistry/] }, gold: [/Medicine/] }),
  Q("r10-7", 10, "Which of these countries does not border Switzerland: Germany, France, Spain, Italy?", ["Switzerland"], { needs: [N("Switzerland", /Germany to the north, France to the west/)], opts: { gold: /Spain/, wrong: [/Germany/, /France/, /Italy/] }, gold: [/Spain/] }),
  Q("r10-8", 10, "Which of these was not one of Booth's conspirators: Powell, Herold, Atzerodt, Grant?", ["Assassination of Abraham Lincoln"], { needs: [N("Assassination of Abraham Lincoln", /Lewis Powell, David Herold, and George Atzerodt/)], opts: { gold: /Grant/, wrong: [/Powell/, /Herold/, /Atzerodt/] }, gold: [/Grant/] }),
  Q("r10-9", 10, "Is Pluto one of the eight planets?", ["Solar System"], { needs: [N("Solar System", /eight planets/), N("Solar System", /dwarf planet/)], gold: [/dwarf planet|not (?:one of|a|among)|\bno\b/i], forbid: [/\byes\b|Pluto is (?:one of|a) (?:the )?(?:eight )?planet/i] }),
  // ── R11 causal why / how (the mechanism is stated in prose) ──
  Q("r11-1", 11, "Why is the daytime sky blue?", ["Rayleigh scattering"], { needs: [N("Rayleigh scattering", /Since blue light wavelengths scatter more, the diffuse sky seen in daytime is blue/)], gold: [/blue/i, /scatter/i, /wavelength/i] }),
  Q("r11-2", 11, "Why is Jupiter flattened at its poles?", ["Jupiter"], { needs: [N("Jupiter", /Because of Jupiter's rapid rotation rate, one turn in ten hours, the shape of the planet is an oblate spheroid/)], gold: [/rotat/i, /oblate|flatten/i] }),
  Q("r11-3", 11, "What causes tides?", ["Tide"], { needs: [N("Tide", /differential gravitational forces exerted primarily by the Moon and the Sun/)], gold: [/gravitation/i, /Moon/, /Sun/] }),
  Q("r11-4", 11, "How does photosynthesis work?", ["Photosynthesis"], { needs: [N("Photosynthesis", /convert light energy—typically from sunlight—into the chemical energy/)], gold: [/light energy|sunlight/i, /chemical energy/i] }),
  Q("r11-5", 11, "Why is the Mariana Trench so deep?", ["Mariana Trench"], { needs: [N("Mariana Trench", /Pacific plate, is subducted \(i\.e\., thrust\) beneath the smaller Mariana plate/)], gold: [/subduct/i, /Pacific plate/i] }),
  Q("r11-6", 11, "Why did the Berlin Wall fall?", ["Fall of the Berlin Wall"], { needs: [N("Fall of the Berlin Wall", /Pan-European Picnic on 19 August 1989 set in motion a peaceful chain reaction/)], gold: [/Picnic|Peaceful Revolution|Hungary|chain reaction/i] }),
  Q("r11-7", 11, "How do vaccines work?", ["Vaccine"], { needs: [N("Vaccine", /stimulates the immune system to recognize the agent as a threat/)], gold: [/immune system/i, /recogni[sz]e|remember/i] }),
  Q("r11-8", 11, "What causes an earthquake?", ["Earthquake"], { needs: [N("Earthquake", /sudden release of energy in the lithosphere that creates seismic waves/)], gold: [/sudden release of energy/i] }),
  Q("r11-9", 11, "Why does the Sun's energy reach Earth as shortwave radiation?", ["Greenhouse effect"], { needs: [N("Greenhouse effect", /Sun has a surface temperature of 5,500 °C.{0,60}emits most of its energy as shortwave radiation/)], gold: [/surface temperature|5,500|hot/i, /shortwave/i] }),
  // ── R12 summarisation (3 sentences; graded by key-fact coverage and absence of invented figures / names) ──
  Q("r12-1", 12, "Summarize this page in 3 sentences.", ["Mount Everest"], { keys: [/highest mountain/i, /Himalaya/i, /Nepal/i, /8,848|29,031/, /climb/i] }),
  Q("r12-2", 12, "Summarize this page in 3 sentences.", ["Marie Curie"], { keys: [/Polish/i, /physicist|chemist/i, /1903/, /1911/, /radium|polonium/i] }),
  Q("r12-3", 12, "Summarize this page in 3 sentences.", ["Apollo 11"], { keys: [/1969/, /Armstrong/, /Aldrin/, /Moon/, /Saturn V|Columbia|Eagle/] }),
  Q("r12-4", 12, "Summarize this page in 3 sentences.", ["Eiffel Tower"], { keys: [/Paris/, /330 metres|1,083/, /Gustave Eiffel/, /1889/, /wrought.iron|lattice|iron/i] }),
  Q("r12-5", 12, "Summarize this page in 3 sentences.", ["Black hole"], { keys: [/gravity/i, /light/i, /general relativity/i, /event horizon/i, /collapse|supermassive|stellar/i] }),
  Q("r12-6", 12, "Summarize this page in 3 sentences.", ["Jupiter"], { keys: [/fifth planet/i, /largest/i, /gas giant/i, /moons/i, /hydrogen|helium/i] }),
  Q("r12-7", 12, "Summarize this page in 3 sentences.", ["Napoleon"], { keys: [/Corsica/i, /Emperor/i, /Revolution/i, /1814|1815|Waterloo/i, /1821|Saint Helena|St\.? Helena|Elba/i] }),
  Q("r12-8", 12, "Summarize this page in 3 sentences.", ["Don Quixote"], { keys: [/Cervantes/i, /novel/i, /1605/, /1615/, /Sancho|knight|Quixote/i] }),
  // ── R13 contradiction across sources: do these two pages agree? (agree:false = they carry conflicting figures; vals = both values) ──
  Q("r13-1", 13, "Do these sources agree on the average distance from the Earth to the Moon?", ["Moon", "Lunar distance"], { agree: false, vals: [/378,000/, /38[45],\d{3}|385,000/], needs: [N("Moon", /averaging around 378,000 kilometers/), N("Lunar distance", /385,000 km|384,399 km/)] }),
  Q("r13-2", 13, "Do these sources agree on how many people live in the Australian Capital Territory?", ["Canberra", "Australian Capital Territory"], { agree: false, vals: [/484,630/, /475,600/], needs: [N("Canberra", /484,630/), N("Australian Capital Territory", /475,600 residents/)] }),
  Q("r13-3", 13, "Do these sources agree on the height of Mount Everest in feet?", ["Mount Everest", "Mount Everest in 2018"], { agree: false, vals: [/29,031/, /29,029/], needs: [N("Mount Everest", /29,031 ft/), N("Mount Everest in 2018", /29,029 feet/)] }),
  Q("r13-4", 13, "Do these sources agree on the date Mahatma Gandhi died?", ["Mahatma Gandhi", "Assassination of Mahatma Gandhi"], { agree: true, vals: [/30 January 1948/], needs: [N("Mahatma Gandhi", /30 January 1948/), N("Assassination of Mahatma Gandhi", /30 January 1948/)] }),
  Q("r13-5", 13, "Do these sources agree on the year Don Quixote's first part was published?", ["Don Quixote", "Miguel de Cervantes"], { agree: true, vals: [/1605/], needs: [N("Don Quixote", /1605/), N("Miguel de Cervantes", /1605/)] }),
  Q("r13-6", 13, "Do these sources agree on the maximum depth of the Challenger Deep?", ["Mariana Trench", "Challenger Deep"], { agree: true, vals: [/10,935/], needs: [N("Mariana Trench", /10,935 ± 6/), N("Challenger Deep", /10,935 ± 6 m/)] }),
  Q("r13-7", 13, "Do these sources agree on the year Abraham Lincoln died?", ["Abraham Lincoln", "Assassination of Abraham Lincoln"], { agree: true, vals: [/1865/], needs: [N("Abraham Lincoln", /1865/), N("Assassination of Abraham Lincoln", /1865/)] }),
  Q("r13-8", 13, "Do these sources agree on the date of the Apollo 11 Moon landing?", ["Apollo 11", "Moon landing"], { agree: true, vals: [/July 20/, /1969/], needs: [N("Apollo 11", /July 20/), N("Moon landing", /1969/)] }),
  Q("r13-9", 13, "Do these sources agree on the height of the Eiffel Tower?", ["Eiffel Tower", "Gustave Eiffel"], { agree: true, vals: [/330/], needs: [N("Eiffel Tower", /330 metres/), N("Gustave Eiffel", /study for a 300/)] }),
  // ── R14 unanswerable from the sources (on-topic, lexically close, the answer is simply not there) ──
  Q("r14-1", 14, "What was Marie Curie's favourite colour?", ["Marie Curie"], { answerable: false, absent: [N("Marie Curie", /favou?rite colou?r/i)] }),
  Q("r14-2", 14, "What did Napoleon eat for breakfast on the day of the Battle of Marengo?", ["Napoleon"], { answerable: false, absent: [N("Napoleon", /breakfast/i)] }),
  Q("r14-3", 14, "How many people visited the Eiffel Tower on its opening day?", ["Eiffel Tower"], { answerable: false, absent: [N("Eiffel Tower", /opening day|first day/i)] }),
  Q("r14-4", 14, "What was Albert Einstein's blood type?", ["Albert Einstein"], { answerable: false, absent: [N("Albert Einstein", /blood type|blood group/i)] }),
  Q("r14-5", 14, "How much did the Great Wall of China cost to build?", ["Great Wall of China"], { answerable: false, absent: [N("Great Wall of China", /cost (?:of|to) build|construction cost|\$\s?\d/i)] }),
  Q("r14-6", 14, "What was Alexander Fleming's salary at St Mary's Hospital?", ["Alexander Fleming"], { answerable: false, absent: [N("Alexander Fleming", /salary/i)] }),
  Q("r14-7", 14, "What is the telephone number of the Louvre?", ["Louvre"], { answerable: false, absent: [N("Louvre", /telephone|phone number/i)] }),
  Q("r14-8", 14, "How much did Leonardo da Vinci charge for painting the Mona Lisa?", ["Mona Lisa"], { answerable: false, absent: [N("Mona Lisa", /charged|fee of|paid \d|florins/i)] }),
  Q("r14-9", 14, "What is the name of Jupiter's tallest mountain?", ["Jupiter"], { answerable: false, absent: [N("Jupiter", /tallest mountain|highest mountain/i)] }),
  // ── R15 opinion / advice (no ground truth: an honest gap is drawn, no verdict is chosen) ──
  Q("r15-1", 15, "Was Napoleon a better leader than Abraham Lincoln?", ["Napoleon", "Abraham Lincoln"], { answerable: false, opinion: true }),
  Q("r15-2", 15, "Should I visit the Louvre or the Eiffel Tower first?", ["Louvre", "Eiffel Tower"], { answerable: false, opinion: true }),
  Q("r15-3", 15, "Is Python a better programming language than JavaScript?", ["Python (programming language)", "JavaScript"], { answerable: false, opinion: true }),
  Q("r15-4", 15, "Was Marie Curie a greater scientist than Albert Einstein?", ["Marie Curie", "Albert Einstein"], { answerable: false, opinion: true }),
  Q("r15-5", 15, "Is it morally right to climb Mount Everest?", ["Mount Everest"], { answerable: false, opinion: true }),
  Q("r15-6", 15, "Is the Mona Lisa the most beautiful painting ever made?", ["Mona Lisa"], { answerable: false, opinion: true }),
  Q("r15-7", 15, "Was the fall of the Berlin Wall a good thing?", ["Fall of the Berlin Wall"], { answerable: false, opinion: true }),
  Q("r15-8", 15, "Should I buy gold as an investment?", ["Gold"], { answerable: false, opinion: true }),
  Q("r15-9", 15, "Which is the best Nobel Prize to win?", ["Marie Curie"], { answerable: false, opinion: true }),
];

// ── validator: every answerable question's evidence IS on the pages; every R14 absence IS absent; R5's attribute sentence really lacks the name ──
export function validate() {
  const bad = [];
  const txt = (t) => page(t).text.replace(/\s+/g, " ");
  for (const q of BATTERY) {
    for (const t of q.pages) { try { page(t); } catch { bad.push(`${q.id}: page missing ${t}`); } }
    for (const [t, re] of q.needs || []) { const pg = t || q.pages[0]; if (!re.test(txt(pg))) bad.push(`${q.id}: needs ${re} not on "${pg}"`); }
    for (const [t, re] of q.absent || []) { if (re.test(txt(t))) bad.push(`${q.id}: absent ${re} IS on "${t}"`); }
    if (q.coref) {
      const sents = txt(q.pages[0]).split(/(?<=[.!?])\s+/);
      const s = sents.find((x) => q.coref.attr.test(x) && !q.coref.ent.test(x) && /^(He|She|It|They)\b/.test(x));
      if (!s) bad.push(`${q.id}: no pronoun sentence with attribute ${q.coref.attr} that lacks the name`);
    }
    if (q.keys) { const pg = txt(q.pages[0]); q.keys.forEach((k, i) => { if (!k.test(pg)) bad.push(`${q.id}: key ${i} ${k} not on page`); }); }
    if (q.vals) { q.vals.forEach((v, i) => { if (!q.pages.some((t) => v.test(txt(t)))) bad.push(`${q.id}: val ${i} ${v} on no page`); }); }
  }
  return bad;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const bad = validate();
  const by = {}; for (const q of BATTERY) by[q.rung] = (by[q.rung] || 0) + 1;
  console.log("questions:", BATTERY.length, "per rung:", JSON.stringify(by));
  console.log(bad.length ? bad.join("\n") : "battery valid: all evidence present, all absences absent");
}
