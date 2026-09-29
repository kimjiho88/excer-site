#!/usr/bin/env python3
"""
excer-bot: 사이트의 모임 모집(벙) 글을 늘 지켜보다가 오픈채팅방에 벙 일정을 올리고 공지로 건다.

봇 계정(excer-bot)으로 로그인한 카카오톡을 이 파이썬이 대신 조작한다.
카카오톡에는 오픈채팅에 글을 올리거나 공지를 거는 공개 연결이 없어서, 사람이 하듯 화면을 조작한다.
  android  안드로이드 폰이나 태블릿(USB 디버깅)의 카카오톡을 uiautomator2 로. 방은 늘 채팅 목록에서 눌러 열고,
           보낸 목록 말풍선을 글자로 찾아 길게 눌러 공지로 건다.
  pc       윈도우 PC 카카오톡. 방 창을 앞으로 가져와 붙여넣고 보낸다. 공지는 보낸 메시지를 우클릭해 건다
           (처음에 calibrate 로 메뉴 자리를 한 번 잡는다. 우클릭한 메시지를 복사해 봇이 보낸 글인지 확인한 뒤에만 건다).
  dry      보내지 않고 화면에 찍기만(시험용).

하는 일
  - 20초마다 사이트를 읽는다(check_sec). 새 벙, 날짜와 시간과 장소 바뀜, 마감, 마감 풀림, 지워진 벙이 보이면
    곧바로 다가오는 벙 목록을 올리고 공지로 건다. 첫 줄에 무엇이 바뀌었는지, 줄 끝에 (새), (바뀜: 시간) 을 단다.
  - 한 번 올린 뒤 1분 안에 또 바뀌면 모았다가 1분이 지나면 올린다(min_gap_sec). 글을 쓰고 바로 고치는 경우.
  - 매일 10시에 목록을 한 번 더 올려 공지를 새로 건다(지난 벙이 빠지게). 그날 이미 올렸으면 건너뛴다. digest_at 을 "" 로 두면 안 한다.
  - 처음 켤 때 이미 올라와 있던 글은 새 벙으로 치지 않는다.
  - 보내기에 실패하면 기록을 바꾸지 않고 1분 쉬었다가 다시 보낸다.
  - 카카오톡을 건드리는 것은 올릴 것이 있을 때뿐이다.
가진 것: 없음. 사이트의 공개 글만 읽는다. 공개 접속 키는 사이트에서 읽어 온다. 운영진 비밀번호는 여기에 두지 않는다.

준비
  - 봇 계정을 방의 부방장으로 둔다(공지는 방장과 부방장만 건다).
  - 파이썬 3.8 이상. android 는 pip install uiautomator2 와 adb(Android SDK Platform-Tools), pc 는 pip install pywin32.
  - android: 봇 계정 카카오톡 기기의 USB 디버깅을 켜고 PC 에 연결. 화면 잠금 없음, 충전 중 화면 켜짐 유지, 자동 회전 끔.
  - pc: 봇 계정으로 PC 카카오톡에 로그인하고 방 창을 열어 둔다(최소화해도 된다). 윈도우 잠금은 끈다.

명령(이 파일이 있는 폴더에서)
  python excer_bot.py setup         설정 파일(excer_bot.json)을 만든다. 방식과 방 이름을 묻는다
  python excer_bot.py check         사이트와 기기 연결을 확인한다(보내지 않음)
  python excer_bot.py list          지금 목록을 찍어 본다(보내지 않음)
  python excer_bot.py test          시험 방에 지금 목록을 보내고 공지까지 걸어 본다
  python excer_bot.py run --test    시험 방으로 늘 지켜보기(알릴 방은 건드리지 않음, 기록도 따로)
  python excer_bot.py run           알릴 방으로 늘 지켜보기(멈추려면 Ctrl+C)
  python excer_bot.py sample-feed   시험 파일(excer_bot_feed.json)을 만든다. run --test --feed excer_bot_feed.json 과 함께
                                    쓰면 사이트 대신 이 파일을 읽으므로, 파일을 고쳐 새 벙, 바뀜, 마감, 지움을 흉내 낸다
  python excer_bot.py ui            (android) 지금 화면의 글자와 단추 이름을 excer_bot_ui.txt 에 적는다(안 될 때 원인 찾기용,
                                    시험 방을 띄워 놓고 쓴다. 화면에 보이는 대화 글이 들어간다)
  python excer_bot.py calibrate     (pc) 우클릭 메뉴의 복사, 공지 자리를 잡는다. 시험 방에서 한다
  python excer_bot.py once          한 번만 보고 끝낸다
기록: excer_bot_state.json(본 글, 시험은 excer_bot_test_state.json), excer_bot.log(한 일). 이 파일 옆에 생긴다.
"""
import argparse
import json
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
    "backend": "android",                # android, pc, dry
    "room": "",                          # 알릴 방 이름(카카오톡에 보이는 그대로)
    "test_room": "",                     # 시험 방(봇 계정과 나만 있는 방). test, calibrate 가 쓴다
    "notice": True,                      # 올린 목록을 공지로 걸지
    "check_sec": 20,                     # 사이트를 몇 초에 한 번 볼지
    "digest_at": "10:00",                # 매일 목록을 올릴 시각(한국 시간). "" 이면 올리지 않는다
    "digest_late_min": 180,              # 이 시각에서 이만큼 지나도록 못 올렸으면 그날은 건너뛴다
    "digest_empty": True,                # 다가오는 벙이 없어도 매일 목록을 올릴지
    "min_gap_sec": 60,                   # 한 번 올린 뒤 다음에 올리기까지(그 사이 바뀜은 모았다가)
    "quiet": [],                         # 이 사이에는 올리지 않는다. 예: ["00:00", "07:00"]. [] 이면 늘 올린다
    "max_lines": 15,                     # 목록 줄 수 한도
    "site": "https://excer-site.vercel.app",
    "supa": "https://drggzlnzwvkhtalvkqyo.supabase.co",
    "link": True,                        # 목록 끝에 벙 일정 주소(pc 에서 공지가 자주 실패하면 false: 주소 미리보기가 늦게 떠 자리가 밀린다)
    "pc": {"window": [40, 40, 460, 780], "input_dy": 80, "bubble": None, "menu_copy": None, "menu_notice": None, "confirm": None},
    "android": {"serial": "", "package": "com.kakao.talk"},
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
    return {"id": str(p["id"]), "title": clean(p.get("title"), 40) or "제목 없음", "author": clean(p.get("author"), 20),
            "date": d if DATE_RE.match(d) else "", "time": t if TIME_RE.match(t) else "",
            "place": clean(m.get("place"), 40), "cap": cap, "closed": m.get("status") == "closed",
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
        q = urllib.parse.urlencode({"select": "id,title,author,meta,created_at", "category": "eq.벙 소식",
                                    "order": "created_at.desc", "limit": "100"}, quote_via=urllib.parse.quote)
        url = self.cfg["supa"] + "/rest/v1/site_posts_v?" + q
        for fresh in (False, True):
            k = self.anon_key(fresh)
            code, body = self.get(url, {"apikey": k, "Authorization": "Bearer " + k})
            if code != 401:
                break
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
def upcoming(v, now):
    if not v["date"] or v["closed"] or v["date"] < now.ymd:
        return False
    return not (v["date"] == now.ymd and v["time"] and v["time"] < now.hm)


def undated_open(v, now):
    if v["date"] or v["closed"]:
        return False
    since = (datetime.strptime(now.ymd, "%Y-%m-%d") - timedelta(days=30)).strftime("%Y-%m-%d")
    return not v["created"] or v["created"][:10] >= since


def skey(v):
    return (v["date"], v["time"] or "99:99", int(v["id"]) if v["id"].isdigit() else 0)


def head(v):
    return (md(v["date"]) if v["date"] else "날짜 미정") + (" " + v["time"] if v["time"] else "") + " " + v["title"]


def line(v):
    return head(v) + (", " + v["place"] if v["place"] else "")


def sig(v):
    return {"d": v["date"], "t": v["time"], "p": v["place"], "c": 1 if v["closed"] else 0, "n": v["title"], "cr": v["created"]}


def noch():
    return {"new": [], "chg": [], "cls": [], "del": []}


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
            if not v["closed"] and (upcoming(v, now) or undated_open(v, now)):
                ch["new"].append(v)
            continue
        if v["date"] and v["date"] < now.ymd:
            continue                                   # 지난 벙은 알리지 않는다
        if v["closed"]:
            if not o.get("c"):
                ch["cls"].append(v)
            continue
        f = [n for n, a, b in (("날짜", o.get("d"), v["date"]), ("시간", o.get("t"), v["time"]), ("장소", o.get("p"), v["place"])) if (a or "") != (b or "")]
        if o.get("c"):
            f.append("마감 풀림")
        if f:
            ch["chg"].append((v, f))
    # 안 보이는 글: 지워졌으면 알리고, 최근 100개 밖으로 밀려난 것이면 기억해 둔다(다시 보여도 새 글로 치지 않게)
    oldest = min((v["created"] for v in posts if v["created"]), default="")
    since = (datetime.strptime(now.ymd, "%Y-%m-%d") - timedelta(days=30)).strftime("%Y-%m-%d")
    for k, o in known.items():
        if k in cur or not o or o.get("c"):
            continue
        live = (o.get("d") or "") >= now.ymd if o.get("d") else (o.get("cr") or "")[:10] >= since
        if not live:
            continue                                   # 지난 글은 잊는다
        if init and (full or (o.get("cr") and oldest and o["cr"] > oldest)):   # 읽은 범위 안의 글이 없어졌으면 지워진 것
            ch["del"].append({"id": k, "date": o.get("d") or "", "time": o.get("t") or "", "title": o.get("n") or "제목 없음", "place": o.get("p") or ""})
            continue
        cur[k] = o
    return cur, ch


def has_changes(ch):
    return bool(ch["new"] or ch["chg"] or ch["cls"] or ch.get("del"))


def compose(posts, now, ch, cfg, always=False):
    """다가오는 벙 목록. 바뀐 것이 있으면 첫 줄과 줄 끝에 적는다. 올릴 것이 없으면 빈 글"""
    items = sorted([v for v in posts if upcoming(v, now)], key=skey) + [v for v in posts if undated_open(v, now)]
    if not items and not has_changes(ch) and not always and not cfg.get("digest_empty", True):
        return ""
    new_ids = {v["id"] for v in ch["new"]}
    chg = {v["id"]: f for v, f in ch["chg"]}

    def mark(v):
        if v["id"] in new_ids:
            return " (새)"
        f = chg.get(v["id"])
        if not f:
            return ""
        rest = [x for x in f if x != "마감 풀림"]
        return " (" + ("바뀜: " + ", ".join(rest) if rest else "다시 모집") + ")"

    top = "[벙 일정] %s 기준 %s" % (md(now.ymd), ("%d건" % len(items)) if items else "올라온 벙 없음")
    summary = [("새 %d" % len(ch["new"])) if ch["new"] else "", ("바뀜 %d" % len(ch["chg"])) if ch["chg"] else "",
               ("마감 %d" % len(ch["cls"])) if ch["cls"] else "", ("삭제 %d" % len(ch.get("del", []))) if ch.get("del") else ""]
    summary = [s for s in summary if s]
    if summary:
        top += ", " + ", ".join(summary)
    mx = max(1, int(cfg.get("max_lines", 15)))
    shown = items[:mx] + [v for v in items[mx:] if v["id"] in new_ids or v["id"] in chg]   # 바뀐 것은 한도 밖이어도 보인다
    out = [top] + [line(v) + mark(v) for v in shown]
    if len(items) > len(shown):
        out.append("외 %d건" % (len(items) - len(shown)))
    out += ["마감: " + head(v) for v in ch["cls"]]
    out += ["삭제: " + head(v) for v in ch.get("del", [])]
    if cfg.get("link", True):
        out.append(("전체 " if items else "벙 올리기 ") + cfg["site"] + "/bung")
    return "\n".join(out)


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
class Bot:
    def __init__(self, cfg, sender, site, state_path, log, clock=None, room=None):
        self.cfg, self.sender, self.site, self.state_path, self.log = cfg, sender, site, state_path, log
        self.room = room or cfg["room"]
        self.clock = clock or (lambda: datetime.now(KST))
        self.st = load_state(state_path)
        self.last_check = 0.0
        self.hold_until = 0.0                           # 읽기나 보내기가 실패하면 잠시 쉰다

    def save(self):
        save_json(self.state_path, self.st)

    def due(self):
        now = Now(self.clock())
        if now.ts < self.hold_until:
            return False
        return now.ts - self.last_check >= int(self.cfg.get("check_sec", 20)) or digest_due(self.st, now, self.cfg) is True

    def cycle(self):
        """사이트를 한 번 보고 올릴 것이 있으면 올린다. 무엇을 했는지 한 낱말로 돌려준다"""
        now = Now(self.clock())
        self.last_check = now.ts
        st, cfg = self.st, self.cfg
        if in_quiet(now.hm, cfg.get("quiet")):
            return "quiet"
        try:
            posts = self.site.posts()
        except Exception as e:                          # 사이트가 흔들리면 다음 차례에
            self.log("사이트 읽기 실패: %s" % e)
            self.hold_until = now.ts + 60
            return "read-fail"
        cur, ch = diff(st.get("known", {}), posts, now, bool(st.get("init")), bool(getattr(self.site, "last_full", False)))
        if not st.get("init"):
            st.update(known=cur, init=True)
            self.save()
            self.log("처음 켬: 글 %d개를 기억함(알리지 않음)" % len(posts))
            ch = noch()
        changed = has_changes(ch)
        dg = digest_due(st, now, cfg)
        if dg == "skip" or (dg and st.get("last_post_ymd") == now.ymd and not changed):
            st["last_digest"] = now.ymd                 # 너무 늦었거나 오늘 이미 올렸다
            self.save()
            dg = False
        gap_ok = now.ts - float(st.get("last_post_at") or 0) >= int(cfg.get("min_gap_sec", 60))
        if not ((changed and gap_ok) or dg):
            if not changed:
                st["known"] = cur                       # 제목만 바뀜, 지난 글 정리
                self.save()
            return "wait" if changed else "none"
        text = compose(posts, now, ch, cfg)
        if not text:
            st.update(known=cur, last_digest=now.ymd)
            self.save()
            return "empty"
        try:
            self.sender.send(self.room, text)
        except Exception as e:
            self.log("보내기 실패(다음 차례에 다시): %s" % e)
            self.hold_until = now.ts + 60
            return "send-fail"
        st.update(known=cur, last_post_at=now.ts, last_post_ymd=now.ymd)
        if dg:
            st["last_digest"] = now.ymd
        self.save()
        self.log("올림: " + text.split("\n")[0])
        if cfg.get("notice"):
            try:
                self.sender.notice(self.room, text)
                self.log("공지로 걸었음")
            except Exception as e:
                self.log("공지 걸기 실패(목록은 올라감): %s" % e)
                return "sent-no-notice"
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
    b = cfg.get("backend", "pc")
    if b == "dry":
        return DrySender()
    if b == "android":
        return AndroidSender(cfg, log)
    if b == "pc":
        if os.name != "nt":
            raise SystemExit("pc 방식은 윈도우에서만 됩니다. excer_bot.json 의 backend 를 android 나 dry 로 바꾸세요.")
        return PcSender(cfg, log)
    raise SystemExit("backend 는 pc, android, dry 중 하나")


# ── 명령 ──
def cmd_setup(cfg, cfg_path, ask=input):
    print("excer-bot 설정. 비워 두고 엔터를 누르면 [ ] 안의 값을 씁니다.")
    b = ask("방식 android(안드로이드 폰, 태블릿) / pc(윈도우 PC 카카오톡) / dry(시험) [%s]: " % cfg["backend"]).strip() or cfg["backend"]
    cfg["backend"] = b
    rooms = []
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


def main(argv=None):
    ap = argparse.ArgumentParser(description="사이트의 벙 일정을 늘 지켜보다가 오픈채팅방에 올리고 공지로 건다")
    ap.add_argument("command", choices=["setup", "check", "list", "test", "run", "once", "sample-feed", "ui", "calibrate"])
    ap.add_argument("--config", default=os.path.join(HERE, "excer_bot.json"))
    ap.add_argument("--test", action="store_true", help="run, once: 알릴 방 대신 시험 방으로(기록도 따로)")
    ap.add_argument("--feed", default="", help="사이트 대신 이 파일의 글을 읽는다(시험용, sample-feed 로 만든다)")
    a = ap.parse_args(argv)
    cfg = load_cfg(a.config)
    base = os.path.splitext(a.config)[0]
    log = Log(base + ".log")
    if a.command == "setup":
        return cmd_setup(cfg, a.config)
    if a.command == "sample-feed":
        path = a.feed or base + "_feed.json"
        today = datetime.now(KST)
        rows = [{"id": 900001, "title": "시험 벙", "author": "시험", "created_at": today.strftime("%Y-%m-%dT%H:%M:%S+09:00"),
                 "meta": {"kind": "bung", "date": (today + timedelta(days=1)).strftime("%Y-%m-%d"), "time": "19:00", "place": "시험 장소", "cap": 4}}]
        save_json(path, rows)
        print("만들었습니다:", path)
        print("python excer_bot.py run --test --feed %s 로 켠 뒤, 이 파일을 메모장으로 열어 고치고 저장하면 20초 안에 시험 방에 올라옵니다." % os.path.basename(path))
        return
    site = FileSite(a.feed) if a.feed else Site(cfg)
    now = lambda: Now(datetime.now(KST))
    if a.command == "list":
        print(compose(site.posts(), now(), noch(), cfg, always=True))
        return
    if a.command == "check":
        try:
            ps = site.posts()
            print("사이트: 모임 모집 글 %d개 읽음, 다가오는 벙 %d개" % (len(ps), sum(1 for v in ps if upcoming(v, now()))))
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
    if a.command == "ui":
        sender = make_sender(cfg, log)
        if not isinstance(sender, AndroidSender):
            raise SystemExit("ui 는 android 방식에서 씁니다.")
        n = sender.dump(base + "_ui.txt")
        print("화면 요소 %d개를 %s 에 적었습니다." % (n, base + "_ui.txt"))
        return
    if a.command in ("calibrate", "test"):
        room = cfg.get("test_room") or ""
        if not room:
            raise SystemExit("excer_bot.json 의 test_room(시험 방)을 먼저 넣으세요(setup).")
        sender = make_sender(cfg, log)
        text = compose(site.posts(), now(), noch(), cfg, always=True)
        if a.command == "calibrate":
            if not isinstance(sender, PcSender):
                raise SystemExit("calibrate 는 pc 방식에서만 필요합니다.")
            cfg["pc"] = sender.calibrate(room, text)
            save_json(a.config, cfg)
            print("저장했습니다. python excer_bot.py test 로 확인하세요.")
            return
        sender.send(room, text)
        log("시험 방에 보냄")
        if cfg.get("notice"):
            sender.notice(room, text)
            log("시험 방에 공지를 걸었음. 방 위쪽 공지를 확인하세요.")
        return
    room = cfg.get("test_room") if a.test else cfg.get("room")
    if not room:
        raise SystemExit("excer_bot.json 의 %s 을 먼저 넣으세요(setup)." % ("test_room(시험 방)" if a.test else "room(알릴 방)"))
    bot = Bot(cfg, make_sender(cfg, log), site, base + ("_test_state.json" if a.test else "_state.json"), log, room=room)
    if a.command == "once":
        log("한 번 봄: " + bot.cycle())
        return
    log("켬: %s 방%s, %s 방식, %d초마다 %s 확인" % (room, "(시험)" if a.test else "", cfg["backend"], int(cfg.get("check_sec", 20)), "시험 파일" if a.feed else "사이트"))
    while True:
        try:
            if bot.due():
                r = bot.cycle()
                if r not in ("none", "quiet"):
                    log("차례: " + r)
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
