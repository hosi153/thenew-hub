# 에이전트 작업 로그

여러 세션/에이전트가 같은 저장소를 함께 작업하므로, 변경 이력을 추적하기 위한 로그입니다. 각 항목은 작업 주체, 시각, 변경 내용, 관련 커밋을 기록합니다.

## 2026-08-31 — Claude (Sonnet 5, claude.ai 모바일 세션)

### 세션 전체 요약 (본 로그 도입 이전 작업, 소급 기록)
- GitHub Pages 최초 배포 (`hosi153/thenew-hub`), Firebase Firestore 연동
- 모달 중앙 정렬, z-index 정리
- 홀 일정/짝꿍코드 CRUD (등록/수정/삭제), 비밀번호 기반 권한 확인, 관리자 마스터 비밀번호 도입
- 예식 준비 체크리스트 기능 신규 추가 (테이블 입력, 공개/비공개, 복사 기능)
- 홀별 색상 태그 통일, 헤더 축소, 지난 식 숨김 토글
- 캘린더 모드 신규 추가 (월별 보기)
- 저장 실패 시 무조건 성공 토스트가 뜨던 버그 수정 → 실제 성공/실패 판별 및 에러 메시지 노출
- 저장/삭제를 전체 컬렉션 재작성 방식에서 단일 문서 쓰기 방식으로 전환 (읽기/쓰기 비용 절감)
- Firestore SDK 전송 실패 시 REST API로 자동 폴백하는 이중 안전장치 추가
- 목록이 표시 안 되던 iOS Safari 렌더링 버그 수정 (탭 전환 시 강제 재렌더링)
- 홀일정/짝꿍코드 목록을 무한스크롤 페이지네이션으로 전환, 캘린더는 월 단위 쿼리로 전환
- 날짜/시간 입력 가로 스크롤·캘린더 레이아웃 붕괴 대응 (이후 다른 에이전트가 더 견고한 방식으로 재작업, 아래 참고)
- Firestore 보안 규칙에 `prepChecklist`, `meta` 컬렉션 허용 규칙 누락 발견 → 사용자가 직접 콘솔에서 추가
- Firestore 무료 할당량(429) 초과 이슈 확인, 원인 설명

### 이번 세션 확인한 외부 변경사항 (다른 에이전트, Claude Code 추정)
커밋 `124d61e`~`44dc7f8` (작성자: 최호균/클라우드플랫폼개발팀):
- 모바일 캘린더/일정등록 폼 가로 넘침 수정 — CSS Grid `minmax(0,1fr)` 방식으로 재작업 (본 에이전트의 datetime-local 방식보다 더 견고함, 그대로 채택)
- 비밀번호를 PBKDF2-SHA256(개별 salt, 210,000회 반복)으로 강화, 기존 SHA-256 항목과의 호환성 유지
- 접근성 개선 (모달 aria-hidden, 포커스 트랩)
- `tests/static-review.test.mjs` 정적 회귀 테스트 9종 추가 (전체 통과 확인)
- 일정 캘린더 보기를 기본값으로 변경
- `docs/PERFORMANCE_REFACTORING_PLAN.md` 성능 개선 리팩터링 계획 문서 작성 (0~6단계 로드맵)

### 이번 로그부터의 계획
- 리팩터링 계획의 **1단계(저장 체감 속도 개선)** 착수
  - SDK 최초 시도 타임아웃 7초 → 약 2초로 단축
  - 세션 내 SDK 실패 이력 기억 → 이후 쓰기는 REST 우선 시도
  - 저장 단계별 상태 텍스트 구분(비밀번호 처리 중 / 저장 중 / 연결 재시도 중)
  - REST 요청에 AbortController 적용
- 브라우저 실행 환경이 없는 세션이라, 0단계의 실측 성능 지표·자동 가로넘침 스크린샷 검사는 이번 세션에서 수행하지 못함(정적 코드 검사만 가능)

### 1단계 구현 완료 (같은 날짜, 이 로그 작성 직후)

**변경 파일**: `index.html`, `tests/static-review.test.mjs`

**구현 내용**:
- `SDK_ATTEMPT_MS = 2000`, `REST_ATTEMPT_MS = 8000`로 타임아웃 재조정 (기존 SDK 7초 + REST 10초 → SDK 2초 + REST 8초)
- `sdkTransportBlocked` 세션 플래그 도입: SDK 채널이 한 번이라도 실패/타임아웃하면 그 세션 동안은 이후 모든 읽기/쓰기/삭제/병합 요청이 SDK 시도를 건너뛰고 곧바로 REST로 감 (매번 SDK 타임아웃을 다시 기다리지 않음)
- `writeWithFallback` / `deleteWithFallback` / `mergeWithFallback` / `readWithFallback` 전부 이 로직으로 통일
- REST 호출(`firestoreRestSet`/`firestoreRestDelete`/`firestoreRestMerge`/`firestoreRestList`)에 `withAbortTimeout()`(AbortController 기반) 적용 — 기존 `Promise.race` 방식은 타임아웃 후에도 실제 fetch가 백그라운드에서 계속 실행됐는데, 이제 진짜로 요청을 취소함
- `classifyRestError()` 추가: HTTP 상태코드를 Firestore 스타일 에러 코드로 매핑(403→permission-denied, 404→not-found, 429→resource-exhausted, 5xx→unavailable) — 이제 실패 원인을 코드 레벨에서 구분 가능
- 저장/삭제 함수에 `onStatus` 콜백 파라미터 추가, 호출부(홀 일정/짝꿍코드/체크리스트의 등록·수정·삭제)에서 버튼 텍스트 또는 토스트로 `비밀번호 처리 중` → `저장 중` → `연결 재시도 중` 단계를 사용자에게 노출
- 각 폼 제출부의 개별 타임아웃도 20초 → 12초로 하향 (내부 예산이 최대 SDK 2초 + REST 8초 = 10초로 줄었으므로)

**테스트**: `tests/static-review.test.mjs`에 1단계 검증용 회귀 테스트 5개 추가 (SDK/REST 타임아웃 상수, 세션 내 전송모드 기억, AbortController 사용, 에러 분류, 단계별 상태 텍스트). 총 13개 테스트 전부 통과.

**검증 한계**: 실제 기기·네트워크에서의 체감 속도 개선(목표: SDK 채널 차단 시에도 저장 4초 이내)은 브라우저 환경에서 직접 확인 필요 — 이번 세션에서는 정적 코드 검사와 문법 검사까지만 수행.

**커밋**: (아래 실제 커밋 해시로 갱신)

