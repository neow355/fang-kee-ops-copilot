from .conftest import login


def test_auth_inquiry_chat_and_metrics(client):
    response = login(client)
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]
    assert client.get("/api/auth/me").json()["role"] == "admin"

    created = client.post(
        "/api/inquiries",
        json={"subject": "客戶查詢", "message": "請協助處理"},
    )
    assert created.status_code == 201
    assert len(client.get("/api/inquiries").json()) == 1

    chat = client.post("/api/chat", json={"question": "門市的營業時間是甚麼？"})
    assert chat.status_code == 200
    body = chat.json()
    assert body["refused"] is False
    assert body["citations"][0]["title"] == "營運指引"
    assert body["cost_usd"] == 0

    metrics = client.get("/api/metrics")
    assert metrics.status_code == 200
    assert metrics.json()["chat_count"] == 1


def test_admin_can_upload_text_document(client):
    login(client)
    response = client.post(
        "/api/documents",
        data={"title": "退款政策", "visibility": "staff"},
        files={"file": ("../../refund.md", "退款申請須由管理員審批。".encode(), "text/markdown")},
    )
    assert response.status_code == 201
    assert response.json()["filename"] == "refund.md"
    assert len(client.get("/api/documents").json()) == 3


def test_health_and_logout(client):
    assert client.get("/health").json() == {"status": "ok"}
    login(client)
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
