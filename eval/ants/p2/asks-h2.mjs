// H2: a SECOND held-out set, written AFTER the v2 fixes were made and BEFORE v2 was run on it (the first HELD set is no longer held-out for v2: its misses motivated the fixes).
// Real pages the dev and first held sets did not use. Gold copied by hand from the page text; checked by asks-lib `validate`; frozen by sha in FREEZE.json (h2 entry) before the run.
const W = (t) => "wiki:" + t;
export const H2 = [
  // figures
  { id: "k01", type: "figure", q: "What is the population of Chicago?", page: W("Chicago"), others: [W("Barcelona"), W("Switzerland")], key: "2.74 million", min: "with a population of 2.74 million at the 2020 census" },
  { id: "k02", type: "figure", q: "How many cantons does Switzerland have?", page: W("Switzerland"), others: [W("Swiss franc"), W("Barcelona")], key: "26 cantons", min: "Switzerland is a federal republic composed of 26 cantons" },
  { id: "k03", type: "figure", q: "How many people live in Switzerland?", page: W("Switzerland"), others: [W("Swiss franc"), W("Chicago")], key: "9 million people", min: "the majority of its 9 million people are concentrated on the plateau" },
  { id: "k04", type: "figure", q: "What would the Earth's average surface temperature be without the greenhouse effect?", page: W("Greenhouse effect"), others: [W("Climate change"), W("Weather")], key: "−18 °C", min: "Without the greenhouse effect, the Earth's average surface temperature would be as cold as −18 °C" },
  { id: "k05", type: "figure", q: "How many visitors did the Metropolitan Museum of Art have in fiscal year 2025?", page: W("Metropolitan Museum of Art"), others: [W("Louvre"), W("Barcelona")], key: "5,727,258 visitors", min: "With 5,727,258 visitors in fiscal year 2025" },
  { id: "k06", type: "figure", q: "How many works does the Metropolitan Museum of Art list in its collection?", page: W("Metropolitan Museum of Art"), others: [W("Louvre"), W("Chicago")], key: "1.5 million works", min: "it currently lists a total of 1.5 million works" },
  { id: "k07", type: "figure", q: "What is the population of Barcelona?", page: W("Barcelona"), others: [W("Chicago"), W("Switzerland")], key: "1.7 million", min: "With a population of 1.7 million within city limits" },
  { id: "k08", type: "figure", q: "How many metres is a mile exactly?", page: W("Mile"), others: [W("Teaspoon"), W("Tablespoon")], key: "1609.344 metres", min: "making the mile exactly 1609.344 metres" },
  { id: "k09", type: "figure", q: "How many mL is a teaspoon?", page: W("Teaspoon"), others: [W("Tablespoon"), W("Mile")], key: "5 mL", min: "a teaspoonful is defined as 5 mL" },
  // dates
  { id: "k10", type: "date", q: "When was Chicago incorporated as a city?", page: W("Chicago"), others: [W("Barcelona"), W("Switzerland")], key: "1837", min: "Chicago was incorporated as a city in 1837" },
  { id: "k11", type: "date", q: "When did the Great Chicago Fire happen?", page: W("Chicago"), others: [W("Barcelona"), W("Earthquake")], key: "1871", min: "In 1871, the Great Chicago Fire destroyed several square miles" },
  { id: "k12", type: "date", q: "When was the statute mile standardised?", page: W("Mile"), others: [W("Teaspoon"), W("Tablespoon")], key: "1959", min: "The statute mile was standardised as a unit of length between the Commonwealth of Nations and the United States by an international agreement in 1959" },
  // names / places
  { id: "k13", type: "name", q: "Who founded Barcelona according to tradition?", page: W("Barcelona"), others: [W("Chicago"), W("Switzerland")], key: "the Phoenicians", alt: ["Carthaginians"], min: "According to tradition, Barcelona was founded by either the Phoenicians or the Carthaginians" },
  { id: "k14", type: "place", q: "Where is Barcelona located?", page: W("Barcelona"), others: [W("Switzerland"), W("Chicago")], key: "northeastern coast of Spain", min: "Barcelona is a city on the northeastern coast of Spain" },
  { id: "k15", type: "place", q: "Where is the main building of the Metropolitan Museum of Art?", page: W("Metropolitan Museum of Art"), others: [W("Louvre"), W("Chicago")], key: "1000 Fifth Avenue", min: "The main building at 1000 Fifth Avenue" },
  { id: "k16", type: "place", q: "Where is Chicago located?", page: W("Chicago"), others: [W("Barcelona"), W("Switzerland")], key: "western shore of Lake Michigan", min: "Located on the western shore of Lake Michigan" },
  // definitions
  { id: "k17", type: "definition", q: "What is hand washing?", page: W("Hand washing"), others: [W("Bacteria"), W("Vaccine")], key: "process of cleaning the hands", min: "Hand washing (or handwashing), also called hand hygiene, is the process of cleaning the hands with soap or handwash and water to eliminate bacteria, viruses, dirt, microorganisms, and other potentially harmful substances" },
  { id: "k18", type: "definition", q: "What is the greenhouse effect?", page: W("Greenhouse effect"), others: [W("Climate change"), W("Weather")], key: "heat-trapping gases in a planet's atmosphere prevent the planet from losing heat to space", min: "The greenhouse effect occurs when heat-trapping gases in a planet's atmosphere prevent the planet from losing heat to space, raising its surface temperature" },
  { id: "k19", type: "definition", q: "What are tides?", page: W("Tide"), others: [W("Earthquake"), W("Weather")], key: "periodic rise and fall of sea level", min: "Tides are the periodic rise and fall of sea level resulting from the differential gravitational forces exerted primarily by the Moon and the Sun" },
  { id: "k20", type: "definition", q: "What is caffeine?", page: W("Caffeine"), others: [W("Tea"), W("Instant coffee")], key: "central nervous system (CNS) stimulant", min: "Caffeine is a central nervous system (CNS) stimulant of the methylxanthine class" },
  { id: "k21", type: "definition", q: "What is a teaspoon?", page: W("Teaspoon"), others: [W("Tablespoon"), W("Mile")], key: "a small spoon", min: "A teaspoon (tsp.) is a small spoon that can be used to stir a cup of tea or coffee, or as a tool for measuring volume" },
  { id: "k22", type: "definition", q: "What is the Windsor knot?", page: W("Windsor knot"), others: [W("Four-in-hand knot"), W("Teaspoon")], key: "a knot used to tie a necktie", min: "The Windsor knot, sometimes referred to as a full Windsor (or misleadingly as a double Windsor) to distinguish it from the half-Windsor, is a knot used to tie a necktie" },
  // list / reason / yes-no
  { id: "k23", type: "list", q: "Which cities are on the Swiss plateau?", page: W("Switzerland"), others: [W("Barcelona"), W("Chicago")], key: "Zurich, Geneva, Basel, Bern, Lausanne, Winterthur, and Lucerne", min: "including Zurich, Geneva, Basel, Bern, Lausanne, Winterthur, and Lucerne" },
  { id: "k24", type: "reason", q: "Why is the Challenger Deep called the Challenger Deep?", page: W("Challenger Deep"), others: [W("Mariana Trench"), W("Mount Everest")], key: "named after the British Royal Navy survey ships HMS Challenger", min: "The depression is named after the British Royal Navy survey ships HMS Challenger" },
  { id: "k25", type: "yesno", q: "Is Chicago the most populous city in Illinois?", page: W("Chicago"), others: [W("Barcelona"), W("Switzerland")], key: "most populous city in the U.S. state of Illinois", min: "Chicago is the most populous city in the U.S. state of Illinois and in the Midwestern United States" },
  { id: "k26", type: "yesno", q: "Is Switzerland a landlocked country?", page: W("Switzerland"), others: [W("Swiss franc"), W("Barcelona")], key: "a landlocked country", min: "Switzerland, officially the Swiss Confederation, is a landlocked country" },
  // other languages
  { id: "m01", type: "name", lang: "es", q: "¿Quién pintó la Gioconda?", page: W("La Gioconda"), others: [W("Muro de Berlín"), W("Torre Eiffel")], key: "Leonardo da Vinci", min: "es una célebre obra pictórica al óleo de Leonardo da Vinci" },
  { id: "m02", type: "figure", lang: "fr", q: "Quelle est l'altitude de l'Everest ?", page: W("Everest"), others: [W("Tour Eiffel"), W("Mur de Berlin")], key: "8 849 mètres", min: "Son altitude est établie à 8 849 mètres" },
  { id: "m03", type: "figure", lang: "ru", q: "Какова высота Джомолунгмы?", page: W("Джомолунгма"), others: [W("Эйфелева башня"), W("Канберра")], key: "8848,86 м", min: "высочайшая вершина Земли (8848,86 м) на китайско-непальской границе" },
  { id: "m04", type: "name", lang: "zh", q: "蒙娜丽莎是谁画的？", page: W("蒙娜丽莎"), others: [W("艾菲爾鐵塔"), W("柏林墙倒塌")], key: "列奥纳多·达芬奇", min: "是一幅文艺复兴时期画家列奥纳多·达芬奇所绘的肖像画" },
  { id: "m05", type: "figure", lang: "de", gapExpected: true, q: "Wie hoch ist der Mount Everest?", page: W("Höchster Berg"), others: [W("Eiffelturm"), W("Mondlandung")], key: "8", min: "8" },
  { id: "m06", type: "figure", lang: "pt", gapExpected: true, q: "Qual é a velocidade da luz?", page: W("Velocidade da luz"), others: [W("Muro de Berlim"), W("Camberra")], key: "299", min: "299" },
  // unanswerable: on-topic real pages that do not state it, or a near miss
  { id: "v01", type: "unanswerable", answerable: false, q: "What is Chicago's area code?", page: W("Chicago"), others: [W("Barcelona"), W("Switzerland")] },
  { id: "v02", type: "unanswerable", answerable: false, q: "How many bridges does Barcelona have?", page: W("Barcelona"), others: [W("Chicago"), W("Switzerland")] },
  { id: "v03", type: "unanswerable", answerable: false, q: "What is the exchange rate of the Swiss franc to the euro?", page: W("Switzerland"), others: [W("Swiss franc"), W("Barcelona")] },
  { id: "v04", type: "unanswerable", answerable: false, q: "What was the temperature on the day of the Great Chicago Fire?", page: W("Chicago"), others: [W("Barcelona"), W("Earthquake")] },
  { id: "v05", type: "unanswerable", answerable: false, q: "Who invented the Windsor knot?", page: W("Windsor knot"), others: [W("Four-in-hand knot"), W("Teaspoon")] },
  { id: "v06", type: "unanswerable", answerable: false, q: "How many floors does the Metropolitan Museum of Art have?", page: W("Metropolitan Museum of Art"), others: [W("Louvre"), W("Chicago")] },
  { id: "v07", type: "unanswerable", answerable: false, q: "What is the boiling point of caffeine?", page: W("Caffeine"), others: [W("Tea"), W("Instant coffee")] },
  { id: "v08", type: "unanswerable", answerable: false, q: "What is the lowest temperature ever recorded in Barcelona?", page: W("Barcelona"), others: [W("Chicago"), W("Weather")] },
  { id: "v09", type: "unanswerable", answerable: false, q: "What is the boiling point of ethanol?", page: W("Hand washing"), others: [W("Bacteria"), W("Vaccine")] },
  { id: "v10", type: "unanswerable", answerable: false, q: "How tall is the Windsor knot?", page: W("Windsor knot"), others: [W("Four-in-hand knot"), W("Mile")] },
];
