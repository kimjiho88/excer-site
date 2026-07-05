# 엑서 빵집 타이쿤 — AI 그림 생성 프롬프트 모음 (한글 안내)

> 오븐 그림과 **똑같은 화풍**으로 나머지 에셋을 만들기 위한 프롬프트 모음입니다.
> ChatGPT(이미지)·Midjourney·나노바나나 등 어디서든 그대로 복사해 쓰세요.
>
> **만드는 법**: ① 아래 프롬프트 복사 → 그림 생성 → ② 파일로 저장 → ③ 이 채팅에 **📎 파일 첨부**로 올려주기.
> (이미지 붙여넣기가 아니라 **파일 첨부**여야 게임에 넣을 수 있어요.)
>
> **일관성 팁**: 오븐 그림이 마음에 드셨으니, 새 그림 만들 때 **오븐 그림을 스타일 참고로 함께 첨부**하고 "같은 화풍으로" 라고 덧붙이면 톤이 딱 맞습니다.

---

## 0. 공통 규칙 (모든 그림에 해당)

- **배경 없이**(투명 PNG), 물체 **하나만** 화면 가운데, **글자·워터마크 없이**
- 시점: 설비·가구·캐릭터 = **비스듬히 내려다보는 3/4 쿼터뷰**, 벽에 붙는 것(문·창문·조명) = **정면뷰**
- 빛은 **왼쪽 위에서** 들어오는 따뜻한 느낌으로 통일

**모든 프롬프트 앞에 붙이는 공통 스타일 문구(영문):**
```
Cozy premium bakery cafe management game asset, 2D isometric three-quarter view,
hand-painted vector illustration style, warm pastel color palette, soft cel shading,
rounded friendly shapes, warm brown outline, subtle paper texture, gentle gradients,
soft contact shadow, consistent light from upper-left, cute but polished commercial
mobile game quality, highly readable at small size, transparent background,
centered single object, no text, no watermark
```

**빼달라고 하는 문구(네거티브, 지원하는 도구에서):**
```
photorealistic, 3D render, pixel art, harsh black outline, dark mood, noisy texture,
blurry, cropped, multiple objects, text, logo, watermark, low resolution, messy background
```

---

## 1. 설비 (가장 먼저 — 화면에서 제일 큼)

### 🍰 유리 쇼케이스 — `display`  (권장 폭 96px)
```
2D isometric three-quarter view glass pastry display case, warm wooden base,
curved clear glass front with soft reflections, two shelves filled with croissants,
cakes, muffins and bread rolls, a small glass cake dome on top, cream and caramel
tones, soft cel shading, warm brown outline, polished cute mobile game illustration,
transparent background, centered single object, upper-left lighting, no text, no watermark
```
- (선택) 빈 진열장 버전 → 위 문구 끝에 `, empty shelves, sold out` 추가 → 파일명 `display_empty`

### 🧾 카운터 / POS — `counter`  (권장 폭 100px)
```
2D isometric three-quarter view wooden bakery cashier counter, cream countertop,
warm wood grain, a cute POS register with a soft green screen, a small receipt,
a little stack of gold coins, a glass tip jar, a tiny menu card without readable text,
warm pastel palette, soft cel shading, warm brown outline, soft contact shadow,
transparent background, centered single object, no text, no watermark
```

### ☕ 에스프레소 머신 — `coffee_machine`  (권장 폭 88px)
```
2D isometric three-quarter view vintage espresso machine, cream and chrome body,
shiny group head, small round pressure gauge, two little cups underneath, soft steam
curls rising, warm pastel palette, soft cel shading, warm brown outline, gentle
gradients, cute polished mobile game illustration, transparent background,
centered single object, upper-left lighting, no text, no watermark
```

### 🫖 핸드드립 커피 스탠드 — `coffee_drip`  (권장 폭 82px)
```
2D isometric three-quarter view small wooden hand-drip coffee stand, paper dripper
on a glass carafe with coffee, a gooseneck kettle, warm wood, cream and caramel tones,
soft cel shading, warm brown outline, cute polished mobile game illustration,
transparent background, centered single object, no text, no watermark
```

---

## 2. 직원 캐릭터 (귀여움 = 호감의 핵심)

### 👩‍🍳 베이커 직원 — `staff_baker`  (권장 폭 54px)
```
full body cute chibi bakery baker character, big head small body proportions,
cream shirt with a warm brown apron, white chef hat, a little flour dust on the apron,
friendly warm smile, big expressive eyes with highlights, rosy cheeks, stylized hair,
standing pose, hand-painted vector style, warm pastel palette, soft cel shading,
warm brown outline, transparent background, centered single character,
readable at small size, no text, no watermark
```

### ☕ 바리스타 직원 — `staff_barista`  (권장 폭 52px)
```
full body cute chibi bakery barista character, big head small body proportions,
coral shirt with a pastel mint apron, rolled sleeves, a small towel over the shoulder,
cheerful bright smile, big expressive eyes with highlights, rosy cheeks, detailed
stylized hair, standing pose, hand-painted vector style, warm pastel palette,
soft cel shading, warm brown outline, transparent background, centered single character,
no text, no watermark
```

> **바쁜 표정 버전(선택)**: 위 문구 끝에 `, focused busy expression, tiny sweat drop` 추가 →
> 파일명 `staff_baker_busy` / `staff_barista_busy`

---

## 3. 손님 캐릭터 (원하면)

### 일반 손님 — `customer_walkin` (여러 장 만들면 다양해짐, 폭 54px)
```
full body cute chibi cafe customer character, big head small body proportions,
casual cozy outfit in warm pastel color, happy relaxed expression, big eyes with
highlights, rosy cheeks, stylized hair, standing pose, hand-painted vector style,
warm brown outline, soft cel shading, transparent background, centered single character,
no text, no watermark
```

### 멤버(단골) 손님 — `member_<멤버id>` (실제 멤버 특징 반영, 폭 54px)
`[  ]` 안을 실제 멤버 특징으로 바꿔 넣으세요:
```
full body cute chibi cafe customer character, big head small body proportions,
[짧은 갈색 머리 / 안경 / 파란 후드티 같은 특징], happy expression, standing pose,
hand-painted vector style, warm pastel palette, warm brown outline, soft cel shading,
transparent background, centered single character, no text, no watermark
```

---

## 4. 가구 (꾸미기)  — 파일명 `fur_<이름>`

| 그림 | 파일명 | 폭 | 프롬프트 끝에 붙일 물체 설명(영문) |
|---|---|---|---|
| 원목 테이블 | `fur_table_wood` | 74 | small round wooden cafe table with a plate and a coffee cup |
| 2인 테이블 | `fur_table_couple` | 92 | rectangular wooden cafe table for two with a small flower vase |
| 소파 | `fur_sofa` | 88 | cozy two-seat sofa, terracotta red fabric with piping, wooden feet |
| 파라솔 테이블 | `fur_terrace_table` | 92 | outdoor cafe table with a red and white striped parasol umbrella |
| 화분 | `fur_plant` | 44 | a potted green plant in a terracotta pot |
| 튤립 화단 | `fur_flower` | 48 | a tulip flower planter box |
| 그림 액자 | `fur_poster` | 50 | a framed bakery menu poster on a small wooden easel |
| 괘종시계 | `fur_clock` | 46 | an antique warm-wood grandfather clock |
| 라디오 | `fur_radio` | 46 | a retro cream-colored radio |
| 곰인형 | `fur_bear` | 46 | a cute sitting teddy bear plush |
| 책장 | `fur_bookshelf` | 58 | a small wooden bookshelf with colorful books |
| 피아노 | `fur_piano` | 80 | an upright warm-wood piano with the key lid open |

→ 예시(화분): 공통 스타일 문구 + `a potted green plant in a terracotta pot`

---

## 5. 벽·환경 (정면뷰!)  — 파일명 그대로

| 그림 | 파일명 | 폭 | 프롬프트 끝에 붙일 설명(영문) |
|---|---|---|---|
| 출입문 | `door` | 48 | wooden bakery entrance door with a round window and a hanging OPEN sign, brass handle, **front view** |
| 창문 | `window` | 54 | wooden cafe window with blue sky and soft clouds outside, **front view** |
| 펜던트 조명 | `lamp` | 34 | a brass pendant lamp with a warm glowing bulb, **front view** |
| Welcome 입간판 | `deco_aboard` | 52 | a wooden A-frame chalkboard sign with a cute coffee cup doodle, no readable text |
| 벽 선반 | `deco_shelf` | 64 | a wooden wall shelf with a few colorful jam jars |
| 꽃 수풀 | `deco_bush` | 60 | a round green bush with small pink and white flowers |
| 고양이 마스코트 | `deco_cat` | 46 | a cute sitting cream-colored cat mascot with a red bandana |

---

## 6. 우선순위 (이 순서로 만들면 효율적)

1. **오븐** ✅ (완료 — 벡터로 재현됨)
2. **쇼케이스** `display`
3. **카운터** `counter`
4. **베이커** `staff_baker`
5. **바리스타** `staff_barista`
6. **에스프레소 머신** `coffee_machine`
7. 그다음: 가구·문·창문·조명·멤버 캐릭터

> **이 5장(쇼케이스·카운터·베이커·바리스타·머신)만 만들어 주시면 게임 화면의 대부분이 그 그림체가 됩니다.**
> 하나씩 만들어서 **📎 파일 첨부**로 올려주시면, 제가 크기 맞추고 게임에 넣어 배포까지 처리하겠습니다.
