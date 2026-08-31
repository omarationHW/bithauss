/**
 * Fail-fast environment validation (BH-02).
 *
 * The audit found two variables missing from the production App Service. The
 * symptom was not a crash but silent degradation: `createAdminClient()` threw
 * deep inside a request, the catch turned it into "NO_ENCONTRADO", and every
 * certificate looked invalid. A service that boots into a broken state is far
 * worse than one that refuses to boot, so every required variable is checked
 * once, up front, and reported together.
 *
 * Wire it into `ConfigModule.forRoot({ validate: validateEnv })`.
 */

export interface EnvRequirement {
  name: string;
  /** Why the process cannot work without it — printed in the error. */
  why: string;
  /** When true the variable is only required with NODE_ENV=production. */
  productionOnly?: boolean;
}

export const REQUIRED_API_ENV: EnvRequirement[] = [
  {
    name: 'SUPABASE_URL',
    why: 'sin ella no hay base de datos: todas las consultas fallan',
  },
  {
    name: 'SUPABASE_ANON_KEY',
    why: 'necesaria para crear clientes por usuario que respetan RLS',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    why: 'necesaria para validar el JWT y leer profiles en los guards',
  },
  {
    name: 'FRONTEND_URL',
    why: 'la allowlist de CORS falla cerrada sin ella',
    productionOnly: true,
  },
];

export class MissingEnvError extends Error {
  constructor(public readonly missing: EnvRequirement[]) {
    super(
      [
        'Faltan variables de entorno obligatorias. La API no puede arrancar.',
        '',
        ...missing.map((m) => `  - ${m.name}: ${m.why}`),
        '',
        'Cárgalas en el App Service (o en apps/api/.env para desarrollo local).',
        'Ver docs/SECURITY.md, sección 4.1.',
      ].join('\n'),
    );
    this.name = 'MissingEnvError';
  }
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

/**
 * @nestjs/config calls this with the merged env (process.env + dotenv files)
 * and expects the validated config back.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const isProduction = String(config.NODE_ENV ?? '') === 'production';

  const missing = REQUIRED_API_ENV.filter((req) => {
    if (req.productionOnly && !isProduction) return false;
    return isBlank(config[req.name]);
  });

  if (missing.length > 0) {
    throw new MissingEnvError(missing);
  }

  return config;
}
