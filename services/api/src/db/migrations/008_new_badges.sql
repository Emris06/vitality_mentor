-- 008_new_badges.sql
-- Adds catalog rows for the deposit and transfer first-completion badges so
-- they exist before apply.ts tries to award them via user_badges.badge_id FK.
-- Idempotent — re-applying is a no-op thanks to ON CONFLICT.

INSERT INTO badges (id, name_key, description_key, icon, criteria)
VALUES
  ('first_deposit',  'badges.first_deposit.name',  'badges.first_deposit.desc',  'banknotes',
   '{"kind":"simScenarioCompleted","scenarioId":"deposit"}'),
  ('first_transfer', 'badges.first_transfer.name', 'badges.first_transfer.desc', 'arrow-right-circle',
   '{"kind":"simScenarioCompleted","scenarioId":"transfer"}')
ON CONFLICT (id) DO NOTHING;
