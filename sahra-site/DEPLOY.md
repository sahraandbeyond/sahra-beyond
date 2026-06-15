# Sahra & Beyond — Deployment Guide

## What's in this folder

```
sahra-site/
├── index.html          ← Your main app (both API keys already wired in)
├── netlify.toml        ← Netlify configuration
├── admin/
│   ├── index.html      ← Netlify CMS interface
│   └── config.yml      ← CMS content schema
├── content/
│   ├── settings.json   ← App settings & API keys
│   ├── locations/      ← One JSON file per location
│   └── blog/           ← One JSON file per blog post
└── public/
    └── uploads/        ← Your photos & videos go here
```

---

## Step 1 — Create a GitHub account
Go to github.com and sign up (free). This is where your site's files will live.

## Step 2 — Create a new GitHub repository
1. Click the **+** button → "New repository"
2. Name it: `sahra-beyond`
3. Set to **Public**
4. Click "Create repository"

## Step 3 — Upload your files to GitHub
1. On your new repo page, click **"uploading an existing file"**
2. Drag the entire `sahra-site` folder contents into the upload area
3. Keep the folder structure exactly as-is
4. Click **"Commit changes"**

## Step 4 — Create a Netlify account
Go to netlify.com and sign up using your **GitHub account** (important — use the same GitHub you just used).

## Step 5 — Deploy on Netlify
1. In Netlify, click **"Add new site" → "Import an existing project"**
2. Choose **GitHub**
3. Select your `sahra-beyond` repository
4. Leave all build settings blank (no build command needed)
5. Click **"Deploy site"**

Your site will be live in ~30 seconds at a URL like `https://sahra-beyond.netlify.app`

## Step 6 — Enable Netlify CMS (your admin panel)
1. In Netlify dashboard → **Site settings → Identity**
2. Click **"Enable Identity"**
3. Under **Registration**, set to **"Invite only"** (so only you can log in)
4. Go to **Identity → Services → Git Gateway** → click **"Enable Git Gateway"**
5. Go to **Identity → Invite users** → enter your email → send invite
6. Check your email and accept the invite — this creates your admin login

## Step 7 — Log into your CMS
Go to `https://your-site.netlify.app/admin`
Log in with your email. You'll see:
- **Locations** — add, edit, delete adventure spots
- **Blog Posts** — write stories, attach photos
- **Media** — upload photos and videos
- **Settings** — update API keys if needed

## Step 8 — Custom domain (optional)
1. Buy a domain at namecheap.com (e.g. `sahraandbeyond.com`, ~$10/yr)
2. In Netlify → **Domain settings → Add custom domain**
3. Follow Netlify's DNS instructions
4. HTTPS is automatic and free

---

## Day-to-day content management

**To add a new location:**
→ Go to `/admin` → Locations → New Location → fill in details → Save

**To write a blog post:**
→ Go to `/admin` → Blog Posts → New Blog Post → write your story → upload cover photo → Publish

**To upload photos/videos:**
→ Go to `/admin` → Media → Upload
→ Then attach them to a blog post in the Blog Posts editor

**Changes go live in ~30 seconds** after you save in the CMS.

---

## API Keys already configured
- ✅ Google Maps: AIzaSyDNJwCMt37FiFixtWGvxRtdkASdlbx0yF4
- ✅ OpenWeatherMap: 6c72fdb6df4ed7b50f1393b96bbc3e00

**Important:** Restrict your Google Maps key to your domain in Google Cloud Console
→ console.cloud.google.com → APIs & Services → Credentials → Edit key → Add domain restriction

---

## Security
- The `/admin` panel is protected by Netlify Identity login
- Only invited users (you) can log in
- Your API keys are in the source code — restrict them by domain as noted above
