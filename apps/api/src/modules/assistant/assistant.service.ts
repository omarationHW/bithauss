import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  CHAT_API_VERSION,
  LLM_MAX_TOKENS,
  LLM_TEMPERATURE,
  LLM_TIMEOUT_MS,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_CHARS,
  MAX_TOOL_CALLS_PER_ROUND,
  MAX_TOOL_ROUNDS,
} from './assistant.constants';
import type { ChatMessageDto, ChatResponse } from './assistant.dto';
import {
  SEARCH_TOOL,
  SEARCH_TOOL_NAME,
  SYSTEM_PROMPT,
  compactSearchResult,
  parseSearchArgs,
} from './assistant.prompt';
import { GeocodingService } from './geocoding.service';
import { PropertiesService } from '../properties/properties.service';
import type {
  PropertySearchCriteria,
  PropertySearchHit,
  PropertySearchResult,
} from '../properties/property-search.types';

/* ------------------------------------------------------------------ */
/*  OpenAI wire types (only what we read/write)                        */
/* ------------------------------------------------------------------ */

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

type LlmMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

interface LlmUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

interface LlmResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null; tool_calls?: ToolCall[] };
  }>;
  usage?: LlmUsage;
}

const UNAVAILABLE = 'El asistente no está disponible en este momento. Intenta de nuevo en unos minutos.';
const FILTERED_REPLY =
  'Solo puedo ayudarte a buscar inmuebles en BitHauss. ¿Qué tipo de propiedad y en qué zona te interesa?';
const EMPTY_REPLY = 'No pude generar una respuesta. ¿Me cuentas qué tipo de inmueble y en qué zona buscas?';

/** Keeps only the tail of the conversation, each message capped. */
export function trimHistory(messages: ChatMessageDto[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, MAX_MESSAGE_CHARS) }));
}

/** For logs only — never log full user text. */
function preview(text: string, max = 60): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

class ContentFilteredError extends Error {}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly deployment: string;

  constructor(
    private readonly config: ConfigService,
    private readonly properties: PropertiesService,
    private readonly geocoder: GeocodingService,
  ) {
    this.endpoint = (this.config.get<string>('AZURE_OPENAI_ENDPOINT') ?? '').replace(/\/+$/, '');
    this.apiKey = this.config.get<string>('AZURE_OPENAI_KEY') ?? '';
    this.deployment =
      this.config.get<string>('AZURE_OPENAI_ASSISTANT_DEPLOYMENT') ||
      this.config.get<string>('AZURE_OPENAI_DEPLOYMENT') ||
      'gpt-4.1-mini';
  }

  async chat(messages: ChatMessageDto[]): Promise<ChatResponse> {
    if (!this.endpoint || !this.apiKey) {
      throw new ServiceUnavailableException(
        'El asistente no está configurado (faltan AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_KEY).',
      );
    }

    const history = trimHistory(messages);
    const last = history[history.length - 1];
    if (!last || last.role !== 'user') {
      throw new BadRequestException('El último mensaje debe ser del usuario.');
    }

    const convo: LlmMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history];
    const usage = { calls: 0, prompt: 0, completion: 0, cached: 0 };
    let lastSearch: PropertySearchResult | null = null;
    let reply = '';

    this.logger.debug(`chat: ${history.length} msgs, último="${preview(last.content)}"`);

    try {
      for (let round = 0; ; round++) {
        // Once the tool budget is spent the model is told it may not search.
        const toolsAllowed = round < MAX_TOOL_ROUNDS;
        const res = await this.complete(convo, toolsAllowed);
        usage.calls++;
        usage.prompt += res.usage?.prompt_tokens ?? 0;
        usage.completion += res.usage?.completion_tokens ?? 0;
        usage.cached += res.usage?.prompt_tokens_details?.cached_tokens ?? 0;

        const message = res.choices?.[0]?.message;
        const toolCalls = (message?.tool_calls ?? []).filter((c) => c?.type === 'function');

        if (toolCalls.length === 0 || !toolsAllowed) {
          reply = (message?.content ?? '').trim();
          break;
        }

        const honoured = toolCalls.slice(0, MAX_TOOL_CALLS_PER_ROUND);
        convo.push({ role: 'assistant', content: message?.content ?? null, tool_calls: honoured });
        for (const call of honoured) {
          const { content, result } = await this.runTool(call);
          if (result) lastSearch = result;
          convo.push({ role: 'tool', tool_call_id: call.id, content });
        }
      }
    } catch (err) {
      if (err instanceof ContentFilteredError) {
        reply = FILTERED_REPLY;
      } else {
        this.logger.error(`chat falló: ${(err as Error).message}`);
        throw new ServiceUnavailableException(UNAVAILABLE);
      }
    } finally {
      this.logger.log(
        `assistant usage deployment=${this.deployment} calls=${usage.calls} ` +
          `prompt=${usage.prompt} cached=${usage.cached} completion=${usage.completion} ` +
          `hits=${lastSearch?.hits.length ?? 0}`,
      );
    }

    return {
      reply: reply || EMPTY_REPLY,
      properties: (lastSearch?.hits ?? []) as PropertySearchHit[],
      relaxed: lastSearch?.relaxed ?? false,
    };
  }

  /* ---------------------------------------------------------------- */

  private async runTool(
    call: ToolCall,
  ): Promise<{ content: string; result: PropertySearchResult | null }> {
    if (call.function?.name !== SEARCH_TOOL_NAME) {
      return { content: JSON.stringify({ error: 'herramienta_desconocida' }), result: null };
    }

    const { criteria, note } = await this.buildCriteria(call.function.arguments);
    try {
      const result = await this.properties.searchForAssistant(criteria);
      return { content: compactSearchResult(result, note), result };
    } catch (err) {
      this.logger.error(`searchForAssistant falló: ${(err as Error).message}`);
      return {
        content: JSON.stringify({ error: 'busqueda_no_disponible' }),
        result: null,
      };
    }
  }

  /** Tool args → contract criteria, geocoding `cerca_de` into `near`. */
  async buildCriteria(
    rawArgs: string | undefined,
  ): Promise<{ criteria: PropertySearchCriteria; note?: string }> {
    const { criteria, cercaDe, radioKm } = parseSearchArgs(rawArgs);
    if (!cercaDe) return { criteria };

    // The city disambiguates homonyms ("Centro", "Zona Hotelera").
    const query =
      criteria.city && !cercaDe.toLowerCase().includes(criteria.city.toLowerCase())
        ? `${cercaDe}, ${criteria.city}`
        : cercaDe;
    const point = await this.geocoder.geocode(query);
    if (point) {
      return { criteria: { ...criteria, near: { lat: point.lat, lng: point.lng, radius_km: radioKm } } };
    }

    // Could not place it on the map: search the name as text instead.
    const fallback = { ...criteria };
    if (!fallback.neighborhood) fallback.neighborhood = cercaDe;
    else fallback.keywords = [fallback.keywords, cercaDe].filter(Boolean).join(' ');
    return {
      criteria: fallback,
      note: `No se pudo ubicar "${cercaDe}" en el mapa; se buscó por nombre de zona.`,
    };
  }

  private async complete(messages: LlmMessage[], toolsAllowed: boolean): Promise<LlmResponse> {
    const url =
      `${this.endpoint}/openai/deployments/${encodeURIComponent(this.deployment)}` +
      `/chat/completions?api-version=${CHAT_API_VERSION}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        // Tools stay in the request even when disallowed so the cached prefix
        // (system + tools) is identical on every call.
        tools: [SEARCH_TOOL],
        tool_choice: toolsAllowed ? 'auto' : 'none',
        temperature: LLM_TEMPERATURE,
        max_tokens: LLM_MAX_TOKENS,
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      // Azure's content filter (jailbreaks, abuse) answers 400 content_filter:
      // that is a user problem, not an outage.
      if (response.status === 400 && body.includes('content_filter')) {
        throw new ContentFilteredError('content_filter');
      }
      throw new Error(`Azure OpenAI ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as LlmResponse;
    if (data.choices?.[0]?.finish_reason === 'content_filter') {
      throw new ContentFilteredError('content_filter');
    }
    return data;
  }
}
