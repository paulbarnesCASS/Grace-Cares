"""Admin: reporting, Xero sync queue (mocked), audit logs, user/role management, account."""
import io
import csv
import random
from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId

from core import db, now_utc, clean, cleans
from auth import get_current_user, require_admin, ADMIN_ROLES, hash_password

admin_router = APIRouter(prefix="/api")


# ---------------- Reporting ----------------
@admin_router.get("/admin/reports/summary")
async def report_summary(user=Depends(require_admin("finance_admin", "readonly", "shop_admin"))):
    orders = await db.orders.find({"payment_status": "paid"}).to_list(5000)
    total_ex = sum(o["totals"]["subtotal_ex_vat"] for o in orders)
    total_vat = sum(o["totals"]["vat_total"] for o in orders)
    total_sales = sum(o["totals"]["total_payable"] for o in orders)
    zero_rated = sum(o["totals"]["subtotal_ex_vat"] for o in orders
                     if any(l.get("vat_relief_applied") for l in o.get("items", [])))
    donations = await db.donations.find({"payment_status": "paid"}).to_list(5000)
    donation_total = sum(d["amount"] for d in donations)
    order_donations = sum(o.get("donation_amount", 0) for o in orders)
    refunds = sum(o.get("refund_amount", 0) for o in orders if o.get("refund_amount"))
    products = await db.products.find().to_list(5000)
    low_stock = [clean(p) for p in products
                 if (p.get("quantity_available", 0) - p.get("quantity_reserved", 0)) <= 1
                 and p.get("status") != "sold"]
    carbon = sum((p.get("carbon_saving_kg", 0) or 0) for p in products if p.get("status") == "sold")
    aov = round(total_sales / len(orders), 2) if orders else 0
    bookings = await db.event_bookings.count_documents({"status": "confirmed"})
    downloads = await db.resource_downloads.count_documents({})
    subs = await db.subscribers.count_documents({})
    eq_donations = await db.equipment_donations.count_documents({})
    items_saved = await db.products.count_documents({"status": "sold"})
    return {
        "total_sales_inc_vat": round(total_sales, 2),
        "total_sales_ex_vat": round(total_ex, 2),
        "total_vat": round(total_vat, 2),
        "zero_rated_sales": round(zero_rated, 2),
        "standard_rated_sales": round(total_ex - zero_rated, 2),
        "donations_total": round(donation_total + order_donations, 2),
        "standalone_donations": round(donation_total, 2),
        "order_donations": round(order_donations, 2),
        "refunds_total": round(refunds, 2),
        "average_order_value": aov,
        "orders_count": len(orders),
        "products_sold": items_saved,
        "low_stock_count": len(low_stock),
        "low_stock_products": low_stock[:20],
        "equipment_saved": items_saved,
        "estimated_carbon_saving_kg": round(carbon, 1),
        "equipment_donation_enquiries": eq_donations,
        "event_bookings": bookings,
        "resource_downloads": downloads,
        "email_signups": subs,
    }


@admin_router.get("/admin/reports/orders.csv")
async def orders_csv(user=Depends(require_admin("finance_admin", "readonly"))):
    orders = await db.orders.find().sort("created_at", -1).to_list(5000)
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["Reference", "Date", "Customer", "Status", "Ex VAT", "VAT", "Delivery",
                "Donation", "Total", "Xero Status"])
    for o in orders:
        t = o.get("totals", {})
        w.writerow([o.get("reference"), str(o.get("created_at")), o.get("customer", {}).get("name"),
                    o.get("status"), t.get("subtotal_ex_vat"), t.get("vat_total"),
                    t.get("delivery_total"), t.get("donation"), t.get("total_payable"),
                    o.get("xero_sync_status")])
    return Response(content=out.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=orders.csv"})


# ---------------- Xero sync (mocked) ----------------
@admin_router.get("/admin/xero/queue")
async def xero_queue(user=Depends(require_admin("finance_admin"))):
    items = await db.xero_sync_queue.find().sort("created_at", -1).to_list(500)
    queued = [i for i in items if i.get("status") == "queued"]
    synced = [i for i in items if i.get("status") == "synced"]
    failed = [i for i in items if i.get("status") == "failed"]
    return {"queued": cleans(queued), "synced": cleans(synced), "failed": cleans(failed),
            "counts": {"queued": len(queued), "synced": len(synced), "failed": len(failed)}}


@admin_router.post("/admin/xero/sync/{item_id}")
async def xero_sync_item(item_id: str, user=Depends(require_admin("finance_admin"))):
    item = await db.xero_sync_queue.find_one({"_id": ObjectId(item_id)})
    if not item:
        raise HTTPException(404, "Sync item not found")
    # MOCKED Xero posting: 85% success, idempotent (won't re-post already synced)
    if item.get("status") == "synced":
        return {"ok": True, "already_synced": True}
    attempts = item.get("attempts", 0) + 1
    success = random.random() < 0.85
    if success:
        await db.xero_sync_queue.update_one({"_id": ObjectId(item_id)},
            {"$set": {"status": "synced", "attempts": attempts, "synced_at": now_utc(),
                      "xero_id": f"XERO-{random.randint(10000,99999)}", "error": None}})
        _id = item.get("order_id") or item.get("donation_id")
        if item.get("order_id"):
            await db.orders.update_one({"_id": ObjectId(item["order_id"])},
                                       {"$set": {"xero_sync_status": "synced"}})
        return {"ok": True, "synced": True}
    else:
        await db.xero_sync_queue.update_one({"_id": ObjectId(item_id)},
            {"$set": {"status": "failed", "attempts": attempts,
                      "error": "Xero API temporarily unavailable (503). Retry queued."}})
        return {"ok": False, "failed": True, "error": "Xero temporarily unavailable"}


@admin_router.post("/admin/xero/sync-all")
async def xero_sync_all(user=Depends(require_admin("finance_admin"))):
    items = await db.xero_sync_queue.find({"status": {"$in": ["queued", "failed"]}}).to_list(500)
    results = {"synced": 0, "failed": 0}
    for item in items:
        r = await xero_sync_item(str(item["_id"]), user)
        if r.get("synced"):
            results["synced"] += 1
        else:
            results["failed"] += 1
    return results


@admin_router.get("/admin/xero/reconciliation")
async def reconciliation(user=Depends(require_admin("finance_admin"))):
    orders = await db.orders.find({"payment_status": "paid"}).to_list(5000)
    website_total = sum(o["totals"]["total_payable"] for o in orders)
    synced = await db.xero_sync_queue.find({"status": "synced"}).to_list(5000)
    xero_total = sum(i.get("amount", 0) for i in synced)
    return {"website_total": round(website_total, 2), "xero_total": round(xero_total, 2),
            "difference": round(website_total - xero_total, 2),
            "stripe_total": round(website_total, 2)}


# ---------------- Audit logs ----------------
@admin_router.get("/admin/audit-logs")
async def audit_logs(user=Depends(require_admin("super_admin"))):
    docs = await db.audit_logs.find().sort("at", -1).to_list(500)
    return cleans(docs)


# ---------------- VAT declarations (restricted) ----------------
def _parse_range(date_from, date_to):
    from datetime import datetime as _dt, timezone as _tz
    q = {}
    if date_from:
        q["$gte"] = _dt.fromisoformat(date_from).replace(tzinfo=_tz.utc)
    if date_to:
        q["$lte"] = _dt.fromisoformat(date_to).replace(hour=23, minute=59, second=59, tzinfo=_tz.utc)
    return {"created_at": q} if q else {}


RELIEF_RATE = 0.20  # standard VAT rate that would otherwise apply to relieved items


def _order_relief(order):
    """VAT that would have been charged on relieved lines = the relief granted."""
    relieved = 0.0
    for it in (order or {}).get("items", []):
        if it.get("vat_relief_applied"):
            relieved += round((it.get("line_ex_vat", 0) or 0) * RELIEF_RATE, 2)
    return round(relieved, 2)


async def _orders_by_ref(refs):
    refs = [r for r in refs if r]
    docs = await db.orders.find({"reference": {"$in": refs}}).to_list(len(refs) or 1)
    return {o["reference"]: o for o in docs}


@admin_router.get("/admin/vat-declarations")
async def vat_declarations(date_from: Optional[str] = None, date_to: Optional[str] = None,
                           user=Depends(require_admin("finance_admin"))):
    query = _parse_range(date_from, date_to)
    docs = await db.vat_declarations.find(query).sort("created_at", -1).to_list(2000)
    omap = await _orders_by_ref([d.get("order_reference") for d in docs])
    out = []
    for d in docs:
        c = clean(d)
        o = omap.get(d.get("order_reference"))
        c["total_vat_relieved"] = _order_relief(o)
        c["order_total_paid"] = (o or {}).get("totals", {}).get("total_payable")
        out.append(c)
    return out


@admin_router.get("/admin/vat-declarations/{did}")
async def vat_declaration_detail(did: str, user=Depends(require_admin("finance_admin"))):
    d = await db.vat_declarations.find_one({"_id": ObjectId(did)})
    if not d:
        raise HTTPException(404, "Declaration not found")
    o = await db.orders.find_one({"reference": d.get("order_reference")})
    c = clean(d)
    c["total_vat_relieved"] = _order_relief(o)
    c["order_total_paid"] = (o or {}).get("totals", {}).get("total_payable")
    c["relieved_items"] = [
        {"name": it.get("name"), "sku": it.get("sku"), "quantity": it.get("quantity"),
         "line_ex_vat": it.get("line_ex_vat"),
         "vat_relieved": round((it.get("line_ex_vat", 0) or 0) * RELIEF_RATE, 2)}
        for it in (o or {}).get("items", []) if it.get("vat_relief_applied")
    ]
    return c


VAT_EXPORT_COLUMNS = ["created_at", "order_reference", "customer_email", "eligible_person_name",
                      "eligible_person_address", "condition_description", "for_personal_domestic_use",
                      "completed_by_name", "relationship", "info_accurate", "signature",
                      "order_total_paid", "total_vat_relieved"]


@admin_router.get("/admin/vat-declarations-export.csv")
async def vat_declarations_export(date_from: Optional[str] = None, date_to: Optional[str] = None,
                                  user=Depends(require_admin("finance_admin"))):
    query = _parse_range(date_from, date_to)
    docs = await db.vat_declarations.find(query).sort("created_at", -1).to_list(5000)
    omap = await _orders_by_ref([d.get("order_reference") for d in docs])
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(VAT_EXPORT_COLUMNS)
    for d in docs:
        ca = d.get("created_at")
        o = omap.get(d.get("order_reference"))
        w.writerow([ca.isoformat() if hasattr(ca, "isoformat") else (ca or ""),
                    d.get("order_reference", ""), d.get("customer_email", ""),
                    d.get("eligible_person_name", ""), d.get("eligible_person_address", ""),
                    d.get("condition_description", ""), d.get("for_personal_domestic_use", ""),
                    d.get("completed_by_name", ""), d.get("relationship", ""),
                    d.get("info_accurate", ""), d.get("signature", ""),
                    (o or {}).get("totals", {}).get("total_payable", ""), _order_relief(o)])
    fn = "vat-declarations"
    if date_from or date_to:
        fn += f"_{date_from or 'start'}_to_{date_to or 'now'}"
    return Response(content=out.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={fn}.csv"})


class ReportViewBody(BaseModel):
    preset: str = "all"
    date_from: Optional[str] = None
    date_to: Optional[str] = None


@admin_router.get("/admin/vat-report-view")
async def get_report_view(user=Depends(require_admin("finance_admin"))):
    s = await db.site_settings.find_one({"key": "vat_report_view"})
    return (s or {}).get("view", {"preset": "all", "date_from": None, "date_to": None})


@admin_router.put("/admin/vat-report-view")
async def set_report_view(body: ReportViewBody, user=Depends(require_admin("finance_admin"))):
    await db.site_settings.update_one({"key": "vat_report_view"},
        {"$set": {"key": "vat_report_view", "view": body.model_dump()}}, upsert=True)
    return {"ok": True, "view": body.model_dump()}


class VatStatementBody(BaseModel):
    statement: dict


@admin_router.get("/admin/vat-declaration-statement")
async def get_vat_statement_admin(user=Depends(require_admin("finance_admin", "content_admin"))):
    from shop import get_vat_statement
    return await get_vat_statement()


@admin_router.put("/admin/vat-declaration-statement")
async def set_vat_statement_admin(body: VatStatementBody, user=Depends(require_admin("finance_admin", "content_admin"))):
    from shop import log_audit, DEFAULT_VAT_STATEMENT
    stmt = {k: body.statement.get(k, DEFAULT_VAT_STATEMENT[k]) for k in DEFAULT_VAT_STATEMENT}
    await db.site_settings.update_one({"key": "vat_declaration"},
        {"$set": {"key": "vat_declaration", "statement": stmt}}, upsert=True)
    await log_audit(user, "update", "vat_declaration_statement", after=stmt)
    return {"ok": True, "statement": stmt}


# ---------------- User / role management ----------------
class RoleBody(BaseModel):
    role: str


@admin_router.get("/admin/users")
async def list_users(user=Depends(require_admin("super_admin"))):
    docs = await db.users.find().sort("created_at", -1).to_list(1000)
    out = []
    for d in docs:
        c = clean(d); c.pop("password_hash", None)
        out.append(c)
    return out


@admin_router.put("/admin/users/{uid}/role")
async def set_role(uid: str, body: RoleBody, user=Depends(require_admin("super_admin"))):
    if body.role != "customer" and body.role not in ADMIN_ROLES:
        raise HTTPException(400, "Invalid role")
    before = await db.users.find_one({"_id": ObjectId(uid)})
    await db.users.update_one({"_id": ObjectId(uid)}, {"$set": {"role": body.role}})
    await db.audit_logs.insert_one({"user_email": user["email"], "action": "set_role",
        "entity": "user", "entity_id": uid, "before": {"role": before.get("role")},
        "after": {"role": body.role}, "at": now_utc()})
    return {"ok": True}


# ---------------- Customer account ----------------
class AddressBody(BaseModel):
    label: str
    line1: str
    line2: Optional[str] = ""
    city: str
    postcode: str


@admin_router.get("/account/addresses")
async def get_addresses(user=Depends(get_current_user)):
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    return u.get("addresses", [])


@admin_router.post("/account/addresses")
async def add_address(body: AddressBody, user=Depends(get_current_user)):
    await db.users.update_one({"_id": ObjectId(user["id"])},
                              {"$push": {"addresses": body.model_dump()}})
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    return u.get("addresses", [])


class PrefsBody(BaseModel):
    marketing_consent: bool


@admin_router.put("/account/preferences")
async def update_prefs(body: PrefsBody, user=Depends(get_current_user)):
    await db.users.update_one({"_id": ObjectId(user["id"])},
                              {"$set": {"marketing_consent": body.marketing_consent}})
    return {"ok": True}


@admin_router.get("/account/bookings")
async def my_bookings(user=Depends(get_current_user)):
    docs = await db.event_bookings.find({"email": user["email"]}).sort("created_at", -1).to_list(200)
    return cleans(docs)


@admin_router.post("/account/request-deletion")
async def request_deletion(user=Depends(get_current_user)):
    await db.deletion_requests.insert_one({"user_id": user["id"], "email": user["email"],
                                           "status": "requested", "at": now_utc()})
    return {"ok": True, "message": "Your account deletion request has been received."}
