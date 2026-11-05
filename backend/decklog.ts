const origins = new Set(["https://yumekazaki.github.io"]);

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers = {
    "Content-Type": "application/json",
    "Vary": "Origin",
    ...(origin && origins.has(origin) ? {"Access-Control-Allow-Origin": origin} : {}),
  };
  const respond = (body: unknown, status = 200) => Response.json(body, {status, headers});
  if (origin && !origins.has(origin)) return respond({error: "Origin unavailable."}, 403);
  if (request.method !== "GET") return respond({error: "Use GET."}, 405);

  const params = new URL(request.url).searchParams;
  const code = params.get("code")?.toUpperCase() ?? "";
  const language = params.get("language");
  if (!/^[A-Z0-9]{3,10}$/.test(code) || (language !== "EN" && language !== "JP")) {
    return respond({error: "Enter a valid Deck Log code and edition."}, 400);
  }
  const host = language === "EN" ? "https://decklog-en.bushiroad.com" : "https://decklog.bushiroad.com";
  try {
    const response = await fetch(host + "/system/app/api/view/" + code, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": host,
        "Referer": host + "/view/" + code,
      },
      body: "{}",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return respond({error: "Deck Log is temporarily unavailable."}, 502);
    const data = await response.json();
    if (data?.deck_id !== code) return respond({error: "No shared deck found for this code and edition."}, 404);
    if (Number(data.game_title_id) !== 2) return respond({error: "This code is for a different card game."}, 422);
    if (!Array.isArray(data.list) || !data.list.length || data.list.length > 500 ||
      data.list.some(row => typeof row?.card_number !== "string" || !/^[A-Za-z0-9/._-]{3,80}$/.test(row.card_number) ||
        !Number.isSafeInteger(row.num) || row.num < 1 || row.num > 500)) {
      return respond({error: "Deck Log returned an unsupported card list."}, 422);
    }
    return respond({
      title: typeof data.title === "string" ? data.title.slice(0, 200) : "",
      format: data.deck_param1 === "N" ? "Neo Standard" : "Standard",
      cards: data.list.map(row => ({code: row.card_number, count: row.num})),
    });
  } catch {
    return respond({error: "Deck Log could not be reached. Try again shortly."}, 502);
  }
});
