# Cooking Idea Generator

Simple full-stack starter project:
- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Data source (for now):** predefined meals in backend code (easy to move to local JSON later)

## Folder structure

- `frontend/` → React app (Vite)
- `backend/` → Express API server

## Run the project in VS Code (step-by-step)

Open **two terminals** in VS Code.

### 1) Start backend (Terminal 1)

```powershell
cd d:\Georgi\Desktop\CookingIdeaGenerator\backend
npm install
npm run dev
```

Backend will run at: `http://localhost:3001`

Quick test in the same terminal (optional):

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:3001/api/health
```

### 2) Start frontend (Terminal 2)

```powershell
cd d:\Georgi\Desktop\CookingIdeaGenerator\frontend
npm install
npm run dev
```

Frontend will run at: `http://localhost:5173`

## Backend API

### GET `/api/health`
Checks if backend is alive.

### POST `/api/suggestions`
Send 3 ingredients and receive 2-3 meal ideas.

Example request:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/suggestions -ContentType 'application/json' -Body '{"ingredients":["egg","tomato","cheese"]}'
```

## Where to learn from code comments

- `backend/src/server.js` has comments for server setup, middleware, validation, and route logic.
- `backend/src/data/meals.js` has comments for predefined meal data.
