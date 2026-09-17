import { parsePlanStructure } from "../api/catalog.mjs";

const raw = `**Étape 1: Avancer malgré les adversités**
Jour 1: 2 Corinthiens 4:8-9, Galates 6:9, Hébreux 12:1-3
Jour 10: Matthieu 24:13, Apocalypse 2:10, Apocalypse 3:11

**Étape 2: Renoncer à soi-même**
Jour 11: Matthieu 16:24-26, Luc 9:23-25, Luc 14:25-27
Jour 20: 1 Pierre 2:21-24, 1 Pierre 4:1-2, Hébreux 5:7-9

**Étape 3: Être un témoin fidèle**
Jour 21: Actes 1:8, Matthieu 28:18-20, Matthieu 5:14-16
Jour 30: 1 Corinthiens 9:24-27, Hébreux 12:1-2, Philippiens 3:12-14

**Étape 4: Vivre sous la souveraineté de Dieu**
Jour 31: Psaume 103:19, Daniel 4:34-35, Ésaïe 46:9-10
Jour 40: Romains 8:31-39, Apocalypse 21:3-5, Jude 1:24-25`;

const { days, stages } = parsePlanStructure(raw);
console.log(
  "days",
  days.length,
  days.map((d) => `${d.jour}:e${d.etape ?? "?"}`).join(","),
);
console.log("stages", JSON.stringify(stages, null, 2));
if (stages.length !== 4) {
  console.error("FAIL: expected 4 stages");
  process.exit(1);
}
if (days.some((d) => !d.etape)) {
  console.error("FAIL: missing etape on day");
  process.exit(1);
}
console.log("OK");
