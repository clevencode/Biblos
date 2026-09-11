/**
 * Teste rápido da mensagem de lembrete de leitura diária.
 * Usage: npm run test:reminder
 */
import assert from "node:assert/strict";
import { shiftDay, todayKey } from "../src/calendar.ts";
import { buildDailyReadingReminder } from "../src/readingReminder.ts";

const today = todayKey();
const yesterday = shiftDay(today, -1);

const plan = {
  id: "plan-test",
  nome: "Disciple de Jesus",
  theme: "Disciple de Jesus",
  url: "",
  days: [
    { jour: 1, texte: "Jean 3:16-21", defi: "" },
    { jour: 2, texte: "Jean 4:1-14", defi: "" },
    { jour: 3, texte: "Matthieu 5:1-12", defi: "" },
  ],
};

const day1 = buildDailyReadingReminder(plan, {
  startDate: today,
  completedDays: [],
});
assert.ok(day1);
assert.equal(day1.jour, 1);
assert.equal(day1.passageLabel, "Jean 3:16-21");
assert.match(day1.title, /Jour 1/);
assert.match(day1.body, /Jean 3:16-21/);
assert.equal(day1.complete, false);

const day2 = buildDailyReadingReminder(plan, {
  startDate: yesterday,
  completedDays: [1],
});
assert.ok(day2);
assert.equal(day2.jour, 2);
assert.equal(day2.passageLabel, "Jean 4:1-14");

const done = buildDailyReadingReminder(plan, {
  startDate: yesterday,
  completedDays: [1, 2, 3],
});
assert.ok(done);
assert.equal(done.complete, true);
assert.match(done.body, /terminé/i);

assert.equal(buildDailyReadingReminder(null, null), null);

console.log("OK readingReminder");
console.log(` sample: ${day1.title} — ${day1.body}`);
