
CREATE TABLE public.nova_hub_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  server_url text,
  app_id text,
  app_secret text,
  webhook_secret text,
  connected_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.nova_hub_config TO authenticated;
GRANT ALL ON public.nova_hub_config TO service_role;

ALTER TABLE public.nova_hub_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read nova hub config"
  ON public.nova_hub_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins insert nova hub config"
  ON public.nova_hub_config FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update nova hub config"
  ON public.nova_hub_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.nova_hub_config (id) VALUES (true) ON CONFLICT DO NOTHING;
