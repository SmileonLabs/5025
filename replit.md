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

- DB 스키마(소스오브트루스): `lib/db/src/schema/` — 기프티콘 카탈로그는 `gifticonCatalogItems.ts`, 주문은 `gifticonOrders.ts`. barrel은 `schema/index.ts`. 모든 테이블이 여기서 export.
- 기프티콘 API: `artifacts/api-server/src/routes/gifticons.ts` — 카탈로그 CRUD(부모), 세션 스코프 조회(아이→부모 카탈로그), 주문 생성/취소, 부모 발급·거절 PATCH, 운영자(admin) 라우트.
- 잔액 차감·환불·발급 원자성: `artifacts/api-server/src/lib/gifticonCredit.ts` (조건부 UPDATE, requireParentId IDOR 가드).
- 포인트 환산(서버 권위): `artifacts/api-server/src/topupCredit.ts` — `POINTS_PER_KRW`(=10). 충전 라우트는 `routes/topups.ts`.
- 포인트 표시(프론트): `artifacts/bible-pay/src/lib/utils.ts` — `POINTS_PER_KRW`, `formatPoints()`.
- 부모 기프티콘 관리 UI: `artifacts/bible-pay/src/pages/parent/GifticonsPage.tsx` (구매요청 발급/거절 + 상품관리 CRUD 탭).
- 아이 상점 UI: `artifacts/bible-pay/src/pages/child/ShopPage.tsx`. 전역 상태/헬퍼: `src/context/AppContext.tsx`.

## Architecture decisions

- 기프티콘 주문 상태머신: `requested → fulfilled`(운영자 수동 발급), `requested → rejected`(운영자, 환불), `requested → canceled`(아이, 환불). 부모 승인 단계 없음.
- `fulfilled`는 종결 상태로, 운영자가 핀/바코드를 발급한 뒤에는 환불·되돌리기 경로가 없음(수동 발급 MVP의 의도된 한계). 잘못 발급 시 별도 보상은 수동 처리.
- 기프티콘 가격은 서버 권위. 클라이언트는 `catalogItemId`만 전송하고, 가격은 `gifticonCatalog.ts` 상수에서 읽어 주문 행에 스냅샷(가격 변조 차단).
- 잔액 차감/환불은 조건부 `UPDATE ... WHERE balance >= price`(차감)와 `WHERE status = 'requested'`(환불/발급)로 원자적 처리 — TOCTOU·이중환불 방지.
- 발급 비밀값(핀/바코드/이미지URL)은 목록 응답에서 제외, 상세 엔드포인트(소유 아이/부모/운영자 인가)에서만 노출.

## Product

한국 아이용 성경-용돈 PWA. 모든 금액 단위는 **포인트(P)**.

- **부모**: 회원가입/로그인, 아이 계정 생성(PIN 4자리), 용돈 충전(Stripe 결제 → 결제 원금 ×10 포인트 적립), 미션 관리, 기프티콘 상품 카탈로그 등록/삭제(부모별), 아이 구매요청 발급/거절(거절 시 자동 환불).
- **아이**: PIN 로그인, 미션 수행·성경 읽기·퀴즈로 포인트 획득, 상점에서 **자기 부모가 등록한** 기프티콘만 구매(구매 즉시 잔액 차감), 발급 전 구매 취소/환불.
- **운영자(admin)**: 부모 발급/거절과 별도로 기프티콘 발급·거절 경로 유지.

## User preferences

- Always communicate with the user in Korean (한국어). This applies to all chat replies AND internal reasoning/thinking.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
