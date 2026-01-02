Frontend (Vercel)
- Set Environment Variables in Vercel project:
  - VITE_API_URL=https://your-backend.onrender.com
  - VITE_WS_URL=https://your-backend.onrender.com
- Build command: `npm run build` (Vercel will run `npm run build` by default)
- Output directory: leave as default (Vite outputs to `dist`)

Backend (Render)
- Create a Web Service (Docker/Node) or use "Web Service" with Node:
  - Start Command: `npm start` (already present in backend/package.json)
  - Environment Variables:
    - MONGODB_URI=your_mongodb_uri
    - PORT=10000 (Render sets its own; leave blank if using Render's port)
    - FRONTEND_URL=https://your-app.vercel.app
    - NODE_ENV=production
    - JWT_SECRET=replace_with_strong_secret

Notes
- Frontend now reads `import.meta.env.VITE_API_URL` and `VITE_WS_URL`.
- Backend CORS and Socket.IO accept `FRONTEND_URL` (fallback to localhost during local dev).
- Do NOT commit secrets; set them in provider UI.
