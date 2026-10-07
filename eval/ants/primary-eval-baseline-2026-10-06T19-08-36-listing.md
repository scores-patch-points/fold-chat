# primary-eval listing — arm baseline — 2026-10-06T19:09:34.479Z

Every page the arm returned, for a person to judge (the oracle's class is a host+text check, not a judgement). `reach` = expected host AND page text carries the claim's say-regexes; `unlisted_passes_text` is NOT counted as reach.

Totals: `{"claims":14,"reach":9,"reachRate":0.6428571428571429,"mirrorFA_pages":2,"mirrorFA_claims":2,"wrongFA_pages":0,"wrongFA_claims":0,"unlistedPass_pages":3,"abstained":0}`

## head-of-state (head of state) — REACH
claim: Emmanuel Macron is the president of France.

- **reach** (ok_host_and_text) https://www.elysee.fr/en/emmanuel-macron
  title: Emmanuel Macron | Élysée  foundVia: {"host":"en.wikipedia.org"}
  text head: Emmanuel Macron | Élysée Access main content Access search _follow_us_on_facebook" eulerian-label="follow_us_on_facebook" eulerian-component-hierarchy="follow_us_>_module_>_social_>_link"> follow us on Facebook _follow_us_on_twitter" eulerian-label="follow_us_

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/Emmanuel_Macron  q=Emmanuel Macron is the president of France.
  - kept elysee.fr https://www.elysee.fr/en/emmanuel-macron  q=Emmanuel Macron is the president of France.

## capital (capital) — MIRROR FALSE ACCEPT
claim: Canberra is the capital city of Australia.

- **forbidden** (forbidden_host) https://www.britannica.com/place/Canberra
  title: Canberra | History, Map, Population, Climate, & Facts | Britannica  foundVia: {"host":"en.wikipedia.org"}
  text head: Canberra | History, Map, Population, Climate, & Facts | Britannica Ask the Chatbot Games & Quizzes History & Society Science & Tech Biographies Animals & Nature Geography & Travel Arts & Culture ProCon Money Videos Canberra Introduction & Top Questions Referen

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/Canberra  q=Canberra is the capital city of Australia.
  - kept britannica.com https://www.britannica.com/place/Canberra  q=Canberra is the capital city of Australia.

## height-everest (height) — MIRROR FALSE ACCEPT
claim: Mount Everest's elevation is 8,848.86 metres (29,031.7 ft) above sea level.

- **forbidden** (forbidden_host) https://www.britannica.com/place/Mount-Everest
  title: Mount Everest | Height, Map, Deaths, Facts, & Climbers | Britannica  foundVia: {"host":"en.wikipedia.org"}
  text head: Mount Everest | Height, Map, Deaths, Facts, & Climbers | Britannica Ask the Chatbot Games & Quizzes History & Society Science & Tech Biographies Animals & Nature Geography & Travel Arts & Culture ProCon Money Videos Mount Everest Introduction & Top Questions P

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/Mount_Everest  q=Mount Everest's elevation is 8,848.86 metres (29,031.7 ft) above sea l
  - kept britannica.com https://www.britannica.com/place/Mount-Everest  q=Mount Everest's elevation is 8,848.86 metres (29,031.7 ft) above sea l

## death-curie (death date) — returned pages, none reach
claim: Marie Curie died on 4 July 1934 at the Sancellemoz sanatorium in Passy, France.

- **unlisted_passes_text** (unlisted_host) https://thisdayinhistory.ai/event/death-of-marie-curie.860852
  title: Death of Marie Curie - July 4, 1934 | This Day in History  foundVia: {"host":"en.wikipedia.org"}
  text head: Death of Marie Curie - July 4, 1934 | This Day in History Skip to main content On July 4, 1934, in the alpine stillness of the Sancellemoz sanatorium near Passy, France, Marie Curie drew her final breath. The cause of death was aplastic anemia, a devastating b

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/Marie_Curie  q=Marie Curie died on 4 July 1934 at the Sancellemoz sanatorium in Passy
  - kept thisdayinhistory.ai https://thisdayinhistory.ai/event/death-of-marie-curie.860852  q=Marie Curie died on 4 July 1934 at the Sancellemoz sanatorium in Passy

## count-senate (count) — REACH
claim: The United States Senate is composed of 100 senators, two for each of the 50 states.

- **reach** (ok_host_and_text) https://www.usa.gov/agencies/u-s-senate
  title: U.S. Senate | USAGov  foundVia: {"host":"en.wikipedia.org"}
  text head: U.S. Senate | USAGov Skip to main content U.S. Senate The U.S. Senate and the U.S. House of Representatives make up the two chambers of Congress. The Senate has 100 members, two from each state, who are elected to serve for a term of six years. Website U.S. Se

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/United_States_Senate  q=The United States Senate is composed of 100 senators, two for each of 
  - kept usa.gov https://www.usa.gov/agencies/u-s-senate  q=The United States Senate is composed of 100 senators, two for each of 

## definition-tsunami (definition) — REACH
claim: A tsunami is a series of waves caused by the displacement of a large volume of water, generally in an ocean or a large lake.

- **reach** (ok_host_and_text) https://www.noaa.gov/education/resource-collections/ocean-coasts/tsunamis
  title: Tsunamis | National Oceanic and Atmospheric Administration  foundVia: {"host":"en.wikipedia.org"}
  text head: Tsunamis | National Oceanic and Atmospheric Administration Skip to main content Official websites use .gov A .gov website belongs to an official government organization in the United States. Secure .gov websites use HTTPS A lock ( ) or https:// means you’ve sa

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/Tsunami  q=A tsunami is a series of waves caused by the displacement of a large v
  - kept noaa.gov https://www.noaa.gov/education/resource-collections/ocean-coasts/tsunamis  q=A tsunami is a series of waves caused by the displacement of a large v

## founding-un (founding date) — REACH
claim: The United Nations was founded on 24 October 1945, when its Charter came into force.

- **reach** (ok_host_and_text) https://www.un.org/en/about-us/history-of-the-un
  title: History of the United Nations | United Nations  foundVia: {"host":"en.wikipedia.org"}
  text head: History of the United Nations | United Nations Skip to main content History of the United Nations The UN Secretariat building (at left) under construction in New York City in 1949. At right, the Secretariat and General Assembly buildings four decades later in 

  trail:
  - kept un.org https://www.un.org/en/about-us/history-of-the-un  q=The United Nations was founded on 24 October 1945, when its Charter ca

## award-einstein (award) — REACH
claim: Albert Einstein was awarded the 1921 Nobel Prize in Physics for his services to theoretical physics and the photoelectric effect.

- **reach** (ok_host_and_text) https://www.nobelprize.org/prizes/physics/1921/summary/
  title: The Nobel Prize in Physics 1921 - NobelPrize.org  foundVia: {"host":"en.wikipedia.org"}
  text head: The Nobel Prize in Physics 1921 - NobelPrize.org Skip to content Navigate to: Summary - Albert Einstein Presentation Speech Photo from the Nobel Foundation archive. Albert Einstein Prize share: 1/1 The Nobel Prize in Physics 1921 was awarded to Albert Einstein

  trail:
  - kept nobelprize.org https://www.nobelprize.org/prizes/physics/1921/summary/  q=Albert Einstein was awarded the 1921 Nobel Prize in Physics for his se

## event-apollo11 (event date) — REACH
claim: Apollo 11 landed the first humans on the Moon on 20 July 1969.

- **reach** (ok_host_and_text) https://www.nasa.gov/mission/apollo-11/
  title: Apollo 11 - NASA  foundVia: {"host":"en.wikipedia.org"}
  text head: Apollo 11 - NASA Suggested Searches Artemis ISS Roman Webb Quesst Moon Base View All Topics A-Z Home Missions Humans in Space Earth The Solar System The Universe Science Aeronautics Technology Learning Resources About NASA Español News & Events Multimedia NASA

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/Apollo_11  q=Apollo 11 landed the first humans on the Moon on 20 July 1969.
  - kept nasa.gov https://www.nasa.gov/mission/apollo-11/  q=Apollo 11 landed the first humans on the Moon on 20 July 1969.

## distance-moon (measure) — REACH
claim: The Moon orbits Earth at an average distance of about 384,400 kilometres (238,855 miles).

- **reach** (ok_host_and_text) https://spaceplace.nasa.gov/moon-distance/en/
  title: How Far Away Is the Moon? | NASA Space Place – NASA Science for Kids  foundVia: {"host":"en.wikipedia.org"}
  text head: How Far Away Is the Moon? | NASA Space Place – NASA Science for Kids moon-distance How Far Away Is the Moon? The Short Answer: The Moon is an average of 238,855 miles away from Earth, which is about 30 Earths away. You might be surprised. Often when we see dra

  trail:
  - kept spaceplace.nasa.gov https://spaceplace.nasa.gov/moon-distance/en/  q=The Moon orbits Earth at an average distance of about 384,400 kilometr

## museum-monalisa (museum holding) — returned pages, none reach
claim: The Mona Lisa, painted by Leonardo da Vinci, is on permanent display at the Louvre Museum in Paris.

- **unlisted_passes_text** (unlisted_host) https://www.pariscityvision.com/en/paris/museums/louvre-museum/the-mona-lisa-history-and-mystery
  title: The Mona Lisa, history and mysteries - Musée du Louvre Paris - PARISCityVISION  foundVia: {"host":"en.wikipedia.org"}
  text head: The Mona Lisa, history and mysteries - Musée du Louvre Paris - PARISCityVISION The Mona Lisa : painting of da Vinci located at the Louvre Louvre Museum Tours Starting from 39,00 € Find out more The Mona Lisa painting is one of the most emblematic portraits in 

  trail:
  - kept pariscityvision.com https://www.pariscityvision.com/en/paris/museums/louvre-museum/the-mona-lisa-history-and-mystery  q=The Mona Lisa, painted by Leonardo da Vinci, is on permanent display a

## count-bones (count) — REACH
claim: The adult human skeleton has 206 bones.

- **reach** (ok_host_and_text) https://my.clevelandclinic.org/health/body/25176-bones
  title: Bones: How Many Do Humans Have, Types, Anatomy & Function  foundVia: {"host":"en.wikipedia.org"}
  text head: Bones: How Many Do Humans Have, Types, Anatomy & Function Home / Health Library / Body Systems & Organs / Bones Advertisement Advertisement Bones Medically Reviewed. Last updated on 10/17/2025 . Adults have between 206 and 213 bones. You use all of them each d

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/List_of_bones_of_the_human_skeleton  q=The adult human skeleton has 206 bones.
  - kept my.clevelandclinic.org https://my.clevelandclinic.org/health/body/25176-bones  q=The adult human skeleton has 206 bones.

## founding-harvard (founding date) — REACH
claim: Harvard University was founded in 1636 as Harvard College, the oldest institution of higher learning in the United States.

- **reach** (ok_host_and_text) https://www.harvard.edu/about/history/timeline/
  title: History timeline - Harvard University  foundVia: {"host":"en.wikipedia.org"}
  text head: History timeline - Harvard University Skip to main content 1600s: Our early origins 1700s: Harvard and the American Revolution 1800s: A century of growth 1900s: A century of progress 2000s: Rapid evolution, breakthroughs, and discoveries 1600s: Our early origi

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/History_of_Harvard_University  q=Harvard University was founded in 1636 as Harvard College, the oldest 
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/Harvard_University  q=Harvard University was founded in 1636 as Harvard College, the oldest 
  - kept harvard.edu https://www.harvard.edu/about/history/timeline/  q=Harvard University was founded in 1636 as Harvard College, the oldest 

## height-eiffel (height) — returned pages, none reach
claim: The Eiffel Tower is 330 metres tall, about the same height as an 81-storey building.

- **unlisted_passes_text** (unlisted_host) https://eiffeltowertravel.com/height-and-facts
  title: Eiffel Tower Height: 330m (1,083 ft) &ndash; Dimensions, Weight & Fun Facts  foundVia: {"host":"en.wikipedia.org"}
  text head: Eiffel Tower Height: 330m (1,083 ft) &ndash; Dimensions, Weight & Fun Facts Skip to main content Experience Tickets Viewpoints Photo Spots Dining Neighborhoods Itineraries The Numbers How Tall Is the Eiffel Tower? The Eiffel Tower stands 330 metres (1,083 feet

  trail:
  - skipped (wikipedia) en.wikipedia.org https://en.wikipedia.org/wiki/Eiffel_Tower  q=The Eiffel Tower is 330 metres tall, about the same height as an 81-st
  - kept eiffeltowertravel.com https://eiffeltowertravel.com/height-and-facts  q=The Eiffel Tower is 330 metres tall, about the same height as an 81-st
