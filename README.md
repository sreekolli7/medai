# MedAi

MCAT study app: practice questions for every section, an AI tutor that answers only from cited sources,
and 3D anatomy. Study tool only. Not medical advice.

## Stack

- Frontend: React + Vite + TypeScript, plain CSS, hosted on Vercel
- Backend: Supabase (Postgres, Auth, Storage, Edge Functions, pgvector)
- AI: Anthropic API, called only from Edge Functions (and the local question-drafting script)
- Embeddings: Voyage AI

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase URL + publishable key
npm run dev
```

Only public values belong in `.env.local`. Server secrets (Anthropic, Voyage, Stripe, service role key)
are set with `npx supabase secrets set ...` and never committed.

## Content

MCAT sections and topics live in the `sections` and `topics` tables. Every part, question and tutor passage
belongs to a topic. Everything starts as `reviewed = false` and shows as Draft until a reviewer approves it.

- Tutor sources: Wikipedia articles (CC BY-SA 4.0), listed per topic in `content/wikipedia-sources.json`.
  `node scripts/import-wikipedia.ts [topic ...]` writes one file per topic to `supabase/content/wikipedia/`; load
  them with `for f in supabase/content/wikipedia/*.sql; do npx supabase db query --linked -f "$f"; done`, then
  press "Embed new content" on the Reviewer page.
- Practice questions: `content/questions/*.json`. `node scripts/build-questions-sql.ts` writes
  `supabase/content/questions.sql`; load it the same way.
- More questions: `ANTHROPIC_API_KEY=... node scripts/draft-questions.ts <topic> [count]` drafts questions with
  Claude Opus from that topic's tutor sources into `content/questions/draft-<topic>.json`.

OpenStax textbooks are CC BY-NC-SA (non-commercial only), so they are not used in this paid product.
