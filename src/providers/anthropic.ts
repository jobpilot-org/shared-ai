import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';

import {
  EFFORT,
  responseSchemas,
  type AiAction,
  type AiResponse,
  type AiService,
  type requestSchemas,
} from '../assistant.js';
import { AiApiError, AiIncompleteError, AiRefusalError } from '../errors.js';
import { PROMPTS } from '../prompts/assistant.js';

export const ANTHROPIC_MODEL = 'claude-opus-5-5';

type MessagesClient = Pick<Anthropic, 'beta'>;

export type AnthropicRequest<S extends z.ZodType> = {
  system: string;
  user: string;
  /** Antwortformat – der Dienst erzwingt die Form */
  schema: S;
  maxTokens: number;
  effort: 'low' | 'medium';
  /** Base64 eines PDFs; wird vor dem Text als Dokument übergeben */
  pdf?: string;
};

export type AnthropicResult<S extends z.ZodType> = {
  output: z.infer<S>;
  /** Das tatsächlich antwortende Modell (kann durch den Server-Fallback abweichen) */
  model: string;
};

/** Ein Aufruf gegen Claude: Text oder PDF hinein, geprüfte Struktur und Modell zurück */
export async function runAnthropic<S extends z.ZodType>(
  client: MessagesClient,
  request: AnthropicRequest<S>,
): Promise<AnthropicResult<S>> {
  const content = request.pdf
    ? [
        {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: request.pdf,
          },
        },
        { type: 'text' as const, text: request.user },
      ]
    : request.user;

  try {
    // Gestreamt: Längere Antworten (z. B. die Gesprächsvorbereitung) brauchen über eine
    // Minute – ohne laufenden Datenfluss brechen Server-Laufzeiten solche Anfragen ab
    const stream = client.beta.messages.stream({
      model: ANTHROPIC_MODEL,
      max_tokens: request.maxTokens,
      // Lehnt das Modell ab, springt serverseitig ein passendes Ersatzmodell ein
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: request.effort,
        format: betaZodOutputFormat(request.schema),
      },
      system: request.system,
      messages: [{ role: 'user', content }],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') throw new AiRefusalError();
    if (message.stop_reason === 'max_tokens' || !message.parsed_output) {
      throw new AiIncompleteError();
    }
    return { output: message.parsed_output as z.infer<S>, model: message.model };
  } catch (error) {
    // SDK-Fehler nicht nach außen tragen: Der Aufrufer kennt nur die provider-neutralen Fehler
    if (error instanceof Anthropic.APIError) throw new AiApiError(error.status);
    throw error;
  }
}

export function createAnthropicService(client: MessagesClient): AiService {
  return {
    async run<A extends AiAction>(
      action: A,
      input: z.infer<(typeof requestSchemas)[A]>,
    ): Promise<AiResponse<A>> {
      const { system, user } = PROMPTS[action](input);
      const { output } = await runAnthropic(client, {
        system,
        user,
        schema: responseSchemas[action],
        maxTokens: 16000,
        effort: EFFORT[action],
      });
      return output as AiResponse<A>;
    },
  };
}
