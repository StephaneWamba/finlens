-- Row Level Security (RLS) Policies
-- Ensures users can only access their own company's data

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Companies policies
CREATE POLICY "Users can view own company"
  ON public.companies FOR SELECT
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "Owners can update own company"
  ON public.companies FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can insert company"
  ON public.companies FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Agent Configs policies
CREATE POLICY "Users can view company agent configs"
  ON public.agent_configs FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage company agent configs"
  ON public.agent_configs FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Contacts policies
CREATE POLICY "Users can view company contacts"
  ON public.contacts FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage company contacts"
  ON public.contacts FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Deals policies
CREATE POLICY "Users can view company deals"
  ON public.deals FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage company deals"
  ON public.deals FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Analytics Events policies
CREATE POLICY "Users can view company analytics"
  ON public.analytics_events FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert company analytics"
  ON public.analytics_events FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

