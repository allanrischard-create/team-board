import { neon } from "@neondatabase/serverless";

const sql = () => neon(process.env.DATABASE_URL);

async function postToSlack(webhook, text) {
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, unfurl_links: false }),
  });
  if (!res.ok) throw new Error(`Slack webhook error ${res.status}`);
}

function frDate(d = new Date()) {
  return d.toLocaleDateString("fr-FR", {
    weekday: "long", day: "2-digit", month: "long",
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const WEBHOOK = process.env.SLACK_WEBHOOK_URL;
  if (!WEBHOOK) {
    return res.status(500).json({ error: "SLACK_WEBHOOK_URL not configured" });
  }

  const db  = sql();
  const type = req.query.type; // "daily" | "overdue"

  try {

    // ── 1. RÉSUMÉ DAILY  (appelé chaque matin en semaine à 9h) ──
    if (type === "daily") {
      const tasks = await db`
        SELECT title, assignee, done
        FROM tasks
        WHERE category = 'Daily'
        ORDER BY done ASC, assignee ASC
      `;

      if (!tasks.length) {
        await postToSlack(WEBHOOK,
          `🔥 *Daily Board — ${frDate()}*\nAucune tâche daily aujourd'hui !`
        );
        return res.status(200).json({ ok: true });
      }

      const pending = tasks.filter(t => !t.done);
      const done    = tasks.filter(t =>  t.done);

      const lines = [
        `🔥 *Daily Board — ${frDate()}*`,
        `${pending.length} à faire · ${done.length} terminées`,
      ];

      if (pending.length) {
        lines.push("", "*À faire :*");
        pending.forEach(t => lines.push(`• *${t.assignee}* — ${t.title}`));
      }

      if (done.length) {
        lines.push("", "✅ *Déjà faites :*");
        done.forEach(t => lines.push(`~• ${t.assignee} — ${t.title}~`));
      }

      await postToSlack(WEBHOOK, lines.join("\n"));
      return res.status(200).json({ ok: true, sent: tasks.length });
    }

    // ── 2. TÂCHES EN RETARD  (appelé chaque matin à 10h) ──────────
    if (type === "overdue") {
      const tasks = await db`
        SELECT title, assignee, due_date, category
        FROM tasks
        WHERE done = false
          AND due_date IS NOT NULL
          AND due_date < CURRENT_DATE
        ORDER BY due_date ASC, assignee ASC
      `;

      if (!tasks.length) {
        return res.status(200).json({ ok: true, msg: "No overdue tasks" });
      }

      const lines = [
        `⚠️ *${tasks.length} tâche${tasks.length > 1 ? "s" : ""} en retard — ${frDate()}*`,
        "",
      ];

      tasks.forEach(t => {
        const days = Math.round(
          (Date.now() - new Date(t.due_date).getTime()) / 86_400_000
        );
        const cat  = { Daily:"🔥", Weekly:"📅", Monthly:"🗓️", Backlog:"📌" }[t.category] || "";
        lines.push(`• ${cat} *${t.assignee}* — ${t.title} _(${days}j de retard)_`);
      });

      await postToSlack(WEBHOOK, lines.join("\n"));
      return res.status(200).json({ ok: true, sent: tasks.length });
    }

    return res.status(400).json({
      error: "type must be 'daily' or 'overdue'",
    });

  } catch (err) {
    console.error("[slack]", err);
    return res.status(500).json({ error: err.message });
  }
}
