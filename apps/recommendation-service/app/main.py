import logging
import os
import re
from time import monotonic

from fastapi import FastAPI, HTTPException

from .assistant import (
    AssistantGeminiAdapter,
    AssistantInterpretRequest,
    AssistantInterpretResponse,
    AssistantInterpreter,
    AssistantPipelineError,
    AcademicHelpGenerator,
    AcademicHelpRequest,
    AcademicHelpResponse,
    BookExplanationGenerator,
    BookExplanationRequest,
    BookExplanationResponse,
    CatalogSelectionRequest,
    CatalogSelectionResponse,
    CatalogSelector,
)
from .recommendations import GeminiAdapter, RankRequest, RankResponse, RecommendationRanker

app = FastAPI(title="Smart Library Recommendation Service", version="0.1.0")
logger = logging.getLogger("uvicorn.error")


def assistant_ai_enabled() -> bool:
    value = os.getenv("ASSISTANT_AI_ENABLED")
    if value is None:
        value = os.getenv("RECOMMENDATION_ENABLED", "false")
    return value.lower() == "true"


def gemini_model() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")


def gemini_api_configured() -> bool:
    return bool(os.getenv("GEMINI_API_KEY", "").strip())


def sanitized_error_message(error: BaseException) -> str:
    message = str(error) or type(error).__name__
    secret = os.getenv("GEMINI_API_KEY", "").strip()
    if secret:
        message = message.replace(secret, "[api-key-redacted]")
    message = re.sub(r"Bearer\s+[A-Za-z0-9._~-]+", "Bearer [redacted]", message, flags=re.I)
    message = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[email-redacted]", message)
    message = re.sub(r"(?:\+?20|0)1[0125]\d{8}", "[phone-redacted]", message)
    return " ".join(message.split())[:600]


def log_assistant_failure(error: AssistantPipelineError) -> None:
    cause = error.cause
    status = getattr(cause, "status_code", getattr(cause, "code", "unknown"))
    logger.warning(
        "Gemini assistant failure code=%s stage=%s model=%s exception=%s status=%s message=%s",
        error.code,
        error.stage,
        gemini_model(),
        type(cause).__name__,
        status,
        sanitized_error_message(cause),
    )


@app.on_event("startup")
async def log_ai_configuration() -> None:
    logger.info(
        "Assistant AI enabled=%s Gemini API configured=%s Gemini model=%s",
        assistant_ai_enabled(),
        gemini_api_configured(),
        gemini_model(),
    )


@app.get("/health")
def health() -> dict[str, str]:
    """Provide a dependency-free readiness endpoint for the Phase 1 service."""
    return {"status": "ok", "service": "recommendation-service"}


@app.post("/recommendations/rank", response_model=RankResponse)
async def rank_recommendations(request: RankRequest) -> RankResponse:
    """Rank a bounded candidate set without owning any library data."""
    if os.getenv("RECOMMENDATION_ENABLED", "false").lower() != "true":
        raise HTTPException(status_code=503, detail="Recommendation ranking is disabled")
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini is not configured")

    started = monotonic()
    try:
        result = await RecommendationRanker(
            GeminiAdapter(
                api_key=api_key,
                model=gemini_model(),
            )
        ).rank(request)
    except TimeoutError as error:
        logger.warning("Gemini recommendation request timed out")
        raise HTTPException(status_code=504, detail="Recommendation ranking timed out") from error
    except (TypeError, ValueError) as error:
        logger.warning("Gemini returned an invalid recommendation response")
        raise HTTPException(status_code=502, detail="Invalid recommendation response") from error
    except Exception as error:
        logger.warning("Gemini recommendation request failed: %s", type(error).__name__)
        raise HTTPException(status_code=502, detail="Recommendation ranking failed") from error

    logger.info(
        "Recommendation ranked candidates=%s history=%s results=%s latency_ms=%s",
        len(request.candidateBooks),
        len(request.history),
        len(result.recommendations),
        round((monotonic() - started) * 1000),
    )
    return result


@app.post("/assistant/interpret", response_model=AssistantInterpretResponse)
async def interpret_assistant_message(
    request: AssistantInterpretRequest,
) -> AssistantInterpretResponse:
    """Interpret one bounded assistant message without owning or mutating library data."""
    if not assistant_ai_enabled():
        raise HTTPException(status_code=503, detail="AI interpretation is disabled")
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini is not configured")
    started = monotonic()
    try:
        result = await AssistantInterpreter(
            AssistantGeminiAdapter(
                api_key=api_key,
                model=gemini_model(),
            )
        ).interpret(request)
    except AssistantPipelineError as error:
        log_assistant_failure(error)
        status = 504 if error.code == "TIMEOUT" else 502
        raise HTTPException(status_code=status, detail=error.code) from error
    except Exception as error:
        logger.warning(
            "Gemini assistant failure code=AI_UNAVAILABLE stage=unhandled model=%s exception=%s status=unknown message=%s",
            gemini_model(),
            type(error).__name__,
            sanitized_error_message(error),
        )
        raise HTTPException(status_code=502, detail="Assistant interpretation failed") from error
    logger.info(
        "Assistant interpreted history=%s references=%s intent=%s latency_ms=%s",
        len(request.history),
        len(request.allowedBookIds),
        result.intent.value,
        round((monotonic() - started) * 1000),
    )
    return result


@app.post("/assistant/explain-academic", response_model=AcademicHelpResponse)
async def explain_academic_topic(request: AcademicHelpRequest) -> AcademicHelpResponse:
    """Generate a bounded academic explanation without catalog or identity data."""
    if not assistant_ai_enabled():
        raise HTTPException(status_code=503, detail="AI explanation is disabled")
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini is not configured")
    started = monotonic()
    try:
        result = await AcademicHelpGenerator(
            AssistantGeminiAdapter(api_key=api_key, model=gemini_model())
        ).explain(request)
    except AssistantPipelineError as error:
        log_assistant_failure(error)
        status = 504 if error.code == "TIMEOUT" else 502
        raise HTTPException(status_code=status, detail=error.code) from error
    except Exception as error:
        logger.warning(
            "Gemini assistant failure code=AI_UNAVAILABLE stage=academic_unhandled model=%s exception=%s status=unknown message=%s",
            gemini_model(),
            type(error).__name__,
            sanitized_error_message(error),
        )
        raise HTTPException(status_code=502, detail="Academic explanation failed") from error
    logger.info(
        "Assistant explained academic topic history=%s locale=%s latency_ms=%s",
        len(request.history),
        request.locale,
        round((monotonic() - started) * 1000),
    )
    return result


@app.post("/assistant/explain-book", response_model=BookExplanationResponse)
async def explain_catalog_book(request: BookExplanationRequest) -> BookExplanationResponse:
    """Explain one real, backend-supplied safe catalog projection."""
    if not assistant_ai_enabled():
        raise HTTPException(status_code=503, detail="AI explanation is disabled")
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini is not configured")
    started = monotonic()
    try:
        result = await BookExplanationGenerator(
            AssistantGeminiAdapter(api_key=api_key, model=gemini_model())
        ).explain(request)
    except AssistantPipelineError as error:
        log_assistant_failure(error)
        status = 504 if error.code == "TIMEOUT" else 502
        raise HTTPException(status_code=status, detail=error.code) from error
    except Exception as error:
        logger.warning("Gemini book explanation failed: %s", type(error).__name__)
        raise HTTPException(status_code=502, detail="Book explanation failed") from error
    logger.info(
        "Assistant explained book history=%s latency_ms=%s",
        len(request.history),
        round((monotonic() - started) * 1000),
    )
    return result


@app.post("/assistant/select-catalog", response_model=CatalogSelectionResponse)
async def select_catalog_books(request: CatalogSelectionRequest) -> CatalogSelectionResponse:
    """Select only semantically relevant IDs from a bounded real catalog projection."""
    if not assistant_ai_enabled():
        raise HTTPException(status_code=503, detail="AI catalog selection is disabled")
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini is not configured")
    started = monotonic()
    try:
        result = await CatalogSelector(
            AssistantGeminiAdapter(api_key=api_key, model=gemini_model())
        ).select(request)
    except AssistantPipelineError as error:
        log_assistant_failure(error)
        status = 504 if error.code == "TIMEOUT" else 502
        raise HTTPException(status_code=status, detail=error.code) from error
    except Exception as error:
        logger.warning(
            "Gemini catalog selection failed model=%s exception=%s message=%s",
            gemini_model(),
            type(error).__name__,
            sanitized_error_message(error),
        )
        raise HTTPException(status_code=502, detail="Catalog selection failed") from error
    logger.info(
        "Assistant catalog selection candidates=%s results=%s locale=%s latency_ms=%s",
        len(request.books),
        len(result.matches),
        request.locale,
        round((monotonic() - started) * 1000),
    )
    return result
