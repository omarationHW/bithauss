"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "./user-context";

export interface CompanyAccess {
  id: string;
  trade_name: string;
  owner_id: string;
  access: "DUENO" | "ADMIN" | "ADMINISTRADOR";
}

interface CompanyContextType {
  companies: CompanyAccess[];
  /** Inmobiliaria elegida; null = todas. */
  active: CompanyAccess | null;
  setActiveId: (id: string | null) => void;
  /** false hasta saber qué inmobiliarias opera la sesión. */
  ready: boolean;
}

const CompanyContext = createContext<CompanyContextType>({
  companies: [],
  active: null,
  setActiveId: () => {},
  ready: false,
});

export const useCompany = () => useContext(CompanyContext);

const storageKey = (userId: string) => `bh:company:${userId}`;

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const userId = user?.id;
  const [companies, setCompanies] = useState<CompanyAccess[]>([]);
  const [activeId, setId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    createClient()
      .rpc("my_companies")
      .then(({ data }) => {
        if (!mounted) return;
        // Sin la migración 043 la RPC no existe: se conserva la vista por dueño.
        setCompanies((data as CompanyAccess[] | null) ?? []);
        try {
          setId(window.localStorage.getItem(storageKey(userId)));
        } catch {
          /* sin almacenamiento */
        }
        setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  const setActiveId = useCallback(
    (id: string | null) => {
      setId(id);
      if (!userId) return;
      try {
        if (id) window.localStorage.setItem(storageKey(userId), id);
        else window.localStorage.removeItem(storageKey(userId));
      } catch {
        /* sin almacenamiento */
      }
    },
    [userId],
  );

  const value = useMemo(
    () => ({
      companies,
      active: companies.find((c) => c.id === activeId) ?? null,
      setActiveId,
      ready,
    }),
    [companies, activeId, setActiveId, ready],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

/**
 * Filtro PostgREST `or` para los inmuebles visibles: la inmobiliaria elegida o,
 * con "Todas", los propios más los de las inmobiliarias que la sesión opera.
 * El ADMIN sin selección conserva "los míos".
 */
export function propertyScope(
  userId: string,
  isAdmin: boolean,
  companies: Pick<CompanyAccess, "id">[],
  active: Pick<CompanyAccess, "id"> | null,
): string {
  if (active) return `company_id.eq.${active.id}`;
  if (isAdmin || companies.length === 0) return `owner_id.eq.${userId}`;
  return `owner_id.eq.${userId},company_id.in.(${companies.map((c) => c.id).join(",")})`;
}
