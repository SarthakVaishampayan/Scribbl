Deployment Guide

This guide will help you deploy the Collaborative Canvas application to Vercel (frontend) and Render (backend).

Prerequisites

- GitHub repository with your code
- Vercel account (free tier available)
- Render account (free tier available)

 Architecture

- Frontend: React + Vite application deployed on Vercel
- Backend: Express + Socket.io server deployed on Render

 Deployment Steps

 1. Deploy Backend to Render

1. Push your code to GitHub (if not already done)

2. Create a new Web Service on Render
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - Name: `collaborative-canvas-server`
     - Environment: `Node`
     - Build Command: `cd server && npm install`
     - Start Command: `cd server && npm start`
     - Plan: Free (or paid if you prefer)

3. Set Environment Variables in Render:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render will override this, but set it anyway)
   - `CORS_ORIGIN`: Leave empty for now - you'll update it after deploying the frontend

4. Deploy and copy the server URL (e.g., `https://collaborative-canvas-server.onrender.com`)

 2. Deploy Frontend to Vercel

1. Create a new project on Vercel:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New" → "Project"
   - Import your GitHub repository

2. Configure Vercel:
   Root Directory: Leave as root (`.`)
   - Framework Preset: Vite (or auto-detect)
   - Build Command: `cd src && npm install && npm run build`
   - Output Directory: `src/dist`
   - Install Command: `cd src && npm install`

3. Set Environment Variables in Vercel:
   - `VITE_SOCKET_URL`: Your Render backend URL (e.g., `https://collaborative-canvas-server.onrender.com`)
     - Important: Do NOT include a trailing slash

4. Deploy and copy the frontend URL (e.g., `https://collaborative-canvas.vercel.app`)

3. Update CORS on Render

After deploying the frontend, update the `CORS_ORIGIN` environment variable on Render:

1. Go to your Render service dashboard
2. Navigate to "Environment" tab
3. Update `CORS_ORIGIN` to your Vercel frontend URL (e.g., `https://collaborative-canvas.vercel.app`)
4. Save and redeploy

Note: If you want to allow multiple origins (local dev + production), set `CORS_ORIGIN` to a comma-separated list:
```
http://localhost:5173,https://collaborative-canvas.vercel.app
```

4. Verify Deployment

1. Visit your Vercel frontend URL
2. Try joining a room and drawing - it should connect to the Render backend
3. Open multiple browser tabs/windows to test collaboration

 Environment Variables Summary

 Render (Backend)
- `NODE_ENV`: `production`
- `PORT`: `10000` (usually auto-set by Render)
- `CORS_ORIGIN`: Your Vercel frontend URL (comma-separated for multiple origins)

 Vercel (Frontend)
- `VITE_SOCKET_URL`: Your Render backend URL (no trailing slash)

 Troubleshooting

 Frontend can't connect to backend
- Check that `VITE_SOCKET_URL` is set correctly in Vercel
- Verify the Render service is running
- Check browser console for CORS errors
- Ensure `CORS_ORIGIN` in Render matches your Vercel URL exactly

 CORS errors
- Make sure `CORS_ORIGIN` in Render includes your exact Vercel domain
- No trailing slashes in URLs
- Check that the Render service has been redeployed after changing environment variables

Build failures
- Ensure all dependencies are listed in `package.json` (not just devDependencies in root)
- Check that build commands use the correct paths (`cd src` for frontend, `cd server` for backend)

 Notes

- Free tier limitations: Both services may spin down inactive instances. First requests may be slow.
- Socket.io on Render: Free tier works but may have connection limits
- For production: Consider upgrading to paid tiers for better performance and reliability

