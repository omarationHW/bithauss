-- ─────────────────────────────────────────────────────────────
-- 037 · Elimina policies heredadas de profiles que no están en el repo
-- ─────────────────────────────────────────────────────────────
-- Diagnóstico en producción (pg_policies, 2026-09-15) mostró tres policies
-- creadas fuera de las migraciones, anteriores a 003/031:
--
-- 1. "Users can update profiles" — su USING consulta auth.users, tabla a la
--    que el rol authenticated no tiene SELECT. Como las policies permisivas
--    se evalúan en OR, Postgres la evalúa siempre y todo update propio
--    falla con 42501 "permission denied for table users". Es la causa de
--    que "Mi Perfil" no guardara aun después de 036. La sustituyen
--    "Users can update own profile (no role change)" y
--    "Admins can update any profile".
--
-- 2. "Service role can insert profiles" (WITH CHECK true) — el service role
--    no pasa por RLS, así que esta policy sólo aplicaba a usuarios normales
--    y les permitía insertar un perfil con cualquier rol (p.ej. ADMIN),
--    anulando el candado is_self_assignable_role() de 031. Agujero de
--    seguridad; se elimina.
--
-- 3. "Users can insert own profile" — duplicada por
--    "Users can insert own profile (no privileged role)" (031), que es más
--    estricta. Al ser permisiva, la versión laxa ganaba.
--
-- Queda pendiente (no se toca aquí, requiere auditar qué pantallas leen
-- perfiles ajenos): "Profiles readable by authenticated" (SELECT true), que
-- 003 pretendía reemplazar por lecturas acotadas.

drop policy if exists "Users can update profiles"          on profiles;
drop policy if exists "Service role can insert profiles"   on profiles;
drop policy if exists "Users can insert own profile"       on profiles;

notify pgrst, 'reload schema';
