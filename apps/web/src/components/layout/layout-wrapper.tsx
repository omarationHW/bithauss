"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./navbar";
import { PriceTicker } from "./price-ticker";
import { Footer } from "./footer";
import { AssistantLauncher } from "@/components/assistant/assistant-launcher";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  if (isDashboard) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <PriceTicker />
      {children}
      <Footer />
      {/* Public pages only — see isAssistantRoute (allowlist). */}
      <AssistantLauncher />
    </>
  );
}
