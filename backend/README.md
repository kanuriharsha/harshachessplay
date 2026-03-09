# Chessplay Backend

Minimal Express + Mongoose backend for Chessplay.

Setup

1. Copy `.env.example` to `.env` and fill `MONGODB_URI` and `JWT_SECRET`.
2. Install dependencies:

```bash
cd backend
npm install
```

3. Start dev server:

```bash
npm run dev
```

API endpoints
- `POST /auth/signup` { email, password, username?, role? }
- `POST /auth/signin` { email, password }
- `POST /requests` (Bearer token) create request (student only)
- `GET /requests` (Bearer token) list requests (admin sees pending, student sees own)
- `PATCH /requests/:id` (admin only) update status/time
- `DELETE /requests/:id` (student only) delete own request
