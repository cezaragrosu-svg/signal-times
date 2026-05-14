// netlify/functions/check-breaking.mjs
// Runs every 15 minutes to check for breaking news
// Only adds NEW stories that aren't already stored

import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const config = {
  schedule: "*/15 * * * *", // Every 15 minutes
};

export default async function handler(req, context) {
  const store = getStore("signal-times-news");
  const dateKey = new Date().toISOString().slice(0, 10);

  try {
    // Get existing news
    const existing = await store.get("news-latest", { type: "json" });
    const existingHeadlines = new Set(
      [
        ...(existing?.breaking || []),
        ...(existing?.stories || []),
      ].map((s) => s.headline?.toLowerCase())
    );

    const dateStr = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Search for breaking news only
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [
        {
          role: "user",
          content: `Search for any BREAKING NEWS in the last 30 minutes. Today is ${dateStr}.

Search: "breaking news last 30 minutes" and "latest breaking news today"

Return ONLY valid JSON, no markdown:
{
  "newBreaking": [
    {
      "id": "breaking-timestamp",
      "category": "Breaking",
      "headline": "Breaking headline",
      "summary": "2-3 sentence summary",
      "timestamp": "X minutes ago",
      "isBreaking": true
    }
  ]
}

If there is no genuine new breaking news in the last 30 minutes, return: {"newBreaking": []}
Only include stories that are TRULY breaking — major events, not regular news updates.`,
        },
      ],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    if (!result.newBreaking || result.newBreaking.length === 0) {
      return new Response(JSON.stringify({ added: 0 }), { status: 200 });
    }

    // Filter out stories we already have
    const genuinelyNew = result.newBreaking.filter(
      (s) => !existingHeadlines.has(s.headline?.toLowerCase())
    );

    if (genuinelyNew.length === 0) {
      return new Response(JSON.stringify({ added: 0 }), { status: 200 });
    }

    // Merge new breaking stories with existing
    const updated = {
      ...existing,
      lastUpdated: new Date().toISOString(),
      breaking: [...genuinelyNew, ...(existing?.breaking || [])].slice(0, 5), // Keep max 5 breaking
    };

    await store.setJSON("news-latest", updated);
    await store.setJSON(`news-${dateKey}`, updated);

    console.log(`✅ Added ${genuinelyNew.length} new breaking stories`);

    return new Response(
      JSON.stringify({ added: genuinelyNew.length, stories: genuinelyNew }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Breaking news check failed:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
