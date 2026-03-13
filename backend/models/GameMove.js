const mongoose = require('mongoose');

const GameMoveSchema = new mongoose.Schema({
  gameId:       { type: String, required: true, index: true },
  moveNumber:   { type: Number, required: true },
  playerColor:  { type: String, enum: ['white', 'black'], required: true },
  move:         { type: String, required: true }, // SAN notation
  fenPosition:  { type: String, required: true }, // FEN after the move
  createdAt:    { type: Date, default: Date.now },
});

// Compound index for efficient threefold-repetition queries
GameMoveSchema.index({ gameId: 1, fenPosition: 1 });
GameMoveSchema.index({ gameId: 1, moveNumber: 1 });

module.exports = mongoose.model('GameMove', GameMoveSchema);
