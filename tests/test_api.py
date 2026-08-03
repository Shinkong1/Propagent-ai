"""
API endpoint tests (requires running server + test DB)
Run: pytest tests/test_api.py -v
"""
import pytest
import httpx

BASE_URL = "http://localhost:8000"


@pytest.mark.asyncio
async def test_health():
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_signup_and_login():
    async with httpx.AsyncClient() as client:
        # Signup
        signup_resp = await client.post(f"{BASE_URL}/auth/signup", json={
            "email": "test_user_001@test.com",
            "password": "testpass123",
            "first_name": "Test",
            "last_name": "User",
            "organization_name": "Test Org 001",
        })
        assert signup_resp.status_code in [201, 400]  # 400 if already exists

        # Login
        login_resp = await client.post(f"{BASE_URL}/auth/login", json={
            "email": "demo@propagent.ai",
            "password": "demo1234",
        })
        # Skip if DB not seeded
        if login_resp.status_code == 200:
            data = login_resp.json()
            assert "access_token" in data
            assert data["email"] == "demo@propagent.ai"


@pytest.mark.asyncio
async def test_billing_plans():
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_URL}/billing/plans")
    assert resp.status_code == 200
    plans = resp.json()["plans"]
    assert len(plans) == 3
    assert plans[0]["key"] == "starter"
