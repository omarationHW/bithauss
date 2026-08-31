import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import {
  BRC_MEMBERSHIP_DISCOUNT_PCT,
  BRC_TARIFF_BRACKETS,
  IVA_RATE,
  MEMBERSHIP_TIERS,
  STRIPE_MX_CARD_FIXED_MXN,
  STRIPE_MX_CARD_PCT,
  getBrcDiscountPct,
} from "@bithauss/config";

/**
 * QA de integración — costuras A e I.
 *
 * Cuatro archivos escritos por agentes distintos contienen los MISMOS números
 * de negocio, a propósito (no se puede importar entre `apps/`, ni desde SQL):
 *
 *   1. `packages/config/src/constants.ts`            — tarifas, IVA, Stripe, descuento
 *   2. `packages/config/src/membership-plans.ts`     — descuento BRC por nivel
 *   3. `apps/api/src/modules/payments/brc-pricing.ts`— espejo servidor
 *   4. `packages/supabase/migrations/025_brc_pricing_2026.sql` + `seed/002`
 *
 * Si divergen, el cliente cotiza un precio y el servidor cobra otro — el fallo
 * más caro que puede tener este módulo, y el que ninguna prueba unitaria por
 * módulo puede ver porque cada una mockea a su vecino. Esta suite compara las
 * cuatro copias leyendo las otras tres desde disco.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");

function readRepoFile(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

const API_PRICING = readRepoFile("apps/api/src/modules/payments/brc-pricing.ts");
const MIGRATION_025 = readRepoFile(
  "packages/supabase/migrations/025_brc_pricing_2026.sql",
);
const SEED_002 = readRepoFile("packages/supabase/seed/002_membership_plans.sql");

/** `export const NAME = 0.036;` → 0.036 */
function numericConst(source: string, name: string): number {
  const match = new RegExp(
    `export const ${name}(?:\\s*:\\s*number)?\\s*=\\s*([0-9_.]+)`,
  ).exec(source);
  expect(match, `no se encontró ${name} en el espejo del API`).toBeTruthy();
  return Number(match![1]!.replace(/_/g, ""));
}

describe("costura A · el descuento BRC tiene UNA sola fuente de verdad", () => {
  it("BRC_MEMBERSHIP_DISCOUNT_PCT es la fracción de getBrcDiscountPct", () => {
    // La conversión de unidades es el riesgo real: el catálogo publica puntos
    // porcentuales (5, 10, 15) y la calculadora usa fracciones (0.05, …).
    for (const tier of MEMBERSHIP_TIERS) {
      expect(BRC_MEMBERSHIP_DISCOUNT_PCT[tier]).toBeCloseTo(
        getBrcDiscountPct(tier) / 100,
        10,
      );
    }
  });

  it("cubre exactamente los seis niveles vigentes", () => {
    expect(Object.keys(BRC_MEMBERSHIP_DISCOUNT_PCT).sort()).toEqual(
      [...MEMBERSHIP_TIERS].sort(),
    );
  });

  it("un nivel retirado del MVP no obtiene descuento", () => {
    expect(BRC_MEMBERSHIP_DISCOUNT_PCT.PREMIUM).toBeUndefined();
  });

  it("el seed 002 escribe los mismos puntos porcentuales en la base", () => {
    // Fila del CTE `tier_data`: ('GOLD'::membership_tier, 4, 300, 4,  5,  5, 0,
    for (const tier of MEMBERSHIP_TIERS) {
      const row = new RegExp(
        `\\('${tier}'::membership_tier,\\s*\\d+,\\s*\\d+,\\s*\\d+,\\s*(\\d+)`,
      ).exec(SEED_002);
      expect(row, `el seed 002 no declara el nivel ${tier}`).toBeTruthy();
      expect(Number(row![1])).toBe(getBrcDiscountPct(tier));
    }
  });
});

describe("costura I · el espejo del API coincide con @bithauss/config", () => {
  it("mismas tasas de IVA y de la pasarela", () => {
    expect(numericConst(API_PRICING, "IVA_RATE")).toBe(IVA_RATE);
    expect(numericConst(API_PRICING, "STRIPE_MX_CARD_PCT")).toBe(
      STRIPE_MX_CARD_PCT,
    );
    expect(numericConst(API_PRICING, "STRIPE_MX_CARD_FIXED_MXN")).toBe(
      STRIPE_MX_CARD_FIXED_MXN,
    );
  });

  it("mismo descuento por nivel de membresía", () => {
    const block = /BRC_MEMBERSHIP_DISCOUNT_PCT[^{]*\{([^}]*)\}/.exec(
      API_PRICING,
    );
    expect(block, "el API ya no declara BRC_MEMBERSHIP_DISCOUNT_PCT").toBeTruthy();

    const mirrored: Record<string, number> = {};
    for (const [, tier, value] of block![1]!.matchAll(
      /([A-Z_]+)\s*:\s*([0-9.]+)/g,
    )) {
      mirrored[tier!] = Number(value);
    }

    for (const tier of MEMBERSHIP_TIERS) {
      expect(mirrored[tier]).toBeCloseTo(BRC_MEMBERSHIP_DISCOUNT_PCT[tier]!, 10);
    }
    expect(Object.keys(mirrored).sort()).toEqual([...MEMBERSHIP_TIERS].sort());
  });

  it("mismos seis rangos de tarifa, con los mismos importes y límites", () => {
    const rows = [
      ...API_PRICING.matchAll(
        /\{\s*id:\s*'([A-Z0-9_]+)',\s*minMxn:\s*([0-9_]+),\s*maxMxn:\s*([0-9_]+|null),\s*amountMxn:\s*([0-9_]+)/g,
      ),
    ].map((m) => ({
      id: m[1]!,
      minMxn: Number(m[2]!.replace(/_/g, "")),
      maxMxn: m[3] === "null" ? null : Number(m[3]!.replace(/_/g, "")),
      amountMxn: Number(m[4]!.replace(/_/g, "")),
    }));

    expect(rows).toEqual(
      BRC_TARIFF_BRACKETS.map((b) => ({
        id: b.id,
        minMxn: b.minMxn,
        maxMxn: b.maxMxn,
        amountMxn: b.amountMxn,
      })),
    );
  });
});

describe("costura I · la migración 025 cobra la misma tarifa base", () => {
  it("los seis importes del catálogo SQL son los de BRC_TARIFF_BRACKETS", () => {
    const amounts = [
      ...MIGRATION_025.matchAll(
        /\('BRC 2026 · [^']+',\s*[0-9.]+,\s*(?:[0-9.]+|null),\s*([0-9]+)\.00, 'MXN', true\)/g,
      ),
    ].map((m) => Number(m[1]));

    expect(amounts).toEqual(BRC_TARIFF_BRACKETS.map((b) => b.amountMxn));
  });

  it("los cortes de rango de SQL son los de la tabla (límite superior inclusivo)", () => {
    const rows = [
      ...MIGRATION_025.matchAll(
        /\('BRC 2026 · [^']+',\s*([0-9.]+),\s*([0-9.]+|null),/g,
      ),
    ].map((m) => ({
      min: Number(m[1]),
      max: m[2] === "null" ? null : Number(m[2]),
    }));

    expect(rows).toHaveLength(BRC_TARIFF_BRACKETS.length);
    rows.forEach((row, i) => {
      const bracket = BRC_TARIFF_BRACKETS[i]!;
      expect(row.max).toBe(bracket.maxMxn);
      // El SQL arranca el rango siguiente en `.01` porque su lookup es
      // `price_min <= value <= price_max`; la tabla de TS usa el límite
      // inferior exclusivo. Ambas describen el mismo corte.
      expect(row.min).toBe(i === 0 ? 0 : bracket.minMxn + 0.01);
    });
  });
});
