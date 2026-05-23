CREATE TABLE IF NOT EXISTS resources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_key    TEXT NOT NULL,
  desc_key     TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('aml_kyc', 'customer', 'products', 'operations')),
  doc_type     TEXT NOT NULL CHECK (doc_type IN ('guide', 'checklist', 'sop', 'regulation')),
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO resources (title_key, desc_key, category, doc_type) VALUES
  ('resources.aml_intro.title',        'resources.aml_intro.desc',        'aml_kyc',    'guide'),
  ('resources.kyc_checklist.title',    'resources.kyc_checklist.desc',    'aml_kyc',    'checklist'),
  ('resources.pep_screening.title',    'resources.pep_screening.desc',    'aml_kyc',    'checklist'),
  ('resources.complaint_sop.title',    'resources.complaint_sop.desc',    'customer',   'sop'),
  ('resources.account_types.title',    'resources.account_types.desc',    'products',   'guide'),
  ('resources.deposit_ops.title',      'resources.deposit_ops.desc',      'operations', 'sop'),
  ('resources.transfer_reg.title',     'resources.transfer_reg.desc',     'operations', 'regulation'),
  ('resources.onboarding_guide.title', 'resources.onboarding_guide.desc', 'operations', 'guide')
ON CONFLICT DO NOTHING;
