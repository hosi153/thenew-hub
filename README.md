# 더뉴컨벤션 정보 허브

별도 빌드 과정 없이 `index.html`을 배포하는 정적 웹앱입니다. 일정, 짝꿍코드, 예식 준비 체크리스트는 Firebase Firestore에 저장됩니다.

## 로컬 실행

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:4173`을 엽니다. Firebase SDK와 Firestore를 사용하므로 인터넷 연결이 필요합니다.

## 검증

```bash
node --test tests/static-review.test.mjs
```

테스트는 인라인 JavaScript 문법, HTML ID 중복, REST 페이지네이션, 동적 이벤트 데이터 처리, 모달 접근성에 필요한 회귀 조건을 확인합니다.

## 비밀번호 호환성

- 새 항목은 개별 salt를 사용하는 PBKDF2-SHA256으로 비밀번호 해시를 저장합니다.
- 기존 SHA-256 항목은 계속 수정·삭제할 수 있습니다.
- 비밀번호 입력 흐름은 실수로 다른 사용자의 항목을 수정하는 것을 막기 위한 앱 기능입니다.
- 검증과 Firestore 쓰기가 모두 브라우저에서 수행되므로, 이 방식만으로 직접 Firestore API 호출을 차단할 수는 없습니다. 강한 접근 통제가 필요해지면 Firebase Auth와 서버 측 권한 검증으로 전환해야 합니다.

## 배포 전 확인

- Firebase 프로젝트의 허용 도메인과 API 키 제한
- Firestore 백업 및 복구 절차
- 실제 iPhone Safari에서 캘린더와 `datetime-local` 입력
- 일정·코드·체크리스트 등록, 수정, 삭제 및 잘못된 비밀번호 처리
- 네트워크 차단 상태에서 재시도 버튼과 REST 폴백

## 구조상 주의사항

현재 앱은 단일 HTML 파일 구조를 유지합니다. 기능을 더 확장할 경우 CSS와 JavaScript를 별도 파일로 분리하고 Firebase Emulator 기반 통합 테스트를 추가하는 것이 좋습니다.

단일 파일을 Vite 기반 기능 모듈로 전환하고 저장·조회·렌더링 성능을 개선하는 단계별 작업은 [성능 개선 리팩터링 계획](docs/PERFORMANCE_REFACTORING_PLAN.md)을 참고하세요.
