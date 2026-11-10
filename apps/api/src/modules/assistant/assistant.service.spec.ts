import 'reflect-metadata';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { AssistantService, trimHistory } from './assistant.service';
import { LLM_MAX_TOKENS, LLM_TEMPERATURE, MAX_TOOL_ROUNDS } from './assistant.constants';
import { SYSTEM_PROMPT } from './assistant.prompt';
import type { GeocodingService } from './geocoding.service';
import type { PropertiesService } from '../properties/properties.service';
import type { PropertySearchHit, PropertySearchResult } from '../properties/property-search.types';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const ENV: Record<string, string> = {
  AZURE_OPENAI_ENDPOINT: 'https://bh.openai.azure.com/',
  AZURE_OPENAI_KEY: 'k',
  AZURE_OPENAI_DEPLOYMENT: 'gpt-4.1-mini',
};

function config(env: Record<string, string> = ENV): ConfigService {
  return { get: (k: string) => env[k] } as unknown as ConfigService;
}

const HIT: PropertySearchHit = {
  id: 'p1',
  title: 'Oficina en Puerto Cancún',
  type: 'OFICINA',
  operation: 'RENTA',
  price: 45000,
  currency: 'MXN',
  area_m2: 102,
  bedrooms: null,
  bathrooms: 2,
  parking_spaces: 2,
  neighborhood: 'Puerto Cancún',
  city: 'Cancún',
  state: 'Quintana Roo',
  latitude: 21.15,
  longitude: -86.8,
  distance_km: 0.84,
  featured_image_url: 'https://cdn.example/x.jpg',
  url_path: '/propiedades/p1',
};

const RESULT: PropertySearchResult = { hits: [HIT], relaxed: false, relaxed_fields: [] };

function toolCallResponse(args: Record<string, unknown>, id = 'call_1') {
  return {
    choices: [
      {
        finish_reason: 'tool_calls',
        message: {
          content: null,
          tool_calls: [
            { id, type: 'function', function: { name: 'buscar_propiedades', arguments: JSON.stringify(args) } },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 1200, completion_tokens: 30, prompt_tokens_details: { cached_tokens: 1024 } },
  };
}

function textResponse(content: string) {
  return {
    choices: [{ finish_reason: 'stop', message: { content } }],
    usage: { prompt_tokens: 1400, completion_tokens: 60 },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Parsed body of the n-th fetch call. */
function requestBody(fetchMock: jest.SpyInstance, n: number) {
  return JSON.parse((fetchMock.mock.calls[n][1] as RequestInit).body as string);
}

function setup(env?: Record<string, string>) {
  const properties = { searchForAssistant: jest.fn().mockResolvedValue(RESULT) };
  const geocoder = { geocode: jest.fn().mockResolvedValue({ lat: 21.16, lng: -86.81 }) };
  const service = new AssistantService(
    config(env),
    properties as unknown as PropertiesService,
    geocoder as unknown as GeocodingService,
  );
  return { service, properties, geocoder };
}

const USER = [
  { role: 'user' as const, content: 'búscame una oficina de 100 m² cerca de Puerto Cancún con 2 baños' },
];

let fetchMock: jest.SpyInstance;

beforeEach(() => {
  fetchMock = jest.spyOn(global, 'fetch');
});
afterEach(() => {
  jest.restoreAllMocks();
});

/* ------------------------------------------------------------------ */

describe('AssistantService.chat — tool flow', () => {
  it('maps tool args to criteria, geocodes cerca_de into near and returns the hits', async () => {
    const { service, properties, geocoder } = setup();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          toolCallResponse({
            type: 'OFICINA',
            area_min: 80,
            area_max: 120,
            bathrooms_min: 2,
            cerca_de: 'Puerto Cancún',
          }),
        ),
      )
      .mockResolvedValueOnce(jsonResponse(textResponse('Encontré una oficina en Puerto Cancún por $45,000 MXN.')));

    const res = await service.chat(USER);

    expect(geocoder.geocode).toHaveBeenCalledWith('Puerto Cancún');
    expect(properties.searchForAssistant).toHaveBeenCalledWith({
      type: 'OFICINA',
      area_min: 80,
      area_max: 120,
      bathrooms_min: 2,
      limit: 5,
      near: { lat: 21.16, lng: -86.81, radius_km: 3 },
    });
    expect(res).toEqual({
      reply: 'Encontré una oficina en Puerto Cancún por $45,000 MXN.',
      properties: [HIT],
      relaxed: false,
    });
  });

  it('sends system prompt first, cost limits, and a compact tool result without image URLs', async () => {
    const { service } = setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(toolCallResponse({ type: 'OFICINA', cerca_de: 'Puerto Cancún' })))
      .mockResolvedValueOnce(jsonResponse(textResponse('Listo.')));

    await service.chat(USER);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe(
      'https://bh.openai.azure.com/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2025-01-01-preview',
    );
    const first = requestBody(fetchMock, 0);
    expect(first.messages[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT });
    expect(first.max_tokens).toBe(LLM_MAX_TOKENS);
    expect(first.temperature).toBe(LLM_TEMPERATURE);
    expect(first.tools[0].function.name).toBe('buscar_propiedades');
    expect(first.tools[0].function.parameters.properties.type.enum).toContain('OFICINA');
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeDefined();

    const second = requestBody(fetchMock, 1);
    const toolMsg = second.messages.find((m: { role: string }) => m.role === 'tool');
    expect(toolMsg.tool_call_id).toBe('call_1');
    expect(toolMsg.content).not.toContain('cdn.example');
    expect(toolMsg.content).not.toContain('/propiedades/');
    const payload = JSON.parse(toolMsg.content);
    expect(payload.resultados[0]).toMatchObject({
      id: 'p1',
      precio: '$45,000 MXN',
      m2: 102,
      banos: 2,
      distancia_km: 0.8,
    });
  });

  it('uses AZURE_OPENAI_ASSISTANT_DEPLOYMENT when set', async () => {
    const { service } = setup({ ...ENV, AZURE_OPENAI_ASSISTANT_DEPLOYMENT: 'asistente' });
    fetchMock.mockResolvedValueOnce(jsonResponse(textResponse('¿Qué tipo de inmueble buscas?')));
    await service.chat(USER);
    expect(fetchMock.mock.calls[0][0]).toContain('/deployments/asistente/');
  });

  it('answers without searching when the model asks a clarifying question', async () => {
    const { service, properties } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(textResponse('¿En qué zona y qué tipo de inmueble?')));
    const res = await service.chat([{ role: 'user', content: 'quiero algo bonito' }]);
    expect(properties.searchForAssistant).not.toHaveBeenCalled();
    expect(res).toEqual({ reply: '¿En qué zona y qué tipo de inmueble?', properties: [], relaxed: false });
  });

  it('propagates relaxed from the last search', async () => {
    const { service, properties } = setup();
    properties.searchForAssistant.mockResolvedValueOnce({ ...RESULT, relaxed: true, relaxed_fields: ['area'] });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(toolCallResponse({ type: 'OFICINA' })))
      .mockResolvedValueOnce(jsonResponse(textResponse('No encontré exacto, pero hay esto parecido.')));
    const res = await service.chat(USER);
    expect(res.relaxed).toBe(true);
    const tool = requestBody(fetchMock, 1).messages.find((m: { role: string }) => m.role === 'tool');
    expect(JSON.parse(tool.content)).toMatchObject({ relajado: true, se_flexibilizo: ['metros cuadrados (±20%)'] });
  });

  it('tells the model a hidden price is "a consultar"', async () => {
    const { service, properties } = setup();
    properties.searchForAssistant.mockResolvedValueOnce({
      ...RESULT,
      hits: [{ ...HIT, price: null, latitude: null, longitude: null, distance_km: null }],
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(toolCallResponse({ type: 'OFICINA' })))
      .mockResolvedValueOnce(jsonResponse(textResponse('Hay una con precio a consultar.')));
    await service.chat(USER);
    const tool = requestBody(fetchMock, 1).messages.find((m: { role: string }) => m.role === 'tool');
    const hit = JSON.parse(tool.content).resultados[0];
    expect(hit.precio).toBe('a consultar');
    expect(hit.ubicacion_oculta).toBe(true);
    expect(hit).not.toHaveProperty('distancia_km');
  });
});

describe('AssistantService.chat — geocode fallback', () => {
  it('passes the place as neighborhood text when geocoding fails', async () => {
    const { service, properties, geocoder } = setup();
    geocoder.geocode.mockResolvedValueOnce(null);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(toolCallResponse({ type: 'OFICINA', cerca_de: 'Puerto Cancún' })))
      .mockResolvedValueOnce(jsonResponse(textResponse('ok')));

    await service.chat(USER);

    const criteria = properties.searchForAssistant.mock.calls[0][0];
    expect(criteria.near).toBeUndefined();
    expect(criteria.neighborhood).toBe('Puerto Cancún');
    const tool = requestBody(fetchMock, 1).messages.find((m: { role: string }) => m.role === 'tool');
    expect(JSON.parse(tool.content).nota).toContain('Puerto Cancún');
  });

  it('keeps an explicit neighborhood and appends the place to keywords', async () => {
    const { service, geocoder } = setup();
    geocoder.geocode.mockResolvedValueOnce(null);
    const { criteria } = await service.buildCriteria(
      JSON.stringify({ neighborhood: 'Centro', cerca_de: 'Plaza Las Américas', keywords: 'vista' }),
    );
    expect(criteria).toMatchObject({ neighborhood: 'Centro', keywords: 'vista Plaza Las Américas' });
  });

  it('adds the city to the geocode query and honours radio_km', async () => {
    const { service, geocoder } = setup();
    const { criteria } = await service.buildCriteria(
      JSON.stringify({ city: 'Cancún', cerca_de: 'Malecón Tajamar', radio_km: 5 }),
    );
    expect(geocoder.geocode).toHaveBeenCalledWith('Malecón Tajamar, Cancún');
    expect(criteria.near).toEqual({ lat: 21.16, lng: -86.81, radius_km: 5 });
  });
});

describe('AssistantService.chat — max tool rounds', () => {
  it(`stops after ${MAX_TOOL_ROUNDS} tool rounds and forces a final answer`, async () => {
    const { service, properties } = setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(toolCallResponse({ type: 'OFICINA' }, 'a')))
      .mockResolvedValueOnce(jsonResponse(toolCallResponse({ type: 'LOCAL_COMERCIAL' }, 'b')))
      // Even if the model insists on a 3rd search, it is not executed.
      .mockResolvedValueOnce(jsonResponse(toolCallResponse({ type: 'BODEGA' }, 'c')));

    const res = await service.chat(USER);

    expect(fetchMock).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1);
    expect(properties.searchForAssistant).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    expect(requestBody(fetchMock, 0).tool_choice).toBe('auto');
    expect(requestBody(fetchMock, 1).tool_choice).toBe('auto');
    expect(requestBody(fetchMock, 2).tool_choice).toBe('none');
    expect(res.reply).toBeTruthy();
    expect(res.properties).toEqual([HIT]);
  });

  it('honours at most 2 tool calls per round', async () => {
    const { service, properties } = setup();
    const many = toolCallResponse({ type: 'CASA' });
    const message = many.choices[0]!.message;
    const call = message.tool_calls[0]!;
    message.tool_calls = [1, 2, 3, 4].map((i) => ({ ...call, id: `c${i}` }));
    fetchMock.mockResolvedValueOnce(jsonResponse(many)).mockResolvedValueOnce(jsonResponse(textResponse('ok')));
    await service.chat(USER);
    expect(properties.searchForAssistant).toHaveBeenCalledTimes(2);
  });
});

describe('AssistantService.chat — history and errors', () => {
  it('only sends the last 8 messages, each capped at 500 chars', async () => {
    const { service } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(textResponse('ok')));
    const messages = Array.from({ length: 15 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `m${i} ` + 'x'.repeat(700),
    }));

    await service.chat(messages);

    const sent = requestBody(fetchMock, 0).messages;
    expect(sent).toHaveLength(1 + 8);
    expect(sent[1].content.startsWith('m7 ')).toBe(true);
    expect(sent.slice(1).every((m: { content: string }) => m.content.length <= 500)).toBe(true);
  });

  it('trimHistory keeps order and roles', () => {
    expect(trimHistory([{ role: 'user', content: 'hola' }])).toEqual([{ role: 'user', content: 'hola' }]);
  });

  it('rejects a conversation whose last message is not from the user', async () => {
    const { service } = setup();
    await expect(service.chat([{ role: 'assistant', content: 'hola' }])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 503 when Azure OpenAI is not configured', async () => {
    const { service } = setup({});
    await expect(service.chat(USER)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 503 when the LLM fails or times out', async () => {
    const { service } = setup();
    fetchMock.mockRejectedValueOnce(new DOMException('The operation was aborted', 'TimeoutError'));
    await expect(service.chat(USER)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('turns an Azure content-filter rejection into a polite reply', async () => {
    const { service } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: 'content_filter' } }, 400));
    const res = await service.chat(USER);
    expect(res.reply).toContain('inmuebles');
    expect(res.properties).toEqual([]);
  });

  it('tells the model when the search itself fails instead of crashing', async () => {
    const { service, properties } = setup();
    properties.searchForAssistant.mockRejectedValueOnce(new Error('db down'));
    fetchMock
      .mockResolvedValueOnce(jsonResponse(toolCallResponse({ type: 'CASA' })))
      .mockResolvedValueOnce(jsonResponse(textResponse('No pude buscar ahora.')));
    const res = await service.chat(USER);
    const tool = requestBody(fetchMock, 1).messages.find((m: { role: string }) => m.role === 'tool');
    expect(JSON.parse(tool.content)).toEqual({ error: 'busqueda_no_disponible' });
    expect(res).toEqual({ reply: 'No pude buscar ahora.', properties: [], relaxed: false });
  });
});
