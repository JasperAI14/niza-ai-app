CREATE UNIQUE INDEX IF NOT EXISTS payment_events_activation_ref_uniq
  ON public.payment_events (event_type, reference)
  WHERE event_type = 'premium.activated' AND reference IS NOT NULL;