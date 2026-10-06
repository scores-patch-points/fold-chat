// eval/langid/asks.mjs — the labelled asks for the language-identification study (docs/LANGID-PREREG.md).
// AUTHORED AND LABELLED BEFORE ANY DETECTOR WAS RUN ON THEM. One ask per line: lower-case, little or no
// punctuation, sometimes no diacritics, typos, loanwords — the way people type to a chat box.
//
// A block is  [gold, "line\nline\n..."].   gold is one of
//   an ISO code ("es")             a confident answer must be exactly this code
//   "unknown"                      the CANNOT-TELL class: the detector must say unknown (never a guess)
//   "en|unknown" (a '|' list)      any of the listed answers is acceptable, anything else is a WRONG confident answer
// Latin-script classes that are one half of a closely related pair are listed in PAIRS (reported separately).

export const BLOCKS = [
// ── English, strict (>= 3 words with ordinary English function words) ─────────────────────────────────
["en", `show me a cookie recipe
show me a recipe for chocolate chip cookies
what is the capital of australia
what's the weather like in seattle today
how do i reverse a string in python
who won the world cup in 2018
tell me about mercury
give me tips to fall asleep faster
wat is the tallest mountain on earth lol
i want to learn guitar
where should i start
is it safe to eat eggs after the expiration date
how many calories are in an avocado
explain the difference between a virus and a bacterium
compare iphone and android for a first time user
write a thank you note to my neighbor
can you help me fix my resume
how tall is the eiffel tower
in what year did the berlin wall fall
who wrote pride and prejudice
what else did she write
when was it published
translate where is the train station into spanish
give me a 3 day itinerary for lisbon
how does compound interest work
i have a job interview tomorrow any advice
how do i make sourdough starter from scratch
what time does the pharmacy close
can i bring my dog on the train
find me a good book about stoicism
why is my sourdough so dense
recommend some podcasts about history
how to tie a tie
what are the symptoms of the flu
how far is the moon from earth
best way to learn spanish fast
play something relaxing
make it shorter
and who is his wife
how much does a tesla cost
do you know any good pasta recipes
i need a cheap flight to london
show me pictures of golden retriever puppies
what is the meaning of life
should i buy a laptop or a tablet
where can i watch the new batman movie
how do i get rid of fruit flies
what does gdp stand for
tell me a joke
whats a good name for a cat
how old is the universe
is coffee bad for you
give me a workout plan for beginners
show me how to change a tire
list the planets in order
what happened in 1066
i cant sleep help
how do i center a div
let me see the menu
can u show me a banana bread recipe
who is the president of france
show me the cheapest hotels in rome
how do vaccines work
help me write a cover letter
which one is better
thanks that helps
wanna know how to bake bread
what is the population of tokyo
where is the nearest hospital
why is the sky blue
how many ounces in a cup
show me a map of nashville
give me a recipe for pad thai
what should i cook tonight
im looking for a gift for my mom
do you have any advice for a first date
what is the speed of light
please show me the chocolate cake recipe
looking for a plumber in nashville
where to buy cheap guitars
How do I cook rice?
Who painted the Mona Lisa?
wat is teh capitol of austrailia
hw do i make pancakes
shwo me a recipie for cookies
recomend me a good moive
what about the other one
find me a recipe for pasta carbonara
give me the recipe for a classic carbonara
how do you say good morning in german
what does the word saudade mean
who was the first person on the moon
tell me everything you know about the roman empire
i would like a recipe with no eggs
can you show me a good lasagna recipe
what is the best way to cook salmon
me and my friends want to visit japan in spring
how can i show a progress bar in react
do you have a recipe for a gluten free cake
show me a quick dinner idea
i want a chewier cookie recipe
what's a good recipe for banana bread?
show me something for dinner
`],
// ── English keyword queries: no function word to hear; English or unknown, never another language ───────
["en|unknown#kw", `cookie recipe
iphone 15 price
wifi password
pasta carbonara
best pizza near me
weather tomorrow
cheap flights london
python reverse string
nashville weather
tom hanks movies
taylor swift tour dates
bitcoin price
banana bread recipe
nearest pharmacy open now
chocolate chip cookies
laptop deals
used cars nashville
vegan lasagna recipe
dog friendly hotels
beginner guitar chords
sourdough recipe
ps5 restock
cookie recipe easy
show me cookies
more crispy please
and him
tell me more
thanks
ok thanks
that works
sounds good
best cafe in paris
sushi near me
recipe please
chewier please
more
cookie recipe please
show me
pizza dough recipe
how much
`],
// ── CANNOT TELL: names only, one token, numbers, symbols: unknown is the only right answer ───────────────
["unknown#ct", `paris
tom hanks
ok
lol
iphone 15
nashville tn
taylor swift
123456
???
hmm
a
elon musk
bmw x5
cnn
netflix
2+2
pdf
https://example.com/page
john smith
lebron james
new york
ryanair
mcdonalds
sushi
taxi
wifi
angela merkel
pedro pascal
leonardo dicaprio
lionel messi
serena williams
tokyo
berlin
real madrid
fc barcelona
nike air max
ps5
spotify
youtube
chatgpt
mercury
python
kobe bryant
bill gates
mount everest
coca cola
hello
hi
chewier
ok google
jk rowling
emma watson
cristiano ronaldo
adele
samsung galaxy s24
tesla model 3
`],
// ── Spanish ───────────────────────────────────────────────────────────────────────────────────────────
["es", `muestrame una receta de galletas
cual es la capital de australia
como hago pan casero
donde queda el hospital mas cercano
dame consejos para dormir mejor
quiero aprender a tocar la guitarra
cuanto cuesta un vuelo a madrid
como se dice hello en español
que hora es en tokio
dime un chiste
necesito una receta de tortilla de patatas
por que el cielo es azul
cuantas calorias tiene un aguacate
ayudame a escribir una carta de presentacion
me puedes recomendar un libro de ciencia ficcion
quien gano el mundial de 2018
y su esposa
¿Qué altura tiene la Torre Eiffel?
receta de paella
muéstrame recetas de galletas de chocolate
`],
// ── Portuguese ────────────────────────────────────────────────────────────────────────────────────────
["pt", `me mostra uma receita de biscoito
qual e a capital da australia
como faço pão caseiro
onde fica o hospital mais proximo
me dá dicas pra dormir melhor
quero aprender a tocar violão
quanto custa uma passagem para lisboa
que horas são em toquio
me conta uma piada
preciso de uma receita de bolo de cenoura
por que o céu é azul
quantas calorias tem um abacate
me ajuda a escrever uma carta de apresentação
quem ganhou a copa de 2018
e a esposa dele
receita de pão de queijo
mostra uma receita de brigadeiro
`],
// ── Italian ───────────────────────────────────────────────────────────────────────────────────────────
["it", `mostrami una ricetta per i biscotti
qual è la capitale dell'australia
come faccio il pane in casa
dov'è l'ospedale più vicino
dammi dei consigli per dormire meglio
voglio imparare a suonare la chitarra
quanto costa un volo per roma
che ore sono a tokyo
raccontami una barzelletta
mi serve una ricetta per la carbonara
perché il cielo è azzurro
quante calorie ha un avocado
aiutami a scrivere una lettera di presentazione
chi ha vinto i mondiali del 2018
e sua moglie
cerco un idraulico a milano
ricetta della pizza margherita
`],
// ── Catalan ───────────────────────────────────────────────────────────────────────────────────────────
["ca", `mostra'm una recepta de galetes
quina és la capital d'austràlia
com puc fer pa casolà
on és l'hospital més proper
dona'm consells per dormir millor
vull aprendre a tocar la guitarra
quant costa un bitllet a barcelona
per què el cel és blau
m'ajudes a escriure una carta
a quina hora tanca la farmàcia
recepta de crema catalana
`],
// ── French ────────────────────────────────────────────────────────────────────────────────────────────
["fr", `montre moi une recette de cookies
quelle est la capitale de l'australie
comment faire du pain maison
ou est l'hopital le plus proche
donne moi des conseils pour mieux dormir
je veux apprendre a jouer de la guitare
combien coute un vol pour paris
quelle heure est il a tokyo
raconte moi une blague
j'ai besoin d'une recette de quiche lorraine
pourquoi le ciel est bleu
combien de calories dans un avocat
aide moi a ecrire une lettre de motivation
qui a gagne la coupe du monde 2018
et sa femme
je cherche un plombier a lyon
recette de crêpes
Quelle est la hauteur de la tour Eiffel ?
`],
// ── German ────────────────────────────────────────────────────────────────────────────────────────────
["de", `zeig mir ein rezept für kekse
was ist die hauptstadt von australien
wie backe ich brot zu hause
wo ist das nächste krankenhaus
gib mir tipps zum besser schlafen
ich möchte gitarre lernen
wie viel kostet ein flug nach berlin
wie spät ist es in tokio
erzähl mir einen witz
ich brauche ein rezept für apfelkuchen
warum ist der himmel blau
wie viele kalorien hat eine avocado
hilf mir bei meinem lebenslauf
wer hat die weltmeisterschaft 2018 gewonnen
und seine frau
wann schliesst die apotheke
wie funktioniert ein elektromotor
rezept für kartoffelsalat
`],
// ── Dutch ─────────────────────────────────────────────────────────────────────────────────────────────
["nl", `laat me een recept voor koekjes zien
wat is de hoofdstad van australie
hoe bak ik zelf brood
waar is het dichtstbijzijnde ziekenhuis
geef me tips om beter te slapen
ik wil gitaar leren spelen
hoeveel kost een vlucht naar amsterdam
hoe laat is het in tokio
vertel me een grap
waarom is de lucht blauw
recept voor stroopwafels
`],
// ── Swedish ───────────────────────────────────────────────────────────────────────────────────────────
["sv", `visa mig ett recept på kakor
vad är huvudstaden i australien
hur bakar jag bröd hemma
var ligger närmaste sjukhus
ge mig tips för att sova bättre
jag vill lära mig spela gitarr
hur mycket kostar en flygning till stockholm
vad är klockan i tokyo
berätta ett skämt
varför är himlen blå
`],
// ── Danish ────────────────────────────────────────────────────────────────────────────────────────────
["da", `vis mig en opskrift på småkager
hvad er hovedstaden i australien
hvordan bager jeg brød derhjemme
hvor er det nærmeste hospital
giv mig tips til at sove bedre
jeg vil gerne lære at spille guitar
hvor meget koster en flybillet til københavn
hvad er klokken i tokyo
fortæl mig en vittighed
hvorfor er himlen blå
`],
// ── Norwegian ─────────────────────────────────────────────────────────────────────────────────────────
["no", `vis meg en oppskrift på kjeks
hva er hovedstaden i australia
hvordan baker jeg brød hjemme
hvor er nærmeste sykehus
gi meg tips for å sove bedre
jeg vil lære å spille gitar
hvor mye koster en flybillett til oslo
hva er klokka i tokyo
fortell meg en vits
hvorfor er himmelen blå
`],
// ── Romanian ──────────────────────────────────────────────────────────────────────────────────────────
["ro", `arată-mi o rețetă de biscuiți
care este capitala australiei
cum fac pâine acasă
unde este cel mai apropiat spital
dă-mi sfaturi ca să dorm mai bine
vreau să învăț să cânt la chitară
cât costă un zbor spre bucurești
de ce este cerul albastru
cum se face o ciorba de legume
`],
// ── Polish ────────────────────────────────────────────────────────────────────────────────────────────
["pl", `pokaż mi przepis na ciasteczka
jaka jest stolica australii
jak upiec chleb w domu
gdzie jest najbliższy szpital
daj mi wskazówki jak lepiej spać
chcę nauczyć się grać na gitarze
ile kosztuje bilet do warszawy
dlaczego niebo jest niebieskie
`],
// ── Czech ─────────────────────────────────────────────────────────────────────────────────────────────
["cs", `ukaž mi recept na sušenky
jaké je hlavní město austrálie
jak upéct chleba doma
kde je nejbližší nemocnice
dej mi tipy jak líp spát
chci se naučit hrát na kytaru
kolik stojí letenka do prahy
proč je obloha modrá
`],
// ── Turkish ───────────────────────────────────────────────────────────────────────────────────────────
["tr", `bana kurabiye tarifi göster
avustralyanın başkenti neresi
evde ekmek nasıl yapılır
en yakın hastane nerede
daha iyi uyumak için tavsiye ver
gitar çalmayı öğrenmek istiyorum
istanbul'a uçak bileti ne kadar
gökyüzü neden mavi
en yakin eczane nerede
`],
// ── Indonesian ────────────────────────────────────────────────────────────────────────────────────────
["id", `tunjukkan resep kue kering
apa ibu kota australia
cara membuat roti di rumah
dimana rumah sakit terdekat
kasih saya tips tidur nyenyak
saya mau belajar main gitar
berapa harga tiket pesawat ke jakarta
kenapa langit berwarna biru
ceritakan lelucon dong
jam berapa sekarang di tokyo
`],
// ── Malay ─────────────────────────────────────────────────────────────────────────────────────────────
["ms", `tunjukkan resipi biskut
apakah ibu negara australia
bagaimana nak buat roti di rumah
di mana hospital yang paling dekat
beri saya petua untuk tidur lena
saya mahu belajar bermain gitar
berapa harga tiket kapal terbang ke kuala lumpur
kenapa langit biru
`],
// ── Finnish ───────────────────────────────────────────────────────────────────────────────────────────
["fi", `näytä minulle keksireseptti
mikä on australian pääkaupunki
miten leivon leipää kotona
missä on lähin sairaala
anna vinkkejä nukkumiseen
haluan oppia soittamaan kitaraa
paljonko lento helsinkiin maksaa
miksi taivas on sininen
`],
// ── Hungarian ─────────────────────────────────────────────────────────────────────────────────────────
["hu", `mutass egy sütemény receptet
mi ausztrália fővárosa
hogyan süssek kenyeret otthon
hol van a legközelebbi kórház
adj tippeket a jobb alváshoz
gitározni szeretnék tanulni
`],
// ── Croatian / Serbian (Latin) / Bosnian: the closely related South Slavic trio, each with a marker word ─
["hr", `pokaži mi recept za kekse
koji je glavni grad australije
kako ispeći kruh kod kuće
gdje je najbliža bolnica
daj mi savjete za bolji san
želim naučiti svirati gitaru
koliko košta let do zagreba
zašto je nebo plavo
`],
["sr", `pokaži mi recept za kolače
koji je glavni grad australije
kako da ispečem hleb kod kuće
gde je najbliža bolnica
daj mi savete za bolji san
želim da naučim da sviram gitaru
`],
["bs", `pokaži mi recept za kolače
koji je glavni grad australije
kako ispeći hljeb kod kuće
gdje je najbliža bolnica
daj mi savjete za bolji san
želim naučiti svirati gitaru
`],
// ── Vietnamese ────────────────────────────────────────────────────────────────────────────────────────
["vi", `cho tôi công thức làm bánh quy
thủ đô của úc là gì
làm bánh mì ở nhà như thế nào
bệnh viện gần nhất ở đâu
cho mình vài mẹo để ngủ ngon hơn
tôi muốn học chơi guitar
giá vé máy bay đi hà nội bao nhiêu
tại sao bầu trời màu xanh
cach nau pho ngon
gan day co quan ca phe nao khong
`],
// ── Hindi / Urdu written in Latin script (Hindustani: a related pair) ─────────────────────────────────
["hi", `mujhe cookie ki recipe dikhao
australia ki rajdhani kya hai
ghar par roti kaise banaye
sabse najdik hospital kahan hai
mujhe achhi neend ke tips batao
mujhe guitar bajana seekhna hai
delhi ka ticket kitne ka hai
aasman neela kyu hota hai
`],
["ur", `mujhe biscuit ki recipe dikhain
australia ka dar ul hukumat kya hai
ghar mein roti kaise banayen
sab se qareeb hospital kahan hai
mujhe achi neend ke liye mashwara dein
lahore ka ticket kitne ka hai
`],
// ── Afrikaans ─────────────────────────────────────────────────────────────────────────────────────────
["af", `wys my 'n resep vir koekies
wat is die hoofstad van australië
hoe bak ek brood tuis
waar is die naaste hospitaal
`],
// ── Languages with no prior in the repo: the right answer is unknown (reported, no bar) ───────────────
["unknown#oos", `ano ang kabisera ng australia
magkano ang ticket papuntang maynila
paano magluto ng adobo
saan ang pinakamalapit na ospital
hver er höfuðborg ástralíu
hvar er næsta sjúkrahús
cila është kryeqyteti i australisë
ku është spitali më i afërt
mi volas lerni ludi gitaron
nataka kujua mji mkuu wa australia
Mnara wa Eiffel una urefu gani?
Ukuta wa Berlin ulianguka mwaka gani?
Mji mkuu wa Australia ni upi?
`],
// ── Russian ───────────────────────────────────────────────────────────────────────────────────────────
["ru", `покажи рецепт печенья
какая столица австралии
как испечь хлеб дома
где ближайшая больница
дай советы как лучше спать
хочу научиться играть на гитаре
сколько стоит билет в москву
почему небо голубое
расскажи анекдот
сколько калорий в авокадо
какова высота эйфелевой башни
`],
["uk", `покажи рецепт печива
яка столиця австралії
як спекти хліб вдома
де найближча лікарня
дай поради як краще спати
хочу навчитися грати на гітарі
скільки коштує квиток до києва
чому небо блакитне
`],
["bg", `покажи ми рецепта за бисквити
коя е столицата на австралия
как да изпека хляб вкъщи
къде е най-близката болница
искам да се науча да свиря на китара
`],
["sr", `покажи ми рецепт за колаче
који је главни град аустралије
где је најближа болница
желим да научим да свирам гитару
`],
["el", `δείξε μου μια συνταγή για μπισκότα
ποια είναι η πρωτεύουσα της αυστραλίας
πώς φτιάχνω ψωμί στο σπίτι
πού είναι το πλησιέστερο νοσοκομείο
θέλω να μάθω κιθάρα
γιατί ο ουρανός είναι μπλε
`],
["he", `תראה לי מתכון לעוגיות
מהי בירת אוסטרליה
איך אופים לחם בבית
איפה בית החולים הקרוב ביותר
תן לי טיפים לשינה טובה
אני רוצה ללמוד לנגן בגיטרה
כמה עולה טיסה לתל אביב
למה השמיים כחולים
`],
["ar", `أرني وصفة كوكيز
ما هي عاصمة أستراليا
كيف أخبز الخبز في البيت
أين أقرب مستشفى
أعطني نصائح لنوم أفضل
أريد أن أتعلم العزف على الجيتار
كم سعر تذكرة الطيران إلى القاهرة
لماذا السماء زرقاء
احكي لي نكتة
كم سعرة حرارية في الأفوكادو
`],
["fa", `یک دستور پخت کلوچه نشان بده
پایتخت استرالیا کجاست
چطور در خانه نان بپزم
نزدیک‌ترین بیمارستان کجاست
می‌خواهم گیتار یاد بگیرم
چرا آسمان آبی است
`],
["ur", `مجھے بسکٹ کی ترکیب دکھائیں
آسٹریلیا کا دارالحکومت کیا ہے
گھر پر روٹی کیسے بنائیں
سب سے قریب ہسپتال کہاں ہے
مجھے گٹار سیکھنا ہے
آسمان نیلا کیوں ہے
`],
["hi", `मुझे कुकीज़ की रेसिपी दिखाओ
ऑस्ट्रेलिया की राजधानी क्या है
घर पर रोटी कैसे बनाएं
सबसे नज़दीकी अस्पताल कहाँ है
मुझे अच्छी नींद के लिए टिप्स दो
मुझे गिटार बजाना सीखना है
दिल्ली का टिकट कितने का है
आसमान नीला क्यों होता है
`],
["mr", `मला कुकीजची रेसिपी दाखव
ऑस्ट्रेलियाची राजधानी कोणती आहे
जवळचे रुग्णालय कुठे आहे
`],
["bn", `আমাকে কুকিজের রেসিপি দেখাও
অস্ট্রেলিয়ার রাজধানী কী
বাড়িতে রুটি কীভাবে বানাব
কাছের হাসপাতাল কোথায়
আমি গিটার শিখতে চাই
`],
["ta", `குக்கீ செய்முறையைக் காட்டு
ஆஸ்திரேலியாவின் தலைநகரம் என்ன
அருகிலுள்ள மருத்துவமனை எங்கே
நான் கிட்டார் கற்க விரும்புகிறேன்
`],
["te", `కుకీల రెసిపీ చూపించు
ఆస్ట్రేలియా రాజధాని ఏమిటి
దగ్గరలో ఆసుపత్రి ఎక్కడ ఉంది
`],
["th", `ขอสูตรคุกกี้หน่อย
เมืองหลวงของออสเตรเลียคืออะไร
ทำขนมปังที่บ้านยังไง
โรงพยาบาลที่ใกล้ที่สุดอยู่ที่ไหน
ขอเคล็ดลับนอนหลับสบาย
อยากเรียนเล่นกีตาร์
ตั๋วเครื่องบินไปเชียงใหม่ราคาเท่าไหร่
ทำไมท้องฟ้าถึงสีฟ้า
`],
["zh", `给我看一个饼干食谱
澳大利亚的首都是哪里
怎么在家做面包
最近的医院在哪里
给我一些睡好觉的建议
我想学吉他
去北京的机票多少钱
天空为什么是蓝色的
讲个笑话
牛油果有多少卡路里
2018年世界杯谁赢了
台北現在幾點
我想學彈吉他
埃菲尔铁塔有多高
`],
["ja", `クッキーのレシピを見せて
オーストラリアの首都はどこ
家でパンを焼くにはどうすればいい
一番近い病院はどこですか
よく眠れるコツを教えて
ギターを習いたいです
東京行きの航空券はいくらですか
なぜ空は青いの
冗談を言って
アボカドのカロリーは
エッフェル塔の高さはどれくらいですか
`],
["ko", `쿠키 레시피 보여줘
호주의 수도는 어디야
집에서 빵 만드는 법
가장 가까운 병원이 어디예요
잠 잘 자는 팁 알려줘
기타 배우고 싶어요
서울행 비행기 표 얼마예요
하늘은 왜 파란색이야
`],
// ── Code-switching, loanwords and brand names inside a non-English matrix: the script gives these away ─
["ko#mix", `iphone 15 가격 알려줘
유튜브에서 파이썬 강의 추천해줘`],
["ja#mix", `python でリストを逆順にする方法
iphone 15 の値段を教えて`],
["zh#mix", `怎么用python反转字符串
iphone 15多少钱
推荐一个好用的vpn`],
["ru#mix", `как установить python на windows
посоветуй хороший ноутбук для gaming`],
["ar#mix", `كيف أثبت python على ويندوز
كم سعر iphone 15`],
["hi#mix", `iphone 15 की कीमत क्या है
python में लिस्ट को उल्टा कैसे करें`],
["th#mix", `iphone 15 ราคาเท่าไหร่
สอน python เบื้องต้น`],
["he#mix", `איך מתקינים python על ווינדוס
כמה עולה iphone 15`],
// Latin-script code-switching: the matrix language, or unknown, are fair; a THIRD language is a wrong answer
["es|unknown#mix", `dame un recipe de pancakes
quiero un playlist de chill music
como instalo python en windows
cual es el mejor laptop para gaming
como se dice thank you en japones`],
["de|unknown#mix", `ich brauche ein update für meine app
wie installiere ich python unter windows
wie sagt man hello auf spanisch`],
["fr|unknown#mix", `c'est quoi le meilleur laptop pour gaming
comment installer python sur windows`],
["pt|unknown#mix", `qual o melhor smartphone para gaming
como instalar python no windows`],
["en|unknown#mix", `what is the meaning of saudade in portuguese
how do you say gracias in english
translate buenos dias to english
tell me about la tomatina
what does como estas mean`],
["en|es|unknown#mix", `show me una receta de paella`],
["hi|ur|unknown#mix", `iphone 15 ka price kya hai
mujhe ek good recipe batao for biryani`],
["id|ms|unknown#mix", `bagaimana cara install python di windows`],
["nl|unknown#mix", `hoe installeer ik python op windows`],
["pl|unknown#mix", `jak zainstalować pythona na windowsie`],
["tr|unknown#mix", `windows'ta python nasıl kurulur`],
// ── Short non-English asks (2-3 words): coverage may be lost, a WRONG answer may not ────────────────────
["es#short", `pan casero
receta de flan
donde esta el baño`],
["fr#short", `meilleur restaurant paris
recette de ratatouille`],
["de#short", `rezept für pfannkuchen
wetter morgen berlin`],
["it#short", `ricetta tiramisù
dove mangiare roma`],
["pt#short", `receita de feijoada`],
["ru#short", `рецепт борща
погода завтра`],
["zh#short", `饼干食谱
今天天气`],
["ja#short", `クッキー レシピ
明日の天気`],
];

// the closely related Latin-script pairs / groups, reported separately (no bar)
export const PAIRS = {
  romance: ["es", "pt", "it", "ca"],
  nordic: ["no", "da", "sv"],
  southslavic: ["hr", "sr", "bs"],
  malay: ["id", "ms"],
  hindustani: ["hi", "ur"],
  lowlands: ["nl", "af"],
};
