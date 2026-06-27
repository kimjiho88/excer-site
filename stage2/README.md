# 2단계 — 카카오 로그인 + 클라우드 세이브 + 익명→카카오 이전

`GAME_DESIGN.md §12.7 / §13 / §14`의 2단계 구현. **기존 `game.html`은 건드리지 않고** 독립 모듈로 만들어, 3단계(엔진화)·5단계(통합) 때 그대로 재사용한다.

| 파일 | 역할 |
|---|---|
| `schema.sql` | `game_saves`(전체 상태 `S`를 JSONB로) + RLS + `save_score()` + 익명→카카오 병합 RPC `migrate_anon_to_me()` |
| `cloudsave.js` | 재사용 모듈 `window.CloudSave` (로그인/세이브·로드/이전/진행도 비교) |
| `login.html` | game.html 없이 전체 흐름을 클릭으로 검증하는 테스트 페이지 |

## 무엇이 바뀌나 (현행 → 2단계)

| | 현행 `game.html` | 2단계 |
|---|---|---|
| 신원 | 익명(`signInAnonymously`)만 | 익명 → **카카오 연결/로그인** |
| 저장 | 전체 `S`는 **localStorage에만** | 전체 `S`를 **`game_saves`(JSONB) 클라우드 저장**, localStorage는 캐시 |
| 서버 데이터 | `game_players`(랭킹 투영)만 | + `game_saves`(진짜 세이브) |
| 진행도 보존 | 기기 바꾸면 유실 | 카카오 신원 기준으로 클라우드 복원 |

> 권위(anti-cheat: 전투력/가챠 서버 RPC)는 **4단계** 범위다. 2단계는 신원·영속성·이전에 집중한다. 단, 진행도 점수(`score`)는 트리거로 서버가 계산해 가짜 점수 덮어쓰기는 차단했다.

## 설치

### 1. SQL 적용
Supabase 대시보드 → **SQL Editor** 에 `schema.sql` 전체를 붙여 실행. (기존 `game_players`/`game_ops`는 그대로 둠)

### 2. 카카오 OAuth 공급자 등록
**Kakao Developers** (https://developers.kakao.com)
1. 애플리케이션 생성 → **REST API 키** 확보, **Client Secret** 발급(활성화).
2. 카카오 로그인 **활성화 ON**, 동의항목에서 필요한 범위(닉네임 등) 설정.
3. **Redirect URI** 에 Supabase 콜백 추가:
   `https://drggzlnzwvkhtalvkqyo.supabase.co/auth/v1/callback`
4. 플랫폼 → Web 사이트 도메인에 배포 도메인 등록(예: GitHub Pages 도메인).

**Supabase 대시보드** → Authentication → Providers → **Kakao** 활성화
- REST API 키 → `Client ID`, Client Secret → `Client Secret` 입력.

**Supabase** → Authentication → URL Configuration → **Redirect URLs** 에 `login.html`(및 추후 게임 페이지) 의 실제 URL 추가. 없으면 OAuth 복귀가 차단된다.

> 익명 로그인도 활성화돼 있어야 한다(Authentication → Providers → Anonymous). 이미 game.html 이 쓰고 있으므로 보통 켜져 있음.

### 3. 테스트
`login.html` 을 **허용된 Redirect URL 과 같은 출처**에서 연다(로컬 `file://` 는 OAuth 리다이렉트 불가 — 배포 도메인 또는 동일 호스팅 필요).
1. **익명으로 시작** → uid 발급 확인
2. **레벨업/환생/도감** 으로 진행도 생성 → **클라우드에 저장**
3. **카카오 로그인 / 연결** → 카카오 동의 후 복귀
4. 복귀 후 로그가 *"같은 uid, 데이터 이동 없음"*(연결) 또는 *"익명 → 카카오 이전 완료"*(병합) 인지 확인
5. **클라우드에서 불러오기** 로 진행도 보존 확인

## 이전(migration) 동작

```
익명 플레이(localStorage + 클라우드 세이브)
        │  [카카오 로그인 / 연결] 클릭
        ▼
linkIdentity({provider:'kakao'})
   ├─ 성공 ─────────────► 같은 uid 에 카카오 identity 부착. 세이브 그대로(이동 0).
   └─ identity_already_exists
            (카카오가 이미 타 기기/계정에 존재)
                 │
                 ▼
        signInWithOAuth({kakao})  →  카카오 uid 로 전환
                 │  복귀 후
                 ▼
        migrate_anon_to_me(익명uid)   ← SECURITY DEFINER RPC
            · is_anonymous=true 출처만 허용(실계정 보호)
            · score 높은 세이브를 '통째로' 채택(인벤 부분병합 X = 복제 차단)
            · 익명 game_saves/game_players 정리
```

`handleRedirectResult()` 가 페이지 로드시 1회 이 마무리를 자동 수행한다. 리다이렉트 직전 익명 uid 는 localStorage(`nh_cs_pending_anon`)에 보관된다.

## `cloudsave.js` API

```js
await CloudSave.init({ url, anon });   // 클라이언트 생성 + 세션 복원, 반환: user|null
await CloudSave.ensureAnon();          // 세션 없으면 익명 시작
await CloudSave.linkKakao();           // 익명 uid 유지하며 카카오 연결. {conflict:true} 가능
await CloudSave.signInWithKakao();     // 카카오로 로그인/전환(uid 바뀔 수 있음)
await CloudSave.handleRedirectResult();// OAuth 복귀 처리(연결/병합 마무리)
await CloudSave.loadCloud();           // 내 세이브 {state,ver,score,clientSeen,updatedAt}|null
await CloudSave.saveCloud(S);          // 전체 상태 저장(score/seen 은 서버가 계산)
CloudSave.progressScore(S);            // 진행도 점수(= schema.sql save_score 와 동일 공식)
CloudSave.resolve(localS, cloudS);     // 채택 결정 {chosen, source, localScore, cloudScore}
CloudSave.user();                      // {uid,isAnonymous,providers,hasKakao,email,nick}
```

## 5단계(통합) 때 game.html 에 붙이는 법 (요약)

현재 `game.html` 의 신원/저장 지점만 교체하면 된다. (지금은 건드리지 않음)

1. `<script src="stage2/cloudsave.js">` 추가, 부트에서 `await CloudSave.init(SUPA)`.
2. 부트 순서: `init` → `handleRedirectResult()` → `ensureAnon()` →
   `resolve(localStorage의 S, (await loadCloud()).state)` 로 시작 상태 결정.
3. 현재 `save()`(line ~293)의 localStorage 저장은 **캐시로 유지**하고, 뒤에 `CloudSave.saveCloud(S)`(디바운스) 추가.
4. 닉/카카오 로그인 버튼을 UI에 추가 → `linkKakao()`/`signInWithKakao()` 연결.
5. 기존 `netSubmit()`(랭킹 투영, `game_players`)은 그대로 둔다 — 클라우드 세이브와 병행.

> 전투력·가챠·구매의 서버 권위화(RPC)는 **4단계**에서 진행한다(`GAME_DESIGN.md §14`).

## 카카오 로그인이 안 될 때 (트러블슈팅)

증상: "카카오로 로그인"을 눌러 카카오 동의까지 갔다가 **돌아오면 로그인이 안 되어 있음**(조용한 실패).
거의 대부분 **코드 문제가 아니라 대시보드 설정(특히 Redirect URL 허용목록)** 이 원인이다.
이제 복귀 시 에러가 화면(`alert`)과 콘솔에 표시되므로, 아래를 그 메시지와 대조해 확인한다.

현재 배포 기준 URL (Vercel):

| 항목 | 값 |
|---|---|
| 게임 페이지(복귀 주소) | `https://excer-site.vercel.app/game_v2.html` |
| 필독/Site URL 후보 | `https://excer-site.vercel.app/` |
| Supabase 콜백 | `https://drggzlnzwvkhtalvkqyo.supabase.co/auth/v1/callback` |

체크리스트:

1. **Supabase → Authentication → URL Configuration → Redirect URLs** 에 게임 페이지 주소를 등록.
   경로가 바뀌어도 되도록 와일드카드 권장: `https://excer-site.vercel.app/**`
   (게임 화면의 *"로그인이 안 되나요?"* 를 펼치면 등록해야 할 정확한 주소가 나오고, 눌러서 복사할 수 있다.)
2. **Supabase → Authentication → Providers → Kakao** 활성화 + `Client ID`(카카오 REST API 키) / `Client Secret` 입력.
3. **Kakao Developers → 카카오 로그인 → Redirect URI** 에 `https://drggzlnzwvkhtalvkqyo.supabase.co/auth/v1/callback` 등록.
4. **Kakao Developers → 플랫폼 → Web 사이트 도메인** 에 `https://excer-site.vercel.app` 등록.
5. **Supabase → Authentication → Providers → Anonymous** 활성화(익명 시작에 필요).
6. (선택) **Site URL** 을 `https://excer-site.vercel.app/game_v2.html` 로 두면 redirect 미스 시에도 게임 페이지로 떨어져 에러가 바로 보인다.

> 로컬 `file://` 나 미등록 도메인에서는 OAuth 복귀가 차단된다. 반드시 **등록된 배포 도메인**에서 테스트한다.
> 코드 측 진단: 복귀 에러는 `game_v2.html`/`index.html` 의 가드가 파싱해 `alert`로 표시하고, 클릭 시점의 `redirectTo` 는 콘솔(`[카카오] redirectTo = …`)에 남는다.
