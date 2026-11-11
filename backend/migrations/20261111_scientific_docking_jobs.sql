-- MedGen AI scientific docking persistence.
-- user_id is the durable UUID assigned by MedGen's own account/session system.
-- It is intentionally NOT auth.users(id): current MedGen sessions are not Supabase Auth JWTs.
CREATE TABLE IF NOT EXISTS public.scientific_docking_jobs (
    id BIGSERIAL PRIMARY KEY,
    job_id TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    owner_username TEXT NOT NULL,
    target_pdb TEXT NOT NULL,
    target_name TEXT NOT NULL,
    ligand_name TEXT NOT NULL,
    ligand_smiles TEXT NOT NULL,
    binding_affinity_kcal_mol DOUBLE PRECISION NOT NULL,
    hbonds_count INTEGER NOT NULL DEFAULT 0,
    lipinski_violations INTEGER NOT NULL DEFAULT 0,
    admet_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Backward-compatible upgrade from the earlier draft schema.
ALTER TABLE public.scientific_docking_jobs
    DROP CONSTRAINT IF EXISTS scientific_docking_jobs_user_id_fkey;
ALTER TABLE public.scientific_docking_jobs ADD COLUMN IF NOT EXISTS job_id TEXT;
ALTER TABLE public.scientific_docking_jobs ADD COLUMN IF NOT EXISTS owner_username TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE public.scientific_docking_jobs ADD COLUMN IF NOT EXISTS ligand_name TEXT NOT NULL DEFAULT 'legacy ligand';
ALTER TABLE public.scientific_docking_jobs ADD COLUMN IF NOT EXISTS result_data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.scientific_docking_jobs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';
UPDATE public.scientific_docking_jobs SET job_id='legacy-' || id::text WHERE job_id IS NULL;
ALTER TABLE public.scientific_docking_jobs ALTER COLUMN job_id SET NOT NULL;
ALTER TABLE public.scientific_docking_jobs ALTER COLUMN hbonds_count DROP NOT NULL;
ALTER TABLE public.scientific_docking_jobs ALTER COLUMN lipinski_violations DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_scientific_docking_jobs_job_id
    ON public.scientific_docking_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_scientific_docking_jobs_user_created
    ON public.scientific_docking_jobs(user_id, created_at DESC);
ALTER TABLE public.scientific_docking_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scientific_docking_jobs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS medgen_docking_owner_policy ON public.scientific_docking_jobs;
CREATE POLICY medgen_docking_owner_policy
    ON public.scientific_docking_jobs
    USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
    WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
