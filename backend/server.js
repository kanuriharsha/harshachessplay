require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const User = require('./models/User');
const GameRequest = require('./models/GameRequest');
const GameSession = require('./models/GameSession');

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL;
app.use(cors({
  origin: FRONTEND_URL ? [FRONTEND_URL, 'http://localhost:8080', 'http://127.0.0.1:8080'] : ['http://localhost:8080', 'http://127.0.0.1:8080'],
  credentials: true,
}));
app.use(express.json());

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Auth routes
app.post('/auth/signup', async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    // Check by username first, then email if provided
    const existing = await User.findOne({ $or: [{ username }, ...(email ? [{ email }] : [])] }).exec();
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const user = await User.create({ username, email: email || null, password, role: role === 'admin' ? 'admin' : 'student' });
    res.json({ user: { id: user._id, email: user.email, role: user.role, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/auth/signin', async (req, res) => {
  const { username, email, password } = req.body;
  if ((!username && !email) || !password) return res.status(400).json({ error: 'Username/email and password required' });

  try {
    let user = null;
    if (username) {
      user = await User.findOne({ username }).exec();
    }
    if (!user && email) {
      user = await User.findOne({ email }).exec();
    }

    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    if (password !== user.password) return res.status(400).json({ error: 'Invalid credentials' });
    res.json({ user: { id: user._id, email: user.email, role: user.role, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// User management routes (admin only)
app.get('/users', async (req, res) => {
  try {
    const users = await User.find({}).select('-__v').exec();
    res.json({ users: users.map(u => ({ id: u._id, email: u.email, username: u.username, role: u.role, createdAt: u.createdAt })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, email } = req.body;
  
  try {
    const user = await User.findById(id).exec();
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (username !== undefined) user.username = username;
    if (password !== undefined && password.trim() !== '') user.password = password;
    if (email !== undefined) user.email = email;
    
    await user.save();
    res.json({ user: { id: user._id, email: user.email, username: user.username, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Requests
app.post('/requests', async (req, res) => {
  // Accept studentId from body when provided (frontend should send authenticated id)
  const userId = req.body?.studentId || 'default_student';
  try {
    const existing = await GameRequest.findOne({ studentId: userId, status: 'pending' }).exec();
    if (existing) return res.status(400).json({ error: 'Existing pending request' });
    const reqDoc = await GameRequest.create({ studentId: userId });
    res.json({ request: reqDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/requests', async (req, res) => {
  // Assume admin for getting pending
  try {
    // If a userId is provided, return requests for that student only

    if (req.query.userId) {
      const userId = req.query.userId;
      // For student-specific requests, only return pending requests so
      // rejected/accepted requests don't appear in the student's dashboard.
      const requests = await GameRequest.find({ studentId: userId, status: 'pending' }).sort({ createdAt: -1 }).exec();
      return res.json({ requests: requests.map(r => ({ ...r.toObject(), id: r._id })) });
    }

    // Default: return pending requests for admin, newest first
    const data = await GameRequest.find({ status: 'pending' }).sort({ createdAt: -1 }).exec();
    res.json({ requests: data.map(r => ({ ...r.toObject(), id: r._id })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/requests/:id', async (req, res) => {
  const { id } = req.params;
  const { status, timeControl, adminIsWhite } = req.body;
  try {
    const request = await GameRequest.findById(id).exec();
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (status) request.status = status;
    if (timeControl) request.timeControl = timeControl;
    await request.save();

    // If accepted, create game session
    if (status === 'accepted') {
      const gameMode = req.body.gameMode || 'serious';
      // Prefer explicit adminId provided by the caller (frontend should provide authenticated user id)
      const adminId = req.body.adminId || 'default_admin';
      const session = await GameSession.create({
        adminId: adminId,
        studentId: request.studentId,
        adminTimeMs: timeControl * 60000 || 600000,
        studentTimeMs: timeControl * 60000 || 600000,
        adminIsWhite: adminIsWhite === undefined ? true : !!adminIsWhite,
        gameMode,
      });

      // Notify both admin and student sockets that a session was created so clients can
      // join the room immediately and navigate to the game UI.
      try {
        const payload = { sessionId: session._id.toString(), session: session };
        const adminSockets = userSockets[String(adminId)];
        const studentSockets = userSockets[String(request.studentId)];
        if (adminSockets) for (const sid of adminSockets) io.to(sid).emit('session-created', payload);
        if (studentSockets) for (const sid of studentSockets) io.to(sid).emit('session-created', payload);
      } catch (emitErr) {
        console.error('Failed to emit session-created:', emitErr);
      }
    }

    // If rejected, notify the student via socket (if connected)
    if (status === 'rejected') {
      try {
        const studentId = String(request.studentId);
        const sockets = userSockets[studentId];
        if (sockets) {
          for (const sid of sockets) {
            io.to(sid).emit('request-rejected', { requestId: request._id, message: 'Admin declined to play with you' });
          }
        }
      } catch (emitErr) {
        console.error('Failed to emit request-rejected:', emitErr);
      }
    }

    res.json({ request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/requests/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const request = await GameRequest.findById(id).exec();
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (String(request.studentId) !== 'default_student') return res.status(403).json({ error: 'Not authorized to delete' });
    await request.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Game Sessions
app.get('/sessions/active', async (req, res) => {
  try {
    // If caller requests all active sessions (for server-side joining of rooms), return any active session
    if (req.query.all) {
      const session = await GameSession.findOne({ status: 'active' }).sort({ createdAt: -1 }).exec();
      return res.json({ session });
    }

    // Default behavior: try to resolve session for a specific user (fallbacks to default_student/admin)
    const userId = req.query.userId || 'default_student';
    const session = await GameSession.findOne({
      status: 'active',
      $or: [{ adminId: userId }, { studentId: userId }]
    }).sort({ createdAt: -1 }).exec();
    res.json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/sessions/:id', async (req, res) => {
  const { id } = req.params;
  const { fen, turn, adminTimeMs, studentTimeMs, status, winner } = req.body;
  try {
    const session = await GameSession.findById(id).exec();
    if (!session) return res.status(404).json({ error: 'Session not found' });
    // Assume authorized
    if (fen) session.fen = fen;
    if (turn) session.turn = turn;
    if (adminTimeMs !== undefined) session.adminTimeMs = adminTimeMs;
    if (studentTimeMs !== undefined) session.studentTimeMs = studentTimeMs;
    if (status) session.status = status;
    if (winner) session.winner = winner;
    session.lastMoveAt = new Date();
    await session.save();
    res.json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const { Server: IOServer } = require('socket.io');
const io = new IOServer(server, {
  cors: {
    origin: FRONTEND_URL ? [FRONTEND_URL, 'http://localhost:8080', 'http://127.0.0.1:8080'] : ['http://localhost:8080', 'http://127.0.0.1:8080'],
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

// In-memory tracking of sockets per session and socket->session map
const sessionSockets = {}; // { [sessionId]: { admin: socketId|null, student: socketId|null } }
const socketToSession = {}; // { [socketId]: { sessionId, role } }
// Map of userId -> Set of socketIds for direct user notifications
const userSockets = {}; // { [userId]: Set(socketId) }
const socketToUser = {}; // { [socketId]: userId }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Allow clients to register their authenticated userId for direct messages
  socket.on('register', (data) => {
    const userId = data && data.userId;
    if (!userId) return;
    if (!userSockets[userId]) userSockets[userId] = new Set();
    userSockets[userId].add(socket.id);
    socketToUser[socket.id] = userId;
    console.log(`Socket ${socket.id} registered as user ${userId}`);
  });

  socket.on('join-session', (data) => {
    // Accept either string sessionId or object { sessionId, role }
    let sessionId = null;
    let role = null;
    if (typeof data === 'string') sessionId = data;
    else if (data && data.sessionId) {
      sessionId = data.sessionId;
      role = data.role;
    }

    if (!sessionId) return;
    socket.join(sessionId);
    console.log(`User ${socket.id} joined session ${sessionId} role=${role}`);

    // initialize mapping
    if (!sessionSockets[sessionId]) sessionSockets[sessionId] = { admin: null, student: null };
    if (role === 'admin') sessionSockets[sessionId].admin = socket.id;
    else if (role === 'student') sessionSockets[sessionId].student = socket.id;
    else {
      // unknown role: try to fill empty slot
      if (!sessionSockets[sessionId].admin) sessionSockets[sessionId].admin = socket.id;
      else if (!sessionSockets[sessionId].student) sessionSockets[sessionId].student = socket.id;
    }

    socketToSession[socket.id] = { sessionId, role };
  });

  socket.on('move', async (data) => {
    const { sessionId, fen, turn, adminTimeMs, studentTimeMs } = data;
    try {
      const session = await GameSession.findById(sessionId).exec();
      if (session) {
        session.fen = fen;
        session.turn = turn;
        if (adminTimeMs !== undefined) session.adminTimeMs = adminTimeMs;
        if (studentTimeMs !== undefined) session.studentTimeMs = studentTimeMs;
        session.lastMoveAt = new Date();
        await session.save();
        // Forward lastMove from the client if provided so remote clients can
        // highlight the recent move (FEN alone doesn't preserve history).
        const payload = { fen, turn, adminTimeMs, studentTimeMs };
        if (data && data.lastMove) payload.lastMove = data.lastMove;
        io.to(sessionId).emit('game-update', payload);
      }
    } catch (err) {
      console.error('Move update error:', err);
    }
  });

  // Undo move support: only allowed in friendly mode. Client must include the
  // desired FEN to revert to (server does not reconstruct history).
  socket.on('undo', async (data) => {
    const { sessionId, fen } = data || {};
    try {
      const session = await GameSession.findById(sessionId).exec();
      if (!session) return;
      if (session.gameMode !== 'friendly') {
        // Not allowed
        return;
      }
      session.fen = fen;
      session.lastMoveAt = new Date();
      await session.save();
      io.to(sessionId).emit('game-update', { fen: session.fen, turn: session.turn, adminTimeMs: session.adminTimeMs, studentTimeMs: session.studentTimeMs, lastMove: null });
    } catch (err) {
      console.error('Undo error:', err);
    }
  });

  socket.on('draw-request', (data) => {
    const { sessionId, fromRole } = data;
    console.log(`Draw request from ${fromRole} in session ${sessionId}`);
    socket.to(sessionId).emit('draw-request-received', { fromRole });
  });

  socket.on('draw-response', async (data) => {
    const { sessionId, accepted } = data;
    try {
      if (accepted) {
        const session = await GameSession.findById(sessionId).exec();
        if (session) {
          session.status = 'completed';
          session.winner = 'draw';
          await session.save();
          io.to(sessionId).emit('game-ended', { result: 'draw', winner: 'draw', sessionId: session._id.toString() });
          // destroy session permanently
          try {
            await GameSession.deleteOne({ _id: session._id }).exec();
            console.log('Deleted session after draw:', session._id.toString());
          } catch (delErr) {
            console.error('Failed to delete session after draw:', delErr);
          }
        }
      } else {
        socket.to(sessionId).emit('draw-declined');
      }
    } catch (err) {
      console.error('Draw response error:', err);
    }
  });

  socket.on('resign', async (data) => {
    const { sessionId, resignerRole } = data;
    try {
      const session = await GameSession.findById(sessionId).exec();
      if (session) {
        session.status = 'completed';
        session.winner = resignerRole === 'admin' ? 'student' : 'admin';
        await session.save();
        io.to(sessionId).emit('game-ended', { result: 'resign', winner: session.winner, sessionId: session._id.toString(), adminId: session.adminId, studentId: session.studentId });
        // destroy session permanently
        try {
          await GameSession.deleteOne({ _id: session._id }).exec();
          console.log('Deleted session after resign:', session._id.toString());
        } catch (delErr) {
          console.error('Failed to delete session after resign:', delErr);
        }
      }
    } catch (err) {
      console.error('Resign error:', err);
    }
  });

  // Accept client-side notification that a game reached a terminal state
  socket.on('game-ended', async (data) => {
    const { sessionId, result, winner } = data || {};
    if (!sessionId) return;
    try {
      const session = await GameSession.findById(sessionId).exec();
      if (!session) return;
      session.status = 'completed';
      if (winner) session.winner = winner;
      await session.save();
      io.to(sessionId).emit('game-ended', { result: result || 'ended', winner: session.winner, sessionId: session._id.toString(), adminId: session.adminId, studentId: session.studentId });
      // destroy session permanently
      try {
        await GameSession.deleteOne({ _id: session._id }).exec();
        console.log('Deleted session after game-ended:', session._id.toString());
      } catch (delErr) {
        console.error('Failed to delete session after game-ended:', delErr);
      }
    } catch (err) {
      console.error('game-ended handler error:', err);
    }
  });



  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    const mapping = socketToSession[socket.id];
    if (!mapping) return;
    const { sessionId, role } = mapping;

    // Cleanup user socket registration
    const uid = socketToUser[socket.id];
    if (uid) {
      const set = userSockets[uid];
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) delete userSockets[uid];
      }
      delete socketToUser[socket.id];
    }

    // remove socket mapping
    if (sessionSockets[sessionId]) {
      if (sessionSockets[sessionId].admin === socket.id) sessionSockets[sessionId].admin = null;
      if (sessionSockets[sessionId].student === socket.id) sessionSockets[sessionId].student = null;
    }
    delete socketToSession[socket.id];

    // If other player still present, declare them winner and destroy session
    const sessionMap = sessionSockets[sessionId];
    const remainingSocketId = sessionMap ? (sessionMap.admin || sessionMap.student) : null;
    try {
      const session = await GameSession.findById(sessionId).exec();
      if (session) {
        // If one player left (remainingSocketId exists) -> remaining player wins
        if (remainingSocketId) {
          // determine winner role (the opposite of the disconnected role if provided)
          let winnerRole = null;
          if (role === 'admin') winnerRole = 'student';
          else if (role === 'student') winnerRole = 'admin';
          else {
            // fallback: if admin slot occupied then admin wins else student
            winnerRole = sessionSockets[sessionId] && sessionSockets[sessionId].admin ? 'admin' : 'student';
          }

          session.status = 'completed';
          session.winner = winnerRole;
          await session.save();
          io.to(sessionId).emit('game-ended', { result: 'opponent-left', winner: winnerRole, sessionId: session._id.toString(), adminId: session.adminId, studentId: session.studentId });
          // destroy session
          try {
            await GameSession.deleteOne({ _id: session._id }).exec();
            console.log('Deleted session after disconnect:', session._id.toString());
          } catch (delErr) {
            console.error('Failed to delete session after disconnect:', delErr);
          }
        } else {
          // No players left in room; ensure session removed
          try {
            await GameSession.deleteOne({ _id: session._id }).exec();
            console.log('Deleted session (no players left):', session._id.toString());
          } catch (delErr) {
            console.error('Failed to delete empty session:', delErr);
          }
        }
      }
    } catch (err) {
      console.error('Error handling disconnect for session', sessionId, err);
    }
    // cleanup sessionSockets entry
    if (sessionSockets[sessionId] && !sessionSockets[sessionId].admin && !sessionSockets[sessionId].student) {
      delete sessionSockets[sessionId];
    }
  });
});
