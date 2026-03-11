import { HeroSection } from "@/components/landing/hero-section";
import { BrcSection } from "@/components/landing/brc-section";
import { FeaturedProperties } from "@/components/landing/featured-properties";
import { CitiesSection } from "@/components/landing/cities-section";
import { SellConfidenceSection } from "@/components/landing/sell-confidence-section";
import { SellOptionsSection } from "@/components/landing/sell-options-section";
import { AgentsSection } from "@/components/landing/agents-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { TrustSection } from "@/components/landing/trust-section";
import { CtaSection } from "@/components/landing/cta-section";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <BrcSection />
      <FeaturedProperties />
      <CitiesSection />
      <SellConfidenceSection />
      <SellOptionsSection />
      <AgentsSection />
      <PricingSection />
      <TrustSection />
      <CtaSection />
    </main>
  );
}
