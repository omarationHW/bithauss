import { describe, expect, it } from "vitest";

import {
  MEMBERSHIP_BENEFIT_ROWS,
  MEMBERSHIP_CATALOG,
  MEMBERSHIP_PERIODS,
  MEMBERSHIP_TIERS,
  MEMBERSHIP_TRIAL_DAYS,
  getBrcDiscountPct,
  getCrmSeats,
  getLegalTickets,
  getPlanPricing,
  getPrepaidAnnualSavings,
  getPriceFor,
  getPropertyLimit,
  getVideoDiscountPct,
  isMembershipPeriod,
  isMembershipTier,
  type MembershipPeriodKey,
  type MembershipTierKey,
} from "@bithauss/config";

import {
  availableUpgradeTiers,
  canConsumeLegalTicket,
  canCreateCrmSeat,
  canPublishProperty,
  canStackMembership,
  classifyTierChange,
  computeEntitlements,
  computeTrialEnd,
  daysRemaining,
  evaluateUpgrade,
  isDowngradeBlocked,
  isExpired,
  isHoldingEffective,
  isRenewalDue,
  isTrialActive,
  isTrialExpired,
  legalTicketsAvailable,
  quotaState,
  trialDaysRemaining,
  type MembershipHolding,
} from "./membership";

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

const NOW = new Date("2026-03-01T12:00:00.000Z");

function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString();
}

function holding(
  overrides: Partial<MembershipHolding> & { tier: MembershipTierKey },
): MembershipHolding {
  return {
    id: `sub-${overrides.tier}`,
    period: "ANUAL",
    status: "ACTIVA",
    currentPeriodEnd: daysFromNow(200),
    trialEndsAt: null,
    parentSubscriptionId: null,
    paymentConfirmedBy: "admin-1",
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Catálogo — los 24 precios exactos del PDF                          */
/* ------------------------------------------------------------------ */

describe("catálogo de membresías (PDF Módulo Membresías 2024 · 2026 V1)", () => {
  // Transcribed from page 10 ("RESUMÉN. MEMBRESÍAS BITHAUSS") and
  // cross-checked against the per-tier detail pages 4-9.
  const EXPECTED_PRICES: Record<
    MembershipTierKey,
    Record<MembershipPeriodKey, number>
  > = {
    START: {
      TRIMESTRAL: 3_000,
      SEMESTRAL: 6_000,
      ANUAL: 12_000,
      ANUAL_ANTICIPADO: 10_000,
    },
    GROW: {
      TRIMESTRAL: 4_500,
      SEMESTRAL: 9_000,
      ANUAL: 18_000,
      ANUAL_ANTICIPADO: 15_000,
    },
    BLUE: {
      TRIMESTRAL: 7_500,
      SEMESTRAL: 15_000,
      ANUAL: 30_000,
      ANUAL_ANTICIPADO: 25_000,
    },
    GOLD: {
      TRIMESTRAL: 10_000,
      SEMESTRAL: 20_000,
      ANUAL: 40_000,
      ANUAL_ANTICIPADO: 35_000,
    },
    BLACK: {
      TRIMESTRAL: 15_000,
      SEMESTRAL: 30_000,
      ANUAL: 60_000,
      ANUAL_ANTICIPADO: 50_000,
    },
    PLATINO: {
      TRIMESTRAL: 20_000,
      SEMESTRAL: 40_000,
      ANUAL: 80_000,
      ANUAL_ANTICIPADO: 70_000,
    },
  };

  it("tiene exactamente 6 niveles y 4 planes = 24 combinaciones", () => {
    expect(MEMBERSHIP_TIERS).toHaveLength(6);
    expect(MEMBERSHIP_PERIODS).toHaveLength(4);
    expect(Object.keys(MEMBERSHIP_CATALOG)).toHaveLength(6);
  });

  it.each(MEMBERSHIP_TIERS)("precios exactos de %s", (tier) => {
    for (const period of MEMBERSHIP_PERIODS) {
      expect(getPriceFor(tier, period)).toBe(EXPECTED_PRICES[tier][period]);
    }
  });

  // A4 — the PDF quotes one monthly instalment per tier, shared by the
  // 3/6/12-payment plans.
  const EXPECTED_INSTALMENTS: Record<MembershipTierKey, number> = {
    START: 1_100,
    GROW: 1_750,
    BLUE: 3_000,
    GOLD: 3_750,
    BLACK: 5_500,
    PLATINO: 7_500,
  };

  it.each(MEMBERSHIP_TIERS)(
    "mensualidades domiciliadas de %s (3/6/12 pagos)",
    (tier) => {
      for (const period of ["TRIMESTRAL", "SEMESTRAL", "ANUAL"] as const) {
        const pricing = getPlanPricing(tier, period);
        expect(pricing.instalmentAmount).toBe(EXPECTED_INSTALMENTS[tier]);
        expect(pricing.instalments).toBe(pricing.months);
      }
      // The prepaid annual plan is by definition a single payment.
      const prepaid = getPlanPricing(tier, "ANUAL_ANTICIPADO");
      expect(prepaid.instalmentAmount).toBeNull();
      expect(prepaid.instalments).toBeNull();
      expect(prepaid.isPrepaidAnnual).toBe(true);
    },
  );

  it("límites de propiedades y cuentas CRM", () => {
    expect(MEMBERSHIP_TIERS.map(getPropertyLimit)).toEqual([
      50, 75, 150, 300, 500, 800,
    ]);
    expect(MEMBERSHIP_TIERS.map(getCrmSeats)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("descuentos BRC y de videos", () => {
    expect(MEMBERSHIP_TIERS.map(getBrcDiscountPct)).toEqual([
      0, 0, 0, 5, 10, 15,
    ]);
    expect(MEMBERSHIP_TIERS.map(getVideoDiscountPct)).toEqual([
      0, 0, 0, 5, 10, 15,
    ]);
  });

  it("beneficios exclusivos de PLATINO", () => {
    const platino = MEMBERSHIP_CATALOG.PLATINO;
    expect(platino.certifiedProfessionalsNetwork).toBe(true);
    expect(platino.notaryNetwork).toBe(true);
    expect(platino.legalFormsLibrary).toBe(true);
    expect(platino.allowsStacking).toBe(true);

    for (const tier of MEMBERSHIP_TIERS.filter((t) => t !== "PLATINO")) {
      const def = MEMBERSHIP_CATALOG[tier];
      expect(def.certifiedProfessionalsNetwork).toBe(false);
      expect(def.notaryNetwork).toBe(false);
      expect(def.legalFormsLibrary).toBe(false);
      expect(def.allowsStacking).toBe(false);
    }
  });

  it("el plan anual anticipado siempre ahorra frente al plan anual", () => {
    for (const tier of MEMBERSHIP_TIERS) {
      expect(getPrepaidAnnualSavings(tier)).toBeGreaterThan(0);
    }
    expect(getPrepaidAnnualSavings("PLATINO")).toBe(10_000);
  });

  it("marca como (*En desarrollo) exactamente los rubros del PDF", () => {
    const inDev = MEMBERSHIP_BENEFIT_ROWS.filter((r) => r.inDevelopment).map(
      (r) => r.key,
    );
    expect(inDev).toEqual([
      "videoDiscountPct",
      "legalTickets",
      "certifiedProfessionalsNetwork",
      "notaryNetwork",
      "legalFormsLibrary",
    ]);
  });

  it("valida claves de nivel y periodo", () => {
    expect(isMembershipTier("PLATINO")).toBe(true);
    expect(isMembershipTier("BASICO")).toBe(false);
    expect(isMembershipPeriod("ANUAL_ANTICIPADO")).toBe(true);
    expect(isMembershipPeriod("monthly")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Tickets jurídicos — sólo Plan Anual anticipado en BLACK / PLATINO  */
/* ------------------------------------------------------------------ */

describe("tickets de consultas jurídicas", () => {
  it("BLACK otorga 3 y PLATINO 6 sólo con Plan Anual pagado por anticipado", () => {
    expect(getLegalTickets("BLACK", "ANUAL_ANTICIPADO")).toBe(3);
    expect(getLegalTickets("PLATINO", "ANUAL_ANTICIPADO")).toBe(6);
  });

  it("no otorga tickets en trimestral, semestral ni anual domiciliado", () => {
    for (const period of ["TRIMESTRAL", "SEMESTRAL", "ANUAL"] as const) {
      expect(getLegalTickets("BLACK", period)).toBe(0);
      expect(getLegalTickets("PLATINO", period)).toBe(0);
    }
  });

  it("los niveles 1-4 nunca otorgan tickets", () => {
    for (const tier of ["START", "GROW", "BLUE", "GOLD"] as const) {
      for (const period of MEMBERSHIP_PERIODS) {
        expect(getLegalTickets(tier, period)).toBe(0);
      }
    }
  });

  it("cuenta tickets disponibles y consumidos", () => {
    const ent = computeEntitlements(
      [holding({ tier: "PLATINO", period: "ANUAL_ANTICIPADO" })],
      NOW,
    );
    expect(ent.legalTicketsGranted).toBe(6);
    expect(legalTicketsAvailable(ent, 2)).toBe(4);
    expect(canConsumeLegalTicket(ent, 5)).toBe(true);
    expect(canConsumeLegalTicket(ent, 6)).toBe(false);
    expect(legalTicketsAvailable(ent, 99)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  A6 — acumulación                                                   */
/* ------------------------------------------------------------------ */

describe("A6 · acumulación de membresías", () => {
  it("PLATINO + BLACK = 1,300 propiedades y 11 cuentas CRM", () => {
    const ent = computeEntitlements(
      [
        holding({ tier: "PLATINO", id: "parent" }),
        holding({
          tier: "BLACK",
          id: "child",
          parentSubscriptionId: "parent",
        }),
      ],
      NOW,
    );
    expect(ent.propertyLimit).toBe(1_300);
    expect(ent.crmSeats).toBe(11);
  });

  it("acumula tres membresías cuando hay PLATINO de por medio", () => {
    const ent = computeEntitlements(
      [
        holding({ tier: "PLATINO", id: "p" }),
        holding({ tier: "BLACK", id: "c1", parentSubscriptionId: "p" }),
        holding({ tier: "GOLD", id: "c2", parentSubscriptionId: "p" }),
      ],
      NOW,
    );
    expect(ent.propertyLimit).toBe(800 + 500 + 300);
    expect(ent.crmSeats).toBe(6 + 5 + 4);
  });

  it("NO acumula cuando no hay PLATINO: se aplica sólo la mejor membresía", () => {
    const ent = computeEntitlements(
      [holding({ tier: "GOLD", id: "a" }), holding({ tier: "BLACK", id: "b" })],
      NOW,
    );
    expect(ent.propertyLimit).toBe(500);
    expect(ent.crmSeats).toBe(5);
    expect(ent.contributingTiers).toEqual(["BLACK"]);
  });

  it("los descuentos se toman al mejor porcentaje, nunca se suman", () => {
    const ent = computeEntitlements(
      [
        holding({ tier: "PLATINO", id: "p" }),
        holding({ tier: "BLACK", id: "c", parentSubscriptionId: "p" }),
      ],
      NOW,
    );
    expect(ent.brcDiscountPct).toBe(15);
    expect(ent.videoDiscountPct).toBe(15);
  });

  it("suma los tickets jurídicos de las membresías acumuladas", () => {
    const ent = computeEntitlements(
      [
        holding({ tier: "PLATINO", id: "p", period: "ANUAL_ANTICIPADO" }),
        holding({
          tier: "BLACK",
          id: "c",
          period: "ANUAL_ANTICIPADO",
          parentSubscriptionId: "p",
        }),
      ],
      NOW,
    );
    expect(ent.legalTicketsGranted).toBe(9);
  });

  it("sólo PLATINO puede contratar membresías adicionales", () => {
    expect(canStackMembership([holding({ tier: "PLATINO" })], NOW).allowed).toBe(
      true,
    );
    const denied = canStackMembership([holding({ tier: "BLACK" })], NOW);
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/PLATINO/);
  });

  it("no permite acumular sobre un PLATINO no vigente", () => {
    const expiredPlatino = holding({
      tier: "PLATINO",
      status: "VENCIDA",
      currentPeriodEnd: daysFromNow(-1),
    });
    expect(canStackMembership([expiredPlatino], NOW).allowed).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  A6 — upgrade / downgrade                                           */
/* ------------------------------------------------------------------ */

describe("A6 · upgrade y downgrade", () => {
  it("clasifica el cambio de nivel", () => {
    expect(classifyTierChange("START", "GOLD")).toBe("UPGRADE");
    expect(classifyTierChange("BLACK", "GROW")).toBe("DOWNGRADE");
    expect(classifyTierChange("BLUE", "BLUE")).toBe("SAME_TIER");
  });

  it("permite el upgrade y exige doble verificación de pago", () => {
    const decision = evaluateUpgrade("GOLD", "PLATINO");
    expect(decision.allowed).toBe(true);
    expect(decision.kind).toBe("UPGRADE");
    expect(decision.requiresPaymentDoubleVerification).toBe(true);
  });

  it("rechaza el downgrade y explica que hay que cancelar y recontratar", () => {
    const decision = evaluateUpgrade("PLATINO", "START");
    expect(decision.allowed).toBe(false);
    expect(decision.kind).toBe("DOWNGRADE");
    expect(decision.reason).toMatch(/cancelar el contrato/i);
    expect(isDowngradeBlocked("PLATINO", "START")).toBe(true);
    expect(isDowngradeBlocked("START", "PLATINO")).toBe(false);
  });

  it("rechaza el cambio al mismo nivel", () => {
    expect(evaluateUpgrade("BLUE", "BLUE").allowed).toBe(false);
  });

  it("lista sólo los niveles superiores como destino de upgrade", () => {
    expect(availableUpgradeTiers("BLUE")).toEqual([
      "GOLD",
      "BLACK",
      "PLATINO",
    ]);
    expect(availableUpgradeTiers("PLATINO")).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  A2 — prueba de 7 días                                              */
/* ------------------------------------------------------------------ */

describe("A2 · prueba gratuita de 7 días", () => {
  it("computeTrialEnd cae exactamente 7 días naturales después", () => {
    const end = computeTrialEnd(NOW);
    expect(end.getTime() - NOW.getTime()).toBe(
      MEMBERSHIP_TRIAL_DAYS * 86_400_000,
    );
  });

  it("la prueba vigente otorga 1 cuenta CRM y 3 propiedades", () => {
    const trial = holding({
      tier: "PLATINO",
      status: "PRUEBA",
      trialEndsAt: daysFromNow(4),
      paymentConfirmedBy: null,
    });
    expect(isTrialActive(trial, NOW)).toBe(true);
    expect(trialDaysRemaining(trial, NOW)).toBe(4);

    const ent = computeEntitlements([trial], NOW);
    expect(ent.isTrial).toBe(true);
    expect(ent.propertyLimit).toBe(3);
    expect(ent.crmSeats).toBe(1);
    expect(ent.trainingSeats).toBe(1);
    // Even a PLATINO trial grants none of the paid perks.
    expect(ent.brcDiscountPct).toBe(0);
    expect(ent.legalTicketsGranted).toBe(0);
    expect(ent.hasNotaryNetwork).toBe(false);
  });

  it("la prueba vencida deja de otorgar acceso", () => {
    const trial = holding({
      tier: "GOLD",
      status: "PRUEBA",
      trialEndsAt: daysFromNow(-1),
      paymentConfirmedBy: null,
    });
    expect(isTrialActive(trial, NOW)).toBe(false);
    expect(isTrialExpired(trial, NOW)).toBe(true);
    expect(trialDaysRemaining(trial, NOW)).toBe(0);
    expect(computeEntitlements([trial], NOW).propertyLimit).toBe(0);
  });

  it("una suscripción ya cobrada no se considera en prueba", () => {
    const active = holding({ tier: "GOLD", trialEndsAt: daysFromNow(3) });
    expect(isTrialActive(active, NOW)).toBe(false);
    expect(computeEntitlements([active], NOW).isTrial).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  A5 — sin doble verificación no hay acceso                          */
/* ------------------------------------------------------------------ */

describe("A5 · doble verificación de pago", () => {
  it("PENDIENTE_PAGO no otorga ningún beneficio", () => {
    const pending = holding({
      tier: "PLATINO",
      status: "PENDIENTE_PAGO",
      paymentConfirmedBy: null,
    });
    expect(isHoldingEffective(pending, NOW)).toBe(false);
    expect(computeEntitlements([pending], NOW).propertyLimit).toBe(0);
  });

  it("una fila ACTIVA sin confirmación de pago tampoco otorga acceso", () => {
    const unconfirmed = holding({
      tier: "PLATINO",
      status: "ACTIVA",
      paymentConfirmedBy: null,
    });
    expect(isHoldingEffective(unconfirmed, NOW)).toBe(false);
  });

  it("suspendida y cancelada no otorgan acceso", () => {
    expect(
      isHoldingEffective(holding({ tier: "GOLD", status: "SUSPENDIDA" }), NOW),
    ).toBe(false);
    expect(
      isHoldingEffective(holding({ tier: "GOLD", status: "CANCELADA" }), NOW),
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  A3 — vigencia                                                      */
/* ------------------------------------------------------------------ */

describe("A3 · vigencia y renovación", () => {
  it("cuenta los días restantes redondeando hacia arriba", () => {
    expect(daysRemaining(daysFromNow(30), NOW)).toBe(30);
    expect(daysRemaining(daysFromNow(0.25), NOW)).toBe(1);
    expect(daysRemaining(daysFromNow(-5), NOW)).toBe(0);
    expect(daysRemaining(null, NOW)).toBe(0);
  });

  it("detecta la expiración del plazo", () => {
    expect(isExpired({ currentPeriodEnd: daysFromNow(-1) }, NOW)).toBe(true);
    expect(isExpired({ currentPeriodEnd: daysFromNow(1) }, NOW)).toBe(false);
  });

  it("avisa la renovación dentro de los 30 días previos", () => {
    expect(isRenewalDue({ currentPeriodEnd: daysFromNow(15) }, NOW)).toBe(true);
    expect(isRenewalDue({ currentPeriodEnd: daysFromNow(45) }, NOW)).toBe(false);
    expect(isRenewalDue({ currentPeriodEnd: daysFromNow(-1) }, NOW)).toBe(false);
  });

  it("una membresía vencida no otorga beneficios", () => {
    const expired = holding({
      tier: "PLATINO",
      currentPeriodEnd: daysFromNow(-1),
    });
    expect(isHoldingEffective(expired, NOW)).toBe(false);
    expect(computeEntitlements([expired], NOW).propertyLimit).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Consumo y cuotas                                                   */
/* ------------------------------------------------------------------ */

describe("consumo de cuotas", () => {
  const ent = computeEntitlements([holding({ tier: "GOLD" })], NOW);

  it("bloquea publicar al llegar al límite", () => {
    expect(canPublishProperty(ent, 299)).toBe(true);
    expect(canPublishProperty(ent, 300)).toBe(false);
    expect(canPublishProperty(ent, 5_000)).toBe(false);
  });

  it("bloquea crear cuentas CRM al llegar al límite", () => {
    expect(canCreateCrmSeat(ent, 3)).toBe(true);
    expect(canCreateCrmSeat(ent, 4)).toBe(false);
  });

  it("sin membresía vigente no se puede publicar nada", () => {
    const none = computeEntitlements([], NOW);
    expect(none.propertyLimit).toBe(0);
    expect(canPublishProperty(none, 0)).toBe(false);
  });

  it("quotaState calcula porcentaje, restante y umbral de alerta", () => {
    expect(quotaState(24, 300)).toMatchObject({
      remaining: 276,
      percentUsed: 8,
      isAtLimit: false,
      isNearLimit: false,
    });
    expect(quotaState(280, 300).isNearLimit).toBe(true);
    expect(quotaState(300, 300).isAtLimit).toBe(true);
    // Never exceeds 100% even if the data is inconsistent.
    expect(quotaState(400, 300).percentUsed).toBe(100);
    expect(quotaState(0, 0).percentUsed).toBe(100);
  });
});
