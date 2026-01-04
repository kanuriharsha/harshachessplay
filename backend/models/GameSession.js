const mongoose = require('mongoose');

const GameSessionSchema = new mongoose.Schema({
  // Support both admin-student and student-student games
  adminId: { type: String, default: null },
  studentId: { type: String, default: null },
  // New fields for student-to-student play
  player1Id: { type: String, default: null },
  player2Id: { type: String, default: null },
  
  fen: { type: String, default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  turn: { type: String, enum: ['w', 'b'], default: 'w' },
  
  // Support different time formats
  adminTimeMs: { type: Number, default: 600000 },
  studentTimeMs: { type: Number, default: 600000 },
  player1TimeMs: { type: Number, default: 600000 },
  player2TimeMs: { type: Number, default: 600000 },
  
  lastMoveAt: { type: Date, default: null },
  status: { type: String, enum: ['active', 'completed', 'timeout', 'paused'], default: 'active' },
  winner: { type: String, default: null },
  adminIsWhite: { type: Boolean, default: true },
  player1IsWhite: { type: Boolean, default: true },
  player2IsWhite: { type: Boolean, default: false },
  gameMode: { type: String, enum: ['friendly', 'serious'], default: 'serious' },
  createdAt: { type: Date, default: Date.now },
  // Track spectators (admin IDs watching this game)
  spectators: [{ type: String }]
});

module.exports = mongoose.model('GameSession', GameSessionSchema);