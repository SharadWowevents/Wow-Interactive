const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true }
}, { _id: false });

const VenueSchema = new mongoose.Schema({
  id: { type: Number },
  name: { type: String },
  label: { type: String },
  lat: { type: Number },
  lon: { type: Number },
  cc: { type: String }
}, { _id: false });

const ResponseSchema = new mongoose.Schema({
  t: { type: Number, default: () => Date.now() },
  pid: { type: String, required: true },
  text: { type: String, default: '' },
  blocked: { type: Boolean, default: false },
  choices: [{ type: String }],
  city: {
    id: Number,
    name: String,
    state: String,
    country: String,
    cc: String,
    label: String,
    lat: Number,
    lon: Number
  }
}, { _id: false });

const QuestionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['cloud', 'map', 'poll'], default: 'cloud' },
  text: { type: String, required: true, trim: true, maxlength: 200 },
  mode: { type: String, enum: ['phrase', 'words'], default: 'phrase' },
  maxPerPerson: { type: Number, default: 3, min: 1, max: 10 },
  open: { type: Boolean, default: true },
  options: [OptionSchema],
  multi: { type: Boolean, default: false },
  showResults: { type: Boolean, default: true },
  venue: { type: VenueSchema, default: null },
  hidden: [{ type: String }],
  responses: [ResponseSchema],
  resetAt: { type: Number, default: 0 },
  createdAt: { type: Number, default: () => Date.now() }
}, {
  timestamps: true
});

module.exports = mongoose.model('Question', QuestionSchema);
