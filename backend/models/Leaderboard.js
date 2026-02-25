const mongoose = require('mongoose');

const leaderboardEntrySchema = new mongoose.Schema({
  position: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username: { type: String, default: '' },
  fullName: { type: String, default: '' },
}, { _id: false });

const leaderboardSchema = new mongoose.Schema({
  singletonKey: { type: String, default: 'main', unique: true },
  entries: { type: [leaderboardEntrySchema], default: [] },
  banner: {
    enabled: { type: Boolean, default: false },
    playerName: { type: String, default: '' },
  },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Leaderboard', leaderboardSchema);
