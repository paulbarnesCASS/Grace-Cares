"""v3 extras: product approve/draft workflow, fulfilment info, Grace AI stub,
sitemap.xml, robots.txt, and 301 redirect manager."""
import os
import csv as _csv
import io as _io
import stripe
from fastapi import APIRouter, HTTPException, Depends, Response, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId

from core import db, now_utc, clean, cleans
from auth import require_admin
from shop import log_audit, DEFAULT_BANDS, notify_admins

extra_router = APIRouter(prefix="/api")
SITE = os.environ.get("FRONTEND_URL", "https://grace-cares.com").rstrip("/")


# ---------- Draft -> Approve workflow ----------
@extra_router.get("/admin/products-review")
async def products_awaiting(user=Depends(require_admin("shop_admin", "product_approver"))):
    docs = await db.products.find({"status": {"$in": ["draft", "awaiting_approval"]}}).sort("created_at", -1).to_list(200)
    return cleans(docs)


@extra_router.post("/products/{pid}/submit")
async def submit_for_approval(pid: str, user=Depends(require_admin("shop_admin", "product_contributor", "product_approver"))):
    await db.products.update_one({"_id": ObjectId(pid)}, {"$set": {"status": "awaiting_approval"}})
    await log_audit(user, "submit_for_approval", "product", pid)
    return {"ok": True}


@extra_router.post("/products/{pid}/approve")
async def approve_product(pid: str, user=Depends(require_admin("shop_admin", "product_approver"))):
    p = await db.products.find_one({"_id": ObjectId(pid)})
    if not p:
        raise HTTPException(404, "Product not found")
    await db.products.update_one({"_id": ObjectId(pid)}, {"$set": {"status": "available", "approved_by": user["email"], "approved_at": now_utc()}})
    await log_audit(user, "approve", "product", pid, {"status": p.get("status")}, {"status": "available"})
    return {"ok": True}


# ---------- Grace AI stub (rule-based, refuses clinical + VAT eligibility) ----------
class AIBody(BaseModel):
    message: str


CLINICAL = ["suitable", "suitability", "right for", "safe for", "should i", "will it help", "which wheelchair", "what size", "diagnos", "medical advice", "recommend for"]
VAT_ELIG = ["do i qualify", "am i eligible", "qualify for vat", "vat relief eligible", "claim vat", "eligible for vat", "am i entitled"]
HUMAN = "For this, please speak to a real person on 01543 730189 (Mon–Fri, 9am–5pm) or email hello@grace-cares.com — we'll be glad to help."


@extra_router.post("/grace-ai")
async def grace_ai(body: AIBody):
    m = body.message.lower()
    if any(k in m for k in VAT_ELIG):
        return {"reply": "I can't decide whether you personally qualify for VAT relief — that's your declaration to make, and getting it wrong has legal consequences. What I can say: relief only applies when (1) an item is approved as eligible AND (2) you complete the declaration at checkout confirming a disability or long-term illness and personal/domestic use. Being elderly alone, or a temporary condition, does not qualify. " + HUMAN, "handoff": True}
    if any(k in m for k in CLINICAL):
        return {"reply": "I'm not able to give clinical or suitability advice, or tell you which equipment is right for a person's condition — that needs a qualified professional (e.g. an occupational therapist) or our team. " + HUMAN, "handoff": True}
    if "vat" in m:
        return {"reply": "Products show two prices where relief applies: the standard (VAT-inclusive) price, and the price if you validly claim VAT relief at checkout. You'll complete a short HMRC declaration during checkout. " + HUMAN, "handoff": False}
    if any(k in m for k in ["delivery", "collect", "postage", "bulky"]):
        return {"reply": "We offer three routes depending on the item: postable (small items sent by courier), collection from our Lichfield hub, and delivery for bulky items (we'll ask a few access questions and quote separately). You'll pick the route at checkout. " + HUMAN, "handoff": False}
    if any(k in m for k in ["donate", "donation"]):
        return {"reply": "You can donate equipment via our Donate Equipment form, or make a financial gift on the Donate page. Thank you! " + HUMAN, "handoff": False}
    return {"reply": "Thanks for your message. I can help with general questions about buying, donating, delivery and events. For anything about a person's health, suitability, or whether you qualify for VAT relief, I'll always point you to a human. " + HUMAN, "handoff": False}


# ---------- Redirect manager (301) ----------
class RedirectBody(BaseModel):
    from_path: str
    to_path: str
    status_code: int = 301


@extra_router.get("/redirects/resolve")
async def resolve_redirect(path: str):
    r = await db.redirects.find_one({"from_path": path})
    if not r:
        return {"found": False}
    return {"found": True, "to": r["to_path"], "status_code": r.get("status_code", 301)}


@extra_router.get("/admin/redirects")
async def list_redirects(user=Depends(require_admin("content_admin"))):
    return cleans(await db.redirects.find().sort("from_path", 1).to_list(1000))


@extra_router.post("/admin/redirects")
async def create_redirect(body: RedirectBody, user=Depends(require_admin("content_admin"))):
    await db.redirects.update_one({"from_path": body.from_path}, {"$set": body.model_dump()}, upsert=True)
    await log_audit(user, "upsert", "redirect", body.from_path, after=body.model_dump())
    return {"ok": True}


@extra_router.delete("/admin/redirects/{rid}")
async def delete_redirect(rid: str, user=Depends(require_admin("content_admin"))):
    await db.redirects.delete_one({"_id": ObjectId(rid)})
    return {"ok": True}


# ---------- SEO: sitemap + robots ----------
@extra_router.get("/sitemap.xml")
async def sitemap():
    urls = ["/", "/shop", "/donate-equipment", "/donate-funds", "/get-help", "/nhs",
            "/events", "/resources", "/impact", "/news", "/about", "/contact", "/get-involved"]
    for p in await db.products.find({"status": {"$nin": ["hidden", "draft", "awaiting_approval"]}}).to_list(2000):
        urls.append(f"/product/{p['_id']}")
    for c in await db.categories.find({"hidden": {"$ne": True}}).to_list(200):
        urls.append(f"/shop?category_id={c['_id']}")
    for a in await db.articles.find({"status": "published"}).to_list(500):
        urls.append(f"/news/{a['slug']}")
    for e in await db.events.find({"published": True}).to_list(500):
        urls.append(f"/events/{e['slug']}")
    body = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        body.append(f"<url><loc>{SITE}{u}</loc></url>")
    body.append("</urlset>")
    return Response(content="\n".join(body), media_type="application/xml")


@extra_router.get("/robots.txt", response_class=PlainTextResponse)
async def robots():
    return f"User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nSitemap: {SITE}/api/sitemap.xml\n"


class PostageBands(BaseModel):
    bands: List[dict]


@extra_router.get("/admin/postage-bands")
async def get_bands(user=Depends(require_admin("shop_admin", "finance_admin"))):
    s = await db.site_settings.find_one({"key": "postage_bands"})
    return {"bands": (s or {}).get("bands", DEFAULT_BANDS)}


@extra_router.put("/admin/postage-bands")
async def set_bands(body: PostageBands, user=Depends(require_admin("shop_admin", "finance_admin"))):
    await db.site_settings.update_one({"key": "postage_bands"},
        {"$set": {"key": "postage_bands", "bands": body.bands}}, upsert=True)
    await log_audit(user, "update", "postage_bands", after={"bands": body.bands})
    return {"ok": True}


@extra_router.get("/admin/notifications")
async def notifications(user=Depends(require_admin("shop_admin", "product_approver"))):
    return cleans(await db.notifications.find().sort("at", -1).to_list(100))


@extra_router.post("/admin/notifications/{nid}/read")
async def mark_read(nid: str, user=Depends(require_admin("shop_admin", "product_approver"))):
    await db.notifications.update_one({"_id": ObjectId(nid)}, {"$set": {"read": True}})
    return {"ok": True}


class QuoteBody(BaseModel):
    amount: float
    note: Optional[str] = ""


@extra_router.post("/admin/orders/{oid}/delivery-quote")
async def delivery_quote(oid: str, body: QuoteBody, user=Depends(require_admin("shop_admin", "finance_admin"))):
    o = await db.orders.find_one({"_id": ObjectId(oid)})
    if not o:
        raise HTTPException(404, "Order not found")
    origin = os.environ.get("FRONTEND_URL", SITE)
    session = stripe.checkout.Session.create(
        line_items=[{"price_data": {"currency": "gbp",
                     "product_data": {"name": f"Delivery for order {o['reference']}"},
                     "unit_amount": int(round(body.amount * 100))}, "quantity": 1}],
        mode="payment",
        success_url=f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/",
        metadata={"order_id": oid, "type": "delivery_quote"})
    await db.payment_transactions.insert_one({
        "session_id": session.id, "order_id": oid, "order_ref": o["reference"],
        "amount": body.amount, "currency": "gbp", "type": "delivery_quote",
        "status": "initiated", "payment_status": "pending",
        "created_at": now_utc(), "updated_at": now_utc()})
    await db.orders.update_one({"_id": ObjectId(oid)}, {"$set": {"delivery_quote": {
        "amount": body.amount, "note": body.note, "checkout_url": session.url,
        "status": "awaiting_payment", "by": user["email"], "at": now_utc()}}})
    await log_audit(user, "delivery_quote", "order", oid, after={"amount": body.amount})
    return {"ok": True, "checkout_url": session.url}


class ImportBody(BaseModel):
    csv: str


@extra_router.post("/admin/redirects/import")
async def import_redirects(body: ImportBody, user=Depends(require_admin("content_admin"))):
    import csv as csvmod, io
    reader = csvmod.reader(io.StringIO(body.csv))
    count = 0
    for row in reader:
        if len(row) < 2:
            continue
        frm, to = row[0].strip(), row[1].strip()
        if not frm or not to or frm.lower() in ("from", "from_path"):
            continue
        code = int(row[2]) if len(row) > 2 and row[2].strip().isdigit() else 301
        await db.redirects.update_one({"from_path": frm},
            {"$set": {"from_path": frm, "to_path": to, "status_code": code}}, upsert=True)
        count += 1
    await log_audit(user, "import", "redirects", after={"imported": count})
    return {"ok": True, "imported": count}


# ---------- Product import / export ----------
PRODUCT_COLUMNS = ["name", "sku", "category_slug", "description", "condition",
                   "price_ex_vat", "vat_rate", "vat_relief_eligible", "quantity_available",
                   "weight_kg", "fulfilment_route", "stock_model", "delivery_charge",
                   "carbon_saving_kg", "dimensions", "max_user_weight", "safety_info",
                   "status", "featured", "image_urls"]


def _b(v):
    return str(v).strip().lower() in ("true", "yes", "1", "y")


def _csv_response(rows, filename):
    out = _io.StringIO()
    w = _csv.writer(out)
    w.writerow(PRODUCT_COLUMNS)
    for r in rows:
        w.writerow(r)
    return Response(content=out.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={filename}"})


@extra_router.get("/admin/product-template.csv")
async def product_template(user=Depends(require_admin("shop_admin", "product_contributor", "product_approver"))):
    example = ["Folding Wheelchair", "MOB-100", "mobility",
               "Lightweight folding wheelchair, serviced.", "Good, visible signs of previous use but fully functional.",
               "120.00", "0.20", "true", "1", "14", "hub_collection", "unique",
               "25", "40", "94 x 66 x 91 cm", "115 kg", "Brakes tested.", "draft", "false",
               "https://example.com/photo1.jpg|https://example.com/photo2.jpg"]
    return _csv_response([example], "grace-cares-product-template.csv")


@extra_router.get("/admin/products-export.csv")
async def product_export(user=Depends(require_admin("shop_admin", "product_approver"))):
    cats = {str(c["_id"]): c.get("slug", "") for c in await db.categories.find().to_list(200)}
    rows = []
    for p in await db.products.find().sort("created_at", -1).to_list(5000):
        rows.append([
            p.get("name", ""), p.get("sku", ""), cats.get(p.get("category_id"), ""),
            p.get("description", ""), p.get("condition", ""), p.get("price_ex_vat", 0),
            p.get("vat_rate", 0.2), p.get("vat_relief_eligible", False),
            p.get("quantity_available", 0), p.get("weight_kg", 0),
            p.get("fulfilment_route", "hub_collection"), p.get("stock_model", "unique"),
            p.get("delivery_charge", 0), p.get("carbon_saving_kg", 0), p.get("dimensions", ""),
            p.get("max_user_weight", ""), p.get("safety_info", ""), p.get("status", "available"),
            p.get("featured", False), "|".join(p.get("images", []))])
    return _csv_response(rows, "grace-cares-products.csv")


@extra_router.post("/admin/products/import")
async def product_import(body: ImportBody, user=Depends(require_admin("shop_admin", "product_approver"))):
    slug_to_id = {c.get("slug"): str(c["_id"]) for c in await db.categories.find().to_list(200)}
    reader = _csv.DictReader(_io.StringIO(body.csv))
    created, updated, errors = 0, 0, []
    contributor = user["role"] == "product_contributor"
    for i, row in enumerate(reader, start=2):
        sku = (row.get("sku") or "").strip()
        name = (row.get("name") or "").strip()
        if not sku or not name:
            errors.append(f"Row {i}: name and sku are required")
            continue
        try:
            fields = {
                "name": name, "sku": sku,
                "category_id": slug_to_id.get((row.get("category_slug") or "").strip()),
                "description": row.get("description", ""),
                "condition": row.get("condition", "Good"),
                "price_ex_vat": float(row.get("price_ex_vat") or 0),
                "vat_rate": float(row.get("vat_rate") or 0.2),
                "vat_relief_eligible": _b(row.get("vat_relief_eligible")),
                "quantity_available": int(float(row.get("quantity_available") or 0)),
                "weight_kg": float(row.get("weight_kg") or 0),
                "fulfilment_route": (row.get("fulfilment_route") or "hub_collection").strip(),
                "stock_model": (row.get("stock_model") or "unique").strip(),
                "delivery_charge": float(row.get("delivery_charge") or 0),
                "carbon_saving_kg": float(row.get("carbon_saving_kg") or 0),
                "dimensions": row.get("dimensions", ""),
                "max_user_weight": row.get("max_user_weight", ""),
                "safety_info": row.get("safety_info", ""),
                "featured": _b(row.get("featured")),
                "images": [u.strip() for u in (row.get("image_urls") or "").split("|") if u.strip()],
            }
            status = (row.get("status") or "").strip() or "available"
            if contributor:
                status = "draft"  # contributors can only import drafts
            fields["status"] = status
        except ValueError as e:
            errors.append(f"Row {i} ({sku}): invalid number — {e}")
            continue
        existing = await db.products.find_one({"sku": sku})
        if existing:
            await db.products.update_one({"_id": existing["_id"]}, {"$set": fields})
            updated += 1
        else:
            fields.update({"quantity_reserved": 0, "vat_rate": fields["vat_rate"],
                           "listing_type": "sale", "specifications": {}, "related_ids": [],
                           "fulfilment_options": ["collection", "delivery"], "created_at": now_utc()})
            res = await db.products.insert_one(fields)
            created += 1
            if status in ("draft", "awaiting_approval"):
                await notify_admins("new_listing", f"Imported listing '{name}' ({sku}) awaiting approval.", str(res.inserted_id))
    await log_audit(user, "import", "products", after={"created": created, "updated": updated})
    return {"ok": True, "created": created, "updated": updated, "errors": errors}
