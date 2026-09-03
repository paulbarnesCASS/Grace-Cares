"""Shop: categories, products, VAT engine, cart checkout, Stripe, orders, refunds, wishlist."""
import os
import random
import string
import stripe
from datetime import timedelta
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional
from bson import ObjectId

from core import db, now_utc, clean, cleans
from auth import get_current_user, get_optional_user, require_admin
from emails import send_order_confirmation, send_order_status_update

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

shop_router = APIRouter(prefix="/api")

STANDARD_VAT = 0.20
RESERVE_MINUTES = 30


def gen_ref(prefix="GC"):
    return f"{prefix}-{''.join(random.choices(string.digits, k=8))}"


async def log_audit(user: dict, action: str, entity: str, entity_id: str = None,
                    before=None, after=None):
    await db.audit_logs.insert_one({
        "user_email": user.get("email"), "user_id": user.get("id"),
        "action": action, "entity": entity, "entity_id": entity_id,
        "before": before, "after": after, "at": now_utc()})


async def record_stock_movement(product_id, change, reason, ref=None, note=None):
    await db.stock_movements.insert_one({
        "product_id": product_id, "change": change, "reason": reason,
        "reference": ref, "note": note, "at": now_utc()})


async def release_expired_reservations():
    cursor = db.orders.find({"status": "pending_payment", "reserved_until": {"$lt": now_utc()}})
    async for o in cursor:
        for it in o.get("items", []):
            await db.products.update_one({"_id": ObjectId(it["product_id"])},
                                         {"$inc": {"quantity_reserved": -it["quantity"]}})
        await db.orders.update_one({"_id": o["_id"]}, {"$set": {"status": "expired"}})


DEFAULT_BANDS = [{"max_kg": 2, "price": 4.95}, {"max_kg": 5, "price": 7.95},
                 {"max_kg": 10, "price": 11.95}, {"max_kg": 20, "price": 16.95},
                 {"max_kg": 9999, "price": 24.95}]


# Editable VAT-relief declaration wording shown at checkout (admin can change).
DEFAULT_VAT_STATEMENT = {
    "heading": "VAT relief declaration",
    "intro": "Your basket contains items that may qualify for VAT relief. To claim, both must be true: the product is approved as eligible, and you complete the declaration below.",
    "bullets": [
        "Being elderly on its own does not qualify.",
        "A temporary injury or condition does not normally qualify.",
        "If you don't qualify or don't complete the declaration, standard VAT applies to those items.",
    ],
    "choice_personal": "My own personal or domestic use (I am disabled or have a long-term illness)",
    "choice_behalf": "An eligible person I am purchasing on behalf of",
    "choice_not_qualify": "Another purpose — I do not qualify / do not wish to claim (standard VAT applies)",
    "confirm_domestic": "I confirm the goods are for the eligible person's personal or domestic use.",
    "confirm_accurate": "I declare that the information above is accurate and complete.",
}


async def get_vat_statement() -> dict:
    s = await db.site_settings.find_one({"key": "vat_declaration"})
    merged = {**DEFAULT_VAT_STATEMENT, **((s or {}).get("statement") or {})}
    return merged


@shop_router.get("/vat-declaration-statement")
async def public_vat_statement():
    return await get_vat_statement()


async def get_postage(weight: float) -> float:
    s = await db.site_settings.find_one({"key": "postage_bands"})
    bands = (s or {}).get("bands", DEFAULT_BANDS)
    for b in sorted(bands, key=lambda x: x["max_kg"]):
        if weight <= b["max_kg"]:
            return round(b["price"], 2)
    return round(bands[-1]["price"], 2) if bands else 0.0


async def notify_admins(kind: str, message: str, entity_id: str = None):
    await db.notifications.insert_one({"kind": kind, "message": message,
                                       "entity_id": entity_id, "read": False, "at": now_utc()})
    approvers = await db.users.find({"role": {"$in": ["product_approver", "shop_admin", "super_admin"]}}).to_list(50)
    for a in approvers:
        print(f"[MOCK EMAIL] To {a['email']}: {message}")  # MOCKED — wire to email provider later


async def finalize_delivery_quote(order_id: str, pi: str = None):
    await db.orders.update_one({"_id": ObjectId(order_id)},
        {"$set": {"delivery_quote.status": "paid", "delivery_quote.paid_at": now_utc(),
                  "delivery_quote.payment_intent": pi}})


# ---------------- Categories ----------------
class CategoryBody(BaseModel):
    name: str
    slug: str
    description: Optional[str] = ""
    parent_id: Optional[str] = None
    order: int = 0
    hidden: bool = False
    image: Optional[str] = None


@shop_router.get("/categories")
async def list_categories(include_hidden: bool = False):
    q = {} if include_hidden else {"hidden": {"$ne": True}}
    docs = await db.categories.find(q).sort("order", 1).to_list(200)
    return cleans(docs)


@shop_router.post("/categories")
async def create_category(body: CategoryBody, user=Depends(require_admin("shop_admin"))):
    doc = body.model_dump(); doc["created_at"] = now_utc()
    res = await db.categories.insert_one(doc)
    await log_audit(user, "create", "category", str(res.inserted_id), after=body.model_dump())
    return clean(await db.categories.find_one({"_id": res.inserted_id}))


@shop_router.put("/categories/{cid}")
async def update_category(cid: str, body: CategoryBody, user=Depends(require_admin("shop_admin"))):
    before = await db.categories.find_one({"_id": ObjectId(cid)})
    await db.categories.update_one({"_id": ObjectId(cid)}, {"$set": body.model_dump()})
    await log_audit(user, "update", "category", cid, clean(before), body.model_dump())
    return clean(await db.categories.find_one({"_id": ObjectId(cid)}))


@shop_router.delete("/categories/{cid}")
async def delete_category(cid: str, user=Depends(require_admin("shop_admin"))):
    await db.categories.delete_one({"_id": ObjectId(cid)})
    await log_audit(user, "delete", "category", cid)
    return {"ok": True}


# ---------------- Products ----------------
class ProductBody(BaseModel):
    name: str
    sku: str
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    description: str = ""
    condition: str = "Good"
    price_ex_vat: float
    vat_rate: float = STANDARD_VAT
    vat_relief_eligible: bool = False
    quantity_available: int = 1
    images: List[str] = []
    specifications: Optional[dict] = {}
    dimensions: Optional[str] = ""
    max_user_weight: Optional[str] = ""
    carbon_saving_kg: Optional[float] = 0
    fulfilment_options: List[str] = ["collection"]  # collection, delivery, delivery_quote
    delivery_charge: float = 0
    listing_type: str = "sale"  # sale or hire
    stock_model: str = "unique"  # unique or repeat
    weight_kg: float = 0
    fulfilment_route: str = "hub_collection"  # postable, hub_collection, bulky_delivery
    status: str = "available"  # available, reserved, sold, hidden
    related_ids: List[str] = []
    safety_info: Optional[str] = ""
    admin_notes: Optional[str] = ""
    seo_title: Optional[str] = ""
    seo_description: Optional[str] = ""
    featured: bool = False


def public_product(p: dict) -> dict:
    p = clean(p)
    p.pop("admin_notes", None)
    ex = p.get("price_ex_vat", 0)
    rate = p.get("vat_rate", STANDARD_VAT)
    p["price_inc_vat"] = round(ex * (1 + rate), 2)
    p["available_qty"] = max(0, p.get("quantity_available", 0) - p.get("quantity_reserved", 0))
    return p


@shop_router.get("/products")
async def list_products(
    q: Optional[str] = None, category_id: Optional[str] = None,
    condition: Optional[str] = None, fulfilment: Optional[str] = None,
    vat_relief: Optional[bool] = None, listing_type: Optional[str] = None,
    min_price: Optional[float] = None, max_price: Optional[float] = None,
    in_stock: Optional[bool] = None, featured: Optional[bool] = None,
    sort: str = "recent", limit: int = 60, skip: int = 0,
):
    await release_expired_reservations()
    query = {"status": {"$nin": ["hidden", "draft", "awaiting_approval"]}}
    if category_id:
        query["category_id"] = category_id
    if condition:
        query["condition"] = condition
    if fulfilment:
        query["fulfilment_options"] = fulfilment
    if vat_relief is not None:
        query["vat_relief_eligible"] = vat_relief
    if listing_type:
        query["listing_type"] = listing_type
    if featured:
        query["featured"] = True
    if min_price is not None or max_price is not None:
        pr = {}
        if min_price is not None:
            pr["$gte"] = min_price
        if max_price is not None:
            pr["$lte"] = max_price
        query["price_ex_vat"] = pr
    if q:
        # fuzzy-ish: case-insensitive regex across name/description/sku
        terms = q.strip()
        query["$or"] = [
            {"name": {"$regex": terms, "$options": "i"}},
            {"description": {"$regex": terms, "$options": "i"}},
            {"sku": {"$regex": terms, "$options": "i"}},
        ]
    sort_map = {"recent": [("created_at", -1)], "price_low": [("price_ex_vat", 1)],
                "price_high": [("price_ex_vat", -1)], "name": [("name", 1)]}
    docs = await db.products.find(query).sort(sort_map.get(sort, [("created_at", -1)])).skip(skip).limit(limit).to_list(limit)
    total = await db.products.count_documents(query)
    items = [public_product(d) for d in docs]
    if in_stock:
        items = [i for i in items if i["available_qty"] > 0]
    return {"items": items, "total": total}


@shop_router.get("/products/{pid}")
async def get_product(pid: str):
    await release_expired_reservations()
    try:
        doc = await db.products.find_one({"_id": ObjectId(pid)})
    except Exception:
        doc = None
    if not doc:
        doc = await db.products.find_one({"sku": pid})
    if not doc:
        raise HTTPException(404, "Product not found")
    p = public_product(doc)
    related = []
    for rid in doc.get("related_ids", [])[:4]:
        try:
            r = await db.products.find_one({"_id": ObjectId(rid)})
            if r:
                related.append(public_product(r))
        except Exception:
            pass
    p["related"] = related
    return p


@shop_router.get("/admin/products/{pid}")
async def admin_get_product(pid: str, user=Depends(require_admin("shop_admin"))):
    doc = await db.products.find_one({"_id": ObjectId(pid)})
    if not doc:
        raise HTTPException(404, "Product not found")
    return clean(doc)


@shop_router.post("/products")
async def create_product(body: ProductBody, user=Depends(require_admin("shop_admin", "product_contributor", "product_approver"))):
    doc = body.model_dump()
    doc["quantity_reserved"] = 0
    if user["role"] == "product_contributor":
        doc["status"] = "draft"  # contributors cannot publish
    doc["created_at"] = now_utc()
    res = await db.products.insert_one(doc)
    await record_stock_movement(str(res.inserted_id), body.quantity_available, "initial_stock")
    await log_audit(user, "create", "product", str(res.inserted_id), after={"name": body.name, "sku": body.sku})
    if doc.get("status") in ("draft", "awaiting_approval"):
        await notify_admins("new_listing", f"New listing '{body.name}' ({body.sku}) is awaiting approval.", str(res.inserted_id))
    return clean(await db.products.find_one({"_id": res.inserted_id}))


@shop_router.put("/products/{pid}")
async def update_product(pid: str, body: ProductBody, user=Depends(require_admin("shop_admin", "product_contributor", "product_approver"))):
    before = await db.products.find_one({"_id": ObjectId(pid)})
    if not before:
        raise HTTPException(404, "Product not found")
    upd_body = body.model_dump()
    if user["role"] == "product_contributor":
        # contributors edit drafts only and can never publish
        upd_body["status"] = "draft"
    # VAT eligibility change requires finance or super admin
    if before.get("vat_relief_eligible") != body.vat_relief_eligible and user["role"] not in ("super_admin", "finance_admin"):
        raise HTTPException(403, "Only finance or super administrators can change VAT eligibility")
    upd = upd_body
    if body.quantity_available != before.get("quantity_available"):
        diff = body.quantity_available - before.get("quantity_available", 0)
        await record_stock_movement(pid, diff, "manual_adjustment", note=f"by {user['email']}")
    await db.products.update_one({"_id": ObjectId(pid)}, {"$set": upd})
    await log_audit(user, "update", "product", pid,
                    {"vat_relief_eligible": before.get("vat_relief_eligible"), "price_ex_vat": before.get("price_ex_vat")},
                    {"vat_relief_eligible": body.vat_relief_eligible, "price_ex_vat": body.price_ex_vat})
    return clean(await db.products.find_one({"_id": ObjectId(pid)}))


@shop_router.delete("/products/{pid}")
async def delete_product(pid: str, user=Depends(require_admin("shop_admin"))):
    await db.products.delete_one({"_id": ObjectId(pid)})
    await log_audit(user, "delete", "product", pid)
    return {"ok": True}


@shop_router.get("/stock-movements/{pid}")
async def stock_history(pid: str, user=Depends(require_admin("shop_admin"))):
    docs = await db.stock_movements.find({"product_id": pid}).sort("at", -1).to_list(200)
    return cleans(docs)


# ---------------- VAT engine + checkout ----------------
class DeclarationData(BaseModel):
    eligible_person_name: str
    eligible_person_address: str
    condition_description: str
    for_personal_domestic_use: bool
    completed_by_name: Optional[str] = ""
    relationship: Optional[str] = ""
    info_accurate: bool
    signature: str


class CheckoutItem(BaseModel):
    product_id: str
    quantity: int = Field(ge=1)


class CustomerDetails(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    address_line1: str = ""
    address_line2: Optional[str] = ""
    city: str = ""
    postcode: str = ""


class CheckoutBody(BaseModel):
    items: List[CheckoutItem]
    customer: CustomerDetails
    fulfilment: str = "collection"  # collection, postable, hub_collection, bulky_delivery, delivery
    delivery_questionnaire: Optional[dict] = None
    vat_relief_claim: bool = False
    declaration: Optional[DeclarationData] = None
    donation_amount: float = 0
    marketing_consent: bool = False
    accept_terms: bool
    origin_url: str


async def compute_order(body: CheckoutBody):
    """Validate stock and compute line-level VAT. Returns (order_lines, totals)."""
    lines = []
    vat_breakdown = {}  # rate -> {ex, vat}
    subtotal_ex = 0.0
    vat_total = 0.0
    declaration_valid = bool(
        body.vat_relief_claim and body.declaration and
        body.declaration.for_personal_domestic_use and body.declaration.info_accurate and
        body.declaration.eligible_person_name and body.declaration.condition_description
    )
    for it in body.items:
        p = await db.products.find_one({"_id": ObjectId(it.product_id)})
        if not p:
            raise HTTPException(400, f"Product no longer available")
        available = p.get("quantity_available", 0) - p.get("quantity_reserved", 0)
        if available < it.quantity:
            raise HTTPException(409, f"'{p['name']}' is no longer available in the requested quantity")
        ex = round(p["price_ex_vat"] * it.quantity, 2)
        eligible = p.get("vat_relief_eligible", False)
        applied_rate = 0.0 if (eligible and declaration_valid) else p.get("vat_rate", STANDARD_VAT)
        line_vat = round(ex * applied_rate, 2)
        lines.append({
            "product_id": it.product_id, "name": p["name"], "sku": p.get("sku"),
            "quantity": it.quantity, "unit_price_ex_vat": p["price_ex_vat"],
            "line_ex_vat": ex, "vat_rate": applied_rate, "line_vat": line_vat,
            "line_total": round(ex + line_vat, 2),
            "vat_relief_eligible": eligible, "vat_relief_applied": eligible and declaration_valid,
        })
        subtotal_ex += ex
        vat_total += line_vat
        key = f"{int(applied_rate*100)}%"
        vat_breakdown.setdefault(key, {"ex": 0, "vat": 0})
        vat_breakdown[key]["ex"] = round(vat_breakdown[key]["ex"] + ex, 2)
        vat_breakdown[key]["vat"] = round(vat_breakdown[key]["vat"] + line_vat, 2)

    delivery_ex = 0.0
    delivery_vat = 0.0
    if body.fulfilment == "postable":
        total_w = 0.0
        for it in body.items:
            p = await db.products.find_one({"_id": ObjectId(it.product_id)})
            total_w += (p.get("weight_kg", 0) or 0) * it.quantity
        delivery_ex = await get_postage(total_w)
        delivery_vat = round(delivery_ex * STANDARD_VAT, 2)
    elif body.fulfilment == "delivery":
        charges = []
        for it in body.items:
            p = await db.products.find_one({"_id": ObjectId(it.product_id)})
            charges.append(p.get("delivery_charge", 0) or 0)
        delivery_ex = round(max(charges) if charges else 0, 2)
        delivery_vat = round(delivery_ex * STANDARD_VAT, 2)
    # hub_collection / bulky_delivery -> £0 now (bulky quoted separately later)
    if delivery_ex:
        key = "20%"
        vat_breakdown.setdefault(key, {"ex": 0, "vat": 0})
        vat_breakdown[key]["ex"] = round(vat_breakdown[key]["ex"] + delivery_ex, 2)
        vat_breakdown[key]["vat"] = round(vat_breakdown[key]["vat"] + delivery_vat, 2)

    donation = round(max(0, body.donation_amount), 2)
    total = round(subtotal_ex + vat_total + delivery_ex + delivery_vat + donation, 2)
    totals = {
        "subtotal_ex_vat": round(subtotal_ex, 2), "vat_total": round(vat_total, 2),
        "vat_breakdown": vat_breakdown, "delivery_ex_vat": delivery_ex,
        "delivery_vat": delivery_vat, "delivery_total": round(delivery_ex + delivery_vat, 2),
        "donation": donation, "total_payable": total,
        "declaration_valid": declaration_valid,
    }
    return lines, totals


@shop_router.post("/checkout/quote")
async def checkout_quote(body: CheckoutBody):
    """Compute totals without creating an order (for cart preview)."""
    lines, totals = await compute_order(body)
    return {"lines": lines, "totals": totals}


@shop_router.post("/checkout")
async def create_checkout(body: CheckoutBody, request: Request, user=Depends(get_optional_user)):
    if not body.accept_terms:
        raise HTTPException(400, "You must accept the terms and conditions")
    await release_expired_reservations()
    lines, totals = await compute_order(body)

    order_ref = gen_ref()
    declaration_id = None
    if body.vat_relief_claim and body.declaration and totals["declaration_valid"]:
        dec = body.declaration.model_dump()
        dec.update({"order_reference": order_ref, "created_at": now_utc(),
                    "customer_email": body.customer.email})
        dres = await db.vat_declarations.insert_one(dec)
        declaration_id = str(dres.inserted_id)

    order_doc = {
        "reference": order_ref, "user_id": user["id"] if user else None,
        "customer": body.customer.model_dump(), "items": lines, "totals": totals,
        "fulfilment": body.fulfilment, "donation_amount": totals["donation"],
        "delivery_questionnaire": body.delivery_questionnaire,
        "vat_relief_claim": body.vat_relief_claim, "declaration_id": declaration_id,
        "marketing_consent": body.marketing_consent,
        "status": "pending_payment", "payment_status": "pending",
        "xero_sync_status": "not_synced",
        "reserved_until": now_utc() + timedelta(minutes=RESERVE_MINUTES),
        "created_at": now_utc(),
    }
    order_res = await db.orders.insert_one(order_doc)
    order_id = str(order_res.inserted_id)

    # reserve stock
    for it in body.items:
        await db.products.update_one({"_id": ObjectId(it.product_id)},
                                     {"$inc": {"quantity_reserved": it.quantity}})

    if body.marketing_consent:
        await upsert_subscriber(body.customer.email, body.customer.name, "checkout")

    # Stripe checkout session with server-computed total (custom VAT handled by us)
    amount_cents = int(round(totals["total_payable"] * 100))
    try:
        session = stripe.checkout.Session.create(
            line_items=[{
                "price_data": {"currency": "gbp",
                               "product_data": {"name": f"Grace Cares Order {order_ref}"},
                               "unit_amount": amount_cents},
                "quantity": 1}],
            mode="payment",
            success_url=f"{body.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{body.origin_url}/payment/cancel?order={order_ref}",
            metadata={"order_id": order_id, "order_ref": order_ref, "type": "order"},
        )
    except Exception as e:
        raise HTTPException(500, f"Payment could not be started: {e}")

    await db.payment_transactions.insert_one({
        "session_id": session.id, "order_id": order_id, "order_ref": order_ref,
        "amount": totals["total_payable"], "currency": "gbp", "type": "order",
        "status": "initiated", "payment_status": "pending",
        "created_at": now_utc(), "updated_at": now_utc()})
    await db.orders.update_one({"_id": order_res.inserted_id},
                               {"$set": {"stripe_session_id": session.id}})
    return {"checkout_url": session.url, "session_id": session.id, "order_reference": order_ref}


async def finalize_paid_order(order_id: str, payment_intent: str = None):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order or order.get("payment_status") == "paid":
        return
    for it in order.get("items", []):
        pid = it["product_id"]
        await db.products.update_one({"_id": ObjectId(pid)},
                                     {"$inc": {"quantity_available": -it["quantity"],
                                               "quantity_reserved": -it["quantity"]}})
        p = await db.products.find_one({"_id": ObjectId(pid)})
        if p and (p.get("quantity_available", 0) <= 0):
            await db.products.update_one({"_id": ObjectId(pid)}, {"$set": {"status": "sold"}})
        await record_stock_movement(pid, -it["quantity"], "sale", order["reference"])
    await db.orders.update_one({"_id": ObjectId(order_id)},
                               {"$set": {"status": "paid", "payment_status": "paid",
                                         "stripe_payment_intent": payment_intent,
                                         "paid_at": now_utc(), "xero_sync_status": "queued"}})
    # order confirmation email (failure must not break payment finalisation)
    try:
        fresh = await db.orders.find_one({"_id": ObjectId(order_id)})
        await send_order_confirmation(fresh)
        await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": {"confirmation_emailed_at": now_utc()}})
    except Exception as e:
        print(f"[EMAIL] order confirmation failed for {order.get('reference')}: {e}")
    # queue Xero sync (mocked)
    await db.xero_sync_queue.insert_one({
        "order_id": order_id, "order_ref": order["reference"], "type": "invoice",
        "amount": order["totals"]["total_payable"], "status": "queued",
        "attempts": 0, "created_at": now_utc()})


@shop_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    rec = await db.payment_transactions.find_one({"session_id": session_id})
    if not rec:
        raise HTTPException(404, "Transaction not found")
    if rec.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid",
                              "stripe_payment_intent_id": s.payment_intent, "updated_at": now_utc()}})
                if rec.get("type") == "order" and rec.get("order_id"):
                    await finalize_paid_order(rec["order_id"], s.payment_intent)
                elif rec.get("type") == "donation" and rec.get("donation_id"):
                    await finalize_donation(rec["donation_id"], s.payment_intent)
                elif rec.get("type") == "event" and rec.get("booking_id"):
                    await finalize_event_booking(rec["booking_id"], s.payment_intent)
                elif rec.get("type") == "delivery_quote" and rec.get("order_id"):
                    await finalize_delivery_quote(rec["order_id"], s.payment_intent)
                rec = await db.payment_transactions.find_one({"session_id": session_id})
        except Exception:
            pass
    return {"session_id": rec["session_id"], "status": rec["status"],
            "payment_status": rec["payment_status"], "type": rec.get("type"),
            "order_ref": rec.get("order_ref")}


@shop_router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(400, "Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        sid = obj["id"]
        await db.payment_transactions.update_one(
            {"session_id": sid, "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": "paid",
                      "stripe_payment_intent_id": obj.get("payment_intent"), "updated_at": now_utc()}})
        rec = await db.payment_transactions.find_one({"session_id": sid})
        if rec:
            if rec.get("type") == "order" and rec.get("order_id"):
                await finalize_paid_order(rec["order_id"], obj.get("payment_intent"))
            elif rec.get("type") == "donation" and rec.get("donation_id"):
                await finalize_donation(rec["donation_id"], obj.get("payment_intent"))
            elif rec.get("type") == "event" and rec.get("booking_id"):
                await finalize_event_booking(rec["booking_id"], obj.get("payment_intent"))
            elif rec.get("type") == "delivery_quote" and rec.get("order_id"):
                await finalize_delivery_quote(rec["order_id"], obj.get("payment_intent"))
    elif t == "charge.refunded":
        pi = obj.get("payment_intent")
        await db.payment_transactions.update_one({"stripe_payment_intent_id": pi},
            {"$set": {"payment_status": "refunded", "updated_at": now_utc()}})
    return {"status": "ok"}


# ---------------- Orders ----------------
@shop_router.get("/orders/mine")
async def my_orders(user=Depends(get_current_user)):
    docs = await db.orders.find({"user_id": user["id"]}).sort("created_at", -1).to_list(200)
    return cleans(docs)


@shop_router.get("/orders/{oid}")
async def get_order(oid: str, user=Depends(get_current_user)):
    o = await db.orders.find_one({"_id": ObjectId(oid)})
    if not o:
        raise HTTPException(404, "Order not found")
    is_admin = user["role"] != "customer"
    if not is_admin and o.get("user_id") != user["id"]:
        raise HTTPException(403, "Not allowed")
    out = clean(o)
    if not is_admin:
        out.pop("declaration_id", None)
    return out


@shop_router.get("/admin/orders")
async def admin_orders(status: Optional[str] = None, user=Depends(require_admin("shop_admin", "finance_admin"))):
    q = {}
    if status:
        q["status"] = status
    docs = await db.orders.find(q).sort("created_at", -1).to_list(500)
    return cleans(docs)


class RefundBody(BaseModel):
    amount: Optional[float] = None  # None = full
    reason: Optional[str] = ""
    return_stock: bool = True


@shop_router.post("/admin/orders/{oid}/refund")
async def refund_order(oid: str, body: RefundBody, user=Depends(require_admin("finance_admin"))):
    o = await db.orders.find_one({"_id": ObjectId(oid)})
    if not o:
        raise HTTPException(404, "Order not found")
    if not o.get("stripe_payment_intent"):
        raise HTTPException(400, "No payment to refund")
    kwargs = {"payment_intent": o["stripe_payment_intent"]}
    if body.amount:
        kwargs["amount"] = int(round(body.amount * 100))
    try:
        refund = stripe.Refund.create(**kwargs)
    except Exception as e:
        raise HTTPException(500, f"Refund failed: {e}")
    is_full = not body.amount or body.amount >= o["totals"]["total_payable"]
    if body.return_stock and is_full:
        for it in o.get("items", []):
            await db.products.update_one({"_id": ObjectId(it["product_id"])},
                                         {"$inc": {"quantity_available": it["quantity"]},
                                          "$set": {"status": "available"}})
            await record_stock_movement(it["product_id"], it["quantity"], "refund_return", o["reference"])
    await db.orders.update_one({"_id": ObjectId(oid)},
        {"$set": {"status": "refunded" if is_full else "partially_refunded",
                  "refund_amount": body.amount or o["totals"]["total_payable"],
                  "refund_reason": body.reason, "xero_sync_status": "queued"},
         "$push": {"refunds": {"amount": body.amount or o["totals"]["total_payable"],
                               "stripe_refund_id": refund.id, "at": now_utc(), "by": user["email"]}}})
    await db.xero_sync_queue.insert_one({
        "order_id": oid, "order_ref": o["reference"], "type": "credit_note",
        "amount": body.amount or o["totals"]["total_payable"], "status": "queued",
        "attempts": 0, "created_at": now_utc()})
    await log_audit(user, "refund", "order", oid, after={"amount": body.amount, "full": is_full})
    return {"ok": True, "refund_id": refund.id, "full": is_full}


class OrderStatusBody(BaseModel):
    status: str
    note: Optional[str] = ""
    notify: bool = False


AUTO_EMAIL_STATUSES = {"dispatched", "ready_for_collection"}


@shop_router.put("/admin/orders/{oid}/status")
async def update_order_status(oid: str, body: OrderStatusBody, user=Depends(require_admin("shop_admin"))):
    o = await db.orders.find_one({"_id": ObjectId(oid)})
    if not o:
        raise HTTPException(404, "Order not found")
    should_email = body.notify or body.status in AUTO_EMAIL_STATUSES
    emailed = False
    if should_email:
        try:
            emailed = bool(await send_order_status_update(o, body.status, body.note))
        except Exception as e:
            print(f"[EMAIL] status update failed for {o.get('reference')}: {e}")
    await db.orders.update_one({"_id": ObjectId(oid)},
        {"$set": {"status": body.status},
         "$push": {"status_history": {"kind": "status", "status": body.status, "at": now_utc(),
                                      "by": user["email"], "note": body.note, "emailed": emailed}}})
    await log_audit(user, "update_status", "order", oid, {"status": o.get("status")}, {"status": body.status})
    return {"ok": True, "emailed": emailed}


class NoteBody(BaseModel):
    note: str


@shop_router.post("/admin/orders/{oid}/note")
async def add_order_note(oid: str, body: NoteBody, user=Depends(require_admin("shop_admin", "finance_admin"))):
    if not body.note.strip():
        raise HTTPException(400, "Note cannot be empty")
    res = await db.orders.update_one({"_id": ObjectId(oid)},
        {"$push": {"status_history": {"kind": "note", "note": body.note.strip(),
                                      "at": now_utc(), "by": user["email"]}}})
    if not res.matched_count:
        raise HTTPException(404, "Order not found")
    await log_audit(user, "note", "order", oid, after={"note": body.note.strip()})
    return {"ok": True}


@shop_router.post("/admin/orders/{oid}/send-confirmation")
async def resend_order_confirmation(oid: str, user=Depends(require_admin("shop_admin", "finance_admin"))):
    o = await db.orders.find_one({"_id": ObjectId(oid)})
    if not o:
        raise HTTPException(404, "Order not found")
    email_id = await send_order_confirmation(o)
    if not email_id:
        raise HTTPException(400, "No customer email is stored on this order")
    await db.orders.update_one({"_id": ObjectId(oid)}, {"$set": {"confirmation_emailed_at": now_utc()}})
    return {"ok": True, "email_id": email_id, "sent_to": o.get("customer", {}).get("email")}


# ---------------- Wishlist / item requests ----------------
class WishlistBody(BaseModel):
    product_id: Optional[str] = None
    name: str
    email: str
    item_description: Optional[str] = ""


@shop_router.post("/wishlist")
async def add_wishlist(body: WishlistBody):
    doc = body.model_dump(); doc["created_at"] = now_utc(); doc["status"] = "open"
    await db.wishlist_requests.insert_one(doc)
    return {"ok": True}


@shop_router.get("/admin/wishlist")
async def list_wishlist(user=Depends(require_admin("shop_admin"))):
    docs = await db.wishlist_requests.find().sort("created_at", -1).to_list(300)
    return cleans(docs)


# ---------------- shared helpers imported by content module ----------------
async def upsert_subscriber(email: str, name: str, source: str, tags=None):
    existing = await db.subscribers.find_one({"email": email.lower()})
    if existing:
        return
    await db.subscribers.insert_one({
        "email": email.lower(), "name": name, "consent_source": source,
        "consent_at": now_utc(), "tags": tags or [], "subscribed": True,
        "created_at": now_utc()})


# forward declarations resolved at runtime (defined in content module and attached)
async def finalize_donation(donation_id, pi):
    from content import _finalize_donation
    await _finalize_donation(donation_id, pi)


async def finalize_event_booking(booking_id, pi):
    from content import _finalize_event_booking
    await _finalize_event_booking(booking_id, pi)
