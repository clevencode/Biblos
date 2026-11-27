import { storage } from './shim';
import * as fs from './mock-firestore';
import { setVerseMarks, exportVerseMarkStore } from '../../src/verseMarks';
import { markJourComplete, exportPlanProgressStore } from '../../src/features/reading-plans/domain/planProgress';
import { startUserDataSync, stopUserDataSync, flushUserDataBeforeSignOut, clearPersonalLocalData, getSyncStatus } from '../../src/features/user-sync/data/userDataSync';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
function check(name: string, ok: boolean, extra = '') { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; }
const PENDING = 'biblos.userSync.pending.v1';
const hiPath = 'users/u1/highlights/state';
const planPath = 'users/u1/planProgress/state';

(async () => {
  // 1. gesto → pendente → push com debounce → confirmado
  await startUserDataSync('u1'); await wait(50);
  setVerseMarks('JHN', '3', [16], '#ffcc00' as never);
  check('1a pendente marcado logo após o gesto', (storage.get(PENDING) ?? '').includes('highlights'));
  await wait(1400);
  check('1b marca chegou ao Firestore', JSON.stringify(fs.remote.get(hiPath) ?? {}).includes('JHN'));
  check('1c pendente limpo após confirmação', !storage.has(PENDING), storage.get(PENDING) ?? '');
  check('1d estado synced', getSyncStatus() === 'synced', getSyncStatus());

  // 2. reinício antes do debounce → reenvio no arranque
  markJourComplete('plan-a', 3);
  check('2a progresso pendente', (storage.get(PENDING) ?? '').includes('planProgress'));
  stopUserDataSync(); // navegador fechado antes do push
  check('2b ainda não está no Firestore', !fs.remote.has(planPath));
  check('2c pendente sobrevive ao fecho', (storage.get(PENDING) ?? '').includes('planProgress'));
  await startUserDataSync('u1'); await wait(100);
  check('2d reenviado no arranque', JSON.stringify(fs.remote.get(planPath) ?? {}).includes('plan-a'));
  check('2e pendente limpo', !storage.has(PENDING), storage.get(PENDING) ?? '');

  // 3. esconder a página envia já (sem esperar debounce)
  setVerseMarks('GEN', '1', [1], '#00ccff' as never);
  (document as any).visibilityState = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
  await wait(30);
  check('3 página escondida → flush imediato', JSON.stringify(fs.remote.get(hiPath) ?? {}).includes('GEN'));
  (document as any).visibilityState = 'visible';

  // 4. evento storage de outra aba (outra chave) não gera escrita
  await wait(1400);
  const before = fs.writes.length;
  window.dispatchEvent(new Event('storage'));
  await wait(1400);
  check('4 storage sem mudança → sem push', fs.writes.length === before, `${fs.writes.length - before} escritas`);

  // 5. offline: guardado, enviado quando a rede volta (mesmo após reinício)
  fs.setOnline(false); (navigator as any).onLine = false;
  markJourComplete('plan-b', 1);
  await wait(1400);
  check('5a offline → estado offline', getSyncStatus() === 'offline', getSyncStatus());
  check('5b pendente mantido offline', (storage.get(PENDING) ?? '').includes('planProgress'));
  stopUserDataSync();
  fs.setOnline(true); (navigator as any).onLine = true;
  await startUserDataSync('u1'); await wait(100);
  check('5c após reinício online → enviado', JSON.stringify(fs.remote.get(planPath) ?? {}).includes('plan-b'));
  check('5d pendente limpo', !storage.has(PENDING), storage.get(PENDING) ?? '');

  // 6. novo aparelho / dados locais apagados → remoto restaura local
  stopUserDataSync(); clearPersonalLocalData();
  check('6a local vazio', Object.keys(exportVerseMarkStore()).length === 0);
  await startUserDataSync('u1'); await wait(100);
  check('6b marcas restauradas do Firestore', JSON.stringify(exportVerseMarkStore()).includes('JHN'));
  check('6c progresso restaurado', JSON.stringify(exportPlanProgressStore()).includes('plan-a'));
  const hiRemote = JSON.stringify(fs.remote.get(hiPath));
  check('6d remoto não foi apagado pelo local vazio', hiRemote.includes('JHN') && hiRemote.includes('GEN'));

  // 7. logout envia o pendente antes de limpar
  setVerseMarks('PSA', '23', [1], '#ff00aa' as never);
  await flushUserDataBeforeSignOut();
  stopUserDataSync(); clearPersonalLocalData();
  check('7 logout: gesto recente chegou ao Firestore', JSON.stringify(fs.remote.get(hiPath) ?? {}).includes('PSA'));

  console.log(fails ? `\n${fails} FAIL` : '\nTODOS OK');
  process.exit(fails ? 1 : 0);
})();
