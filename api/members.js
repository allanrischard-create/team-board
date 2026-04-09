import { neon } from "@neondatabase/serverless";

const sql = () => neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const db = sql();

  try {
    if (req.method === "GET") {
      const members = await db`SELECT name FROM members ORDER BY created_at ASC`;
      return res.status(200).json(members.map(m => m.name));
    }

    if (req.method === "POST") {
      const { name } = req.body;
      const [member] = await db`
        INSERT INTO members (name) VALUES (${name})
        ON CONFLICT (name) DO NOTHING
        RETURNING *`;
      return res.status(201).json(member);
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
