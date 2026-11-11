-- MedGen AI scientific docking persistence.
-- owner_id is the durable UUID assigned by MedGen's own account/session system.
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
CREATE INDEX IF NOT EXISTS idx_scientific_docking_jobs_user_created
    ON public.scientific_docking_jobs(user_id, created_at DESC);
ALTER TABLE public.scientific_docking_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scientific_docking_jobs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS medgen_docking_owner_policy ON public.scientific_docking_jobs;
CREATE POLICY medgen_docking_owner_policy
    ON public.scientific_docking_jobs
    USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
    WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
