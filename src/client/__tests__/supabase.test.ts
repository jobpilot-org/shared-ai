import { describe, expect, it, vi } from 'vitest';

import { AiFunctionError, type AiFunctionErrorCode } from '../../errors.js';
import { invokeAiFunction, type AiFunctionClient } from '../supabase.js';

const errorResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  });

/** Nachgebauter Supabase-Client: liefert die vorbereitete Antwort der Edge Function */
function fakeClient(reply: { data?: unknown; error?: unknown }) {
  const invoke = vi.fn(async () => ({ data: reply.data ?? null, error: reply.error ?? null }));
  return { client: { functions: { invoke } } as unknown as AiFunctionClient, invoke };
}

const failureOf = async (promise: Promise<unknown>): Promise<AiFunctionErrorCode> => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AiFunctionError);
    return (error as AiFunctionError).code;
  }
  throw new Error('Der Aufruf hätte fehlschlagen müssen.');
};

describe('invokeAiFunction', () => {
  it('gibt die Daten der Funktion zurück und schickt Name und Body mit', async () => {
    const { client, invoke } = fakeClient({ data: { job: { company: 'Nordlicht' } } });

    const result = await invokeAiFunction<{ job: { company: string } }>(client, 'job-import', {
      posting: 'Text',
    });

    expect(result).toEqual({ job: { company: 'Nordlicht' } });
    expect(invoke).toHaveBeenCalledWith('job-import', { body: { posting: 'Text' } });
  });

  it('übernimmt einen bekannten Fehlercode des Servers', async () => {
    const { client } = fakeClient({ error: { context: errorResponse({ error: 'missing-key' }) } });

    expect(await failureOf(invokeAiFunction(client, 'cv-import', {}))).toBe('missing-key');
  });

  it('meldet unbekannte Fehlercodes und unlesbare Antworten als unavailable', async () => {
    const unknownCode = fakeClient({
      error: { context: errorResponse({ error: 'rate-limited' }) },
    });
    expect(await failureOf(invokeAiFunction(unknownCode.client, 'job-fit', {}))).toBe(
      'unavailable',
    );

    const noBody = fakeClient({ error: { context: new Response('kaputt', { status: 500 }) } });
    expect(await failureOf(invokeAiFunction(noBody.client, 'job-fit', {}))).toBe('unavailable');

    const notJson = fakeClient({
      error: { context: new Response('<html>Fehler</html>', { status: 502 }) },
    });
    expect(await failureOf(invokeAiFunction(notJson.client, 'job-fit', {}))).toBe('unavailable');
  });

  it('meldet einen nicht erreichten Server als offline', async () => {
    const network = fakeClient({ error: new TypeError('Failed to fetch') });
    expect(await failureOf(invokeAiFunction(network.client, 'cover-letter', {}))).toBe('offline');

    // Das Relay der Edge Functions antwortet ohne HTTP-Antwort am Client
    const relay = fakeClient({ error: { name: 'FunctionsRelayError', context: { region: 'eu' } } });
    expect(await failureOf(invokeAiFunction(relay.client, 'cover-letter', {}))).toBe('offline');
  });
});
