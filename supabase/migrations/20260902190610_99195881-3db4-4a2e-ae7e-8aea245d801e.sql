ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS threads_user_pinned_idx ON public.threads (user_id, pinned, updated_at DESC);