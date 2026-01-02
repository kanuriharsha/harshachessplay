const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String },
  // Make email optional so users can sign up with username/password only.
  // Use a sparse unique index so multiple docs without email don't conflict.
  email: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'student'], default: 'student' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
