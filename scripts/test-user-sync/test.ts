/**
 * Sync das atividades entre dispositivos (Firestore em memória).
 * Cada "dispositivo" tem o seu localStorage; o Firestore é partilhado.
 */
import { storage } from "./shim";
import * as fs from "./mock-firestore";
import { setVerseMarks, exportVerseMarkEntries } from "../../src/verseMarks";
import {
  markJourComplete,
  resetPlanProgress,
  loadPlanProgress,
} from "../../src/features/reading-plans/domain/planProgress";
import { saveVerseNote, loadVerseNote } from "../../src/bible/verseNotes";
import { saveDayNoteLocal, loadDayNote } from "../../src/features/reading-plans/domain/planDayNote";
import {
  recordBibleRead,
  listBibleReadingHistory,
  removeActivityById,
} from "../../src/activityLog";
import {
  startUserDataSync,
  stopUserDataSync,
  flushUserDataBeforeSignOut,
  clearPersonalLocalData,
  getSyncStatus,
} from "../../src/features/user-sync/data/userDataSync";

const UID = "u1";
const PENDING = "biblos.userSync.pending.v1";
const doc = (id: string) => fs.remote.get(`users/${UID}/${id}/state`) as Record<string, any> | undefined;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) fails++;
}

/* ---- dispositivos: troca o conteúdo do localStorage ---- */
const devices = new Map<string, Map<string, string>>();
let current = "A";
devices.set("A", new Map());
async function useDevice(name: string) {
  stopUserDataSync();
  devices.set(current, new Map(storage));
  storage.clear();
  for (const [k, v] of devices.get(name) ?? new Map()) storage.set(k, v);
  current = name;
  await startUserDataSync(UID);
  await wait(30);
}
/** Fecha o navegador sem enviar nada (sem flush). */
function killBrowser() {
  stopUserDataSync();
}

const ref = { versionId: "s21" as const, usfm: "JHN", chapter: 3 };
const hasMark = (key: string) => key in exportVerseMarkEntries();

(async () => {
  /* ===== 1. mesmo dispositivo: gesto → pendente → envio ===== */
  await startUserDataSync(UID);
  await wait(30);
  setVerseMarks("JHN", "3", [16], "#ffcc00");
  check("1a pendente marcado logo após o gesto", (storage.get(PENDING) ?? "").includes("highlights"));
  await wait(1400);
  check("1b marca no Firestore (formato v2)", doc("highlights")?.schema === 2 && "JHN.3:16" in (doc("highlights")?.entries ?? {}));
  check("1c pendente limpo após confirmação", !storage.has(PENDING), storage.get(PENDING) ?? "");
  check("1d estado synced", getSyncStatus() === "synced", getSyncStatus());

  /* ===== 2. reinício antes do envio ===== */
  markJourComplete("plan-a", 3);
  killBrowser();
  check("2a ainda não enviado", !doc("planProgress"));
  await startUserDataSync(UID);
  await wait(30);
  check("2b reenviado no arranque", "plan-a#3" in (doc("planProgress")?.entries ?? {}));

  /* ===== 3. página escondida → envio imediato ===== */
  setVerseMarks("GEN", "1", [1], "#00ccff");
  (document as any).visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  await wait(30);
  (document as any).visibilityState = "visible";
  check("3 flush ao esconder a página", "GEN.1:1" in (doc("highlights")?.entries ?? {}));

  /* ===== 4. evento storage sem mudança → sem push ===== */
  await wait(1400);
  const before = fs.writes.length;
  window.dispatchEvent(new Event("storage"));
  await wait(1400);
  check("4 storage sem mudança → sem push", fs.writes.length === before, `${fs.writes.length - before} escritas`);

  /* ===== 5. dados criados em A aparecem em B ===== */
  saveVerseNote({ ...ref, verse: 16 }, "Note de A");
  saveDayNoteLocal("plan-a", 3, "Journal A");
  recordBibleRead({ bookId: "JHN", chapterId: "3", versionId: "s21", userId: UID });
  await wait(1400);
  await useDevice("B");
  check("5a B recebe marcas", hasMark("JHN.3:16") && hasMark("GEN.1:1"));
  check("5b B recebe nota de versículo", loadVerseNote("s21", "JHN", 3, 16)?.text === "Note de A");
  check("5c B recebe nota do plano", loadDayNote("plan-a", 3)?.text === "Journal A");
  check("5d B recebe progresso", loadPlanProgress("plan-a")?.completedJours.includes(3) === true);
  check("5e B recebe histórico", listBibleReadingHistory(UID, 10).length === 1);

  /* ===== 6. remoções em B propagam para A (não reaparecem) ===== */
  saveVerseNote({ ...ref, verse: 16 }, ""); // apagar nota
  setVerseMarks("GEN", "1", [1], null); // apagar marca
  resetPlanProgress("plan-a"); // reiniciar plano
  const readEvent = listBibleReadingHistory(UID, 10)[0]!;
  removeActivityById(readEvent.id, UID); // apagar item do histórico
  await wait(1400);
  await useDevice("A");
  check("6a nota apagada em B some em A", loadVerseNote("s21", "JHN", 3, 16) == null);
  check("6b marca apagada em B some em A", !hasMark("GEN.1:1") && hasMark("JHN.3:16"));
  check("6c plano reiniciado em B → A sem dias concluídos", (loadPlanProgress("plan-a")?.completedJours.length ?? -1) === 0);
  check("6d item do histórico apagado em B some em A", listBibleReadingHistory(UID, 10).length === 0);
  await wait(1400);
  check("6e A não ressuscita a nota no Firestore", Object.keys(doc("verseNotes")?.entries ?? {}).length === 0);

  /* ===== 7. edições offline em paralelo somam-se ===== */
  fs.setOnline(false); (navigator as any).onLine = false;
  markJourComplete("plan-a", 2);
  await wait(1400);
  check("7a offline → estado offline", getSyncStatus() === "offline", getSyncStatus());
  killBrowser();
  await useDevice("B");
  markJourComplete("plan-a", 5);
  await wait(1400);
  killBrowser();
  fs.setOnline(true); (navigator as any).onLine = true;
  await useDevice("A");
  await wait(1400);
  await useDevice("B");
  const daysB = loadPlanProgress("plan-a")?.completedJours ?? [];
  check("7b dias concluídos offline em A e B ficam ambos", daysB.includes(2) && daysB.includes(5), JSON.stringify(daysB));

  /* ===== 8. mesma nota editada nos dois: a mais recente ganha ===== */
  saveVerseNote({ ...ref, verse: 1 }, "versão B (antiga)");
  await wait(1400);
  await useDevice("A");
  await wait(5);
  saveVerseNote({ ...ref, verse: 1 }, "versão A (recente)");
  await wait(1400);
  await useDevice("B");
  check("8 última edição ganha", loadVerseNote("s21", "JHN", 3, 1)?.text === "versão A (recente)", loadVerseNote("s21", "JHN", 3, 1)?.text);

  /* ===== 8b. tempo real: mudança de outro dispositivo com B aberto ===== */
  {
    const d = doc("highlights")!;
    const at = new Date(Date.now() + 1000).toISOString();
    await fs.setDoc(`users/${UID}/highlights/state`, {
      ...d,
      entries: { ...d.entries, "MAT.5:9": { color: "#ffcc00", markedAt: at } },
      meta: { ...d.meta, "MAT.5:9": { at, h: "live" } },
    });
    await wait(20);
    check("8b B aberto recebe marca nova em tempo real", hasMark("MAT.5:9"));
    setVerseMarks("MAT", "5", [9], null);
    await wait(1400);
  }

  /* ===== 9. dispositivo novo / dados do navegador apagados ===== */
  await useDevice("C");
  check("9a C (novo) recebe tudo", hasMark("JHN.3:16") && loadVerseNote("s21", "JHN", 3, 1) != null);
  const hiCount = Object.keys(doc("highlights")?.entries ?? {}).length;
  check("9b C vazio não apaga o remoto", hiCount === 1, String(hiCount));

  /* ===== 10. logout envia o pendente antes de limpar ===== */
  setVerseMarks("PSA", "23", [1], "#ff00aa");
  await flushUserDataBeforeSignOut();
  stopUserDataSync();
  clearPersonalLocalData();
  check("10 logout: gesto recente chegou ao Firestore", "PSA.23:1" in (doc("highlights")?.entries ?? {}));

  /* ===== 11. migração: documento e dados locais do formato antigo ===== */
  const LEG = "u-legacy";
  fs.remote.set(`users/${LEG}/highlights/state`, {
    store: { "ROM.8": { "28": "#ffcc00" } },
    touched: { "ROM.8:28": "2025-01-01T00:00:00.000Z" },
    removed: { "ROM.8:1": "2025-01-02T00:00:00.000Z" },
    updatedAt: "2025-01-02T00:00:00.000Z",
  });
  storage.clear();
  storage.set("biblos.verseMarks", JSON.stringify({ "ROM.8": { "1": "#00ff00" }, "EPH.2": { "8": "#00ff00" } }));
  storage.set("biblos.verseMarks.touched", JSON.stringify({ "ROM.8:1": "2024-12-01T00:00:00.000Z", "EPH.2:8": "2024-12-01T00:00:00.000Z" }));
  await startUserDataSync(LEG);
  await wait(1400);
  const legDoc = fs.remote.get(`users/${LEG}/highlights/state`) as Record<string, any>;
  check("11a doc antigo reescrito em v2 (sem `store`)", legDoc?.schema === 2 && !("store" in legDoc));
  check("11b marca antiga do remoto chega ao local", hasMark("ROM.8:28"));
  check("11c remoção antiga (mais recente) vence marca local antiga", !hasMark("ROM.8:1"));
  check("11d marca só local é enviada", "EPH.2:8" in (legDoc?.entries ?? {}));
  stopUserDataSync();

  console.log(fails ? `\n${fails} FAIL` : "\nTODOS OK");
  process.exit(fails ? 1 : 0);
})();
