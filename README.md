# Angol Beszéd 🗣️

Beszédközpontú angol gyakorló webapp magyaroknak – **kihangosított autós móddal**.
Azoknak szól, akik olvasva jól értenek angolul, de beszélni és hallás után érteni nehezen tudnak.

A tanulási terv: [docs/TANULASI_TERV.md](docs/TANULASI_TERV.md)

## Funkciók

- **Szintfelmérés** (15 perc): diktálás, párbeszéd-értés, felolvasás (kiejtés), szóban fordítás
  → becsült CEFR-szint készségenként; ebből állítja be a gyakorlás nehézségét.
- **🚗 Autós mód:** indítás után nem kell hozzányúlni. Az app beszél, te válaszolsz, a
  beszédfelismerés ellenőriz, és magától halad tovább:
  utánmondás → magyarból angolra szóban → gyors, összevont beszéd → kérdés–válasz (vagy
  AI-beszélgetés) → a hibázott mondatok ismétlése.
  Hangparancsok: *repeat, slower, next, pause, stop* (szünetből: *continue*).
- **🌙 Esti gyakorlás:** diktálás, kiejtés, „Mondd angolul”, gyors beszéd, minimálpárok.
- **🤖 AI beszélgetőpartner (opcionális):** saját Claude API kulccsal szabad beszélgetés vagy
  szerepjáték, rövid javításokkal – szövegesen, szóban, és az autós módban is.
- **📋 Napi napló és célzott gyakorlás:** minden nem sikerült mondat elmentődik (mit kellett volna
  mondani, mit mondtál). A napló felismeri a visszatérő hibamintákat (névelők, segédigék,
  elöljárószók, -s/-ed végződés, th és w/v hang, szórend, hasonló hangzású szavak, „nem jött válasz”),
  és magyarul elmagyarázza őket. A **makacs mondatok** addig jönnek vissza („🎯 Makacs mondataim”,
  autóban „Célzott menet”), amíg háromszor egymás után fejből helyesen ki nem mondod őket.
  A napló egy gombbal megosztható vagy e-mailben elküldhető; API kulccsal az AI is elemzi a napot,
  és gyakorló mondatokat ír a hibáidra.
- **Haladás:** ismétlési rendszer (a rontott mondatok hamarabb jönnek vissza), napi statisztika,
  sorozat, felmérések összevetése. Minden a böngészőben tárolódik.
- 220+ gyakori beszélt mondat 15 témában (A1–B2), 24 összevont beszéd gyakorlat, 18 minimálpár.

## Használat

### Telefonon (ajánlott: Android + Chrome)

A mikrofonhoz HTTPS kell, ezért a legegyszerűbb a GitHub Pages:

1. GitHub → a repó **Settings → Pages** → *Deploy from a branch* → válaszd ezt az ágat és a `/ (root)` mappát.
2. Nyisd meg a kapott `https://<felhasználónév>.github.io/language/` címet Chrome-ban.
3. Menü → **Hozzáadás a kezdőképernyőhöz** – így appként indul, és offline is működik (az AI kivételével).
4. Első indításkor engedélyezd a mikrofont.

**Magyar felolvasó hang** (az autós fordítós részhez kell): Android → Beállítások →
Kisegítő lehetőségek / Rendszer → Szövegfelolvasó → Google beszédszolgáltatások → Nyelvek →
magyar hang letöltése. Ha nincs magyar hang, a fordítós rész helyett utánmondás lesz.

### Számítógépen

```bash
python3 -m http.server 8000
# majd Chrome-ban: http://localhost:8000
```

(`localhost`-on a mikrofon HTTPS nélkül is működik.)

### AI beszélgetőpartner

1. Hozz létre egy API kulcsot: <https://console.anthropic.com/> → API Keys.
2. Az appban: ⚙️ Beállítások → API kulcs → Mentés. Modell: alapból Claude Opus 5.5;
   választható a gyorsabb, olcsóbb Claude Sonnet 5.5 vagy Claude Haiku 4.5 is (autóban a
   gyorsabb válasz kellemesebb lehet).
3. A kulcs csak a böngésződben tárolódik, és közvetlenül az Anthropic API-hoz megy.
   Ne add meg megosztott gépen. A használat díjköteles.

## Böngésző-támogatás

| | Felolvasás | Beszédfelismerés |
|---|---|---|
| Chrome (Android, asztali) | ✅ | ✅ (internet kell hozzá) |
| Edge | ✅ | ✅ |
| Safari (iOS/macOS) | ✅ | részben |
| Firefox | ✅ | ❌ |

## Fejlesztés

Build nélküli, sima HTML + JavaScript modulok.

```
index.html        – váz
css/style.css     – stílus (világos/sötét)
js/app.js         – router, kezdőlap, beállítások, terv
js/speech.js      – felolvasás és beszédfelismerés (Web Speech API)
js/score.js       – válasz összevetése a várt mondattal
js/storage.js     – haladás, ismétlési rendszer (localStorage)
js/assessment.js  – szintfelmérés
js/carmode.js     – autós mód
js/drills.js      – esti gyakorlatok
js/tutor.js       – Claude API kliens (AI partner)
js/tutorview.js   – AI chat képernyő
js/mistakes.js    – hibanapló, hibaminták, makacs mondatok
js/report.js      – napi napló képernyő, megosztás / e-mail
data/*.js         – mondatok, gyakorlatok, felmérés anyaga
sw.js, manifest.json – telepíthető, offline működés
```

Tesztek (Node 20+):

```bash
npm test
```

Új mondatot a `data/phrases.js` megfelelő témájának **végére** írj (az azonosító a sorszámból képződik).
