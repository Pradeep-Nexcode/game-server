# 🚀 Phase-6B-1: Exact VPS + Docker Production Checklist

*(Windows 11 dev → Linux VPS prod)*

## 🧠 Architecture (simple & correct)

```
Windows 11 (Your PC)
 ├─ Code (TypeScript)
 ├─ Git
 └─ Docker (optional local test)

Linux VPS (Ubuntu)
 ├─ Docker
 ├─ Docker Compose
 ├─ Nakama
 └─ PostgreSQL
```

Unity clients connect **directly to VPS**.

---

## ✅ STEP 0 — What VPS to buy (IMPORTANT)

### Minimum (good for small game / beta)
* **2 vCPU**
* **4 GB RAM**
* **40+ GB SSD**
* **Ubuntu 22.04**

Providers that are fine:
* Hostinger VPS ✅
* DigitalOcean
* Hetzner
* Vultr

❌ Shared hosting
❌ Windows Server VPS

---

## ✅ STEP 1 — Prepare VPS (once)

SSH into VPS:

```bash
ssh root@YOUR_VPS_IP
```

Update system:

```bash
apt update && apt upgrade -y
```

Install basics:

```bash
apt install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release
```

---

## ✅ STEP 2 — Install Docker (PRODUCTION SAFE)

```bash
curl -fsSL https://get.docker.com | sh
```

Enable auto-start:

```bash
systemctl enable docker
systemctl start docker
```

Check:

```bash
docker --version
```

---

## ✅ STEP 3 — Install Docker Compose (v2)

```bash
mkdir -p ~/.docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-linux-x86_64 \
  -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
```

Check:

```bash
docker compose version
```

---

## ✅ STEP 4 — Server Folder Layout (IMPORTANT)

On VPS:

```bash
mkdir -p /srv/nakama
cd /srv/nakama
```

Final structure:

```
/srv/nakama
 ├─ docker-compose.yml
 ├─ .env
 ├─ data/
 │   └─ modules/
 └─ postgres/
```

---

## ✅ STEP 5 — docker-compose.yml (PRODUCTION)

*See the `docker-compose.yml` file in this repository for the production-ready configuration.*

---

## ✅ STEP 6 — Copy your server code (from Windows 11)

From **Windows PowerShell**:

```powershell
# You can use the helper script: scripts/deploy_to_vps.ps1
scp -r .\data\modules root@YOUR_VPS_IP:/srv/nakama/data/
```

You only upload:
* compiled `.js`
* configs

❌ No Unity project
❌ No node_modules

---

## ✅ STEP 7 — Start server (FIRST RUN)

```bash
cd /srv/nakama
docker compose up -d
```

Check logs:

```bash
docker logs -f nakama
```

You should see:
```
Nakama starting
Registered matches
RPCs loaded
```

---

## ✅ STEP 8 — Firewall (CRITICAL)

Open only what you need:

| Port | Purpose       |
| ---- | ------------- |
| 7350 | Game clients  |
| 7351 | Admin console | 
| 22   | SSH           |

Example (UFW):

```bash
ufw allow 22
ufw allow 7350
ufw allow 7351
ufw enable
```

---

## ✅ STEP 9 — Test from Unity

Client config:

```csharp
new Client("http", "YOUR_VPS_IP", 7350, "defaultkey");
```

Test:
* Auth
* Matchmaking
* Play a match
* Killcam
* Spectator

If this works → **production is ready**.

---

## 🔁 Updating server code (SAFE METHOD)

1. Build on Windows
2. Copy new `data/modules` to VPS
3. Restart Nakama only:

```bash
docker compose restart nakama
```

✔ Ongoing matches finish
✔ New matches use new code

---

## 💾 STEP 10 — Database Backup (DO THIS)

Nightly backup (cron):

```bash
docker exec nakama-postgres \
  pg_dump -U nakama nakama > /srv/backup/nakama_$(date +%F).sql
```

This protects:
* XP
* MMR
* Seasons
* Progression

---

## ❌ DO NOT DO (IMPORTANT)

❌ Run Nakama on Windows Server
❌ Put DB inside container without volume
❌ Expose extra ports
❌ Edit code directly on VPS
