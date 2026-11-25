# 보안 마무리 (콘솔에서 직접 해야 하는 것)

1. Firebase 콘솔 → Firestore → 규칙 → 저장소의 `firestore.rules` 내용을 붙여넣고 게시
   - 문서 크기·필드 제한, 정해진 컬렉션 외 차단, `meta` 쓰기 차단이 적용됩니다.
2. 관리자 비밀번호: 해시가 번들에 있어 근본적으로 안전하지 않음. 새 비밀번호를 정하면
   PBKDF2(salt) 해시로 교체 가능. 완전한 해결은 Firebase Auth + Cloud Functions(Blaze 요금제).
3. Firebase 콘솔 → 일일 백업(또는 export) 설정 권장.
