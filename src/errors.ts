/** Das Modell hat die Anfrage aus Sicherheitsgründen abgelehnt */
export class AiRefusalError extends Error {}
/** Antwort kam nicht vollständig oder nicht im erwarteten Format an */
export class AiIncompleteError extends Error {}
/** Der KI-Dienst hat mit einem HTTP-Status geantwortet (provider-unabhängig) */
export class AiApiError extends Error {
  /** undefined, wenn der Dienst ohne HTTP-Antwort gescheitert ist (z. B. Verbindungsfehler) */
  readonly status: number | undefined;

  constructor(status: number | undefined) {
    super(`Der KI-Dienst hat mit Status ${status ?? 'ohne Status'} geantwortet.`);
    this.status = status;
  }
}

/** Fehlercodes der KI-Edge-Functions (backend/supabase/functions/_shared/ai-request.ts) */
export const AI_ERROR_CODES = [
  'unauthorized',
  'missing-key',
  'invalid-key',
  'bad-request',
  'too-large',
  'refused',
  'incomplete',
  'ai-unavailable',
  'unavailable',
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

/** Dazu `offline` (Server nicht erreicht) und `invalid-response` (Antwort passt nicht) */
export type AiFunctionErrorCode = AiErrorCode | 'offline' | 'invalid-response';

/** Ruft eine KI-Edge-Function auf; wirft `AiFunctionError` mit dem Fehlercode des Servers */
export class AiFunctionError extends Error {
  constructor(readonly code: AiFunctionErrorCode) {
    super(code);
  }
}
