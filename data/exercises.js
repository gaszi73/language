// Kiegészítő gyakorlóanyagok: kérdés–válasz, összevont (gyors) beszéd, minimálpárok.

// Kérdés–válasz: az app kérdez, te szabadon válaszolsz, utána elhangzik egy mintaválasz.
// A "keywords" közül legalább egynek szerepelnie kell egy értelmes válaszban.
export const QUESTIONS = [
  { id: "q1", level: "A1", q: "What's your name, and where are you from?", sample: "My name is Gabor and I'm from Hungary.", keywords: ["name", "from", "i'm", "i am"] },
  { id: "q2", level: "A1", q: "What do you do for a living?", sample: "I work as an engineer at a small company.", keywords: ["work", "i'm", "i am", "job"] },
  { id: "q3", level: "A1", q: "Do you have any children?", sample: "Yes, I have two children. A boy and a girl.", keywords: ["yes", "no", "have", "children", "kids"] },
  { id: "q4", level: "A1", q: "What did you have for breakfast today?", sample: "I had some toast and a cup of coffee.", keywords: ["had", "ate", "coffee", "bread", "nothing", "eggs", "toast", "breakfast"] },
  { id: "q5", level: "A1", q: "What's the weather like today?", sample: "It's sunny and quite warm today.", keywords: ["sunny", "rain", "raining", "cold", "warm", "hot", "cloudy", "nice", "weather"] },
  { id: "q6", level: "A2", q: "Where are you driving right now?", sample: "I'm driving to work. It takes about thirty minutes.", keywords: ["driving", "work", "home", "going"] },
  { id: "q7", level: "A2", q: "What did you do last weekend?", sample: "Last weekend I visited my parents and we had lunch together.", keywords: ["i", "went", "was", "visited", "stayed", "did", "had"] },
  { id: "q8", level: "A2", q: "What do you usually do in the evening?", sample: "I usually have dinner with my family and then I watch a film.", keywords: ["usually", "watch", "dinner", "read", "evening", "i"] },
  { id: "q9", level: "A2", q: "Why are you learning English?", sample: "I'm learning English because I need it for work, and I want to understand films.", keywords: ["because", "work", "want", "need", "travel", "films"] },
  { id: "q10", level: "A2", q: "What kind of food do you like?", sample: "I like Italian food, especially pasta, and of course Hungarian goulash.", keywords: ["like", "love", "food", "pizza", "pasta", "meat"] },
  { id: "q11", level: "A2", q: "Tell me about your home.", sample: "I live in a house with a small garden. It has three bedrooms.", keywords: ["live", "house", "flat", "apartment", "rooms", "home"] },
  { id: "q12", level: "A2", q: "What's your favourite film or series?", sample: "My favourite series is Friends. It's funny and easy to watch.", keywords: ["favourite", "favorite", "like", "film", "series", "movie"] },
  { id: "q13", level: "B1", q: "What would you do if you won the lottery?", sample: "If I won the lottery, I would travel around the world and buy a house by the sea.", keywords: ["would", "if"] },
  { id: "q14", level: "B1", q: "What's the best trip you've ever been on?", sample: "The best trip I've ever been on was to Italy. The food and the weather were amazing.", keywords: ["best", "was", "went", "trip", "been"] },
  { id: "q15", level: "B1", q: "What's difficult for you in English?", sample: "Listening is the hardest for me. People speak very fast and I can't catch every word.", keywords: ["difficult", "hard", "listening", "speaking", "fast"] },
  { id: "q16", level: "B1", q: "Describe your typical working day.", sample: "I start at eight, I check my emails, then I have meetings. In the afternoon I work on projects.", keywords: ["start", "work", "meetings", "then", "usually"] },
  { id: "q17", level: "B1", q: "Do you prefer the city or the countryside? Why?", sample: "I prefer the countryside because it's quieter and the air is cleaner.", keywords: ["prefer", "because", "city", "countryside"] },
  { id: "q18", level: "B1", q: "How has your town changed in the last ten years?", sample: "There are more cars and new shops, but the old centre hasn't changed much.", keywords: ["more", "new", "changed", "there are", "built"] },
  { id: "q19", level: "B1", q: "What are your plans for next summer?", sample: "Next summer we're going to spend a week at Lake Balaton with the family.", keywords: ["going", "will", "plan", "summer", "next"] },
  { id: "q20", level: "B2", q: "Do you think technology makes our lives better or worse?", sample: "I think it makes life easier in many ways, but we spend too much time on our phones.", keywords: ["think", "better", "worse", "because", "but"] },
];

// Összevont, gyors beszéd — ez a filmek megértésének egyik kulcsa.
// "clear": ahogy leírjuk; "fast": ahogy valójában hangzik (a felolvasó a "clear" szöveget mondja gyorsan).
export const CONNECTED = [
  { id: "c1", level: "A2", clear: "I am going to call you later.", fast: "I'm gonna call ya later.", hu: "Később felhívlak.", tip: "going to → gonna" },
  { id: "c2", level: "A2", clear: "Do you want to get something to eat?", fast: "D'ya wanna get somethin' to eat?", hu: "Akarsz enni valamit?", tip: "do you → d'ya, want to → wanna" },
  { id: "c3", level: "A2", clear: "What are you doing?", fast: "Whatcha doin'?", hu: "Mit csinálsz?", tip: "what are you → whatcha, -ing → -in'" },
  { id: "c4", level: "A2", clear: "I don't know what you mean.", fast: "I dunno whatcha mean.", hu: "Nem tudom, mire gondolsz.", tip: "don't know → dunno" },
  { id: "c5", level: "A2", clear: "Let me see it.", fast: "Lemme see it.", hu: "Hadd lássam.", tip: "let me → lemme" },
  { id: "c6", level: "A2", clear: "Give me a minute.", fast: "Gimme a minute.", hu: "Adj egy percet.", tip: "give me → gimme" },
  { id: "c7", level: "A2", clear: "I have got to go.", fast: "I gotta go.", hu: "Mennem kell.", tip: "have got to → gotta" },
  { id: "c8", level: "B1", clear: "Did you eat yet?", fast: "Jeet yet?", hu: "Ettél már?", tip: "did you → didja / j'" },
  { id: "c9", level: "B1", clear: "What do you want to do?", fast: "Whaddaya wanna do?", hu: "Mit akarsz csinálni?", tip: "what do you → whaddaya" },
  { id: "c10", level: "A2", clear: "Not at all.", fast: "Na-da-tall.", hu: "Egyáltalán nem.", tip: "összekötés: not‿at‿all" },
  { id: "c11", level: "A2", clear: "Turn it off.", fast: "Tur-ni-toff.", hu: "Kapcsold ki.", tip: "összekötés mássalhangzó + magánhangzó" },
  { id: "c12", level: "B1", clear: "I should have told you.", fast: "I shoulda told ya.", hu: "El kellett volna mondanom neked.", tip: "should have → shoulda" },
  { id: "c13", level: "B1", clear: "I could have done it.", fast: "I coulda done it.", hu: "Megcsinálhattam volna.", tip: "could have → coulda" },
  { id: "c14", level: "B1", clear: "You would not believe it.", fast: "Ya wouldn't believe it.", hu: "El sem hinnéd.", tip: "gyenge 'you' → ya" },
  { id: "c15", level: "A2", clear: "Can I have a cup of tea?", fast: "C'n I hav a cuppa tea?", hu: "Kaphatok egy csésze teát?", tip: "can → c'n, cup of → cuppa" },
  { id: "c16", level: "B1", clear: "Where did you get that?", fast: "Where'd ya get that?", hu: "Honnan szerezted?", tip: "where did you → where'd ya" },
  { id: "c17", level: "B1", clear: "It is kind of weird.", fast: "It's kinda weird.", hu: "Kicsit fura.", tip: "kind of → kinda" },
  { id: "c18", level: "B1", clear: "I am not going to tell you.", fast: "I'm not gonna tell ya.", hu: "Nem mondom meg.", tip: "going to → gonna" },
  { id: "c19", level: "A2", clear: "Get out of here!", fast: "Ged-oudda here!", hu: "Tűnj innen! / Ne viccelj!", tip: "t két magánhangzó között → gyors 'd' (amerikai)" },
  { id: "c20", level: "B1", clear: "What is the matter with you?", fast: "Whatsa madder with ya?", hu: "Mi bajod van?", tip: "t → d (matter → madder)" },
  { id: "c21", level: "A2", clear: "Would you like some water?", fast: "Wouldja like some water?", hu: "Kérsz egy kis vizet?", tip: "would you → wouldja" },
  { id: "c22", level: "B1", clear: "I told him to wait.", fast: "I told'im to wait.", hu: "Mondtam neki, hogy várjon.", tip: "him/her 'h' hangja kiesik: told'im" },
  { id: "c23", level: "B1", clear: "Tell them I am busy.", fast: "Tell'em I'm busy.", hu: "Mondd meg nekik, hogy elfoglalt vagyok.", tip: "them → 'em" },
  { id: "c24", level: "A2", clear: "Come on, let us go.", fast: "C'mon, let's go.", hu: "Gyerünk, menjünk.", tip: "come on → c'mon" },
];

// Minimálpárok: magyarok számára nehéz hangkülönbségek.
export const MINIMAL_PAIRS = [
  { id: "m1", sound: "i: / ɪ (hosszú/rövid i)", a: "sheep", b: "ship", huA: "birka", huB: "hajó" },
  { id: "m2", sound: "i: / ɪ", a: "leave", b: "live", huA: "elmegy", huB: "él" },
  { id: "m3", sound: "i: / ɪ", a: "feel", b: "fill", huA: "érez", huB: "tölt" },
  { id: "m4", sound: "æ / e", a: "bad", b: "bed", huA: "rossz", huB: "ágy" },
  { id: "m5", sound: "æ / e", a: "man", b: "men", huA: "férfi", huB: "férfiak" },
  { id: "m6", sound: "æ / ʌ", a: "cap", b: "cup", huA: "sapka", huB: "csésze" },
  { id: "m7", sound: "u: / ʊ", a: "fool", b: "full", huA: "bolond", huB: "tele" },
  { id: "m8", sound: "θ / s (th)", a: "think", b: "sink", huA: "gondol", huB: "mosogató" },
  { id: "m9", sound: "θ / t (th)", a: "three", b: "tree", huA: "három", huB: "fa" },
  { id: "m10", sound: "ð / d (th)", a: "they", b: "day", huA: "ők", huB: "nap" },
  { id: "m11", sound: "w / v", a: "west", b: "vest", huA: "nyugat", huB: "mellény" },
  { id: "m12", sound: "w / v", a: "wine", b: "vine", huA: "bor", huB: "szőlőtő" },
  { id: "m13", sound: "ɜ: / ɔ: ", a: "work", b: "walk", huA: "dolgozik", huB: "sétál" },
  { id: "m14", sound: "ɒ / əʊ", a: "want", b: "won't", huA: "akar", huB: "nem fog" },
  { id: "m15", sound: "szóvégi zöngés/zöngétlen", a: "bag", b: "back", huA: "táska", huB: "hát" },
  { id: "m16", sound: "szóvégi zöngés/zöngétlen", a: "eyes", b: "ice", huA: "szemek", huB: "jég" },
  { id: "m17", sound: "ŋ / n", a: "sing", b: "sin", huA: "énekel", huB: "bűn" },
  { id: "m18", sound: "h néma / h", a: "hear", b: "ear", huA: "hall", huB: "fül" },
];
