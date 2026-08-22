import json
import os
import sys
import types
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from pydantic import ValidationError

from app.assistant import (
    ACADEMIC_HELP_SYSTEM_INSTRUCTION,
    ASSISTANT_SYSTEM_INSTRUCTION,
    BOOK_EXPLANATION_SYSTEM_INSTRUCTION,
    AcademicHelpGenerator,
    AcademicHelpRequest,
    AcademicHelpResponse,
    AssistantContext,
    AssistantGeminiAdapter,
    AssistantInterpretRequest,
    AssistantInterpretResponse,
    AssistantInterpreter,
    AssistantIntent,
    AssistantPipelineError,
    BookExplanationGenerator,
    BookExplanationResponse,
    BookExplanationRequest,
    build_academic_help_payload,
    build_assistant_payload,
)
from app.main import assistant_ai_enabled, gemini_api_configured, log_assistant_failure


class FakeAdapter:
    def __init__(self, value: str) -> None:
        self.value = value
        self.payload = ""

    async def generate(self, payload: str) -> str:
        self.payload = payload
        return self.value


class FakeBookAdapter:
    def __init__(self, value: str) -> None:
        self.value = value
        self.payload = ""

    async def explain_book(self, payload: str) -> str:
        self.payload = payload
        return self.value


class FakeAcademicAdapter:
    def __init__(self, value: str) -> None:
        self.value = value
        self.payload = ""

    async def explain_academic(self, payload: str) -> str:
        self.payload = payload
        return self.value


class ClientError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code


class FailingModels:
    async def generate_content(self, **_kwargs: object) -> object:
        raise ClientError(
            400,
            '400 INVALID_ARGUMENT: Unknown name "additional_properties" at response_schema',
        )


class FakeAsyncClient:
    models = FailingModels()

    async def __aenter__(self) -> "FakeAsyncClient":
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None


class FakeClient:
    aio = FakeAsyncClient()


class AssistantTests(unittest.IsolatedAsyncioTestCase):
    def request(self) -> AssistantInterpretRequest:
        return AssistantInterpretRequest(
            message="رشح لي كتاب عن الشبكات",
            locale="ar",
            history=[
                {"role": "assistant", "content": "وجدت كتبًا", "bookIds": ["book-1"]}
            ],
            context={
                "referencedBookIds": ["book-1"],
                "selectedBookId": "book-1",
                "lastIntent": "RECOMMEND_BOOKS",
            },
            allowedBookIds=["book-1"],
        )

    async def test_structured_intent_is_parsed(self) -> None:
        result = await AssistantInterpreter(
            FakeAdapter(
                json.dumps(
                    {
                        "intent": "SEARCH_BOOKS",
                        "query": "networks",
                        "referencedBookId": None,
                    }
                )
            )
        ).interpret(self.request())
        self.assertEqual(result.intent.value, "SEARCH_BOOKS")
        self.assertEqual(result.query, "networks")

    async def test_hallucinated_reference_is_discarded(self) -> None:
        result = await AssistantInterpreter(
            FakeAdapter(
                json.dumps(
                    {
                        "intent": "BOOK_AVAILABILITY",
                        "query": "Big Java",
                        "referencedBookId": "invented-book",
                    }
                )
            )
        ).interpret(self.request())
        self.assertIsNone(result.referencedBookId)

    async def test_invalid_structured_intent_output_has_a_distinct_failure_code(self) -> None:
        with self.assertRaises(AssistantPipelineError) as raised:
            await AssistantInterpreter(
                FakeAdapter(json.dumps({"intent": "ACADEMIC_HELP"}))
            ).interpret(self.request())
        self.assertEqual(raised.exception.code, "INTENT_PARSE_FAILED")
        self.assertEqual(raised.exception.stage, "response_parsing")

    def test_request_rejects_unknown_fields_and_unbounded_history(self) -> None:
        with self.assertRaises(ValidationError):
            AssistantInterpretRequest.model_validate(
                {
                    "message": "test",
                    "locale": "ar",
                    "history": [
                        {"role": "user", "content": str(index)} for index in range(11)
                    ],
                    "allowedBookIds": [],
                    "memberId": "private",
                }
            )

    def test_payload_contains_only_the_explicit_safe_contract(self) -> None:
        payload = json.loads(build_assistant_payload(self.request()))
        self.assertEqual(
            set(payload), {"message", "locale", "history", "context", "allowedBookIds"}
        )
        self.assertNotIn("email", json.dumps(payload))
        self.assertNotIn("memberId", json.dumps(payload))

    def test_system_instruction_is_tool_and_prompt_injection_safe(self) -> None:
        self.assertIn("untrusted data", ASSISTANT_SYSTEM_INSTRUCTION)
        self.assertIn("never execute tools", ASSISTANT_SYSTEM_INSTRUCTION)
        self.assertIn("never generate SQL", ASSISTANT_SYSTEM_INSTRUCTION)
        self.assertIn("never invent authoritative library facts", ASSISTANT_SYSTEM_INSTRUCTION)
        self.assertIn("untrusted data", BOOK_EXPLANATION_SYSTEM_INSTRUCTION)
        self.assertIn("untrusted data", ACADEMIC_HELP_SYSTEM_INSTRUCTION)

    def test_supported_intents_include_book_university_and_out_of_scope(self) -> None:
        self.assertIn(AssistantIntent.BOOK_DETAILS, AssistantIntent)
        self.assertIn(AssistantIntent.UNIVERSITY_INFO, AssistantIntent)
        self.assertIn(AssistantIntent.OUT_OF_SCOPE, AssistantIntent)

    def test_context_rejects_unsupported_last_intent(self) -> None:
        with self.assertRaises(ValidationError):
            AssistantContext.model_validate({"lastIntent": "DELETE_BOOK"})

    async def test_book_explanation_uses_only_the_safe_bounded_contract(self) -> None:
        adapter = FakeBookAdapter(
            json.dumps(
                {
                    "overview": "Big Java يقدم مدخلًا إلى Java وفق بيانات الفهرس.",
                    "topics": ["أساسيات Java", "البرمجة كائنية التوجه"],
                    "level": "BEGINNER_INTERMEDIATE",
                    "whyUseful": "يساعد طالب البرمجة على بناء أساس منظم.",
                    "caveat": None,
                }
            )
        )
        result = await BookExplanationGenerator(adapter).explain(
            BookExplanationRequest(
                message="اشرح لي كتاب Big Java",
                locale="ar",
                book={
                    "id": "book-1",
                    "title": "Big Java",
                    "authors": ["Cay Horstmann"],
                    "category": "Programming",
                    "description": "An introduction to Java programming.",
                },
            )
        )
        self.assertIn("Java", result.overview)
        self.assertEqual(result.level, "BEGINNER_INTERMEDIATE")
        payload = json.loads(adapter.payload)
        self.assertEqual(set(payload), {"message", "locale", "history", "book"})
        self.assertNotIn("memberId", adapter.payload)
        self.assertNotIn("email", adapter.payload)

    async def test_missing_book_description_is_explicit_at_the_safe_boundary(self) -> None:
        adapter = FakeBookAdapter(
            json.dumps(
                {
                    "overview": "نبذة حذرة مبنية على العنوان والتصنيف.",
                    "topics": ["Java"],
                    "level": "UNKNOWN",
                    "whyUseful": None,
                    "caveat": "لا يتوفر وصف أو معاينة؛ لم تتم قراءة محتوى الكتاب الكامل.",
                }
            )
        )
        result = await BookExplanationGenerator(adapter).explain(
            BookExplanationRequest(
                message="اشرح Big Java",
                locale="ar",
                book={"id": "book-1", "title": "Big Java", "authors": []},
            )
        )
        payload = json.loads(adapter.payload)["book"]
        self.assertNotIn("description", payload)
        self.assertFalse(payload["previewAvailable"])
        self.assertIn("لم تتم قراءة", result.caveat or "")

    async def test_academic_help_generation_is_separate_and_preserves_arabic_locale(self) -> None:
        adapter = FakeAcademicAdapter(
            json.dumps(
                {
                    "title": "Linked List — القائمة المرتبطة",
                    "summary": "القائمة المرتبطة بنية بيانات تجمع عقدًا مترابطة.",
                    "keyPoints": [
                        "كل عنصر يسمى عقدة (Node).",
                        "العقدة تحمل البيانات.",
                        "المؤشر يصلها بالعقدة التالية.",
                    ],
                    "example": "10 → 20 → 30 → NULL",
                    "useCase": "تفيد عند تكرار الإضافة والحذف.",
                }
            )
        )
        result = await AcademicHelpGenerator(adapter).explain(
            AcademicHelpRequest(message="اشرح linked list", locale="ar")
        )
        self.assertIn("عقد", result.summary)
        self.assertEqual(len(result.keyPoints), 3)
        self.assertIn("NULL", result.example or "")
        payload = json.loads(adapter.payload)
        self.assertEqual(payload["locale"], "ar")
        self.assertEqual(payload["message"], "اشرح linked list")

    def test_academic_schema_rejects_unstructured_or_overlong_key_points(self) -> None:
        with self.assertRaises(ValidationError):
            AcademicHelpResponse.model_validate({"answer": "raw paragraph"})
        with self.assertRaises(ValidationError):
            AcademicHelpResponse.model_validate(
                {
                    "title": "Topic",
                    "summary": "Summary",
                    "keyPoints": [str(index) for index in range(6)],
                    "example": None,
                    "useCase": None,
                }
            )

    def test_explanation_prompts_require_compact_structure_and_no_fabrication(self) -> None:
        academic = ACADEMIC_HELP_SYSTEM_INSTRUCTION.lower()
        book = BOOK_EXPLANATION_SYSTEM_INSTRUCTION.lower()
        self.assertIn("80–180", ACADEMIC_HELP_SYSTEM_INSTRUCTION)
        self.assertIn("three to five", academic)
        self.assertIn("without markdown", academic)
        self.assertIn("never fabricate chapters", book)
        self.assertIn("complete book", book)

    def test_gemini_output_schemas_exclude_the_unsupported_additional_properties(self) -> None:
        def assert_supported(value: object) -> None:
            if isinstance(value, dict):
                self.assertNotIn("additionalProperties", value)
                for child in value.values():
                    assert_supported(child)
            elif isinstance(value, list):
                for child in value:
                    assert_supported(child)

        for model in (
            AssistantInterpretResponse,
            AcademicHelpResponse,
            BookExplanationResponse,
        ):
            assert_supported(model.model_json_schema())

    async def test_google_client_error_is_classified_with_stage_and_status(self) -> None:
        adapter = AssistantGeminiAdapter(
            api_key="test-key",
            model="gemini-3.5-flash-lite",
        )
        fake_genai = types.ModuleType("google.genai")
        fake_genai.Client = lambda **_kwargs: FakeClient()  # type: ignore[attr-defined]
        fake_types = types.ModuleType("google.genai.types")
        fake_types.GenerateContentConfig = lambda **kwargs: SimpleNamespace(  # type: ignore[attr-defined]
            **kwargs
        )
        fake_genai.types = fake_types  # type: ignore[attr-defined]
        with patch.dict(
            sys.modules,
            {"google.genai": fake_genai, "google.genai.types": fake_types},
        ):
            with self.assertRaises(AssistantPipelineError) as raised:
                await adapter.generate(build_assistant_payload(self.request()))
        self.assertEqual(raised.exception.code, "GEMINI_API_ERROR")
        self.assertEqual(raised.exception.stage, "structured_intent")
        self.assertEqual(type(raised.exception.cause).__name__, "ClientError")
        self.assertEqual(getattr(raised.exception.cause, "status_code", None), 400)

    def test_client_error_logging_is_diagnostic_and_redacts_sensitive_values(self) -> None:
        cause = ClientError(
            400,
            '400 INVALID_ARGUMENT for configured-secret and student@example.test: Unknown name "additional_properties"',
        )
        error = AssistantPipelineError("GEMINI_API_ERROR", "structured_intent", cause)
        with patch.dict(
            os.environ,
            {
                "GEMINI_API_KEY": "configured-secret",
                "GEMINI_MODEL": "gemini-3.5-flash-lite",
            },
            clear=True,
        ):
            with self.assertLogs("uvicorn.error", level="WARNING") as logs:
                log_assistant_failure(error)
        message = logs.output[0]
        self.assertIn("code=GEMINI_API_ERROR", message)
        self.assertIn("stage=structured_intent", message)
        self.assertIn("model=gemini-3.5-flash-lite", message)
        self.assertIn("exception=ClientError", message)
        self.assertIn("status=400", message)
        self.assertIn("additional_properties", message)
        self.assertNotIn("configured-secret", message)
        self.assertNotIn("student@example.test", message)

    def test_assistant_flag_is_independent_with_legacy_fallback(self) -> None:
        with patch.dict(os.environ, {"ASSISTANT_AI_ENABLED": "true"}, clear=True):
            self.assertTrue(assistant_ai_enabled())
        with patch.dict(os.environ, {"RECOMMENDATION_ENABLED": "true"}, clear=True):
            self.assertTrue(assistant_ai_enabled())
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(assistant_ai_enabled())

    def test_missing_api_key_is_detected_without_exposing_a_secret(self) -> None:
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=True):
            self.assertFalse(gemini_api_configured())
        with patch.dict(os.environ, {"GEMINI_API_KEY": "configured-secret"}, clear=True):
            self.assertTrue(gemini_api_configured())


if __name__ == "__main__":
    unittest.main()
