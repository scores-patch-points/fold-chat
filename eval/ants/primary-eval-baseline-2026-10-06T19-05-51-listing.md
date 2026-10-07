# primary-eval listing — arm baseline — 2026-10-06T19:06:38.787Z

Every page the arm returned, for a person to judge (the oracle's class is a host+text check, not a judgement). `reach` = expected host AND page text carries the claim's say-regexes; `unlisted_passes_text` is NOT counted as reach.

Totals: `{"claims":14,"reach":0,"reachRate":0,"mirrorFA_pages":1,"mirrorFA_claims":1,"wrongFA_pages":12,"wrongFA_claims":12,"unlistedPass_pages":1,"abstained":0}`

## head-of-state (head of state) — returned pages, none reach
claim: Emmanuel Macron is the president of France.

- **unlisted_fails_text** (unlisted_host_text_lacks) https://christianpure.com/learn/emmanuel-meaning-bible/
  title: Emmanuel Means God With Us — and Jesus Was Never Called It | Christian Pure  foundVia: {"host":"en.wikipedia.org"}
  text head: Emmanuel Means God With Us — and Jesus Was Never Called It | Christian Pure Christian Education Emmanuel Means God With Us — and Jesus Was Never Called It Christian Pure Team · Published May 24, 2024 · Updated September 20, 2026 Share Facebook Pinterest X Redd

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/Immanuel  q=Emmanuel Macron is the president of France.
  - kept christianpure.com https://christianpure.com/learn/emmanuel-meaning-bible/  q=Emmanuel Macron is the president of France.

## capital (capital) — MIRROR FALSE ACCEPT
claim: Canberra is the capital city of Australia.

- **forbidden** (forbidden_host) https://www.britannica.com/place/Canberra
  title: Canberra | History, Map, Population, Climate, & Facts | Britannica  foundVia: {"host":"en.wikipedia.org"}
  text head: Canberra | History, Map, Population, Climate, & Facts | Britannica Ask the Chatbot Games & Quizzes History & Society Science & Tech Biographies Animals & Nature Geography & Travel Arts & Culture ProCon Money Videos Canberra Introduction & Top Questions Referen

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/Canberra  q=Canberra is the capital city of Australia.
  - kept britannica.com https://www.britannica.com/place/Canberra  q=Canberra is the capital city of Australia.

## height-everest (height) — returned pages, none reach
claim: Mount Everest's elevation is 8,848.86 metres (29,031.7 ft) above sea level.

- **unlisted_fails_text** (unlisted_host_text_lacks) https://www.merriam-webster.com/dictionary/mount
  title: MOUNT Definition & Meaning - Merriam-Webster  foundVia: {"host":"en.wikipedia.org"}
  text head: MOUNT Definition & Meaning - Merriam-Webster Est. 1828 Dictionary Definition noun (1) verb noun (2) noun 3 noun (1) verb noun (2) Synonyms Example Sentences Word History Rhymes Entries Near Cite this Entry Citation Kids Definition Kids Medical Definition Medic

  trail:
  - kept merriam-webster.com https://www.merriam-webster.com/dictionary/mount  q=Mount Everest's elevation is 8,848.86 metres (29,031.7 ft) above sea l

## death-curie (death date) — returned pages, none reach
claim: Marie Curie died on 4 July 1934 at the Sancellemoz sanatorium in Passy, France.

- **unlisted_fails_text** (unlisted_host_text_lacks) https://www.parents.com/marie-name-meaning-8627666
  title: Explore the Meaning of the Name Marie  foundVia: {"host":"en.wikipedia.org"}
  text head: Explore the Meaning of the Name Marie Lego, Barbie, Magna-Tiles & more top toys are up to 85% off for Amazon Prime Day Marie Name Meaning: Discover Its Rich History and Cultural Significance Marie is often used as a girl name. Learn more about the meaning, ori

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/Marie_(given_name)  q=Marie Curie died on 4 July 1934 at the Sancellemoz sanatorium in Passy
  - kept parents.com https://www.parents.com/marie-name-meaning-8627666  q=Marie Curie died on 4 July 1934 at the Sancellemoz sanatorium in Passy

## count-senate (count) — returned pages, none reach
claim: The United States Senate is composed of 100 senators, two for each of the 50 states.

- **unlisted_fails_text** (unlisted_host_text_lacks) https://us.hotels.united.com/
  title: Book Hotels and Earn 2x More Miles | United Hotels  foundVia: {"host":"en.wikipedia.org"}
  text head: Book Hotels and Earn 2x More Miles | United Hotels Earn more miles Earn 2x miles on almost a million properties Unlock offers Sign in to save with MileagePlus member deals Use your miles Book a stay and pay with miles or use miles + money EXPERIENCE VIP ACCESS

  trail:
  - unreadable (status:200 len:0) united.com https://www.united.com/ual/en/us/  q=The United States Senate is composed of 100 senators, two for each of 
  - unreadable (status:200 len:0) newsroom.united.com https://newsroom.united.com/  q=The United States Senate is composed of 100 senators, two for each of 
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/United_Airlines  q=The United States Senate is composed of 100 senators, two for each of 
  - unreadable (status:200 len:0) united.com https://www.united.com/en/us/book-flight/  q=The United States Senate is composed of 100 senators, two for each of 
  - unreadable (status:200 len:0) united.com https://www.united.com/en/us/checkin  q=The United States Senate is composed of 100 senators, two for each of 
  - unreadable (status:200 len:0) united.com https://www.united.com/en/us/flightstatus  q=The United States Senate is composed of 100 senators, two for each of 
  - unreadable (status:200 len:0) united.com https://www.united.com/en/us/fly/help-center.html  q=The United States Senate is composed of 100 senators, two for each of 
  - unreadable (status:200 len:0) united.com https://www.united.com/en/us/deals/flights  q=The United States Senate is composed of 100 senators, two for each of 
  - unreadable (status:200 len:0) united.com https://www.united.com/en/us/fly/mileageplus.html  q=The United States Senate is composed of 100 senators, two for each of 
  - kept us.hotels.united.com https://us.hotels.united.com/  q=The United States Senate is composed of 100 senators, two for each of 

## definition-tsunami (definition) — returned pages, none reach
claim: A tsunami is a series of waves caused by the displacement of a large volume of water, generally in an ocean or a large lake.

- **host_ok_text_fails** (text_lacks:wave) https://www.tsunami.gov/
  title: U.S. Tsunami Warning Centers  foundVia: {"host":"en.wikipedia.org"}
  text head: U.S. Tsunami Warning Centers United States Department of Commerce NOAA / National Weather Service U.S. Tsunami Warning System Home News Organization Products/Messages Previous Messages Message Subscriptions Message Definitions Product List Warning Criteria Atl

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/Tsunami  q=A tsunami is a series of waves caused by the displacement of a large v
  - kept tsunami.gov https://www.tsunami.gov/  q=A tsunami is a series of waves caused by the displacement of a large v

## founding-un (founding date) — returned pages, none reach
claim: The United Nations was founded on 24 October 1945, when its Charter came into force.

- **unlisted_fails_text** (unlisted_host_text_lacks) https://us.hotels.united.com/
  title: Book Hotels and Earn 2x More Miles | United Hotels  foundVia: {"host":"en.wikipedia.org"}
  text head: Book Hotels and Earn 2x More Miles | United Hotels Earn more miles Earn 2x miles on almost a million properties Unlock offers Sign in to save with MileagePlus member deals Use your miles Book a stay and pay with miles or use miles + money EXPERIENCE VIP ACCESS

  trail:
  - unreadable (status:200 len:0) united.com https://www.united.com/ual/en/us/  q=The United Nations was founded on 24 October 1945, when its Charter ca
  - unreadable (status:200 len:0) newsroom.united.com https://newsroom.united.com/  q=The United Nations was founded on 24 October 1945, when its Charter ca
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/United_Airlines  q=The United Nations was founded on 24 October 1945, when its Charter ca
  - unreadable (status:200 len:0) united.com https://www.united.com/en/us/book-flight/  q=The United Nations was founded on 24 October 1945, when its Charter ca
  - unreadable (status:200 len:0) united.com https://www.united.com/en/us/checkin  q=The United Nations was founded on 24 October 1945, when its Charter ca
  - unreadable (status:200 len:0) united.com https://www.united.com/en/us/flightstatus  q=The United Nations was founded on 24 October 1945, when its Charter ca
  - unreadable (status:200 len:0) united.com https://www.united.com/en/us/fly/help-center.html  q=The United Nations was founded on 24 October 1945, when its Charter ca
  - unreadable (status:200 len:0) united.com https://www.united.com/en/us/deals/flights  q=The United Nations was founded on 24 October 1945, when its Charter ca
  - unreadable (status:200 len:0) united.com https://www.united.com/en/us/fly/mileageplus.html  q=The United Nations was founded on 24 October 1945, when its Charter ca
  - kept us.hotels.united.com https://us.hotels.united.com/  q=The United Nations was founded on 24 October 1945, when its Charter ca

## award-einstein (award) — returned pages, none reach
claim: Albert Einstein was awarded the 1921 Nobel Prize in Physics for his services to theoretical physics and the photoelectric effect.

- **unlisted_fails_text** (unlisted_host_text_lacks) https://albert.com/
  title: Albert | Your personal financial assistant  foundVia: {"host":"en.wikipedia.org"}
  text head: Introducing Genius . Your personal financial assistant. Budget, save, invest, and shop smarter with a financial assistant who gets money and things done. Get started Download the app Albert sees your full financial picture. 📊 Budget 🏦 Accounts 🎯 Forecast 💳

  trail:
  - kept albert.com https://albert.com/  q=Albert Einstein was awarded the 1921 Nobel Prize in Physics for his se

## event-apollo11 (event date) — returned pages, none reach
claim: Apollo 11 landed the first humans on the Moon on 20 July 1969.

- **unlisted_fails_text** (unlisted_host_text_lacks) https://www.apollo.io/
  title: The AI GTM System for Go-to-Market Teams | Apollo  foundVia: {"host":"en.wikipedia.org"}
  text head: The AI GTM System for Go-to-Market Teams | Apollo Grow revenue with one connected GTM system Spend more time selling, not managing tools — with the agentic system that works where you work: Apollo, Claude, ChatGPT, and more. No credit card required Sign up for

  trail:
  - kept apollo.io https://www.apollo.io/  q=Apollo 11 landed the first humans on the Moon on 20 July 1969.

## distance-moon (measure) — returned pages, none reach
claim: The Moon orbits Earth at an average distance of about 384,400 kilometres (238,855 miles).

- **unlisted_passes_text** (unlisted_host) https://moonphase.today/
  title: Moon Phase Today & Tonight: Live Moon Phase Tracker  foundVia: {"host":"en.wikipedia.org"}
  text head: Moon Phase Today & Tonight: Live Moon Phase Tracker Skip to content Moon Phase Today: Waning Crescent On Tuesday, October 6, 2026, the moon phase today is a Waning Crescent , with 16% illumination. Next full moon: Oct 26. N S ⓘ The Moon wobbles slightly as it 

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/Moon  q=The Moon orbits Earth at an average distance of about 384,400 kilometr
  - kept moonphase.today https://moonphase.today/  q=The Moon orbits Earth at an average distance of about 384,400 kilometr

## museum-monalisa (museum holding) — returned pages, none reach
claim: The Mona Lisa, painted by Leonardo da Vinci, is on permanent display at the Louvre Museum in Paris.

- **unlisted_fails_text** (unlisted_host_text_lacks) https://game8.co/games/Genshin-Impact/archives/Mona-Best-Builds
  title: Mona Best Builds and Teams | Genshin Impact｜Game8  foundVia: {"host":"en.wikipedia.org"}
  text head: Mona Best Builds and Teams | Genshin Impact｜Game8 What can you do as a free member? Create your free account today and unlock all our premium features and tools to enhance your gaming experience. Create your free account today and save articles to your watchli

  trail:
  - kept game8.co https://game8.co/games/Genshin-Impact/archives/Mona-Best-Builds  q=The Mona Lisa, painted by Leonardo da Vinci, is on permanent display a

## count-bones (count) — returned pages, none reach
claim: The adult human skeleton has 206 bones.

- **unlisted_fails_text** (unlisted_host_text_lacks) https://www.merriam-webster.com/dictionary/adult
  title: ADULT Definition & Meaning - Merriam-Webster  foundVia: {"host":"en.wikipedia.org"}
  text head: ADULT Definition & Meaning - Merriam-Webster Est. 1828 Dictionary Definition adjective noun verb adjective 3 adjective noun verb Synonyms Example Sentences Word History Phrases Containing Rhymes Entries Near Related Articles Cite this Entry Citation Kids Defin

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/Adult  q=The adult human skeleton has 206 bones.
  - kept merriam-webster.com https://www.merriam-webster.com/dictionary/adult  q=The adult human skeleton has 206 bones.

## founding-harvard (founding date) — returned pages, none reach
claim: Harvard University was founded in 1636 as Harvard College, the oldest institution of higher learning in the United States.

- **host_ok_text_fails** (text_lacks:1636) https://www.harvard.edu/
  title: Harvard University  foundVia: {"host":"en.wikipedia.org"}
  text head: Harvard University Skip to main content Alzheimer’s Bruce Yankner and his team published research showing that lithium is a natural, biologically important element in the brain that has the potential to prevent or even reverse Alzheimer’s disease. Learn more a

  trail:
  - kept harvard.edu https://www.harvard.edu/  q=Harvard University was founded in 1636 as Harvard College, the oldest 

## height-eiffel (height) — returned pages, none reach
claim: The Eiffel Tower is 330 metres tall, about the same height as an 81-storey building.

- **host_ok_text_fails** (text_lacks:330) https://www.toureiffel.paris/en
  title: The OFFICIAL Eiffel Tower website: tickets, news, info...  foundVia: {"host":"en.wikipedia.org"}
  text head: The OFFICIAL Eiffel Tower website: tickets, news, info... The OFFICIAL Eiffel Tower website: tickets, news, info... Cookies management panel Close Cookies management panel This website uses cookies set by SETE or by third parties. This page allows you to deter

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/Gustave_Eiffel  q=The Eiffel Tower is 330 metres tall, about the same height as an 81-st
  - kept toureiffel.paris https://www.toureiffel.paris/en  q=The Eiffel Tower is 330 metres tall, about the same height as an 81-st
