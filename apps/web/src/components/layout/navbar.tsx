"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldCheck, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

const navLinks = [
  { label: "Propiedades", href: "/propiedades" },
  { label: "Certificacion BRC", href: "/como-funciona" },
  { label: "Planes", href: "/#planes" },
  { label: "Nosotros", href: "/nosotros" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        "backdrop-blur-xl supports-[backdrop-filter]:bg-background/70",
        scrolled
          ? "bg-background/80 border-b border-border/50 shadow-sm shadow-primary/[0.03]"
          : "bg-background/40 border-b border-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo - Enhanced with accent color on "Hauss" */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="relative">
            <ShieldCheck className="h-7 w-7 text-primary transition-transform duration-300 group-hover:scale-110" />
            <div className="absolute inset-0 h-7 w-7 bg-primary/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            <span className="text-foreground">Bit</span>
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Hauss
            </span>
          </span>
        </Link>

        {/* Desktop nav links - Enhanced */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={cn(
                "relative rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-all duration-200",
                "hover:text-foreground hover:bg-primary/5"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop auth buttons - Enhanced with glow on CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-muted-foreground hover:text-foreground"
          >
            <Link href="/auth/login">Iniciar Sesion</Link>
          </Button>
          <Button
            size="sm"
            asChild
            className="relative shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-shadow duration-300"
          >
            <Link href="/auth/registro">Registrarse</Link>
          </Button>
        </div>

        {/* Mobile hamburger - Enhanced */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden hover:bg-primary/5"
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
              {/* Mobile logo - Enhanced */}
              <Link
                href="/"
                className="flex items-center gap-2.5"
                onClick={() => setOpen(false)}
              >
                <ShieldCheck className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold tracking-tight">
                  <span className="text-foreground">Bit</span>
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Hauss
                  </span>
                </span>
              </Link>

              {/* Mobile nav links - Enhanced */}
              <div className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-all duration-200",
                      "hover:bg-primary/5 hover:text-foreground hover:translate-x-1"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Mobile auth buttons - Enhanced */}
              <div className="flex flex-col gap-3 border-t border-border/50 pt-6">
                <Button
                  variant="outline"
                  asChild
                  className="justify-center border-border/50 hover:border-primary/30 hover:bg-primary/5"
                >
                  <Link href="/auth/login" onClick={() => setOpen(false)}>
                    Iniciar Sesion
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
