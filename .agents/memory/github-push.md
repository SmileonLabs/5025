---
name: GitHub push workflow (SmileonLabs/5025)
description: How to push local commits to GitHub from the main agent — connector token, sandbox limits, divergence handling
---

# GitHub 푸시 워크플로

- 메인 에이전트 샌드박스에서 `git fetch`/`pull`은 차단됨("Destructive git operations"), **push는 허용**되지만 인증 수단이 없어 그냥 하면 행/403.
- 인증: GitHub 커넥터 연결 후 code_execution에서 `listConnections('github')` → `settings.access_token`. 토큰을 URL/argv에 넣지 말고 `GIT_ASKPASS` 스크립트(+`GH_TOKEN` env)로 전달, 출력은 redact.
- 커넥터 계정은 `ljhee3611-cmyk`(사용자 개인 계정), 저장소는 `SmileonLabs/5025`(별도 계정 소유, public). ljhee3611-cmyk는 **collaborator(write)** 로 초대돼 있음. 초대 수락은 `PATCH /user/repository_invitations/{id}`로 API 대행 가능.
- **Why:** 원격 main에 로컬에 없는 외부 커밋(2026-06-12 "Cloudflare Worker API"·"Supabase Hyperdrive" — 다른 도구에서 푸시된 것)이 있어 non-fast-forward. force push 금지.
- **How to apply:** 갈라졌으면 ① `git push origin main:refs/heads/replit-sync`(임시 브랜치) ② `POST /repos/.../merges` (base=main, head=replit-sync)로 서버측 병합 ③ compare API로 로컬 커밋 포함 검증 ④ 임시 브랜치 삭제. fetch 불가라 로컬은 원격보다 뒤처진 상태로 남음 — 로컬 동기화는 사용자가 Git 패널에서 pull해야 함(그때 Cloudflare/Supabase 파일이 로컬로 들어옴).
