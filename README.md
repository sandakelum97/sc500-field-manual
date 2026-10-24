# SC-500 Field Manual

Interactive study kit for **Microsoft Exam SC-500: Implementing End-to-End Security Controls for Cloud and AI Workloads** (Microsoft Certified: Cloud and AI Security Engineer Associate).

Built only from Microsoft Learn. Every key fact, lab, flashcard and practice answer links to the learn.microsoft.com page it comes from.

## What's inside

| Area | What it does |
| --- | --- |
| Overview | Progress per domain (with official weights), weakest objectives, links to the study guide, sandbox and scoring docs |
| Learn | All objectives from the official study guide: summary, key facts with sources, portal path, a hands-on lab, Learn modules, confidence rating |
| Practice | Instant-feedback items in the real exam formats: single answer, multiple answer, yes/no grid, hotspot drop-downs, ordering. Filter by domain, objective, new, missed or flagged |
| Mock exam | Timed, weighted by domain, question navigator, mark-for-review, per-domain results and full review |
| Flashcards | Spaced review (Leitner boxes: 1, 3, 7, 14 days) |
| Review | Everything you got wrong last time, plus flagged items |
| Sync | Optional Supabase sync across devices, plus JSON backup/restore |

Practice items are original. They are **not** real exam questions. Microsoft's [exam security policy](https://learn.microsoft.com/en-us/credentials/support/exam-and-assessment-lab-security-policies) treats using brain-dump material as misconduct that can lead to a ban and revoked certifications, so none is used here.

## Run it locally

```bash
node build.mjs          # merges data/content/*.json into data/bank.json and writes index.html
npx serve .             # or: python3 -m http.server 8080
```

Opening `index.html` straight from disk won't work because the app fetches its JSON data.

## Publish on GitHub Pages

1. Create a new repository (for example `sc500-field-manual`) and push this folder to `main`.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` validates the content, builds, and deploys on every push to `main`.
4. Your site appears at `https://<your-user>.github.io/sc500-field-manual/`.

Keep the repo private if you prefer; GitHub Pages from a private repo needs a paid plan.

## Optional: sync progress with Supabase

Progress always saves in the browser (`localStorage`). To sync between devices:

1. Create a free project at supabase.com.
2. **SQL Editor → New query**, paste `supabase/schema.sql`, **Run**. This creates `sc500_progress` with row-level security so each signed-in user can only read and write their own row.
3. **Authentication → URL Configuration**: set **Site URL** to your GitHub Pages URL and add it under **Redirect URLs**.
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key.
5. Either paste them on the site's **Sync** tab, or put them in `js/config.js` and push, so every device picks them up.
6. On the Sync tab, enter your email and open the magic link on that device.

Only ever use the anon key in the browser. The service_role key bypasses RLS and must never be committed.

## Updating content

Content lives in `data/content/<section>.json`, one file per study-guide section. The format is documented in `docs/CONTENT_SCHEMA.md`. Check your changes with:

```bash
node docs/validate.mjs
```

The validator checks structure, answer indexes, duplicate IDs, and that every source is a Microsoft Learn URL.

Microsoft updates exam objectives. Compare `data/objectives.json` with the [official study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/sc-500) before your exam; the retrieval date is stored in the file.

## Files

```
index.html                 generated page for GitHub Pages
build.mjs                  builds data/bank.json + index.html
src/app-body.html          page template
css/app.css                styles (light and dark)
js/app.js                  the app
js/store.js                progress storage + Supabase sync
js/config.js               optional baked-in Supabase settings
data/objectives.json       official skills outline
data/content/*.json        notes, labs, flashcards, questions (source of truth)
data/bank.json             generated bundle the app loads
supabase/schema.sql        table + RLS policies
docs/CONTENT_SCHEMA.md     content format
docs/validate.mjs          content checker
```
