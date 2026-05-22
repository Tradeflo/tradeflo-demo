/**
 * Netlify Scheduled Function — daily POST to Next.js data retention purge API.
 * Requires `DATA_RETENTION_CRON_SECRET` and `NEXT_PUBLIC_BASE_URL` in Netlify env.
 */

export default async (req) => {
  let nextRun = "unknown";
  try {
    const body = await req.json();
    if (body?.next_run) nextRun = body.next_run;
  } catch {
    /* manual "Run now" may omit body */
  }

  const secret = process.env.DATA_RETENTION_CRON_SECRET?.trim();
  if (!secret) {
    console.error(
      "[data-retention-purge-scheduled] DATA_RETENTION_CRON_SECRET is not set",
    );
    return new Response(
      JSON.stringify({
        ok: false,
        error: "DATA_RETENTION_CRON_SECRET is not configured",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (!siteUrl) {
    console.error(
      "[data-retention-purge-scheduled] NEXT_PUBLIC_BASE_URL is not set",
    );
    return new Response(
      JSON.stringify({ ok: false, error: "NEXT_PUBLIC_BASE_URL is not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const purgeUrl = `${siteUrl}/api/cron/data-retention-purge`;
  console.log(
    "[data-retention-purge-scheduled] POST",
    purgeUrl,
    "next_run",
    nextRun,
  );

  try {
    const res = await fetch(purgeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
    });
    const text = await res.text();
    console.log(
      "[data-retention-purge-scheduled] response",
      res.status,
      text.slice(0, 500),
    );

    return new Response(
      JSON.stringify({
        ok: res.ok,
        status: res.status,
        next_run: nextRun,
        purge: text.slice(0, 2000),
      }),
      {
        status: res.ok ? 200 : 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[data-retention-purge-scheduled]", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
};
