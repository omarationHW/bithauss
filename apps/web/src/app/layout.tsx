import type { Metadata } from "next";
import { Inter, Barlow } from "next/font/google";
import { Providers } from "./providers";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "BitHauss - Bienes Raíces Certificados",
  description:
    "Plataforma de bienes raíces con certificación blockchain para propiedades verificadas y transacciones seguras.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${barlow.variable} font-sans antialiased`}>
        <Providers>
          <LayoutWrapper>{children}</LayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}
