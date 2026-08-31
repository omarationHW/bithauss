-- ============================================================
-- BitHauss — Security hardening: invariantes de columna
-- ============================================================
-- Cierra parcialmente docs/SECURITY.md:
--   BH-12: el navegador escribe directo a Postgres sin validación de
--          frontera. Las políticas RLS restringen FILAS, no COLUMNAS, así
--          que un `message` de 10 MB o un `name` de longitud arbitraria
--          entran sin oposición por el formulario público de contacto.
--   BH-10 (parcial): un límite de longitud no es rate limiting, pero acota
--          el coste por petición del único endpoint público que escribe.
--
-- Las restricciones se crean NOT VALID a propósito: aplican a todo lo que
-- se escriba a partir de ahora sin arriesgar el despliegue por una fila
-- histórica que las incumpla. Validarlas después, en ventana de
-- mantenimiento, con:
--   alter table leads validate constraint leads_message_len;
--
-- Idempotente.
-- ============================================================

do $$
begin
  if to_regclass('public.leads') is null then
    raise notice 'skip: la tabla public.leads no existe';
    return;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'leads_message_len' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_message_len
      check (message is null or char_length(message) <= 2000) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'leads_name_len' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_name_len
      check (char_length(name) between 1 and 150) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'leads_email_len' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_email_len
      check (char_length(email) between 3 and 320) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'leads_phone_len' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_phone_len
      check (phone is null or char_length(phone) <= 30) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'leads_utm_len' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_utm_len
      check (
        coalesce(char_length(utm_source), 0)   <= 100
        and coalesce(char_length(utm_medium), 0)   <= 100
        and coalesce(char_length(utm_campaign), 0) <= 100
      ) not valid;
  end if;
end
$$;
