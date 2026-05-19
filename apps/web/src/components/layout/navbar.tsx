"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Menu, User, LogOut, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";

const navLinks = [
  { label: "Propiedades", href: "/propiedades" },
  { label: "Certificado BRC", href: "/como-funciona" },
  { label: "Nosotros", href: "/nosotros" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<{ name: string; initials: string; avatarUrl: string | null } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function loadUser(authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null) {
      if (!authUser) {
        if (!cancelled) setUser(null);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", authUser.id)
        .maybeSingle();

      if (cancelled) return;

      const meta = authUser.user_metadata ?? {};
      const first = profile?.first_name ?? (meta.first_name as string | undefined) ?? "";
      const last = profile?.last_name ?? (meta.last_name as string | undefined) ?? "";
      const name = `${first} ${last}`.trim() || authUser.email || "Usuario";
      const initials = first && last
        ? `${first[0]}${last[0]}`.toUpperCase()
        : name.slice(0, 2).toUpperCase();
      setUser({ name, initials, avatarUrl: profile?.avatar_url ?? null });
    }

    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      loadUser(authUser);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore TOKEN_REFRESHED / USER_UPDATED to avoid clobbering the avatar
      // with a session payload that doesn't include the profile data.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
        loadUser(session?.user ?? null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = () => setDropdownOpen(false);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [dropdownOpen]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setDropdownOpen(false);
    router.push("/");
  };

  // On non-home pages, always use solid navbar style
  const solid = !isHome || scrolled;

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        solid
          ? "bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-sm"
          : "bg-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left nav links */}
        <div className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                solid
                  ? "text-muted-foreground hover:text-foreground hover:bg-primary/5"
                  : "text-white/80 hover:text-white"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Center logo */}
        <Link href="/" className="group flex items-center gap-2">
          <Image
            src={
              solid
                ? "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Logo-BitHauss-Texto-Negro.png"
                : "https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Logo-BitHauss-Texto-Blanco.png"
            }
            alt="BitHauss"
            width={140}
            height={36}
            priority
            className="h-8 w-auto transition-all duration-300"
          />
        </Link>

        {/* Right - Auth buttons or User menu */}
        <div className="hidden items-center gap-3 lg:flex">
          {!mounted ? (
            <div className="h-8 w-24" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(!dropdownOpen); }}
                className={cn(
                  "flex items-center gap-2.5 rounded-full px-3 py-1.5 transition-all duration-200",
                  solid
                    ? "hover:bg-muted"
                    : "hover:bg-white/10"
                )}
              >
                {user.avatarUrl ? (
                  <Image src={user.avatarUrl} alt={user.name} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
                  >
                    {user.initials}
                  </div>
                )}
                <span
                  className={cn(
                    "text-sm font-medium",
                    solid ? "text-foreground" : "text-white"
                  )}
                >
                  {user.name}
                </span>
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-card shadow-lg overflow-hidden animate-fade-in-up">
                  <div className="p-3 border-b">
                    <p className="text-sm font-medium">{user.name}</p>
                  </div>
                  <div className="p-1">
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <User className="h-4 w-4" />
                      Mi perfil
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/auth/login"
                className={cn(
                  "text-sm font-medium transition-colors duration-200",
                  solid
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-white/80 hover:text-white"
                )}
              >
                Iniciar sesión
              </Link>
              <Button
                size="sm"
                asChild
                className="border-0 bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:opacity-90 transition-all duration-300"
              >
                <Link href="/auth/registro">Registrarse</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "lg:hidden",
                solid ? "hover:bg-primary/5" : "text-white hover:bg-white/10"
              )}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[300px] sm:w-[360px] border-l border-border/50"
          >
            <SheetTitle className="sr-only">Menu de navegacion</SheetTitle>
            <div className="flex flex-col gap-6 pt-6">
              <Link
                href="/"
                className="flex items-center gap-2.5"
                onClick={() => setOpen(false)}
              >
                <Image
                  src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Logo-BitHauss-Texto-Negro.png"
                  alt="BitHauss"
                  width={120}
                  height={32}
                  className="h-7 w-auto"
                />
              </Link>

              <div className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-primary/5 hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-border/50 pt-6">
                {!mounted ? null : user ? (
                  <>
                    <div className="flex items-center gap-3 px-4 py-2">
                      {user.avatarUrl ? (
                        <Image src={user.avatarUrl} alt={user.name} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                          style={{ background: "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))" }}
                        >
                          {user.initials}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                      </div>
                    </div>
                    <Link
                      href="/dashboard"
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-primary/5 hover:text-foreground flex items-center gap-2"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                    <Button
                      variant="outline"
                      className="justify-center text-red-500 border-red-200 hover:bg-red-50"
                      onClick={() => { handleLogout(); setOpen(false); }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Cerrar sesión
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      asChild
                      className="justify-center border-border/50 hover:border-primary/30 hover:bg-primary/5"
                    >
                      <Link href="/auth/login" onClick={() => setOpen(false)}>
                        Iniciar Sesión
                      </Link>
                    </Button>
                    <Button
                      asChild
                      className="justify-center shadow-md shadow-primary/20"
                    >
                      <Link href="/auth/registro" onClick={() => setOpen(false)}>
                        Registrarse
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
