import { neon } from "@neondatabase/serverless";

const sql = () => neon(process.env.DATABASE_URL);

/* ─── Migration légère : colonne `position` (ordre d'affichage des panneaux) ───
   Idempotente, exécutée une fois par instance (cold start). Rien à lancer
   manuellement dans Neon : la colonne est créée et remplie au premier appel. */
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db`ALTER TABLE members ADD COLUMN IF NOT EXISTS position INTEGER`;
  // Les membres sans position (ancienne base) prennent leur ordre de création
  await db`
    UPDATE members AS m SET position = s.rn
    FROM (SELECT id, row_number() OVER (ORDER BY created_at ASC) AS rn FROM members) AS s
    WHERE m.id = s.id AND m.position IS NULL`;
  schemaReady = true;
}

const listMembers = (db) => db`
  SELECT name, position, created_at
  FROM members
  ORDER BY position ASC NULLS LAST, created_at ASC`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const db = sql();

  try {
    await ensureSchema(db);

    if (req.method === "GET") {
      const members = await listMembers(db);
      // ?detail=1 → objets complets (position, created_at) ; sinon liste de noms
      // dans l'ordre d'affichage (compatible avec l'ancien front).
      if (req.query.detail) return res.status(200).json(members);
      return res.status(200).json(members.map(m => m.name));
    }

    if (req.method === "POST") {
      const { name } = req.body;
      // Un nouveau membre arrive en fin de tableau
      const [member] = await db`
        INSERT INTO members (name, position)
        VALUES (${name}, (SELECT COALESCE(MAX(position), 0) + 1 FROM members))
        ON CONFLICT (name) DO NOTHING
        RETURNING *`;
      return res.status(201).json(member);
    }

    if (req.method === "PUT") {
      // Réordonnancement : { order: ["Noémie", "Jean", ...] } dans l'ordre voulu
      const { order } = req.body || {};
      if (!Array.isArray(order) || !order.length || !order.every(n => typeof n === "string")) {
        return res.status(400).json({ error: "order must be a non-empty array of member names" });
      }
      const positions = order.map((_, i) => i + 1);
      await db`
        UPDATE members AS m SET position = o.pos
        FROM unnest(${order}::text[], ${positions}::int[]) AS o(name, pos)
        WHERE m.name = o.name`;
      const members = await listMembers(db);
      return res.status(200).json(members);
    }

    if (req.method === "DELETE") {
      const { name } = req.query;
      // Remove member + all their tasks
      await db`DELETE FROM tasks  WHERE assignee = ${name}`;
      await db`DELETE FROM members WHERE name    = ${name}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
