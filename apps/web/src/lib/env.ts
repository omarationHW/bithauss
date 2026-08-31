/**
 * Startup environment validation for the web server (BH-02).
 *
 * The audit found `SUPABASE_SERVICE_ROLE_KEY` and `BRC_VERIFY_SECRET` missing
 * from the production App Service. Nothing crashed: `createAdminClient()` threw
 * inside the request, the catch turned it into `NO_ENCONTRADO`, and *every*
 * certificate on the platform reported as non-existent. Nobody noticed because
 * the failure looked like ordinary application output.
 *
 * The lesson is that a misconfigured deployment must announce itself at boot,
 * not degrade into plausible-looking wrong answers.
 */

export interface EnvRequirement {
  name: string;
  /** What breaks without it — printed verbatim in the error. */
  why: string;
}

export const REQUIRED_WEB_ENV: EnvRequirement[] = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    why: "sin ella no hay sesión ni datos; la app arranca en blanco",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    why: "sin ella el cliente del navegador no puede autenticarse",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    why: "/api/verify/[id] no puede leer brc_certificates y TODO certificado responde NO_ENCONTRADO",
  },
  {
    name: "BRC_VERIFY_SECRET",
    why: "la respuesta de verificación pública no puede firmarse (generar con `openssl rand -hex 32`)",
  },
];

export class MissingEnvError extends Error {
  constructor(public readonly missing: EnvRequirement[]) {
    super(
      [
        "Faltan variables de entorno obligatorias. La aplicación web no puede arrancar.",
        "",
        ...missing.map((m) => `  - ${m.name}: ${m.why}`),
        "",
        "Cárgalas en el App Service (o en apps/web/.env.local para desarrollo).",
        "Ver docs/SECURITY.md, sección 4.1.",
      ].join("\n"),
    );
    this.name = "MissingEnvError";
  }
}

export interface AssertEnvOptions {
  env?: Record<string, string | undefined>;
  /** In production a missing variable throws; elsewhere it warns loudly. */
  isProduction?: boolean;
  requirements?: EnvRequirement[];
}

export function missingServerEnv(
  env: Record<string, string | undefined>,
  requirements: EnvRequirement[] = REQUIRED_WEB_ENV,
): EnvRequirement[] {
  return requirements.filter((req) => {
    const value = env[req.name];
    return value === undefined || value === null || String(value).trim() === "";
  });
}

/**
 * Throws in production, warns everywhere else.
 *
 * The asymmetry is deliberate: a developer running `next dev` without a
 * verification secret should still be able to work on unrelated screens, but a
 * production deployment in that state is silently serving wrong answers to the
 * one question the product exists to answer.
 */
export function assertServerEnv(options: AssertEnvOptions = {}): EnvRequirement[] {
  const env = options.env ?? process.env;
  const isProduction =
    options.isProduction ?? env.NODE_ENV === "production";
  const missing = missingServerEnv(env, options.requirements);

  if (missing.length === 0) return missing;

  const error = new MissingEnvError(missing);
  if (isProduction) throw error;

  // eslint-disable-next-line no-console
  console.warn(`[env] ${error.message}`);
  return missing;
}
