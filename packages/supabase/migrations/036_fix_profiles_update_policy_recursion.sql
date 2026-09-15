-- ─────────────────────────────────────────────────────────────
-- 036 · Corrige recursión infinita en la policy de update de profiles
-- ─────────────────────────────────────────────────────────────
-- Síntoma: cualquier usuario que guardaba su perfil recibía
--   42P17 "infinite recursion detected in policy for relation profiles"
-- y la pantalla "Mi Perfil" no persistía nombre/teléfono.
--
-- Causa: la policy de 031 comprobaba que `role` e `is_active` no cambien con
-- subconsultas directas a `profiles` dentro del WITH CHECK. Esas subconsultas
-- vuelven a evaluar las policies de `profiles` (incluidas las de select que
-- también consultan `profiles`), y Postgres corta el ciclo con 42P17.
--
-- Fix: usar los helpers SECURITY DEFINER que ya existen para este propósito
-- (`current_user_role()` de 003 e `is_active_user()` de 031): leen la fila
-- sin pasar por RLS, así que no hay recursión y la garantía es la misma —
-- el propio usuario no puede cambiarse el rol ni reactivarse.

drop policy if exists "Users can update own profile (no role change)" on profiles;

create policy "Users can update own profile (no role change)"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role      = public.current_user_role()
    and is_active = public.is_active_user()
  );

notify pgrst, 'reload schema';
