import { parsePlanStructure } from "../api/catalog.mjs";

// Contenu Notion (PLAN — Le chemin du vrai disciple), propriété Plan [extration ia]
const raw = `**Étape 1: Avancer malgré les adversités**
Jour 1: 2 Corinthiens 4:8-9, Galates 6:9, Hébreux 12:1-3
Jour 2: Ésaïe 40:28-31, Ésaïe 43:1-2, Psaume 23:4
Jour 3: Josué 1:7-9, Psaume 27:1-3, Psaume 46:1-3
Jour 4: 2 Corinthiens 4:16-18, Romains 8:18, Romains 5:3-5
Jour 5: Jacques 1:2-4, Jacques 1:12, 1 Pierre 1:6-7
Jour 6: 2 Corinthiens 12:9-10, Philippiens 4:11-13, Ésaïe 41:10
Jour 7: Hébreux 10:35-36, Hébreux 12:11-13, Romains 8:35-37
Jour 8: 1 Corinthiens 15:58, 2 Timothée 2:3, 2 Timothée 4:5
Jour 9: Psaume 34:18-20, Psaume 42:6-12, Psaume 73:21-26
Jour 10: Matthieu 24:13, Apocalypse 2:10, Apocalypse 3:11

**Étape 2: Renoncer à soi-même**
Jour 11: Matthieu 16:24-26, Luc 9:23-25, Luc 14:25-27
Jour 12: Luc 14:33, Matthieu 10:37-39, Jean 12:24-26
Jour 13: Luc 22:41-42, Jean 6:38, Matthieu 26:39
Jour 14: Romains 12:1-2, Galates 2:20, Galates 5:24
Jour 15: Philippiens 2:5-8, Philippiens 3:7-9, Colossiens 3:1-3
Jour 16: Matthieu 6:9-10, Matthieu 6:33, 1 Jean 2:15-17
Jour 17: Romains 6:6-8, Romains 6:11-13, Éphésiens 4:22-24
Jour 18: Marc 8:34-37, Matthieu 19:21-22, Luc 18:28-30
Jour 19: Jean 15:4-5, Jean 3:30, 2 Corinthiens 5:14-15
Jour 20: 1 Pierre 2:21-24, 1 Pierre 4:1-2, Hébreux 5:7-9

**Étape 3: Être un témoin fidèle**
Jour 21: Actes 1:8, Matthieu 28:18-20, Matthieu 5:14-16
Jour 22: 2 Timothée 1:7-8, 2 Timothée 2:1-3, 2 Timothée 4:1-2
Jour 23: Actes 4:18-20, Actes 5:29, Actes 20:22-24
Jour 24: 1 Pierre 3:14-16, Philippiens 1:27-29, 1 Corinthiens 4:1-2
Jour 25: Jean 15:26-27, Jean 13:34-35, 1 Jean 1:1-3
Jour 26: 2 Corinthiens 5:18-20, Éphésiens 6:19-20, Colossiens 4:5-6
Jour 27: Matthieu 10:32-33, Luc 12:8-9, Apocalypse 12:11
Jour 28: 1 Timothée 4:12-16, 1 Timothée 6:11-12, Tite 2:7-8
Jour 29: Actes 7:54-60, Actes 16:25-26, 2 Timothée 4:6-8
Jour 30: 1 Corinthiens 9:24-27, Hébreux 12:1-2, Philippiens 3:12-14

**Étape 4: Vivre sous la souveraineté de Dieu**
Jour 31: Psaume 103:19, Daniel 4:34-35, Ésaïe 46:9-10
Jour 32: Romains 8:28-30, Éphésiens 1:11, Proverbes 19:21
Jour 33: Genèse 50:20, Job 42:1-3, Psaume 115:3
Jour 34: Ésaïe 55:8-9, Romains 11:33-36, Jérémie 29:11
Jour 35: Proverbes 3:5-6, Psaume 37:5-7, Psaume 46:10
Jour 36: Habacuc 3:17-19, Job 1:20-22, 1 Pierre 4:19
Jour 37: Romains 5:1-5, Jacques 1:2-4, 2 Corinthiens 1:3-5
Jour 38: Psaume 31:14-15, Psaume 62:6-9, Ésaïe 26:3-4
Jour 39: Colossiens 1:15-17, Hébreux 1:3, Apocalypse 4:11
Jour 40: Romains 8:31-39, Apocalypse 21:3-5, Jude 1:24-25`;

const { days, stages } = parsePlanStructure(raw);
console.log("chars", raw.length);
console.log("days", days.length);
console.log(
  "etapes",
  stages.map((s) => `${s.id}:${s.fromJour}-${s.toJour}`).join(" | "),
);
console.log("j1", days[0]?.texte);
console.log("j40", days[39]?.texte, "e", days[39]?.etape);

if (days.length !== 40) {
  console.error("FAIL: expected 40 days, got", days.length);
  process.exit(1);
}
if (stages.length !== 4) {
  console.error("FAIL: expected 4 stages");
  process.exit(1);
}
if (stages[0].toJour !== 10 || stages[3].fromJour !== 31) {
  console.error("FAIL: stage bounds", stages);
  process.exit(1);
}
// Truncation ~2000 chars would lose later days
const truncated = raw.slice(0, 2000);
const partial = parsePlanStructure(truncated);
console.log("truncated@2000 days", partial.days.length, "(bug before fix)");
if (partial.days.length >= 40) {
  console.error("FAIL: truncation fixture unexpected");
  process.exit(1);
}
console.log("OK");
