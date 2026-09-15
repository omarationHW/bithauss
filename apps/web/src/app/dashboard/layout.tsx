"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserProvider, useUser } from "./_context/user-context";
import { OnboardingProvider, restartOnboarding } from "@/components/onboarding/onboarding-provider";
import { isOnboardingRole } from "@/lib/onboarding/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Building2,
  Users,
  MessageSquare,
  CreditCard,
  User,
  Settings,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  ChevronDown,
  Search,
  Heart,
  FileText,
  ScanSearch,
  Compass,
} from "lucide-react";
import { ShieldBrc } from '@/components/ui/shield-brc'

type UserRole = "ADMIN" | "INMOBILIARIA" | "BROKER" | "VENDEDOR" | "COMPRADOR" | "NOTARIO" | "OPERADOR_BRC";

const allNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", roles: ["ALL"] },
  { label: "Mis Propiedades", icon: Building2, href: "/dashboard/propiedades", roles: ["BROKER", "INMOBILIARIA", "VENDEDOR", "ADMIN"] },
  { label: "Leads", icon: Users, href: "/dashboard/leads", roles: ["BROKER", "INMOBILIARIA", "ADMIN"] },
  { label: "Propiedades Guardadas", icon: Heart, href: "/dashboard/guardadas", roles: ["COMPRADOR"] },
  { label: "Mis Solicitudes", icon: FileText, href: "/dashboard/solicitudes", roles: ["COMPRADOR"] },
  { label: "Mensajes", icon: MessageSquare, href: "/dashboard/mensajes", roles: ["ALL"] },
  { label: "Membresía", icon: CreditCard, href: "/dashboard/membresia", roles: ["BROKER", "INMOBILIARIA", "ADMIN"] },
  { label: "Certificados BRC", icon: ShieldBrc, href: "/dashboard/expedientes", roles: ["BROKER", "INMOBILIARIA", "VENDEDOR", "NOTARIO", "OPERADOR_BRC", "ADMIN"] },
  { label: "Usuarios", icon: Users, href: "/dashboard/admin/usuarios", roles: ["ADMIN"] },
  { label: "Verificar Notarios", icon: ShieldBrc, href: "/dashboard/admin/notarios", roles: ["ADMIN", "OPERADOR_BRC"] },
  { label: "Asignar Expedientes", icon: FileText, href: "/dashboard/admin/asignaciones", roles: ["ADMIN", "OPERADOR_BRC"] },
  { label: "Prueba OCR", icon: ScanSearch, href: "/dashboard/admin/ocr-test", roles: ["ADMIN"] },
  { label: "Prueba OCR Escritura", icon: ScanSearch, href: "/dashboard/admin/ocr-escritura", roles: ["ADMIN"] },
  { label: "Perfil", icon: User, href: "/dashboard/perfil", roles: ["ALL"] },
  { label: "Configuración", icon: Settings, href: "/dashboard/configuracion", roles: ["ALL"] },
];

function getNavItemsForRole(role: UserRole) {
  return allNavItems.filter((item) => item.roles.includes("ALL") || item.roles.includes(role));
}

const rolLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  INMOBILIARIA: "Inmobiliaria",
  BROKER: "Broker",
  VENDEDOR: "Vendedor",
  COMPRADOR: "Comprador",
  NOTARIO: "Notario",
  OPERADOR_BRC: "Operador BRC",
};

const SIDEBAR_COLLAPSED_KEY = "bh:sidebar-collapsed";
const SIDEBAR_BG = "#0F172A";
const BRAND_GRADIENT = "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))";

function UserAvatar({
  name,
  initials,
  avatarUrl,
  size,
  className,
}: {
  name: string;
  initials: string;
  avatarUrl: string | null;
  size: number;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-blue-500/15 font-bold text-blue-100 ring-1 ring-white/10",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {initials}
    </span>
  );
}

function SidebarContent({
  activeItem,
  userName,
  userInitials,
  userAvatarUrl,
  userRole,
  navItems,
  onLogout,
  collapsed = false,
}: {
  activeItem: string;
  userName: string;
  userInitials: string;
  userAvatarUrl: string | null;
  userRole: UserRole;
  navItems: typeof allNavItems;
  onLogout: () => void;
  /** Modo barra de iconos (escritorio): sin textos, con tooltips nativos. */
  collapsed?: boolean;
}) {
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      style={{ backgroundColor: SIDEBAR_BG }}
    >
      {/* Halo de marca muy tenue detrás del logo (sin líneas ni bordes). */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(221 83% 53% / 0.28), transparent 70%)" }}
      />

      {/* Logo */}
      <div className={cn("relative pb-5 pt-7", collapsed ? "flex justify-center px-0" : "px-6")}>
        <Link
          href="/"
          title={collapsed ? "BitHauss" : undefined}
          className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
        >
          {collapsed ? (
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-[0_8px_20px_-8px_hsl(221_83%_53%/0.8)]"
              style={{ background: BRAND_GRADIENT }}
            >
              <ShieldBrc className="h-5 w-5" />
              <span className="sr-only">BitHauss</span>
            </span>
          ) : (
            <Image
              src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Logo-BitHauss-blanco.png"
              alt="BitHauss"
              width={140}
              height={36}
              className="h-8 w-auto"
              unoptimized
            />
          )}
        </Link>
      </div>

      {/* Usuario */}
      <div
        title={collapsed ? `${userName} · ${rolLabels[userRole]}` : undefined}
        className={cn(
          "relative mb-3 flex items-center gap-3 rounded-2xl bg-white/[0.04] py-3",
          collapsed ? "mx-3 justify-center px-0" : "mx-3 px-3",
        )}
      >
        <UserAvatar name={userName} initials={userInitials} avatarUrl={userAvatarUrl} size={40} />
        {!collapsed && (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-white">{userName}</span>
            <span className="mt-0.5 truncate text-xs font-medium text-slate-400">
              {rolLabels[userRole]}
            </span>
          </div>
        )}
      </div>

      {/* Navegación */}
      <ScrollArea className="relative flex-1 px-3 py-2">
        <nav aria-label="Secciones del panel" className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = activeItem === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={`nav:${item.href}`}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group flex min-h-11 items-center gap-3 rounded-xl py-1.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]",
                  collapsed ? "justify-center px-0" : "px-2.5",
                  isActive
                    ? "bg-white/[0.08] text-white"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
                    isActive
                      ? "text-white shadow-[0_8px_20px_-8px_hsl(221_83%_53%/0.8)]"
                      : "bg-white/[0.05] text-slate-400 group-hover:bg-white/10 group-hover:text-white",
                  )}
                  style={isActive ? { background: BRAND_GRADIENT } : undefined}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                </span>
                {collapsed ? (
                  <span className="sr-only">{item.label}</span>
                ) : (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Cerrar sesión */}
      <div className="relative px-3 pb-5 pt-2">
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? "Cerrar Sesión" : undefined}
          className={cn(
            "group flex min-h-11 w-full items-center gap-3 rounded-xl py-1.5 text-sm font-medium text-slate-400 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]",
            collapsed ? "justify-center px-0" : "px-2.5",
          )}
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-slate-400 transition-colors duration-200 group-hover:bg-red-500/15 group-hover:text-red-300"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </span>
          {collapsed ? <span className="sr-only">Cerrar Sesión</span> : "Cerrar Sesión"}
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <OnboardingProvider>
        <DashboardShell>{children}</DashboardShell>
      </OnboardingProvider>
    </UserProvider>
  );
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

function useNotifications(userId: string | undefined) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [count, setCount] = useState(0);
  const supabase = useMemo(() => createClient(), []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, is_read, created_at")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    const list = (data as NotificationItem[]) ?? [];
    setItems(list);
    setCount(list.filter((n) => !n.is_read).length);
  }, [userId, supabase]);

  useEffect(() => {
    if (!userId) return;
    refresh();

    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => refresh(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, supabase, refresh]);

  const markAsRead = useCallback(
    async (id: string) => {
      await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setCount((c) => Math.max(0, c - 1));
    },
    [supabase],
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .eq("is_read", false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setCount(0);
  }, [userId, supabase]);

  return { items, count, markAsRead, markAllAsRead };
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  // Menú lateral colapsado (solo escritorio); la preferencia se recuerda por navegador.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      /* sin almacenamiento: arranca expandido */
    }
  }, []);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignorar */
      }
      return next;
    });
  }, []);
  const { items: notifications, count: notificationCount, markAsRead, markAllAsRead } = useNotifications(user?.id);

  // Close notification dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handleClick = () => setNotifOpen(false);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [notifOpen]);

  const userName = user?.fullName ?? "Cargando...";
  const userInitials = user?.initials ?? "..";
  const userAvatarUrl = user?.avatarUrl ?? null;
  const userRole = user?.role ?? "COMPRADOR";
  const handleLogout = logout;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen shadow-[8px_0_32px_-24px_rgba(15,23,42,0.5)] transition-[width] duration-300 motion-reduce:transition-none lg:block",
          collapsed ? "w-[84px]" : "w-[272px]",
        )}
      >
        <SidebarContent
          activeItem={pathname}
          userName={userName}
          userInitials={userInitials}
          userAvatarUrl={userAvatarUrl}
          userRole={userRole}
          navItems={getNavItemsForRole(userRole)}
          onLogout={handleLogout}
          collapsed={collapsed}
        />
      </aside>

      {/* Main Content */}
      <div
        className={cn(
          "transition-[margin] duration-300 motion-reduce:transition-none",
          collapsed ? "lg:ml-[84px]" : "lg:ml-[272px]",
        )}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200/60 bg-white/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-white/75 lg:px-8">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-xl text-gray-600 hover:bg-gray-100 lg:hidden"
                data-tour="nav:menu"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[272px] border-0 p-0">
              <SheetTitle className="sr-only">
                Menú de navegación
              </SheetTitle>
              <SidebarContent
                activeItem={pathname}
                userName={userName}
                userInitials={userInitials}
                userAvatarUrl={userAvatarUrl}
                userRole={userRole}
                navItems={getNavItemsForRole(userRole)}
                onLogout={handleLogout}
              />
            </SheetContent>
          </Sheet>

          {/* Colapsar / expandir menú lateral (escritorio) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            aria-pressed={collapsed}
            aria-label={collapsed ? "Mostrar menú lateral" : "Ocultar menú lateral"}
            title={collapsed ? "Mostrar menú" : "Ocultar menú"}
            className="hidden h-11 w-11 rounded-xl text-gray-600 hover:bg-gray-100 lg:inline-flex"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>

          {/* Search */}
          <label className="relative hidden md:block">
            <span className="sr-only">Buscar</span>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Buscar propiedades, leads..."
              className="h-11 w-72 appearance-none rounded-xl bg-gray-100/80 pl-10 pr-4 text-sm text-gray-700 outline-none ring-1 ring-transparent transition-[background-color,box-shadow] duration-200 placeholder:text-gray-400 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-300"
            />
          </label>

          <div className="ml-auto flex items-center gap-2">
            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setNotifOpen(!notifOpen); }}
                data-tour="nav:notificaciones"
                aria-haspopup="dialog"
                aria-expanded={notifOpen}
                className="relative flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                <Bell className="h-5 w-5" aria-hidden />
                {notificationCount > 0 && (
                  <span
                    className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
                  >
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
                <span className="sr-only">
                  Notificaciones{notificationCount > 0 ? ` (${notificationCount} sin leer)` : ""}
                </span>
              </button>

              {notifOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-96 overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[0_2px_4px_rgba(15,23,42,0.05),0_24px_48px_-16px_rgba(15,23,42,0.25)] animate-fade-in-up"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-5 pb-3 pt-4">
                    <h3
                      className="text-base font-bold text-gray-900"
                      style={{ fontFamily: "Barlow, Inter, sans-serif" }}
                    >
                      Notificaciones
                    </h3>
                    {notificationCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllAsRead()}
                        className="-mr-2 min-h-9 rounded-lg px-2 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                      >
                        Marcar todas como leídas
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto px-2 pb-2">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-400" aria-hidden>
                          <Bell className="h-5 w-5" />
                        </span>
                        <p className="mt-3 text-sm font-medium text-gray-600">Sin notificaciones</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {notifications.map((n) => {
                          const Icon =
                            n.type === "BRC_ESTADO_CAMBIO" ? ShieldBrc :
                            n.type === "LEAD_RECIBIDO" ? Users :
                            n.type === "COMPRA_SOLICITUD" ? Building2 :
                            Bell;
                          const iconBg =
                            n.type === "BRC_ESTADO_CAMBIO" ? "bg-blue-50" :
                            n.type === "LEAD_RECIBIDO" ? "bg-emerald-50" :
                            n.type === "COMPRA_SOLICITUD" ? "bg-amber-50" :
                            "bg-gray-100";
                          const iconColor =
                            n.type === "BRC_ESTADO_CAMBIO" ? "text-blue-600" :
                            n.type === "LEAD_RECIBIDO" ? "text-emerald-600" :
                            n.type === "COMPRA_SOLICITUD" ? "text-amber-600" :
                            "text-gray-500";
                          const content = (
                            <div
                              className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 transition-colors ${
                                n.is_read ? "hover:bg-gray-50" : "bg-blue-50/50 hover:bg-blue-50"
                              }`}
                              onClick={async () => {
                                if (!n.is_read) await markAsRead(n.id);
                                setNotifOpen(false);
                              }}
                            >
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
                                <Icon className={`h-4 w-4 ${iconColor}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm leading-tight text-gray-900 ${n.is_read ? "font-medium" : "font-bold"}`}>
                                  {n.title}
                                </p>
                                {n.body && (
                                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.body}</p>
                                )}
                                <p className="mt-1 text-[11px] text-gray-400">
                                  {new Date(n.created_at).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                              {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Sin leer" />}
                            </div>
                          );
                          return n.link ? (
                            <Link key={n.id} href={n.link} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
                              {content}
                            </Link>
                          ) : (
                            <div key={n.id}>{content}</div>
                          );
                        })}

                        {/* Accesos rápidos */}
                        <p className="mt-2 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          Accesos rápidos
                        </p>
                        {[
                          { href: "/dashboard/leads", icon: Users, bg: "bg-blue-50", color: "text-blue-600", title: "Ver todas tus leads", body: "Acceso rápido al inbox de leads" },
                          { href: "/dashboard/mensajes", icon: MessageSquare, bg: "bg-emerald-50", color: "text-emerald-600", title: "Mensajes", body: "Revisa tus conversaciones" },
                          { href: "/dashboard/expedientes", icon: ShieldBrc, bg: "bg-purple-50", color: "text-purple-600", title: "Expedientes BRC", body: "Revisa el estado de tus certificaciones" },
                        ].map((q) => (
                          <Link
                            key={q.href + q.title}
                            href={q.href}
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                            onClick={() => setNotifOpen(false)}
                          >
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${q.bg}`}>
                              <q.icon className={`h-4 w-4 ${q.color}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900">{q.title}</p>
                              <p className="text-xs text-gray-500">{q.body}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors duration-200 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 md:pr-3"
                >
                  {userAvatarUrl ? (
                    <Image
                      src={userAvatarUrl}
                      alt={userName}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-700"
                    >
                      {userInitials}
                    </span>
                  )}
                  <span className="hidden text-sm font-medium text-gray-700 md:inline-block">
                    {userName.split(" ")[0]}
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-gray-400 md:block" aria-hidden />
                  <span className="sr-only">Abrir menú de cuenta</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-2xl border border-gray-200/70 p-1.5 shadow-[0_2px_4px_rgba(15,23,42,0.05),0_24px_48px_-16px_rgba(15,23,42,0.25)]"
              >
                <DropdownMenuLabel className="px-2 py-1.5">
                  <span className="block truncate text-sm font-semibold text-gray-900">{userName}</span>
                  <span className="block text-xs font-normal text-gray-500">{rolLabels[userRole]}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-100" />
                <DropdownMenuItem className="min-h-10 cursor-pointer rounded-lg px-2" asChild>
                  <Link href="/dashboard/perfil">
                    <User className="mr-2 h-4 w-4 text-gray-500" />
                    Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="min-h-10 cursor-pointer rounded-lg px-2" asChild>
                  <Link href="/dashboard/configuracion">
                    <Settings className="mr-2 h-4 w-4 text-gray-500" />
                    Configuración
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="min-h-10 cursor-pointer rounded-lg px-2" asChild>
                  <Link href="/dashboard/membresia">
                    <CreditCard className="mr-2 h-4 w-4 text-gray-500" />
                    Membresía
                  </Link>
                </DropdownMenuItem>
                {isOnboardingRole(userRole) && (
                  <DropdownMenuItem
                    className="min-h-10 cursor-pointer rounded-lg px-2"
                    onClick={restartOnboarding}
                  >
                    <Compass className="mr-2 h-4 w-4 text-gray-500" />
                    Ver guía de inicio
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-gray-100" />
                <DropdownMenuItem
                  className="min-h-10 cursor-pointer rounded-lg px-2 text-red-600 focus:bg-red-50 focus:text-red-700"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
