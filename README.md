# Wow Interactive (MERN Stack Edition)

Interactive audience platform for live events: **☁️ Word clouds**, **📍 Live maps ("Where are you from?")**, and **📊 Polls**. Each question generates a dynamic QR code. The audience participates on mobile with zero app installation, and the live projector screens update in real-time.

Converted from a flat-file prototype into a full **MERN** application:
- **M**ongoDB & Mongoose for scalable, indexed document storage with schema validation.
- **E**xpress.js API backend with Server-Sent Events (SSE) for low-latency live streaming.
- **R**eact (Vite) single-page application with modern hooks, responsive layouts, and interactive visualizations.
- **N**ode.js runtime powering the entire ecosystem.

---

## Architecture & Project Structure

```
Wow_Intrective/
├── client/                     # React + Vite Frontend
│   ├── public/
│   ├── src/
│   │   ├── api/                # API client with JWT / cookie handling
│   │   ├── components/
│   │   │   ├── Admin/          # QuestionCards, CreateForm, EditModal, QrModal, CityAutocomplete
│   │   │   ├── Answer/         # CloudAnswer, PollAnswer, MapAnswer
│   │   │   ├── Live/           # LiveCloud, LivePoll, LiveMap, LiveControls
│   │   │   └── Common/         # Toast, Badges, Headers
│   │   ├── pages/              # AdminPage, AnswerPage, LivePage
│   │   ├── styles/             # Global CSS design tokens and typography
│   │   ├── App.jsx             # React Router routing
│   │   └── main.jsx
│   ├── vite.config.js          # Vite configuration with proxy to port 5000
│   └── package.json
├── server/                     # Express + MongoDB Backend
│   ├── config/
│   │   └── db.js               # Mongoose connection manager
│   ├── controllers/            # Auth, Questions, Public endpoints
│   ├── models/
│   │   └── Question.js         # Mongoose schema for Cloud, Map, and Poll
│   ├── routes/                 # Express route handlers
│   ├── utils/
│   │   ├── geo.js              # Offline GeoNames lookup & distance calculator
│   │   ├── textProcessing.js   # Stopwords filter & Hindi/English moderation
│   │   ├── summarize.js        # Analytics, percentages, and word counts
│   │   └── sse.js              # Server-Sent Events real-time broadcast engine
│   ├── geo/                    # Offline datasets (cities.tsv.gz, countries-ind.json)
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── package.json                # Root automation scripts
└── README.md
```

---

## Prerequisites

- **Node.js**: v18 or later
- **MongoDB**: v6 or v8 (running on `localhost:27017` or a MongoDB Atlas connection URI)

---

## Quick Start

### 1. Configure Environment Variables
Inside `server/.env` (or copy from `server/.env.example`):
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/wow_interactive
ADMIN_PASSWORD=changeme
SESSION_SECRET=supersecretwordcloudsessionkey
PUBLIC_URL=http://localhost:5173
BOOST_COUNTRY=IN
```

### 2. Install Dependencies
```bash
# In the server folder:
cd server
npm install

# In the client folder:
cd ../client
npm install
```

### 3. Run Development Mode
To run both the Express backend (port 5000) and the Vite React frontend (port 5173):

```bash
# From the root directory:
npm run dev

# Or independently:
# Terminal 1:
cd server && npm start

# Terminal 2:
cd client && npm run dev
```

Open [http://localhost:5173/admin](http://localhost:5173/admin) to log in with your admin password (`changeme`).

### 4. Production Build & Run
In production, Express can serve the compiled React SPA directly:
```bash
# Build the React client:
cd client && npm run build

# Start the server:
cd ../server && npm start
```
The application will be served at `http://localhost:5000`.

---

## Features

### ☁️ Word Clouds
- Real-time word frequency ranking rendered onto an HTML5 Canvas via `wordcloud`.
- Configurable settings: Count whole answers or individual words (filters stopwords and profanity).
- Admin word moderation: click `×` to hide a word, or `↺` to unhide it.
- Top 3 podium display on projector screen.

### 📍 "Where Are You From?" Map
- High-performance offline GeoNames city dataset (135,000+ cities) with auto-suggestions.
- India point-of-view Natural Earth national boundaries bundled locally (works without internet).
- Glowing city dots sized by participant count, with top city in gold.
- Optional event venue city: draws animated travel arcs and computes total/farthest distance travelled.
- Real-time arrival ticker banner and pulsing arrival animations.

### 📊 Polls
- Single or multiple choice options with custom labels (A, B, C...).
- Animated percentage and vote counter bars on projector view with leading option 👑 crown.
- "Hide results on screen" mode to build suspense until admin clicks "✨ Reveal results".
- Mobile phones show immediate feedback and live results with "your vote" highlighted.

### 🎛️ Live Screen Shortcuts
When viewing a live screen (`/live/:id`):
- **T**: Toggle between Dark and Light mode.
- **Q**: Toggle showing/hiding the corner QR code.
- **C**: Re-centre the live map.
- **F**: Toggle Full-screen mode.
