export interface SyncResponse {
  syncId: number;
  total: number;
  status: 'success' | 'error';
  error?: string;
  durationMs: number;
}
