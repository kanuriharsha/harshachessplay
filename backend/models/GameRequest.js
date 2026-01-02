const mongoose = require('mongoose');

const GameRequestSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  timeControl: { type: Number, default: null },
  gameMode: { type: String, enum: ['friendly', 'serious'], default: 'serious' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

GameRequestSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('GameRequest', GameRequestSchema);
