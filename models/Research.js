

const mongoose = require("mongoose");

const researchSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  query: { type: String, required: true },
  report: { type: String, default: "" },
  summary: { type: String, default: "" },
  sources: [{ title: String, url: String, content: String }],
  factCheck: { type: Object, default: {} },
  reliabilityScore: { type: Number, default: 75 },
  isPublic: { type: Boolean, default: false },
  language: { type: String, default: "english" },
  rating: { type: Number, min: 1, max: 5, default: null },
  bookmarks: [{ text: String, note: String, createdAt: { type: Date, default: Date.now } }],
  collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  tags: [{ type: String }],
  template: { type: String, default: null },
  scheduledAt: { type: Date},
  isScheduled: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Research", researchSchema);