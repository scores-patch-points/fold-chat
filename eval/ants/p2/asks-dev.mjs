// DEV asks (30): written BEFORE the module, used to build it. The held asks (asks-held.mjs) are written after and frozen before the first run on them.
const W = (t) => "wiki:" + t;
export const DEV = [
  // figures with units
  { id: "d01", type: "figure", q: "How tall is the Eiffel Tower?", page: W("Eiffel Tower"), others: [W("Statue of Liberty"), W("Mount Everest")], key: "330 metres", min: "The tower is 330 metres (1,083 ft) tall" },
  { id: "d02", type: "figure", q: "How deep is the Mariana Trench?", page: W("Mariana Trench"), others: [W("Mount Everest"), W("Nile")], key: "10,935 ± 6 meters", min: "The maximum known depth is 10,935 ± 6 meters" },
  { id: "d03", type: "figure", q: "How long is the Great Wall of China?", page: W("Great Wall of China"), others: [W("Nile"), W("Berlin Wall")], key: "21,196.18 km", min: "spanning 21,196.18 km (13,170.70 mi) in total" },
  { id: "d04", type: "figure", q: "How tall is the Statue of Unity?", page: W("Statue of Unity"), others: [W("Statue of Liberty"), W("Eiffel Tower")], key: "182 metres", min: "The Statue of Unity is the world's tallest statue, with a height of 182 metres (597 feet)" },
  { id: "d05", type: "figure", q: "How far away is the Moon?", page: W("Moon"), others: [W("Solar System"), W("Jupiter")], key: "378,000 kilometers", min: "at a distance that varies over the year, averaging around 378,000 kilometers (235,000 mi)" },
  { id: "d06", type: "figure", q: "What is the atomic number of gold?", page: W("Gold"), others: [W("Photosynthesis"), W("Jupiter")], key: "atomic number 79", min: "Gold is a chemical element; its chemical symbol is Au (from Latin aurum) and atomic number 79" },
  { id: "d07", type: "figure", q: "How many visitors did the Louvre receive in 2025?", page: W("Louvre"), others: [W("Eiffel Tower"), W("Mona Lisa")], key: "9.0 million visitors", min: "It received 9.0 million visitors in 2025" },
  { id: "d08", type: "figure", q: "How long is the Nile?", page: W("Nile"), others: [W("Mount Everest"), W("Great Wall of China")], key: "7,088 kilometers", min: "At 7,088 kilometers (4,404 mi) long, it is the longest river in the world" },
  // dates
  { id: "d09", type: "date", q: "When did construction of the Berlin Wall begin?", page: W("Berlin Wall"), others: [W("Great Wall of China"), W("Napoleon")], key: "13 August 1961", min: "Construction of the Berlin Wall was commenced by the government of the GDR on 13 August 1961" },
  { id: "d10", type: "date", q: "When was Napoleon born?", page: W("Napoleon"), others: [W("Cleopatra"), W("Leonardo da Vinci")], key: "15 August 1769", min: "born Napoleone di Buonaparte; 15 August 1769" },
  { id: "d11", type: "date", q: "When did Marie Curie win her Nobel Prize in Chemistry?", page: W("Marie Curie"), others: [W("Albert Einstein"), W("Alexander Fleming")], key: "1911", min: "She won the 1911 Nobel Prize in Chemistry" },
  { id: "d12", type: "date", q: "When was the Statue of Liberty dedicated?", page: W("Statue of Liberty"), others: [W("Eiffel Tower"), W("Statue of Unity")], key: "October 28, 1886", min: "The statue was dedicated on October 28, 1886" },
  // names
  { id: "d13", type: "name", q: "Who designed the Eiffel Tower?", page: W("Eiffel Tower"), others: [W("Statue of Liberty"), W("Louvre")], key: "Gustave Eiffel", alt: ["Maurice Koechlin", "Émile Nouguier"], min: "It is named after the engineer Gustave Eiffel, whose company designed and built the tower" },
  { id: "d14", type: "name", q: "Who painted the Mona Lisa?", page: W("Mona Lisa"), others: [W("Leonardo da Vinci"), W("Louvre")], key: "Leonardo da Vinci", min: "The Mona Lisa is a half-length portrait painting by the Italian artist Leonardo da Vinci" },
  { id: "d15", type: "name", q: "Who proposed the Celsius scale?", page: W("Celsius"), others: [W("Fahrenheit"), W("Albert Einstein")], key: "Anders Celsius", min: "named after the Swedish astronomer Anders Celsius (1701–1744), who proposed the first version of it in 1742" },
  { id: "d16", type: "name", q: "Who invented Bitcoin?", page: W("Bitcoin"), others: [W("Cryptocurrency"), W("Blockchain")], key: "Satoshi Nakamoto", min: "bitcoin was invented in 2008 when an unknown person published a white paper under the pseudonym of Satoshi Nakamoto" },
  // places
  { id: "d17", type: "place", q: "What is the capital of Iceland?", page: W("Iceland"), others: [W("Canberra"), W("Switzerland")], key: "Reykjavík", min: "Its capital and largest city is Reykjavík" },
  { id: "d18", type: "place", q: "Where was Marie Curie born?", page: W("Marie Curie"), others: [W("Albert Einstein"), W("Napoleon")], key: "Warsaw", min: "Curie was born in Warsaw, Russian Empire" },
  { id: "d19", type: "place", q: "Where is the Statue of Unity located?", page: W("Statue of Unity"), others: [W("Statue of Liberty"), W("Great Wall of China")], key: "Gujarat", min: "located in Narmada valley, near Kevadia in the state of Gujarat, India" },
  // definitions
  { id: "d20", type: "definition", q: "What is photosynthesis?", page: W("Photosynthesis"), others: [W("Cellular respiration"), W("DNA")], key: "convert light energy", min: "Photosynthesis is a system of biological processes by which photopigment-bearing autotrophic organisms, such as most plants, algae and cyanobacteria, convert light energy—typically from sunlight—into the chemical energy" },
  { id: "d21", type: "definition", q: "What is a black hole?", page: W("Black hole"), others: [W("Solar System"), W("Jupiter")], key: "so compact that its gravity prevents anything, including light, from escaping", min: "A black hole is an astronomical body so compact that its gravity prevents anything, including light, from escaping" },
  // reasons
  { id: "d22", type: "reason", q: "Why was the Berlin Wall built?", page: W("Berlin Wall"), others: [W("Great Wall of China"), W("Napoleon")], key: "prevent East German citizens from fleeing to the West", min: "The primary intention for the Wall's construction was to prevent East German citizens from fleeing to the West" },
  { id: "d23", type: "reason", q: "Why was the Great Wall of China built?", page: W("Great Wall of China"), others: [W("Berlin Wall"), W("Louvre")], key: "protection against various nomadic groups", min: "They were built across the historical northern borders of ancient Chinese states and Imperial China as protection against various nomadic groups from the Eurasian Steppe" },
  // lists
  { id: "d24", type: "list", q: "Which planets are the terrestrial planets?", page: W("Solar System"), others: [W("Jupiter"), W("Moon")], key: "Mercury, Venus, Earth and Mars", min: "Closest to the Sun in order of increasing distance are the terrestrial planets – Mercury, Venus, Earth and Mars" },
  { id: "d25", type: "list", q: "What are the four largest moons of Jupiter?", page: W("Jupiter"), others: [W("Moon"), W("Solar System")], key: "Io, Europa, Ganymede, and Callisto", min: "the four largest moons—Io, Europa, Ganymede, and Callisto—orbit within the magnetosphere" },
  // yes/no
  { id: "d26", type: "yesno", q: "Is the Eiffel Tower taller than the Chrysler Building?", page: W("Eiffel Tower"), others: [W("Statue of Liberty"), W("Louvre")], key: "it is now taller than the Chrysler Building by 11 metres", min: "it is now taller than the Chrysler Building by 11 metres (36 ft)" },
  // unanswerable (on-topic page that does not state it; or off-topic pages)
  { id: "d27", type: "unanswerable", answerable: false, q: "How many floors does the Louvre have?", page: W("Louvre"), others: [W("Eiffel Tower"), W("Mona Lisa")] },
  { id: "d28", type: "unanswerable", answerable: false, q: "What is Marie Curie's favourite colour?", page: W("Marie Curie"), others: [W("Albert Einstein"), W("Napoleon")] },
  { id: "d29", type: "unanswerable", answerable: false, q: "What is the boiling point of ethanol?", page: W("Eiffel Tower"), others: [W("Mariana Trench"), W("Berlin Wall")] },
  { id: "d30", type: "unanswerable", answerable: false, q: "How much does the Eiffel Tower weigh in total?", page: W("Statue of Liberty"), others: [W("Louvre"), W("Moon")] },
  // other languages (dev): es, fr, ru, zh have tables; de has none and must give a typed gap
  { id: "d31", type: "figure", lang: "es", q: "¿Qué altitud tiene el monte Everest?", page: W("Monte Everest"), others: [W("Velocidad de la luz"), W("Apolo 11")], key: "8848,86 metros", min: "con una altitud de 8848,86 metros (29 032 pies)" },
  { id: "d32", type: "figure", lang: "fr", q: "Quelle est la vitesse de la lumière ?", page: W("Vitesse de la lumière"), others: [W("Mur de Berlin"), W("Tour Eiffel")], key: "299 792 458 m/s", min: "Elle est égale à 299 792 458 m/s" },
  { id: "d33", type: "figure", lang: "ru", q: "Какова скорость света в вакууме?", page: W("Скорость света"), others: [W("Берлинская стена"), W("Канберра")], key: "299 792 458 м/с", min: "в точности равная 299 792 458 м/с" },
  { id: "d34", type: "figure", lang: "zh", q: "珠穆朗玛峰有多高？", page: W("珠穆朗瑪峰"), others: [W("堪培拉"), W("蒙娜丽莎")], key: "8848.86米", min: "海拔8848.86米" },
  { id: "d35", type: "figure", lang: "de", q: "Wie hoch ist der Eiffelturm?", page: W("Eiffelturm"), others: [W("Mondlandung"), W("Neil Armstrong")], key: "330", min: "330", gapExpected: true },
];
