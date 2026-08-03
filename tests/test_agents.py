"""
Agent pipeline tests
Run: pytest tests/test_agents.py -v
"""
import pytest
import asyncio
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.mark.asyncio
async def test_master_agent_maintenance_intent():
    from agents.agents.master_agent import keyword_intent_detection
    intent, conf = keyword_intent_detection("my toilet is overflowing")
    assert intent == "maintenance"
    assert conf > 0.1


@pytest.mark.asyncio
async def test_master_agent_leasing_intent():
    from agents.agents.master_agent import keyword_intent_detection
    intent, conf = keyword_intent_detection("is the apartment still available?")
    assert intent == "leasing"


@pytest.mark.asyncio
async def test_maintenance_classification():
    from services.maintenance_service import classify_maintenance_request
    result = classify_maintenance_request("the toilet is overflowing with water everywhere")
    assert result["category"] == "plumbing"
    assert result["priority"] in ["high", "medium"]


@pytest.mark.asyncio
async def test_maintenance_classification_hvac():
    from services.maintenance_service import classify_maintenance_request
    result = classify_maintenance_request("the AC is broken and it is 95 degrees outside")
    assert result["category"] == "hvac"
    assert result["priority"] == "high"


@pytest.mark.asyncio
async def test_full_pipeline_no_openai():
    """Full pipeline test using fallback (no OpenAI key needed)"""
    from agents.graph import process_message
    result = await process_message(
        message="my heater is broken",
        channel="chat",
    )
    assert "response" in result
    assert len(result["response"]) > 10
    assert result["intent"] in ["maintenance", "general", None]


@pytest.mark.asyncio
async def test_leasing_agent_response():
    from agents.agents.leasing_agent import leasing_agent_node
    state = {
        "message": "Is the 2BR apartment still available?",
        "tenant_id": None, "property_id": None, "channel": "chat",
        "intent": "leasing", "confidence": 0.9, "current_agent": None,
        "ticket_id": None, "vendor_assigned": False,
        "response": "", "actions_taken": [], "history": [], "metadata": {},
    }
    result = await leasing_agent_node(state)
    assert result["response"]
    assert len(result["response"]) > 10


@pytest.mark.asyncio
async def test_screening_evaluation():
    from services.tenant_service import evaluate_screening
    # Good applicant
    result = await evaluate_screening(
        annual_income=75000, monthly_rent=1500,
        credit_score=720, employment_status="employed"
    )
    assert result["approved"] is True
    assert result["score"] >= 65

    # Bad applicant
    result = await evaluate_screening(
        annual_income=20000, monthly_rent=2000,
        credit_score=520, employment_status="unemployed"
    )
    assert result["approved"] is False
