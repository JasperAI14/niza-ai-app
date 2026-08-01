ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS watermarked boolean NOT NULL DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited boolean NOT NULL DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

CREATE TABLE IF NOT EXISTS public.music_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled track',
  prompt text NOT NULL DEFAULT '',
  audio_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.music_history TO authenticated;
GRANT ALL ON public.music_history TO service_role;
ALTER TABLE public.music_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own music history" ON public.music_history;
CREATE POLICY "own music history" ON public.music_history
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS music_history_user_created_idx ON public.music_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_thread_created_idx ON public.messages (thread_id, created_at);