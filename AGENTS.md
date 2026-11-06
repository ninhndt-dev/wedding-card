# Wedding Card

- Match the existing monorepo layout: `apps/api`, `apps/web`, `shared`, `infra`, `docs`.
- API: Java 25, Spring Boot, MySQL, Flyway. Feature packages contain controller, service, repository and model where applicable.
- Web: React, TypeScript, Vite. Feature UI lives under `apps/web/src/features`; shared models under `src/lib`.
- Keep the public invitation URLs and API contracts compatible with the bundled wedding runtime.
- Never commit `.env.local`, guest data, database exports, uploads, credentials or `.local` artifacts.
- `npm test` uses `wedding_card_test` on ports 8087/3101. Never run destructive tests against `wedding_card`.
- Run `npm run typecheck`, `npm run build` and `npm test` for backend/frontend migrations.
- MySQL migrations belong in `apps/api/src/main/resources/db/migration`. Add a new migration after a schema has been applied.
