-- ============================================================
-- 044 · Tipo de persona y representantes legales por inmobiliaria
-- ============================================================
-- Tabla aparte de company_profiles: esa la puede leer cualquier usuario
-- registrado si la inmobiliaria tiene inmuebles publicados, y los nombres de
-- los representantes no deben quedar expuestos. Requiere 043. Idempotente.
-- ============================================================

create table if not exists company_legal_info (
  company_id            uuid primary key references company_profiles(id) on delete cascade,
  person_type           kyc_person_type not null,
  legal_representatives text[] not null default '{}'
    check (cardinality(legal_representatives) <= 10
           and array_position(legal_representatives, null) is null
           and array_position(legal_representatives, '') is null),
  updated_at            timestamptz not null default now()
);

alter table company_legal_info enable row level security;
revoke all on company_legal_info from anon, authenticated;
grant select, insert, update on company_legal_info to authenticated;

-- El equipo lo ve; solo el dueño (o ADMIN) lo edita.
drop policy if exists "Company team can view legal info" on company_legal_info;
create policy "Company team can view legal info" on company_legal_info for select
  to authenticated using (public.can_manage_company(company_id));
drop policy if exists "Company owner can insert legal info" on company_legal_info;
create policy "Company owner can insert legal info" on company_legal_info for insert
  to authenticated with check (public.owns_company(company_id));
drop policy if exists "Company owner can update legal info" on company_legal_info;
create policy "Company owner can update legal info" on company_legal_info for update
  to authenticated using (public.owns_company(company_id))
  with check (public.owns_company(company_id));

-- Datos entregados por el cliente (24-nov-2026). No pisa ediciones posteriores.
insert into company_legal_info (company_id, person_type, legal_representatives)
select v.id, 'MORAL'::kyc_person_type, v.reps
  from (values
    ('9b218809-62ab-452c-aacd-c28320859854'::uuid, array['Guadalupe Hernández','Renato Torres']),
    ('a8adbe19-a947-5660-a81b-758b8358b281'::uuid, array['Renato Torres'])
  ) as v(id, reps)
  join company_profiles c on c.id = v.id
on conflict (company_id) do nothing;
