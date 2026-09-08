-- ─────────────────────────────────────────────────────────────────
--  Team Board — Postprod Sheriff Projects
--  Neon (PostgreSQL) schema
--  Run once in the Neon SQL editor or via psql
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS members (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  position   INTEGER,                         -- ordre d'affichage des panneaux (glisser-déposer)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration pour une base existante (appliquée aussi automatiquement par api/members.js
-- au premier appel, donc facultative ici) :
ALTER TABLE members ADD COLUMN IF NOT EXISTS position INTEGER;
UPDATE members AS m SET position = s.rn
FROM (SELECT id, row_number() OVER (ORDER BY created_at ASC) AS rn FROM members) AS s
WHERE m.id = s.id AND m.position IS NULL;

CREATE TABLE IF NOT EXISTS tasks (
  id                SERIAL       PRIMARY KEY,
  title             TEXT         NOT NULL,
  assignee          TEXT         NOT NULL REFERENCES members(name) ON DELETE CASCADE,
  category          TEXT         NOT NULL CHECK (category          IN ('Daily','Weekly','Monthly','Backlog')),
  original_category TEXT         NOT NULL CHECK (original_category IN ('Daily','Weekly','Monthly','Backlog')),
  due_date          DATE,
  done              BOOLEAN      NOT NULL DEFAULT false,
  done_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_assignee_idx  ON tasks (assignee);
CREATE INDEX IF NOT EXISTS tasks_category_idx  ON tasks (category);
CREATE INDEX IF NOT EXISTS tasks_done_idx      ON tasks (done);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx  ON tasks (due_date) WHERE due_date IS NOT NULL;

-- ─── Membres initiaux ────────────────────────────────────────────
INSERT INTO members (name) VALUES
  ('Noémie'),
  ('Rafaela'),
  ('Helena'),
  ('Gwen'),
  ('Félix'),
  ('David'),
  ('Alexandre'),
  ('Nora'),
  ('Jean')
ON CONFLICT (name) DO NOTHING;
