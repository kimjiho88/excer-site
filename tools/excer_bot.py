#!/usr/bin/env python3
"""
excer-bot: 사이트의 모임 모집(벙) 글을 늘 지켜보다가 오픈채팅방에 벙 일정을 올리고 공지로 건다.

봇 계정(excer-bot)으로 로그인한 카카오톡을 이 파이썬이 대신 조작한다.
카카오톡에는 오픈채팅에 글을 올리거나 공지를 거는 공개 연결이 없어서, 사람이 하듯 화면을 조작한다.
  tablet   태블릿(또는 폰) 하나로. 그 기기의 Termux 에서 이 파일을 돌리고, 무선 디버깅으로 같은 기기에 adb 로 붙어
           화면을 읽고(uiautomator dump) 누른다(input). 한글은 클립보드(termux-clipboard-set)로 붙여넣고,
           입력 칸의 글이 목록과 같은지 확인한 뒤에만 보낸다. 공지는 보낸 말풍선을 길게 눌러 건다. 추가 설치(pip) 없음.
  android  PC 에서 USB 로 연결한 안드로이드 기기를 uiautomator2 로(pip install uiautomator2).
  pc       윈도우 PC 카카오톡(pip install pywin32). 처음에 calibrate 로 우클릭 메뉴 자리를 잡는다.
  dry      보내지 않고 화면에 찍기만(시험용).

하는 일
  - 20초마다 사이트의 모임 모집 글을 읽는다(check_sec). 날짜가 있는 글만 벙으로 친다(사이트가 날짜, 시작 시간, 끝나는 시간, 장소를 꼭 받는다).
  - 공지: 오늘 벙을 카드로 적는다. 첫 줄 '오늘의 벙 10/9(금) 3건', 둘째 줄 '참석' 과 사이트 주소(공지 띠에 보이는 두 줄),
    카드마다 번호와 시간, 제목, 장소, 정원과 신청 마감. 카드는 올릴 때 진행 중인 벙, 다음 시간 벙, 시간이 지난 벙 차례(같은 시각이면
    먼저 등록한 글이 위), 넷까지이고 넘으면 '외 N건'. 마감했거나 정원이 찬 오늘 벙은
    그 아래 '마감' 한 줄씩, 그다음 내일 이후 모집 중인(마감 안 함, 정원 남음, 신청 마감 전) 벙은 첫 벙만 한 줄('외 N건'). 오늘 벙이 없으면 다음 벙을 장소까지.
    시작했거나 끝났거나 신청 마감이 지난 오늘 벙도 그날은 카드로 남는다. 시각만 지나 차례가 바뀌면 다시 올리지 않고,
    '외 N건' 에 가려진 진행 중이나 시작 전 벙을 카드로 올려야 할 때만 지금 차례로 다시 올린다.
    오늘은 조용한 시간이 끝날 때 다음 날로 넘어간다(quiet 00:30-07:30 이면 07:30. 조용한 시간이 없거나 끝이 12:00 이후면 자정).
    이 글이 달라질 때마다(새 벙, 바뀜, 마감, 정원 참, 다시 모집, 취소, 오늘이 넘어갈 때) 방에 올리고 길게 눌러 공지로 건다.
    올리기 전과 run 을 켠 뒤 처음에 방 위쪽 공지 띠를 읽어(앞부분만 보이면 띠를 눌러 상세보기로 전체를 읽고 방으로 돌아온다) 이 글과 견준다.
    이미 이 글이면 올리지 않고, 켠 뒤 처음 읽은 방 공지가 이 글과 확실히 다르면 이미 올린 이 글을 찾아 다시 건다(tablet).
  - 알림: 새 벙, 날짜와 시간과 장소와 신청 마감 바뀜, 마감, 정원 참, 다시 모집(마감 풀림, 자리 남), 취소(모집 글 삭제)는
    공지 글 앞에 알림 메시지를 따로 올린다. 새 벙은 사이트에 처음 올라왔을 때 한 번, 벙마다 한 메시지(장소, 인원, 벙주, 끝 줄은
    '참석' 과 그 벙 주소 /bung?id=번호. 카카오톡 미리보기 상자를 눌러도 소식의 그 글이 펼쳐져 참석 단추가 바로 보인다).
    나머지는 하나면 자세히(그 벙 주소까지), 여럿이면 한 메시지에 한 줄씩.
  - 24시간 돈다. 한 번 올린 뒤 1분 안에 또 바뀌면 모았다가 1분이 지나면 올린다(min_gap_sec).
  - 처음 켤 때는 이미 올라와 있던 글을 알리지 않고, 지금의 공지 글만 올려 공지로 건다(방 공지가 이미 이 글이면 올리지 않는다).
  - 보내기에 실패하면 1분 쉬었다가 다시. 공지 걸기만 실패하면 1분, 5분, 15분 뒤 이미 올린 글을 찾아 다시 건다(세 번까지).
    tablet 은 글을 다시 올리지 않고 찾아서 건다. 위로 밀려 못 찾을 때만 한 번 더 올린다.
  - 공지 글은 400자 안으로(notice_max_chars, 넘치는 벙은 '외 N건'). 카카오톡은 긴 글을 접어(전체보기) 보여 줘서 말풍선을 찾기 어렵다.
  - 한 차례에 새 벙과 지운 벙이 합쳐 6건 이상이면(사이트에서 글을 한꺼번에 옮기거나 지운 것) 알림 없이 공지 글만 새로 올린다(bulk_quiet).
    알릴 것이 6건 이상이면(조용한 시간 뒤 등) 한 줄씩 적지 않고 'N건' 한 줄과 주소만. 끝난 벙을 마감하거나 고친 것은 알리지 않는다.
  - 매일 09:00(heartbeat_at, 조용한 시간이면 끝난 뒤) 시험 방에 '봇 정상' 한 줄(사이트를 본 때, 공지 상태). 안 오면 태블릿을 본다.
  - 공지 걸기를 네 번 실패해 쉬는 동안은 status 와 '봇 정상' 줄에 '직접 공지로 걸어 주세요' 가 계속 보인다.
  - 매일 정한 시각에 공지 글을 한 번 더 올릴 수 있다(digest_at, 기본은 끔).
  - 운영 화면(ops.html 데이터 탭의 봇 원격 조종)에서 공지 멈춤(공지 글만 쉼, 알림은 그대로)이나 전체 멈춤(알림과 공지 모두 쉼,
    그동안 바뀐 것은 기억만)을 누르면 1분 안에 따른다. 멈춤이 끝나면(정한 시간이 지나거나 다시 켜기) 공지 글을 다시 올려 건다.
  - 멤버: 매일 05:10(members_at) 알릴 방 오른쪽 위 세 줄 단추(방 메뉴)를 열고 대화상대 칸을 끝까지 밀어 지금 방에 있는 멤버의 닉네임을
    읽어(봇 자신은 빼고) 사이트 닉네임 목록에 올린다(tablet, 봇 열쇠가 있을 때). 누르는 것은 세 줄 단추, 대화상대 칸의 더보기 단추,
    뒤로 키뿐이다. 대화상대 수(봇 빼고)의 9할을 못 읽으면 올리지 않고 30분 뒤 다시(하루 세 번까지). 서버는 지금 목록의 7할 아래로
    줄면 바꾸지 않는다. 조용한 시간에도 하고, 운영 화면의 전체 멈춤 중에는 쉰다.
  - 알릴 방이 열려 있지 않으면 오픈채팅 주소(room_link, 기본은 사이트의 오픈채팅 참여 주소)로 바로 연다. 안 되면 채팅 목록에서 찾는다.
  - 카카오톡을 건드리는 것은 올릴 것이 있을 때와 하루 한 번 멤버를 읽을 때뿐이다. 채팅 목록에서 방을 못 찾거나 방으로 가는 길에 누를 자리가
    보이스룸 작은 창에 가려 있으면 1, 2, 5, 10, 15분 간격으로 다시 본다. 채팅 목록으로는 아래(또는 옆) 메뉴의 '채팅' 으로 가고, 맨 위 머리 제목 글자는 누르지 않는다.
가진 것: 멤버 목록만 바꿀 수 있는 봇 열쇠(members_key, 운영 화면 데이터 탭에서 만든다). 사이트의 공개 글만 읽는다.
공개 접속 키는 사이트에서 읽어 온다. 운영진 비밀번호는 여기에 두지 않는다.

tablet 준비(태블릿 하나로)
  - Termux 와 Termux:API 를 같은 곳(F-Droid)에서 깔고, Termux 에서 yes | pkg upgrade 로 기본 부품을 먼저 올린 뒤
    pkg install python android-tools termux-api curl (안 올리면 adb, curl 이 CANNOT LINK EXECUTABLE 로 안 켜진다)
  - 설정 > 개발자 옵션 > 무선 디버깅을 켜고, 페어링 코드로 한 번 adb pair 127.0.0.1:포트 한 뒤
    python excer_bot.py connect (포트는 스스로 찾는다. 못 찾으면 무선 디버깅 화면의 'IP 주소 및 포트' 의 포트를 적는다).
    connect 는 고정 포트(5555)도 열어 두어 무선 디버깅이 저절로 꺼져도 붙는다(처음 한 번 화면의 허용 창). 재부팅하면 무선 디버깅을 켜고 connect 만 다시.
  - 화면 잠금 없음, 충전기 연결, Termux 는 배터리 제한 없음(run 이 termux-wake-lock 을 직접 건다).
    화면 방향은 봇이 켤 때와 카카오톡을 띄울 때마다 자동 회전을 끄고 가로로 고정한다(자동 회전이 꺼진 동안은 앱이 화면을 돌리는 것도 막는다.
    rotate 로 바꾼다).
    화면은 꺼져 있어도 된다. 봇이 올릴 때 화면을 켜고 카카오톡을 앞으로 가져온다.
  - 와이파이 절전을 끈다(설정 > 연결 > Wi-Fi > 고급 또는 인텔리전트 Wi-Fi 에서 절전 모드 끔, 배터리 > 절전 예외 앱에 Termux 와 카카오톡).
    화면이 꺼진 채 몇 시간씩 망이 끊기면 그동안 공지가 멈추고 보이스룸도 끊긴다. 봇은 3분 넘게 응답이 없고 다른 주소도 안 열리면
    와이파이를 껐다 켠다(15분에 한 번). 사이트가 응답 코드를 주는 장애(서버 쪽)에는 와이파이를 건드리지 않는다.
  - 봇 계정을 방의 부방장으로 둔다(공지는 방장과 부방장만 건다).
  - 재부팅이나 Termux 종료 뒤에는 봇이 저절로 다시 켜지지 않는다. Termux 를 열고 python excer_bot.py status 로 멈춘 것을 확인한 뒤
    (무선 디버깅을 켜고 connect 를 한 번) python excer_bot.py run. 하루 한 번 status 를 치는 습관이 가장 싼 감시다.
    Termux 의 상단 알림을 지우거나 최근 앱 목록에서 밀어내면 봇이 꺼진다. 카카오톡 자동 업데이트를 꺼 두면 화면 글자가
    갑자기 바뀌어 올리기와 공지가 실패하는 일을 줄인다(Play 스토어 > 카카오톡 > 자동 업데이트 사용 끄기).

명령(이 파일이 있는 폴더에서)
  python excer_bot.py setup           설정 파일(excer_bot.json)을 만든다. tablet 이면 카카오톡 목록의 방 이름을 번호로 고른다
  python excer_bot.py connect 포트     (tablet) 무선 디버깅 포트로 같은 기기에 붙는다
  python excer_bot.py check           사이트, 기기 연결, 클립보드를 확인한다(보내지 않음)
  python excer_bot.py status          run 이 돌고 있는지, 사이트를 마지막으로 본 때, 공지 첫 줄, 보이스룸, 멤버 자동 갱신, 최근 기록 다섯 줄,
                                      저장소에 새 판이 있는지. 기기를 건드리지 않으니 run 이 도는 동안 다른 창에서 쳐도 된다
  python excer_bot.py update          저장소의 봇 파일이 이 파일과 다르면 받아 바꾼다(문법 검사 뒤, 옛 파일은 .bak). run 을 먼저 Ctrl+C
  python excer_bot.py quiet 00:30-07:30   이 사이에는 방에 올리지 않는다(새벽 글은 끝나는 시각에 한꺼번에). quiet off 로 끈다. run 을 다시 켜야 적용
  python excer_bot.py reset           본 글 기록을 비운다. 다음 run 은 처음 켤 때처럼 알리지 않고 기억만 한 뒤 방 공지가 지금 글과 다르면 공지 글을 새로 올린다
                                      (사이트 글을 한꺼번에 옮기거나 지운 뒤, 새 벙과 취소 알림이 쏟아지지 않게). run 을 먼저 Ctrl+C
  python excer_bot.py list            지금 목록을 찍어 본다(보내지 않음)
  python excer_bot.py test            시험 방에 지금 목록을 보내고 공지까지 걸어 본다
  python excer_bot.py run --test      시험 방으로 늘 지켜보기(알릴 방은 건드리지 않음, 기록도 따로)
  python excer_bot.py run             알릴 방으로 늘 지켜보기(멈추려면 Ctrl+C)
  python excer_bot.py sample-feed     시험 파일(excer_bot_feed.json)을 만든다. run --test --feed excer_bot_feed.json 으로 켜고
  python excer_bot.py feed add        다른 창에서 feed add, change, close, del, soon, full, deadline 으로 새 벙, 바뀜, 마감, 취소,
                                      곧 시작하는 벙, 정원 참, 2분 뒤 신청 마감을 흉내 낸다
  python excer_bot.py study           시험 방에서 카카오톡 화면을 단계마다 적고 클립보드에 담는다(목록, 방, 방 메뉴, 톡게시판,
                                      길게 누른 메뉴, 공지 창. 글을 올리거나 공지를 거는 단추는 누르지 않는다)
  python excer_bot.py ui              지금 화면의 글자와 단추 이름을 excer_bot_ui.txt 에 적는다(안 될 때 원인 찾기용,
                                      시험 방을 띄워 놓고 쓴다. 화면에 보이는 대화 글이 들어간다. 맨 위에 창 목록)
  python excer_bot.py voice study     (tablet) 시험 방에 보이스룸을 실제로 하나 만들었다가 끝내며, 단계마다 화면(단추 이름)과
                                      신호(알림, 소리, 서비스)를 excer_bot_voice_study.txt 에 적고 클립보드에 담는다. docs/BOT_VOICE_ROOM.md
  python excer_bot.py voice status    보이스룸이 켜져 있는지(화면을 건드리지 않고 알림, 소리, 서비스로)와 최근 끊김 기록
  python excer_bot.py voice raw       그 신호의 원문을 excer_bot_voice_raw.txt 에 적고 클립보드에 담는다(해석기를 맞추는 근거.
                                      대화 글은 안 들어가고 보이스룸 알림 글자만 그대로)
  python excer_bot.py voice on        run 이 보이스룸도 지키게 켠다: 60초마다 보고 끊기면 다시 켜고(새로 만들거나 참여), 47.5시간이 지나면
                                      끝내고 새로 만든다. 실패하면 1, 2, 5, 10, 15분 간격으로 다시. voice off 로 끈다
  python excer_bot.py voice now       지금 바로 확인하고 꺼져 있으면 다시 켠다(한 번)
  python excer_bot.py voice look      켜 둔 보이스룸(알릴 방)의 띠와 보이스룸 화면 단추 이름을 excer_bot_voice_look.txt 에 적고
                                      클립보드에 담는다(갱신이 안 될 때 원인 찾기. 나가기는 누르지 않고 작게 접는다, 대화 글은 안 들어감)
  python excer_bot.py members         (tablet) 알릴 방 메뉴(세 줄 단추)에서 멤버를 지금 읽어 수와 가린 보기 다섯을 보이고
                                      excer_bot_members.txt 에 적는다(사이트에 올리지 않음). run 을 먼저 Ctrl+C
  python excer_bot.py members push    지금 읽어 사이트 닉네임 목록에 올린다. run 을 먼저 Ctrl+C
  python excer_bot.py members key     운영 화면 데이터 탭에서 복사한 봇 열쇠를 저장한다(클립보드에서 읽는다. 뒤에 열쇠를 적어도 된다.
                                      끝 네 글자만 보인다. members key off 로 지운다)
  python excer_bot.py members study   대화상대 칸 화면을 단계마다 excer_bot_members_study.txt 에 적고 클립보드에 담는다
                                      (멤버 이름은 가린다. 읽기가 안 될 때 원인 찾기). run 을 먼저 Ctrl+C
  python excer_bot.py members at 05:10   매일 멤버를 읽어 올리는 시각. members at off 로 끈다. run 을 다시 켜야 적용
  python excer_bot.py rotate 가로     (tablet) 화면 방향을 가로로 고정한다(기본). rotate 세로, rotate off(봇이 방향을 건드리지 않음).
                                      바로 고정하고, run 은 카카오톡을 띄울 때마다 자동 회전을 끄고 다시 맞춘다
  python excer_bot.py calibrate       (pc) 우클릭 메뉴의 복사, 공지 자리를 잡는다
  python excer_bot.py once            한 번만 보고 끝낸다
기록: excer_bot_state.json(본 글, 시험 방은 excer_bot_test_state.json, 시험 파일은 excer_bot_feed_state.json),
      excer_bot_voice.json(보이스룸 켜짐과 끊김), excer_bot_alive.json(run 이 30초마다 남기는 살아 있음 표시),
      excer_bot_members.txt(members 로 읽은 멤버 이름), excer_bot.log(한 일). 이 파일 옆에 생긴다.
"""
import argparse
import json
import subprocess
import xml.etree.ElementTree as ET
import os
import re
import sys
import time
import unicodedata
import urllib.request
import urllib.error
import urllib.parse
from datetime import date, datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
VERSION = "2026-10-10.10"                    # 이 파일의 판. status 와 check 가 보여 준다. update 는 파일 내용으로 견준다(같은 날 고쳐도 받게)
RAW_URL = "https://raw.githubusercontent.com/kimjiho88/excer-site/main/tools/excer_bot.py"
KST = timezone(timedelta(hours=9))
DOW = "월화수목금토일"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^\d{2}:\d{2}$")

DEFAULTS = {
    "backend": "tablet",                 # tablet, android, pc, dry
    "room": "",                          # 알릴 방 이름(카카오톡에 보이는 그대로)
    "room_link": "https://open.kakao.com/o/geS7Tzy",   # (tablet) 알릴 방 오픈채팅 주소. 방이 열려 있지 않으면 이 주소로 바로 연다(목록을 훑지 않음). "" 이면 안 씀
    "test_room": "",                     # 시험 방(봇 계정과 나만 있는 방). test, calibrate 가 쓴다
    "notice": True,                      # 올린 목록을 공지로 걸지
    "check_sec": 20,                     # 사이트를 몇 초에 한 번 볼지
    "digest_at": "",                     # 매일 이 시각(예 "10:00")에 공지 글을 한 번 더 올린다. "" 이면 안 한다(차례대로 바뀌므로 기본은 끔)
    "digest_late_min": 180,              # 이 시각에서 이만큼 지나도록 못 올렸으면 그날은 건너뛴다
    "min_gap_sec": 60,                   # 한 번 올린 뒤 다음에 올리기까지(그 사이 바뀜은 모았다가)
    "quiet": [],                         # 이 사이에는 올리지 않는다. 예: ["00:00", "07:00"]. [] 이면 늘 올린다
    "net_kick": True,                    # (tablet) 사이트를 3분 넘게 못 읽으면 와이파이를 껐다 켠다(15분에 한 번). 유선이나 데이터만 쓰면 false
    "max_lines": 15,                     # 목록 줄 수 한도
    "notice_max_chars": 400,             # 공지 글 길이 한도(넘치는 벙은 '외 N건'). 카카오톡은 긴 글을 접어 보여 줘 봇이 말풍선을 찾기 어렵다
    "bulk_quiet": 6,                     # 한 차례에 새 벙과 지운 벙이 합쳐 이만큼 이상이면 알리지 않고 공지 글만(한꺼번에 옮기거나 지운 것). 알림이 이만큼 이상이면 한 줄로. 0 이면 끔
    "heartbeat_at": "09:00",             # 매일 이 시각에 시험 방에 '봇 정상' 한 줄(안 오면 태블릿을 본다). 조용한 시간이면 끝난 뒤. "" 이면 끔
    "members_at": "05:10",               # (tablet) 매일 이 시각에 알릴 방 메뉴(세 줄 단추)의 멤버를 읽어 사이트 닉네임 목록에 올린다. "" 이나 "off" 면 안 한다
    "members_key": "",                   # 봇 열쇠(운영 화면 데이터 탭에서 만들고 python excer_bot.py members key 로 넣는다). 멤버 목록만 바꿀 수 있다
    "members": {"min_ratio": 0.9, "min": 20, "rid": ""},   # 다 읽었다고 볼 몫(대화상대 수에서 봇을 뺀 수의 0.9), 대화상대 수를 못 읽었을 때 적어도 몇 명, 이름 칸 id(비우면 스스로)
    "site": "https://excer-site.vercel.app",
    "supa": "https://drggzlnzwvkhtalvkqyo.supabase.co",
    "link": True,                        # 목록 끝에 벙 일정 주소(pc 에서 공지가 자주 실패하면 false: 주소 미리보기가 늦게 떠 자리가 밀린다)
    "notice_attend": False,              # 공지 글에 참석 수(참석 N/정원)를 넣을지. 넣으면 참석자가 바뀔 때마다 공지를 새로 올리고 다시 건다. 끄면 '정원 N명'
    "pc": {"window": [40, 40, 460, 780], "input_dy": 80, "bubble": None, "menu_copy": None, "menu_notice": None, "confirm": None},
    "android": {"serial": "", "package": "com.kakao.talk"},
    "tablet": {"freeze": True,                 # 보낸 뒤 대화를 살짝 위로 올려 자동으로 내려가지 않게(바쁜 방에서 봇 글이 밀리지 않게)
              "serial": "", "package": "com.kakao.talk", "adb": "adb", "clip": "termux-clipboard-set", "return_to": "com.termux",
              "rotation": "landscape"},        # 화면 방향: landscape(가로), portrait(세로), off(건드리지 않음). 카카오톡을 띄울 때마다 자동 회전을 끄고 이 방향으로 고정
    # 보이스룸 지키기(docs/BOT_VOICE_ROOM.md): run 이 끊김을 알아채 기록하고 다시 켠다. room 이 비면 알릴 방
    "voice": {"on": False, "room": "", "title": "신입(날짜)분들 2주 내 벙 필참 🙏 자삭금지 🚫",   # 봇이 보이스룸을 만들 때 쓰는 제목(운영자가 정함)
              "check_sec": 60, "notif_word": "보이스룸",
              "on_text": "보이스룸에 참여 중", "end_text": "보이스룸 종료",   # 카카오톡 알림 글자(실측). 바뀌면 여기만
              "renew_hours": 47.5, "mute": True, "volume0": True, "recover": True,   # recover: 끊기면 다시 켠다(2단계). 끄면 기록만
              "kick_retry_min": 0, "max_new_per_day": 6, "alert_test_room": False},
}


class KakaoError(Exception):
    pass


class NotFound(KakaoError):
    """올린 글을 방 화면에서 찾지 못함(공지를 다시 걸 때 글을 한 번 더 올릴지 가른다)"""


class RoomUnreachable(KakaoError):
    """방까지 가지 못함(adb 끊김, 화면 읽기, 카카오톡). 공지 걸기 실패로 세지 않고 보내기 실패처럼 1분 뒤 다시"""


class RoomNotFound(RoomUnreachable):
    """채팅 목록을 끝까지 훑어도 방이 없음(방 이름이 바뀜 등). 되풀이할수록 길게 쉰다(ROOM_MISS_WAIT)"""


class Covered(KakaoError):
    """누를 자리가 다른 창(보이스룸 작은 창 등)에 다 가려 누르지 않음. 방을 못 찾은 것처럼 되풀이할수록 길게 쉰다.
    방까지 못 간 것(RoomUnreachable)으로 보지 않는다: 공지를 걸다 가리면 공지 걸기 실패로 센다"""


ROOM_MISS_WAIT = (60, 120, 300, 600, 900)               # 방을 못 찾은 뒤 다시 하기까지(초): 1분마다 목록을 헛되이 훑지 않게


# ── 설정, 기록, 남기기 ──
def load_cfg(path):
    cfg = json.loads(json.dumps(DEFAULTS))
    if os.path.exists(path):
        with open(path, encoding="utf-8-sig") as f:
            got = json.load(f)
        for k, v in got.items():
            if isinstance(v, dict) and isinstance(cfg.get(k), dict):
                cfg[k].update(v)
            else:
                cfg[k] = v
    return cfg


def cfg_diff(cfg, base=None):
    """설정 파일에 적을 것: 기본값과 다른 값만(기본값까지 적으면 나중에 코드의 기본값을 바꿔도 태블릿에는 옛 값이 남는다)"""
    base = DEFAULTS if base is None else base
    out = {}
    for k, v in cfg.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            d = cfg_diff(v, base[k])
            if d:
                out[k] = d
        elif k not in base or base[k] != v:
            out[k] = v
    return out


def save_cfg(path, cfg):
    save_json(path, cfg_diff(cfg))


def save_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def load_state(path):
    try:
        with open(path, encoding="utf-8-sig") as f:
            st = json.load(f)
        if isinstance(st, dict):
            st.setdefault("known", {})
            return st
    except (OSError, ValueError):
        pass
    return {"known": {}}


class Log:
    def __init__(self, path=None, echo=True):
        self.path, self.echo, self.lines = path, echo, []

    def __call__(self, msg):
        line = datetime.now(KST).strftime("%m-%d %H:%M:%S ") + str(msg)
        self.lines.append(line)
        if self.echo:
            try:
                print(line, flush=True)
            except UnicodeEncodeError:
                print(line.encode("utf-8", "replace").decode("ascii", "replace"), flush=True)
        if self.path:
            try:
                if os.path.exists(self.path) and os.path.getsize(self.path) > 1_000_000:
                    os.replace(self.path, self.path + ".old")
                with open(self.path, "a", encoding="utf-8") as f:
                    f.write(line + "\n")
            except OSError:
                pass


# ── 시각 ──
class Now:
    def __init__(self, dt):
        dt = dt.astimezone(KST)
        self.ymd, self.hm, self.ts = dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M"), dt.timestamp()


def md(ymd):
    y, m, d = (int(x) for x in ymd.split("-"))
    return "%d/%d(%s)" % (m, d, DOW[date(y, m, d).weekday()])


def mins(hm):
    h, m = hm.split(":")
    return int(h) * 60 + int(m)


def in_quiet(hm, q):
    if not q or len(q) != 2 or q[0] == q[1]:
        return False
    return (q[0] <= hm < q[1]) if q[0] < q[1] else (hm >= q[0] or hm < q[1])


# ── 사이트 읽기 ──
def clean(s, n):
    t = re.sub(r"\s+", " ", "" if s is None else str(s)).strip()
    return t[:n] + "..." if len(t) > n else t


def u16(s):
    """카카오톡(안드로이드)이 세는 글자 수: 이모지는 2"""
    return len((s or "").encode("utf-16-le")) // 2


INVIS_RE = re.compile("[\u00ad\u200b-\u200f\u2060-\u206f\ufe00-\ufe0f\ufeff]")
CUT_TAIL_RE = re.compile(r"(\s*(전체\s*보기|더\s*보기)\s*>?)+$")


def norm_txt(s):
    """화면 글자와 보낸 글을 견줄 때: 보이지 않는 글자(이모지 변형 선택자 등)를 빼고 공백을 하나로"""
    return re.sub(r"\s+", " ", INVIS_RE.sub("", s or "")).strip()


def text_core(s):
    """견주기용 알맹이: 보이지 않는 글자, 이모지, 기호, 띄어쓰기를 빼고 글자와 숫자만(카카오톡 띠나 카드가 이모지를 빼거나 다르게 보여도 같게)"""
    return re.sub(r"[\W_]+", "", norm_txt(s)).lower()


def same_head(shown, first, cut=True):
    """화면 글(공지 띠, 공지 카드)이 이 글의 첫 줄(first)인가: 알맹이가 첫 줄로 시작하거나, cut 이면 잘려 보인 첫 줄의 앞부분(알맹이 4자 이상)도.
    앞에 붙은 짧은 표시('공지' 같은, 알맹이 8자까지)는 건너뛰고 본다"""
    a = text_core(CUT_TAIL_RE.sub("", norm_txt(shown)).rstrip(" .\u2026"))
    b = text_core(first)
    if not a or not b:
        return False
    for j in range(min(8, len(a)) + 1):
        x = a[j:]
        if x and (x.startswith(b) or (cut and len(x) >= 4 and b.startswith(x))):
            return True
    return False


def notice_core(s):
    """공지 글 전체를 견줄 때의 알맹이: 글자와 숫자만(줄바꿈, 이모지, 기호, 끝의 말줄임표와 '전체보기' 는 뺀다)"""
    return text_core(CUT_TAIL_RE.sub("", norm_txt(s)).rstrip(" .\u2026"))


def strict_core(s):
    """공지 글 전체가 같은지 볼 때의 알맹이: 띄어쓰기와 줄바꿈, 이모지와 그림 기호(카카오톡이 빼거나 그림으로 바꿔 보일 수 있다), 끝의 말줄임표와
    '전체보기' 만 빼고 글자(크고 작은 것 그대로), 숫자, 문장 부호는 남긴다(1.5km 와 15km, At 과 AT 는 다른 글)"""
    s = CUT_TAIL_RE.sub("", INVIS_RE.sub("", s or "")).rstrip().rstrip(".\u2026").rstrip()
    return "".join(c for c in s if not c.isspace() and unicodedata.category(c) not in ("So", "Sk", "Me", "Mn", "Cf", "Co", "Cn", "Cs"))


def band_shows(band, text, others=()):
    """방 위쪽 공지 띠나 상세보기에서 읽은 글(band)이 이 공지 글(text)인가(strict_core 로 견준다).
    글 전체가 보이면(앞뒤에 글쓴이 줄이나 댓글이 붙어도) 같은 글. 다만 이 글을 품은 더 긴 다른 후보 글이 통째로 보이면 아니다(끝 줄만 뺀 새 글).
    앞부분만 보이면 첫 줄을 넘는 데까지 같고, 다른 후보(others: 전에 건 글, 올렸지만 걸렸는지 모르는 글, 최근에 올린 글) 가운데 그 앞부분을
    가진 것이 없을 때만 같은 글(후보를 모르면 글 전체가 보여야). 앞에 붙은 짧은 표시(8자까지)는 건너뛴다"""
    sa, sb = strict_core(band), strict_core(text)
    if not sa or not sb:
        return False
    alts = {strict_core(x) for x in others if x} - {sb, ""}
    if sb in sa:
        return whole_notice(band, text) and not any(len(o) > len(sb) and sb in o and o in sa for o in alts)
    ls = text.split("\n")
    first = strict_core(ls[0] + (ls[1] if len(ls) > 1 and ls[1].startswith(EMO["go"]) else ""))   # 첫 줄과 둘째 줄의 참석 주소(모든 공지에 같다)
    if not alts:
        return False
    for j in range(min(8, len(sa)) + 1):
        x = sa[j:]
        if len(x) > len(first) + 1 and sb.startswith(x) and not any(o.startswith(x) for o in alts):
            return True
    return False


def notice_line(line):
    """봇 공지 글의 줄처럼 생겼는지(📣, 👉, 카드 번호, 📍, 👥, 🔒, 🗓, ⏳ 로 시작하거나 '외 N건')"""
    t = (line or "").strip()
    return t.startswith((EMO["next"], EMO["go"], EMO["place"], EMO["people"], EMO["벙 마감"], EMO["later"], EMO["live"]) + tuple(CARD_NO)) \
        or bool(re.match(r"외 \d+건$", t))


def whole_notice(band, text):
    """읽은 글(band) 안에 이 공지 글(text)이 줄 단위로 통째로 들어 있고, 그 뒤에 공지 줄이 더 이어지지 않는지(끝 줄만 뺀 새 글을
    더 긴 옛 공지 안에서 찾아 같다고 하지 않게. 상세보기의 글쓴이 줄과 아래 댓글은 붙어도 된다). 줄이 없이 한 줄로 보인 글은 글자로만"""
    raw = [l for l in (band or "").split("\n") if strict_core(l)]
    a, b = [strict_core(l) for l in raw], [strict_core(l) for l in (text or "").split("\n") if strict_core(l)]
    if len(a) < 2 or not b:
        return True
    for i in range(len(a)):
        if a[i].endswith(b[0]) and a[i + 1:i + len(b)] == b[1:]:
            return not (i + len(b) < len(raw) and notice_line(raw[i + len(b)]))
    return False


def band_verdict(shown, text, others=(), sure=False):
    """방에 걸린 공지 글(shown: 띠나 상세보기에서 읽은 글)이 이 공지 글(text)과 'same'(같음), 'diff'(다름), '?'(모름).
    다르다고는 확실히 읽었을 때만(sure: 띠의 '핀 고정' 단추로 찾았거나 상세보기) 본다. 앞부분만 보이는데 그 앞부분이 같으면 모름"""
    if band_shows(shown, text, others):
        return "same"
    a, b = notice_core(shown), notice_core(text)
    if not sure or not a or not b:
        return "?"
    if any(a[j:] and b.startswith(a[j:]) for j in range(min(8, len(a)) + 1)):
        return "?"
    return "diff"


def notice_change(old, new):
    """올리는 공지 글이 지난번 글과 어디가 다른지 한 줄로(기록용). 첫 줄이 다르거나 지난번 글을 모르면 ''"""
    ol, nl = [norm_txt(l) for l in (old or "").split("\n")], [norm_txt(l) for l in (new or "").split("\n")]
    if not old or ol[0] != nl[0]:
        return ""
    added = [l for l in nl[1:] if l and l not in ol]
    if added:
        return "바뀐 줄 '%s'" % added[0][:40]
    gone = [l for l in ol[1:] if l and l not in nl]
    return "빠진 줄 '%s'" % gone[0][:40] if gone else ""


def cut_of(t, want):
    """화면의 글(t)이 보낸 글(want)의 앞부분이 잘려 보이는 것인가. 둘 다 norm_txt 를 거친 것.
    카카오톡은 긴 글을 접어 보이며 끝에 말줄임표나 '전체보기' 를 붙이고, 잘린 자리의 이모지가 깨질 수 있다"""
    t = CUT_TAIL_RE.sub("", t).rstrip(" .\u2026\ufffd")
    return len(t) >= 60 and (want.startswith(t) or want.startswith(t[:-2]))


def norm(p):
    if not isinstance(p, dict) or p.get("id") is None:
        return None
    m = p.get("meta") if isinstance(p.get("meta"), dict) else {}
    if m.get("kind") and m.get("kind") != "bung":
        m = {}
    d, t, e = str(m.get("date") or ""), str(m.get("time") or ""), str(m.get("end") or "")
    try:
        cap = int(round(float(m.get("cap")))) if m.get("cap") not in (None, "") and float(m.get("cap")) > 0 else 0
    except (TypeError, ValueError):
        cap = 0
    dl = str(m.get("deadline") or "")
    try:
        att = int(p["attend_count"]) if p.get("attend_count") is not None else None
    except (TypeError, ValueError):
        att = None
    return {"id": str(p["id"]), "title": clean(p.get("title"), 40) or "제목 없음", "author": clean(p.get("author"), 20),
            "date": d if DATE_RE.match(d) else "", "time": t if TIME_RE.match(t) else "", "end": e if TIME_RE.match(e) else "",
            "place": clean(m.get("place"), 40), "addr": clean(m.get("addr"), 60), "cap": cap, "closed": m.get("status") == "closed",
            "deadline": dl if re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$", dl) else "",
            "attend": att, "full": bool(cap and att is not None and att >= cap),
            "created": str(p.get("created_at") or "")}


def http_get(url, headers=None, timeout=15):
    """압축(gzip)을 받는다: 20초마다 읽는 글 목록이 비압축이면 달마다 수백 MB 가 나간다"""
    import gzip
    req = urllib.request.Request(url, headers=dict({"User-Agent": "excer-bot/1", "Accept-Encoding": "gzip"}, **(headers or {})))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read()
            if (r.headers.get("Content-Encoding") or "").lower() == "gzip":
                body = gzip.decompress(body)
            return r.status, body.decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def http_post(url, data, headers=None, timeout=20):
    """POST(JSON 몸통 data, bytes). 받는 것은 http_get 과 같다(압축, 응답 코드, 오류 응답의 글)"""
    import gzip
    req = urllib.request.Request(url, data=data, method="POST", headers=dict(
        {"User-Agent": "excer-bot/1", "Accept-Encoding": "gzip", "Content-Type": "application/json"}, **(headers or {})))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read()
            if (r.headers.get("Content-Encoding") or "").lower() == "gzip":
                body = gzip.decompress(body)
            return r.status, body.decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


class Site:
    def __init__(self, cfg, get=None, post=None):
        self.cfg, self.get, self.post, self.key = cfg, get or http_get, post or http_post, ""

    def anon_key(self, fresh=False):
        if self.key and not fresh:
            return self.key
        code, body = self.get(self.cfg["site"] + "/assets/site-core.js")
        m = code == 200 and re.search(r'anon:\s*"([A-Za-z0-9._-]{40,})"', body)
        if not m:
            raise RuntimeError("사이트에서 접속 키를 읽지 못함(HTTP %s)" % code)
        self.key = m.group(1)
        return self.key

    def control(self):
        """운영 화면의 봇 원격 조종(공지 멈춤, 전체 멈춤). 이 SQL 을 아직 안 돌린 서버는 None"""
        url = self.cfg["supa"] + "/rest/v1/rpc/bot_control"
        for fresh in (False, True):
            k = self.anon_key(fresh)
            code, body = self.get(url, {"apikey": k, "Authorization": "Bearer " + k})
            if code != 401:
                break
        if code == 404:
            return None
        if not 200 <= code < 300:
            raise RuntimeError("조종 값을 읽지 못함(HTTP %s)" % code)
        d = json.loads(body)
        return d if isinstance(d, dict) else None

    def push_members(self, names, key):
        """봇 멤버 자동 갱신(2026-10-09-memberbot.sql): 읽은 멤버 이름을 봇 열쇠와 함께 올린다(member_sync).
        서버의 답(ok, n, skipped 또는 error)을 돌려준다. 그 SQL 을 아직 안 돌린 서버는 None. 열쇠는 어디에도 적지 않는다"""
        url = self.cfg["supa"] + "/rest/v1/rpc/member_sync"
        data = json.dumps({"p_key": key, "p_names": list(names)}, ensure_ascii=False).encode("utf-8")
        for fresh in (False, True):
            k = self.anon_key(fresh)
            code, body = self.post(url, data, {"apikey": k, "Authorization": "Bearer " + k})
            if code != 401:
                break
        if code == 404:
            return None
        if not 200 <= code < 300:
            raise RuntimeError("멤버 목록을 올리지 못함(HTTP %s)" % code)
        d = json.loads(body)
        if not isinstance(d, dict):
            raise RuntimeError("멤버 목록을 올린 답의 모양이 다름")
        return d

    def posts(self):
        """어제 이후 날짜의 모임 모집 글(최근 100개). 지난 글은 읽지 않으니 멀리 잡은 벙이 목록 밖으로 밀리지 않는다.
        어제 것도 읽는 까닭: 자정을 넘겨 끝나는 벙(19:00 시작 01:00 끝)이 자정에 공지에서 빠지지 않게"""
        cols = "id,title,author,meta,created_at" + ("" if getattr(self, "no_attend", False) else ",attend_count")
        q = urllib.parse.urlencode({"select": cols, "category": "eq.벙 소식", "meta->>date": "gte." + Now(datetime.now(KST) - timedelta(days=1)).ymd,
                                    "order": "created_at.desc", "limit": "100"}, quote_via=urllib.parse.quote)
        url = self.cfg["supa"] + "/rest/v1/site_posts_v?" + q
        for fresh in (False, True):
            k = self.anon_key(fresh)
            code, body = self.get(url, {"apikey": k, "Authorization": "Bearer " + k})
            if code != 401:
                break
        if code == 400 and "attend_count" in body and not getattr(self, "no_attend", False):
            self.no_attend = True                       # 참석 기능 SQL 을 아직 안 돌린 서버: 참석 수 없이 읽는다
            return self.posts()
        if not 200 <= code < 300:
            raise RuntimeError("글을 읽지 못함(HTTP %s) %s" % (code, body[:120]))
        rows = json.loads(body)
        if not isinstance(rows, list):
            raise RuntimeError("글 모양이 다름")
        self.last_full = len(rows) < 100                    # 100개보다 적으면 모임 모집 글을 전부 읽은 것
        return [v for v in (norm(r) for r in rows) if v]


class FileSite:
    """사이트 대신 파일에서 글을 읽는다(시험용). 파일은 사이트 글과 같은 모양의 목록"""
    def __init__(self, path):
        self.path, self.last_full = path, True

    def posts(self):
        with open(self.path, encoding="utf-8-sig") as f:
            rows = json.load(f)
        if not isinstance(rows, list):
            raise RuntimeError("시험 파일은 [ ] 로 감싼 목록이어야 함")
        return [v for v in (norm(r) for r in rows) if v]


# ── 견주기와 문구 ──
def now_key(now):
    return now.ymd + "T" + now.hm


def start_key(v):
    return v["date"] + "T" + (v["time"] or "23:59")


def deadline_key(v):
    return v.get("deadline") or start_key(v)


def end_key(v):
    """끝나는 시각. 시작보다 이르거나 같으면 다음 날(19:00 시작 01:00 끝). 끝나는 시간이 없는 옛 글은 시작 시각"""
    e = v.get("end") or ""
    if not e or not v["date"]:
        return start_key(v)
    if e > (v["time"] or "23:59"):
        return v["date"] + "T" + e
    y, m, d = (int(x) for x in v["date"].split("-"))
    return (date(y, m, d) + timedelta(days=1)).isoformat() + "T" + e


def ongoing(v, now):
    """시작했고 아직 끝나지 않은 벙"""
    return bool(v["date"]) and start_key(v) <= now_key(now) < end_key(v)


def upcoming(v, now):
    """아직 끝나지 않았고(끝나는 시간이 없으면 시작 전) 마감하지 않은 벙"""
    return bool(v["date"]) and not v["closed"] and now_key(now) < end_key(v)


def recruiting(v, now):
    """모집 중: 마감 안 함, 정원 남음, 모임장이 정한 신청 마감 전, 끝나기 전. 공지에는 이 벙만 넣는다.
    신청 마감을 따로 정하지 않은 벙은 시작한 뒤에도 끝날 때까지 '진행 중'으로 공지에 남는다(시작 시각은 설정한 마감이 아니다)"""
    return upcoming(v, now) and not v.get("full") and (not v.get("deadline") or now_key(now) < v["deadline"])


def dl_text(v):
    d = v.get("deadline") or ""
    if not d or d == start_key(v):
        return ""
    return "신청 " + ("" if d[:10] == v["date"] else md(d[:10]) + " ") + d[11:16] + "까지"


def skey(v):
    """날짜, 시작 시각, 사이트에 등록한 차례(글 번호가 작은 것이 먼저 등록한 글)"""
    return (v["date"], v["time"] or "99:99", int(v["id"]) if v["id"].isdigit() else 0)


def notice_rank(v, at):
    """공지 카드의 차례: 진행 중 0, 시작 전 1, 끝남 2. at 이 없으면 모두 1(시간 차례만)"""
    if at is None:
        return 1
    k = now_key(at)
    if start_key(v) <= k < end_key(v):
        return 0
    return 1 if k < start_key(v) else 2


def head(v):
    return (md(v["date"]) if v["date"] else "날짜 미정") + (" " + v["time"] + ("~" + v["end"] if v.get("end") else "") if v["time"] else "") + " " + v["title"]


def line(v):
    return head(v) + (", " + v["place"] if v["place"] and v["place"] not in v["title"] else "")   # 제목에 이미 장소가 있으면 되풀이하지 않는다


def sig(v):
    return {"d": v["date"], "t": v["time"], "p": v["place"], "c": 1 if v["closed"] else 0, "n": v["title"], "cr": v["created"],
            "dl": v.get("deadline") or "", "f": 1 if v.get("full") else 0, "cap": v.get("cap") or 0, "e": v.get("end") or ""}


def sig_live(o, now):
    """기록된 글이 아직 살아 있는가: 날짜가 오늘 이후이거나, 어제 시작해 자정을 넘겨 아직 끝나지 않은 벙"""
    if not o or not o.get("d"):
        return False
    if o["d"] >= now.ymd:
        return True
    return bool(o.get("e")) and now_key(now) < end_key({"date": o["d"], "time": o.get("t") or "", "end": o["e"]})


def live_reason(v):
    """진행 중인데 마감인 까닭(공지의 진행 중 줄에 적는다)"""
    return "모집 마감" if v["closed"] else "정원 마감" if v.get("full") else "신청 마감"


def noch():
    return {"new": [], "chg": [], "cls": [], "full": [], "del": []}


def diff(known, posts, now, init, full=False):
    """지난번에 본 글(known)과 견준다. 기록을 바꾸지 않고 (새 기록, 바뀜)을 돌려준다.
    full: 모임 모집 글을 전부 읽었는지(전부면 안 보이는 글은 지워진 것)"""
    cur, ch = {}, noch()
    for v in posts:
        cur[v["id"]] = sig(v)
        if not init:
            continue
        o = known.get(v["id"])
        if not o:
            if upcoming(v, now):
                ch["new"].append(v)
            continue
        if v["date"] and (now_key(now) >= end_key(v) if v.get("end") else v["date"] < now.ymd):
            continue                                   # 끝난 벙은 알리지 않는다(끝난 뒤 정리하려고 마감하거나 고쳐도). 자정을 넘겨 진행 중인 어제 벙은 아직 산 것
        if v["closed"]:
            if not o.get("c"):
                ch["cls"].append(v)
            continue
        f = [n for n, a, b in (("날짜", o.get("d"), v["date"]), ("시간", o.get("t"), v["time"]), ("장소", o.get("p"), v["place"]),
                                ("신청 마감", o.get("dl"), v.get("deadline"))) if (a or "") != (b or "")]
        if "cap" in o and (o.get("cap") or 0) != (v.get("cap") or 0):
            f.append("정원")                            # 예전 기록에 정원이 없으면(이 판 이전) 바뀐 것으로 치지 않는다
        if "e" in o and (o.get("e") or "") != (v.get("end") or ""):
            f.append("끝나는 시간")
        if v.get("full") and not o.get("f"):
            ch["full"].append(v)                       # 정원이 찼다(정원을 줄여서 찬 것이면 마감 알림 한 번에 참석과 정원을 적는다)
            f = [x for x in f if x != "정원"]
        elif (o.get("c") or o.get("f")) and not v.get("full") and recruiting(v, now):
            f.append("마감 풀림")                       # 마감을 풀었거나 자리가 났다(신청 마감이 지났으면 다시 모집이 아니다)
        if f:
            ch["chg"].append((dict(v, _old=o), f))
    # 안 보이는 글: 지워졌으면 알리고, 최근 100개 밖으로 밀려난 것이면 기억해 둔다(다시 보여도 새 글로 치지 않게)
    oldest = min((v["created"] for v in posts if v["created"]), default="")
    for k, o in known.items():
        if k in cur or not o or o.get("c"):
            continue
        if not sig_live(o, now):
            continue                                   # 지난 글은 잊는다
        if init and (full or (o.get("cr") and oldest and o["cr"] > oldest)):   # 읽은 범위 안의 글이 없어졌으면 지워진 것
            ch["del"].append({"id": k, "date": o.get("d") or "", "time": o.get("t") or "", "title": o.get("n") or "제목 없음", "place": o.get("p") or ""})
            continue
        cur[k] = o
    return cur, ch


def hm_of(ts):
    """초를 '10-09 15:30' 으로(한국 시간)"""
    try:
        return datetime.fromtimestamp(float(ts), KST).strftime("%m-%d %H:%M")
    except (ValueError, OverflowError, OSError, TypeError):
        return "?"


def ctl_text(bot, ts):
    """운영 화면의 원격 조종 상태 한 줄. 평소면 빈 글자"""
    c = getattr(bot, "ctl", None) or {}
    parts = (["전체 멈춤 %s까지" % hm_of(c["pause"])] if float(c.get("pause") or 0) > ts else []) + \
            (["공지 멈춤 %s까지" % hm_of(c["notice"])] if float(c.get("notice") or 0) > ts else [])
    return ", ".join(parts)


def beat_text(bot, now):
    """시험 방에 매일 올리는 한 줄: 판, 사이트를 본 때와 실패, 공지 상태"""
    st = bot.st
    lc = float(getattr(bot, "last_check", 0) or 0)
    out = ["\u2705 봇 정상 %s %s (판 %s)" % (md(now.ymd), now.hm, VERSION),
           "사이트: %s 확인, %s" % (datetime.fromtimestamp(lc, KST).strftime("%H:%M") if lc else "아직 안 봄",
                                 "읽기 실패 %d번 이어짐" % bot.read_fails if getattr(bot, "read_fails", 0) else "실패 없음")]
    if st.get("notice_gaveup"):
        out.append("공지: 걸기를 쉬는 중. 방에 올린 마지막 공지 글을 직접 공지로 걸어 주세요")
    elif st.get("notice_fail"):
        out.append("공지: 걸기 실패 %d번, 다시 거는 중" % int(st["notice_fail"]))
    elif st.get("notice_text"):
        out.append("공지: " + st["notice_text"].split("\n")[0])
    if getattr(bot, "send_fails", 0):
        out.append("보내기 실패 %d번 이어짐" % bot.send_fails)
    if ctl_text(bot, now.ts):
        out.append("운영 화면: " + ctl_text(bot, now.ts))
    if members_beat(bot):
        out.append(members_beat(bot))
    return "\n".join(out)


def members_at(cfg):
    """매일 멤버를 읽어 올리는 시각(HH:MM). 꺼 두었거나('' 또는 off) 모양이 틀리면 ''"""
    at = str(cfg.get("members_at") or "").strip()
    return at if TIME_RE.match(at) and at < "24:00" else ""


def members_on(bot):
    """이 run 이 멤버 자동 갱신을 하는가: tablet 방식, 알릴 방(시험 방이나 시험 파일이 아님), 사이트에 올리는 길이 있음"""
    cfg = getattr(bot, "cfg", None) or {}
    return isinstance(getattr(bot, "sender", None), AdbSender) and hasattr(getattr(bot, "site", None), "push_members") \
        and bool(cfg.get("room")) and getattr(bot, "room", "") == cfg.get("room")


def member_key_tag(key):
    """열쇠를 알아보는 짧은 표(기록에는 열쇠 대신 이것만 남긴다)"""
    import hashlib
    return hashlib.sha256((key or "").encode("utf-8")).hexdigest()[:10]


def members_short(why):
    """기록과 '봇 정상' 줄에 남길 짧은 까닭: 첫 문장만, 앞의 '멤버 목록을 올리지 못함' 같은 말은 빼고(고칠 방법은 기록 파일에)"""
    t = re.sub(r"^멤버(?: 목록을 올리지 (?:못함|않음)|를 다 읽지 못함)[:\s]*", "", re.split(r"\.\s", str(why))[0])
    return clean(t[1:-1] if t.startswith("(") and t.endswith(")") else t, 60)


def members_result(r):
    """member_sync 의 답을 (가름, 한 줄)로. 가름: ok, stop(오늘은 다시 안 함), key(열쇠를 바꿀 때까지 안 함), retry(30분 뒤 다시)"""
    if r is None:
        return "stop", "멤버 목록을 올리지 못함: 서버에 2026-10-09-memberbot.sql 을 먼저 실행해야 함"
    if r.get("ok"):
        sk = int(r.get("skipped") or 0)
        return "ok", "멤버 목록 %d명을 사이트에 올림%s" % (int(r.get("n") or 0), "(겹치거나 쓸 수 없는 이름 %d개 뺌)" % sk if sk else "")
    e = str(r.get("error") or "")
    if e == "SHRINK":
        return "stop", ("멤버 목록을 올리지 않음: 사이트 목록 %s명에서 %s명으로 줄어 서버가 막음. 방 메뉴의 멤버를 다 읽었는지 python excer_bot.py members 로 확인. "
                        "방 인원이 실제로 그만큼 줄었으면 운영 화면 데이터 탭의 '사이트에 올리기' 로 한 번 올리면 다음 날부터 다시 됨" % (r.get("now"), r.get("got")))
    if e == "BAD_KEY":
        return "key", "멤버 목록을 올리지 못함: 봇 열쇠가 맞지 않음. 운영 화면 데이터 탭에서 봇 열쇠를 다시 만들고 python excer_bot.py members key"
    if e == "NO_KEY":
        return "key", "멤버 목록을 올리지 못함: 서버에 봇 열쇠가 없음(운영 화면에서 껐거나 아직 안 만듦). 운영 화면 데이터 탭에서 봇 열쇠를 만들고 python excer_bot.py members key"
    if e == "RATE_LIMIT":
        return "retry", "멤버 목록을 올리지 못함: 서버가 잠시 막음(1시간에 30번까지)"
    if e in ("EMPTY", "BAD_NAMES", "TOO_MANY"):
        return "stop", "멤버 목록을 올리지 못함: 서버가 이름을 받지 않음(%s)" % e
    return "retry", "멤버 목록을 올리지 못함(%s)" % (e or "알 수 없는 답")


def members_last_text(last, when=True):
    """마지막 멤버 갱신: '10/10 05:10 123명' 또는 '10/10 05:40 읽기 실패(까닭)'. when=False 면 실패에 때를 붙이지 않는다"""
    if not isinstance(last, dict) or not last.get("at"):
        return ""
    m = re.match(r"^\d{4}-(\d{2})-(\d{2}) (\d{2}:\d{2})", str(last["at"]))
    t = "%d/%d %s" % (int(m.group(1)), int(m.group(2)), m.group(3)) if m else str(last["at"])
    if last.get("error"):
        return (t + " " if when else "") + "%s 실패(%s)" % ("올리기" if last.get("step") == "push" else "읽기", last["error"])
    return "%s %d명" % (t, int(last.get("n") or 0))


def members_beat(bot):
    """'봇 정상' 줄에 붙일 멤버 한 줄: '멤버: 10/10 05:10 123명' 또는 '멤버: 읽기 실패(까닭)'. 하지 않거나 아직 없으면 ''"""
    cfg = getattr(bot, "cfg", None) or {}
    if not (members_on(bot) and members_at(cfg) and cfg.get("members_key")):
        return ""
    t = members_last_text((getattr(bot, "st", None) or {}).get("members_last"), when=False)
    return "멤버: " + t if t else ""


def members_alive(bot):
    """살아 있음 표시에 남길 멤버 자동 갱신 상태(status 가 '멤버 자동 갱신:' 으로 보인다). 이 run 이 하지 않는 일이면 ''"""
    if not members_on(bot):
        return ""
    cfg, st = bot.cfg, bot.st
    at, key = members_at(cfg), cfg.get("members_key") or ""
    if not at:
        return "꺼짐(켜려면 python excer_bot.py members at 05:10)"
    if not key:
        return "봇 열쇠 없음(운영 화면 데이터 탭에서 만들고 python excer_bot.py members key)"
    t = members_last_text(st.get("members_last"))
    out = ["매일 " + at, "마지막 " + t if t else "아직 안 함"]
    if st.get("members_badkey") == member_key_tag(key):
        out.append("열쇠를 바꿀 때까지 쉼")
    elif float(st.get("members_retry_at") or 0) > bot.ts():
        out.append("%s 에 다시" % hm_of(st["members_retry_at"])[6:])
    return ", ".join(out)


def has_changes(ch):
    return bool(ch["new"] or ch["chg"] or ch["cls"] or ch.get("full") or ch.get("del"))


# 카카오톡은 글자만 보내므로 이모지로 줄의 뜻을 표시한다. 공지 띠에는 첫 100자쯤이 보여 첫 줄에 오늘 날짜와 벙 수, 그 아래 첫 카드를 둔다
EMO = {"next": "\U0001F4E3", "place": "\U0001F4CD", "people": "\U0001F465", "later": "\U0001F5D3", "go": "\U0001F449", "bell": "\U0001F514", "live": "⏳",
       "새 벙": "\U0001F195", "벙 변경": "\u270F\uFE0F", "벙 마감": "\U0001F512", "벙 다시 모집": "\U0001F513", "벙 취소": "\u274C"}
CARD_NO = ["%d\uFE0F\u20E3" % n for n in range(1, 5)]   # 공지 카드 번호(숫자 이모지 1부터 4). 카드는 넷까지


def place_line(v):
    p, a = v.get("place") or "", v.get("addr") or ""
    if not p and not a:
        return ""
    return EMO["place"] + " " + (p + (", " + a if a and a not in p else "") if p else a)


def people_line(v, host=False, live=True):
    """live: 참석 수까지(알림). 공지 글은 기본으로 정원만 적는다(참석자가 바뀔 때마다 공지를 다시 올리지 않게)"""
    parts = []
    if live and v.get("attend") is not None and v.get("cap"):
        parts.append("참석 %d/%d" % (v["attend"], v["cap"]))
    elif live and v.get("attend"):
        parts.append("참석 %d명" % v["attend"])          # 인원을 정하지 않은 모임(49차부터 선택)
    elif v.get("cap"):
        parts.append("정원 %d명" % v["cap"])
    if host and v.get("author"):
        parts.append("벙주 " + v["author"])
    if dl_text(v):
        parts.append(dl_text(v))
    return (EMO["people"] + " " + ", ".join(parts)) if parts else ""


def live_line(v):
    """진행 중이지만 마감인 벙의 줄: 제목, 장소, 끝나는 시각, 마감 까닭"""
    return EMO["live"] + " 진행 중 " + v["title"] + (", " + v["place"] if v["place"] and v["place"] not in v["title"] else "") + \
        (" " + v["end"] + "까지" if v.get("end") else "") + " (" + live_reason(v) + ")"


def day_turn(cfg):
    """공지 글의 오늘이 다음 날로 넘어가는 시각: 조용한 시간이 끝나는 때(12:00 전일 때만). 조용한 시간이 없으면 자정"""
    q = cfg.get("quiet") or []
    e = str(q[1]) if len(q) == 2 and q[0] != q[1] else ""
    return e if TIME_RE.match(e) and e < "12:00" and e[3:] < "60" else "00:00"   # 손으로 고친 설정의 07:60 같은 값은 자정


def notice_day(now, cfg):
    """공지 글의 오늘. 넘어가는 시각 전이면 전날(조용한 시간 00:30~07:30 이면 07:30 전까지는 전날 벙 공지 그대로)"""
    if now.hm >= day_turn(cfg):
        return now.ymd
    y, m, d = (int(x) for x in now.ymd.split("-"))
    return (date(y, m, d) - timedelta(days=1)).isoformat()


def span(v):
    """카드의 시간: 19:00~21:00, 끝나는 시간이 없는 옛 글은 19:00, 시간이 없으면 '시간 미정'"""
    return (v["time"] + ("~" + v["end"] if v.get("end") else "")) if v["time"] else "시간 미정"


def notice_text(posts, now, cfg, at="now"):
    return notice_build(posts, now, cfg, at)[0]


def notice_build(posts, now, cfg, at="now"):
    """공지로 걸 글(카드형)과 카드로 보인 벙의 번호들. 첫 줄 '오늘의 벙 10/9(금) 3건', 둘째 줄 참석 주소(공지 띠에 보이는 두 줄),
    오늘 벙은 카드로(번호와 시간, 제목, 장소, 정원과 신청 마감). 카드는 at(기본은 now) 때 진행 중인 벙, 다음 시간 벙, 시간이 지난 벙 차례
    (같은 시각이면 먼저 등록한 글이 위). 넷까지, 넘으면 '외 N건'. 마감했거나 정원이 찬 오늘 벙은 그 아래 '마감' 한 줄씩,
    그다음 이후 벙 한 줄(오늘 벙이 없으면 장소까지). 시작했거나 끝났거나 신청 마감이 지난 오늘 벙도 그날은 카드로 남는다.
    오늘은 조용한 시간이 끝날 때(없으면 자정) 넘어간다"""
    at = now if at == "now" else at
    today = notice_day(now, cfg)
    y, m, d = (int(x) for x in today.split("-"))
    t0 = day_turn(cfg)
    day0 = Now(datetime(y, m, d, int(t0[:2]), int(t0[3:]), tzinfo=KST))   # 이후 벙은 오늘이 시작한 때 기준으로 모집 중(그날 신청 마감이 지나도 글이 그대로)
    nextday = (date(y, m, d) + timedelta(days=1)).isoformat()
    # 오늘 날짜의 벙 가운데 오늘이 시작하기 전에 이미 끝난 것(조용한 시간 07:30 이면 새벽 01:50~02:50 벙)은 넣지 않는다(전날 공지의 이후 줄에 있었다)
    gone = lambda v: t0 != "00:00" and end_key(v) <= now_key(day0)
    on = sorted([v for v in posts if v["date"] == today and not gone(v) and not v["closed"] and not v.get("full")], key=lambda v: (notice_rank(v, at), skey(v)))
    off = sorted([v for v in posts if v["date"] == today and not gone(v) and (v["closed"] or v.get("full"))], key=skey)
    later = sorted([v for v in posts if v["date"] > today and recruiting(v, day0)], key=skey)
    live = bool(cfg.get("notice_attend"))
    lock = EMO["벙 마감"] + " 마감 "

    def build(nc, ns, pin):
        """nc: 카드 수, ns: 마감 줄 수(0 이면 '마감 N건' 한 줄), pin: 다음 벙의 장소 줄"""
        out = [EMO["next"] + " 오늘의 벙 " + md(today) + (" %d건" % len(on) if on else " 모두 마감" if off else " 없음")]
        if cfg.get("link", True):                        # 둘째 줄도 공지 띠에 보인다
            out.append(EMO["go"] + (" 참석 " if on else " 벙 올리기 ") + cfg["site"] + "/bung")
        for n, v in enumerate(on[:nc]):
            out += ["", CARD_NO[n] + " " + span(v) + " " + v["title"]] + \
                [l for l in ((EMO["place"] + " " + v["place"]) if v["place"] else "", people_line(v, live=live)) if l]   # 장소 이름만(상세 주소는 글에)
        if len(on) > nc:
            out += ["", "외 %d건" % (len(on) - nc)]
        if off and ns:
            out += [""] + [lock + " ".join(x for x in (v["time"], v["title"]) if x) for v in off[:ns]] + \
                (["%s외 %d건" % (lock, len(off) - ns)] if len(off) > ns else [])
        elif off:
            out += ["", "%s%d건" % (lock, len(off))]
        if later:
            v = later[0]
            k = sum(1 for x in later[1:] if x["date"] == v["date"])   # '외 N건' 은 그 날의 다른 벙만(내일 3건처럼 읽히지 않게)
            more = " 외 %d건" % k if k else ""
            if on or off:                                # 오늘 벙이 있으면 한 줄(다음 날이면 '내일'), 끝 줄(주소)이 바로 아래
                out += ["", " ".join(x for x in (EMO["later"], "내일" if v["date"] == nextday else "다음 벙", md(v["date"]), v["time"], v["title"]) if x) + more]
            else:                                        # 오늘 벙이 없으면 다음 벙을 시간 범위와 장소까지
                out += ["", " ".join((EMO["later"], "다음 벙", md(v["date"]), span(v), v["title"])) + more] + \
                    ([EMO["place"] + " " + v["place"]] if pin and v["place"] else [])
        return "\n".join(out)

    cap = int(cfg.get("notice_max_chars", 400) or 0)    # 글 길이 한도(0 이면 없음). 넘치면 마감 줄부터 줄이고('마감 N건'), 카드를 줄이고('외 N건'), 다음 벙의 장소 줄을 뺀다
    nc, ns, pin = min(len(on), len(CARD_NO)), min(len(off), 3), True
    text = build(nc, ns, pin)
    while cap and u16(text) > cap and (nc > 1 or ns or pin):
        if ns:
            ns -= 1                                          # 신청할 수 있는 카드보다 마감 줄을 먼저 줄인다
        elif nc > 1:
            nc -= 1
        else:
            pin = False
        text = build(nc, ns, pin)
    return text, [v["id"] for v in on[:nc]]


def notice_reorder_due(posts, now, cfg, then_ids, ids):
    """시각만 지나 카드 차례가 바뀐 공지를 다시 올릴지: 지금 카드로 보여야 할 진행 중이나 시작 전 벙이 올린 공지에서는 '외 N건' 에 가려져 있었으면"""
    alive = {v["id"] for v in posts if notice_rank(v, now) < 2}
    return bool((set(ids) & alive) - set(then_ids))


def bung_link(cfg, v):
    """그 벙으로 바로 가는 주소(소식의 모임 모집 탭에서 그 글을 펼친다. 카카오톡 미리보기 상자를 눌러도 같은 곳)"""
    return cfg["site"] + "/bung?id=" + v["id"]


def alert_text(ch, cfg):
    return "\n\n".join(alert_msgs(ch, cfg))


def alert_key(a):
    """보낸 알림을 알아보는 열쇠. 한 벙 알림은 끝의 그 벙 주소 줄(다시 보내는 사이 참석 수가 바뀌어도 같은 알림), 여럿을 묶은 알림은 글 전체"""
    last = a.rsplit("\n", 1)[-1]
    return last if "/bung?id=" in last else a


def alert_msgs(ch, cfg):
    """바뀐 것 알림(공지와 따로 올리는 메시지들). 새 벙은 하나씩 따로(채팅방에 한 번 공유: 장소, 인원, 벙주, 그 벙으로 바로 가는 주소).
    나머지(바뀜, 마감, 다시 모집, 취소)는 하나면 자세히, 여럿이면 한 메시지에 한 줄씩. 모두 bulk_quiet(6)건 넘으면 한 줄 요약"""
    items = []
    for v in sorted(ch["new"], key=skey):
        items.append(("새 벙", v, ""))
    for v, f in ch["chg"]:
        rest = [x for x in f if x != "마감 풀림"]
        items.append(("벙 다시 모집" if "마감 풀림" in f else "벙 변경", v, (", ".join(rest) + " 바뀜") if rest else ""))
    for v in ch["cls"]:
        items.append(("벙 마감", v, "모집 마감"))
    for v in ch.get("full", []):
        over = v.get("attend") is not None and v["attend"] > v["cap"]   # 모임장이 정원 너머로 적었거나 정원을 줄임
        items.append(("벙 마감", v, ("참석 %d명, 정원 %d명" % (v["attend"], v["cap"])) if over else "정원 %d명 다 참" % v["cap"]))
    for v in ch.get("del", []):
        items.append(("벙 취소", v, "모집 글 삭제"))
    if not items:
        return []
    tag = lambda kind: EMO.get(kind, "") + " " + kind

    def one(kind, v, d):
        out = [tag(kind) + " " + head(v)]
        cl = changes_line(ch, v) if kind in ("벙 변경", "벙 다시 모집") else ""
        if cl:
            out.append("바뀜: " + cl)
        elif d:
            out.append(d)
        if kind in ("새 벙", "벙 다시 모집", "벙 변경"):
            out += [l for l in (place_line(v), people_line(v, host=True)) if l]
        if kind != "벙 취소" and cfg.get("link", True):
            go = " 참석 " if kind == "새 벙" and not v["closed"] and not v.get("full") else " "   # 올릴 때 이미 마감했거나 정원이 찬 벙은 주소만
            out.append(EMO["go"] + go + bung_link(cfg, v))   # 미리보기 상자를 눌러도 그 벙으로
        return "\n".join(out)
    bulk = int(cfg.get("bulk_quiet", 6) or 0)
    if bulk and len(items) >= bulk:                   # 많으면 한 줄로(조용한 시간 뒤나 여러 글을 한꺼번에 고친 때). 내용은 공지와 사이트에
        cnt = {}
        for kind, v, d in items:
            cnt[kind] = cnt.get(kind, 0) + 1
        parts = ["%s %d" % (k, cnt[k]) for k in ("새 벙", "벙 변경", "벙 다시 모집", "벙 마감", "벙 취소") if cnt.get(k)]
        return ["\n".join([EMO["bell"] + " 벙 알림 %d건 (%s)" % (len(items), ", ".join(parts))] + ([EMO["go"] + " " + cfg["site"] + "/bung"] if cfg.get("link", True) else []))]
    msgs = [one(*it) for it in items if it[0] == "새 벙"]   # 새 벙은 하나씩 따로(그 벙의 미리보기 상자가 붙게)
    rest = [it for it in items if it[0] != "새 벙"]
    if len(rest) == 1:
        msgs.append(one(*rest[0]))
    elif rest:
        msgs.append("\n".join([EMO["bell"] + " 벙 알림 %d건" % len(rest)] +
                               ["%s %s%s" % (tag(kind), head(v), (" (" + d + ")") if d else "") for kind, v, d in rest]))
    return msgs


def changes_line(ch, v):
    for x, f in ch["chg"]:
        if x["id"] == v["id"]:
            o = x.get("_old") or {}
            parts = []
            if "날짜" in f:
                parts.append("날짜 %s 에서 %s" % (md(o["d"]) if o.get("d") else "없음", md(v["date"]) if v["date"] else "없음"))
            if "시간" in f:
                parts.append("시간 %s 에서 %s" % (o.get("t") or "없음", v["time"] or "없음"))
            if "장소" in f:
                parts.append("장소 %s 에서 %s" % (o.get("p") or "없음", v["place"] or "없음"))
            if "신청 마감" in f:
                fmt = lambda d: (md(d[:10]) + " " + d[11:16]) if d else "시작 시각"
                parts.append("신청 마감 %s 에서 %s" % (fmt(o.get("dl") or ""), fmt(v.get("deadline") or "")))
            if "정원" in f:
                parts.append("정원 %d명에서 %d명" % (o.get("cap") or 0, v.get("cap") or 0))
            if "끝나는 시간" in f:
                parts.append("끝나는 시간 %s 에서 %s" % (o.get("e") or "없음", v.get("end") or "없음"))
            return ", ".join(parts)
    return ""


def digest_due(st, now, cfg):
    at = cfg.get("digest_at") or ""
    if not at or st.get("last_digest") == now.ymd:
        return False
    late = mins(now.hm) - mins(at)
    if late < 0:
        return False
    if late > int(cfg.get("digest_late_min", 180)):
        return "skip"
    return True


# ── 한 차례 ──
NOTICE_RETRY = [60, 300, 900]                           # 공지 걸기가 실패하면 1분, 5분, 15분 뒤 다시(세 번까지)


class Bot:
    def __init__(self, cfg, sender, site, state_path, log, clock=None, room=None):
        self.cfg, self.sender, self.site, self.state_path, self.log = cfg, sender, site, state_path, log
        self.room = room or cfg["room"]
        self.clock = clock or (lambda: datetime.now(KST))
        self.st = load_state(state_path)
        self.last_check = 0.0
        self.hold_until = 0.0                           # 읽기나 보내기가 실패하면 잠시 쉰다
        self.empty_streak = 0                           # 알던 벙이 있는데 사이트가 빈 목록을 준 횟수
        self.read_fails = 0                             # 사이트 읽기가 연속으로 실패한 횟수(망 끊김)
        self.net_fails = 0                              # 그 가운데 응답 자체가 없던 실패(망, 시간 초과)가 이어진 횟수
        self.net_kick_at = 0.0                          # 마지막으로 와이파이를 껐다 켠 때
        self.send_fails = 0                             # 보내기가 연속으로 실패한 횟수(adb 안 붙음, 카카오톡 화면 다름)
        self.room_miss = 0                              # 그 가운데 채팅 목록에서 방을 못 찾은 횟수(되풀이할수록 길게 쉰다)
        self.prev_ids, self.prev_read = None, 0.0       # 바로 전에 사이트에서 읽은 글(한꺼번에 바뀐 것을 가리는 데 쓴다)
        self.ctl, self.ctl_read = {"notice": 0.0, "pause": 0.0}, 0.0   # 운영 화면의 원격 조종(끝나는 때, 초)과 마지막으로 읽은 때
        self.first = True                               # run 을 켠 뒤 아직 방 공지를 사이트 글과 견주지 않았다
        self.look_fails = 0                             # 방 공지 보기(look)가 이어서 실패한 횟수
        self.fail_keys = []                             # 최근 실패의 종류와 글 앞부분(새 실패는 바로 적는다)
        self.fail_new_at = None                         # 새 실패로 따로 적은 때(10분에 한 번까지)

    def ts(self):
        """지금 시각(초). 한 차례가 1분 넘게 걸리기도 해서 다시 시도 시각은 끝난 때부터 잰다"""
        return Now(self.clock()).ts

    def save(self):
        save_json(self.state_path, self.st)

    def control(self, now):
        """운영 화면의 원격 조종을 1분에 한 번 읽는다. 못 읽으면 지난 값 그대로(망이 흔들려도 멈춤이 풀리지 않게)"""
        get = getattr(self.site, "control", None)
        if not get or (self.ctl_read and now.ts - self.ctl_read < 60):
            return self.ctl
        self.ctl_read = now.ts
        try:
            d = get()
        except Exception:
            return self.ctl
        d = d or {}
        self.ctl = {"notice": float(d.get("notice_until_ts") or 0), "pause": float(d.get("pause_until_ts") or 0)}
        return self.ctl

    def heartbeat(self):
        """매일 heartbeat_at 에 시험 방에 '봇 정상' 한 줄. 못 보내면 30분 뒤 다시(그날 안). 무엇을 했는지 한 낱말로"""
        now, cfg = Now(self.clock()), self.cfg
        at, room = cfg.get("heartbeat_at") or "", cfg.get("test_room") or ""
        if not (at and room and room != self.room and TIME_RE.match(at)) or now.hm < at or self.st.get("beat_ymd") == now.ymd:
            return ""
        if now.ts < float(self.st.get("beat_retry_at") or 0) or now.ts < self.hold_until or in_quiet(now.hm, cfg.get("quiet")):
            return ""
        try:
            self.sender.send(room, beat_text(self, now))
        except Exception as e:
            self.st["beat_retry_at"] = self.ts() + 1800
            self.save()
            self.log("시험 방에 봇 정상 한 줄 보내기 실패(30분 뒤 다시): %s" % e)
            return "beat-fail"
        finally:
            if hasattr(self.sender, "done"):
                self.sender.done()
        self.st.update(beat_ymd=now.ymd, beat_retry_at=0)
        self.save()
        self.log("시험 방에 봇 정상 한 줄")
        return "beat"

    def members_tick(self):
        """매일 members_at 에 알릴 방 메뉴(서랍)의 멤버를 읽어 사이트 닉네임 목록에 올린다(tablet, 봇 열쇠가 있을 때).
        방에 올리는 것이 없어 조용한 시간에도 한다. 운영 화면의 전체 멈춤 중에는 쉰다. 실패하면 30분 뒤 다시(하루 세 번까지),
        서버가 줄어서 막거나(SHRINK) SQL 이 없으면 그날은 그만, 열쇠가 맞지 않으면 열쇠를 바꿀 때까지 쉰다. 무엇을 했는지 한 낱말로"""
        now, cfg, st = Now(self.clock()), self.cfg, self.st
        at, key = members_at(cfg), cfg.get("members_key") or ""
        if not (at and key and members_on(self)) or now.hm < at:
            return ""
        if st.get("members_fail") and str((st.get("members_last") or {}).get("at") or "")[:10] != now.ymd:
            st["members_fail"] = 0                          # 전날 실패는 오늘 세지 않는다
        if st.get("members_ymd") == now.ymd or now.ts < float(st.get("members_retry_at") or 0) or now.ts < self.hold_until:
            return ""                                       # 오늘 이미 했거나, 다시 할 때가 아니거나, 보내기나 읽기가 막 실패해 쉬는 중
        if st.get("members_badkey") == member_key_tag(key):
            return ""                                       # 맞지 않던 열쇠 그대로다(members key 로 새 열쇠를 넣으면 다시)
        if self.control(now)["pause"] > now.ts:
            return ""                                       # 운영 화면의 전체 멈춤 중에는 화면을 건드리지 않는다
        names, step = [], "read"
        try:
            names = self.sender.read_members(self.room, cfg.get("members") or {})
            step = "push"
            r = self.site.push_members(names, key)
        except Exception as e:
            return self.members_failed(now, step, e, len(names))
        finally:
            if hasattr(self.sender, "done"):
                self.sender.done()
        kind, msg = members_result(r)
        if kind == "retry":
            return self.members_failed(now, "push", msg, len(names))
        st.update(members_ymd=now.ymd, members_retry_at=0, members_fail=0, members_last={
            "at": "%s %s" % (now.ymd, now.hm), "n": int(r.get("n") or 0) if kind == "ok" else len(names),
            "error": "" if kind == "ok" else members_short(msg), "step": "push"})
        if kind == "key":
            st["members_badkey"] = member_key_tag(key)
        else:
            st.pop("members_badkey", None)
        self.save()
        self.log(msg + {"ok": "", "stop": ". 오늘은 다시 하지 않음", "key": ". 새 열쇠를 넣을 때까지 하지 않음"}[kind])
        return "members" if kind == "ok" else "members-fail"

    def members_failed(self, now, step, e, n):
        """멤버 갱신 실패: 30분 뒤 다시, 하루 세 번까지. 마지막 실패는 기록(members_last)에"""
        st, why = self.st, str(e)
        k = int(st.get("members_fail") or 0) + 1
        if k >= 3:
            st.update(members_ymd=now.ymd, members_fail=0, members_retry_at=0)
            tail = "오늘은 그만, 내일 %s 에 다시" % members_at(self.cfg)
        else:
            st.update(members_fail=k, members_retry_at=self.ts() + 1800)
            tail = "30분 뒤 다시"
        st["members_last"] = {"at": "%s %s" % (now.ymd, now.hm), "n": n, "error": members_short(why), "step": step}
        self.save()
        self.log("멤버 %s 실패(%d번째, %s): %s" % ("읽기" if step == "read" else "올리기", k, tail, why))
        return "members-fail"

    def net_up(self):
        """사이트 말고 다른 주소가 열리는가(망은 살아 있나). 못 보면 False"""
        try:
            code, _ = http_get("https://connectivitycheck.gstatic.com/generate_204", timeout=8)
            return code in (200, 204)
        except Exception:
            return False

    def due(self):
        now = Now(self.clock())
        if now.ts < self.hold_until:
            return False
        return now.ts - self.last_check >= int(self.cfg.get("check_sec", 20)) or digest_due(self.st, now, self.cfg) is True

    def cycle(self):
        """사이트를 한 번 보고, 바뀐 것은 알림으로, 공지 글이 달라졌으면 공지로. 무엇을 했는지 한 낱말로 돌려준다"""
        now = Now(self.clock())
        self.last_check = now.ts
        st, cfg = self.st, self.cfg
        if in_quiet(now.hm, cfg.get("quiet")):
            return "quiet"
        try:
            posts = self.site.posts()
        except Exception as e:                          # 사이트가 흔들리면 다음 차례에. 같은 오류가 이어지면 처음과 10번째마다만 적는다
            self.read_fails += 1
            self.net_fails = self.net_fails + 1 if isinstance(e, OSError) else 0   # 응답 코드를 받은 실패(서버 장애, 사이트 모양)는 망이 살아 있는 것
            if self.read_fails == 1 or self.read_fails % 10 == 0:
                self.log("사이트 읽기 실패%s: %s" % ("(%d번째, 망이 끊겼으면 돌아올 때까지 1분마다 다시 봄)" % self.read_fails if self.read_fails > 1 else "", e))
            # 3분 넘게 응답이 없으면 와이파이를 껐다 켠다(15분에 한 번). 화면이 꺼진 채 절전으로 잠든 와이파이를 깨우는 가장 싼 방법.
            # 다른 주소는 열리면(사이트만 응답 없음) 그대로 둔다(껐다 켜면 무선 디버깅과 보이스룸이 끊길 수 있다)
            if self.net_fails >= 3 and cfg.get("net_kick", True) and hasattr(self.sender, "net_kick") and now.ts - self.net_kick_at >= 900:
                self.net_kick_at = now.ts
                if self.net_up():
                    self.log("사이트만 응답이 없음(다른 주소는 열림): 와이파이는 그대로 둠")
                else:
                    try:
                        self.log("망 끊김 %d분: 와이파이를 껐다 켬(그전 망: %s)" % (self.read_fails, self.sender.net_kick()))
                    except Exception as e2:
                        self.log("와이파이 껐다 켜기 실패: %s" % e2)
            self.hold_until = now.ts + 60
            return "read-fail"
        if self.read_fails:
            self.log("사이트 다시 읽힘(%d번 실패 뒤)" % self.read_fails)
            self.read_fails = self.net_fails = 0
        live_known = any(sig_live(o, now) for o in st.get("known", {}).values())
        if not posts and live_known:                     # 빈 목록: 사이트가 흔들린 것일 수 있다. 세 번 연속이어야 믿는다
            self.empty_streak += 1
            if self.empty_streak < 3:
                self.log("사이트가 빈 목록을 줌(%d번째). 다음 차례에 다시 봄" % self.empty_streak)
                self.hold_until = now.ts + 60
                return "read-empty"
        else:
            self.empty_streak = 0
        cur, ch = diff(st.get("known", {}), posts, now, bool(st.get("init")), bool(getattr(self.site, "last_full", False)))
        if not st.get("init"):
            st.update(known=cur, init=True)
            self.save()
            self.log("처음 켬: 글 %d개를 기억함(알리지 않음)" % len(posts))
            ch = noch()
        # 운영 화면의 원격 조종: 전체 멈춤이면 바뀐 것은 기억만 하고 아무것도 올리지 않는다. 공지 멈춤이면 알림만 올린다.
        # 멈춤이 끝나면 봇 공지를 다시 올려 건다(운영진이 그사이 건 공지 대신)
        ctl = self.control(now)
        paused, held = ctl["pause"] > now.ts, ctl["notice"] > now.ts
        if paused:
            if not st.get("ctl_paused"):
                self.log("운영 화면에서 전체 멈춤(%s까지): 알림과 공지를 올리지 않고 바뀐 것은 기억만" % hm_of(ctl["pause"]))
            st.update(known=cur, ctl_paused=1)
            self.save()
            self.prev_ids, self.prev_read = {v["id"] for v in posts}, now.ts
            return "paused"
        if st.pop("ctl_paused", None):
            self.log("운영 화면의 전체 멈춤이 끝남" + ("" if held else ": 봇 공지를 다시 올려 겁니다"))
            if not held:
                st["notice_text"] = ""
        if held and not st.get("ctl_notice"):
            st["ctl_notice"] = 1
            self.log("운영 화면에서 공지 멈춤(%s까지): 공지 글은 올리지 않고 알림만" % hm_of(ctl["notice"]))
        elif not held and st.pop("ctl_notice", None):
            st["notice_text"] = ""
            self.log("운영 화면의 공지 멈춤이 끝남: 봇 공지를 다시 올려 겁니다")
        # 한꺼번에 바뀜: 사람이 하나씩 올린 것이 아니라 글을 한꺼번에 옮기거나 지운 것이면 알림 없이 공지만.
        # 바로 전 읽기(10분 안)와 견준다. 조용한 시간이나 보내기 실패로 쌓인 것은 세지 않는다. 켠 뒤 첫 차례는 기록과 견준다
        new_ids, del_ids = {v["id"] for v in ch["new"]}, {o["id"] for o in ch.get("del", [])}
        if self.prev_ids is None:
            bulk = len(new_ids) + len(del_ids)
        elif now.ts - self.prev_read <= 600:
            bulk = len(new_ids - self.prev_ids) + len(del_ids & self.prev_ids)
        else:
            bulk = 0
        self.prev_ids, self.prev_read = {v["id"] for v in posts}, now.ts
        if bulk >= int(cfg.get("bulk_quiet", 6) or 10 ** 9):
            self.log("새 벙과 지운 벙이 한꺼번에 %d건이라 알리지 않음(글을 한꺼번에 옮기거나 지운 것으로 봄). 공지 글만 새로" % bulk)
            ch["new"], ch["del"] = [], []
        alert = alert_msgs(ch, cfg)
        fresh, shown = notice_build(posts, now, cfg)
        ntext = self.same_order(st, posts, now, cfg, fresh, shown)
        dg = digest_due(st, now, cfg)
        if dg == "skip" or (dg and st.get("last_post_ymd") == now.ymd and ntext == st.get("notice_text")):
            st["last_digest"] = now.ymd                 # 너무 늦었거나 오늘 이미 올렸다
            self.save()
            dg = False
        if held:
            dg = False                                  # 공지 멈춤 중에는 공지 글을 올리지 않는다(매일 다시 올리기도)
        if dg:
            ntext = fresh                               # 매일 다시 올리기는 지금 차례로
        want = not held and ((ntext != st.get("notice_text") and now.ts >= float(st.get("notice_retry_at") or 0)) or bool(dg))
        seen, looked = None, False
        unsure = bool(st.get("notice_fail_text")) and st.get("notice_fail_text") != ntext   # 다른 글을 올렸는데 걸렸는지 모름(걸렸을 수 있다)
        if not want and not held and cfg.get("notice") and ntext == st.get("notice_text") and (self.first or unsure):
            seen, looked = self.look(ntext, unsure), True   # 켠 뒤 처음이나 걸렸는지 모를 때: 방에 걸린 공지를 읽어 지금 사이트 글과 견준다
            want = seen == "diff"
        if not looked or seen is not None:
            self.first = False                          # 못 읽었으면 쉬었다가 다시 본다
        if not alert and not want:
            st["known"] = cur                           # 제목만 바뀜, 지난 글 정리
            self.save()
            return "none"
        if now.ts - float(st.get("last_post_at") or 0) < int(cfg.get("min_gap_sec", 60)):
            return "wait"                               # 방금 올렸다. 모았다가 한 번에
        if want and ntext == fresh:
            st["notice_built"] = {"text": ntext, "at": now.ts}   # 이 글을 만든 때(카드 차례를 정한 때)
        try:
            return self._post(st, cfg, now, cur, alert, ntext if want else "", dg, seen)
        finally:
            if hasattr(self.sender, "done"):
                self.sender.done()

    def same_order(self, st, posts, now, cfg, fresh, ids):
        """시각만 지나 카드 차례만 바뀌었으면 올린 공지 글 그대로(벙이 시작하거나 끝날 때마다 다시 올리지 않게).
        '외 N건' 에 가려진 진행 중이나 시작 전 벙을 카드로 올려야 하면, 또는 벙 글이 바뀌었으면 지금 차례의 새 글"""
        nb = st.get("notice_built") or {}
        old = nb.get("text") or ""
        if not old or old == fresh or old not in (st.get("notice_text"), st.get("notice_fail_text")):
            return fresh
        then, then_ids = notice_build(posts, now, cfg, Now(datetime.fromtimestamp(float(nb.get("at") or 0), KST)))
        return old if then == old and not notice_reorder_due(posts, now, cfg, then_ids, ids) else fresh

    def send_once(self, text):
        """보낸다. 지난번에 같은 글을 보내다 실패했는데 실제로는 올라가 있으면(화면에서 확인) 또 보내지 않는다"""
        if self.st.get("send_fail_text") == text and hasattr(self.sender, "already_sent"):
            try:
                if self.sender.already_sent(self.room, text):
                    self.log("지난번 글이 이미 올라가 있어 다시 보내지 않음")
                    self.st["send_fail_text"] = ""
                    return
            except (RoomUnreachable, Covered):                   # 방까지 못 갔다: 보내기도 같은 길이라 이번에는 그만(한 번에 한 번만 방을 연다)
                self.send_fails += 1
                self.save()
                raise
            except Exception:
                pass
        try:
            self.sender.send(self.room, text)
        except Exception:
            self.st["send_fail_text"] = text
            self.send_fails += 1
            self.save()
            raise
        self.st["send_fail_text"] = ""
        self.room_miss = 0
        if self.send_fails:
            self.log("보내기 다시 됨(%d번 실패 뒤)" % self.send_fails)
            self.send_fails = 0

    def send_wait(self, e):
        """보내기 실패 뒤 쉬는 시간(초). 채팅 목록에서 방을 못 찾거나 누를 자리가 가린 실패는 되풀이할수록 길게(1, 2, 5, 10, 15분), 나머지는 1분"""
        if isinstance(e, (RoomNotFound, Covered)) or isinstance(getattr(e, "__cause__", None), (RoomNotFound, Covered)):
            self.room_miss += 1
            return ROOM_MISS_WAIT[min(self.room_miss, len(ROOM_MISS_WAIT)) - 1]
        return 60

    def fail_changed(self, e):
        """최근 실패들과 종류나 글 앞부분이 다른 새 실패인지(같은 실패만 되풀이되면 처음과 10번째마다만 적고, 새 실패는 바로 적는다.
        실패가 번갈아 나도 1분마다 쌓이지 않게 최근 셋을 보고, 새 실패로 따로 적는 것은 10분에 한 번까지)"""
        key = (type(e).__name__, re.sub(r"\d+", "#", str(e))[:40])     # 자리, 횟수 같은 수는 빼고 견준다
        recent = getattr(self, "fail_keys", None) or []
        self.fail_keys = ([k for k in recent if k != key] + [key])[-3:]
        return key not in recent

    def new_log_ok(self):
        """새 실패로 따로 적어도 되는지: 10분에 한 번까지(실패 여럿이 돌아가며 나도 1분마다 쌓이지 않게)"""
        now, last = getattr(self, "ts", time.time)(), getattr(self, "fail_new_at", None)
        if last is not None and now - last < 600:
            return False
        self.fail_new_at = now
        return True

    def send_log(self, what, e, wait=60):
        """보내기 실패는 처음과 10번째마다, 그리고 실패가 달라질 때 적는다(adb 가 안 붙은 동안 1분마다 쌓이지 않게). 길게 쉬는 실패(방을 못 찾음)는 매번"""
        new = self.fail_changed(e)
        if wait > 60:
            self.log("%s 실패(%d번째, %d분 뒤 다시): %s" % (what, self.send_fails, wait // 60, e))
        elif self.send_fails == 1 or self.send_fails % 10 == 0:
            self.log("%s 실패%s: %s" % (what, "(%d번째, 붙을 때까지 1분마다 다시)" % self.send_fails if self.send_fails > 1 else "(다음 차례에 다시)", e))
        elif new and self.new_log_ok():
            self.log("%s 실패(%d번째, 1분 뒤 다시): %s" % (what, self.send_fails, e))

    def notice_alts(self):
        """방에 걸려 있을 수 있는 다른 공지 글: 지난번에 건 글, 걸었는지 모르는 글, 최근에 올린 글"""
        st = self.st
        return [st.get("notice_text") or "", st.get("notice_fail_text") or ""] + list(st.get("notice_posted") or [])

    def notice_seen(self, ntext):
        """알릴 방에 걸린 공지가 이 글인지: 'same', 'diff', '?'. tablet 만 읽는다(다른 방식은 '?'). 방까지 못 가면 KakaoError"""
        read = getattr(self.sender, "pinned_notice", None)
        if not read:
            return "?"
        shown, sure = read(self.room, ntext)
        self.room_miss = 0                                       # 방까지 가서 읽었다(다음 실패는 다시 1분부터)
        return band_verdict(shown, ntext, self.notice_alts(), sure)

    def look(self, ntext, unsure=False):
        """방에 걸린 공지를 읽어 지금 사이트 글(ntext, 기록상 이미 건 글)과 견준다. run 을 켠 뒤 처음, 또는 다른 글을 올렸는데 걸렸는지 모를 때(unsure).
        같으면 그대로(기록의 걸기 실패를 지움). 다르면(unsure 면 모름도) 이미 올린 이 글을 다시 건다(방의 말풍선을 찾아 걸고, 못 찾으면 한 번 더 올림).
        모르면 기록을 믿고 그대로. 못 읽으면 기록을 믿고 None(쉬었다가 다시 본다). 무엇을 했는지 한 줄 적는다. 끝나면 Termux 를 앞으로"""
        st = self.st
        try:
            seen = self.notice_seen(ntext)
        except Exception as e:
            self.look_fails += 1
            wait = self.send_wait(e)
            self.hold_until = self.ts() + wait
            changed = self.fail_changed(e)
            if self.look_fails == 1 or self.look_fails % 10 == 0 or (changed and self.new_log_ok()):
                self.log("방 공지를 읽지 못함(지난번에 건 글을 믿고 그대로 둠, %d분 뒤 다시 봄): %s" % (max(1, wait // 60), e))
            return None
        finally:
            if hasattr(self.sender, "done"):
                self.sender.done()
        self.look_fails = 0
        if seen == "same":
            st.update(notice_fail=0, notice_fail_text="", notice_retry_at=0, notice_gaveup=0)
            self.save()
            self.log("방 공지가 지금 사이트 글과 같아 올리지 않음")
            return "same"
        if seen == "?" and not unsure:
            self.log("공지: 지난번에 건 글이 지금 사이트 글과 같아 올리지 않음")
            return "?"
        st.update(notice_text="", notice_fail=max(1, int(st.get("notice_fail") or 0)), notice_fail_text=ntext, notice_retry_at=0, notice_gaveup=0,
                  notice_sends=max(1, int(st.get("notice_sends") or 0)))   # 될 때까지(1분 간격, 실패) 이 글을 다시 건다. 글은 두 번까지
        self.save()
        self.log("방 공지가 지금 사이트 글과 %s 이미 올린 글을 다시 겁니다" % ("달라" if seen == "diff" else "같은지 알 수 없어"))
        return "diff"

    def _post(self, st, cfg, now, cur, alert, ntext, dg, seen=None):
        alerts = [alert] if isinstance(alert, str) and alert else list(alert or [])
        if alerts:
            done = list(st.get("alert_done") or [])
            for a in alerts:
                if alert_key(a) in done:
                    continue                                # 지난 차례에 올렸다(뒤의 알림을 보내다 실패해 다시 하는 중)
                try:
                    self.send_once(a)
                except Exception as e:
                    wait = self.send_wait(e)
                    self.send_log("알림 보내기", e, wait)
                    self.hold_until = self.ts() + wait
                    return "send-fail"
                done.append(alert_key(a))
                st["alert_done"] = done
                self.save()
                self.log("알림: " + a.split("\n")[0])
            st["alert_done"] = []
        st.update(known=cur, last_post_at=now.ts)
        self.save()
        if not ntext:
            return "alert"
        if seen is None and cfg.get("notice") and not dg:      # 올리기 전에 방 공지를 본다. 이미 이 글이면 올리지도 걸지도 않는다
            try:
                seen = self.notice_seen(ntext)
            except Exception as e:
                self.send_fails += 1
                wait = self.send_wait(e)
                self.send_log("공지 글 보내기", e, wait)
                self.hold_until = self.ts() + wait
                return "send-fail"
        if seen == "same":
            self.room_miss = 0
            if self.send_fails:
                self.log("다시 됨(%d번 실패 뒤)" % self.send_fails)
                self.send_fails = 0
            st.update(notice_text=ntext, notice_fail=0, notice_fail_text="", notice_retry_at=0, notice_sends=0, notice_gaveup=0, send_fail_text="")
            self.save()
            self.log("방 공지가 이미 지금 사이트 글과 같아 올리지 않음")
            return "same"
        again = bool(cfg.get("notice")) and not dg and st.get("notice_fail_text") == ntext and int(st.get("notice_fail") or 0) > 0
        sends = int(st.get("notice_sends") or st.get("notice_fail") or 1)   # 이 글을 방에 올린 횟수(옛 판 기록은 실패 수가 곧 올린 수)
        if again and hasattr(self.sender, "pin_again"):
            # 공지 걸기만 실패했던 같은 글: 방에 이미 올린 글을 찾아 공지로만 건다(같은 글을 또 올리지 않는다).
            # 위로 밀려 못 찾았을 때만 한 번 더 올린다(글은 두 번까지)
            try:
                self.sender.pin_again(self.room, ntext)
            except RoomUnreachable as e:                    # 방까지 못 감(adb 끊김 등): 공지 걸기 실패로 세지 않고 1분 뒤 다시
                self.send_fails += 1
                wait = self.send_wait(e)
                self.send_log("공지 다시 걸기", e, wait)
                self.hold_until = self.ts() + wait
                return "send-fail"
            except Exception as e:
                if not (isinstance(e, NotFound) and sends < 2):
                    return self._notice_failed(st, now, ntext, e)
                self.log("이미 올린 공지 글을 찾지 못해 한 번 더 올림: %s" % e)
            else:
                self.room_miss = 0
                if self.send_fails:
                    self.log("다시 됨(%d번 실패 뒤)" % self.send_fails)
                    self.send_fails = 0
                st.update(notice_text=ntext, notice_fail=0, notice_fail_text="", notice_retry_at=0, notice_sends=0, notice_gaveup=0)
                self.save()
                self.log("공지로 걸었음(이미 올린 글)")
                return "pinned"
        try:
            self.send_once(ntext)
        except Exception as e:
            wait = self.send_wait(e)
            self.send_log("공지 글 보내기", e, wait)
            self.hold_until = self.ts() + wait
            return "send-fail"
        st.update(last_post_at=now.ts, last_post_ymd=now.ymd, notice_sends=sends + 1 if again else 1,
                  notice_posted=([x for x in (st.get("notice_posted") or []) if x != ntext] + [ntext])[-10:])
        if dg:
            st["last_digest"] = now.ymd
        chg = notice_change(st.get("notice_text") or "", ntext)
        self.log("올림: " + ntext.split("\n")[0] + (" (%s)" % chg if chg else ""))
        if not cfg.get("notice"):
            st["notice_text"] = ntext
            self.save()
            return "sent"
        try:
            self.sender.notice(self.room, ntext)
        except Exception as e:
            return self._notice_failed(st, now, ntext, e)
        st.update(notice_text=ntext, notice_fail=0, notice_fail_text="", notice_retry_at=0, notice_sends=0, notice_gaveup=0)
        self.save()
        self.log("공지로 걸었음")
        return "sent"

    def _notice_failed(self, st, now, ntext, e):
        """공지 걸기 실패: 1분, 5분, 15분 뒤 다시. 그래도 안 되면 다음 바뀜까지 쉰다(사람이 직접 걸 수 있게 알린다)"""
        n = int(st.get("notice_fail") or 0) if st.get("notice_fail_text") == ntext else 0
        if n < len(NOTICE_RETRY):
            st.update(notice_fail=n + 1, notice_fail_text=ntext, notice_retry_at=self.ts() + NOTICE_RETRY[n])
            self.log("공지 걸기 실패(%d번째, %d분 뒤 다시 건다): %s" % (n + 1, NOTICE_RETRY[n] // 60, e))
        else:
            st.update(notice_text=ntext, notice_fail=0, notice_retry_at=0, notice_gaveup=1)   # 네 번 실패: 다음 바뀜까지 쉼(status 에 계속 보인다)
            self.log("공지 걸기 %d번 실패, 다음 바뀜 때 다시. 방에 올린 마지막 공지 글을 길게 눌러 직접 공지로 걸어 주세요: %s" % (n + 1, e))
        self.save()
        return "sent-no-notice"


# ── 카카오톡 조작: 보내지 않고 찍기만 ──
class DrySender:
    def __init__(self, out=print):
        self.out, self.sent, self.notices = out, [], []

    def send(self, room, text):
        self.sent.append((room, text))
        self.out("[보냄 %s]\n%s" % (room, text))

    def notice(self, room, text):
        self.notices.append((room, text.split("\n")[0]))
        self.out("[공지 %s] %s" % (room, text.split("\n")[0]))

    def check(self):
        return ["카카오톡: dry 방식이라 보내지 않고 찍기만 합니다"]


# ── 카카오톡 조작: 윈도우 PC ──
VK = {"ctrl": 0x11, "alt": 0x12, "enter": 0x0D, "esc": 0x1B, "del": 0x2E, "a": 0x41, "c": 0x43, "v": 0x56}


class PcSender:
    def __init__(self, cfg, log, mods=None):
        if mods:
            self.g, self.con, self.api, self.clip, self.proc = mods
        else:
            import win32gui, win32con, win32api, win32clipboard, win32process   # pip install pywin32
            self.g, self.con, self.api, self.clip, self.proc = win32gui, win32con, win32api, win32clipboard, win32process
            try:
                import ctypes
                ctypes.windll.shcore.SetProcessDpiAwareness(2)   # 화면 배율과 상관없이 같은 좌표
            except Exception:
                pass
        self.cfg, self.pc, self.log, self.sleep = cfg, cfg["pc"], log, time.sleep

    # 키, 마우스, 클립보드
    def key(self, *names):
        codes = [VK[n] for n in names]
        for c in codes:
            self.api.keybd_event(c, 0, 0, 0)
        for c in reversed(codes):
            self.api.keybd_event(c, 0, 2, 0)
        self.sleep(0.15)

    def click(self, x, y, right=False):
        self.api.SetCursorPos((int(x), int(y)))
        down, up = (8, 16) if right else (2, 4)
        self.api.mouse_event(down, 0, 0, 0, 0)
        self.api.mouse_event(up, 0, 0, 0, 0)
        self.sleep(0.35)

    def _clip_open(self):
        for _ in range(10):
            try:
                self.clip.OpenClipboard()
                return
            except Exception:
                self.sleep(0.1)
        raise KakaoError("클립보드를 열지 못함")

    def set_clip(self, text):
        self._clip_open()
        try:
            self.clip.EmptyClipboard()
            if text:
                self.clip.SetClipboardData(13, text)       # CF_UNICODETEXT
        finally:
            self.clip.CloseClipboard()

    def get_clip(self):
        self._clip_open()
        try:
            return self.clip.GetClipboardData(13) or ""
        except Exception:
            return ""
        finally:
            self.clip.CloseClipboard()

    # 창
    def kakao_windows(self):
        out = []

        def cb(h, _):
            t = self.g.GetWindowText(h)
            if t and self.g.IsWindowVisible(h):
                try:
                    _, pid = self.proc.GetWindowThreadProcessId(h)
                    hp = self.api.OpenProcess(0x0410, False, pid)
                    exe = self.proc.GetModuleFileNameEx(hp, 0)
                except Exception:
                    exe = ""
                if exe.lower().endswith("kakaotalk.exe"):
                    out.append((h, t))
            return True
        self.g.EnumWindows(cb, None)
        return out

    def check(self):
        ws = [t for _, t in self.kakao_windows() if t != "카카오톡"]
        return ["열려 있는 카카오톡 방 창: " + (", ".join(ws) if ws else "없음"),
                "공지 자리: " + ("잡음" if self.pc.get("bubble") else "아직(calibrate)")]

    def window(self, room):
        h = self.g.FindWindow(None, room)
        if not h:
            h = next((w for w, t in self.kakao_windows() if room in t and t != "카카오톡"), 0)
        if not h:
            raise KakaoError("'%s' 방 창이 열려 있지 않음. 봇 계정 PC 카카오톡에서 방을 열어 두세요(최소화 가능)" % room)
        return h

    def front(self, h):
        if self.g.IsIconic(h):
            self.g.ShowWindow(h, 9)                         # SW_RESTORE
        x, y, w, hh = self.pc["window"]
        self.g.MoveWindow(h, x, y, w, hh, True)            # 늘 같은 자리, 같은 크기(calibrate 한 자리)
        for _ in range(3):
            self.api.keybd_event(VK["alt"], 0, 0, 0)          # 다른 창이 앞에 있어도 앞으로 오게
            try:
                self.g.SetForegroundWindow(h)
            except Exception:
                pass
            self.api.keybd_event(VK["alt"], 0, 2, 0)
            self.sleep(0.3)
            if self.g.GetForegroundWindow() == h:
                return self.g.GetWindowRect(h)
        raise KakaoError("방 창을 앞으로 가져오지 못함(윈도우가 잠겨 있으면 안 됩니다)")

    def input_point(self, h, rect):
        """입력 칸 가운데. 창 안의 RichEdit 칸을 먼저 찾고, 없으면 창 아래에서 input_dy 위"""
        found = []

        def cb(c, _):
            if self.g.GetClassName(c).lower().startswith("richedit") and self.g.IsWindowVisible(c):
                found.append(self.g.GetWindowRect(c))
            return True
        try:
            self.g.EnumChildWindows(h, cb, None)
        except Exception:
            pass
        if found:
            l, t, r, b = max(found, key=lambda x: x[3])
            return (l + r) // 2, (t + b) // 2
        l, t, r, b = rect
        return (l + r) // 2, b - int(self.pc["input_dy"])

    def send(self, room, text):
        h = self.window(room)
        rect = self.front(h)
        old = self.get_clip()
        self.set_clip(text)
        self.click(*self.input_point(h, rect))
        self.key("ctrl", "a")
        self.key("del")
        self.key("ctrl", "v")
        self.sleep(0.4)
        self.key("enter")
        self.sleep(1.0)
        try:
            self.set_clip(old)
        except KakaoError:
            pass

    def bubble_point(self, rect):
        l, t, r, b = rect
        bx, by = self.pc["bubble"]
        return r - bx, b - by

    def notice(self, room, text):
        if not (self.pc.get("bubble") and self.pc.get("menu_copy") and self.pc.get("menu_notice")):
            raise KakaoError("공지 자리를 아직 잡지 않음(python excer_bot.py calibrate)")
        self.sleep(2.5)                                    # 주소 미리보기가 떠 말풍선이 제자리에 오도록
        h = self.window(room)
        rect = self.front(h)
        x, y = self.bubble_point(rect)
        first = text.split("\n")[0]
        # 1) 우클릭해 복사: 마지막 메시지가 방금 봇이 보낸 글인지 확인(다른 사람 말이 끼어들었으면 걸지 않는다)
        self.set_clip("")
        self.click(x, y, right=True)
        self.click(x + self.pc["menu_copy"][0], y + self.pc["menu_copy"][1])
        got = self.get_clip()
        if first not in got:
            self.key("esc")
            raise KakaoError("마지막 메시지가 봇이 보낸 목록이 아님(다른 메시지가 끼어듦). 공지는 다음 목록에")
        # 2) 우클릭해 공지
        self.click(x, y, right=True)
        self.click(x + self.pc["menu_notice"][0], y + self.pc["menu_notice"][1])
        self.sleep(0.8)
        if self.pc.get("confirm"):
            l, t, r, b = rect
            self.click((l + r) // 2 + self.pc["confirm"][0], (t + b) // 2 + self.pc["confirm"][1])
        else:
            self.key("enter")                              # 확인 창이 뜨면 확인, 없으면 빈 입력 칸이라 아무 일 없음

    def calibrate(self, room, text, ask=input, wait=5):
        """시험 방에 목록을 보내고, 입력 칸, 말풍선, 복사, 공지, 확인 자리를 마우스로 짚어 받는다.
        엔터는 이 명령 창에서 누르고, 그 뒤 초를 세는 동안 마우스를 카카오톡의 그 자리에 올려 둔다"""
        def point(msg, before=None):
            ask(msg + " 준비되면 여기서 엔터. 그 뒤 %d초 안에 마우스를 그 자리에 올려 두세요." % wait)
            if before:
                before()
            for i in range(wait, 0, -1):
                print(" %d" % i, end="", flush=True)
                self.sleep(1)
            print()
            return self.api.GetCursorPos()
        h = self.window(room)
        self.send(room, text)
        self.sleep(2.5)
        fr = lambda: self.front(h)
        rect = fr()
        l, t, r, b = rect
        ix, iy = point("카카오톡 방 창의 글 입력 칸 안에 마우스를 올려 둘 차례입니다.", fr)
        self.pc["input_dy"] = b - iy
        bx, by = point("방금 보낸 목록 말풍선의 오른쪽 아래 가까운 안쪽에 마우스를 올려 둘 차례입니다.", fr)
        self.pc["bubble"] = [r - bx, b - by]
        cx, cy = point("말풍선에 우클릭 메뉴가 뜹니다. 메뉴의 '복사' 위에 마우스를 올려 둘 차례입니다.", lambda: (fr(), self.click(bx, by, right=True)))
        self.pc["menu_copy"] = [cx - bx, cy - by]
        self.key("esc")
        nx, ny = point("다시 우클릭 메뉴가 뜹니다. 메뉴의 '공지' 위에 마우스를 올려 둘 차례입니다.", lambda: (fr(), self.click(bx, by, right=True)))
        self.pc["menu_notice"] = [nx - bx, ny - by]
        fx, fy = point("이제 '공지'를 누릅니다. 확인 창이 뜨면 '확인' 위에 마우스를, 창이 없으면 마우스를 그대로 두세요.", lambda: self.click(nx, ny))
        if abs(fx - nx) + abs(fy - ny) > 30:
            self.pc["confirm"] = [fx - (l + r) // 2, fy - (t + b) // 2]
            self.click(fx, fy)
        else:
            self.pc["confirm"] = None
        return dict(self.pc)


# ── 화면 방향: 자동 회전을 끄고 한 방향으로 고정(카카오톡 화면 모양이 바뀌면 자리와 목록이 흔들린다) ──
ROT_WORDS = {"landscape": "landscape", "가로": "landscape", "portrait": "portrait", "세로": "portrait", "off": "off", "끔": "off"}
ROT_NAME = {"landscape": "가로", "portrait": "세로"}
ROT_CMD = ("dumpsys window displays 2>/dev/null | grep -E 'mRotation=|mLandscapeRotation=|mPortraitRotation=|mUserRotationMode=|mFixedToUserRotation=| init=| cur=' | head -40; "
           "echo ACC=$(settings get system accelerometer_rotation 2>/dev/null) USR=$(settings get system user_rotation 2>/dev/null); true")


def rot_num(s):
    """'ROTATION_90' 이나 '1' 을 0~3 으로. 모르면 None"""
    m = re.match(r"\s*(ROTATION_)?(\d+)\b", s or "")
    if not m:
        return None
    v = int(m.group(2))
    if m.group(1):
        return v // 90 % 4
    return v if 0 <= v <= 3 else None


def rot_info(out):
    """ROT_CMD 출력에서: 지금 회전(rot), 가로와 세로가 되는 회전 값(land, port), 지금 모양(shape), 자동 회전(acc), 고정 회전(usr),
    앱이 돌리지 못하게 막혔는지(fixed). 모르는 값은 None"""
    def g(pat):
        m = re.search(pat, out or "")
        return m.group(1) if m else None
    land = [x for x in (rot_num(g(r"\bmLandscapeRotation=(\S+)")), rot_num(g(r"\bmSeascapeRotation=(\S+)"))) if x is not None]
    port = [x for x in (rot_num(g(r"\bmPortraitRotation=(\S+)")), rot_num(g(r"\bmUpsideDownRotation=(\S+)"))) if x is not None]
    nat, cur = re.search(r"\binit=(\d+)x(\d+)", out or ""), re.search(r"\bcur=(\d+)x(\d+)", out or "")
    if (not land or not port) and nat:                   # 회전 값 줄이 없는 판: 처음 크기가 가로로 길면 0 이 가로
        land, port = ([0, 2], [3, 1]) if int(nat.group(1)) > int(nat.group(2)) else ([1, 3], [0, 2])
    rot = rot_num(g(r"\bmRotation=(\S+)"))
    shape = None
    if cur:
        shape = "landscape" if int(cur.group(1)) > int(cur.group(2)) else "portrait"
    elif rot is not None and land:
        shape = "landscape" if rot in land else "portrait"
    acc = g(r"\bACC=(\S*)")
    return {"rot": rot, "land": land, "port": port, "shape": shape, "acc": acc if acc not in ("", "null") else None,
            "usr": rot_num(g(r"\bUSR=(\S*)")), "fixed": (g(r"\bmFixedToUserRotation=(\S+)") or "").lower() == "true"}


def row_head(s):
    """줄 글의 첫 마디. 여러 칸이 한 글로 합쳐진 줄(방 이름, 사람 수, 마지막 글, 시각이 줄바꿈이나 쉼표로 이어짐)의 앞 칸"""
    return re.split(r"\n|, ", s or "", maxsplit=1)[0]


def same_room(t, room):
    """방 이름이 같은가: 보이지 않는 글자와 공백 차이는 보지 않고, 앞뒤에 그림 글자(보이스룸 표시 같은)만 붙은 것도 같다.
    글자나 숫자가 더 붙은 다른 방('... 시험' 같은)은 아니다"""
    a, b = norm_txt(t), norm_txt(room)
    if not a or not b:
        return False
    i = a.find(b)
    return i >= 0 and not re.search(r"\w", a[:i] + a[i + len(b):])


# ── 카카오톡 조작: 태블릿 하나로(Termux 안에서 adb 로 같은 기기에) ──
# 화면 읽기 도우미(tools/excer_dump/ExcerDump.java 를 dex 로 바꾼 jar, base64). 안드로이드 기본 uiautomator dump 는
# 화면이 1초 멈춰야 읽어서 글이 빨리 올라오는 방에서는 끝내 못 읽는다. 이것은 잠깐만 기다리고 그대로 읽는다.
# 다시 만들기: sh tools/excer_dump/build.sh (sha1 1faf69d258f19e52484fc53bb43d19ec9f579c2d)
DUMPER_JAR = (
    "UEsDBBQAAAAIAAAAQV29EbLUgQ4AAMgZAAALAAAAY2xhc3Nlcy5kZXidmXtsW9d9x3/38JKXokiKD0mWaVm+oR09bMuUJSuio4djyZGj"
    "hx+VHdmm6tU0eS1dm7qkyEtLyrLESdPYW9Z1awtnQLp1KCJ0AxKsa1wsj7VJ5gTzgLXojKEwEqyIUxgr0rVLhq5/FEu07zn3UKaybhhG"
    "6HN/v/M779/5nXMPxayx5OvqSdKjz1x79e+eTYTfvPPqlZ90feHlQ5+E/3zRnfn6jY1EBSJamt4TIflRYfsSOXYdvMCI7oHc6SLyQL6s"
    "Eg1A/hRSgbwB43uo/VPIb4eIroE3wA/AbfBz8GvgDhMFQRNoBlvBdtAF+sAgGAETwASL4BJ4B7wPPgIK+nEDL/CDZrAFbAPtYAdIgG5w"
    "HxgBB8EEOAKugOfBd8FHoC1KdAY8Cv4Y/CX4e/Ae+A+g1RNtBJ1gP/gsKICnwHPgRXAN/DV4DbwO3gI3wA/Bj8A74J/BbXAHrII9DURj"
    "4BA4Dk6B08AA50ERLIFL4Ar4ErgKvg5eBK+AN8EN8H3wHvgA/BK4GonCoB0kwF4wBqaACZbBk+AZ8DXwEngD/AP4EfgJ+AXwbsDcwXbQ"
    "BZJgCIyAh8BnwAkwA84AE5TAY+Ay+Cp4DrwC3gL/BN4Bt8G/gI/Ar8DHwNeEvhBLzWAL2AraQDvoANvBDh6DoBPsAgnQBXaDbtAD9oBe"
    "cB/oA0mwF9wP+sEgeBAcBA+BMTAOJkBMxn9XyBmHItObpZ6EvUXqD4ScvcGkzveHKstz3V2la1LfJvUuWT5QZY9U2aPSHgf1fJwhp0y9"
    "LHOv1I9W6XwMrVI/Kdtpku3wOW+U+pDUeTv7pH4G+gNSn4O+X+qFKn0J+rDUL1XZeb8jUv9D6AekfrKqzNeq9OdDjv8rvh6V+gtyLptk"
    "myq8PEP8vFHomJRlKT8v5TOQDeSn34F0wYMNQsZoSsjNtChkE/22WA+NZoV005yQYbKEbKSnhWygL4p2nXY02kCnhfTS54RU6IyQNZSW"
    "8qyUhpSmkLWUk+XnhWwR5yiXJSltSK9s34tyGSmzQmp0TqbPC9lCeSkXpCxC1shxcnlCylNCeuiCkJvoKchaeL1ByAhNC9lMfwDph/0J"
    "EYO19HuQdfDU45AheP4SZBiRvSTlsohPpz8em8eF3EIpIXX6LSEVuijizylXjx4+I2RAyqCUdVKGpIzSF4R0xtEI7YqIXR99VkiFLot1"
    "dPZd5SXF46QJcfILGeQ8704Tl4rQw03OfiyE+IkRhD9cYq82ws79F3XHKarqZOndiEE/ZC/WyU8xpUnoIUp6T1Mx1AaP+/HSsUJdaNfH"
    "evUp5HcKPepqpZ5uH8VYQNRppVsYQPvPoq4B2L2w10l7+y+jriFpC1ZsH/RM8XSokn4/6vLJMr6K7VbUFZC22ortB1FXjbT5K7a39gxf"
    "X+Vzgf49Lqcx580YpRv+3oU5v8547DTTPWyQXaIIG2XNTNvqWCL1fcOPUCTCbQuhDvipVpU5rX1nCxSJV+V4ZE6y78lzFOl2ctqR42NK"
    "u8wb6/vyDEWG1+V1yLxU3zeOUmRK9L89Hq2hi0oLYsBWtuAZYV48LT2OqLKVe6D7a62QG7HhZ0l4YAqL+WO//4FTkJau4Y1gnfDShBEJ"
    "RFhUrafe4VbaG9iG1VJ5ncDegEaNapYW9L2I2lsMQ/x5jIVJ29r++Ub1BrV/sdHzLbX92Qgy2r+BZ0f7izF4Stve/lK8vh5j2414jPmP"
    "oEUPb7Eh2fA9WlL6EeM+xiIMc4vgXbWZvI0k9Rbx3nT0ZvI2VfQt5MUBGKltxC0pEowwFua1sb8QXb0hr+JFm0wJU1G/H9HnZ1vgi7jq"
    "QQTXIJIPqU3hUWDpjTiHrdBG1PWrh9TGsBXazD2sHlY3okRjOKnepFFhr0M9v5pUvy/iWBXlN4R5JPtQflB9G+WQ1nfhDehDue9SpJ7B"
    "c1YoJlqMNPQcf5kOot296jXkKUes0CaxmkmMLQmP7K1TETfKrlHWFJ6Ku4iPcOoAo78afmKbY1NoNNYU9opTWSWGo/6PGIs9obuh/Ymq"
    "xkYZRszySjI0ryTrLii7meoZZLMKt9+qCyssjFmMajs66MJqRHi8gw6uBtSImHv7kwGm/a32bgTxWo+I6MN7TLs3zurhtd0YaUytFztk"
    "GHPn8jhkzF1Dju7U2YNyyVqc++rCKRfteCqmRmSduFpLBX0r7hRWKMn9zWLY2ZaewG3Dzyz9XuKRtg3zOuty097aX2FHPoL8Vqy2reiI"
    "3iDxkfKV6aCe1QBzrG0sonZQ72pM5XebvtWIyr3eQQ9CU4500OHVZO37lAyolAz+GNF3lLS3k7Vvoq8IYhB7aRsitZVHVa/nmVUeNzxm"
    "zsiYiWkb5MzEiabJ1fRZeg99E+mYzyPyvinymj6Vp1blbZJ598k8d1Ve86fytLW8g76Nnrt275o98uvu5zOYwwYRQT3DpxE5vFwbxh3V"
    "4uIkLsKDj9GotsHDZ7DQpZCuxZiyNh8dZUe1Js/UIiM+5qKou1PWreSpa3kx7bCodzfP9b/UU6rqTcp6t5hHUVo7aHw18u/Ktg46gChs"
    "X4mxR7FefqxoB13/mMdgB73+CeRUB732Cbd+52Ptbe3dDrp3Vc1q3+6g5z4h8Z52Yf1nxPu2XbzfXXjjlcV7OUrPivtBlP6U+P1Uozvy"
    "nvMzIQP0Eb+HwW4p/O4apb9R+Nmi0Q0p3xWymd6DfBW3xxXG01HyPr7hDnvD9fiGD8TzVdcbLoIS/As3T74gnt8Sz2t48rclvyUp9ArO"
    "rtv8XendSXyFIixOznnET18f3qlTKqMpRaUplwv7W6FBfCVb0HfQWzg9FvTt2ENc7qDr5HPxdDfkYMAp84/kU7gtIuQO+iFOJZ5GdFDM"
    "3Sj8nyK/m6/Jd4Tshqdi7t9FDIXQt9/D4yPlibmfhCW8zvIwLIF1lseIn4fVlpOwBNdZ2N0+Q1Hk+EQcG1V9u6pK1P/GEsq6cT8ozp1u"
    "3MS47OG3IiWmOjG5Hzq37RayG7cxJ62IW8gheQuxQn7ej0u5p3c3v5nw+5wf32pwGwjxexY/i920cNpFf/bmLVLwaf/XAHza/m8x8Sbt"
    "hTeDKPe2iDXcjZTgrcr3msq9iX/43Yh/f1ekjdHdu1S0qpxCzvcWLmNVZR2YSKvS7iHne5CGeVfacsk7X6WNTVJWvlfx+51PP5svW9nS"
    "YHyG/HomZ2YupM/mjME4hfVc3prtrDb54no6Y5sXuV4b18/lM+WSkUWiJq7n0stGEaoW1wtmAYo3rheNNM9l8SFyt27d3dUvRE8/qa1b"
    "9/JEer7AE7M2f+bw9LQulPOQzYls2k4ncvlMOpew5wsJYyljFD9XNnctzefIP5CYM41iupiZWx4ibSBh5bPGEJ0c2Idc/aJRLJl5a7Bt"
    "966uNt2wMvmsac0Otj18fLQz2aaX7LSVTWNuxmDbslFq0/cNDay1phfzdtrmteNdfCKZC2J+ngHTMu0hCgzwnnTTyhpLMAcHFqHmF3V7"
    "ucB9woAyQmxkjIIP8gEfKM8Xdp1PX0yTMkausbExYmOTpIwTG4eYJDY5QrWTa0X7YUCRSZ6Ror5JDLSYN7OJdCZjlErmWTNn2sslo3jR"
    "zBiJ/dXGY45xzDqX76fY3YqFQuJhc3/Zzs+LWfXThrW82WK6MGdmSokpIwOPd69lXDSNxfVdru/rMFzgdLTn/1znhPCTU6tvMpOfT1Rq"
    "ls20M7x8MZHJF4114z02Z+RyJzDQglHk88K6XTQvoK4llylxfK6YXyzxPO7mhJlPjJo540jZLpTtYzYCcB73x7W8o0XTWjM3OeZc2ppN"
    "jMyli8eMhTKixVirIHL44hQc30WrzGOWbczyQYWqjJPYMOsth9L2XD9FqixHzp4X/q62YUQmr7nxv9mGy2Yuy7tZV3y5ZBvz623wAzbb"
    "+qEL3/Ctuzamsm3mEpNmCf27xXYgZZrYNGJuepxc0+MIzOlJ8kxPTvJYVSERitMpUlLEUlBnhqlp5n+KoJ6Z/0cIRWd+gx/YTIrcp+N6"
    "Yohcp3F4sNMz5HFOHnIhGJBARFhZUtO2XSTP2byNiCFPBqu43yZ3JpculbjIlwzSMnnLwgDJD8U2LLsza5Qy5MuapUqOByufzqHGuVx6"
    "tkSuWcOmMB7D4mgcs45lioZhkZeblm2jJLSROSwNBSraCMqiD57kvR9OzxvUwFNOpwfQZ9EUgURumMeyopFJfmpSENrRNI7ZWUPU05Ce"
    "yudt0QBXxqz9YvbONhLlq3a8KH/cWLIdBWcR1UGp3kiipWmsylh2yijly8WM01MtzHJvZsm3lsAMzZLTJdWapZHKO4BqzNKoc+pTkwnP"
    "HDUzdrlorCmHsLBUZ5b4TrhbC4ZpE2ufM47nH8b5RWrOOAe35wxr1p4jdT5tWuSaTy/hAU2z8p1FPn2Vn7bE8hfIlS9jdgXHR+QtpIsl"
    "dGpTjdB4b8jlmztnUW1RzrDTzJK7aM7O2dRc4isxX0AWxg6vo72HKoc+1SB30hlLsLTetWrJfMQgdylnGAVSbe5kr513ApVcdr5A7ovp"
    "XBluWkyb9mi+OJbFhN2LRdM28OrVgvQVhb+HtfGbnRNLE18ZWlm5vLKycmGAGhTkXr158/btldTA+cmJTnP/vpaliTI71z8xgA/bOJ7a"
    "NXHZxKels+XqytLMfG7lshKuu3ld2Vx3nV3YyZaeZsFTLWzL+MBy6sOUmUrdHHh2kE1vbmFtpyZYavPARGrq/OCSeVnR65TmOmVr3VX2"
    "iLIvePIIq9vJXnt8nN3fz/Y/TYvOf1C1U6mBy0qkDn83r/IPOuN/HXWpxGG2/NLhli6cAz7l95VmpSko7h5PXFI/DCjeK0Gl5j/rFO+1"
    "5tCn7jpcVn7f4PcWnZzfOLhPKr9zqHT3tw4+ksrvHR66+5uHK+To4t6kO3U+hO7RHTv//5QS4nd95/+tTHf65b+RuGR58X8q/e7/r0jq"
    "4v9asn3+e8x/AVBLAQIUAxQAAAAIAAAAQV29EbLUgQ4AAMgZAAALAAAAAAAAAAAAAACAAQAAAABjbGFzc2VzLmRleFBLBQYAAAAAAQAB"
    "ADkAAACqDgAAAAA="
)
# ── 보이스룸 신호: 화면을 건드리지 않고 adb dumpsys 로 읽는다(docs/BOT_VOICE_ROOM.md 3절) ──
VOICE_SERVICE_RE = re.compile(r"vox|voice|call|room", re.I)


def notif_records(out, pkg):
    """dumpsys notification --noredact 에서 지금 떠 있는 이 앱의 알림: [{"ongoing", "text"}]. 지난 알림 보관함(mArchive)은 뺀다"""
    cut = min([i for i in (out.find(w) for w in ("mArchive", "Archive (", "Historical")) if i >= 0] or [len(out)])
    recs = []
    for blk in out[:cut].split("NotificationRecord(")[1:]:
        m = re.search(r"\bpkg=(\S+)", blk.split("\n", 1)[0])
        if not m or m.group(1) != pkg:
            continue
        flags = 0
        for f in re.findall(r"\bflags=0x([0-9a-fA-F]+)", blk):
            flags |= int(f, 16)
        texts = [t for t in re.findall(r"android\.(?:title|text|subText|bigText|infoText|textLines)=\w+ \((.*?)\)\s*$", blk, re.M) if t and t != "null"]
        ts = [int(x) for x in re.findall(r"\b(?:mUpdateTimeMs|mCreationTimeMs|postTime)=(\d{10,})", blk)]
        cr = [int(x) for x in re.findall(r"\bmCreationTimeMs=(\d{10,})", blk)] or [int(x) for x in re.findall(r"\bpostTime=(\d{10,})", blk)]
        recs.append({"ongoing": bool(flags & 0x42), "text": " / ".join(texts)[:200], "t": max(ts) if ts else 0,   # 0x2 진행 중, 0x40 포그라운드 서비스
                     "c": min(cr) if cr else 0})                                                                 # c: 알림이 처음 뜬 시각(ms)
    return recs


def voice_on_since(sig, v=None):
    """'참여 중' 알림이 처음 뜬 시각(초). 보이스룸을 만들거나 들어간 시각에 가깝다. 없으면 0.
    알림이 여럿이면(끝난 보이스룸의 것이 안 지워진 채 남음) 가장 최근에 올라온 것의 처음 뜬 시각"""
    w = voice_words(v)
    recs = [r for r in (sig or {}).get("notif") or [] if w["on"] in r["text"] and (r.get("c") or 0) > 0]
    if not recs:
        return 0.0
    return max(recs, key=lambda r: (r.get("t") or 0, r["c"]))["c"] / 1000.0


def audio_active(out, pkg, pids):
    """dumpsys audio: 이 앱의 재생이 돌고 있는지(players 에 state:started), 오디오 포커스를 쥐고 있는지.
    혼자 있는 보이스룸은 들어오는 소리가 없어 재생이 멈춰 있고 포커스만 쥔다(실측)"""
    started = any(m.group(1) in pids for m in re.finditer(r"u/pid:\d+/(\d+)\s+state:started", out))
    focus = re.search(r"pack:\s*%s\b" % re.escape(pkg), out) is not None
    return started, focus


def telecom_call(out, pkg):
    """dumpsys telecom: 이 앱의 통화가 살아 있는지(카카오톡 통화 계열은 전화 앱처럼 통화로 등록되기도 한다)"""
    for blk in re.split(r"\n(?=\s*(?:Call |\[?TC@))", out or ""):
        if pkg in blk and re.search(r"(?:State|state)\s*[:=]?\s*(ACTIVE|DIALING|CONNECTING|RINGING|HOLDING)\b", blk):
            return True
    return False


def fg_services(out, pkg):
    """dumpsys activity services <앱>: [(서비스 이름, 포그라운드인지)]"""
    res = []
    for blk in out.split("ServiceRecord{")[1:]:
        m = re.search(r"\s%s/(\S+?)\}" % re.escape(pkg), blk.split("\n", 1)[0])
        if not m:
            continue
        name = m.group(1)
        res.append((pkg + name if name.startswith(".") else name, "isForeground=true" in blk))
    return res


def net_state(route, conn=""):
    """연결된 망 종류: ip route get 1.1.1.1 의 장치(wlan WIFI, rmnet MOBILE), 없으면 dumpsys connectivity. 둘 다 없으면 '없음'.
    안드로이드는 경로 표가 여럿이라 그냥 ip route 는 비어 있다"""
    kinds = []
    for m in re.finditer(r"^(?:default\s.*?|\d+\.\d+\.\d+\.\d+\s.*?)\bdev\s+(\S+)", route or "", re.M):
        d = m.group(1)
        k = "WIFI" if d.startswith("wlan") else "MOBILE" if re.match(r"rmnet|ccmni|pdp|radio", d) else "ETHERNET" if d.startswith("eth") else d
        if k not in kinds:
            kinds.append(k)
    for m in re.finditer(r"\[type: (\w+)[^\n]*?state: (\w+)", conn or ""):
        if m.group(2) == "CONNECTED" and m.group(1) not in kinds:
            kinds.append(m.group(1))
    return ", ".join(kinds) or "없음"


def voice_words(v=None):
    v = v or {}
    return {"on": v.get("on_text") or "보이스룸에 참여 중", "end": v.get("end_text") or "보이스룸 종료", "word": v.get("notif_word") or "보이스룸"}


def voice_state(sig, v=None):
    """판정(실측 2026-10-02): 켜져 있으면 카카오톡 알림에 '보이스룸에 참여 중입니다' 가 있고 오디오 포커스를 쥔다(혼자면 재생은 멈춤,
    포그라운드 서비스는 안 보임). 끊기면 '보이스룸 종료 / 일시적인 오류가 발생하여 종료했습니다' 알림이 남는다.
    on: 참여 중 알림이 있고 카카오톡이 살아 있음. off: 참여 중 알림이 없고 소리, 포커스, 통화, 서비스도 없음. unsure: 엇갈림.
    unknown: adb 가 안 붙어 못 읽음"""
    w = voice_words(v)
    if sig.get("unreadable"):
        return "unknown", "읽지 못함: " + (sig.get("errors") or ["?"])[0]
    notes = sig.get("notif") or []
    has_on = [r for r in notes if w["on"] in r["text"]]
    ended_recs = [r for r in notes if w["end"] in r["text"]]
    ended = [r["text"] for r in ended_recs]
    end_note = (", 종료 알림: " + ended[-1].split(" / ", 1)[-1][:60]) if ended else ""
    on_t, end_t = max([r.get("t", 0) for r in has_on] or [0]), max([r.get("t", 0) for r in ended_recs] or [0])
    if has_on and sig.get("alive") and end_t > on_t and not sig.get("focus"):
        return "off", "참여 중 알림보다 종료 알림이 새롭고 포커스 없음" + end_note   # 참여 중 알림이 안 지워진 채 끝난 경우
    if has_on and sig.get("alive"):
        return "on", "참여 중 알림" + ("(진행 중)" if any(r["ongoing"] for r in has_on) else "") + (", 포커스" if sig.get("focus") else "")
    fg = [n for n, f in sig.get("services") or [] if f and VOICE_SERVICE_RE.search(n)]
    extra = ((["소리 재생"] if sig.get("audio") else []) + (["오디오 포커스"] if sig.get("focus") else [])
             + (["통화 상태"] if sig.get("call") else []) + (["서비스 " + ", ".join(fg)] if fg else []))
    if has_on:
        return "off", "참여 중 알림은 남았지만 카카오톡 꺼짐" + end_note
    if not extra:
        return "off", "참여 중 알림 없음" + ("" if sig.get("alive") else ", 카카오톡 꺼짐") + end_note
    return "unsure", "참여 중 알림은 없는데 " + ", ".join(extra) + end_note


def voice_status_lines(sig, st, v=None):
    state, why = voice_state(sig, v)
    out = ["보이스룸: %s (%s)" % ({"on": "켜짐", "off": "꺼짐", "unsure": "알 수 없음", "unknown": "읽지 못함"}[state], why)]
    if state == "unknown":
        if st.get("state"):
            out.append("기록: %s %s 부터" % ("켜짐" if st["state"] == "on" else "꺼짐", st.get("since", "")))
        return out
    w, notes = voice_words(v), sig.get("notif") or []
    for r in notes:                                     # 보이스룸 알림만 글자를 적는다(대화 알림 글은 적지 않는다)
        if w["word"] in r["text"]:
            out.append("알림: %s%s" % ("진행 중 " if r["ongoing"] else "", r["text"]))
    since = voice_on_since(sig, v)
    if state == "on" and since:
        out.append("참여 중 알림이 뜬 지: %.1f시간(%s부터)" % (max(0.0, time.time() - since) / 3600, datetime.fromtimestamp(since, KST).strftime("%m-%d %H:%M")))
    others = sum(1 for r in notes if w["word"] not in r["text"])
    if others:
        out.append("알림: 그 밖 %d개(글자는 적지 않음)" % others)
    out.append("소리: 재생 %s, 포커스 %s, 통화 상태 %s" % ("있음" if sig.get("audio") else "없음", "있음" if sig.get("focus") else "없음", "있음" if sig.get("call") else "없음"))
    out.append("포그라운드 서비스: %s" % (", ".join(n for n, f in sig.get("services") or [] if f) or "없음"))
    out.append("카카오톡 프로세스: %s" % (", ".join(sig.get("pids") or []) or "없음"))
    out.append("망: %s" % (sig.get("net") or "모름"))
    if sig.get("errors"):
        out.append("읽기 오류: " + " | ".join(sig["errors"]))
    if st.get("state"):
        out.append("기록: %s %s 부터" % ("켜짐" if st["state"] == "on" else "꺼짐", st.get("since", "")))
    drops = [e for e in st.get("events") or [] if e.get("to") == "off" and e.get("hours") is not None]
    if drops:
        e = drops[-1]
        out.append("최근 끊김: %s (%s, %s시간 만에, 망 %s, 카카오톡 %s), 끊김 %d번" % (e["at"], e["why"], e["hours"], e.get("net", "모름"), "살아 있음" if e.get("alive") else "꺼짐", len(drops)))
    return out


class VoiceWatch:
    """보이스룸 지키기: run 안에서 화면을 건드리지 않고 켜짐과 끊김을 알아채 기록하고(1단계), 끊겼으면 다시 켜고(2단계),
    만든 지 오래됐으면 끝내고 새로 만든다(48시간 갱신). docs/BOT_VOICE_ROOM.md"""
    BACKOFF = (60, 120, 300, 600, 900)                   # 복구 실패 뒤 다시 하기까지(초)
    RENEW_MAX = 2                                        # 갱신이 이만큼 잇달아 실패하면 그 보이스룸은 갱신하지 않는다(48시간이 되어 끊기면 복구가 새로 켠다)

    def __init__(self, cfg, sender, path, log, clock=None):
        self.v = dict(DEFAULTS["voice"], **(cfg.get("voice") or {}))
        self.cfg, self.sender, self.path, self.log = cfg, sender, path, log
        self.room = self.v.get("room") or cfg.get("room") or ""
        self.clock = clock or (lambda: datetime.now(KST))
        self.st = {"state": "", "since": "", "since_ts": 0, "events": [], "made": []}
        try:
            with open(path, encoding="utf-8-sig") as f:
                got = json.load(f)
            if isinstance(got, dict):
                self.st.update(got)
        except (OSError, ValueError):
            pass
        self.next_ts, self.off_streak, self.blind = 0.0, 0, False
        self.retry_at, self.fails, self.kick_until, self.renew_retry_at, self.last_skip = 0.0, 0, 0.0, 0.0, ""
        self.renew_fails, self.sig = 0, {}

    def due(self):
        return self.clock().timestamp() >= self.next_ts

    def can_recover(self):
        return self.v.get("recover", True) and bool(self.room) and hasattr(self.sender, "voice_recover")

    def save(self):
        save_json(self.path, self.st)

    def record(self, dt, ts, state, why, sig=None):
        ev = {"at": dt.astimezone(KST).strftime("%Y-%m-%d %H:%M"), "to": state, "why": why,
              "alive": bool((sig or {}).get("alive", True)), "net": (sig or {}).get("net") or ""}
        if self.st.get("state") == "on" and self.st.get("since_ts"):
            ev["hours"] = round((ts - float(self.st["since_ts"])) / 3600, 1)
        self.st["events"] = (self.st.get("events") or [])[-199:] + [ev]
        self.st["state"], self.st["since"], self.st["since_ts"] = state, ev["at"], ts
        if state == "on":
            self.renew_fails = 0                         # 새로 켜진 보이스룸은 갱신을 다시 해 본다
        self.save()
        return ev

    def tick(self):
        """한 번 읽고 판정. 꺼짐은 두 번 연속일 때만 끊김으로 적고, 그러면 다시 켠다.
        돌려주는 것: on, off, off?(한 번 안 보임), unknown(adb 안 붙음), wait, 그리고 복구 뒤 recovered, renewed"""
        dt = self.clock()
        ts = dt.timestamp()
        if ts < self.next_ts:
            return "wait"
        self.next_ts = ts + max(15, int(self.v.get("check_sec") or 60))
        sig = self.sig = self.sender.voice_signals()
        state, why = voice_state(sig, self.v)
        prev = self.st.get("state") or ""
        if state == "unknown":                           # adb 가 안 붙으면 판정을 바꾸지 않고, 처음 한 번만 적는다
            if not self.blind:
                self.log("보이스룸: " + why + ". 붙을 때까지 지난 판정(%s)을 지킨다" % ({"on": "켜짐", "off": "꺼짐"}.get(prev, "없음")))
            self.blind = True
            return "unknown"
        if self.blind:
            self.log("보이스룸: 다시 읽음")
            self.blind = False
        if state == "unsure":                            # 엇갈림(알림은 없는데 포커스 등): 켜져 있던 중이면 세 번 연속일 때 끊김으로
            if prev == "on":
                self.off_streak += 1
                if self.off_streak < 3:
                    return "off?"
                state = "off"
            else:
                state = prev or "off"
        elif state == "off" and prev == "on":
            self.off_streak += 1
            if self.off_streak < 2:
                return "off?"
        else:
            self.off_streak = 0
        if state != prev:
            ev = self.record(dt, ts, state, why, sig)
            if state == "on":
                self.log("보이스룸: 켜짐")
            elif prev == "on":
                self.log("보이스룸: 끊김(%s%s)" % (why, ", %s시간 만에" % ev["hours"] if "hours" in ev else ""))
            else:
                self.log("보이스룸: 지금 꺼져 있음(%s)" % why)
        if state == "on":
            self.fails, self.retry_at, self.kick_until = 0, 0.0, 0.0
            if self.can_recover() and self.renew_due(dt, ts):
                return self.renew(dt, ts)
            return "on"
        if self.can_recover():
            ok, skip = self.allowed(dt, ts, sig)
            if ok:
                return self.recover(dt, ts)
            if skip and skip != self.last_skip:
                self.log("보이스룸: 복구 안 함(%s)" % skip)
                self.last_skip = skip
        return state

    def allowed(self, dt, ts, sig=None):
        """지금 복구해도 되는지: 망, 재시도 간격, 내보내짐 뒤 대기, 하루 만들기 한도"""
        if sig is not None and (sig.get("net") or "") in ("", "없음"):
            return False, "망이 없음(와이파이나 핫스팟 끊김). 돌아오면 다시 켠다"
        if ts < self.retry_at:
            return False, ""
        if ts < self.kick_until:
            return False, "내보내진 뒤라 다시 들어가지 않음" + ("" if self.kick_until == float("inf") else ", %d분 뒤 한 번 더" % max(1, int((self.kick_until - ts) // 60)))
        today = dt.astimezone(KST).strftime("%Y-%m-%d")
        n = sum(1 for m in self.st.get("made") or [] if str(m).startswith(today))
        if n >= int(self.v.get("max_new_per_day") or 6):
            return False, "오늘 만든 횟수 %d번, 한도에 닿아 내일까지 쉼" % n
        return True, ""

    def recover(self, dt, ts):
        """끊긴 보이스룸을 다시 켠다. 실패하면 1, 2, 5, 10, 15분 간격으로 다시"""
        self.last_skip = ""
        try:
            how = self.sender.voice_recover(self.room, self.v)
        except KakaoError as e:
            self.fails += 1
            gap = self.BACKOFF[min(self.fails - 1, len(self.BACKOFF) - 1)]
            self.retry_at = ts + gap
            self.log("보이스룸 복구 실패(%d번째): %s. %d분 뒤 다시" % (self.fails, e, gap // 60))
            if self.fails == 5:
                self.alert("보이스룸 복구가 다섯 번 연속 실패했습니다: %s" % str(e)[:80])
            return "fail"
        if how == "kicked":
            kr = int(self.v.get("kick_retry_min") or 0)
            self.kick_until = ts + kr * 60 if kr else float("inf")
            self.log("보이스룸: 봇이 내보내진 것으로 보여 다시 들어가지 않음" + (", %d분 뒤 한 번 더" % kr if kr else ". 운영자가 보이스룸을 켜면 그때부터 다시 지킨다"))
            return "kicked"
        self.fails, self.retry_at, self.off_streak = 0, 0.0, 0
        if how == "created":
            self.st["made"] = ((self.st.get("made") or []) + [dt.astimezone(KST).strftime("%Y-%m-%d %H:%M")])[-50:]
        self.record(dt, ts, "on", {"created": "복구: 새로 만듦", "joined": "복구: 열려 있는 보이스룸에 참여", "on": "확인: 이미 켜져 있음"}.get(how, how))
        self.log("보이스룸: " + {"created": "새로 만들어 켬", "joined": "열려 있는 보이스룸에 참여함", "on": "화면으로 보니 켜져 있음"}.get(how, how))
        return "recovered"

    def start_ts(self):
        """보이스룸을 켠 시각. 기록(봇이 켜짐을 본 시각)보다 '참여 중' 알림이 처음 뜬 시각을 믿는다:
        봇이 꺼져 있는 사이 새로 켜졌거나(알림이 더 늦음), 봇이 늦게 알아챘으면(알림이 더 이름, 48시간 안) 알림 쪽이 맞다"""
        since = float(self.st.get("since_ts") or 0)
        last_on = [e for e in self.st.get("events") or [] if e.get("to") == "on"][-1:]
        if last_on and str(last_on[0].get("why", "")).startswith(("복구:", "갱신:")) and not str(last_on[0].get("why", "")).startswith("복구: 열려 있는"):
            return since                                     # 봇이 직접 새로 켠 것: 그 시각이 맞다(남은 옛 알림 시각을 믿지 않는다)
        made = voice_on_since(self.sig, self.v)
        if made and (made > since or since - made < 48 * 3600):
            return made
        return since

    def renew_due(self, dt, ts):
        if self.renew_fails >= self.RENEW_MAX:
            return False                                     # 이 보이스룸은 갱신을 그만뒀다
        hours = float(self.v.get("renew_hours") or 47.5)
        since = self.start_ts()
        if not since or ts - since < hours * 3600 or ts < self.renew_retry_at:
            return False
        if ts - float(self.st.get("renewed_ts") or 0) < hours * 1800:
            return False                                     # 갱신한 뒤 반나절(갱신 주기의 절반)은 다시 하지 않는다(시각을 잘못 읽어도 되풀이하지 않게)
        today = dt.astimezone(KST).strftime("%Y-%m-%d")
        if sum(1 for m in self.st.get("made") or [] if str(m).startswith(today)) >= int(self.v.get("max_new_per_day") or 6):
            return False                                     # 오늘 만든 횟수가 한도면 갱신도 하지 않는다
        if in_quiet(dt.astimezone(KST).strftime("%H:%M"), self.cfg.get("quiet") or []):
            return False                                     # 조용한 시간대에는 갱신하지 않는다(끊김 복구는 한다)
        return True

    def renew(self, dt, ts):
        """48시간 만료 전에 봇이 먼저 끝내고 새로 만든다(몇 초 빈다). 안 되면 30분 뒤 다시"""
        try:
            self.sender.voice_end(self.room, self.v)
            self.record(dt, ts, "off", "갱신: 봇이 끝냄")
            how = self.sender.voice_recover(self.room, self.v)
        except KakaoError as e:
            self.renew_fails += 1
            if self.renew_fails >= self.RENEW_MAX:          # 화면을 거듭 건드리지 않는다. 48시간이 되어 끊기면 복구가 새로 켠다
                self.log("보이스룸 갱신 실패(%d번째): %s. 이 보이스룸은 갱신하지 않고, 48시간이 되어 끊기면 다시 켠다" % (self.renew_fails, e))
            else:
                self.renew_retry_at = ts + 1800
                self.log("보이스룸 갱신 실패: %s. 30분 뒤 다시" % e)
            return "renew-fail"
        if how == "created":
            self.st["made"] = ((self.st.get("made") or []) + [dt.astimezone(KST).strftime("%Y-%m-%d %H:%M")])[-50:]
        self.st["renewed_ts"] = ts
        self.record(dt, ts, "on", "갱신: 새로 만듦")
        self.log("보이스룸: 48시간 만료 전에 끝내고 새로 만듦")
        return "renewed"

    def alert(self, text):
        self.log("!! " + text)
        if self.v.get("alert_test_room") and self.cfg.get("test_room") and hasattr(self.sender, "send"):
            try:
                self.sender.send(self.cfg["test_room"], "[excer-bot] " + text)
            except KakaoError as e:
                self.log("알림을 시험 방에 보내지 못함: %s" % e)


BOUNDS_RE = re.compile(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]")
NAV_WORDS = {"채팅", "오픈채팅", "친구", "더보기", "쇼핑", "뷰", "지갑", "전체", "안읽음"}


def ws(s):
    return re.sub(r"\s+", " ", s or "").strip()


def find(nodes, text=None, desc=None, starts=None, cls=None, rid=None):
    out = []
    for n in nodes:
        if text is not None and n["text"] != text:
            continue
        if desc is not None and n["desc"] != desc:
            continue
        if starts is not None and not n["text"].startswith(starts):
            continue
        if cls is not None and not n["cls"].endswith(cls):
            continue
        if rid is not None and rid not in n["rid"]:
            continue
        out.append(n)
    return out


MEMBER_NEVER = ("나가기", "내보내기", "강퇴", "신고", "차단", "삭제", "가리기", "초대", "종료", "설정")   # 멤버 읽기에서 누르지 않는 말(VOICE_NEVER 에 더해)
MEMBER_HEAD_RE = re.compile(r"^(?:대화\s*상대|참여자|참여\s*(?:인원|멤버)|채팅방\s*멤버|멤버)\s*[(\[]?\s*(\d[\d,]*)?\s*명?\s*[)\]]?$")   # 대화상대 칸 머리: '대화상대 37', '대화상대(25)', '참여자 12명'
MEMBER_COUNT_RE = re.compile(r"^[(\[]?\s*\d[\d,]*\s*명?\s*[)\]]?$")   # 수만 있는 글(머리 옆의 '37' 같은)
MEMBER_SECTION_RE = re.compile(r"^(운영진|방장|부방장|운영자|관리자|일반\s*멤버|멤버|참여자)\s*[(\[]?\s*\d[\d,]*\s*명?\s*[)\]]?$")   # 전체 멤버 화면의 칸 머리('운영진 4', '멤버 90')
MEMBER_MORE = ("더보기", "전체보기", "모두보기", "대화상대더보기", "대화상대전체보기", "참여자더보기", "참여자전체보기", "멤버더보기", "멤버전체보기")   # 대화상대 칸의 더보기 단추(띄어쓰기와 기호를 뺀 모양)
MEMBER_SELF = ("나", "본인", "me")                     # 봇 자신의 줄 표시
MEMBER_LABELS = set("""채팅방서랍 서랍 톡게시판 게시판 공지 공지사항 사진동영상 사진 동영상 파일 링크 일정 톡캘린더 캘린더 투표 앨범 음성메시지
    보이스룸 라이브톡 채팅방설정 설정 채팅방관리 멤버관리 오픈채팅 오픈채팅정보 대화상대 참여자 멤버 대화상대초대 초대하기 초대 친구초대
    대화상대검색 검색 대화내용검색 알림 알림끄기 알림켜기 즐겨찾기 나가기 채팅방나가기 메뉴 닫기 뒤로 뒤로가기 이전 프로필 내프로필
    11채팅 채팅하기 방장 부방장 나 본인 me 운영자 관리자 온라인 오프라인
    퀴즈 챗봇 챗봇beta beta 커버보기 오픈채팅관리 공유 공유하기 채팅방정보 운영진 일반멤버""".split()) | set(MEMBER_MORE)   # 이름이 아닌 글(서랍과 방 정보 화면의 메뉴와 칸 이름, 표시)
MEMBER_RID_RE = re.compile(r"name|nick", re.I)        # 이름 칸 id 로 볼 것(name, nickname, profile_name)
MEMBER_RID_NOT = re.compile(r"room|title|menu|header|section|count|badge|status|message", re.I)
MEMBER_LIST_RE = re.compile(r"RecyclerView|ListView|ScrollView|GridView")
MEMBER_KEY_RE = re.compile(r"(?<![0-9A-Za-z_])mbk_[0-9a-f]{48}(?![0-9A-Za-z_])")   # 봇 열쇠: mbk_ 뒤에 소문자 16진수 48자


def member_mk(s):
    """견주기용: 띄어쓰기와 기호를 빼고 소문자('사진/동영상' 은 '사진동영상', '전체보기 >' 는 '전체보기')"""
    return re.sub(r"[\W_]+", "", s or "").lower()


def member_name(s):
    """사이트와 같은 닉네임 정리: NFC(분해된 한글을 모은다), 공백 묶음은 하나로, 앞뒤 공백 뗌"""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", s or "")).strip()


def member_key(s):
    """같은 사람 가르기(사이트의 bung_nick_key 처럼): 보이지 않는 글자를 빼고 소문자"""
    return re.sub(r"\s+", " ", INVIS_RE.sub("", member_name(s))).strip().lower()


def member_label(s, room=""):
    """이름이 아닌 글: 서랍의 메뉴와 칸 이름, 표시(방장, 나), 대화상대 머리, 수, 방 이름, 기호뿐인 글"""
    t = member_name(s)
    k = member_mk(t)
    return not k or k in MEMBER_LABELS or bool(MEMBER_HEAD_RE.match(t) or MEMBER_COUNT_RE.match(t) or MEMBER_SECTION_RE.match(t)) or (bool(room) and t == member_name(room))


def member_headish(s):
    """모르는 대화상대 머리로 보이는 글('참여 중인 멤버 8', '구성원 8'): 머리 말과 수만. 닉네임(끝이 수)은 머리 말이 없어 아니다"""
    t = member_name(s)
    if re.search(r"(^|\s)(남|여)(\s|$)", t):
        return False                                     # '대화왕 역삼 남 88' 같은 닉네임(성별 칸)은 머리가 아니다(study 에 그대로 나오지 않게)
    return len(t) <= 14 and bool(re.match(r"^[가-힣\s]*(대화|참여|멤버|인원|구성원|참가)[가-힣\s]*[(\[]?\s*\d[\d,]*\s*명?\s*[)\]]?$", t))


def member_isbot(s):
    """봇 이름(운영 화면과 같은 규칙: 끝이 '봇' 이거나 ' bot', '_bot')"""
    return bool(re.search(r"(^|[\s_])bot$", s, re.I)) or s.endswith("봇")


def member_mask(s):
    """화면에 보일 때 이름을 가린다: 첫 글자만, 나머지는 *(띄어쓰기는 그대로)"""
    return s[:1] + "".join(c if c == " " else "*" for c in s[1:])


def member_merge(names, page, back=False):
    """한 쪽의 이름을 목록에 넣는다(처음 본 차례, 겹침 없이). 넣은 수를 돌려준다.
    앞으로 민 쪽은 새 이름을 끝에 붙이고, 되돌려 읽은 쪽(back)은 아는 이름 사이 제자리에 끼운다"""
    ks = [member_key(x) for x in names]
    added, pos, pend, pk = 0, None, [], set()
    for nm in page:
        k = member_key(nm)
        if not k or k in pk:
            continue
        if k in ks:
            if back:
                j = ks.index(k)
                names[j:j], ks[j:j] = pend, [member_key(x) for x in pend]
                added, pos, pend, pk = added + len(pend), j + len(pend) + 1, [], set()
            continue
        if back and pos is None:
            pend.append(nm)
            pk.add(k)
        elif back:
            names.insert(pos, nm)
            ks.insert(pos, k)
            pos, added = pos + 1, added + 1
        else:
            names.append(nm)
            ks.append(k)
            added += 1
    names.extend(pend)
    return added + len(pend)


class AdbSender:
    """태블릿(또는 폰) 안의 Termux 에서 돈다. adb 로 같은 기기에 붙어 화면을 읽고(uiautomator dump) 누른다(input)"""
    TMP = "/data/local/tmp/excer_ui.xml"
    JAR = "/data/local/tmp/excer_dump.jar"
    diag_path = None                                             # 안 될 때 그때 화면을 적을 파일(main 이 정한다)
    mem_left = None                                              # 멤버 읽기가 서랍을 닫았다고 보지 못하고 끝났으면 {pre, marks}. 다음 open_room 이 먼저 닫는다

    def __init__(self, cfg, log, run=None):
        self.t, self.log, self.sleep = cfg["tablet"], log, time.sleep
        self.run = run or self._run
        self.serial = ""
        self.trace = []                                          # 안 될 때 원인을 보려고 지나온 화면을 모아 둔다
        self.facts, self.changed = [], False                     # 지나온 곳(진단 한 마디씩), 누른 뒤 화면이 바뀌었는지(wait_change)
        self.mini_box, self.mini_keys = None, set()              # 카카오톡 화면 안에 그려진 보이스룸 작은 창(dump)
        self.fast = None                                         # 화면 읽기 도우미: None 아직 모름, True 됨, False 이 기기에서 안 됨(기본 방식만)
        self.fast_fail = 0
        self.vcfg = dict(DEFAULTS["voice"], **(cfg.get("voice") or {}))   # 보이스룸 제목(띠와 작은 창 글자를 공지나 보이스룸 화면으로 보지 않게)
        self.rot_fixed, self.rot_note, self.shape, self.turn_note = False, 0.0, None, 0.0   # 화면 방향 고정, 지난번 화면 모양(가로나 세로, 넓이)
        self.comps = {}                                          # 앱의 첫 화면 이름(am start 로 띄울 때)
        self.rot_state = ""                                      # 마지막 방향 고정: '' 됨(또는 할 일 없음), unknown 회전 값을 못 읽음, failed 바꾸지 못함
        self.main_room, self.room_link = cfg.get("room") or "", (cfg.get("room_link") or "").strip()   # 알릴 방과 그 오픈채팅 주소

    @staticmethod
    def _run(args, data=None, timeout=30):
        try:
            p = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
        except FileNotFoundError:
            raise KakaoError("'%s' 명령이 없음(Termux 에서 pkg install android-tools termux-api)" % args[0])
        except subprocess.TimeoutExpired:
            raise KakaoError("'%s' 가 %d초 안에 끝나지 않음" % (" ".join(args[:4]), timeout))
        return p.returncode, p.stdout.decode("utf-8", "replace"), p.stderr.decode("utf-8", "replace")

    # 연결
    def devices(self):
        code, out, err = self.run([self.t["adb"], "devices"], None, 20)
        return [l.split("\t")[0] for l in out.splitlines()[1:] if l.strip().endswith("\tdevice") or l.strip().endswith(" device")]

    def device(self):
        if self.serial:
            return self.serial
        want, devs = self.t.get("serial") or "", self.devices()
        if want:
            if want not in devs and ":" in want:
                self.run([self.t["adb"], "connect", want], None, 20)
                devs = self.devices()
            if want in devs:
                self.serial = want
                return want
            fixed = "127.0.0.1:%d" % self.FIXED                # 무선 디버깅 포트가 죽었어도 고정 포트가 열려 있으면 그리로
            if want != fixed:
                try:
                    code, out, err = self.run([self.t["adb"], "connect", fixed], None, 10)
                    if "connected" in out and "failed" not in out and "cannot" not in out:
                        self.serial = fixed
                        return fixed
                except KakaoError:
                    pass
            raise KakaoError("adb 에 '%s' 기기가 없음. 무선 디버깅이 꺼졌거나 재부팅했으면 무선 디버깅을 켜고 python excer_bot.py connect" % want)
        if len(devs) == 1:
            self.serial = devs[0]
            return self.serial
        if not devs:
            raise KakaoError("adb 에 붙은 기기가 없음. 무선 디버깅을 켜고 python excer_bot.py connect")
        local = [d for d in devs if d.startswith("127.0.0.1:")]   # 127.0.0.1 로 붙은 것은 모두 이 기기(무선 포트와 고정 포트)
        if local:
            fixed = "127.0.0.1:%d" % self.FIXED
            self.serial = fixed if fixed in local else local[0]
            return self.serial
        raise KakaoError("adb 에 붙은 기기가 여럿(%s). excer_bot.json 의 tablet.serial 에 하나를 넣으세요" % ", ".join(devs))

    def mdns_port(self):
        """기기가 알리는 무선 디버깅 포트(adb mdns services 의 _adb-tls-connect). 이 adb 가 mdns 를 못 하면 ''"""
        try:
            code, out, err = self.run([self.t["adb"], "mdns", "services"], None, 15)
        except KakaoError:
            return ""
        m = re.search(r"_adb-tls-connect\._tcp\.?\s+\S*?:(\d{1,5})\b", out or "")
        return m.group(1) if m else ""

    @staticmethod
    def probe(port):
        """이 기기 안(127.0.0.1)에서 이 포트가 열려 있는지"""
        import socket
        s = socket.socket()
        s.settimeout(0.05)
        try:
            return s.connect_ex(("127.0.0.1", port)) == 0
        except OSError:
            return False
        finally:
            s.close()

    def scan_port(self, ranges=((5555, 5556), (30000, 50000), (50000, 61000))):
        """무선 디버깅 포트 찾기: 기기 안의 열린 포트를 훑어 adb connect 가 되는 것. 무선 디버깅은 3만에서 5만 사이 숫자를 쓴다"""
        tried = 0
        for lo, hi in ranges:
            for port in range(lo, hi):
                if not self.probe(port):
                    continue
                tried += 1
                if tried > 12:
                    return ""
                try:
                    code, out, err = self.run([self.t["adb"], "connect", "127.0.0.1:%d" % port], None, 10)
                except KakaoError:
                    return ""
                if "connected" in out and "cannot" not in out and "failed" not in out:
                    return str(port)
        return ""

    def connect(self, port):
        addr = port if ":" in str(port) else "127.0.0.1:%s" % port
        code, out, err = self.run([self.t["adb"], "connect", addr], None, 20)
        if "connected" not in out or "cannot" in out or "failed" in out:
            msg = (out + err).strip()[:200]
            if "refused" in msg:                        # 흔한 실수: 예로 든 숫자나 페어링 창의 포트를 넣음
                msg += ("\n포트를 확인하세요. 안내에 예로 적힌 숫자가 아니라 이 기기 화면에 보이는 숫자이고, 페어링 창의 포트가 아니라 "
                        "무선 디버깅 첫 화면 'IP 주소 및 포트' 의 : 뒤 숫자입니다(무선 디버깅을 껐다 켜거나 재부팅하면 바뀝니다).\n"
                        "숫자를 안 적고 python excer_bot.py connect 만 치면 스스로 찾아 봅니다.")
            raise KakaoError("adb connect 실패: %s" % msg)
        self.serial = addr
        done = []
        # Termux 가 오래 돌 때 안드로이드가 끄지 않게. 화면은 꺼져도 된다(봇이 쓸 때 켠다)
        for cmd, what in (("settings put global settings_enable_monitor_phantom_procs false", "Termux 강제 종료 막기"),):
            try:
                self.sh(cmd)
                done.append(what)
            except KakaoError:
                pass
        fixed = self.fixed_port(addr)
        if fixed:
            done.append(fixed)
        return self.serial, done

    FIXED = 5555
    pending_auth = False

    def fixed_port(self, addr):
        """무선 디버깅은 와이파이가 바뀌거나 저절로 꺼지면 포트가 사라진다. adbd 를 고정 포트(5555)로도 열어 두면 그래도 붙는다(재부팅 전까지).
        처음 한 번은 태블릿 화면의 'USB 디버깅을 허용하시겠습니까?' 창에서 허용해야 한다. 안 되면 조용히 무선 포트를 그대로 쓴다"""
        fixed = "127.0.0.1:%d" % self.FIXED
        if addr == fixed:
            return "고정 포트 %d" % self.FIXED
        ok = lambda out: "connected" in out and "failed" not in out and "cannot" not in out
        try:
            code, out, err = self.run([self.t["adb"], "connect", fixed], None, 10)
            if ok(out):                                           # 이미 열려 있음
                self.serial = fixed
                return "고정 포트 %d(이미 열려 있음)" % self.FIXED
            code, out, err = self.run([self.t["adb"], "-s", addr, "tcpip", str(self.FIXED)], None, 20)
            if "restarting" not in out + err:
                return ""
            self.sleep(2.5)
            for _ in range(3):
                code, out, err = self.run([self.t["adb"], "connect", fixed], None, 10)
                if ok(out):
                    self.serial = fixed
                    return "고정 포트 %d(무선 디버깅이 꺼져도 붙음, 재부팅 전까지)" % self.FIXED
                if re.search(r"authenticat|unauthorized", out + err):
                    self.pending_auth = True                      # 화면의 허용 창을 눌러야 한다
                    return ""
                self.sleep(1.5)
        except KakaoError:
            pass
        return ""

    def adb(self, *args, **kw):
        timeout = kw.get("timeout", 30)
        for attempt in (0, 1):
            s = self.device()
            code, out, err = self.run([self.t["adb"], "-s", s] + list(args), None, timeout)
            if code == 0:
                return out
            msg = (err or out).strip()
            if attempt == 0 and re.search(r"not found|offline|closed|no devices|protocol fault|unauthorized", msg):
                self.serial = ""                        # 무선 연결이 끊겼으면 한 번 다시 붙어 본다
                if ":" in s:
                    self.run([self.t["adb"], "connect", s], None, 20)
                self.sleep(1)
                continue
            raise KakaoError("adb 명령 실패(%s): %s" % (" ".join(args)[:50], msg[:200]))

    def sh(self, cmd, timeout=30):
        return self.adb("shell", cmd, timeout=timeout)

    # 화면
    def install_dumper(self):
        """화면 읽기 도우미를 기기에 둔다(이미 같은 것이 있으면 그대로). 안 되면 기본 방식(uiautomator dump)만 쓴다"""
        import base64
        import hashlib
        data = base64.b64decode("".join(DUMPER_JAR))
        want = hashlib.sha1(data).hexdigest()
        try:
            have = self.sh("sha1sum %s 2>/dev/null; true" % self.JAR).split(" ")[0].strip()
            if have != want:
                b64 = base64.b64encode(data).decode()
                self.sh("rm -f %s; echo %s | base64 -d > %s; chmod 444 %s; true" % (self.JAR, b64, self.JAR, self.JAR))
                have = self.sh("sha1sum %s 2>/dev/null; true" % self.JAR).split(" ")[0].strip()
            return have == want
        except KakaoError:
            return False

    def _parse_dump(self, out):
        i, j = out.find("<hierarchy"), out.rfind("</hierarchy>")
        if i < 0 or j <= i:
            return None, out.strip()[:120] or "빈 결과"
        try:
            root = ET.fromstring(out[i:j + len("</hierarchy>")])
        except ET.ParseError as e:
            return None, str(e)
        nodes = self._nodes(root)
        if nodes:                                                # 도우미가 적은 창 목록(가린 자리, 진단)과 활성 덧창 대신 앱 창을 읽었는지
            self.picked = root.get("picked") or ""
            self.windows = []
            for w in root.iter("window"):
                m = BOUNDS_RE.match(w.get("bounds", ""))
                lay = w.get("layer", "")
                self.windows.append({"type": w.get("type", ""), "layer": int(lay) if re.fullmatch(r"-?\d+", lay) else 0,
                                     "active": w.get("active") == "true", "read": w.get("read") == "true", "pip": w.get("pip") == "true",
                                     "pkg": w.get("package", ""), "b": tuple(int(x) for x in m.groups()) if m else (0, 0, 0, 0)})
        return (nodes, "") if nodes else (None, "빈 화면")

    WIN_KIND = {"1": "앱", "2": "입력기", "3": "시스템", "4": "접근성", "5": "나눔선"}

    def win_name(self, w):
        pk = "카카오톡" if w["pkg"] == self.t["package"] else (w["pkg"].split(".")[-1] or "?")
        if w["pip"] or (w["type"] != "1" and w["pkg"] == self.t["package"]):
            return pk + " 작은 창"
        return "%s %s" % (self.WIN_KIND.get(w["type"], w["type"]), pk)

    def win_text(self):
        """창 목록 한 줄(진단): 종류와 앱, 크기와 자리, 활성, 읽은 창. 도우미가 활성 덧창 대신 앱 창을 읽었으면 그렇다고. 목록이 없으면 ''"""
        ws_ = getattr(self, "windows", None) or []
        if not ws_:
            return ""
        parts = []
        for w in ws_[:8]:
            l, t, r, b = w["b"]
            parts.append("%s %dx%d+%d+%d%s%s" % (self.win_name(w), r - l, b - t, l, t, " 활성" if w["active"] else "", " 읽음" if w["read"] else ""))
        return "창: " + ", ".join(parts) + (" (작은 창이 활성이라 앱 창을 읽음)" if getattr(self, "picked", "") == "app" else "")

    def cover_at(self, x, y, n=None):
        """(x, y) 를 덮은 창: 읽은 창보다 위에 겹친 다른 창(보이스룸 작은 창, 화면 가장자리 막대 같은). 그 자리를 누르면 그 창이 눌린다.
        창 목록에 없어도 카카오톡 화면 안에 그려진 보이스룸 작은 창 자리면 가린 것으로 본다(작은 창 자신의 요소 n 은 빼고). 없으면 None"""
        ws_ = getattr(self, "windows", None) or []
        me = [w for w in ws_ if w["read"]]
        for w in (ws_ if me else []):
            if not w["read"] and w["layer"] > me[0]["layer"] and w["b"][0] <= x < w["b"][2] and w["b"][1] <= y < w["b"][3]:
                return w
        for mb in getattr(self, "mini_boxes", None) or []:
            if mb[0] <= x < mb[2] and mb[1] <= y < mb[3]:
                if n is not None and (n["b"], n["text"], n["desc"]) in (getattr(self, "mini_keys", None) or set()):
                    return None                                  # 작은 창 자신의 요소(보이스룸 흐름이 일부러 누르는 것)
                return {"type": "3", "layer": 0, "active": False, "read": False, "pip": False, "pkg": self.t["package"], "b": mb, "tree": True}
        return None

    UI_WORDS = NAV_WORDS | {"지금", "숏폼", "전송", "공지", "확인", "예", "아니요", "메뉴", "붙여넣기", "핀", "고정", "상세보기"}

    def tap_label(self, n):
        """누르려던 것의 이름(진단): 정해진 화면 낱말이면 그 낱말, 아니면 요소 종류(방 이름이나 대화 글은 적지 않는다)"""
        if n is None:
            return "밀 자리"
        lab = ws(n["text"]) or ws(n["desc"])
        head = re.split(r"[\s,]", lab)[0] if lab else ""
        if head in self.UI_WORDS or lab in self.ENTER_WORDS:
            return lab if lab in self.ENTER_WORDS else head
        return n["cls"].split(".")[-1] or "요소"

    def covered_err(self, w, n=None, what=None):
        l, t, r, b = w["b"]
        where = "화면 안 작은 창 [%d,%d][%d,%d]" % (l, t, r, b) if w.get("tree") else "창: %s %dx%d+%d+%d" % (self.win_name(w), r - l, b - t, l, t)
        msg = "누를 곳이 %s에 가려 있음(%s). 누르려던 것: %s" % (self.win_name(w), where, what or self.tap_label(n))
        if n is not None:
            msg += " [%d,%d][%d,%d]" % n["b"]
        sw, sh = (self.shape[2], self.shape[3]) if self.shape else (max([x["b"][2] for x in getattr(self, "windows", None) or []] or [r]),
                                                                   max([x["b"][3] for x in getattr(self, "windows", None) or []] or [b]))
        there = l <= sw * 0.05 and sh * 0.3 <= (t + b) / 2 <= sh * 0.7    # 이미 왼쪽 가장자리 가운데 높이
        if "작은 창" in self.win_name(w) and not there:
            msg += ". 작은 창을 화면 왼쪽 가장자리 가운데 높이로 옮겨 주세요"
        return Covered(msg)

    def point(self, n, what=None):
        """요소를 누를 자리: 가운데. 가운데가 다른 창에 가려 있으면 요소 안의 가리지 않은 자리. 다 가려 있으면 Covered(가린 창을 누르지 않게)"""
        x, y = self.center(n)
        w = self.cover_at(x, y, n)
        if w is None:
            return x, y
        l, t, r, b = n["b"]
        for fy in (0.5, 0.25, 0.75, 0.1, 0.9):
            for fx in (0.5, 0.25, 0.75, 0.1, 0.9):
                px, py = l + int((r - l) * fx), t + int((b - t) * fy)
                if self.cover_at(px, py, n) is None:
                    return px, py
        raise self.covered_err(w, n, what)

    def free_x(self, x, y, l, r):
        """밀기를 시작할 자리(x, y)가 다른 창에 가려 있으면 같은 높이에서 l..r 안의 가리지 않은 x(가린 창을 끌지 않게). 없으면 Covered"""
        w = self.cover_at(x, y)
        if w is None:
            return x
        for f in (0.5, 0.35, 0.65, 0.2, 0.8, 0.08, 0.92):
            px = l + int((r - l) * f)
            if self.cover_at(px, y) is None:
                return px
        raise self.covered_err(w)

    def dump(self):
        """지금 화면의 요소들. 화면이 막 가로와 세로로 바뀌었으면(돌아가는 중) 잠깐 기다렸다 다시 읽는다"""
        nodes = self._dump()
        sh = self.shape_of(nodes)
        if sh and self.shape and sh[0] != self.shape[0] and sh[1] >= self.shape[1] * 0.6:
            if time.time() - self.turn_note >= 600:              # 같은 줄이 쌓이지 않게 10분에 한 번만 적는다
                self.turn_note = time.time()
                self.log("화면이 %s로 바뀜. 다 돌 때까지 기다렸다 다시 읽음" % ROT_NAME[sh[0]])
            self.sleep(1.5)
            nodes = self._dump()
            sh = self.shape_of(nodes) or sh
        if sh:
            self.shape = sh
        self.mini_boxes, self.mini_keys = [], set()             # 카카오톡 화면 안에 그려진 보이스룸 작은 창(그 자리는 누르지 않는다, cover_at)
        try:
            inl = self.in_lists(nodes)
            minis = [(box, under) for box, under in self.voice_minis(nodes) if box["i"] not in inl]   # 대화 칸, 목록 안의 카드는 아님
        except Exception:
            minis = []
        for box, under in minis:
            self.mini_boxes.append(box["b"])
            self.mini_keys |= {(nodes[i]["b"], nodes[i]["text"], nodes[i]["desc"]) for i in under}
        self.mini_box = self.mini_boxes[0] if self.mini_boxes else None
        return nodes

    @staticmethod
    def shape_of(nodes):
        """화면 전체를 덮는 창이면 (가로나 세로, 넓이, 폭, 높이). 작은 창(메뉴, 확인 창)이면 None"""
        if not nodes:
            return None
        l, t, r, b = nodes[0]["b"]
        if l > 10 or t > 10 or r - l < 200 or b - t < 200:
            return None
        return ("landscape" if r - l > b - t else "portrait", (r - l) * (b - t), r - l, b - t)

    def _dump(self):
        """도우미로 먼저 읽고(바빠도 읽힘), 안 되면 기본 uiautomator dump 로(화면이 1초 멈출 때까지 기다림)"""
        if self.fast is None:
            self.fast = self.install_dumper() or False
        last = ""
        for _ in range(6):
            if self.fast:
                out = self.sh("rm -f %s; CLASSPATH=/system/framework/uiautomator.jar:%s app_process /system/bin ExcerDump %s 200 1200 0 0 %s "
                              ">/dev/null 2>&1; cat %s 2>/dev/null; true" % (self.TMP, self.JAR, self.TMP, self.t["package"], self.TMP), timeout=30)
                nodes, last = self._parse_dump(out)
                if nodes:
                    self.fast_fail = 0
                    return nodes
                self.fast_fail += 1
                if self.fast_fail >= 3:                          # 이 기기에서 도우미가 안 되면 기본 방식만
                    self.fast = False
                    self.log("화면 읽기 도우미가 이 기기에서 안 됨, 기본 방식으로 읽음(%s)" % last)
            out = self.sh("rm -f %s; uiautomator dump %s >/dev/null 2>&1; cat %s 2>/dev/null; true" % (self.TMP, self.TMP, self.TMP), timeout=45)
            nodes, last = self._parse_dump(out)
            if nodes:
                return nodes
            self.sleep(0.8)
        raise KakaoError("화면을 읽지 못함: %s" % last)

    @staticmethod
    def _nodes(root):
        out = []

        def walk(el, parent):
            if el.tag == "node":
                a = el.attrib
                m = BOUNDS_RE.match(a.get("bounds", ""))
                n = {"text": a.get("text", ""), "desc": a.get("content-desc", ""), "rid": a.get("resource-id", ""),
                     "cls": a.get("class", ""), "click": a.get("clickable") == "true", "scroll": a.get("scrollable") == "true", "pkg": a.get("package", ""),
                     "b": tuple(int(x) for x in m.groups()) if m else (0, 0, 0, 0), "kids": [], "i": len(out)}
                out.append(n)
                if parent is not None:
                    parent["kids"].append(n["i"])
                parent = n
            for c in el:
                walk(c, parent)
        walk(root, None)
        return out

    @staticmethod
    def center(n):
        l, t, r, b = n["b"]
        return (l + r) // 2, (t + b) // 2

    def tap(self, n):
        self.sh("input tap %d %d" % self.point(n))
        self.sleep(0.6)

    def hold(self, n, ms=1000, what="길게 누를 곳"):
        x, y = self.point(n, what)
        self.sh("input swipe %d %d %d %d %d" % (x, y, x, y, ms))
        self.sleep(0.9)

    def key(self, *codes):
        self.sh("input keyevent " + " ".join(str(c) for c in codes))
        self.sleep(0.3)

    def set_clip(self, text):
        code, out, err = self.run([self.t["clip"]], text.encode("utf-8"), 20)
        if code != 0:
            raise KakaoError("클립보드에 넣지 못함(%s, Termux:API 앱이 깔려 있는지): %s" % (self.t["clip"], (err or out).strip()[:120]))

    # 카카오톡 채팅 목록과 방
    def on_kakao(self, nodes):
        return any(n.get("pkg") == self.t["package"] for n in nodes)

    CHAT_NAV_RE = re.compile(r"^(?:선택됨\s*,?\s*)?채팅(\s*탭)?\s*(,|$)")
    NOW_NAV_RE = re.compile(r"^(?:선택됨\s*,?\s*)?(지금|오픈채팅)(\s*탭)?\s*(,|$)")

    @staticmethod
    def head_band(nodes):
        """화면 맨 위 머리 띠의 아래 끝(높이의 12%). 목록 칸 머리 제목 '채팅' 은 이 안에 있다"""
        return max([n["b"][3] for n in nodes] or [0]) * 0.12

    def chat_nav(self, nodes):
        """누를 '채팅' 메뉴: 아래(또는 옆) 메뉴의 것. 이름이 '채팅 탭', '채팅, 새 메시지 3개' 처럼 붙어 나오는 판도 있다. 여럿이면 아래 것.
        목록 칸 머리 제목 글자 '채팅'(화면 맨 위)은 누르지 않는다(보이스룸 작은 창이 그 자리에 떠 있곤 하다). 목록 안의 글(말풍선)도 아니다"""
        inl, right = self.in_lists(nodes), self.list_right(nodes)
        k = [n for n in nodes if n.get("pkg") == self.t["package"] and n["i"] not in inl and self.center(n)[0] < right]   # 목록 안(말풍선, 목록 줄)과 방 칸은 빼고
        top = self.head_band(nodes)
        low = lambda c: sorted(c, key=lambda n: -n["b"][1])
        named = lambda ns: low(find(ns, desc="채팅")) + low([n for n in ns if n["desc"] != "채팅" and self.CHAT_NAV_RE.match(n["desc"])])
        below, band = [n for n in k if n["b"][1] >= top], [n for n in k if n["b"][1] < top]
        c = named(below) + low(find(below, text="채팅")) + named(band)   # 머리 띠의 것은 이름(content-desc)이 '채팅' 일 때만, 맨 나중에
        return c[0] if c else None

    def chat_head(self, nodes):
        """목록 칸 머리 제목 '채팅'(화면 맨 위): 채팅 목록이 떠 있다는 표시"""
        top = self.head_band(nodes)
        c = [n for n in find(nodes, text="채팅") if n.get("pkg") == self.t["package"] and n["b"][1] < top]
        return c[0] if c else None

    def chat_tab(self, nodes):
        """채팅 목록이나 그리로 가는 메뉴가 보이는지(누를 것은 chat_nav)"""
        return self.chat_nav(nodes) or self.chat_head(nodes)

    # 화면 방향
    def rot_want(self):
        return ROT_WORDS.get(str(self.t.get("rotation") or "landscape").strip().lower(), "landscape")

    def rot_read(self):
        return rot_info(self.sh(ROT_CMD, timeout=20))

    def lock_rotation(self):
        """자동 회전을 끄고 정한 방향(rotation: 가로나 세로)으로 고정한다. 자동 회전이 꺼져 있는 동안은 앱이 화면을 돌리는 것도 막는다
        (wm fixed-to-user-rotation enabled_if_no_auto_rotation: 사람이 자동 회전을 켜면 다시 돈다. 판 10.3 의 늘 고정은 화면이 세로에 묶였다).
        카카오톡을 띄울 때마다 본다(자동 회전이 저절로 다시 켜져도 봇이 읽는 화면 모양이 바뀌지 않게). 바꾼 뒤 다시 읽어 확인한다.
        고친 것이 있으면 무엇이었는지 한 줄, 그대로면 ''. 같은 쪽 두 회전(0 과 180 처럼)은 지금 것을 그대로 둔다(화면이 뒤집히지 않게)"""
        self.rot_state = ""
        want = self.rot_want()
        if want == "off":
            return ""
        info = self.rot_read()
        good = info["land"] if want == "landscape" else info["port"]
        if not good:
            self.rot_state = "unknown"
            return ""                                            # 이 기기의 회전 값을 읽지 못함: 건드리지 않는다
        cur = info["rot"]
        target = cur if cur in good else info["usr"] if info["usr"] in good else good[0]
        if info["acc"] == "0" and info["usr"] == target and cur in (None, target) and info["shape"] in (None, want) and self.rot_fixed:
            return ""
        what = []
        if info["acc"] not in ("0", None):
            what.append("자동 회전이 켜져 있었음")
        if info["shape"] and info["shape"] != want:
            what.append("%s였음" % ROT_NAME["portrait" if want == "landscape" else "landscape"])
        cmd = "settings put system accelerometer_rotation 0; settings put system user_rotation %d; wm user-rotation lock %d >/dev/null 2>&1; " % (target, target)
        if not self.rot_fixed:                                   # 켤 때 한 번(옛 판이 건 늘 고정도 이것으로 바뀐다)
            cmd += "wm fixed-to-user-rotation enabled_if_no_auto_rotation >/dev/null 2>&1 || wm fixed-to-user-rotation default >/dev/null 2>&1; "
        self.sh(cmd + "true", timeout=20)
        self.rot_fixed = True
        if info["shape"] and info["shape"] != want:
            self.sleep(1.5)                                      # 돌아가는 동안
            after = self.rot_read()
            if after["shape"] and after["shape"] != want:
                self.rot_state = "failed"
                what.append("%s로 바꾸지 못함(지금 %s)" % (ROT_NAME[want], ROT_NAME[after["shape"]]))
        return ", ".join(what)

    def rot_line(self, what):
        """방향을 고친 뒤 남길 한 줄"""
        if self.rot_state == "failed":
            return "화면 방향: " + what
        return "화면 방향: %s. %s로 고정함" % (what, ROT_NAME[self.rot_want()])

    def rot_unlock(self):
        """rotation off: 앱이 화면을 돌리는 것을 막던 것만 처음대로(자동 회전 켜고 끄기는 사람이)"""
        self.sh("wm fixed-to-user-rotation default >/dev/null 2>&1; true", timeout=20)
        self.rot_fixed = False

    def rot_text(self, info=None):
        """지금 화면 방향 한 줄(check, rotate)"""
        info = info or self.rot_read()
        shape = ROT_NAME.get(info["shape"] or "", "모름")
        auto = {"0": "자동 회전 끔", "1": "자동 회전 켜짐"}.get(info["acc"] or "", "자동 회전 모름")
        return "%s(%s%s)" % (shape, auto, ", 앱이 돌리지 못하게 고정" if info["fixed"] else "")

    # 앱 띄우기: monkey 는 끝날 때마다 화면 회전 잠금을 풀고(자동 회전 켜짐) 회전을 0 으로 돌려 놓는다(Monkey.java 의 finally:
    # freezeRotation(0) 뒤 thawRotation). 자동 회전이 저절로 다시 켜지고 화면이 세로로 돌던 원인이라 am start 로 띄운다
    LAUNCH_FLAGS = "0x10200000"                                  # 새 작업 + 작업이 있으면 그대로 앞으로(런처 아이콘을 누른 것처럼)

    def app_component(self, pkg):
        """앱의 첫 화면(런처 화면) 이름 '패키지/화면'. 한 번 읽어 둔다. 못 읽으면 ''"""
        comps = self.comps
        if pkg in comps:
            return comps[pkg]
        comp = ""
        for sub in ("resolve-activity", "query-activities"):     # 고르는 창(ResolverActivity)이 나오면 목록에서 그 앱 것을 고른다
            try:
                out = self.sh("cmd package %s --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER %s 2>/dev/null; true" % (sub, pkg), timeout=20)
            except KakaoError:
                break
            got = [l.strip() for l in out.splitlines() if re.match(r"^%s/[\w.$]+$" % re.escape(pkg), l.strip())]
            if got:
                comp = got[0]
                break
        comps[pkg] = comp
        return comp

    def start_app(self, pkg):
        """앱을 앞으로(am start). 안 되면 monkey 로 띄우고 화면 방향을 다시 고정한다. monkey 를 썼으면 True"""
        comp = self.app_component(pkg)
        out = self.sh("am start %s -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -f %s 2>&1; true"
                      % (("-n " + comp) if comp else ("-p " + pkg), self.LAUNCH_FLAGS), timeout=30)
        if not re.search(r"^\s*Error|Exception|unable to resolve", out, re.M | re.I):
            return False
        self.sh("monkey -p %s -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; true" % pkg)
        try:
            self.lock_rotation()                                 # monkey 가 풀어 놓은 회전 잠금을 다시
        except KakaoError:
            pass
        return True

    def launch(self):
        """화면을 켜고 카카오톡을 앞으로. 뜨는 중이면 조금 더 기다린다(화면이 꺼져 있어도 된다, 잠금만 없으면).
        그 전에 화면 방향을 정한 방향으로 고정한다(자동 회전이 저절로 다시 켜졌어도)"""
        self.key(224)
        try:
            what = self.lock_rotation()
            if what and time.time() - self.rot_note >= 300:
                self.rot_note = time.time()
                self.log(self.rot_line(what))
        except KakaoError:
            pass                                                 # 방향을 못 고쳐도 올리기는 한다
        self.sh("cmd statusbar collapse; true")                  # 남은 알림 창이 있으면 접는다(없으면 아무 일 없음)
        self.start_app(self.t["package"])
        nodes = []
        for wait in (2.0, 1.5, 2.5):
            self.sleep(wait)
            nodes = self.dump()
            if self.on_kakao(nodes) and (self.chat_tab(nodes) or find(nodes, cls="EditText")):
                break
        return nodes

    def room_open(self, nodes, room):
        """이 방이 이미 열려 있는지: 입력 칸이 있고, 방 칸 맨 위 머리에 방 이름이 그대로"""
        e = find(nodes, cls="EditText")
        if not e or not self.on_kakao(nodes):
            return False
        l0 = max(e, key=lambda n: n["b"][3])["b"][0]                 # 방 입력 칸(맨 아래 것. 목록 칸의 찾기 칸은 아님)
        hgt = max(n["b"][3] for n in nodes)
        return any(same_room(n["text"], room) and n["b"][0] >= l0 - 60 and n["b"][1] < hgt * 0.12 for n in nodes)

    def goto_list(self, nodes=None):
        nodes, launched = (nodes, 0) if nodes is not None else ([], 0)
        for _ in range(8):
            if not self.on_kakao(nodes):                         # 카카오톡을 앞으로
                if launched >= 3:
                    break
                nodes = self.launch()
                launched += 1
                continue
            tab = self.chat_nav(nodes)
            if tab:
                self.tap(tab)
                new = self.wait_change(nodes, tries=3)
                self.fact("채팅 메뉴(%s, %s) 누름%s" % ("이름" if tab["desc"] else "글자", "아래" if self.center(tab)[1] > self.head_band(nodes) * 5 else "옆",
                                                     "" if getattr(self, "changed", True) else ", 안 바뀜"))
                return new
            if self.chat_head(nodes):                            # 머리 제목 '채팅' 만: 이미 채팅 목록(누르지도 뒤로 가지도 않는다)
                self.fact("채팅 머리만")
                return nodes
            self.key(4)                                          # 폰은 방 안이면 뒤로 가서 목록으로, 알림 창이면 닫는다
            self.fact("뒤로")
            self.sleep(0.8)
            nodes = self.dump()
        self.save_diag(nodes)
        why = "카카오톡이 앞으로 나오지 않음" if not self.on_kakao(nodes) else "'채팅' 단추를 찾지 못함"
        raise KakaoError("카카오톡 채팅 목록 화면으로 가지 못함(%s)%s" % (why, self.diag_note()))

    @staticmethod
    def list_right(nodes):
        """채팅 목록 칸의 오른쪽 끝. 태블릿은 목록 옆에 방이 열려 있으니 그 입력 칸 왼쪽까지(화면 위쪽 30% 안의 입력 칸, 목록 칸의 찾기 칸은 빼고).
        폰의 방 화면은 입력 칸이 왼쪽 끝에서 시작해 목록이 없는 것으로 본다"""
        h = max([n["b"][3] for n in nodes] or [0])
        e = [n for n in find(nodes, cls="EditText") if n["b"][1] >= h * 0.3]
        return min(n["b"][0] for n in e) if e else 10 ** 9

    def room_item(self, nodes, room):
        """목록에서 이 방의 줄. 이름이 같은 방만(글자가 더 붙은 다른 방으로 보내지 않게, same_room). 화면 글자는 잘려 보여도 이름 전체가 들어온다.
        글자 그대로 같은 칸이 먼저, 그다음 줄이 칸 하나로 합쳐진 판(그 줄의 글이나 이름(content-desc)의 첫 마디). 다른 줄의 미리보기 글(줄 아래쪽)보다
        줄 위쪽의 이름 칸을 먼저 고른다. '방 이름, 2호점' 같은 다른 방의 이름 칸은 첫 마디로 보지 않는다(줄바꿈으로 이은 칸, 쉼표 뒤가 사람 수인 칸은 본다)"""
        right = self.list_right(nodes) + 5
        par = {k: n["i"] for n in nodes for k in n["kids"]}
        row_of = lambda n: self.row_of(nodes, n, par)

        def texts_under(r):
            out, st = set(), [r["i"]]
            while st:
                j = st.pop()
                st.extend(nodes[j]["kids"])
                if nodes[j]["text"].strip():
                    out.add(j)
            return out

        def merged(n):                                           # 줄 안에 글자 칸이 이것 하나뿐(이름, 사람 수, 마지막 글이 한 칸에)
            r = row_of(n)
            return r is not None and texts_under(r) <= {n["i"]}

        def upper(n):                                            # 줄의 위쪽 절반(이름 자리)
            r = row_of(n)
            return r is None or (n["b"][1] + n["b"][3]) <= (r["b"][1] + r["b"][3])

        def hit(n):                                              # 0: 글자가 이름 그대로, 1: 합쳐진 칸이나 이름(desc)만 있는 칸의 첫 마디, None: 아님
            if same_room(n["text"], room):
                return 0
            t = n["text"].strip()
            if t:
                head, rest = t.split("\n", 1)[0], (t.split(", ", 1) + [""])[1]
                if "\n" in t and same_room(head, room):
                    return 1                                     # 줄바꿈으로 이은 칸(이름, 사람 수, 마지막 글, 시각)
                if ", " in t and re.match(r"\d[\d,]*\s*명?\s*(,|$)", rest) and same_room(row_head(t), room):
                    return 1                                     # '방 이름, 94명' 처럼 사람 수가 붙은 칸
                return 1 if merged(n) and same_room(row_head(t), room) else None
            return 1 if same_room(row_head(n["desc"]), room) else None
        c = [(h, n) for n in nodes if n["b"][2] <= right for h in [hit(n)] if h is not None]
        return min(c, key=lambda hn: (hn[0], not upper(hn[1]), hn[1]["b"][1], hn[1]["b"][0]))[1] if c else None

    @staticmethod
    def row_of(nodes, n, par=None):
        """그 칸을 품은 누를 수 있는 줄(그 칸이 누를 수 있으면 그 칸). 없으면 None"""
        par = par if par is not None else {k: x["i"] for x in nodes for k in x["kids"]}
        j = n["i"]
        while j is not None and not nodes[j]["click"]:
            j = par.get(j)
        return nodes[j] if j is not None else None

    def tap_row(self, nodes, n):
        """목록 줄의 이름 칸을 누른다. 이름 칸이 다 가려 있으면 그 줄의 가리지 않은 자리를 누른다"""
        try:
            self.tap(n)
        except Covered:
            r = self.row_of(nodes, n)
            if r is None or r is n:
                raise
            self.tap(r)

    def list_box(self, nodes):
        """채팅 목록 칸: 가장 큰 목록(RecyclerView, ListView), 태블릿 두 칸이면 입력 칸 왼쪽. 없으면 화면(입력 칸 왼쪽까지)"""
        right = self.list_right(nodes) + 5
        hgt = max(n["b"][3] for n in nodes)
        c = [n for n in nodes if re.search(r"RecyclerView|ListView", n["cls"]) and n["b"][2] <= right and n["b"][3] - n["b"][1] >= hgt * 0.3]
        if c:
            return max(c, key=lambda n: (n["b"][2] - n["b"][0]) * (n["b"][3] - n["b"][1]))["b"]
        return (min(n["b"][0] for n in nodes), min(n["b"][1] for n in nodes),
                min(max(n["b"][2] for n in nodes), self.list_right(nodes)), hgt)

    def scroll_list(self, nodes, up=False):
        """목록을 민다. 보통은 아래로(손가락을 위로), up 이면 맨 위 쪽으로(손가락을 아래로)"""
        l, t, r, b = self.list_box(nodes)
        lo, hi = t + (b - t) // 3, t + (b - t) * 3 // 4
        x = self.free_x((l + r) // 2, lo if up else hi, l, r)
        self.sh("input swipe %d %d %d %d 400" % ((x, lo, x, hi) if up else (x, hi, x, lo)))
        self.sleep(0.8)

    def list_sig(self, nodes):
        """목록 칸에 보이는 글자와 자리(밀어도 그대로면 끝에 닿은 것)"""
        l, t, r, b = self.list_box(nodes)
        return [(n["text"], n["b"][1]) for n in nodes if n["text"] and l <= self.center(n)[0] <= r and t <= self.center(n)[1] <= b]

    def row_like(self, nodes):
        """목록 칸 안의 줄처럼 생긴 것(누를 수 있고, 높이가 화면의 4~20%, 폭이 칸의 4분의 1 넘게). 동영상 화면에는 없다"""
        l, t, r, b = self.list_box(nodes)
        hgt = max(n["b"][3] for n in nodes)
        return [n for n in nodes if n["click"] and l <= self.center(n)[0] <= r and t <= self.center(n)[1] <= b
                and hgt * 0.04 <= n["b"][3] - n["b"][1] <= hgt * 0.2 and n["b"][2] - n["b"][0] >= (r - l) * 0.25]

    def not_list(self, nodes):
        """밀어 찾을 목록이 아닌 화면: 줄처럼 생긴 것이 하나도 없고, 목록(RecyclerView, ListView)이 없거나 한 장이 목록을 거의 다 채운다(숏폼 동영상)"""
        if self.row_like(nodes):
            return False
        box = self.list_box(nodes)
        lists = [n for n in nodes if n["b"] == box and re.search(r"RecyclerView|ListView", n["cls"])]
        if not lists:
            return True
        h = max(1, box[3] - box[1])
        return any(nodes[k]["b"][3] - nodes[k]["b"][1] >= h * 0.6 for k in lists[0]["kids"])

    def seek_room(self, nodes, room, seen):
        """지금 목록에서 방 찾기: 맨 위까지 올리며 본 뒤 끝까지 내리며 본다(지난번에 밀어 둔 자리에서 시작해도). (화면, 찾은 줄 또는 None).
        목록이 아닌 화면(숏폼 동영상 같은, not_list)은 밀지 않는다"""
        def kind(ns):                                            # 진단: 민 칸이 목록(RecyclerView, ListView)인지 화면 전체인지
            box = self.list_box(ns)
            return next((("RV" if "RecyclerView" in n["cls"] else "LV") for n in ns if n["b"] == box
                         and re.search(r"RecyclerView|ListView", n["cls"])), "화면")
        moved = []
        for up, most in ((True, 6), (False, 14)):
            if self.not_list(nodes):
                self.fact("목록 아님(줄 0개)")
                break
            sig = self.list_sig(nodes)
            n_sw = n_mv = 0
            for _ in range(most):
                self.scroll_list(nodes, up)
                n_sw += 1
                nodes = self.dump()
                seen.update(self._names(nodes))
                item = self.room_item(nodes, room)
                if item:
                    return nodes, item
                now = self.list_sig(nodes)
                if now == sig:
                    break
                n_mv += 1
                sig = now
            moved.append("%s %d/%d" % ("위" if up else "아래", n_sw, n_mv))
        if moved:
            self.fact("밀기 %s %s" % (kind(nodes), " ".join(moved)))
        return nodes, None

    @staticmethod
    def near_names(room, seen):
        """못 찾았을 때: 목록에 이 방 이름이 보였는데 못 골랐는지, 이름이 비슷한 방(방 이름이 바뀌었는지 보게), 이름이 더 긴 다른 방(시험 방 같은, 고르지 않음).
        아무것도 없으면 본 방 수"""
        import difflib
        if any(same_room(x, room) for x in seen):
            return "목록에 이 방 이름이 보였지만 누를 줄로 고르지 못함"
        want = norm_txt(room)
        longer = [x for x in seen if x and want and want in norm_txt(x)]   # 1:1 대화 이름일 수 있어 수만 적는다
        near = sorted(((difflib.SequenceMatcher(None, want, norm_txt(x)).ratio(), x) for x in seen if x and x not in longer), reverse=True)
        near = [x for r, x in near if r >= 0.6][:2]
        out = []
        if near:
            out.append("목록에 비슷한 이름: %s. 방 이름이 바뀌었으면 python excer_bot.py setup 으로 다시 고르세요" % ", ".join("'%s'" % x for x in near))
        if longer:
            out.append("이름이 더 긴 다른 방 %d개(고르지 않음)" % len(longer))
        return ". ".join(out) if out else "목록에서 본 방 %d개, 방 이름이 똑같은지 확인" % len(seen)

    def wait_change(self, nodes, ok=None, tries=4):
        """누른 뒤 화면이 바뀔 때까지(또는 ok(새 화면) 가 참일 때까지) 기다린다. 바로 읽으면 바뀌기 전 화면을 읽는다"""
        old = [(n["b"], n["text"]) for n in nodes]
        new = nodes
        for _ in range(tries):
            self.sleep(0.8)
            new = self.dump()
            if ok and ok(new):
                self.changed = True
                return new
            if not ok and [(n["b"], n["text"]) for n in new] != old:
                self.sleep(0.6)                                  # 바뀌는 중일 수 있어 한 번 더
                self.changed = True
                return self.dump()
        self.changed = [(n["b"], n["text"]) for n in new] != old   # 진단(지나온 곳): 누른 뒤 화면이 바뀌었는지
        return new

    OPEN_SUB_RE = re.compile(r"^오픈\s*채팅(\s*탭)?\s*(\(?\d[\d,+]*\)?\s*개?)?\s*(,.*)?$", re.S)
    NEVER_WORDS = ("나가기", "삭제", "신고", "차단")

    def open_subs(self, nodes):
        """목록 칸 위쪽(화면 위 30%)의 '오픈채팅' 칸: 글자나 이름이 '오픈채팅', '오픈채팅 300', '오픈채팅, 새 메시지 3개' 같은 것. 누를 수 있는 것부터, 위에서부터"""
        right, hgt, inl = self.list_right(nodes), max([n["b"][3] for n in nodes] or [0]), self.in_lists(nodes)
        c = [n for n in nodes if n.get("pkg") == self.t["package"] and self.center(n)[0] < right and self.center(n)[1] < hgt * 0.3 and n["i"] not in inl
             and any(self.OPEN_SUB_RE.match(ws(x)) for x in (n["text"], n["desc"]) if x)
             and not any(w in n["text"] + " " + n["desc"] for w in self.NEVER_WORDS)]
        return sorted(c, key=lambda n: (not n["click"], n["b"][1]))

    def goto_open_list(self, nodes, room=None):
        """오픈채팅 목록으로. 채팅 목록 위의 '오픈채팅' 칸이 있는 판, 아래 메뉴 '지금'(오픈채팅) 안의 '오픈채팅' 칸인 판.
        '오픈채팅' 칸이 작은 창에 다 가려 있으면 Covered"""
        k = [n for n in nodes if n.get("pkg") == self.t["package"]]
        ok = (lambda ns: self.room_item(ns, room) is not None) if room else None
        sub = self.open_subs(nodes)
        if not sub:
            top, inl = self.head_band(nodes), self.in_lists(nodes)
            k = [n for n in k if n["i"] not in inl]
            nav = [n for n in k if self.NOW_NAV_RE.match(n["desc"])] or sorted((n for n in k if n["text"] in ("지금", "오픈채팅") and n["b"][1] >= top),
                                                                                key=lambda n: -n["b"][1])
            if not nav:
                self.fact("오픈채팅 칸 못 찾음")
                return None
            self.tap(nav[0])
            nodes = self.wait_change(nodes, ok)
            self.fact("지금(%s) 누름%s" % ("이름" if nav[0]["desc"] else "글자", "" if getattr(self, "changed", True) else ", 안 바뀜"))
            self.snap("오픈채팅 메뉴를 누른 뒤", nodes)
            if ok and ok(nodes):
                return nodes
            sub = self.open_subs(nodes)
            if not sub:
                self.fact("오픈채팅 칸 못 찾음")
                return nodes
        try:
            self.tap(sub[0])
        except Covered:
            self.fact("오픈채팅 칸 가림 [%d,%d][%d,%d]" % sub[0]["b"])
            raise
        nodes = self.wait_change(nodes, ok)
        self.fact("오픈채팅 칸 누름%s" % ("" if getattr(self, "changed", True) else ", 안 바뀜"))
        self.snap("'오픈채팅' 을 누른 뒤", nodes)
        return nodes

    def room_names(self):
        nodes = self.goto_list()
        names = self._names(nodes)
        op = self.goto_open_list(nodes)
        if op:
            names += [n for n in self._names(op) if n not in names]
        return names

    def _names(self, nodes):
        right, names = self.list_right(nodes) + 5, []
        stop = min([n["b"][1] for n in nodes if n["text"].startswith("지금 뜨는")] or [10 ** 9])   # 아래 커뮤니티 글은 방이 아님
        for n in nodes:
            if not n["click"] or n["b"][2] > right or n["b"][1] >= stop:
                continue
            texts, stack = [], list(n["kids"])
            while stack:
                k = nodes[stack.pop(0)]
                if k["text"].strip():
                    texts.append(k["text"].strip())
                stack[:0] = k["kids"]
            first = texts[0].split("\n", 1)[0].strip() if texts else ""   # 줄바꿈으로 이은 칸은 첫 줄(방 이름)만
            if len(texts) >= 2 and first and first not in NAV_WORDS and first not in names:
                names.append(first)
            elif not texts:                                      # 칸이 하나로 합쳐진 줄: 그 줄의 글이나 이름(content-desc)의 첫 마디
                full = n["text"].strip() or n["desc"].strip()
                head = row_head(full).strip()
                if head and head != full and head not in NAV_WORDS and head not in names:
                    names.append(head)
        return names

    def new_trace(self):
        """지나온 화면(trace)과 지나온 곳(facts)을 새로 모은다(진단 파일 excer_bot_ui.txt)"""
        self.trace, self.facts = [], []

    def fact(self, s):
        """지나온 곳 한 마디(진단). 정해진 낱말과 수, 자리만 적는다(방 이름과 대화 글은 넣지 않는다)"""
        facts = getattr(self, "facts", None)
        if facts is not None:
            facts.append(s[:60])
            del facts[:-24]

    def facts_note(self):
        """실패 글 끝에 붙이는 지나온 곳(400자까지)"""
        s = ", ".join(getattr(self, "facts", None) or [])
        return " | 지나온 곳: " + (s if len(s) <= 400 else s[:397] + "...") if s else ""

    def with_note(self, msg):
        """실패 글에 진단 파일 안내를 한 번만 붙인다"""
        note = self.diag_note()
        return msg if not note or msg.endswith(note) else msg + note

    def mini_fact(self, nodes):
        """보이스룸 작은 창이 어디에 어떻게(따로 된 창, 카카오톡 화면 안) 떠 있는지 한 마디"""
        for w in getattr(self, "windows", None) or []:
            if "작은 창" in self.win_name(w) and not w["read"]:
                return "작은 창 [%d,%d][%d,%d] 창 목록" % w["b"]
        mb = getattr(self, "mini_box", None)
        return "작은 창 [%d,%d][%d,%d] 화면 안" % mb if mb else ""

    def open_room(self, room):
        """방을 연다(알릴 방은 오픈채팅 주소로, 아니면 채팅 목록에서). 연 방의 화면. 안 되면 KakaoError(지나온 화면은 excer_bot_ui.txt)"""
        self.new_trace()
        try:
            return self._open_room(room)
        except KakaoError as e:
            if isinstance(e, Covered) and " | 지나온 곳: " not in str(e):
                e.args = (self.with_note(str(e) + self.facts_note()),)
            self.save_diag(fail=e)                               # 진단 파일 맨 위에 실패를 적는다(진단을 남기지 않고 나가는 실패도)
            raise

    def _open_room(self, room):
        nodes = self.launch()
        self.brief("카카오톡을 띄운 화면", nodes, room)
        mf = self.mini_fact(nodes)
        if mf:
            self.fact(mf)
        nodes = self.voice_guard(nodes)                          # 보이스룸 화면이 앞에 떠 있으면 최소화만(나가기는 안 누른다, 작은 창은 그대로)
        if self.mem_left:                                        # 멤버 읽기가 서랍을 닫지 못하고 끝났다: 입력 칸 자리를 누르기 전에 닫는다(서랍 아래 띠에 나가기)
            nodes = self.mem_unstick(nodes)
        if self.room_open(nodes, room):                          # 지난번에 연 방이 그대로면 목록을 거치지 않는다
            return nodes
        if self.room_link and same_room(room, self.main_room):  # 알릴 방은 오픈채팅 주소로 바로 연다(카카오톡이 첫 화면으로 돌아가 있어도)
            got = self.open_by_link(room)
            if got is not None:
                return got
            nodes = self.wait_change(self.dump(), lambda ns: self.room_open(ns, room), tries=2)
            if self.room_open(nodes, room):                      # 주소로 연 방이 늦게 떴다(목록으로 가려고 뒤로 가기를 누르면 방이 닫힌다)
                self.fact("주소로 연 방이 늦게 뜸")
                return nodes
        nodes = self.goto_list(nodes)
        self.snap("채팅 목록", nodes)
        seen = set(self._names(nodes))
        item = self.room_item(nodes, room)
        covered = None
        if not item:                                             # 오픈채팅 목록부터(알릴 방은 오픈채팅)
            op = None
            try:
                op = self.goto_open_list(nodes, room)
            except Covered as e:                                 # '오픈채팅' 칸이 작은 창에 가렸다: 채팅 탭에서라도 찾는다
                covered = e
                nodes = self.goto_list(self.dump())
                seen.update(self._names(nodes))
                item = self.room_item(nodes, room)
            if op:
                nodes = op
                seen.update(self._names(nodes))
                item = self.room_item(nodes, room)
                if not item:                                     # 오픈채팅 목록을 훑고, 없으면 채팅 탭으로 돌아가 훑는다
                    nodes, item = self.seek_room(nodes, room, seen)
                if not item:
                    nodes = self.goto_list(nodes)
                    seen.update(self._names(nodes))
                    item = self.room_item(nodes, room)
        if not item:                                             # 그래도 없으면 지금 목록을 맨 위까지 올렸다가 끝까지 내리며
            nodes, item = self.seek_room(nodes, room, seen)
        if not item:
            self.save_diag(nodes)
            if covered is not None:
                raise Covered(self.with_note("%s. 채팅 탭에도 없음%s" % (str(covered), self.facts_note())))
            l, t, r, b = self.list_box(nodes)
            taps = sum(1 for n in nodes if n["click"] and l <= self.center(n)[0] <= r and t <= self.center(n)[1] <= b)
            raise RoomNotFound("채팅 목록에서 '%s' 방을 찾지 못함(%s, 화면 요소 %d개, 누를 수 있는 것 %d개)%s%s" % (
                room, self.near_names(room, seen), len(nodes), taps, self.facts_note(), self.diag_note()))
        self.tap_row(nodes, item)
        nodes = self.wait_change(nodes, lambda ns: self.room_open(ns, room), tries=5)
        if not self.room_open(nodes, room):                      # 연 방의 머리가 이 방이어야 한다(다른 방, 공지 상세보기에 올리지 않게)
            self.save_diag(nodes)
            raise KakaoError(("목록에서 누른 줄로 연 방의 머리가 이 방이 아님(목록이 움직였거나 다른 방). 보내지 않음"
                              if find(nodes, cls="EditText") else "방은 열었는데 입력 칸이 없음") + self.facts_note() + self.diag_note())
        return nodes

    ENTER_WORDS = ("채팅방 들어가기", "채팅방으로 이동", "채팅방 입장", "채팅방 가기", "들어가기", "입장", "입장하기", "채팅하기", "대화하기")

    def open_by_link(self, room):
        """알릴 방을 오픈채팅 주소로 연다. 봇이 이미 들어가 있는 방이라 카카오톡이 그 방을 연다(소개 화면이 뜨면 들어가기 단추).
        https 주소가 안 열리면 카카오톡 주소(kakaoopen://join)로. 방 머리가 그 방이고 입력 칸이 있으면 그 화면, 아니면 None(목록에서 찾는다)"""
        m = re.search(r"open\.kakao\.com/o/([A-Za-z0-9_]+)", self.room_link)
        urls = [(self.room_link, " -p " + self.t["package"])]
        if m:
            urls.append(("kakaoopen://join?l=%s&r=EW" % m.group(1), ""))
        nodes = []
        for url, pkg in urls:
            kind = "kakaoopen" if url.startswith("kakaoopen") else "https"
            out = self.sh("am start -a android.intent.action.VIEW -d '%s'%s 2>&1; true" % (url.replace("'", ""), pkg), timeout=30)
            if re.search(r"^\s*Error|Exception|unable to resolve", out, re.M | re.I):
                self.fact("주소 %s 열리지 않음" % kind)
                continue
            how = ("떠 있던 화면에 넘김" if re.search(r"delivered to currently running", out) else
                   "앞으로만(주소 안 넘김)" if re.search(r"brought to the front", out) else "엶")
            for wait in (2.0, 1.5, 2.5, 2.5):
                self.sleep(wait)
                nodes = self.dump()
                if self.room_open(nodes, room):
                    self.brief("오픈채팅 주소로 연 방", nodes, room)
                    self.fact("주소 %s %s, 방" % (kind, how))
                    return nodes
                btn = self.vpick(nodes, self.ENTER_WORDS) if self.on_kakao(nodes) and not find(nodes, cls="EditText") else None
                if btn:
                    self.tap(btn)
                    self.fact("들어가기 누름")
            self.brief("오픈채팅 주소로 연 화면(그 방이 아님)", nodes, room)
            self.fact("주소 %s %s, 그 방 아님" % (kind, how))
            self.top_fact()
            return None
        self.brief("오픈채팅 주소가 열리지 않은 화면", self.dump(), room)
        self.top_fact()
        return None

    def top_fact(self):
        """주소로 방을 못 열었을 때 앞에 뜬 화면(앱과 화면 종류 이름만) 한 마디"""
        try:
            out = self.sh("dumpsys activity activities 2>/dev/null | grep -m1 -E 'topResumedActivity|mResumedActivity'; true", timeout=20)
        except Exception:
            return
        m = re.search(r"\s([\w.]+)/([\w.$]+)", out or "")
        if m:
            self.fact("앞 화면 %s %s" % ("카카오톡" if m.group(1) == self.t["package"] else m.group(1).split(".")[-1], m.group(2).split(".")[-1]))

    def diag_note(self):
        return ". 지나온 화면을 %s 에 적었습니다" % os.path.basename(self.diag_path) if self.diag_path else ""

    @staticmethod
    def box(nodes):
        e = find(nodes, cls="EditText")
        if not e:
            raise KakaoError("입력 칸이 없음")
        return max(e, key=lambda n: n["b"][3])

    def clear_box(self, n):
        self.tap(n)
        self.key(123)                                            # 끝으로
        left = len(n["text"]) + 5
        while left > 0:
            k = min(left, 300)
            self.sh("input keyevent " + " ".join(["67"] * k))       # 지우기
            left -= k

    def send(self, room, text):
        nodes = self.open_room(room)
        box = self.box(nodes)
        self.tap(box)
        if box["text"].strip():
            self.clear_box(box)
        self.set_clip(text)
        self.key(279)                                            # 붙여넣기
        self.sleep(0.6)
        nodes = self.dump()
        box = self.box(nodes)
        if ws(box["text"]) != ws(text):                         # 붙여넣기 키가 안 먹으면 입력 칸을 길게 눌러 '붙여넣기'
            if box["text"].strip():
                self.clear_box(box)
                nodes = self.dump()
            before = {n["b"] for n in find(nodes, text="붙여넣기")}
            self.hold(self.box(nodes), 800)
            nodes = self.dump()
            p = [n for n in find(nodes, text="붙여넣기") if n["b"] not in before]
            if p:
                self.tap(p[0])
                self.sleep(0.6)
                nodes = self.dump()
            box = self.box(nodes)
        if ws(box["text"]) != ws(text):
            if box["text"].strip():
                self.clear_box(box)
            raise KakaoError("입력 칸에 목록을 넣지 못함(클립보드 붙여넣기 실패). 보내지 않음")
        btn = find(nodes, desc="전송") or find(nodes, text="전송") or find(nodes, rid=":id/send")
        if not btn:
            raise KakaoError("전송 단추를 찾지 못함")
        self.tap(btn[0])
        self.sleep(0.7)
        if self.t.get("freeze", True):
            self.freeze(nodes)                                   # 바쁜 방: 곧바로 대화를 살짝 올려 화면이 더 내려가지 않게
        for i in range(4):                                       # 입력 칸이 비워질 때까지 잠깐씩 더 본다
            self.sleep(0.5)
            if ws(self.box(self.dump())["text"]) != ws(text):
                return
        raise KakaoError("전송을 눌렀는데 입력 칸에 글이 남아 있음")

    def already_sent(self, room, text):
        """이 글이 방 화면(아래쪽)에 이미 올라가 있는지. 보내기 실패 뒤 다시 보내기 전에 본다"""
        nodes = self.open_room(room)
        return self.own_bubble(nodes, text, exact=True) is not None   # 접힌 옛 공지는 앞부분이 같아도 증거가 아니다(글 전체가 같아야)

    def chat_area(self, nodes):
        """대화가 흐르는 칸: 입력 칸과 같은 가로 범위, 방 이름 머리 아래부터 입력 칸 위까지"""
        e = find(nodes, cls="EditText")
        if not e:                                                # 방 화면이 아니다(다른 창이 잠깐 앞에 있거나 확인 창)
            raise KakaoError("방 화면이 아님(입력 칸이 없음)")
        box = max(e, key=lambda n: n["b"][3])
        l0, r0 = min(n["b"][0] for n in e), max(n["b"][2] for n in e)
        hgt = max(n["b"][3] for n in nodes)
        top = int(hgt * 0.16)
        return l0, top, r0, box["b"][1] - 10

    def freeze(self, nodes, amount=0.07):
        """대화를 아주 조금 위로(손가락은 아래로) 올린다. 맨 아래가 아니면 카카오톡은 새 글이 와도 화면을 내리지 않는다.
        많이 올리면 방금 보낸 글이 아래로 밀려 안 보이니 조금만"""
        l, t, r, b = self.chat_area(nodes)
        h = b - t
        y1 = t + int(h * 0.35)
        x = self.free_x((l + r) // 2, y1, l, r)
        self.sh("input swipe %d %d %d %d 250" % (x, y1, x, y1 + int(h * amount)))
        self.sleep(0.5)

    def bubble(self, nodes, text, exact=False):
        """방금 보낸 목록 말풍선: 방(입력 칸과 같은 가로 범위) 안에서 글 전체가 같은 것 중 가장 아래.
        채팅 목록의 미리보기와 위쪽 머리, 공지 띠는 빠진다. 긴 글이 접혀 보이면(전체보기) 앞부분이 같은 것.
        이모지 변형 선택자 같은 보이지 않는 글자는 빼고 견준다"""
        e = find(nodes, cls="EditText")
        l0, r0 = (min(n["b"][0] for n in e), max(n["b"][2] for n in e)) if e else (-1, 10 ** 9)
        hgt = max([n["b"][3] for n in nodes] or [0])
        want = norm_txt(text)
        inside = [n for n in nodes if l0 - 10 <= self.center(n)[0] <= r0 + 10 and n["text"] and not n["cls"].endswith("EditText")
                  and n["b"][3] > hgt * 0.12]
        c = [n for n in inside if norm_txt(n["text"]) == want]
        if not c and not exact:
            c = [n for n in inside if cut_of(norm_txt(n["text"]), want)]
        if not c:
            raise NotFound("보낸 목록 말풍선을 화면에서 찾지 못함")
        return max(c, key=lambda n: n["b"][3])

    # 확인 단추 이름(앞에 있을수록 먼저). 이미 공지가 있으면 '공지 등록' 창(채팅방 상단 공지는 1건만...)이 떠서 '예' 를 눌러야 걸린다.
    # 창 제목 '공지 등록' 은 단추가 아니라 넣지 않는다. '아니요', '취소' 는 누르지 않는다
    CONFIRM = ("예", "네", "확인", "등록", "등록하기", "완료", "올리기", "공지 올리기", "공지로 등록")

    @staticmethod
    def labeled(nodes, words, before=()):
        """글자나 이름(content-desc)이 words 중 하나인 새 요소(before 에 없던 자리). 누를 수 있는 것을 먼저"""
        seen = {n["b"] for n in before}
        out = []
        for w in words:
            out += [n for n in nodes if (n["text"].strip() == w or n["desc"].strip() == w) and n["b"] not in seen and n not in out]
        return [n for n in out if n["click"]] + [n for n in out if not n["click"]]

    def pinned(self, nodes, text, skip=()):
        """방 위쪽 공지 띠에 이 글(첫 줄)이 보이는지. 말풍선이 아니라 방 칸의 맨 위 쪽에 있는 것(skip: 원래 있던 말풍선 자리)"""
        e = find(nodes, cls="EditText")
        if not e:
            return False
        l0, r0 = min(n["b"][0] for n in e), max(n["b"][2] for n in e)
        pane = [n for n in nodes if l0 - 10 <= self.center(n)[0] <= r0 + 10]
        top, bottom = min(n["b"][1] for n in pane), max(n["b"][3] for n in e)
        first = text.split("\n")[0]
        for n in pane:
            t = norm_txt(n["text"]).rstrip(".\u2026 ")
            if (n["b"][1] > top + (bottom - top) * 0.22 or n["b"][3] - n["b"][1] > (bottom - top) * 0.12
                    or len(t) < 6 or n["cls"].endswith("EditText") or n["b"] in skip):
                continue
            if same_head(n["text"], first):
                return True
        return False

    @staticmethod
    def card_text_of(nodes):
        """'공지가 등록되었습니다' 카드 머리와 그 바로 밑(카드 안) 글의 짝. 카드 다음 말풍선은 더 떨어져 있어 들지 않는다"""
        hgt = max([n["b"][3] for n in nodes] or [1])
        gap = hgt * 0.06
        heads = [h for h in nodes if ws(h["text"]).startswith("공지가 등록")]
        return [(h, t) for h in heads for t in nodes if t is not h and t["text"] and h["b"][3] - 5 <= t["b"][1] <= h["b"][3] + gap
                and t["b"][0] < h["b"][2] and t["b"][2] > h["b"][0]]

    def cards(self, nodes, text):
        """'공지가 등록되었습니다' 카드 중 카드 안 글이 이 글(첫 줄)인 것(첫 줄이 다 보이는 것만: 잘린 옛 카드를 새 카드로 보지 않게)"""
        first = text.split("\n")[0]
        out = []
        for h, t in self.card_text_of(nodes):
            if same_head(t["text"], first, cut=False) and h not in out:
                out.append(h)
        return out

    def registered(self, nodes, before, text):
        """새 '공지가 등록되었습니다' 카드: 전보다 많거나, 가장 아래 카드가 전보다 아래(새 글이 맨 아래에 붙는다)"""
        a, b = self.cards(nodes, text), self.cards(before, text)
        if not a:
            return False
        if len(a) > len(b) or not b:
            return True
        return max(n["b"][1] for n in a) > max(n["b"][1] for n in b) + 10

    def to_bottom(self, nodes):
        """대화 맨 아래로(멈춘 화면을 풀어 방금 붙은 '공지가 등록되었습니다' 카드를 본다)"""
        l, t, r, b = self.chat_area(nodes)
        h = b - t
        x = self.free_x((l + r) // 2, t + int(h * 0.8), l, r)
        for _ in range(3):
            self.sh("input swipe %d %d %d %d 150" % (x, t + int(h * 0.8), x, t + int(h * 0.15)))
            self.sleep(0.3)
        self.sleep(0.6)

    def registered_below(self, nodes, text):
        """맨 아래 화면에서: 이 글(첫 줄)의 '공지가 등록되었습니다' 카드가 봇 글보다 아래(뒤에 생긴 것)에 있는지"""
        cs = self.cards(nodes, text)
        if not cs:
            return False
        own = self.own_bubble(nodes, text)
        low = max(cs, key=lambda n: n["b"][1])
        return own is None or low["b"][1] > own["b"][1]

    def own_bubble(self, nodes, text, exact=False):
        """봇이 보낸 글: 글 전체가 같은 말풍선 중 가장 아래('공지가 등록되었습니다' 카드 안 글은 뺀다). 없으면 None.
        exact: 접혀 보이는 글(앞부분만 같음)은 치지 않는다"""
        inside = {id(t) for _, t in self.card_text_of(nodes)}
        try:
            n = self.bubble([x for x in nodes if id(x) not in inside], text, exact)
        except KakaoError:
            return None
        return n

    def find_own(self, nodes, text, tries=6):
        """멈춘 화면에서 봇 글을 찾는다. 이미 위로 밀려 안 보이면 대화를 조금씩 위로 올려 가며(자리가 아니라 글자로)"""
        target = self.own_bubble(nodes, text)
        for _ in range(tries):
            if target:
                break
            if not find(nodes, cls="EditText"):                  # 방 화면이 아니면(다른 창이 잠깐 앞에) 밀지 않고 다시 읽는다
                self.sleep(0.8)
                nodes = self.dump()
                target = self.own_bubble(nodes, text)
                continue
            self.freeze(nodes, 0.35)                             # 이미 위로 밀려 올라갔으면 조금씩 위로
            nodes = self.dump()
            target = self.own_bubble(nodes, text)
        return nodes, target

    def banner_text(self, nodes, room=""):
        """방 위쪽 공지 띠의 글(방 이름 머리 바로 아래 한 줄). 없으면 ''. 보이스룸 띠(제목, 'N명 참여')와 방 이름은 공지 띠로 보지 않는다"""
        e = find(nodes, cls="EditText")
        if not e:
            return ""
        l0, r0 = min(n["b"][0] for n in e), max(n["b"][2] for n in e)
        hgt = max(n["b"][3] for n in nodes)
        c = [n for n in nodes if n["text"].strip() and l0 - 60 <= n["b"][0] and n["b"][2] <= r0 + 200
             and hgt * 0.045 < n["b"][1] < hgt * 0.085 and n["b"][3] - n["b"][1] < hgt * 0.06 and not n["cls"].endswith("EditText")
             and not self.voice_mark(n, self.vcfg) and not (room and same_room(n["text"], room))]
        return ws(max(c, key=lambda n: n["b"][2] - n["b"][0])["text"]) if c else ""   # 띠 안에서 가장 넓은 글(앞의 '공지' 표시 글자는 빼고)

    PIN_WORDS = ("핀 고정", "핀 해제", "고정 해제", "핀 고정 해제")   # 공지 띠 오른쪽의 단추(2026-10 카카오톡: 확성기, 공지 글, '핀 고정', X)

    def band_find(self, nodes, room=""):
        """방 위쪽 공지 띠: (글, 누를 글 칸, 단추로 찾았는지). 띠의 '핀 고정'(또는 '핀 해제') 단추(방 칸 위쪽 3할 안, 대화 목록 밖의 단추)가 보이면
        그 단추를 품은 띠 묶음 안의 글(묶음을 모르면 단추 왼쪽 같은 줄의 글, 대화 칸 목록 안의 말풍선과 보이스룸 띠와 방 이름은 빼고)에서
        넓은 글을 위에서부터 이어 붙인다(짧은 표시 글자는 뺀다). 누를 칸은 단추 왼쪽의 넓은 글 칸(단추 크기의 칸은 아님).
        단추가 없으면 자리로 찾은 글(banner_text)이고 누를 칸은 없다. 띠가 없으면 ('', None, False)"""
        e = find(nodes, cls="EditText")
        if not e:
            return "", None, False
        el, er = min(n["b"][0] for n in e), max(n["b"][2] for n in e)
        hgt = max(n["b"][3] for n in nodes)
        inlist = self.in_lists(nodes)
        word = lambda n: n["text"].strip() in self.PIN_WORDS or n["desc"].strip() in self.PIN_WORDS
        pins = [n for n in nodes if word(n) and el - 60 <= self.center(n)[0] <= er + 200 and n["i"] not in inlist and n["b"][1] < hgt * 0.3
                and (n["click"] or re.search(r"Button", n["cls"]))]
        if not pins:
            return self.banner_text(nodes, room), None, False
        p = min(pins, key=lambda n: n["b"][1])
        par = {k: n["i"] for n in nodes for k in n["kids"]}
        box, cur = None, p
        while cur["i"] in par:                               # 단추를 품은 가장 작은 넓은 묶음(방 칸 폭의 반 넘게, 화면 높이의 3할 안)이 띠
            cur = nodes[par[cur["i"]]]
            if cur["b"][3] - cur["b"][1] > hgt * 0.3:
                break
            if cur["b"][2] - cur["b"][0] >= (er - el) * 0.5:
                box = cur
                break
        base = lambda n: n["text"].strip() and not word(n) and not n["cls"].endswith("EditText")
        if box is not None:                                  # 띠 묶음 안의 글은 다 띠 글이다(공지 글에 보이스룸 낱말이 있어도)
            under, stack = [], list(box["kids"])
            while stack:
                j = stack.pop()
                under.append(nodes[j])
                stack.extend(nodes[j]["kids"])
            c = [n for n in under if base(n)]
        else:
            h = max(1, p["b"][3] - p["b"][1])
            c = [n for n in nodes if base(n) and n["i"] not in inlist and not self.voice_mark(n, self.vcfg) and not (room and same_room(n["text"], room))
                 and n["b"][0] >= el - 60 and n["b"][2] <= p["b"][0] + 10 and p["b"][1] - h * 2 <= (n["b"][1] + n["b"][3]) / 2 <= p["b"][3] + h * 2]
        if not c:
            return "", None, True
        widest = max(c, key=lambda n: n["b"][2] - n["b"][0])
        c = sorted((n for n in c if n["b"][2] - n["b"][0] >= (widest["b"][2] - widest["b"][0]) * 0.4), key=lambda n: (n["b"][1], n["b"][0]))
        pw = p["b"][2] - p["b"][0]
        bw = (box["b"][2] - box["b"][0]) if box is not None else (er - el)
        tap = widest if (widest["b"][2] <= p["b"][0] + 10 and widest["b"][2] - widest["b"][0] >= max(pw * 1.5, bw * 0.25)
                         and notice_core(widest["text"])) else None
        return "\n".join(n["text"].strip() for n in c), tap, True

    def band_text(self, nodes, room=""):
        """방 위쪽 공지 띠의 글(band_find). 없으면 ''"""
        return self.band_find(nodes, room)[0]

    DETAIL_SKIP = ("상세보기", "글목록", "등록", "댓글을 남겨보세요.", "댓글을 남겨보세요")

    def detail_title(self, nodes):
        """공지 띠를 누르면 뜨는 공지 전체 화면의 제목 '상세보기'(화면 위쪽 머리, 대화 목록 밖). '글목록' 이나 댓글 칸이 함께 있어야. 없으면 None"""
        hgt = max([n["b"][3] for n in nodes] or [0])
        inlist = self.in_lists(nodes)
        t = [n for n in nodes if n["text"].strip() == "상세보기" and n["b"][3] < hgt * 0.12 and n["i"] not in inlist]
        if not t or not (find(nodes, text="글목록") or self.comment_box(nodes)):
            return None
        return min(t, key=lambda n: n["b"][1])

    @staticmethod
    def comment_box(nodes):
        """상세보기의 댓글 칸(입력 칸 글이나 이름에 '댓글')"""
        c = [n for n in find(nodes, cls="EditText") if "댓글" in n["text"] + " " + n["desc"]]
        return max(c, key=lambda n: n["b"][3]) if c else None

    def is_detail(self, nodes):
        """공지 전체 화면(상세보기)인지"""
        return self.detail_title(nodes) is not None

    def detail_text(self, nodes):
        """상세보기 화면의 글: 제목 아래부터 댓글 칸 위까지, 상세보기 칸(댓글 칸과 같은 가로 범위, 태블릿 왼쪽 채팅 목록은 빼고)의 글(글이 없으면 이름)을
        위에서부터 이어 붙인다(글쓴이와 때 줄, 댓글이 섞여도 견주기에는 괜찮다). 상세보기가 아니면 ''"""
        title = self.detail_title(nodes)
        if title is None:
            return ""
        cb = self.comment_box(nodes) or (max(find(nodes, cls="EditText"), key=lambda n: n["b"][3]) if find(nodes, cls="EditText") else None)
        bottom = cb["b"][1] if cb else max(n["b"][3] for n in nodes)
        left = (cb["b"][0] - 60) if cb else (title["b"][0] - 250)
        lab = lambda n: n["text"].strip() or n["desc"].strip()
        c = [n for n in nodes if lab(n) and lab(n) not in self.DETAIL_SKIP and not n["cls"].endswith("EditText") and n is not title
             and n["b"][1] >= title["b"][3] - 5 and n["b"][3] <= bottom + 5 and self.center(n)[0] >= left]
        return "\n".join(lab(n) for n in sorted(c, key=lambda n: (n["b"][1], n["b"][0])))

    def back_to_room(self, nodes, room):
        """상세보기(또는 띠를 눌러 열린 다른 화면)에서 방으로: 방이 보일 때까지 뒤로(세 번까지, 방이 보이면 누르지 않는다). 못 돌아오면 KakaoError"""
        for _ in range(3):
            if self.room_open(nodes, room):
                return nodes
            self.key(4)
            nodes = self.wait_change(nodes, lambda ns: self.room_open(ns, room), tries=2)
        if self.room_open(nodes, room):
            return nodes
        self.brief("공지를 본 뒤 방으로 못 돌아옴", nodes, room)
        raise KakaoError("공지 상세보기에서 방으로 돌아오지 못함")

    def pinned_notice(self, room, want=""):
        """알릴 방 위쪽에 걸린 공지: (글, 확실히 읽었는지). 띠에 이 글(want)의 앞부분만 보여 띠로는 판가름이 안 나면, '핀 고정' 단추로 찾은
        띠의 글을 한 번 눌러 공지 전체(상세보기)를 읽고 방으로 돌아온다(상세보기 글이 띠 글을 담을 때까지 기다리고, 끝내 안 담으면 띠 글만).
        띠가 다른 글이면 누르지 않는다. 띠가 없으면 ''. 방까지 못 가거나 방으로 못 돌아오면 KakaoError"""
        nodes = self.open_room(room)
        text, tap, anchored = self.band_find(nodes, room)
        self.brief("공지 띠 %s" % ("%d자" % len(text) if text else "없음"), nodes, room)
        if not text or not want or not anchored or tap is None or band_shows(text, want):
            return text, anchored
        if band_verdict(text, want, sure=True) != "?":
            return text, True                                # 띠가 다른 글을 보인다(눌러 볼 것 없음)
        head = notice_core(text)
        has = lambda ns: self.is_detail(ns) and head in notice_core(self.detail_text(ns))
        self.tap(tap)
        got = self.wait_change(nodes, has, tries=4)
        full = ""
        if has(got):
            self.sleep(0.6)                                  # 다 떴는지 한 번 더 읽는다(늦게 뜨는 글)
            again = self.dump()
            got = again if has(again) else got
            full = self.detail_text(got)
            self.brief("공지 상세보기 %d자" % len(full), got, room)
        elif self.room_open(got, room):
            return (self.band_text(got, room) or text), True    # 눌러도 그대로(상세보기가 안 뜸)
        else:
            self.brief("공지 띠를 누른 뒤 %s" % ("상세보기(글 없음)" if self.is_detail(got) else "다른 화면"), got, room)
        self.back_to_room(got, room)
        return (full or text), True

    def to_latest(self, nodes, tries=8):
        """대화 맨 아래까지: 더 내려가지 않을 때까지 민다(지난번에 멈춰 둔 화면이 한참 위에 있어도)"""
        sig = None
        for _ in range(tries):
            self.to_bottom(nodes)
            nodes = self.dump()
            if not find(nodes, cls="EditText"):                  # 입력 칸이 잠깐 안 보이면(바뀌는 중) 한 번 더 읽는다
                self.sleep(1.0)
                nodes = self.dump()
                if not find(nodes, cls="EditText"):
                    self.brief("내린 뒤 방 화면이 아님", nodes)
            l, t, r, b = self.chat_area(nodes)
            cur = [(n["text"], n["b"]) for n in nodes if n["text"] and t <= n["b"][1] <= b and l <= self.center(n)[0] <= r]
            if cur == sig:
                break
            sig = cur
        return nodes

    def pin_again(self, room, text):
        """공지 걸기만 실패했던 글: 방을 열고 맨 아래로 간 뒤, 이미 올린 글을 위로 올려 가며 찾아 공지로 건다(글을 다시 올리지 않는다).
        맨 아래에 붙은 화면은 새 글이 오면 따라 내려가 엉뚱한 말풍선을 누를 수 있어, 보낸 뒤처럼 살짝 올려 멈춘 다음 찾는다"""
        try:
            try:
                nodes = self.to_latest(self.open_room(room))
            except RoomUnreachable:
                raise
            except KakaoError:                                   # 내린 뒤 방 화면이 아니면(다른 창이 앞에) 방을 한 번 다시 연다
                nodes = self.to_latest(self.open_room(room))
            if self.t.get("freeze", True):
                self.freeze(nodes)
        except RoomUnreachable:
            raise
        except KakaoError as e:
            self.save_diag(fail=e)
            raise RoomUnreachable(self.with_note(str(e))) from e   # 가림이면 길게 쉰다(send_wait)
        self.notice(room, text)

    def notice(self, room, text):
        self.key(224)
        self.sleep(1.0)
        nodes = self.dump()
        if not find(nodes, cls="EditText") or self.is_detail(nodes):   # 방 화면이 아니면(다른 창이나 공지 상세보기가 앞에) 방을 다시 연다
            nodes = self.open_room(room)
            if self.t.get("freeze", True):                       # 다시 연 방은 맨 아래에 붙어 있다: 살짝 올려 멈춘다
                self.freeze(nodes)
                nodes = self.dump()
        self.new_trace()                                         # 공지 단계만 남긴다(안 될 때 보낼 파일이 짧게)
        e = find(nodes, cls="EditText")
        l0 = min([n["b"][0] for n in e] or [0])
        hgt = max([n["b"][3] for n in nodes] or [0])
        self.snap("방 위쪽(공지 띠 자리)", [n for n in nodes if n["b"][1] < hgt * 0.3 and self.center(n)[0] >= l0 - 10])
        nodes, target = self.find_own(nodes, text)
        if not target:
            self.save_diag(nodes)
            if not find(nodes, cls="EditText"):
                raise KakaoError("방 화면이 아니라 보낸 글을 찾지 못함%s" % self.diag_note())
            raise NotFound("보낸 글을 화면에서 찾지 못함(위로 올려 가며 찾았는데 없음)%s" % self.diag_note())
        for _ in range(3):                                       # 그래도 밀리는 중이면(화면이 덜 멈춤) 멈출 때까지
            again = self.dump()
            t2 = self.own_bubble(again, text)
            if t2 and t2["b"] == target["b"]:
                break
            if not t2:
                again, t2 = self.find_own(again, text)
                if not t2:                                       # 방금 보였던 글이다: 다시 올릴 일은 아니다(NotFound 가 아님)
                    raise KakaoError("보낸 글이 화면에서 밀려 사라짐")
            nodes, target = again, t2
            self.sleep(0.6)
        pre = self.pinned(nodes, text, {target["b"]})            # 첫 줄이 같은 공지가 이미 걸려 있으면 띠로는 바뀐 것을 알 수 없다
        first = text.split("\n")[0]
        skip = {n["b"] for n in nodes if same_head(n["text"], first)}   # 원래 있던 같은 글(말풍선)은 공지 띠로 치지 않는다
        before = self.band_text(nodes, room)                     # 걸기 전 공지 띠 글
        self.hold(target, 1000, "길게 누를 글")
        menu = self.wait_change(nodes, lambda ns: bool(self.labeled(ns, ("공지", "공지 등록", "공지로 등록"), nodes)), tries=3)
        self.snap("말풍선을 길게 누른 뒤(새로 나온 것)", menu, nodes)
        m = self.labeled(menu, ("공지", "공지 등록", "공지로 등록"), nodes)
        if not m:
            self.key(4)
            self.save_diag()
            raise KakaoError("메뉴에 '공지'가 없음(봇 계정이 이 방의 방장이나 부방장인지 확인)%s" % self.diag_note())
        self.tap(m[0])
        bt = lambda ns: self.band_text(ns, room)
        wrong = lambda ns: bool(bt(ns)) and not same_head(bt(ns), first)   # 알맹이(글자와 숫자)로 견준다
        # 된 것: '공지가 등록되었습니다' 카드, 첫 줄이 같은 공지가 없던 띠에 이 글, 또는 띠가 바뀌어 이 글을 보인다(걸기 전 띠 글과 견줘 판가름)
        ok = lambda ns: not wrong(ns) and (self.registered(ns, nodes, text) or (not pre and self.pinned(ns, text, skip))
                                           or (notice_core(bt(ns)) != notice_core(before) and band_shows(bt(ns), text, [before] if before else [])))
        dlg = self.wait_change(menu, lambda ns: ok(ns) or bool(self.labeled(ns, self.CONFIRM, menu) and any(
            re.search(r"공지.*(하시겠|할까요|1건만)|(하시겠|할까요).*공지", ws(n["text"])) for n in ns)), tries=4)
        self.snap("'공지' 를 누른 뒤(새로 나온 것)", dlg, menu)
        if ok(dlg):                                              # 누르자마자 걸렸다(확인 창 없음). 확인을 또 누르지 않는다
            return
        # 확인 단추는 '공지를 등록하시겠습니까?' 같은 묻는 창이 떴을 때만 누른다(다른 알림 창의 '확인' 을 잘못 누르지 않게)
        asks = [n for n in dlg if n not in menu and re.search(r"공지.*(하시겠|할까요|1건만)|(하시겠|할까요).*공지", ws(n["text"]))]
        c = self.labeled(dlg, self.CONFIRM, menu) if asks else []
        if c:
            self.tap(c[0])
        done = dlg
        for _ in range(5):                                       # '공지가 등록되었습니다' 카드나 위쪽 공지 띠에 이 글이 보이면 된 것
            self.sleep(0.8)
            done = self.dump()
            if ok(done):
                return
        if not wrong(done):                                      # 멈춘 화면이라 카드가 아래에 붙어 안 보일 수 있다: 맨 아래로 가서 본다
            if not find(done, cls="EditText"):                   # 확인 창이 막 닫히는 중이면 방 화면을 다시 읽는다
                self.sleep(0.8)
                done = self.dump()
            if find(done, cls="EditText"):
                self.to_bottom(done)
                bottom = self.dump()
                if not wrong(bottom) and self.registered_below(bottom, text):
                    return
                done = bottom
        if wrong(done) and bt(done) != before:
            self.snap("마지막 화면(새로 나온 것)", done, nodes)
            self.save_diag()
            raise KakaoError("공지 띠가 다른 글로 바뀜(봇 글이 아닌 글이 걸렸을 수 있음, 띠 글 '%s'). 다시 겁니다%s" % (ws(bt(done))[:40], self.diag_note()))
        if pre and c:                                            # 같은 첫 줄 공지가 이미 있어 첫 줄로는 알 수 없고, 확인은 눌렀다
            dt = bt(done)
            if (before and len(strict_core(before)) > len(strict_core(first)) + 4 and strict_core(dt) == strict_core(before)
                    and not band_shows(dt, text)):              # 띠가 걸기 전 글 전체를 그대로 보인다: 걸리지 않았다
                self.snap("마지막 화면(새로 나온 것)", done, nodes)
                self.save_diag()
                raise KakaoError("공지 확인을 눌렀는데 위쪽 공지 띠가 걸기 전 글 그대로임. 다시 겁니다%s" % self.diag_note())
            return
        self.snap("마지막 화면(새로 나온 것)", done, nodes)
        self.save_diag()
        raise KakaoError("공지를 눌렀는데 공지가 걸린 표시('공지가 등록되었습니다' 나 위쪽 공지 띠)를 찾지 못함%s" % self.diag_note())

    # ── 화면 조사: 카카오톡 실제 화면을 단계마다 적는다(시험 방에서만, 글을 올리거나 공지를 거는 단추는 누르지 않는다) ──
    def study_rows(self, nodes, before=None, private=False, keep=()):
        if before is not None:
            seen = {(n["b"], n["text"], n["desc"]) for n in before}
            nodes = [n for n in nodes if (n["b"], n["text"], n["desc"]) not in seen]
        rows = []
        for n in nodes:
            if not (n["text"] or n["desc"] or n["click"] or n["cls"].endswith("EditText")):
                continue
            t = ws(n["text"])
            if t and t not in keep and not t.startswith(("[다음 벙]", EMO["next"], "공지", "채팅방 상단")) and (len(t) > (6 if private else 20)):
                t = "(글 %d자)" % len(t)                         # 대화 내용은 적지 않는다(단추 이름, 짧은 글만)
            rows.append("%s|%s|%s|%s|%s|[%d,%d][%d,%d]" % (n["cls"].split(".")[-1], t[:60], ws(n["desc"])[:40], n["rid"].split("/")[-1],
                                                         "누름" if n["click"] else "", *n["b"]))
        return rows[:70]

    def paste_into(self, field, text):
        """입력 칸에 글 넣기(클립보드 붙여넣기 키, 안 되면 길게 눌러 '붙여넣기'). 넣은 뒤 화면을 돌려준다"""
        self.tap(field)
        self.set_clip(text)
        self.key(279)
        self.sleep(0.6)
        ns = self.dump()
        if not any(ws(n["text"]) == ws(text) for n in find(ns, cls="EditText")):
            before = {n["b"] for n in find(ns, text="붙여넣기")}
            e = find(ns, cls="EditText")
            if e:
                self.hold(max(e, key=lambda n: (n["b"][2] - n["b"][0]) * (n["b"][3] - n["b"][1])), 800)
                ns = self.dump()
                p = [n for n in find(ns, text="붙여넣기") if n["b"] not in before]
                if p:
                    self.tap(p[0])
                    self.sleep(0.6)
                    ns = self.dump()
        return ns

    def study(self, room, trial=True):
        """trial: 시험 방에 톡게시판으로 시험 공지를 한 번 실제로 써 본다(채팅 말풍선을 거치지 않는 공지 방법을 알아보려고)"""
        out, keep = [], (room,)
        def take(label, nodes, before=None, private=False):
            rows = self.study_rows(nodes, before, private, keep)
            out.extend(["== %s (%d)" % (label, len(rows))] + rows + [""])
        def back_to_room():
            for _ in range(6):
                ns = self.dump()
                if self.room_open(ns, room):
                    return ns
                if not self.on_kakao(ns):
                    return self.open_room(room)
                self.key(4)
                self.sleep(0.8)
            return self.open_room(room)
        nodes = self.launch()
        take("1 카카오톡을 띄운 화면", nodes, private=True)
        tab = self.chat_nav(nodes)
        if tab:
            self.tap(tab)
            nodes = self.wait_change(nodes, tries=3)
            take("2 아래 메뉴 '채팅' 을 누른 뒤", nodes, private=True)
        op = self.goto_open_list(nodes, room)
        if op:
            take("3 오픈채팅 목록", op, private=True)
        nodes = self.open_room(room)
        take("4 시험 방(%s)" % room, nodes)
        hgt = max(n["b"][3] for n in nodes)
        e = find(nodes, cls="EditText")
        l0 = min(n["b"][0] for n in e)
        topbar = [n for n in nodes if n["click"] and n["b"][1] < hgt * 0.08 and n["b"][0] >= l0 - 60]
        if topbar:                                               # 방 오른쪽 위 메뉴(서랍): 톡게시판, 공지 자리
            btn = max(topbar, key=lambda n: n["b"][2])
            self.tap(btn)
            drawer = self.wait_change(nodes, tries=3)
            take("5 방 오른쪽 위 메뉴를 누른 뒤(새로 나온 것)", drawer, nodes)
            board = [n for n in drawer if "게시판" in n["text"] or "게시판" in n["desc"]]
            if board:
                self.tap(board[0])
                bd = self.wait_change(drawer, tries=3)
                take("6 톡게시판", bd, private=True)
                write = [n for n in bd if n["click"] and (ws(n["text"]) in ("글쓰기", "글 쓰기", "작성", "+") or ws(n["desc"]) in ("글쓰기", "글 쓰기", "작성", "새 글"))]
                if write:
                    self.tap(write[0])
                    wr = self.wait_change(bd, tries=3)
                    take("7 글쓰기를 누른 뒤", wr, private=True)
                    pick = [n for n in wr if ws(n["text"]) == "공지" or ws(n["desc"]) == "공지"]
                    done_trial = False
                    if pick:
                        self.tap(pick[0])
                        nw = self.wait_change(wr, tries=3)
                        take("8 공지 쓰기 화면", nw, private=True)
                        fields = find(nw, cls="EditText")
                        if trial and fields:                     # 시험 방에만: 시험 공지를 넣고 올려 본다
                            ttext = EMO["next"] + " 다음 벙 톡게시판 공지 시험 " + time.strftime("%H:%M")
                            keep = keep + (ttext,)
                            field = max(fields, key=lambda n: (n["b"][2] - n["b"][0]) * (n["b"][3] - n["b"][1]))
                            filled = self.paste_into(field, ttext)
                            take("8-1 시험 공지 글을 넣은 뒤", filled, nw, private=True)
                            ok_btn = self.labeled(filled, ("완료", "등록", "올리기", "게시", "확인"))
                            if ok_btn:
                                self.tap(ok_btn[0])
                                after = self.wait_change(filled, tries=4)
                                take("8-2 '%s' 를 누른 뒤(새로 나온 것)" % (ok_btn[0]["text"] or ok_btn[0]["desc"]), after, filled, private=True)
                                yes = self.labeled(after, ("예", "네", "확인"), filled)
                                if yes:
                                    self.tap(yes[0])
                                    after2 = self.wait_change(after, tries=4)
                                    take("8-3 '%s' 를 누른 뒤" % (yes[0]["text"] or yes[0]["desc"]), after2, private=True)
                                done_trial = True
                    if not done_trial:
                        self.key(4)
                        self.sleep(0.8)
                        take("9 공지 쓰기에서 뒤로(새로 나온 창)", self.dump(), wr, private=True)
            nodes = back_to_room()
            take("10 방으로 돌아와서", nodes)
        inside = {id(t) for _, t in self.card_text_of(nodes)}
        bubbles = [n for n in nodes if ws(n["text"]).startswith(("[다음 벙]", EMO["next"])) and n["b"][0] >= l0 - 60 and n["b"][1] > hgt * 0.25 and id(n) not in inside]
        if bubbles:                                              # 봇이 올린 말풍선을 길게 눌러 메뉴, '공지' 를 누른 뒤 창은 '아니요' 로 닫는다
            target = max(bubbles, key=lambda n: n["b"][3])
            self.hold(target, 1000, "길게 누를 글")
            menu = self.wait_change(nodes, tries=3)
            take("11 말풍선을 길게 누른 메뉴(새로 나온 것)", menu, nodes)
            m = self.labeled(menu, ("공지",), nodes)
            has_notice = any(n["text"].strip() and n["text"].strip() != room and not n["cls"].endswith("EditText")
                             and n["b"][0] >= l0 - 60 and hgt * 0.04 < n["b"][1] < hgt * 0.12 for n in nodes)
            if m and has_notice:
                self.tap(m[0])                                   # 공지가 이미 있을 때만(없으면 바로 걸려서 누르지 않는다)
                dlg = self.wait_change(menu, tries=3)
                take("12 '공지' 를 누른 뒤(새로 나온 것)", dlg, menu)
                no = self.labeled(dlg, ("아니요", "취소"), menu)
                if no:
                    self.tap(no[0])
            else:
                self.key(4)
        else:
            out.append("== 11 '다음 벙' 말풍선이 화면에 없어 길게 누르기는 건너뜀\n")
        return "\n".join(out)

    # ── 멤버 읽기: 알릴 방 오른쪽 위 메뉴(서랍)의 대화상대 칸. 방을 연 뒤 누르는 것은 서랍 단추, 대화상대 칸의 더보기 단추 하나, 뒤로 키뿐 ──
    def mem_never(self, n):
        """멤버 읽기에서 누르지 않을 것: 나가기, 내보내기, 강퇴, 신고, 차단, 삭제, 가리기, 초대, 종료, 설정이 든 것"""
        lab = n["text"] + " " + n["desc"]
        return any(w in lab for w in MEMBER_NEVER + self.VOICE_NEVER)

    def mem_tap(self, n):
        """멤버 읽기에서 누르는 것은 이것으로만(서랍 단추, 더보기 단추). 위험한 말이 들었으면 누르지 않고 멈춘다"""
        if self.mem_never(n):
            raise KakaoError("누르지 않음(%s)" % (ws(n["text"]) or ws(n["desc"]))[:20])
        self.tap(n)

    def mem_button(self, nodes):
        """방 오른쪽 위 세 줄(방 메뉴) 단추. study 와 같은 자리(방 칸 위쪽 8% 안의 누를 수 있는 것)의 글자 없는 작은 그림 단추 중
        맨 위 줄(방 이름 줄)의 것만 본다(그 아래 공지 띠의 X, 핀 고정은 보지 않는다). 이름에 메뉴나 서랍이 든 것, 없으면 그 줄의 가장 오른쪽.
        가장 오른쪽이 뒤로, 검색, 통화, 보이스룸, 공지, 닫기, 나가기, 설정 같은 것이면 다른 단추로 넘어가지 않고 None(아무것도 안 누른다)"""
        hgt = max(n["b"][3] for n in nodes)
        wid = max(n["b"][2] for n in nodes)
        e = find(nodes, cls="EditText")
        l0 = min(n["b"][0] for n in e) if e else 0
        top = [n for n in nodes if n["click"] and n["b"][1] < hgt * 0.08 and n["b"][0] >= l0 - 60 and not n["text"].strip()
               and not n["cls"].endswith("EditText") and n["b"][2] - n["b"][0] <= max(240, (wid - l0) * 0.25)]
        if not top:
            return None
        y0 = min(self.center(n)[1] for n in top)            # 맨 위 줄의 가운데
        row = [n for n in top if self.center(n)[1] - y0 <= max(24, (n["b"][3] - n["b"][1]) // 2)]
        bad = lambda n: self.mem_never(n) or bool(re.search(r"뒤로|검색|통화|보이스|페이스|라이브|프로필|사진|선물|공지|닫기|접기|고정", n["desc"]))
        named = [n for n in row if re.search(r"메뉴|서랍", n["desc"]) and not bad(n)]
        if named:
            return max(named, key=lambda n: n["b"][2])
        right = max(row, key=lambda n: n["b"][2])
        return None if bad(right) else right

    @staticmethod
    def mem_under(nodes, i):
        """요소 i 와 그 아래 요소들(위에서부터 차례대로)"""
        out, stack = [], [i]
        while stack:
            k = stack.pop(0)
            out.append(nodes[k])
            stack[:0] = nodes[k]["kids"]
        return out

    def mem_list(self, nodes, area):
        """area(왼, 위, 오른, 아래) 안의 목록 칸: 밀리는 칸(RecyclerView, ListView 같은 것, 판에 따라 scroll 표시).
        대화상대 머리를 품은 것 중 가장 안쪽, 없으면 메뉴 이름이 많은 것, 오른쪽, 큰 것. 목록이 없으면 자식이 셋 넘는 큰 칸"""
        l, t, r, b = area
        big = lambda n: n["b"][0] >= l - 5 and n["b"][2] <= r + 5 and n["b"][1] >= t - 5 and n["b"][3] <= b + 5 and n["b"][3] - n["b"][1] > (b - t) * 0.25
        root = nodes[0]["b"] if nodes else None
        c = [n for n in nodes if big(n) and n["kids"] and (n.get("scroll") or MEMBER_LIST_RE.search(n["cls"]))]
        if not c:
            c = [n for n in nodes if big(n) and len(n["kids"]) >= 3]
            c = [n for n in c if n["b"] != root] or c          # 화면 전체 묶음(위 띠, 보이스룸 작은 창까지 품은 것)보다 안쪽 칸

        def score(n):
            under = [x for x in self.mem_under(nodes, n["i"]) if x["text"].strip()]
            has = any(MEMBER_HEAD_RE.match(member_name(x["text"])) for x in under)
            size = (n["b"][2] - n["b"][0]) * (n["b"][3] - n["b"][1])
            return (has, -size if has else 0, sum(1 for x in under if member_mk(x["text"]) in MEMBER_LABELS), n["b"][0], size)
        return max(c, key=score) if c else None

    def mem_box(self, nodes, box, area):
        """민 뒤 화면의 같은 목록 칸(종류, id, 자리가 같은 것). 없으면 다시 고른다"""
        for n in nodes:
            if n["b"] == box["b"] and n["cls"] == box["cls"] and n["rid"] == box["rid"] and n["kids"]:
                return n
        return self.mem_list(nodes, area)

    def mem_rows(self, nodes, box):
        """목록 칸의 줄들 [(줄, 그 아래 요소들)], 위에서 아래로. 목록의 자식 하나가 한 줄.
        목록 안의 목록이나 목록 높이의 1/3 넘는 묶음(감싼 칸)은 풀어서 그 자식을 줄로 본다"""
        hgt = max(1, box["b"][3] - box["b"][1])
        out = []

        def headed(k):
            """대화상대 머리와 멤버 줄을 한 카드에 담은 묶음(머리 글 높이의 세 배 넘고, 머리, 수, 메뉴 말이 아닌 글이 있음).
            풀어야 첫 쪽의 멤버도 읽는다. 머리 줄만 높은 것('대화상대' 와 '94' 가 따로)은 풀지 않는다(수를 잃지 않게)"""
            n = nodes[k]
            under = self.mem_under(nodes, k)[1:]
            hs = [x for x in under if MEMBER_HEAD_RE.match(member_name(x["text"]))]
            return bool(hs) and n["b"][3] - n["b"][1] > 3 * max(1, hs[0]["b"][3] - hs[0]["b"][1]) and \
                any(x["text"].strip() and not member_label(x["text"]) for x in under)

        def sub(i, depth):
            for k in nodes[i]["kids"]:
                n = nodes[k]
                if n["kids"] and depth < 6 and (MEMBER_LIST_RE.search(n["cls"]) or n.get("scroll") or n["b"][3] - n["b"][1] > hgt * 0.34 or headed(k)):
                    sub(k, depth + 1)
                else:
                    out.append((n, self.mem_under(nodes, k)))
        sub(box["i"], 0)
        out.sort(key=lambda x: (x[0]["b"][1], x[0]["b"][0]))
        return out

    @staticmethod
    def mem_head(ns):
        """대화상대 칸 머리 줄이면 (머리 이름, 수 또는 None), 아니면 None. 수는 같은 글('대화상대 37')이나 옆 글('37')에서.
        컴포즈처럼 한 글로 묶인 '대화상대, 94' 는 쉼표로 나눠 본다"""
        labs = [member_name(p) for n in ns for x in (n["text"], n["desc"]) for p in re.split(r",\s+", x) if p.strip()]   # '1,234' 는 나누지 않는다
        for t in labs:
            m = MEMBER_HEAD_RE.match(t)
            if m:
                num = re.sub(r"\D", "", m.group(1) or next((x for x in labs if MEMBER_COUNT_RE.match(x)), ""))
                return member_mk(re.sub(r"[\d,()\[\]\s]+명?[)\]]?$", "", t)), (int(num) if num else None)
        return None

    def mem_row(self, ns, room=""):
        """한 줄 가르기: ('self', []) 봇 자신의 줄(나, 본인 표시), ('label', []) 이름이 없는 줄(메뉴, 초대, 더보기 같은),
        ('member', 이름 후보들) 후보는 위에서 아래, 왼쪽에서 오른쪽 차례"""
        marks = [member_mk(x) for n in ns for x in (n["text"] + "," + n["desc"]).split(",") if x.strip()]   # 컴포즈는 글을 '이름, 방장' 처럼 묶기도 한다
        if any(m in MEMBER_SELF for m in marks) or any(re.match(r"^[(\[]\s*(나|본인|me)\s*[)\]]", n["text"].strip(), re.I) for n in ns):
            return "self", []                                # '나' 표시가 따로 있거나 이름 앞에 '(나)' 가 붙은 줄
        act = lambda n, t: self.mem_never(n) and not re.search(r"\d", t)   # '내보내기 해제', '채팅방 나가기' 같은 줄(닉네임에는 보통 출생 연도가 있다)
        c = sorted([n for n in ns if n["text"].strip() and not member_label(n["text"], room) and not act(n, n["text"])], key=lambda n: (n["b"][1], n["b"][0]))
        r = ns[0] if ns else None
        if not c and r and r["click"] and not r["text"].strip() and r["desc"].strip() and not member_label(re.split(r",\s+", r["desc"])[0], room) and not act(r, r["desc"]):
            c = [r]                                          # 누르는 줄 하나가 이름을 desc 로만 가진 판(컴포즈가 '이름, 방장' 으로 묶은 줄)
        return ("member" if c else "label"), c

    @staticmethod
    def mem_rid(rows):
        """이름 칸 id 를 스스로 찾는다: name, nick 이 든 id 가 줄마다 하나씩, 세 줄 넘게 줄의 6할 넘게 있고 왼쪽 끝이 고르면 그 id. 없으면 ''"""
        got = {}
        for c in rows:
            for rid in {n["rid"] for n in c if MEMBER_RID_RE.search(n["rid"].split("/")[-1]) and not MEMBER_RID_NOT.search(n["rid"].split("/")[-1])}:
                got.setdefault(rid, []).append(next(n for n in c if n["rid"] == rid))
        if not got:
            return ""
        rid, ns = max(got.items(), key=lambda kv: len(kv[1]))
        lefts = [n["b"][0] for n in ns]
        return rid if len(ns) >= 3 and len(ns) >= len(rows) * 0.6 and max(lefts) - min(lefts) <= 40 else ""

    def mem_names(self, rows, st):
        """대화상대 칸의 줄들에서 줄마다 이름 하나. 이름 칸 id(설정 members.rid, 없으면 스스로 찾은 것)가 있으면 그 칸의 글,
        없으면 줄의 첫 글. 봇 자신, 이름이 없는 줄, 30자 넘는 글, 봇 이름은 뺀다"""
        cands = [c for kind, c in (self.mem_row(ns, st["room"]) for _, ns in rows) if kind == "member"]
        if not st["rid"] and not st["rid_fixed"]:
            st["rid"] = self.mem_rid(cands)
        rid = st["rid"]
        picks = [[n for n in c if rid in n["rid"]] for c in cands] if rid else cands
        if rid and not st["rid_fixed"] and not any(picks) and len(cands) >= 3:
            st["rid"], picks = "", cands                     # 정한 id 가 이 화면에 없다(다른 모양): 줄의 첫 글로
        out = []
        for p in picks:
            nm = re.sub(r"(,\s*(방장|부방장|운영자|관리자))+$", "", member_name(p[0]["text"] or p[0]["desc"])) if p else ""   # 묶인 글 끝의 표시는 뗀다
            if p and self.mem_never(p[0]) and not re.search(r"\d", nm):
                continue                                     # 목록 아래의 '오픈채팅방 나가기', '채팅방 신고하기' 같은 줄(닉네임에는 보통 출생 연도가 있다)
            if nm and len(nm) <= 30 and not member_isbot(nm):
                out.append(nm)
        return out

    def mem_page(self, nodes, box, st):
        """목록 칸 한 쪽 읽기: 대화상대 머리 아래 줄(머리를 앞 쪽에서 봤거나 전체 멤버 화면이면 모든 줄)의 이름. 머리 위(메뉴)는 읽지 않는다.
        대화상대 칸 안의 더보기 단추를 보면 st more 에 둔다. 돌려주는 것: (이름들, 줄 수, 대화상대 칸이 시작하는 y 또는 None)"""
        rows = self.mem_rows(nodes, box)
        hi = None
        for i, (_, ns) in enumerate(rows):
            h = self.mem_head(ns)                            # 수가 없는 머리('대화상대')는 누를 수 없는 것만(누르는 '멤버' 메뉴와 가르려고)
            if h and (h[1] or not any(x["click"] for x in ns)) and st["head"] in (None, h[0]):
                if h[1] is None:                             # '대화상대' 와 '94' 가 따로 줄로 갈린 판(컴포즈): 같은 높이의 수만 있는 글
                    r0 = rows[i][0]
                    cy = (r0["b"][1] + r0["b"][3]) // 2
                    same = [x for r, xs in rows if r is not r0 and abs((r["b"][1] + r["b"][3]) // 2 - cy) <= max(24, (r0["b"][3] - r0["b"][1]) // 2) for x in xs]
                    h = self.mem_head(ns + same) or h
                st["head"], st["n"], hi = h[0], st["n"] or h[1], i
                break
        st["head_vis"] = hi is not None
        if hi is not None:
            body, look, sec = rows[hi + 1:], rows[hi:], rows[hi][0]["b"][1]
        elif st["head"] or st["inmore"]:
            body, look, sec = rows, rows, box["b"][1]
        else:
            return [], len(rows), None
        hs = sorted(r["b"][3] - r["b"][1] for r, _ in body)
        full = hs[len(hs) // 2] if hs else 0                 # 위 끝에 반쯤 가린 줄(이름은 가려지고 상태 글만 보일 수 있다)은 앞 쪽에서 다 보였다
        body = [(r, ns) for r, ns in body if not (r["b"][1] <= box["b"][1] + 2 and r["b"][3] - r["b"][1] < full * 0.8)]
        if not st["more_done"] and not st["inmore"]:          # 더보기 단추는 쪽마다 새로 찾는다(되돌려 읽은 화면의 옛 자리를 누르지 않게)
            kinds = [self.mem_row(ns, st["room"])[0] for _, ns in look]
            last = max([i for i, k in enumerate(kinds) if k != "label"], default=-1)
            st["more"] = None
            for i, (_, ns) in enumerate(look):               # 머리 줄이나 마지막 멤버 줄 아래의 이름 없는 줄만(멤버 줄마다 붙은 더보기는 그 사람의 메뉴)
                if kinds[i] != "label" or 0 < i <= last:
                    continue
                for n in ns:
                    if (member_mk(n["text"]) in MEMBER_MORE or member_mk(n["desc"]) in MEMBER_MORE) and not self.mem_never(n):
                        st["more"] = st["more"] or n
        return self.mem_names(body, st), len(rows), sec

    def mem_sig(self, nodes, box):
        """목록 칸 안의 글과 자리(밀어도 그대로면 끝)"""
        return [(n["text"], n["desc"], n["b"]) for n in self.mem_under(nodes, box["i"])]

    def mem_danger(self, nodes, box, area):
        """밀 때 피할 것: area 안의 누르면 안 되는 단추(나가기, 설정 같은). (목록 줄 밖의 것, 모두)"""
        rowids = {x["i"] for _, ns in self.mem_rows(nodes, box) for x in ns}
        bad = [n for n in nodes if self.mem_never(n) and area[0] <= self.center(n)[0] <= area[2] and area[1] <= self.center(n)[1] <= area[3]]
        return [n for n in bad if n["i"] not in rowids], bad

    def mem_swipe(self, box, dh, frac, danger=((), ()), back=False):
        """목록 칸 안에서 손가락을 천천히 위로(back 이면 아래로) 민다. 서랍 높이(dh)의 아래 15%(나가기 단추가 있는 아래 띠 쪽),
        목록 칸의 위아래 끝과 가장자리는 건드리지 않고, 위험한 단추(초대, 내보내기 같은) 위에서는 손가락을 대지 않는다"""
        l, t, r, b = box["b"]
        h = b - t
        lo, hi = int(b - dh * 0.15), int(t + h * 0.12)
        for d in danger[0]:                                  # 목록 밖의 위험한 단추가 목록 아래쪽에 걸치면 그 위까지만
            if d["b"][1] > t + h * 0.4 and d["b"][0] < r and d["b"][2] > l:
                lo = min(lo, d["b"][1] - int(dh * 0.03))
        dist = min(int(h * frac), lo - hi)
        if dist < h * 0.1:
            raise KakaoError("멤버 목록 칸이 작아 밀 수 없음")
        y1, y2 = (lo - dist, lo) if back else (lo, lo - dist)
        hit = lambda x, y: any(d["b"][0] <= x <= d["b"][2] and d["b"][1] <= y <= d["b"][3] for d in danger[1]) or self.cover_at(x, y) is not None
        for f in (0.4, 0.3, 0.5, 0.6):                       # 누름은 손가락을 대는 자리에서만 생긴다(미는 동안과 떼는 자리는 아님)
            x = l + int((r - l) * f)
            if not hit(x, y1):
                break
        else:
            raise KakaoError("멤버 목록을 밀 자리가 없음(누르면 안 되는 단추나 다른 창이 겹침)")
        self.sh("input swipe %d %d %d %d 900" % (x, y1, x, y2))   # 천천히(던지듯 밀면 줄을 건너뛴다)
        self.sleep(0.8)

    def mem_mask(self, nodes, box=None, sec=None, before=None, keep=(), only=None):
        """멤버 화면 한 장을 적는다(멤버 이름은 가림). 메뉴와 칸 이름, 대화상대 머리(모르는 머리도 '참여 중인 멤버 8' 같은 모양이면), 수,
        표시(방장, 나), 더보기는 그대로. 목록 칸 안(목록 칸을 못 찾았으면 서랍에 새로 나온 것 모두)의 다른 글은 글자 수만,
        목록 칸 밖(위쪽 띠, 아래 띠)은 6자까지, 누를 수 있는 것만 글 12자, 이름 16자까지. id, 종류, 자리는 그대로.
        sec(대화상대 칸이 시작하는 y)는 쓰지 않는다(머리를 못 알아봐도 이름이 새지 않게). 줄: 종류|글|이름|id|누름|자리"""
        inbox = {x["i"] for x in self.mem_under(nodes, box["i"])} if box else set()
        seen = {(n["b"], n["text"], n["desc"]) for n in before} if before is not None else set()
        rows = []
        for n in nodes:
            if (n["b"], n["text"], n["desc"]) in seen or (only and not only(n)):
                continue
            if not (n["text"] or n["desc"] or n["click"] or n["cls"].endswith("EditText")):
                continue
            btn = n["click"] or bool(re.search(r"Button|ImageView", n["cls"]))
            inlist = n["i"] in inbox if box else before is not None
            lt, ld = (0, 0) if inlist else (6, 6) if not btn else (12, 16)
            t, d = ws(n["text"]), ws(n["desc"])
            if t and t not in keep and not member_label(t) and not member_headish(t) and len(t) > lt:
                t = "(글 %d자)" % len(t)
            if d and d not in keep and not member_label(d) and not member_headish(d) and len(d) > ld:
                d = "(이름 %d자)" % len(d)
            rows.append("%s|%s|%s|%s|%s|[%d,%d][%d,%d]" % (n["cls"].split(".")[-1], t[:60], d[:60], n["rid"].split("/")[-1], "누름" if n["click"] else "", *n["b"]))
        return rows[:90]

    def mem_snap(self, label, rows):
        """안 될 때 남길 지나온 화면(이름을 가린 줄)에 넣는다. 처음 셋(방 위쪽, 서랍)과 마지막 다섯을 둔다"""
        self.trace.append((label, rows))
        if len(self.trace) > 8:
            self.trace = self.trace[:3] + self.trace[-5:]

    def mem_read(self, nodes, box, area, st, res, limit, note, what, before=()):
        """목록 칸을 끝까지 밀며 이름을 모은다(res names). 두 쪽 잇달아 새 이름이 없거나 화면이 그대로면 끝, 민 횟수는 limit 까지.
        대화상대 칸 안에 더보기 단추가 보이면 멈춘다(st more). 밀림이 커서 앞 쪽과 겹치는 이름이 없으면 덜 밀고 한 번 되돌려 읽는다.
        before: 열기 전 화면(서랍 뒤의 방). 그 요소는 적지 않는다. 돌려주는 것: (마지막 화면, 목록 칸)"""
        dh = max(1, area[3] - area[1])
        old = {(n["b"], n["text"], n["desc"]) for n in before}
        mine = lambda n: area[0] <= self.center(n)[0] <= area[2] and area[1] <= self.center(n)[1] <= area[3] and (n["b"], n["text"], n["desc"]) not in old

        def look(nodes, box, k, back=False):
            if st["head"] is None and not st["inmore"]:      # 머리가 목록 칸 밖(위에 붙은 띠)에 있는 판: 목록 칸 전체가 대화상대 칸
                under = {x["i"] for x in self.mem_under(nodes, box["i"])}
                out = [n for n in nodes if mine(n) and n["i"] not in under and n["b"][3] <= box["b"][1] + 5]
                h = self.mem_head([n for n in out if not n["click"]])
                if h:
                    st["head"], st["n"] = h
            page, nrow, sec = self.mem_page(nodes, box, st)
            add = member_merge(res["names"], page, back)
            res["pages"].append((what, len(page), add))
            note("%s %d쪽%s(줄 %d, 이름 %d, 새 이름 %d)" % (what, k, " 되돌려" if back else "", nrow, len(page), add), nodes, box, sec, None, mine)
            return page, add

        def again(nodes, box):
            nodes = self.dump()
            box = self.mem_box(nodes, box, area)
            if box is None:
                raise KakaoError("멤버 목록 칸이 사라짐")
            self.mem_keep(nodes, box)
            return nodes, box
        page, _ = look(nodes, box, 1)
        k, step, idle = 1, 0.5, 0
        while res["swipes"] < limit and st["more"] is None:
            was = self.mem_sig(nodes, box)
            found = st["head"] is not None or st["inmore"]
            self.mem_swipe(box, dh, step if found else min(step, 0.35), self.mem_danger(nodes, box, area))   # 머리를 찾기 전에는 덜 민다(늦게 뜬 대화상대 머리를 건너뛰지 않게)
            res["swipes"] += 1
            nodes, box = again(nodes, box)
            if self.mem_sig(nodes, box) == was:
                break                                        # 더 내려가지 않는다(끝)
            k += 1
            vis = found and st.get("head_vis")               # 앞 쪽에 머리가 보였나
            prev, (page, add) = page, look(nodes, box, k)
            moved = {member_key(x) for x in page} != {member_key(x) for x in prev}
            gap = vis and not prev and page and not st.get("head_vis")   # 앞 쪽은 머리만 보였는데 이번 쪽에는 머리가 없다: 그 사이 줄을 건너뛰었을 수 있다
            if (gap or prev and page and not {member_key(x) for x in prev} & {member_key(x) for x in page}) and step > 0.3 and res["swipes"] < limit:
                step = 0.3                                   # 사이를 건너뛰었다: 앞으로는 덜 밀고, 한 번 되돌려 그 사이를 읽는다
                self.mem_swipe(box, dh, step, self.mem_danger(nodes, box, area), back=True)
                res["swipes"] += 1
                nodes, box = again(nodes, box)
                k += 1
                page, more = look(nodes, box, k, back=True)
                add += more
            idle = 0 if add or (st["head"] is None and not st["inmore"]) or (st["inmore"] and moved) else idle + 1   # 머리 전(메뉴)은 세지 않는다. 전체 멤버 화면은 서랍에서 읽은 이름을 지나가는 동안도
            if idle >= 2:
                break
        return nodes, box

    def mem_walk(self, room, mcfg=None, rec=None, limit=120, more_limit=120):
        """방을 열고 오른쪽 위 메뉴(서랍)를 열어 대화상대 칸을 끝까지 읽는다. 대화상대 칸에 더보기 단추가 있으면 한 번 눌러 열린 화면에서 읽는다.
        끝나면(안 되어도) 연 화면을 뒤로 키로 닫는다(Termux 로 돌아가는 done 은 부르는 쪽이). 지나온 화면은 이름을 가려 trace 에 둔다.
        rec(이름표, 줄들): members_study 가 화면마다 받는다. 돌려주는 것: {names, n(대화상대 수), head, rid, swipes, more, pages}"""
        fixed = str((mcfg or {}).get("rid") or "").strip()
        st = {"head": None, "n": None, "rid": fixed, "rid_fixed": bool(fixed), "more": None, "more_done": False, "inmore": False, "room": room}
        res = {"names": [], "n": None, "head": "", "rid": "", "swipes": 0, "more": False, "pages": []}

        def note(label, nodes, box=None, sec=None, before=None, only=None):
            rows = self.mem_mask(nodes, box, sec, before, (room,), only)
            self.mem_snap(label, rows)
            if rec:
                rec(label, rows)
        bbox = lambda ns: (min(n["b"][0] for n in ns), min(n["b"][1] for n in ns), max(n["b"][2] for n in ns), max(n["b"][3] for n in ns))
        mark = lambda ns, old: {(n["b"], n["text"], n["desc"]) for n in ns if (n["text"] or n["desc"]) and (n["b"], n["text"], n["desc"]) not in old}
        depth, marks, pre = 0, set(), None                   # 뒤로 키로 닫을 화면 수(서랍, 전체 멤버 화면), 그 화면에만 있던 글(닫혔는지 보려고), 열기 전 방 화면
        nodes = self.open_room(room)
        self.new_trace()                                     # 채팅 목록 화면(대화 글)은 남기지 않는다. 멤버 화면은 이름을 가려 남긴다
        try:
            hgt = max(n["b"][3] for n in nodes)
            e = find(nodes, cls="EditText")
            l0 = min(n["b"][0] for n in e) if e else 0
            note("방 위쪽(메뉴 단추 자리)", nodes, only=lambda n: n["b"][1] < hgt * 0.08 and n["b"][0] >= l0 - 60)
            btn = self.mem_button(nodes)
            if not btn:
                self.save_diag()
                raise KakaoError("방 오른쪽 위 세 줄 단추(방 메뉴)를 찾지 못함" + self.diag_note())
            room_n = self.mem_room_count(nodes, room)       # 방 이름 옆의 수('94'): 대화상대 머리에서 수를 못 읽으면 쓴다
            seen = {(n["b"], n["text"], n["desc"]) for n in nodes}
            pre = {k for k in seen if k[1] or k[2]}
            self.mem_left = {"pre": pre, "marks": set(), "btn": (btn["b"], btn["desc"]), "boxes": set()}
            self.mem_tap(btn)
            depth = 1                                        # 누른 순간부터 열렸다고 본다(바로 뒤 화면 읽기가 실패해도 닫게)

            def opened():
                drawer = self.mem_settle(self.wait_change(nodes, tries=3))   # 밀려 들어오는 중인 화면으로 자리를 정하지 않게 멈출 때까지
                now_ = {(n["b"], n["text"], n["desc"]) for n in drawer}
                side = [k for k in pre if (k[0][0] + k[0][2]) // 2 < l0 - 60]   # 태블릿 왼쪽 채팅 목록의 글
                full = sum(1 for k in side if k in now_) * 2 < len(side)   # 왼쪽 목록이 가려졌다: 방 정보가 화면 전체로 열렸다(새 카카오톡)
                return drawer, [n for n in drawer if (n["b"], n["text"], n["desc"]) not in seen and (full or self.center(n)[0] >= l0 - 60)]
            drawer, new = opened()
            if not new:
                drawer, new = opened()                       # 늦게 뜨는 기기: 한 번 더 기다린다
            if not new:
                self.save_diag()
                raise KakaoError("세 줄 단추를 눌렀는데 방 메뉴가 열리지 않음" + self.diag_note())
            marks = mark(new, seen)                          # 새로 연 칸의 글만(왼쪽 채팅 목록이나 뒤의 방에서 바뀐 글은 넣지 않는다)
            self.mem_left["marks"] = set(marks)
            area = bbox(new)
            box = self.mem_list(drawer, area)
            if box is None:
                note("방 메뉴(새로 나온 것)", drawer, before=nodes)
                self.save_diag()
                raise KakaoError("방 메뉴에서 목록 칸을 찾지 못함" + self.diag_note())
            self.mem_keep(drawer, box)
            cur, box = self.mem_read(drawer, box, area, st, res, limit, note, "방 메뉴", nodes)
            if st["more"] is not None:
                st["more_done"] = True
                self.mem_tap(st["more"])
                depth = 2                                    # 누른 순간부터(바로 뒤 화면 읽기가 실패해도 두 번 닫게)
                scr = self.mem_settle(self.wait_change(cur, tries=3))
                if [(n["b"], n["text"]) for n in scr] == [(n["b"], n["text"]) for n in cur]:
                    st["more"], depth = None, 1              # 눌러도 그대로: 방 메뉴를 이어 읽는다
                    self.mem_read(cur, box, area, st, res, limit, note, "방 메뉴 이어서", nodes)
                else:
                    res["more"] = True
                    marks |= mark(scr, {(n["b"], n["text"], n["desc"]) for n in cur})
                    self.mem_left["marks"] |= marks
                    st.update(inmore=True, rid=fixed, more=None)
                    h = self.mem_head(scr)                   # 전체 멤버 화면 위쪽 띠의 '대화상대 37'
                    if h and h[1]:
                        st["n"] = max(st["n"] or 0, h[1])
                    area2 = bbox(scr)
                    box2 = self.mem_list(scr, area2)
                    if box2 is None:
                        note("더보기를 누른 뒤(목록 칸 못 찾음)", scr, before=cur)
                    else:
                        self.mem_keep(scr, box2)
                        self.mem_read(scr, box2, area2, st, res, min(120, res["swipes"] + more_limit), note, "전체", cur)
                    self.key(4)                              # 방 메뉴로
                    self.sleep(0.6)
                    depth = 1
            res.update(n=st["n"] or room_n, head=st["head"] or "", rid=st["rid"])
            return res
        finally:
            self.mem_close(depth)

    def mem_settle(self, nodes, tries=2):
        """화면이 멈출 때까지(두 번 읽은 것이 같을 때까지, tries 번까지) 조금 더 읽는다. 넘어가는 중인 화면을 보고 정하지 않게"""
        for _ in range(tries):
            self.sleep(0.5)
            nxt = self.dump()
            if [(n["b"], n["text"]) for n in nxt] == [(n["b"], n["text"]) for n in nodes]:
                return nxt
            nodes = nxt
        return nodes

    def mem_keep(self, nodes, box):
        """닫혔는지 볼 표시를 더한다: 읽는 목록 칸(종류, id, 자리)과 그 안의 글. 첫 화면이 넘어가는 중이었어도 마지막 화면을 알아보게"""
        if self.mem_left is None:
            return
        if (box.get("scroll") or MEMBER_LIST_RE.search(box["cls"])) and box["i"] != 0 and box["b"] != nodes[0]["b"]:
            self.mem_left.setdefault("boxes", set()).add((box["cls"], box["rid"], box["b"]))
        pre = self.mem_left.get("pre") or set()
        self.mem_left.setdefault("marks", set()).update(k for k in ((n["b"], n["text"], n["desc"]) for n in self.mem_under(nodes, box["i"]) if n["text"] or n["desc"]) if k not in pre)

    def mem_room_count(self, nodes, room):
        """방 위쪽 줄에서 방 이름 옆의 수('94', '(94)'). 없으면 None"""
        hgt = max(n["b"][3] for n in nodes)
        ts = [n for n in nodes if same_room(n["text"], room) and n["b"][1] < hgt * 0.12]
        for t in ts:
            cy, h = (t["b"][1] + t["b"][3]) // 2, t["b"][3] - t["b"][1]
            for n in nodes:
                if n is not t and n["b"][0] >= t["b"][0] and MEMBER_COUNT_RE.match(n["text"].strip()) and abs((n["b"][1] + n["b"][3]) // 2 - cy) <= max(12, h):
                    v = int(re.sub(r"\D", "", n["text"]) or 0)
                    if v >= 2:
                        return v
        return None

    def mem_open(self, nodes, left=None):
        """방 메뉴(서랍, 방 정보)나 전체 멤버 화면이 아직 떠 있는지(left: mem_left). (1) 읽던 목록 칸(종류, id, 자리)이 그대로 있으면 떠 있다.
        (2) 카카오톡인데 방도 채팅 목록도 아니면(입력 칸, 채팅 탭, 누른 세 줄 단추가 없음) 떠 있다고 본다(화면 전체로 열리는 방 정보).
        (3) 그 화면에만 있던 글(marks)이 셋(적으면 모두) 보이면 떠 있다. marks 를 모르면(열자마자 실패) 열기 전 방 화면(pre)에 없던 글이
        방 칸에 여섯 넘게 있으면 떠 있다고 본다(새 대화 글이 많아도 그렇게 보지만 뒤로 한 번이면 그만)"""
        left = left or {}
        boxes = left.get("boxes") or set()
        if boxes and any(n["kids"] and (n["cls"], n["rid"], n["b"]) in boxes for n in nodes):
            return True
        btn = left.get("btn")
        if self.on_kakao(nodes) and not find(nodes, cls="EditText") and self.chat_tab(nodes) is None and \
                not (btn and any((n["b"], n["desc"]) == btn for n in nodes)):
            return True
        cur = {(n["b"], n["text"], n["desc"]) for n in nodes if n["text"] or n["desc"]}
        marks, pre = left.get("marks") or set(), left.get("pre")
        if marks:
            return len(marks & cur) >= min(3, len(marks))
        if not pre or not find(nodes, cls="EditText"):
            return False                                     # 방 화면이 아니다(목록으로 나갔으면 방 메뉴도 없다)
        return len(cur - pre) > 6

    def mem_close(self, depth):
        """연 화면(전체 멤버, 방 메뉴)을 뒤로 키로 닫는다. 누를 때마다 먼저 보고 떠 있을 때만 누른다(depth 에 두 번 더까지).
        누른 뒤에는 화면이 바뀌고 멈출 때까지 보고 다음을 정한다(느린 기기에서 두 번 눌러 방까지 나가지 않게).
        닫혔다고 본 뒤에야 mem_left 를 지운다. adb 가 끊겨 못 보면 남겨 두어 다음 open_room 이 먼저 닫게 한다
        (방 메뉴가 남아 있으면 다음 보내기가 입력 칸 자리를 눌러 그 화면의 다른 것을 누를 수 있다)"""
        if not depth:
            self.mem_left = None
            return
        left, ns = self.mem_left or {}, None
        for i in range(depth + 2):
            if ns is None:
                try:
                    ns = self.dump()
                except KakaoError:
                    ns = None                                # 화면을 못 읽으면 처음 depth 번은 그냥 누른다(adb 가 살아 있으면 닫힌다)
            try:
                if ns is not None and not self.mem_open(ns, left):
                    self.mem_left = None
                    return
                if ns is None and i >= depth:
                    return                                   # 못 본 채로 더 누르지 않는다(mem_left 를 남겨 다음 open_room 이 닫게)
                self.key(4)
            except KakaoError:
                return
            try:
                ns = self.mem_settle(self.wait_change(ns, tries=2), tries=1) if ns is not None else None
            except KakaoError:
                ns = None
            if ns is None:
                self.sleep(0.6)
        try:
            if not self.mem_open(self.dump(), left):
                self.mem_left = None
        except KakaoError:
            pass

    def mem_unstick(self, nodes):
        """지난 멤버 읽기가 닫지 못한 서랍을 닫는다(open_room 이 방을 쓰기 전에). 두 번 눌러도 남으면 멈춘다(입력 칸 자리를 누르지 않게)"""
        left = self.mem_left or {}
        for _ in range(3):
            if not self.mem_open(nodes, left):
                self.mem_left = None
                return nodes
            self.key(4)
            nodes = self.mem_settle(self.wait_change(nodes, tries=2), tries=1)
        self.mem_snap("마지막 화면(멤버 읽기 뒤 닫히지 않음)", self.mem_mask(nodes, before=[]))   # 이름은 가려 적는다
        self.save_diag()
        raise KakaoError("멤버 읽기 뒤 방 메뉴가 닫히지 않음. 태블릿에서 뒤로 가기로 방 메뉴를 닫아 주세요" + self.diag_note())

    def read_members(self, room, cfg_members=None):
        """알릴 방 메뉴(서랍)의 대화상대 칸에서 멤버 닉네임을 읽는다(봇 자신 빼고, 처음 본 차례, 사이트처럼 정리).
        다 읽었는지 본다: 대화상대 수 N 을 읽었으면 (N - 1) x min_ratio 명 넘게, 못 읽었으면 min 명 넘게. 아니면 KakaoError
        (이름을 가린 지나온 화면은 diag 파일에). 기록이나 화면에 이름을 적지 않는다"""
        m = dict(DEFAULTS["members"], **(cfg_members or {}))
        res = self.mem_walk(room, m)
        self.mem_info = {k: res[k] for k in ("n", "head", "rid", "swipes", "more")}
        names, n = res["names"], res["n"]
        ratio, least = float(m.get("min_ratio") or 0.9), int(m.get("min") or 20)
        why = ""
        if not res["head"]:
            why = "방 메뉴에서 대화상대 칸을 찾지 못함"
        elif n and len(names) < (n - 1) * ratio:
            why = "멤버를 다 읽지 못함(대화상대 %d명 중 %d명)" % (n, len(names))
        elif n and len(names) > n + max(3, n // 10):
            why = "멤버보다 많이 읽음(대화상대 %d명인데 이름 %d개)" % (n, len(names))
        elif not n and len(names) < least:
            why = "멤버를 다 읽지 못함(%d명, 대화상대 수를 못 읽어 %d명은 넘어야 함)" % (len(names), least)
        if why:
            self.save_diag()
            raise KakaoError(why + ". python excer_bot.py members study 로 화면을 적어 보내 주세요" + self.diag_note())
        return names

    def members_study(self, room, cfg_members=None):
        """알릴 방 메뉴(서랍)의 대화상대 칸 화면을 단계마다 적는다(멤버 이름은 가림). 누르는 것은 read_members 와 같다
        (서랍 단추, 더보기 하나, 뒤로). 서랍은 15번, 전체 멤버 화면은 5번까지 민다. 끝에 무엇을 찾았는지 정리한다"""
        out = ["# 멤버 읽기 화면 살피기 %s (판 %s)" % (time.strftime("%Y-%m-%d %H:%M"), VERSION),
               "멤버 이름은 적지 않음: 메뉴와 칸 이름, 대화상대 머리, 수, 표시(방장, 나)만 그대로, 나머지는 글자 수. 줄: 종류|글|이름|id|누름|자리", ""]

        def rec(label, rows):
            out.extend(["== %s (%d)" % (label, len(rows))] + rows + [""])
        res = None
        try:
            res = self.mem_walk(room, cfg_members, rec=rec, limit=15, more_limit=5)
        except KakaoError as e:
            out += ["== 멈춤: %s" % e, ""]
        if res:
            out += ["== 정리",
                    "대화상대 머리: %s%s" % (res["head"] or "못 찾음", ", 수 %d" % res["n"] if res["n"] else ", 수 못 읽음"),
                    "이름 칸 id: %s" % (res["rid"].split("/")[-1] if res["rid"] else "없음(줄의 첫 글)"),
                    "읽은 이름: %d개(이름은 적지 않음)%s" % (len(res["names"]), ", 봇을 빼면 %d명이어야 다 읽은 것" % (res["n"] - 1) if res["n"] else ""),
                    "민 횟수: %d, 더보기: %s" % (res["swipes"], "누름" if res["more"] else "없음")]
        return "\n".join(out)

    # ── 보이스룸(docs/BOT_VOICE_ROOM.md) ──
    VOICE_START = ("시작", "시작하기", "만들기", "개설", "개설하기", "보이스룸 시작", "보이스룸 만들기", "확인")
    VOICE_PERM = ("앱 사용 중에만 허용", "이번만 허용", "허용")
    VOICE_MIN = ("최소화", "작게 보기", "접기")
    VOICE_LEAVE = ("보이스룸 나가기", "나가기", "보이스룸 종료", "종료")
    VOICE_END_OK = ("종료", "나가기", "확인", "예")
    VOICE_NEVER = ("방 나가기", "채팅방 나가기", "삭제", "신고", "차단")   # 어떤 흐름에서도 누르지 않는다

    def voice_signals(self):
        """보이스룸 신호(화면을 건드리지 않음): 알림, 소리, 서비스, 카카오톡 프로세스, 망"""
        pkg = self.t["package"]
        sig = {"notif": [], "audio": False, "focus": False, "services": [], "alive": False, "pids": [], "net": "", "errors": [], "unreadable": False}
        try:
            self.device()                                 # adb 가 안 붙으면 신호를 '없음' 으로 치지 않는다
        except KakaoError as e:
            sig["errors"].append(str(e)[:160])
            sig["unreadable"] = True
            return sig

        def get(cmd, timeout=60):
            try:
                return self.sh(cmd + " 2>/dev/null; true", timeout=timeout)
            except KakaoError as e:
                sig["errors"].append(str(e)[:80])
                return ""
        pids = re.findall(r"\d+", get("ps -A -o PID,NAME | grep -F %s | awk '{print $1}'; pidof %s" % (pkg, pkg), 30))
        sig["pids"] = sorted(set(pids), key=int)
        sig["alive"] = bool(sig["pids"])
        sig["notif"] = notif_records(get("dumpsys notification --noredact"), pkg)
        sig["audio"], sig["focus"] = audio_active(get("dumpsys audio"), pkg, sig["pids"])
        sig["services"] = fg_services(get("dumpsys activity services %s" % pkg), pkg)
        sig["call"] = telecom_call(get("dumpsys telecom", 40), pkg)
        sig["net"] = net_state(get("ip route get 1.1.1.1; ip route", 20), get("dumpsys connectivity", 40))
        return sig

    def net_kick(self):
        """망이 끊겼을 때 와이파이를 껐다 켠다(svc wifi). 그전 망 상태를 돌려준다. 다시 붙는 데 몇 초에서 십여 초가 걸리므로 다음 차례에 확인한다"""
        before = net_state(self.sh("ip route get 1.1.1.1 2>/dev/null; ip route 2>/dev/null; true", 20), self.sh("dumpsys connectivity 2>/dev/null; true", 40))
        self.sh("svc wifi disable; sleep 3; svc wifi enable; true", 30)
        return before

    def voice_raw(self, v=None):
        """신호의 원문을 적는다(해석기를 맞추는 근거). 대화 글은 들어가지 않게: 알림 글자는 보이스룸이 든 것만 그대로, 나머지는 글자 수.
        전화번호 꼴 숫자는 가린다"""
        pkg, w = self.t["package"], voice_words(v)
        out = ["# 보이스룸 신호 원문 " + time.strftime("%Y-%m-%d %H:%M") + " (기기 %s, SDK %s)" % (self.sh("getprop ro.product.model").strip(), self.sh("getprop ro.build.version.sdk").strip()), ""]

        def get(cmd, timeout=60):
            try:
                return self.sh(cmd + " 2>/dev/null; true", timeout=timeout)
            except KakaoError as e:
                return "(읽기 오류: %s)" % str(e)[:80]

        def mask(s):                                          # 전화번호 꼴(9자리 이상)만 가린다. 8자리 flags 값은 그대로
            return re.sub(r"\d{9,}", lambda m: "숫자" + str(len(m.group(0))) + "자리", s)
        pids = sorted(set(re.findall(r"\d+", get("ps -A -o PID,NAME | grep -F %s | awk '{print $1}'; pidof %s" % (pkg, pkg), 30))), key=int)
        out += ["## 프로세스: " + (", ".join(pids) or "없음"), ""]
        no = get("dumpsys notification --noredact")
        cut = min([i for i in (no.find(x) for x in ("mArchive", "Archive (", "Historical")) if i >= 0] or [len(no)])
        out.append("## 알림(카카오톡 것만, 글자는 '%s' 가 든 것만 그대로)" % w["word"])
        for blk in no[:cut].split("NotificationRecord(")[1:]:
            head = blk.split("\n", 1)[0]
            if not re.search(r"\bpkg=%s\b" % re.escape(pkg), head):
                continue
            out.append("- " + mask(head)[:300])
            for line in blk.split("\n")[1:]:
                s = line.strip()
                if re.match(r"(uid=|opPkg=|flags=|mIsForegroundService|isOngoing|isForeground|android\.(title|text|subText|bigText|textLines|infoText|conversationTitle)=|tickerText=|category=|mChannel|channel=)", s):
                    m = re.match(r"(android\.\w+=\w+ \()(.*)(\)\s*)$", s)
                    if m and w["word"] not in m.group(2):
                        s = m.group(1) + "(글 %d자)" % len(m.group(2)) + ")"
                    out.append("    " + mask(s)[:200])
        out.append("")
        au = get("dumpsys audio")
        out.append("## 소리(dumpsys audio 에서 카카오톡 줄과 포커스 줄)")
        out += ["    " + l.strip()[:220] for l in au.split("\n") if pkg in l or any(("/%s " % p) in l for p in pids) or "Focus stack" in l or "focus" in l.lower() and "stack" in l.lower()][:40]
        out.append("")
        sv = get("dumpsys activity services %s" % pkg)
        out.append("## 서비스(dumpsys activity services)")
        out += ["    " + l.strip()[:200] for l in sv.split("\n") if "ServiceRecord{" in l or "isForeground" in l or "foregroundId" in l or "fgs" in l.lower()][:40]
        out.append("")
        tc = get("dumpsys telecom", 40)
        out.append("## 통화(dumpsys telecom 에서 카카오톡과 상태 줄)")
        out += ["    " + mask(l.strip())[:200] for l in tc.split("\n") if pkg in l or re.search(r"\b(ACTIVE|DIALING|CONNECTING|RINGING|HOLDING|DISCONNECTED|SelfManaged|isSelfManaged)\b", l)][:60]
        out.append("")
        out.append("## 망(ip route get 1.1.1.1, ip route)")
        out += ["    " + l.strip()[:200] for l in get("ip route get 1.1.1.1; ip route", 20).split("\n") if l.strip()][:20]
        out.append("## 망(dumpsys connectivity 앞부분, 망 이름은 가림)")
        out += ["    " + re.sub(r'extra: "[^"]*"', 'extra: "..."', l.strip())[:200] for l in get("dumpsys connectivity", 40).split("\n") if l.strip()][:30]
        out.append("")
        out.append("## 판정")
        out += voice_status_lines(self.voice_signals(), {}, v)
        return "\n".join(out)

    def voice_study(self, room, title="시험 보이스룸", v=None):
        """시험 방에 보이스룸을 실제로 하나 만들었다가 끝내며, 단계마다 화면(단추 이름)과 신호를 적는다. 2단계(복구)의 근거.
        '방 나가기', '삭제' 같은 단추는 누르지 않는다"""
        out, word = [], voice_words(v)["word"]

        def take(label, nodes, before=None):
            keep = (room, title) + tuple(ws(n["text"]) for n in nodes if word in n["text"])   # 보이스룸 글자가 든 띠와 안내 창 글은 그대로 적는다
            rows = self.study_rows(nodes, before, False, keep)
            out.extend(["== %s (%d)" % (label, len(rows))] + rows + [""])

        def sig(label):
            s = self.voice_signals()
            out.append("## 신호: " + label)
            out.extend(voice_status_lines(s, {}, v))
            out.append("")
            return voice_state(s, v)[0]

        def pick(nodes, words, before=()):
            c = [n for n in self.labeled(nodes, words, before) if not any(w in n["text"] + " " + n["desc"] for w in self.VOICE_NEVER)]
            return c[0] if c else None

        def name(n):
            return n["text"].strip() or n["desc"].strip()

        def has_voice_ui(nodes):
            return pick(nodes, self.VOICE_LEAVE) is not None or pick(nodes, ("마이크 끄기", "마이크 켜기", "음소거")) is not None
        first = voice_state(self.voice_signals(), v)[0]
        if first == "on":                                 # 한 계정은 보이스룸 하나. 시험하면 켜 둔 보이스룸(알릴 방)이 끊긴다
            raise KakaoError("보이스룸이 이미 켜져 있음(알릴 방). 시험을 하면 그 보이스룸이 끊기니, 끝낸 뒤에 voice study 를 하세요")
        if first == "unknown":
            raise KakaoError("adb 가 안 붙어 신호를 읽지 못함. python excer_bot.py connect 포트 뒤에 다시")
        nodes = self.open_room(room)
        take("1 시험 방(%s)" % room, nodes)
        sig("1 시작 전")
        box = self.box(nodes)
        bh = box["b"][3] - box["b"][1]
        cands = [n for n in nodes if n["click"] and n["b"][2] <= box["b"][0] + 10 and n["b"][0] >= box["b"][0] - 400
                 and abs(self.center(n)[1] - self.center(box)[1]) < bh]
        if not cands:
            out.append("안 됨: 입력 칸 왼쪽에서 + 단추를 찾지 못함")
            return "\n".join(out)
        plus = max(cands, key=lambda n: n["b"][2])
        out.extend(["+ 단추로 고른 것: " + self.study_rows([plus], None, False, ())[0], ""])
        self.tap(plus)
        panel = self.wait_change(nodes, tries=3)
        take("2 + 를 누른 뒤(새로 나온 것)", panel, nodes)
        item = [n for n in panel if word in n["text"] or word in n["desc"]]
        if not item:
            out.append("안 됨: + 메뉴에 '%s' 이 없음(봇이 방장이나 부방장인지, 메뉴를 옆으로 밀어야 하는지)" % word)
            self.key(4)
            return "\n".join(out)
        self.tap(item[0])
        dlg = self.wait_change(panel, tries=3)
        take("3 '%s' 을 누른 뒤(새로 나온 것)" % word, dlg, panel)
        if has_voice_ui(dlg):
            scr = dlg                                             # 창 없이 바로 만들어짐
        else:
            field = [n for n in find(dlg, cls="EditText") if n["b"] != box["b"]]
            if field:
                dlg = self.paste_into(field[0], title)
                take("3-1 제목을 넣은 뒤", dlg, panel)
            start = pick(dlg, self.VOICE_START, panel)
            if not start:
                out.append("안 됨: 시작 단추를 찾지 못함")
                self.key(4)
                return "\n".join(out)
            self.tap(start)
            scr = self.wait_change(dlg, tries=4)
            take("4 '%s' 를 누른 뒤(새로 나온 것)" % name(start), scr, dlg)
        perm = pick(scr, self.VOICE_PERM)
        if perm:
            self.tap(perm)
            out.append("권한 창: '%s' 를 누름" % name(perm))
            scr = self.wait_change(scr, tries=4)
        take("5 보이스룸 화면", scr)
        self.sleep(3)
        sig("5 보이스룸 화면에서")
        mic = pick(scr, ("마이크 끄기", "음소거"))
        if mic:
            self.tap(mic)
            scr2 = self.wait_change(scr, tries=2)
            take("5-1 '%s' 를 누른 뒤(새로 나온 것)" % name(mic), scr2, scr)
            scr = scr2
        mn = pick(scr, self.VOICE_MIN)
        if mn:
            self.tap(mn)
            out.append("최소화: '%s' 단추" % name(mn))
        else:
            self.key(4)
            out.append("최소화: 단추가 없어 뒤로 가기")
        nodes = self.wait_change(scr, tries=3)
        take("6 최소화한 뒤(방 화면: 띠, 작은 창)", nodes)
        sig("6 최소화한 뒤")
        self.done()
        self.sleep(5)
        sig("7 다른 앱(Termux)으로 나간 뒤")
        nodes = self.open_room(room)
        take("8 방을 다시 연 화면", nodes)
        tag = [n for n in nodes if (word in n["text"] or word in n["desc"]) and n["b"][0] >= box["b"][0] - 60]
        tag = [n for n in tag if n["click"]] + [n for n in tag if not n["click"]]
        if tag:
            self.tap(tag[0])
            scr = self.wait_change(nodes, tries=3)
            take("9 '%s' 띠(또는 작은 창)를 누른 뒤(새로 나온 것)" % name(tag[0])[:20], scr, nodes)
        else:
            out.append("== 9 방 화면에 '%s' 글자가 없어 띠 누르기는 건너뜀\n" % word)
            scr = nodes
        leave = pick(scr, self.VOICE_LEAVE)
        if not leave:
            out.append("안 됨: 나가기 단추를 찾지 못함. 보이스룸은 켜진 채로 둠(직접 끄세요)")
            return "\n".join(out)
        self.tap(leave)
        conf = self.wait_change(scr, tries=3)
        take("10 '%s' 를 누른 뒤(새로 나온 것)" % name(leave), conf, scr)
        yes = pick(conf, self.VOICE_END_OK, scr)
        if yes:
            self.tap(yes)
            after = self.wait_change(conf, tries=3)
            take("11 '%s' 를 누른 뒤" % name(yes), after)
        self.sleep(2)
        sig("12 끝낸 뒤")
        return "\n".join(out)

    # ── 보이스룸 2단계: 다시 켜기, 끝내기(docs/BOT_VOICE_ROOM.md 4절, 6절) ──
    VOICE_JOIN = ("참여", "참여하기", "보이스룸 참여", "들어가기")
    VOICE_KICK_RE = re.compile(r"내보내|강퇴|참여할 수 없|참여가 제한")
    VOICE_ERR_RE = re.compile(r"보이스룸[^\n]{0,30}(오류|종료|끊)|(오류|종료|끊)[^\n]{0,30}보이스룸|일시적인 오류")

    def vpick(self, nodes, words, before=()):
        """단추 찾기. '방 나가기', '삭제', '신고' 는 어떤 흐름에서도 고르지 않는다"""
        c = [n for n in self.labeled(nodes, words, before) if not any(w in n["text"] + " " + n["desc"] for w in self.VOICE_NEVER)]
        return c[0] if c else None

    def vsoft(self, nodes, words):
        """이름에 words 가 들어 있는 단추(아이콘 단추 이름은 '보이스룸 나가기 버튼' 처럼 붙어 나온다). 누를 수 있거나 단추, 그림 칸인 것만,
        이름은 16자까지. 입력 칸이 있는 화면(방)에서는 쓰지 않는다(말풍선 글을 단추로 보지 않게)"""
        if find(nodes, cls="EditText"):
            return None
        c = []
        for n in nodes:
            lab = ws(n["text"]) or ws(n["desc"])
            if not lab or len(lab) > 16 or not (n["click"] or re.search(r"Button|ImageView", n["cls"])):
                continue
            if any(w in lab for w in words) and not any(w in lab for w in self.VOICE_NEVER):
                c.append(n)
        c.sort(key=lambda n: not n["click"])
        return c[0] if c else None

    def voice_ui(self, nodes):
        """보이스룸 화면인지(나가기나 마이크 단추가 있음)"""
        return self.vpick(nodes, self.VOICE_LEAVE) is not None or self.vpick(nodes, ("마이크 끄기", "마이크 켜기", "음소거")) is not None

    def voice_screen(self, nodes, v=None):
        """띠나 알림을 누른 뒤 열린 것이 보이스룸 화면인지. 이름이 정확한 단추(voice_ui)이거나, 입력 칸이 없는 화면에
        이름에 나가기나 종료가 든 짧은 단추가 있고 보이스룸 글자나 제목이나 'N명 참여' 도 보일 때('마이크' 만으로는 치지 않는다)"""
        if self.voice_ui(nodes):
            return True
        return self.vsoft(nodes, ("나가기", "종료")) is not None and any(self.voice_mark(n, v) for n in nodes)

    VOICE_BAND_RE = re.compile(r"\d+\s*명\s*참여")

    @staticmethod
    def plain(s):
        """이모지와 기호를 뺀 글(제목 견주기용)"""
        return ws(re.sub(r"[^\w\s()]", " ", s or ""))

    def voice_title_head(self, v=None):
        return self.plain((v or {}).get("title") or DEFAULTS["voice"]["title"])[:8]

    def voice_mark(self, n, v=None):
        """보이스룸 띠의 글자인지: '보이스룸', 보이스룸 제목 앞부분, 'N명 참여'"""
        lab = n["text"] + " " + n["desc"]
        head = self.voice_title_head(v)
        return (voice_words(v)["word"] in lab or (bool(head) and head in self.plain(lab)) or self.VOICE_BAND_RE.search(lab) is not None) \
            and not any(w in lab for w in self.VOICE_NEVER)

    def room_top(self, nodes):
        """방 칸(태블릿은 왼쪽 채팅 목록 말고 오른쪽)에서 입력 칸 위 화면의 위쪽 3할 반: (왼쪽 끝, 아래 경계). 방이 아니면 None"""
        if not find(nodes, cls="EditText") or not self.on_kakao(nodes):
            return None
        box = self.box(nodes)
        l0 = box["b"][0] - 60
        pane = [n for n in nodes if self.center(n)[0] >= l0]
        top = min(n["b"][1] for n in pane)
        return l0, top + (box["b"][1] - top) * 0.35

    BAND_AVOID = ("나가기", "종료", "닫기", "끄기", "숨기기", "참여하기", "참여")   # 띠 안의 작은 단추(나가기, 닫기 등)는 띠로 치지 않는다

    def voice_band(self, nodes, v=None):
        """방 위쪽 보이스룸 띠. 방 칸의 위쪽에서 보이스룸 글자나 제목이나 'N명 참여' 가 든 것. 누를 수 있는 것을, 위에 있는 것을 먼저.
        채팅 목록(태블릿 왼쪽)의 '보이스룸' 글, 아래쪽 말풍선, 띠 안의 나가기와 닫기 단추는 고르지 않는다"""
        area = self.room_top(nodes)
        if not area:
            return None
        l0, limit = area
        inlist = self.in_lists(nodes)
        avoid = lambda n: any(w in n["text"] + " " + n["desc"] for w in self.BAND_AVOID) and not self.VOICE_BAND_RE.search(n["text"] + " " + n["desc"])
        c = [n for n in nodes if self.center(n)[0] >= l0 and n["b"][1] < limit and n["i"] not in inlist and not n["cls"].endswith("EditText")
             and self.voice_mark(n, v) and not avoid(n)]
        c.sort(key=lambda n: (n["b"][1], not n["click"]))
        return c[0] if c else None

    @staticmethod
    def in_lists(nodes):
        """대화 칸, 채팅 목록 같은 목록(RecyclerView, ListView) 안의 요소 번호들. 말풍선과 목록 줄은 여기 든다"""
        out, stack = set(), [n["i"] for n in nodes if re.search(r"RecyclerView|ListView", n["cls"])]
        while stack:
            i = stack.pop()
            for k in nodes[i]["kids"] if i < len(nodes) else []:
                if k not in out:
                    out.add(k)
                    stack.append(k)
        return out

    def shade_hits(self, nodes, v=None):
        """알림 창에서 카카오톡 '보이스룸에 참여 중' 알림 글(그 글뿐인 것. 남의 대화 알림에 그 말이 섞인 것은 빼려고)"""
        on = voice_words(v)["on"]
        return [n for n in nodes if any(ws(x).startswith(on) and len(ws(x)) <= len(on) + 6 for x in (n["text"], n["desc"]))]

    def voice_from_shade(self, v=None):
        """알림 창을 내려 '보이스룸에 참여 중' 알림을 누른다(보이스룸 화면이 열린다). 못 열면 알림 창을 접고 None.
        알림 창에는 남의 알림이 있어 그 글은 적지 않는다(참여 중 알림만)"""
        self.shade_hit_n, scr = 0, None
        self.sh("cmd statusbar expand-notifications; true")
        try:
            self.sleep(1.2)
            shade = self.dump()
            hit = self.shade_hits(shade, v)
            self.shade_hit_n = len(hit)
            self.snap("알림 창의 보이스룸 알림", hit)
            if not hit:
                return None
            self.tap(hit[0])
            got = self.wait_change(shade, tries=4)
            if self.on_kakao(got) and not self.shade_hits(got, v):   # 알림 창이 닫히고 카카오톡이 열림
                self.snap("알림을 누른 뒤", got)
                scr = got
            return scr
        finally:
            if scr is None:
                self.sh("cmd statusbar collapse; true")

    def voice_open_screen(self, room, v=None):
        """보이스룸 화면을 연다: 방 위쪽 띠를 누르고, 안 되면 알림 창의 '참여 중' 알림을 누른다. 안 되면 KakaoError(지나온 화면은 excer_bot_ui.txt)"""
        nodes = self.open_room(room)
        self.snap("방", nodes)
        band = self.voice_band(nodes, v)
        tried = []
        if band:
            tried.append("띠 '%s'" % (ws(band["text"]) or ws(band["desc"]))[:24])
            self.tap(band)
            scr = self.wait_change(nodes, tries=3)
            self.snap("띠를 누른 뒤", scr, nodes)
            if self.voice_screen(scr, v):
                return scr
            if not find(scr, cls="EditText"):
                self.key(4)                                       # 다른 화면이 열렸으면 닫고 방으로(나가기는 누르지 않는다)
        else:
            tried.append("방 위쪽에 띠 없음")
        scr = self.voice_from_shade(v)
        tried.append("알림 창에 참여 중 알림 없음" if not self.shade_hit_n else "알림 창의 참여 중 알림을 눌렀으나 " + ("열리지 않음" if scr is None else "보이스룸 화면이 아님"))
        if scr is not None and self.voice_screen(scr, v):
            return scr
        self.save_diag(scr)
        raise KakaoError("보이스룸 화면을 열지 못함(%s)%s" % (", ".join(tried), self.diag_note()))

    def voice_close_dialog(self, nodes):
        """보이스룸 오류나 종료 안내 창이면 확인으로 닫는다. 다른 창은 건드리지 않는다"""
        if self.VOICE_ERR_RE.search(" ".join(n["text"] for n in nodes if n["text"])):
            ok = self.vpick(nodes, ("확인", "닫기", "네"))
            if ok:
                self.snap("보이스룸 안내 창", nodes)
                self.tap(ok)
                return self.wait_change(nodes, tries=2)
        return nodes

    def voice_mini(self, nodes):
        """보이스룸 작은 창(제목, '1명 참여 중', 마이크, 스피커, 나가기가 든 작은 상자)의 요소 번호들.
        작은 창은 보이스룸 화면이 아니다(그것만 보고 뒤로 가기를 누르면 카카오톡이 닫힌다)"""
        out = set()
        for box, under in self.voice_minis(nodes):
            out |= under
        return out

    def voice_minis(self, nodes):
        """보이스룸 작은 창 같은 작은 상자 하나하나: (상자 요소, 그 안의 요소 번호들)"""
        if not nodes:
            return []
        area = max(1, max(n["b"][2] for n in nodes) * max(n["b"][3] for n in nodes))
        par = {k: n["i"] for n in nodes for k in n["kids"]}
        out, seen = [], set()
        for n in nodes:
            if not self.VOICE_BAND_RE.search(n["text"] + " " + n["desc"]):
                continue
            box, cur = None, (n if n["kids"] else nodes[par[n["i"]]] if n["i"] in par else None)
            while cur is not None:                               # 그 글을 품은 작은 상자 가운데 가장 큰 것(화면의 5% 안, 띠처럼 길지 않은)
                w, h = cur["b"][2] - cur["b"][0], cur["b"][3] - cur["b"][1]
                if w * h > area * 0.05 or w > h * 4:
                    break
                box = cur
                cur = nodes[par[cur["i"]]] if cur["i"] in par else None
            if box is None:
                continue
            under, stack = set(), [box["i"]]
            while stack:
                j = stack.pop()
                if j not in under:
                    under.add(j)
                    stack.extend(nodes[j]["kids"])
            if box["i"] not in seen and any(any(w in nodes[j]["text"] + " " + nodes[j]["desc"] for w in self.VOICE_LEAVE + ("마이크", "스피커")) for j in under):
                seen.add(box["i"])
                out.append((box, under))
        return out

    def voice_front(self, nodes):
        """보이스룸 화면이 앞에 떠 있는지(작은 창은 빼고 본다)"""
        if not self.on_kakao(nodes) or find(nodes, cls="EditText"):
            return False
        mini = self.voice_mini(nodes)
        return self.voice_ui([n for n in nodes if n["i"] not in mini])

    def voice_guard(self, nodes):
        """공지 흐름이 시작될 때 보이스룸 화면이 앞에 떠 있으면 최소화하고 방으로. 나가기는 누르지 않는다. 작은 창은 그대로 둔다"""
        if self.voice_front(nodes):
            self.brief("보이스룸 화면이 앞에 떠 있어 접음", nodes)
            return self.voice_minimize(nodes)
        return nodes

    def voice_minimize(self, nodes):
        """보이스룸 화면을 작게 접는다: 최소화 단추, 없으면 뒤로. 보이스룸 화면이 아니면(방, 목록, 작은 창뿐) 아무것도 누르지 않는다"""
        mini = self.voice_mini(nodes)
        big = [n for n in nodes if n["i"] not in mini]
        mn = self.vpick(big, self.VOICE_MIN)
        if mn:
            self.tap(mn)
        elif not find(nodes, cls="EditText") and self.voice_screen(big, self.vcfg):
            self.key(4)
        else:
            return nodes
        return self.wait_change(nodes, tries=3)

    def voice_perm(self, scr):
        perm = self.vpick(scr, self.VOICE_PERM)
        if perm:
            self.tap(perm)
            scr = self.wait_change(scr, tries=4)
        return scr

    def voice_mute(self, scr):
        mic = self.vpick(scr, ("마이크 끄기", "음소거"))
        if mic:
            self.tap(mic)
            return self.wait_change(scr, tries=2)
        return scr

    def voice_volume0(self):
        """통화 음량 0: 태블릿 스피커로 방 소리가 나지 않게"""
        for cmd in ("cmd media_session volume --stream 0 --set 0", "media volume --stream 0 --set 0"):
            try:
                self.sh(cmd + " >/dev/null 2>&1; true", timeout=15)
                return
            except KakaoError:
                pass

    def voice_wait_on(self, v, tries=4):
        for _ in range(tries):
            self.sleep(2.5)
            if voice_state(self.voice_signals(), v)[0] == "on":
                return True
        return False

    def voice_plus(self, nodes):
        box = self.box(nodes)
        bh = box["b"][3] - box["b"][1]
        cands = [n for n in nodes if n["click"] and n["b"][2] <= box["b"][0] + 10 and n["b"][0] >= box["b"][0] - 400
                 and abs(self.center(n)[1] - self.center(box)[1]) < bh]
        return max(cands, key=lambda n: n["b"][2]) if cands else None

    def voice_create(self, nodes, title, word, v=None):
        """방에서 + 메뉴, 보이스룸, (제목), 시작. 보이스룸 화면을 돌려준다. 안 되면 화면을 적고 KakaoError.
        시작을 누른 뒤 화면을 못 알아봐도 '참여 중' 알림이 뜨면 만들어진 것이다(실기기 로그: 화면이 아니라고 적은 13초 뒤 켜짐)"""
        plus = self.voice_plus(nodes)
        if not plus:
            self.save_diag(nodes)
            raise KakaoError("입력 칸 왼쪽에서 + 단추를 찾지 못함" + self.diag_note())
        self.tap(plus)
        panel = self.wait_change(nodes, tries=3)
        self.snap("+ 메뉴", panel, nodes)
        item = [n for n in panel if word in n["text"] or word in n["desc"]]
        if not item:
            self.save_diag(panel)
            self.key(4)
            raise KakaoError("+ 메뉴에 '%s' 이 없음(봇이 방장이나 부방장인지)%s" % (word, self.diag_note()))
        self.tap(item[0])
        dlg = self.wait_change(panel, tries=3)
        self.snap("'%s' 을 누른 뒤" % word, dlg, panel)
        if self.voice_ui(dlg):
            return dlg
        box = self.box(nodes)
        field = [n for n in find(dlg, cls="EditText") if n["b"] != box["b"]]
        if field and title:
            dlg = self.paste_into(field[0], title)
        start = self.vpick(dlg, self.VOICE_START, panel)
        if not start:
            self.save_diag(dlg)
            self.key(4)
            raise KakaoError("보이스룸 시작 단추를 찾지 못함" + self.diag_note())
        self.tap(start)
        scr = self.voice_perm(self.wait_change(dlg, tries=4))
        self.snap("시작을 누른 뒤", scr)
        if not self.voice_ui(scr) and not self.voice_wait_on(v, tries=3):
            self.save_diag(scr)
            raise KakaoError("시작을 눌렀는데 보이스룸 화면이 아니고 '참여 중' 알림도 없음" + self.diag_note())
        return scr

    def voice_recover(self, room, v=None):
        """끊긴 보이스룸을 다시 켠다. 띠에 '참여' 가 있으면(다른 진행자가 열어 둠) 참여, 없으면 새로 만든다.
        돌려주는 것: on(이미 켜져 있음), joined, created, kicked(내보내진 것으로 보임). 안 되면 KakaoError(지나온 화면은 excer_bot_ui.txt)"""
        v = v or {}
        w = voice_words(v)
        title = v.get("title") or DEFAULTS["voice"]["title"]
        if voice_state(self.voice_signals(), v)[0] == "on":    # 신호로 켜져 있으면 화면을 건드리지 않는다
            return "on"
        self.new_trace()
        try:
            nodes = self.launch()
            self.snap("카카오톡을 띄운 화면", nodes)
            nodes = self.voice_close_dialog(nodes)
            if self.voice_front(nodes):                         # 보이스룸 화면이 앞에 떠 있음: 아직 켜져 있을 수 있다
                nodes = self.voice_minimize(nodes)
                if voice_state(self.voice_signals(), v)[0] == "on":
                    return "on"
            nodes = self.open_room(room)
            self.snap("방", nodes)
            if any(self.VOICE_KICK_RE.search(n["text"] + " " + n["desc"]) for n in nodes if w["word"] in n["text"] + n["desc"]):
                self.save_diag(nodes)
                return "kicked"
            tagged = [n for n in nodes if w["word"] in n["text"] or w["word"] in n["desc"]]
            join = self.vpick(nodes, self.VOICE_JOIN) if tagged else None
            if join:
                self.tap(join)
                scr = self.voice_perm(self.wait_change(nodes, tries=4))
                self.snap("'참여' 를 누른 뒤", scr)
                if not self.voice_ui(scr) and not self.voice_wait_on(v, tries=3):
                    self.save_diag(scr)
                    raise KakaoError("참여를 눌렀는데 보이스룸 화면이 아니고 '참여 중' 알림도 없음" + self.diag_note())
                how = "joined"
            else:
                scr = self.voice_create(nodes, title, w["word"], v)
                how = "created"
            if v.get("mute", True):
                scr = self.voice_mute(scr)
            if v.get("volume0", True):
                self.voice_volume0()
            if not self.voice_wait_on(v):
                self.save_diag(scr)
                raise KakaoError("보이스룸을 %s 했는데 '%s' 알림이 안 보임%s" % ("만들기" if how == "created" else "참여", w["on"], self.diag_note()))
            self.voice_minimize(self.dump())                    # 지금 화면으로(그새 접혔으면 아무것도 누르지 않는다)
            return how
        finally:
            self.done()

    def voice_end(self, room, v=None):
        """켜 둔 보이스룸을 끝낸다(48시간 갱신). 봇이 진행자라 나가면 끝난다: 나가기, 종료 확인"""
        v = v or {}
        self.new_trace()
        try:
            nodes = self.voice_close_dialog(self.launch())
            scr = nodes if self.voice_screen(nodes, v) else self.voice_open_screen(room, v)
            leave = self.vpick(scr, self.VOICE_LEAVE) or self.vsoft(scr, ("나가기", "종료"))
            if not leave:
                self.voice_minimize(scr)                          # 열어 둔 보이스룸 화면은 접어 둔다
                self.save_diag(scr)
                raise KakaoError("나가기 단추를 찾지 못함" + self.diag_note())
            self.tap(leave)
            conf = self.wait_change(scr, tries=3)
            self.snap("나가기를 누른 뒤", conf, scr)
            yes = self.vpick(conf, self.VOICE_END_OK, scr)
            if yes:
                self.tap(yes)
                self.wait_change(conf, tries=3)
            for _ in range(4):
                self.sleep(2)
                if voice_state(self.voice_signals(), v)[0] != "on":
                    return True
            self.save_diag()
            raise KakaoError("끝내기를 눌렀는데 아직 켜져 있음" + self.diag_note())
        finally:
            self.done()

    def voice_look(self, room, v=None):
        """알릴 방의 보이스룸 띠와 보이스룸 화면의 단추 이름을 적는다(갱신이 안 될 때 원인 찾기, 켜진 채로).
        나가기, 종료는 누르지 않고 마지막에 작게 접는다. 대화 글, 닉네임, 남의 알림은 적지 않는다:
        글은 띠 자리나 보이스룸 화면의 보이스룸 글자, 제목, 'N명 참여' 만 그대로, 단추는 짧은 이름만, 나머지는 글자 수만"""
        v = v or {}
        out = ["# 보이스룸 화면 살피기 " + time.strftime("%Y-%m-%d %H:%M"), ""]
        out += voice_status_lines(self.voice_signals(), {}, v) + [""]

        def row(n, show=False, where="", chat=False):
            btn = (n["click"] or re.search(r"Button|ImageView", n["cls"]) is not None) and not chat   # 목록 안(말풍선, 채팅 목록 줄)은 짧아도 글을 적지 않는다
            t, d = ws(n["text"]), ws(n["desc"])
            if not (show and self.voice_mark(n, v)) or chat:
                t = t if btn and len(t) <= 12 else ("(글 %d자)" % len(t) if t else "")
                d = d if btn and len(d) <= 16 else ("(이름 %d자)" % len(d) if d else "")
            return "%s%s|%s|%s|%s|%s|[%d,%d][%d,%d]" % (where, n["cls"].split(".")[-1], t[:60], d[:60], n["rid"].split("/")[-1], "누름" if n["click"] else "", *n["b"])

        def take(label, nodes, only=None, show=None, where=None):
            inl = self.in_lists(nodes)
            rs = [row(n, bool(show and show(n)), where(n) if where else "", n["i"] in inl) for n in nodes if (n["text"] or n["desc"] or n["click"]) and (only is None or only(n))]
            out.extend(["== %s (%d)" % (label, len(rs))] + rs[:80] + [""])
        self.new_trace()
        try:
            nodes = self.open_room(room)
            area = self.room_top(nodes)
            inlist = self.in_lists(nodes)
            top = (lambda n: self.center(n)[0] >= area[0] and n["b"][1] < area[1] and n["i"] not in inlist) if area else (lambda n: False)
            if area:
                take("1 방 위쪽(방 칸, 입력 칸 위 3할, 대화 목록 밖)", nodes, top, show=top)
            spot = lambda n: ("목록|" if area and self.center(n)[0] < area[0] else "방 위쪽|" if top(n) else "대화 칸|")
            take("2 화면 전체에서 보이스룸 글자, 제목, 'N명 참여' 가 든 것(자리만, 글은 띠 자리만)", nodes, lambda n: self.voice_mark(n, v), show=top, where=spot)
            band = self.voice_band(nodes, v)
            scr, ok = nodes, False
            if band:
                out += ["띠로 고른 것: " + row(band, True), ""]
                self.tap(band)
                scr = self.wait_change(nodes, tries=3)
                ok = self.voice_screen(scr, v)
                voice_like = not find(scr, cls="EditText")
                seen = {(n["b"], n["text"], n["desc"]) for n in nodes}
                take("3 띠를 누른 뒤(새로 나온 것)", scr, lambda n: (n["b"], n["text"], n["desc"]) not in seen, show=lambda n: voice_like)
                if not ok and not find(scr, cls="EditText"):
                    self.key(4)
            else:
                out += ["띠: 방 위쪽에서 찾지 못함", ""]
            if not ok:
                got = self.voice_from_shade(v)
                out.append("== 4 알림 창: 보이스룸 참여 중 알림 %d개%s" % (self.shade_hit_n, "" if self.shade_hit_n else "(없으면 카카오톡 알림 설정을 보세요)"))
                out.append("")
                if got is not None:
                    scr = got
                    ok = self.voice_screen(scr, v)
                    take("5 알림을 누른 뒤", scr, show=lambda n: not find(scr, cls="EditText"))
            out.append("보이스룸 화면으로 봄: " + ("예" if ok else "아니요"))
            if ok:
                leave = self.vpick(scr, self.VOICE_LEAVE) or self.vsoft(scr, ("나가기", "종료"))
                mn = self.vpick(scr, self.VOICE_MIN)
                out.append("나가기로 고를 단추(누르지 않음): " + (row(leave, True) if leave else "없음"))
                out.append("작게 접기: " + (row(mn, True) if mn else "단추 없음, 뒤로 가기"))
                self.voice_minimize(scr)
            out += ["", "## 끝난 뒤"] + voice_status_lines(self.voice_signals(), {}, v)
        finally:
            self.done()
        return "\n".join(out)

    def done(self):
        """올리고 나면 Termux 를 앞으로(기록이 보이게, 다음 명령을 치게). return_to 를 "" 로 두면 카카오톡에 머문다"""
        app = self.t.get("return_to") or ""
        if app:
            try:
                self.start_app(app)
            except KakaoError:
                pass

    def check(self):
        out = ["adb 연결: 됨(%s)" % self.device()]
        try:
            out.append("기기: %s, 안드로이드 SDK %s" % (self.sh("getprop ro.product.model").strip(), self.sh("getprop ro.build.version.sdk").strip()))
        except KakaoError:
            pass
        try:
            out.append("카카오톡: " + ("있음" if "package:" in self.sh("pm path %s" % self.t["package"]) else "찾지 못함"))
        except KakaoError:
            out.append("카카오톡: 찾지 못함(%s)" % self.t["package"])
        for key, what in (("settings_enable_monitor_phantom_procs", "Termux 강제 종료 막기"),):
            try:
                v = self.sh("settings get global %s" % key).strip()
                ok = v == "false" if key.startswith("settings_") else v not in ("", "0", "null")
                out.append("%s: %s" % (what, "됨" if ok else "안 됨(python excer_bot.py connect 포트 로 다시 설정)"))
            except KakaoError:
                pass
        try:
            self.set_clip("excer-bot")
            out.append("클립보드: 됨")
        except KakaoError as e:
            out.append("클립보드: 안 됨(%s)" % e)
        try:
            n = len(self.dump())
            out.append("화면 읽기: 됨(요소 %d개, %s)" % (n, "빠른 방식" if self.fast else "기본 방식: 글이 빨리 올라오는 방에서는 느릴 수 있음"))
        except KakaoError as e:
            out.append("화면 읽기: 안 됨(%s)" % e)
        try:
            want = self.rot_want()
            out.append("화면 방향: %s. %s" % (self.rot_text(), "봇이 %s로 고정함(python excer_bot.py rotate)" % ROT_NAME[want] if want != "off" else "봇이 건드리지 않음"))
        except KakaoError:
            pass
        return out

    @staticmethod
    def rows(nodes):
        return ["%s | 글자=%s | 이름=%s | id=%s | 누름=%s | %s | %s" % (n["cls"].split(".")[-1], n["text"][:60].replace("\n", " / "), n["desc"][:80].replace("\n", " / "), n["rid"],
                "예" if n["click"] else "", "[%d,%d][%d,%d]" % n["b"], n.get("pkg", "")) for n in nodes
                if n["text"] or n["desc"] or n["rid"] or n["click"] or n["cls"].endswith("EditText")]

    def dump_file(self, path, nodes=None, head=False, fail=None):
        """지금 화면을 파일에. head: 맨 위에 판과 창 목록(ui), 안 됐으면 그 까닭과 지나온 화면도 아래에(한 파일로 보내게)"""
        rows = self.rows(self.dump() if nodes is None else nodes)
        out = rows
        if head:
            out = self.diag_head(fail) + ["", "== 지금 화면 (%d줄)" % len(rows)] + rows
            if fail is not None:
                for label, tr in self.trace:
                    out += ["", "== %s (%d줄)" % (label, len(tr))] + tr
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(out))
        return len(rows)

    def snap(self, label, nodes, before=None):
        """지나온 화면 한 장. before 를 주면 그때 없던 요소만(메뉴, 확인 창)"""
        if before is not None:
            seen = {(n["b"], n["text"], n["desc"]) for n in before}
            nodes = [n for n in nodes if (n["b"], n["text"], n["desc"]) not in seen]
        self.trace = (self.trace + [(label, self.rows(nodes)[:120])])[-8:]

    def brief(self, label, nodes, room=""):
        """지나온 화면을 한 줄로(무엇이 떠 있었는지만. 이름과 대화 글은 적지 않는다)"""
        sh = self.shape_of(nodes)
        parts = ["카카오톡" if self.on_kakao(nodes) else "다른 앱(%s)" % (nodes[0].get("pkg") if nodes else "?"),
                 "%dx%d %s" % (sh[2], sh[3], ROT_NAME[sh[0]]) if sh else "작은 창",
                 "입력 칸 있음" if find(nodes, cls="EditText") else "입력 칸 없음",
                 "채팅 단추 있음" if self.chat_tab(nodes) else "채팅 단추 없음"]
        if room:
            parts.append("방 이름 보임" if any(same_room(n["text"], room) for n in nodes) else "방 이름 안 보임")
        if self.voice_mini(nodes):
            parts.append("보이스룸 작은 창")
        if self.voice_front(nodes):
            parts.append("보이스룸 화면")
        nav = self.chat_nav(nodes)
        menu = ("채팅 메뉴 %s(%s)" % ("아래" if self.center(nav)[1] > self.head_band(nodes) * 5 else "옆", "이름" if nav["desc"] else "글자")
                if nav else "채팅 머리만" if self.chat_head(nodes) else "채팅 메뉴 없음")
        line = ", ".join(parts) + ", 요소 %d개, %s" % (len(nodes), menu)
        mf = self.mini_fact(nodes)
        if mf:
            line += ", " + mf
        wt = self.win_text()
        self.trace = (self.trace + [(label, [line] + ([wt] if wt else []))])[-8:]

    def diag_head(self, fail=None):
        """진단 파일 맨 위 줄들: 판과 화면, 때, 읽는 방식, 창 목록, 실패(종류와 글 앞부분), 지나온 곳"""
        head = "# 판 %s, 화면 %s, %s, %s, 창 목록 %s" % (
            VERSION, "%dx%d %s" % (self.shape[2], self.shape[3], ROT_NAME[self.shape[0]]) if getattr(self, "shape", None) else "모름",
            time.strftime("%m-%d %H:%M:%S"), {True: "읽기 도우미", False: "기본"}.get(getattr(self, "fast", None), "읽기 모름"),
            "있음" if getattr(self, "windows", None) else "없음")
        if fail is not None:
            head += ", 실패 %s: %s" % (type(fail).__name__, ws(str(fail))[:120])
        out = [head]
        wt = self.win_text()
        out += ["# " + wt] if wt else []
        facts = getattr(self, "facts", None)
        if facts:
            out.append("# 지나온 곳: " + ", ".join(facts))
        return out

    def save_diag(self, nodes=None, fail=None):
        if not self.diag_path:
            return
        if nodes is not None:
            self.snap("마지막 화면", nodes)
        out = self.diag_head(fail) + [""]
        for label, rows in self.trace:
            out += ["== %s (%d줄)" % (label, len(rows))] + rows + [""]
        try:
            with open(self.diag_path, "w", encoding="utf-8") as f:
                f.write("\n".join(out))
        except OSError:
            pass


# ── 카카오톡 조작: 안드로이드 폰, 태블릿(uiautomator2) ──
class AndroidSender:
    def __init__(self, cfg, log, device=None):
        if device is None:
            import uiautomator2 as u2                    # pip install uiautomator2
            device = u2.connect(cfg["android"].get("serial") or None)
        self.d, self.cfg, self.log, self.pkg, self.sleep = device, cfg, log, cfg["android"]["package"], time.sleep

    def _list_visible(self):
        d = self.d
        return d(description="채팅").exists or d(text="채팅").exists

    def _room_item(self, room):
        d = self.d
        for sel in (dict(text=room), dict(textStartsWith=room[:12])):
            o = d(**sel)
            if o.exists:
                return o
        return None

    def open_room(self, room):
        """방은 늘 채팅 목록에서 눌러 연다. 태블릿은 목록과 방이 한 화면이라 다른 방이 열려 있어도 이 방으로 바뀐다"""
        d = self.d
        d.screen_on()
        d.app_start(self.pkg)
        self.sleep(1.5)
        for _ in range(5):                                  # 폰은 방 안에 있으면 뒤로 가서 목록으로
            if self._list_visible():
                break
            d.press("back")
            self.sleep(0.6)
        else:
            raise KakaoError("카카오톡 채팅 목록 화면으로 가지 못함")
        for sel in (dict(description="채팅"), dict(text="채팅")):
            if d(**sel).click_exists(timeout=1):
                break
        self.sleep(0.8)
        item = self._room_item(room)
        if not item:
            d(text="오픈채팅").click_exists(timeout=1)    # 채팅과 오픈채팅이 나뉜 판
            self.sleep(0.8)
            item = self._room_item(room)
        if not item:
            try:
                d(scrollable=True).scroll.to(text=room)
            except Exception:
                pass
            item = self._room_item(room)
        if not item:
            raise KakaoError("채팅 목록에서 '%s' 방을 찾지 못함" % room)
        item.click()
        if not d(className="android.widget.EditText").wait(timeout=5):
            raise KakaoError("방은 열었는데 입력 칸이 없음")
        self.sleep(0.6)

    def send(self, room, text):
        self.open_room(room)
        d = self.d
        box = d(className="android.widget.EditText")
        box.click()
        box.set_text(text)
        self.sleep(0.5)
        for sel in (dict(description="전송"), dict(text="전송"), dict(resourceIdMatches=r".*:id/send.*")):
            if d(**sel).click_exists(timeout=1):
                self.sleep(1.5)
                return
        raise KakaoError("전송 단추를 찾지 못함")

    def bubble(self, text):
        """방금 보낸 목록 말풍선. 채팅 목록의 미리보기(한 줄)와 위쪽 공지 띠는 빼고, 글 전체가 같은 것 중 가장 아래"""
        d = self.d
        want = text.strip()
        sel = d(textContains=want.split("\n")[0])
        if not sel.wait(timeout=5):
            raise KakaoError("보낸 목록을 화면에서 찾지 못함")
        best = None
        for i in range(sel.count):
            el = sel[i]
            try:
                info = el.info
            except Exception:
                continue
            t = (info.get("text") or "").strip()
            score = (t == want, t.count("\n"), (info.get("bounds") or {}).get("bottom", 0))
            if best is None or score > best[0]:
                best = (score, el)
        if not best or (not best[0][0] and best[0][1] < want.count("\n")):
            raise KakaoError("보낸 목록 말풍선을 찾지 못함(미리보기 줄만 보임)")
        return best[1]

    def notice(self, room, text):
        d = self.d
        self.sleep(1.0)
        self.bubble(text).long_click(duration=1.0)
        if not d(text="공지").click_exists(timeout=3):
            d.press("back")
            raise KakaoError("메뉴에 '공지'가 없음(봇 계정이 이 방의 부방장인지 확인)")
        self.sleep(0.8)
        for t in ("확인", "등록", "공지 등록"):
            if d(text=t).click_exists(timeout=1.5):
                break

    def check(self):
        d, out = self.d, []
        i = d.info
        out.append("기기 연결: 됨(%s, 화면 %sx%s, 화면 켜짐 %s)" % (i.get("productName", "?"), i.get("displayWidth", "?"), i.get("displayHeight", "?"), "예" if i.get("screenOn") else "아니오"))
        try:
            d.app_info(self.pkg)
            out.append("카카오톡: 있음")
        except Exception:
            out.append("카카오톡: 찾지 못함(%s)" % self.pkg)
        try:
            out.append("지금 앞에 뜬 앱: %s" % (d.app_current() or {}).get("package", "?"))
        except Exception:
            pass
        return out

    def dump(self, path):
        import xml.etree.ElementTree as ET
        root = ET.fromstring(self.d.dump_hierarchy())
        rows = []
        for n in root.iter("node"):
            a = n.attrib
            if a.get("text") or a.get("content-desc") or a.get("resource-id"):
                rows.append("%s | 글자=%s | 이름=%s | id=%s | 누름=%s | %s" % (a.get("class", "").split(".")[-1], a.get("text", "")[:60].replace("\n", " / "),
                            a.get("content-desc", ""), a.get("resource-id", ""), a.get("clickable", ""), a.get("bounds", "")))
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(rows))
        return len(rows)


def make_sender(cfg, log):
    b = cfg.get("backend", "tablet")
    if b == "dry":
        return DrySender()
    if b == "tablet":
        return AdbSender(cfg, log)
    if b == "android":
        return AndroidSender(cfg, log)
    if b == "pc":
        if os.name != "nt":
            raise SystemExit("pc 방식은 윈도우에서만 됩니다. excer_bot.json 의 backend 를 android 나 dry 로 바꾸세요.")
        return PcSender(cfg, log)
    raise SystemExit("backend 는 tablet, android, pc, dry 중 하나")


# ── 명령 ──
def cmd_setup(cfg, cfg_path, ask=input, tab=None):
    print("excer-bot 설정. 비워 두고 엔터를 누르면 [ ] 안의 값을 씁니다.")
    b = ask("방식 tablet(태블릿 하나로) / android(PC 에 연결한 기기) / pc(윈도우 PC 카카오톡) / dry(시험) [%s]: " % cfg["backend"]).strip() or cfg["backend"]
    cfg["backend"] = b
    rooms = []
    if b == "tablet":
        print("카카오톡 채팅 목록에서 방 이름을 읽습니다(카카오톡이 잠깐 앞으로 나옵니다).")
        try:
            tab = tab or AdbSender(cfg, print)
            try:
                rooms = tab.room_names()
            finally:
                tab.done()
        except Exception as e:
            print("방 이름을 읽지 못함:", e, "(방 이름을 직접 넣거나 connect 부터 하세요)")
        if rooms:
            print("채팅 목록에 보이는 방:")
            for i, t in enumerate(rooms, 1):
                print("  %d. %s" % (i, t))
    if b == "pc" and os.name == "nt":
        try:
            rooms = [t for _, t in PcSender(cfg, print).kakao_windows() if t != "카카오톡"]
        except Exception as e:
            print("카카오톡 창 목록을 읽지 못함:", e)
        if rooms:
            print("열려 있는 카카오톡 방 창:")
            for i, t in enumerate(rooms, 1):
                print("  %d. %s" % (i, t))

    def pick(label, cur):
        v = ask("%s(번호나 이름) [%s]: " % (label, cur)).strip()
        if v.isdigit() and rooms and 1 <= int(v) <= len(rooms):
            return rooms[int(v) - 1]
        return v or cur
    cfg["room"] = pick("알릴 방", cfg["room"])
    cfg["test_room"] = pick("시험 방(봇 계정과 나만 있는 방)", cfg["test_room"])
    v = ask("목록을 공지로 걸까요 y/n [%s]: " % ("y" if cfg["notice"] else "n")).strip().lower()
    if v in ("y", "n"):
        cfg["notice"] = v == "y"
    save_cfg(cfg_path, cfg)
    print("저장했습니다:", cfg_path)
    print("다음: python excer_bot.py check 로 연결 확인" + (", calibrate 로 공지 자리 잡기" if b == "pc" and cfg["notice"] else "") + ", test, run --test, 그다음 run.")


def cmd_feed(path, op):
    """시험 파일 고치기: add(새 벙), change(마지막 벙 시간 한 시간 뒤로), close(마지막 벙 마감), del(마지막 벙 지우기),
    soon(3분 뒤 시작하는 벙), full(마지막 벙 정원 채우기), deadline(마지막 벙 2분 뒤 신청 마감)"""
    if op not in ("add", "change", "close", "del", "soon", "full", "deadline"):
        raise SystemExit("python excer_bot.py feed add | change | close | del | soon | full | deadline")
    try:
        with open(path, encoding="utf-8-sig") as f:
            rows = json.load(f)
    except (OSError, ValueError):
        raise SystemExit("시험 파일이 없음. 먼저 python excer_bot.py sample-feed")
    now = datetime.now(KST)
    if op == "soon":                                    # 3분 뒤 시작, 6분 뒤 끝: 오늘 벙이면 공지 카드에 들어가고, 시작과 끝에는 공지 글이 그대로인지 본다
        n = max([r.get("id", 900000) for r in rows] + [900000]) + 1
        at, till = now + timedelta(minutes=3), now + timedelta(minutes=6)
        rows.append({"id": n, "title": "곧 시작 시험 벙 %d" % (n - 900000), "author": "시험", "created_at": now.strftime("%Y-%m-%dT%H:%M:%S+09:00"),
                     "meta": {"kind": "bung", "date": at.strftime("%Y-%m-%d"), "time": at.strftime("%H:%M"), "end": till.strftime("%H:%M"), "place": "시험 장소", "cap": 4}})
        save_json(path, rows)
        print("고쳤습니다: %s 에 시작해 %s 에 끝나는 벙. 20초 안에 새 벙 알림과 공지 카드가 올라오고, 시작과 끝에는 공지 글이 그대로입니다." % (at.strftime("%H:%M"), till.strftime("%H:%M")))
        return
    if op == "add":
        n = max([r.get("id", 900000) for r in rows] + [900000]) + 1
        rows.append({"id": n, "title": "시험 벙 %d" % (n - 900000), "author": "시험", "created_at": now.strftime("%Y-%m-%dT%H:%M:%S+09:00"),
                     "meta": {"kind": "bung", "date": (now + timedelta(days=1 + (n - 900000) % 5)).strftime("%Y-%m-%d"), "time": "19:00", "end": "21:00", "place": "시험 장소 %d" % (n - 900000), "cap": 6}})
        what = "새 벙: " + rows[-1]["title"]
    else:
        full = lambda r: (r.get("attend_count") or 0) >= int((r.get("meta") or {}).get("cap") or 0) > 0
        live = [r for r in rows if (r.get("meta") or {}).get("status") != "closed" and not full(r)]
        if not live:
            raise SystemExit("고칠 벙이 없음. feed add 부터")
        r = live[-1]
        if op == "change":
            h = int(((r.get("meta") or {}).get("time") or "18:00")[:2])
            r.setdefault("meta", {})["time"] = "%02d:00" % ((h + 1) % 24)
            what = "%s 시간을 %s 로" % (r["title"], r["meta"]["time"])
        elif op == "full":                               # 정원을 채운다(오늘 벙이면 카드가 '마감' 줄로 옮겨 가는지)
            cap = int((r.get("meta") or {}).get("cap") or 4)
            r.setdefault("meta", {})["cap"] = cap
            r["attend_count"] = cap
            what = "%s 정원 %d명 다 참" % (r["title"], cap)
        elif op == "deadline":                           # 2분 뒤 신청 마감(카드에 '신청 HH:MM까지' 가 붙고, 그 시각이 지나도 공지 글은 그대로인지)
            at = now + timedelta(minutes=2)
            r.setdefault("meta", {})["deadline"] = at.strftime("%Y-%m-%dT%H:%M")
            what = "%s 신청 마감 %s" % (r["title"], at.strftime("%H:%M"))
        elif op == "close":
            r.setdefault("meta", {})["status"] = "closed"
            what = "%s 마감" % r["title"]
        else:
            rows.remove(r)
            what = "%s 지움(취소)" % r["title"]
    save_json(path, rows)
    print("고쳤습니다: %s. 20초 안에 시험 방에 올라옵니다(한 번 올린 뒤 1분 안이면 1분 뒤)." % what)


def main(argv=None):
    ap = argparse.ArgumentParser(description="사이트의 벙 일정을 늘 지켜보다가 오픈채팅방에 올리고 공지로 건다")
    ap.add_argument("command", choices=["setup", "connect", "check", "status", "update", "quiet", "reset", "list", "test", "run", "once", "sample-feed", "feed", "ui", "study", "calibrate", "voice", "members", "rotate"])
    ap.add_argument("arg", nargs="?", default="", help="connect: 무선 디버깅 포트, feed: add, change, close, del, soon, full, deadline, voice: study, status, raw, now, look, on, off, quiet: 00:30-07:30 또는 off, members: push, study, key, at, rotate: 가로, 세로, off")
    ap.add_argument("arg2", nargs="?", default="", help="members key: 봇 열쇠(없으면 클립보드), members at: 05:10 또는 off")
    ap.add_argument("--config", default=os.path.join(HERE, "excer_bot.json"))
    ap.add_argument("--test", action="store_true", help="run, once, reset: 알릴 방 대신 시험 방으로(기록도 따로)")
    ap.add_argument("--feed", default="", help="사이트 대신 이 파일의 글을 읽는다(시험용, sample-feed 로 만든다)")
    a = ap.parse_args(argv)
    cfg = load_cfg(a.config)
    base = os.path.splitext(a.config)[0]
    log = Log(base + ".log")
    AdbSender.diag_path = base + "_ui.txt"
    if a.command == "setup":
        return cmd_setup(cfg, a.config)
    if a.command == "status":                          # 기기를 건드리지 않고 파일만 본다. run 이 도는 동안 다른 창에서 쳐도 된다
        for l in status_lines(base):
            print(l)
        ver, _ = remote_version()
        print("저장소의 판: %s%s" % (ver or "읽지 못함", "" if not ver or ver == VERSION else " (새 판이 있습니다: Ctrl+C 로 run 을 멈추고 python excer_bot.py update)"))
        return
    if a.command == "update":
        print(cmd_update(base))
        return
    if a.command == "quiet":                           # 이 사이에는 방에 올리지 않는다(새벽에 올라온 글은 끝나는 시각에 한꺼번에). run 을 다시 켜야 적용된다
        print(cmd_quiet(cfg, a.config, a.arg))
        return
    if a.command == "reset":                           # 본 글 기록을 비운다(사이트 글을 한꺼번에 옮기거나 지운 뒤). run 을 먼저 멈춘다
        print(cmd_reset(base, base + ("_feed_state.json" if a.feed else "_test_state.json" if a.test else "_state.json")))
        return
    if a.command == "connect":
        port = a.arg
        if not re.match(r"^(\d{1,5}|[\w.-]+:\d{1,5})$", port):
            finder = AdbSender(cfg, log)                  # 포트를 안 적었으면(또는 '포트' 라고 적었으면) 스스로 찾아 본다
            print("무선 디버깅 포트를 찾는 중(몇 초)")
            port = finder.mdns_port() or finder.scan_port()
            if port:
                print("무선 디버깅 포트를 찾았습니다: %s" % port)
            else:
                raise SystemExit("찾지 못했습니다. 무선 디버깅이 켜져 있는지 보고(설정 > 개발자 옵션 > 무선 디버깅) 다시 python excer_bot.py connect\n"
                                 "그래도 안 되면 숫자를 직접: python excer_bot.py connect 포트   예: python excer_bot.py connect 37581\n"
                                 "포트는 숫자이고 기기마다 다릅니다. 무선 디버깅 글자를 눌러 들어간 화면의 'IP 주소 및 포트' 가 192.168.0.12:37581 이면 37581.\n"
                                 "페어링 창의 포트가 아닙니다. 무선 디버깅을 껐다 켜거나 재부팅하면 숫자가 바뀝니다.")
        conn = AdbSender(cfg, log)
        serial, done = conn.connect(port)
        cfg["tablet"]["serial"] = serial                   # 이 기기로 정해 둔다(같은 기기가 다른 이름으로 하나 더 보여도 헷갈리지 않게)
        save_cfg(a.config, cfg)
        print("붙었습니다: %s%s" % (serial, (", 설정함: " + ", ".join(done)) if done else ""))
        if conn.pending_auth:
            print("태블릿 화면에 'USB 디버깅을 허용하시겠습니까?' 창이 떴으면 '이 컴퓨터에서 항상 허용' 을 켜고 허용을 누른 뒤 python excer_bot.py connect 를 한 번 더 치세요."
                  " 그러면 무선 디버깅이 저절로 꺼져도 붙는 고정 포트(%d)가 됩니다(재부팅 전까지)." % AdbSender.FIXED)
        return
    if a.command == "feed":
        return cmd_feed(a.feed or base + "_feed.json", a.arg)
    if a.command == "sample-feed":
        path = a.feed or base + "_feed.json"
        today = datetime.now(KST)
        rows = [{"id": 900001, "title": "시험 벙", "author": "시험", "created_at": today.strftime("%Y-%m-%dT%H:%M:%S+09:00"),
                 "meta": {"kind": "bung", "date": (today + timedelta(days=1)).strftime("%Y-%m-%d"), "time": "19:00", "end": "21:00", "place": "시험 장소", "cap": 4}}]
        save_json(path, rows)
        print("만들었습니다:", path)
        print("python excer_bot.py run --test --feed %s 로 켠 뒤, 다른 창에서 python excer_bot.py feed add (또는 change, close, del, soon, full, deadline) 를 치면 20초 안에 시험 방에 올라옵니다." % os.path.basename(path))
        return
    site = FileSite(a.feed) if a.feed else Site(cfg)
    now = lambda: Now(datetime.now(KST))
    if a.command == "list":
        print(notice_text(site.posts(), now(), cfg))
        return
    if a.command == "check":
        print("봇 파일 판: %s" % VERSION)
        try:
            ps = site.posts()
            print("사이트: 오늘 이후 모임 모집 글 %d개 읽음, 모집 중인 벙 %d개" % (len(ps), sum(1 for v in ps if recruiting(v, now()))))
        except Exception as e:
            print("사이트: 읽지 못함(%s)" % e)
        print("방식: %s, 알릴 방: %s, 시험 방: %s, 공지: %s" % (cfg["backend"], cfg["room"] or "(없음)", cfg["test_room"] or "(없음)", "건다" if cfg.get("notice") else "안 건다"))
        try:
            for l in make_sender(cfg, log).check():
                print(l)
        except SystemExit as e:
            print(e)
        except Exception as e:
            print("카카오톡 쪽: 확인하지 못함(%s)" % e)
        return
    if a.command == "study":
        room = cfg.get("test_room") or ""
        if not room:
            raise SystemExit("excer_bot.json 의 test_room(시험 방)을 먼저 넣으세요(setup).")
        sender = make_sender(cfg, log)
        if not isinstance(sender, AdbSender):
            raise SystemExit("study 는 tablet 방식에서 씁니다.")
        ans = input("시험 방 '%s' 에서 화면을 적고, 톡게시판으로 시험 공지를 한 번 실제로 걸어 봅니다. 시작할까요? y/n [y]: " % room).strip().lower()
        if ans not in ("", "y", "yes", "ㅛ"):
            print("그만둡니다.")
            return
        print("1~2분 걸립니다. 끝날 때까지 태블릿을 만지지 마세요.")
        try:
            txt = sender.study(room)
        finally:
            sender.done()
        path = base + "_study.txt"
        with open(path, "w", encoding="utf-8") as f:
            f.write(txt)
        try:
            sender.set_clip(txt)
            print("다 적었습니다(%s). 클립보드에도 담았으니 대화창에 붙여넣어 보내 주세요." % os.path.basename(path))
        except KakaoError:
            print("다 적었습니다: %s (cat 으로 보세요)" % path)
        return
    if a.command == "members":                         # 봇 멤버 자동 갱신: 지금 읽기, 올리기, 화면 살피기, 열쇠, 매일 시각
        return cmd_members(cfg, a, base, log)
    if a.command == "rotate":                          # 화면 방향 고정: 가로, 세로, off. 바로 고정하고 run 은 카카오톡을 띄울 때마다 다시 맞춘다
        print(cmd_rotate(cfg, a.config, a.arg, log))
        return
    if a.command == "voice":
        return cmd_voice(cfg, a, base, log)
    if a.command == "ui":
        sender = make_sender(cfg, log)
        if isinstance(sender, AdbSender):
            err = None
            try:                                        # 시험 방을 연 화면을 적는다(다른 방 대화가 들어가지 않게)
                try:
                    if cfg.get("test_room"):
                        sender.open_room(cfg["test_room"])
                    else:
                        sender.goto_list()
                except KakaoError as e:                 # 못 가도 지금 화면은 적는다(원인 찾기용. 지나온 화면도 같은 파일 아래에)
                    err = e
                n = sender.dump_file(base + "_ui.txt", head=True, fail=err)
            finally:
                sender.done()
            if err:
                print("안 됨:", err)
            print(sender.win_text() or "창: 창 목록 없음" + ("" if sender.fast else "(기본 방식으로 읽음)"))
        elif isinstance(sender, AndroidSender):
            n = sender.dump(base + "_ui.txt")
        else:
            raise SystemExit("ui 는 tablet, android 방식에서 씁니다.")
        print("화면 요소 %d개를 %s 에 적었습니다." % (n, base + "_ui.txt"))
        return
    if a.command in ("calibrate", "test"):
        room = cfg.get("test_room") or ""
        if not room:
            raise SystemExit("excer_bot.json 의 test_room(시험 방)을 먼저 넣으세요(setup).")
        sender = make_sender(cfg, log)
        text = notice_text(site.posts(), now(), cfg)
        if a.command == "calibrate":
            if not isinstance(sender, PcSender):
                raise SystemExit("calibrate 는 pc 방식에서만 필요합니다.")
            cfg["pc"] = sender.calibrate(room, text)
            save_cfg(a.config, cfg)
            print("저장했습니다. python excer_bot.py test 로 확인하세요.")
            return
        try:
            sender.send(room, text)
            log("시험 방에 보냄")
            if cfg.get("notice"):
                sender.notice(room, text)
                log("시험 방에 공지를 걸었음. 방 위쪽 공지를 확인하세요.")
        finally:
            if hasattr(sender, "done"):
                sender.done()
        return
    room = cfg.get("test_room") if a.test else cfg.get("room")
    if not room:
        raise SystemExit("excer_bot.json 의 %s 을 먼저 넣으세요(setup)." % ("test_room(시험 방)" if a.test else "room(알릴 방)"))
    # 기록은 따로: 시험 파일(--feed), 시험 방(--test), 알릴 방. 시험 파일로 흉내 낸 것이 실제 시험에 섞이지 않게
    state_path = base + ("_feed_state.json" if a.feed else "_test_state.json" if a.test else "_state.json")
    bot = Bot(cfg, make_sender(cfg, log), site, state_path, log, room=room)
    if isinstance(bot.sender, AdbSender):              # 켤 때 adb 가 안 붙어 있으면 바로 말한다(재부팅 뒤 무선 디버깅이 꺼진 채 켜는 일)
        try:
            bot.sender.device()
        except KakaoError as e:
            log("adb 가 안 붙음: %s. 사이트는 지켜보지만 붙을 때까지 올리지 못한다" % e)
    if a.command == "once":
        log("한 번 봄: " + bot.cycle())
        return
    if run_alive(base):                                 # 다른 창에서 이미 도는 봇이 있으면 켜지 않는다(둘이 같은 화면을 번갈아 누르고 같은 글을 두 번 올림)
        raise SystemExit("이미 run 이 돌고 있습니다. 그 창을 그대로 두세요. 상태는 python excer_bot.py status")
    log("켬(판 %s): %s 방%s, %s 방식, %d초마다 %s 확인" % (VERSION, room, "(시험)" if a.test else "", cfg["backend"], int(cfg.get("check_sec", 20)), "시험 파일" if a.feed else "사이트"))
    if isinstance(bot.sender, AdbSender):
        try:                                            # 화면 방향을 켤 때 바로 고정(그 뒤로는 카카오톡을 띄울 때마다 다시 맞춘다)
            line = rot_start_line(bot.sender)
            if line:
                log(line)
        except KakaoError:
            pass
    voice = None
    if (cfg.get("voice") or {}).get("on"):
        if isinstance(bot.sender, AdbSender):
            voice = VoiceWatch(cfg, bot.sender, base + "_voice.json", log)
            log("보이스룸 지키기: %d초마다 보고, 끊기면 %s(방: %s, 제목: %s)" % (max(15, int(voice.v.get("check_sec") or 60)), "다시 켠다" if voice.can_recover() else "기록만", voice.room, voice.v.get("title") or DEFAULTS["voice"]["title"]))
        else:
            log("보이스룸 지키기는 tablet 방식에서만 돈다")
    wake_lock(True)                                     # Termux 가 잠들지 않게(태블릿일 때만 있는 명령)
    try:
        run_loop(bot, log, voice, base + "_alive.json")
    finally:
        wake_lock(False)


def rot_start_line(s):
    """run 을 켤 때 화면 방향을 고정하고 남길 한 줄(rotation off 면 '')"""
    if s.rot_want() == "off":
        return ""
    what = s.lock_rotation()
    if s.rot_state == "unknown":
        return "화면 방향: 이 기기의 회전 값을 읽지 못해 그대로 둠"
    if s.rot_state == "failed":
        return "화면 방향: " + what
    return "화면 방향: %s로 고정%s" % (ROT_NAME[s.rot_want()], "(%s)" % what if what else "")


def cmd_rotate(cfg, path, arg, log, sender=None):
    """rotate [가로|세로|off]: 정한 방향을 저장하고 바로 고정한다. 아무것도 안 적으면 지금 방향을 보이고 저장된 방향으로 고정"""
    arg = (arg or "").strip().lower()
    if arg and arg not in ROT_WORDS:
        return "python excer_bot.py rotate 가로 | 세로 | off"
    if arg:
        cfg.setdefault("tablet", {})["rotation"] = ROT_WORDS[arg]
        save_cfg(path, cfg)
    saved = "저장했습니다. " if arg else ""
    if cfg.get("backend", "tablet") != "tablet":
        return saved + "화면 방향 고정은 tablet 방식에서 씁니다"
    s = sender or AdbSender(cfg, log)
    try:
        if s.rot_want() == "off":
            s.rot_unlock()
            return "화면 방향을 봇이 건드리지 않습니다. 지금: %s" % s.rot_text()
        what = s.lock_rotation()
        name = ROT_NAME[s.rot_want()]
        if s.rot_state == "unknown":
            return "이 기기의 회전 값을 읽지 못해 고정하지 못했습니다. 지금: %s" % s.rot_text()
        if s.rot_state == "failed":
            return "%s로 바꾸지 못했습니다. 지금: %s" % (name, s.rot_text())
        return "%s로 고정했습니다%s. 지금: %s. run 은 카카오톡을 띄울 때마다 다시 맞춥니다" % (name, "(%s)" % what if what else "", s.rot_text())
    except KakaoError as e:
        return saved + "지금 고정하지는 못했습니다(%s). run 이 카카오톡을 띄울 때 고정합니다" % e


def cmd_voice(cfg, a, base, log):
    sub = a.arg
    if sub in ("on", "off"):
        cfg.setdefault("voice", {})["on"] = sub == "on"
        save_cfg(a.config, cfg)
        title = cfg["voice"].get("title") or DEFAULTS["voice"]["title"]
        print("보이스룸 지키기: " + ("켬. run 이 끊김을 알아채 다시 켭니다. 만들 때 제목: " + title if sub == "on" else "끔"))
        return
    if sub not in ("study", "status", "raw", "now", "look"):
        raise SystemExit("python excer_bot.py voice study | status | raw | now | look | on | off")
    sender = make_sender(cfg, log)
    if not isinstance(sender, AdbSender):
        raise SystemExit("voice 는 tablet 방식에서 씁니다.")
    v = cfg.get("voice") or {}
    word = voice_words(v)["word"]
    if sub == "status":
        st = {}
        try:
            with open(base + "_voice.json", encoding="utf-8-sig") as f:
                st = json.load(f)
        except (OSError, ValueError):
            pass
        for l in voice_status_lines(sender.voice_signals(), st if isinstance(st, dict) else {}, v):
            print(l)
        return
    if sub == "now":
        room = v.get("room") or cfg.get("room") or ""
        if not room:
            raise SystemExit("excer_bot.json 의 room(알릴 방)을 먼저 넣으세요(setup).")
        print("보이스룸을 확인하고 꺼져 있으면 다시 켭니다(방: %s). 1분쯤 걸립니다. 태블릿을 만지지 마세요." % room)
        w = VoiceWatch(cfg, sender, base + "_voice.json", log)
        r = w.tick() if w.due() else "wait"
        if r in ("on", "off?", "wait"):
            r = w.recover(datetime.now(KST), time.time()) if r != "on" else "on"
        print("결과: " + {"on": "이미 켜져 있음", "recovered": "다시 켬", "fail": "실패(excer_bot.log 와 excer_bot_ui.txt 를 보세요)", "kicked": "내보내진 것으로 보여 안 들어감", "renewed": "갱신함"}.get(r, r))
        return
    if sub == "look":
        room = v.get("room") or cfg.get("room") or ""
        if not room:
            raise SystemExit("excer_bot.json 의 room(알릴 방)을 먼저 넣으세요(setup).")
        print("알릴 방(%s)의 보이스룸 띠와 보이스룸 화면을 적습니다. 나가기는 누르지 않고 마지막에 작게 접습니다. 30초쯤 걸립니다. 태블릿을 만지지 마세요." % room)
        txt = sender.voice_look(room, v)
        path = base + "_voice_look.txt"
        with open(path, "w", encoding="utf-8") as f:
            f.write(txt)
        try:
            sender.set_clip(txt)
            print("적었습니다(%s). 클립보드에도 담았으니 대화창에 붙여넣어 보내 주세요." % os.path.basename(path))
        except KakaoError:
            print("적었습니다: %s (cat 으로 보세요)" % path)
        return
    if sub == "raw":
        txt = sender.voice_raw(v)
        path = base + "_voice_raw.txt"
        with open(path, "w", encoding="utf-8") as f:
            f.write(txt)
        try:
            sender.set_clip(txt)
            print("적었습니다(%s, %d줄). 클립보드에도 담았으니 대화창에 붙여넣어 보내 주세요." % (os.path.basename(path), txt.count("\n") + 1))
        except KakaoError:
            print("적었습니다: %s (cat 으로 보세요)" % path)
        return
    room = cfg.get("test_room") or ""
    if not room:
        raise SystemExit("excer_bot.json 의 test_room(시험 방)을 먼저 넣으세요(setup).")
    ans = input("시험 방 '%s' 에 보이스룸을 실제로 하나 만들었다가 끝내며 화면과 신호를 적습니다(방 사람들에게 보이스룸 알림이 갈 수 있습니다). 시작할까요? y/n [y]: " % room).strip().lower()
    if ans not in ("", "y", "yes", "ㅛ"):
        print("그만둡니다.")
        return
    print("1~2분 걸립니다. 끝날 때까지 태블릿을 만지지 마세요.")
    try:
        txt = sender.voice_study(room, v.get("title") or DEFAULTS["voice"]["title"], v)
    finally:
        sender.done()
    path = base + "_voice_study.txt"
    with open(path, "w", encoding="utf-8") as f:
        f.write(txt)
    try:
        sender.set_clip(txt)
        print("다 적었습니다(%s). 클립보드에도 담았으니 대화창에 붙여넣어 보내 주세요." % os.path.basename(path))
    except KakaoError:
        print("다 적었습니다: %s (cat 으로 보세요)" % path)


def clip_text():
    """안드로이드 클립보드의 글(termux-clipboard-get). 못 읽으면 ''"""
    try:
        p = subprocess.run(["termux-clipboard-get"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15)
    except (OSError, subprocess.SubprocessError):
        return ""
    return p.stdout.decode("utf-8", "replace") if p.returncode == 0 else ""


def members_key_cmd(cfg, path, val, clip=None):
    """members key [열쇠]: 봇 열쇠를 저장한다. 적지 않으면 클립보드에서 읽는다. 열쇠는 끝 네 글자만 보인다(off 는 지운다)"""
    val = (val or "").strip()
    if val == "off":
        cfg["members_key"] = ""
        save_cfg(path, cfg)
        return "봇 열쇠를 지웠습니다. 멤버 자동 갱신을 하지 않습니다. run 이 돌고 있으면 Ctrl+C 로 멈추고 다시 켜야 적용됩니다"
    src = "적은 글"
    if not val:
        val, src = (clip or clip_text)() or "", "클립보드의 글"
        if not val.strip():
            return ("클립보드가 비어 있거나 읽지 못했습니다(Termux:API 앱이 있어야 합니다). 운영 화면 데이터 탭에서 복사 단추를 누른 뒤 다시 "
                    "python excer_bot.py members key, 안 되면 열쇠를 길게 눌러 붙여 넣어 python excer_bot.py members key 열쇠")
    got = sorted(set(MEMBER_KEY_RE.findall(INVIS_RE.sub("", val))))
    if len(got) != 1:
        return "%s(%d자)%s. 운영 화면 데이터 탭에서 봇 열쇠를 만들고 복사 단추를 다시 누르세요" % (
            src, len(val.strip()), "에 열쇠가 %d개 들어 있습니다" % len(got) if got else "이 봇 열쇠 모양이 아닙니다(mbk_ 뒤에 0~9, a~f 48자)")
    cfg["members_key"] = got[0]
    save_cfg(path, cfg)
    return "봇 열쇠를 저장했습니다(끝 %s). run 이 돌고 있으면 Ctrl+C 로 멈추고 다시 켜야 적용됩니다. 바로 올려 보려면 run 을 멈춘 채 python excer_bot.py members push" % got[0][-4:]


def members_at_cmd(cfg, path, val):
    """members at 05:10: 매일 이 시각에 멤버를 읽어 올린다. members at off: 끈다. 인자가 없으면 지금 설정을 보인다"""
    val = (val or "").strip()
    if not val:
        at = members_at(cfg)
        return "멤버 자동 갱신: %s%s. 바꾸려면 python excer_bot.py members at 05:10 또는 members at off" % (
            "매일 " + at if at else "꺼짐", "" if cfg.get("members_key") else ", 봇 열쇠 없음(python excer_bot.py members key)")
    if val == "off":
        cfg["members_at"] = "off"
    else:
        m = re.match(r"^(\d{1,2}):(\d{2})$", val)
        if not m or int(m.group(1)) > 23 or int(m.group(2)) > 59:
            return "모양이 다릅니다. 예: python excer_bot.py members at 05:10 (24시간), 끄려면 members at off"
        cfg["members_at"] = "%02d:%02d" % (int(m.group(1)), int(m.group(2)))
    save_cfg(path, cfg)
    return ("멤버 자동 갱신을 매일 %s 로 정했습니다" % cfg["members_at"] if cfg["members_at"] != "off" else "멤버 자동 갱신을 껐습니다") + \
        ". run 이 돌고 있으면 Ctrl+C 로 멈추고 다시 켜야 적용됩니다"


def cmd_members(cfg, a, base, log, sender=None, site=None, clip=None):
    """members: 알릴 방 메뉴(서랍)의 멤버를 지금 읽는다(올리지 않음). push 는 읽어 올리고, study 는 화면을 적고,
    key 는 봇 열쇠를, at 은 매일 시각을 정한다. 화면을 쓰는 것(members, push, study)은 run 이 돌면 하지 않는다"""
    sub, val = (a.arg or "").strip(), (getattr(a, "arg2", "") or "").strip()
    if sub == "key":
        print(members_key_cmd(cfg, a.config, val, clip))
        return
    if sub == "at":
        print(members_at_cmd(cfg, a.config, val))
        return
    if sub not in ("", "push", "study"):
        raise SystemExit("python excer_bot.py members | members push | members study | members key [열쇠] | members at 05:10 (또는 off)")
    if run_alive(base):                                 # 도는 run 과 이 명령이 같은 화면을 번갈아 누르게 된다
        raise SystemExit("run 이 돌고 있습니다. 둘이 같은 화면을 누르게 되니 그 창에서 Ctrl+C 로 멈춘 뒤 다시 python excer_bot.py members" + (" " + sub if sub else ""))
    room, key = cfg.get("room") or "", cfg.get("members_key") or ""
    if not room:
        raise SystemExit("excer_bot.json 의 room(알릴 방)을 먼저 넣으세요(setup).")
    if sub == "push" and not key:
        raise SystemExit("봇 열쇠가 없습니다. 운영 화면 데이터 탭에서 봇 열쇠를 만들어 복사한 뒤 python excer_bot.py members key")
    sender = sender or make_sender(cfg, log)
    if not isinstance(sender, AdbSender):
        raise SystemExit("members 는 tablet 방식에서 씁니다.")
    if sub == "study":
        print("알릴 방(%s) 방 메뉴(오른쪽 위 세 줄 단추)의 대화상대 칸 화면을 적습니다(멤버 이름은 가림, 누르는 것은 세 줄 단추와 더보기뿐). 1~2분 걸립니다. 태블릿을 만지지 마세요." % room)
        try:
            txt = sender.members_study(room, cfg.get("members") or {})
        finally:
            sender.done()
        path = base + "_members_study.txt"
        with open(path, "w", encoding="utf-8") as f:
            f.write(txt)
        try:
            sender.set_clip(txt)
            print("다 적었습니다(%s). 클립보드에도 담았으니 개발 대화창에 붙여넣어 보내 주세요." % os.path.basename(path))
        except KakaoError:
            print("다 적었습니다: %s (cat 으로 보세요)" % path)
        return
    print("알릴 방(%s) 방 메뉴(오른쪽 위 세 줄 단추)에서 멤버를 읽습니다. 1~5분 걸립니다. 끝날 때까지 태블릿을 만지지 마세요." % room)
    try:
        names = sender.read_members(room, cfg.get("members") or {})
    finally:
        sender.done()
    path = base + "_members.txt"
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(names) + "\n")
    n = (getattr(sender, "mem_info", None) or {}).get("n")
    print("멤버 %d명을 읽었습니다%s. 보기: %s" % (len(names), "(방의 대화상대 %d명에서 봇을 빼면 %d명)" % (n, n - 1) if n else "", ", ".join(member_mask(x) for x in names[:5])))
    print("전체 목록: %s" % path)
    if sub != "push":
        print("사이트에는 올리지 않았습니다. 올리려면 python excer_bot.py members push")
        return
    try:
        r = (site or Site(cfg)).push_members(names, key)
        kind, msg = members_result(r)
    except Exception as e:                              # 망, 서버 오류: 파이썬 오류 화면 대신 한 줄
        r, kind, msg = None, "retry", "멤버 목록을 올리지 못함(%s). 망을 확인하고 다시 python excer_bot.py members push" % e
    print(msg)
    sp = base + "_state.json"                           # run 이 멈춰 있으니 기록을 여기서 고친다(status 와 '봇 정상' 줄에 보인다)
    st, now = load_state(sp), Now(datetime.now(KST))
    st["members_last"] = {"at": "%s %s" % (now.ymd, now.hm), "n": int((r or {}).get("n") or 0) if kind == "ok" else len(names),
                          "error": "" if kind == "ok" else members_short(msg), "step": "push"}
    if kind == "ok":
        st.update(members_ymd=now.ymd, members_fail=0, members_retry_at=0)
        st.pop("members_badkey", None)
    elif kind == "key":
        st["members_badkey"] = member_key_tag(key)
    save_json(sp, st)


def cmd_quiet(cfg, path, arg):
    """quiet 00:30-07:30: 그 사이에는 올리지 않는다. quiet off: 늘 올린다. 인자가 없으면 지금 설정을 보여 준다"""
    arg = (arg or "").strip()
    if not arg:
        q = cfg.get("quiet") or []
        return "조용한 시간: %s" % ("%s~%s" % (q[0], q[1]) if len(q) == 2 else "없음(늘 올림)") + ". 바꾸려면 python excer_bot.py quiet 00:30-07:30 또는 quiet off"
    if arg == "off":
        cfg["quiet"] = []
    else:
        m = re.match(r"^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$", arg)
        if not m or arg[:5] == arg[6:]:
            return "모양이 다릅니다. 예: python excer_bot.py quiet 00:30-07:30 (시작-끝, 24시간), 끄려면 quiet off"
        cfg["quiet"] = [arg[:5], arg[6:]]
    save_cfg(path, cfg)
    return ("조용한 시간을 %s~%s 로 정했습니다" % tuple(cfg["quiet"]) if cfg["quiet"] else "조용한 시간을 껐습니다(늘 올림)") + ". run 이 돌고 있으면 Ctrl+C 로 멈추고 다시 켜야 적용됩니다"


def cmd_reset(base, state_path):
    """본 글 기록을 비운다. 다음 run 은 처음 켤 때처럼 지금 글을 알리지 않고 기억만 한 뒤 공지 글을 새로 올려 건다.
    도는 run 은 기록을 제 손에 들고 있다가 다시 써 버리므로, run 이 돌고 있으면 먼저 멈추라고 한다"""
    if run_alive(base):
        return "run 이 돌고 있습니다. 그 창에서 Ctrl+C 로 멈춘 뒤 다시 python excer_bot.py reset"
    st = load_state(state_path)
    n = len(st.get("known") or {})
    for k in ("init", "notice_text", "send_fail_text", "notice_fail", "notice_fail_text", "notice_retry_at", "notice_posted"):
        st.pop(k, None)
    st["known"] = {}
    save_json(state_path, st)
    return "기록을 비웠습니다(기억하던 글 %d개). 다음 run 은 지금 글을 알리지 않고 기억만 한 뒤, 방 공지가 지금 글과 다르면 공지 글을 새로 올려 겁니다. 이제 python excer_bot.py run" % n


def wake_lock(on):
    import shutil
    cmd = "termux-wake-lock" if on else "termux-wake-unlock"
    if shutil.which(cmd):
        try:
            subprocess.run([cmd], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
        except (OSError, subprocess.SubprocessError):
            pass


def run_loop(bot, log, voice=None, alive_path=None):
    last_err, err_n, beat = "", 0, 0.0
    while True:
        ran = False
        try:
            if bot.due():
                ran = True
                r = bot.cycle()
                if r not in ("none", "quiet", "read-fail", "read-empty", "send-fail"):   # 실패는 cycle 이 이미 적는다(망이 끊긴 동안 1분마다 한 줄씩 쌓이지 않게)
                    log("차례: " + r)
            if voice and voice.due():
                ran = True
                voice.tick()                            # 보이스룸 끊김은 tick 안에서 적는다
            if hasattr(bot, "heartbeat") and bot.heartbeat():
                ran = True
            if hasattr(bot, "members_tick") and bot.members_tick():   # 하루 한 번 방 메뉴의 멤버를 사이트에(tablet, 봇 열쇠가 있을 때)
                ran = True
            if ran and last_err:
                log("오류가 멎음(%d번 이어졌음)" % err_n)
                last_err, err_n = "", 0
        except KeyboardInterrupt:
            raise
        except Exception as e:
            msg = "%s" % e
            err_n = err_n + 1 if msg == last_err else 1
            last_err = msg
            if err_n == 1 or err_n % 30 == 0:           # 같은 오류가 2초마다 이어지면 처음과 30번째마다만 적는다(설정 오타 등)
                log("오류%s: %s" % ("(%d번째, 같은 오류가 이어짐)" % err_n if err_n > 1 else "", msg))
        if alive_path and time.time() - beat >= 30:    # 살아 있다는 표시: status 명령이 읽는다
            beat = time.time()
            write_alive(alive_path, bot, voice, last_err)
        time.sleep(2)


def write_alive(path, bot, voice, err=""):
    try:
        save_json(path, {"at": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S"), "ts": time.time(), "pid": os.getpid(), "version": VERSION,
                         "last_check": float(getattr(bot, "last_check", 0) or 0), "read_fails": int(getattr(bot, "read_fails", 0) or 0),
                         "send_fails": int(getattr(bot, "send_fails", 0) or 0),
                         "notice_fail": int((bot.st.get("notice_fail") or 0) if getattr(bot, "st", None) else 0),
                         "notice_gaveup": int((bot.st.get("notice_gaveup") or 0) if getattr(bot, "st", None) else 0),
                         "ctl": ctl_text(bot, bot.ts() if callable(getattr(bot, "ts", None)) else time.time()),
                         "notice": (bot.st.get("notice_text") or "").split("\n")[0] if getattr(bot, "st", None) else "",
                         "voice": (voice.st.get("state") or "") if voice else "", "members": members_alive(bot), "error": err})
    except (OSError, ValueError, TypeError, AttributeError):   # 표시를 못 남겨도 run 은 그대로 돈다(이 함수는 run_loop 의 try 밖)
        pass


def pid_alive(pid):
    try:
        os.kill(int(pid), 0)
        return True
    except (OSError, ValueError, TypeError):
        return False


def bot_pid(pid):
    """그 pid 가 지금 도는 봇인가: 살아 있고 명령줄에 excer_bot 이 있다. 명령줄을 못 읽으면 None(모름)"""
    if not pid_alive(pid):
        return False
    try:
        with open("/proc/%d/cmdline" % int(pid), "rb") as f:
            return b"excer_bot" in f.read()
    except (OSError, ValueError, TypeError):
        return None


def run_alive(base, now_ts=None):
    """run 이 돌고 있는가: 살아 있음 표시가 90초 안이고 그 프로세스가 있다. 표시가 오래됐어도(긴 일 하는 중) 그 프로세스가 봇이면 돌고 있다"""
    try:
        with open(base + "_alive.json", encoding="utf-8-sig") as f:
            alive = json.load(f)
        if (now_ts or time.time()) - float(alive.get("ts") or 0) < 90 and pid_alive(alive.get("pid")):
            return True
        return int(alive.get("pid") or 0) != os.getpid() and bot_pid(alive.get("pid")) is True
    except (OSError, ValueError, TypeError, AttributeError):
        return False


def status_lines(base, now_ts=None):
    """run 이 살아 있는지, 마지막으로 사이트를 본 때, 공지 첫 줄, 보이스룸, 멤버 자동 갱신, 최근 기록. 기기는 건드리지 않는다"""
    now_ts = now_ts or time.time()
    out = ["봇 파일 판: %s" % VERSION]
    alive = {}
    try:
        with open(base + "_alive.json", encoding="utf-8-sig") as f:
            alive = json.load(f)
    except (OSError, ValueError):
        pass
    if not alive:
        out.append("run: 돈 적 없음(또는 옛 판으로 돌고 있음). python excer_bot.py run")
    else:
        age = now_ts - float(alive.get("ts") or 0)
        busy = age >= 90 and bot_pid(alive.get("pid")) is True   # 표시는 오래됐지만 봇 프로세스는 살아 있음(공지 걸기 같은 긴 일 하는 중)
        live = (age < 90 and pid_alive(alive.get("pid"))) or busy
        out.append("run: %s(마지막 표시 %s, %s)" % ("돌고 있음, 일하는 중" if busy else "돌고 있음" if live else "멈춤", alive.get("at", "?"), "%d초 전" % age if age < 120 else "%d분 전" % (age // 60)))
        if not live:
            out.append("  다시 켜려면: python excer_bot.py run   (재부팅했으면 무선 디버깅을 켜고 python excer_bot.py connect 먼저)")
        if alive.get("version") and alive["version"] != VERSION:
            out.append("  돌고 있는 판(%s)이 이 파일(%s)과 다릅니다. Ctrl+C 로 멈추고 다시 켜세요" % (alive["version"], VERSION))
        lc = float(alive.get("last_check") or 0)
        out.append("사이트 마지막 확인: %s%s" % (datetime.fromtimestamp(lc, KST).strftime("%m-%d %H:%M:%S") if lc else "없음", ", 읽기 실패 %d번 이어짐" % alive["read_fails"] if alive.get("read_fails") else ""))
        if alive.get("send_fails"):
            out.append("보내기 실패 %d번 이어짐: adb 가 안 붙었거나(무선 디버깅, connect) 카카오톡 화면이 달라짐(excer_bot_ui.txt)" % alive["send_fails"])
        if alive.get("notice_fail"):
            out.append("공지 걸기 실패 %d번: 글은 올렸지만 공지로 못 걸었음(봇 계정이 부방장인지)" % alive["notice_fail"])
        if alive.get("ctl"):
            out.append("운영 화면의 원격 조종: " + alive["ctl"])
        if alive.get("notice_gaveup"):
            out.append("공지 걸기를 쉬는 중: 방에 올린 마지막 공지 글을 길게 눌러 직접 공지로 걸어 주세요(다음에 벙이 바뀌면 봇이 다시 겁니다)")
        if alive.get("notice"):
            out.append("공지 첫 줄: " + alive["notice"])
        if alive.get("voice"):
            out.append("보이스룸: " + {"on": "켜짐", "off": "꺼짐"}.get(alive["voice"], alive["voice"]))
        if alive.get("members"):
            out.append("멤버 자동 갱신: " + alive["members"])
        if alive.get("error"):
            out.append("이어지는 오류: " + alive["error"])
    try:
        with open(base + ".log", encoding="utf-8", errors="replace") as f:
            tail = [l.rstrip("\n") for l in f.readlines()[-5:]]
        if tail:
            out.append("최근 기록:")
            out.extend("  " + l for l in tail)
    except OSError:
        pass
    return out


def remote_version(get=None):
    """저장소(main)의 봇 파일 판. 못 읽으면 빈 글자"""
    try:
        code, body = (get or http_get)(RAW_URL, timeout=20)
        m = code == 200 and re.search(r'^VERSION = "([^"]+)"', body, re.M)
        return (m.group(1) if m else ""), body if code == 200 else ""
    except Exception:
        return "", ""


def cmd_update(base, get=None, me=None):
    """저장소의 봇 파일을 받아 이 파일을 바꾼다. 문법 검사가 통과해야 바꾸고, 옛 파일은 .bak 으로 둔다. run 이 돌고 있으면 먼저 멈추라고 한다"""
    import py_compile
    me = me or os.path.abspath(__file__)
    if run_alive(base):
        return "run 이 돌고 있습니다. 그 창에서 Ctrl+C 로 멈춘 뒤 다시 python excer_bot.py update"
    ver, body = remote_version(get)
    if not body:
        return "저장소에서 봇 파일을 읽지 못했습니다(망 확인). 받은 판 없음"
    try:
        with open(me, encoding="utf-8") as f:
            same = f.read().replace("\r\n", "\n") == body.replace("\r\n", "\n")
    except OSError:
        same = False
    if same:
        return "이미 최신 판(%s)입니다" % VERSION
    new = me + ".new"
    with open(new, "w", encoding="utf-8") as f:
        f.write(body)
    try:
        py_compile.compile(new, doraise=True)
    except py_compile.PyCompileError as e:
        os.remove(new)
        return "받은 파일이 깨져 있어 바꾸지 않았습니다: %s" % str(e).split("\n")[0]
    try:
        os.replace(me, me + ".bak")
    except OSError:
        pass
    os.replace(new, me)
    return "바꿨습니다: %s -> %s (옛 파일은 %s). 이제 python excer_bot.py run" % (VERSION, ver or "?", os.path.basename(me) + ".bak")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("멈춤")
    except KakaoError as e:                             # 파이썬 오류 화면 대신 무엇이 안 됐는지만
        print("안 됨:", e)
        sys.exit(1)
