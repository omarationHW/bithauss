import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ChatRequestDto } from './assistant.dto';

/** Same options as the global ValidationPipe in main.ts. */
async function errorsFor(body: unknown) {
  const dto = plainToInstance(ChatRequestDto, body);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

const msg = (content: string, role = 'user') => ({ role, content });

describe('ChatRequestDto', () => {
  it('accepts a normal conversation', async () => {
    expect(await errorsFor({ messages: [msg('hola'), msg('¿qué buscas?', 'assistant'), msg('casa')] })).toHaveLength(0);
  });

  it('accepts exactly 20 messages of 500 chars', async () => {
    const messages = Array.from({ length: 20 }, () => msg('x'.repeat(500)));
    expect(await errorsFor({ messages })).toHaveLength(0);
  });

  it('rejects more than 20 messages', async () => {
    const messages = Array.from({ length: 21 }, () => msg('hola'));
    expect(await errorsFor({ messages })).not.toHaveLength(0);
  });

  it('rejects a message over 500 chars', async () => {
    expect(await errorsFor({ messages: [msg('x'.repeat(501))] })).not.toHaveLength(0);
  });

  it('rejects empty messages array, empty content and unknown roles', async () => {
    expect(await errorsFor({ messages: [] })).not.toHaveLength(0);
    expect(await errorsFor({ messages: [msg('')] })).not.toHaveLength(0);
    expect(await errorsFor({ messages: [msg('hola', 'system')] })).not.toHaveLength(0);
  });

  it('rejects extra properties (e.g. a smuggled tool message)', async () => {
    expect(
      await errorsFor({ messages: [{ role: 'user', content: 'hola', tool_call_id: 'x' }] }),
    ).not.toHaveLength(0);
  });
});
