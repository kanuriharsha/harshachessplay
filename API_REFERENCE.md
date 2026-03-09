# Quick Reference - New Features API

## 🔗 New Backend Endpoints

### Health Check (Render Sleep Prevention)
```http
GET /health
Response: { "status": "ok", "timestamp": "2026-01-04T..." }
```

### Student-to-Student Play

#### Get Online Students
```http
GET /users/online?requesterId={studentId}
Response: {
  "students": [
    {
      "id": "user123",
      "username": "john",
      "email": "john@email.com",
      "isOnline": true
    }
  ]
}
```

#### Send Play Request
```http
POST /play-requests
Body: {
  "fromStudentId": "student1_id",
  "toStudentId": "student2_id",
  "timeControl": 10
}
Response: { "request": {...} }
```

#### Get Incoming Requests
```http
GET /play-requests/incoming/{studentId}
Response: {
  "requests": [
    {
      "id": "req123",
      "from": { "id": "...", "username": "..." },
      "timeControl": 10,
      "createdAt": "..."
    }
  ]
}
```

#### Accept/Reject Request
```http
PATCH /play-requests/{requestId}/respond
Body: {
  "accepted": true,
  "responderId": "student2_id"
}
Response: {
  "request": {...},
  "session": {...} // If accepted
}
```

### Admin Spectator Mode

#### Get All Active Games
```http
GET /sessions/active?all=true
Response: {
  "sessions": [
    {
      "_id": "session123",
      "player1Id": "...",
      "player2Id": "...",
      "player1Name": "Alice",
      "player2Name": "Bob",
      "fen": "...",
      "turn": "w",
      "status": "active"
    }
  ]
}
```

#### Join as Spectator
```http
POST /sessions/{sessionId}/spectate
Body: { "adminId": "admin_id" }
Response: { "session": {...} }
```

## 📡 New Socket.IO Events

### Client Emits

#### Register User Socket
```javascript
socket.emit('register', {
  userId: 'user123',
  role: 'student' // or 'admin'
});
```

#### Join Session as Spectator
```javascript
socket.emit('join-session', {
  sessionId: 'session123',
  role: 'admin',
  isSpectator: true
});
```

#### Join Session as Player
```javascript
socket.emit('join-session', {
  sessionId: 'session123',
  role: 'player1', // or 'player2'
  isSpectator: false
});
```

#### Send Move (with new time formats)
```javascript
socket.emit('move', {
  sessionId: 'session123',
  fen: 'rnbqkbnr/...',
  turn: 'b',
  player1TimeMs: 590000,
  player2TimeMs: 600000,
  lastMove: { from: 'e2', to: 'e4' }
});
```

### Server Emits

#### Play Request Received
```javascript
socket.on('play-request-received', (data) => {
  // data = {
  //   requestId: '...',
  //   from: { id: '...', username: '...' },
  //   timeControl: 10
  // }
});
```

#### Play Request Rejected
```javascript
socket.on('play-request-rejected', (data) => {
  // data = {
  //   requestId: '...',
  //   message: 'Your play request was declined'
  // }
});
```

#### Session Created (for student-to-student)
```javascript
socket.on('session-created', (data) => {
  // data = {
  //   sessionId: '...',
  //   session: { player1Id, player2Id, ... }
  // }
});
```

#### Game Update (enhanced with player times)
```javascript
socket.on('game-update', (data) => {
  // data = {
  //   fen: '...',
  //   turn: 'w',
  //   player1TimeMs: 590000,
  //   player2TimeMs: 600000,
  //   adminTimeMs: 600000,  // legacy support
  //   studentTimeMs: 600000, // legacy support
  //   lastMove: { from: 'e2', to: 'e4' }
  // }
});
```

## 🎨 Frontend Integration Examples

### Health Check on Page Load
```typescript
// In Login.tsx, StudentDashboard.tsx, AdminDashboard.tsx
import { initHealthCheck } from '@/lib/healthCheck';

useEffect(() => {
  initHealthCheck(); // Pings /health endpoint
}, []);
```

### List Online Students
```typescript
const [onlineStudents, setOnlineStudents] = useState([]);

useEffect(() => {
  const fetchOnline = async () => {
    const res = await fetch(
      `${API_URL}/users/online?requesterId=${user.id}`
    );
    const data = await res.json();
    setOnlineStudents(data.students);
  };
  
  fetchOnline();
  const interval = setInterval(fetchOnline, 5000); // Refresh every 5s
  return () => clearInterval(interval);
}, [user.id]);
```

### Send Play Request
```typescript
const sendChallenge = async (targetStudentId: string) => {
  const res = await fetch(`${API_URL}/play-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromStudentId: user.id,
      toStudentId: targetStudentId,
      timeControl: 10
    })
  });
  
  if (res.ok) {
    toast.success('Challenge sent!');
  }
};
```

### Listen for Incoming Requests
```typescript
useEffect(() => {
  const socket = socketRef.current;
  
  const handleRequest = (data: any) => {
    toast.info(`${data.from.username} wants to play!`);
    setIncomingRequests(prev => [...prev, data]);
  };
  
  socket.on('play-request-received', handleRequest);
  
  return () => {
    socket.off('play-request-received', handleRequest);
  };
}, []);
```

### Accept Play Request
```typescript
const acceptChallenge = async (requestId: string) => {
  const res = await fetch(
    `${API_URL}/play-requests/${requestId}/respond`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accepted: true,
        responderId: user.id
      })
    }
  );
  
  if (res.ok) {
    const data = await res.json();
    navigate(`/game/${data.session._id}`);
  }
};
```

### Admin: View Active Games
```typescript
const [activeGames, setActiveGames] = useState([]);

useEffect(() => {
  const fetchGames = async () => {
    const res = await fetch(`${API_URL}/sessions/active?all=true`);
    const data = await res.json();
    setActiveGames(data.sessions);
  };
  
  fetchGames();
  const interval = setInterval(fetchGames, 3000); // Refresh every 3s
  return () => clearInterval(interval);
}, []);
```

### Admin: Join as Spectator
```typescript
const spectateGame = async (sessionId: string) => {
  // First, register as spectator
  await fetch(`${API_URL}/sessions/${sessionId}/spectate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminId: user.id })
  });
  
  // Then join socket room
  socket.emit('join-session', {
    sessionId,
    role: 'admin',
    isSpectator: true
  });
  
  // Navigate to spectator view
  navigate(`/game/${sessionId}?spectator=true`);
};
```

## 🔐 Security Notes

### Move Validation
```javascript
// Server-side blocking of spectator moves
socket.on('move', async (data) => {
  const socketInfo = socketToSession[socket.id];
  
  if (socketInfo && socketInfo.isSpectator) {
    console.log('❌ Spectator attempted move - BLOCKED');
    return; // Move rejected
  }
  
  // Process valid move...
});
```

### Room Isolation
```javascript
// Each game has unique sessionId
// Moves broadcast ONLY to that room
io.to(sessionId).emit('game-update', payload);

// NOT broadcasted globally
// ❌ io.emit('game-update', payload); // NEVER DO THIS
```

## 📊 Database Schema Changes

### GameSession Model
```javascript
{
  // Legacy fields (still supported)
  adminId: String,
  studentId: String,
  adminTimeMs: Number,
  studentTimeMs: Number,
  adminIsWhite: Boolean,
  
  // New fields
  player1Id: String,
  player2Id: String,
  player1TimeMs: Number,
  player2TimeMs: Number,
  player1IsWhite: Boolean,
  spectators: [String], // Array of admin IDs
  
  // Common fields
  fen: String,
  turn: String,
  status: String,
  winner: String,
  gameMode: String,
  createdAt: Date,
  lastMoveAt: Date
}
```

### GameRequest Model
```javascript
{
  studentId: String,           // Requester
  targetStudentId: String,     // NEW: Target student
  status: String,              // 'pending' | 'accepted' | 'rejected'
  timeControl: Number,
  gameMode: String,
  createdAt: Date,
  updatedAt: Date
}
```

## 🎯 Testing Commands

### Test Health Endpoint
```bash
curl http://localhost:4000/health
```

### Test Online Students
```bash
curl "http://localhost:4000/users/online?requesterId=USER_ID"
```

### Test Play Request
```bash
curl -X POST http://localhost:4000/play-requests \
  -H "Content-Type: application/json" \
  -d '{
    "fromStudentId": "STUDENT1_ID",
    "toStudentId": "STUDENT2_ID",
    "timeControl": 10
  }'
```

### Test Active Games
```bash
curl "http://localhost:4000/sessions/active?all=true"
```

## 🚀 Quick Start Commands

```bash
# Terminal 1 - Backend
cd backend
npm install
npm start

# Terminal 2 - Frontend  
cd ../
npm install
npm run dev

# Access app at: http://localhost:8080
# Backend at: http://localhost:4000
```

## ⚡ Performance Tips

1. **Socket Connection:** Reuse single socket instance per user
2. **Online Status:** Poll every 5-10 seconds, not on every render
3. **Game List:** Refresh active games every 3-5 seconds
4. **Health Ping:** Only on page load, not continuously
5. **Move Updates:** Use Socket.IO, don't poll

## 🐛 Common Issues

### "Spectator can make moves"
✅ **Fixed:** Server blocks spectator moves
```javascript
if (socketInfo && socketInfo.isSpectator) return;
```

### "Moves appear in wrong game"
✅ **Fixed:** Socket.IO rooms isolate games
```javascript
io.to(sessionId).emit(...)  // Only to specific room
```

### "Backend sleeping on Render"
✅ **Fixed:** Health endpoint + auto-ping
```typescript
initHealthCheck(); // On page load
```

### "Can't see online students"
✅ **Fixed:** User socket registration
```javascript
socket.emit('register', { userId, role });
```

---

**🎉 All features are production-ready and tested!**
