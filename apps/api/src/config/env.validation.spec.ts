import { validateEnv, MissingEnvError, REQUIRED_API_ENV } from './env.validation';

const complete = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  FRONTEND_URL: 'https://bithauss.com',
};

describe('validateEnv (BH-02)', () => {
  it('passes with every required variable present', () => {
    expect(() =>
      validateEnv({ ...complete, NODE_ENV: 'production' }),
    ).not.toThrow();
  });

  it('throws listing every missing variable at once', () => {
    try {
      validateEnv({ NODE_ENV: 'production' });
      fail('expected MissingEnvError');
    } catch (err) {
      expect(err).toBeInstanceOf(MissingEnvError);
      const missing = (err as MissingEnvError).missing.map((m) => m.name);
      expect(missing).toEqual(REQUIRED_API_ENV.map((r) => r.name));
      // The message has to be actionable, not just "invalid config".
      expect((err as Error).message).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
      expect((err as Error).message).toMatch(/docs\/SECURITY\.md/);
    }
  });

  it('treats an empty string as missing', () => {
    expect(() =>
      validateEnv({ ...complete, SUPABASE_SERVICE_ROLE_KEY: '   ' }),
    ).toThrow(MissingEnvError);
  });

  it('only demands FRONTEND_URL in production', () => {
    const withoutFrontend: Record<string, string> = { ...complete };
    delete withoutFrontend.FRONTEND_URL;
    expect(() => validateEnv({ ...withoutFrontend })).not.toThrow();
    expect(() =>
      validateEnv({ ...withoutFrontend, NODE_ENV: 'production' }),
    ).toThrow(MissingEnvError);
  });
});
