
CREATE TABLE public.app_settings (
  id boolean PRIMARY KEY DEFAULT true,
  paystack_plan_code text,
  paystack_plan_amount_kobo integer NOT NULL DEFAULT 500000,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = true)
);
INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

GRANT SELECT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read settings" ON public.app_settings
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update settings" ON public.app_settings
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
