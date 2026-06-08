-- 1. Aggiungiamo la colonna user_id a parsing_logs e analysis_logs (se non presenti)
ALTER TABLE public.parsing_logs 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.analysis_logs 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Creiamo gli indici per rendere le query SUM istantanee e scalabili
CREATE INDEX IF NOT EXISTS idx_parsing_logs_user_date ON public.parsing_logs(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_parsing_logs_date ON public.parsing_logs(start_time);

CREATE INDEX IF NOT EXISTS idx_analysis_logs_user_date ON public.analysis_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_date ON public.analysis_logs(created_at);

-- 3. Funzione RPC per calcolare la spesa mensile utente e globale in modo aggregato e performante sul DB
CREATE OR REPLACE FUNCTION get_monthly_spend(user_uuid uuid, start_date text)
RETURNS TABLE (user_total numeric, global_total numeric) AS $$
DECLARE
  u_parsing numeric;
  u_analysis numeric;
  g_parsing numeric;
  g_analysis numeric;
  start_ts timestamp;
BEGIN
  start_ts := start_date::timestamp;

  -- Spesa utente parsing
  SELECT COALESCE(SUM(cost_usd), 0) INTO u_parsing 
  FROM public.parsing_logs 
  WHERE user_id = user_uuid AND start_time::timestamp >= start_ts;

  -- Spesa utente analisi
  SELECT COALESCE(SUM(cost_usd), 0) INTO u_analysis 
  FROM public.analysis_logs 
  WHERE user_id = user_uuid AND created_at::timestamp >= start_ts;

  -- Spesa globale parsing
  SELECT COALESCE(SUM(cost_usd), 0) INTO g_parsing 
  FROM public.parsing_logs 
  WHERE start_time::timestamp >= start_ts;

  -- Spesa globale analisi
  SELECT COALESCE(SUM(cost_usd), 0) INTO g_analysis 
  FROM public.analysis_logs 
  WHERE created_at::timestamp >= start_ts;

  RETURN QUERY SELECT 
    (u_parsing + u_analysis)::numeric, 
    (g_parsing + g_analysis)::numeric;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Aggiungiamo la colonna per il limite mensile nella tabella profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS monthly_limit_usd numeric(10, 4) DEFAULT 1.0000;

-- 5. Funzione e Trigger per mantenere i limiti allineati in automatico nella tabella profiles:
-- - Se l'utente ha ruolo 'admin', il limite viene impostato a 20.00
-- - Se è un tester/user ed è NULL o 0.20, viene impostato al default di 1.00
CREATE OR REPLACE FUNCTION public.sync_profile_limits()
RETURNS trigger AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    NEW.monthly_limit_usd := 20.0000;
  ELSIF NEW.monthly_limit_usd IS NULL OR NEW.monthly_limit_usd = 0.2000 THEN
    NEW.monthly_limit_usd := 1.0000;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Creiamo il trigger prima dell'inserimento o dell'aggiornamento
DROP TRIGGER IF EXISTS tr_sync_profile_limits ON public.profiles;
CREATE TRIGGER tr_sync_profile_limits
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_limits();

-- 6. Rimuoviamo la vista di sola lettura se era stata creata precedentemente per tenere pulito il DB
DROP VIEW IF EXISTS public.v_profiles_active_limits;

-- 7. Allineiamo subito i record esistenti nel database
UPDATE public.profiles 
SET monthly_limit_usd = 20.0000 
WHERE role = 'admin';

UPDATE public.profiles 
SET monthly_limit_usd = 1.0000 
WHERE role != 'admin' AND (monthly_limit_usd IS NULL OR monthly_limit_usd = 0.2000 OR monthly_limit_usd = 20.0000);

-- 8. Pre-registrazione e inserimento del tester alegsonoio@gmail.com
-- Questo passaggio crea in modo sicuro l'utente in auth.users e il profilo in public.profiles,
-- rendendolo visibile subito e consentendogli l'accesso immediato con Google.
DO $$
DECLARE
  new_uid uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'alegsonoio@gmail.com') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_uid,
      'authenticated',
      'authenticated',
      'alegsonoio@gmail.com',
      '',
      now(),
      '{"provider": "google", "providers": ["google"]}',
      '{}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  END IF;

  -- Ora inseriamo il profilo per il record in auth.users
  INSERT INTO public.profiles (id, email, role, plan, monthly_limit_usd)
  SELECT id, email, 'tester', 'free', 1.0000
  FROM auth.users
  WHERE email = 'alegsonoio@gmail.com'
  ON CONFLICT (id) DO UPDATE 
  SET role = 'tester', monthly_limit_usd = 1.0000;
END $$;
