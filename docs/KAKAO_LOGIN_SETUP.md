# 카카오 로그인 준비 (운영자 설정)

카카오 로그인 코드를 넣기 전에 운영자가 두 화면에서 설정합니다. 메뉴 이름은 화면 개편에 따라 조금 다를 수 있습니다.

비밀 값(Client Secret)은 Supabase 설정 칸에만 붙여 넣습니다. 채팅, 저장소, 소식 글에는 올리지 않습니다.

## 넣을 값

| 칸 | 값 |
|---|---|
| 사이트 도메인(카카오) | `https://excer-site.vercel.app` |
| Redirect URI(카카오) | `https://drggzlnzwvkhtalvkqyo.supabase.co/auth/v1/callback` |
| Redirect URLs(Supabase) | `https://excer-site.vercel.app/**` |
| 개인정보 처리방침(카카오에 칸이 있으면) | `https://excer-site.vercel.app/privacy.html` |

## 1. 카카오 디벨로퍼스(developers.kakao.com)

지도와 공유에 쓰는 앱(excer)에 카카오 로그인을 켭니다. 새 앱은 만들지 않습니다.

1. 내 애플리케이션에서 **excer** 를 엽니다.
2. 앱의 플랫폼 **Web**: 사이트 도메인에 `https://excer-site.vercel.app` 이 있는지 봅니다(지도를 켤 때 넣어 둠).
3. **카카오 로그인**: 사용 설정을 **ON**.
4. 카카오 로그인의 **Redirect URI**: 위의 값 하나만 등록합니다.
5. 카카오 로그인의 **동의항목**:
   - 닉네임(`profile_nickname`): **선택 동의**. 동의 목적은 '모임 참석 본인 확인'. 필수 동의는 카카오 검수가 필요할 수 있어 선택으로 둡니다.
   - 프로필 사진, 카카오계정(이메일): 설정하지 않습니다(받지 않음).
6. **보안**: Client Secret 코드를 만들고 활성화 상태를 **사용함**으로. 이 코드는 2단계의 Supabase 칸에만 넣습니다.
7. **앱 키**: REST API 키를 확인합니다(2단계의 Client ID 칸).
8. 개인정보 처리방침 URL 칸이 있으면 위의 값을 넣습니다.

## 2. Supabase 대시보드

1. **Authentication > Sign In / Providers > Kakao** 를 엽니다. 이미 켜져 있으면 값만 확인합니다.
2. **Enable** 을 켭니다.
3. **REST API Key(Client ID)**: 1단계 7의 REST API 키. **Client Secret Code**: 1단계 6의 코드.
4. **Allow users without an email** 을 켭니다(이메일을 받지 않으므로).
5. **Save**.
6. **Authentication > URL Configuration**: Redirect URLs 에 `https://excer-site.vercel.app/**` 가 있는지 보고 없으면 더합니다. Site URL 은 이미 있으면 그대로 둡니다.

## 3. 끝나면

- '설정 끝' 이라고만 알려 주세요. 키나 비밀 값은 보내지 않습니다.
- 그다음 작업(코드)
  1. 서버: 카카오 계정과 채팅방 닉네임을 하나씩 묶는 표와 함수. 참석, 취소, 모임 올리기를 로그인한 계정으로만.
  2. 소식 화면: '카카오로 확인' 단추와 닉네임 고르기. 그 뒤 참석은 한 번 누르기.
  3. 운영 화면: 묶기 목록, 풀기와 바꾸기, 같은 닉네임을 둘이 고른 경우.
  4. 개인정보 처리방침에 카카오 로그인 항목(카카오 회원번호, 카카오 닉네임, 보관 기간)을 더하고 시행 7일 전에 소식 공지로 알림.

## 지킬 것

- Client Secret 과 운영진 비밀번호는 채팅, 저장소, 소식 글에 올리지 않습니다.
- Redirect URI 는 위의 값 하나만 둡니다.
- 동의항목은 닉네임 하나로 시작합니다. 쓰지 않는 항목은 받지 않습니다.
