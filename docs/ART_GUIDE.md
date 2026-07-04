# 엑서 빵집 타이쿤 — 아트 가이드 v3

> **아트 디렉션 v3**: cozy premium bakery cafe · warm pastel · hand-painted vector · soft cel shading ·
> warm brown outline · 좌상단 웜 광원 · soft contact shadow · **작은 크기에서도 읽히는 실루엣** ·
> cute but polished **commercial casual game quality**.
>
> 파이프라인: `assets/sprites/`에 PNG를 넣고 `manifest.json`에 등록 → 코드 수정 없이 벡터 아트를 대체.
> **미등록/로드 실패 시 벡터 v3로 자동 폴백** — 한 장씩 점진 교체해도 게임은 항상 동작한다.

## 1. 적용 방법 (3단계)

1. 아래 프롬프트로 생성 (Midjourney / ChatGPT / 나노바나나 등)
2. 배경 제거한 PNG를 `assets/sprites/`에 저장
3. `manifest.json` 등록 후 커밋·배포:
```json
"sprites": {
  "oven":       { "file": "oven_idle.png", "w": 104 },
  "oven_busy":  { "file": "oven_busy.png", "w": 104 },
  "member_member_001": { "file": "m01.png", "w": 54, "dy": 4 }
}
```
- `w` = 게임 내 표시 폭(px). 아래 표의 권장값 사용
- `dy` = 세로 위치 보정(px, 선택). 에셋이 떠 보이면 +2~6으로 접지

## 2. 공통 스타일 앵커 (모든 프롬프트 앞에 붙임)

```
Cozy premium bakery cafe management game asset, 2D isometric three-quarter view,
hand-painted vector illustration style, warm pastel color palette, soft cel shading,
rounded friendly shapes, warm brown outline, subtle paper texture, gentle gradients,
soft contact shadow, consistent light from upper-left, cute but polished commercial
mobile game quality, highly readable at small size, transparent background,
centered single object, no text, no watermark
```

**네거티브 프롬프트** (지원하는 도구에서 함께 사용):
```
photorealistic, 3D render, pixel art, anime screenshot, harsh black outline,
dark horror mood, noisy texture, blurry, cropped object, multiple objects,
text, logo, watermark, distorted perspective, low resolution, messy background
```

**디자인 토큰** (벡터 아트와 톤 일치용 — `assets/bakery-art.js TOKENS`와 동일):
아웃라인 `#5b3a26` · 크림 `#fdf6ec` · 버터 `#f6d98a` · 우드 `#c99e6d` · 카라멜 `#e8b64c` · 살구 `#f7c896` · 코랄 `#e98f7f` · 민트 `#9fd8c3` · 오븐 발광 `#ff9d3b`

## 3. 규격 공통 규칙

- 해상도: 표시 폭의 **2배 이상**으로 생성 (레티나) — 예: w=104 → 208px+
- 시점: 바닥 설비/가구/캐릭터 = **isometric 3/4 view**, 벽 부착물(door/window/lamp) = **front view**
- 배경: 투명 PNG, 단일 오브젝트 중앙 배치, 하단 여백 최소화(접지 그림자는 게임이 처리)
- 용량: 장당 100KB 이하 권장 (tinypng.com 압축)
- 파일명: `oven_idle.png`, `oven_busy.png`, `staff_baker_idle.png` 처럼 `<키>_<상태>.png` 권장 (파일명은 자유 — 매핑은 manifest 키가 결정)

## 4. 에셋 목록 · 프롬프트 (스타일 앵커 + 네거티브와 함께 사용)

### 4.1 설비 — 우선순위 1

**`oven` (w:104) — 벽돌 오븐 idle**
```
2D isometric three-quarter view brick bread oven, warm red bricks, arched oven mouth,
soft inner orange glow, wooden baker peel leaning on the side, tray of fresh bread on top,
brass handle details, flour dust, warm brown outline, soft cel shading, gentle gradients,
cute polished casual game style, transparent background, centered single object,
consistent upper-left lighting, readable at 128px, no text, no watermark
```

**`oven_busy` (w:104) — 벽돌 오븐 busy**
```
2D isometric three-quarter view brick bread oven in active baking state, stronger orange
glow from oven mouth, visible warm fire light, fresh bread tray, soft steam curls, subtle
heat shimmer impression, wooden baker peel, warm red bricks, polished hand-painted vector
style, warm brown outline, soft contact shadow, transparent background, centered single
object, no text, no watermark
```

**`display` (w:96) — 유리 쇼케이스** *(변형: `display_low` 재고 절반 이하, `display_empty` 빈 선반)*
```
2D isometric three-quarter view glass pastry display case, wooden base, curved clear glass
front with bright reflections, shelves filled with croissants, cakes, muffins and bread,
small cake dome, warm pastel colors, soft cel shading, polished mobile game illustration,
warm brown outline, transparent background, centered single object, consistent upper-left
lighting, no text, no watermark
```

**`counter` (w:100) — 카운터/POS** *(변형: `counter_active` POS 화면 밝게+동전 반짝)*
```
2D isometric three-quarter view wooden cashier counter with POS terminal, receipt printer,
small coin stack, tip jar, menu card without readable text, warm wood grain, cream
countertop, cute polished casual game style, soft cel shading, warm brown outline,
soft contact shadow, transparent background, centered single object, no text, no watermark
```

**`coffee_machine` (w:88) — 에스프레소 머신** *(변형: `_busy` 스팀 추가 / `coffee_drip`(w:82)은 핸드드립 스탠드)*
```
2D isometric three-quarter view vintage espresso machine, cream and chrome body, shiny
group head, pressure gauge, small cup underneath, soft steam curls, polished casual game
illustration, warm pastel palette, soft cel shading, warm brown outline, transparent
background, centered single object, no text, no watermark
```

### 4.2 직원 캐릭터 — 우선순위 2

**`staff_baker` (w:54)** *(변형: `_busy` 반죽 동작+집중 표정)*
```
full body 2D isometric three-quarter view, friendly young bakery staff wearing cream shirt,
warm brown apron, small name tag without text, comfortable shoes, expressive eyes with
highlights, soft smile, rosy cheeks, stylized hair with highlights, cute polished mobile
game illustration, warm pastel palette, soft cel shading, warm brown outline, transparent
background, centered single character, readable at small size, no text, no watermark
```

**`staff_barista` (w:52)** *(변형: `_busy`)*
```
full body 2D isometric three-quarter view, cheerful barista bakery staff wearing pastel
mint apron, rolled sleeves, small towel, expressive eyes, friendly smile, detailed hair
silhouette, subtle clothing folds, cute polished hand-painted vector style, warm brown
outline, soft cel shading, transparent background, centered single character, consistent
upper-left lighting, no text, no watermark
```

### 4.3 멤버 캐릭터 (키: `member_<members.json id>`, w:54)

멤버 실물 특징(머리·안경·좋아하는 색)을 반영. **정지 이미지로 교체되면 걷기 애니메이션이 사라지므로 멤버만 선택 교체 권장** (일반 손님은 벡터 유지 = 걷기 유지):
```
full body 2D isometric three-quarter view, chibi customer character, [머리 특징],
[의상 특징], [소품], happy expression, standing, big head small body proportions,
cute polished mobile game illustration, warm brown outline, soft cel shading,
transparent background, centered single character, no text, no watermark
```

### 4.4 가구 (키: `fur_<가구id>`)

| 키 | w | 오브젝트 설명(프롬프트 끝에 붙임) |
|---|---|---|
| `fur_table_wood` | 74 | small round wooden cafe table with plate of crumbs and tiny coffee cup, single center leg |
| `fur_table_couple` | 92 | rectangular wooden cafe table for two, small flower vase |
| `fur_sofa` | 88 | cozy two-seat sofa, terracotta red fabric, piping seams, wooden feet |
| `fur_terrace_table` | 92 | outdoor cafe table with red and white striped parasol |
| `fur_plant` 44 / `fur_flower` 48 / `fur_poster` 50 / `fur_clock` 46 / `fur_radio` 46 / `fur_bear` 46 / `fur_bookshelf` 58 / `fur_piano` 80 | | potted plant / tulip planter / menu poster easel / grandfather clock / retro radio / teddy bear / bookshelf / upright piano |

### 4.5 벽·환경 (front view)

| 키 | w | 설명 |
|---|---|---|
| `door` | 48 | wooden bakery entrance door, round window, hanging OPEN sign shape without readable text, brass handle, **front view** |
| `window` | 54 | wooden cafe window, blue sky and clouds outside, **front view** |
| `lamp` | 34 | brass pendant lamp with warm glowing bulb, **front view** |

## 5. 폴백/상태 동작 (개발 참고)

- `spriteOr([우선키, 폴백키...], 벡터SVG)` — 앞 키부터 조회, 전부 없으면 벡터 v3 렌더
- 상태 키 조회 순서 예: 오븐 가동 시 `oven_busy` → `oven` → 벡터. 쇼케이스는 재고율로 `display_empty`(0) / `display_low`(<25%) / `display`(그 외)
- 이미지는 부팅 시 프리로드에 **성공한 것만** 등록되므로 깨진 파일·404는 자동으로 벡터 폴백
- 이미지 교체 시 해당 요소의 코드 애니메이션(불꽃·스팀·팔다리)은 정지됨 → `_busy` 변형으로 상태감 유지

## 6. 생성 우선순위

1. `oven` + `oven_busy` (화면 중심, 상태 변화가 가장 잘 보임)
2. `display` (+`display_empty`)
3. `counter` (+`counter_active`)
4. `staff_baker`(+`_busy`), `staff_barista`
5. `coffee_machine`(+`_busy`)
6. 멤버 캐릭터 (커뮤니티 반응이 가장 큰 항목 — 실제 멤버 특징 반영)
7. 가구·문·창문·조명

**일관성 팁**: 첫 에셋(oven)이 마음에 들면 그 이미지를 스타일 레퍼런스로 첨부하고 나머지를 같은 세션에서 연속 생성.
