-- ─────────────────────────────────────────────────────────────
-- 040 · Dirección completa obligatoria para solicitar el BRC
-- ─────────────────────────────────────────────────────────────
-- La dirección del inmueble era un solo texto libre y opcional
-- (`address_line`), así que se podía certificar un inmueble sin saber dónde
-- está, y no había forma de comparar el número exterior contra la escritura.
--
--   * Calle, número exterior y número interior pasan a columnas propias.
--     `address_line` se sigue llenando (compuesta desde ellas) para que los
--     listados, la ficha técnica y el certificado no cambien.
--   * Publicar sigue sin exigir dirección. Enviar una solicitud de BRC sí:
--     un expediente no sale de BORRADOR si al inmueble le falta calle,
--     número exterior, colonia, código postal, ciudad/alcaldía o estado.
--     El candado vive aquí porque el navegador escribe directo en
--     `brc_expedientes`; la validación de la página es solo la cortesía.

alter table properties
  add column if not exists street           text,
  add column if not exists exterior_number  text,
  add column if not exists interior_number  text;

comment on column properties.street is
  'Calle del inmueble (sin número). Obligatoria para solicitar el BRC.';
comment on column properties.exterior_number is
  'Número exterior tal como aparece en la escritura (puede incluir letras: "12-B", "S/N"). Obligatorio para solicitar el BRC.';
comment on column properties.interior_number is
  'Número interior / departamento, si aplica.';

-- ── Candado: dirección completa al enviar la solicitud ───────

create or replace function brc_expediente_require_property_address()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p       properties%rowtype;
  missing text[] := '{}';
begin
  -- Solo al salir de BORRADOR (o si alguien inserta directo en otro estado).
  if new.status = 'BORRADOR' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'BORRADOR' then
    return new;
  end if;

  select * into p from properties where id = new.property_id;

  if coalesce(btrim(p.street), '') = ''          then missing := missing || 'calle'::text; end if;
  if coalesce(btrim(p.exterior_number), '') = '' then missing := missing || 'número exterior'::text; end if;
  if coalesce(btrim(p.neighborhood), '') = ''    then missing := missing || 'colonia'::text; end if;
  if coalesce(p.zip_code, '') !~ '^[0-9]{5}$'    then missing := missing || 'código postal'::text; end if;
  if coalesce(btrim(p.city), '') = ''            then missing := missing || 'ciudad o alcaldía'::text; end if;
  if coalesce(btrim(p.state), '') = ''           then missing := missing || 'estado'::text; end if;

  if array_length(missing, 1) > 0 then
    raise exception 'Para solicitar el BRC el inmueble necesita dirección completa. Falta: %.',
      array_to_string(missing, ', ')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists brc_expedientes_require_address on brc_expedientes;
create trigger brc_expedientes_require_address
  before insert or update of status on brc_expedientes
  for each row execute function brc_expediente_require_property_address();

notify pgrst, 'reload schema';
