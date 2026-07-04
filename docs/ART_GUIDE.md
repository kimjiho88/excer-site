# 엑서 빵집 타이쿤 — AI 스프라이트 에셋 가이드

> 목표: 코드 생성 SVG를 **전문 일러스트 수준의 AI 생성 PNG**로 교체한다.
> 파이프라인은 이미 게임에 내장되어 있다: `assets/sprites/`에 PNG를 넣고 `manifest.json`에 한 줄 등록하면
> 코드 수정 없이 즉시 적용된다. 등록이 없으면 SVG로 폴백하므로 **에셋을 하나씩 점진 교체해도 게임은 항상 동작**한다.

## 1. 적용 방법 (3단계)

1. 아래 프롬프트로 이미지 생성 (Midjourney / ChatGPT(DALL·E) / 나노바나나 등 어느 도구든 OK)
2. 배경 제거 후 PNG로 `assets/sprites/`에 저장 (파일명 자유)
3. `assets/sprites/manifest.json`의 `sprites`에 등록:
```json
"sprites": {
  "oven": { "file": "oven.png", "w": 104 },
  "member_member_001": { "file": "kim.png", "w": 54 }
}
```
`w`= 게임 내 표시 폭(px). 아래 표의 권장값 사용. 커밋·배포하면 끝.

## 2. 스타일 가이드 (모든 에셋 공통 — 프롬프트에 항상 포함)

**스타일 앵커 (영문 프롬프트 접두)**:
```
cozy mobile game asset, warm pastel bakery cafe theme, cute chibi cartoon style,
soft cel shading with warm dark-brown outlines, isometric 3/4 top-down view,
clean vector-like finish, transparent background, no text, single object centered
```
- 라이팅: 좌상단 광원, 부드러운 셀 셰이딩 1~2단
- 팔레트: 크림 #fdf6ec · 브라운 #8a5a33 · 카라멜 #c99e6d · 골드 #e8b64c · 포인트 레드 #e06d6d
- 아웃라인: 웜 다크브라운(#4a3020), 균일 두께
- **뷰 각도가 생명**: 바닥에 놓이는 물체는 반드시 "isometric 3/4 view", 벽 부착물(문·창문)은 "front view"
- 해상도: 표시 폭의 2배로 생성(레티나). 예: 표시 104px → 208px 이상

## 3. 에셋 목록 · 규격 · 프롬프트

### 3.1 설비 (우선순위 1 — 화면 점유가 가장 큼)

| 키 | 표시폭 | 프롬프트 (스타일 앵커 뒤에 추가) |
|---|---|---|
| `oven` | 104 | brick stone bread oven with arched dark opening, wooden peel, chimney, tray of golden bread loaves on top |
| `oven_busy` | 104 | 위와 동일 + glowing orange fire inside the arched opening, small smoke puff from chimney |
| `display` | 96 | wooden bakery display showcase with glass front, two shelves filled with breads croissants and pastries, glass reflection |
| `counter` | 100 | wooden cashier counter with small POS register with green screen, glass tip jar with gold coins |
| `coffee_drip` | 82 | small wooden coffee brew stand with paper dripper, glass server with coffee, gooseneck kettle |
| `coffee_machine` | 88 | red retro espresso machine on wooden counter, chrome portafilter, two white cups on top, pressure gauge |
| `coffee_machine_busy` | 88 | 위와 동일 + steam rising from the group head |

### 3.2 직원 (우선순위 2)

| 키 | 표시폭 | 프롬프트 |
|---|---|---|
| `staff_baker` | 54 | chibi baker character, white chef hat and apron, friendly smile, standing, big head small body proportions |
| `staff_baker_busy` | 54 | 위와 동일 + kneading dough with both hands, focused open-mouth expression |
| `staff_cashier` | 52 | chibi cashier girl character, red ponytail, yellow shirt with white apron, welcoming smile, standing |

### 3.3 가구 (키: `fur_<id>`)

| 키 | 표시폭 | 프롬프트 |
|---|---|---|
| `fur_table_wood` | 74 | small round wooden cafe table, single center leg |
| `fur_table_couple` | 92 | rectangular wooden cafe table for two, small flower vase on top |
| `fur_sofa` | 88 | cozy two-seat sofa, terracotta red fabric, wooden feet |
| `fur_terrace_table` | 92 | outdoor cafe table with red and white striped parasol umbrella |
| `fur_plant` | 44 | potted green plant in terracotta pot |
| `fur_flower` | 48 | tulip flower bed planter box |
| `fur_poster` | 50 | framed bakery menu poster on wooden easel stand |
| `fur_clock` | 46 | antique grandfather wall clock, warm wood |
| `fur_radio` | 46 | retro cream-colored radio |
| `fur_bear` | 46 | cute teddy bear plush sitting |
| `fur_bookshelf` | 58 | small wooden bookshelf with colorful books |
| `fur_piano` | 80 | upright piano, warm brown wood, open key lid |

### 3.4 벽·환경 (front view!)

| 키 | 표시폭 | 프롬프트 |
|---|---|---|
| `door` | 48 | wooden bakery entrance door with round window and OPEN sign, brass handle, **front view** |
| `window` | 54 | wooden frame cafe window with blue sky and clouds outside, **front view** |
| `lamp` | 34 | hanging pendant lamp with warm yellow glow, brass shade, **front view** |

### 3.5 멤버 캐릭터 (키: `member_<members.json의 id>`)

멤버별 개성이 곧 콘텐츠다. 실제 멤버의 특징(머리 스타일·안경·좋아하는 색)을 반영해 생성:
```
chibi customer character, [머리 특징], [의상 특징], [소품], happy expression,
standing, big head small body proportions
```
예 — `member_member_001` (표시폭 54):
```
... chibi customer character, short brown hair, orange fox-themed hoodie,
round glasses, happy expression, standing, big head small body proportions
```
등록: `"member_member_001": { "file": "m01.png", "w": 54 }`

## 4. 제작 팁

- **일관성**: 한 세션/한 도구에서 스타일 앵커를 고정하고 연속 생성해야 톤이 맞는다. 첫 결과물이 마음에 들면 그 이미지를 스타일 레퍼런스로 넣고 나머지를 생성
- **배경 제거**: 생성 시 "transparent background"를 넣어도 체커보드가 아닌 흰 배경이 올 수 있음 → remove.bg 등으로 제거 후 저장
- **이미지 에셋의 트레이드오프**: PNG로 교체하면 해당 요소의 코드 애니메이션(팔다리 걷기, 표정 변화, 불꽃)은 정지 이미지가 된다. 그래서 `_busy` 변형 키를 지원(오븐/커피/제빵사). 손님 캐릭터는 걷기 애니메이션 유지를 위해 SVG를 기본으로 두고, **멤버만** 이미지 교체를 권장
- **용량**: PNG당 100KB 이하 권장(카톡 인앱 로딩). tinypng.com 압축

## 5. 현재 상태

- 벡터 아트 v2(아웃라인+그라데이션 셰이딩)가 기본 적용되어 있음 — 에셋이 없어도 일러스트 톤 유지
- `manifest.json`은 빈 상태로 배포됨. 교체 우선순위: 설비(3.1) → 직원(3.2) → 멤버(3.5) → 가구(3.3)
