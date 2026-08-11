
# LaTeX Template Generator

An AI-powered tool that extracts formatting rules from publisher author guidelines and helps generate a matching LaTeX manuscript template.

## Project Structure

```
project/
├── backend/          # FastAPI + Groq-powered extraction API
│   ├── main.py
│   ├── guideline_extraction.py
│   └── .env          # you create this - see Setup below
└── frontend/          # React app (3-step form)
    ├── src/
    └── package.json
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- A free Groq API key ([console.groq.com](https://console.groq.com) → API Keys)

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd <repo-name>
```

### 2. Backend setup

Navigate to the `backend` folder:

```bash
cd backend
```

Create a `.env` file in this folder with your Groq API key, in exactly this format:

```
GROQ_API_KEY=your_api_key
```

> Note: no quotes, no spaces around the `=`. Replace `your_api_key` with your actual key.

Install the Python dependencies:

```bash
pip install fastapi uvicorn openai python-dotenv
```

Run the backend server:

```bash
python -m uvicorn main:app --reload
```

The API will be running at `http://localhost:8000`. You can test it directly at `http://localhost:8000/docs`.

### 3. Frontend setup

In a separate terminal, navigate to the `frontend` folder:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm start
```

The app will open at `http://localhost:3000`.

## Usage

1. On the first screen, select a publisher and paste in the author guidelines text.
2. Click **Extract Formatting Rules** — the backend will call the Groq API and pre-fill the formatting fields on the next screen.
3. Review and adjust any fields flagged as "not found in guidelines."
4. Fill in your manuscript details on the final screen and generate your template.

## Notes

- Both the backend (`uvicorn --reload`) and frontend (`npm start`) need to be running at the same time for the app to work.
- If you edit `.env`, restart the backend server for the change to take effect - it's only read once at startup.
- The Groq API's free tier has daily rate limits per model; if extraction starts failing, check your usage at [console.groq.com](https://console.groq.com).
