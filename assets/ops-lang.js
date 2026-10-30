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
   - 초성은 자모가 이어진 묶음 안에서만 본다. 앞뒤의 ㅋㅎㅠ 같은 소리는 떼고, ㅇㅈ ㄹㅇ ㅈㄲㅁ 같은 흔한 말과
     흔한 말 둘이 붙은 것(ㅇㅈ+ㄹㅇ)은 뺀다.
   - 거짓 양성 함정(개인, 개발, 소개, 시발점, 출시발표, 질병신고, 읽씹, 새끼손가락, 시바견, 한남동, 등신대,
     이년 동안, 18년생, 좇아가다, 싸가지고, 잠깐만 초성)은 항목마다 앞뒤 문맥으로 뺀다. 시험(test_lang.js)이 지킨다.
   ============================================================ */
(function (global) {
  "use strict";
  var VERSION = "2026-10-30.2";
  var CATS = [
    { k: "curse", t: "욕설" },
    { k: "rude", t: "막말" },
    { k: "slang", t: "비속어" },
    { k: "jamo", t: "초성 욕설" },
    { k: "filler", t: "추임새" }
  ];
  var RANK = { curse: 0, rude: 1, slang: 2, jamo: 3, filler: 4 };
  var CAT_T = {}; CATS.forEach(function (c) { CAT_T[c.k] = c.t; });

  /* 동물과 먹을거리 뒤의 '새끼', '대가리', '주둥이'는 말 그대로다 */
  var ANIMALS = "(?:강아지|고양이|병아리|송아지|망아지|오리|토끼|돼지|염소|호랑이|사자|곰|여우|늑대|고래|원숭이|닭|쥐|개구리|참새|비둘기|동물|짐승|새|고슴도치|햄스터|거북이|물고기|판다|코끼리|기린|사슴|노루|멧돼지|길냥이|냥이|댕댕이|댕댕|멍멍이|강쥐|고냥이|앵무새|두더지|다람쥐|너구리|수달|물범|펭귄|악어|뱀|거미|벌레|고등어|갈치|새우|게|꽃게|우리\s?개|개)";
  var FOODS = "(?:새우|콩나물|생선|멸치|고등어|갈치|오징어|문어|낙지|닭|오리|돼지|소|게|꽃게|대게|킹크랩|조기|명태|대구|북어|황태|연어|참치|전어|방어|우럭|광어|도미|장어|붕어|잉어|물고기|나물|무|배추|파|마늘|돔|꽁치|삼치|가자미|아귀|홍어|가오리|쭈꾸미|주꾸미|한치|성게|해삼|멍게|굴|전복|소라|골뱅이|꼬막|홍합|바지락|조개|가재|랍스터)";
  var SPOUTS = "(?:주전자|병|호리병|컵|물병|페트병|꽃병|항아리|주둥이가\s?긴)";

  /* 항목. id 는 바뀌지 않는다(끈 목록과 저장한 줄이 이 id 를 쓴다).
     k 종류, t 목록에 보이는 이름, re 정규식 본문(괄호는 (?:) 로), b 앞 경계(true: 한글 뒤가 아님, "latin": 영문과 숫자 뒤가 아님),
     e 뒤 경계(true: 한글 앞이 아님, "latin": 영문과 숫자 앞이 아님), c 압축 글(기호와 숫자를 뺀 글)에서도 찾음,
     x 앞뒤 문맥으로 빼기(pre 는 앞 10자에 $, unless 는 pre 가 맞아도 살리는 꼴, post 는 뒤 8자에 ^, both 는 둘 다 맞을 때만),
     def false 는 기본으로 꺼 둠 */
  var ENTRIES = [
    /* 욕설 */
    /* 시발점, 시발역은 말 그대로. 출시발표, 도시발전, 즉시발송처럼 'X시'와 '발X'가 붙은 꼴은 앞뒤가 모두 맞을 때만 뺀다 */
    { id: "c_sibal", k: "curse", t: "시발(씨발, 씨팔, 쓰발, 시벌 등)", re: "(?:시|씨|쉬|쓰|씌|쒸|쉽|슈|쓔|ㅆ)(?:발|벌|빨|팔)|(?:씨|쒸|쓰|쉬)불|(?:시|씨)이+(?:발|빨|팔)", c: true, x: { post: /^(?:점|역|택시|지점)/, both: { pre: /(?:역|다|도|출|검|감|제|표|게|실|지|투|응|전|명|적|즉|상|항|수|동|과|묵|개|행|무|임|반|월|당|매|순|잠|주|조|공|참|기|국)$/, post: /^(?:송|표|전|생|견|매|급|행|신|달|음|효|명|굴|사|족|끝|령|진|권|판|제|간|주|휘|의|상|현|열|자|병|부|산|동|탁|화|언|성|단|광|돋|톱|가|끈|목|등|바닥|가락|이|라|을)/ } } },
    { id: "c_sibal_sp", k: "curse", t: "시 발(띄어 쓴 꼴, ㅅ발, 시불)", re: "(?:씨|시)\\s(?:발|빨|팔)(?![가-힣])|시불(?![가-힣])|ㅅ(?:발|빨|팔)", b: true },
    /* 시바: 앞이 한글이면 아, 하, 야, 어 같은 감탄만 살린다(아저씨바, 역시바로는 아님). 시바견, 시바 이누는 뺀다 */
    { id: "c_siba", k: "curse", t: "씨바(시바, 씨빠)", re: "(?:시|씨)바(?:알+|아+)?(?![가-힣])|(?:씨빠|시빠)(?![가-힣])", c: true, x: { pre: /[가-힣]$/, unless: /(?:^|[^가-힣])(?:아+|하|야|어|오|우|에이)$/, post: /^\s?(?:이누|견|스리갈)/ } },
    { id: "c_sibul", k: "curse", t: "씨부럴(씨부랄)", re: "(?:씨|시)(?:부럴|부랄|부렁|부레|부랑|불럼|불년|발놈|발년|발럼|발넘|발것)", c: true },
    { id: "c_sibang", k: "curse", t: "씨방새", re: "(?:시|씨)방(?:새|놈|년|것)", c: true },
    /* 질병신고, 간병신청처럼 'X병'과 '신X'가 붙은 꼴은 앞뒤가 모두 맞을 때만 뺀다 */
    { id: "c_byungsin", k: "curse", t: "병신(븅신, 빙신)", re: "(?:병|븅|빙|뱅)(?:신|쉰|시나)|븅딱|병딱", c: true, x: { both: { pre: /[가-힣]$/, post: /^(?:고|청|속|규|분|경|용|입|체|호|화|제|설|원|택|곡|시|하|대|기|상|문|생|년도)/ } } },
    { id: "c_jiral", k: "curse", t: "지랄(지럴, 찌랄)", re: "(?:지|찌)(?:랄|럴|롤)|지뢀", c: true },
    /* 좇다(꿈을 좇다, 좇아가요)는 말 그대로라 좇은 뒤에 붙는 말이 있을 때만 */
    { id: "c_jot", k: "curse", t: "좆(좇같, 좃밥, ㅈ같, 조까)", re: "좆|(?:좇|좃)(?:같|나|밥|까|도|만|빠|됐|됨|바|랄|팔|이(?![가-힣]))|ㅈ(?:같|밥|됐|됨|될|빠|까(?![가-힣])|되(?![가-힣]))|조까(?!지|치)|좃까|조까튼|좇까", c: true },
    { id: "c_ssib", k: "curse", t: "씹(씹새, 씹년, 씹창 등)", re: "씹(?:새|년|놈|창|창|덕|질|팔|할|쌔|빨|선비|자식|탱|노|쓰|보|치)" },
    /* 이, 저, 그, 요 뒤의 새끼는 그 앞이 한글이 아닐 때만(고양이 새끼의 '이 새끼'가 걸리지 않게). 걸린 글자 앞의 빈칸은 scan 이 뗀다 */
    { id: "c_saekki", k: "curse", t: "개새끼(이 새끼, 미친 새끼 등)", re: "(?:(?:개|미친|씨발|시발|병신|좆|좇|썅|쌍|쓰레기|느그|느금|똥|개돼지|망할|죽일|나쁜|못된|개같은)|(?:^|[^가-힣])(?:이|저|그|요|니))\\s?(?:새끼|새키|쉐끼|쉑기|색기|색히|새꺄|쌔끼|쌔키|섀끼|새뀌|쌕끼|새끠|쉐이|새갸)|(?:개|미친|씨발|병신)\\s?세끼|개새(?![가-힣])|개새야|개쉐이|개쉑", c: true, x: { post: /^\s?(?:고양이|강아지|오리|손가락|발가락|들이\s?태어|를?\s?낳|분양|치|줄)/ } },
    { id: "c_ssang", k: "curse", t: "썅(쌍년, 쌍놈)", re: "썅|쌍(?:년|놈|욕|것|노무|뇬|넘)", c: true },
    { id: "c_yeombyung", k: "curse", t: "염병(엠병, 옘병)", re: "염병|엠병|옘병|앰병|옘뷩|얨병", c: true },
    { id: "c_nimi", k: "curse", t: "니미(니기미, 느금, 니애미)", re: "니미(?!지)", b: true },
    { id: "c_nimi2", k: "curse", t: "니미럴(느금마, 애미없냐 등)", re: "니미럴|니기미|니미랄|니애미|니에미|니앰|느금|느그엄|느개비|애미없|애미뒤|에미없|엠창|엄창|앰창|니애비|느그애비|니엄마", c: true },
    { id: "c_horo", k: "curse", t: "호로새끼(후레자식)", re: "호로(?:새끼|자식|놈|년|쉑|쌔끼|새키)|후레(?:자식|새끼|놈|아들)", c: true },
    { id: "c_changnyeo", k: "curse", t: "창녀(걸레년)", re: "창녀|창년|걸레년|걸레같은년", c: true },
    { id: "c_michin_n", k: "curse", t: "미친놈(미친년, 미친새끼)", re: "미친\\s?(?:놈|년|새끼|넘|련|뇬|쉐|놈아|년아)|미친\\s?새(?![가-힣])" },
    { id: "c_gae_n", k: "curse", t: "개년(개놈, 개자식, 개지랄, 개같은 놈)", re: "개(?:년|놈|자식|지랄|쌍년|쌍놈|썅|놈아|년아)|개같은\\s?(?:년|놈|새끼|자식|것)", x: { pre: /(?:[0-9]|일|이|삼|사|오|육|칠|팔|구|십|수|몇|한|두|세|네)$/ } },
    { id: "c_keyboard", k: "curse", t: "영문 자판 변형(tlqkf, qudtls, wlfkf 등)", re: "tlqkf|tlqk(?![a-z])|qudtls|wlfkf|rotorl|alcls|sibal|ssibal|shibal|si8al|ssi8al|sival", b: "latin" },
    { id: "c_c8", k: "curse", t: "c8(씨8, 18놈)", re: "c8(?![a-z0-9])|(?:시|씨|ㅆ|ㅅ)8(?![0-9])|18(?:놈|넘|새끼|새키)|십팔(?:놈|새끼)", b: "latin" },
    /* 막말 */
    { id: "r_finger", k: "rude", t: "가운뎃손가락 이모지", re: "\\uD83D\\uDD95" },
    { id: "r_dakcho", k: "rude", t: "닥쳐(닥치라, 입 다물어)", re: "닥쳐(?!오|올|온|와|왔|서)|닥치(?:라|고|세요|셈|쇼|라고|지|삼|시지|시죠)|입\\s?닥|입\\s?다물|아가리\\s?닥", x: { pre: /들이\s?$/ } },
    { id: "r_kkeojyeo", k: "rude", t: "꺼져(꺼지라)", re: "꺼져(?!\\s?(?:있|서|가지|도|가요|가는|간|갈|도록|버렸|버린|버림|버리고|버릴|주면|요(?![가-힣])))|꺼져\\s?(?:버려(?![가-힣])|버려라|주세요|줄래|줘|주라|주시)|꺼지(?:라|세요|고|셈|쇼|든가|라고|지|삼|시죠|시지|십쇼|라니까|라구)", x: { pre: /(?:불|전원|화면|폰|핸드폰|티비|tv|컴퓨터|컴|시동|엔진|앱|알림|소리|촛불|등|불이|전원이|화면이|폰이|티비가|tv가|컴이|시동이|엔진이|앱이|알림이|소리가|촛불이|등이|불은|불도|불까지|저절로|갑자기|자꾸|계속|불빛이|조명이|조명|전기가|전기|가스가|가스|히터가|히터|보일러가|보일러|에어컨이|에어컨)\s?$/i } },
    { id: "r_dwijyeo", k: "rude", t: "뒤져라(뒤질래, 뒈져)", re: "뒤져(?:라|버려|버리|야)|뒈(?:져|지|진|질)|디져(?:라|버)|뒤질(?:래|놈|년|거|려|라|려고|라고|려구|려면|라면|때)|디질(?:래|놈)|뒤진다|디진다|뒤지기\\s?싫" },
    { id: "r_jugeo", k: "rude", t: "죽어버려(죽을래, 죽여버려)", re: "죽어버려|죽어버리|죽여버|죽여줄까|죽을래|죽을라고|죽을려고|나가\\s?죽어|죽고\\s?싶냐|쳐죽|패죽|맞아\\s?죽|뒤지고\\s?싶" },
    /* 주사 맞을래요, 비 맞을래, 한 대 맞고 왔어요는 말 그대로 */
    { id: "r_majeul", k: "rude", t: "맞을래(쳐맞, 패버려)", re: "맞을래(?!요)|쳐맞|처맞|패버|패줄|때려버|때려줄|주먹\\s?맛|한\\s?대\\s?맞(?:을래|고\\s?싶|자|아\\s?볼|아볼|아야|을\\s?텐)|처발|쳐발", x: { pre: /(?:주사|비|눈|햇빛|햇볕|바람|백신|링거|침|예방|독감|영양제|수액|소나기|물)\s?(?:좀|을|를|나|도|이나)?\s?$/ } },
    { id: "r_yeot", k: "rude", t: "엿 먹어", re: "엿\\s?먹(?!었|어\\s?봤|어본|어\\s?본|고\\s?싶|으면|어\\s?보|는|을\\s?수)|엿이나\\s?(?:먹|드)|엿\\s?드세요|엿\\s?드셔|엿\\s?드셈", x: { pre: /(?:호박|울릉도|쌀|땅콩|생강|수수|조청|옛날|갱|전통)\s?$/ } },
    { id: "r_chomok", k: "rude", t: "처먹(쳐먹, 처마시)", re: "처(?:먹|마시|마셔|마셨|드시|드세|드셔|웃|울|넣|자빠|잤|자고|자라)|쳐(?:먹|마시|마셔|마셨|드시|드세|드셔|넣|자빠|잤|자고|자라)|처박(?!혀|힌|혔)|쳐박(?!혀|힌|혔)" },
    { id: "r_jikkeol", k: "rude", t: "지껄여(씨부려)", re: "지껄|씨부리|씨불이|씨부렁" },
    { id: "r_kkolgap", k: "rude", t: "꼴값(꼬라지, 꼬락서니)", re: "꼴값|꼬라지|꼬락서니|꼬라질" },
    { id: "r_ssagaji", k: "rude", t: "싸가지", re: "싸가지(?!고|구)|싹아지" },
    /* 새우 대가리, 주전자 주둥이는 말 그대로. 닭대가리처럼 붙여 쓴 욕은 살린다 */
    { id: "r_daegari", k: "rude", t: "대가리(아가리, 주둥이)", re: "대가리|대갈통|대갈빡|아가리|주둥이|주둥아리", x: { pre: new RegExp("(?:" + FOODS + "|" + ANIMALS + "|" + SPOUTS + ")\\s?(?:의|는|은|도|만|가|이)?\\s?$"), unless: /(?:닭|새|돌|빡)$/ } },
    { id: "r_jaesu", k: "rude", t: "재수 없어(밥맛이야)", re: "재수\\s?없|재수\\s?가\\s?없|밥맛이야|밥맛\\s?없는\\s?(?:놈|년|새끼|인간)" },
    { id: "r_eojjeo", k: "rude", t: "어쩌라고(어쩔래)", re: "어쩌라고|어쩌라구|어쩌라는|어쩔래|어쩔\\s?건데" },
    { id: "r_mworae", k: "rude", t: "뭐래(뭐라니, 뭐라는 거야)", re: "뭐래(?![가-힣])|뭐라니|뭐라냐|뭐라는\\s?거|뭐래는\\s?거", def: false },
    { id: "r_nega", k: "rude", t: "니가 뭔데(너나 잘해, 주제 파악)", re: "너나\\s?잘\\s?해|너나\\s?잘하|니가\\s?뭔데|네가\\s?뭔데|너가\\s?뭔데|니까짓|네까짓|주제도\\s?모르|주제\\s?파악\\s?(?:좀|을|해|하|부터)" },
    /* 비속어 */
    /* 미친 가성비, 미친 맛처럼 칭찬으로 쓰는 꼴은 뺀다. 그래도 많이 걸리면 운영자가 끈다 */
    { id: "s_michin", k: "slang", t: "미친(미쳤다, 미쳐)", re: "미친|미쳤|미쳐|미칠|미침|미치겠", x: { pre: /이$/, post: /^\s?(?:가성비|맛|존맛|퀄리티|비주얼|조합|케미|텐션|스케일|분위기|몰입|연기|노래|효율|가격|할인|경치|뷰|풍경|실력|피지컬|체력|집중력|속도)/ } },
    { id: "s_ttorai", k: "slang", t: "또라이(돌아이, 똘끼)", re: "또라이|똘아이|돌아이|똘끼", b: true },
    { id: "s_deungsin", k: "slang", t: "등신(머저리, 얼간이, 쪼다)", re: "등신|머저리|얼간이|쪼다", x: { post: /^(?:대|불|상)/ } },
    { id: "s_meongcheong", k: "slang", t: "멍청이(멍청아, 돌대가리)", re: "멍청(?:이|아|한\\s?놈|한\\s?년|한\\s?새끼|한놈|한년|하네|하냐)|멍충이|돌대가리|빡대가리|무뇌" },
    { id: "s_jjinda", k: "slang", t: "찐따(찌질이)", re: "찐따|찌질|찌찔" },
    { id: "s_kkondae", k: "slang", t: "꼰대(틀딱, 개저씨)", re: "꼰대|틀딱|개저씨|노친네" },
    { id: "s_hate", k: "slang", t: "한남충(김치녀, 맘충, 급식충)", re: "한남(?:충|들|새끼|놈|새|스럽|같|이네|이다|이랑|\\s?특)|김치녀|된장녀|맘충|급식충|진지충|설명충|틀딱충|한녀|페미(?:년|충|나치)|꼴페미|메갈(?!로)" },
    { id: "s_geolle", k: "slang", t: "걸레(변태, 호구)", re: "걸레\\s?(?:같|년|짓|야)|변태(?:야|새끼|같|냐|들|아저씨)|호구(?:냐|잡|새끼|야|들|네)" },
    { id: "s_gae", k: "slang", t: "개소리(개판, 개같다)", re: "개소리|개판(?!매)|개수작|개같(?:은|다|이|네|아|애)|개꼴|개뿔|개망신|개짓|개버릇|개무시|개드립|개같" },
    { id: "s_saekki", k: "slang", t: "새끼(앞말 없이)", re: "(?:새끼|새꺄|쉐끼|색기|쌔끼|새키)(?!\\s?(?:손|발|줄|리|를\\s?낳|가\\s?태어|치|고양이|강아지|오리|들이\\s?태어|분양))", x: { pre: new RegExp(ANIMALS + "\\s?(?:의|가|는|은|도|들|들이|들은|들의)?\\s?$") } },
    /* 이년 동안, 저년도, 이년이 지났다(두 해)는 뒤 문맥으로 뺀다 */
    { id: "s_nyeon", k: "slang", t: "년(이년, 저년, 그년)", re: "(?:(?:미친|썅|쌍|씨발|시발|망할|염병할|죽일|나쁜|못된|개같은)|(?:^|[^가-힣])(?:이|저|그|요))\\s?(?:년|뇬|련)(?:아|야|들아|들|이네|이다|이랑|한테|때문|이|은|을)?(?![가-힣])", x: { post: /^\s?(?:동안|간|전|뒤|째|차|이상|넘|가까이|정도|만에|후|사이|반|쯤|여|이내|안|연속|치|분|마다|넘게|남짓|됐|되|됨|지나|지났|가량|이나|이면|이란|걸|넘었|흘)/ } },
    { id: "s_nom", k: "slang", t: "놈(이놈, 저놈)", re: "(?:(?:미친|썅|쌍|씨발|시발|망할|염병할|죽일|나쁜|못된|개같은)|(?:^|[^가-힣])(?:이|저|그|요))\\s?(?:놈|넘|눔)(?:아|야|들아|들|이네|이다|이랑|한테|때문|이|은|을)?(?![가-힣])", def: false },
    { id: "s_babo", k: "slang", t: "바보(바보야)", re: "바보(?:야|새끼|같은|냐|냐고|들|놈|년)", def: false },
    { id: "s_hansim", k: "slang", t: "한심", re: "한심", def: false },
    { id: "s_sseuregi", k: "slang", t: "쓰레기 같은 놈(인간 쓰레기)", re: "쓰레기\\s?(?:같은|새끼|놈|년|자식|들아|야)|쓰레기네(?!\\s*(?:개|봉지|장|통|번|명))|인간\\s?쓰레기|쓰렉|개쓰레기" },
    { id: "s_geukhyeom", k: "slang", t: "극혐(혐오스럽다)", re: "극혐|혐오스|혐짤" },
    { id: "s_nodab", k: "slang", t: "노답", re: "노답" },
    { id: "s_aeja", k: "slang", t: "장애인 비하(애자, 정신병자)", re: "애자(?:냐|새끼|같)|정신병자|장애인\\s?(?:이냐|냐|같|새끼|이야)|정병(?=\\s?(?:있|걸|이냐|이야|임|인가|환자))" },
    { id: "s_bingu", k: "slang", t: "빙구(멍텅구리, 띨띨)", re: "빙구(?!르)|멍텅구리|띨빵|띨띨" },
    /* 초성 욕설(자모 묶음 안에서 찾는다. whole 은 묶음 전체가 그 글자뿐일 때, exact 는 묶음의 알맹이가 꼭 그 꼴일 때) */
    { id: "j_sb", k: "jamo", t: "ㅅㅂ(ㅆㅂ)", jamo: ["ㅅㅂ", "ㅆㅂ", "ㅅㅃ", "ㅆㅃ"] },
    { id: "j_jr", k: "jamo", t: "ㅈㄹ", jamo: ["ㅈㄹ"] },
    { id: "j_mc", k: "jamo", t: "ㅁㅊ", jamo: ["ㅁㅊ"] },
    { id: "j_bs", k: "jamo", t: "ㅂㅅ(ㅄ)", jamo: ["ㅂㅅ", "ㅄ"] },
    { id: "j_jn", k: "jamo", t: "ㅈㄴ", jamo: ["ㅈㄴ"] },
    { id: "j_sk", k: "jamo", t: "ㅅㄲ(ㄱㅅㄲ)", jamo: ["ㄱㅅㄲ", "ㅅㄲ", "ㅆㄲ"] },
    { id: "j_kj", k: "jamo", t: "ㄲㅈ(꺼져)", jamo: ["ㄲㅈ"] },
    { id: "j_dc", k: "jamo", t: "ㄷㅊ(닥쳐. 대충과 헷갈려 기본 끔)", jamo: ["ㄷㅊ"], def: false },
    { id: "j_jk", k: "jamo", t: "ㅈㄲ(좆까)", jamo: ["ㅈㄲ"], exact: ["ㅈㄲ", "ㅈㄲㄹ"] },
    { id: "j_o", k: "jamo", t: "ㅗ(가운뎃손가락)", jamo: ["ㅗ"], whole: true },
    { id: "j_gid", k: "filler", t: "ㄱㅇㄷ(개이득)", jamo: ["ㄱㅇㄷ"] },
    { id: "j_jmt", k: "filler", t: "ㅈㅁㅌ(존맛탱)", jamo: ["ㅈㅁㅌ"] },
    /* 추임새 */
    { id: "f_jonna", k: "filler", t: "존나(존내, 졸라, 존맛, 존버, ㅈ나 등)", re: "존나|존내|존니|조낸|쫀나|조오*온나|존트|존쎄|졸라(?![매맨맺맸묶메서대댔도보봐달])|존맛|존예|존잘|존못|존멋|존귀|존좋|존버|존웃|존싫|존빡|존맛탱|존똑|존예쁨|ㅈ나게|ㅈ나(?![가-힣])", c: true, x: { pre: /(?:보|생|현|영|의|공|잔|기|상)$/ } },
    { id: "f_jmt", k: "filler", t: "JMT(제이엠티)", re: "jmt(?:gr)?|제이엠티|제엠티", b: "latin", e: "latin" },
    { id: "f_gae", k: "filler", t: "개(개맛있다, 개좋다, 개웃기다 같은 세게 하는 말)", gae: true },
    { id: "f_assi", k: "filler", t: "아 씨(아씨)", re: "아+\\s?씨+(?![가-힣])|앗\\s?씨(?![가-힣])|아\\s?씨이+", b: true },
    { id: "f_jenjang", k: "filler", t: "젠장(제기랄, 빌어먹을, 망할 놈)", re: "젠장|제기랄|제길(?!동)|제길슨|빌어먹|우라질|넨장|지기미|망할\\s?(?:놈|년|자식|새끼|것|넘)|썩을\\s?(?:놈|년|것|넘)" }
  ];

  /* '개' 뒤에 붙어 세게 하는 말의 줄기. 개 바로 앞이 세는 말이나 '소개', '날개' 같은 낱말의 끝이면 세지 않는다(완전개웃겨, 진심개맛있다는 살린다) */
  var GAE_STEMS = ["맛있", "맛없", "맛잇", "맛나", "맛도리", "마싯", "마시써", "마싰", "맛집", "좋", "조음", "조아", "굿", "웃", "빡", "꿀", "이득", "쩔", "쩐", "쩜", "쩌는", "많", "힘들", "힘듦", "힘드", "힘세", "피곤", "재밌", "재미", "재밋", "잼", "비싸", "비쌈", "싫", "노잼", "꿀잼", "핵", "극혐", "혐", "구라", "뻥", "쉽", "쉬움", "쉬워", "어렵", "어려", "멀", "덥", "더움", "더워", "춥", "추움", "추워", "배고", "졸리", "졸려", "졸림", "귀엽", "귀여", "귀욤", "예쁘", "이쁘", "예뻐", "이뻐", "예쁨", "이쁨", "잘", "못", "빨리", "빠르", "빠름", "빨라", "늦", "느리", "느림", "느려", "크", "큼", "작", "적다", "적어", "적네", "짜증", "열받", "킹받", "부럽", "부러", "신기", "무섭", "무서", "아프", "아파", "더럽", "더러", "지루", "심심", "바쁘", "바빠", "바쁨", "불편", "어이없", "황당", "당황", "멋있", "멋져", "멋짐", "쎄", "높", "짧", "뚱", "말랐", "가깝", "가까", "일찍", "오랜만", "오래", "금방", "달달", "맵", "매워", "시원", "뜨겁", "뜨거", "따뜻", "따듯", "깨끗", "조용", "시끄", "밝", "어둡", "어두", "궁금", "기대", "설레", "떨려", "떨림", "슬프", "슬퍼", "기쁘", "기뻐", "행복", "우울", "답답", "억울", "서운", "고맙", "고마", "고생", "고소", "반갑", "반가", "그립", "귀찮", "만족", "후회", "웃프", "대박", "오바", "레전드", "노답", "쪽팔", "창피", "민망", "어색", "똑똑", "멍청", "허접", "구려", "구림", "구린", "간지", "찐", "멘붕", "빡세", "빡침", "빡쳐", "빡친", "나쁘", "나빠", "착하", "착해", "친절", "성실", "부지런", "게으르", "게을러", "느끼", "쫄깃", "쫄", "바삭", "촉촉", "든든", "배부르", "배불러", "취했", "취함", "취해", "취한", "졸귀", "꾸짐", "간단", "복잡", "빻", "못생", "잘생", "섹시", "예민", "소름", "무리", "멀쩡", "싱겁", "짜다", "짠", "시큼", "떫", "뻘쭘", "열심", "푹", "무겁", "무거", "가볍", "가벼", "힘듬", "졸았", "쫄았", "쌈", "싸다", "싸네", "싸게", "싸구려", "싼", "손해", "오지", "오져", "지리", "지린", "짱", "땡기", "땡겨", "당기", "터짐", "터졌", "빵터"];
  var GAE_RE = new RegExp("개(?:" + GAE_STEMS.slice().sort(function (a, b) { return b.length - a.length; }).join("|") + ")", "g");
  /* 띄어 쓴 '개 맛있다'는 개(동물)를 말할 수 없는 줄기만 */
  var GAE_SP_RE = /개\s(?:맛있|맛없|비싸|웃기|웃겨|웃김|빡세|피곤|졸려|졸리|배고|힘들|덥|춥|멀|늦|짜증|어렵|쉽|재밌|재미|노잼|꿀잼|이득|쩔|쩐|극혐|빡|꿀|많|싫|비쌈|맛집)/g;
  var GAE_PRE = /(?:[0-9]|한|두|세|네|몇|여러|열|스무|서른|백|천|다섯|여섯|일곱|여덟|아홉|수십|수백|두어|서너|너댓|대여섯|날|지우|베|안|무지|가리|덮|마|소|전|공|중|대|재|타|매|포|반|번|조|산|참|심|이|삼|사|오|육|칠|팔|구|십)$/;
  var GAE_PRE_OK = /(?:완전|진심|레알|진짜|겁나|너무|엄청|되게|존나|졸라)$/;

  var JAMO_RUN = /[ㄱ-ㅣ]+/g;
  var JAMO_NOISE_HEAD = /^[ㅋㅎㅠㅜㅡㅏㅑㅓㅕㅛㅣㅐㅔㅇ]+/, JAMO_NOISE_TAIL = /[ㅋㅎㅠㅜㅡㅏㅑㅓㅕㅛㅣㅐㅔ]+$/;
  var BENIGN = {};
  ["ㅇㅈ", "ㄹㅇ", "ㄱㄱ", "ㄴㄴ", "ㅇㅇ", "ㅇㅋ", "ㄱㅅ", "ㅊㅋ", "ㅈㅅ", "ㄷㄷ", "ㅎㅇ", "ㅂㅂ", "ㅂㅇ", "ㅅㄱ", "ㅇㄷ", "ㅁㄹ", "ㅈㅈ", "ㄱㄷ", "ㄳ", "ㅊㅊ", "ㅅㅌㅊ", "ㅍㅌㅊ", "ㅎㅌㅊ", "ㅈㅂ", "ㄱㅊ", "ㅁㅇ", "ㅇㅎ", "ㅇㄱㄹㅇ", "ㅇㅇㅇ", "ㅁㅁ", "ㅇㄴ", "ㄴㄴㄴ", "ㄱㄱㄱ", "ㅇㅋㅇㅋ", "ㄱㅅㄱㅅ", "ㅈㅅㅈㅅ", "ㅇㅈㅇㅈ", "ㄹㅇㅋㅋ", "ㄷㅋ", "ㅂㄷㅂㄷ", "ㄸㄹㄹ", "ㅎㄷㄷ", "ㅇㅂ", "ㅃㅃ", "ㅂㅂㅇ", "ㄱㅂ", "ㅇㄹ", "ㅎㅎ", "ㅋㅋ", "ㄱㅅㅇ", "ㅊㅋㅊㅋ", "ㄴㄷ", "ㅈㅇ", "ㅅㅅ", "ㅆㅅ", "ㅇㅅㅇ", "ㅇㅅ", "ㅅㅇ", "ㅇㅍ", "ㅈㄲㅁ", "ㅈㄲㅁㅇ", "ㅈㄲ만", "ㄷㅊ", "ㅂㅅㅇ", "ㄱㅇ", "ㅇㄱ", "ㅁㅊㅇ", "ㄷㄱ", "ㄱㄷㄹ", "ㄱㅁ", "ㅇㅋㄷㅋ", "ㅇㄷㄱ", "ㅇㅈㄹㅇ"].forEach(function (x) { BENIGN[x] = 1; });

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
      var o = { id: e.id, k: e.k, t: e.t, x: e.x || null, c: !!e.c, jamo: e.jamo || null, whole: !!e.whole, exact: e.exact || null, gae: !!e.gae };
      if (e.re) o.rx = new RegExp(bound(e.b) + "(" + e.re + ")" + tail(e.e), "gi");
      list.push(o);
    });
    (cfg.add || []).forEach(function (a) {
      var t = String((a && a.t) || "").trim(); if (!t) return;
      var k = RANK[a.k] != null ? a.k : "rude";
      list.push({ id: "u_" + (a.id || hash(tight(t))), k: k, t: t, custom: true, x: null, c: /^[가-힣]+$/.test(t), rx: new RegExp("()(" + esc(t.replace(/\s+/g, " ")).replace(/ /g, "\\s?") + ")", "gi") });
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
  var JAMO_CH = /[ㄱ-ㅣ]/;
  /* 압축 글: 한글, 자모, 영문, 빈칸만 남긴다(시1발, 씨@발). 빈칸은 남겨 낱말을 가르지 않는다.
     자모 사이의 기호(ㄱㅅ.ㅂㅂ)는 빈칸으로 두어 흔한 초성 둘이 붙지 않게 한다(숫자는 뺀다: ㅅ1ㅂ). map 은 압축 글의 자리가 원문의 어느 자리인지 */
  function compact(t) {
    var s = "", map = [];
    for (var i = 0; i < t.length; i++) {
      var ch = t.charAt(i);
      if (/[가-힣ㄱ-ㅣa-zA-Z ]/.test(ch)) { s += ch.toLowerCase(); map.push(i); }
      else if (!/[0-9]/.test(ch) && i > 0 && i < t.length - 1 && JAMO_CH.test(t.charAt(i - 1)) && JAMO_CH.test(t.charAt(i + 1))) { s += " "; map.push(i); }
    }
    return { s: s, map: map };
  }
  function excluded(x, str, s, e) {
    if (!x) return false;
    var pre = str.slice(Math.max(0, s - 10), s), post = str.slice(e, e + 8);
    if (x.pre && x.pre.test(pre) && !(x.unless && x.unless.test(pre))) return true;
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
  function runGae(en, str, map, out) {
    var m, at = function (i) { return map ? map[i] : i; };
    GAE_RE.lastIndex = 0;
    while ((m = GAE_RE.exec(str))) {
      var s = m.index, before = str.slice(Math.max(0, s - 3), s);
      if (before && /[가-힣0-9]$/.test(before) && GAE_PRE.test(before) && !GAE_PRE_OK.test(before)) continue;
      out.push({ i: en.id, k: en.k, s: at(s), e: at(s + m[0].length - 1) + 1 });
    }
    GAE_SP_RE.lastIndex = 0;
    while ((m = GAE_SP_RE.exec(str))) {
      var s2 = m.index, before2 = str.slice(Math.max(0, s2 - 3), s2);
      if (before2 && /[가-힣0-9]$/.test(before2) && GAE_PRE.test(before2) && !GAE_PRE_OK.test(before2)) continue;
      out.push({ i: en.id, k: en.k, s: at(s2), e: at(s2 + m[0].length - 1) + 1 });
    }
  }
  /* 흔한 초성 말, 또는 흔한 말 둘이 붙은 것(ㅇㅈ+ㄹㅇ, ㄱㅅ+ㅂㅂ) */
  function benign(core) {
    if (BENIGN[core]) return true;
    for (var i = 1; i < core.length; i++) if (BENIGN[core.slice(0, i)] && BENIGN[core.slice(i)]) return true;
    return false;
  }
  function runJamo(entries, str, map, out) {
    var m; JAMO_RUN.lastIndex = 0;
    var at = function (i) { return map ? map[i] : i; };
    while ((m = JAMO_RUN.exec(str))) {
      var run = m[0], head = (run.match(JAMO_NOISE_HEAD) || [""])[0];
      var core = run.slice(head.length).replace(JAMO_NOISE_TAIL, "");
      if (!core || core.length > 10 || benign(run) || benign(core)) continue;
      var base = m.index + head.length;
      for (var i = 0; i < entries.length; i++) {
        var en = entries[i];
        if (en.whole) { if (/^ㅗ+$/.test(run.replace(/[ㅋㅎ]+/g, ""))) out.push({ i: en.id, k: en.k, s: at(base), e: at(base + core.length - 1) + 1 }); continue; }
        if (en.exact) { if (en.exact.indexOf(core) >= 0) out.push({ i: en.id, k: en.k, s: at(base), e: at(base + core.length - 1) + 1 }); continue; }
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
    var ms = [], cp = compact(t0), packed = cp.s.length !== t0.length || cp.s !== t0.toLowerCase(), jam = [];
    for (var i = 0; i < lex.list.length; i++) {
      var en = lex.list[i];
      if (en.jamo) { jam.push(en); continue; }
      if (en.gae) { runGae(en, t0, null, ms); if (packed) runGae(en, cp.s, cp.map, ms); continue; }
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

  /* 발췌: 메시지가 80자 안이면 전부, 길면 첫 걸린 말 앞 30자부터 80자. 자리는 prep 과 같아 주소도 그대로 보인다. 전화번호는 가운데를 가린다 */
  function excerpt(text, ms, maxLen) {
    maxLen = maxLen || 80;
    var t = String(text == null ? "" : text).replace(/[\r\n\t]/g, " ");
    var start = 0, end = t.length, pre = "", post = "";
    if (t.length > maxLen) {
      start = Math.max(0, (ms[0] ? ms[0].s : 0) - 30); end = Math.min(t.length, start + maxLen);
      if (end - start < maxLen) start = Math.max(0, end - maxLen);
      if (start > 0) pre = "(앞 생략) ";
      if (end < t.length) post = " (뒤 생략)";
    }
    var x = pre + t.slice(start, end) + post;
    x = x.replace(/(^|[^\d\/=._%-])(01[016789])[-\s.]?(\d{3,4})[-\s.]?(\d{4})(?!\d)/g, function (_, p, a, b, c) { return p + a + "-" + b.slice(0, 1) + "***-**" + c.slice(2); });
    return { x: x };
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

  var OpsLang = { VERSION: VERSION, CATS: CATS, RANK: RANK, CAT_T: CAT_T, compile: compile, scan: scan, excerpt: excerpt, classify: classify, entries: entries, tight: tight, prep: prep, hash: hash };
  global.OpsLang = OpsLang;
  if (typeof module !== "undefined" && module.exports) module.exports = OpsLang;
})(typeof window !== "undefined" ? window : globalThis);
