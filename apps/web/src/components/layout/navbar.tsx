"use client";

import { useState } from "react";
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
  { label: "Certificacion BRC", href: "#" },
  { label: "Planes", href: "#" },
  { label: "Nosotros", href: "#" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight text-foreground">
            BitHauss
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
                "hover:bg-accent/10 hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop auth buttons */}
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/auth/login">Iniciar Sesion</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/auth/registro">Registrarse</Link>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[360px]">
            <SheetTitle className="sr-only">Menu de navegacion</SheetTitle>
            <div className="flex flex-col gap-6 pt-6">
              {/* Mobile logo */}
              <Link
                href="/"
                className="flex items-center gap-2"
                onClick={() => setOpen(false)}
              >
                <ShieldCheck className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold tracking-tight">
                  BitHauss
                </span>
              </Link>

              {/* Mobile nav links */}
              <div className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors",
                      "hover:bg-accent/10 hover:text-foreground"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Mobile auth buttons */}
              <div className="flex flex-col gap-2 border-t pt-4">
                <Button variant="ghost" asChild className="justify-start">
                  <Link href="/auth/login" onClick={() => setOpen(false)}>
                    Iniciar Sesion
                  </Link>
                </Button>
                <Button asChild>
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
