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

---

## 2026-08-31 — Codex 데스크톱 세션

> 아래에 소급 기록된 기존 2단계·3단계 착수 작업 이후에 진행한 후속 스텝입니다.

### 사용자 지시
- 리팩터링 계획을 한 번에 끝내지 않고 스텝별로 진행
- 모든 작업을 이 로그에 남겨 다른 에이전트가 이어서 작업할 수 있게 유지

### 이번 스텝 범위
- `docs/PERFORMANCE_REFACTORING_PLAN.md` 3단계 중 **일정(schedule) 기능의 API·상태·화면 모듈 분리**만 수행
- 짝꿍코드(codes), 체크리스트(checklist), 인라인 이벤트 제거는 다음 스텝으로 보류
- 실제 운영 중인 루트 `index.html`은 변경하지 않음

### 사전 확인 및 환경 준비
- `git status --short --branch`: 시작 시 `main...origin/main`, 변경 없음
- 기존 `docs/AGENT_ACTIVITY_LOG.md`, `docs/PERFORMANCE_REFACTORING_PLAN.md`, `web/src/main.js`, 테스트 파일을 읽어 이전 작업과 의존성 확인
- 최초 환경에 `node`/`npm`이 없어 Homebrew로 Node.js `v26.8.1`, npm `11.19.0` 설치
- `npm ci`로 잠금 파일 기준 의존성 설치. 오프라인 감사 결과가 0건으로 달라 별도 온라인 `npm audit --audit-level=moderate`로 재확인한 결과 취약점 2건(중간 1, 높음 1)이 맞음. `esbuild <=0.24.2` 개발 서버 이슈가 포함되며 자동 해결은 Vite 8.2.2로의 브레이킹 변경을 요구하므로 이번 구조 분리 스텝에서는 `npm audit fix --force`를 실행하지 않음
- npm 11은 `esbuild@0.21.5`, `fsevents@2.3.3` 설치 스크립트 승인 관련 경고를 출력했지만, Vite 빌드는 정상 실행됨

### 구현 내용

**신규 파일**:
- `web/src/features/schedule/api.js` (70줄)
  - `hallSchedule` 컬렉션 존재 확인, seed 저장, 페이지/미정 일정/전체/월 범위 조회 분리
  - 단일 일정 ID 생성, 저장, 삭제를 공통 Firestore 전송 계층에 연결
- `web/src/features/schedule/state.js` (41줄)
  - 일정 목록, 필터, 지난 식 표시, 목록/달력 보기, 편집/상세 ID, 페이지네이션, 월 캐시와 달력 선택 상태를 `scheduleState`로 통합
  - 목록 교체·중복 없는 추가·캘린더 캐시 초기화 함수 제공
- `web/src/features/schedule/view.js` (434줄)
  - 일정 초기화와 seed 폴백, 목록/필터/무한 스크롤, 달력, 이번 주 위젯, 상세/등록/수정/삭제 UI를 이동
  - 기존 Firestore 필드, PBKDF2 처리, 12초 작업 제한, 낙관적 갱신/실패 원복, 상태 토스트 동작 유지

**변경 파일**:
- `web/src/main.js`: 1,523줄 → 1,096줄
  - 일정 기능을 새 모듈에서 import
  - `halls`, `hallPage`, `hallFilter`, `hallView`, `calMonthCache` 등 일정 전역 상태 제거
  - 초기화, 네비게이션, 관리자 패치가 `scheduleState`와 일정 모듈의 공개 함수만 사용하도록 변경
  - 브라우저 스모크 테스트에서 발견된 TDZ 오류를 고치기 위해 `init()` 호출을 파일 상단에서 모든 선언/핸들러 연결 이후인 파일 마지막으로 이동
- `tests/vite-build.test.mjs`
  - 일정 기능의 `api.js`/`state.js`/`view.js` 존재와 연결, `main.js`의 과거 일정 전역 상태 제거를 검사하는 회귀 테스트 1개 추가
- `docs/PERFORMANCE_REFACTORING_PLAN.md`
  - 3단계 진행 현황을 일정 모듈 분리 완료, codes/checklist 미완료로 갱신

### 검증 기록
- `git diff --check`: 통과
- `npm test`: 정적 회귀 테스트 15/15 통과
- `node --test tests/vite-build.test.mjs`: Vite/구조 테스트 5/5 통과
- `npm run build`: 성공, 12개 모듈 변환
  - `dist/index.html` 45.63kB
  - CSS 19.93kB, JS 49.34kB (해시 자산 생성 확인)
- 로컬 `vite preview`를 `127.0.0.1:4173`에서 실행하고 인앱 브라우저로 스모크 테스트
  1. 첫 실행에서 `ReferenceError: Cannot access ... before initialization` 발견
  2. `init()`을 파일 마지막으로 이동하고 재빌드/새로고침
  3. 홈 초기 화면 렌더링 확인
  4. 홀일정 탭 → 2026년 8월 달력과 선택 날짜 빈 상태 렌더링 확인
  5. 달력 → 목록 전환 확인
  6. `+` 버튼 → `일정 등록` 모달 열기 → 취소 확인
  7. 수정된 번들(`index-DyWImJxC.js`)의 콘솔 오류 0건 확인
- 운영 Firestore 데이터를 바꾸지 않기 위해 실제 등록·수정·삭제 제출은 수행하지 않음
- 로컬 미리보기 서버와 테스트용 브라우저 탭은 검증 후 종료

### 현재 작업 트리 및 인계 지점
- 변경 사항은 아직 커밋하지 않음
- 변경 파일: `docs/PERFORMANCE_REFACTORING_PLAN.md`, `docs/AGENT_ACTIVITY_LOG.md`, `tests/vite-build.test.mjs`, `web/src/main.js`
- 신규 디렉터리: `web/src/features/schedule/`
- 다음 권장 스텝: **짝꿍코드(codes) 기능을 `api.js`·`state.js`·`view.js`로 분리**
- 그 다음: 체크리스트 분리 → 인라인 이벤트 제거 → 기능별 동적 import 검토
- 다음 에이전트는 먼저 `git diff --check`, `npm test`, `node --test tests/vite-build.test.mjs`, `npm run build`로 기준 상태를 재확인할 것

**커밋**: 미생성 (사용자 지시 없이 커밋하지 않음)

### 커밋·푸시 전 배포 안전성 재점검
- 사용자 질문: 현재 상태를 커밋·푸시해도 기존 배포에 이상이 없는지 확인
- 현재 변경 대상은 `docs/`, `tests/`, `web/src/`뿐이며 운영 파일인 루트 `index.html`은 변경되지 않음
- `.github/workflows`와 별도 `CNAME`/`.nojekyll` 파일 없음
- 실제 Pages URL `https://hosi153.github.io/thenew-hub/` 응답: HTTP 200, `content-length: 159392`
- 배포 HTML SHA-256과 로컬 루트 `index.html` SHA-256이 모두 `e530b04cf4cf24fab91a58be88fd3ba84e30ae0adbb71c916db5b99945ab0556`으로 일치
- 재검증: 정적 테스트 15/15, Vite/구조 테스트 6/6, Vite 프로덕션 빌드, `git diff --check` 모두 통과
- 결론: 현재 Pages가 루트 `index.html`을 배포하는 구조에서는 커밋·푸시 후 운영 화면/동작이 바뀌지 않음. 새 `web/` 모듈 구조는 6단계 Pages 전환 전까지 운영에 사용되지 않음
- 제한: 로컬 GitHub CLI 토큰이 만료되어 Pages 설정 API 자체는 조회하지 못했으나, 실제 배포 응답과 로컬 파일의 바이트 단위 일치로 현재 배포 소스를 검증함


### 사용자 확인 (같은 날짜)
- "반응속도가 월등히 빨라졌어" — 1단계 체감 속도 개선 효과 실기기에서 확인됨
- "그또한 좋아졌어" — 단계별 상태 표시("비밀번호 처리 중"/"저장 중"/"연결 재시도 중")도 정상 노출 확인됨
- 1단계는 사용자 확인까지 완료된 것으로 간주. 다음 단계(2단계: Vite 빌드 도입 등) 착수는 사용자 지시 대기 중

### 2단계 구현 (같은 날짜) — Vite 빌드 기반 구축

**사용자 지시**: "순서대로 진행해줘" → 로드맵 2단계(빌드 기반과 정적 자산 분리) 착수.

**핵심 원칙**: 브라우저 없는 세션이라 육안 검증이 불가능하므로, **운영 중인 루트 `index.html`은 절대 건드리지 않고** `web/` 하위에이 완전히 병행하는 구조로 구축. 실패해도 실 서비스에 영향 없음.

**작업 내용**:
- 루트 `index.html`의 `<style>` 블록(23,504바이트)을 `web/src/style.css`로, 인라인 `<script>`(75,526바이트)를 `web/src/main.js`로 그대로 추출(내용 변경 없음)
- 인라인 `onclick`/`oninput`/`onchange` 핸들러가 참조하는 함수 32개를 스캔해서, `main.js` 끝에 `window.함수명 = 함수명;` 형태로 명시적 전역 노출 추가 (ES 모듈은 전역 스코프가 아니라서 이 처리 없이는 기존 마크업의 인라인 핸들러가 전부 깨짐)
- `web/index.html`을 Vite 진입점으로 신규 생성 (루트 index.html의 `<head>` 메타/폰트, `<body>` 전체를 그대로 옮기고 style/script만 참조 방식으로 교체)
- `package.json`, `vite.config.js` 추가 (`root:'web'`, `outDir:'../dist'`, `base:'./'`로 GitHub Pages 서브경로에도 안전하게 대응)
- `npm install` → `npm run build` 실행 성공 확인 (dist/index.html 45.63kB, CSS 19.93kB, JS 48.08kB, gzip 적용 시 각각 더 작음)
- 빌드 결과물을 로컬 정적 서버로 실제 서빙해서 CSS/JS 파일이 200 응답 + 정확한 바이트 수로 로드되는지 확인
- **32개 전역 노출 함수 전수 검증**: 압축(minify)된 결과물에서도 `window.함수명=` 패턴이 전부 존재하는지 스크립트로 검사 → 32/32 통과
- `tests/vite-build.test.mjs` 신규 작성 (4개 테스트): 빌드 성공 여부, 해시된 자산 파일 실제 존재 여부, 인라인 핸들러 함수 전역 노출 여부, HTML id 중복 여부. 향후 회귀 방지용.
- 기존 정적 테스트(운영 index.html 대상)와 합쳐 **총 19개 테스트 전부 통과**
- `esbuild`/`vite` dev 서버 관련 중간 수준 취약점 1건 발견 — 개발 서버 전용이라 프로덕션 빌드에는 영향 없음, 메이저 버전 업그레이드(브레이킹 체인지) 필요해서 이번 단계에서는 보류

**검증 한계**: 실제 브라우저에서 이 빌드된 페이지가 시각적으로 동일하게 보이고 모든 클릭/입력이 실제로 작동하는지는 확인하지 못함 (구조적/정적 검증까지만 수행). 완료 조건 중 "빌드 전후 화면과 데이터 동작이 동일하다"는 사용자의 실기기 확인이 필요함.

**배포 상태 변화 없음**: GitHub Pages는 여전히 루트 `index.html`을 그대로 서빙 중. 이번 작업으로 추가된 `dist/`, `node_modules/`는 `.gitignore`에 등록되어 저장소에 커밋되지 않음(빌드 결과물이므로).

**커밋**: (아래 실제 커밋 해시로 갱신)

### 3단계 착수 (같은 날짜) — 기능 모듈화 (부분 진행, 진행 중)

**사용자 지시**: "ㄱㄱㄱ" → 로드맵 3단계(기능 모듈화) 착수.

**전략**: 3단계는 계획 문서 자체가 "가장 위험한 단계"로 지목한 작업(전역 실행 순서 변경 위험)이라, **가장 독립적이고 위험도 낮은 공통 모듈부터** 먼저 떼어내고, 여러 기능이 전역 배열(halls/codes/checklists)을 공유하며 얽혀있는 화면별 CRUD/렌더링 로직은 이번 라운드에서 보류. web/ 병행 구축 원칙(운영 index.html 미변경)은 계속 유지.

**이번 라운드에서 분리 완료된 모듈** (원본 텍스트를 그대로 이동, 내용 변경 없음):

| 모듈 | 줄 수 | 내용 |
|---|---|---|
| web/src/config/firebase.js | 24 | firebaseConfig, firebase.initializeApp, db 초기화, 롱폴링 설정 |
| web/src/security/password.js | 43 | hashPwLegacy/derivePwHash/PW_ITERATIONS/createPasswordFields/matchesItemPassword/ADMIN_PW_HASH/authenticateItem |
| web/src/data/firestore-rest.js | 207 | SDK+REST 폴백 전송 계층 전체 (writeWithFallback/deleteWithFallback/mergeWithFallback/readWithFallback/withTimeout/firestoreRestList 등) |
| web/src/ui/toast.js | 10 | toast() — 기존에 window._toastTimer로 전역을 오염시키던 부분을 모듈 스코프 변수로 정리 |
| web/src/ui/modal.js | 58 | showOverlay/hideOverlay/askPassword/cancelPwPrompt/submitPwPrompt/verify() |

web/src/main.js는 1830줄 → 1523줄로 축소(약 17% 감소), 남은 부분은 홀 일정/짝꿍코드/체크리스트/캘린더/네비게이션 등 화면별 로직.

**검증 절차** (각 모듈 분리마다 반복):
1. 원본에서 정확한 라인 범위를 스크립트로 추출(수기 재입력 없음 → 오타/누락 방지)
2. 외부에서 참조하는 함수만 골라 export 표시, 나머지는 모듈 내부로 은닉
3. import 문으로 교체 후 npm run build 성공 확인
4. 빌드된 결과물을 로컬 서버로 실제 서빙해서 특정 로직(PBKDF2 등) 존재를 문자열 검색으로 확인
5. node --test tests/*.test.mjs 실행 — 매 단계 19개 테스트 전부 통과

**작업 중 발견하고 수정한 실수**: 모달 모듈 추출 과정에서 import { toast }와 pwInput keydown 리스너를 실수로 중복 삽입 → 직접 재확인하며 발견해서 제거.

**남은 작업 (다음 라운드)**:
- 홀 일정(schedule) api·state·view 분리는 위 Codex 후속 스텝에서 완료
- 짝꿍코드(codes) api·state·view 분리는 아래 Codex 후속 스텝에서 완료
- 체크리스트(checklist)를 api·state·view 모듈로 분리
- 인라인 onclick/oninput/onchange를 이벤트 위임 방식으로 교체 (현재는 여전히 32개 함수를 window에 노출하는 임시 방편 사용 중)
- 전역 상태(halls/codes/checklists/hallFilter/showPast 등)를 기능별 상태 객체로 제한

**당시 검증 한계**: 이 착수 라운드에서는 실제 브라우저 검증을 못했으나, 위 Codex 후속 스텝에서 일정 화면의 브라우저 스모크 테스트를 추가 수행함.

**커밋**: (아래 실제 커밋 해시로 갱신)

---

## 2026-08-31 — Codex 데스크톱 세션 (3단계 계속: 짝꿍코드)

### 사용자 지시
- 이전 작업을 기록하고 계획의 다음 스텝을 계속 진행
- 한 번에 전체 단계를 끝내지 않고 기능 단위로 진행

### 이번 스텝 범위
- 3단계 기능 모듈화 중 **짝꿍코드(codes) 기능의 API·상태·화면 분리**
- 체크리스트 모듈화와 인라인 이벤트 제거는 다음 스텝으로 보류
- 운영 루트 `index.html`과 Firestore 데이터 형식은 변경하지 않음

### 사전 확인
- 기존 미커밋 일정 모듈화 변경을 보존한 상태에서 작업 시작
- `git status`, `web/src/main.js`의 codes 관련 참조, 기존 활동 로그와 계획 문서 확인
- 일정 모듈과 같은 공개 경계 및 명명 방식을 사용하기로 결정

### 구현 내용

**신규 파일**:
- `web/src/features/codes/api.js` (51줄)
  - `matchingCodes` 컬렉션 존재 확인, seed 저장, 문서 ID 순 페이지 조회, 전체 조회 분리
  - 새 문서 ID 생성, 단일 저장·삭제를 공통 Firestore 전송 계층에 연결
- `web/src/features/codes/state.js` (19줄)
  - 항목, 카테고리 필터, 편집/상세 ID, 페이지네이션, 전체 로딩 상태를 `matchingCodeState`로 통합
  - 목록 교체와 ID 기준 중복 없는 추가 함수 제공
- `web/src/features/codes/view.js` (249줄)
  - 초기화와 seed 폴백, 카테고리 칩, 검색, 전체/페이지 조회, 목록 렌더링을 이동
  - 상세·등록·수정·삭제 모달과 낙관적 갱신/실패 원복, PBKDF2 및 상태 표시 유지

**변경 파일**:
- `web/src/main.js`: 1,096줄 → 883줄
  - codes 모듈과 `matchingCodeState` import
  - `codes`, `codePage`, `codeFilter`, `editingCodeId`, `viewingCodeId` 등 codes 전역 상태 제거
  - 초기화, 무한 스크롤, 네비게이션, 관리자 패치가 codes 모듈의 공개 상태/함수만 사용하도록 변경
  - 일정 데이터가 없어도 짝꿍코드 데이터가 있으면 화면 재렌더링이 가능하도록 공통 재렌더 조건 보완
- `tests/vite-build.test.mjs`
  - codes의 api/state/view 파일과 main 연결, 과거 codes 전역 상태 제거를 검증하는 테스트 1개 추가
- `docs/PERFORMANCE_REFACTORING_PLAN.md`
  - 일정·짝꿍코드 모듈화 완료, 체크리스트 미완료로 진행 현황 갱신

### 검증 기록
- `git diff --check`: 통과
- `npm test`: 정적 회귀 테스트 15/15 통과
- `node --test tests/vite-build.test.mjs`: Vite/구조 테스트 6/6 통과
- `npm run build`: 성공, 15개 모듈 변환
  - `dist/index.html` 45.63kB
  - CSS 19.93kB, JS 50.31kB
- 로컬 `vite preview`와 인앱 브라우저 스모크 테스트
  1. 홈 → 짝꿍코드 탭 이동 및 목록 렌더링 확인
  2. `스냅` 필터 선택 후 26개 행 렌더링 확인
  3. 첫 항목(`탐클로이`) 상세 모달 열기/닫기 확인
  4. `+` 버튼 → `짝꿍코드 등록` 모달 열기/취소 확인
  5. 현재 번들(`index-fnLfZIWu.js`) 콘솔 오류 0건 확인
- 운영 데이터 변경 방지를 위해 등록·수정·삭제 제출은 수행하지 않음
- 미리보기 서버와 테스트용 브라우저 탭은 검증 후 종료

### 현재 작업 트리 및 인계 지점
- 이번 스텝도 커밋하지 않았으며 이전 일정 모듈화 변경과 함께 작업 트리에 존재
- 신규 디렉터리: `web/src/features/codes/`, `web/src/features/schedule/`
- 다음 권장 스텝: **체크리스트(checklist) 기능을 `api.js`·`state.js`·`view.js`로 분리**
- 체크리스트 분리 후 3개 기능이 모두 자체 상태를 소유하는지 검증하고, 그 다음 인라인 이벤트 제거로 진행
- 다음 에이전트는 `git diff --check`, `npm test`, `node --test tests/vite-build.test.mjs`, `npm run build`로 시작 상태를 확인할 것

**커밋**: 미생성 (사용자 지시 없이 커밋하지 않음)

## 2026-08-31 (계속) — Claude (Sonnet 5, claude.ai 모바일 세션) — Codex 로컬 작업 리뷰

**배경**: 사용자가 Codex(다른 로컬 에이전트, `/Users/choihogyun/Documents/Codex/.../work/repo`)를 통해 로컬에서 일정(schedule)·짝꿍코드(codes) 기능 모듈화를 이어서 진행. 사용자가 `git add -A && git commit && git push` 명령을 직접 실행해 반영(커밋 `315d951`).

### 리뷰 절차 및 결과
1. `git fetch origin main` → `315d951` 확인, `git pull`로 로컬 동기화
2. `npm install && npm run build` → **성공**, 15개 모듈 변환, 산출물 크기 안정적(CSS 19.93kB, JS 50.31kB)
3. `node --test tests/*.test.mjs` → **21/21 전부 통과** (기존 19개 + Codex가 추가한 schedule/codes 구조 검증 테스트 2개)
4. 코드 리뷰로 확인한 것:
   - `halls`/`codes` 전역 배열이 `scheduleState.items` / `matchingCodeState.items` 객체로 정확히 캡슐화됨 (계획 문서 3단계 목표인 "전역 상태를 기능별 상태 객체로 제한"에 부합)
   - 이전에 이 에이전트(Claude)가 만든 `applyPatches()`가 새 상태 구조(`scheduleState.items`/`matchingCodeState.items`)에 맞게 정확히 재배선됨
   - 오히려 개선점 발견: 패치 적용 실패 시 `applied` 목록에 잘못 기록되지 않도록 `newlyApplied` 별도 추적 추가, `firebase.firestore.FieldValue.arrayUnion()`으로 동시 쓰기 안전성 확보 (기존엔 전체 배열을 덮어쓰는 `set()` 방식이었음)
   - 인라인 `onclick` 핸들러용 `window.함수명 = 함수명` 노출 패턴은 그대로 유지됨 (Claude가 만든 안전장치를 그대로 존중)
   - 일부 신규 행(예: 체크리스트 목록 행)은 `data-action`/`data-id` 속성 기반 이벤트 위임으로 전환되어 있음 — 계획 문서 3단계의 "인라인 핸들러를 이벤트 위임으로 교체" 항목도 부분적으로 진행 중
5. `git status --short` → **비어 있음** (운영 루트 `index.html`은 이번에도 전혀 변경되지 않음, 안전 원칙 계속 유지 확인)

### Codex 로그에서 확인한 추가 검증 (Claude가 못했던 부분)
Codex는 `vite preview` + 실제 인앱 브라우저로 다음을 직접 클릭 테스트함(Claude는 브라우저 없는 세션이라 이 부분 검증 불가):
- 홈 → 짝꿍코드 탭 이동, 목록 렌더링
- `스냅` 필터 선택 후 결과 렌더링
- 상세 모달 열기/닫기
- 등록 모달 열기/취소
- 콘솔 에러 0건 확인
- (운영 데이터 보호를 위해 실제 등록·수정·삭제 제출은 하지 않음 — 안전 원칙 일치)

### 종합 평가
Codex의 로컬 작업은 **품질이 높고 안전 원칙(운영 파일 미변경, 단계별 커밋, 되돌릴 수 있는 단위)을 정확히 준수**했음. 두 에이전트가 별도 세션에서 작업했음에도 상태 관리 패턴이 일관되게 유지됨. 병합 충돌 없이 정상 반영 확인.

### 다음 단계 (Codex 로그 인계 사항과 동일)
- 체크리스트(checklist) 기능을 `api.js`/`state.js`/`view.js`로 분리 (schedule/codes와 동일 패턴)
- 3개 기능 모두 자체 상태를 갖게 된 후, 인라인 이벤트 핸들러의 이벤트 위임 전환 마무리
