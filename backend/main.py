from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from guideline_extraction import router as extraction_router
from template_generation import router as generation_router

app = FastAPI(title="LaTeX Template Generator API")

# Allow the React frontend (running on a different port during dev) to
# call this API. Tighten allow_origins to your real frontend URL before
# deploying.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extraction_router)
app.include_router(generation_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)