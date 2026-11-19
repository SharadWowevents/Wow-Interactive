const { summarize } = require('./summarize');

const streams = new Map(); // qid -> Set(res)
const pending = new Map(); // qid -> timer

function addSubscriber(qid, res) {
  if (!streams.has(qid)) {
    streams.set(qid, new Set());
  }
  streams.get(qid).add(res);

  reqCloseHandler = () => {
    removeSubscriber(qid, res);
  };

  return reqCloseHandler;
}

function removeSubscriber(qid, res) {
  const set = streams.get(qid);
  if (set) {
    set.delete(res);
    if (set.size === 0) {
      streams.delete(qid);
    }
  }
}

function broadcast(qid, QuestionModel) {
  if (pending.has(qid)) return;

  const timer = setTimeout(async () => {
    pending.delete(qid);
    const set = streams.get(qid);
    if (!set || !set.size) return;

    try {
      const q = await QuestionModel.findOne({ id: qid }).lean();
      const payload = q ? JSON.stringify(summarize(q)) : JSON.stringify({ deleted: true });
      for (const res of set) {
        try {
          res.write(`data: ${payload}\n\n`);
        } catch (_) {}
      }
    } catch (err) {
      console.error(`[SSE Broadcast Error] for ${qid}:`, err.message);
    }
  }, 700);

  pending.set(qid, timer);
}

// 25-second keep-alive ping
setInterval(() => {
  for (const set of streams.values()) {
    for (const res of set) {
      try {
        res.write(': ping\n\n');
      } catch (_) {}
    }
  }
}, 25000);

module.exports = {
  addSubscriber,
  removeSubscriber,
  broadcast
};
