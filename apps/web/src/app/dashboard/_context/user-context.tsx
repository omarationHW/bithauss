"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type UserRole = "ADMIN" | "INMOBILIARIA" | "BROKER" | "VENDEDOR" | "COMPRADOR" | "NOTARIO" | "OPERADOR_BRC";

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  role: UserRole;
  phone: string | null;
  avatarUrl: string | null;
}

interface UserContextType {
  user: UserData | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateUser: (partial: Partial<UserData>) => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  updateUser: () => {},
});

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function fetchUser() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser || !mounted) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, role, phone, avatar_url")
        .eq("id", authUser.id)
        .maybeSingle();

      if (!mounted) return;

      const firstName = profile?.first_name ?? authUser.user_metadata?.first_name ?? "";
      const lastName = profile?.last_name ?? authUser.user_metadata?.last_name ?? "";
      const fullName = `${firstName} ${lastName}`.trim() || authUser.email || "Usuario";
      const initials = firstName && lastName
        ? `${firstName[0]}${lastName[0]}`.toUpperCase()
        : fullName.slice(0, 2).toUpperCase();
      const role = (profile?.role ?? authUser.user_metadata?.role ?? "COMPRADOR") as UserRole;

      setUser({
        id: authUser.id,
        email: authUser.email ?? "",
        firstName,
        lastName,
        fullName,
        initials,
        role,
        phone: profile?.phone ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      });
      setLoading(false);
    }

    fetchUser();
    return () => { mounted = false; };
  }, []);

  const logout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/auth/login");
    router.refresh();
  }, [router]);

  const updateUser = useCallback((partial: Partial<UserData>) => {
    setUser((prev) => prev ? { ...prev, ...partial } : prev);
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, logout, updateUser }}>
      {children}
    </UserContext.Provider>
  );
}
