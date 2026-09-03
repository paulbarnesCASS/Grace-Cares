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
@admin_router.get("/admin/vat-declarations")
async def vat_declarations(user=Depends(require_admin("finance_admin"))):
    docs = await db.vat_declarations.find().sort("created_at", -1).to_list(500)
    return cleans(docs)


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
