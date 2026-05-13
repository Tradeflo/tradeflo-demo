<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Next.js 16:** The `middleware.ts` convention is deprecated. Use **`proxy.ts`** at the project root or under `src/` (same level as `app/`), with a named export **`proxy`** (not `middleware`). See `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` (“middleware to proxy”) and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`. Proxy runs in the **nodejs** runtime (not edge).
<!-- END:nextjs-agent-rules -->
