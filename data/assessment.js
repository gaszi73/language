// A szintfelmérés anyaga. Minden rész fokozatosan nehezedik (A1 → B2).

// 1. Diktálás: meghallgatod, begépeled. A "rate" a felolvasás tempója (1 = természetes).
export const DICTATION = [
  { level: "A1", rate: 0.8, text: "My name is Anna and I live in London." },
  { level: "A1", rate: 0.85, text: "Can I have a coffee, please?" },
  { level: "A2", rate: 0.9, text: "We went to the cinema last night and saw a great film." },
  { level: "A2", rate: 0.95, text: "I'm going to visit my parents at the weekend." },
  { level: "B1", rate: 1.0, text: "If you're not busy tomorrow, we could have lunch together." },
  { level: "B1", rate: 1.05, text: "I've been waiting here for almost half an hour, where have you been?" },
  { level: "B2", rate: 1.1, text: "I wish I'd known about it earlier, I would have booked the tickets myself." },
  { level: "B2", rate: 1.15, text: "To be honest, I don't think they're gonna make it on time." },
];

// 2. Hallás utáni értés: párbeszéd, utána kérdések (helyes válasz indexe: "answer").
export const DIALOGUES = [
  {
    level: "A2",
    rate: 0.9,
    lines: [
      ["A", "Hi Tom, are you coming to the party on Saturday?"],
      ["B", "I'd love to, but I have to work until six."],
      ["A", "No problem, it starts at eight."],
      ["B", "Great, then I'll be there. Should I bring anything?"],
      ["A", "Maybe some drinks."],
    ],
    questions: [
      { q: "Mikor kezdődik a buli?", options: ["Hatkor", "Nyolckor", "Szombat délben"], answer: 1 },
      { q: "Mit kérnek Tomtól?", options: ["Italokat", "Ételt", "Hogy ne késsen"], answer: 0 },
    ],
  },
  {
    level: "B1",
    rate: 1.0,
    lines: [
      ["A", "Excuse me, I booked a room for two nights, but I'd like to stay one more night. Is that possible?"],
      ["B", "Let me check. Unfortunately we're fully booked on Friday, but I can offer you a room at our sister hotel across the street."],
      ["A", "Oh, that's fine. Is it the same price?"],
      ["B", "It's actually a bit cheaper, and breakfast is included."],
    ],
    questions: [
      { q: "Mit szeretne a vendég?", options: ["Lemondani a foglalást", "Még egy éjszakát maradni", "Másik szobát kérni"], answer: 1 },
      { q: "Milyen a másik szálloda ajánlata?", options: ["Drágább, reggeli nélkül", "Ugyanannyi", "Kicsit olcsóbb, reggelivel"], answer: 2 },
    ],
  },
  {
    level: "B2",
    rate: 1.1,
    lines: [
      ["A", "So, how did the interview go?"],
      ["B", "Honestly, I thought I'd blown it. They kept asking about stuff I hadn't done in years."],
      ["A", "But?"],
      ["B", "But they called me this morning. Turns out the other guy pulled out, so the job's mine if I want it."],
      ["A", "That's brilliant! You don't sound too excited, though."],
      ["B", "Well, it'd mean moving to Manchester, and I'm not sure I'm ready for that."],
    ],
    questions: [
      { q: "Hogyan érezte magát az interjú után?", options: ["Biztos volt a sikerben", "Azt hitte, elrontotta", "Nem érdekelte"], answer: 1 },
      { q: "Miért bizonytalan?", options: ["Kevés a fizetés", "Költöznie kellene", "Nem tetszik a főnök"], answer: 1 },
    ],
  },
];

// 3. Felolvasás: kiejtés ellenőrzése a beszédfelismeréssel.
export const READ_ALOUD = [
  { level: "A1", text: "Thank you very much for your help." },
  { level: "A2", text: "I think the weather will be better this weekend." },
  { level: "B1", text: "The three brothers thought the theatre was worth it." },
  { level: "B1", text: "We usually walk to work, but yesterday we took the bus." },
  { level: "B2", text: "Although the vehicle was reasonably cheap, it wasn't worth the trouble." },
];

// 4. Aktív beszéd: magyar mondatot hallasz/látsz, szóban mondod angolul.
export const TRANSLATE = [
  { level: "A1", hu: "Hol van a pályaudvar?", en: ["Where is the train station?", "Where is the station?", "Where's the station?", "Where's the train station?"] },
  { level: "A1", hu: "Egy kávét kérek.", en: ["A coffee, please.", "I'd like a coffee, please.", "Can I have a coffee, please?", "One coffee, please."] },
  { level: "A2", hu: "Tegnap nagyon fáradt voltam.", en: ["I was very tired yesterday.", "Yesterday I was very tired.", "I was really tired yesterday."] },
  { level: "A2", hu: "Holnap meg fogom látogatni a barátomat.", en: ["I'm going to visit my friend tomorrow.", "I will visit my friend tomorrow.", "Tomorrow I'm going to visit my friend.", "I'm visiting my friend tomorrow."] },
  { level: "B1", hu: "Három éve dolgozom ennél a cégnél.", en: ["I've worked at this company for three years.", "I have been working at this company for three years.", "I've been working for this company for three years.", "I have worked for this company for three years."] },
  { level: "B1", hu: "Ha lenne időm, eljönnék veled.", en: ["If I had time, I would come with you.", "If I had time, I'd come with you.", "If I had the time, I would come with you."] },
  { level: "B2", hu: "Bárcsak korábban mondtad volna!", en: ["I wish you had told me earlier!", "I wish you'd told me earlier!", "If only you had told me earlier!"] },
  { level: "B2", hu: "Nem kellett volna annyit ennem.", en: ["I shouldn't have eaten so much.", "I should not have eaten so much.", "I shouldn't have eaten that much."] },
];

export const LEVELS = ["A1", "A2", "B1", "B2"];
