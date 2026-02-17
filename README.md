# LevyLite

Cloud-based strata management platform for small operators in Australia.

## Repository Structure

```
levylite/
├── landing/          # Marketing landing page (Netlify)
│   ├── src/
│   ├── public/
│   └── package.json
├── app/              # Strata management application (Vercel)
│   ├── src/
│   └── package.json
└── docs/             # Shared documentation
    ├── features/     # Feature specifications
    ├── diagrams/     # Mermaid architecture diagrams
    ├── PRD.md        # Product Requirements Document
    └── ...
```

## Landing Page (`landing/`)

Static marketing site deployed on **Netlify**.

```bash
cd landing
bun install
bun dev
```

- **URL:** levylite.com.au
- **Stack:** Next.js 16 (static export), Tailwind CSS, shadcn/ui
- **Deploy:** Netlify (base directory: `landing/`)

## Application (`app/`)

Full strata management platform deployed on **Vercel**.

```bash
cd app
bun install
bun dev
```

- **URL:** app.levylite.com.au
- **Stack:** Next.js 15 (App Router), Supabase, Stripe, Tailwind CSS, shadcn/ui
- **Deploy:** Vercel (root directory: `app/`)

## Documentation (`docs/`)

Comprehensive planning documentation including:

- **PRD** — Product requirements and go-to-market strategy
- **Feature specs** — 11 detailed feature specifications
- **Mermaid diagrams** — 28 architecture and workflow diagrams
- **Data model** — 44-table PostgreSQL schema with RLS policies

See [`docs/diagrams/README.md`](docs/diagrams/README.md) for diagram index.
