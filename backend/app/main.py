import os
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import close_database, get_database
from .repository import ProductRepository
from .routes import extension, feedback, products, recommendations, users

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
repository = ProductRepository()


@asynccontextmanager
async def lifespan(_: FastAPI):
    repository.connect()
    yield
    close_database()


app = FastAPI(
    title="Eco-Cart AI API",
    description=(
        "Sustainable clothing catalog, explainable Eco Scores, greener alternatives, "
        "carbon comparisons, user accounts and shopping feedback."
    ),
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if origin.strip()],
    allow_origin_regex=r"chrome-extension://[a-p]{32}",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/", tags=["System"])
def root() -> dict:
    return {"name": "Eco-Cart AI", "status": "running", "docs": "/docs"}


@app.get("/health", tags=["System"])
@app.get("/api/health", tags=["System"], include_in_schema=False)
def health() -> dict:
    return {"status": "ok", "database": "mongodb" if get_database() is not None else "local"}


for route_module in (products, recommendations, users, feedback, extension):
    app.include_router(route_module.router)
    app.include_router(route_module.router, prefix="/api", include_in_schema=False)