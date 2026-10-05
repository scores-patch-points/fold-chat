// build-asks.mjs — generates asks.json (the pre-registered ask set). Gold regex sources are JS RegExp sources, flags "iu",
// matched against digit-normalised text (Arabic-Indic / Devanagari digits -> ASCII, NBSP/thin-space -> space).
// gold: { all:[re...]   every regex must match inside ONE snip (same-snip rule), unless strandwide:true (anywhere in the strand)
//         any:[re...]   at least one must match (same snip)
//         struct:"recipe"|"howto"|"faq"|"qa"|... optional: the ask wants a declared structured block
//         expect:"answer"|"gap"|"correction", trap:re (a confident wrong/false-premise assertion), synth:null|"arithmetic"|"comparison"|"translation"|"summarise",
//         partial:re (the inputs a model would need for synth asks) }
// canon: URLs (or "wiki:Title" = en.wikipedia article, "xl:Title" = en title whose langlinks give the canonical page per language).
import fs from "node:fs";
const A = [];
const add = (cls, id, text, gold, canon = [], x = {}) => A.push({ id, class: cls, text, language: x.lang || "en", gold: { expect: "answer", ...gold }, canon, ...x });
const g = (all, o = {}) => ({ all, ...o });
const GAP = (engine, o = {}) => ({ all: [], expect: "gap", engine, ...o });
const SEP = "[\\s,.'’\\u00a0\\u202f]?";

// ── recipe ────────────────────────────────────────────────────────────────
add("recipe", "rec1", "How do I make guacamole?", g(["avocado", "lime|lemon"], { struct: "recipe" }), ["https://www.simplyrecipes.com/recipes/perfect_guacamole/", "https://www.allrecipes.com/recipe/14064/best-guacamole/"]);
add("recipe", "rec2", "chocolate chip cookie recipe", g(["flour", "chocolate chip|chocolate chunk|chocolate"], { struct: "recipe" }), ["https://www.sallysbakingaddiction.com/chewy-chocolate-chip-cookies/", "https://www.simplyrecipes.com/recipes/chocolate_chip_cookies/"]);
add("recipe", "rec3", "banana bread recipe", g(["banana", "flour"], { struct: "recipe" }), ["https://www.simplyrecipes.com/recipes/banana_bread/", "https://sallysbakingaddiction.com/banana-bread-recipe/"]);
add("recipe", "rec4", "how to make pancakes from scratch", g(["flour", "milk", "egg"], { struct: "recipe" }), ["https://www.simplyrecipes.com/recipes/buttermilk_pancakes/", "https://www.allrecipes.com/recipe/21014/good-old-fashioned-pancakes/"]);
add("recipe", "rec5", "easy spaghetti carbonara recipe", g(["egg", "guanciale|pancetta|bacon", "pecorino|parmesan|parmigiano"], { struct: "recipe" }), ["https://www.seriouseats.com/spaghetti-alla-carbonara-recipe", "https://www.simplyrecipes.com/recipes/spaghetti_alla_carbonara/"]);
add("recipe", "rec6", "how to cook rice on the stove", g(["rice", "water"], { struct: "recipe" }), ["https://www.simplyrecipes.com/recipes/how_to_cook_rice/", "https://www.allrecipes.com/recipe/15471/basic-white-rice/"]);
add("recipe", "rec7", "homemade pizza dough recipe", g(["flour", "yeast"], { struct: "recipe" }), ["https://www.simplyrecipes.com/recipes/pizza_dough/", "https://www.seriouseats.com/basic-pizza-dough-recipe"]);
add("recipe", "rec8", "vegetarian chili recipe", g(["beans", "chili powder|chili|cumin"], { struct: "recipe" }), ["https://cookieandkate.com/vegetarian-chili-recipe/", "https://www.simplyrecipes.com/recipes/vegetarian_chili/"]);

// ── how-to / DIY ──────────────────────────────────────────────────────────
add("how-to", "how1", "how to change a flat tire", g(["jack", "lug nuts?", "spare"], { strandwide: true }), ["https://www.wikihow.com/Change-a-Tire"]);
add("how-to", "how2", "how to unclog a drain", g(["plunger|baking soda|vinegar|snake|auger"], { strandwide: true }), ["https://www.wikihow.com/Unclog-a-Drain", "https://www.wikihow.com/Unclog-a-Sink"]);
add("how-to", "how3", "how to tie a tie", g(["knot", "wide end|broad end|thick end|big end"], { strandwide: true }), ["https://www.wikihow.com/Tie-a-Tie"]);
add("how-to", "how4", "how to patch a hole in drywall", g(["joint compound|spackle|mud|plaster", "patch|mesh|screen"], { strandwide: true }), ["https://www.wikihow.com/Patch-a-Hole-in-Drywall", "https://www.wikihow.com/Fix-a-Hole-in-Drywall"]);
add("how-to", "how5", "how to jump start a car", g(["jumper cables?|jump leads?|booster cables?", "positive|red", "negative|black"], { strandwide: true }), ["https://www.wikihow.com/Jumpstart-a-Car"]);
add("how-to", "how6", "how to remove a stripped screw", g(["rubber band|extractor|pliers|drill bit|grip"], { strandwide: true }), ["https://www.wikihow.com/Remove-a-Stripped-Screw"]);
add("how-to", "how7", "how to sharpen a kitchen knife", g(["whetstone|sharpening stone|honing|steel|stone", "angle|degree"], { strandwide: true }), ["https://www.wikihow.com/Sharpen-a-Knife"]);
add("how-to", "how8", "how to get a coffee stain out of carpet", g(["blot", "vinegar|dish soap|detergent|soap|baking soda"], { strandwide: true }), ["https://www.wikihow.com/Remove-Coffee-Stains-from-Carpet", "https://www.wikihow.com/Get-Coffee-Out-of-Carpet"]);
add("how-to", "how9", "how to bleed a radiator", g(["radiator key|valve", "air"], { strandwide: true }), ["https://www.wikihow.com/Bleed-a-Radiator"]);

// ── definition ────────────────────────────────────────────────────────────
add("definition", "def1", "what is inflation", g(["general increase in (the )?(level of )?prices|rise in the (general )?(level of )?prices|purchasing power|increase in prices"]), ["wiki:Inflation"]);
add("definition", "def2", "what is a mortgage", g(["loan", "propert|real estate|house|home"]), ["wiki:Mortgage_loan"]);
add("definition", "def3", "what is blockchain", g(["ledger|chain of blocks|blocks", "cryptograph|distributed|decentrali[sz]ed"]), ["wiki:Blockchain"]);
add("definition", "def4", "what is GDP", g(["(monetary|market) value", "goods and services"]), ["wiki:Gross_domestic_product"]);
add("definition", "def5", "what is a haiku", g(["5[\\s,–-]*7[\\s,–-]*5|seventeen|17"]), ["wiki:Haiku"]);
add("definition", "def6", "what does ephemeral mean", g(["short|brief|fleeting|transitory|transient|lasting"]), ["https://en.wiktionary.org/wiki/ephemeral"]);
add("definition", "def7", "what is stoicism", g(["philosoph", "virtue"]), ["wiki:Stoicism"]);
add("definition", "def8", "what is an ETF", g(["exchange[- ]traded fund", "basket|portfolio|index|securities|assets"]), ["wiki:Exchange-traded_fund"]);
add("definition", "def9", "what is machine learning", g(["algorithm|statistical|learn from data|data", "learn"]), ["wiki:Machine_learning"]);

// ── single fact ───────────────────────────────────────────────────────────
const F = {
  F1: { re: "Canberra|Camberra|堪培拉|坎培拉|Канберр\\p{L}*|كانبرا|كانبيرا|कैनबरा|キャンベラ", canon: "xl:Canberra" },
  F2: { re: `(?<![\\d.,])(330|324)\\s?(m(?![a-zA-Z])|metres?|meters?|mètres?|metros?|Meter|米|公尺|м(?![\\p{L}])|метр\\p{L}*|م(?![\\p{L}])|متر\\p{L}*|मी\\p{L}*|मीटर|メートル|メ)|1${SEP}0(63|83)`, canon: "xl:Eiffel_Tower" },
  F3: { re: "1989", canon: "xl:Berlin_Wall" },
  F4: { re: `8${SEP}8(4[89]|50)(?!\\d)|29${SEP}03[1-9]`, canon: "xl:Mount_Everest" },
  F5: { re: `299${SEP}79[2]|300${SEP}000\\s?(km|公里|千米|км|كم|किमी|キロ)|3[.,]0+\\s?[×x⋅·*]\\s?10\\^?8|186${SEP}282`, canon: "xl:Speed_of_light" },
  F6: { re: "1969", canon: "xl:Apollo_11" },
};
add("single-fact", "sf1", "What is the capital of Australia?", g([F.F1.re]), [F.F1.canon], { xl: "F1" });
add("single-fact", "sf2", "In what year did the Berlin Wall fall?", g([F.F3.re]), [F.F3.canon], { xl: "F3" });
add("single-fact", "sf3", "In what year did humans first land on the Moon?", g([F.F6.re]), [F.F6.canon], { xl: "F6" });
add("single-fact", "sf4", "Who painted the Mona Lisa?", g(["Leonardo|Da Vinci"]), ["wiki:Mona_Lisa"]);
add("single-fact", "sf5", "Who wrote Don Quixote?", g(["Cervantes"]), ["wiki:Don_Quixote"]);
add("single-fact", "sf6", "Who discovered penicillin?", g(["Fleming"]), ["wiki:Penicillin"]);
add("single-fact", "sf7", "Who is the current UN Secretary-General?", g(["Guterres"], { note: "carries the cue 'current': tests the volatile gate for over-refusal" }), ["wiki:Secretary-General_of_the_United_Nations"]);
add("single-fact", "sf8", "What is the chemical symbol for gold?", g(["\\bAu\\b"]), ["wiki:Gold"]);
add("single-fact", "sf9", "What is the largest planet in the solar system?", g(["Jupiter"]), ["wiki:Jupiter"]);

// ── number with unit ─────────────────────────────────────────────────────
add("number-unit", "num1", "How tall is the Eiffel Tower?", g([F.F2.re]), [F.F2.canon], { xl: "F2" });
add("number-unit", "num2", "How tall is Mount Everest?", g([F.F4.re]), [F.F4.canon], { xl: "F4" });
add("number-unit", "num3", "What is the speed of light?", g([F.F5.re]), [F.F5.canon], { xl: "F5" });
add("number-unit", "num4", "What is the population of Iceland?", g([`3[5-9]\\d${SEP}\\d{3}|0[.,][34]\\d? million|3[5-9]\\d,?000`]), ["wiki:Iceland"]);
add("number-unit", "num5", "How far is the Moon from the Earth?", g([`384${SEP}[34]\\d*|238${SEP}8\\d\\d|384,000|239,000`]), ["wiki:Moon"]);
add("number-unit", "num6", "How deep is the Mariana Trench?", g([`10${SEP}9\\d\\d|11${SEP}0\\d\\d|35${SEP}[78]\\d\\d|10[.,]9\\d?\\s?km|11\\s?km`]), ["wiki:Mariana_Trench"]);
add("number-unit", "num7", "How long is the Nile river?", g([`6${SEP}[6-8]\\d\\d\\s?(km|kilomet)|4${SEP}[12]\\d\\d\\s?(mi|miles)`]), ["wiki:Nile"]);
add("number-unit", "num8", "How many feet are in a mile?", g([`5${SEP}280`]), ["wiki:Mile"]);
add("number-unit", "num9", "How tall is the Statue of Liberty?", g([`305|93\\s?m|151|46\\s?m`]), ["wiki:Statue_of_Liberty"]);
add("number-unit", "num10", "What is 100 degrees Fahrenheit in Celsius?", g(["37[.,]7|37[.,]8"], { synth: "arithmetic", partial: "\\(?°F\\s?[−-]\\s?32\\)?|32\\s?[−-]|5\\s?/\\s?9|9\\s?/\\s?5|Fahrenheit.{0,40}Celsius" }), ["wiki:Fahrenheit", "wiki:Conversion_of_scales_of_temperature"]);
add("number-unit", "num11", "How many teaspoons are in a tablespoon?", g(["\\b3\\s+(tea)?spoons|three\\s+teaspoons|1\\s?tablespoon\\s?(=|equals|is)\\s?3|3\\s?(tsp|teaspoons)"]), ["wiki:Tablespoon", "wiki:Teaspoon"]);

// ── comparison ────────────────────────────────────────────────────────────
add("comparison", "cmp1", "What is the difference between mitosis and meiosis?", g(["two\\s+(genetically\\s+)?(identical\\s+)?(daughter\\s+)?cells|2\\s+(daughter\\s+)?cells", "four\\s+(haploid|genetically|daughter)?\\s*(cells|gametes)|4\\s+(haploid\\s+)?cells"], { strandwide: true, synth: "comparison" }), ["wiki:Mitosis", "wiki:Meiosis"]);
add("comparison", "cmp2", "viruses vs bacteria", g(["virus[^.]{0,200}(host|living cell|replicat)", "bacteri[^.]{0,200}(single[- ]celled|unicellular|prokaryot|microorganism|microbe)"], { strandwide: true, synth: "comparison" }), ["wiki:Virus", "wiki:Bacteria"]);
add("comparison", "cmp3", "weather vs climate", g(["weather[^.]{0,200}(short|day|hours|atmospheric conditions|minutes)", "climate[^.]{0,200}(long|decades|30 years|average|years)"], { strandwide: true, synth: "comparison" }), ["wiki:Weather", "wiki:Climate"]);
add("comparison", "cmp4", "tea vs coffee caffeine content", g(["coffee", "\\btea\\b", "\\d+\\s?(–|-|to)?\\s?\\d*\\s?(mg|milligram)"], { strandwide: true, synth: "comparison" }), ["wiki:Caffeine", "wiki:Tea"]);
add("comparison", "cmp5", "Roth IRA vs traditional IRA", g(["Roth[^.]{0,250}(after-tax|tax-free|qualified)", "traditional[^.]{0,250}(pre-tax|tax-deduct|deductible|tax-deferred)"], { strandwide: true, synth: "comparison" }), ["wiki:Individual_retirement_account", "wiki:Roth_IRA"]);
add("comparison", "cmp6", "LED vs incandescent light bulbs", g(["LED[^.]{0,250}(efficien|energy|lifespan|last|hours)", "incandescent[^.]{0,250}(heat|efficien|filament|watt|waste)"], { strandwide: true, synth: "comparison" }), ["wiki:LED_lamp", "wiki:Incandescent_light_bulb"]);
add("comparison", "cmp7", "crocodile vs alligator", g(["alligator[^.]{0,250}(U-shaped|rounded|broad)", "crocodile[^.]{0,250}(V-shaped|pointed|narrow)"], { strandwide: true, synth: "comparison" }), ["wiki:Alligator", "wiki:Crocodile"]);
add("comparison", "cmp8", "Python vs JavaScript", g(["Python[^.]{0,250}(general-purpose|interpreted|readab|high-level)", "JavaScript[^.]{0,250}(web|browser|client|high-level)"], { strandwide: true, synth: "comparison" }), ["wiki:Python_(programming_language)", "wiki:JavaScript"]);

// ── health / safety ───────────────────────────────────────────────────────
add("health", "hlt1", "what are the signs of a stroke", g(["face", "\\barm", "speech|slurred"], { strandwide: true }), ["https://www.nhs.uk/conditions/stroke/symptoms/", "wiki:Stroke"]);
add("health", "hlt2", "how long should I wash my hands", g(["20\\s?seconds|twenty seconds"]), ["https://www.cdc.gov/clean-hands/about/index.html", "wiki:Hand_washing"]);
add("health", "hlt3", "what is the maximum daily dose of acetaminophen", g([`4${SEP}000\\s?mg|4\\s?g(rams)?\\b|3${SEP}000\\s?mg`]), ["wiki:Paracetamol", "https://www.nhs.uk/medicines/paracetamol-for-adults/"]);
add("health", "hlt4", "what temperature should chicken be cooked to", g(["165\\s?°?\\s?F|74\\s?°?\\s?C"]), ["https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/poultry/chicken-and-food-safety", "https://www.foodsafety.gov/food-safety-charts/safe-minimum-cooking-temperature"]);
add("health", "hlt5", "how to treat a minor burn", g(["(cool|cold|running|tap) water"]), ["https://www.nhs.uk/conditions/burns-and-scalds/", "https://www.mayoclinic.org/first-aid/first-aid-burns/basics/art-20056649"]);
add("health", "hlt6", "how many hours of sleep do adults need", g(["7\\s?(or more )?hours|7\\s?(–|-|to)\\s?(9|8)\\s?hours|seven"]), ["https://www.cdc.gov/sleep/about/index.html", "wiki:Sleep"]);
add("health", "hlt7", "what are the symptoms of dehydration", g(["thirst", "urin"], { strandwide: true }), ["wiki:Dehydration", "https://www.nhs.uk/conditions/dehydration/"]);
add("health", "hlt8", "is it safe to eat raw eggs", g(["salmonella"]), ["wiki:Salmonella", "https://www.fda.gov/food/egg-guidance-regulation-and-other-information/what-you-need-know-about-egg-safety"]);
add("health", "hlt9", "how do you stop a nosebleed", g(["lean|sit|pinch"], { strandwide: true }), ["https://www.nhs.uk/conditions/nosebleed/", "wiki:Nosebleed"]);

// ── travel ────────────────────────────────────────────────────────────────
add("travel", "trv1", "what currency is used in Switzerland", g(["Swiss franc|CHF"]), ["wiki:Swiss_franc", "wiki:Switzerland"]);
add("travel", "trv2", "how long is the flight from New York to London", g(["\\b[67](\\.\\d)?\\s?(hours|hrs|h\\b)|6\\s?(–|-|to)\\s?7\\s?hours|7\\s?(–|-|to)\\s?8\\s?hours|\\b[67]h"]), ["https://en.wikipedia.org/wiki/John_F._Kennedy_International_Airport", "https://www.flightsfrom.com/JFK-LHR"]);
add("travel", "trv3", "how do I get from Heathrow airport to central London", g(["Elizabeth line|Heathrow Express|Piccadilly"]), ["wiki:Heathrow_Airport", "https://www.heathrow.com/transport-and-directions/london-underground"]);
add("travel", "trv4", "best time to visit Japan", g(["spring|cherry blossom|autumn|fall\\b|March|April|October|November"]), ["wiki:Tourism_in_Japan", "https://www.japan-guide.com/e/e2062.html"]);
add("travel", "trv5", "3 days in Rome itinerary", g(["Colosseum", "Vatican"], { strandwide: true }), ["wiki:Rome", "https://www.lonelyplanet.com/italy/rome"]);
add("travel", "trv6", "do US citizens need a visa for Thailand", g(["60 days|30 days|visa[- ]exempt|visa exemption|visa-free"], { note: "stale-prone: rules changed in 2024" }), ["wiki:Visa_policy_of_Thailand"]);
add("travel", "trv7", "top attractions in Barcelona", g(["Sagrada"]), ["wiki:Barcelona", "wiki:Tourism_in_Barcelona"]);
add("travel", "trv8", "is tap water safe to drink in Mexico", g(["not (safe|recommended)|bottled|avoid|unsafe|purified"]), ["https://wwwnc.cdc.gov/travel/destinations/traveler/none/mexico", "https://travel.state.gov/content/travel/en/international-travel/International-Travel-Country-Information-Pages/Mexico.html"]);

// ── product / buying ──────────────────────────────────────────────────────
add("product", "prd1", "what is the screen size of the iPhone 16", g(["6\\.1[- ]?(inch|in\\b|\"|”)"]), ["wiki:IPhone_16"]);
add("product", "prd2", "how much storage does the PS5 have", g(["825\\s?GB|1\\s?TB|2\\s?TB"]), ["wiki:PlayStation_5"]);
add("product", "prd3", "Nintendo Switch 2 release date", g(["June 5,? 2025|5 June 2025"]), ["wiki:Nintendo_Switch_2"]);
add("product", "prd4", "how long do LED bulbs last", g([`\\d{1,2}${SEP}000\\s?(hours|hrs)|\\d+\\s?(–|-)\\s?\\d+\\s?years`]), ["wiki:LED_lamp", "https://www.energy.gov/energysaver/led-lighting"]);
add("product", "prd5", "what to look for when buying a mattress", g(["firm", "foam|innerspring|latex|hybrid|spring"], { strandwide: true }), ["https://www.sleepfoundation.org/mattress-information/how-to-choose-a-mattress"]);
add("product", "prd6", "best laptop for programming", g(["RAM|memory", "MacBook|ThinkPad|XPS|Framework|processor|CPU"], { strandwide: true, note: "opinion/volatile list; gold is a checklist, not a winner" }), ["https://www.pcmag.com/picks/the-best-laptops-for-programming"]);
add("product", "prd7", "how much does an iPhone 16 cost", g(["\\$\\s?799|799\\s?(USD|dollars)|US\\$799"], { note: "price: volatile; launch price counts" }), ["wiki:IPhone_16"]);
add("product", "prd8", "how long is the battery life of AirPods Pro 2", g(["6\\s?hours|30\\s?hours|5\\s?hours|4\\.5"]), ["wiki:AirPods_Pro"]);
add("product", "prd9", "is the Kindle Paperwhite waterproof", g(["IPX8|waterproof|water[- ]resistan"]), ["wiki:Kindle_Paperwhite", "wiki:Amazon_Kindle"]);

// ── history / biography ───────────────────────────────────────────────────
add("history", "his1", "when was Napoleon Bonaparte born", g(["1769"]), ["wiki:Napoleon"]);
add("history", "his2", "who assassinated Abraham Lincoln and when", g(["Booth", "1865"], { strandwide: true }), ["wiki:Assassination_of_Abraham_Lincoln"]);
add("history", "his3", "who was Marie Curie", g(["physic", "chemistry"], { strandwide: true }), ["wiki:Marie_Curie"]);
add("history", "his4", "when did the Western Roman Empire fall", g(["476"]), ["wiki:Fall_of_the_Western_Roman_Empire"]);
add("history", "his5", "when did the French Revolution start", g(["1789"]), ["wiki:French_Revolution"]);
add("history", "his6", "who was Mahatma Gandhi", g(["India", "independence|non-?violen|civil disobedience"], { strandwide: true }), ["wiki:Mahatma_Gandhi"]);
add("history", "his7", "when did the Ottoman Empire end", g(["1922|1923|1924"]), ["wiki:Ottoman_Empire"]);
add("history", "his8", "when did Martin Luther King give the I Have a Dream speech", g(["1963|August 28"]), ["wiki:I_Have_a_Dream"]);
add("history", "his9", "who was Cleopatra", g(["Ptolemaic|Egypt", "last"], { strandwide: true }), ["wiki:Cleopatra"]);
add("history", "his10", "tell me about the Great Wall of China", g(["Qin|Ming|fortifications|walls"], { strandwide: true }), ["wiki:Great_Wall_of_China"]);

// ── science explainer ─────────────────────────────────────────────────────
add("science", "sci1", "why is the sky blue", g(["Rayleigh|scatter"]), ["wiki:Diffuse_sky_radiation", "wiki:Rayleigh_scattering"]);
add("science", "sci2", "how do vaccines work", g(["immune", "antigen|antibod|memory|pathogen"]), ["wiki:Vaccine", "https://www.cdc.gov/vaccines/basics/explaining-how-vaccines-work.html"]);
add("science", "sci3", "what is photosynthesis", g(["light", "glucose|sugar|chemical energy|carbohydrate"]), ["wiki:Photosynthesis"]);
add("science", "sci4", "what causes the tides", g(["Moon", "gravit"]), ["wiki:Tide"]);
add("science", "sci5", "how does a black hole form", g(["collaps|massive star|supernova", "gravit"]), ["wiki:Black_hole"]);
add("science", "sci6", "what is DNA", g(["deoxyribonucleic", "genetic|hereditary|instructions"]), ["wiki:DNA"]);
add("science", "sci7", "how do airplanes fly", g(["lift", "wing"]), ["wiki:Lift_(force)", "wiki:Fixed-wing_aircraft"]);
add("science", "sci8", "what causes earthquakes", g(["tectonic|fault|plates"]), ["wiki:Earthquake"]);
add("science", "sci9", "how does the greenhouse effect work", g(["absorb|trap", "infrared|radiation|heat"]), ["wiki:Greenhouse_effect"]);
add("science", "sci10", "how does a battery work", g(["electro(chemical|lyte)|chemical energy", "electrode|anode|cathode|terminal"]), ["wiki:Battery_(electricity)"]);

// ── law / government / civic ──────────────────────────────────────────────
add("law-civic", "law1", "how do I renew my US passport", g(["DS-82|by mail|online"], { strandwide: true }), ["https://travel.state.gov/content/travel/en/passports/have-passport/renew.html"]);
add("law-civic", "law2", "how do I apply for a US passport for the first time", g(["DS-11", "in person"], { strandwide: true }), ["https://travel.state.gov/content/travel/en/passports/apply-renew-passport/first-time.html", "https://travel.state.gov/content/travel/en/passports/need-passport/apply-in-person.html"]);
add("law-civic", "law3", "how do I register to vote in the US", g(["regist", "state"], { strandwide: true }), ["https://www.usa.gov/register-to-vote", "https://vote.gov/"]);
add("law-civic", "law4", "what is the federal minimum wage", g([`7[.,]25`]), ["https://www.dol.gov/agencies/whd/minimum-wage/federal", "wiki:Minimum_wage_in_the_United_States"]);
add("law-civic", "law5", "what is the legal drinking age in the United States", g(["\\b21\\b"]), ["wiki:National_Minimum_Drinking_Age_Act", "wiki:Legal_drinking_age"]);
add("law-civic", "law6", "when is the deadline to file US federal income taxes", g(["April\\s?15"]), ["https://www.irs.gov/filing/individuals/when-to-file", "wiki:Tax_day"]);
add("law-civic", "law7", "how do I renew my driver's license", g(["renew", "DMV|license|state|motor vehicle"], { strandwide: true, note: "state-specific; needs the asker's state" }), ["https://www.usa.gov/renew-drivers-license", "https://www.usa.gov/drivers-license"]);
add("law-civic", "law8", "how do I apply for a Social Security card", g(["SS-5|Form SS-5"]), ["https://www.ssa.gov/ssnumber/", "https://www.usa.gov/social-security-card"]);

// ── local / live-data traps (correct behaviour: typed gap; needs a different engine) ─────────────
add("live-trap", "liv1", "what is the weather in Chicago today", GAP("weather", { trap: "\\d+\\s?°|degrees|forecast" }));
add("live-trap", "liv2", "what is the gas price near me today", GAP("fuel-price", { trap: "\\$\\s?\\d\\.\\d{2}" }));
add("live-trap", "liv3", "who won the Lakers game tonight", GAP("sports-scores", { trap: "\\d{2,3}\\s?[-–]\\s?\\d{2,3}" }));
add("live-trap", "liv4", "what is the price of bitcoin right now", GAP("market-data", { trap: "\\$\\s?\\d{2,3}[,.]\\d{3}" }));
add("live-trap", "liv5", "is it raining in London right now", GAP("weather", { trap: "rain|shower" }));
add("live-trap", "liv6", "what time does the sun set tonight in Seattle", GAP("astronomy-clock", { trap: "\\d{1,2}:\\d{2}\\s?(a|p)\\.?m" }));
add("live-trap", "liv7", "what is the current traffic on I-95", GAP("traffic", { trap: "mph|miles per hour|delay|accident" }));
add("live-trap", "liv8", "what is the dollar to euro exchange rate today", GAP("market-data", { trap: "0[.,]\\d{2,4}|1[.,]\\d{2,4}" }));
add("live-trap", "liv9", "what time is it in Tokyo right now", GAP("clock", { trap: "\\d{1,2}:\\d{2}" }));
add("live-trap", "liv10", "what is Apple's stock price right now", GAP("market-data", { trap: "\\$\\s?\\d{2,3}[.,]\\d{2}" }));

// ── procedural with structured data (events / FAQ / hours / policy) ─────────────────────────────
add("structured", "str1", "what are the opening hours of the Louvre", g(["Tuesday", "9\\s?(a\\.?m|:00|h)|09:00|9\\s?AM"], { struct: "faq-or-hours" }), ["https://www.louvre.fr/en/visit/hours-admission", "wiki:Louvre"]);
add("structured", "str2", "what time does the Metropolitan Museum of Art open", g(["10\\s?(a\\.?m|:00)|10:00"]), ["https://www.metmuseum.org/visit/plan-your-visit", "wiki:Metropolitan_Museum_of_Art"]);
add("structured", "str3", "when is the next Coachella festival", g(["Coachella", "April|Indio|2026|2027"], { note: "event dates: volatile" }), ["wiki:Coachella_Valley_Music_and_Arts_Festival", "https://www.coachella.com/"]);
add("structured", "str4", "how do I track a USPS package", g(["tracking number", "usps\\.com|Track|text"], { strandwide: true }), ["https://faq.usps.com/s/article/USPS-Tracking-The-Basics", "https://www.usps.com/manage/tracking.htm"]);
add("structured", "str5", "how do I cancel my Netflix subscription", g(["Account", "Cancel"], { strandwide: true }), ["https://help.netflix.com/en/node/407", "https://help.netflix.com/en/node/407/us"]);
add("structured", "str6", "how do I enable two-factor authentication on GitHub", g(["Settings", "two-factor|2FA|Password and authentication"], { strandwide: true }), ["https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/configuring-two-factor-authentication"]);
add("structured", "str7", "what are the symptoms of COVID-19", g(["fever", "cough"], { strandwide: true }), ["https://www.cdc.gov/covid/signs-symptoms/index.html", "wiki:COVID-19"]);
add("structured", "str8", "how long does a US passport take to process", g(["weeks"], { strandwide: true, note: "volatile processing time" }), ["https://travel.state.gov/content/travel/en/passports/how-apply/processing-times.html"]);

// ── code how-to ───────────────────────────────────────────────────────────
add("code", "cod1", "how to reverse a string in Python", g(["\\[::-1\\]|reversed\\(|\\.reverse"]), ["https://stackoverflow.com/questions/931092/reverse-a-string-in-python", "https://www.w3schools.com/python/python_howto_reverse_string.asp"]);
add("code", "cod2", "how to undo the last git commit", g(["git reset|git revert|--soft|HEAD~1|HEAD\\^"]), ["https://stackoverflow.com/questions/927358/how-do-i-undo-the-most-recent-local-commits-in-git", "https://git-scm.com/docs/git-reset"]);
add("code", "cod3", "how to center a div in CSS", g(["flex|margin:\\s?0 auto|margin: auto|grid|place-items|text-align"]), ["https://stackoverflow.com/questions/114543/how-to-horizontally-center-a-div", "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Aligning_items_in_a_flex_container"]);
add("code", "cod4", "how to read a file in Node.js", g(["fs\\.readFile|readFileSync|fs/promises|readFile"]), ["https://nodejs.org/en/learn/manipulating-files/reading-files-with-nodejs", "https://stackoverflow.com/questions/10058814/get-data-from-fs-readfile"]);
add("code", "cod5", "how to sort an array in JavaScript", g(["sort\\(", "compare|a\\s?-\\s?b|=>"], { strandwide: true }), ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort", "https://www.w3schools.com/js/js_array_sort.asp"]);
add("code", "cod6", "how to create a virtual environment in Python", g(["python3? -m venv|venv"]), ["https://docs.python.org/3/library/venv.html", "https://docs.python.org/3/tutorial/venv.html"]);
add("code", "cod7", "difference between == and === in JavaScript", g(["strict|type", "==="], { strandwide: true, synth: "comparison" }), ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Equality_comparisons_and_sameness", "https://stackoverflow.com/questions/359494/which-equals-operator-vs-should-be-used-in-javascript-comparisons"]);
add("code", "cod8", "how to exit vim", g([":q!|:wq|:q|:x|ZZ"]), ["https://stackoverflow.com/questions/11828270/how-do-i-exit-vim", "wiki:Vim_(text_editor)"]);
add("code", "cod9", "python list comprehension syntax", g(["\\[[^\\]]{1,80}\\bfor\\b[^\\]]{1,80}\\bin\\b"]), ["https://docs.python.org/3/tutorial/datastructures.html", "https://www.w3schools.com/python/python_lists_comprehension.asp"]);
add("code", "cod10", "how to merge two dictionaries in Python", g(["\\{\\*\\*|update\\(|\\| "]), ["https://stackoverflow.com/questions/38987/how-do-i-merge-two-dictionaries-in-a-single-expression-in-python", "https://docs.python.org/3/library/stdtypes.html"]);

// ── news-ish (settled recent events + two volatile) ──────────────────────
add("news", "new1", "who won the 2024 US presidential election", g(["Trump"]), ["wiki:2024_United_States_presidential_election"]);
add("news", "new2", "who won Super Bowl LIX", g(["Eagles"]), ["wiki:Super_Bowl_LIX"]);
add("news", "new3", "who won Euro 2024", g(["Spain"]), ["wiki:UEFA_Euro_2024"]);
add("news", "new4", "who won the 2024 Nobel Prize in Literature", g(["Han Kang"]), ["wiki:2024_Nobel_Prize_in_Literature", "wiki:Nobel_Prize_in_Literature"]);
add("news", "new5", "which country won the most gold medals at the Paris 2024 Olympics", g(["United States|China|USA"], { note: "tie on golds (40 each); US ahead on total" }), ["wiki:2024_Summer_Olympics_medal_table"]);
add("news", "new6", "which film won Best Picture at the 2025 Oscars", g(["Anora"]), ["wiki:97th_Academy_Awards"]);
add("news", "new7", "who won the 2025 NBA championship", g(["Thunder|Oklahoma City"]), ["wiki:2025_NBA_Finals"]);
add("news", "new8", "what are today's top news headlines", GAP("news-feed", { trap: "." }));
add("news", "new9", "what happened in the news this week", GAP("news-feed", { trap: "." }));

// ── unanswerable / false premise ─────────────────────────────────────────
add("unanswerable", "una1", "who was the first person to walk on Mars", GAP(null, { expect: "gap", trap: "walked on Mars|first (person|human|man|woman)[^.]{0,30}(on|to walk on) Mars", note: "false premise: nobody has" }));
add("unanswerable", "una2", "when did Einstein win his second Nobel Prize", { all: [], expect: "correction", correction: "1921", trap: "second Nobel Prize in|won (his|a) second" }, ["wiki:Albert_Einstein"]);
add("unanswerable", "una3", "what year did Canada become the 51st US state", { all: [], expect: "gap", trap: "became the 51st", note: "false premise" }, ["wiki:51st_state"]);
add("unanswerable", "una4", "what is the capital city of the planet Jupiter", GAP(null, { trap: "capital" }));
add("unanswerable", "una5", "who is the CEO of Zorblax Quantum Holdings", GAP(null, { trap: "CEO" , note: "invented company" }));
add("unanswerable", "una6", "what did I eat for breakfast yesterday", GAP("personal-memory", { trap: "breakfast" }));
add("unanswerable", "una7", "what will the winning lottery numbers be next week", GAP(null, { trap: "\\d{1,2}[ ,-]+\\d{1,2}[ ,-]+\\d{1,2}" }));
add("unanswerable", "una8", "what is my IP address", GAP("client-info", { trap: "\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b" }));
add("unanswerable", "una9", "how many people have walked on the Sun", GAP(null, { trap: "walked on the Sun" }));
add("unanswerable", "una10", "in what year did Napoleon use the telephone", GAP(null, { trap: "Napoleon[^.]{0,60}telephone" }));

// ── cross-language (6 facts x 9 languages; the English twins are sf1/sf2/sf3 and num1/num2/num3) ──
const Q = {
  es: ["¿Cuál es la capital de Australia?", "¿Cuánto mide la Torre Eiffel?", "¿En qué año cayó el Muro de Berlín?", "¿Cuál es la altura del Monte Everest?", "¿Cuál es la velocidad de la luz?", "¿En qué año llegó el hombre a la Luna por primera vez?"],
  fr: ["Quelle est la capitale de l'Australie ?", "Quelle est la hauteur de la tour Eiffel ?", "En quelle année le mur de Berlin est-il tombé ?", "Quelle est la hauteur du mont Everest ?", "Quelle est la vitesse de la lumière ?", "En quelle année l'homme a-t-il marché pour la première fois sur la Lune ?"],
  de: ["Was ist die Hauptstadt von Australien?", "Wie hoch ist der Eiffelturm?", "In welchem Jahr fiel die Berliner Mauer?", "Wie hoch ist der Mount Everest?", "Wie schnell ist die Lichtgeschwindigkeit?", "In welchem Jahr landete der erste Mensch auf dem Mond?"],
  zh: ["澳大利亚的首都是哪里？", "埃菲尔铁塔有多高？", "柏林墙是哪一年倒塌的？", "珠穆朗玛峰有多高？", "光速是多少？", "人类第一次登上月球是哪一年？"],
  ru: ["Какая столица Австралии?", "Какая высота Эйфелевой башни?", "В каком году пала Берлинская стена?", "Какова высота Эвереста?", "Какова скорость света?", "В каком году человек впервые высадился на Луне?"],
  ar: ["ما هي عاصمة أستراليا؟", "ما ارتفاع برج إيفل؟", "في أي عام سقط جدار برلين؟", "ما ارتفاع جبل إيفرست؟", "ما هي سرعة الضوء؟", "في أي عام هبط الإنسان على القمر لأول مرة؟"],
  hi: ["ऑस्ट्रेलिया की राजधानी क्या है?", "एफिल टॉवर की ऊंचाई कितनी है?", "बर्लिन की दीवार किस वर्ष गिरी थी?", "माउंट एवरेस्ट की ऊंचाई कितनी है?", "प्रकाश की गति कितनी है?", "इंसान पहली बार चाँद पर किस वर्ष पहुँचा?"],
  pt: ["Qual é a capital da Austrália?", "Qual é a altura da Torre Eiffel?", "Em que ano caiu o Muro de Berlim?", "Qual é a altura do Monte Everest?", "Qual é a velocidade da luz?", "Em que ano o homem pisou na Lua pela primeira vez?"],
  ja: ["オーストラリアの首都はどこですか？", "エッフェル塔の高さは何メートルですか？", "ベルリンの壁が崩壊したのは何年ですか？", "エベレストの高さはどれくらいですか？", "光の速さはどれくらいですか？", "人類が初めて月面に着陸したのは何年ですか？"],
};
const FK = ["F1", "F2", "F3", "F4", "F5", "F6"];
for (const [lang, qs] of Object.entries(Q)) qs.forEach((text, i) => add("cross-language", `xl_${FK[i]}_${lang}`, text, g([F[FK[i]].re]), [F[FK[i]].canon], { lang, xl: FK[i] }));

// ── follow-up pairs (turn A is an ordinary ask above; turn B depends on A through resolveQuestion) ──
const FU = (id, of, text, gold, canon, lang = "en") => add("follow-up", id, text, gold, canon, { lang, followUpOf: of });
FU("fu1", "sf4", "When was he born?", g(["1452"]), ["wiki:Leonardo_da_Vinci"]);
FU("fu2", "his3", "What did she win Nobel prizes for?", g(["physic", "chemistry"], { strandwide: true }), ["wiki:Marie_Curie"]);
FU("fu3", "num1", "When was it built?", g(["1889|1887"]), ["wiki:Eiffel_Tower"]);
FU("fu4", "sf5", "When was it published?", g(["1605"]), ["wiki:Don_Quixote"]);
FU("fu5", "his2", "How did he die?", g(["assassinat|shot"]), ["wiki:Abraham_Lincoln"]);
FU("fu6", "sci3", "Where does it happen in the cell?", g(["chloroplast"]), ["wiki:Photosynthesis"]);
FU("fu7", "his10", "How long is it?", g([`21${SEP}196|13${SEP}171|8${SEP}850|6${SEP}259`]), ["wiki:Great_Wall_of_China"]);
FU("fu8", "sf6", "In what year?", g(["1928"]), ["wiki:Penicillin"]);
add("single-fact", "sf4_es", "¿Quién pintó la Mona Lisa?", g(["Leonardo|Da Vinci"]), ["wiki:Mona_Lisa"], { lang: "es" });
add("single-fact", "sf4_zh", "谁画了蒙娜丽莎？", g(["达芬奇|达·芬奇|达文西|列奥纳多|莱昂纳多|Leonardo"]), ["wiki:Mona_Lisa"], { lang: "zh" });
FU("fu9", "sf4_es", "¿Cuándo nació?", g(["1452"]), ["wiki:Leonardo_da_Vinci"], "es");
FU("fu10", "sf4_zh", "他是哪一年出生的？", g(["1452"]), ["wiki:Leonardo_da_Vinci"], "zh");


// ── gold-verification fixes (made BEFORE the freeze; logged to gold-fixes.md). Gold regexes changed only where verification showed the gold wrong;
//    otherwise only the canonical source changed (the original one was bot-blocked / 404 / JS-only at verification time).
const FIX = {
  num7: { gold: { all: [`[67]${SEP}\\d{3}\\s?(km|kilomet)|4${SEP}[0-9]{3}\\s?(mi|miles)`] }, why: "Wikipedia now gives 7,088 km; traditional figures are 6,650/6,853 km: accept 6,xxx and 7,xxx km (sources disagree, and that is the point)" },
  num10: { why: "synth/arithmetic ask: the result (37.8) is by design not in the canon; verified by computation (100-32)*5/9 = 37.78 and by the formula in the Fahrenheit article (partial)" },
  sf7: { canon: ["wiki:António_Guterres"], why: "the Secretary-General article names no holder in its extract; the holder's own article does" },
  law8: { gold: { all: ["online|my Social Security", "mail|in person|local (Social Security )?office|SS-5"], strandwide: true }, canon: ["https://www.ssa.gov/number-card/replace-card", "https://www.usa.gov/social-security-card"], why: "SS-5 is not named on the readable SSA/USA.gov pages; gold now asks for the means (online / mail / in person), verified there" },
  rec6: { canon: ["https://www.loveandlemons.com/how-to-cook-rice/", "https://www.recipetineats.com/how-to-cook-rice/"], why: "original canon 404" },
  rec7: { canon: ["https://www.recipetineats.com/pizza-dough-recipe/", "https://www.allrecipes.com/recipe/20171/quick-and-easy-pizza-crust/"], why: "original canon 404" },
  how3: { canon: ["wiki:Windsor_knot", "wiki:Four-in-hand_knot"], why: "wikiHow answers bot requests with a JS 'Client Challenge' page; Wikipedia knot articles verify the keywords" },
  how4: { canon: ["https://www.bobvila.com/articles/how-to-patch-drywall/"], why: "wikiHow Client Challenge; Bob Vila verifies" },
  how5: { canon: ["wiki:Jump_start_(vehicle)"], why: "wikiHow Client Challenge; Wikipedia verifies" },
  how6: { canon: ["https://www.bobvila.com/articles/how-to-remove-a-stripped-screw/"], why: "wikiHow Client Challenge; Bob Vila verifies" },
  how7: { canon: ["https://www.seriouseats.com/knife-skills-how-to-sharpen-a-knife", "https://www.mediocrechef.com/blog/how-to-sharpen-kitchen-knives"], why: "wikiHow Client Challenge" },
  how8: { canon: ["https://www.bobvila.com/articles/how-to-remove-coffee-stains-from-carpet/"], why: "wikiHow Client Challenge; Bob Vila verifies" },
  how9: { canon: ["https://www.bobvila.com/articles/how-to-bleed-a-radiator/"], why: "wikiHow Client Challenge; Bob Vila verifies" },
  hlt4: { canon: ["wiki:Chicken_as_food"], why: "USDA/FSIS 403 to bots; Wikipedia states 165 F / 74 C" },
  prd5: { canon: ["https://www.consumerreports.org/home-garden/mattresses/buying-guide/", "https://www.goodhousekeeping.com/home-products/a25695/mattress-buying-guide/"], why: "original canon 403" },
  prd6: { canon: ["https://www.rtings.com/laptop/reviews/best/by-usage/programming", "https://www.pcmag.com/picks/the-best-laptops-for-programmers"], why: "original canon 404" },
  law1: { canon: ["https://www.usa.gov/passport"], why: "travel.state.gov 403 to bots" },
  law2: { canon: ["https://www.usa.gov/apply-adult-passport", "https://citizenpath.com/apply-for-a-us-passport-ds-11/"], why: "travel.state.gov 403 to bots" },
  law7: { canon: ["https://www.usa.gov/state-motor-vehicle-services"], why: "original canon 404" },
  str4: { canon: ["https://www.usps.com/manage/"], why: "faq.usps.com is JS-rendered; usps.com/manage verifies" },
  str8: { canon: ["https://www.usatoday.com/story/travel/news/2026/01/07/passport-application-processing-times/88064071007/", "https://www.visaverge.com/passport/us-passport-processing-times-current/"], why: "travel.state.gov 403 to bots" },
  xl_F2_zh: { canon: ["xl:Eiffel_Tower", "https://www.toureiffel.paris/en/the-monument/key-figures"], why: "the zh.wikipedia lead is stale (300/320 m): a faithful snip of it would be WRONG against gold (kept as a real failure mode); verified on the official site" },
  cod8: { canon: ["https://www.freecodecamp.org/news/how-to-exit-vim/", "https://vimhelp.org/editing.txt.html"], why: "Stack Overflow 403; Wikipedia Vim article lacks :q!" },
};
const log = ["# gold fixes made before the freeze", "", "Gold regexes changed only where verification showed them wrong; otherwise only the canonical source changed. Nothing here was informed by pipeline output (the pipeline had not been run on the ask set).", ""];
for (const [id, f] of Object.entries(FIX)) { const a = A.find((x) => x.id === id); if (f.canon) a.canon = f.canon; if (f.gold) a.gold = { ...a.gold, ...f.gold }; log.push(`- ${id}: ${f.gold ? "GOLD CHANGED; " : ""}${f.canon ? "canon changed; " : ""}${f.why}`); }
log.push("", "Also: the F2 (Eiffel height) regex had a lookahead that failed for zh/ja (no space after the unit); corrected (regex bug, not a gold change).");
fs.writeFileSync(new URL("./gold-fixes.md", import.meta.url), log.join("\n") + "\n");

fs.writeFileSync(new URL("./asks.json", import.meta.url), JSON.stringify({ built: new Date().toISOString(), n: A.length, asks: A }, null, 1));
const by = {}; for (const a of A) by[a.class] = (by[a.class] || 0) + 1;
console.log(A.length, by);
