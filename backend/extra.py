"""v3 extras: product approve/draft workflow, fulfilment info, Grace AI stub,
sitemap.xml, robots.txt, and 301 redirect manager."""
import os
from fastapi import APIRouter, HTTPException, Depends, Response, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId

from core import db, now_utc, clean, cleans
from auth import require_admin
from shop import log_audit

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
