 Step-by-Step Deployment Guide

Follow these steps to deploy your Collaborative Canvas app to Vercel and Render.


PART 1: Prepare Your Code

Step 1: Push to GitHub (if not already done)

1. Initialize Git (if needed):
   ```bash
   git init
   git add .
   git commit -m "Initial commit - ready for deployment"
   ```

2. Create a GitHub repository:
   - Go to https://github.com/new
   - Create a new repository (e.g., `collaborative-canvas`)
   -Don't initialize with README

3. Push your code:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/collaborative-canvas.git
   git branch -M main
   git push -u origin main
   ```
   Replace `YOUR_USERNAME` with your GitHub username.

---

PART 2: Deploy Backend to Render

Step 2: Create Render Account
- Go to https://dashboard.render.com
- Sign up with GitHub (recommended) or email

Step 3: Create Web Service on Render

1. Click the "New +" button → Select "Web Service"

2. Connect your repository:
   - Click "Connect account" if needed
   - Select your `collaborative-canvas` repository

3. Configure the service:
   - Name: `collaborative-canvas-server` (or any name you prefer)
   - Region: Choose closest to you (e.g., Oregon)
   - Branch: `main`
   - Root Directory: Leave empty (or `server` if you want)
   - Runtime: `Node`
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && npm start`
   - Plan: Select Free (or paid if you prefer)

4. Click "Create Web Service"

 Step 4: Set Environment Variables on Render

1. In your Render service dashboard, go to "Environment" tab

2. Add these environment variables:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` |
   | `CORS_ORIGIN` | `http://localhost:5173` (temporary, we'll update this later) |

3. Click "Save Changes"

4. Wait for deployment to complete (2-3 minutes)

5. Copy your Render URL:
   - Look at the top of the dashboard
   - It will be something like: `https://collaborative-canvas-server.onrender.com`
   - Save this URL - you'll need it in the next steps!

---

 PART 3: Deploy Frontend to Vercel

 Step 5: Create Vercel Account
- Go to https://vercel.com
- Sign up with GitHub (recommended)

 Step 6: Create Vercel Project

1. Click "Add New..." → "Project"

2. Import your repository:
   - Select your `collaborative-canvas` repository
   - Click "Import"

3. Configure Project Settings:
   
   Leave these as default (Vercel will auto-detect):
   - Framework Preset: `Vite` (should auto-detect)
   - Root Directory: `.` (root)
   - Build Command: `cd src && npm install && npm run build` (should auto-fill)
   - Output Directory: `src/dist` (should auto-fill)
   - Install Command: `cd src && npm install` (should auto-fill)

4. Add Environment Variable:
   - Scroll down to "Environment Variables" section
   - Click "Add"
   - Key: `VITE_SOCKET_URL`
   - Value: Paste your Render backend URL from Step 4 (e.g., `https://collaborative-canvas-server.onrender.com`)
     - ⚠️ Important: No trailing slash! Use `https://...` not `https://.../`
   - Environment: Select `Production`, `Preview`, and `Development`
   - Click "Add"

5. Click "Deploy"

6. Wait 1-2 minutes for deployment

7. Copy your Vercel URL:
   - After deployment, Vercel will show: `https://your-project-name.vercel.app`
   - Save this URL!

---

 PART 4: Connect Frontend and Backend

 Step 7: Update CORS on Render

1. Go back to your Render dashboard

2. Click on your web service

3. Go to "Environment" tab

4. Update `CORS_ORIGIN`:
   - Find `CORS_ORIGIN` in the list
   - Click the edit/pencil icon
   - New Value: Your Vercel URL from Step 6 (e.g., `https://your-project-name.vercel.app`)
   
   Optional: To allow both local dev AND production:
   ```
   http://localhost:5173,https://your-project-name.vercel.app
   ```
   (comma-separated, no spaces around comma)

5. Click "Save Changes"

6. Redeploy (if needed):
   - Go to "Manual Deploy" tab
   - Click "Deploy latest commit" OR wait for auto-redeploy

---

 PART 5: Test Your Deployment

### Step 8: Test the App

1. Visit your Vercel URL (from Step 6)

2. Open browser console (F12 → Console tab) to check for errors

3. Test features:
   - Enter a name and room ID
   - Click "Join Room"
   - Try drawing on the canvas
   - Open the same URL in another browser tab/window
   - Draw in the second tab - you should see it in the first tab!

4. Check connection:
   - If you see "Users in room" count updating =  Working!
   - If you see CORS errors in console =  Check CORS_ORIGIN on Render

---

 Troubleshooting

 Frontend can't connect to backend

Check:
1. Is `VITE_SOCKET_URL` set correctly in Vercel? (No trailing slash!)
2. Is Render service running? (Check Render dashboard)
3. Check browser console for specific error

Fix:
- Go to Vercel → Your Project → Settings → Environment Variables
- Verify `VITE_SOCKET_URL` matches your Render URL exactly
- Redeploy Vercel project after changing environment variables

 CORS errors in browser console

Check:
1. Does `CORS_ORIGIN` in Render match your Vercel URL exactly?
2. No trailing slashes in URLs
3. Did you redeploy Render after changing `CORS_ORIGIN`?

Fix:
- Render → Your Service → Environment → Update `CORS_ORIGIN`
- Must match exactly: `https://your-project-name.vercel.app` (no trailing slash)
- Save and redeploy

 Build fails on Vercel

Check:
- Vercel build logs (click on failed deployment → View logs)

Fix:
- Make sure `package.json` exists in `src/` folder
- Verify build command: `cd src && npm install && npm run build`

 Build fails on Render

Check:
- Render build logs (click on deployment → View logs)

Fix:
- Verify start command: `cd server && npm start`
- Make sure `server/package.json` has a `start` script

---

 Quick Reference

 Your URLs
- Frontend (Vercel): `https://your-project-name.vercel.app`
- Backend (Render): `https://collaborative-canvas-server.onrender.com`

 Environment Variables

Vercel:
- `VITE_SOCKET_URL` = https://scribbll.onrender.com

Render:
- `NODE_ENV` = `production`
- `PORT` = `10000`
- `CORS_ORIGIN` = https://scribbl-pearl.vercel.app/

---
You're Done!

Your app should now be live! Share your Vercel URL with others to collaborate on the canvas.

Note: Free tier services may spin down after inactivity. First request after idle time may be slower.
