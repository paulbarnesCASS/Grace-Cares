"""Shared transactional email (Emergent-managed Resend): gate, sender, and templates.

Guardrails from the Resend playbook are enforced in _assert_safe_email — do not weaken.
Recipients always come from server-side order records (G4); bodies are fixed templates.
"""
import os
import re
import ipaddress
import logging
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from core import db  # noqa: F401  (kept for future template lookups)

logger = logging.getLogger("grace_cares")

SITE = os.environ.get("FRONTEND_URL", "https://grace-cares.com").rstrip("/")
BRAND = "#006738"

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Grace Cares")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

HUB = "our Lichfield hub"


# ---------------- Guardrail gate (do not weaken / wrap in try-except) ----------------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                     headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(502, "Failed to send email")
    except Exception as e:
        logger.error(f"Email send error: {e}")
        raise HTTPException(500, "Failed to send email")


# ---------------- Templates ----------------
def _gbp(v):
    return f"£{float(v or 0):,.2f}"


def _shell(inner: str) -> str:
    return ('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            'style="font-family:Arial,Helvetica,sans-serif;color:#1A1A1D"><tr><td style="padding:24px">'
            f'<h1 style="color:{BRAND};font-size:22px;margin:0 0 4px">Grace Cares</h1>'
            + inner +
            '<p style="font-size:12px;color:#888;margin-top:24px;line-height:18px">Sent by Grace Cares CIC, '
            'Lichfield. We never ask for your password or card details by email. Questions? Call 01543 730189 '
            'or email hello@grace-cares.com.</p></td></tr></table>')


_FULFIL = {
    "postable": "We'll post your order to you.",
    "hub_collection": f"You can collect your order from {HUB}.",
    "collection": f"You can collect your order from {HUB}.",
    "bulky_delivery": "As this is a bulky item, we'll be in touch to arrange delivery and any charge.",
    "delivery": "We'll arrange delivery of your order.",
}


async def send_order_confirmation(order: dict) -> str | None:
    to = (order or {}).get("customer", {}).get("email", "").strip()
    if not to:
        return None
    ref = escape(order.get("reference", ""))
    name = escape(order.get("customer", {}).get("name") or "there")
    tot = order.get("totals", {})
    rows = ""
    for it in order.get("items", []):
        rows += (f'<tr><td style="padding:6px 8px;border-bottom:1px solid #E4EAE6">{escape(str(it.get("name","")))}'
                 f'{" (VAT relief applied)" if it.get("vat_relief_applied") else ""}</td>'
                 f'<td style="padding:6px 8px;border-bottom:1px solid #E4EAE6;text-align:center">{it.get("quantity",1)}</td>'
                 f'<td style="padding:6px 8px;border-bottom:1px solid #E4EAE6;text-align:right">{_gbp(it.get("line_total"))}</td></tr>')
    fulfil = _FULFIL.get(order.get("fulfilment", ""), "")
    inner = (
        '<p style="font-size:13px;color:#4A4A4D;margin:0 0 16px">Your order is confirmed</p>'
        f'<p style="font-size:15px">Hello {name}, thank you for your order and for supporting Grace Cares.</p>'
        f'<p style="font-size:15px">Order reference: <strong>{ref}</strong></p>'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:14px 0">'
        '<tr style="background:#F3F7F4"><th style="padding:8px;text-align:left;font-size:13px">Item</th>'
        '<th style="padding:8px;text-align:center;font-size:13px">Qty</th>'
        '<th style="padding:8px;text-align:right;font-size:13px">Total</th></tr>'
        f'{rows}'
        f'<tr><td style="padding:8px;font-weight:bold">Total paid</td><td></td>'
        f'<td style="padding:8px;text-align:right;font-weight:bold;color:{BRAND}">{_gbp(tot.get("total_payable"))}</td></tr>'
        '</table>'
        f'<p style="font-size:14px;color:#2D2D30">{escape(fulfil)}</p>'
        f'<p style="margin:18px 0"><a href="{SITE}/shop" style="background:{BRAND};color:#ffffff;'
        'text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:bold;font-size:14px;'
        'display:inline-block">Browse more at Grace Cares</a></p>'
    )
    return await send_email(to=to, subject=f"Your Grace Cares order {order.get('reference','')} is confirmed",
                            html=_shell(inner))


_STATUS_MSG = {
    "paid": "We've received your payment and your order is confirmed.",
    "processing": "Good news — we're now preparing your order.",
    "ready_for_collection": f"Your order is ready to collect from {HUB} (Mon–Fri, 9am–5pm). Please bring your order reference.",
    "dispatched": "Your order is on its way to you.",
    "completed": "Your order is now complete. Thank you for supporting Grace Cares.",
    "cancelled": "Your order has been cancelled. If you have any questions, please get in touch.",
    "refunded": "A refund has been processed for your order.",
    "partially_refunded": "A partial refund has been processed for your order.",
}


async def send_order_status_update(order: dict, status: str, note: str = "") -> str | None:
    to = (order or {}).get("customer", {}).get("email", "").strip()
    if not to:
        return None
    ref = escape(order.get("reference", ""))
    name = escape(order.get("customer", {}).get("name") or "there")
    msg = _STATUS_MSG.get(status, f"Your order status has been updated to {status.replace('_',' ')}.")
    note_html = f'<p style="font-size:14px;color:#4A4A4D">{escape(note)}</p>' if note else ""
    inner = (
        '<p style="font-size:13px;color:#4A4A4D;margin:0 0 16px">An update on your order</p>'
        f'<p style="font-size:15px">Hello {name},</p>'
        f'<p style="font-size:15px">{escape(msg)}</p>'
        f'<p style="font-size:15px">Order reference: <strong>{ref}</strong></p>'
        f'{note_html}'
    )
    return await send_email(to=to, subject=f"Update on your Grace Cares order {order.get('reference','')}",
                            html=_shell(inner))
