const mongoose = require('mongoose');

const GameSessionSchema = new mongoose.Schema({
  // Support both admin-student and student-student games
  adminId: { type: String, default: null, index: true },
  studentId: { type: String, default: null, index: true },
  // New fields for student-to-student play
  player1Id: { type: String, default: null, index: true },
  player2Id: { type: String, default: null, index: true },
  
  fen: { type: String, default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  turn: { type: String, enum: ['w', 'b'], default: 'w' },
  
  // Support different time formats
  adminTimeMs: { type: Number, default: 600000 },
  studentTimeMs: { type: Number, default: 600000 },
  player1TimeMs: { type: Number, default: 600000 },
  player2TimeMs: { type: Number, default: 600000 },
  
  lastMoveAt: { type: Date, default: null },
  status: { type: String, enum: ['active', 'completed', 'timeout', 'paused'], default: 'active', index: true },
  winner: { type: String, default: null },
  adminIsWhite: { type: Boolean, default: true },
  player1IsWhite: { type: Boolean, default: true },
  player2IsWhite: { type: Boolean, default: false },
  gameMode: { type: String, enum: ['friendly', 'serious'], default: 'serious' },
  createdAt: { type: Date, default: Date.now, index: -1 },
  // Track spectators (admin IDs watching this game)
  spectators: [{ type: String }]
});

// Compound indexes for common queries
GameSessionSchema.index({ status: 1, createdAt: -1 });
GameSessionSchema.index({ adminId: 1, status: 1 });
GameSessionSchema.index({ studentId: 1, status: 1 });
GameSessionSchema.index({ player1Id: 1, status: 1 });
GameSessionSchema.index({ player2Id: 1, status: 1 });

module.exports = mongoose.model('GameSession', GameSessionSchema);