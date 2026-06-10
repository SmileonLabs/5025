# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- 기프티콘 주문 상태머신: `requested → fulfilled`(운영자 수동 발급), `requested → rejected`(운영자, 환불), `requested → canceled`(아이, 환불). 부모 승인 단계 없음.
- `fulfilled`는 종결 상태로, 운영자가 핀/바코드를 발급한 뒤에는 환불·되돌리기 경로가 없음(수동 발급 MVP의 의도된 한계). 잘못 발급 시 별도 보상은 수동 처리.
- 기프티콘 가격은 서버 권위. 클라이언트는 `catalogItemId`만 전송하고, 가격은 `gifticonCatalog.ts` 상수에서 읽어 주문 행에 스냅샷(가격 변조 차단).
- 잔액 차감/환불은 조건부 `UPDATE ... WHERE balance >= price`(차감)와 `WHERE status = 'requested'`(환불/발급)로 원자적 처리 — TOCTOU·이중환불 방지.
- 발급 비밀값(핀/바코드/이미지URL)은 목록 응답에서 제외, 상세 엔드포인트(소유 아이/부모/운영자 인가)에서만 노출.

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

- Always communicate with the user in Korean (한국어). This applies to all chat replies AND internal reasoning/thinking.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
