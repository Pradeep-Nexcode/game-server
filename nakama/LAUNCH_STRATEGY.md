# 🏁 Phase-6D: Launch Strategy & Checklist

This document guides the transition from development to public release.  
**Philosophy:** Risk management > Features. Launch is a sequence, not a date.

---

## 🚀 STAGE 1 — ALPHA (Private, Unsafe by Design)
**Goal:** Validate core gameplay + stability with 5-20 trusted testers.  
**Access:** Whitelisted users only.

### ✅ Alpha Verification Checklist
#### Backend
- [x] **One Region Only**: Defaulting to `us-east` (configured in `matchBase.ts`).
- [x] **Logs Enabled**: Info & Warnings active (`docker-compose.yml`, `matchBase.ts`).
- [x] **Anti-Cheat Logging**: Active (`anticheat.ts` warns on flags > 1.0).
- [x] **DB Backups**: `scripts/backup_db.sh` ready for nightly runs.
- [x] **Admin RPCs**: `admin_start_season`, `debug_add_xp` available (`liveops/rpcs.ts`).

#### Game
- [x] **One Mode**: `standard` (default in `matchBase.ts`).
- [x] **One Map**: `arena_small` / `map_01` (default in `matchBase.ts`).
- [x] **Minimal Weapons**: Only `pistol` & `assault_rifle` defined in `weapons.json`.
- [x] **Killcam**: System registered & functional (`systems/killcam.ts`).
- [x] **Spectator**: Logic handles `isSpectator` flag (`matchBase.ts`).

### ⛔ Exit Alpha Criteria
- [ ] 10+ matches played without server crash.
- [ ] No corrupted player data.
- [ ] Players can finish matches successfully.
- [ ] No critical desync issues reported.

---

## 🧪 STAGE 2 — CLOSED BETA (Controlled, Feedback)
**Goal:** Test scale (50-300 players), retention, and "game feel".  
**Access:** Discord community, invite-based.

### ✅ Beta Prep Checklist
#### Backend
- [ ] **Matchmaking Queues**: Verify stability with >20 concurrents.
- [ ] **Ranked/Casual Split**: Ensure separate queues work.
- [ ] **Season Reset**: Test `admin_end_season` RPC effects.
- [ ] **Performance**: Ensure CPU < 70% under load.

#### Game
- [ ] **Tutorial/Hints**: Add basic "How to Play" text/UI.
- [ ] **Feedback**: Hit markers, death screen, win/loss UI clear.
- [ ] **Cosmetics**: Verify skins/emotes sync correctly.
- [ ] **Respawn**: Ensure spawn points aren't camped easily.

#### Ops
- [ ] **Community**: Set up Discord #bug-reports channel.
- [ ] **Metrics**: Track Avg Match Duration & Quit Rate.

### ⛔ Exit Closed Beta Criteria
- [ ] Players asking for *content* (not fixes).
- [ ] No server downtime > 5 min.
- [ ] Matchmaking feels fair to players.

---

## 🌍 STAGE 3 — OPEN BETA / SOFT LAUNCH
**Goal:** Test real players, rate limits, and auto-moderation.  
**Who:** Public access, "Beta" label.

### ✅ Open Beta Checklist
- [ ] **Rate Limiting**: Verify Nginx/Nakama rate limits.
- [ ] **Auto-Mod**: Enable auto-kick/ban actions in Anti-Cheat.
- [ ] **Logs**: Configure log rotation (don't fill disk).
- [ ] **Progression**: XP curves and Level Up rewards visible.
- [ ] **Emergency**: Have a "Panic Switch" to stop matchmaking.

---

## 🎉 STAGE 4 — PUBLIC LAUNCH
**Goal:** Growth.

### ✅ Launch Checklist
- [ ] **Scale**: Plan for adding more VPS/Regions.
- [ ] **Versioning**: Strategy for client updates vs server compatibility.
- [ ] **Live Ops**: Calendar for Season 1.
- [ ] **Legal**: Terms of Service & Privacy Policy accessible.

---

## 🚨 LAUNCH DAY RULES
1. **Stability > Everything**.
2. ❌ NO new backend code.
3. ❌ NO weapon rebalancing.
4. ❌ NO new features.
5. ✅ Only hotfix crashes.
