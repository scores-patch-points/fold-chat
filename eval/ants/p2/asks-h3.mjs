// H3: a THIRD held-out set, written AFTER the v3 fixes (cue own-word, named-unit dimension, false sentence splits, definition heads, conversion atoms, word-history causal words, agreement)
// and BEFORE v3 was run on it. Real pages that dev, HELD and H2 did not use. Gold copied by hand from the page text; checked by asks-lib `validate`.
const W = (t) => "wiki:" + t;
export const H3 = [
  // figures
  { id: "p01", type: "figure", q: "How many categories were awarded at the 97th Academy Awards?", page: W("97th Academy Awards"), others: [W("2025 NBA Finals"), W("Sleep")], key: "23 categories", min: "the AMPAS presented Academy Awards (commonly referred to as Oscars) in 23 categories" },
  { id: "p02", type: "figure", q: "How many people were in the crowd at the UEFA Euro 2024 final?", page: W("UEFA Euro 2024 final"), others: [W("2025 NBA Finals"), W("Super Bowl LIX")], key: "65,600", min: "In front of a crowd of 65,600" },
  { id: "p03", type: "figure", q: "How many serotypes does Salmonella enterica have?", page: W("Salmonella"), others: [W("Bacteria"), W("Vaccine")], key: "2,650 serotypes", min: "further divided into six subspecies that include over 2,650 serotypes" },
  { id: "p04", type: "figure", q: "How many morae does a traditional haiku have?", page: W("Haiku"), others: [W("Haiku in English"), W("Sleep")], key: "17 morae", min: "Traditional Japanese haiku consist of three phrases composed of 17 morae" },
  // dates
  { id: "p05", type: "date", q: "When was Apple founded?", page: W("Apple Inc."), others: [W("History of Apple Inc."), W("IPhone 16")], key: "1976", min: "Founded in 1976 as Apple Computer Company by Steve Jobs, Steve Wozniak and Ronald Wayne" },
  { id: "p06", type: "date", q: "When was the PlayStation 5 launched in North America?", page: W("PlayStation 5"), others: [W("Nintendo Switch 2"), W("Apple Inc.")], key: "November 12, 2020", min: "launched in Australia, Japan, New Zealand, North America, and South Korea on November 12, 2020" },
  { id: "p07", type: "date", q: "When was the Nintendo Switch 2 released?", page: W("Nintendo Switch 2"), others: [W("PlayStation 5"), W("Apple Inc.")], key: "June 5, 2025", min: "released in most regions on June 5, 2025" },
  { id: "p08", type: "date", q: "When did the Ottomans conquer Constantinople?", page: W("Ottoman Empire"), others: [W("French Revolution"), W("Fixed-wing aircraft")], key: "1453", min: "The Ottomans ended the Byzantine Empire with the conquest of Constantinople in 1453 by Mehmed II" },
  { id: "p09", type: "date", q: "When did the French Revolution end?", page: W("French Revolution"), others: [W("Ottoman Empire"), W("Napoleon")], key: "9 November 1799", min: "ended with the Coup of 18 Brumaire on 9 November 1799" },
  { id: "p10", type: "date", q: "When did the Storming of the Bastille happen?", page: W("French Revolution"), others: [W("Ottoman Empire"), W("Napoleon")], key: "14 July", min: "The Storming of the Bastille in Paris on 14 July" },
  { id: "p11", type: "date", q: "When did the 2025 NBA Finals end?", page: W("2025 NBA Finals"), others: [W("97th Academy Awards"), W("Super Bowl LIX")], key: "June 22", min: "The series began on June 5 and ended on June 22" },
  { id: "p12", type: "date", q: "When was the 97th Academy Awards ceremony held?", page: W("97th Academy Awards"), others: [W("2025 NBA Finals"), W("Sleep")], key: "March 2, 2025", min: "took place on March 2, 2025" },
  // names
  { id: "p13", type: "name", q: "Who founded Apple?", page: W("Apple Inc."), others: [W("History of Apple Inc."), W("IPhone 16")], key: "Steve Jobs", alt: ["Steve Wozniak", "Ronald Wayne"], min: "Founded in 1976 as Apple Computer Company by Steve Jobs, Steve Wozniak and Ronald Wayne" },
  { id: "p14", type: "name", q: "Who hosted the 97th Academy Awards?", page: W("97th Academy Awards"), others: [W("2025 NBA Finals"), W("Sleep")], key: "Conan O'Brien", min: "Comedian Conan O'Brien hosted the show for the first time" },
  { id: "p15", type: "name", q: "Who was the NBA Finals MVP in 2025?", page: W("2025 NBA Finals"), others: [W("Super Bowl LIX"), W("Sleep")], key: "Shai Gilgeous-Alexander", min: "The Thunder's Shai Gilgeous-Alexander was voted the NBA Finals Most Valuable Player (MVP)" },
  { id: "p16", type: "name", q: "Who gave haiku its current name?", page: W("Haiku"), others: [W("Haiku in English"), W("Sleep")], key: "Masaoka Shiki", min: "Haiku was given its current name by the Japanese writer Masaoka Shiki" },
  { id: "p17", type: "name", q: "Who won the UEFA Euro 2024 final?", page: W("UEFA Euro 2024 final"), others: [W("UEFA Euro 2024"), W("2025 NBA Finals")], key: "Spain", min: "Spain won the match 2–1" },
  { id: "p18", type: "name", q: "Who was Salmonella named after?", page: W("Salmonella"), others: [W("Bacteria"), W("Vaccine")], key: "Daniel Elmer Salmon", min: "Salmonella was named after Daniel Elmer Salmon (1850–1914), an American veterinary surgeon" },
  // places
  { id: "p19", type: "place", q: "Where is Apple headquartered?", page: W("Apple Inc."), others: [W("History of Apple Inc."), W("Fixed-wing aircraft")], key: "Cupertino", min: "headquartered in Cupertino, California" },
  { id: "p20", type: "place", q: "Where was the UEFA Euro 2024 final held?", page: W("UEFA Euro 2024 final"), others: [W("UEFA Euro 2024"), W("2025 NBA Finals")], key: "Olympiastadion", min: "The match was held at the Olympiastadion in Berlin, Germany" },
  { id: "p21", type: "place", q: "Where did haiku originate?", page: W("Haiku"), others: [W("Haiku in English"), W("Sleep")], key: "Japan", min: "is a type of short-form poetry that originated in Japan" },
  { id: "p22", type: "place", q: "Where did the 97th Academy Awards take place?", page: W("97th Academy Awards"), others: [W("2025 NBA Finals"), W("Sleep")], key: "Dolby Theatre", min: "took place on March 2, 2025, at the Dolby Theatre in Hollywood" },
  // definitions
  { id: "p23", type: "definition", q: "What is Salmonella?", page: W("Salmonella"), others: [W("Bacteria"), W("Vaccine")], key: "genus of rod-shaped (bacillus), gram-negative bacteria", min: "Salmonella is a genus of rod-shaped (bacillus), gram-negative bacteria of the family Enterobacteriaceae" },
  { id: "p24", type: "definition", q: "What is sleep?", page: W("Sleep"), others: [W("Dehydration"), W("Hangover")], key: "state of reduced mental and physical activity", min: "Sleep is a state of reduced mental and physical activity in which consciousness is altered and certain sensory activity is inhibited" },
  { id: "p25", type: "definition", q: "What is a fixed-wing aircraft?", page: W("Fixed-wing aircraft"), others: [W("Lift (force)"), W("Earthquake")], key: "heavier-than-air aircraft", min: "A fixed-wing aircraft is a heavier-than-air aircraft, such as an airplane, which is capable of flight using aerodynamic lift" },
  { id: "p26", type: "definition", q: "What is haiku?", page: W("Haiku"), others: [W("Haiku in English"), W("Sleep")], key: "type of short-form poetry", min: "is a type of short-form poetry that originated in Japan" },
  { id: "p27", type: "definition", q: "What is the PlayStation 5?", page: W("PlayStation 5"), others: [W("Nintendo Switch 2"), W("Apple Inc.")], key: "home video game console", min: "The PlayStation 5 (PS5) is a home video game console developed by Sony Interactive Entertainment" },
  // list / reason / yes-no
  { id: "p28", type: "list", q: "In which regions was the PlayStation 5 launched first?", page: W("PlayStation 5"), others: [W("Nintendo Switch 2"), W("Apple Inc.")], key: "Australia, Japan, New Zealand, North America, and South Korea", min: "launched in Australia, Japan, New Zealand, North America, and South Korea on November 12, 2020" },
  { id: "p29", type: "reason", q: "Why is Salmonella called Salmonella?", page: W("Salmonella"), others: [W("Bacteria"), W("Vaccine")], key: "named after Daniel Elmer Salmon", min: "Salmonella was named after Daniel Elmer Salmon" },
  { id: "p30", type: "yesno", q: "Did Spain win the UEFA Euro 2024 final?", page: W("UEFA Euro 2024 final"), others: [W("UEFA Euro 2024"), W("2025 NBA Finals")], key: "Spain won the match 2–1", min: "Spain won the match 2–1" },
  { id: "p31", type: "yesno", q: "Is Apple one of the Big Tech companies?", page: W("Apple Inc."), others: [W("History of Apple Inc."), W("IPhone 16")], key: "Apple is one of the Big Tech companies", min: "Apple is one of the Big Tech companies" },
  // other languages
  { id: "r01", type: "date", lang: "es", q: "¿Cuándo alunizó el Apolo 11?", page: W("Apolo 11"), others: [W("Muro de Berlín"), W("Torre Eiffel")], key: "20 de julio", min: "alunizaron en el Mar de la Tranquilidad el 20 de julio a las 20:17 UTC" },
  { id: "r02", type: "date", lang: "fr", q: "Quand a été construit le mur de Berlin ?", page: W("Mur de Berlin"), others: [W("Tour Eiffel"), W("Chute du mur de Berlin")], key: "13 août 1961", min: "est érigé en plein Berlin dès la nuit du 12 au 13 août 1961" },
  { id: "r03", type: "date", lang: "zh", q: "阿波罗11号是哪一年登月的？", page: W("阿波罗11号"), others: [W("柏林墙倒塌"), W("艾菲爾鐵塔")], key: "1969年7月20日", min: "于1969年7月20日20时17分" },
  { id: "r04", type: "definition", lang: "ru", q: "Что такое Канберра?", page: W("Канберра"), others: [W("Берлинская стена"), W("Эйфелева башня")], key: "столица Австралии", min: "— столица Австралии" },
  { id: "r05", type: "place", lang: "pt", gapExpected: true, q: "Qual é a capital da Austrália?", page: W("Camberra"), others: [W("Muro de Berlim"), W("Monte Evereste")], key: "Camberra", min: "Camberra" },
  // unanswerable
  { id: "q01", type: "unanswerable", answerable: false, q: "What is the mascot of Euro 2024?", page: W("UEFA Euro 2024 final"), others: [W("UEFA Euro 2024"), W("2025 NBA Finals")] },
  { id: "q02", type: "unanswerable", answerable: false, q: "What was the weather at the UEFA Euro 2024 final?", page: W("UEFA Euro 2024 final"), others: [W("UEFA Euro 2024"), W("Weather")] },
  { id: "q03", type: "unanswerable", answerable: false, q: "What is the capacity of the Olympiastadion?", page: W("UEFA Euro 2024 final"), others: [W("UEFA Euro 2024"), W("2025 NBA Finals")] },
  { id: "q04", type: "unanswerable", answerable: false, q: "How many calories does Salmonella contain?", page: W("Salmonella"), others: [W("Bacteria"), W("Vaccine")] },
  { id: "q05", type: "unanswerable", answerable: false, q: "What is the mascot of Apple?", page: W("Apple Inc."), others: [W("History of Apple Inc."), W("IPhone 16")] },
  { id: "q06", type: "unanswerable", answerable: false, q: "Who wrote the first haiku?", page: W("Haiku"), others: [W("Haiku in English"), W("Sleep")] },
  { id: "q07", type: "unanswerable", answerable: false, q: "How much does a ticket to the Oscars cost?", page: W("97th Academy Awards"), others: [W("2025 NBA Finals"), W("Sleep")] },
  { id: "q08", type: "unanswerable", answerable: false, q: "What was the weather like during the French Revolution?", page: W("French Revolution"), others: [W("Ottoman Empire"), W("Weather")] },
  { id: "q09", type: "unanswerable", answerable: false, q: "What is the battery life of the PlayStation 5?", page: W("PlayStation 5"), others: [W("Nintendo Switch 2"), W("Apple Inc.")] },
  { id: "q10", type: "unanswerable", answerable: false, q: "What is the price of a fixed-wing aircraft?", page: W("Fixed-wing aircraft"), others: [W("Lift (force)"), W("Earthquake")] },
  { id: "q11", type: "unanswerable", answerable: false, q: "What is the mascot of the 2025 NBA Finals?", page: W("2025 NBA Finals"), others: [W("Super Bowl LIX"), W("Sleep")] },
  { id: "q12", type: "unanswerable", answerable: false, q: "What is the boiling point of ethanol?", page: W("Sleep"), others: [W("Dehydration"), W("Hangover")] },
];
