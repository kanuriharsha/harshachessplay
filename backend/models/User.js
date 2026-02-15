const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, index: true },
  // Make email optional so users can sign up with username/password only.
  // Use a sparse unique index so multiple docs without email don't conflict.
  email: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'student'], default: 'student', index: true },
  createdAt: { type: Date, default: Date.now }
});

// Compound index for faster queries
UserSchema.index({ role: 1, username: 1 });

module.exports = mongoose.model('User', UserSchema);
