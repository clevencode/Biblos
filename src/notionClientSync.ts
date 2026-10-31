/**
 * Sync cliente ↔ Notion (API Vercel). Desligado para testes mobile offline.
 * Repor `true` antes de release / push produção.
 */
export const NOTION_CLIENT_SYNC_ENABLED = false;

export function isNotionClientSyncEnabled(): boolean {
  return NOTION_CLIENT_SYNC_ENABLED;
}
