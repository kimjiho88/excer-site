/* ============================================================
   ops-lang.js : 채팅 언어 점검(운영 대시보드 전용)
   ------------------------------------------------------------
   운영 기준 공지(욕설, 비속어, 막말. 습관적인 욕설과 추임새, 초성 욕설도 같게)를 대화 파일에서
   같은 잣대로 세기 위한 단어 목록과 검사기다. ops-analyzer.js(워커)가 글 메시지마다 scan 을 부르고,
   ops.html 은 목록을 보여 주고 켜고 끄는 데 쓴다. 시험은 node 에서 바로 부른다.

   원칙
   - 걸린 줄은 '목록에 있는 말이 나왔다'는 사실만 적는다. 판단은 운영자가 발췌를 보고 한다.
   - 종류는 다섯: 욕설(curse), 막말(rude), 비속어(slang), 초성 욕설(jamo), 추임새(filler).
     한 메시지는 한 건으로 세고, 종류는 걸린 말 가운데 가장 센 것(위 순서)으로 둔다.
   - 항목마다 켜고 끌 수 있고(def 가 false 인 항목은 운영자가 켤 때만), 말을 더하거나(add)
     걸려도 세지 않을 말(allow, 걸린 글자 그대로)을 둘 수 있다.
   - 변형: 사이에 낀 기호와 숫자(시1발, 씨@발)는 빼고도 본다(압축 글). 띄어쓰기는 가르지 않는다
     ('역시 발이' 가 '시발'로 걸리지 않게).
   - 초성은 자모가 이어진 묶음 안에서만 본다. 앞뒤의 ㅋㅎㅠ 같은 소리는 떼고, ㅇㅈ ㄹㅇ 같은 흔한 말은 뺀다.
   - 거짓 양성 함정(개인, 개발, 소개, 시발점, 질병신고, 읽씹, 새끼손가락, 시바견, 한남동, 등신대,
     이년 동안, 조직 개편하고)은 항목마다 앞뒤 문맥으로 뺀다. 시험(test_lang.js)이 지킨다.
   ============================================================ */
(function (global) {
  "use strict";
  var VERSION = "2026-10-30";
  var CATS = [
    { k: "curse", t: "욕설" },
    { k: "rude", t: "막말" },
    { k: "slang", t: "비속어" },
    { k: "jamo", t: "초성 욕설" },
    { k: "filler", t: "추임새" }
  ];
  var RANK = { curse: 0, rude: 1, slang: 2, jamo: 3, filler: 4 };
  var CAT_T = {}; CATS.forEach(function (c) { CAT_T[c.k] = c.t; });

  /* 동물과 먹을거리 뒤의 '새끼', '대가리'는 말 그대로다 */
  var ANIMALS = "(?:강아지|고양이|병아리|송아지|망아지|오리|토끼|돼지|염소|호랑이|사자|곰|여우|늑대|고래|원숭이|닭|쥐|개구리|참새|비둘기|동물|짐승|새|고슴도치|햄스터|거북이|물고기|판다|코끼리|기린|사슴|노루|멧돼지|길냥이|냥이|댕댕이|댕댕|멍멍이|강쥐|고냥이|앵무새|두더지|다람쥐|너구리|수달|물범|펭귄|악어|뱀|거미|벌레|고등어|갈치|새우|게|꽃게)";
  var FOODS = "(?:새우|콩나물|생선|멸치|고등어|갈치|오징어|문어|낙지|닭|오리|돼지|소|게|꽃게|대게|킹크랩|조기|명태|대구|북어|황태|연어|참치|전어|방어|우럭|광어|도미|장어|붕어|잉어|물고기|나물|무|배추|파|마늘|돔|꽁치|삼치|가자미|아귀|홍어|가오리|쭈꾸미|주꾸미|한치|성게|해삼|멍게|굴|전복|소라|골뱅이|꼬막|홍합|바지락|조개|가재|랍스터)";

  /* 항목. id 는 바뀌지 않는다(끈 목록과 저장한 줄이 이 id 를 쓴다).
     k 종류, t 목록에 보이는 이름, re 정규식 본문(괄호는 (?:) 로), b 앞 경계(true: 한글 뒤가 아님, "latin": 영문과 숫자 뒤가 아님),
     e 뒤 경계(true: 한글 앞이 아님, "latin": 영문과 숫자 앞이 아님), c 압축 글(기호와 숫자를 뺀 글)에서도 찾음,
     x 앞뒤 문맥으로 빼기(pre 는 앞 10자에 $, post 는 뒤 8자에 ^), def false 는 기본으로 꺼 둠 */
  var ENTRIES = [
    /* 욕설 */
    /* 시발점, 시발역은 말 그대로. 출시발표, 도시발전, 즉시발송처럼 'X시'와 '발X'가 붙은 꼴은 앞뒤가 모두 맞을 때만 뺀다 */
    { id: "c_sibal", k: "curse", t: "시발(씨발, 씨팔, 쓰발, 시벌 등)", re: "(?:시|씨|쉬|쓰|씌|쒸|쉽|ㅆ)(?:발|벌|빨|팔)|(?:씨|쒸|쓰|쉬)불", c: true, x: { post: /^(?:점|역|택시|지점)/, both: { pre: /(?:역|다|도|출|검|감|제|표|게|실|지|투|응|전|명|적|즉|상|항|수|동|과|묵|개|행|무|수|임|반|실|월|당|매|순|잠|주|조|공|참|기|국)$/, post: /^(?:송|표|전|생|견|매|급|행|신|달|음|효|명|굴|사|족|끝|령|진|권|판|제|간|주|휘|의|상|현|열|자|병|표|부|산|열|동|탁|화|언|성|신|휘|단|견|광|돋|톱|가|끈|목|등|바닥|가락)/ } } },
    { id: "c_siba", k: "curse", t: "씨바(씨빠, 시빠)", re: "(?:씨바|씨빠|시빠)(?![가-힣])|(?:시|씨)바아+", c: true },
    { id: "c_sibul", k: "curse", t: "씨부럴(씨부랄)", re: "(?:씨|시)(?:부럴|부랄|부렁|부레|부랑|불럼|불년|발놈|발년|발럼|발넘|발것)", c: true },
    { id: "c_sibang", k: "curse", t: "씨방새", re: "(?:시|씨)방(?:새|놈|년|것)", c: true },
    /* 질병신고, 간병신청처럼 'X병'과 '신X'가 붙은 꼴은 앞뒤가 모두 맞을 때만 뺀다 */
    { id: "c_byungsin", k: "curse", t: "병신(븅신, 빙신)", re: "(?:병|븅|빙|뱅)(?:신|쉰)|븅딱|병딱", c: true, x: { both: { pre: /[가-힣]$/, post: /^(?:고|청|속|규|분|경|용|입|체|호|화|제|설|원|택|곡|시|하|대|기|상|문|생|년도)/ } } },
    { id: "c_jiral", k: "curse", t: "지랄(지럴, 찌랄)", re: "(?:지|찌)(?:랄|럴|롤)|지뢀", c: true },
    { id: "c_jot", k: "curse", t: "좆(좇, 좃같, 조까)", re: "좆|좇|좃(?:같|나|밥|까|도|만|빠|이|됐|됨|바)|조까(?!지)|좃까|조까튼|좇까", c: true },
    { id: "c_ssib", k: "curse", t: "씹(씹새, 씹년, 씹창 등)", re: "씹(?:새|년|놈|창|덕|질|팔|할|쌔|빨|선비|자식|탱|노|쓰|보|치)" },
    /* 이, 저, 그, 요 뒤의 새끼는 그 앞이 한글이 아닐 때만(고양이 새끼의 '이 새끼'가 걸리지 않게). 걸린 글자 앞의 빈칸은 scan 이 뗀다 */
    { id: "c_saekki", k: "curse", t: "개새끼(이 새끼, 미친 새끼 등)", re: "(?:(?:개|미친|씨발|시발|병신|좆|좇|썅|쌍|쓰레기|느그|느금|똥|개돼지|망할|죽일|나쁜|못된)|(?:^|[^가-힣])(?:이|저|그|요|니))\\s?(?:새끼|새키|쉐끼|쉑기|색기|색히|새꺄|쌔끼|쌔키|섀끼|새뀌|쌕끼|새끠|쉐이|새갸)|(?:개|미친|씨발|병신)\\s?세끼|개새(?![가-힣])|개새야|개쉐이|개쉑" },
    { id: "c_ssang", k: "curse", t: "썅(쌍년, 쌍놈)", re: "썅|쌍(?:년|놈|욕|것|노무|뇬|넘)", c: true },
    { id: "c_yeombyung", k: "curse", t: "염병(엠병, 옘병)", re: "염병|엠병|옘병|앰병|옘뷩|얨병", c: true },
    { id: "c_nimi", k: "curse", t: "니미(니기미, 느금, 니애미)", re: "니미(?!지)", b: true },
    { id: "c_nimi2", k: "curse", t: "니미럴(느금마, 애미없냐 등)", re: "니미럴|니기미|니미랄|니애미|니에미|니앰|느금|느그엄|느개비|애미없|애미뒤|에미없|엠창|엄창|앰창|니애비|느그애비|니엄마|니애비", c: true },
    { id: "c_horo", k: "curse", t: "호로새끼(후레자식)", re: "호로(?:새끼|자식|놈|년|쉑|쌔끼|새키)|후레(?:자식|새끼|놈|아들)", c: true },
    { id: "c_changnyeo", k: "curse", t: "창녀(걸레년)", re: "창녀|창년|걸레년|걸레같은년", c: true },
    { id: "c_michin_n", k: "curse", t: "미친놈(미친년, 미친새끼)", re: "미친\\s?(?:놈|년|새끼|넘|련|뇬|새|쉐|놈아|년아)" },
    { id: "c_gae_n", k: "curse", t: "개년(개놈, 개자식, 개지랄)", re: "개(?:년|놈|자식|지랄|쌍년|쌍놈|썅|놈아|년아)", x: { pre: /(?:[0-9]|일|이|삼|사|오|육|칠|팔|구|십|수|몇|한|두|세|네)$/ } },
    { id: "c_keyboard", k: "curse", t: "영문 자판 변형(tlqkf, qudtls, wlfkf 등)", re: "tlqkf|tlqk(?![a-z])|qudtls|wlfkf|rotorl|alcls|sibal|ssibal|shibal|si8al|ssi8al|sival", b: "latin" },
    { id: "c_c8", k: "curse", t: "c8(씨8, 18놈)", re: "c8(?![a-z0-9])|(?:시|씨|ㅆ|ㅅ)8(?![0-9])|18(?:놈|넘|년|새끼|새키)|십팔(?:놈|년|새끼)", b: "latin" },
    /* 막말 */
    { id: "r_finger", k: "rude", t: "가운뎃손가락 이모지", re: "\\uD83D\\uDD95" },
    { id: "r_dakcho", k: "rude", t: "닥쳐(닥치라, 입 다물어)", re: "닥쳐|닥치(?:라|고|세요|셈|쇼|라고|지|삼|시지|시죠)|입\\s?닥|입\\s?다물|아가리\\s?닥" },
    { id: "r_kkeojyeo", k: "rude", t: "꺼져(꺼지라)", re: "꺼져(?!\\s?(?:있|서|버|가지|요|도|가요|가는|간|갈|도록|라고\\s?(?:해|하)|주))|꺼지(?:라|세요|고|셈|쇼|든가|라고|지)", x: { pre: /(?:불|전원|화면|폰|핸드폰|티비|tv|컴퓨터|컴|시동|엔진|앱|알림|소리|촛불|등|불이|전원이|화면이|폰이|티비가|tv가|컴이|시동이|엔진이|앱이|알림이|소리가|촛불이|등이|불은|불도|불까지|저절로|갑자기|자꾸|계속|불빛이|조명이|조명|전기가|전기|가스가|가스|히터가|히터|보일러가|보일러|에어컨이|에어컨)\s?$/i } },
    { id: "r_dwijyeo", k: "rude", t: "뒤져라(뒤질래, 뒈져)", re: "뒤져(?:라|버려|버리|야)|뒈져|뒈지|디져(?:라|버)|뒤질(?:래|놈|년|거)|디질(?:래|놈)|뒤진다|디진다" },
    { id: "r_jugeo", k: "rude", t: "죽어버려(죽을래, 죽여버려)", re: "죽어버려|죽어버리|죽여버|죽을래|죽고\\s?싶냐|죽고\\s?싶어서\\s?환장|쳐죽|패죽|맞아\\s?죽|뒤지고\\s?싶" },
    { id: "r_majeul", k: "rude", t: "맞을래(쳐맞, 패버려)", re: "맞을래|쳐맞|처맞|패버|패줄|때려버|때려줄|주먹\\s?맛|한\\s?대\\s?맞|처발|쳐발" },
    { id: "r_yeot", k: "rude", t: "엿 먹어", re: "엿\\s?먹|엿이나|엿을\\s?먹" },
    { id: "r_chomok", k: "rude", t: "처먹(쳐먹, 처마시)", re: "처먹|쳐먹|처드시|처마시|쳐마시|처웃|쳐웃|처박|쳐박|처넣|쳐넣|처자빠|쳐자빠|처잤|쳐잤|처자고|쳐자고" },
    { id: "r_jikkeol", k: "rude", t: "지껄여", re: "지껄" },
    { id: "r_kkolgap", k: "rude", t: "꼴값(꼬라지, 꼬락서니)", re: "꼴값|꼬라지|꼬락서니|꼬라질" },
    { id: "r_ssagaji", k: "rude", t: "싸가지", re: "싸가지|싹아지" },
    { id: "r_daegari", k: "rude", t: "대가리(아가리, 주둥이)", re: "대가리|대갈통|대갈빡|아가리|아갈|주둥이|주둥아리", x: { pre: new RegExp(FOODS + "\\s?(?:의|는|은|도|만)?\\s?$") } },
    { id: "r_jaesu", k: "rude", t: "재수 없어(밥맛이야)", re: "재수\\s?없|재수\\s?가\\s?없|밥맛이야|밥맛\\s?없는\\s?(?:놈|년|새끼|인간)" },
    { id: "r_eojjeo", k: "rude", t: "어쩌라고", re: "어쩌라고|어쩌라구|어쩌라는|어쩌라는데" },
    { id: "r_mworae", k: "rude", t: "뭐래(뭐라니)", re: "뭐래(?![가-힣])|뭐라니|뭐라냐", def: false },
    { id: "r_nega", k: "rude", t: "니가 뭔데(너나 잘해, 주제 파악)", re: "너나\\s?잘\\s?해|너나\\s?잘하|니가\\s?뭔데|네가\\s?뭔데|너가\\s?뭔데|니까짓|네까짓|주제도\\s?모르|주제\\s?파악\\s?(?:좀|을|해|하|부터)" },
    /* 비속어 */
    { id: "s_michin", k: "slang", t: "미친(미쳤다, 미쳐)", re: "미친|미쳤|미쳐|미칠|미침|미치겠", x: { pre: /이$/ } },
    { id: "s_ttorai", k: "slang", t: "또라이(돌아이, 똘끼)", re: "또라이|똘아이|돌아이|똘끼" },
    { id: "s_deungsin", k: "slang", t: "등신(머저리, 얼간이, 쪼다)", re: "등신|머저리|얼간이|쪼다", x: { post: /^(?:대|불|상)/ } },
    { id: "s_meongcheong", k: "slang", t: "멍청이(멍청아, 돌대가리)", re: "멍청(?:이|아|한\\s?놈|한\\s?년|한\\s?새끼|한놈|한년)|돌대가리|빡대가리|무뇌" },
    { id: "s_jjinda", k: "slang", t: "찐따(찌질이)", re: "찐따|찌질|찌찔" },
    { id: "s_kkondae", k: "slang", t: "꼰대(틀딱, 개저씨)", re: "꼰대|틀딱|개저씨|노친네" },
    { id: "s_hate", k: "slang", t: "한남(김치녀, 맘충, 급식충)", re: "한남(?!동|대교|오거리|역|더힐|힐|자)|김치녀|된장녀|맘충|급식충|진지충|설명충|틀딱충|한녀|페미(?:년|충|나치)|꼴페미|메갈" },
    { id: "s_geolle", k: "slang", t: "걸레(변태, 호구)", re: "걸레(?:같|년|짓|야)|변태(?:야|새끼|같|냐|들|아저씨)|호구(?:냐|잡|새끼|야|들|네)" },
    { id: "s_gae", k: "slang", t: "개소리(개판, 개같다)", re: "개소리|개판(?!매)|개수작|개같(?:은|다|이|네|아|애)|개꼴|개뿔|개망신|개짓|개버릇|개무시|개드립|개같" },
    { id: "s_saekki", k: "slang", t: "새끼(앞말 없이)", re: "(?:새끼|새꺄|쉐끼|색기|쌔끼|새키)(?!손|발|줄|리|를\\s?낳|가\\s?태어|치|고양이|강아지|오리|들이\\s?태어)", x: { pre: new RegExp(ANIMALS + "\\s?(?:의|가|는|은|도|들|들이|들은|들의)?\\s?$") } },
    { id: "s_nyeon", k: "slang", t: "년(이년, 저년, 그년)", re: "(?:(?:미친|썅|쌍|씨발|시발|망할|염병할|죽일|나쁜|못된)|(?:^|[^가-힣])(?:이|저|그|요))\\s?(?:년|뇬|련)(?![가-힣])", x: { post: /^\s?(?:동안|간|전|뒤|째|차|이상|넘|가까이|정도|만에|후|사이|반|쯤|여|이내|안|연속|치|분|마다|넘게|남짓)/ } },
    { id: "s_nom", k: "slang", t: "놈(이놈, 저놈)", re: "(?:(?:미친|썅|쌍|씨발|시발|망할|염병할|죽일|나쁜|못된)|(?:^|[^가-힣])(?:이|저|그|요))\\s?(?:놈|넘|눔)(?![가-힣])", def: false },
    { id: "s_babo", k: "slang", t: "바보(바보야)", re: "바보(?:야|새끼|같은|냐|냐고|들|놈|년)", def: false },
    { id: "s_hansim", k: "slang", t: "한심", re: "한심", def: false },
    { id: "s_sseuregi", k: "slang", t: "쓰레기 같은 놈(인간 쓰레기)", re: "쓰레기\\s?(?:같은|새끼|놈|년|자식|들|네|야)|인간\\s?쓰레기|쓰렉" },
    { id: "s_geukhyeom", k: "slang", t: "극혐(혐오스럽다)", re: "극혐|혐오스|혐짤" },
    { id: "s_nodab", k: "slang", t: "노답", re: "노답" },
    { id: "s_aeja", k: "slang", t: "장애인 비하(애자, 정신병자)", re: "애자(?:냐|새끼|같)|정신병자|장애인\\s?(?:이냐|냐|같|새끼|이야)|정병" },
    { id: "s_bingu", k: "slang", t: "빙구(멍텅구리, 띨띨)", re: "빙구|멍텅구리|띨빵|띨띨" },
    /* 초성 욕설(자모 묶음 안에서 찾는다. whole 은 묶음 전체가 그 글자뿐일 때) */
    { id: "j_sb", k: "jamo", t: "ㅅㅂ(ㅆㅂ)", jamo: ["ㅅㅂ", "ㅆㅂ", "ㅅㅃ", "ㅆㅃ"] },
    { id: "j_jr", k: "jamo", t: "ㅈㄹ", jamo: ["ㅈㄹ"] },
    { id: "j_mc", k: "jamo", t: "ㅁㅊ", jamo: ["ㅁㅊ"] },
    { id: "j_bs", k: "jamo", t: "ㅂㅅ(ㅄ)", jamo: ["ㅂㅅ", "ㅄ"] },
    { id: "j_jn", k: "jamo", t: "ㅈㄴ", jamo: ["ㅈㄴ"] },
    { id: "j_sk", k: "jamo", t: "ㅅㄲ(ㄱㅅㄲ)", jamo: ["ㄱㅅㄲ", "ㅅㄲ", "ㅆㄲ"] },
    { id: "j_kj", k: "jamo", t: "ㄲㅈ(꺼져)", jamo: ["ㄲㅈ"] },
    { id: "j_dc", k: "jamo", t: "ㄷㅊ(닥쳐)", jamo: ["ㄷㅊ"] },
    { id: "j_jk", k: "jamo", t: "ㅈㄲ(좆까)", jamo: ["ㅈㄲ"] },
    { id: "j_o", k: "jamo", t: "ㅗ(가운뎃손가락)", jamo: ["ㅗ"], whole: true },
    { id: "j_gid", k: "filler", t: "ㄱㅇㄷ(개이득)", jamo: ["ㄱㅇㄷ"] },
    { id: "j_jmt", k: "filler", t: "ㅈㅁㅌ(존맛탱)", jamo: ["ㅈㅁㅌ"] },
    /* 추임새 */
    { id: "f_jonna", k: "filler", t: "존나(존내, 졸라, 존맛, 존버 등)", re: "존나|존내|존니|조낸|쫀나|존트|존쎄|졸라(?![매맨맺맸묶메])|존맛|존예|존잘|존못|존멋|존귀|존좋|존버|존웃|존싫|존빡|존맛탱|존똑|존예쁨", c: true, x: { pre: /(?:보|생|현|영|의|공|잔|기|상|보)$/ } },
    { id: "f_jmt", k: "filler", t: "JMT(제이엠티)", re: "jmt|제이엠티|제엠티", b: "latin", e: "latin" },
    { id: "f_gae", k: "filler", t: "개(개맛있다, 개좋다, 개웃기다 같은 세게 하는 말)", gae: true },
    { id: "f_assi", k: "filler", t: "아 씨(아씨)", re: "아+\\s?씨+(?![가-힣])|앗\\s?씨(?![가-힣])|아\\s?씨이+", b: true },
    { id: "f_jenjang", k: "filler", t: "젠장(제기랄, 빌어먹을, 망할 놈)", re: "젠장|제기랄|제길(?!동)|제길슨|빌어먹|우라질|넨장|지기미|망할\\s?(?:놈|년|자식|새끼|것|넘)|썩을\\s?(?:놈|년|것|넘)" }
  ];

  /* '개' 뒤에 붙어 세게 하는 말의 줄기. 개 바로 앞이 세는 말이나 '소개', '날개' 같은 낱말의 끝이면 세지 않는다 */
  var GAE_STEMS = ["맛있", "맛없", "맛잇", "맛나", "좋", "웃", "빡", "꿀", "이득", "쩔", "쩐", "쩜", "많", "힘들", "힘듦", "힘세", "피곤", "재밌", "재미", "비싸", "비쌈", "싫", "노잼", "꿀잼", "핵", "극혐", "혐", "구라", "뻥", "쉽", "쉬움", "쉬워", "어렵", "어려", "멀", "덥", "더움", "더워", "춥", "추움", "추워", "배고", "졸리", "졸려", "졸림", "귀엽", "귀여", "예쁘", "이쁘", "예뻐", "이뻐", "예쁨", "이쁨", "잘", "못", "빨리", "빠르", "빠름", "빨라", "늦", "느리", "느림", "느려", "크", "작", "짜증", "열받", "킹받", "부럽", "부러", "신기", "무섭", "무서", "아프", "아파", "더럽", "더러", "지루", "심심", "바쁘", "바빠", "불편", "어이없", "황당", "멋있", "멋져", "멋짐", "쎄", "높", "짧", "뚱", "말랐", "가깝", "가까", "일찍", "오랜만", "오래", "금방", "달달", "맵", "매워", "시원", "뜨겁", "뜨거", "따뜻", "따듯", "깨끗", "조용", "시끄", "밝", "어둡", "어두", "궁금", "기대", "설레", "떨려", "떨림", "슬프", "슬퍼", "기쁘", "기뻐", "행복", "우울", "답답", "억울", "서운", "고맙", "고마", "고생", "고소", "반갑", "반가", "그립", "귀찮", "만족", "후회", "웃프", "대박", "오바", "레전드", "노답", "쪽팔", "창피", "민망", "어색", "똑똑", "멍청", "허접", "구려", "구림", "구린", "간지", "찐", "멘붕", "빡세", "빡침", "빡쳐", "빡친", "나쁘", "나빠", "착하", "착해", "친절", "성실", "부지런", "게으르", "게을러", "느끼", "쫄깃", "쫄", "바삭", "촉촉", "든든", "배부르", "배불러", "취했", "취함", "취해", "졸귀", "꾸짐", "간단", "복잡", "빻", "못생", "잘생", "섹시", "예민", "소름", "무리", "멀쩡", "싱겁", "짜다", "짠", "시큼", "떫", "뻘쭘", "열심", "푹", "무겁", "무거", "가볍", "가벼", "힘듬", "졸았", "쫄았"];
  var GAE_RE = new RegExp("개(?:" + GAE_STEMS.slice().sort(function (a, b) { return b.length - a.length; }).join("|") + ")", "g");
  var GAE_PRE = /(?:[0-9]|한|두|세|네|몇|여러|열|스무|서른|백|천|다섯|여섯|일곱|여덟|아홉|수십|수백|두어|서너|너댓|대여섯|날|지우|베|안|무지|가리|덮|마|소|전|공|중|대|재|타|매|포|반|번|조|산|참|심|이|삼|사|오|육|칠|팔|구|십)$/;

  var JAMO_RUN = /[ㄱ-ㅣ]+/g;
  var JAMO_NOISE_HEAD = /^[ㅋㅎㅠㅜㅡㅏㅑㅓㅕㅛㅣㅐㅔㅇ]+/, JAMO_NOISE_TAIL = /[ㅋㅎㅠㅜㅡㅏㅑㅓㅕㅛㅣㅐㅔ]+$/;
  var BENIGN = {};
  ["ㅇㅈ", "ㄹㅇ", "ㄱㄱ", "ㄴㄴ", "ㅇㅇ", "ㅇㅋ", "ㄱㅅ", "ㅊㅋ", "ㅈㅅ", "ㄷㄷ", "ㅎㅇ", "ㅂㅂ", "ㅂㅇ", "ㅅㄱ", "ㅇㄷ", "ㅁㄹ", "ㅈㅈ", "ㄱㄷ", "ㄳ", "ㅊㅊ", "ㅅㅌㅊ", "ㅍㅌㅊ", "ㅎㅌㅊ", "ㅈㅂ", "ㄱㅊ", "ㅁㅇ", "ㅇㅎ", "ㅇㄱㄹㅇ", "ㅇㅇㅇ", "ㅁㅁ", "ㅇㄴ", "ㄴㄴㄴ", "ㄱㄱㄱ", "ㅇㅋㅇㅋ", "ㄱㅅㄱㅅ", "ㅈㅅㅈㅅ", "ㅇㅈㅇㅈ", "ㄹㅇㅋㅋ", "ㄷㅋ", "ㅂㄷㅂㄷ", "ㄸㄹㄹ", "ㅎㄷㄷ", "ㅇㅂ", "ㅃㅃ", "ㅂㅂㅇ", "ㄱㅂ", "ㅇㄹ", "ㅎㅎ", "ㅋㅋ", "ㄱㅅㅇ", "ㅊㅋㅊㅋ", "ㄴㄷ", "ㅈㅇ", "ㅅㅅ", "ㅆㅅ", "ㅇㅅㅇ", "ㅇㅅ", "ㅅㅇ", "ㅇㅍ"].forEach(function (x) { BENIGN[x] = 1; });

  function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function tight(s) { return String(s == null ? "" : s).replace(/\s+/g, "").toLowerCase(); }
  function hash(str) { var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function bound(b) { return b === "latin" ? "(^|[^a-z0-9])" : b ? "(^|[^가-힣])" : "()"; }
  function tail(e) { return e === "latin" ? "(?![a-z0-9])" : e ? "(?![가-힣])" : ""; }

  /* 설정을 받아 쓸 항목을 고른다. cfg: { off: [id], on: [id], add: [{id, t, k}], allow: [말] } */
  function compile(cfg) {
    cfg = cfg || {};
    var off = {}, on = {};
    (cfg.off || []).forEach(function (x) { off[x] = 1; });
    (cfg.on || []).forEach(function (x) { on[x] = 1; });
    var list = [];
    ENTRIES.forEach(function (e) {
      var enabled = e.def === false ? !!on[e.id] : !off[e.id];
      if (!enabled) return;
      var o = { id: e.id, k: e.k, t: e.t, x: e.x || null, c: !!e.c, jamo: e.jamo || null, whole: !!e.whole, gae: !!e.gae };
      if (e.re) o.rx = new RegExp(bound(e.b) + "(" + e.re + ")" + tail(e.e), "gi");
      list.push(o);
    });
    (cfg.add || []).forEach(function (a) {
      var t = String((a && a.t) || "").trim(); if (!t) return;
      var k = RANK[a.k] != null ? a.k : "rude";
      list.push({ id: "u_" + (a.id || hash(t)), k: k, t: t, custom: true, x: null, c: /^[가-힣]+$/.test(t), rx: new RegExp("()(" + esc(t.replace(/\s+/g, " ")).replace(/ /g, "\\s?") + ")", "gi") });
    });
    var allow = {};
    (cfg.allow || []).forEach(function (x) { var t = tight(x); if (t) allow[t] = 1; });
    var byId = {}; list.forEach(function (e) { byId[e.id] = e; });
    return { list: list, byId: byId, allow: allow };
  }

  /* 원문을 검사용으로: 주소는 같은 길이의 빈칸, 줄바꿈은 빈칸(자리가 그대로 맞게) */
  function prep(text) {
    return String(text == null ? "" : text).replace(/https?:\/\/\S+/g, function (u) { return new Array(u.length + 1).join(" "); }).replace(/[\r\n\t]/g, " ");
  }
  /* 압축 글: 한글, 자모, 영문, 빈칸만 남긴다(시1발, 씨@발). 빈칸은 남겨 낱말을 가르지 않는다. map 은 압축 글의 자리가 원문의 어느 자리인지 */
  function compact(t) {
    var s = "", map = [];
    for (var i = 0; i < t.length; i++) {
      var ch = t.charAt(i);
      if (/[가-힣ㄱ-ㅣa-zA-Z ]/.test(ch)) { s += ch.toLowerCase(); map.push(i); }
    }
    return { s: s, map: map };
  }
  function excluded(x, str, s, e) {
    if (!x) return false;
    var pre = str.slice(Math.max(0, s - 10), s), post = str.slice(e, e + 8);
    if (x.pre && x.pre.test(pre)) return true;
    if (x.post && x.post.test(post)) return true;
    if (x.both && x.both.pre.test(pre) && x.both.post.test(post)) return true;
    return false;
  }
  function runRx(en, str, map, out) {
    var rx = en.rx, m, guard = 0;
    rx.lastIndex = 0;
    while ((m = rx.exec(str)) && guard++ < 300) {
      var pre = m[1] || "", s0 = m.index + pre.length, e0 = m.index + m[0].length;
      if (e0 <= s0) { rx.lastIndex = m.index + 1; continue; }
      if (excluded(en.x, str, s0, e0)) continue;
      out.push({ i: en.id, k: en.k, s: map ? map[s0] : s0, e: map ? map[e0 - 1] + 1 : e0 });
    }
  }
  function runGae(en, t0, out) {
    var m; GAE_RE.lastIndex = 0;
    while ((m = GAE_RE.exec(t0))) {
      var s = m.index, before = t0.slice(Math.max(0, s - 3), s);
      if (before && /[가-힣0-9]$/.test(before) && GAE_PRE.test(before)) continue;
      out.push({ i: en.id, k: en.k, s: s, e: s + m[0].length });
    }
  }
  function runJamo(entries, str, map, out) {
    var m; JAMO_RUN.lastIndex = 0;
    var at = function (i) { return map ? map[i] : i; };
    while ((m = JAMO_RUN.exec(str))) {
      var run = m[0], head = (run.match(JAMO_NOISE_HEAD) || [""])[0];
      var core = run.slice(head.length).replace(JAMO_NOISE_TAIL, "");
      if (!core || core.length > 10 || BENIGN[core]) continue;
      var base = m.index + head.length;
      for (var i = 0; i < entries.length; i++) {
        var en = entries[i];
        if (en.whole) { if (/^ㅗ+$/.test(run.replace(/[ㅋㅎ]+/g, ""))) out.push({ i: en.id, k: en.k, s: at(base), e: at(base + core.length - 1) + 1 }); continue; }
        for (var j = 0; j < en.jamo.length; j++) {
          var idx = core.indexOf(en.jamo[j]);
          if (idx < 0) continue;
          out.push({ i: en.id, k: en.k, s: at(base + idx), e: at(base + idx + en.jamo[j].length - 1) + 1 });
          break;
        }
      }
    }
  }
  /* 겹치는 자리는 하나만: 더 센 종류, 같으면 더 긴 것 */
  function dedupe(ms) {
    ms.sort(function (a, b) { return a.s - b.s || (b.e - b.s) - (a.e - a.s); });
    var out = [];
    ms.forEach(function (m) {
      var last = out[out.length - 1];
      if (last && m.s < last.e) {
        if (RANK[m.k] < RANK[last.k] || (RANK[m.k] === RANK[last.k] && m.e - m.s > last.e - last.s)) out[out.length - 1] = m;
        return;
      }
      out.push(m);
    });
    return out;
  }
  function topOf(ms) { var k = null; ms.forEach(function (m) { if (k == null || RANK[m.k] < RANK[k]) k = m.k; }); return k; }

  /* 한 메시지 검사. 걸린 것이 없으면 null, 있으면 { k: 종류, ms: [{ i: 항목, k, w: 걸린 글자, s, e }] } */
  function scan(text, lex) {
    if (!text || !lex) return null;
    var t0 = prep(text);
    if (!/[가-힣ㄱ-ㅣa-zA-Z0-9\uD83D]/.test(t0)) return null;
    var ms = [], cp = compact(t0), packed = cp.s.length !== t0.length, jam = [];
    for (var i = 0; i < lex.list.length; i++) {
      var en = lex.list[i];
      if (en.jamo) { jam.push(en); continue; }
      if (en.gae) { runGae(en, t0, ms); continue; }
      runRx(en, t0, null, ms);
      if (en.c && packed) runRx(en, cp.s, cp.map, ms);
    }
    if (jam.length) { runJamo(jam, t0, null, ms); if (packed) runJamo(jam, cp.s, cp.map, ms); }
    if (!ms.length) return null;
    // 경계로 삼은 앞 글자(빈칸, 기호)가 딸려 왔으면 뗀다
    ms.forEach(function (m) { while (m.s < m.e - 1 && /[^가-힣ㄱ-ㅣa-zA-Z0-9\uD83D]/.test(t0.charAt(m.s))) m.s += 1; });
    var seen = {};
    ms = ms.filter(function (m) { var key = m.i + "|" + m.s + "|" + m.e; if (seen[key]) return false; seen[key] = 1; return true; });
    ms = dedupe(ms).map(function (m) { m.w = t0.slice(m.s, m.e); return m; }).filter(function (m) { return !lex.allow[tight(m.w)]; });
    if (!ms.length) return null;
    return { k: topOf(ms), ms: ms };
  }

  /* 발췌: 메시지가 100자 안이면 전부, 길면 첫 걸린 말 앞 30자부터 100자. o 는 발췌 안에서 걸린 말의 자리 [시작, 길이].
     전화번호는 가운데를 가리고, 가리면 자리가 어긋나므로 자리를 버린다 */
  function excerpt(text, ms, maxLen) {
    maxLen = maxLen || 100;
    var t = String(text == null ? "" : text).replace(/[\r\n\t]/g, " ");   // 자리는 prep 과 같다(주소도 그대로 보인다)
    var start = 0, end = t.length, pre = "", post = "";
    if (t.length > maxLen) {
      start = Math.max(0, (ms[0] ? ms[0].s : 0) - 30); end = Math.min(t.length, start + maxLen);
      if (end - start < maxLen) start = Math.max(0, end - maxLen);
      if (start > 0) pre = "(앞 생략) ";
      if (end < t.length) post = " (뒤 생략)";
    }
    var x = pre + t.slice(start, end) + post;
    var o = ms.filter(function (m) { return m.s >= start && m.e <= end; }).map(function (m) { return [m.s - start + pre.length, m.e - m.s]; });
    var masked = x.replace(/(^|[^\d\/=._%-])(01[016789])[-\s.]?(\d{3,4})[-\s.]?(\d{4})(?!\d)/g, function (_, p, a, b, c) { return p + a + "-" + b.slice(0, 1) + "***-**" + c.slice(2); });
    if (masked !== x) { x = masked; o = []; }
    return { x: x, o: o };
  }

  /* 저장된 줄의 걸린 말 목록([항목 id, 글자] 배열)을 지금 설정으로 다시 거른다. 끈 항목과 예외 말을 뺀 뒤 종류를 다시 정한다 */
  function classify(w, lex) {
    var ms = [];
    (w || []).forEach(function (p) {
      var en = lex.byId[p[0]]; if (!en) return;
      if (lex.allow[tight(p[1])]) return;
      ms.push({ i: p[0], k: en.k, w: p[1] });
    });
    if (!ms.length) return null;
    return { k: topOf(ms), ms: ms };
  }

  function entries() { return ENTRIES.map(function (e) { return { id: e.id, k: e.k, t: e.t, def: e.def !== false }; }); }

  var OpsLang = { VERSION: VERSION, CATS: CATS, RANK: RANK, CAT_T: CAT_T, compile: compile, scan: scan, excerpt: excerpt, classify: classify, entries: entries, tight: tight, prep: prep };
  global.OpsLang = OpsLang;
  if (typeof module !== "undefined" && module.exports) module.exports = OpsLang;
})(typeof window !== "undefined" ? window : globalThis);
