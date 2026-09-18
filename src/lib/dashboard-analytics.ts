import type { SupabaseClient } from "@supabase/supabase-js";
export type AnalyticsPeriod = "7" | "30" | "gesamt";
export function analyticsPeriod(value: unknown): AnalyticsPeriod {
  return value === "7" || value === "gesamt" ? value : "30";
}
export function analyticsDays(period: AnalyticsPeriod) {
  return period === "gesamt" ? null : Number(period);
}
export type TrafficMetrics = {
  profile_views: number;
  contact_clicks: number;
  website_clicks: number;
  has_data: boolean;
};
export type CampaignMetrics = {
  id: string;
  internal_name: string;
  status: "draft" | "pending" | "approved" | "rejected" | "paused";
  approved_start_date: string | null;
  approved_end_date: string | null;
  impressions: number;
  clicks: number;
};
export type CompanyMetrics = {
  today: string;
  first_day: string | null;
  traffic: TrafficMetrics;
  leads: { new: number; total: number; received: number };
  ads: Record<
    | "draft"
    | "pending"
    | "scheduled"
    | "active"
    | "paused"
    | "expired"
    | "rejected",
    number
  >;
  campaigns: CampaignMetrics[];
};
export type AdminMetrics = {
  today: string;
  first_day: string | null;
  traffic: TrafficMetrics;
  advertising: { impressions: number; clicks: number; has_data: boolean };
  counts: Record<
    | "published"
    | "profiles_pending"
    | "quality_pending"
    | "leads_new"
    | "leads_open"
    | "ads_pending"
    | "ads_active"
    | "ads_scheduled",
    number
  >;
};
type Result<T> = { data?: T; error?: string; unauthenticated?: boolean };
// Read-only RPCs return aggregated totals, never raw daily rows. No event writer exists.
async function load<T>(
  client: SupabaseClient,
  period: AnalyticsPeriod,
  rpc: string,
): Promise<Result<T>> {
  try {
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user) return { unauthenticated: true };
    const { data, error } = await client.rpc(rpc, {
      p_days: analyticsDays(period),
    });
    if (error || !data || typeof data !== "object" || !data.traffic)
      return {
        error:
          "Die Dashboard-Zahlen konnten gerade nicht geladen werden. Bitte versuchen Sie es später erneut.",
      };
    return { data: data as T };
  } catch {
    return {
      error:
        "Die Dashboard-Zahlen konnten gerade nicht geladen werden. Bitte versuchen Sie es später erneut.",
    };
  }
}
export function loadCompanyMetrics(
  client: SupabaseClient,
  period: AnalyticsPeriod,
) {
  return load<CompanyMetrics>(client, period, "get_company_dashboard_metrics");
}
export function loadAdminMetrics(
  client: SupabaseClient,
  period: AnalyticsPeriod,
) {
  return load<AdminMetrics>(client, period, "get_admin_dashboard_metrics");
}
export function clickThroughRate(impressions: number, clicks: number) {
  return impressions > 0 ? (clicks / impressions) * 100 : 0;
}
