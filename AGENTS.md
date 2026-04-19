<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Package manager

This project uses **pnpm**. Always use it — never `npm install`, `npm add`, `npx`, or similar. Use `pnpm install`, `pnpm add <pkg>`, `pnpm add -D <pkg>`, `pnpm dlx <cmd>`, `pnpm test`, `pnpm run <script>`. The lockfile is `pnpm-lock.yaml`.

If you see a `package-lock.json` appear, delete it — it means someone slipped and used npm.
