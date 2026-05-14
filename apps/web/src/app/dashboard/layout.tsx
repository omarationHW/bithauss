"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserProvider, useUser } from "./_context/user-context";
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
  ShieldCheck,
  LayoutDashboard,
  Building2,
  Users,
  MessageSquare,
  CreditCard,
  User,
  Settings,
  LogOut,
  Menu,
  Bell,
  ChevronDown,
  Search,
  Heart,
  FileText,
  FolderOpen,
  ScanSearch,
} from "lucide-react";

type UserRole = "ADMIN" | "INMOBILIARIA" | "BROKER" | "VENDEDOR" | "COMPRADOR" | "NOTARIO" | "OPERADOR_BRC";

const allNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", roles: ["ALL"] },
  { label: "Mis Propiedades", icon: Building2, href: "/dashboard/propiedades", roles: ["BROKER", "INMOBILIARIA", "VENDEDOR", "ADMIN"] },
  { label: "Leads", icon: Users, href: "/dashboard/leads", roles: ["BROKER", "INMOBILIARIA", "ADMIN"] },
  { label: "Propiedades Guardadas", icon: Heart, href: "/dashboard/guardadas", roles: ["COMPRADOR"] },
  { label: "Mis Solicitudes", icon: FileText, href: "/dashboard/solicitudes", roles: ["COMPRADOR"] },
  { label: "Mensajes", icon: MessageSquare, href: "/dashboard/mensajes", roles: ["ALL"] },
  { label: "Membresía", icon: CreditCard, href: "/dashboard/membresia", roles: ["BROKER", "INMOBILIARIA", "ADMIN"] },
  { label: "BRC Expedientes", icon: ShieldCheck, href: "/dashboard/expedientes", roles: ["BROKER", "INMOBILIARIA", "VENDEDOR", "NOTARIO", "OPERADOR_BRC", "ADMIN"] },
  { label: "Documentos KYC", icon: FolderOpen, href: "/dashboard/documentos", roles: ["COMPRADOR", "VENDEDOR"] },
  { label: "Usuarios", icon: Users, href: "/dashboard/admin/usuarios", roles: ["ADMIN"] },
  { label: "Verificar Notarios", icon: ShieldCheck, href: "/dashboard/admin/notarios", roles: ["ADMIN", "OPERADOR_BRC"] },
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

function SidebarContent({
  activeItem,
  userName,
  userInitials,
  userAvatarUrl,
  userRole,
  navItems,
  onLogout,
}: {
  activeItem: string;
  userName: string;
  userInitials: string;
  userAvatarUrl: string | null;
  userRole: UserRole;
  navItems: typeof allNavItems;
  onLogout: () => void;
}) {
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "#0F172A" }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Logo-BitHauss-blanco.png"
            alt="BitHauss"
            width={140}
            height={36}
            className="h-8 w-auto"
            unoptimized
          />
        </Link>
      </div>

      {/* Subtle divider */}
      <div className="mx-5 h-px bg-white/10" />

      {/* User Info */}
      <div className="flex items-center gap-3 px-6 py-5">
        {userAvatarUrl ? (
          <Image
            src={userAvatarUrl}
            alt={userName}
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-full object-cover shadow-lg"
          />
        ) : (
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
            }}
          >
            {userInitials}
          </div>
        )}
        <div className="flex flex-col overflow-hidden">
          <span className="truncate text-sm font-semibold text-white">
            {userName}
          </span>
          <Badge
            className="mt-1 w-fit border-0 px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{
              background:
                "linear-gradient(135deg, hsl(221 83% 53% / 0.4), hsl(160 84% 39% / 0.4))",
            }}
          >
            {rolLabels[userRole]}
          </Badge>
        </div>
      </div>

      {/* Subtle divider */}
      <div className="mx-5 h-px bg-white/10" />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = activeItem === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300",
                  isActive
                    ? "text-white shadow-lg"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
                style={
                  isActive
                    ? {
                        background:
                          "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                      }
                    : undefined
                }
              >
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px] transition-colors duration-300",
                    isActive
                      ? "text-white"
                      : "text-slate-500 group-hover:text-white"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Logout */}
      <div className="px-3 pb-5">
        <div className="mx-2 mb-4 h-px bg-white/10" />
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 transition-all duration-300 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Cerrar Sesión
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
      <DashboardShell>{children}</DashboardShell>
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
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[272px] shadow-2xl lg:block">
        <SidebarContent
          activeItem={pathname}
          userName={userName}
          userInitials={userInitials}
          userAvatarUrl={userAvatarUrl}
          userRole={userRole}
          navItems={getNavItemsForRole(userRole)}
          onLogout={handleLogout}
        />
      </aside>

      {/* Main Content */}
      <div className="lg:ml-[272px]">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 shadow-sm lg:px-8">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5 text-gray-600" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[272px] p-0">
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

          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar propiedades, leads..."
              className="h-9 w-72 rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm text-gray-700 placeholder:text-gray-400 outline-none transition-all duration-300 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setNotifOpen(!notifOpen); }}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition-all duration-300 hover:bg-gray-50 hover:text-gray-700"
              >
                <Bell className="h-[18px] w-[18px]" />
                {notificationCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                    }}
                  >
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
                <span className="sr-only">Notificaciones</span>
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 rounded-2xl border border-gray-100 bg-white shadow-2xl overflow-hidden z-50 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">Notificaciones</h3>
                    {notificationCount > 0 && (
                      <button
                        onClick={() => markAllAsRead()}
                        className="text-[11px] text-blue-500 hover:text-blue-700 font-semibold"
                      >
                        Marcar todas como leídas
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-gray-400">
                        Sin notificaciones
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {notifications.map((n) => {
                          const Icon =
                            n.type === "BRC_ESTADO_CAMBIO" ? ShieldCheck :
                            n.type === "LEAD_RECIBIDO" ? Users :
                            n.type === "COMPRA_SOLICITUD" ? Building2 :
                            Bell;
                          const iconBg =
                            n.type === "BRC_ESTADO_CAMBIO" ? "bg-blue-50" :
                            n.type === "LEAD_RECIBIDO" ? "bg-emerald-50" :
                            n.type === "COMPRA_SOLICITUD" ? "bg-amber-50" :
                            "bg-gray-50";
                          const iconColor =
                            n.type === "BRC_ESTADO_CAMBIO" ? "text-blue-500" :
                            n.type === "LEAD_RECIBIDO" ? "text-emerald-500" :
                            n.type === "COMPRA_SOLICITUD" ? "text-amber-500" :
                            "text-gray-500";
                          const content = (
                            <div
                              className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${
                                n.is_read ? "hover:bg-gray-50" : "bg-blue-50/30 hover:bg-blue-50/50"
                              }`}
                              onClick={async () => {
                                if (!n.is_read) await markAsRead(n.id);
                                setNotifOpen(false);
                              }}
                            >
                              <div className={`h-8 w-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                                <Icon className={`h-4 w-4 ${iconColor}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm ${n.is_read ? "font-medium" : "font-bold"} text-gray-900 leading-tight`}>
                                  {n.title}
                                </p>
                                {n.body && (
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                                )}
                                <p className="text-[10px] text-gray-400 mt-1">
                                  {new Date(n.created_at).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                              {!n.is_read && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
                            </div>
                          );
                          return n.link ? (
                            <Link key={n.id} href={n.link} className="block">
                              {content}
                            </Link>
                          ) : (
                            <div key={n.id}>{content}</div>
                          );
                        })}
                        {/* Legacy quick links kept as fallback at bottom */}
                        <Link
                          href="/dashboard/leads"
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                          onClick={() => setNotifOpen(false)}
                        >
                          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-blue-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">Ver todas tus leads</p>
                            <p className="text-xs text-gray-500">Acceso rápido al inbox de leads</p>
                          </div>
                        </Link>
                        <Link
                          href="/dashboard/mensajes"
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                          onClick={() => setNotifOpen(false)}
                        >
                          <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                            <MessageSquare className="h-4 w-4 text-emerald-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">Mensajes</p>
                            <p className="text-xs text-gray-500">Revisa tus conversaciones</p>
                          </div>
                        </Link>
                        <Link
                          href="/dashboard/expedientes"
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                          onClick={() => setNotifOpen(false)}
                        >
                          <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                            <ShieldCheck className="h-4 w-4 text-purple-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">Expedientes BRC</p>
                            <p className="text-xs text-gray-500">Revisa el estado de tus certificaciones</p>
                          </div>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 transition-all duration-300 hover:bg-gray-50">
                  {userAvatarUrl ? (
                    <Image
                      src={userAvatarUrl}
                      alt={userName}
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, hsl(221 83% 53%), hsl(160 84% 39%))",
                      }}
                    >
                      {userInitials}
                    </div>
                  )}
                  <span className="hidden text-sm font-medium text-gray-700 md:inline-block">
                    {userName.split(" ")[0]}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-xl border border-gray-200 p-1 shadow-lg"
              >
                <DropdownMenuLabel className="text-xs text-gray-500">
                  Mi Cuenta
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="rounded-lg cursor-pointer" asChild>
                  <Link href="/dashboard/perfil">
                    <User className="mr-2 h-4 w-4" />
                    Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg cursor-pointer" asChild>
                  <Link href="/dashboard/configuracion">
                    <Settings className="mr-2 h-4 w-4" />
                    Configuración
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg cursor-pointer" asChild>
                  <Link href="/dashboard/membresia">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Membresía
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="rounded-lg cursor-pointer text-red-600 focus:text-red-600"
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
