import { HeroSection } from "@/components/landing/hero-section";
import { FeaturedProperties } from "@/components/landing/featured-properties";
import { BrcSection } from "@/components/landing/brc-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { TrustSection } from "@/components/landing/trust-section";
import { CtaSection } from "@/components/landing/cta-section";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <FeaturedProperties />
      <BrcSection />
      <PricingSection />
      <TrustSection />
      <CtaSection />
    </main>
  );
}
