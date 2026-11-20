# 🚀 Deployment, Mobile Builds & Cloud Setup Guide

This guide covers:
1. **GitHub Actions Mobile App Builds** (Downloadable `.apk` for Android & `.ipa` for iOS)
2. **Supabase Cloud Database Setup** (Persistent PostgreSQL data storage)
3. **Vercel Web App Deployment** (Instant global CDN hosting)

---

## 📱 Part 1: Download & Install Android APK and iOS IPA from GitHub

We have configured an automated GitHub Actions pipeline in [`.github/workflows/build-mobile.yml`](.github/workflows/build-mobile.yml). Every time you push code or trigger the workflow, GitHub builds fresh native mobile binaries.

### How to Download the APK / IPA from GitHub:
1. Go to your **GitHub repository** in your web browser.
2. Click the **Actions** tab at the top.
3. Select **Build Mobile Apps (Android APK & iOS IPA)** on the left sidebar.
4. (Optional) To trigger a build manually: click **Run workflow** → Select branch `main` → Click **Run workflow**.
5. Click on the latest workflow run.
6. Scroll down to the **Artifacts** section at the bottom of the summary page:
   - **`AnacondaPark-Android-APK`**: Click to download the `.zip` containing `AnacondaPark-v1.0-debug.apk`.
   - **`AnacondaPark-iOS-IPA`**: Click to download the `.zip` containing `AnacondaPark-v1.0-unsigned.ipa`.

### How to Install on your Device:

#### 🤖 Android Device:
1. Extract the downloaded `AnacondaPark-Android-APK.zip` on your phone or PC.
2. Transfer or open `AnacondaPark-v1.0-debug.apk` directly on your Android phone.
3. Tap **Install** (if prompted, enable *"Install from Unknown Sources"* for your browser or file manager).
4. Launch **Anaconda Park / CoilQuest** and play!

#### 🍎 iOS Device:
1. Download `AnacondaPark-iOS-IPA`.
2. Sideload the `.ipa` onto your iPhone/iPad using any standard sideload tool:
   - **AltStore** (free, no jailbreak required)
   - **Sideloadly** (macOS/Windows)
   - **Apple Configurator 2** / Xcode Devices window.

---

## ☁️ Part 2: Supabase Setup for Persistent Data Storage

Supabase provides hosted PostgreSQL with auto-generated REST APIs and real-time websockets.

### Step 1: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New Project**.
3. Choose your organization, project name (e.g. `coilquest-db`), database password, and region.
4. Wait ~1 minute for Supabase to provision your database.

### Step 2: Run the Database Schema
1. In the Supabase Dashboard, click **SQL Editor** on the left menu.
2. Click **New Query**.
3. Open [`supabase/schema.sql`](supabase/schema.sql) in this repository, copy all the SQL, and paste it into the Supabase SQL Editor.
4. Click **Run** (green button).
5. All 5 tables are created:
   - `game_state` (JSONB auto-sync for live snapshots)
   - `player_profiles` (Player stats, avatars, stars, tickets)
   - `player_hearts` (5-heart life system with 15-minute restore countdowns)
   - `campaign_progress` (1,000-level adventure progress & Quest Master cooldowns)
   - `leaderboard_records` (Global high scores and kills)

### Step 3: Connect your Backend to Supabase
1. In Supabase Dashboard, go to **Project Settings** (gear icon) → **API**.
2. Find:
   - **Project URL**: `https://<your-project-ref>.supabase.co`
   - **service_role secret key** (Reveal and copy this secret key — this allows backend writes).
3. Set these environment variables in your server hosting platform (Render, Railway, Fly.io, or VPS) or in `backend/.env`:
```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-secret-key
SUPABASE_STATE_ID=main
```
4. Restart your backend. The backend will automatically hydrate from Supabase and synchronize player saves on every match!

---

## 🌐 Part 3: Vercel Setup for Webapp Deployment

Vercel provides edge hosting and global CDN for the frontend web application.

### Step 1: Push Repository to GitHub
Ensure all recent commits are pushed to your GitHub repository:
```bash
git add .
git commit -m "feat: clean in-game HUD layout, mobile CI workflows and Supabase schema"
git push origin main
```

### Step 2: Deploy on Vercel
1. Go to [https://vercel.com](https://vercel.com) and log in.
2. Click **Add New...** → **Project**.
3. Import your GitHub repository (`bitme` / `coilquest`).
4. Vercel automatically detects [`vercel.json`](vercel.json):
   - **Framework Preset**: Other / Vite
   - **Build Command**: `npm --prefix frontend install && npm --prefix frontend run build`
   - **Output Directory**: `frontend/dist`
   - **Install Command**: `npm install`
5. (Optional) If you have a live backend URL (e.g. on Render or Railway), add an Environment Variable in Vercel:
   - `VITE_SERVER_URL`: `https://your-backend.onrender.com`
   - Or set `<meta name="anaconda-server" content="https://your-backend.onrender.com" />` in `frontend/index.html`.
6. Click **Deploy**.
7. In ~30 seconds, your game is live on `https://your-project.vercel.app`!

---

## 🎮 Summary of Recent Enhancements

- **Clean In-Game Layout**:
  - Removed clunky stat boxes and large floating quest tracker from the active play arena.
  - Centered 5-hearts health bar + active power status seconds countdown at top-middle.
  - Placed sleek Pause button `⏸` at top-right.
  - Play area is wide open for movement and combat!
- **Enhanced Pause Menu**:
  - Displays full Active Quest details (Title, level, objective, progress bar, `[Open Quiz]` button, and `[Claim]` button).
  - Displays Live Match Stats (Score, Stars, Items, Kills).
  - Displays Daily Tasks & Missions status and item loot breakdown.
- **Automated CI/CD**:
  - GitHub Actions builds fresh `.apk` (Android) and `.ipa` (iOS) on every push.

