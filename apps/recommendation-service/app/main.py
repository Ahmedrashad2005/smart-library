from fastapi import FastAPI

app = FastAPI(title="Smart Library Recommendation Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    """Provide a dependency-free readiness endpoint for the Phase 1 service."""
    return {"status": "ok", "service": "recommendation-service"}
