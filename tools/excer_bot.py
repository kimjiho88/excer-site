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
  - 20초마다 사이트의 모임 모집 글을 읽는다(check_sec). 날짜가 있는 글만 벙으로 친다(사이트가 날짜, 시간, 장소, 인원을 꼭 받는다).
  - 공지: 모집 중인 벙만 벙 시간 차례대로. 첫 줄이 다음 벙(신청 마감이 따로 있으면 그 시각도), 그 아래로 이후 벙.
    모집 중은 마감하지 않았고, 신청 마감(없으면 시작 시각) 전이고, 참석이 정원에 차지 않은 벙이다.
    이 글이 달라질 때마다(새 벙, 바뀜, 마감, 정원 참, 취소, 그리고 신청 마감이 되어 다음 벙이 첫 줄로 올라올 때)
    방에 올리고 길게 눌러 공지로 건다.
  - 알림: 새 벙, 날짜와 시간과 장소와 신청 마감 바뀜, 마감, 정원 참, 다시 모집(마감 풀림, 자리 남), 취소(모집 글 삭제)는
    공지 글 앞에 알림 메시지를 따로 올린다. 하나면 장소, 인원, 벙주, 글 주소까지, 여럿이면 한 메시지에 한 줄씩.
  - 24시간 돈다. 한 번 올린 뒤 1분 안에 또 바뀌면 모았다가 1분이 지나면 올린다(min_gap_sec).
  - 처음 켤 때는 이미 올라와 있던 글을 알리지 않고, 지금의 공지 글만 올려 공지로 건다.
  - 보내기에 실패하면 1분 쉬었다가 다시. 공지 걸기만 실패하면 공지 글을 다시 올려 1분, 5분, 15분 뒤 다시 건다(세 번까지).
  - 매일 정한 시각에 공지 글을 한 번 더 올릴 수 있다(digest_at, 기본은 끔).
  - 카카오톡을 건드리는 것은 올릴 것이 있을 때뿐이다.
가진 것: 없음. 사이트의 공개 글만 읽는다. 공개 접속 키는 사이트에서 읽어 온다. 운영진 비밀번호는 여기에 두지 않는다.

tablet 준비(태블릿 하나로)
  - Termux 와 Termux:API 를 같은 곳(F-Droid)에서 깔고, Termux 에서 yes | pkg upgrade 로 기본 부품을 먼저 올린 뒤
    pkg install python android-tools termux-api curl (안 올리면 adb, curl 이 CANNOT LINK EXECUTABLE 로 안 켜진다)
  - 설정 > 개발자 옵션 > 무선 디버깅을 켜고, 페어링 코드로 한 번 adb pair 127.0.0.1:포트 한 뒤
    python excer_bot.py connect (포트는 스스로 찾는다. 못 찾으면 무선 디버깅 화면의 'IP 주소 및 포트' 의 포트를 적는다).
    connect 는 고정 포트(5555)도 열어 두어 무선 디버깅이 저절로 꺼져도 붙는다(처음 한 번 화면의 허용 창). 재부팅하면 무선 디버깅을 켜고 connect 만 다시.
  - 화면 잠금 없음, 자동 회전 끔, 충전기 연결, Termux 는 배터리 제한 없음(run 이 termux-wake-lock 을 직접 건다).
    화면은 꺼져 있어도 된다. 봇이 올릴 때 화면을 켜고 카카오톡을 앞으로 가져온다.
  - 봇 계정을 방의 부방장으로 둔다(공지는 방장과 부방장만 건다).

명령(이 파일이 있는 폴더에서)
  python excer_bot.py setup           설정 파일(excer_bot.json)을 만든다. tablet 이면 카카오톡 목록의 방 이름을 번호로 고른다
  python excer_bot.py connect 포트     (tablet) 무선 디버깅 포트로 같은 기기에 붙는다
  python excer_bot.py check           사이트, 기기 연결, 클립보드를 확인한다(보내지 않음)
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
                                      시험 방을 띄워 놓고 쓴다. 화면에 보이는 대화 글이 들어간다)
  python excer_bot.py voice study     (tablet) 시험 방에 보이스룸을 실제로 하나 만들었다가 끝내며, 단계마다 화면(단추 이름)과
                                      신호(알림, 소리, 서비스)를 excer_bot_voice_study.txt 에 적고 클립보드에 담는다. docs/BOT_VOICE_ROOM.md
  python excer_bot.py voice status    보이스룸이 켜져 있는지(화면을 건드리지 않고 알림, 소리, 서비스로)와 최근 끊김 기록
  python excer_bot.py voice raw       그 신호의 원문을 excer_bot_voice_raw.txt 에 적고 클립보드에 담는다(해석기를 맞추는 근거.
                                      대화 글은 안 들어가고 보이스룸 알림 글자만 그대로)
  python excer_bot.py voice on        run 이 보이스룸도 지키게 켠다: 60초마다 보고 끊기면 다시 켜고(새로 만들거나 참여), 47.5시간이 지나면
                                      끝내고 새로 만든다. 실패하면 1, 2, 5, 10, 15분 간격으로 다시. voice off 로 끈다
  python excer_bot.py voice now       지금 바로 확인하고 꺼져 있으면 다시 켠다(한 번)
  python excer_bot.py calibrate       (pc) 우클릭 메뉴의 복사, 공지 자리를 잡는다
  python excer_bot.py once            한 번만 보고 끝낸다
기록: excer_bot_state.json(본 글, 시험 방은 excer_bot_test_state.json, 시험 파일은 excer_bot_feed_state.json),
      excer_bot_voice.json(보이스룸 켜짐과 끊김), excer_bot.log(한 일). 이 파일 옆에 생긴다.
"""
import argparse
import json
import subprocess
import xml.etree.ElementTree as ET
import os
import re
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
from datetime import date, datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
KST = timezone(timedelta(hours=9))
DOW = "월화수목금토일"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^\d{2}:\d{2}$")

DEFAULTS = {
    "backend": "tablet",                 # tablet, android, pc, dry
    "room": "",                          # 알릴 방 이름(카카오톡에 보이는 그대로)
    "test_room": "",                     # 시험 방(봇 계정과 나만 있는 방). test, calibrate 가 쓴다
    "notice": True,                      # 올린 목록을 공지로 걸지
    "check_sec": 20,                     # 사이트를 몇 초에 한 번 볼지
    "digest_at": "",                     # 매일 이 시각(예 "10:00")에 공지 글을 한 번 더 올린다. "" 이면 안 한다(차례대로 바뀌므로 기본은 끔)
    "digest_late_min": 180,              # 이 시각에서 이만큼 지나도록 못 올렸으면 그날은 건너뛴다
    "min_gap_sec": 60,                   # 한 번 올린 뒤 다음에 올리기까지(그 사이 바뀜은 모았다가)
    "quiet": [],                         # 이 사이에는 올리지 않는다. 예: ["00:00", "07:00"]. [] 이면 늘 올린다
    "max_lines": 15,                     # 목록 줄 수 한도
    "site": "https://excer-site.vercel.app",
    "supa": "https://drggzlnzwvkhtalvkqyo.supabase.co",
    "link": True,                        # 목록 끝에 벙 일정 주소(pc 에서 공지가 자주 실패하면 false: 주소 미리보기가 늦게 떠 자리가 밀린다)
    "pc": {"window": [40, 40, 460, 780], "input_dy": 80, "bubble": None, "menu_copy": None, "menu_notice": None, "confirm": None},
    "android": {"serial": "", "package": "com.kakao.talk"},
    "tablet": {"freeze": True,                 # 보낸 뒤 대화를 살짝 위로 올려 자동으로 내려가지 않게(바쁜 방에서 봇 글이 밀리지 않게)
              "serial": "", "package": "com.kakao.talk", "adb": "adb", "clip": "termux-clipboard-set", "return_to": "com.termux"},
    # 보이스룸 지키기(docs/BOT_VOICE_ROOM.md): run 이 끊김을 알아채 기록하고 다시 켠다. room 이 비면 알릴 방
    "voice": {"on": False, "room": "", "title": "신입(날짜)분들 2주 내 벙 필참 🙏 자삭금지 🚫",   # 봇이 보이스룸을 만들 때 쓰는 제목(운영자가 정함)
              "check_sec": 60, "notif_word": "보이스룸",
              "on_text": "보이스룸에 참여 중", "end_text": "보이스룸 종료",   # 카카오톡 알림 글자(실측). 바뀌면 여기만
              "renew_hours": 47.5, "mute": True, "volume0": True, "recover": True,   # recover: 끊기면 다시 켠다(2단계). 끄면 기록만
              "kick_retry_min": 0, "max_new_per_day": 6, "alert_test_room": False},
}


class KakaoError(Exception):
    pass


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


def norm(p):
    if not isinstance(p, dict) or p.get("id") is None:
        return None
    m = p.get("meta") if isinstance(p.get("meta"), dict) else {}
    if m.get("kind") and m.get("kind") != "bung":
        m = {}
    d, t = str(m.get("date") or ""), str(m.get("time") or "")
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
            "date": d if DATE_RE.match(d) else "", "time": t if TIME_RE.match(t) else "",
            "place": clean(m.get("place"), 40), "cap": cap, "closed": m.get("status") == "closed",
            "deadline": dl if re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$", dl) else "",
            "attend": att, "full": bool(cap and att is not None and att >= cap),
            "created": str(p.get("created_at") or "")}


def http_get(url, headers=None, timeout=15):
    req = urllib.request.Request(url, headers=dict({"User-Agent": "excer-bot/1"}, **(headers or {})))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


class Site:
    def __init__(self, cfg, get=None):
        self.cfg, self.get, self.key = cfg, get or http_get, ""

    def anon_key(self, fresh=False):
        if self.key and not fresh:
            return self.key
        code, body = self.get(self.cfg["site"] + "/assets/site-core.js")
        m = code == 200 and re.search(r'anon:\s*"([A-Za-z0-9._-]{40,})"', body)
        if not m:
            raise RuntimeError("사이트에서 접속 키를 읽지 못함(HTTP %s)" % code)
        self.key = m.group(1)
        return self.key

    def posts(self):
        """오늘 이후 날짜의 모임 모집 글(최근 100개). 지난 글은 읽지 않으니 멀리 잡은 벙이 목록 밖으로 밀리지 않는다"""
        cols = "id,title,author,meta,created_at" + ("" if getattr(self, "no_attend", False) else ",attend_count")
        q = urllib.parse.urlencode({"select": cols, "category": "eq.벙 소식", "meta->>date": "gte." + Now(datetime.now(KST)).ymd,
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


def upcoming(v, now):
    """아직 시작하지 않았고 마감하지 않은 벙"""
    return bool(v["date"]) and not v["closed"] and now_key(now) < start_key(v)


def recruiting(v, now):
    """모집 중: 시작 전, 마감 안 함, 신청 마감 전, 정원 남음. 공지에는 이 벙만 넣는다"""
    return upcoming(v, now) and not v.get("full") and now_key(now) < deadline_key(v)


def dl_text(v):
    d = v.get("deadline") or ""
    if not d or d == start_key(v):
        return ""
    return "신청 " + ("" if d[:10] == v["date"] else md(d[:10]) + " ") + d[11:16] + "까지"


def skey(v):
    return (v["date"], v["time"] or "99:99", int(v["id"]) if v["id"].isdigit() else 0)


def head(v):
    return (md(v["date"]) if v["date"] else "날짜 미정") + (" " + v["time"] if v["time"] else "") + " " + v["title"]


def line(v):
    return head(v) + (", " + v["place"] if v["place"] else "")


def sig(v):
    return {"d": v["date"], "t": v["time"], "p": v["place"], "c": 1 if v["closed"] else 0, "n": v["title"], "cr": v["created"],
            "dl": v.get("deadline") or "", "f": 1 if v.get("full") else 0}


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
        if v["date"] and v["date"] < now.ymd:
            continue                                   # 지난 벙은 알리지 않는다
        if v["closed"]:
            if not o.get("c"):
                ch["cls"].append(v)
            continue
        f = [n for n, a, b in (("날짜", o.get("d"), v["date"]), ("시간", o.get("t"), v["time"]), ("장소", o.get("p"), v["place"]),
                                ("신청 마감", o.get("dl"), v.get("deadline"))) if (a or "") != (b or "")]
        if v.get("full") and not o.get("f"):
            ch["full"].append(v)                       # 정원이 찼다
        elif (o.get("c") or o.get("f")) and not v.get("full"):
            f.append("마감 풀림")                       # 마감을 풀었거나 자리가 났다
        if f:
            ch["chg"].append((dict(v, _old=o), f))
    # 안 보이는 글: 지워졌으면 알리고, 최근 100개 밖으로 밀려난 것이면 기억해 둔다(다시 보여도 새 글로 치지 않게)
    oldest = min((v["created"] for v in posts if v["created"]), default="")
    for k, o in known.items():
        if k in cur or not o or o.get("c"):
            continue
        live = bool(o.get("d")) and o["d"] >= now.ymd
        if not live:
            continue                                   # 지난 글은 잊는다
        if init and (full or (o.get("cr") and oldest and o["cr"] > oldest)):   # 읽은 범위 안의 글이 없어졌으면 지워진 것
            ch["del"].append({"id": k, "date": o.get("d") or "", "time": o.get("t") or "", "title": o.get("n") or "제목 없음", "place": o.get("p") or ""})
            continue
        cur[k] = o
    return cur, ch


def has_changes(ch):
    return bool(ch["new"] or ch["chg"] or ch["cls"] or ch.get("full") or ch.get("del"))


def notice_text(posts, now, cfg):
    """공지로 걸 글. 첫 줄이 다음 벙(공지 띠에 보이는 줄), 그 아래로 이후 벙. 벙이 시작하면 다음 벙이 첫 줄로 올라온다"""
    up = sorted([v for v in posts if recruiting(v, now)], key=skey)
    link = cfg["site"] + "/bung"
    if not up:
        return "\n".join(["[다음 벙] 아직 없음"] + (["벙 올리기 " + link] if cfg.get("link", True) else []))
    first, rest = up[0], up[1:]
    same = sum(1 for v in rest if v["date"] == first["date"] and v["time"] == first["time"])
    out = ["[다음 벙] " + line(first) + (", " + dl_text(first) if dl_text(first) else "") + (" 외 %d건" % same if same else "")]
    if rest:
        mx = max(1, int(cfg.get("max_lines", 15)))
        out.append("이후 %d건" % len(rest))
        out += [line(v) for v in rest[:mx]]
        if len(rest) > mx:
            out.append("외 %d건" % (len(rest) - mx))
    if cfg.get("link", True):
        out.append("전체 " + link)
    return "\n".join(out)


def detail(v):
    bits = []
    if v["place"]:
        bits.append("장소 " + v["place"])
    if v["cap"]:
        bits.append("인원 %d명" % v["cap"])
    if v["author"]:
        bits.append("벙주 " + v["author"])
    if dl_text(v):
        bits.append(dl_text(v))
    return ", ".join(bits)


def alert_text(ch, cfg):
    """바뀐 것 알림(공지와 따로 올리는 메시지). 하나면 자세히, 여럿이면 한 메시지에 한 줄씩"""
    items = []
    for v in sorted(ch["new"], key=skey):
        items.append(("새 벙", v, detail(v)))
    for v, f in ch["chg"]:
        rest = [x for x in f if x != "마감 풀림"]
        if rest:
            items.append(("벙 변경", v, ", ".join(rest) + " 바뀜"))
        else:
            items.append(("벙 다시 모집", v, ""))
    for v in ch["cls"]:
        items.append(("벙 마감", v, "모집 마감"))
    for v in ch.get("full", []):
        items.append(("벙 마감", v, "정원 %d명 다 참" % v["cap"]))
    for v in ch.get("del", []):
        items.append(("벙 취소", v, "모집 글 삭제"))
    if not items:
        return ""
    post_link = lambda v: cfg["site"] + "/news.html#post-" + v["id"]
    if len(items) == 1:
        kind, v, d = items[0]
        out = ["[%s] %s" % (kind, head(v))]
        if kind == "벙 변경":
            out.append(changes_line(ch, v))
        elif d:
            out.append(d)
        if kind != "벙 취소" and cfg.get("link", True):
            out.append(post_link(v))
        return "\n".join(out)
    out = ["[벙 알림 %d건]" % len(items)]
    for kind, v, d in items:
        out.append("%s: %s%s" % (kind, head(v), (" (" + d + ")") if d and kind != "새 벙" else ""))
    return "\n".join(out)


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

    def save(self):
        save_json(self.state_path, self.st)

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
            if self.read_fails == 1 or self.read_fails % 10 == 0:
                self.log("사이트 읽기 실패%s: %s" % ("(%d번째, 망이 끊겼으면 돌아올 때까지 1분마다 다시 봄)" % self.read_fails if self.read_fails > 1 else "", e))
            self.hold_until = now.ts + 60
            return "read-fail"
        if self.read_fails:
            self.log("사이트 다시 읽힘(%d번 실패 뒤)" % self.read_fails)
            self.read_fails = 0
        live_known = any(o and o.get("d") and o["d"] >= now.ymd for o in st.get("known", {}).values())
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
        alert = alert_text(ch, cfg)
        ntext = notice_text(posts, now, cfg)
        dg = digest_due(st, now, cfg)
        if dg == "skip" or (dg and st.get("last_post_ymd") == now.ymd and ntext == st.get("notice_text")):
            st["last_digest"] = now.ymd                 # 너무 늦었거나 오늘 이미 올렸다
            self.save()
            dg = False
        want = (ntext != st.get("notice_text") and now.ts >= float(st.get("notice_retry_at") or 0)) or bool(dg)
        if not alert and not want:
            st["known"] = cur                           # 제목만 바뀜, 지난 글 정리
            self.save()
            return "none"
        if now.ts - float(st.get("last_post_at") or 0) < int(cfg.get("min_gap_sec", 60)):
            return "wait"                               # 방금 올렸다. 모았다가 한 번에
        try:
            return self._post(st, cfg, now, cur, alert, ntext if want else "", dg)
        finally:
            if hasattr(self.sender, "done"):
                self.sender.done()

    def send_once(self, text):
        """보낸다. 지난번에 같은 글을 보내다 실패했는데 실제로는 올라가 있으면(화면에서 확인) 또 보내지 않는다"""
        if self.st.get("send_fail_text") == text and hasattr(self.sender, "already_sent"):
            try:
                if self.sender.already_sent(self.room, text):
                    self.log("지난번 글이 이미 올라가 있어 다시 보내지 않음")
                    self.st["send_fail_text"] = ""
                    return
            except Exception:
                pass
        try:
            self.sender.send(self.room, text)
        except Exception:
            self.st["send_fail_text"] = text
            self.save()
            raise
        self.st["send_fail_text"] = ""

    def _post(self, st, cfg, now, cur, alert, ntext, dg):
        if alert:
            try:
                self.send_once(alert)
            except Exception as e:
                self.log("알림 보내기 실패(다음 차례에 다시): %s" % e)
                self.hold_until = now.ts + 60
                return "send-fail"
            self.log("알림: " + alert.split("\n")[0])
        st.update(known=cur, last_post_at=now.ts)
        self.save()
        if not ntext:
            return "alert"
        try:
            self.send_once(ntext)
        except Exception as e:
            self.log("공지 글 보내기 실패(다음 차례에 다시): %s" % e)
            self.hold_until = now.ts + 60
            return "send-fail"
        st.update(last_post_at=now.ts, last_post_ymd=now.ymd)
        if dg:
            st["last_digest"] = now.ymd
        self.log("올림: " + ntext.split("\n")[0])
        if not cfg.get("notice"):
            st["notice_text"] = ntext
            self.save()
            return "sent"
        try:
            self.sender.notice(self.room, ntext)
        except Exception as e:
            n = int(st.get("notice_fail") or 0) if st.get("notice_fail_text") == ntext else 0
            if n < len(NOTICE_RETRY):
                st.update(notice_fail=n + 1, notice_fail_text=ntext, notice_retry_at=now.ts + NOTICE_RETRY[n])
                self.log("공지 걸기 실패(%d번째, 글을 다시 올려 다시 건다): %s" % (n + 1, e))
            else:
                st.update(notice_text=ntext, notice_fail=0, notice_retry_at=0)   # 세 번 넘게 실패: 다음 바뀜까지 쉼
                self.log("공지 걸기 %d번 실패, 다음 바뀜 때 다시: %s" % (n + 1, e))
            self.save()
            return "sent-no-notice"
        st.update(notice_text=ntext, notice_fail=0, notice_fail_text="", notice_retry_at=0)
        self.save()
        self.log("공지로 걸었음")
        return "sent"


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


# ── 카카오톡 조작: 태블릿 하나로(Termux 안에서 adb 로 같은 기기에) ──
# 화면 읽기 도우미(tools/excer_dump/ExcerDump.java 를 dex 로 바꾼 jar, base64). 안드로이드 기본 uiautomator dump 는
# 화면이 1초 멈춰야 읽어서 글이 빨리 올라오는 방에서는 끝내 못 읽는다. 이것은 잠깐만 기다리고 그대로 읽는다.
# 다시 만들기: sh tools/excer_dump/build.sh (sha1 d511ce5f0c8bd60f5f3154f8ad0008dca7632336)
DUMPER_JAR = (
    "UEsDBBQAAAAIAAAAQV15lVeiogkAAAgRAAALAAAAY2xhc3Nlcy5kZXhtmFtsHFcdxv9z2avX9nrXdpytk4ydxN6UOuvcmqTetXHs"
    "utlkc8FJnHRz62R3ak+yO7OemXXs8tAWKgKK+lAuLUWhtEUpEkKipWoFFQLRFlQeWpU8WRREAdEHGoiQirgIVL5z5qyzFrX92+8/"
    "37lf5sx6ysZidHjHHgr+8ZU/jT32176ba5e/+PjoZPXv33/ePPfejXfCHUQ1Ilqc2Zkg8TMZJ7pEvr8W9MpEKegj0AD0hwrRp6Dv"
    "QyXoHpgvthCdgp6LEl0Ei+Aq+DJ4GnwLvAC+B34AXgPL4ANwC4yjfJ7VAc6A86AEXLAAPgseBp8DXwBfAo+Db4BnwPPgBfA6eA+0"
    "x4j2gzJ4BDwFXgJvgd+CW0BqJeoCW8AkOAUqwAUL4CHwMPg8uAqeAF8DXwfXwEvgVfAaeB28Bd4Fy+B34ANwC/wXRNowj2AADIMx"
    "cAiUgQeugq+C6+DH4Jfg1+BD8DfwL/AxUNtRF0iAHtAL+sCdYCcYA/vBCXAGPAQeBVfAE+BJ8E3wXYClp06wBtwBNgAN9IF+sBFs"
    "ApvBABgEabAF3En+HrgLDIGtIAO2sf0A9oJ7QGNTfRTx25LEdZeI/wO/W8Qq9kEPVBYx23uqyM/ioIh7RczqZH5LU54OEadE27Go"
    "nz8h8q8TMat/vYg7o36/u0TZ7SLuhb9DxJsQ7xTxXYh3iXhnk8/qvFvEk4h3i7izKc/RpvhU1J+rbtHuOrEWrJ4AZmSMfD0u9ILQ"
    "WWiSonQGqlAbfpl20ijXNTTDNUFFPn9BOsQ1TiYv7+cPYqamuIZoP1eJ8lzDdEDoQaEFoYe5Rugo1x76jNBpocegIVE/0wmh93IN"
    "0BGuXVSCRjCCNq5ttI9rN12ERuE/wNc0Qg9CWzGSc9A2jOA8tB2746TQU9C4aI+t+6e5rqX7uEp0gq+vn55AzTmuLUJjQluF+u11"
    "ouYynz9/T8bF2iTBb7B/tgqDpQ3EmUo8fqnd36u1uMZ7G0ENbB+/Ct9h5QP9lFQ1srTNmPcYdBDna4xSUpzHcdoTPktO/A7Mc0xK"
    "kBXfiHqj8i5tGul9PE4qA7Rje5RScpCXGaBldCD9YVLJwg/DDws//VFSGRVeqOH9ecc0u440rv+QVKIij9LwlpNKq/DUhvdOUokI"
    "L9Dw3ty5742P2VgQ/4TpDMbcgl4G8Ps2xvxtNqf7E7sTmxKJRLDv2RxWf4qiwb7ndvcdoikpKs/H1yF/iwxn/D7mqMJR4cyPMyc0"
    "H+9lI5f6vrP7yj00FYqGmROiaKg/HMJcJzBbVjzJPrVumkPcxeYvYp0I0JaJBGask3bdvYH2yuuQpmJVYvJezEi3WqZ57U7cWcvB"
    "oJT+Swq7I/1yt/wWpX/Urb6opn8q6elfSLPpt/uVBNrZhNVMqa189BO0B/OfUOdPKrS9MyW1cDdJ/VKEatoa9NeKb0F+rK0yjLR+"
    "GubrvZan9LD7WFLRoxacUffDT3G/E/1ug3Oa0v9oFdeD1Cqnn/HPUgW5clxVvr9bxHmwA/o0sTNTAtekh2PPSdcktgMD/Kz4N9bi"
    "92z/he+iZKifEnI//FqcnZ+WFsKMTKsSTUsKTSsyv5NzsQTmZgO9SVgRbT3uTqYb6A2KKux6OzTX6uf5FdaGeQmuG+hdzCO7lqGp"
    "QDufmSLFApY2QK9w3Ux1pBgYYStbjeD8sETFYCqgw2lb5YzDia5yzsKJrXIm4bSscqTbbcbbkRINWlqajKa25aYc8U/MQav6fS/F"
    "VJbyGNcBnBAxKaVmeZ5xxMzbxnUzPSquJX5nj4g724pHWDuK1LdrWw+8MM6oGE5+7Jw4O7ei8h7cWfNnFXr2Z8sk4Sd9sxVzmr6V"
    "EidFlJ9hPxf7QJJiy43naOMsIvKfm+w7mCQ8mW6fTx1N+SS6/cyVV5D5dUCAHb5SVuHnYwd/zkriGcW0h6LaBbtuld1c/2mKaaWK"
    "WbqkX6gYuX7q0Cq2NTvUbAUGNm4bHuGyY4TUgY172YVerbGLWY99VvAZHJiv29DeTFn39EzFLumVjFetZYzFkuGcr5tbF6sVimUz"
    "c6bh6E5pbmmUQtmMZZeNUTqaHUOqtmA4rmlbucFtW4cHNcMq2WXTms0Nnjg+NbRnUHM93Srr6KCRG1wy3EFtbDS7Upvm2J7usdL9"
    "w/2jFMyalumNUmuWtaCZVtlYxGBkIE2QPJGntntZxybr1drWi/qCTlKelHw+T3K+QNIBkg9ACiQXJqilsJJ1BAayFFhCkVIFdMix"
    "zXJGr9UyJ8zxumdXeSdGaM1K2qyj1+bMkpuZNkqYoO0rCQumcTmjl0qG65oXzIrpLWXGm68Oo+d560F7hHYXSnY10yhXN3W/IdvJ"
    "lGzHWNXysTmjUjmJJmuGM4IeYsIWzEsoa4n5yRyfc+zLLktj486YdmbKrBhH6l6t7h3zHEOvjlDXStpRx7RW7B7frujWbGZiTneO"
    "GfN1LJOxUoCnsNmq+bOQbLLzlmfMsk7Fm8wCtttq55DuzY1Qosk5cuEin7lmDz0yWcm1/+ftq5uVMmtmVfYl1zOqqz3Mg6GXsZn5"
    "9iJphuSZA6TMHMDizxQoOFMosP2gQrHcM0WSiiSf3kfJ05/QD+UsNp189jQF2cxbZVJ1z3MoeMH2sDIULGG2xj0KlCq66zKxXYNC"
    "JduyMDSKIfAMyxsqG26JomXTbaR0zBrePn6z5q1jJccwLAoza8kzXB5NzGG41NqIJpAX9bFL1tJhvWpQF7vyG5hE/Y7JF4faYB/V"
    "cZ/PGivZpm3by1vjJc9cME7iprEvUwj2cWPRo3YEzTuNF5jBHs6Xpw3Xrjslv54W051onB/UbrpsiVcZMyZ2eMU4bp9wDYfUivGg"
    "R8GKYc16c6RWddMipaov4gNRyLKHHHSKVHYfk2xfIsWuexSq+T2ncE13XNwmHkV4xFpDKtu1FYtaHNGzIbNMAcecnfOo12XTUa0h"
    "yTXKBX0J9e1vHCMUcCuGUSPVY0MOe7a/wKR4do0CC3qljgFe1k1vynbyZYwncNkxPQMHfaiNDrMjN3TgxtDBxYNfGb1+/cr169cv"
    "ZSkuUej+4pP4KWZzhbH15sG6XBvJZg8OyfF1xaJZLN7IPpVbmzsoW+toe4Af9iiQvSIl2vF3g5V8UupoZ39b2ouZw/LSy4fXD2M3"
    "hqW5Xqknxr/DPvqI+n5UCv8zKkVuxqDt8abnRkMb7wfYs6PxjoB1uvGeQKXb7wqYNt4XBOn2OwMl7sf8maX5ZR5AHNR8n33fxtdj"
    "PAP9/91kzW+XvWNQRH7+vVu7/X2cRMy/p4v62fuM/wFQSwECFAMUAAAACAAAAEFdeZVXoqIJAAAIEQAACwAAAAAAAAAAAAAAgAEA"
    "AAAAY2xhc3Nlcy5kZXhQSwUGAAAAAAEAAQA5AAAAywkAAAAA"
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
        recs.append({"ongoing": bool(flags & 0x42), "text": " / ".join(texts)[:200], "t": max(ts) if ts else 0})   # 0x2 진행 중, 0x40 포그라운드 서비스
    return recs


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
        sig = self.sender.voice_signals()
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

    def renew_due(self, dt, ts):
        hours = float(self.v.get("renew_hours") or 47.5)
        since = float(self.st.get("since_ts") or 0)
        if not since or ts - since < hours * 3600 or ts < self.renew_retry_at:
            return False
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
            self.renew_retry_at = ts + 1800
            self.log("보이스룸 갱신 실패: %s. 30분 뒤 다시" % e)
            return "renew-fail"
        if how == "created":
            self.st["made"] = ((self.st.get("made") or []) + [dt.astimezone(KST).strftime("%Y-%m-%d %H:%M")])[-50:]
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


class AdbSender:
    """태블릿(또는 폰) 안의 Termux 에서 돈다. adb 로 같은 기기에 붙어 화면을 읽고(uiautomator dump) 누른다(input)"""
    TMP = "/data/local/tmp/excer_ui.xml"
    JAR = "/data/local/tmp/excer_dump.jar"
    diag_path = None                                             # 안 될 때 그때 화면을 적을 파일(main 이 정한다)

    def __init__(self, cfg, log, run=None):
        self.t, self.log, self.sleep = cfg["tablet"], log, time.sleep
        self.run = run or self._run
        self.serial = ""
        self.trace = []                                          # 안 될 때 원인을 보려고 지나온 화면을 모아 둔다
        self.fast = None                                         # 화면 읽기 도우미: None 아직 모름, True 됨, False 이 기기에서 안 됨(기본 방식만)
        self.fast_fail = 0

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
            nodes = self._nodes(ET.fromstring(out[i:j + len("</hierarchy>")]))
        except ET.ParseError as e:
            return None, str(e)
        return (nodes, "") if nodes else (None, "빈 화면")

    def dump(self):
        """지금 화면의 요소들. 도우미로 먼저 읽고(바빠도 읽힘), 안 되면 기본 uiautomator dump 로(화면이 1초 멈출 때까지 기다림)"""
        if self.fast is None:
            self.fast = self.install_dumper() or False
        last = ""
        for _ in range(6):
            if self.fast:
                out = self.sh("rm -f %s; CLASSPATH=/system/framework/uiautomator.jar:%s app_process /system/bin ExcerDump %s 200 1200 "
                              ">/dev/null 2>&1; cat %s 2>/dev/null; true" % (self.TMP, self.JAR, self.TMP, self.TMP), timeout=30)
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
                     "cls": a.get("class", ""), "click": a.get("clickable") == "true", "pkg": a.get("package", ""),
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
        self.sh("input tap %d %d" % self.center(n))
        self.sleep(0.6)

    def hold(self, n, ms=1000):
        x, y = self.center(n)
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

    def chat_tab(self, nodes):
        """아래(또는 옆) 메뉴의 '채팅'. 이름이 '채팅 탭', '채팅, 새 메시지 3개' 처럼 붙어 나오는 판도 있다"""
        k = [n for n in nodes if n.get("pkg") == self.t["package"]]
        c = find(k, desc="채팅") or find(k, text="채팅") or [n for n in k if re.match(r"^채팅(\s*탭)?\s*(,|$)", n["desc"])]
        return c[0] if c else None

    def launch(self):
        """화면을 켜고 카카오톡을 앞으로. 뜨는 중이면 조금 더 기다린다(화면이 꺼져 있어도 된다, 잠금만 없으면)"""
        self.key(224)
        self.sh("monkey -p %s -c android.intent.category.LAUNCHER 1" % self.t["package"])
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
        l0 = min(n["b"][0] for n in e)
        hgt = max(n["b"][3] for n in nodes)
        return any(n["text"].strip() == room and n["b"][0] >= l0 - 60 and n["b"][1] < hgt * 0.12 for n in nodes)

    def goto_list(self, nodes=None):
        nodes, launched = (nodes, 0) if nodes is not None else ([], 0)
        for _ in range(8):
            if not self.on_kakao(nodes):                         # 카카오톡을 앞으로
                if launched >= 3:
                    break
                nodes = self.launch()
                launched += 1
                continue
            tab = self.chat_tab(nodes)
            if tab:
                self.tap(tab)
                return self.wait_change(nodes, tries=3)
            self.key(4)                                          # 폰은 방 안이면 뒤로 가서 목록으로, 알림 창이면 닫는다
            self.sleep(0.8)
            nodes = self.dump()
        self.save_diag(nodes)
        why = "카카오톡이 앞으로 나오지 않음" if not self.on_kakao(nodes) else "'채팅' 단추를 찾지 못함"
        raise KakaoError("카카오톡 채팅 목록 화면으로 가지 못함(%s)%s" % (why, self.diag_note()))

    @staticmethod
    def list_right(nodes):
        """채팅 목록 칸의 오른쪽 끝. 태블릿은 목록 옆에 방이 열려 있으니 그 입력 칸 왼쪽까지"""
        e = find(nodes, cls="EditText")
        return min(n["b"][0] for n in e) if e else 10 ** 9

    def room_item(self, nodes, room):
        # 이름이 똑같은 방만(앞부분만 같은 다른 방으로 보내지 않게). 화면 글자는 잘려 보여도 이름 전체가 들어온다
        right = self.list_right(nodes) + 5
        c = [n for n in find(nodes, text=room) if n["b"][2] <= right]
        return min(c, key=lambda n: (n["b"][1], n["b"][0])) if c else None

    def scroll_list(self, nodes):
        l = min(n["b"][0] for n in nodes)
        t = min(n["b"][1] for n in nodes)
        r = min(max(n["b"][2] for n in nodes), self.list_right(nodes))
        b = max(n["b"][3] for n in nodes)
        x = (l + r) // 2
        self.sh("input swipe %d %d %d %d 400" % (x, t + (b - t) * 3 // 4, x, t + (b - t) // 3))
        self.sleep(0.8)

    def wait_change(self, nodes, ok=None, tries=4):
        """누른 뒤 화면이 바뀔 때까지(또는 ok(새 화면) 가 참일 때까지) 기다린다. 바로 읽으면 바뀌기 전 화면을 읽는다"""
        old = [(n["b"], n["text"]) for n in nodes]
        new = nodes
        for _ in range(tries):
            self.sleep(0.8)
            new = self.dump()
            if ok and ok(new):
                return new
            if not ok and [(n["b"], n["text"]) for n in new] != old:
                self.sleep(0.6)                                  # 바뀌는 중일 수 있어 한 번 더
                return self.dump()
        return new

    def goto_open_list(self, nodes, room=None):
        """오픈채팅 목록으로. 채팅 목록 위의 '오픈채팅' 칸이 있는 판, 아래 메뉴 '지금'(오픈채팅) 안의 '오픈채팅' 칸인 판"""
        k = [n for n in nodes if n.get("pkg") == self.t["package"]]
        ok = (lambda ns: self.room_item(ns, room) is not None) if room else None
        sub = find(k, text="오픈채팅")
        if not sub:
            nav = [n for n in k if re.match(r"^(지금|오픈채팅)(\s*탭)?\s*(,|$)", n["desc"])] or find(k, text="지금")
            if not nav:
                return None
            self.tap(nav[0])
            nodes = self.wait_change(nodes, ok)
            self.snap("오픈채팅 메뉴를 누른 뒤", nodes)
            if ok and ok(nodes):
                return nodes
            sub = find(nodes, text="오픈채팅")
            if not sub:
                return nodes
        self.tap(sub[0])
        nodes = self.wait_change(nodes, ok)
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
            if len(texts) >= 2 and texts[0] not in NAV_WORDS and texts[0] not in names:
                names.append(texts[0])
        return names

    def open_room(self, room):
        self.trace = []
        nodes = self.voice_guard(self.launch())                  # 보이스룸 화면이 앞에 떠 있으면 최소화만(나가기는 안 누른다)
        if self.room_open(nodes, room):                          # 지난번에 연 방이 그대로면 목록을 거치지 않는다
            return nodes
        nodes = self.goto_list(nodes)
        self.snap("채팅 목록", nodes)
        item = self.room_item(nodes, room)
        chat_nodes = nodes
        if not item:                                             # 오픈채팅 목록부터(알릴 방은 오픈채팅)
            op = self.goto_open_list(nodes, room)
            if op:
                nodes = op
                item = self.room_item(nodes, room)
        for i in range(8):                                       # 그래도 없으면 지금 목록을 밀어 가며
            if item:
                break
            self.scroll_list(nodes)
            nodes = self.dump()
            item = self.room_item(nodes, room)
        if not item:
            self.save_diag(nodes)
            raise KakaoError("채팅 목록에서 '%s' 방을 찾지 못함(방 이름이 똑같은지 확인)%s" % (room, self.diag_note()))
        self.tap(item)
        nodes = self.wait_change(nodes, lambda ns: bool(find(ns, cls="EditText")))
        if not find(nodes, cls="EditText"):
            self.save_diag(nodes)
            raise KakaoError("방은 열었는데 입력 칸이 없음%s" % self.diag_note())
        return nodes

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
        return self.own_bubble(nodes, text) is not None

    def chat_area(self, nodes):
        """대화가 흐르는 칸: 입력 칸과 같은 가로 범위, 방 이름 머리 아래부터 입력 칸 위까지"""
        e = find(nodes, cls="EditText")
        box = max(e, key=lambda n: n["b"][3])
        l0, r0 = min(n["b"][0] for n in e), max(n["b"][2] for n in e)
        hgt = max(n["b"][3] for n in nodes)
        top = int(hgt * 0.16)
        return l0, top, r0, box["b"][1] - 10

    def freeze(self, nodes, amount=0.07):
        """대화를 아주 조금 위로(손가락은 아래로) 올린다. 맨 아래가 아니면 카카오톡은 새 글이 와도 화면을 내리지 않는다.
        많이 올리면 방금 보낸 글이 아래로 밀려 안 보이니 조금만"""
        l, t, r, b = self.chat_area(nodes)
        x, h = (l + r) // 2, b - t
        y1 = t + int(h * 0.35)
        self.sh("input swipe %d %d %d %d 250" % (x, y1, x, y1 + int(h * amount)))
        self.sleep(0.5)

    def bubble(self, nodes, text):
        """방금 보낸 목록 말풍선: 방(입력 칸과 같은 가로 범위) 안에서 글 전체가 같은 것 중 가장 아래.
        채팅 목록의 미리보기와 위쪽 공지 띠는 빠진다. 아주 긴 글이 잘려 보이면 앞부분이 같은 것"""
        e = find(nodes, cls="EditText")
        l0, r0 = (min(n["b"][0] for n in e), max(n["b"][2] for n in e)) if e else (-1, 10 ** 9)
        want = ws(text)
        inside = [n for n in nodes if l0 - 10 <= self.center(n)[0] <= r0 + 10 and n["text"] and not n["cls"].endswith("EditText")]
        c = [n for n in inside if ws(n["text"]) == want]
        if not c:
            c = [n for n in inside if len(ws(n["text"])) >= 60 and want.startswith(ws(n["text"]).rstrip(". "))]
        if not c:
            raise KakaoError("보낸 목록 말풍선을 화면에서 찾지 못함")
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
        first = ws(text.split("\n")[0])
        for n in pane:
            t = ws(n["text"]).rstrip(".\u2026 ")
            if (n["b"][1] > top + (bottom - top) * 0.22 or n["b"][3] - n["b"][1] > (bottom - top) * 0.12
                    or len(t) < 6 or n["cls"].endswith("EditText") or n["b"] in skip):
                continue
            if ws(n["text"]).startswith(first) or first.startswith(t):
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
        """'공지가 등록되었습니다' 카드 중 카드 안 글이 이 글(첫 줄)인 것"""
        first = ws(text.split("\n")[0])
        out = []
        for h, t in self.card_text_of(nodes):
            if ws(t["text"]).startswith(first) and h not in out:
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
        x, h = (l + r) // 2, b - t
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

    def own_bubble(self, nodes, text):
        """봇이 보낸 글: 글 전체가 같은 말풍선 중 가장 아래('공지가 등록되었습니다' 카드 안 글은 뺀다). 없으면 None"""
        inside = {id(t) for _, t in self.card_text_of(nodes)}
        try:
            n = self.bubble([x for x in nodes if id(x) not in inside], text)
        except KakaoError:
            return None
        return n

    def find_own(self, nodes, text, tries=6):
        """멈춘 화면에서 봇 글을 찾는다. 이미 위로 밀려 안 보이면 대화를 조금씩 위로 올려 가며(자리가 아니라 글자로)"""
        target = self.own_bubble(nodes, text)
        for _ in range(tries):
            if target:
                break
            self.freeze(nodes, 0.35)                             # 이미 위로 밀려 올라갔으면 조금씩 위로
            nodes = self.dump()
            target = self.own_bubble(nodes, text)
        return nodes, target

    def banner_text(self, nodes):
        """방 위쪽 공지 띠의 글(방 이름 머리 바로 아래 한 줄). 없으면 ''"""
        e = find(nodes, cls="EditText")
        if not e:
            return ""
        l0, r0 = min(n["b"][0] for n in e), max(n["b"][2] for n in e)
        hgt = max(n["b"][3] for n in nodes)
        c = [n for n in nodes if n["text"].strip() and l0 - 60 <= n["b"][0] and n["b"][2] <= r0 + 200
             and hgt * 0.045 < n["b"][1] < hgt * 0.085 and n["b"][3] - n["b"][1] < hgt * 0.06 and not n["cls"].endswith("EditText")]
        return ws(max(c, key=lambda n: n["b"][2] - n["b"][0])["text"]) if c else ""   # 띠 안에서 가장 넓은 글(앞의 '공지' 표시 글자는 빼고)

    def notice(self, room, text):
        self.key(224)
        self.sleep(1.0)
        nodes = self.dump()
        self.trace = []                                          # 공지 단계만 남긴다(안 될 때 보낼 파일이 짧게)
        e = find(nodes, cls="EditText")
        l0 = min([n["b"][0] for n in e] or [0])
        hgt = max([n["b"][3] for n in nodes] or [0])
        self.snap("방 위쪽(공지 띠 자리)", [n for n in nodes if n["b"][1] < hgt * 0.3 and self.center(n)[0] >= l0 - 10])
        nodes, target = self.find_own(nodes, text)
        if not target:
            self.save_diag(nodes)
            raise KakaoError("보낸 글을 화면에서 찾지 못함(위로 올려 가며 찾았는데 없음)%s" % self.diag_note())
        for _ in range(3):                                       # 그래도 밀리는 중이면(화면이 덜 멈춤) 멈출 때까지
            again = self.dump()
            t2 = self.own_bubble(again, text)
            if t2 and t2["b"] == target["b"]:
                break
            if not t2:
                again, t2 = self.find_own(again, text)
                if not t2:
                    raise KakaoError("보낸 글이 화면에서 밀려 사라짐")
            nodes, target = again, t2
            self.sleep(0.6)
        pre = self.pinned(nodes, text, {target["b"]})            # 첫 줄이 같은 공지가 이미 걸려 있으면 띠로는 바뀐 것을 알 수 없다
        first = ws(text.split("\n")[0])
        skip = {n["b"] for n in nodes if ws(n["text"]).startswith(first)}   # 원래 있던 같은 글(말풍선)은 공지 띠로 치지 않는다
        self.hold(target, 1000)
        menu = self.wait_change(nodes, lambda ns: bool(self.labeled(ns, ("공지", "공지 등록", "공지로 등록"), nodes)), tries=3)
        self.snap("말풍선을 길게 누른 뒤(새로 나온 것)", menu, nodes)
        m = self.labeled(menu, ("공지", "공지 등록", "공지로 등록"), nodes)
        if not m:
            self.key(4)
            self.save_diag()
            raise KakaoError("메뉴에 '공지'가 없음(봇 계정이 이 방의 방장이나 부방장인지 확인)%s" % self.diag_note())
        self.tap(m[0])
        wrong = lambda ns: bool(self.banner_text(ns)) and not (self.banner_text(ns).startswith(first) or first.startswith(self.banner_text(ns).rstrip(".\u2026 ")))
        ok = lambda ns: not wrong(ns) and (self.registered(ns, nodes, text) or (not pre and self.pinned(ns, text, skip)))
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
            self.to_bottom(done)
            bottom = self.dump()
            if not wrong(bottom) and self.registered_below(bottom, text):
                return
            done = bottom
        if wrong(done) and self.banner_text(done) != self.banner_text(nodes):
            self.snap("마지막 화면(새로 나온 것)", done, nodes)
            self.save_diag()
            raise KakaoError("공지 띠가 다른 글로 바뀜(봇 글이 아닌 글이 걸렸을 수 있음). 다시 겁니다%s" % self.diag_note())
        if pre and c:
            return                                               # 같은 첫 줄 공지가 이미 있어 띠로는 알 수 없고, 확인은 눌렀다
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
            if t and t not in keep and not t.startswith(("[다음 벙]", "공지", "채팅방 상단")) and (len(t) > (6 if private else 20)):
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
        tab = self.chat_tab(nodes)
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
                            ttext = "[다음 벙] 톡게시판 공지 시험 " + time.strftime("%H:%M")
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
        bubbles = [n for n in nodes if ws(n["text"]).startswith("[다음 벙]") and n["b"][0] >= l0 - 60 and n["b"][1] > hgt * 0.25 and id(n) not in inside]
        if bubbles:                                              # 봇이 올린 말풍선을 길게 눌러 메뉴, '공지' 를 누른 뒤 창은 '아니요' 로 닫는다
            target = max(bubbles, key=lambda n: n["b"][3])
            self.hold(target, 1000)
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
            out.append("== 11 '[다음 벙]' 말풍선이 화면에 없어 길게 누르기는 건너뜀\n")
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

    def voice_ui(self, nodes):
        """보이스룸 화면인지(나가기나 마이크 단추가 있음)"""
        return self.vpick(nodes, self.VOICE_LEAVE) is not None or self.vpick(nodes, ("마이크 끄기", "마이크 켜기", "음소거")) is not None

    def voice_close_dialog(self, nodes):
        """보이스룸 오류나 종료 안내 창이면 확인으로 닫는다. 다른 창은 건드리지 않는다"""
        if self.VOICE_ERR_RE.search(" ".join(n["text"] for n in nodes if n["text"])):
            ok = self.vpick(nodes, ("확인", "닫기", "네"))
            if ok:
                self.snap("보이스룸 안내 창", nodes)
                self.tap(ok)
                return self.wait_change(nodes, tries=2)
        return nodes

    def voice_guard(self, nodes):
        """공지 흐름이 시작될 때 보이스룸 화면이 앞에 떠 있으면 최소화하고 방으로. 나가기는 누르지 않는다"""
        if self.on_kakao(nodes) and self.voice_ui(nodes) and not find(nodes, cls="EditText"):
            return self.voice_minimize(nodes)
        return nodes

    def voice_minimize(self, nodes):
        mn = self.vpick(nodes, self.VOICE_MIN)
        if mn:
            self.tap(mn)
        else:
            self.key(4)
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

    def voice_create(self, nodes, title, word):
        """방에서 + 메뉴, 보이스룸, (제목), 시작. 보이스룸 화면을 돌려준다. 안 되면 화면을 적고 KakaoError"""
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
        if not self.voice_ui(scr):
            self.save_diag(scr)
            raise KakaoError("시작을 눌렀는데 보이스룸 화면이 아님" + self.diag_note())
        return scr

    def voice_recover(self, room, v=None):
        """끊긴 보이스룸을 다시 켠다. 띠에 '참여' 가 있으면(다른 진행자가 열어 둠) 참여, 없으면 새로 만든다.
        돌려주는 것: on(이미 켜져 있음), joined, created, kicked(내보내진 것으로 보임). 안 되면 KakaoError(지나온 화면은 excer_bot_ui.txt)"""
        v = v or {}
        w = voice_words(v)
        title = v.get("title") or DEFAULTS["voice"]["title"]
        if voice_state(self.voice_signals(), v)[0] == "on":    # 신호로 켜져 있으면 화면을 건드리지 않는다
            return "on"
        self.trace = []
        try:
            nodes = self.launch()
            self.snap("카카오톡을 띄운 화면", nodes)
            nodes = self.voice_close_dialog(nodes)
            if self.voice_ui(nodes):                            # 보이스룸 화면이 앞에 떠 있음: 아직 켜져 있을 수 있다
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
                if not self.voice_ui(scr):
                    self.save_diag(scr)
                    raise KakaoError("참여를 눌렀는데 보이스룸 화면이 아님" + self.diag_note())
                how = "joined"
            else:
                scr = self.voice_create(nodes, title, w["word"])
                how = "created"
            if v.get("mute", True):
                scr = self.voice_mute(scr)
            if v.get("volume0", True):
                self.voice_volume0()
            if not self.voice_wait_on(v):
                self.save_diag(scr)
                raise KakaoError("보이스룸을 %s 했는데 '%s' 알림이 안 보임%s" % ("만들기" if how == "created" else "참여", w["on"], self.diag_note()))
            self.voice_minimize(scr)
            return how
        finally:
            self.done()

    def voice_end(self, room, v=None):
        """켜 둔 보이스룸을 끝낸다(48시간 갱신). 봇이 진행자라 나가면 끝난다: 나가기, 종료 확인"""
        v = v or {}
        w = voice_words(v)
        self.trace = []
        try:
            nodes = self.voice_close_dialog(self.launch())
            scr = nodes if self.voice_ui(nodes) else None
            if scr is None:
                nodes = self.open_room(room)
                tag = [n for n in nodes if (w["word"] in n["text"] or w["word"] in n["desc"]) and n["click"]]
                if not tag:
                    self.save_diag(nodes)
                    raise KakaoError("방에서 보이스룸 띠를 찾지 못함" + self.diag_note())
                self.tap(tag[0])
                scr = self.wait_change(nodes, tries=3)
                if not self.voice_ui(scr):
                    self.save_diag(scr)
                    raise KakaoError("띠를 눌렀는데 보이스룸 화면이 아님" + self.diag_note())
            leave = self.vpick(scr, self.VOICE_LEAVE)
            if not leave:
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

    def done(self):
        """올리고 나면 Termux 를 앞으로(기록이 보이게, 다음 명령을 치게). return_to 를 "" 로 두면 카카오톡에 머문다"""
        app = self.t.get("return_to") or ""
        if app:
            try:
                self.sh("monkey -p %s -c android.intent.category.LAUNCHER 1" % app)
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
        return out

    @staticmethod
    def rows(nodes):
        return ["%s | 글자=%s | 이름=%s | id=%s | 누름=%s | %s | %s" % (n["cls"].split(".")[-1], n["text"][:60].replace("\n", " / "), n["desc"], n["rid"],
                "예" if n["click"] else "", "[%d,%d][%d,%d]" % n["b"], n.get("pkg", "")) for n in nodes
                if n["text"] or n["desc"] or n["rid"] or n["click"] or n["cls"].endswith("EditText")]

    def dump_file(self, path, nodes=None):
        rows = self.rows(self.dump() if nodes is None else nodes)
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(rows))
        return len(rows)

    def snap(self, label, nodes, before=None):
        """지나온 화면 한 장. before 를 주면 그때 없던 요소만(메뉴, 확인 창)"""
        if before is not None:
            seen = {(n["b"], n["text"], n["desc"]) for n in before}
            nodes = [n for n in nodes if (n["b"], n["text"], n["desc"]) not in seen]
        self.trace = (self.trace + [(label, self.rows(nodes)[:120])])[-8:]

    def save_diag(self, nodes=None):
        if not self.diag_path:
            return
        if nodes is not None:
            self.snap("마지막 화면", nodes)
        out = []
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
    save_json(cfg_path, cfg)
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
    if op == "soon":                                    # 3분 뒤 시작: 시작하면 공지 첫 줄이 다음 벙으로 넘어가는지 본다
        n = max([r.get("id", 900000) for r in rows] + [900000]) + 1
        at = now + timedelta(minutes=3)
        rows.append({"id": n, "title": "곧 시작 시험 벙 %d" % (n - 900000), "author": "시험", "created_at": now.strftime("%Y-%m-%dT%H:%M:%S+09:00"),
                     "meta": {"kind": "bung", "date": at.strftime("%Y-%m-%d"), "time": at.strftime("%H:%M"), "place": "시험 장소", "cap": 4}})
        save_json(path, rows)
        print("고쳤습니다: %s 에 시작하는 벙. 곧 공지 첫 줄에 오고, %s 가 지나면 다음 벙으로 넘어갑니다." % (at.strftime("%H:%M"), at.strftime("%H:%M")))
        return
    if op == "add":
        n = max([r.get("id", 900000) for r in rows] + [900000]) + 1
        rows.append({"id": n, "title": "시험 벙 %d" % (n - 900000), "author": "시험", "created_at": now.strftime("%Y-%m-%dT%H:%M:%S+09:00"),
                     "meta": {"kind": "bung", "date": (now + timedelta(days=1 + (n - 900000) % 5)).strftime("%Y-%m-%d"), "time": "19:00", "place": "시험 장소 %d" % (n - 900000), "cap": 6}})
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
        elif op == "full":                               # 정원을 채운다(다음 벙으로 넘어가는지)
            cap = int((r.get("meta") or {}).get("cap") or 4)
            r.setdefault("meta", {})["cap"] = cap
            r["attend_count"] = cap
            what = "%s 정원 %d명 다 참" % (r["title"], cap)
        elif op == "deadline":                           # 2분 뒤 신청 마감(그 시각이 지나면 다음 벙으로 넘어가는지)
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
    ap.add_argument("command", choices=["setup", "connect", "check", "list", "test", "run", "once", "sample-feed", "feed", "ui", "study", "calibrate", "voice"])
    ap.add_argument("arg", nargs="?", default="", help="connect: 무선 디버깅 포트, feed: add, change, close, del, soon, full, deadline, voice: study, status, on, off")
    ap.add_argument("--config", default=os.path.join(HERE, "excer_bot.json"))
    ap.add_argument("--test", action="store_true", help="run, once: 알릴 방 대신 시험 방으로(기록도 따로)")
    ap.add_argument("--feed", default="", help="사이트 대신 이 파일의 글을 읽는다(시험용, sample-feed 로 만든다)")
    a = ap.parse_args(argv)
    cfg = load_cfg(a.config)
    base = os.path.splitext(a.config)[0]
    log = Log(base + ".log")
    AdbSender.diag_path = base + "_ui.txt"
    if a.command == "setup":
        return cmd_setup(cfg, a.config)
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
        save_json(a.config, cfg)
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
                 "meta": {"kind": "bung", "date": (today + timedelta(days=1)).strftime("%Y-%m-%d"), "time": "19:00", "place": "시험 장소", "cap": 4}}]
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
                except KakaoError as e:                 # 못 가도 지금 화면은 적는다(원인 찾기용)
                    err = e
                n = sender.dump_file(base + "_ui.txt")
            finally:
                sender.done()
            if err:
                print("안 됨:", err)
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
            save_json(a.config, cfg)
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
    if a.command == "once":
        log("한 번 봄: " + bot.cycle())
        return
    log("켬: %s 방%s, %s 방식, %d초마다 %s 확인" % (room, "(시험)" if a.test else "", cfg["backend"], int(cfg.get("check_sec", 20)), "시험 파일" if a.feed else "사이트"))
    voice = None
    if (cfg.get("voice") or {}).get("on"):
        if isinstance(bot.sender, AdbSender):
            voice = VoiceWatch(cfg, bot.sender, base + "_voice.json", log)
            log("보이스룸 지키기: %d초마다 보고, 끊기면 %s(방: %s, 제목: %s)" % (max(15, int(voice.v.get("check_sec") or 60)), "다시 켠다" if voice.can_recover() else "기록만", voice.room, voice.v.get("title") or DEFAULTS["voice"]["title"]))
        else:
            log("보이스룸 지키기는 tablet 방식에서만 돈다")
    wake_lock(True)                                     # Termux 가 잠들지 않게(태블릿일 때만 있는 명령)
    try:
        run_loop(bot, log, voice)
    finally:
        wake_lock(False)


def cmd_voice(cfg, a, base, log):
    sub = a.arg
    if sub in ("on", "off"):
        cfg.setdefault("voice", {})["on"] = sub == "on"
        save_json(a.config, cfg)
        title = cfg["voice"].get("title") or DEFAULTS["voice"]["title"]
        print("보이스룸 지키기: " + ("켬. run 이 끊김을 알아채 다시 켭니다. 만들 때 제목: " + title if sub == "on" else "끔"))
        return
    if sub not in ("study", "status", "raw", "now"):
        raise SystemExit("python excer_bot.py voice study | status | raw | now | on | off")
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


def wake_lock(on):
    import shutil
    cmd = "termux-wake-lock" if on else "termux-wake-unlock"
    if shutil.which(cmd):
        try:
            subprocess.run([cmd], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
        except (OSError, subprocess.SubprocessError):
            pass


def run_loop(bot, log, voice=None):
    while True:
        try:
            if bot.due():
                r = bot.cycle()
                if r not in ("none", "quiet"):
                    log("차례: " + r)
            if voice and voice.due():
                voice.tick()                            # 보이스룸 끊김은 tick 안에서 적는다
        except KeyboardInterrupt:
            raise
        except Exception as e:
            log("오류: %s" % e)
        time.sleep(2)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("멈춤")
    except KakaoError as e:                             # 파이썬 오류 화면 대신 무엇이 안 됐는지만
        print("안 됨:", e)
        sys.exit(1)
