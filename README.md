This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Data retention (privacy policy §8 / SRS M4)

1. Run SQL in Supabase: [`db/data_retention_purge.sql`](db/data_retention_purge.sql) (adds `user_info.data_retention_purge_after_at`).
2. When Stripe sends **`customer.subscription.deleted`**, the webhook sets **90 days** from that moment on that column.
3. When the contractor **resubscribes** (active/trialing subscription), the deadline is **cleared**.
4. Schedule a recurring **HTTPS POST** to your production **`/api/cron/data-retention-purge`** (see [Scheduling](#scheduling-data-retention-purge)).  
   Env: **`DATA_RETENTION_CRON_SECRET`** — must match **`Authorization: Bearer`** (route returns **`503`** if unset).  
   The job deletes **`work_logs`** + **`work-logs`** Storage objects, **`materials_catalog_gaps`** for the user, and all **`quotes`** (which cascades **`quote_versions`**, including payloads with job/customer/site imagery). Updates **`user_info`**: clears **`data_retention_purge_after_at`**, sets **`work_logs_uploaded`** **`false`**. **Auth login, Stripe/billing mirrors, and other profile fields stay.**

### Scheduling data retention purge

Target (production):

```http
POST /api/cron/data-retention-purge
Authorization: Bearer <DATA_RETENTION_CRON_SECRET>
Content-Type: application/json
```

#### Netlify (configured in this repo)

A **[Scheduled Function](https://docs.netlify.com/build/functions/scheduled-functions/)** runs **`@daily`** (midnight UTC):

- **`netlify/functions/data-retention-purge-scheduled.mjs`** — `POST`s your site’s **`/api/cron/data-retention-purge`**
- **`netlify.toml`** — `[functions."data-retention-purge-scheduled"]` with **`schedule = "@daily"`**

**You only need to:**

1. Set **`DATA_RETENTION_CRON_SECRET`** and **`NEXT_PUBLIC_BASE_URL`** in Netlify → **Site configuration → Environment variables** (production).
2. Deploy to **production**. Scheduled functions run on **published** deploys only (not Deploy Previews).
3. After deploy, open **Functions** in the Netlify UI — confirm **`data-retention-purge-scheduled`** shows **Scheduled**, or use **Run now** to test once.

#### Supabase

- **Dashboard:** **Integrations / Cron / HTTP Request** → **`POST`** your live site URL **`…/api/cron/data-retention-purge`** with **`Authorization: Bearer …`** (store secrets in Vault, not commits).  
  Or use **`pg_cron` + [`pg_net`](https://supabase.com/docs/guides/database/extensions/pg_net)** to **`net.http_post`** that same public URL — see [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) pattern; **`url`** is your Netlify (**or other host**) purge endpoint, **not** required to be a Supabase Edge Function unless you relocate the job.

#### Anything else that can `curl`/POST daily

GitHub Actions `schedule:`, EasyCron, etc. Same URL + Bearer secret.

## Observability (SRS §4.11)

Errors are reported to **Sentry** (`captureApiRouteError`, route wrappers, `global-error` / `error.tsx`). Configure **Sentry alert rules** in the Sentry project (e.g. email or Slack on new issues) for failure notifications.

Structured JSON logs (`user_id`, `action`, `error`, `timestamp`) are emitted via `emitStructuredApiLog` on captured API failures.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
