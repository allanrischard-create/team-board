import { neon } from "@neondatabase/serverless";

const sql = () => neon(process.env.DATABASE_URL);

const CAT_ICON = { Daily: "🔥", Weekly: "📅", Monthly: "🗓️", Backlog: "📌" };

async function notifySlack(text) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, unfurl_links: false }),
    });
  } catch (e) {
    console.warn("[slack]", e.message);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const db = sql();

  try {
    if (req.method === "GET") {
      const tasks = await db`SELECT * FROM tasks ORDER BY created_at ASC`;
      return res.status(200).json(tasks);
    }

    if (req.method === "POST") {
      const { title, assignee, category, original_category, due_date } = req.body;
      const [task] = await db`
        INSERT INTO tasks (title, assignee, category, original_category, due_date)
        VALUES (${title}, ${assignee}, ${category}, ${original_category}, ${due_date ?? null})
        RETURNING *`;
      return res.status(201).json(task);
    }

    if (req.method === "PUT") {
      const { id, title, assignee, category, original_category, due_date, done, done_at } = req.body;

      // Fetch previous state to detect transition → done
      const [prev] = await db`SELECT done FROM tasks WHERE id = ${id}`;

      const [task] = await db`
        UPDATE tasks SET
          title             = ${title},
          assignee          = ${assignee},
          category          = ${category},
          original_category = ${original_category},
          due_date          = ${due_date ?? null},
          done              = ${done},
          done_at           = ${done_at ?? null}
        WHERE id = ${id}
        RETURNING *`;

      // Slack — notify only when task transitions to done (not already done)
      if (done && !prev?.done) {
        const icon = CAT_ICON[category] || "✅";
        await notifySlack(
          `✅ *${assignee}* a terminé : _${title}_ ${icon}`
        );
      }

      return res.status(200).json(task);
    }

    if (req.method === "DELETE") {
      const { id } = req.query;
      await db`DELETE FROM tasks WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
