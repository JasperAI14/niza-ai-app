ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS puter_username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS puter_linked_at timestamptz;