import type { Metadata } from "next";
import {
  Inter,
  Barlow,
  Cinzel,
  Didact_Gothic,
  IBM_Plex_Mono,
  Playfair_Display,
} from "next/font/google";
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

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-cinzel",
});

const didactGothic = Didact_Gothic({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-didact-gothic",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
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
      <body
        className={`${inter.variable} ${barlow.variable} ${cinzel.variable} ${didactGothic.variable} ${ibmPlexMono.variable} ${playfairDisplay.variable} font-sans antialiased`}
      >
        <Providers>
          <LayoutWrapper>{children}</LayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}
