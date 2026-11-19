const crypto = require('crypto');

const MAX_ANSWER_LEN = 40;

const STOPWORDS = new Set(('a an the and or but if of to in on at by for with from as is are was were be been being am ' +
  'i me my we our you your he she it its they them their this that these those so very really just too also ' +
  'not no yes do does did have has had will would can could should shall may might must about into over than then ' +
  'there here what which who whom when where why how all any each more most some such only own same up down out off').split(' '));

const BLOCKED = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'asshole', 'bastard', 'slut', 'whore',
  'chutiya', 'madarchod', 'behenchod', 'bhenchod', 'bhosdi', 'gandu', 'randi', 'lund', 'chod'];

const BLOCKED_STEMS = ['fuck', 'shit', 'bitch', 'chutiy', 'madarchod', 'behenchod', 'bhenchod', 'bhosd'];

function cleanAnswer(raw) {
  return String(raw || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_ANSWER_LEN);
}

function isBlocked(text) {
  const t = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
  const padded = ' ' + t + ' ';
  return BLOCKED.some(w => padded.includes(' ' + w + ' ')) || BLOCKED_STEMS.some(w => padded.includes(' ' + w));
}

function tokens(text, mode) {
  if (mode === 'words') {
    return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [])
      .map(w => w.replace(/['’-]+$/, ''))
      .filter(w => w.length >= 2 && !STOPWORDS.has(w.toLowerCase()));
  }
  const p = text.replace(/[.!?,;:]+$/, '').trim();
  return p ? [p] : [];
}

function newId() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(6), b => alphabet[b % alphabet.length]).join('');
}

module.exports = {
  MAX_ANSWER_LEN,
  STOPWORDS,
  BLOCKED,
  BLOCKED_STEMS,
  cleanAnswer,
  isBlocked,
  tokens,
  newId
};
