const mongoose = require('mongoose');

const GameSessionSchema = new mongoose.Schema({
  adminId: { type: String, required: true },
  studentId: { type: String, required: true },
  fen: { type: String, default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  turn: { type: String, enum: ['w', 'b'], default: 'w' },
  adminTimeMs: { type: Number, default: 600000 },
  studentTimeMs: { type: Number, default: 600000 },
  lastMoveAt: { type: Date, default: null },
  status: { type: String, enum: ['active', 'completed', 'timeout', 'paused'], default: 'active' },
  winner: { type: String, enum: ['admin', 'student', 'draw', null], default: null },
  adminIsWhite: { type: Boolean, default: true },
  gameMode: { type: String, enum: ['friendly', 'serious'], default: 'serious' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GameSession', GameSessionSchema);