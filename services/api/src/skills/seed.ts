/**
 * Skills taxonomy seeder.
 *
 * Idempotent: every insert is `ON CONFLICT DO UPDATE`, so re-running picks up
 * edits to the constants below without leaving stale rows.
 *
 * Seeds three tables:
 *   - skill_nodes              banking taxonomy (10 skills across 5 categories)
 *   - role_skill_requirements  two progression targets (senior_compliance,
 *                              senior_operations)
 *   - training_modules         ~12 modules, 2-3 per skill, with i18n title_keys
 *                              the frontend bundle fills in
 *
 * Run from `services/api/`:  pnpm db:seed:skills
 */

import { sql } from '../plugins/db';

interface SkillSeed {
  id: string;
  nameKey: string;
  category: string;
  relatedSkillIds: string[];
  targetXp: number;
}

const SKILL_NODES: readonly SkillSeed[] = [
  { id: 'kyc',              nameKey: 'skills.kyc',              category: 'Compliance',     relatedSkillIds: ['aml', 'customer_service'], targetXp: 200 },
  { id: 'aml',              nameKey: 'skills.aml',              category: 'Compliance',     relatedSkillIds: ['kyc', 'risk'],             targetXp: 200 },
  { id: 'accounts',         nameKey: 'skills.accounts',         category: 'Core Banking',   relatedSkillIds: ['customer_service', 'products'], targetXp: 150 },
  { id: 'deposits',         nameKey: 'skills.deposits',         category: 'Core Banking',   relatedSkillIds: ['accounts', 'products'],    targetXp: 150 },
  { id: 'transfers',        nameKey: 'skills.transfers',        category: 'Core Banking',   relatedSkillIds: ['accounts', 'aml'],         targetXp: 150 },
  { id: 'customer_service', nameKey: 'skills.customer_service', category: 'Communication',  relatedSkillIds: ['accounts', 'products'],    targetXp: 120 },
  { id: 'risk',             nameKey: 'skills.risk',             category: 'Risk',           relatedSkillIds: ['aml', 'compliance'],       targetXp: 200 },
  { id: 'compliance',       nameKey: 'skills.compliance',       category: 'Compliance',     relatedSkillIds: ['kyc', 'aml', 'risk'],      targetXp: 250 },
  { id: 'products',         nameKey: 'skills.products',         category: 'Products',       relatedSkillIds: ['accounts', 'deposits'],    targetXp: 120 },
  { id: 'fx',               nameKey: 'skills.fx',               category: 'Products',       relatedSkillIds: ['products', 'transfers'],   targetXp: 150 },
];

interface RoleReqSeed {
  role: string;
  skillId: string;
  minXp: number;
  weight: number;
}

const ROLE_REQUIREMENTS: readonly RoleReqSeed[] = [
  // senior_compliance — compliance-heavy progression target
  { role: 'senior_compliance', skillId: 'kyc',        minXp: 150, weight: 1.0 },
  { role: 'senior_compliance', skillId: 'aml',        minXp: 150, weight: 1.0 },
  { role: 'senior_compliance', skillId: 'compliance', minXp: 200, weight: 1.2 },
  { role: 'senior_compliance', skillId: 'risk',       minXp: 120, weight: 0.8 },
  // senior_operations — core banking + customer service progression target
  { role: 'senior_operations', skillId: 'accounts',         minXp: 100, weight: 1.0 },
  { role: 'senior_operations', skillId: 'deposits',         minXp: 100, weight: 1.0 },
  { role: 'senior_operations', skillId: 'transfers',        minXp: 120, weight: 1.0 },
  { role: 'senior_operations', skillId: 'customer_service', minXp:  80, weight: 0.8 },
];

interface ModuleSeed {
  id: string;
  titleKey: string;
  skillId: string;
  estimatedMinutes: number;
  contentUri: string;
}

const TRAINING_MODULES: readonly ModuleSeed[] = [
  // 2-3 modules per skill where it makes sense; ~12 total.
  { id: 'mod_kyc_basics',         titleKey: 'modules.kyc.basics',         skillId: 'kyc',              estimatedMinutes: 25, contentUri: '/learn/kyc/basics' },
  { id: 'mod_kyc_pep',            titleKey: 'modules.kyc.pep',            skillId: 'kyc',              estimatedMinutes: 30, contentUri: '/learn/kyc/pep' },
  { id: 'mod_aml_redflags',       titleKey: 'modules.aml.redflags',       skillId: 'aml',              estimatedMinutes: 35, contentUri: '/learn/aml/redflags' },
  { id: 'mod_aml_reporting',      titleKey: 'modules.aml.reporting',      skillId: 'aml',              estimatedMinutes: 30, contentUri: '/learn/aml/reporting' },
  { id: 'mod_accounts_opening',   titleKey: 'modules.accounts.opening',   skillId: 'accounts',         estimatedMinutes: 20, contentUri: '/learn/accounts/opening' },
  { id: 'mod_deposits_terms',     titleKey: 'modules.deposits.terms',     skillId: 'deposits',         estimatedMinutes: 25, contentUri: '/learn/deposits/terms' },
  { id: 'mod_transfers_swift',    titleKey: 'modules.transfers.swift',    skillId: 'transfers',        estimatedMinutes: 30, contentUri: '/learn/transfers/swift' },
  { id: 'mod_cs_objections',      titleKey: 'modules.cs.objections',      skillId: 'customer_service', estimatedMinutes: 25, contentUri: '/learn/cs/objections' },
  { id: 'mod_cs_empathy',         titleKey: 'modules.cs.empathy',         skillId: 'customer_service', estimatedMinutes: 20, contentUri: '/learn/cs/empathy' },
  { id: 'mod_risk_assessment',    titleKey: 'modules.risk.assessment',    skillId: 'risk',             estimatedMinutes: 35, contentUri: '/learn/risk/assessment' },
  { id: 'mod_compliance_charter', titleKey: 'modules.compliance.charter', skillId: 'compliance',       estimatedMinutes: 40, contentUri: '/learn/compliance/charter' },
  { id: 'mod_products_overview',  titleKey: 'modules.products.overview',  skillId: 'products',         estimatedMinutes: 20, contentUri: '/learn/products/overview' },
  { id: 'mod_fx_rates',           titleKey: 'modules.fx.rates',           skillId: 'fx',               estimatedMinutes: 25, contentUri: '/learn/fx/rates' },
];

async function main(): Promise<void> {
  // skill_nodes -------------------------------------------------------------
  await sql.begin(async (tx) => {
    for (const s of SKILL_NODES) {
      await tx`
        INSERT INTO skill_nodes (id, name_key, category, related_skill_ids, target_xp)
        VALUES (${s.id}, ${s.nameKey}, ${s.category},
                ${s.relatedSkillIds as unknown as string[]}, ${s.targetXp})
        ON CONFLICT (id) DO UPDATE
          SET name_key = EXCLUDED.name_key,
              category = EXCLUDED.category,
              related_skill_ids = EXCLUDED.related_skill_ids,
              target_xp = EXCLUDED.target_xp
      `;
    }
  });
  console.log(`[seed:skills] upserted ${SKILL_NODES.length} skill_nodes`);

  // role_skill_requirements --------------------------------------------------
  await sql.begin(async (tx) => {
    for (const r of ROLE_REQUIREMENTS) {
      await tx`
        INSERT INTO role_skill_requirements (role, skill_id, min_xp, weight)
        VALUES (${r.role}, ${r.skillId}, ${r.minXp}, ${r.weight})
        ON CONFLICT (role, skill_id) DO UPDATE
          SET min_xp = EXCLUDED.min_xp,
              weight = EXCLUDED.weight
      `;
    }
  });
  console.log(`[seed:skills] upserted ${ROLE_REQUIREMENTS.length} role_skill_requirements`);

  // training_modules ---------------------------------------------------------
  await sql.begin(async (tx) => {
    for (const m of TRAINING_MODULES) {
      await tx`
        INSERT INTO training_modules (id, title_key, skill_id, estimated_minutes, content_uri)
        VALUES (${m.id}, ${m.titleKey}, ${m.skillId}, ${m.estimatedMinutes}, ${m.contentUri})
        ON CONFLICT (id) DO UPDATE
          SET title_key = EXCLUDED.title_key,
              skill_id = EXCLUDED.skill_id,
              estimated_minutes = EXCLUDED.estimated_minutes,
              content_uri = EXCLUDED.content_uri
      `;
    }
  });
  console.log(`[seed:skills] upserted ${TRAINING_MODULES.length} training_modules`);

  console.log('[seed:skills] done');
}

main()
  .then(async () => {
    await sql.end({ timeout: 5 });
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[seed:skills] failed', err);
    await sql.end({ timeout: 5 }).catch(() => undefined);
    process.exit(1);
  });
