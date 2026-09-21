# 탭별 이미지 기획과 생성 프롬프트

홈 대표 그림(가을 모닥불) 한 장으로 잡힌 화풍을 사이트 전체로 넓히는 계획입니다. 이미지는 외부 생성 도구로 만들고, 파일이 들어오면 자리를 여는 순서로 갑니다. 규격·표시 규칙은 `docs/IMAGE_SPEC.md`, 색 체계는 `assets/site.css` 토큰이 기준입니다.

## 1. 기획 검토 — 어디에 두고 어디에 두지 않나

이미지는 세 가지 일만 합니다. 이 셋에 들지 않으면 두지 않습니다.

| 역할 | 어디 | 왜 |
|---|---|---|
| **분위기** — 이 방이 어떤 곳인지 3초 안에 전달 | 홈 대표 그림, 이용 안내·맛집 머리 배너 | 글보다 빠르고, 채팅에 붙는 미리보기 카드가 된다 |
| **표지판** — 이 탭이 무엇을 하는 곳인지 | 통계·정산·소식 머리의 작은 스팟 그림 | 탭마다 다른 얼굴이 생겨 "같은 사이트의 다른 방"으로 읽힌다 |
| **빈 자리 채움** — 데이터가 없을 때 첫 행동 유도 | 소식·맛집·통계의 빈 상태, 오프라인 페이지 | 빈 화면이 "고장"이 아니라 "아직"으로 읽힌다 |

두지 않는 곳: 차트·표·목록 옆(숫자와 경쟁), 도해(`.flow`, 레인)와 콜아웃 안(이미 도해가 그림 역할), 글쓰기·등록 폼, 정산 결과 카드(이미지로 저장되는 영역이라 무거워짐), 모든 섹션 제목 옆 장식.

### 검토 결과 — 자리 15곳, 생성 이미지 14장 + 조립 5장

| 순위 | 탭 | 자리 | 종류 | 비율 | 장수 |
|---|---|---|---|---|---|
| 1 | 홈 | 계절 대표 그림 겨울·봄·여름 | 장면 | 3:2 + 4:5 | 6 |
| 1 | 맛집 | 머리 배너 | 장면 | 3:2 | 1 |
| 1 | 이용 안내 | 머리 배너 | 장면 | 3:2 | 1 |
| 2 | 맛집 | '오늘 뭐 먹지' 카드 | 스팟 | 1:1 | 1 |
| 2 | 활동 통계 | 머리 스팟 | 스팟 | 1:1 | 1 |
| 2 | 모임 정산·정산 확인 | 머리 스팟(공용) | 스팟 | 1:1 | 1 |
| 2 | 소식 | 머리 스팟 | 스팟 | 1:1 | 1 |
| 3 | 소식 | 빈 상태(글 없음) | 빈 상태 | 4:3 | 1 |
| 3 | 맛집 | 빈 상태(맛집 없음) | 빈 상태 | 4:3 | 1 |
| 3 | 활동 통계 | 빈 상태(불러오지 못함·발행 전) | 빈 상태 | 4:3 | 1 |
| 3 | 오프라인 페이지 | 가운데 | 스팟 | 1:1 | 1 |
| 4 | 공유 미리보기(OG) | 홈·안내·통계·정산·소식·맛집 | 조립 | 1.91:1 | 5 (생성 없음, 배너·스팟으로 조립) |

가을 대표 그림은 이미 있어 셈에서 뺐습니다. 순위 1만 넣어도 사이트 인상이 바뀌고, 2·3은 있으면 좋은 것입니다.

## 2. 화풍 기준 — 가을 그림에 맞춘다

가을 그림의 특징을 그대로 잇습니다. 새 그림이 이 조건을 벗어나면 다시 뽑습니다.

- **한국 웹툰풍 디지털 일러스트**. 깨끗한 선, 부드러운 셀 셰이딩에 회화적인 빛. 실사·3D·수채화 아님.
- **따뜻한 빛이 주인공**. 등불·창문·모닥불·석양처럼 화면 안에 광원이 하나 있고, 그 빛이 인물과 사물을 감싼다.
- **색**. 그림 안은 주황·빨강·남색이 자유롭지만, 사이트 바탕(크림 `#F7F5EF`)과 보라(`#4B2A82`)·녹슨 주황(`#A9502D`)·황토(`#7E5F25`) 옆에 놓여도 튀지 않아야 한다. 형광색·쨍한 하늘색·민트 금지.
- **사람**. 20대 후반~30대, 다섯 명 안팎, 웃거나 이야기하는 중. 특정 실존 인물·연예인 닮음 금지. 얼굴 클로즈업 금지(생성 결함이 얼굴·손에서 나온다).
- **글자 없음**. 간판·메뉴판·휴대폰 화면·책 표지 어디에도 글자가 없어야 한다. 생성 도구가 만드는 글자는 항상 깨진다. 간판은 빈 판이나 그림 기호로.
- **한국 동네 배경**. 골목 식당, 포장마차, 한강 공원, 벚꽃길, 아파트 창문 불빛. 서양식 다이너·유럽 광장 아님.
- **브랜드·로고 없음**. 카카오·특정 식당·맥주 상표가 보이면 안 된다.

### 다섯 친구 — 이어 쓰면 좋은 인물 설정 (선택)

가을 그림의 다섯 명을 다른 계절에도 같은 사람으로 두면 "같은 모임"이 됩니다. 생성 도구가 완벽히 같은 얼굴을 내지는 못하므로, 옷과 머리 모양으로 알아보게 합니다.

| 번호 | 설정 |
|---|---|
| A | 긴 갈색 웨이브 머리, 챙 넓은 모자를 자주 씀, 아이보리 니트 |
| B | 짧은 갈색 머리, 진녹색 재킷에 흰 후드 |
| C | 긴 갈색 머리, 벽돌빨강 스웨터 |
| D | 갈색 머리, 아이보리 니트에 체크 목도리 |
| E | 검은 머리, 올리브색 플리스 |

이 표는 홈 계절 그림에만 씁니다. 배너·스팟은 인물이 작거나 없어서 필요 없습니다.

## 3. 규격 요약

| 종류 | 원본 생성 크기 | 웹용 파일 | 표시 | 용량 상한 |
|---|---|---|---|---|
| 홈 계절 장면 | 3:2 1536×1024, 4:5 1122×1402(또는 1024×1280) | 3:2 → 1440×960·720×480, 4:5 → 800×1000·400×500 | 지금 가을 그림과 같은 자리·규칙 | 1440 판 300 KB, 800 판 200 KB |
| 머리 배너(안내·맛집) | 3:2 1536×1024 | 1440×960·720×480 | PC: 제목 오른쪽 열(약 58%). 모바일: 제목 아래 화면 폭(350×233). 인물이 작아야 모바일에서도 읽힌다 | 300 KB / 100 KB |
| 스팟(통계·정산·소식·오늘 뭐 먹지·오프라인) | 1:1 1024×1024 | 480×480·240×240 | 96~120px 원 또는 둥근 네모 | 40 KB |
| 빈 상태(소식·맛집·통계) | 4:3 1024×768 | 640×480·320×240 | 빈 상태 상자 안 240px 폭, 가운데 | 60 KB |
| OG | 조립 | 1200×630 JPG 92 | 카카오톡 미리보기 | 200 KB |

파일 이름: `assets/img/<탭>-<자리>-<폭>.webp` (예: `places-banner-1440.webp`, `news-spot-480.webp`, `home-winter-desktop-1440.webp`). 원본은 `assets/img/src/` 에 그대로 둡니다.

배너·스팟·빈 상태는 모두 `<img … onerror>` 방식으로 붙여 파일이 없으면 자리가 사라집니다. 홈 그림과 같은 규칙입니다.

## 4. 프롬프트

모든 프롬프트는 **공통 화풍 블록 + 장면 블록 + 금지 블록** 세 조각을 이어 붙입니다. 영어로 두는 이유는 생성 도구가 영어 지시를 더 정확히 따르기 때문이고, 옆에 한국어 요약을 달았습니다.

### 공통 화풍 블록 (앞에 붙임)

```
Korean webtoon-style digital illustration, warm and cozy mood, clean linework with soft cel shading and painterly light, one warm light source inside the scene (lantern, window, campfire or sunset glow), rich but harmonious palette of cream, deep plum purple accents, rust orange and warm gold, gentle rim light, high detail, consistent style with a cozy autumn campfire illustration, no text anywhere, no signage text, no logos, no watermark
```

### 금지 블록 (뒤에 붙임 · 부정 프롬프트를 따로 받는 도구는 그 칸에)

```
text, letters, typography, readable signs, watermark, logo, brand names, signature, photo-realistic, 3D render, blurry, extra fingers, deformed hands, distorted face, duplicate people, cropped heads, close-up face, neon colors, cyan, mint green, western diner, real celebrities
```

### 도구별 메모

- Midjourney: 뒤에 `--ar 3:2`(또는 `4:5`, `1:1`, `4:3`) `--style raw`. 가을 원본을 `--sref` 로 주면 화풍이 가장 잘 맞음. 금지 블록은 `--no` 뒤에.
- GPT 이미지·DALL·E 계열: 가을 원본을 참고 이미지로 첨부하고 "match this illustration style"을 프롬프트 앞에 한 번 더 적음. 금지 블록은 문장 끝에 "Avoid: …"로.
- Stable Diffusion 계열: 금지 블록을 negative prompt 칸에. 가을 원본으로 image-to-image 강도 0.3~0.4 를 쓰면 구도는 새로, 화풍은 유지.
- 한 자리에 3~4장 뽑아 손·얼굴·글자 결함이 없는 것을 고릅니다. 글자가 조금이라도 보이면 탈락.

---

### 4-1. 홈 — 계절 대표 그림 (순위 1)

계절이 바뀌면 `index.html` 의 계절 블록(알약 문구·제목·소개·파일)과 `assets/og.jpg` 를 같이 바꿉니다. 3:2 와 4:5 두 장씩입니다. 4:5 는 같은 장면을 세로로 다시 뽑는 것이지 3:2 를 자르는 것이 아닙니다(잘라내면 얼굴이 잘립니다).

**겨울 (12~2월)** · 파일 `home-winter-desktop-*.webp`, `home-winter-mobile-*.webp`
한국어 요약: 눈 오는 저녁 골목 포장마차. 다섯 친구가 김 오르는 어묵탕·떡볶이 앞에 목도리·패딩 차림으로 웃으며 잔을 부딪침. 주황 등불과 파란 눈길의 대비.
```
Five friends in their late twenties and early thirties gathered at a small table inside a cozy Korean street food tent (pojangmacha) on a snowy evening, steam rising from a pot of fish cake soup and tteokbokki, warm orange lantern light against a blue snowy alley outside, scarves and puffer jackets, laughing and raising paper cups, snowflakes drifting past the tent opening, wide composition with the group in the middle ground, blank sign boards
```
4:5 판: 끝에 `vertical composition, table in the foreground, the five friends closer together, snow visible at the top` 을 더함.
대체 텍스트: "눈 오는 저녁 포장마차에서 어묵탕을 앞에 두고 웃는 다섯 사람을 그린 일러스트"
홈 문구 후보: 알약 "2026 겨울" · 제목 "함께 보내는 겨울" · 소개 "뜨끈한 국물 한 그릇부터 눈 오는 날 산책까지, 동네친구들과 함께합니다."

**봄 (3~5월)** · 파일 `home-spring-*`
한국어 요약: 벚꽃 만개한 한강 공원 피크닉. 돗자리 위 김밥·치킨·커피, 꽃잎 날림, 자전거와 연이 멀리.
```
Five friends having a picnic under cherry blossom trees in full bloom at a riverside park in Seoul, sitting on a picnic mat with kimbap, fried chicken and iced coffee cups, petals drifting in soft afternoon light, bicycles and a kite far in the background, the river and a bridge beyond, wide composition, people mid-sized and relaxed
```
4:5 판: `vertical composition, blossom branches framing the top, picnic mat in the foreground`.
대체 텍스트: "벚꽃 아래 한강 공원 돗자리에 둘러앉은 다섯 사람을 그린 일러스트"
홈 문구 후보: "2026 봄" · "함께 보내는 봄" · "벚꽃 피크닉부터 저녁 한 끼까지, 동네친구들과 함께합니다."

**여름 (6~8월)** · 파일 `home-summer-*`
한국어 요약: 한강 야경, 잔디에 앉아 치킨과 시원한 음료. 강물 위 도시 불빛, 작은 조명 줄, 멀리 불꽃.
```
Five friends sitting on the grass by the Han River at night in summer, fried chicken and iced drinks on a low table, city lights reflected on the water, string lights on a nearby stall, a small paper fan, distant fireworks bursting low in the sky, warm lamp light on the faces, wide composition with the skyline behind
```
4:5 판: `vertical composition, fireworks at the top, the group in the lower half`.
대체 텍스트: "여름밤 한강 잔디밭에 앉아 불꽃놀이를 보는 다섯 사람을 그린 일러스트"
홈 문구 후보: "2026 여름" · "함께 보내는 여름" · "한강 치킨부터 여름밤 산책까지, 동네친구들과 함께합니다."

### 4-2. 맛집 — 머리 배너 (순위 1)

파일 `places-banner-1440.webp`, `places-banner-720.webp`. 사람은 작게, 골목이 주인공. 간판은 빈 판.
한국어 요약: 해 질 무렵 서울 뒷골목. 작은 식당들이 늘어서고 창마다 따뜻한 불빛, 숯불 연기, 화분과 등. 친구 넷이 어디 갈지 고르며 걷는 뒷모습.
```
A narrow Seoul back alley at dusk lined with small neighborhood restaurants, warm light glowing from every window, thin grill smoke, hanging paper lanterns, potted plants by the doors, blank wooden sign boards without any text, a group of four friends seen from behind strolling and pointing at a restaurant, cobblestone ground with a soft evening sky above, wide establishing shot with small figures
```
대체 텍스트: "해 질 무렵 식당이 늘어선 골목을 걷는 친구들을 그린 일러스트"

### 4-3. 이용 안내 — 머리 배너 (순위 1)

파일 `guide-banner-1440.webp`, `guide-banner-720.webp`. "처음 온 사람이 환영받는 순간". 문 밖에서 본 장면이라 얼굴이 작다.
한국어 요약: 저녁 골목의 아늑한 식당 입구. 안에서는 테이블의 친구들이 손을 흔들고, 문 앞에 갓 도착한 한 사람이 서 있다. 안의 따뜻한 빛이 길로 쏟아짐.
```
The entrance of a cozy small Korean restaurant on a quiet evening street, seen from slightly outside, one newcomer standing at the open door with a small wave, inside a table of four friends turning around and waving warmly, warm interior light spilling onto the pavement, a bicycle leaning by the wall, blank menu board, welcoming and gentle mood, figures small within the scene
```
대체 텍스트: "식당 문 앞에 도착한 사람을 안에서 반기는 친구들을 그린 일러스트"

### 4-4. 맛집 — '오늘 뭐 먹지' 스팟 (순위 2)

파일 `places-pick-480.webp`, `places-pick-240.webp`. 사물 중심 스티커풍. 카드 왼쪽 96px 원 안에 들어갑니다.
한국어 요약: 위에서 본 작은 뽑기 룰렛. 칸마다 국수·구이·초밥·피자 그림 기호, 옆에 젓가락 한 쌍. 크림 바탕.
```
Top-down sticker-style illustration of a small wooden spinning wheel divided into slices, each slice showing a tiny food icon (noodle bowl, grilled meat, sushi, pizza slice, dumplings, a bowl of rice), a pair of chopsticks resting beside it, centered on a plain cream background, soft shadow, no text
```
대체 텍스트: "" (장식 — 카드 제목이 뜻을 전한다)

### 4-5. 활동 통계 — 머리 스팟 (순위 2)

파일 `report-spot-480.webp`, `report-spot-240.webp`. "밤에도 대화가 오가는 동네"를 창문 불빛으로.
한국어 요약: 밤의 아파트 창문 몇 개가 나란히, 각 창이 말풍선 모양으로 빛남. 위에 별. 글자 없음.
```
Sticker-style illustration of a row of small apartment windows at night, each window glowing warmly in the shape of a rounded speech bubble, a few stars above, deep plum night sky, centered on a plain cream background, no text
```
대체 텍스트: ""

### 4-6. 모임 정산·정산 확인 — 머리 스팟 (순위 2, 두 페이지 공용)

파일 `settle-spot-480.webp`, `settle-spot-240.webp`. 휴대폰 화면은 넣지 않습니다(화면 안에 글자가 생깁니다).
한국어 요약: 나무 테이블 위 영수증 한 장, 동전 몇 개, 접힌 지폐, 젓가락, 작은 계산기. 위에서 본 스티커풍.
```
Top-down sticker-style illustration of a wooden table corner with a blank paper receipt, a few coins and a folded bill, a pair of chopsticks and a small pocket calculator with blank keys, soft warm light, centered on a plain cream background, no text or numbers
```
대체 텍스트: ""

### 4-7. 소식 — 머리 스팟 (순위 2)

파일 `news-spot-480.webp`, `news-spot-240.webp`.
한국어 요약: 코르크 게시판에 색색의 빈 카드가 핀으로 꽂혀 있고, 작은 확성기와 종이비행기. 스티커풍.
```
Sticker-style illustration of a small cork board with a few blank colored note cards pinned on it in cream, plum and rust tones, a tiny megaphone and a paper airplane in front, centered on a plain cream background, soft shadow, no text
```
대체 텍스트: ""

### 4-8. 소식 — 빈 상태 (순위 3)

파일 `news-empty-640.webp`, `news-empty-320.webp`. "첫 글을 남겨 주세요" 옆에 놓입니다.
한국어 요약: 창가 카페 테이블, 펼쳐진 빈 노트와 펜, 커피 한 잔, 아침 빛.
```
A cafe table by a window in soft morning light, an open notebook with blank pages and a pen, a cup of coffee, a small plant on the sill, quiet and inviting, 4:3 composition, no text
```
대체 텍스트: ""

### 4-9. 맛집 — 빈 상태 (순위 3)

파일 `places-empty-640.webp`, `places-empty-320.webp`.
한국어 요약: 빈 나무 식탁에 김 오르는 그릇 하나와 젓가락 두 쌍, 작은 화분. 따뜻한 빛. "첫 기록을 기다리는 자리".
```
An empty wooden restaurant table with one steaming bowl of soup, two pairs of chopsticks laid out for guests, a small potted plant, warm hanging lamp light, inviting and calm, 4:3 composition, no text
```
대체 텍스트: ""

### 4-10. 활동 통계 — 빈 상태 (순위 3)

파일 `report-empty-640.webp`, `report-empty-320.webp`. 발행 전·불러오지 못함 두 경우 공용.
한국어 요약: 책상 위 둘둘 말린 종이 차트, 찻잔, 안경. 조용한 장면.
```
A quiet desk with a rolled-up paper chart tied with string, a cup of tea and a pair of reading glasses, warm desk lamp light, cream wall behind, 4:3 composition, no text
```
대체 텍스트: ""

### 4-11. 오프라인 페이지 — 스팟 (순위 3)

파일 `offline-spot-480.webp`, `offline-spot-240.webp`.
한국어 요약: 실이 느슨하게 풀린 종이컵 전화기 두 개. 크림 바탕 스티커풍.
```
Sticker-style illustration of two paper cups connected by a loose, slack string (a tin-can telephone that has gone quiet), centered on a plain cream background, soft shadow, gentle humor, no text
```
대체 텍스트: ""

### 4-12. 공유 미리보기(OG) — 조립 (순위 4)

새로 그리지 않습니다. `assets/img/src/og.html` 을 탭별로 복사해 오른쪽 그림만 바꾸고 1200×630 으로 캡처합니다.

| 페이지 | 오른쪽 그림 | 왼쪽 문구 |
|---|---|---|
| 홈 | 계절 4:5 그림 | 지금과 같음(계절 문구) |
| 이용 안내 | 안내 배너(3:2 → 4:5 로 가운데 잘라 씀. 인물이 작아 잘려도 됨) | "이용 안내" · "처음 2주 동안 할 일, 닉네임 양식, 모임 참여와 정산" |
| 활동 통계 | 통계 스팟(큰 원) | "활동 통계" · "우리 방이 언제, 얼마나 이야기하는지" |
| 모임 정산·정산 확인 | 정산 스팟 | "모임 정산" · "차수별 1/N과 입금 확인 링크" |
| 소식 | 소식 스팟 | "소식" · "공지 · 모임 모집 · 후기 · 정보" |
| 맛집 | 맛집 배너(가운데 잘라 4:5) | "맛집" · "모임에서 다녀온 식당과 한줄평" |

## 5. 제작 순서

1. **가을 원본을 참고 이미지로 걸고** 순위 1의 8장(홈 6 + 배너 2)부터 뽑습니다. 자리당 3~4장 생성 → 글자·손·얼굴 결함 확인 → 1장 선택.
2. 원본을 `assets/img/src/` 에 넣고 알려 주시면, 웹용 크기(3:2 1440/720, 4:5 800/400, 1:1 480/240, 4:3 640/320)로 줄이고 WebP 로 저장해 자리를 붙입니다. 홈 그림 때 쓴 방법(크로미움 캔버스, 품질 0.8~0.82)을 그대로 씁니다.
3. 자리 붙이기는 페이지마다 `<img … onerror>` 한 덩어리입니다. 파일이 없거나 못 읽으면 자리가 접혀 빈 상자가 남지 않습니다. 붙인 뒤 390·768·1440 폭에서 잘림·밀림·대비를 검사합니다.
4. 순위 2·3은 있으면 붙이고, 없으면 지금처럼 아이콘과 글자만으로 둡니다. 순위 4의 OG 는 배너·스팟이 들어온 뒤 조립합니다.

## 6. 하지 않기로 한 것

- 실제 모임 사진, 멤버 얼굴 사진: 초상권과 방 분위기 문제. 일러스트만.
- 글자가 들어간 이미지(배너 위 문구, 포스터형): 글자는 HTML 로 얹는다. 이미지 안 글자는 깨지고 검색·접근성에서도 빠진다.
- 식당별 사진, 글별 사진: 첨부 기능이 없다. 생기면 `IMAGE_SPEC.md` 의 규격(목록 96×96, 상세 480×320)으로.
- 아이콘을 그림으로 바꾸기: 선 아이콘이 이미 통일돼 있고, 작은 크기에서는 일러스트보다 또렷하다.
- 섹션마다 장식 그림: 페이지가 무거워지고 숫자·글과 경쟁한다. 위 15곳 밖에는 두지 않는다.
