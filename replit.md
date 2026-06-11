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

- DB 스키마(소스오브트루스): `lib/db/src/schema/` — 기프티콘 카탈로그는 `gifticonCatalogItems.ts`(`isVariablePrice` 금액권 판별자), 주문은 `gifticonOrders.ts`, 미션은 `missions.ts`(`type` bible|activity, `scheduleType` daily|once, `scheduledDate`, `timeLimit`, `requiresPhoto`, `assignToAll` 전체대상 판별자)·미션 배정은 `missionAssignments.ts`(`missionId`/`childId`, onDelete cascade, unique(missionId,childId); 행 존재 ⟺ assignToAll=false)·미션 로그는 `missionLogs.ts`(`photoUrl` 인증샷, `quiz` jsonb 표시용 퀴즈 스냅샷). barrel은 `schema/index.ts`.
- 기프티콘 API: `artifacts/api-server/src/routes/gifticons.ts` — 카탈로그 CRUD(부모, `isVariablePrice`), 세션 스코프 조회(아이→부모 카탈로그), 주문 생성(자유금액이면 `amount` 필수)/취소, 부모 발급·거절 PATCH, 운영자(admin) 라우트.
- 미션 API: `artifacts/api-server/src/routes/missions.ts` — 생성/수정(부모, once면 `scheduledDate` 필수 refine; 대상은 `assignToAll`+`childIds` refine, `resolveOwnedChildIds`로 소유검증 후 트랜잭션으로 missions+missionAssignments 동시 처리), 아이 GET은 `or(assignToAll, exists assignment)`로 필터·부모 GET은 `assignedChildIds` 동봉, 제출(아이; child.parentId 체크 직후·type분기 전 대상 게이트로 비대상 403, bible 즉시적립, activity는 requested→부모 승인). **닫힌 용돈 구조**: 보상은 무발행이 아니라 부모 잔액(`parents.balance`)에서 차감되어 아이로 이동 — `lib/missionReward.ts`의 `grantBibleReward`/`approveActivityLog`가 `db.transaction`+조건부 UPDATE로 처리(부모부족=402, 같은장중복=409, 이중승인/이중reject 차단). bible 제출의 `quiz`는 표시용 best-effort 스냅샷이라 보상 게이트(책/장/묵상)와 **분리 파싱**(검증 실패해도 완료를 막지 않고 quiz만 드롭). 수행 내역 조회는 `GET /mission-logs`(세션 스코프: 아이→본인·부모→자녀 전체, 클라가 childId/parentId를 안 보냄=IDOR 방지; mission/child 조인, `rewardAmount`=transactionId 있으면 거래액·없으면 미션 예정 보상). 인증샷 스토리지: `routes/storage.ts`(presigned PUT 발급 + serve 인가), 헬퍼 `lib/objectStorage.ts`.
- 잔액 차감·환불·발급 원자성: `artifacts/api-server/src/lib/gifticonCredit.ts` (조건부 UPDATE, requireParentId IDOR 가드).
- 포인트 환산(서버 권위): `artifacts/api-server/src/topupCredit.ts` — `POINTS_PER_KRW`(=10). 충전 라우트는 `routes/topups.ts`.
- 포인트 표시(프론트): `artifacts/bible-pay/src/lib/utils.ts` — `POINTS_PER_KRW`, `formatPoints()`.
- 부모 기프티콘 관리 UI: `artifacts/bible-pay/src/pages/parent/GifticonsPage.tsx` (구매요청 발급/거절 + 상품관리 CRUD 탭; 이모지 팔레트 선택 + 금액권 토글). 부모 미션 관리: `pages/parent/MissionsPage.tsx`(미션 생성 모달: bible/activity, daily/once+날짜, 시간제한, 인증샷 토글, **대상 아이 선택**(전체 토글 + children 다중 칩, 아이 0명이면 전체 고정); 목록에 대상 배지(`MissionTargetBadge`); 대기 제출 사진 표시; 탭 미션/확인요청/내역, "내역" 탭은 `MissionLogList`(showChild)+`MissionLogDetailModal`).
- 아이 상점 UI: `artifacts/bible-pay/src/pages/child/ShopPage.tsx`(금액권은 자유금액 입력 시트; 발급된 기프티콘 DetailSheet에서 "다 썼어요(사용 완료)" 버튼→`markGifticonUsed`, used면 사용일 배지). 용돈 쓰기: `components/SpendModal.tsx`(카테고리 그리드 제거, 직접 입력 용도만; category는 "기타" 고정). 아이 미션: `components/MissionCard.tsx`(activity 인증샷 업로드+제출), 미션 화면 탭 할미션/수행내역(`pages/child/MissionsPage.tsx`). 미션 수행 상세 공통 컴포넌트: `components/MissionResultContent.tsx`(성경passage/퀴즈+정답강조/묵상/인증샷; `TransactionDetailModal`·`MissionLogDetailModal` 공용), 목록 `components/MissionLogList.tsx`(Asia/Seoul 날짜그룹·상태배지). 전역 상태/헬퍼: `src/context/AppContext.tsx`(`missionLogs`/`refreshMissionLogs`).

## Architecture decisions

- 기프티콘 주문 상태머신: `requested → fulfilled`(운영자/부모 발급), `requested → rejected`(운영자/부모, 환불), `requested → canceled`(아이, 환불), `fulfilled → used`(아이, 사용 완료 표시). 부모 승인 단계 없음.
- `fulfilled` 이후 아이가 `used`(사용 완료)로 전환 가능 — `markGifticonOrderUsed`(조건부 UPDATE `WHERE id AND child_id AND status='fulfilled'` SET `status='used', used_at=now`, POST `/gifticons/orders/:id/use`). `used`는 종결 상태로 되돌리기·환불 경로 없음(불변식: 발급·취소·거절은 모두 `status='requested'` 조건이라 used에서 재진입 불가). 발급 후 핀/바코드 열람은 used 이후에도 가능(상세 엔드포인트 status 필터 없음, UI는 "사용 완료한 기프티콘 보기"). 잘못 발급 시 별도 보상은 수동 처리.
- 기프티콘 가격은 서버 권위. 고정상품은 클라 `amount` 무시(카탈로그 price 스냅샷). 금액권(`isVariablePrice`)은 클라가 `amount`(포인트) 전송, 서버 `z.int().min(1).max(10_000_000)` 검증 후 주문 행에 스냅샷. catalog price는 NOT NULL 유지, 금액권이면 0 저장(판별자는 `isVariablePrice`).
- 잔액 차감/환불은 조건부 `UPDATE ... WHERE balance >= price`(차감)와 `WHERE status = 'requested'`(환불/발급)로 원자적 처리 — TOCTOU·이중환불·잔액초과 방지.
- 발급 비밀값(핀/바코드/이미지URL)은 목록 응답에서 제외, 상세 엔드포인트(소유 아이/부모/운영자 인가)에서만 노출.
- 미션 대상 선택: `assignToAll`(기본 true, 하위호환)이 전체대상 판별자. false면 `mission_assignments`에 배정 행 존재(불변식: 행 존재 ⟺ assignToAll=false). 아이 노출·제출 권위는 서버(아이 화면은 무변경). PATCH는 `assignToAll`/`childIds`가 body에 있을 때만 배정을 재설정(delete+insert), true 전환 시 배정 비움. 소유검증은 `inArray AND parentId=세션`(cross-parent IDOR 방지). DB는 drizzle push 대신 동일 결과 DDL 직접 적용(네이밍 규칙 일치 → 이후 push 무프롬프트).
- 미션 타입은 `bible`(즉시 적립)과 `activity`(부모 확인형)뿐 — 구 auto/confirm 삭제. activity 상태머신: 아이 제출→`requested`→부모 `approved`(적립)/`rejected`(미적립, 재도전 가능). 서버 enforce: `requiresPhoto`면 photoUrl 필수, `timeLimit`(KST HH:MM) 마감, once면 `scheduledDate`==오늘(KST)에만 제출, 중복(daily=오늘·once=기간무관, requested/approved 존재 시) 차단. KST는 `Intl.DateTimeFormat(Asia/Seoul)`·SQL `AT TIME ZONE 'Asia/Seoul'`.
- **닫힌 용돈 구조(미션 보상)**: 아이 보상은 신규 발행이 아니라 부모 잔액(`parents.balance`)에서 차감되어 아이(`children.balance`)로 이동(부모 충전 포인트=실돈 결제가 재원). `lib/missionReward.ts`가 `db.transaction`+조건부 UPDATE(`WHERE balance >= reward RETURNING`)로 부모차감→아이적립→거래기록(`type='mission'`)→미션로그를 원자 처리, 부족 시 `RewardError` sentinel throw로 전체 롤백. 부모 부족=**402**(보상 차단+충전 안내, 부모 푸시), 같은장 중복=**409**. 동시성: bible 같은 장은 `mission_logs` 부분 유니크 인덱스 `uq_mission_logs_bible_chapter`(WHERE status='completed')가 백스톱(라우트 사전체크는 빠른 피드백). activity는 approve·reject 모두 조건부 UPDATE `WHERE status='requested'`로 동시 approve/reject·이중승인 경합을 차단(승리자만 진행, 패자 409). 기존 아이/부모 잔액 소급 차감은 하지 않음. ⚠️ pg unique_violation(23505)은 `DrizzleQueryError.cause`에 있어 cause 체인 검사 필요(`isUniqueViolation`).
- 인증샷 인가는 ACL 프레임워크 대신 소유 기반: serve는 `mission_logs.photoUrl`로 참조된 객체만, 소유 아이/해당 부모/admin에게만 스트리밍(미제출 객체는 404). objectPath는 랜덤 UUID.
- 미션 수행 내역은 거래내역(기입장)과 **분리된 별도 화면**. 단일 `GET /mission-logs`가 세션 스코프로 상세 필드를 인라인 반환(별도 `:id` 라우트 없음). `quiz`(jsonb)는 표시용 스냅샷(questions만, 선택답 X)이라 보상 게이트와 분리 파싱; quiz null이면 "퀴즈 통과" 배지로 폴백. 4개 status(completed/approved/requested/rejected) 모두 표시하되 rejected는 금액 숨김. 기입장은 무변경(미션 수입 포함 그대로 노출).

## Product

한국 아이용 성경-용돈 PWA. 모든 금액 단위는 **포인트(P)**.

- **부모**: 회원가입/로그인, 아이 계정 생성(PIN 4자리), 용돈 충전(Stripe 결제 → 결제 원금 ×10 포인트 적립), 미션 관리(성경읽기 + 활동미션: 매일/지정일·시간제한·인증샷; 대상 아이를 전체 또는 특정 아이 여러 명으로 지정), 활동미션 제출 승인/거절, 기프티콘 상품 카탈로그 등록/삭제(부모별; 이모지 팔레트 선택, 금액권 옵션), 아이 구매요청 발급/거절(거절 시 자동 환불).
- **아이**: PIN 로그인, 미션 수행(성경 읽기·퀴즈는 즉시 적립, 활동미션은 인증샷 제출→부모 확인)으로 포인트 획득(보상은 부모 잔액에서 차감되어 이동 — 부모 포인트 부족 시 보상 보류+충전 안내), 상점에서 **자기 부모가 등록한** 기프티콘만 구매(고정가 또는 금액권 자유금액 입력, 구매 즉시 잔액 차감), 발급 전 구매 취소/환불, 발급받은 기프티콘 사용 후 "사용 완료" 표시(사용일 기록).
- **운영자(admin)**: 부모 발급/거절과 별도로 기프티콘 발급·거절 경로 유지.

## User preferences

- Always communicate with the user in Korean (한국어). This applies to all chat replies AND internal reasoning/thinking.

## Gotchas

- 인증샷 presigned PUT 서명에는 contentType/size 조건이 안 들어간다(GCS signObjectURL 한계). 따라서 request-url의 image/*·10MB zod 검증은 "선언"일 뿐 업로드에 강제되지 않음 → serve 라우트(`routes/storage.ts`)에서 응답 Content-Type이 `image/*`인지 검사(아니면 415)하고 `X-Content-Type-Options: nosniff`를 붙여 stored-XSS를 막는다. 이 방어를 제거하면 아이가 text/html을 올려 부모에게 XSS 가능.
- 미션 KST 비교는 항상 `Asia/Seoul` 명시(서버 TZ는 UTC). 날짜는 `Intl.DateTimeFormat("en-CA", …)`로 `YYYY-MM-DD`, 시각은 `en-GB`+`h23`로 `HH:MM`. `scheduledDate`는 date 컬럼(string mode)이라 문자열 직접 비교.
- api-server는 코드 변경 시 자동 리로드 없음(build→start) — 라우트/서버 변경 후 반드시 워크플로 재시작. 프론트(bible-pay)는 Vite HMR.
- 미션을 삭제하면 `mission_logs.missionId` cascade로 그 미션의 수행 내역도 함께 사라진다(수행 내역 화면에서 과거 기록 소실). 미션 삭제 UX는 이 점을 사용자에게 고지해야 한다.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
