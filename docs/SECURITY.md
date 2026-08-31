# BitHauss — Auditoría de seguridad y plan de endurecimiento

- **Fecha:** 31 de agosto de 2026
- **Alcance:** monorepo completo (`apps/web`, `apps/api`, `packages/supabase`, `packages/validators`, `.github/workflows`) en la rama `main`, commit `40a26cc`.
- **Modo:** revisión estática de código y de migraciones SQL. **No** se ejecutó pentest, ni se inspeccionó la configuración real de Supabase Cloud, Azure App Service o Azure Front Door. Todo lo que dependa del entorno desplegado está marcado como **[PENDIENTE PROD]** con el comando exacto para comprobarlo.
- **Nota de contexto:** durante la auditoría había cuatro agentes modificando código en paralelo (BRC/notarial, pagos Stripe, propiedades, membresías). Varios archivos estaban en estado intermedio; se auditó lo que existía y se dejó el checklist obligatorio para lo que aún no existe (módulo de pagos).

---

## 1. Resumen ejecutivo

La plataforma tiene una base de seguridad **mejor que la media** para un producto en esta etapa: RLS está habilitado en todas las tablas de negocio, la migración `003_security_hardening.sql` cerró correctamente las políticas permisivas iniciales, existen funciones `SECURITY DEFINER` con `search_path` fijo, el `service_role` nunca se expone al navegador, hay CSP y cabeceras de seguridad definidas en `next.config.ts`, CORS es una allowlist que falla cerrado, las mutaciones sensibles del BRC pasan por la API con verificación de asignación real al expediente, y el módulo de pagos con Stripe —incorporado durante la propia auditoría— llegó ya con firma de webhook verificada en tiempo constante, protección de replay, idempotencia por índice único y monto calculado íntegramente en servidor. El equipo ya documentó y corrigió hallazgos previos dentro de las propias migraciones, lo cual es una señal de madurez.

Dicho eso, **la plataforma no está lista para producción**. Hay tres problemas que rompen la promesa central del producto: cualquier persona puede auto-asignarse el rol `NOTARIO` en el formulario de registro; el secreto que firma la verificación pública del certificado tiene un valor por defecto escrito en el repositorio y no se configura en el despliegue; y el certificado BRC no está firmado criptográficamente — el campo de firma dice literalmente `[PENDIENTE-FIRMA-PKI]` y el folio se genera con `Math.random()` en el navegador del notario. A eso se suma que el flag `is_active` no se aplica en ningún punto del sistema (desactivar a un usuario no hace nada), que el solicitante de un expediente puede insertar filas de documentos ya marcadas como `VALIDADO`, y que el endpoint público de propiedades usa la llave de servicio con `select('*')` sin filtrar estado ni campos.

En resumen: el **perímetro** (RLS, guards, CSP, CORS) está bien construido; la **lógica de confianza del producto** (quién es notario, qué hace válido a un BRC, quién puede marcar un documento como aprobado) todavía no lo está.

### Top 5 de riesgos

| # | Riesgo | Severidad |
|---|---|---|
| 1 | **BH-01** — Cualquiera se registra como `NOTARIO`: el rol viaja desde el navegador y la política RLS lo permite | Crítica |
| 2 | **BH-02** — `BRC_VERIFY_SECRET` con valor por defecto en el repositorio y ausente en `deploy.yml`: la firma de verificación es falsificable | Crítica |
| 3 | **BH-03** — El BRC no está firmado (`sig: "[PENDIENTE-FIRMA-PKI]"`) y el folio se genera con `Math.random()` en el cliente | Crítica |
| 4 | **BH-04** — `is_active` nunca se evalúa: desactivar una cuenta no la desactiva | Alta |
| 5 | **BH-05** — El solicitante puede insertar documentos de su expediente con `status = 'VALIDADO'` | Alta |

### Conteo de hallazgos

| Severidad | Cantidad |
|---|---|
| Crítica | 3 |
| Alta | 9 |
| Media | 11 |
| Baja | 7 |
| **Total** | **30** |

### Áreas que están bien y no requieren acción

Para que la lista de hallazgos no se lea como si todo estuviera mal, conviene dejar constancia de lo que se revisó y está correcto:

- **Validación del JWT en la API**: `apps/api/src/common/guards/auth.guard.ts:41-49` valida el token contra Supabase (`auth.getUser(token)`), no lo decodifica localmente. Expiración y revocación quedan en manos de Supabase, que es lo correcto.
- **RBAC servidor**: `apps/api/src/common/guards/roles.guard.ts:41-58` lee el rol de la tabla `profiles`, **nunca** de `user_metadata`, y lo comenta explícitamente. Es la decisión correcta.
- **`service_role` jamás en el cliente**: sólo se usa en `apps/api/src/config/supabase.config.ts:17` y `apps/web/src/lib/supabase/admin.ts:16` (rutas de servidor). No hay ninguna variable `NEXT_PUBLIC_*` que contenga un secreto (verificado por inventario completo de `process.env` en `apps/web/src`).
- **CORS**: `apps/api/src/main.ts:50-63` es una allowlist explícita que lanza excepción si `FRONTEND_URL` no está definido en producción. No hay `origin: '*'` ni reflejo del `Origin`.
- **Protección de rutas en servidor**: `apps/web/src/middleware.ts` + `apps/web/src/lib/supabase/middleware.ts:52-59` protegen `/dashboard` y `/admin`; además `apps/web/src/app/admin/layout.tsx:19-27` y `apps/web/src/app/dashboard/admin/layout.tsx:18-26` re-verifican el rol contra la base de datos en un Server Component. No es sólo protección de cliente.
- **`audit_logs` append-only**: `packages/supabase/migrations/010_history_audit.sql:265-278` no crea políticas de escritura y además revoca `insert, update, delete, truncate` a `anon` y `authenticated`. Correcto y bien argumentado.
- **Full-text search**: `apps/api/src/modules/properties/properties.service.ts:284-292` normaliza y usa `websearch_to_tsquery` vía `textSearch`. No hay concatenación de SQL en ninguna migración ni `execute format(...)` dinámico.
- **`dangerouslySetInnerHTML`**: hay un único uso, `apps/web/src/app/certificado/[id]/oficio/page.tsx:634`, y el HTML proviene de `buildStegoWatermarkSvg(seed)` (`apps/web/src/lib/cert-security.ts:109-119`), que es SVG generado determinísticamente sin ninguna entrada de usuario. **No es un XSS.**
- **Proxy de imágenes**: `apps/web/src/app/api/proxy-image/route.ts:40` valida protocolo `https:` y allowlist de hosts. No es un SSRF abierto.
- **Fijación de sesión**: Supabase rota tokens en cada `signInWithPassword`; el flag `bh_remember` (`apps/web/src/lib/supabase/client.ts:39-62`) sólo controla persistencia de cookie, no la identidad de la sesión. No hay riesgo de fijación.
- **Artefactos pesados**: `deploy.zip` (48 MB) y los dos PDF de la raíz **no están versionados** (`git check-ignore` confirma `.gitignore:58-59`) y el ZIP contiene 8 192 archivos que son `node_modules` + `apps/web/package.json`. **No contiene ningún `.env`, `.pem`, `.key` ni credencial** (verificado con `unzip -l`). Es higiene de repositorio, no una fuga.
- **Secretos en el repositorio**: `git ls-files` sólo devuelve `apps/api/.env.example` y `apps/web/.env.local.example`, ambos con placeholders. Los `.env` reales existen en el disco local del desarrollador pero están correctamente ignorados y **nunca fueron commiteados** (`git log --all -- "*.env"` vacío).

---

## 2. Hallazgos

### 2.1 Tabla resumen

> **Estado actualizado el 31 de agosto de 2026** tras la pasada de remediación.
> El detalle de qué se cambió y qué queda abierto está en la **sección 7 —
> Estado de remediación**, al final del documento.

| ID | Título | Severidad | Área | Estado |
|---|---|---|---|---|
| BH-01 | Auto-asignación del rol `NOTARIO` en el registro | Crítica | AuthZ / RLS | **CERRADO** |
| BH-02 | `BRC_VERIFY_SECRET` con fallback en el repo y ausente en el despliegue | Crítica | Secretos / Verificación pública | **CERRADO (código) · [PENDIENTE PROD] cargar el secreto** |
| BH-03 | El BRC no está firmado y el folio se genera con `Math.random()` en el cliente | Crítica | Integridad del certificado | **MITIGADO** (folio y QR corregidos; firma PKI pendiente) |
| BH-04 | `is_active` no se aplica en ningún punto del sistema | Alta | AuthN / AuthZ | **CERRADO** |
| BH-05 | El solicitante puede insertar documentos con `status = 'VALIDADO'` | Alta | RLS | **CERRADO** (otro agente) |
| BH-06 | `GET /properties/:id` público con `service_role` y `select('*')` | Alta | IDOR / Exposición | PENDIENTE (módulo `properties`, otro dueño) |
| BH-07 | Subida directa a Storage sin validación de tipo ni tamaño en servidor | Alta | Archivos | PENDIENTE · [PENDIENTE PROD] |
| BH-08 | `next@15.5.18`: 3 vulnerabilidades altas, incluida SSRF en `rewrites` | Alta | Dependencias | **MITIGADO** (allowlist del rewrite); actualizar Next sigue pendiente |
| BH-09 | La verificación pública del BRC filtra `owner_id`, dirección y precio | Alta | Privacidad | **CERRADO** |
| BH-10 | Rate limiting en memoria, no distribuido, y con `X-Forwarded-For` falsificable | Alta | Abuso | **MITIGADO** (bypass de cabecera cerrado, límites aplicados); falta almacén distribuido y captcha en leads |
| BH-11 | CSP con `'unsafe-inline'` y `'unsafe-eval'` en `script-src` | Media | XSS / Headers | **MITIGADO** (`unsafe-eval` fuera en producción); nonces pendientes |
| BH-12 | `@bithauss/validators` (Zod) nunca se usa; el navegador escribe directo a Postgres | Media | Validación | **MITIGADO** (invariantes de columna en `leads`); Zod en frontera pendiente |
| BH-13 | Políticas de Storage de `avatars` y `properties` fuera de las migraciones | Media | Storage | PENDIENTE · [PENDIENTE PROD] |
| BH-14 | Endpoint OCR sin `@Roles`: abuso de cuota Azure por cualquier usuario | Media | Abuso / Coste | **MITIGADO** (`@Roles` aplicado); cuota por cuenta pendiente |
| BH-15 | `certifyExpediente` sin validación de estado ni idempotencia | Media | Lógica de negocio | PENDIENTE (módulo `brc`, otro dueño) |
| BH-16 | `AuditLogInterceptor` es código muerto: la API no tiene pista de auditoría | Media | Auditoría | **MITIGADO** (interceptor ampliado); falta registrarlo en `app.module.ts` |
| BH-17 | Sentry sin `beforeSend` y con Session Replay activado en el cliente | Media | Privacidad / LFPDPPP | **CERRADO (código)** · [PENDIENTE PROD] scrubbing y retención en el panel |
| BH-18 | CI/CD sin `permissions`, sin secret scanning, SAST ni `pnpm audit` | Media | Supply chain | **MITIGADO** (`permissions`, `pnpm audit`, Gitleaks); OIDC, pin por SHA y CodeQL pendientes |
| BH-19 | RLS de `properties` permite publicar sin pasar por la API | Media | Lógica de negocio | PENDIENTE (módulo `properties`, otro dueño) |
| BH-20 | El borrado de cuenta no elimina los objetos de Storage | Media | LFPDPPP | PENDIENTE (requiere política de retención escrita) |
| BH-21 | Enumeración de cuentas en el registro | Baja | AuthN | **CERRADO** |
| BH-22 | Contraseña mínima de 6 caracteres | Baja | AuthN | **MITIGADO** (mínimo 12); HIBP y MFA pendientes |
| BH-23 | `file_url` / `pdf_url` guardan `getPublicUrl()` de un bucket privado | Baja | Storage | PENDIENTE (deuda técnica) |
| BH-24 | `OPERADOR_BRC` puede ver perfiles de expedientes ajenos | Baja | RLS | **CERRADO** |
| BH-25 | CORS acepta peticiones sin cabecera `Origin` | Baja | CORS | Sin acción en código · [PENDIENTE PROD] |
| BH-26 | `deploy.zip` de 48 MB y PDF en el árbol de trabajo | Baja | Higiene | PENDIENTE (acción humana) |
| BH-27 | No existe la ruta `/privacidad` que el aviso referencia; sin política de retención | Baja | LFPDPPP | PENDIENTE (Legal) |
| BH-28 | Sesión de Checkout antigua sigue válida tras recotizar; el webhook no verifica el importe | Alta | Pagos | Asignado al agente de pagos |
| BH-29 | `checkout.session.completed` acredita sin comprobar `payment_status` (OXXO/SPEI) | Alta | Pagos | Asignado al agente de pagos |
| BH-30 | El payload completo de Stripe (con PII) se guarda indefinidamente | Media | Pagos / LFPDPPP | Asignado al agente de pagos |
| BH-31 | `PaymentsModule` y `MembershipsModule` no registrados en `app.module.ts` | Media | Pagos | PENDIENTE (cableado en `app.module.ts`) |

---

### 2.2 Detalle

---

#### BH-01 · Auto-asignación del rol `NOTARIO` en el registro — **CRÍTICA**

> **ESTADO: CERRADO (31-ago-2026).** Se separó el rol *auto-asignable* del rol
> *otorgado*, en las tres capas:
> - **RLS** — `packages/supabase/migrations/031_security_rbac_hardening.sql`:
>   la política de `insert` de `profiles` sólo acepta
>   `COMPRADOR | VENDEDOR | INMOBILIARIA | BROKER` (helper
>   `public.is_self_assignable_role`). La política de `update` propio ahora
>   también congela `is_active`, no sólo `role`.
> - **Registro (web)** — `apps/web/src/lib/auth-roles.ts` +
>   `apps/web/src/app/auth/registro/page.tsx`: elegir "Notario" crea una
>   **solicitud** (fila en `notary_profiles` con `is_verified = false`) y el
>   perfil nace con el rol por defecto. El rol ya no viaja en `user_metadata`
>   (se guarda como `signup_role_request`, que ninguna capa de autorización
>   lee). `apps/web/src/app/auth/callback/route.ts` fija `'COMPRADOR'` en
>   servidor y comprueba el error del `insert`.
> - **API** — `apps/api/src/common/guards/roles.guard.ts` exige
>   `notary_profiles.is_verified = true` cuando el rol efectivo es `NOTARIO`;
>   `apps/api/src/modules/profiles/profiles.service.ts` rechaza que un usuario
>   escriba `role`/`is_active`/`kyc_status`/`company_id` sobre sí mismo;
>   `apps/api/src/modules/admin/admin.service.ts` impide que un admin cambie su
>   propio rol, exige notaría verificada para otorgar `NOTARIO`, promueve el
>   rol al verificar y rechaza asignar notarios no verificados a un expediente.
>
> **Migración de datos (requiere revisión humana).** La migración conserva el
> acceso de los notarios preexistentes (`is_verified = true` con
> `verification_note` que dice explícitamente que fue automático) para no dejar
> fuera en silencio a nadie, y emite un `raise notice` con el inventario
> completo de cuentas privilegiadas. **Un administrador debe revisar esa lista
> una por una antes del lanzamiento** y revocar lo que no corresponda:
> ```sql
> update notary_profiles set is_verified = false where profile_id = '<uuid>';
> update profiles set role = 'COMPRADOR' where id = '<uuid>';
> ```
> Los perfiles con rol `NOTARIO` **sin** ficha notarial reciben una fila
> `PENDIENTE` sin verificar: quedarán bloqueados por el guard hasta que un
> admin capture y verifique sus datos, que es el comportamiento correcto.


**Impacto: alto · Explotabilidad: trivial.** No requiere herramientas: basta con elegir "Notario" en el formulario público de registro.

**Evidencia**

- `apps/web/src/app/auth/registro/page.tsx:223` — el rol elegido en el navegador viaja a `signUp` como `user_metadata`:
  ```ts
  data: { first_name: ..., last_name: ..., phone, role: selectedRole.toUpperCase() }
  ```
- `apps/web/src/app/auth/registro/page.tsx:265` — el mismo valor se inserta directamente en `profiles.role` desde el navegador con la llave anónima.
- `packages/supabase/migrations/003_security_hardening.sql:125-131` — la política lo autoriza:
  ```sql
  create policy "Users can insert own profile (no privileged role)"
    on profiles for insert to authenticated
    with check (auth.uid() = id
      and role in ('COMPRADOR','VENDEDOR','INMOBILIARIA','BROKER','NOTARIO'));
  ```
- `apps/web/src/app/auth/callback/route.ts:28` — el flujo OAuth repite el error, tomando el rol de `user_metadata` (que el usuario puede reescribir en cualquier momento con `supabase.auth.updateUser({ data: { role: 'NOTARIO' } })`). Además usa `"comprador"` en minúsculas, valor que el enum `user_role` (`packages/supabase/migrations/001_initial_schema.sql:20-23`) no acepta, por lo que ese `insert` falla en silencio (no se comprueba el error).

**Escenario de ataque**

Una persona sin ninguna relación con una notaría abre `/auth/registro`, selecciona "Notario", escribe un número de notaría inventado y un estado, y queda con `profiles.role = 'NOTARIO'` **de inmediato**, sin que ningún administrador verifique nada. `notary_profiles.is_verified` existe (`admin.service.ts:75-90`) pero **ningún guard ni política lo consulta**. Con ese rol pasa el `RolesGuard` de todos los endpoints `@Roles('NOTARIO', ...)` de `apps/api/src/modules/brc/brc.controller.ts`. La contención real es `BrcService.assertNotaryOnExpediente` (`apps/api/src/modules/brc/brc.service.ts:43-66`), que exige estar asignado al expediente — pero eso es una única capa, y basta con que un administrador se equivoque una vez en la pantalla de asignación (`/dashboard/admin/asignaciones`, que lista a todos los `NOTARIO` sin filtrar por `is_verified`) para que un impostor pueda aprobar documentos legales y emitir un certificado BRC. En un producto cuyo valor es "este inmueble está jurídicamente verificado por un notario", esto es la falla más grave del sistema.

**Remediación**

1. Quitar `NOTARIO` de la política de auto-registro:
   ```sql
   -- nueva migración 025_role_selfassign_hardening.sql
   drop policy if exists "Users can insert own profile (no privileged role)" on profiles;
   create policy "Users can insert own profile (no privileged role)"
     on profiles for insert to authenticated
     with check (auth.uid() = id
       and role in ('COMPRADOR','VENDEDOR','INMOBILIARIA','BROKER'));
   ```
2. Convertir el alta de notario en una solicitud: el registro crea el perfil como `VENDEDOR` (o un rol neutro) y una fila en `notary_profiles` con `is_verified = false`; un `ADMIN` promueve a `NOTARIO` con `PATCH /api/v1/admin/users/:id/role` (que ya existe y está bien protegido).
3. En `RolesGuard`, cuando el rol requerido incluya `NOTARIO`, exigir además `notary_profiles.is_verified = true`.
4. En `apps/web/src/app/auth/callback/route.ts:28`, no leer nunca el rol de `user_metadata`: fijar el rol por defecto en el servidor (`'COMPRADOR'`, en mayúsculas) y comprobar el error del `insert`.
5. **Auditar la base de datos actual antes de desplegar:**
   ```sql
   select p.id, p.email, p.role, np.is_verified, p.created_at
     from profiles p left join notary_profiles np on np.profile_id = p.id
    where p.role in ('NOTARIO','OPERADOR_BRC','ADMIN')
    order by p.created_at desc;
   ```

---

#### BH-02 · `BRC_VERIFY_SECRET` con fallback en el repositorio y ausente en el despliegue — **CRÍTICA**

> **ESTADO: CERRADO en código · [PENDIENTE PROD] cargar los secretos.**
> - `apps/web/src/app/api/verify/[id]/route.ts`: se eliminó el fallback;
>   `requireSigningKey()` lanza si falta la variable y el endpoint responde
>   **500 con mensaje explícito**, no `NO_ENCONTRADO` — reportar un fallo de
>   configuración como "ese certificado no existe" es exactamente lo que
>   mantuvo invisible este hallazgo.
> - `apps/web/src/lib/env.ts` + `apps/web/instrumentation.ts`: validación de
>   entorno al arranque que lista **todas** las variables obligatorias y falla
>   en duro en producción (se omite durante `next build`, donde los secretos de
>   runtime legítimamente no existen).
> - `apps/api/src/config/env.validation.ts`: equivalente para la API. **Falta
>   cablearlo**: `ConfigModule.forRoot({ ..., validate: validateEnv })`.
> - `.github/workflows/deploy.yml`: se añaden `SUPABASE_SERVICE_ROLE_KEY`,
>   `BRC_VERIFY_SECRET`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `API_URL` y
>   `RATE_LIMIT_PROXY_DEPTH` a `bithauss-web`, y `STRIPE_*` + `SENTRY_DSN` a
>   `bithauss-api`, **siempre como referencias a secretos de GitHub**. Un paso
>   previo aborta el despliegue si alguno de los dos secretos críticos está
>   vacío.
> - Documentado en `apps/web/.env.local.example` y `apps/api/.env.example`.
>
> **Acción humana:** generar `openssl rand -hex 32`, cargarlo como secreto de
> GitHub `BRC_VERIFY_SECRET`, y cargar `SUPABASE_SERVICE_ROLE_KEY` (rotado, ver
> 4.2). El valor `dev-only-brc-verify-secret-rotate-in-prod` debe considerarse
> **quemado** y no reutilizarse jamás.


**Impacto: alto · Explotabilidad: trivial.** El secreto está publicado en el propio código fuente.

**Evidencia**

- `apps/web/src/app/api/verify/[id]/route.ts:12-15`:
  ```ts
  const SIGNING_KEY =
    process.env.BRC_VERIFY_SECRET ??
    // Dev fallback — DO NOT rely on this in production.
    "dev-only-brc-verify-secret-rotate-in-prod";
  ```
- `.github/workflows/deploy.yml:41-52` — el bloque `az webapp config appsettings set` de `bithauss-web` define únicamente `SCM_DO_BUILD_DURING_DEPLOYMENT`, `WEBSITES_PORT`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_API_URL`. **`BRC_VERIFY_SECRET` no aparece.** Tampoco `SUPABASE_SERVICE_ROLE_KEY`, que `createAdminClient()` (`apps/web/src/lib/supabase/admin.ts:10-15`) necesita para que la verificación funcione.

**Escenario de ataque**

Dos consecuencias, ambas malas:

1. **Firma falsificable.** Cualquiera que lea el repositorio (o el bundle) conoce la clave HMAC y puede generar una respuesta de verificación con `"valid": true` y una `signature` que valida. Si un tercero — un banco, un comprador, un portal — llega a consumir `/api/verify/:id` y a confiar en el campo `signature`, la firma no aporta nada: es un HMAC con clave pública de facto.
2. **La verificación pública está rota en producción.** Sin `SUPABASE_SERVICE_ROLE_KEY`, `createAdminClient()` lanza (`admin.ts:11-15`), el `catch` de `route.ts:236-239` devuelve `notFound()` y **todo certificado real aparece como `NO_ENCONTRADO`**. Falla cerrado, que es lo correcto, pero significa que la característica insignia del producto no funciona en el entorno desplegado.

**Remediación**

1. Eliminar el fallback y fallar al arranque:
   ```ts
   const SIGNING_KEY = process.env.BRC_VERIFY_SECRET;
   if (!SIGNING_KEY) throw new Error("BRC_VERIFY_SECRET no está configurado");
   ```
2. Añadir a `.github/workflows/deploy.yml` (job `deploy-web`), como secretos de GitHub:
   ```yaml
   BRC_VERIFY_SECRET="${{ secrets.BRC_VERIFY_SECRET }}" \
   SUPABASE_SERVICE_ROLE_KEY="${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
   SENTRY_DSN="${{ secrets.SENTRY_DSN }}" \
   ```
3. Generar el secreto con `openssl rand -hex 32` y registrarlo en el inventario de rotación (sección 4).
4. Mejor aún: sustituir el HMAC simétrico por una firma asimétrica (Ed25519) y publicar la clave pública, para que un tercero pueda verificar sin que BitHauss tenga que compartir un secreto. Ver BH-03.
5. **[PENDIENTE PROD]** comprobar tras el despliegue:
   ```bash
   az webapp config appsettings list -n bithauss-web -g bithauss-rg \
     --query "[?name=='BRC_VERIFY_SECRET' || name=='SUPABASE_SERVICE_ROLE_KEY'].name" -o tsv
   curl -s https://bithauss-web.azurewebsites.net/api/verify/<uuid-de-un-cert-real> | jq .status
   ```

---

#### BH-03 · El BRC no está firmado y el folio se genera con `Math.random()` en el cliente — **CRÍTICA**

**Impacto: alto · Explotabilidad: media.** No permite tomar la plataforma, pero permite fabricar el documento que la plataforma vende.

**Evidencia**

- `apps/web/src/lib/cert-security.ts:138` — el payload que se codifica en el QR lleva la firma sin implementar:
  ```ts
  sig: "[PENDIENTE-FIRMA-PKI]",
  ```
- `apps/web/src/lib/cert-security.ts:143-154` — el payload sólo se codifica en base64url (`base64UrlEncode`), que es codificación, no protección, y apunta a `https://bithauss.com/verify?p=<payload>`, ruta que **no existe** en la aplicación (`apps/web/src/app` no tiene `verify/`; la ruta real es `/api/verify/[id]`).
- `apps/web/src/app/dashboard/expedientes/[id]/page.tsx:208` — el número de certificado se sortea en el navegador:
  ```ts
  const seq = String(Math.floor(Math.random() * 999999) + 1).padStart(6, "0");
  ```
- `apps/api/src/modules/brc/brc.service.ts:23` y `:239` — la API acepta ese número tal cual (`CertifyExpedienteDto.certificate_number`) y lo inserta.
- `packages/supabase/migrations/024_notarial_module.sql:220-243` — la migración **ya documenta este mismo problema** y crea `public.next_brc_certificate_number()` con una secuencia, con `grant execute ... to service_role`. La función existe; **el código no la usa.**

**Escenario de ataque**

Dos vectores. (a) Un estafador toma la plantilla del oficio (`apps/web/src/app/certificado/[id]/oficio/page.tsx`, cuyo marcado es público), rellena los datos de un inmueble que no le pertenece, genera el QR con `buildQrUrl` (código público) y lo entrega a un comprador. El comprador escanea, ve una URL de `bithauss.com`, y como el payload no está firmado y la ruta `/verify?p=` no existe, no hay forma de distinguir el falso del auténtico. (b) Dos notarios que certifican el mismo día tienen 1 en un millón de colisión por certificado; con el índice `unique` sobre `certificate_number` (`001_initial_schema.sql:480`) el segundo recibe un error opaco, y nada impide que un notario envíe deliberadamente un `certificate_number` que se parezca a un folio de otra serie.

**Remediación**

1. Que la API genere el folio, no el cliente. Quitar `certificate_number` del `CertifyExpedienteDto` y llamar a la función que ya existe:
   ```ts
   const { data } = await supabase.rpc('next_brc_certificate_number');
   const certificateNumber = data as string;
   ```
2. Firmar el certificado de verdad. Añadir a `brc_certificates` una columna `signature text` y firmar en el servidor, con clave privada Ed25519 guardada en Azure Key Vault, el conjunto canónico `{certificate_number, expediente_id, property_id, issued_by, issued_at, expires_at, document_hash}`. Publicar la clave pública en `/.well-known/brc-public-key.json`.
3. Que el QR apunte a la ruta real y única: `https://bithauss.com/verify/<certificate_id>` — no a un payload autocontenido. El QR debe ser un puntero al servidor, nunca la fuente de verdad.
4. Añadir la ruta `/verify/[id]` (página pública) además del endpoint JSON `/api/verify/[id]`.
5. Marcar en el diseño del oficio los elementos "de seguridad" (microimpresión, patrón void, marca esteganográfica) como **decorativos**: son deterministas a partir de datos públicos y cualquiera puede reproducirlos. No deben presentarse al usuario como garantías de autenticidad.

---

#### BH-04 · `is_active` no se aplica en ningún punto del sistema — **ALTA**

> **ESTADO: CERRADO (31-ago-2026).** El flag se aplica ahora en cuatro puntos:
> - **API `AuthGuard`** (`apps/api/src/common/guards/auth.guard.ts`): carga
>   `role, is_active` tras validar el token y deniega con
>   `403 { code: "ACCOUNT_DISABLED" }` y mensaje accionable en español. Va en
>   `AuthGuard` y no en `RolesGuard` porque este último devuelve `true` en
>   cuanto la ruta no declara `@Roles()`, que es la mayoría. `RolesGuard`
>   conserva el chequeo como defensa en profundidad.
> - **Middleware de Next** (`apps/web/src/lib/supabase/middleware.ts`): en
>   `/dashboard` y `/admin` lee el perfil, cierra la sesión y redirige a
>   `/auth/login?error=cuenta_desactivada`.
> - **RLS** (`031_...sql`): políticas **RESTRICTIVE** de `insert`/`update`/
>   `delete` sobre `profiles`, `company_profiles`, `notary_profiles`,
>   `properties`, `property_media`, `leads`, `brc_expedientes` y
>   `brc_documents`, apoyadas en `public.is_active_user()`. Se eligió
>   *restrictive* para no tener que reescribir (ni conocer) las políticas
>   permisivas que otros módulos definieron en 019–030. El `select` se deja
>   intacto a propósito: un usuario desactivado puede seguir leyendo sus datos
>   —necesario para exportarlos— pero no modificar nada.
> - **Revocación de sesión**: `AdminService.updateUserActive` llama a
>   `auth.admin.signOut(userId, 'global')`; sin eso Supabase seguiría emitiendo
>   access tokens a partir de un refresh token que sobrevive a la
>   desactivación. Además un admin no puede desactivarse a sí mismo.
> - **Cliente**: `apps/web/src/lib/account-status.ts` + `api-client.ts` cierran
>   la sesión al recibir el código `ACCOUNT_DISABLED`, en vez de dejar al
>   usuario chocando contra 403 genéricos.


**Impacto: alto · Explotabilidad: trivial** (para el usuario ya desactivado).

**Evidencia**

`grep -rn "is_active" apps/api/src apps/web/src` sólo devuelve:
- `apps/api/src/modules/admin/admin.service.ts:58-73` — el endpoint que **escribe** el flag.
- `apps/web/src/app/dashboard/admin/usuarios/page.tsx:82, 148, 329, 438-453` — la interfaz que lo muestra y lo alterna.

**No hay una sola lectura del flag en `AuthGuard` (`auth.guard.ts`), en `RolesGuard` (`roles.guard.ts`), en el middleware de Next (`apps/web/src/lib/supabase/middleware.ts`), ni en ninguna política RLS de `packages/supabase/migrations/*.sql`.**

**Escenario de ataque**

Un broker comete fraude, el administrador lo desactiva desde `/dashboard/admin/usuarios`, la interfaz muestra "Desactivado"… y el broker sigue publicando propiedades, leyendo sus leads, subiendo documentos a expedientes y consumiendo la API con su sesión actual. Como Supabase renueva el token con el `refresh_token` que sigue vivo, el acceso no caduca nunca. El administrador cree haber cortado el acceso y no lo ha hecho. Es el peor tipo de fallo: un control de seguridad que existe en la interfaz pero no en la realidad.

**Remediación**

1. En `RolesGuard` (que ya consulta `profiles`), pedir también `is_active` y denegar:
   ```ts
   const { data } = await adminClient.from('profiles')
     .select('role, is_active').eq('id', user.id).single();
   if (!data || data.is_active === false)
     throw new ForbiddenException('Cuenta desactivada');
   ```
   Y hacer que ese chequeo corra **siempre**, no sólo cuando hay `@Roles` — hoy `roles.guard.ts:33` retorna `true` si no hay roles requeridos. Conviene moverlo a `AuthGuard` tras validar el token.
2. En las políticas RLS, añadir un helper y usarlo en las políticas de escritura:
   ```sql
   create or replace function public.is_active_user() returns boolean
   language sql security definer set search_path = public stable as $$
     select coalesce((select is_active from profiles where id = auth.uid()), false);
   $$;
   ```
3. Al desactivar, revocar las sesiones vivas: `supabase.auth.admin.signOut(userId, 'global')` desde `AdminService.updateUserActive`.
4. Replicar el chequeo en `apps/web/src/lib/supabase/middleware.ts` para que el dashboard redirija en lugar de renderizar vacío.

---

#### BH-05 · El solicitante puede insertar documentos con `status = 'VALIDADO'` — **ALTA**

**Impacto: alto · Explotabilidad: media** (requiere usar la API de Supabase directamente, no la interfaz).

**Evidencia**

- `packages/supabase/migrations/022_brc_document_resubmission.sql:16-27` — la política de `insert` no restringe la columna `status`:
  ```sql
  create policy "Requesters can attach documents to their expediente"
    on brc_documents for insert to authenticated
    with check (
      uploaded_by = auth.uid()
      and exists (select 1 from brc_expedientes be
                   where be.id = brc_documents.expediente_id
                     and be.requested_by = auth.uid()
                     and be.status not in ('CERTIFICADO','RECHAZADO')));
  ```
- `packages/supabase/migrations/001_initial_schema.sql:448` — `status brc_document_status not null default 'PENDIENTE'`: el *default* es correcto, pero la columna es escribible.
- Tampoco se restringen `reviewed_by`, `reviewed_at`, ni las columnas notariales añadidas en `024_notarial_module.sql:38-54` (`cert_result`, `notary_legal_opinion`, `reviewer_name`).

**Escenario de ataque**

El propietario de un inmueble con una escritura problemática abre la consola del navegador de su propio dashboard, donde ya tiene un cliente Supabase autenticado, y ejecuta:

```js
await supabase.from('brc_documents').insert({
  expediente_id: '<su expediente>', document_type_id: '<escritura>',
  uploaded_by: '<su uuid>', file_url: '...', file_name: 'escritura.pdf',
  file_size: 1, mime_type: 'application/pdf',
  status: 'VALIDADO', reviewed_by: '<uuid del notario asignado>',
  reviewed_at: new Date().toISOString(),
  notary_legal_opinion: 'Sin observaciones', reviewer_name: 'Lic. …'
});
```

La pantalla del notario (`apps/web/src/app/dashboard/expedientes/[id]/page.tsx:311-317`) lee esas filas tal cual y renderiza el requisito en verde, con dictamen jurídico y nombre de dictaminador incluidos. El notario, viendo todo aprobado, pulsa "Certificar". `BrcService.certifyExpediente` (`brc.service.ts:228-233`) comprueba precisamente que todos los requeridos estén en `VALIDADO`… y lo están, porque los puso el solicitante. **Se emite un BRC sobre documentación que nadie revisó.**

**Remediación**

Restringir las columnas en la política de `insert` y bloquear todo `update` del solicitante:

```sql
-- 025_brc_document_status_hardening.sql
drop policy if exists "Requesters can attach documents to their expediente" on brc_documents;
create policy "Requesters can attach documents to their expediente"
  on brc_documents for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and status = 'PENDIENTE'
    and reviewed_by is null
    and reviewed_at is null
    and rejection_reason is null
    and owner_instruction is null
    and cert_result is null
    and notary_legal_opinion is null
    and reviewer_name is null
    and exists (select 1 from brc_expedientes be
                 where be.id = brc_documents.expediente_id
                   and be.requested_by = auth.uid()
                   and be.status not in ('CERTIFICADO','RECHAZADO')));
```

Adicionalmente, en `certifyExpediente`, exigir que cada documento requerido tenga `reviewed_by` igual a un perfil con rol `NOTARIO`/`OPERADOR_BRC`/`ADMIN` y `reviewed_at` no nulo — no basta con mirar `status`.

---

#### BH-06 · `GET /properties/:id` público con `service_role` y `select('*')` — **ALTA**

**Impacto: medio-alto · Explotabilidad: media** (requiere conocer el UUID).

**Evidencia**

- `apps/api/src/modules/properties/properties.controller.ts:71-77` — el endpoint es `@Public()`.
- `apps/api/src/modules/properties/properties.service.ts:331-345` — usa el cliente admin (que **salta RLS**) y devuelve `select('*, property_media(*)')` **sin filtrar por `status`** y sin recortar campos.
- Lo mismo aplica al listado: `properties.service.ts:270` y `:279` usan `getAdminClient()` con `select('*')`. Aquí sí se fuerza `status: 'PUBLICADO'` en el controlador (`properties.controller.ts:48-52`), lo cual está bien, pero se siguen devolviendo todas las columnas.

**Escenario de ataque**

Dos filtraciones distintas:

1. **Borradores y propiedades eliminadas.** `GET /api/v1/properties/<uuid>` devuelve el registro completo aunque su `status` sea `BORRADOR`, `PAUSADO` o `ELIMINADO`. Las políticas RLS de `001_initial_schema.sql:683-686` restringen esto correctamente para el navegador, pero la API las evita. Un UUID puede filtrarse por un enlace compartido, un log, un correo o una propiedad que se despublicó — y a partir de ese momento sigue siendo legible para siempre por cualquiera.
2. **Campo `show_address`.** El modelo tiene `show_address` (`properties.service.ts:84`, `:125`) para que el vendedor oculte la dirección exacta, pero `select('*')` devuelve `address_line`, `latitude` y `longitude` en la respuesta pública sin mirar ese flag. Un scraper obtiene la dirección exacta de todos los inmuebles cuyos dueños pidieron privacidad.

**Remediación**

1. Definir una proyección pública explícita y usarla en los dos endpoints `@Public()`:
   ```ts
   const PUBLIC_FIELDS = 'id, slug, title, description, type, operation, price, price_sale, price_rent, currency, accepts_crypto, show_price, area_total, area_built, bedrooms, bathrooms, parking_spaces, city, state, neighborhood, zip_code, featured_image_url, brc_status, published_at, show_address, address_line, latitude, longitude, property_media(*)';
   ```
   y borrar `address_line`/`latitude`/`longitude` del objeto de respuesta cuando `show_address === false`.
2. En `findById`, añadir `.eq('status', 'PUBLICADO')` para la vía pública, y exponer la vía autenticada (dueño / admin) como un método distinto que sí verifica identidad.
3. Considerar usar `getClientForUser(accessToken)` (`supabase.config.ts:37-52`, ya implementado y hoy sin usar) en lugar del cliente admin para todo lo que no requiera saltar RLS. Hoy **todos** los servicios usan el cliente admin, lo que convierte a RLS en una segunda capa inerte del lado de la API.

---

#### BH-07 · Subida directa a Storage sin validación de tipo ni tamaño en servidor — **ALTA**

**Impacto: medio-alto · Explotabilidad: alta.**

**Evidencia**

- `apps/web/src/app/dashboard/propiedades/[id]/solicitar-brc/page.tsx:359-372` — el navegador sube directamente a Supabase Storage, con el nombre de archivo tal cual:
  ```ts
  const filePath = `${expedienteId}/${docTypeId}/${file.name}`;
  ```
- `apps/web/src/app/dashboard/expedientes/[id]/page.tsx:515` y `:587-590` — lo mismo para reenvíos y para el PDF del certificado (`upsert: true`).
- La única validación de tipo real del sistema, `apps/api/src/common/validators/magic-bytes.validator.ts` (que está bien escrita: lee magic bytes con `file-type`, no confía en el MIME del cliente), sólo se aplica en `apps/api/src/modules/ocr/ocr.controller.ts:25-32`, es decir **al análisis OCR, no al almacenamiento**. Un archivo puede guardarse sin pasar nunca por OCR.
- Del lado del navegador sólo hay `accept=".pdf,.jpg,.jpeg,.png"` (`solicitar-brc/page.tsx:821`, `expedientes/[id]/page.tsx:1331`), que es cosmético: el usuario cambia el tipo en el diálogo o llama a la API directamente.
- No hay ningún control de tamaño en el cliente (`grep "file.size"` sólo encuentra usos de lectura para mostrar y para persistir `file_size`).

**Escenario de ataque**

Un usuario sube `factura.html` (o un SVG con `<script>`) como "documento del expediente". `supabase-js` fija el `content-type` a partir de `file.type`, que el atacante controla. Cuando el notario abre el enlace firmado, el navegador renderiza HTML/SVG activo en el origen `https://<proyecto>.supabase.co`. No roba las cookies de la aplicación (origen distinto), pero sí permite phishing convincente desde un dominio de infraestructura de BitHauss y ataques contra la propia API de Storage con el token del notario en la URL firmada. En paralelo, sin límite de tamaño, un usuario puede subir 50 GB en el bucket privado y disparar la factura de Supabase.

Sobre *path traversal*: el nombre no se sanea, pero las políticas de `019`/`022` anclan el primer segmento de la ruta (`(storage.foldername(name))[1]`) al `expediente_id` del solicitante, así que **no** se puede escribir fuera de la carpeta propia. El riesgo real es el tipo de contenido y el tamaño, no el traversal.

**Remediación**

1. Sanear el nombre y forzar la extensión en el cliente:
   ```ts
   const safe = file.name.normalize('NFKD').replace(/[^\w.\-]/g, '_').slice(-100);
   const filePath = `${expedienteId}/${docTypeId}/${Date.now()}-${safe}`;
   ```
2. Fijar el `contentType` explícitamente en el `upload` en lugar de dejar que lo elija el navegador, y limitarlo a `application/pdf | image/jpeg | image/png`.
3. **[PENDIENTE PROD]** Configurar en Supabase el bucket `brc-documents` con `allowed_mime_types` y `file_size_limit` (p. ej. 15 MB, el mismo límite que ya usa el OCR en `ocr.controller.ts:28`). Comprobación:
   ```bash
   curl -s -H "apikey: $SERVICE_ROLE" -H "Authorization: Bearer $SERVICE_ROLE" \
     "$SUPABASE_URL/storage/v1/bucket/brc-documents" | jq '{public, file_size_limit, allowed_mime_types}'
   ```
4. A medio plazo: mover la subida a la API (`POST /api/v1/brc/expedientes/:id/documents`) para que pase por `MagicBytesValidator` + `MaxFileSizeValidator`, que ya existen y funcionan.
5. Servir siempre los documentos con `Content-Disposition: attachment`.

---

#### BH-08 · `next@15.5.18`: 3 vulnerabilidades altas, incluida SSRF en `rewrites` — **ALTA**

> **ESTADO: MITIGADO (31-ago-2026) · actualización de dependencias PENDIENTE.**
> El destino del `rewrite` de `/api/v1/*` ya no es "lo que contenga `API_URL`":
> `apps/web/src/lib/api-rewrite-target.ts` lo valida contra una allowlist
> estricta y rechaza credenciales en la URL, rutas, query, fragmento, http en
> producción, direcciones privadas/loopback y —explícitamente— los endpoints de
> metadatos de nube (`169.254.169.254`, `metadata.google.internal`, …), que son
> el destino que convierte esta SSRF en una fuga de tokens de identidad
> administrada en Azure. Si la validación falla, el build/arranque **revienta**
> en vez de proxyear a un destino inesperado. Cubierto por
> `src/lib/api-rewrite-target.test.ts`.
>
> **Sigue abierto (acción humana):** `pnpm up next@^15.5.21 multer@^2.2.0` y
> regenerar el lockfile. No se ejecutó en esta pasada porque estaba prohibido
> instalar dependencias con otros agentes trabajando en paralelo. `ci.yml` ya
> corre `pnpm audit --prod --audit-level=high` (no bloqueante hasta que el
> árbol esté limpio).


**Impacto: medio-alto · Explotabilidad: media.**

**Evidencia** (salida de `pnpm audit --prod`, ejecutado sin instalar nada)

| Paquete | Instalado | Parcheado | Aviso |
|---|---|---|---|
| `next` | 15.5.18 | >= 15.5.21 | SSRF en `rewrites`; SSRF en Server Actions; DoS en App Router |
| `multer` | 2.1.1 | >= 2.2.0 | DoS por objetos profundamente anidados |
| `lodash` (vía `@nestjs/config`) | <= 4.17.23 | — | Inyección de código en `_.template` |
| `ws` (vía `@supabase/realtime-js`) | < 8.21.0 | >= 8.21.0 | Agotamiento de memoria |
| `dompurify` (vía `jspdf`) | <= 3.4.6 | >= 3.4.8 | Bypass de sanitización |
| `postcss` (vía `next`) | <= 8.5.17 | — | Lectura arbitraria de archivos / path traversal |
| `sharp` (vía `next`) | < 0.35.0 | >= 0.35.0 | Vulnerabilidades heredadas de libvips |

Totales: **48 vulnerabilidades en dependencias de producción** (21 altas, 21 moderadas, 6 bajas); 97 contando desarrollo (1 crítica: `handlebars` vía `ts-jest`, sólo dev).

La SSRF de `rewrites` es especialmente relevante aquí porque la aplicación **sí** usa un `rewrite` hacia un host externo: `apps/web/next.config.ts:51-63` reenvía `/api/v1/:path*` a `https://bithauss-api.azurewebsites.net`.

**Escenario de ataque**

Un atacante manipula la ruta de un `rewrite` para que el servidor de Next haga una petición saliente a un destino que él elige. Desde un App Service de Azure, ese destino puede ser el *Instance Metadata Service* (`169.254.169.254`) y devolver tokens de identidad administrada. `multer` y `ws` permiten tumbar la API con peticiones baratas.

**Remediación**

1. `pnpm up next@^15.5.21 multer@^2.2.0` y regenerar el lockfile; verificar con `pnpm audit --prod`.
2. Añadir `pnpm audit --prod --audit-level=high` como paso bloqueante en `ci.yml` (ver BH-18).
3. Habilitar Dependabot o Renovate con agrupación semanal.
4. **[PENDIENTE PROD]** Deshabilitar el acceso al IMDS desde el contenedor de la web si no se usa identidad administrada, y verificar que el App Service tiene restricción de salida.

---

#### BH-09 · La verificación pública del BRC filtra `owner_id`, dirección y precio — **ALTA**

> **ESTADO: CERRADO (31-ago-2026).** `apps/web/src/app/api/verify/[id]/route.ts`
> devuelve por defecto sólo `{ id, title, city, state }` de la propiedad. Se
> añadió un campo `scope` (`"publica" | "participante"`): `address_line`,
> `price`, `currency`, `featured_image_url` y `owner_id` sólo viajan si la
> petición trae sesión del **dueño de la propiedad, el notario emisor, un
> `OPERADOR_BRC` o un `ADMIN`**. Así la página `/certificado/[id]` sigue
> funcionando completa para su dueño sin que el enlace compartido filtre la
> dirección exacta. La ficha pública degrada limpiamente (omite el bloque de
> precio) en vez de renderizar `NaN`.


**Impacto: medio-alto · Explotabilidad: media** (requiere el UUID del certificado, que es UUIDv4 y por tanto no enumerable por fuerza bruta).

**Evidencia**

`apps/web/src/app/api/verify/[id]/route.ts:170-224` — la respuesta pública, sin autenticación alguna, incluye:

```ts
property: { id, title, address_line, city, state, price, currency,
            featured_image_url, owner_id },
notary:   { name, number, state },
```

- `address_line` se devuelve **ignorando `show_address`** (mismo problema que BH-06).
- `owner_id` es el UUID de `auth.users`, un identificador interno que no debe cruzar hacia el exterior: correlaciona el certificado con la cuenta y con cualquier otro punto donde ese UUID aparezca.
- `price` es información comercial que el vendedor puede haber ocultado con `show_price`.

**Escenario de ataque**

Un certificado BRC se comparte legítimamente (ese es su propósito: se pega en el anuncio, se manda por WhatsApp). Cualquiera que reciba el enlace obtiene, además del "sí/no está vigente" que necesita, la dirección exacta del inmueble, el precio interno y el identificador de la cuenta del propietario. Para un inmueble de alto valor, la combinación dirección + precio + identidad del dueño es exactamente el conjunto de datos que se usa para una extorsión o un robo dirigido, un riesgo nada teórico en México. Bajo LFPDPPP es además un tratamiento de datos personales sin finalidad declarada.

**Remediación**

Reducir la respuesta pública a lo mínimo verificable:

```ts
certificate: { certificate_number, issued_at, expires_at },
property:    { city, state, title },          // sin address_line, price, owner_id
notary:      { name, number, state },
```

Si un verificador necesita confirmar la dirección, que lo haga por coincidencia: aceptar un parámetro `?address_hash=` y responder sólo `true`/`false`. Nunca devolver el dato en claro.

---

#### BH-10 · Rate limiting en memoria, no distribuido, y con `X-Forwarded-For` falsificable — **ALTA**

> **ESTADO: MITIGADO (31-ago-2026).**
> - `apps/web/src/lib/rate-limit.ts`: `clientIp()` deja de leer
>   `x-forwarded-for` de izquierda a derecha. Ahora prefiere cabeceras que el
>   borde sobrescribe (`x-azure-clientip`, `cf-connecting-ip`,
>   `true-client-ip`) y, si no las hay, toma la entrada **de la derecha** de
>   `X-Forwarded-For` según `RATE_LIMIT_PROXY_DEPTH` (1 = App Service, 2 =
>   detrás de Front Door). Eso anula el bypass trivial
>   `curl -H "X-Forwarded-For: 1.2.3.<aleatorio>"`. Se valida y normaliza el
>   valor (se quita el puerto que añade Azure) y lo inatribuible cae en un
>   único bucket compartido.
> - Nuevo helper `enforceRateLimit(req, scope, opts)`, aplicado a
>   `/api/geocode` (30/min), `/api/ticker` (60/min), `/api/postal/[cp]`,
>   `/api/localidades/{colonias,municipios}` y `/api/proxy-image` (120/min).
> - `packages/supabase/migrations/032_security_rls_hardening.sql` acota la
>   longitud de los campos de `leads` (mensaje ≤ 2000).
>
> **Sigue abierto:** almacén distribuido (Redis) tanto aquí como en
> `ThrottlerModule`, y captcha + límite por `property_id` en el formulario
> público de contacto (vive en `apps/web/src/app/propiedades/[id]/page.tsx`,
> en manos de otro agente durante esta pasada).


**Impacto: medio · Explotabilidad: alta.**

**Evidencia**

- `apps/web/src/lib/rate-limit.ts:21` — el estado vive en un `Map` del proceso Node. El propio archivo lo advierte en `:1-7`.
- `apps/web/src/lib/rate-limit.ts:79-90` — `clientIp()` confía en `x-forwarded-for` / `x-real-ip` / `cf-connecting-ip` sin validar que provengan de un proxy de confianza.
- Sólo hay **un** consumidor de este limitador: `apps/web/src/app/api/verify/[id]/route.ts:86`. Las rutas `/api/geocode`, `/api/ticker`, `/api/postal/[cp]`, `/api/localidades/*` y `/api/proxy-image` **no tienen ningún límite**.
- En la API: `apps/api/src/app.module.ts:25-30` define 60 req/60 s globales por IP, también en memoria (`ThrottlerModule` sin `storage`). `OcrController` afina a 10/min y 30/min (`ocr.controller.ts:21`, `:47`), lo cual está bien.
- El formulario público de contacto (`apps/web/src/app/propiedades/[id]/page.tsx:323-332`) inserta directo en `leads` **sin límite ni captcha**. La migración `012_leads_admin_update_and_integrity.sql:44-45` ya lo advierte explícitamente.

**Escenario de ataque**

1. **Bypass trivial:** `curl -H "X-Forwarded-For: 1.2.3.<aleatorio>"` en bucle. Cada petición cuenta como una IP distinta y el límite deja de existir.
2. **Bypass por escalado:** en cuanto haya dos instancias de App Service, el límite se duplica; en un reinicio, se resetea.
3. **Coste externo:** `/api/geocode` llama a Nominatim (`geocode/route.ts:29`), cuyo uso está sujeto a política de uso justo; un bucle puede hacer que se bloquee la IP de BitHauss y rompa el alta de propiedades para todos. `/api/ticker` llama a CoinGecko con caché de 60 s en memoria (`ticker/route.ts:19`) — la caché lo protege razonablemente.
4. **Spam de leads:** un competidor inunda el CRM de un broker con leads válidos (pasan la política de `012` porque apuntan a una propiedad publicada real), destruyendo su capacidad de operar.

**Remediación**

1. Confiar en `X-Forwarded-For` **sólo** si la petición viene del proxy conocido. En Azure App Service, usar la cabecera que inyecta la plataforma y validar la IP del salto anterior; detrás de Azure Front Door, usar `X-Azure-ClientIP` y bloquear el tráfico que no venga de Front Door.
2. Sustituir el `Map` por un almacén compartido (Redis / Azure Cache for Redis) tanto en `lib/rate-limit.ts` como en `ThrottlerModule` (`@nest-lab/throttler-storage-redis`).
3. Aplicar `checkRateLimit` a `/api/geocode`, `/api/proxy-image`, `/api/localidades/*` y `/api/postal/*`.
4. Añadir Turnstile o hCaptcha al formulario de contacto y un límite por IP + por `property_id`.
5. **[PENDIENTE PROD]** Poner Azure Front Door delante con reglas de WAF y rate limiting en el borde (ver sección 4).

---

#### BH-11 · CSP con `'unsafe-inline'` y `'unsafe-eval'` en `script-src` — **MEDIA**

> **ESTADO: MITIGADO (31-ago-2026).** `apps/web/next.config.ts` sólo emite
> `'unsafe-eval'` en desarrollo (lo necesita el runtime de React Refresh); una
> build de producción nunca hace `eval`, así que la directiva desaparece y con
> ella toda esa clase de *gadgets*. Se añaden `worker-src`, `manifest-src`,
> `Cross-Origin-Opener-Policy: same-origin`,
> `X-Permitted-Cross-Domain-Policies: none` y se amplía `Permissions-Policy`.
> Hay una prueba (`src/lib/next-config.security.test.ts`) que falla si alguien
> reintroduce `unsafe-eval` en producción o quita una cabecera.
>
> **Sigue abierto:** `'unsafe-inline'`, que requiere mover la CSP al middleware
> con nonces por petición (fase 1).


**Evidencia** — `apps/web/next.config.ts:26`:
```
"script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js dev/prod inline scripts
```

El resto de la CSP está bien construida: `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `connect-src` acotado a la API y a Supabase (`:14-22`), y `upgrade-insecure-requests` sólo en producción (`:36`). También están presentes HSTS con `preload` (`:45`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy` (`:41-45`). Es una configuración por encima de la media.

**Escenario de ataque** — Con `'unsafe-inline'` + `'unsafe-eval'`, la CSP deja de mitigar XSS: cualquier inyección de HTML en cualquier página (por ejemplo, mediante un título de propiedad si en el futuro se renderiza sin escapar) se ejecuta. Hoy no hay un XSS conocido — el único `dangerouslySetInnerHTML` es seguro (BH-secciones "áreas correctas") — pero la CSP es precisamente la red de seguridad para el XSS que aún no se ha encontrado.

**Remediación** — Adoptar nonces. Next 15 soporta CSP con nonce desde el middleware:
```ts
const nonce = crypto.randomUUID();
res.headers.set('Content-Security-Policy',
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; ...`);
```
Mover la CSP de `next.config.ts` (estática) a `middleware.ts` (por petición) y eliminar `'unsafe-eval'`, que en producción Next no necesita. **[PENDIENTE PROD]** verificar las cabeceras reales: `curl -sI https://bithauss-web.azurewebsites.net/ | grep -i "content-security\|strict-transport\|x-frame"` — Azure Front Door y App Service pueden reescribirlas o añadir duplicados.

---

#### BH-12 · `@bithauss/validators` (Zod) nunca se usa; el navegador escribe directo a Postgres — **MEDIA**

> **ESTADO: MITIGADO parcialmente (31-ago-2026).**
> `packages/supabase/migrations/032_security_rls_hardening.sql` añade las
> invariantes de columna que faltaban en `leads` (`message` ≤ 2000, `name`
> ≤ 150, `email` ≤ 320, `phone` ≤ 30, UTM ≤ 100). Se crean `NOT VALID` para no
> arriesgar el despliegue con filas históricas; validarlas después con
> `alter table leads validate constraint leads_message_len;`.
>
> **Sigue abierto:** usar los esquemas Zod en la frontera del cliente y cerrar
> `with check` por columna en `properties` (BH-19).


**Evidencia** — El paquete `packages/validators/src/` define siete esquemas Zod (`user`, `property`, `membership`, `lead`, `brc`, `kyc`, `purchase`). Una búsqueda de `safeParse` / `.parse(` en `apps/web/src` y `apps/api/src` devuelve **cero** usos de esos esquemas (los únicos aciertos son `JSON.parse`). La API valida con `class-validator` en los DTO (bien hecho: `properties.service.ts:37-143` es exhaustivo, con `@Min`/`@Max`/`@Length`/`@IsIn`), pero el frontend escribe a Supabase **sin ninguna validación de frontera**: `registro/page.tsx:254-266`, `propiedades/[id]/page.tsx:323-332`, `solicitar-brc/page.tsx:398`, `expedientes/[id]/page.tsx:529`.

**Escenario de ataque** — La consecuencia no es tanto una inyección (PostgREST parametriza) como la **ausencia de invariantes**: campos de longitud arbitraria (un `message` de lead de 10 MB), enums fuera de rango cuando la columna es `text`, y sobre todo columnas que el usuario no debería poder fijar — que es exactamente el vector de BH-05 y BH-19. Cada escritura directa desde el navegador es una superficie donde la única defensa es la política RLS, y las políticas hoy sólo restringen *filas*, no *columnas*.

**Remediación**
1. Usar los esquemas Zod en el cliente antes de cada `insert`/`update` (`schema.safeParse(payload)`), y en las rutas de API de Next.
2. Más importante: cerrar los `with check` de RLS por columna (como en BH-05) o, mejor, mover las escrituras sensibles a la API. Regla de diseño: **el navegador escribe directo sólo donde ninguna columna cambia una decisión de negocio.**
3. Añadir `check (char_length(message) <= 2000)` y equivalentes a las columnas de texto libre de `leads`.

---

#### BH-13 · Políticas de Storage de `avatars` y `properties` fuera de las migraciones — **MEDIA** · [PENDIENTE PROD]

**Evidencia** — Las migraciones definen políticas de `storage.objects` **únicamente** para `brc-documents` (`019:92-136`, `021:12-58`, `022:46-87`, `024:200-218`). Sin embargo, el código sube y lee de otros dos buckets:
- `avatars` — `registro/page.tsx:139`, `configuracion/page.tsx:325`
- `properties` (`WM_BUCKET`, `apps/web/src/lib/watermark.ts:61`) — `propiedades/nueva/page.tsx:484`, `[id]/editar/page.tsx:601`

Ambos se usan con `getPublicUrl()`, lo que implica que son buckets públicos y que sus políticas de escritura se crearon manualmente en el panel de Supabase. **No están en control de versiones**, no se revisan en PR, y no se recrean en un entorno nuevo.

**Escenario de ataque** — Si la política de `insert` de `properties` es permisiva (por ejemplo `bucket_id = 'properties'` sin más condición, que es lo que sugiere el asistente del panel), cualquier usuario autenticado puede escribir en cualquier ruta del bucket, incluida la de otro vendedor, y sobrescribir sus fotos. Y por ser público, las fotos de propiedades en `BORRADOR` son legibles por cualquiera que adivine la ruta, aunque la propiedad no esté publicada.

**Remediación**
1. Exportar las políticas actuales y versionarlas en una migración `025_storage_policies_avatars_properties.sql`:
   ```sql
   select policyname, cmd, qual, with_check
     from pg_policies where schemaname='storage' and tablename='objects';
   ```
2. Anclar la escritura al `auth.uid()` en el primer segmento de la ruta, igual que se hizo (bien) para `brc-documents`:
   ```sql
   create policy "avatars: owner writes own folder"
     on storage.objects for insert to authenticated
     with check (bucket_id='avatars' and (storage.foldername(name))[1] = auth.uid()::text);
   ```
3. **[PENDIENTE PROD]** verificar los flags de cada bucket:
   ```bash
   curl -s -H "apikey: $SERVICE_ROLE" -H "Authorization: Bearer $SERVICE_ROLE" \
     "$SUPABASE_URL/storage/v1/bucket" | jq '.[] | {name, public, file_size_limit, allowed_mime_types}'
   ```
   Confirmar que `brc-documents` es **`public: false`** y que la duración de las URL firmadas (60 s, `apps/web/src/lib/private-storage.ts:18`, valor razonable) se respeta.

---

#### BH-14 · Endpoint OCR sin `@Roles`: abuso de cuota Azure — **MEDIA**

> **ESTADO: MITIGADO (31-ago-2026).** `apps/api/src/modules/ocr/ocr.controller.ts`
> lleva `@Roles('VENDEDOR','BROKER','INMOBILIARIA','NOTARIO','OPERADOR_BRC','ADMIN')`
> a nivel de controlador: el camino "me registro con un correo desechable como
> COMPRADOR y quemo la cuota de Azure" desaparece.
>
> **Sigue abierto:** throttle por usuario (no por IP), cuota diaria por cuenta
> persistida, y alerta de presupuesto en Azure Cost Management.


**Evidencia** — `apps/api/src/modules/ocr/ocr.controller.ts:16-54`: `POST /api/v1/ocr/validate` y `POST /api/v1/ocr/cross-check-escritura` sólo requieren estar autenticado. El propio comentario reconoce el coste (`:20`: "OCR is expensive — Azure DocIntelligence + OpenAI per call"). El throttle de 10 req/min por IP es la única barrera, y es evadible según BH-10.

**Escenario de ataque** — Alguien se registra con un correo desechable como `COMPRADOR` y lanza 10 documentos por minuto de forma sostenida: 14 400 análisis al día contra Azure Document Intelligence + Azure OpenAI, facturados a BitHauss. No hay elevación de privilegios, sólo una factura.

**Remediación**
1. Restringir por rol: `@Roles('VENDEDOR','BROKER','INMOBILIARIA','NOTARIO','OPERADOR_BRC','ADMIN')`.
2. Throttle por **usuario**, no por IP (`ThrottlerGuard` con `getTracker` sobre `req.user.id`).
3. Cuota diaria por cuenta persistida en base de datos, y alerta de presupuesto en Azure Cost Management.

---

#### BH-15 · `certifyExpediente` sin validación de estado ni idempotencia — **MEDIA**

**Evidencia** — `apps/api/src/modules/brc/brc.service.ts:218-289`:
- No comprueba `expediente.status` antes de certificar: se puede certificar un expediente en `BORRADOR` o incluso ya `CERTIFICADO`.
- `pdf_url` llega del cliente sin validación (`CertifyExpedienteDto.pdf_url`, `:25`) y se persiste tal cual (`:243`).
- Los seis pasos (insertar certificado, actualizar expediente, actualizar propiedad, insertar validación, log, notificación) **no son una transacción**: si el paso 3 falla, queda un certificado emitido sin que la propiedad lo refleje.
- No hay idempotencia: un doble clic genera dos intentos; el segundo falla por el índice `unique` sobre `expediente_id` (`001_initial_schema.sql:478`), pero con un error opaco.
- El flujo de `024_notarial_module.sql` introduce `PENDIENTE_EMISION_BRC` como estado intermedio obligatorio, y este servicio todavía no lo respeta (código en evolución por otro agente).

**Remediación**
1. Validar el estado de entrada: `if (expediente.status !== 'PENDIENTE_EMISION_BRC') throw new BadRequestException(...)`.
2. Validar `pdf_url` contra el host de Supabase Storage del proyecto y el prefijo `certificates/<expediente_id>/`.
3. Envolver los seis pasos en una función Postgres `SECURITY DEFINER` transaccional (`public.issue_brc_certificate(...)`) y llamarla con `rpc`.
4. Aceptar una cabecera `Idempotency-Key` y guardarla.

---

#### BH-16 · `AuditLogInterceptor` es código muerto: la API no tiene pista de auditoría — **MEDIA**

> **ESTADO: MITIGADO (31-ago-2026).** El interceptor se amplió para registrar
> IP (tomada del extremo derecho de `X-Forwarded-For`, no del izquierdo),
> user-agent, rol efectivo, código de estado y duración, y para marcar
> `DENIED` los 401/403 —que son la señal que delata un ataque en curso—.
> Nunca vuelca el `body` ni el query string.
>
> **Sigue abierto:** registrarlo. Requiere una línea en `app.module.ts`, que
> esta pasada no podía tocar:
> `{ provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor }`.


**Evidencia** — `apps/api/src/common/interceptors/audit-log.interceptor.ts` existe y está bien escrito, pero `grep -rn "AuditLogInterceptor" apps/api/src` sólo encuentra su propia declaración (`:15`). **No está registrado** en `apps/api/src/app.module.ts:41-62` (donde sí están `ThrottlerGuard`, `AuthGuard`, `RolesGuard` y `HttpExceptionFilter`) ni en ningún módulo.

En la base de datos sí hay auditoría (`010_history_audit.sql`, `016_audit_archive_actions.sql`: trigger `audit_row_change` `SECURITY DEFINER`, tabla append-only), y los `brc_expediente_logs` se escriben en cada acción del BRC (`brc.service.ts:114`, `:149`, `:207`, `:271`, `:302`). Eso cubre bastante. Lo que falta es la capa HTTP: quién llamó a qué endpoint, desde dónde y cuándo.

**Escenario** — Ante un incidente ("¿quién aprobó este documento el 12 de marzo?"), existen `brc_expediente_logs.performed_by` — bien — pero no hay IP, ni user-agent, ni registro de los intentos **fallidos** (403/401), que es justo lo que se necesita para detectar un ataque en curso.

**Remediación**
1. Registrar el interceptor:
   ```ts
   { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
   ```
2. Ampliarlo para registrar también IP, user-agent, rol efectivo y código de estado; y para **no** volcar el `body` (contiene datos personales).
3. Emitir a un sink persistente (Azure Log Analytics), no sólo a `stdout`.
4. Alertar sobre patrones: >N respuestas 403 por usuario/minuto, cambios de rol, emisión de certificados.

---

#### BH-17 · Sentry sin `beforeSend` y con Session Replay activado en el cliente — **MEDIA**

> **ESTADO: CERRADO en código · [PENDIENTE PROD] panel de Sentry.**
> - Session Replay **desactivado** (`replaysOnErrorSampleRate: 0`). Grabar el
>   100 % de las sesiones con error significaba filmar a un notario leyendo una
>   escritura escaneada y enviarlo a un encargado que el aviso de privacidad no
>   declara.
> - `beforeSend` + `beforeSendTransaction` en las cuatro inicializaciones
>   (`apps/web/sentry.{client,server,edge}.config.ts`,
>   `apps/api/src/instrument.ts`), apoyados en un scrubber compartido
>   (`apps/web/src/lib/sentry-scrub.ts` / `apps/api/src/common/sentry-scrub.ts`):
>   elimina `request.data`, cookies y `env`; redacta por *substring* cualquier
>   clave que contenga `authorization|cookie|token|curp|rfc|escritura|
>   folio_real|address|telefono|email|card|cvv|client_secret|stripe|
>   customer_details|service_role|signature|password`; recorta el query string;
>   y del usuario conserva **sólo el `id`**. `sendDefaultPii: false` explícito.
> - Cubierto por pruebas en ambos lados.
>
> **Sigue abierto (acción humana):** activar Data Scrubbing en el proyecto de
> Sentry, fijar retención a 30 días y declarar a Sentry, Azure OpenAI y Azure
> Document Intelligence como encargados en el aviso de privacidad.


**Evidencia**
- `apps/web/sentry.client.config.ts:12` — `replaysOnErrorSampleRate: 1.0`: el 100 % de las sesiones con error se graban.
- Ninguna de las cuatro inicializaciones (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `apps/api/src/instrument.ts:12-20`) define `beforeSend`, `beforeSendTransaction`, `sendDefaultPii: false` ni reglas de scrubbing.
- `apps/api/src/common/filters/http-exception.filter.ts:62-73` hace bien lo suyo: sólo envía `user.id`, método, estado y `user-agent`, no el cuerpo. Es el mejor punto del área.

**Escenario de ataque / riesgo de cumplimiento** — Un error en `/dashboard/expedientes/[id]` mientras el notario revisa una escritura graba la sesión completa: nombres, CURP y RFC extraídos por OCR, la dirección del inmueble, el visor del documento. Todo eso sale de México hacia la infraestructura de Sentry. Bajo LFPDPPP, es una transferencia de datos personales a un tercero que debe estar declarada en el aviso de privacidad y amparada por un contrato de encargado del tratamiento. El aviso actual (`apps/web/src/components/layout/legal-modal.tsx:100-132`) no menciona transferencias a proveedores de telemetría.

**Remediación**
1. Desactivar Session Replay en las rutas que muestran documentos, o directamente: `replaysOnErrorSampleRate: 0`. Si se conserva, activar `maskAllText: true` y `blockAllMedia: true`.
2. Añadir `beforeSend` en las cuatro configuraciones para eliminar `request.data`, cookies, cabeceras `Authorization` y cualquier campo que coincida con `curp|rfc|escritura|folio_real|address`.
3. Fijar `sendDefaultPii: false` explícitamente.
4. Activar Data Scrubbing en el proyecto de Sentry y fijar la retención al mínimo operativo (30 días).
5. Declarar Sentry, Azure OpenAI y Azure Document Intelligence como encargados en el aviso de privacidad, con firma de convenio de tratamiento.

---

#### BH-18 · CI/CD sin `permissions`, sin secret scanning, SAST ni `pnpm audit` — **MEDIA**

> **ESTADO: MITIGADO (31-ago-2026).** `ci.yml` y `deploy.yml` declaran
> `permissions: contents: read`; `ci.yml` añade `pnpm audit --prod
> --audit-level=high` y un job de Gitleaks (ambos `continue-on-error` mientras
> el árbol de dependencias tenga altas abiertas — convertirlos en bloqueantes
> es el siguiente paso, no un olvido).
>
> **Sigue abierto:** pinear acciones por SHA, CodeQL, migrar
> `AZURE_CREDENTIALS` a OIDC y proteger `deploy.yml` con
> `environment: production` y aprobación humana.


**Evidencia**
- `.github/workflows/ci.yml` y `.github/workflows/deploy.yml` **no declaran un bloque `permissions:`**, por lo que el `GITHUB_TOKEN` hereda el permiso por defecto de la organización, que suele ser `write-all`.
- Ninguno de los dos ejecuta `pnpm audit`, análisis estático (CodeQL/Semgrep), ni escaneo de secretos (Gitleaks/TruffleHog).
- Todas las acciones se referencian por etiqueta móvil (`actions/checkout@v4`, `azure/login@v2`, `azure/webapps-deploy@v3`, `pnpm/action-setup@v4`), no por SHA.
- `deploy.yml` se dispara en cada `push` a `main` (`:3-5`) y despliega a producción sin `environment:` ni aprobación manual.
- `deploy.yml:39` y `:93` usan `secrets.AZURE_CREDENTIALS` (service principal con secreto de larga vida) en lugar de OIDC.

**Escenario de ataque** — Un PR que modifique un script de build o una dependencia transitiva ejecuta código arbitrario en el runner con un `GITHUB_TOKEN` de escritura y, en `deploy.yml`, con credenciales de Azure con permisos sobre `bithauss-rg`. Es la cadena clásica de compromiso de la cadena de suministro, y aquí termina en producción sin puerta intermedia.

**Remediación**
1. Añadir a ambos workflows:
   ```yaml
   permissions:
     contents: read
   ```
   (y sólo lo estrictamente necesario por job).
2. Pinear las acciones por SHA completo.
3. En `ci.yml`, añadir pasos bloqueantes:
   ```yaml
   - run: pnpm audit --prod --audit-level=high
   - uses: github/codeql-action/analyze@<sha>
   - uses: gitleaks/gitleaks-action@<sha>
   ```
4. Migrar `AZURE_CREDENTIALS` a OIDC (`azure/login` con `client-id` + `tenant-id` + `subscription-id` y `permissions: id-token: write`).
5. Proteger `main` con revisión obligatoria y usar `environment: production` con aprobador humano en `deploy.yml`.
6. Añadir un job que valide RLS: aplicar las migraciones sobre un Postgres efímero y comprobar que **toda** tabla de `public` tiene `relrowsecurity = true` y al menos una política.

---

#### BH-19 · RLS de `properties` permite publicar sin pasar por la API — **MEDIA**

**Evidencia** — `packages/supabase/migrations/001_initial_schema.sql:693-702`:
```sql
create policy "Owners can insert properties" on properties for insert
  to authenticated with check (owner_id = auth.uid());
create policy "Owners can update own properties" on properties for update
  to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
```
Ninguna de las dos restringe `status`, `brc_status`, `brc_certificate_id`, `view_count` ni `lead_count`.

**Escenario de ataque** — Un vendedor con plan Básico (máximo 50 propiedades según `packages/supabase/seed/001_initial_seed.sql:8-18`) inserta directamente desde el navegador `{ owner_id: <suyo>, status: 'PUBLICADO', ... }` tantas veces como quiera: elude por completo la API (`PropertiesService.publish`, `properties.service.ts:471-494`, que es donde vivirá la comprobación de límites del plan que está construyendo el agente de membresías). Peor: puede fijar `brc_status: 'CERTIFICADO'` y `brc_certificate_id` apuntando al certificado de otra propiedad, y su anuncio mostrará el sello BRC sin haberlo obtenido. Como `brc_certificates` sólo es legible por los participantes del expediente, el fraude no se detecta desde la ficha pública.

**Remediación**
```sql
-- 025_properties_column_hardening.sql
drop policy if exists "Owners can insert properties" on properties;
create policy "Owners can insert properties" on properties for insert
  to authenticated
  with check (owner_id = auth.uid()
              and status = 'BORRADOR'
              and brc_status = 'SIN_BRC'
              and brc_certificate_id is null);

drop policy if exists "Owners can update own properties" on properties;
create policy "Owners can update own properties" on properties for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid()
              and brc_status = (select p.brc_status from properties p where p.id = properties.id)
              and brc_certificate_id is not distinct from
                  (select p.brc_certificate_id from properties p where p.id = properties.id));
```
Y que la publicación (`BORRADOR → PUBLICADO`) pase obligatoriamente por `PATCH /api/v1/properties/:id/publish`, donde se valida el plan.

---

#### BH-20 · El borrado de cuenta no elimina los objetos de Storage — **MEDIA** (cumplimiento LFPDPPP)

**Evidencia** — `apps/api/src/modules/profiles/profiles.service.ts:144-156`: `deleteAccount` llama a `supabase.auth.admin.deleteUser(userId)`. Las filas se borran por cascada (`profiles.id references auth.users(id) on delete cascade`, `001_initial_schema.sql:99`), pero **los objetos de Supabase Storage no tienen cascada**: las escrituras, INE y actas del usuario siguen en `brc-documents`, y su avatar en `avatars`.

**Escenario / riesgo de cumplimiento** — Un usuario ejerce su derecho de **Cancelación** (ARCO). BitHauss confirma el borrado. Sus documentos de identidad y su escritura pública siguen almacenados indefinidamente. Ante una verificación del INAI, es un incumplimiento directo del artículo 11 de la LFPDPPP (principio de calidad y supresión).

**Remediación**
1. Antes de `deleteUser`, listar y borrar los objetos:
   ```ts
   const { data: expedientes } = await supabase.from('brc_expedientes')
     .select('id').eq('requested_by', userId);
   for (const e of expedientes ?? []) {
     const { data: files } = await supabase.storage.from('brc-documents').list(e.id, { limit: 1000 });
     if (files?.length) await supabase.storage.from('brc-documents')
       .remove(files.map(f => `${e.id}/${f.name}`));
   }
   ```
2. **Cuidado con el conflicto legal**: un expediente con BRC emitido tiene valor probatorio y puede tener obligación de conservación. Definir una **política de retención escrita** que distinga: (a) borrado inmediato de documentos de expedientes no certificados; (b) conservación de expedientes certificados por el plazo legal aplicable, con bloqueo de acceso y aviso al titular; (c) purga automática al vencer el plazo.
3. Registrar cada supresión en `audit_logs` para poder acreditarla.

---

#### BH-21 · Enumeración de cuentas en el registro — **BAJA**

> **ESTADO: CERRADO (31-ago-2026).** `apps/web/src/lib/auth-messages.ts`
> centraliza la copia de login y registro para que no vuelvan a divergir. Un
> correo ya registrado produce exactamente el mismo mensaje que un alta nueva
> ("Revisa tu correo electrónico…"); la desambiguación ocurre por correo, donde
> sólo el dueño real de la dirección puede leerla. El login devuelve una única
> cadena para "no existe la cuenta" y "contraseña incorrecta". Hay pruebas que
> comparan ambas respuestas carácter a carácter.


**Evidencia** — `apps/web/src/app/auth/registro/page.tsx:229-230`:
```ts
if (signUpError.message.includes("already registered"))
  setError("Este correo electrónico ya está registrado. Intenta iniciar sesión.");
```
El login (`login/page.tsx:57-58`) sí lo hace bien: mensaje genérico para credenciales inválidas.

**Escenario** — Un atacante prueba una lista de correos contra `/auth/registro` y obtiene un padrón de cuentas de BitHauss para phishing dirigido ("tu certificado BRC está por vencer, inicia sesión aquí"). El límite de Supabase Auth lo ralentiza pero no lo impide.

**Remediación** — Mostrar siempre el mismo mensaje ("Te enviamos un correo para continuar con el registro") y resolver la ambigüedad por correo. Y aplicar el rate limit de BH-10 a las rutas de autenticación.

---

#### BH-22 · Contraseña mínima de 6 caracteres — **BAJA**

> **ESTADO: MITIGADO (31-ago-2026).** Mínimo elevado a 12 caracteres
> (`MIN_PASSWORD_LENGTH` en `apps/web/src/lib/auth-messages.ts`), con la
> indicación visible en el formulario. Sólo afecta a altas nuevas: nadie queda
> fuera.
>
> **Sigue abierto:** comprobación contra Have I Been Pwned y MFA obligatorio
> para `ADMIN` / `OPERADOR_BRC` / `NOTARIO`.


**Evidencia** — `apps/web/src/app/auth/registro/page.tsx:155-158`: `if (password.length < 6)`. Sin comprobación de complejidad ni contra listas de contraseñas filtradas.

**Escenario** — Credential stuffing sobre cuentas de notario o administrador. Seis caracteres es el mínimo por defecto de Supabase, no una decisión de producto.

**Remediación** — Elevar a 12 caracteres, comprobar contra la API de Have I Been Pwned (k-anonymity), y **[PENDIENTE PROD]** exigir MFA para `ADMIN`, `OPERADOR_BRC` y `NOTARIO` (Supabase Auth soporta TOTP; activar en el panel y forzar el enrolamiento en el `RolesGuard` mediante el claim `aal`).

---

#### BH-23 · `file_url` / `pdf_url` guardan `getPublicUrl()` de un bucket privado — **BAJA**

**Evidencia** — `solicitar-brc/page.tsx:372`, `expedientes/[id]/page.tsx:595`, `registro/page.tsx:139`. El propio `apps/web/src/lib/private-storage.ts:1-14` documenta el problema y lo resuelve al vuelo derivando la ruta y firmando la URL en el momento del clic (`:48-62`, TTL de 60 s: correcto).

**Riesgo** — No es una fuga: la URL "pública" de un bucket privado devuelve 400. El riesgo es de **modelo mental**: el esquema sugiere que esos documentos son públicos, y basta con que alguien marque el bucket como público en el panel (o cree un bucket nuevo por error) para convertir un dato inerte en una fuga masiva de escrituras e identificaciones.

**Remediación** — Guardar en `file_url` la **ruta del objeto** (`<expediente_id>/<tipo>/<archivo>`), no una URL. Migración de normalización + ajuste de `storagePathFromUrl` (ya soporta rutas desnudas, `private-storage.ts:41`). Y añadir un test que falle si `brc-documents` deja de ser privado.

---

#### BH-24 · `OPERADOR_BRC` puede ver perfiles de expedientes ajenos — **BAJA**

> **ESTADO: CERRADO (31-ago-2026).** `031_security_rbac_hardening.sql` añade la
> correlación que faltaba: `and (e.assigned_operator_id = auth.uid() or
> public.is_admin())`.


**Evidencia** — `packages/supabase/migrations/003_security_hardening.sql:79-94`: el `exists` no correlaciona el expediente con el operador que consulta.
```sql
using (public.is_operador_brc() and (exists (
  select 1 from brc_expedientes e
   where (e.requested_by = profiles.id or e.assigned_notary_id = profiles.id
          or e.assigned_operator_id = profiles.id))))
```
Basta con que el perfil participe en **algún** expediente, no en uno del operador.

**Riesgo** — Un operador BRC ve los datos personales (nombre, correo, teléfono, RFC, dirección) de todos los solicitantes y notarios de la plataforma, no sólo de sus casos. Es personal interno, así que el riesgo es de mínimo privilegio y de LFPDPPP, no de intrusión externa.

**Remediación** — Añadir la correlación:
```sql
and (e.assigned_operator_id = auth.uid() or public.is_admin())
```

---

#### BH-25 · CORS acepta peticiones sin cabecera `Origin` — **BAJA**

**Evidencia** — `apps/api/src/main.ts:55`: `if (!origin) return callback(null, true); // same-origin / non-browser`.

**Riesgo** — Es el comportamiento habitual y no crea una vulnerabilidad de navegador (CORS no protege contra clientes que no son navegadores). Se documenta para dejar claro que **CORS no es un control de acceso**: la API está expuesta en `https://bithauss-api.azurewebsites.net` y cualquiera puede llamarla con `curl`. La autenticación y el `RolesGuard` son la única defensa real, lo cual está bien diseñado.

**Remediación** — Ninguna a nivel de código. **[PENDIENTE PROD]** restringir el acceso de red al App Service de la API para que sólo acepte tráfico de Azure Front Door:
```bash
az webapp config access-restriction show -n bithauss-api -g bithauss-rg
```

---

#### BH-26 · `deploy.zip` de 48 MB y PDF en el árbol de trabajo — **BAJA** (higiene)

**Evidencia** — `deploy.zip` (48 927 162 bytes), `BithaussRealState-InvDeck-rev2.pdf` (31 MB) y `MODULO NOTARIAL BITHAUSS.pdf` en la raíz. `git check-ignore -v` confirma que los tres están cubiertos por `.gitignore:58-59` (`*.pdf`, `*.zip`) y `git ls-files` confirma que **no están versionados**.

Contenido del ZIP (verificado con `unzip -l`, sin extraer): 8 192 entradas, todas bajo `node_modules/.pnpm/**` más `apps/web/package.json`. Corresponde a un empaquetado de despliegue de `next@15.5.12` (versión anterior a la del lockfile actual, 15.5.18). **No contiene ningún `.env`, `.pem`, `.key` ni credencial.**

**Riesgo** — No hay exposición. El riesgo es operativo: un artefacto de despliegue obsoleto en la máquina de un desarrollador puede acabar subiéndose a producción por error o mandarse por correo. Y el deck de inversión de 31 MB es material confidencial de negocio en un directorio sincronizado con iCloud.

**Remediación** — Borrar `deploy.zip` (el despliegue lo genera `deploy.yml:86-89`), mover los PDF a un repositorio documental con control de acceso, y añadir a `.gitignore` un patrón explícito `deploy-api/` para el directorio que produce el workflow.

---

#### BH-27 · No existe la ruta `/privacidad`; sin política de retención — **BAJA** (cumplimiento LFPDPPP)

**Evidencia**
- El aviso de privacidad existe y es de buena calidad: `apps/web/src/components/layout/legal-modal.tsx:100-132`, con responsable, finalidades, derechos ARCO (`:127-128`), correo `privacidad@bithauss.com` y plazo de veinte días hábiles. Hay casilla de consentimiento en el registro (`registro/page.tsx:148`, `:677-679`).
- Pero el propio aviso remite dos veces a `www.bithauss.com/privacidad` (`legal-modal.tsx:128`, `:132`) y **esa ruta no existe**: `apps/web/src/app` contiene `admin, api, auth, certificado, como-funciona, dashboard, nosotros, propiedades` y nada más.
- El formulario público de contacto (`propiedades/[id]/page.tsx:302-332`) recoge nombre, correo, teléfono y mensaje **sin casilla de consentimiento ni enlace al aviso** (sólo menciona "términos de servicio" en `:484`).
- No hay ninguna declaración de plazos de conservación para las escrituras, INE y actas de `brc-documents`.

**Remediación**
1. Crear `apps/web/src/app/privacidad/page.tsx` con el aviso integral y el formulario ARCO, o corregir el aviso para que apunte al modal.
2. Añadir consentimiento explícito y enlace al aviso en el formulario de leads.
3. Publicar la política de retención (ver BH-20) como anexo del aviso, con plazos por tipo de documento.
4. Declarar las transferencias a encargados: Supabase (EE. UU.), Azure (región a confirmar), Sentry, Resend, Stripe, OpenStreetMap/Nominatim, CoinGecko.
5. Designar formalmente al responsable de datos personales y publicar el canal ARCO.

---

## 3. Plan de endurecimiento por fases

Roles sugeridos: **BE** = backend/NestJS · **FE** = frontend/Next · **DB** = Supabase/SQL · **DevOps** = Azure/GitHub · **Legal** = producto + asesoría jurídica.

### Fase 0 — Bloqueantes antes de producción

Ninguno de estos puede quedar abierto en el momento del lanzamiento.

| # | Tarea | Hallazgo | Esfuerzo | Responsable |
|---|---|---|---|---|
| 0.1 | Quitar `NOTARIO` del auto-registro + flujo de verificación por admin + `is_verified` en el guard | BH-01 | 1.5 d | DB + BE + FE |
| 0.2 | Auditar y corregir los roles privilegiados existentes en la base de datos | BH-01 | 0.5 d | DB |
| 0.3 | `BRC_VERIFY_SECRET` sin fallback + variables faltantes en `deploy.yml` (`SUPABASE_SERVICE_ROLE_KEY`, `SENTRY_DSN`) | BH-02 | 0.5 d | DevOps |
| 0.4 | Folio del BRC generado por la API con `next_brc_certificate_number()` | BH-03 | 0.5 d | BE + FE |
| 0.5 | Aplicar `is_active` en `AuthGuard` + revocar sesión al desactivar | BH-04 | 1 d | BE |
| 0.6 | Cerrar `with check` por columna en `brc_documents` y `properties` | BH-05, BH-19 | 1 d | DB |
| 0.7 | Proyección pública explícita en `properties` + respetar `show_address` | BH-06 | 1 d | BE |
| 0.8 | Recortar la respuesta de `/api/verify/:id` (sin `owner_id`, dirección ni precio) | BH-09 | 0.5 d | FE |
| 0.9 | `pnpm up next@^15.5.21 multer@^2.2.0` + `pnpm audit --prod` limpio de altas | BH-08 | 0.5 d | DevOps |
| 0.10 | Límites de tipo y tamaño en el bucket `brc-documents` + `contentType` fijado | BH-07 | 1 d | DB + FE |
| 0.11 | Versionar las políticas de Storage de `avatars` y `properties` y anclarlas a `auth.uid()` | BH-13 | 1 d | DB |
| 0.12 | `permissions: contents: read` + `pnpm audit` + Gitleaks en CI | BH-18 | 0.5 d | DevOps |
| 0.13 | `beforeSend` en las 4 configuraciones de Sentry + desactivar Session Replay | BH-17 | 0.5 d | FE + BE |
| 0.14 | Verificar `amount_total` y `session.id` en el webhook + expirar la sesión anterior al recotizar | BH-28 | 1 d | BE |
| 0.15 | No acreditar `checkout.session.completed` con `payment_status !== 'paid'` (OXXO/SPEI) | BH-29 | 0.5 d | BE |
| 0.16 | Registrar `PaymentsModule`/`MembershipsModule`, `@SkipThrottle()` en el webhook, validar `livemode` | BH-31 | 0.5 d | BE |

**Total estimado: ~12 días-persona.**

### Fase 1 — Primeras dos semanas tras el lanzamiento

| # | Tarea | Hallazgo | Esfuerzo | Responsable |
|---|---|---|---|---|
| 1.1 | Firma criptográfica real del BRC (Ed25519 + Key Vault + clave pública publicada) y ruta `/verify/[id]` | BH-03 | 4 d | BE + FE |
| 1.2 | Rate limiting distribuido (Redis) + `X-Forwarded-For` validado contra el proxy | BH-10 | 2 d | BE + DevOps |
| 1.3 | Captcha y límite por IP en el formulario de leads | BH-10 | 1 d | FE |
| 1.4 | Restringir OCR por rol + cuota diaria por cuenta + alerta de presupuesto Azure | BH-14 | 1 d | BE + DevOps |
| 1.5 | `certifyExpediente` transaccional, con validación de estado e idempotencia | BH-15 | 2 d | BE + DB |
| 1.6 | Registrar `AuditLogInterceptor` y enviar a Log Analytics | BH-16 | 1 d | BE + DevOps |
| 1.7 | CSP con nonce; eliminar `unsafe-eval` | BH-11 | 2 d | FE |
| 1.8 | Zod en frontera cliente + `check` de longitud en columnas de texto libre | BH-12 | 2 d | FE + DB |
| 1.9 | MFA obligatorio para ADMIN / OPERADOR_BRC / NOTARIO; contraseña ≥ 12 + HIBP | BH-22 | 2 d | BE + FE |
| 1.10 | Mensajes genéricos en el registro | BH-21 | 0.5 d | FE |
| 1.11 | Corregir la política de perfiles de `OPERADOR_BRC` | BH-24 | 0.5 d | DB |
| 1.12 | Azure Front Door + WAF + restricción de red en los App Service | BH-10, BH-25 | 2 d | DevOps |
| 1.13 | Ruta `/privacidad`, consentimiento en leads, política de retención publicada | BH-20, BH-27 | 2 d | Legal + FE |
| 1.14 | Borrado de cuenta que purga Storage según la política de retención | BH-20 | 1.5 d | BE |
| 1.15 | Migrar `AZURE_CREDENTIALS` a OIDC; pinear acciones por SHA; `environment: production` con aprobación | BH-18 | 1 d | DevOps |

**Total estimado: ~25 días-persona.**

### Fase 2 — Continuo

| # | Tarea | Cadencia | Responsable |
|---|---|---|---|
| 2.1 | Revisión de dependencias (Dependabot/Renovate) y `pnpm audit --prod` sin altas | Semanal | DevOps |
| 2.2 | Revisión de RLS: toda tabla nueva con RLS + política, verificado por test en CI | Cada PR | DB |
| 2.3 | Revisión de roles privilegiados en `profiles` | Mensual | DB + Producto |
| 2.4 | Rotación de llaves (Supabase `service_role`, `BRC_VERIFY_SECRET`, claves Azure OCR/OpenAI, Stripe) | Trimestral | DevOps |
| 2.5 | Prueba de restauración de respaldos (restaurar y verificar, no sólo comprobar que existe el respaldo) | Trimestral | DevOps |
| 2.6 | Revisión del aviso de privacidad y del registro de encargados | Semestral | Legal |
| 2.7 | Pentest externo con alcance en BRC, pagos y RLS | Anual + antes de cada hito grande | Externo |
| 2.8 | Simulacro de respuesta a incidentes (tabletop) | Semestral | Todo el equipo |
| 2.9 | Normalizar `file_url` a rutas de objeto y eliminar `getPublicUrl` de buckets privados | Deuda técnica | BE + DB |
| 2.10 | Migrar los servicios de la API de `getAdminClient()` a `getClientForUser()` donde no se requiera saltar RLS | Deuda técnica | BE |

---

### 3.4 Checklist obligatorio del módulo de pagos (Stripe)

> **Actualización durante la auditoría.** El módulo `apps/api/src/modules/payments/` y la migración `026_payments_stripe.sql` fueron creados por otro agente mientras se redactaba este documento. Se auditaron y el resultado está en **3.5**. El checklist siguiente se conserva como criterio de aceptación; 3.5 dice qué puntos ya se cumplen y cuáles no.

Estos puntos son de cumplimiento obligatorio antes de aceptar el primer cobro real:

1. **El monto se calcula íntegramente en el servidor.** Nunca aceptar `amount`, `currency`, `price`, `tariff_id` ni `discount` del cliente. El servidor lee la propiedad, busca la tarifa en `brc_tariffs` y calcula. El cliente sólo envía identificadores.
2. **Verificación de firma del webhook** con `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`. Requiere el **cuerpo crudo**: en NestJS hay que registrar el `rawBody` (`NestFactory.create(AppModule, { rawBody: true })`) porque `main.ts:12` hoy usa `bodyParser: true` y el JSON ya viene parseado. Sin esto la firma nunca validará.
3. **La ruta del webhook debe ser `@Public()`** (Stripe no envía JWT) **y estar excluida del `ThrottlerGuard`**, pero protegida exclusivamente por la firma. Nunca marcarla pública sin verificar firma.
4. **Idempotencia en dos direcciones.** Hacia Stripe, enviar `Idempotency-Key` en la creación de sesiones. Desde Stripe, guardar `event.id` en una tabla `stripe_events (id text primary key, processed_at timestamptz)` e ignorar los repetidos: Stripe reintenta y el mismo evento llega varias veces.
5. **La verdad la fija el webhook, no el redirect.** El regreso a `success_url` sólo es una señal de interfaz. El expediente pasa a "pagado" únicamente al recibir `checkout.session.completed` con `payment_status === 'paid'`.
6. **Verificar el monto en el webhook**: comparar `session.amount_total` contra el precio recalculado en servidor antes de dar el servicio por pagado.
7. **No registrar nunca** PAN, CVV, `client_secret`, ni la clave secreta de Stripe. Añadir `stripe|card|pan|cvv|client_secret` a las reglas de scrubbing de Sentry (BH-17) y al logger.
8. **Escrituras sólo con `service_role`.** `payments` y `subscriptions` no deben tener política de `insert`/`update` para `authenticated` — hoy correctamente sólo tienen `select` (`001_initial_schema.sql:755-772`). Mantenerlo así.
9. **Separar claves de test y de producción** y verificar `event.livemode` en el webhook.
10. **Reconciliación diaria**: contrastar `payments` contra la API de Stripe y alertar sobre discrepancias.
11. **`STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` sólo en el App Service de la API.** La publicable (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) es la única que puede ir al bundle.
12. **Datos fiscales mexicanos**: `billing_profiles` ya tiene `rfc`, `cfdi_use`, `tax_regime` (`001_initial_schema.sql:342-354`). Definir el flujo de CFDI y quién es el emisor antes de cobrar.

---

### 3.5 Auditoría del módulo de pagos recién incorporado

**Veredicto general: es el módulo mejor construido del repositorio desde el punto de vista de seguridad.** Cumple 9 de los 12 puntos del checklist anterior sin que hubiera que pedirlo. Quedan tres huecos, uno de ellos explotable.

#### Lo que está bien hecho (verificado)

| Checklist | Evidencia |
|---|---|
| 1 · Monto calculado en servidor | `payments/dto/create-brc-checkout.dto.ts:13-16` — el DTO sólo acepta `expediente_id`; con `forbidNonWhitelisted` (`main.ts:30`) un intento de colar `amount` devuelve 400. `payments.service.ts:120-125` recalcula con `calculateBrcPrice` |
| 1b · Descuento de membresía leído en servidor | `payments.service.ts:57-72` `getMembershipTier` consulta `subscriptions`; el cliente no puede reclamar PLATINO |
| 2 · Firma del webhook | `stripe.client.ts:124-188` — HMAC-SHA256 sobre `${t}.${rawBody}`, comparación con `timingSafeEqual` (`:165`), soporte de múltiples `v1` para rotación, y **ventana de tolerancia de 300 s** (`:174-176`) que bloquea el replay. Implementación correcta, sin depender del SDK |
| 2b · `rawBody` habilitado | `apps/api/src/main.ts:16` — `rawBody: true`. Sin esto la firma nunca validaría |
| 3 · Webhook `@Public()` pero autenticado por firma | `payments.controller.ts:44-68`; el error de firma se mapea a 400 y no revela el motivo (`:63-65`) |
| 4 · Idempotencia bidireccional | Hacia Stripe: `Idempotency-Key` en `stripe.client.ts:223` y `payments.service.ts:153`. Desde Stripe: `claimEvent` (`payments.service.ts:301-317`) hace `insert` y trata `23505` como duplicado — **inserta primero en vez de consultar-luego-escribir**, que es lo correcto frente a redeliveries concurrentes; respaldado por `026_payments_stripe.sql:120` (índice único) |
| 5 · La verdad la fija el webhook | `payments.service.ts:337-373`; el `success_url` (`:143`) sólo lleva un parámetro de interfaz |
| 8 · Escrituras sólo con `service_role` | `026_payments_stripe.sql:167-173` — `payments` sólo tiene política de `select`; `stripe_webhook_events` no tiene ninguna política, deliberadamente |
| 11 · Claves sólo en el servidor | `stripe.client.ts:196-202` lee `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` vía `ConfigService`; ninguna con prefijo `NEXT_PUBLIC_` |
| — · Versión de API fijada | `stripe.client.ts:21` — `2024-06-20` |
| — · Degradación limpia | `payments.service.ts:87-91` devuelve 503 si Stripe no está configurado, en vez de romper el flujo |

#### BH-28 · Una sesión de Checkout antigua sigue siendo válida tras recotizar — **ALTA** (nuevo)

**Evidencia** — `payments.service.ts:181-243` `upsertPendingPayment` **reutiliza** la fila `PENDING` del expediente y le sobreescribe el importe (`:213-222`), pero **no cancela la sesión de Stripe anterior** (`payments.stripe_checkout_session_id` se pisa en `:162-165`). Y `markPaymentCompleted` (`:337-356`) marca `COMPLETED` a partir de `metadata.payment_id` **sin comparar nunca `session.amount_total` contra `payments.total_amount`** — el punto 6 del checklist no está implementado.

**Escenario de ataque** — El propietario pone el precio de su inmueble en 1 MXN, llama a `POST /payments/brc/checkout` y obtiene la sesión A por 12 109.16 MXN (tramo "Hasta 5 mdp"). Sin pagarla, edita la propiedad a 45 000 000 MXN (puede hacerlo desde el navegador, ver BH-19) y vuelve a pedir checkout: la fila `PENDING` se actualiza a ~60 500 MXN y se crea la sesión B. Entonces **paga la sesión A**, que sigue abierta. El webhook llega con `metadata.payment_id` apuntando a la misma fila, y como nadie compara importes, la fila pasa a `COMPLETED` y el expediente a `PAGADO`. Se certifica un inmueble de 45 millones por el precio del tramo más bajo: **una diferencia de ~48 000 MXN por operación.**

**Remediación**
1. Comparar en el webhook, antes de completar:
   ```ts
   const amountTotal = Number(event.data.object.amount_total ?? 0);
   const { data: row } = await supabase.from('payments')
     .select('total_amount, currency, stripe_checkout_session_id').eq('id', paymentId).single();
   if (!row || toStripeMinorUnits(row.total_amount) !== amountTotal
       || row.stripe_checkout_session_id !== event.data.object.id) {
     this.logger.error(`Importe o sesión no coinciden para ${paymentId}`);
     throw new BadRequestException('Importe no coincide');   // deja el pago sin acreditar
   }
   ```
2. Expirar la sesión anterior al recotizar: `POST /v1/checkout/sessions/{id}/expire`.
3. Congelar el precio: guardar `property_value_mxn` en la fila de `payments` y rechazar el checkout si el valor de la propiedad cambió desde la cotización.
4. Cerrar BH-19 para que el precio de la propiedad no pueda editarse libremente desde el navegador.

#### BH-29 · `checkout.session.completed` no comprueba `payment_status` (OXXO/SPEI) — **ALTA** (nuevo)

**Evidencia** — `payments.service.ts:280-284`: `checkout.session.completed` desemboca directamente en `markPaymentCompleted`, que no lee `payment_status` del objeto de sesión.

**Escenario** — En México, los métodos asíncronos (OXXO y transferencia SPEI) son habituales. Con ellos, Stripe emite `checkout.session.completed` con `payment_status: 'unpaid'` **en el momento en que se genera el comprobante**, y el dinero puede tardar días o no llegar nunca. Con el código actual, el expediente queda `PAGADO` y el trabajo notarial arranca contra un pago que no existe. Para eso está precisamente `checkout.session.async_payment_succeeded`, que el módulo ya escucha (`:282`) — sólo falta no acreditar en el evento prematuro.

**Remediación**
```ts
const st = event.data.object as { payment_status?: string };
if (event.type === 'checkout.session.completed' && st.payment_status !== 'paid') {
  this.logger.log(`Sesión completada pero aún no pagada (${st.payment_status}); se espera async_payment_succeeded`);
  return;   // el pago se acreditará en checkout.session.async_payment_succeeded
}
```
Y marcar la fila como `AWAITING_PAYMENT` para que la interfaz lo comunique al usuario.

#### BH-30 · El payload completo de Stripe se guarda indefinidamente — **MEDIA** (nuevo)

**Evidencia** — `payments.service.ts:303-307` guarda `payload: event` completo en `stripe_webhook_events`. El objeto de una sesión de Checkout incluye `customer_details` con nombre, correo, teléfono y dirección de facturación del pagador.

**Riesgo** — Datos personales acumulados sin finalidad declarada ni plazo de conservación (LFPDPPP, mismo problema que BH-20). La tabla no es legible por ningún cliente (`026:171-173`, correcto), pero cualquier compromiso del `service_role` la expone entera. No hay tarjeta ni PAN — Stripe Checkout nunca los envía — así que el punto 7 del checklist se cumple en lo esencial.

**Remediación** — Guardar sólo `{ id, type, created, data.object.id, amount_total, currency, payment_status, metadata }`, o purgar `payload` a los 90 días con un job programado. Añadir `customer_details` a las reglas de scrubbing de Sentry.

#### BH-31 · `PaymentsModule` y `MembershipsModule` no están registrados — **MEDIA** (nuevo, funcional)

**Evidencia** — `apps/api/src/app.module.ts:33-39` importa `HealthModule, AuthModule, ProfilesModule, PropertiesModule, OcrModule, AdminModule, BrcModule`. **No** importa `PaymentsModule` ni `MembershipsModule`; el propio `payments.module.ts:9-11` lo advierte. Mientras tanto, el cliente ya llama a `POST /api/v1/payments/brc/checkout` (`solicitar-brc/page.tsx:532`), que hoy devuelve 404; el `catch` lo convierte en `null` (`:546-548`) y el usuario simplemente no ve el botón de pago.

**Remediación** — Al conectarlos: (a) importar ambos módulos; (b) excluir la ruta del webhook del `ThrottlerGuard` (Stripe reintenta en ráfagas y un 429 se cuenta como fallo de entrega): `@SkipThrottle()` en `handleStripeWebhook`; (c) verificar `event.livemode` contra `NODE_ENV` para que un webhook de test no acredite pagos en producción; (d) mover la reclamación del `event.id` a **después** de despachar los tipos conocidos, o excluir la rama `default` de `claimEvent` (`payments.service.ts:290-292`), porque hoy un evento no manejado queda reclamado y no se reprocesará si mañana se añade su handler.


---

## 4. Checklist de despliegue seguro

### 4.1 Variables de entorno

| Variable | Dónde | ¿Está hoy? | Notas |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web (build + runtime) | Sí | Pública por diseño |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web (build + runtime) | Sí | Pública por diseño; su seguridad **depende enteramente de RLS** |
| `SUPABASE_SERVICE_ROLE_KEY` | web (runtime) y api | Ya en `deploy.yml` · **[PENDIENTE PROD] cargar el secreto** | Necesaria para `/api/verify`; nunca con prefijo `NEXT_PUBLIC_`. El arranque de la web falla si falta |
| `BRC_VERIFY_SECRET` | web (runtime) | Ya en `deploy.yml` · **[PENDIENTE PROD] cargar el secreto** | BH-02; `openssl rand -hex 32`. **Sin valor por defecto**: la ruta responde 500 explícito |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | web + api | Ya en `deploy.yml` · opcional | Sin ella, Sentry no se inicializa (no-op limpio) |
| `API_URL` | web (build + runtime) | Ya en `deploy.yml` | Destino del rewrite `/api/v1/*`; validado contra allowlist (BH-08) |
| `API_REWRITE_ALLOWED_HOSTS` | web | Opcional | Hosts adicionales permitidos como destino del rewrite |
| `RATE_LIMIT_PROXY_DEPTH` | web | Opcional (por defecto 1) | Nº de proxies delante. **Poner 2 al activar Azure Front Door** (BH-10) |
| `AZURE_DOC_INTELLIGENCE_KEY`, `AZURE_OPENAI_KEY` | api | Sí | Rotar trimestralmente |
| `FRONTEND_URL` | api | Sí | Obligatoria en producción (`main.ts:44-46`) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | api | Pendiente | Nunca en el bundle |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | web | Pendiente | Publicable |
| `REDIS_URL` | web + api | Pendiente | Para el rate limiting de fase 1 |

Verificación: `az webapp config appsettings list -n bithauss-web -g bithauss-rg --query "[].name" -o tsv` (y lo mismo para `bithauss-api`). Migrar todos los secretos a **Azure Key Vault** con referencias `@Microsoft.KeyVault(...)` en lugar de valores literales en App Settings.

### 4.2 Rotación de llaves

- **Inmediata (antes del lanzamiento):** `SUPABASE_SERVICE_ROLE_KEY` — estuvo en el disco de al menos un desarrollador en un directorio sincronizado con iCloud; asumir exposición y rotar. Crear `BRC_VERIFY_SECRET` nuevo (nunca reutilizar el valor del repositorio).
- **Trimestral:** claves de Azure OCR/OpenAI, `BRC_VERIFY_SECRET`, credenciales de Stripe.
- **Anual o ante incidente:** JWT secret del proyecto Supabase (invalida todas las sesiones — planificar ventana).
- Documentar cada rotación en un registro con fecha, quién y por qué.

### 4.3 WAF y red

- **[PENDIENTE PROD]** Poner **Azure Front Door Premium con WAF** delante de `bithauss-web`, con el ruleset gestionado de OWASP en modo `Prevention`, límite de tasa en el borde (p. ej. 100 req/min por IP), y bloqueo geográfico si el negocio es sólo México.
- Restringir el acceso de red a ambos App Service para que sólo acepten tráfico de Front Door:
  `az webapp config access-restriction add -n bithauss-api -g bithauss-rg --rule-name afd --service-tag AzureFrontDoor.Backend --priority 100 --action Allow`
- Verificar que las cabeceras de seguridad sobreviven al paso por Front Door:
  `curl -sI https://<dominio> | grep -iE "content-security-policy|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy|permissions-policy"`
- Deshabilitar el sitio SCM/Kudu público de ambos App Service.
- **[PENDIENTE PROD]** Confirmar en Supabase: SSL forzado, Network Restrictions activas si aplica, y que la API de Postgres directa no está expuesta a internet abierto.

### 4.4 Respaldos y restauración

- **[PENDIENTE PROD]** Verificar el plan de Supabase: PITR (Point-in-Time Recovery) requiere plan Pro o superior. Confirmar con `supabase projects list` y en el panel → Database → Backups.
- Los respaldos de Postgres **no incluyen Storage**. Configurar una copia programada del bucket `brc-documents` a Azure Blob Storage con inmutabilidad (WORM) — son documentos legales.
- **Probar la restauración trimestralmente** en un proyecto Supabase separado: restaurar, aplicar migraciones, correr smoke tests. Un respaldo no probado no es un respaldo.
- Documentar RPO y RTO objetivo y contrastarlos con el resultado real de la prueba.

### 4.5 Monitoreo y alertas

| Señal | Umbral | Canal |
|---|---|---|
| 5xx en la API | > 1 % durante 5 min | PagerDuty / Slack |
| 401/403 por usuario | > 20/min | Slack seguridad |
| Cambios en `profiles.role` | cualquiera | Slack seguridad (trigger de `audit_logs`) |
| Emisión de certificados BRC | cualquiera | Slack negocio |
| Fallos de firma del webhook de Stripe | cualquiera | PagerDuty |
| Coste de Azure OCR/OpenAI | > presupuesto diario | Azure Budget Alert |
| Volumen de Storage | > umbral | Azure Monitor |
| Certificado TLS | < 30 días para vencer | Azure Monitor |

### 4.6 Plan de respuesta a incidentes

1. **Detección** — Alertas de 4.5 más un canal `security@bithauss.com` publicado (política de divulgación responsable).
2. **Contención inmediata** — Rotar `SUPABASE_SERVICE_ROLE_KEY`; en caso extremo, rotar el JWT secret (cierra todas las sesiones); poner el WAF en modo bloqueo agresivo; desactivar cuentas comprometidas (**una vez que BH-04 esté corregido**, porque hoy desactivar no hace nada).
3. **Evidencia** — Preservar `audit_logs`, `brc_expediente_logs` y los logs de Log Analytics antes de cualquier remediación. `audit_logs` es append-only por diseño (`010:265-278`), lo cual ayuda.
4. **Notificación LFPDPPP** — Ante vulneración de datos personales, la ley exige informar **de forma inmediata** al titular. Tener una plantilla lista y un responsable designado.
5. **Post-mortem** sin culpables, con acciones concretas y fecha, en un plazo de cinco días hábiles.
6. **Contactos:** responsable técnico, responsable de datos personales, asesoría legal, soporte de Supabase, soporte de Azure. Mantener la lista fuera de los sistemas que podrían estar comprometidos.

---

## 5. Controles recurrentes

### 5.1 En CI (cada PR)

```yaml
permissions:
  contents: read

- run: pnpm audit --prod --audit-level=high        # falla el build ante altas
- uses: gitleaks/gitleaks-action@<sha>             # secretos en el diff y en el historial
- uses: github/codeql-action/analyze@<sha>         # SAST JavaScript/TypeScript
- run: pnpm turbo run lint typecheck test
- run: node scripts/check-rls.mjs                  # ver 5.2
```

### 5.2 Verificación automatizada de RLS

Script que aplica las migraciones sobre un Postgres efímero y falla si:

```sql
-- (a) tabla de public sin RLS
select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

-- (b) tabla con RLS pero sin ninguna política (denegación total silenciosa)
select tablename from pg_tables t where schemaname='public'
   and not exists (select 1 from pg_policies p
                    where p.schemaname='public' and p.tablename=t.tablename);

-- (c) política permisiva
select tablename, policyname from pg_policies
 where schemaname='public' and (qual = 'true' or with_check = 'true');

-- (d) función SECURITY DEFINER sin search_path fijo
select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef
   and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c
                    where c like 'search_path=%');
```

Excepciones justificadas hoy: las políticas `using (true)` de `brc_tariffs` y `brc_document_types` (`003:218`, `:227`) son datos de referencia legibles por cualquier autenticado — mantener una allowlist explícita en el script.

### 5.3 Cadencia

| Control | Frecuencia |
|---|---|
| SAST + secret scanning + `pnpm audit` | Cada PR |
| Verificación automatizada de RLS | Cada PR |
| Revisión manual de nuevas políticas RLS | Cada PR que toque `packages/supabase/migrations/` |
| Revisión de dependencias mayores | Semanal |
| Revisión de roles privilegiados en producción | Mensual |
| Rotación de llaves | Trimestral |
| Prueba de restauración de respaldos | Trimestral |
| Simulacro de incidente | Semestral |
| **Pentest externo** | Anual, y obligatoriamente antes de: (a) el lanzamiento público, (b) el primer cobro real con Stripe, (c) la integración con una notaría o registro público real |

El alcance del pentest debe incluir explícitamente: bypass de RLS con la llave anónima, escalada de roles, IDOR en expedientes y propiedades, falsificación de certificados BRC, y manipulación del flujo de pago.

---

## 6. Anexo — Matriz de amenazas STRIDE

Notación: **[V]** verificado en el código · **[M]** mitigado hoy · **[A]** abierto.

### 6.1 Registro e inicio de sesión

| STRIDE | Amenaza | Estado | Referencia |
|---|---|---|---|
| **S** Suplantación | Auto-asignarse el rol `NOTARIO` en el registro | **[A] Crítica** | BH-01 · `registro/page.tsx:223`, `003:125-131` |
| **S** | Credential stuffing (contraseñas de 6 caracteres, sin MFA) | **[A] Baja** | BH-22 |
| **S** | Fijación de sesión | **[M]** Supabase rota tokens en cada login | `client.ts:39-62` |
| **T** Manipulación | Editar el propio rol tras el registro | **[M]** | `003:108-115` compara contra el rol vigente |
| **R** Repudio | "Yo no me registré como notario" | **[A] Media** | BH-16 · no hay log HTTP con IP |
| **I** Divulgación | Enumeración de cuentas | **[A] Baja** | BH-21 · `registro/page.tsx:229` |
| **D** Denegación | Fuerza bruta sobre el login | **[M] parcial** | Rate limit de Supabase Auth; sin capa propia (BH-10) |
| **E** Elevación | Cuenta desactivada que sigue operando | **[A] Alta** | BH-04 |

### 6.2 Alta y publicación de una propiedad

| STRIDE | Amenaza | Estado | Referencia |
|---|---|---|---|
| **S** | Publicar en nombre de otro | **[M]** | `001:693-696` `with check (owner_id = auth.uid())` |
| **T** | Fijar `status='PUBLICADO'` saltando el límite de plan | **[A] Media** | BH-19 |
| **T** | Fijar `brc_status='CERTIFICADO'` sin certificado | **[A] Media** | BH-19 |
| **T** | Subir un SVG/HTML activo como foto | **[A] Alta** | BH-07 · bucket `properties` público |
| **R** | Negar un cambio de precio | **[M]** | `010_history_audit.sql` registra cambios de fila |
| **I** | Leer un borrador ajeno vía la API pública | **[A] Alta** | BH-06 · `properties.service.ts:331-345` |
| **I** | Obtener la dirección exacta pese a `show_address=false` | **[A] Alta** | BH-06 |
| **D** | Scraping masivo del catálogo | **[A] Alta** | BH-10 · sin límite en `GET /properties` |
| **E** | Editar la propiedad de otro | **[M]** | `properties.service.ts:179-200` `verifyOwnership` |

### 6.3 Expediente BRC con documentos legales

| STRIDE | Amenaza | Estado | Referencia |
|---|---|---|---|
| **S** | Hacerse pasar por notario asignado | **[M]** | `brc.service.ts:43-66` `assertNotaryOnExpediente` |
| **S** | Ser notario sin serlo | **[A] Crítica** | BH-01 |
| **T** | Insertar documentos con `status='VALIDADO'` | **[A] Alta** | BH-05 · `022:16-27` |
| **T** | Insertar dictamen jurídico y nombre de dictaminador falsos | **[A] Alta** | BH-05 · `024:38-54` sin restricción |
| **T** | Escribir fuera de la carpeta del expediente en Storage | **[M]** | `019:92-104`, `022:46-58` anclan `foldername(name)[1]` |
| **R** | Negar el rechazo de un documento | **[M]** | `brc.service.ts:149-154` escribe `brc_expediente_logs` |
| **I** | Leer la escritura o el INE de otro | **[M]** | `001:830-843` + `019:106-122` (políticas de tabla y de Storage alineadas) |
| **I** | Enumerar objetos del bucket | **[M]** | Bucket privado + URL firmadas de 60 s (`private-storage.ts:18`) — **[PENDIENTE PROD]** confirmar `public: false` |
| **I** | Documentos legales grabados por Session Replay de Sentry | **[A] Media** | BH-17 |
| **D** | Llenar el bucket sin límite de tamaño | **[A] Alta** | BH-07 |
| **E** | Un solicitante certifica su propio expediente | **[M]** | `019:46-49` limita `with check` a `BORRADOR`/`EN_REVISION` |

### 6.4 Emisión del certificado

| STRIDE | Amenaza | Estado | Referencia |
|---|---|---|---|
| **S** | Emitir a nombre de otro notario | **[M]** | `brc.service.ts:241` fija `issued_by` desde el token |
| **T** | Elegir el folio del certificado | **[A] Crítica** | BH-03 · `expedientes/[id]/page.tsx:208` |
| **T** | `pdf_url` apuntando a un documento externo | **[A] Media** | BH-15 · `brc.service.ts:25` sin validar |
| **T** | Certificar un expediente en estado incorrecto | **[A] Media** | BH-15 |
| **R** | Negar la emisión | **[M]** | `brc.service.ts:271-277` `CERTIFICADO_EMITIDO` |
| **I** | Leer certificados ajenos | **[M]** | `003:271-285` |
| **D** | Colisión de folio que bloquea la emisión | **[A] Media** | BH-03 · `Math.random()` + índice `unique` |
| **E** | Escribir en `brc_certificates` sin ser operador | **[M]** | `003:286-289` |

### 6.5 Pago con Stripe

| STRIDE | Amenaza | Estado | Referencia |
|---|---|---|---|
| **S** | Webhook falsificado | **[M]** | `stripe.client.ts:155-170` HMAC + `timingSafeEqual` |
| **S** | Replay de un webhook válido capturado | **[M]** | `stripe.client.ts:174-176` ventana de 300 s |
| **T** | Alterar el monto desde el cliente | **[M]** | `create-brc-checkout.dto.ts:13-16` + `forbidNonWhitelisted` |
| **T** | Reclamar un descuento de membresía falso | **[M]** | `payments.service.ts:57-72` lee el tier en servidor |
| **T** | Pagar una cotización vieja tras subir el precio | **[A] Alta** | BH-28 · `payments.service.ts:337-356` |
| **T** | Marcar como pagado con OXXO sin que llegue el dinero | **[A] Alta** | BH-29 · `payments.service.ts:280-284` |
| **R** | Disputa sobre un cobro | **[A] Media** | Falta reconciliación diaria (3.4, punto 10) |
| **I** | PAN o secretos en logs | **[M]** | Checkout no expone PAN; `stripe.client.ts:236` sólo registra el mensaje de error |
| **I** | PII del pagador retenida sin plazo | **[A] Media** | BH-30 · `payments.service.ts:303-307` |
| **D** | Reproceso de eventos duplicados | **[M]** | `payments.service.ts:301-317` + `026:120` índice único |
| **D** | 429 del throttler ante ráfagas de reintentos de Stripe | **[A] Media** | BH-31 · falta `@SkipThrottle()` |
| **E** | Escribir directamente en `payments` | **[M]** | `026:167-173` sólo política de `select` |

### 6.6 Verificación pública del BRC

| STRIDE | Amenaza | Estado | Referencia |
|---|---|---|---|
| **S** | Falsificar un certificado completo con QR | **[A] Crítica** | BH-03 · `cert-security.ts:138` |
| **T** | Falsificar la respuesta firmada de verificación | **[A] Crítica** | BH-02 · secreto en el repositorio |
| **R** | "Ese certificado nunca se verificó" | **[M] parcial** | `verificationId` se genera (`route.ts:201`) pero **no se persiste** |
| **I** | Fuga de `owner_id`, dirección y precio | **[A] Alta** | BH-09 · `route.ts:213-224` |
| **I** | Enumeración de certificados | **[M]** | El id es UUIDv4; no enumerable por fuerza bruta |
| **D** | Abuso del endpoint público | **[M] parcial** | 20 req/min (`route.ts:10`) pero evadible (BH-10) |
| **E** | — | n/a | El endpoint es de sólo lectura |

---

*Hallazgos BH-28 a BH-31 corresponden al módulo de pagos incorporado durante la auditoría; su detalle está en la sección 3.5.*

*Documento generado por auditoría estática del código. Todo lo marcado **[PENDIENTE PROD]** requiere verificación en el entorno desplegado con los comandos indicados. Ninguna sección sustituye un pentest externo.*

---

## 7. Estado de remediación — pasada del 31 de agosto de 2026

Esta sección registra qué se cerró en la pasada de remediación posterior a la
auditoría, qué quedó mitigado (el riesgo baja pero no desaparece) y qué sigue
abierto. La regla que se siguió: **ningún hallazgo se deja en silencio**; si no
se cerró, aquí está el motivo.

### 7.1 Resumen

| ID | Severidad | Estado | Motivo / qué falta |
|---|---|---|---|
| BH-01 | Crítica | **CERRADO** | RLS + registro + guard, en las tres capas. Requiere revisión humana del inventario de roles privilegiados (ver 7.4). |
| BH-02 | Crítica | **CERRADO (código)** | Falta cargar `BRC_VERIFY_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` como secretos de GitHub (7.4). |
| BH-03 | Crítica | **MITIGADO** | Folio y firma del QR cerrados por otro agente; la firma PKI real (Ed25519 + Key Vault) sigue pendiente. |
| BH-04 | Alta | **CERRADO** | Guard + middleware + RLS + revocación de sesión. |
| BH-05 | Alta | **CERRADO** | Cerrado por otro agente (columnas de revisión en `brc_documents`). Verificado. |
| BH-06 | Alta | PENDIENTE | Vive en `apps/api/src/modules/properties/**`, propiedad de otro agente en esta pasada. |
| BH-07 | Alta | PENDIENTE | Requiere tocar las pantallas de subida (otro agente) y configurar el bucket en Supabase. |
| BH-08 | Alta | **MITIGADO** | Rewrite acotado con allowlist estricta. Falta `pnpm up next@^15.5.21 multer@^2.2.0` (prohibido instalar en esta pasada). |
| BH-09 | Alta | **CERRADO** | Respuesta pública reducida; detalle sólo para participantes autenticados. |
| BH-10 | Alta | **MITIGADO** | Bypass de `X-Forwarded-For` cerrado y límites aplicados. Falta Redis y captcha en leads. |
| BH-11 | Media | **MITIGADO** | `unsafe-eval` fuera en producción + cabeceras nuevas. Nonces pendientes. |
| BH-12 | Media | **MITIGADO** | Invariantes de columna en `leads`. Zod en frontera pendiente. |
| BH-13 | Media | PENDIENTE | Requiere exportar las políticas reales de Storage desde el panel ([PENDIENTE PROD]). |
| BH-14 | Media | **MITIGADO** | `@Roles` aplicado. Cuota por cuenta pendiente. |
| BH-15 | Media | PENDIENTE | Módulo `brc`, propiedad de otro agente. |
| BH-16 | Media | **MITIGADO** | Interceptor ampliado; falta registrarlo en `app.module.ts` (7.3). |
| BH-17 | Media | **CERRADO (código)** | Falta configuración en el panel de Sentry y el aviso de privacidad. |
| BH-18 | Media | **MITIGADO** | `permissions`, `pnpm audit`, Gitleaks. Faltan OIDC, pin por SHA, CodeQL, `environment: production`. |
| BH-19 | Media | PENDIENTE | Módulo `properties`, propiedad de otro agente. |
| BH-20 | Media | PENDIENTE | Bloqueado por la política de retención escrita (decisión legal, no técnica). |
| BH-21 | Baja | **CERRADO** | Copia unificada en `auth-messages.ts`, con pruebas. |
| BH-22 | Baja | **MITIGADO** | Mínimo 12 caracteres. HIBP y MFA pendientes. |
| BH-23 | Baja | PENDIENTE | Deuda técnica: normalizar `file_url` a rutas de objeto. |
| BH-24 | Baja | **CERRADO** | Correlación añadida en la política RLS. |
| BH-25 | Baja | Sin acción | Comportamiento correcto; la mitigación es de red ([PENDIENTE PROD]). |
| BH-26 | Baja | PENDIENTE | Higiene local: borrar `deploy.zip` y mover los PDF. Acción humana. |
| BH-27 | Baja | PENDIENTE | Requiere redacción legal. |
| BH-28 / BH-29 / BH-30 | Alta / Media | Otro dueño | Asignados al agente de pagos. |
| BH-31 | Media | PENDIENTE | Cableado en `app.module.ts` (7.3). |

**Conteo:** 8 cerrados, 9 mitigados, 11 pendientes (de los cuales 3 corresponden
a otro dueño y 4 requieren acción humana fuera del código).

### 7.2 Cambios por archivo

**Migraciones**
- `packages/supabase/migrations/031_security_rbac_hardening.sql` — helpers
  `is_active_user()`, `is_verified_notario()`, `is_self_assignable_role()`;
  política de `insert` de `profiles` sin `NOTARIO`; `update` propio que congela
  `role` **y** `is_active`; corrección de la política de `OPERADOR_BRC`
  (BH-24); políticas **RESTRICTIVE** de escritura para cuentas desactivadas en
  ocho tablas; columnas `verification_note` / `verified_at` en
  `notary_profiles`; migración de datos de notarios existentes con inventario
  en el log.
- `packages/supabase/migrations/032_security_rls_hardening.sql` — invariantes
  de longitud en `leads` (`NOT VALID`).

**API (NestJS)**
- `common/constants/roles.ts` *(nuevo)* — taxonomía de roles compartida.
- `common/constants/account-status.ts` *(nuevo)* — códigos de error legibles por
  máquina.
- `common/guards/auth.guard.ts` — carga `role, is_active`; deniega cuentas
  desactivadas; cachea el rol en la petición.
- `common/guards/roles.guard.ts` — exige notario verificado; revalida
  `is_active`; mensaje de denegación en español.
- `common/filters/http-exception.filter.ts` — propaga el campo `code` en 4xx.
- `common/interceptors/audit-log.interceptor.ts` — IP, UA, rol, estado, marca
  `DENIED`; sin body ni query string.
- `common/sentry-scrub.ts` *(nuevo)* — scrubbing de eventos.
- `config/env.validation.ts` *(nuevo)* — validación de entorno fail-fast.
- `instrument.ts` — `beforeSend` / `beforeSendTransaction` / `beforeBreadcrumb`,
  `sendDefaultPii: false`.
- `modules/admin/admin.service.ts` + `admin.controller.ts` — reglas de otorgado
  de rol, revocación de sesión al desactivar, verificación de notario que
  promueve/revoca, asignación sólo a notarios verificados.
- `modules/profiles/profiles.service.ts` — `assertNoProtectedProfileFields`,
  rol forzado al crear el perfil.
- `modules/ocr/ocr.controller.ts` — `@Roles(...)` a nivel de controlador.

**Web (Next.js)**
- `src/lib/auth-roles.ts`, `src/lib/auth-messages.ts`, `src/lib/env.ts`,
  `src/lib/sentry-scrub.ts`, `src/lib/api-rewrite-target.ts`,
  `src/lib/account-status.ts` *(todos nuevos)*.
- `src/lib/rate-limit.ts` — `clientIp()` resistente a suplantación,
  `enforceRateLimit()`, `rateLimitHeaders()`.
- `src/lib/supabase/middleware.ts` — expulsión de cuentas desactivadas.
- `src/lib/api-client.ts` — cierre de sesión ante `ACCOUNT_DISABLED`.
- `src/app/auth/registro/page.tsx` — rol no privilegiado, solicitud notarial,
  sin enumeración, contraseña ≥ 12.
- `src/app/auth/login/page.tsx` — copia unificada, lectura del motivo de
  redirección.
- `src/app/auth/callback/route.ts` — rol fijado en servidor, error del `insert`
  comprobado, `next` acotado a rutas relativas, bloqueo de cuentas
  desactivadas.
- `src/app/api/verify/[id]/route.ts` — sin fallback de secreto, respuesta
  pública mínima, 500 explícito ante mala configuración.
- `src/app/api/{geocode,ticker,postal/[cp],localidades/*,proxy-image}/route.ts`
  — rate limiting.
- `src/app/certificado/[id]/page.tsx` — degradación limpia cuando la respuesta
  de verificación viene en modo público.
- `next.config.ts` — CSP endurecida, cabeceras nuevas, rewrite validado.
- `sentry.{client,server,edge}.config.ts` — scrubbing, Replay apagado.
- `instrumentation.ts` — validación de entorno al arranque.
- `.env.local.example`, `apps/api/.env.example` — variables documentadas.

**CI/CD**
- `.github/workflows/ci.yml` — `permissions`, `pnpm audit`, Gitleaks.
- `.github/workflows/deploy.yml` — `permissions`, verificación previa de
  secretos, variables faltantes en ambas apps.

### 7.3 Cambios pendientes en `app.module.ts` / `main.ts`

Ambos archivos quedaron fuera del alcance de esta pasada. Se requieren tres
cambios:

```ts
// 1) BH-02 — validación de entorno al arranque
import { validateEnv } from './config/env.validation';
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: ['.env.local', '.env'],
  validate: validateEnv,          // <-- añadir
}),

// 2) BH-16 — registrar la pista de auditoría HTTP
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
{ provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },

// 3) BH-31 — registrar los módulos de pagos y membresías (ver agente de pagos)
```

### 7.4 Acciones humanas requeridas antes del lanzamiento

1. **Revisar el inventario de roles privilegiados.** Ejecutar la consulta del
   paso 5 de BH-01 tras aplicar `031` y revocar a mano cualquier notario que no
   corresponda. La migración conserva el acceso de los notarios existentes a
   propósito (para no bloquear a nadie en silencio), así que esta revisión es
   obligatoria, no opcional.
2. **Generar y cargar `BRC_VERIFY_SECRET`** (`openssl rand -hex 32`) como
   secreto de GitHub. El valor que estaba en el repositorio queda quemado.
3. **Rotar y cargar `SUPABASE_SERVICE_ROLE_KEY`** como secreto de GitHub (ver
   4.2: estuvo en un directorio sincronizado con iCloud).
4. **Cargar `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`** si se quiere telemetría, y
   activar Data Scrubbing + retención de 30 días en el panel de Sentry.
5. **Actualizar dependencias:** `pnpm up next@^15.5.21 multer@^2.2.0`, regenerar
   el lockfile y verificar con `pnpm audit --prod`. Después, quitar
   `continue-on-error` del paso de auditoría en `ci.yml`.
6. **Definir `RATE_LIMIT_PROXY_DEPTH = 2`** en cuanto se ponga Azure Front Door
   delante; con el valor 1 detrás de Front Door el limitador contaría la IP del
   borde en vez de la del cliente.
7. **Validar las restricciones de `leads`** en ventana de mantenimiento:
   `alter table leads validate constraint leads_message_len;` (y equivalentes).
8. Borrar `deploy.zip` y mover los PDF fuera del árbol (BH-26).

### 7.5 Pruebas añadidas

| Suite | Archivo | Cubre |
|---|---|---|
| Jest (api) | `src/common/guards/guards.security.spec.ts` | BH-01, BH-04 — 13 pruebas |
| Jest (api) | `src/modules/admin/admin.service.spec.ts` | BH-01, BH-04 — 11 pruebas |
| Jest (api) | `src/modules/profiles/profiles.security.spec.ts` | BH-01 — 10 pruebas |
| Jest (api) | `src/common/constants/roles.spec.ts` | BH-01 — 4 pruebas |
| Jest (api) | `src/config/env.validation.spec.ts` | BH-02 — 4 pruebas |
| Jest (api) | `src/common/sentry-scrub.spec.ts` | BH-17 — 18 pruebas |
| Jest (api) | `src/common/interceptors/audit-log.interceptor.spec.ts` | BH-16 — 4 pruebas |
| Vitest (web) | `src/lib/auth-roles.test.ts` | BH-01 |
| Vitest (web) | `src/lib/auth-messages.test.ts` | BH-21, BH-22 |
| Vitest (web) | `src/lib/env.test.ts` | BH-02 |
| Vitest (web) | `src/lib/api-rewrite-target.test.ts` | BH-08 |
| Vitest (web) | `src/lib/rate-limit.test.ts` | BH-10 |
| Vitest (web) | `src/lib/sentry-scrub.test.ts` | BH-17 |
| Vitest (web) | `src/lib/account-status.test.ts` | BH-04 |
| Vitest (web) | `src/lib/next-config.security.test.ts` | BH-08, BH-11 |
| Vitest (web) | `src/app/api/verify/[id]/route.test.ts` | BH-02, BH-09 (ampliado) |

Resultado tras la pasada: **api 332 pruebas en verde (19 suites)**, **web 535
pruebas en verde (27 suites)**, `tsc --noEmit` limpio en ambos paquetes.
