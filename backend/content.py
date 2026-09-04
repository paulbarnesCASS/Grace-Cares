"""Content: donations, equipment donations, events, resources, news, impact, enquiries, newsletter."""
import os
import stripe
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from bson import ObjectId

from core import db, now_utc, clean, cleans
from auth import get_current_user, get_optional_user, require_admin
from shop import gen_ref, log_audit, upsert_subscriber
from emails import send_donation_thank_you

content_router = APIRouter(prefix="/api")


# ---------------- Financial donations ----------------
class DonationBody(BaseModel):
    amount: float = Field(gt=0)
    recurring: bool = False
    name: str
    email: str
    message: Optional[str] = ""
    dedication: Optional[str] = ""
    marketing_consent: bool = False
    origin_url: str


@content_router.post("/donations")
async def create_donation(body: DonationBody):
    ref = gen_ref("GD")
    doc = {"reference": ref, "amount": body.amount, "recurring": body.recurring,
           "name": body.name, "email": body.email, "message": body.message,
           "dedication": body.dedication, "status": "pending", "payment_status": "pending",
           "xero_sync_status": "not_synced", "created_at": now_utc()}
    res = await db.donations.insert_one(doc)
    did = str(res.inserted_id)
    if body.marketing_consent:
        await upsert_subscriber(body.email, body.name, "donation", ["donors"])
    amount_cents = int(round(body.amount * 100))
    price_data = {"currency": "gbp", "product_data": {"name": f"Donation to Grace Cares {ref}"},
                  "unit_amount": amount_cents}
    kwargs = dict(
        mode="subscription" if body.recurring else "payment",
        success_url=f"{body.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{body.origin_url}/donate-funds",
        metadata={"donation_id": did, "type": "donation"},
    )
    if body.recurring:
        price_data["recurring"] = {"interval": "month"}
    kwargs["line_items"] = [{"price_data": price_data, "quantity": 1}]
    try:
        session = stripe.checkout.Session.create(**kwargs)
    except Exception as e:
        raise HTTPException(500, f"Payment could not be started: {e}")
    await db.payment_transactions.insert_one({
        "session_id": session.id, "donation_id": did, "order_ref": ref,
        "amount": body.amount, "currency": "gbp", "type": "donation",
        "status": "initiated", "payment_status": "pending",
        "created_at": now_utc(), "updated_at": now_utc()})
    await db.donations.update_one({"_id": res.inserted_id}, {"$set": {"stripe_session_id": session.id}})
    return {"checkout_url": session.url, "session_id": session.id, "reference": ref}


async def _finalize_donation(donation_id, pi):
    d = await db.donations.find_one({"_id": ObjectId(donation_id)})
    if not d or d.get("payment_status") == "paid":
        return
    await db.donations.update_one({"_id": ObjectId(donation_id)},
        {"$set": {"status": "completed", "payment_status": "paid",
                  "stripe_payment_intent": pi, "paid_at": now_utc(), "xero_sync_status": "queued"}})
    await db.xero_sync_queue.insert_one({
        "donation_id": donation_id, "order_ref": d["reference"], "type": "donation",
        "amount": d["amount"], "status": "queued", "attempts": 0, "created_at": now_utc()})
    try:
        fresh = await db.donations.find_one({"_id": ObjectId(donation_id)})
        await send_donation_thank_you(fresh)
        await db.donations.update_one({"_id": ObjectId(donation_id)}, {"$set": {"thank_you_emailed_at": now_utc()}})
    except Exception as e:
        print(f"[EMAIL] donation thank-you failed for {d.get('reference')}: {e}")


@content_router.post("/admin/donations/{did}/thank-you")
async def resend_donation_thank_you(did: str, user=Depends(require_admin("finance_admin"))):
    d = await db.donations.find_one({"_id": ObjectId(did)})
    if not d:
        raise HTTPException(404, "Donation not found")
    email_id = await send_donation_thank_you(d)
    if not email_id:
        raise HTTPException(400, "No donor email is stored on this donation")
    await db.donations.update_one({"_id": ObjectId(did)}, {"$set": {"thank_you_emailed_at": now_utc()}})
    return {"ok": True, "email_id": email_id, "sent_to": d.get("email")}


@content_router.get("/admin/donations")
async def list_donations(date_from: Optional[str] = None, date_to: Optional[str] = None,
                         user=Depends(require_admin("finance_admin"))):
    from datetime import datetime as _dt, timezone as _tz
    q = {}
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = _dt.fromisoformat(date_from).replace(tzinfo=_tz.utc)
        if date_to:
            rng["$lte"] = _dt.fromisoformat(date_to).replace(hour=23, minute=59, second=59, tzinfo=_tz.utc)
        q["created_at"] = rng
    docs = await db.donations.find(q).sort("created_at", -1).to_list(2000)
    return cleans(docs)


# ---------------- Equipment donation form ----------------
class EquipmentDonationBody(BaseModel):
    donor_name: str
    email: str
    phone: str
    location: str
    postcode: str
    equipment_type: str
    manufacturer: Optional[str] = ""
    model: Optional[str] = ""
    approx_age: Optional[str] = ""
    condition: str
    working: bool = True
    fire_labels: Optional[str] = ""
    photos: List[str] = []
    dimensions: Optional[str] = ""
    collection_preference: str = "collection"
    accessibility_info: Optional[str] = ""
    notes: Optional[str] = ""
    privacy_consent: bool


@content_router.post("/equipment-donations")
async def submit_equipment_donation(body: EquipmentDonationBody):
    if not body.privacy_consent:
        raise HTTPException(400, "Privacy consent is required")
    doc = body.model_dump()
    doc.update({"reference": gen_ref("ED"), "status": "new", "assigned_to": None,
                "internal_notes": [], "created_at": now_utc()})
    res = await db.equipment_donations.insert_one(doc)
    return {"ok": True, "reference": doc["reference"], "id": str(res.inserted_id)}


@content_router.get("/admin/equipment-donations")
async def list_equipment_donations(status: Optional[str] = None, user=Depends(require_admin("shop_admin", "support_admin"))):
    q = {"status": status} if status else {}
    docs = await db.equipment_donations.find(q).sort("created_at", -1).to_list(500)
    return cleans(docs)


class EDUpdateBody(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    note: Optional[str] = None
    listed_product_id: Optional[str] = None
    listed_product_sku: Optional[str] = None


@content_router.put("/admin/equipment-donations/{did}")
async def update_equipment_donation(did: str, body: EDUpdateBody, user=Depends(require_admin("shop_admin", "support_admin"))):
    upd = {}
    if body.status:
        upd["status"] = body.status
    if body.assigned_to is not None:
        upd["assigned_to"] = body.assigned_to
    if body.listed_product_id is not None:
        upd["listed_product_id"] = body.listed_product_id
        upd["listed_product_sku"] = body.listed_product_sku
    ops = {"$set": upd} if upd else {}
    if body.note:
        ops["$push"] = {"internal_notes": {"note": body.note, "by": user["email"], "at": now_utc()}}
    if ops:
        await db.equipment_donations.update_one({"_id": ObjectId(did)}, ops)
    await log_audit(user, "update", "equipment_donation", did, after=upd)
    return {"ok": True}


# ---------------- Events + bookings ----------------
class EventBody(BaseModel):
    name: str
    slug: str
    image: Optional[str] = ""
    description: str = ""
    start_at: str
    end_at: Optional[str] = ""
    venue: Optional[str] = ""
    online_link: Optional[str] = ""  # private, never returned publicly
    accessibility_info: Optional[str] = ""
    capacity: int = 20
    is_paid: bool = False
    price: float = 0
    booking_opens: Optional[str] = ""
    booking_closes: Optional[str] = ""
    cancelled: bool = False
    contact: Optional[str] = ""
    published: bool = True


def public_event(e: dict) -> dict:
    e = clean(e)
    e.pop("online_link", None)
    return e


@content_router.get("/events")
async def list_events(upcoming: bool = True):
    q = {"published": True}
    docs = await db.events.find(q).sort("start_at", 1).to_list(200)
    out = []
    for e in docs:
        pe = public_event(e)
        booked = await db.event_bookings.count_documents({"event_id": str(e["_id"]), "status": "confirmed"})
        pe["booked_count"] = booked
        pe["spots_left"] = max(0, e.get("capacity", 0) - booked)
        out.append(pe)
    return out


@content_router.get("/events/{slug}")
async def get_event(slug: str):
    e = await db.events.find_one({"slug": slug}) or (await db.events.find_one({"_id": ObjectId(slug)}) if len(slug) == 24 else None)
    if not e:
        raise HTTPException(404, "Event not found")
    pe = public_event(e)
    booked = await db.event_bookings.count_documents({"event_id": str(e["_id"]), "status": "confirmed"})
    pe["booked_count"] = booked
    pe["spots_left"] = max(0, e.get("capacity", 0) - booked)
    return pe


@content_router.post("/events")
async def create_event(body: EventBody, user=Depends(require_admin("events_admin"))):
    doc = body.model_dump(); doc["created_at"] = now_utc()
    res = await db.events.insert_one(doc)
    await log_audit(user, "create", "event", str(res.inserted_id), after={"name": body.name})
    return clean(await db.events.find_one({"_id": res.inserted_id}))


@content_router.put("/events/{eid}")
async def update_event(eid: str, body: EventBody, user=Depends(require_admin("events_admin"))):
    await db.events.update_one({"_id": ObjectId(eid)}, {"$set": body.model_dump()})
    await log_audit(user, "update", "event", eid)
    return clean(await db.events.find_one({"_id": ObjectId(eid)}))


@content_router.delete("/events/{eid}")
async def delete_event(eid: str, user=Depends(require_admin("events_admin"))):
    await db.events.delete_one({"_id": ObjectId(eid)})
    return {"ok": True}


class BookingBody(BaseModel):
    event_id: str
    name: str
    email: str
    phone: Optional[str] = ""
    num_attendees: int = 1
    answers: Optional[dict] = {}
    origin_url: Optional[str] = ""


@content_router.post("/bookings")
async def create_booking(body: BookingBody):
    e = await db.events.find_one({"_id": ObjectId(body.event_id)})
    if not e:
        raise HTTPException(404, "Event not found")
    if e.get("cancelled"):
        raise HTTPException(400, "This event has been cancelled")
    booked = await db.event_bookings.count_documents({"event_id": body.event_id, "status": "confirmed"})
    spots_left = e.get("capacity", 0) - booked
    ref = gen_ref("EB")
    if spots_left < body.num_attendees:
        # waiting list
        doc = {"reference": ref, "event_id": body.event_id, "event_name": e["name"],
               "name": body.name, "email": body.email, "phone": body.phone,
               "num_attendees": body.num_attendees, "answers": body.answers,
               "status": "waiting_list", "checked_in": False, "created_at": now_utc()}
        await db.event_bookings.insert_one(doc)
        return {"ok": True, "waiting_list": True, "reference": ref}

    if e.get("is_paid") and e.get("price", 0) > 0:
        doc = {"reference": ref, "event_id": body.event_id, "event_name": e["name"],
               "name": body.name, "email": body.email, "phone": body.phone,
               "num_attendees": body.num_attendees, "answers": body.answers,
               "status": "pending_payment", "payment_status": "pending",
               "checked_in": False, "created_at": now_utc()}
        res = await db.event_bookings.insert_one(doc)
        bid = str(res.inserted_id)
        amount_cents = int(round(e["price"] * body.num_attendees * 100))
        session = stripe.checkout.Session.create(
            line_items=[{"price_data": {"currency": "gbp",
                         "product_data": {"name": f"{e['name']} booking {ref}"},
                         "unit_amount": amount_cents}, "quantity": 1}],
            mode="payment",
            success_url=f"{body.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{body.origin_url}/events",
            metadata={"booking_id": bid, "type": "event"})
        await db.payment_transactions.insert_one({
            "session_id": session.id, "booking_id": bid, "order_ref": ref,
            "amount": e["price"] * body.num_attendees, "currency": "gbp", "type": "event",
            "status": "initiated", "payment_status": "pending",
            "created_at": now_utc(), "updated_at": now_utc()})
        return {"ok": True, "checkout_url": session.url, "session_id": session.id, "reference": ref}

    # free event
    doc = {"reference": ref, "event_id": body.event_id, "event_name": e["name"],
           "name": body.name, "email": body.email, "phone": body.phone,
           "num_attendees": body.num_attendees, "answers": body.answers,
           "status": "confirmed", "payment_status": "free", "checked_in": False,
           "created_at": now_utc()}
    await db.event_bookings.insert_one(doc)
    return {"ok": True, "confirmed": True, "reference": ref,
            "online_link_sent": bool(e.get("online_link"))}


async def _finalize_event_booking(booking_id, pi):
    b = await db.event_bookings.find_one({"_id": ObjectId(booking_id)})
    if not b or b.get("status") == "confirmed":
        return
    await db.event_bookings.update_one({"_id": ObjectId(booking_id)},
        {"$set": {"status": "confirmed", "payment_status": "paid",
                  "stripe_payment_intent": pi, "paid_at": now_utc()}})


@content_router.get("/admin/bookings")
async def admin_bookings(event_id: Optional[str] = None, user=Depends(require_admin("events_admin"))):
    q = {"event_id": event_id} if event_id else {}
    docs = await db.event_bookings.find(q).sort("created_at", -1).to_list(500)
    return cleans(docs)


@content_router.put("/admin/bookings/{bid}/checkin")
async def checkin_booking(bid: str, user=Depends(require_admin("events_admin"))):
    await db.event_bookings.update_one({"_id": ObjectId(bid)}, {"$set": {"checked_in": True}})
    return {"ok": True}


# ---------------- Resources ----------------
class ResourceBody(BaseModel):
    title: str
    slug: str
    description: str = ""
    category: str = "General"
    file_url: Optional[str] = ""
    image: Optional[str] = ""
    is_paid: bool = False
    price: float = 0
    gated: bool = False  # requires email to download
    published: bool = True


@content_router.get("/resources")
async def list_resources(category: Optional[str] = None, q: Optional[str] = None):
    query = {"published": True}
    if category:
        query["category"] = category
    if q:
        query["$or"] = [{"title": {"$regex": q, "$options": "i"}},
                        {"description": {"$regex": q, "$options": "i"}}]
    docs = await db.resources.find(query).sort("created_at", -1).to_list(200)
    out = []
    for d in docs:
        c = clean(d)
        if c.get("gated"):
            c.pop("file_url", None)
        out.append(c)
    return out


class DownloadBody(BaseModel):
    email: Optional[str] = ""
    name: Optional[str] = ""
    marketing_consent: bool = False


@content_router.post("/resources/{rid}/download")
async def download_resource(rid: str, body: DownloadBody):
    r = await db.resources.find_one({"_id": ObjectId(rid)})
    if not r:
        raise HTTPException(404, "Resource not found")
    if r.get("gated") and not body.email:
        raise HTTPException(400, "Email required to access this resource")
    await db.resource_downloads.insert_one({"resource_id": rid, "email": body.email,
                                            "at": now_utc()})
    await db.resources.update_one({"_id": ObjectId(rid)}, {"$inc": {"download_count": 1}})
    if body.marketing_consent and body.email:
        await upsert_subscriber(body.email, body.name or "", "resource_download", ["resources"])
    return {"file_url": r.get("file_url"), "title": r.get("title")}


@content_router.post("/resources")
async def create_resource(body: ResourceBody, user=Depends(require_admin("content_admin"))):
    doc = body.model_dump(); doc["download_count"] = 0; doc["created_at"] = now_utc()
    res = await db.resources.insert_one(doc)
    return clean(await db.resources.find_one({"_id": res.inserted_id}))


@content_router.put("/resources/{rid}")
async def update_resource(rid: str, body: ResourceBody, user=Depends(require_admin("content_admin"))):
    await db.resources.update_one({"_id": ObjectId(rid)}, {"$set": body.model_dump()})
    return clean(await db.resources.find_one({"_id": ObjectId(rid)}))


@content_router.delete("/resources/{rid}")
async def delete_resource(rid: str, user=Depends(require_admin("content_admin"))):
    await db.resources.delete_one({"_id": ObjectId(rid)})
    return {"ok": True}


# ---------------- News / Impact articles ----------------
class ArticleBody(BaseModel):
    title: str
    slug: str
    author: Optional[str] = "Grace Cares"
    category: str = "News"  # News or Impact
    featured_image: Optional[str] = ""
    excerpt: Optional[str] = ""
    content: str = ""
    related_ids: List[str] = []
    seo_title: Optional[str] = ""
    seo_description: Optional[str] = ""
    social_image: Optional[str] = ""
    status: str = "published"  # draft, scheduled, published
    publish_at: Optional[str] = ""
    # impact story fields
    is_impact: bool = False
    impact_problem: Optional[str] = ""
    impact_action: Optional[str] = ""
    impact_beneficiaries: Optional[str] = ""
    impact_environmental: Optional[str] = ""
    impact_social: Optional[str] = ""
    impact_partners: Optional[str] = ""
    impact_outcomes: Optional[str] = ""


@content_router.get("/articles")
async def list_articles(category: Optional[str] = None, is_impact: Optional[bool] = None):
    q = {"status": "published"}
    if category:
        q["category"] = category
    if is_impact is not None:
        q["is_impact"] = is_impact
    docs = await db.articles.find(q).sort("created_at", -1).to_list(200)
    return cleans(docs)


@content_router.get("/articles/{slug}")
async def get_article(slug: str):
    a = await db.articles.find_one({"slug": slug})
    if not a:
        raise HTTPException(404, "Article not found")
    return clean(a)


@content_router.post("/articles")
async def create_article(body: ArticleBody, user=Depends(require_admin("content_admin"))):
    doc = body.model_dump(); doc["created_at"] = now_utc()
    res = await db.articles.insert_one(doc)
    return clean(await db.articles.find_one({"_id": res.inserted_id}))


@content_router.put("/articles/{aid}")
async def update_article(aid: str, body: ArticleBody, user=Depends(require_admin("content_admin"))):
    await db.articles.update_one({"_id": ObjectId(aid)}, {"$set": body.model_dump()})
    return clean(await db.articles.find_one({"_id": ObjectId(aid)}))


@content_router.delete("/articles/{aid}")
async def delete_article(aid: str, user=Depends(require_admin("content_admin"))):
    await db.articles.delete_one({"_id": ObjectId(aid)})
    return {"ok": True}


# ---------------- Enquiries / support ----------------
ENQUIRY_ROUTING = {
    "caregiver_support": "support@grace-cares.com",
    "older_person_support": "support@grace-cares.com",
    "hardship_grant": "grants@grace-cares.com",
    "activities": "events@grace-cares.com",
    "general": "hello@grace-cares.com",
    "nhs": "nhs@grace-cares.com",
    "care_provider": "sustainability@grace-cares.com",
    "corporate": "partnerships@grace-cares.com",
    "volunteering": "volunteer@grace-cares.com",
    "fundraising": "fundraising@grace-cares.com",
    "other": "hello@grace-cares.com",
}
SENSITIVE_ENQUIRY_TYPES = {"caregiver_support", "older_person_support", "hardship_grant"}


class EnquiryBody(BaseModel):
    enquiry_type: str
    name: str
    email: str
    phone: Optional[str] = ""
    message: str
    consent: bool = False


@content_router.post("/enquiries")
async def submit_enquiry(body: EnquiryBody):
    routed = ENQUIRY_ROUTING.get(body.enquiry_type, ENQUIRY_ROUTING["other"])
    doc = body.model_dump()
    doc.update({"reference": gen_ref("EN"), "routed_to": routed, "status": "new",
                "sensitive": body.enquiry_type in SENSITIVE_ENQUIRY_TYPES,
                "created_at": now_utc()})
    await db.enquiries.insert_one(doc)
    return {"ok": True, "reference": doc["reference"], "routed_to": routed}


@content_router.get("/admin/enquiries")
async def list_enquiries(user=Depends(get_current_user)):
    is_admin = user["role"] != "customer"
    if not is_admin:
        raise HTTPException(403, "Admin only")
    # non-sensitive-cleared roles only see non-sensitive enquiries
    from auth import SENSITIVE_ROLES
    if user["role"] in SENSITIVE_ROLES:
        docs = await db.enquiries.find().sort("created_at", -1).to_list(500)
    else:
        docs = await db.enquiries.find({"sensitive": {"$ne": True}}).sort("created_at", -1).to_list(500)
    return cleans(docs)


# ---------------- Newsletter ----------------
class NewsletterBody(BaseModel):
    email: str
    name: Optional[str] = ""
    consent: bool = True


@content_router.post("/newsletter")
async def newsletter_signup(body: NewsletterBody):
    if not body.consent:
        raise HTTPException(400, "Please tick the consent box to subscribe")
    await upsert_subscriber(body.email, body.name or "", "newsletter", ["newsletter"])
    return {"ok": True}


@content_router.get("/admin/subscribers")
async def list_subscribers(user=Depends(require_admin("content_admin"))):
    docs = await db.subscribers.find().sort("created_at", -1).to_list(1000)
    return cleans(docs)


# ---------------- Homepage content, impact stats, partners, testimonials ----------------
@content_router.get("/homepage")
async def get_homepage():
    stats = await db.impact_stats.find().sort("order", 1).to_list(20)
    partners = await db.partners.find().sort("order", 1).to_list(50)
    testimonials = await db.testimonials.find().sort("order", 1).to_list(20)
    settings = await db.site_settings.find_one({"key": "homepage"}) or {}
    return {"impact_stats": cleans(stats), "partners": cleans(partners),
            "testimonials": cleans(testimonials), "settings": clean(settings)}


class ImpactStatBody(BaseModel):
    label: str
    value: str
    order: int = 0


@content_router.post("/admin/impact-stats")
async def create_stat(body: ImpactStatBody, user=Depends(require_admin("content_admin"))):
    doc = body.model_dump()
    res = await db.impact_stats.insert_one(doc)
    return clean(await db.impact_stats.find_one({"_id": res.inserted_id}))


@content_router.put("/admin/impact-stats/{sid}")
async def update_stat(sid: str, body: ImpactStatBody, user=Depends(require_admin("content_admin"))):
    await db.impact_stats.update_one({"_id": ObjectId(sid)}, {"$set": body.model_dump()})
    return clean(await db.impact_stats.find_one({"_id": ObjectId(sid)}))


@content_router.delete("/admin/impact-stats/{sid}")
async def delete_stat(sid: str, user=Depends(require_admin("content_admin"))):
    await db.impact_stats.delete_one({"_id": ObjectId(sid)})
    return {"ok": True}
