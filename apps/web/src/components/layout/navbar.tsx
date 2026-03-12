"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

const navLinks = [
  { label: "Compra", href: "/propiedades" },
  { label: "Venta", href: "/propiedades" },
  { label: "Inversión", href: "/propiedades" },
  { label: "Certificado BRC", href: "/como-funciona" },
  { label: "Nosotros", href: "/nosotros" },
  { label: "Planes", href: "/#planes" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
            src="https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images/Logo-BitHauss-blanco.png"
            alt="BitHauss"
            width={140}
            height={36}
            className={cn(
              "h-8 w-auto transition-all duration-300",
              solid && "brightness-0 dark:brightness-100"
            )}
          />
        </Link>

        {/* Right auth buttons */}
        <div className="hidden items-center gap-3 lg:flex">
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
                <span className="text-lg font-bold tracking-tight">
                  <span className="text-foreground">Bit</span>
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Hauss
                  </span>
                </span>
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
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
