// netlify/functions/get-news.mjs
// Called by the website to retrieve today's news from storage
// Also handles breaking news checks (called every 15 min)

import { getStore } from "@netlify/blobs";

export default async function handler(req, context) {
  // CORS headers so the website can call this
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  };

  try {
    const store = getStore("signal-times-news");
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");

    let newsData;

    if (dateParam) {
      // Get news for specific date
      newsData = await store.get(`news-${dateParam}`, { type: "json" });
    } else {
      // Get latest news
      newsData = await store.get("news-latest", { type: "json" });
    }

    if (!newsData) {
      // No news stored yet — return empty structure
      return new Response(
        JSON.stringify({
          date: new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          breaking: [],
          stories: [],
          empty: true,
        }),
        { status: 200, headers }
      );
    }

    return new Response(JSON.stringify(newsData), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers,
    });
  }
}
