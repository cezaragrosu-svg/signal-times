// netlify/functions/fetch-news.mjs
// Runs on schedule (10AM daily) AND on-demand for breaking news checks
// Stores news in Netlify Blobs so the website can read it

import Anthropic from “@anthropic-ai/sdk”;
import { getStore } from “@netlify/blobs”;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const config = {
schedule: “0 10 * * *”, // Every day at 10:00 AM UTC
};

export default async function handler(req, context) {
const store = getStore(“signal-times-news”);

const today = new Date();
const dateStr = today.toLocaleDateString(“en-GB”, {
day: “numeric”,
month: “long”,
year: “numeric”,
});
const dateKey = today.toISOString().slice(0, 10); // YYYY-MM-DD

console.log(`Fetching news for ${dateStr}...`);

try {
const message = await client.messages.create({
model: “claude-sonnet-4-20250514”,
max_tokens: 4000,
tools: [
{
type: “web_search_20250305”,
name: “web_search”,
},
],
messages: [
{
role: “user”,
content: `Today is ${dateStr}. Search the web for today’s top breaking news stories from around the world.

Search for:

1. Top global breaking news today
1. Major political developments today
1. Economic news today
1. Middle East news today
1. Europe news today
1. Technology news today

Then return ONLY a valid JSON object with today’s complete news. No markdown, no explanation:

{
“date”: “${dateStr}”,
“dateKey”: “${dateKey}”,
“lastUpdated”: “${today.toISOString()}”,
“breaking”: [
{
“id”: “unique-id-1”,
“category”: “Breaking”,
“headline”: “Breaking news headline”,
“summary”: “2-3 sentence summary of what happened”,
“timestamp”: “time ago or HH:MM”,
“isBreaking”: true
}
],
“stories”: [
{
“id”: “unique-id-2”,
“category”: “World/Politics/Economy/Europe/Middle East/Asia/Americas/Africa/Technology”,
“headline”: “Full compelling headline”,
“summary”: “3-4 sentence summary of the story with key facts”,
“timestamp”: “HH:MM or X hours ago”,
“isBreaking”: false,
“featured”: true or false
}
]
}

Rules:

- breaking array: 1-3 most urgent breaking stories right now
- stories array: 12-15 top stories of the day across all categories
- First story in stories should be the biggest story of the day (featured: true)
- All real, factual news from today ${dateStr}
- Summaries must be informative and substantive
- Include stories from multiple regions and topics`,
  },
  ],
  });
  
  // Extract the JSON from the response
  const textContent = message.content
  .filter((b) => b.type === “text”)
  .map((b) => b.text)
  .join(””);
  
  const clean = textContent.replace(/`json|`/g, “”).trim();
  const newsData = JSON.parse(clean);
  
  // Store in Netlify Blobs
  await store.setJSON(`news-${dateKey}`, newsData);
  await store.setJSON(“news-latest”, newsData); // Always keep latest
  
  console.log(
  `✅ Stored ${newsData.stories?.length} stories for ${dateStr}`
  );
  
  return new Response(
  JSON.stringify({ success: true, count: newsData.stories?.length }),
  {
  status: 200,
  headers: { “Content-Type”: “application/json” },
  }
  );
  } catch (err) {
  console.error(“Failed to fetch news:”, err);
  return new Response(JSON.stringify({ error: err.message }), {
  status: 500,
  headers: { “Content-Type”: “application/json” },
  });
  }
  }
