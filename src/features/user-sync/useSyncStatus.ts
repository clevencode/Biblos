import { useEffect, useState } from "react";
import {
  getSyncStatus,
  subscribeSyncStatus,
  type SyncStatus,
} from "./data/userDataSync";

/** Estado da sync das atividades (para indicadores de UI). */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus);
  useEffect(() => subscribeSyncStatus(setStatus), []);
  return status;
}
