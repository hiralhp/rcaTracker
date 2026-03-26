 # RCA Tracker

  A full-stack web application for tracking incidents and managing Root
  Cause Analysis (RCA) workflows.

  ## Features

  - **Dashboard** — Overview of all incidents and RCA statuses
  - **Incident Management** — Log and track incidents with SLA monitoring
  - **RCA Workflow** — Create and manage root cause analyses linked to
  incidents
  - **Analytics** — Visual reporting on incident trends and resolution
  metrics
  - **Customer Portal** — External-facing portal for incident visibility

  ## Tech Stack

  **Frontend**
  - React (Vite)
  - Tailwind CSS

  **Backend**
  - Node.js + Express
  - better-sqlite3

  ## Getting Started

  ### Prerequisites
  - Node.js 22+

  ### Installation

  1. Clone the repo
     ```bash
     git clone https://github.com/hiralhp/rcaTracker.git
     cd rcaTracker

  2. Install backend dependencies
  cd backend
  npm install
  3. Install frontend dependencies
  cd ../frontend
  npm install

  Running the App

  Backend (port 3001)
  cd backend
  npm run dev

  Frontend (port 5173)
  cd frontend
  npm run dev

  API Endpoints

  ┌──────────┬────────────────┬────────────────┐
  │  Method  │    Endpoint    │  Description   │
  ├──────────┼────────────────┼────────────────┤
  │ GET      │ /api/health    │ Health check   │
  ├──────────┼────────────────┼────────────────┤
  │ GET/POST │ /api/incidents │ Incidents      │
  ├──────────┼────────────────┼────────────────┤
  │ GET/POST │ /api/rcas      │ RCAs           │
  ├──────────┼────────────────┼────────────────┤
  │ GET      │ /api/analytics │ Analytics data │
  ├──────────┼────────────────┼────────────────┤
  │ GET      │ /api/portal    │ Portal data    │
  └──────────┴────────────────┴────────────────┘

  ---

  Just paste that into your `README.md` on GitHub (click the pencil edit
  icon on the file).
