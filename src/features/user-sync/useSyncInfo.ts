import { useEffect, useState } from "react";
import {
  getSyncInfo,
  subscribeSyncInfo,
  type SyncInfo,
} from "./data/userDataSync";

/** Estado da sync das atividades + última sincronização (indicadores de UI). */
export function useSyncInfo(): SyncInfo {
  const [info, setInfo] = useState<SyncInfo>(getSyncInfo);
  useEffect(() => subscribeSyncInfo(setInfo), []);
  return info;
}
