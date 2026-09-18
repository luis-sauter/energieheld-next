-- Repository only. Read-only analytics foundation; no events or increment endpoints.
CREATE TABLE public.company_daily_metrics (
 profile_id uuid NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
 metric_date date NOT NULL,
 profile_views bigint NOT NULL DEFAULT 0 CHECK (profile_views>=0),
 contact_clicks bigint NOT NULL DEFAULT 0 CHECK (contact_clicks>=0),
 website_clicks bigint NOT NULL DEFAULT 0 CHECK (website_clicks>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(profile_id,metric_date)
);
CREATE TABLE public.ad_campaign_daily_metrics (
 campaign_id uuid NOT NULL REFERENCES public.company_ad_campaigns(id) ON DELETE CASCADE,
 metric_date date NOT NULL,
 impressions bigint NOT NULL DEFAULT 0 CHECK (impressions>=0),
 clicks bigint NOT NULL DEFAULT 0 CHECK (clicks>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(campaign_id,metric_date)
);
CREATE INDEX company_metrics_date_idx ON public.company_daily_metrics(metric_date);
CREATE INDEX ad_metrics_date_idx ON public.ad_campaign_daily_metrics(metric_date);
ALTER TABLE public.company_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaign_daily_metrics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_daily_metrics,public.ad_campaign_daily_metrics FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.company_daily_metrics,public.ad_campaign_daily_metrics TO authenticated;
CREATE POLICY metrics_company_owner ON public.company_daily_metrics FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id WHERE p.id=profile_id AND c.owner_user_id=(SELECT auth.uid()))
);
CREATE POLICY metrics_company_admin ON public.company_daily_metrics FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid()))
);
CREATE POLICY metrics_ad_owner ON public.ad_campaign_daily_metrics FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.company_ad_campaigns a JOIN public.company_profiles p ON p.id=a.profile_id JOIN public.companies c ON c.id=p.company_id WHERE a.id=campaign_id AND c.owner_user_id=(SELECT auth.uid()))
);
CREATE POLICY metrics_ad_admin ON public.ad_campaign_daily_metrics FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid()))
);
-- Internal read helpers; one calendar definition for metrics dates and lead timestamps.
CREATE FUNCTION public.dashboard_period(p_days integer)
RETURNS TABLE(first_day date,today date,first_instant timestamptz,after_today timestamptz)
LANGUAGE plpgsql STABLE SET search_path='' AS $$
BEGIN
 IF p_days IS NOT NULL AND p_days NOT IN (7,30) THEN RAISE EXCEPTION 'invalid period'; END IF;
 today := (now() AT TIME ZONE 'Europe/Berlin')::date;
 first_day := CASE WHEN p_days IS NULL THEN NULL ELSE today-(p_days-1) END;
 first_instant := first_day::timestamp AT TIME ZONE 'Europe/Berlin';
 after_today := (today+1)::timestamp AT TIME ZONE 'Europe/Berlin';
 RETURN NEXT;
END; $$;
CREATE FUNCTION public.dashboard_ad_state(p_status text,p_start date,p_end date,p_today date)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p_status<>'approved' THEN p_status WHEN p_start>p_today THEN 'scheduled' WHEN p_end<p_today THEN 'expired' ELSE 'active' END;
$$;
CREATE FUNCTION public.get_company_dashboard_metrics(p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE own_profile uuid; period record; traffic jsonb; leads jsonb; ads jsonb; campaigns jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
 SELECT p.id INTO own_profile FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id WHERE c.owner_user_id=auth.uid();
 IF own_profile IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
 SELECT * INTO period FROM public.dashboard_period(p_days);
 SELECT jsonb_build_object('profile_views',coalesce(sum(profile_views),0),'contact_clicks',coalesce(sum(contact_clicks),0),'website_clicks',coalesce(sum(website_clicks),0),'has_data',count(*)>0)
 INTO traffic FROM public.company_daily_metrics WHERE profile_id=own_profile AND metric_date<=period.today AND (period.first_day IS NULL OR metric_date>=period.first_day);
 SELECT jsonb_build_object('new',count(*) FILTER (WHERE status='new'),'total',count(*),
 'received',count(*) FILTER (WHERE created_at<period.after_today AND (period.first_instant IS NULL OR created_at>=period.first_instant)))
 INTO leads FROM public.company_leads WHERE profile_id=own_profile;
 WITH states AS (SELECT public.dashboard_ad_state(status,approved_start_date,approved_end_date,period.today) AS state FROM public.company_ad_campaigns WHERE profile_id=own_profile)
 SELECT jsonb_build_object('draft',count(*) FILTER(WHERE state='draft'),'pending',count(*) FILTER(WHERE state='pending'),'scheduled',count(*) FILTER(WHERE state='scheduled'),
 'active',count(*) FILTER(WHERE state='active'),'paused',count(*) FILTER(WHERE state='paused'),'expired',count(*) FILTER(WHERE state='expired'),'rejected',count(*) FILTER(WHERE state='rejected')) INTO ads FROM states;
 -- Aggregate all campaign metrics together; no query per campaign and no daily rows leave the DB.
 WITH totals AS (
 SELECT a.id,a.internal_name,a.status,a.approved_start_date,a.approved_end_date,
 coalesce(sum(m.impressions),0) AS impressions,coalesce(sum(m.clicks),0) AS clicks
 FROM public.company_ad_campaigns a LEFT JOIN public.ad_campaign_daily_metrics m ON m.campaign_id=a.id
 AND m.metric_date<=period.today AND (period.first_day IS NULL OR m.metric_date>=period.first_day)
 WHERE a.profile_id=own_profile GROUP BY a.id
 ) SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.internal_name,t.id),'[]'::jsonb) INTO campaigns FROM totals t;
 RETURN jsonb_build_object('today',period.today,'first_day',period.first_day,'traffic',traffic,'leads',leads,'ads',ads,'campaigns',campaigns);
END; $$;
-- This narrowly authorized aggregate reads lead totals without changing lead RLS
-- or exposing individual inquiries to admins. No existing business table is modified.
CREATE FUNCTION public.get_admin_dashboard_metrics(p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE period record; traffic jsonb; advertising jsonb; counts jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
 SELECT * INTO period FROM public.dashboard_period(p_days);
 SELECT jsonb_build_object('profile_views',coalesce(sum(profile_views),0),'contact_clicks',coalesce(sum(contact_clicks),0),'website_clicks',coalesce(sum(website_clicks),0),'has_data',count(*)>0)
 INTO traffic FROM public.company_daily_metrics WHERE metric_date<=period.today AND (period.first_day IS NULL OR metric_date>=period.first_day);
 SELECT jsonb_build_object('impressions',coalesce(sum(impressions),0),'clicks',coalesce(sum(clicks),0),'has_data',count(*)>0)
 INTO advertising FROM public.ad_campaign_daily_metrics WHERE metric_date<=period.today AND (period.first_day IS NULL OR metric_date>=period.first_day);
 WITH profiles AS (SELECT count(*) FILTER(WHERE status='approved') AS published,count(*) FILTER(WHERE status='pending') AS pending FROM public.company_profiles),
 quality AS (SELECT count(*) AS pending FROM public.company_quality_requests WHERE status='pending'),
 inquiries AS (SELECT count(*) FILTER(WHERE status='new') AS new,count(*) FILTER(WHERE status IN ('new','read')) AS open FROM public.company_leads),
 campaigns AS (SELECT public.dashboard_ad_state(status,approved_start_date,approved_end_date,period.today) AS state FROM public.company_ad_campaigns),
 ad_counts AS (SELECT count(*) FILTER(WHERE state='pending') AS pending,count(*) FILTER(WHERE state='active') AS active,count(*) FILTER(WHERE state='scheduled') AS scheduled FROM campaigns)
 SELECT jsonb_build_object('published',p.published,'profiles_pending',p.pending,'quality_pending',q.pending,'leads_new',l.new,'leads_open',l.open,
 'ads_pending',a.pending,'ads_active',a.active,'ads_scheduled',a.scheduled)
 INTO counts FROM profiles p CROSS JOIN quality q CROSS JOIN inquiries l CROSS JOIN ad_counts a;
 RETURN jsonb_build_object('today',period.today,'first_day',period.first_day,'traffic',traffic,'advertising',advertising,'counts',counts);
END; $$;
REVOKE ALL ON FUNCTION public.dashboard_period(integer),public.dashboard_ad_state(text,date,date,date),public.get_company_dashboard_metrics(integer),public.get_admin_dashboard_metrics(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_dashboard_metrics(integer),public.get_admin_dashboard_metrics(integer) TO authenticated;
COMMENT ON TABLE public.company_daily_metrics IS 'Empty analytics foundation. Future trusted server-side increments must authorize callers and update timestamps. No browser writes or tracking enabled.';
COMMENT ON TABLE public.ad_campaign_daily_metrics IS 'Empty analytics foundation. No tracking or increment endpoint enabled.';
