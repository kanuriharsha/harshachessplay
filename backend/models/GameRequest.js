const mongoose = require('mongoose');

const GameRequestSchema = new mongoose.Schema({
  studentId: { type: String, required: true, index: true },
  targetStudentId: { type: String, default: null, index: true }, // For student-to-student requests
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending', index: true },
  timeControl: { type: Number, default: null },
  gameMode: { type: String, enum: ['friendly', 'serious'], default: 'serious' },
  createdAt: { type: Date, default: Date.now, index: -1 },
  updatedAt: { type: Date, default: Date.now }
});

// Compound indexes for common queries
GameRequestSchema.index({ studentId: 1, status: 1 });
GameRequestSchema.index({ targetStudentId: 1, status: 1 });
GameRequestSchema.index({ status: 1, createdAt: -1 });

GameRequestSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('GameRequest', GameRequestSchema);
