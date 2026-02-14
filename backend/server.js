require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const User = require('./models/User');
const GameRequest = require('./models/GameRequest');
const GameSession = require('./models/GameSession');
const { Chess } = require('chess.js');

const app = express();
// Support single or comma-separated FRONTEND_URL(s) for deployments (Vercel can have multiple)
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.FRONTEND_URLS || '';
const allowedOrigins = (FRONTEND_URL ? FRONTEND_URL.split(',').map(s => s.trim()).filter(Boolean) : []).concat(['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:8081', 'http://127.0.0.1:8081']);
app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (e.g., curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true,
}));
app.use(express.json());

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Health check endpoint for Render wake-up
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
    // Normalize helper: remove all whitespace and lowercase
    const normalize = (s) => (typeof s === 'string' ? s.replace(/\s+/g, '').toLowerCase() : '');

    let user = null;
    // Try direct lookup first (fast path)
    if (username) {
      user = await User.findOne({ username }).exec();
    }
    if (!user && email) {
      // case-insensitive email match
      user = await User.findOne({ email: (email || '').trim().toLowerCase() }).exec();
    }

    // If still not found, attempt a normalized username match across users
    if (!user && username) {
      const all = await User.find({}).select('username email password role').exec();
      const target = normalize(username);
      user = all.find((u) => normalize(u.username) === target);
    }

    // If we have an email but not a direct match, also try normalized email fallback
    if (!user && email) {
      const all = await User.find({}).select('username email password role').exec();
      const targetEmail = (email || '').trim().toLowerCase();
      user = all.find((u) => (u.email || '').toLowerCase() === targetEmail);
    }

    if (!user) return res.status(400).json({ error: 'Invalid credentials. Please try with correct credentials.' });

    // Compare passwords by normalizing (ignore spaces and case) to allow flexible input
    const inputPwdNorm = normalize(password);
    const storedPwdNorm = normalize(user.password || '');
    if (inputPwdNorm !== storedPwdNorm) return res.status(400).json({ error: 'Invalid credentials. Please try with correct credentials.' });

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

// Get online students (for student-to-student play)
app.get('/users/online', async (req, res) => {
  try {
    const requesterId = req.query.requesterId;
    // Get all registered users with student role
    const students = await User.find({ role: 'student' }).select('-password -__v').exec();
    
    // Filter out the requester and mark online status based on connected sockets
    const onlineStudents = students
      .filter(s => String(s._id) !== requesterId)
      .map(s => ({
        id: s._id,
        username: s.username,
        email: s.email,
        isOnline: userSockets[String(s._id)] && userSockets[String(s._id)].size > 0
      }));
    
    res.json({ students: onlineStudents });
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

// Delete a user (admin)
app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(String(id))) return res.status(400).json({ error: 'Invalid user id' });
    const deleted = await User.findByIdAndDelete(id).exec();
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    // cleanup any socket registrations
    const uid = String(deleted._id);
    if (userSockets[uid]) {
      for (const sid of Array.from(userSockets[uid])) {
        try { io.to(sid).disconnectSockets(); } catch (e) {}
      }
      delete userSockets[uid];
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Student-to-student play requests
app.post('/play-requests', async (req, res) => {
  const { fromStudentId, toStudentId, timeControl } = req.body;
  if (!fromStudentId || !toStudentId) {
    return res.status(400).json({ error: 'Both student IDs required' });
  }
  
  try {
    // Check if request already exists
    const existing = await GameRequest.findOne({
      studentId: fromStudentId,
      targetStudentId: toStudentId,
      status: 'pending'
    }).exec();
    
    if (existing) {
      return res.status(400).json({ error: 'Request already sent' });
    }
    
    const request = await GameRequest.create({
      studentId: fromStudentId,
      targetStudentId: toStudentId,
      timeControl: timeControl || 10,
      status: 'pending'
    });
    
    // Notify target student via socket
    const targetSockets = userSockets[String(toStudentId)];
    if (targetSockets) {
      const fromUser = await User.findById(fromStudentId).exec();
      for (const sid of targetSockets) {
        io.to(sid).emit('play-request-received', {
          requestId: request._id,
          from: {
            id: fromStudentId,
            username: fromUser?.username || 'Unknown'
          },
          timeControl: request.timeControl
        });
      }
    }
    
    res.json({ request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get incoming play requests for a student
app.get('/play-requests/incoming/:studentId', async (req, res) => {
  const { studentId } = req.params;
  try {
    const requests = await GameRequest.find({
      targetStudentId: studentId,
      status: 'pending'
    }).sort({ createdAt: -1 }).exec();
    
    // Populate sender info
    const populatedRequests = await Promise.all(
      requests.map(async (r) => {
        const sender = await User.findById(r.studentId).exec();
        return {
          id: r._id,
          from: {
            id: r.studentId,
            username: sender?.username || 'Unknown'
          },
          timeControl: r.timeControl,
          createdAt: r.createdAt
        };
      })
    );
    
    res.json({ requests: populatedRequests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept/reject student play request
app.patch('/play-requests/:id/respond', async (req, res) => {
  const { id } = req.params;
  const { accepted, responderId } = req.body;
  
  try {
    const request = await GameRequest.findById(id).exec();
    if (!request) return res.status(404).json({ error: 'Request not found' });
    
    if (accepted) {
      request.status = 'accepted';
      await request.save();
      
      // Create game session between two students with complementary colors
      const p1IsWhite = Math.random() > 0.5;
      const session = await GameSession.create({
        player1Id: request.studentId,
        player2Id: request.targetStudentId,
        player1TimeMs: (request.timeControl || 10) * 60000,
        player2TimeMs: (request.timeControl || 10) * 60000,
        player1IsWhite: p1IsWhite,
        player2IsWhite: !p1IsWhite,
        gameMode: 'serious',
        status: 'active'
      });
      
      // Notify both students
      const payload = { 
        sessionId: session._id.toString(), 
        session: session 
      };
      
      const player1Sockets = userSockets[String(request.studentId)];
      const player2Sockets = userSockets[String(request.targetStudentId)];
      
      if (player1Sockets) {
        for (const sid of player1Sockets) {
          io.to(sid).emit('session-created', payload);
        }
      }
      if (player2Sockets) {
        for (const sid of player2Sockets) {
          io.to(sid).emit('session-created', payload);
        }
      }
      
      res.json({ request, session });
    } else {
      request.status = 'rejected';
      await request.save();
      
      // Notify requester and the target/responder (both parties)
      const requesterSockets = userSockets[String(request.studentId)];
      const targetSockets = userSockets[String(request.targetStudentId)];
      const payload = {
        requestId: request._id,
        message: 'Play request was declined',
        requesterId: String(request.studentId),
        targetId: String(request.targetStudentId)
      };
      if (requesterSockets) {
        for (const sid of requesterSockets) {
          io.to(sid).emit('play-request-rejected', payload);
        }
      }
      if (targetSockets) {
        for (const sid of targetSockets) {
          io.to(sid).emit('play-request-rejected', payload);
        }
      }
      
      res.json({ request });
    }
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

    // If rejected, notify both admin (responder) and the student via socket (if connected)
    if (status === 'rejected') {
      try {
        const studentId = String(request.studentId);
        const sockets = userSockets[studentId];
        const adminId = String(req.body.adminId || 'default_admin');
        const adminSockets = userSockets[adminId];
        const payload = { requestId: request._id, message: 'Admin declined to play with you' };
        if (sockets) {
          for (const sid of sockets) {
            io.to(sid).emit('request-rejected', payload);
          }
        }
        if (adminSockets) {
          for (const sid of adminSockets) {
            io.to(sid).emit('request-rejected', payload);
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
      const sessions = await GameSession.find({ status: 'active' }).sort({ createdAt: -1 }).exec();
      // Populate player names
      const populatedSessions = await Promise.all(
        sessions.map(async (s) => {
          let player1Name = 'Unknown';
          let player2Name = 'Unknown';
          
          if (s.player1Id && mongoose.Types.ObjectId.isValid(String(s.player1Id))) {
            const p1 = await User.findById(s.player1Id).exec();
            player1Name = p1?.username || 'Unknown';
          } else if (s.player1Id) {
            player1Name = String(s.player1Id);
          } else if (s.adminId && mongoose.Types.ObjectId.isValid(String(s.adminId))) {
            const admin = await User.findById(s.adminId).exec();
            player1Name = admin?.username || 'Admin';
          } else if (s.adminId) {
            player1Name = String(s.adminId);
          }
          
          if (s.player2Id && mongoose.Types.ObjectId.isValid(String(s.player2Id))) {
            const p2 = await User.findById(s.player2Id).exec();
            player2Name = p2?.username || 'Unknown';
          } else if (s.player2Id) {
            player2Name = String(s.player2Id);
          } else if (s.studentId && mongoose.Types.ObjectId.isValid(String(s.studentId))) {
            const student = await User.findById(s.studentId).exec();
            player2Name = student?.username || 'Student';
          } else if (s.studentId) {
            player2Name = String(s.studentId);
          }
          
          return {
            ...s.toObject(),
            player1Name,
            player2Name
          };
        })
      );
      return res.json({ sessions: populatedSessions });
    }

    // Default behavior: try to resolve session for a specific user
    const userId = req.query.userId || 'default_student';
    const session = await GameSession.findOne({
      status: 'active',
      $or: [
        { adminId: userId }, 
        { studentId: userId },
        { player1Id: userId },
        { player2Id: userId }
      ]
    }).sort({ createdAt: -1 }).exec();
    if (!session) return res.json({ session: null });

    // Populate names for single session return
    const s = session.toObject();
    if (s.player1Id && mongoose.Types.ObjectId.isValid(String(s.player1Id))) {
      const p1 = await User.findById(s.player1Id).exec();
      s.player1Name = p1?.username || null;
    }
    if (s.player2Id && mongoose.Types.ObjectId.isValid(String(s.player2Id))) {
      const p2 = await User.findById(s.player2Id).exec();
      s.player2Name = p2?.username || null;
    }
    if (s.adminId && mongoose.Types.ObjectId.isValid(String(s.adminId))) {
      const a = await User.findById(s.adminId).exec();
      s.adminName = a?.username || null;
    }
    if (s.studentId && mongoose.Types.ObjectId.isValid(String(s.studentId))) {
      const st = await User.findById(s.studentId).exec();
      s.studentName = st?.username || null;
    }

    res.json({ session: s });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get session by id
app.get('/sessions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const s = await GameSession.findById(id).exec();
    if (!s) return res.status(404).json({ error: 'Session not found' });

    // Populate friendly player names similar to /sessions/active
    let player1Name = null;
    let player2Name = null;
    let adminName = null;
    let studentName = null;

    if (s.player1Id && mongoose.Types.ObjectId.isValid(String(s.player1Id))) {
      const p1 = await User.findById(s.player1Id).exec();
      player1Name = p1?.username || null;
    } else if (s.player1Id) {
      player1Name = String(s.player1Id);
    }
    if (s.player2Id && mongoose.Types.ObjectId.isValid(String(s.player2Id))) {
      const p2 = await User.findById(s.player2Id).exec();
      player2Name = p2?.username || null;
    } else if (s.player2Id) {
      player2Name = String(s.player2Id);
    }
    if (s.adminId && mongoose.Types.ObjectId.isValid(String(s.adminId))) {
      const a = await User.findById(s.adminId).exec();
      adminName = a?.username || null;
    } else if (s.adminId) {
      adminName = String(s.adminId);
    }
    if (s.studentId && mongoose.Types.ObjectId.isValid(String(s.studentId))) {
      const st = await User.findById(s.studentId).exec();
      studentName = st?.username || null;
    } else if (s.studentId) {
      studentName = String(s.studentId);
    }

    const out = {
      ...s.toObject(),
      player1Name,
      player2Name,
      adminName,
      studentName,
    };

    // Resolve winnerId when winner is a role string
    try {
      let winnerId = null;
      if (out.winner) {
        winnerId = getUserIdByRole(s, out.winner) || (typeof out.winner === 'string' && out.winner.match(/^[a-fA-F0-9]{24}$/) ? out.winner : null);
      }
      out.winnerId = winnerId;
    } catch (err) {
      out.winnerId = null;
    }

    res.json({ session: out });
  } catch (err) {
    console.error('Error fetching session by id:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get recent sessions (all statuses) - for admin review
app.get('/sessions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const sessions = await GameSession.find({}).sort({ createdAt: -1 }).limit(limit).exec();
    const populated = await Promise.all(sessions.map(async (s) => {
      let player1Name = null;
      let player2Name = null;
      let adminName = null;
      let studentName = null;
          if (s.player1Id && mongoose.Types.ObjectId.isValid(String(s.player1Id))) {
            const p1 = await User.findById(s.player1Id).exec();
            player1Name = p1?.username || null;
          } else if (s.player1Id) {
            player1Name = String(s.player1Id);
          }
          if (s.player2Id && mongoose.Types.ObjectId.isValid(String(s.player2Id))) {
            const p2 = await User.findById(s.player2Id).exec();
            player2Name = p2?.username || null;
          } else if (s.player2Id) {
            player2Name = String(s.player2Id);
          }
          if (s.adminId && mongoose.Types.ObjectId.isValid(String(s.adminId))) {
            const a = await User.findById(s.adminId).exec();
            adminName = a?.username || null;
          } else if (s.adminId) {
            adminName = String(s.adminId);
          }
          if (s.studentId && mongoose.Types.ObjectId.isValid(String(s.studentId))) {
            const st = await User.findById(s.studentId).exec();
            studentName = st?.username || null;
          } else if (s.studentId) {
            studentName = String(s.studentId);
          }
      const out = { ...s.toObject(), player1Name, player2Name, adminName, studentName };
      try {
        let winnerId = null;
        if (out.winner) {
          winnerId = getUserIdByRole(s, out.winner) || (typeof out.winner === 'string' && out.winner.match(/^[a-fA-F0-9]{24}$/) ? out.winner : null);
        }
        out.winnerId = winnerId;
      } catch (err) {
        out.winnerId = null;
      }
      return out;
    }));
    res.json({ sessions: populated });
  } catch (err) {
    console.error('Error fetching sessions list:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint for admin to join as spectator
app.post('/sessions/:id/spectate', async (req, res) => {
  const { id } = req.params;
  const { adminId } = req.body;
  
  try {
    const session = await GameSession.findById(id).exec();
    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    // Add admin to spectators if not already present
    if (!session.spectators) session.spectators = [];
    if (!session.spectators.includes(adminId)) {
      session.spectators.push(adminId);
      await session.save();
    }
    
    res.json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin creates a game between two students
app.post('/sessions/create-student-game', async (req, res) => {
  const { student1Id, student2Id, timeControl, student1IsWhite } = req.body;
  
  if (!student1Id || !student2Id) {
    return res.status(400).json({ error: 'Both student IDs required' });
  }
  
  if (student1Id === student2Id) {
    return res.status(400).json({ error: 'Cannot create game between same student' });
  }
  
  try {
    // Verify both are students
    const student1 = await User.findById(student1Id).exec();
    const student2 = await User.findById(student2Id).exec();
    
    if (!student1 || !student2) {
      return res.status(404).json({ error: 'One or both students not found' });
    }
    
    if (student1.role !== 'student' || student2.role !== 'student') {
      return res.status(400).json({ error: 'Both users must be students' });
    }
    
    // Create session
    const timeMs = (timeControl || 15) * 60000;
    const session = await GameSession.create({
      player1Id: student1Id,
      player2Id: student2Id,
      player1TimeMs: timeMs,
      player2TimeMs: timeMs,
      player1IsWhite: student1IsWhite === undefined ? true : !!student1IsWhite,
      player2IsWhite: student1IsWhite === undefined ? false : !student1IsWhite,
      gameMode: 'serious',
      status: 'active'
    });
    
    // Notify both students via socket
    const payload = { 
      sessionId: session._id.toString(), 
      session: session,
      message: 'Admin has started a game for you!'
    };
    
    const s1Sockets = userSockets[String(student1Id)];
    const s2Sockets = userSockets[String(student2Id)];
    
    if (s1Sockets) {
      for (const sid of s1Sockets) {
        io.to(sid).emit('session-created', payload);
      }
    }
    if (s2Sockets) {
      for (const sid of s2Sockets) {
        io.to(sid).emit('session-created', payload);
      }
    }
    
    res.json({ session });
  } catch (err) {
    console.error('Error creating student game:', err);
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

// Delete a session (admin) - removes session record from DB
app.delete('/sessions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(String(id))) return res.status(400).json({ error: 'Invalid session id' });
    const deleted = await GameSession.findByIdAndDelete(id).exec();
    if (!deleted) return res.status(404).json({ error: 'Session not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting session:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const { Server: IOServer } = require('socket.io');
const io = new IOServer(server, {
  cors: {
    origin: FRONTEND_URL ? [FRONTEND_URL, 'http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:8081', 'http://127.0.0.1:8081'] : ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:8081', 'http://127.0.0.1:8081'],
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
// Per-session move queues to ensure sequential processing and avoid race conditions
const sessionMoveQueues = {}; // { [sessionId]: Array<moveData> }
const sessionProcessing = {}; // { [sessionId]: boolean }

// Helper: map a session and a role string to a userId when possible
function getUserIdByRole(session, role) {
  if (!role || !session) return null;
  if (role === 'admin') return session.adminId || null;
  if (role === 'student') return session.studentId || null;
  if (role === 'player1') return session.player1Id || null;
  if (role === 'player2') return session.player2Id || null;
  // If role looks like an id (24 hex chars), assume it's an id
  if (typeof role === 'string' && role.match(/^[a-fA-F0-9]{24}$/)) return role;
  return null;
}

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
    // Attempt to detect any active session for this user and reattach them
    (async () => {
      try {
        const session = await GameSession.findOne({
          status: 'active',
          $or: [
            { adminId: userId },
            { studentId: userId },
            { player1Id: userId },
            { player2Id: userId }
          ]
        }).sort({ createdAt: -1 }).exec();
        if (session) {
          const sessionId = session._id.toString();
          // Join the socket to the room
          socket.join(sessionId);
          // Update in-memory session socket mapping: prefer role-specific slots
          if (!sessionSockets[sessionId]) sessionSockets[sessionId] = { admin: null, student: null, player1: null, player2: null, spectators: [] };
          // Determine which slot this user occupies
          if (String(session.adminId) === String(userId)) sessionSockets[sessionId].admin = socket.id;
          else if (String(session.studentId) === String(userId)) sessionSockets[sessionId].student = socket.id;
          else if (String(session.player1Id) === String(userId)) sessionSockets[sessionId].player1 = socket.id;
          else if (String(session.player2Id) === String(userId)) sessionSockets[sessionId].player2 = socket.id;
          socketToSession[socket.id] = { sessionId, role: null, isSpectator: false };

          // Send latest authoritative session state to the reattached client
          io.to(socket.id).emit('session-reattached', {
            sessionId,
            session: session,
            message: 'Reattached to active session',
          });
          console.log(`Reattached user ${userId} (socket ${socket.id}) to session ${sessionId}`);
        }
      } catch (err) {
        console.error('Error while attempting to reattach user on register:', err);
      }
    })();
  });

  socket.on('join-session', (data) => {
    // Accept either string sessionId or object { sessionId, role }
    let sessionId = null;
    let role = null;
    let isSpectator = false;
    
    if (typeof data === 'string') sessionId = data;
    else if (data && data.sessionId) {
      sessionId = data.sessionId;
      role = data.role;
      isSpectator = data.isSpectator || false;
    }

    if (!sessionId) return;
    socket.join(sessionId);
    console.log(`User ${socket.id} joined session ${sessionId} role=${role} spectator=${isSpectator}`);

    // initialize mapping
    if (!sessionSockets[sessionId]) sessionSockets[sessionId] = { admin: null, student: null, player1: null, player2: null, spectators: [] };
    
    if (isSpectator) {
      // Add to spectators list
      sessionSockets[sessionId].spectators.push(socket.id);
    } else if (role === 'admin') {
      sessionSockets[sessionId].admin = socket.id;
    } else if (role === 'student') {
      sessionSockets[sessionId].student = socket.id;
    } else if (role === 'player1') {
      sessionSockets[sessionId].player1 = socket.id;
    } else if (role === 'player2') {
      sessionSockets[sessionId].player2 = socket.id;
    } else {
      // unknown role: try to fill empty slot
      if (!sessionSockets[sessionId].player1) sessionSockets[sessionId].player1 = socket.id;
      else if (!sessionSockets[sessionId].player2) sessionSockets[sessionId].player2 = socket.id;
      else if (!sessionSockets[sessionId].admin) sessionSockets[sessionId].admin = socket.id;
      else if (!sessionSockets[sessionId].student) sessionSockets[sessionId].student = socket.id;
    }

    socketToSession[socket.id] = { sessionId, role, isSpectator };
  });

  // Enqueue moves to ensure sequential processing per session and avoid race conditions
  socket.on('move', (data) => {
    const { sessionId } = data || {};
    const socketInfo = socketToSession[socket.id];
    if (socketInfo && socketInfo.isSpectator) {
      console.log('Spectator attempted to make a move - blocked');
      return;
    }
    if (!sessionId) return;
    if (!sessionMoveQueues[sessionId]) sessionMoveQueues[sessionId] = [];
    sessionMoveQueues[sessionId].push({ socketId: socket.id, data });
    // start processing if not already
    if (!sessionProcessing[sessionId]) processNextMove(sessionId).catch(err => console.error('processNextMove error:', err));
  });

  async function processNextMove(sessionId) {
    if (sessionProcessing[sessionId]) return;
    sessionProcessing[sessionId] = true;
    while (sessionMoveQueues[sessionId] && sessionMoveQueues[sessionId].length > 0) {
      const item = sessionMoveQueues[sessionId].shift();
      const { data } = item || {};
      const { fen, turn } = data || {};
      try {
        const session = await GameSession.findById(sessionId).exec();
        if (!session) continue;
        // apply authoritative update
        if (fen !== undefined) session.fen = fen;
        if (turn !== undefined) session.turn = turn;
        if (data.adminTimeMs !== undefined) session.adminTimeMs = data.adminTimeMs;
        if (data.studentTimeMs !== undefined) session.studentTimeMs = data.studentTimeMs;
        if (data.player1TimeMs !== undefined) session.player1TimeMs = data.player1TimeMs;
        if (data.player2TimeMs !== undefined) session.player2TimeMs = data.player2TimeMs;
        session.lastMoveAt = new Date();
        await session.save();

        const payload = {
          sessionId: session._id.toString(),
          fen: session.fen,
          turn: session.turn,
          adminTimeMs: session.adminTimeMs,
          studentTimeMs: session.studentTimeMs,
          player1TimeMs: session.player1TimeMs,
          player2TimeMs: session.player2TimeMs,
        };
        if (data && data.lastMove) payload.lastMove = data.lastMove;
        io.to(sessionId).emit('game-update', payload);
      } catch (err) {
        console.error('Move processing error for session', sessionId, err);
      }
    }
    sessionProcessing[sessionId] = false;
  }

  // Timer timeout from client: declare opponent the winner
  socket.on('timeout', async (data) => {
    const { sessionId, timedOutRole } = data || {};
    if (!sessionId || !timedOutRole) return;
    try {
      const session = await GameSession.findById(sessionId).exec();
      if (!session) return;
      session.status = 'completed';

      // Determine winner role opposite of timedOutRole
      let winnerRole = null;
      if (timedOutRole === 'admin') winnerRole = 'student';
      else if (timedOutRole === 'student') winnerRole = 'admin';
      else if (timedOutRole === 'player1') winnerRole = 'player2';
      else if (timedOutRole === 'player2') winnerRole = 'player1';

      const winnerId = getUserIdByRole(session, winnerRole) || null;
      const loserId = getUserIdByRole(session, timedOutRole) || null;

      session.winner = winnerId || winnerRole || 'opponent';
      await session.save();

      io.to(sessionId).emit('game-ended', { result: 'timeout', winner: session.winner, winnerId, loserId, sessionId: session._id.toString(), adminId: session.adminId, studentId: session.studentId, player1Id: session.player1Id, player2Id: session.player2Id, timedOutRole });
      // keep session in DB for admin review
    } catch (err) {
      console.error('Timeout handler error:', err);
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
      io.to(sessionId).emit('game-update', { sessionId: session._id.toString(), fen: session.fen, turn: session.turn, adminTimeMs: session.adminTimeMs, studentTimeMs: session.studentTimeMs, lastMove: null });
    } catch (err) {
      console.error('Undo error:', err);
    }
  });

  socket.on('draw-request', (data) => {
    const { sessionId, fromRole } = data;
    console.log(`Draw request from ${fromRole} in session ${sessionId}`);
    socket.to(sessionId).emit('draw-request-received', { sessionId, fromRole });
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
          io.to(sessionId).emit('game-ended', { result: 'draw', winner: 'draw', winnerId: null, sessionId: session._id.toString(), adminId: session.adminId, studentId: session.studentId, player1Id: session.player1Id, player2Id: session.player2Id });
          // keep session in DB so admin/spectators can review results later
        }
      } else {
        socket.to(sessionId).emit('draw-declined', { sessionId });
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

        // Try to resolve the actual resigner by socket->user mapping first (handles student-vs-student)
        const resignerUserId = socketToUser[socket.id] || null;

        // Determine loser and winner userIds
        let loserId = null;
        let winnerId = null;

        if (resignerUserId) {
          loserId = resignerUserId;
          // Opponent determination for student-vs-student or admin-student
          if (session.player1Id && session.player2Id) {
            winnerId = session.player1Id === resignerUserId ? session.player2Id : (session.player2Id === resignerUserId ? session.player1Id : null);
          } else if (session.adminId && session.studentId) {
            winnerId = session.adminId === resignerUserId ? session.studentId : (session.studentId === resignerUserId ? session.adminId : null);
          }
        }

        // If we couldn't determine by socket mapping, fall back to role string resolution
        if (!winnerId) {
          if (resignerRole === 'admin') winnerId = session.studentId || null;
          else if (resignerRole === 'student') winnerId = session.adminId || null;
          else if (resignerRole === 'player1') winnerId = session.player2Id || null;
          else if (resignerRole === 'player2') winnerId = session.player1Id || null;
        }

        // If loserId not set, try resolving via role
        if (!loserId) {
          loserId = getUserIdByRole(session, resignerRole) || null;
        }

        session.winner = winnerId || (resignerRole === 'admin' ? 'student' : (resignerRole === 'student' ? 'admin' : 'opponent'));
        await session.save();

        io.to(sessionId).emit('game-ended', { result: 'resign', winner: session.winner, winnerId, loserId, sessionId: session._id.toString(), adminId: session.adminId, studentId: session.studentId, player1Id: session.player1Id, player2Id: session.player2Id });
        // keep session record for auditing
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
      // If the client claims checkmate, validate it server-side by testing all legal moves
      if (result === 'checkmate') {
        const fenToCheck = (data && data.fen) || session.fen || null;
        if (!fenToCheck) {
          // no FEN to validate against; reject the claim
          console.warn('Received checkmate claim without FEN for session', sessionId);
          return;
        }

        const chess = new Chess(fenToCheck);
        // Only proceed to finalize if position is indeed a check for side to move
        if (!chess.isCheck()) {
          console.warn('Received checkmate claim but side to move is not in check for session', sessionId);
          return;
        }

        // Generate all legal moves for the side to move and test whether any move removes the check
        const legalMoves = chess.moves({ verbose: true }) || [];
        let escapeFound = false;
        for (const mv of legalMoves) {
          try {
            const test = new Chess(fenToCheck);
            const promotion = mv.promotion || 'q';
            const made = test.move({ from: mv.from, to: mv.to, promotion });
            if (!made) continue;
            if (!test.isCheck()) {
              escapeFound = true;
              break;
            }
          } catch (e) {
            // ignore move application errors and continue testing others
            continue;
          }
        }

        if (escapeFound) {
          // Not a checkmate — client reported checkmate but an escaping move exists
          console.warn('Client reported checkmate but an escaping move exists for session', sessionId);
          // Optionally notify the reporting client that the claim was rejected
          io.to(socket.id).emit('game-ended-invalid', { reason: 'not_checkmate', sessionId });
          return;
        }

        // All legal moves leave the king in check -> valid checkmate, fall through to finalize below
      }

      // Finalize the session (draw/resign/validated checkmate/etc.)
      session.status = 'completed';
      // Normalize winner: could be a role ('admin','student','player1','player2') or a userId
      let winnerId = null;
      if (winner) {
        // try to resolve role to userId
        winnerId = getUserIdByRole(session, winner) || (typeof winner === 'string' && winner.match(/^[a-fA-F0-9]{24}$/) ? winner : null);
        session.winner = winnerId || winner;
      }
      await session.save();
      const player1Id = session.player1Id || null;
      const player2Id = session.player2Id || null;
      const loserId = winnerId ? (winnerId === player1Id ? player2Id : (winnerId === player2Id ? player1Id : null)) : null;
      io.to(sessionId).emit('game-ended', { result: result || 'ended', winner: session.winner, winnerId, loserId, sessionId: session._id.toString(), adminId: session.adminId, studentId: session.studentId, player1Id, player2Id });
      // keep session record for later review by admins/spectators
    } catch (err) {
      console.error('game-ended handler error:', err);
    }
  });



  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    const mapping = socketToSession[socket.id];
    const uid = socketToUser[socket.id];

    // Cleanup user socket registration
    if (uid) {
      const set = userSockets[uid];
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) delete userSockets[uid];
      }
      delete socketToUser[socket.id];
    }

    // If not in a session mapping, nothing more to do
    if (!mapping) return;

    const { sessionId, role } = mapping;

    // remove socket mapping
    if (sessionSockets[sessionId]) {
      if (sessionSockets[sessionId].admin === socket.id) sessionSockets[sessionId].admin = null;
      if (sessionSockets[sessionId].student === socket.id) sessionSockets[sessionId].student = null;
      if (sessionSockets[sessionId].player1 === socket.id) sessionSockets[sessionId].player1 = null;
      if (sessionSockets[sessionId].player2 === socket.id) sessionSockets[sessionId].player2 = null;
      // remove from spectators array if present
      if (sessionSockets[sessionId].spectators) sessionSockets[sessionId].spectators = sessionSockets[sessionId].spectators.filter(sid => sid !== socket.id);
    }
    delete socketToSession[socket.id];

    try {
      const session = await GameSession.findById(sessionId).exec();
      if (session) {
        // Do NOT conclude games on disconnect. Instead, mark the player as temporarily offline
        // and notify remaining participants so clocks continue running on clients.
        const disconnectedUserId = uid || null;
        io.to(sessionId).emit('player-offline', { sessionId, disconnectedUserId, socketId: socket.id, role });
        console.log(`Player ${disconnectedUserId || socket.id} marked offline in session ${sessionId}`);
        // Keep session.status as 'active' so game continues. Persist a lastMoveAt if needed.
        // Optionally set a lightweight flag on session in DB (not changing schema) by updating lastMoveAt
        session.lastMoveAt = session.lastMoveAt || new Date();
        await session.save();
      }
    } catch (err) {
      console.error('Error handling disconnect for session', sessionId, err);
    }

    // cleanup empty sessionSockets entry only if no known sockets remain
    if (sessionSockets[sessionId] && !sessionSockets[sessionId].admin && !sessionSockets[sessionId].student && !sessionSockets[sessionId].player1 && !sessionSockets[sessionId].player2 && (!sessionSockets[sessionId].spectators || sessionSockets[sessionId].spectators.length === 0)) {
      delete sessionSockets[sessionId];
    }
  });
});
