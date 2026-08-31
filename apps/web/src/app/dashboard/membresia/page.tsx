"use client";

import { useEffect, useState } from "react";

import { BrcExclusionNotice } from "@/components/ui/brc-exclusion-notice";
import { apiClient } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import type { MembershipHolding, UsageSnapshot } from "@/lib/membership";

import { MembresiaView } from "./membresia-view";

/** Shape returned by GET /api/v1/memberships/me (snake_case, as in Postgres). */
interface ApiSubscription {
  id: string;
  tier: MembershipHolding["tier"];
  period: MembershipHolding["period"];
  status: MembershipHolding["status"];
  current_period_end: string;
  trial_ends_at: string | null;
  parent_subscription_id: string | null;
  payment_confirmed_by: string | null;
}

interface ApiMembership {
  subscriptions: ApiSubscription[];
  usage: {
    propertiesPublished: number;
    crmSeatsUsed: number;
    legalTicketsUsed: number;
  };
}

const EMPTY_USAGE: UsageSnapshot = {
  publishedProperties: 0,
  crmSeatsUsed: 0,
  legalTicketsUsed: 0,
};

function toHolding(row: ApiSubscription): MembershipHolding {
  return {
    id: row.id,
    tier: row.tier,
    period: row.period,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    trialEndsAt: row.trial_ends_at,
    parentSubscriptionId: row.parent_subscription_id,
    paymentConfirmedBy: row.payment_confirmed_by,
  };
}

export default function MembresiaPage() {
  const [holdings, setHoldings] = useState<MembershipHolding[]>([]);
  const [usage, setUsage] = useState<UsageSnapshot>(EMPTY_USAGE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const data = await apiClient.get<ApiMembership>(
          "/v1/memberships/me",
          session?.access_token ? { token: session.access_token } : undefined,
        );

        if (cancelled) return;

        setHoldings((data.subscriptions ?? []).map(toHolding));
        setUsage({
          publishedProperties: data.usage?.propertiesPublished ?? 0,
          crmSeatsUsed: data.usage?.crmSeatsUsed ?? 0,
          legalTicketsUsed: data.usage?.legalTicketsUsed ?? 0,
        });
      } catch {
        // A failed lookup must not fabricate a membership: the empty state is
        // the honest fallback, and every entitlement resolves to zero.
        if (!cancelled) {
          setHoldings([]);
          setUsage(EMPTY_USAGE);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-44 animate-pulse rounded-2xl bg-gray-100" />
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="h-32 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-32 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-32 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BrcExclusionNotice />
      <MembresiaView holdings={holdings} usage={usage} />
    </div>
  );
}
