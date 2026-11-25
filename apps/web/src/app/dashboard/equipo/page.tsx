"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useCompany, type CompanyAccess } from "../_context/company-context";
import { useUser } from "../_context/user-context";
import { CompanyLegalInfo } from "./legal-info";

interface Member {
  profile_id: string;
  email: string;
  full_name: string;
}

function CompanyTeam({ company }: { company: CompanyAccess }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await createClient().rpc("list_company_members", {
      p_company_id: company.id,
    });
    if (e) setError(e.message);
    else setMembers((data as Member[] | null) ?? []);
    setBusy(false);
  }, [company.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    const { error: e } = await createClient().rpc("add_company_member", {
      p_company_id: company.id,
      p_email: email,
    });
    if (e) {
      setError(e.message);
      setBusy(false);
      return;
    }
    setEmail("");
    await load();
  }

  async function remove(m: Member) {
    if (!window.confirm(`¿Quitar el acceso de ${m.email} a ${company.trade_name}?`)) return;
    setBusy(true);
    setError(null);
    const { error: e } = await createClient().rpc("remove_company_member", {
      p_company_id: company.id,
      p_profile_id: m.profile_id,
    });
    if (e) {
      setError(e.message);
      setBusy(false);
      return;
    }
    await load();
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200/60">
      <h3 className="text-lg font-semibold text-gray-900">{company.trade_name}</h3>
      <CompanyLegalInfo companyId={company.id} />
      <form onSubmit={add} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@inmobiliaria.com"
          aria-label={`Correo de la persona a autorizar en ${company.trade_name}`}
          className="h-11"
        />
        <Button type="submit" disabled={busy} className="h-11 shrink-0">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
          Autorizar
        </Button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      <ul className="mt-4 divide-y divide-gray-100">
        {members.map((m) => (
          <li key={m.profile_id} className="flex min-h-14 items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{m.full_name || m.email}</p>
              <p className="truncate text-xs text-gray-500">{m.email} · Administrador de Inmobiliaria</p>
            </div>
            <Button variant="ghost" size="icon" disabled={busy} onClick={() => remove(m)} aria-label={`Quitar a ${m.email}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
        {!busy && members.length === 0 && (
          <li className="py-3 text-sm text-gray-500">Aún no hay personas autorizadas.</li>
        )}
      </ul>
    </section>
  );
}

export default function EquipoPage() {
  const { companies, ready } = useCompany();
  const { user } = useUser();
  const [error, setError] = useState<string | null>(null);
  const managed = companies.filter((c) => c.access !== "ADMINISTRADOR");
  const teams = companies.filter((c) => c.access === "ADMINISTRADOR");

  async function leave(c: CompanyAccess) {
    if (!user || !window.confirm(`¿Dejar de administrar ${c.trade_name}?`)) return;
    const { error: e } = await createClient().rpc("remove_company_member", {
      p_company_id: c.id,
      p_profile_id: user.id,
    });
    if (e) setError(e.message);
    else window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Equipo</h2>
        <p className="mt-1 text-sm text-gray-500">
          Autoriza a personas para administrar los inmuebles y leads de cada inmobiliaria. Deben tener una cuenta en BitHauss.
        </p>
      </div>
      {managed.map((c) => (
        <CompanyTeam key={c.id} company={c} />
      ))}
      {teams.map((c) => (
        <section key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200/60">
          <p className="min-w-0 flex-1 text-sm text-gray-600">
            Administras <span className="font-semibold text-gray-900">{c.trade_name}</span> por autorización de su dueño.
          </p>
          <Button variant="outline" className="h-11" onClick={() => leave(c)}>Salir del equipo</Button>
        </section>
      ))}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {ready && managed.length === 0 && (
        <p className="text-sm text-gray-500">No eres dueño de ninguna inmobiliaria.</p>
      )}
    </div>
  );
}
