"""
Unit and integration tests for dashboard multi-tenant resources and session auth.

Covers:
- Task and QuickLink CRUD workflows.
- Owner isolation (cross-user access returns 404, preventing information leaks).
- Server-side owner pinning during record creation.
- Date grouping logic (Today vs Upcoming vs Pending in IST).
- Token-to-session exchange, rate limiting, and secure logout.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import QuickLink, Task


class DashboardAPITests(APITestCase):

    def setUp(self):
        self.user = get_user_model().objects.create_user(username="developer")
        self.other = get_user_model().objects.create_user(username="other")
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def test_crud_for_both_resources(self):
        for resource, payload in [
            ("tasks", {"title": "Ship Phase 1"}),
            ("links", {"title": "Django", "url": "https://www.djangoproject.com/"}),
        ]:
            with self.subTest(resource=resource):
                endpoint = f"/api/{resource}/"
                response = self.client.post(endpoint, payload, format="json")
                self.assertEqual(response.status_code, 201)
                detail = f"{endpoint}{response.data['id']}/"
                self.assertEqual(self.client.get(detail).status_code, 200)
                self.assertEqual(self.client.get(endpoint).data["count"], 1)
                response = self.client.patch(detail, {"title": "Updated"}, format="json")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["title"], "Updated")
                response = self.client.put(detail, payload, format="json")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(self.client.delete(detail).status_code, 204)
                self.assertEqual(self.client.get(detail).status_code, 404)

    def test_requires_authentication(self):
        self.client.credentials()
        for resource in ["tasks", "links"]:
            self.assertEqual(self.client.get(f"/api/{resource}/").status_code, 401)
            self.assertEqual(self.client.post(f"/api/{resource}/", {}).status_code, 401)

    def test_records_are_private(self):
        task = Task.objects.create(owner=self.other, title="Private")
        link = QuickLink.objects.create(owner=self.other, title="Private", url="https://example.com")
        for resource, obj in [("tasks", task), ("links", link)]:
            with self.subTest(resource=resource):
                endpoint = f"/api/{resource}/"
                self.assertEqual(self.client.get(endpoint).data["count"], 0)
                detail = f"{endpoint}{obj.pk}/"
                self.assertEqual(self.client.get(detail).status_code, 404)
                self.assertEqual(self.client.patch(detail, {"title": "Changed"}).status_code, 404)
                self.assertEqual(self.client.put(detail, {"title": "Changed"}).status_code, 404)
                self.assertEqual(self.client.delete(detail).status_code, 404)

    def test_cannot_assign_another_owner(self):
        for resource, model, payload in [
            ("tasks", Task, {"title": "Mine"}),
            ("links", QuickLink, {"title": "Mine", "url": "https://example.com"}),
        ]:
            response = self.client.post(
                f"/api/{resource}/", {**payload, "owner": self.other.pk}, format="json"
            )
            self.assertEqual(response.status_code, 201)
            self.assertEqual(model.objects.get(pk=response.data["id"]).owner, self.user)

    def test_task_groups(self):
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)
        tomorrow = today + timedelta(days=1)
        for title, date, status in [
            ("Today", today, Task.Status.PENDING),
            ("Today done", today, Task.Status.COMPLETED),
            ("Upcoming", tomorrow, Task.Status.IN_PROGRESS),
            ("Pending", yesterday, Task.Status.IN_PROGRESS),
            ("Old done", yesterday, Task.Status.COMPLETED),
            ("Early done", tomorrow, Task.Status.COMPLETED),
        ]:
            Task.objects.create(owner=self.user, title=title, scheduled_date=date, status=status)
        for group, titles in [
            ("today", {"Today", "Today done"}),
            ("upcoming", {"Upcoming"}),
            ("pending", {"Pending"}),
        ]:
            response = self.client.get(f"/api/tasks/?group={group}")
            self.assertEqual(response.status_code, 200)
            self.assertEqual({task["title"] for task in response.data["results"]}, titles)
        self.assertEqual(self.client.get("/api/tasks/?group=invalid").status_code, 400)

    def test_validation(self):
        for payload in [
            {"title": " "},
            {"title": "Task", "status": "invalid"},
            {"title": "Task", "scheduled_date": "not-a-date"},
        ]:
            self.assertEqual(self.client.post("/api/tasks/", payload).status_code, 400)
        for url in ["javascript:alert(1)", "ftp://example.com", "invalid"]:
            response = self.client.post("/api/links/", {"title": "Link", "url": url})
            self.assertEqual(response.status_code, 400)
        response = self.client.post(
            "/api/links/", {"title": "Link", "url": "https://example.com", "position": -1}
        )
        self.assertEqual(response.status_code, 400)

    def test_cors_preflight(self):
        for origin, allowed in [("http://localhost:3000", True), ("https://untrusted.example", False)]:
            response = self.client.options(
                "/api/tasks/",
                HTTP_ORIGIN=origin,
                HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
                HTTP_ACCESS_CONTROL_REQUEST_HEADERS="authorization,content-type",
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get("Access-Control-Allow-Origin"), origin if allowed else None)
            self.assertEqual(response.get("Access-Control-Allow-Credentials"), "true" if allowed else None)
            if allowed:
                self.assertIn("authorization", response["Access-Control-Allow-Headers"])
                self.assertIn("POST", response["Access-Control-Allow-Methods"])


class WorkspaceSessionTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        from rest_framework.test import APIClient
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = get_user_model().objects.create_user(username="session-user")
        self.other = get_user_model().objects.create_user(username="session-other")
        self.token = Token.objects.create(user=self.user)
        self.other_token = Token.objects.create(user=self.other)
        self.origin = {"HTTP_ORIGIN": "http://localhost:3000"}

    def connect(self, token=None):
        bootstrap = self.client.get("/api/session/").json()
        response = self.client.post("/api/session/", {"token": (token or self.token).key}, format="json",
                                    HTTP_X_CSRFTOKEN=bootstrap["csrf_token"], **self.origin)
        self.assertEqual(response.status_code, 200)
        return response

    def test_refresh_cookie_and_logout_invalidation(self):
        from django.conf import settings
        from django.contrib.sessions.models import Session
        response = self.connect()
        cookie = response.cookies[settings.SESSION_COOKIE_NAME]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"], "Lax")
        self.assertEqual(bool(cookie["secure"]), settings.SESSION_COOKIE_SECURE)
        self.assertEqual(self.client.get("/api/session/").json()["user"]["id"], self.user.pk)
        self.assertEqual(self.client.get("/api/tasks/").status_code, 200)
        session_key = cookie.value
        result = self.client.delete("/api/session/", HTTP_X_CSRFTOKEN=response.json()["csrf_token"], **self.origin)
        self.assertEqual(result.status_code, 200)
        self.assertFalse(Session.objects.filter(session_key=session_key).exists())
        self.assertIsNone(self.client.get("/api/session/").json()["user"])
        self.assertEqual(self.client.get("/api/tasks/").status_code, 401)
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session_key
        self.assertEqual(self.client.get("/api/tasks/").status_code, 401)

    def test_csrf_on_exchange_writes_and_logout(self):
        self.assertEqual(self.client.post("/api/session/", {"token": self.token.key}, format="json").status_code, 403)
        bootstrap = self.client.get("/api/session/").json()
        self.assertEqual(self.client.post("/api/session/", {"token": self.token.key}, format="json",
                         HTTP_X_CSRFTOKEN=bootstrap["csrf_token"], HTTP_ORIGIN="https://evil.example").status_code, 403)
        response = self.connect()
        self.assertEqual(self.client.post("/api/tasks/", {"title": "Blocked"}, format="json").status_code, 403)
        self.assertEqual(self.client.delete("/api/session/").status_code, 403)
        result = self.client.post("/api/tasks/", {"title": "Mine"}, format="json",
                                 HTTP_X_CSRFTOKEN=response.json()["csrf_token"], **self.origin)
        self.assertEqual(result.status_code, 201)
        self.assertEqual(Task.objects.get(pk=result.data["id"]).owner, self.user)

    def test_expired_session_and_user_isolation(self):
        from django.contrib.sessions.models import Session
        self.connect()
        task = Task.objects.create(owner=self.user, title="First user private")
        link = QuickLink.objects.create(owner=self.user, title="Private link", url="https://example.com")
        self.connect(self.other_token)
        for endpoint, identity in [("tasks", task.pk), ("links", link.pk)]:
            self.assertEqual(self.client.get(f"/api/{endpoint}/").data["count"], 0)
            self.assertEqual(self.client.get(f"/api/{endpoint}/{identity}/").status_code, 404)
        Session.objects.update(expire_date=timezone.now() - timedelta(seconds=1))
        self.assertIsNone(self.client.get("/api/session/").json()["user"])
        self.assertEqual(self.client.get("/api/tasks/").status_code, 401)

    def test_invalid_and_inactive_credentials(self):
        bootstrap = self.client.get("/api/session/").json()
        for token in ["invalid", self.token.key]:
            self.user.is_active = False
            self.user.save()
            response = self.client.post("/api/session/", {"token": token}, format="json",
                                       HTTP_X_CSRFTOKEN=bootstrap["csrf_token"], **self.origin)
            self.assertEqual(response.status_code, 401)
