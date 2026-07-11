# Database migrations

Production schema changes must be generated and reviewed before deployment:

```bash
pnpm --filter @workspace/db run generate
pnpm --filter @workspace/db run migrate
```

The existing Replit production database predates this migration directory. Before the first generated migration is applied, create a reviewed baseline from the production schema and record it in Drizzle's migration journal. Do not run `push-force` against production.
