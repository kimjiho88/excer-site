/* ===================================================================
   좀비 헌팅 RPG · 2단계 클라우드 세이브 모듈  (window.CloudSave)
   -------------------------------------------------------------------
   기존 game.html 은 건드리지 않는다. 이 모듈은 단독으로 동작하며,
   5단계(통합) 때 game.html / React 클라이언트가 그대로 import 한다.

   필요 전제:
     1) <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> 가 먼저 로드
     2) stage2/schema.sql 적용
     3) Supabase 대시보드에 Kakao OAuth 공급자 + Redirect URL 등록 (README 참고)

   핵심 개념
     - 신원: 익명(signInAnonymously) → 카카오(linkIdentity / signInWithOAuth).
     - 세이브: 전체 상태 S 를 game_saves.state(JSONB) 에 통째로 저장. localStorage 는 캐시.
     - 이전: ① linkIdentity 로 uid 보존(데이터 이동 0)  ② 카카오가 이미 타 기기에 있으면
             카카오로 전환 후 migrate_anon_to_me RPC 로 '진행도 높은 세이브 통째 채택'.
   =================================================================== */
(function (global) {
  "use strict";

  var LS_PENDING = "nh_cs_pending_anon"; // OAuth 리다이렉트 동안 익명 uid 를 임시 보관
  var LS_LINKMODE = "nh_cs_linkmode";    // 진행 중인 흐름: "link" | "switch"

  var CloudSave = {
    sb: null,
    cfg: { url: "", anon: "", table: "game_saves", players: "game_players" },
    _user: null,

    /* ---------- 초기화 ---------- */
    // init({url, anon}) → supabase 클라이언트 생성 + 현재 세션 복원. 반환: 현재 user 정보(없으면 null).
    async init(opts) {
      opts = opts || {};
      this.cfg.url = opts.url || this.cfg.url;
      this.cfg.anon = opts.anon || this.cfg.anon;
      if (opts.table) this.cfg.table = opts.table;
      if (opts.players) this.cfg.players = opts.players;
      if (!this.cfg.url || !this.cfg.anon) throw new Error("CloudSave.init: url/anon 필요");
      if (!global.supabase || !global.supabase.createClient) throw new Error("supabase-js 가 먼저 로드돼야 함");
      this.sb = global.supabase.createClient(this.cfg.url, this.cfg.anon);
      await this.refresh();
      return this._user;
    },

    // 세션을 다시 읽어 _user 갱신.
    async refresh() {
      var ses = (await this.sb.auth.getSession()).data.session;
      this._user = ses ? this._mapUser(ses.user) : null;
      return this._user;
    },

    _mapUser(u) {
      if (!u) return null;
      var ids = (u.identities || []).map(function (i) { return i.provider; });
      return {
        uid: u.id,
        isAnonymous: !!u.is_anonymous,
        providers: ids,
        hasKakao: ids.indexOf("kakao") >= 0,
        email: u.email || null,
        nick: (u.user_metadata && (u.user_metadata.nickname || u.user_metadata.name)) || null
      };
    },

    user() { return this._user; },

    // 자동 로그인 보장: 세션이 없으면 익명으로 시작.
    async ensureAnon() {
      await this.refresh();
      if (!this._user) {
        await this.sb.auth.signInAnonymously();
        await this.refresh();
      }
      return this._user;
    },

    /* ---------- 카카오 로그인 / 연결 ---------- */
    _redirect(redirectTo) {
      // 기본값: 쿼리/해시 제거한 현재 페이지. (Supabase Auth Redirect URLs 허용목록에 등록 필요)
      return redirectTo || global.location.href.split("#")[0].split("?")[0];
    },

    // 카카오 계정으로 '연결'(현재 익명 uid 유지). 가장 깔끔한 이전 경로.
    //   - 성공 시 OAuth 리다이렉트 발생 → 돌아오면 같은 uid 에 kakao identity 가 붙어 있음.
    //   - 카카오 계정이 이미 다른 user 에 연결돼 있으면 identity_already_exists 로 즉시 실패(리다이렉트 X).
    // 반환: {conflict:true} (이미 존재 → 전환 경로로) | (성공 시 리다이렉트되어 반환 안 함)
    async linkKakao(redirectTo) {
      await this.refresh();
      var anonUid = this._user && this._user.uid;
      if (anonUid) {
        try { global.localStorage.setItem(LS_PENDING, anonUid); } catch (e) {}
      }
      try { global.localStorage.setItem(LS_LINKMODE, "link"); } catch (e) {}
      var res = await this.sb.auth.linkIdentity({
        provider: "kakao",
        options: { redirectTo: this._redirect(redirectTo), scopes: "profile_nickname" }
      });
      if (res.error) {
        var msg = (res.error.message || "") + " " + (res.error.code || "");
        if (/identity_already_exists|already.*linked|manual_linking/i.test(msg)) {
          return { conflict: true, error: res.error };
        }
        throw res.error;
      }
      return { linked: true }; // 보통 여기 도달 전에 리다이렉트됨
    },

    // 카카오로 '로그인/전환'(다른 uid 가 될 수 있음). linkKakao 가 conflict 일 때 사용.
    async signInWithKakao(redirectTo) {
      await this.refresh();
      var anonUid = this._user && this._user.uid;
      // 익명 uid 보관 → 복귀 후 handleRedirectResult 가 migrate_anon_to_me 로 진행도 이전.
      if (anonUid) { try { global.localStorage.setItem(LS_PENDING, anonUid); } catch (e) {} }
      try { global.localStorage.setItem(LS_LINKMODE, "switch"); } catch (e) {}
      var res = await this.sb.auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo: this._redirect(redirectTo), scopes: "profile_nickname" }
      });
      if (res.error) throw res.error;
      return res; // 리다이렉트됨
    },

    async signOut() {
      await this.sb.auth.signOut();
      this._user = null;
    },

    /* ---------- 리다이렉트 복귀 처리 ---------- */
    // 페이지 로드 직후 1회 호출. OAuth 복귀를 감지해 필요한 이전(migrate)을 마무리한다.
    // 반환: {migrated, fromUid, toUid, mode, save} | null(처리할 것 없음)
    async handleRedirectResult() {
      await this.refresh();
      var mode, pendingAnon;
      try { mode = global.localStorage.getItem(LS_LINKMODE); } catch (e) {}
      try { pendingAnon = global.localStorage.getItem(LS_PENDING); } catch (e) {}
      if (!mode && !pendingAnon) return null;

      var out = { migrated: false, fromUid: pendingAnon || null, toUid: this._user && this._user.uid, mode: mode || null, save: null };

      // 카카오 로그인이 실제로 끝났을 때만 정리/이전 수행.
      if (this._user && this._user.hasKakao) {
        if (pendingAnon && pendingAnon !== this._user.uid) {
          // 전환 경로: 익명 uid 와 다른 카카오 uid → 서버 병합 RPC.
          out.save = await this.migrateAnonToMe(pendingAnon);
          out.migrated = true;
        } else {
          // 연결 경로: 같은 uid → 데이터 이동 없음(이미 내 세이브).
          out.save = await this.loadCloud();
        }
        try { global.localStorage.removeItem(LS_PENDING); } catch (e) {}
        try { global.localStorage.removeItem(LS_LINKMODE); } catch (e) {}
      }
      return out;
    },

    // 익명(anon) → 현재(카카오) uid 로 서버측 병합. 진행도 높은 세이브를 통째로 채택 후 익명 흔적 정리.
    async migrateAnonToMe(anonUid) {
      var r = await this.sb.rpc("migrate_anon_to_me", { p_anon_uid: anonUid });
      if (r.error) throw r.error;
      return this._mapSave(Array.isArray(r.data) ? r.data[0] : r.data);
    },

    /* ---------- 클라우드 세이브 / 로드 ---------- */
    _mapSave(row) {
      if (!row || !row.uid) return null; // RPC 가 빈 composite(null uid)를 줄 수 있음
      return { uid: row.uid, state: row.state, ver: row.ver, score: Number(row.score) || 0,
               clientSeen: row.client_seen || 0, updatedAt: row.updated_at };
    },

    // 내 클라우드 세이브 읽기. 없으면 null.
    async loadCloud() {
      await this.refresh();
      if (!this._user) return null;
      var r = await this.sb.from(this.cfg.table)
        .select("uid,state,ver,score,client_seen,updated_at")
        .eq("uid", this._user.uid).maybeSingle();
      if (r.error) throw r.error;
      return this._mapSave(r.data);
    },

    // 전체 상태 S 를 클라우드에 저장(upsert). score/client_seen 은 서버 트리거가 계산.
    async saveCloud(state) {
      await this.refresh();
      if (!this._user) throw new Error("로그인 필요");
      var payload = { uid: this._user.uid, state: state, ver: (state && state.ver) || 2 };
      var r = await this.sb.from(this.cfg.table)
        .upsert(payload, { onConflict: "uid" })
        .select("uid,state,ver,score,client_seen,updated_at").single();
      if (r.error) throw r.error;
      return this._mapSave(r.data);
    },

    /* ---------- 진행도 비교(순수 함수, 테스트 가능) ---------- */
    // schema.sql 의 save_score() 와 동일 공식이어야 한다.
    progressScore(s) {
      s = s || {};
      var reb = +s.rebirth || 0;
      var br = +s.bestRegion || 1, bs = +s.bestStage || 1;
      var lv = +s.lv || 1;
      var dex = (s.dex && typeof s.dex === "object") ? Object.keys(s.dex).length : 0;
      var bestStage = (br - 1) * 10 + bs;
      return reb * 1e12 + bestStage * 1e8 + lv * 1e4 + dex;
    },

    // 로컬 vs 클라우드 중 채택할 상태 결정. 점수 우선, 동률이면 더 최근(lastSeen) 우선.
    // 반환: {chosen, source:"local"|"cloud"|"localOnly"|"cloudOnly", localScore, cloudScore}
    resolve(localState, cloudState) {
      if (localState && !cloudState) return { chosen: localState, source: "localOnly", localScore: this.progressScore(localState), cloudScore: -1 };
      if (!localState && cloudState) return { chosen: cloudState, source: "cloudOnly", localScore: -1, cloudScore: this.progressScore(cloudState) };
      if (!localState && !cloudState) return { chosen: null, source: "none", localScore: -1, cloudScore: -1 };
      var ls = this.progressScore(localState), cs = this.progressScore(cloudState);
      if (cs > ls) return { chosen: cloudState, source: "cloud", localScore: ls, cloudScore: cs };
      if (ls > cs) return { chosen: localState, source: "local", localScore: ls, cloudScore: cs };
      // 동률: 더 최근에 플레이한 쪽
      var lSeen = +(localState.lastSeen || 0), cSeen = +(cloudState.lastSeen || 0);
      return cSeen > lSeen
        ? { chosen: cloudState, source: "cloud", localScore: ls, cloudScore: cs }
        : { chosen: localState, source: "local", localScore: ls, cloudScore: cs };
    }
  };

  global.CloudSave = CloudSave;
  // 테스트(노드 등)용 export
  if (typeof module !== "undefined" && module.exports) module.exports = CloudSave;
})(typeof window !== "undefined" ? window : globalThis);
