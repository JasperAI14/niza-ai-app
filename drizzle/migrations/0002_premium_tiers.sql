ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_tier text;
ALTER TABLE public.app_settings ALTER COLUMN paystack_plan_amount_kobo SET DEFAULT 700000;
UPDATE public.app_settings SET paystack_plan_amount_kobo = 700000, paystack_plan_code = NULL WHERE id = true;