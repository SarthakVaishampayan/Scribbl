# Vercel Deployment Settings - Quick Reference

## Configuration Summary

### Framework Preset
- **Select**: `Vite` (should auto-detect)
- If not detected, choose `Other` - Vercel will use vercel.json

### Root Directory
- **Set to**: `.` (project root)
- This is correct because vercel.json handles subdirectory paths

### Build Settings (from vercel.json)
These should auto-populate, but verify:
- **Build Command**: `cd src && npm install && npm run build`
- **Output Directory**: `src/dist`
- **Install Command**: `cd src && npm install` (optional)

### Environment Variables (REQUIRED - Add This!)

Click "Add" in Environment Variables section:

| Key | Value | Environments |
|-----|-------|--------------|
| `VITE_SOCKET_URL` | `https://scribbll.onrender.com` | Production, Preview, Development |

⚠️ **Important**: 
- No trailing slash in the URL
- Add to all three environments (Production, Preview, Development)

### Advanced Settings
- Leave as default
- The `vercel.json` file handles the SPA routing rewrite

---

## What Vercel Should Auto-Detect

Since you have `vercel.json` in the root:
- ✅ Framework: Vite
- ✅ Build command
- ✅ Output directory
- ❌ Environment variables (you must add manually)

---

## After Deployment

Once Vercel deploys:
1. Copy your Vercel URL (e.g., `https://scribbl.vercel.app`)
2. Go back to Render
3. Update `CORS_ORIGIN` to your Vercel URL
4. Save and redeploy Render
