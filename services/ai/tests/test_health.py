from fastapi.testclient import TestClient

from app.main import create_app


def test_healthcheck_returns_service_status() -> None:
    client = TestClient(create_app())

    response = client.get("/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "tcc-assist-ai"
    assert "timestamp" in response.json()

