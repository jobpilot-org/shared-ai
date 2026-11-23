import { AI_ERROR_CODES, AiFunctionError, type AiErrorCode } from '../errors.js';

const SERVER_CODES = new Set<string>(AI_ERROR_CODES);

/** Der Ausschnitt des Supabase-Clients, den ein KI-Aufruf braucht */
export interface AiFunctionClient {
  functions: {
    invoke<T>(
      name: string,
      options: { body?: Record<string, unknown> },
    ): Promise<{ data: T | null; error: unknown }>;
  };
}

/**
 * `instanceof FunctionsHttpError` scheitert, wenn im Bundle eine zweite Kopie des SDK liegt –
 * deshalb zählt die Form: ein Fehler mit einer HTTP-Antwort als `context`.
 */
function httpResponse(error: unknown): Response | null {
  if (typeof error !== 'object' || error === null || !('context' in error)) return null;
  const context = (error as { context: unknown }).context;
  return context instanceof Response ? context : null;
}

/**
 * Ruft eine KI-Edge-Function auf. Wirft `AiFunctionError`: den Fehlercode des Servers,
 * `offline`, wenn der Server nicht erreicht wurde, sonst `unavailable`.
 */
export async function invokeAiFunction<T>(
  client: AiFunctionClient,
  name: string,
  body: unknown,
): Promise<T | null> {
  const { data, error } = await client.functions.invoke<T>(name, {
    body: body as Record<string, unknown>,
  });
  if (!error) return data;

  const response = httpResponse(error);
  if (!response) throw new AiFunctionError('offline');

  const parsed = (await response.json().catch(() => null)) as { error?: string } | null;
  const code = parsed?.error;
  throw new AiFunctionError(code && SERVER_CODES.has(code) ? (code as AiErrorCode) : 'unavailable');
}
