# 모임 모집 사진 3차 생성 프롬프트 (2026-11-08, 140차)

모임 모집 글의 사진(assets/bung, 800x400 와 작은 사진 180x180)을 늘리기 위한 프롬프트 모음입니다.
지금 사진 467장(음식과 술과 카페 86 종류, 활동과 장소 43 종류)과 같은 느낌의 실사 사진으로 만듭니다.

**141차(2026-11-08)에 46장을 모두 받아 넣었습니다.** 쓰는 낱말과 이름표는 assets/bung-photo.js 에 있고(6절은 넣은 그대로), 낱말을 고치면 `node tools/bung_photo_check.js` 로 확인합니다.

## 1. 왜 이 종류인가: 실제 모집 글 193개(2026-08-27 ~ 11-08)

| 본 것 | 결과 |
|---|---|
| 사진이 붙은 글 | 127개(66%), 제목이나 장소 낱말로 |
| 두루 쓰는 사진만 붙은 글 | 22개(11%), 카페, 식사, 술, 집, 한강, 공원 사진 |
| 사진 없이 달력으로 빠진 글 | 44개(23%) |
| 많이 쓰인 종류 | 포차 16, 카페 11, 쇼핑 8(대부분 잘못 붙음), 호프 7(편의점 모임), 삼겹살 6, 한우 5 |
| 시작 시각 | 저녁 6~9시 57, 밤 9~12시 52, 낮 11~6시 53, 새벽 0~5시 26(13%), 아침 5 |
| 요일 | 토 41, 금 31, 수 27, 목 27, 월 25, 일 24, 화 18 |

- **사진이 없는 종류**: 편의점 앞 테이블 모임 7개(지금은 호프와 야장 사진을 빌려 씀), 야구와 e스포츠 단체 관람 3개, 산오징어와 수산 횟집 7개.
- **사진이 너무 적은 종류**: 노래방 5개에 1장, 집 모임 10개 안팎에 6장(두루 쓰는 사진), 클라이밍 3개에 2장, 해장 3개에 2장, 반려견 동반 2개에 2장.
- **가장 많이 쓰는 종류**: 포차 16개에 8장이라 같은 사진이 자주 반복된다.
- **곧 올 계절**: 연말(사진 3장), 크리스마스 거리와 겨울 간식, 눈, 스케이트(사진 없음), 해돋이(1장).
- 달력으로 빠진 44개 가운데 많은 수는 사진은 있는데 제목과 장소에 낱말이 없던 글이다(노래연습장, 수산, 막회, 반점, 축산, 술상 같은 낱말). 쇼핑 8개는 대부분 가게 이름의 '어시장' 과 장소의 '코엑스' 때문에 잘못 붙었다. 이 낱말 규칙은 사진을 넣을 때 함께 고친다.

## 2. 만드는 법

1. ChatGPT(이미지)나 다른 생성 도구에 아래 칸을 하나씩 그대로 붙여 넣어 만든다. 칸마다 같은 꼬리 문구가 들어 있어 한 칸만 붙여도 된다.
2. 크기는 가로 1536x1024. 가운데 띠를 2:1(800x400)로 잘라 쓰므로 주인공은 가운데 높이에 둔다.
3. 다시 만들 것: 간판, 병, 화면, 포장에 글자나 로고가 생긴 사진, 얼굴이 또렷한 사진, 손가락이 어색한 사진.
4. 파일 이름은 칸 제목의 이름(conv-01 같은)으로 저장해 이 채팅에 파일로 보낸다. 이름이 없으면 보낸 순서대로 붙인다.
5. 받으면 2:1 로 잘라 assets/bung 과 assets/bung/t 에 넣고, 이름표와 낱말 규칙(assets/bung-photo.js)을 더한다.

**빼달라는 문구(네거티브를 받는 도구에서)**

```
illustration, cartoon, anime, 3D render, CGI look, text, letters, numbers, logo, brand label, signage text, watermark, close-up face, identifiable face, distorted hands, extra fingers, oversaturated, HDR look, fisheye, cluttered, low resolution
```

## 3. A. 운영에서 비어 있는 종류 (먼저)

### 편의점 앞 테이블 (편맥, 편소) 4장

**conv-01**
```
Night scene in front of a Korean convenience store on a quiet Gangnam side street: a white plastic patio table with a folded parasol, four friends sitting around it, beer cans and plain green glass soju bottles without labels, paper cups, open bags of chips and dried squid snacks, the store window glowing warm white behind them. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**conv-02**
```
Close-up of a plastic convenience store table at night: cold beer cans with condensation, steaming instant noodle cups, triangle rice balls and snack packets with blank packaging, two hands clinking cans, blurred street lights and a glowing store window in the background. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**conv-03**
```
Summer evening at a Korean convenience store terrace: green plastic chairs, a striped parasol, three friends laughing seen from behind, the store light spilling onto the sidewalk, a delivery motorbike parked nearby, warm humid atmosphere, beer and ice cream on the table. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**conv-04**
```
Very late night in a quiet alley: a small convenience store with a bright window, one outdoor table with empty cans and a half-finished snack, two friends in hoodies talking quietly, cool fluorescent light mixing with orange street lamps, calm 2 a.m. mood. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

### 노래방 4장 (지금 1장)

**karaoke-02**
```
Inside a Korean karaoke room (noraebang): a dim room lit by colorful rotating disco lights, a long leather sofa, a low table with two wireless microphones, a tambourine and a song book, a large wall screen showing an abstract colorful music video with no lyrics and no text. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**karaoke-03**
```
Friends singing in a noraebang seen from behind: one person standing with a microphone raised high, another shaking a tambourine, neon purple and blue lighting, drinks and a fruit plate on the table, energetic motion blur. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**karaoke-04**
```
Coin karaoke booth (coin noraebang): a small cozy soundproof booth with two stools, a microphone on a stand, neon pink light, headphones hanging on a hook, a glass door, clean and minimal, two friends squeezed in with a cup of soda. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**karaoke-05**
```
Large karaoke party room for a group: a wide U-shaped sofa, a mirrored disco ball, LED strip lights, beer and a fruit platter on the table, several friends clapping and cheering for the singer, warm party atmosphere. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

### 집 모임 4장 (지금 6장)

**home-07**
```
Apartment living room party on a weekend night: friends sitting on the floor around a low table covered with delivery fried chicken boxes, a pizza, beer cans and cola, blank packaging, a TV glowing in the background, cozy warm lamp light. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**home-08**
```
Korean housewarming gathering (jibdeuri) in a small new apartment: a bundle of toilet paper rolls and a laundry detergent box as gifts by the door, friends holding glasses in the bright living room, potted plants, afternoon sunlight through sheer curtains. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**home-09**
```
Home wine night: a wooden table with a cheese and charcuterie board, two wine bottles without labels, candles and fairy lights, friends' hands raising glasses in a toast, warm intimate light, a cozy apartment in the background. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**home-10**
```
A cat lounging on a sofa armrest watching friends play a board game on the living room floor, snacks and drinks around them, soft blankets, warm evening lamp light, relaxed cozy home gathering. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

### 포차 4장 (지금 8장, 가장 많이 쓰임)

**pocha-09**
```
Indoor Korean pojangmacha: a big pot of odeng-tang (fish cake soup with skewers) bubbling on a portable gas burner, steam rising, plain green soju bottles without labels and small glasses, orange tarp walls and warm bulbs, friends' arms reaching in with chopsticks. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**pocha-10**
```
Orange tent pojangmacha on a street at night seen from outside through clear plastic curtains with raindrops, silhouettes of friends drinking inside, red plastic stools, glowing warm interior, wet asphalt reflecting the light. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**pocha-11**
```
Pocha table close-up: golbaengi-muchim (spicy sea snail salad with thin noodles), a thick gyeran-mari rolled omelette, a bowl of fish cake soup, soju glasses on a stainless steel table, warm light, hands with chopsticks. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**pocha-12**
```
Crowded retro-style pocha around 11 p.m.: warm neon lights, blank menu boards on the wall, long shared tables, friends toasting with soju seen from behind, lively noisy atmosphere, steam from hot dishes. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

### 경기 단체 관람 3장 (야구, e스포츠, 축구)

**viewing-01**
```
Sports pub in Seoul at night: a large projection screen showing a baseball game from a distance with no scoreboard text and no team logos, friends with beer glasses jumping up and cheering seen from behind, fried chicken on the table. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**viewing-02**
```
Late-night esports viewing party in a cozy bar: a big screen showing an abstract fantasy battle scene with glowing effects and no interface text, friends in hoodies cheering with raised fists, a dark room lit by the screen, beers on the table. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**viewing-03**
```
Soccer match viewing at a pub: a wide shot of a bar with a big screen showing a green pitch, people in plain red shirts without logos or numbers raising beer glasses, excited crowd seen from behind, warm bar lights. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

### 산오징어와 수산 횟집 4장

**squid-01**
```
Korean live squid restaurant: a plate of freshly sliced squid sashimi (ojingeo-hoe) with sesame leaves, sliced garlic and gochujang dipping sauce, soju glasses on a wooden table, an aquarium tank with live squid glowing blue in the background. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**squid-02**
```
Seafood pub table with grilled whole squid, spicy squid stir-fry and a bubbling seafood stew, friends' chopsticks reaching in, plain green soju bottles without labels, warm cozy evening light. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**fishmarket-01**
```
Korean sashimi restaurant (hoe-jip): rows of glowing seawater tanks with flatfish and rockfish by the entrance, a large platter of assorted sliced raw fish on ice with lettuce and green chili on the table, friends sitting at a long table. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**fishmarket-02**
```
Rustic seafood pub late at night: a big stainless bowl of makhoe (roughly sliced raw fish) mixed with shredded vegetables and sweet spicy sauce, side dishes, soju bottles without labels, friends' hands mixing with chopsticks, lively mood. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

## 4. B. 겨울과 연말 (다음 달부터 쓰임)

### 연말 송년회 3장 (지금 3장)

**yearend-04**
```
Korean year-end party (songnyeonhoe) in a restaurant private room: a long table with grilled food and side dishes, friends raising glasses in a toast, gold tinsel and warm string lights, joyful December atmosphere. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**yearend-05**
```
Christmas home party: a small decorated tree with warm lights, wrapped gifts underneath, a table with roast chicken, a cake and wine, friends in winter sweaters exchanging gifts, cozy apartment. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**yearend-06**
```
Party room celebration: balloons, a round neon light ring without letters, confetti in the air, friends in party hats seen from behind, a cake with sparklers on the table, festive purple and gold light. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

### 크리스마스 거리 2장

**xmas-01**
```
Christmas illumination street in Seoul at night: a tunnel of warm golden fairy lights over a pedestrian street, friends in winter coats walking away from the camera, breath visible in the cold air, soft bokeh. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**xmas-02**
```
Outdoor Christmas market in a city plaza at night: wooden stalls with warm lights, hot drinks in paper cups, a giant decorated tree, friends browsing ornaments seen from behind, gentle snow. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

### 겨울 길거리 간식 2장

**snack-01**
```
Winter street food stall at night: golden bungeoppang (fish-shaped pastries) baking in a cast iron mold, steam rising, a gloved hand holding a paper bag of warm pastries, warm stall light against the cold blue street. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**snack-02**
```
Hotteok sweet pancakes sizzling on a street griddle, paper cups of hot fish cake broth, friends in padded jackets eating outdoors on a winter evening, steam and warm light. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

### 해돋이 2장 (지금 1장)

**sunrise-03**
```
New Year sunrise on an East Sea beach in Gangwon: a crowd seen from behind as silhouettes facing the sun rising over the ocean, winter jackets, golden sky and calm waves. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**sunrise-04**
```
Sunrise from a mountain summit: friends in hiking gear standing on rocks with arms raised seen from behind, a sea of clouds below, orange dawn light over distant ridges. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

### 눈 오는 날 2장

**snow-01**
```
Snowy night in a quiet Seoul neighborhood: friends with umbrellas walking under warm street lights, snowflakes falling, footprints on fresh snow, calm and romantic. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**snow-02**
```
Snow-covered park path in the morning: bare trees, a bench covered with snow, friends building a small snowman, soft blue winter light, playful mood. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

### 아이스링크 1장

**skate-01**
```
Outdoor ice skating rink in a city plaza at night: friends skating hand in hand seen from behind, string lights overhead, a big decorated tree nearby, glowing ice reflections. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

## 5. C. 장 수가 적은 종류 늘리기

### 클라이밍 2장 (지금 2장)

**climbing-03**
```
Indoor bouldering gym: a climber seen from behind reaching for a colorful hold on a steep wall, chalk dust in the air, bright clean lighting, other climbers resting below. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**climbing-04**
```
Friends sitting on a thick crash pad at a bouldering gym with chalk bags, watching and cheering one friend on the wall, colorful holds everywhere, relaxed weekend afternoon. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

### 해장 2장 (지금 2장, 새벽 모임이 13%)

**haejang-03**
```
Kongnamul-gukbap (bean sprout soup with rice) bubbling in an earthenware pot at a 24-hour restaurant at dawn, a raw egg and kimchi on the side, steam rising, early blue light through the window. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**haejang-04**
```
Sundae-gukbap (pork soup with Korean blood sausage) with side dishes on a stainless steel table, chopped scallions, a hand adding salted shrimp, quiet morning-after atmosphere in a small restaurant. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

### 반려견 동반 2장 (지금 개 1장, 고양이 1장)

**pet-03**
```
Dog-friendly cafe: a small fluffy dog sitting on a chair at the table between two friends with lattes, warm wooden interior, afternoon light, the dog looking at a treat. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**pet-04**
```
Friends walking a dog in a Seoul park in late autumn: fallen yellow leaves, the dog wearing a small scarf, friends seen from behind holding coffee cups, soft golden afternoon light. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

### 러닝 대회와 단체 러닝 2장

**running-04**
```
Charity fun run in a Seoul park in the morning: runners with blank race bibs at the start line under an inflatable arch with no text, colorful t-shirts, friends stretching together seen from behind, fresh morning light. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**running-05**
```
Group night run along the Han River: runners in reflective gear jogging on the riverside path, bridge and city lights reflecting on the water, slight motion blur, energetic but calm. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

### 축제와 박람회 3장

**beerfest-01**
```
Indoor craft beer festival in a large convention hall: rows of booths with beer taps and no logos, people holding plastic cups of beer, warm lights, a lively crowd seen from behind, friends toasting in the middle. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**expo-01**
```
Pet fair in a large exhibition hall: people walking with small dogs and cats in strollers, booths with pet supplies and no signage text, bright hall lights, friends crouching to greet a puppy. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

**expo-02**
```
Weekend dessert and bakery fair in a big exhibition hall: colorful booths with cakes, cookies and bread on display, crowds with tote bags, friends sharing a sample seen from behind, bright cheerful light. Photorealistic candid lifestyle photo in Seoul, South Korea, warm natural light, 35mm lens, shallow depth of field, realistic colors. Landscape 3:2, 1536x1024, main subject in the middle band so a 2:1 center crop keeps it. Korean adults in their late 20s to 30s seen from behind or the side, faces not clearly visible. No text, no letters, no numbers, no logos, no brand labels, no watermark.
```

## 6. 넣은 이름표와 낱말 (141차)

| 이름 | 이름표 | 붙인 낱말(예) |
|---|---|---|
| conv | 편의점 | 편맥, 편소, 편쏘, 편벙, 편편, 편의점, CU, GS25, 세븐일레븐 |
| karaoke | 노래방 | 노래방, 노래연습장, 래방, 놀애방, 코노, 준코 |
| home | 집 | 집벙, 홈파티, 집들이, 자취방, 🏠, 장소 칸이 집 주소(202호) |
| pocha | 포차 | 포차, 포장마차, 오뎅, 오탕, 어묵탕, 골뱅이 |
| viewing | 경기 관람 | 뷰잉, 플옵, 와일드카드, 결승, 경기 보면서(뒤에 직관이 있으면 야구장). 롤드컵과 티원은 e스포츠 사진, 축구와 국대는 축구 사진 |
| squid | 오징어 | 오징어, 산오징어 |
| fishmarket | 횟집 | 어시장, 수산, 막회, 양어장, 회센터(회, 광어, 횟집은 전의 회 사진) |
| yearend | 연말 파티 | 연말, 송년, 신년회, 크리스마스 |
| xmas | 크리스마스 거리 | 일루미네이션, 빛축제, 크리스마스 마켓, 트리 점등, 미디어파사드 |
| snack | 겨울 간식 | 붕어빵, 잉어빵, 호떡, 군고구마, 군밤, 호빵 |
| sunrise | 일출 | 일출, 해돋이, 해맞이 |
| snow | 눈 오는 날 | 첫눈, 함박눈, 눈사람, 눈 오는 날(두루 쓰는 말이라 다른 낱말이 먼저) |
| skate | 스케이트 | 스케이트, 아이스링크, 빙상장 |
| climbing | 클라이밍 | 클라이밍, 더클라임, 볼더링, 돌잡이 |
| haejang | 해장국 | 해장(음식 이름보다 아래), 콩나물국밥, 황태, 북엇국, 선지 |
| pet | 반려동물 | 강아지, 애견, 반려견, 🐶 |
| running | 러닝 | 러닝, 마라톤, 낱말 하나인 런(기부런, 푸르메런) |
| beerfest | 맥주 축제 | 비어페스트, 맥주 축제, 옥토버페스트 |
| expo | 박람회 | 펫쇼, 캣쇼, 애견 박람회(반려동물 사진), 박람회, 엑스포, 페어, 페스타, 카페쇼 |
