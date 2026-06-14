---
name: bible-pay 미션 제출 동시성
description: activity 미션 제출의 사전체크 게이트(중복/횟수)는 advisory xact lock으로 직렬화해야 초과 지급을 막는다
---

# activity 미션 제출 동시성

규칙: activity 미션 제출(`/missions/:id/submit`)에서 "사전 SELECT로 검사 후 insert"하는 게이트(중복 방지, `maxCompletions` 횟수 제한)는 반드시 `(missionId, childId)` 단위 `pg_advisory_xact_lock(int,int)` + 단일 트랜잭션으로 직렬화한다. 검사·insert를 같은 `tx`에서 수행.

**Why:** 보상은 닫힌 용돈 구조라 부모 잔액에서 차감된다. 사전체크가 비원자적이면 더블탭/병렬 제출이 둘 다 검사를 통과해 `requested` 로그가 초과 생성되고, 부모가 양쪽을 승인하면 포인트가 초과 지급되는 금전 무결성 사고가 난다.

**How to apply:** 미션 제출이나 유사한 "검사 후 mutation" 경로를 새로 만들거나 수정할 때, 단순 조건부 UPDATE로 원자화가 안 되는 다중 단계 게이트면 advisory xact lock(또는 DB unique/partial index 백스톱)을 건다. bible 즉시적립 경로는 이미 partial unique index(`uq_mission_logs_bible_chapter`)가 백스톱. lock 인자는 `${id}::int`로 캐스팅해 2-arg(int4,int4) 오버로드를 명시. 차단은 트랜잭션 안에서 `{ok:false,error}` 반환 후 트랜잭션 밖에서 res 응답(롤백 안전).
