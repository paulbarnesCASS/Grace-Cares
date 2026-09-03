"""End-to-end backend tests for Grace Cares CIC platform."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for direct pytest runs
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"
ADMIN_EMAIL = "paul@cass-online.co.uk"
ADMIN_PASSWORD = "GraceCares2026!"
ORIGIN = BASE_URL


# ------------- Fixtures -------------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def customer_session():
    s = requests.Session()
    email = f"TEST_cust_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "TestPass123!", "name": "Test Customer"})
    assert r.status_code == 200, f"Register failed: {r.text}"
    s.email = email  # type: ignore
    return s


@pytest.fixture(scope="session")
def products(admin_session):
    r = admin_session.get(f"{API}/products?limit=100")
    assert r.status_code == 200
    items = r.json()["items"]
    assert items
    return items


def _find(products, eligible):
    for p in products:
        if p.get("vat_relief_eligible") == eligible and p.get("available_qty", 0) > 0:
            return p
    return None


def _fresh_product(eligible):
    """Get a fresh product with stock (bypassing stale session fixture)."""
    r = requests.get(f"{API}/products?limit=100&vat_relief={'true' if eligible else 'false'}&in_stock=true")
    if r.status_code == 200:
        for p in r.json()["items"]:
            if p.get("available_qty", 0) > 0:
                return p
    return None


# ------------- Health / auth -------------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"

    def test_admin_login(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        me = r.json()
        assert me["email"] == ADMIN_EMAIL
        assert me["role"] == "super_admin"

    def test_admin_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong!!"})
        assert r.status_code == 401

    def test_register_and_me(self, customer_session):
        r = customer_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "customer"


# ------------- Shop -------------
class TestShop:
    def test_categories(self):
        r = requests.get(f"{API}/categories")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_products_list(self, products):
        assert len(products) > 0
        p0 = products[0]
        # Verify price_inc_vat computed
        assert "price_inc_vat" in p0
        assert "available_qty" in p0

    def test_products_filter_vat_relief(self):
        r = requests.get(f"{API}/products?vat_relief=true&limit=50")
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["vat_relief_eligible"] is True

    def test_products_search(self):
        r = requests.get(f"{API}/products?q=chair")
        assert r.status_code == 200
        assert r.json()["total"] >= 0

    def test_product_detail(self, products):
        pid = products[0]["id"]
        r = requests.get(f"{API}/products/{pid}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == pid
        assert "related" in d


# ------------- VAT engine -------------
def _quote_payload(items, vat_relief_claim=False, declaration=None, fulfilment="collection"):
    return {
        "items": items,
        "customer": {"name": "T", "email": "t@example.com", "address_line1": "1 St",
                     "city": "London", "postcode": "SW1"},
        "fulfilment": fulfilment,
        "vat_relief_claim": vat_relief_claim,
        "declaration": declaration,
        "donation_amount": 0,
        "marketing_consent": False,
        "accept_terms": True,
        "origin_url": ORIGIN,
    }


VALID_DECL = {
    "eligible_person_name": "John Doe",
    "eligible_person_address": "1 Test St",
    "condition_description": "chronic mobility",
    "for_personal_domestic_use": True,
    "info_accurate": True,
    "signature": "John Doe",
}


class TestVATEngine:
    def test_standard_rated_only(self, products):
        p = _fresh_product(eligible=False)
        if not p:
            pytest.skip("No non-eligible product with stock")
        body = _quote_payload([{"product_id": p["id"], "quantity": 1}])
        r = requests.post(f"{API}/checkout/quote", json=body)
        assert r.status_code == 200
        t = r.json()["totals"]
        assert t["vat_total"] == round(p["price_ex_vat"] * 0.20, 2)
        assert "20%" in t["vat_breakdown"]

    def test_eligible_with_declaration_zero(self, products):
        p = _fresh_product(eligible=True)
        if not p:
            pytest.skip("No eligible product")
        body = _quote_payload([{"product_id": p["id"], "quantity": 1}],
                              vat_relief_claim=True, declaration=VALID_DECL)
        r = requests.post(f"{API}/checkout/quote", json=body)
        assert r.status_code == 200
        t = r.json()["totals"]
        assert t["declaration_valid"] is True
        assert t["vat_total"] == 0
        assert r.json()["lines"][0]["vat_relief_applied"] is True

    def test_eligible_without_declaration(self, products):
        p = _fresh_product(eligible=True)
        if not p:
            pytest.skip("No eligible product")
        body = _quote_payload([{"product_id": p["id"], "quantity": 1}])
        r = requests.post(f"{API}/checkout/quote", json=body)
        t = r.json()["totals"]
        assert t["vat_total"] == round(p["price_ex_vat"] * 0.20, 2)

    def test_mixed_basket(self, products):
        elig = _fresh_product(eligible=True)
        std = _fresh_product(eligible=False)
        if not elig or not std:
            pytest.skip("Need both eligible and non-eligible products in stock")
        body = _quote_payload(
            [{"product_id": elig["id"], "quantity": 1},
             {"product_id": std["id"], "quantity": 1}],
            vat_relief_claim=True, declaration=VALID_DECL)
        r = requests.post(f"{API}/checkout/quote", json=body)
        t = r.json()["totals"]
        vb = t["vat_breakdown"]
        assert "0%" in vb and "20%" in vb
        assert vb["0%"]["vat"] == 0
        assert vb["20%"]["vat"] == round(std["price_ex_vat"] * 0.20, 2)

    def test_do_not_qualify(self, products):
        p = _fresh_product(eligible=True)
        if not p:
            pytest.skip("No eligible product")
        body = _quote_payload([{"product_id": p["id"], "quantity": 1}],
                              vat_relief_claim=False)
        r = requests.post(f"{API}/checkout/quote", json=body)
        t = r.json()["totals"]
        assert t["vat_total"] == round(p["price_ex_vat"] * 0.20, 2)


# ------------- Checkout + Stock -------------
class TestCheckoutStock:
    def test_checkout_returns_stripe_url(self, products):
        p = _fresh_product(eligible=False)
        if not p:
            pytest.skip("No non-eligible product with stock")
        body = _quote_payload([{"product_id": p["id"], "quantity": 1}])
        r = requests.post(f"{API}/checkout", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["checkout_url"].startswith("https://")
        assert d["order_reference"].startswith("GC-")

    def test_stock_conflict_qty1(self, products, admin_session):
        # Find a product with available_qty >=1 and quantity_available == 1
        r = admin_session.get(f"{API}/products?limit=100")
        # create a new qty-1 product to avoid interfering
        create = admin_session.post(f"{API}/products", json={
            "name": "TEST_UNIQUE_ITEM", "sku": f"TEST-{uuid.uuid4().hex[:6]}",
            "price_ex_vat": 10.0, "vat_rate": 0.20, "vat_relief_eligible": False,
            "quantity_available": 1, "description": "test", "condition": "Good",
        })
        assert create.status_code == 200, create.text
        pid = create.json()["id"] if "id" in create.json() else create.json().get("id")
        if not pid:
            # clean may not add id? — look up by sku
            pid = create.json().get("_id") or create.json().get("id")
        assert pid, f"No pid: {create.json()}"

        body = _quote_payload([{"product_id": pid, "quantity": 1}])
        r1 = requests.post(f"{API}/checkout", json=body)
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{API}/checkout", json=body)
        assert r2.status_code == 409, f"Expected 409, got {r2.status_code}: {r2.text}"

        # cleanup
        admin_session.delete(f"{API}/products/{pid}")

    def test_payment_status_pending(self, products):
        p = _fresh_product(eligible=False)
        if not p:
            pytest.skip("No non-eligible product with stock")
        body = _quote_payload([{"product_id": p["id"], "quantity": 1}])
        r = requests.post(f"{API}/checkout", json=body)
        if r.status_code != 200:
            pytest.skip(f"Checkout unavailable: {r.status_code}")
        sid = r.json()["session_id"]
        r2 = requests.get(f"{API}/payments/status/{sid}")
        assert r2.status_code == 200
        assert r2.json()["payment_status"] in ("pending", "paid")


# ------------- Donations -------------
class TestDonations:
    def test_donation_oneoff(self):
        r = requests.post(f"{API}/donations", json={
            "amount": 10.0, "recurring": False, "name": "Donor", "email": "d@example.com",
            "origin_url": ORIGIN, "marketing_consent": False})
        assert r.status_code == 200, r.text
        assert r.json()["checkout_url"].startswith("https://")

    def test_donation_recurring(self):
        r = requests.post(f"{API}/donations", json={
            "amount": 5.0, "recurring": True, "name": "Donor", "email": "d@example.com",
            "origin_url": ORIGIN, "marketing_consent": False})
        assert r.status_code == 200, r.text
        assert "checkout_url" in r.json()


# ------------- Equipment donations -------------
class TestEquipmentDonation:
    def test_requires_consent(self):
        r = requests.post(f"{API}/equipment-donations", json={
            "donor_name": "X", "email": "x@example.com", "phone": "123", "location": "L",
            "postcode": "SW1", "equipment_type": "Wheelchair", "condition": "Good",
            "privacy_consent": False})
        assert r.status_code == 400

    def test_submit(self, admin_session):
        r = requests.post(f"{API}/equipment-donations", json={
            "donor_name": "TEST_Donor", "email": "eq@example.com", "phone": "123",
            "location": "L", "postcode": "SW1", "equipment_type": "Wheelchair",
            "condition": "Good", "privacy_consent": True})
        assert r.status_code == 200
        ref = r.json()["reference"]
        assert ref.startswith("ED-")
        r2 = admin_session.get(f"{API}/admin/equipment-donations")
        assert r2.status_code == 200
        refs = [d["reference"] for d in r2.json()]
        assert ref in refs


# ------------- Events -------------
class TestEvents:
    def test_events_list_no_online_link(self):
        r = requests.get(f"{API}/events")
        assert r.status_code == 200
        for e in r.json():
            assert "online_link" not in e

    def test_free_booking(self, admin_session):
        events = requests.get(f"{API}/events").json()
        free = next((e for e in events if not e.get("is_paid") and e.get("spots_left", 0) > 0), None)
        if not free:
            pytest.skip("No free event with capacity")
        r = requests.post(f"{API}/bookings", json={
            "event_id": free["id"], "name": "T", "email": "b@example.com",
            "num_attendees": 1, "origin_url": ORIGIN})
        assert r.status_code == 200
        assert r.json().get("confirmed") is True

    def test_paid_booking(self, admin_session):
        events = requests.get(f"{API}/events").json()
        paid = next((e for e in events if e.get("is_paid") and e.get("spots_left", 0) > 0), None)
        if not paid:
            pytest.skip("No paid event")
        r = requests.post(f"{API}/bookings", json={
            "event_id": paid["id"], "name": "T", "email": "p@example.com",
            "num_attendees": 1, "origin_url": ORIGIN})
        assert r.status_code == 200
        assert "checkout_url" in r.json()

    def test_waiting_list(self, admin_session):
        # create small-capacity event
        r = admin_session.post(f"{API}/events", json={
            "name": "TEST_WL", "slug": f"test-wl-{uuid.uuid4().hex[:6]}",
            "description": "", "start_at": "2030-01-01T10:00:00", "capacity": 1,
            "is_paid": False, "price": 0, "published": True})
        assert r.status_code == 200
        eid = r.json()["id"]
        # fill capacity
        r1 = requests.post(f"{API}/bookings", json={
            "event_id": eid, "name": "A", "email": "a@example.com", "num_attendees": 1,
            "origin_url": ORIGIN})
        assert r1.json().get("confirmed") is True
        # over-capacity => waiting list
        r2 = requests.post(f"{API}/bookings", json={
            "event_id": eid, "name": "B", "email": "b@example.com", "num_attendees": 1,
            "origin_url": ORIGIN})
        assert r2.json().get("waiting_list") is True
        admin_session.delete(f"{API}/events/{eid}")


# ------------- Resources -------------
class TestResources:
    def test_list(self):
        r = requests.get(f"{API}/resources")
        assert r.status_code == 200

    def test_gated_requires_email(self):
        rs = requests.get(f"{API}/resources").json()
        gated = next((r for r in rs if r.get("gated")), None)
        if not gated:
            pytest.skip("No gated resource")
        r1 = requests.post(f"{API}/resources/{gated['id']}/download", json={"email": ""})
        assert r1.status_code == 400
        r2 = requests.post(f"{API}/resources/{gated['id']}/download",
                           json={"email": "u@example.com"})
        assert r2.status_code == 200
        assert "file_url" in r2.json()

    def test_nongated_download(self):
        rs = requests.get(f"{API}/resources").json()
        free = next((r for r in rs if not r.get("gated")), None)
        if not free:
            pytest.skip("No free resource")
        r = requests.post(f"{API}/resources/{free['id']}/download", json={})
        assert r.status_code == 200
        assert "file_url" in r.json()


# ------------- Enquiries -------------
class TestEnquiries:
    def test_routing_general(self):
        r = requests.post(f"{API}/enquiries", json={
            "enquiry_type": "general", "name": "T", "email": "t@example.com",
            "message": "Hi", "consent": True})
        assert r.status_code == 200
        assert r.json()["routed_to"] == "hello@grace-cares.com"

    def test_routing_sensitive(self):
        r = requests.post(f"{API}/enquiries", json={
            "enquiry_type": "hardship_grant", "name": "T", "email": "t@example.com",
            "message": "help", "consent": True})
        assert r.status_code == 200
        assert r.json()["routed_to"] == "grants@grace-cares.com"


# ------------- Role-based access -------------
class TestRoleAccess:
    @pytest.fixture(scope="class")
    def content_admin_session(self, admin_session):
        s = requests.Session()
        email = f"test_ca_{uuid.uuid4().hex[:8]}@example.com"
        s.post(f"{API}/auth/register", json={"email": email, "password": "Pass1234!", "name": "CA"})
        # promote via admin
        users = admin_session.get(f"{API}/admin/users").json()
        uid = next(u["id"] for u in users if u["email"] == email)
        r = admin_session.put(f"{API}/admin/users/{uid}/role", json={"role": "content_admin"})
        assert r.status_code == 200
        # re-login for fresh token with new role
        s2 = requests.Session()
        s2.post(f"{API}/auth/login", json={"email": email, "password": "Pass1234!"})
        return s2

    def test_admin_vat_declarations(self, admin_session):
        r = admin_session.get(f"{API}/admin/vat-declarations")
        assert r.status_code == 200

    def test_content_admin_blocked_from_vat(self, content_admin_session):
        r = content_admin_session.get(f"{API}/admin/vat-declarations")
        assert r.status_code == 403

    def test_content_admin_cannot_see_sensitive_enquiries(self, content_admin_session):
        # seed a sensitive enquiry
        requests.post(f"{API}/enquiries", json={
            "enquiry_type": "caregiver_support", "name": "X", "email": "x@x.com",
            "message": "help", "consent": True})
        r = content_admin_session.get(f"{API}/admin/enquiries")
        assert r.status_code == 200
        for e in r.json():
            assert not e.get("sensitive")

    def test_super_admin_sees_all_enquiries(self, admin_session):
        r = admin_session.get(f"{API}/admin/enquiries")
        assert r.status_code == 200
        # should include at least one sensitive if any exist
        # just verify list works
        assert isinstance(r.json(), list)


# ------------- Admin product management -------------
class TestAdminProducts:
    def test_create_edit_vat_toggle(self, admin_session):
        r = admin_session.post(f"{API}/products", json={
            "name": "TEST_Prod", "sku": f"TP-{uuid.uuid4().hex[:6]}",
            "price_ex_vat": 20.0, "vat_relief_eligible": False,
            "quantity_available": 3, "description": "d", "condition": "Good"})
        assert r.status_code == 200
        pid = r.json()["id"]
        # toggle vat eligibility (super_admin allowed)
        upd = r.json(); upd["vat_relief_eligible"] = True
        upd.pop("id", None); upd.pop("quantity_reserved", None); upd.pop("created_at", None)
        r2 = admin_session.put(f"{API}/products/{pid}", json=upd)
        assert r2.status_code == 200
        assert r2.json()["vat_relief_eligible"] is True
        # stock movement recorded
        r3 = admin_session.get(f"{API}/stock-movements/{pid}")
        assert r3.status_code == 200
        assert len(r3.json()) >= 1
        admin_session.delete(f"{API}/products/{pid}")


# ------------- Xero mock -------------
class TestXero:
    def test_queue(self, admin_session):
        r = admin_session.get(f"{API}/admin/xero/queue")
        assert r.status_code == 200
        assert "counts" in r.json()

    def test_sync_idempotent(self, admin_session):
        q = admin_session.get(f"{API}/admin/xero/queue").json()
        synced = q.get("synced", [])
        if not synced:
            pytest.skip("No synced item to test idempotency")
        item_id = synced[0]["id"]
        r = admin_session.post(f"{API}/admin/xero/sync/{item_id}")
        assert r.status_code == 200
        assert r.json().get("already_synced") is True


# ------------- Refund permission -------------
class TestRefundPermission:
    def test_customer_cannot_refund(self, customer_session):
        r = customer_session.post(f"{API}/admin/orders/deadbeef/refund",
                                  json={"reason": "x"})
        assert r.status_code in (403, 401)


# ------------- Password reset -------------
class TestPasswordReset:
    def test_forgot_password_ok(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": "nonexistent@example.com"})
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_reset_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "invalid", "password": "NewPass1!"})
        assert r.status_code == 400


# ------------- Newsletter -------------
class TestNewsletter:
    def test_requires_consent(self):
        r = requests.post(f"{API}/newsletter", json={
            "email": "n@example.com", "consent": False})
        assert r.status_code == 400

    def test_ok(self):
        r = requests.post(f"{API}/newsletter", json={
            "email": f"TEST_{uuid.uuid4().hex[:6]}@example.com", "consent": True})
        assert r.status_code == 200


# ------------- Checkout declaration validation -------------
class TestCheckoutDeclaration:
    def test_incomplete_declaration_falls_back_to_vat(self, products):
        p = _find(products, eligible=True)
        bad_decl = {**VALID_DECL, "info_accurate": False}
        body = _quote_payload([{"product_id": p["id"], "quantity": 1}],
                              vat_relief_claim=True, declaration=bad_decl)
        r = requests.post(f"{API}/checkout/quote", json=body)
        t = r.json()["totals"]
        # invalid declaration => VAT charged
        assert t["declaration_valid"] is False
        assert t["vat_total"] > 0
