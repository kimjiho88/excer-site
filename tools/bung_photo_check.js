/* 벙 사진 규칙 점검(assets/bung-photo.js). 실행: node tools/bung_photo_check.js
   1) 규칙에 적힌 사진마다 큰 사진(assets/bung)과 작은 사진(assets/bung/t)이 있고 이름표가 있는지
   2) 낱말 함정: 가게 이름이나 다른 낱말 속의 짧은 낱말(에스프레소바의 소바, 어시장의 시장, 이런의 런)이
      엉뚱한 사진을 고르지 않는지. 예시 글은 지어낸 것이고, 글 번호를 바꿔 가며 돌려 사진 순서와 상관없이 본다.
   문제가 있으면 줄마다 적고 1 로 끝난다 */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "assets/bung-photo.js"), "utf8"), ctx);
const B = ctx.window.BUNGPHOTO;
const bad = [];

const names = new Set();
B.RULES.forEach((r) => r[1].forEach((n) => names.add(n)));
for (const n of names) {
  if (!fs.existsSync(path.join(ROOT, "assets/bung", n + ".jpg"))) bad.push("큰 사진 없음: " + n);
  if (!fs.existsSync(path.join(ROOT, "assets/bung/t", n + ".jpg"))) bad.push("작은 사진 없음: " + n);
  if (!B.label(n)) bad.push("이름표 없음: " + n);
}

/* [제목, 장소, 본문, 기대 종류(여럿이면 배열, '' 는 달력 그림)] */
const CASES = [
  ["커피와 담소", "OO에스프레소바 역삼점", "", "cafe"],
  ["나무라지마라", "이자카야 OO", "", "izakaya"],
  ["마라탕 먹자", "", "", "mala"],
  ["마라톤 연습", "", "", ["running", "sport"]],
  ["카페 반찬 증정식", "OO커피", "", "cafe"],
  ["점심 정식", "", "", "hansik"],
  ["정식 모임 공지", "", "", ""],
  ["속초 어시장", "", "", "fishmarket"],
  ["", "OO수산 강남점", "", "fishmarket"],
  ["", "OO막회", "", "fishmarket"],
  ["동대문 시장 구경", "", "", "shopping"],
  ["", "속초오징어어시장 역삼점", "", "squid"],
  ["", "OO 산오징어", "", "squid"],
  ["가게 이름이 소풍나온오징어", "", "", "squid"],
  ["한강 소풍", "", "", ["picnic", "river"]],
  ["포트럭벙", "", "", ["picnic", "river"]],
  ["문화의날 영화", "메가박스 코엑스", "", ["cinema", "movie"]],
  ["코엑스 커피", "OO 코엑스몰점", "", "cafe"],
  ["비어 페스트 코엑스", "코엑스", "", "beerfest"],
  ["뷰티 페스타", "OO디자인플라자", "", "expo"],
  ["캣쇼 보러", "", "", "expo"],
  ["와인 페어링", "", "", "winebar"],
  ["단편소설 읽기", "", "", ""],
  ["편편쏘", "", "", "conv"],
  ["주말 한잔", "CU 역삼점", "", "conv"],
  ["야장", "CU 역삼점", "", "yajang"],
  ["이런 날엔 한잔", "", "", "soju"],
  ["두런두런 수다", "", "", "cafe"],
  ["홈런 치러", "", "", ""],
  ["기부런 같이 뛰어요", "", "", ["running", "sport"]],
  ["새벽 런 가요", "", "", ["running", "sport"]],
  ["런치 오마카세", "", "", "sushi"],
  ["브런치", "", "", "brunch"],
  ["차돌짬뽕 해장하러", "", "", "jungsik"],
  ["해장 파스타", "", "", "pasta"],
  ["바지락 칼국수(해장)", "", "", "kalguksu"],
  ["아침 해장", "OO감자탕", "", "haejang"],
  ["콩나물국밥", "", "", "haejang"],
  ["순대국밥", "", "", "gukbap"],
  ["떡볶이랑 어묵", "", "", "tteokbokki"],
  ["", "OO오뎅", "", "pocha"],
  ["오탕이벙", "", "", "pocha"],
  ["", "OO반점", "", "jungsik"],
  ["", "OO축산", "", ["samgyeopsal", "hanwoo"]],
  ["", "OO도야지", "", "samgyeopsal"],
  ["", "OO돈가스", "", "donkatsu"],
  ["쭉꾸미", "", "", "nakji"],
  ["닭강정", "", "", "chicken"],
  ["래방 가자", "", "", "karaoke"],
  ["", "OO노래연습장", "", "karaoke"],
  ["플옵 3차전 보는 벙", "OO축산", "", "viewing"],
  ["플옵 직관 가실분", "", "", "baseball"],
  ["롤드컵 결승 뷰잉", "", "", "viewing"],
  ["축구 국대 경기 보면서 치맥", "", "", "viewing"],
  ["풋살 하실분", "", "", "futsal"],
  ["마라톤 결승선", "", "", ["running", "sport"]],
  ["붕어빵 사러", "", "", "snack"],
  ["소금빵 맛집", "", "", "bakery"],
  ["첫눈 오는 날 산책", "", "", "snow"],
  ["눈 오는 날 막걸리", "", "", "makgeolli"],
  ["아이스링크 가실분", "", "", "skate"],
  ["크리스마스 마켓", "", "", "xmas"],
  ["크리스마스 파티", "OO파티룸", "", "yearend"],
  ["새해 해돋이", "", "", "sunrise"],
  ["", "OO빌 202호", "", "home"],
  ["", "OO 12호점", "", ""],
  ["2호선 타고 가요", "", "", ""],
  ["", "더클라임 OO", "", "climbing"],
  ["커피 & 🐶", "OO커피", "", "pet"],
  ["오늘도 낮술", "", "", "soju"],
  ["술먹을사람", "", "", "soju"],
  ["", "OO술상", "", "soju"],
  ["벙", "", "마라탕 먹고 2차 노래방", "mala"],
  ["파티원 모집", "", "", ""],
  ["롤 경기 하실분", "", "", ""],
  ["축구 경기 하실분", "", "", "futsal"],
  ["풋살 대회 결승", "", "", "futsal"],
  ["스크린골프 페어웨이", "", "", "golf"],
  ["카페 쇼핑", "", "", "shopping"],
  ["크리스마스 트리 앞 홈파티", "", "", "yearend"],
  ["노량진 컵밥", "", "", "dinner"],
  ["역삼 모임", "OO 역삼점", "[지도] 서울 강남구 OO로 1층 101호", ""],
];
for (const [title, place, body, want] of CASES) {
  const allow = [].concat(want);
  const got = new Set();
  for (let id = 0; id < 12; id++) got.add(B.kindOf(B.name({ id, title, body }, { place })));
  const wrong = [...got].filter((k) => !allow.includes(k));
  if (wrong.length) bad.push(`낱말: "${title}" "${place}"${body ? ` "${body}"` : ""} 은 ${wrong.map((k) => k || "달력").join(", ")} (기대 ${allow.map((k) => k || "달력").join(", ")})`);
}

console.log(`규칙 ${B.RULES.length}줄, 사진 ${names.size}장, 낱말 예시 ${CASES.length}개`);
if (bad.length) {
  bad.forEach((s) => console.log("X " + s));
  process.exit(1);
}
console.log("문제 없음");
