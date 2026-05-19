import {
  Playfair_Display,
  Didact_Gothic,
  IBM_Plex_Mono,
  Cinzel,
  Noto_Sans_SC,
} from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-playfair",
});
const didact = Didact_Gothic({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-didact",
});
const ibmMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-ibm-plex-mono",
});
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-cinzel",
});
const notoCjk = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-noto-cjk",
});

export default function OficioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${playfair.variable} ${didact.variable} ${ibmMono.variable} ${cinzel.variable} ${notoCjk.variable}`}
      style={{ minHeight: "100%" }}
    >
      {children}
    </div>
  );
}
