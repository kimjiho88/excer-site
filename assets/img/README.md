# assets/img — 사이트 그림

여기에 넣을 파일과 쓰이는 자리. 경로와 용도는 `assets/images.js` 한 곳에서 관리한다.

| 파일 | 자리 | 비율 | 대체 텍스트 |
|---|---|---|---|
| `neighborhood-hero.webp` | 홈 대표 영역 오른쪽 | 4:3 | 동네 풍경 (정보 그림, alt 있음) |
| `activity-dining.webp` | 홈 활동 소개 · 식사 | 4:3 | 장식 (alt 비움) |
| `activity-walking.webp` | 홈 활동 소개 · 산책 | 4:3 | 장식 |
| `activity-culture.webp` | 홈 활동 소개 · 전시·문화 | 4:3 | 장식 |
| `activity-boardgame.webp` | 홈 활동 소개 · 보드게임 | 4:3 | 장식 |

파일을 넣은 뒤 `assets/images.js` 에서 해당 항목의 `ready: false` 를 `true` 로 바꾸면 화면에 나온다.
`ready: false` 인 동안은 파일을 요청하지 않으므로 깨진 그림이나 404 가 생기지 않는다.

권장: 가로 1200px 이상, webp, 장당 300KB 이하. 글자나 버튼은 그림 안에 넣지 않는다(HTML 로 얹는다).
