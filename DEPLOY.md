# Deploy Setu for free (≈15 minutes)

Deployed once, your site lives at a public URL forever — no dev machine required.

## 1. MongoDB Atlas (database) — ~5 min

1. Go to https://www.mongodb.com/cloud/atlas/register and sign up (Google login works).
2. Create a **free M0 cluster** (pick the region closest to you). No credit card needed.
3. **Database Access** → *Add New Database User* → username `setu-app`, generate a password, role **Read and write**. Save the password somewhere.
4. **Network Access** → *Add IP Address* → **Allow access from anywhere** (`0.0.0.0/0`). Required because Render's free tier uses dynamic IPs.
5. **Database → Connect → Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://setu-app:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Change the database part to `/setu_works` (before the `?`) so the data lands in a named DB:
   ```
   mongodb+srv://setu-app:<password>@cluster0.xxxxx.mongodb.net/setu_works?retryWrites=true&w=majority
   ```
   Replace `<password>` with the real password. **Keep this string — it's your MONGO_URI.**

## 2. Render (backend) — ~5 min

1. Push this repo to GitHub (already done: `xlok227/setu`).
2. Go to https://dashboard.render.com → **New → Web Service** → connect your GitHub repo `setu`.
3. Render detects `render.yaml`. Confirm these settings:
   - **Root Directory:** `.freebuff/backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Under **Environment**, add:
   | Key | Value |
   |---|---|
   | `MONGO_URI` | your Atlas string from step 1 |
   | `CORS_ORIGINS` | *(leave blank for now — fill after step 3)* |
   (`JWT_SECRET` auto-generates via render.yaml.)
5. **Create Web Service.** First deploy takes ~3 minutes. Note your URL: `https://setu-backend-xxxx.onrender.com`
6. Test: open `https://setu-backend-xxxx.onrender.com/` in a browser — you should see **"Setu backend is running"**.

## 3. Vercel (frontend) — ~3 min

1. Go to https://vercel.com → sign in with GitHub.
2. **Add New → Project** → import `setu`.
3. Configure:
   - **Root Directory:** `.freebuff/client`
   - **Framework Preset:** Vite (auto-detected)
   - **Environment variable:** `VITE_API_BASE` = `https://setu-backend-xxxx.onrender.com` (your Render URL from step 2, **no trailing slash**)
4. **Deploy.** You get a URL like `https://setu-xxxx.vercel.app`.
5. Test: open the URL → log in with `student@setu.dev` / `password123` → the dashboard should show real data from Atlas.

## 4. Close the CORS loop (1 min)

Go back to **Render → your backend → Environment** and set:

```
CORS_ORIGINS=https://setu-xxxx.vercel.app
```

Save — Render redeploys automatically. Done: your site is live, data persists in Atlas, and anyone can use it 24/7.

## Notes

- **Free-tier sleeps:** Render free spins the backend down after ~15 min idle; the first request after that takes ~30–60s to wake. Judge demos: hit the site once before presenting.
- **Data:** whatever happens on the deployed site now persists in Atlas (unlike the local in-memory DB).
- **Custom domain:** optional, both platforms support it free.
