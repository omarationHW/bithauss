"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { parseRepresentatives } from "./parse-representatives";

type PersonType = "MORAL" | "FISICA";

const PERSON_TYPES: { value: PersonType; label: string }[] = [
  { value: "MORAL", label: "Persona moral" },
  { value: "FISICA", label: "Persona física" },
];

/** Razón social (solo lectura), tipo de persona y representantes legales. */
export function CompanyLegalInfo({ companyId }: { companyId: string }) {
  const [legalName, setLegalName] = useState("");
  const [personType, setPersonType] = useState<PersonType>("MORAL");
  const [reps, setReps] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    Promise.all([
      supabase.from("company_profiles").select("legal_name").eq("id", companyId).maybeSingle(),
      supabase
        .from("company_legal_info")
        .select("person_type, legal_representatives")
        .eq("company_id", companyId)
        .maybeSingle(),
    ]).then(([company, legal]) => {
      if (!mounted) return;
      if (company.error || legal.error) {
        // Sin los datos actuales no se deja guardar: los borraría.
        setMessage({ ok: false, text: "No pudimos cargar los datos legales." });
        return;
      }
      setLegalName(company.data?.legal_name ?? "");
      if (legal.data) {
        setPersonType(legal.data.person_type as PersonType);
        setReps((legal.data.legal_representatives as string[]).join("\n"));
      }
      setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, [companyId]);

  async function save(ev: FormEvent) {
    ev.preventDefault();
    const list = parseRepresentatives(reps);
    if (list.length > 10) {
      setMessage({ ok: false, text: "Máximo 10 representantes legales." });
      return;
    }
    setSaving(true);
    setMessage(null);
    const { error } = await createClient().from("company_legal_info").upsert({
      company_id: companyId,
      person_type: personType,
      legal_representatives: list,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (!error) setReps(list.join("\n"));
    setMessage(error ? { ok: false, text: "No se pudo guardar." } : { ok: true, text: "Datos guardados." });
  }

  return (
    <form onSubmit={save} className="mt-4 space-y-4 border-b border-gray-100 pb-6">
      {legalName && <p className="text-sm text-gray-600">Razón social: <span className="font-medium text-gray-900">{legalName}</span></p>}
      <fieldset disabled={!loaded || saving} className="space-y-4">
        <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Tipo de persona">
          {PERSON_TYPES.map((t) => (
            <label key={t.value} className="flex min-h-11 items-center gap-2 text-sm text-gray-900">
              <input
                type="radio"
                name={`person-type-${companyId}`}
                checked={personType === t.value}
                onChange={() => setPersonType(t.value)}
              />
              {t.label}
            </label>
          ))}
        </div>
        <label className="block text-sm font-medium text-gray-900">
          Representantes legales (uno por línea)
          <textarea
            rows={3}
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-normal"
          />
        </label>
        <Button type="submit" variant="outline" className="h-11">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar datos legales
        </Button>
      </fieldset>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
