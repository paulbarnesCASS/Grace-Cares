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
        if e.response.status_code == 422:
            try:
                msg = e.response.json().get("message") or "Recipient looks undeliverable"
            except Exception:
                msg = "Recipient looks undeliverable"
            raise HTTPException(400, msg)
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

_P = 'font-size:15px;line-height:22px'

# ---------------- Editable template registry ----------------
# Editable parts: subject + inner body (wrapped in the branded _shell on send).
# {{variables}} are substituted at send time; structural fragments (tables, buttons) are
# provided pre-rendered as variables so branding & guardrails stay intact.
TEMPLATE_DEFAULTS = {
    "order_confirmation": {
        "label": "Order confirmation",
        "description": "Sent automatically to the customer when their order is paid.",
        "variables": ["name", "reference", "items_table", "fulfilment_note", "shop_button"],
        "subject": "Your Grace Cares order {{reference}} is confirmed",
        "body": (
            '<p style="font-size:13px;color:#4A4A4D;margin:0 0 16px">Your order is confirmed</p>'
            f'<p style="{_P}">Hello {{{{name}}}}, thank you for your order and for supporting Grace Cares.</p>'
            f'<p style="{_P}">Order reference: <strong>{{{{reference}}}}</strong></p>'
            '{{items_table}}'
            f'<p style="{_P}">{{{{fulfilment_note}}}}</p>'
            '{{shop_button}}'
        ),
        "sample": {"name": "Jane Smith", "reference": "GC-12345678",
                   "items_table": '<p style="color:#888">[order items table]</p>',
                   "fulfilment_note": "We'll post your order to you.",
                   "shop_button": ""},
    },
    "order_status_update": {
        "label": "Order status update",
        "description": "Sent when you mark an order dispatched/ready for collection, or tick 'email the customer' on any status change.",
        "variables": ["name", "reference", "status_message", "note_html"],
        "subject": "Update on your Grace Cares order {{reference}}",
        "body": (
            '<p style="font-size:13px;color:#4A4A4D;margin:0 0 16px">An update on your order</p>'
            f'<p style="{_P}">Hello {{{{name}}}},</p>'
            f'<p style="{_P}">{{{{status_message}}}}</p>'
            f'<p style="{_P}">Order reference: <strong>{{{{reference}}}}</strong></p>'
            '{{note_html}}'
        ),
        "sample": {"name": "Jane Smith", "reference": "GC-12345678",
                   "status_message": _STATUS_MSG["ready_for_collection"], "note_html": ""},
    },
    "donation_thank_you": {
        "label": "Donation thank-you",
        "description": "Sent automatically to a donor when their donation payment succeeds.",
        "variables": ["name", "reference", "amount", "kind", "receipt_box", "recur_html", "ded_html"],
        "subject": "Thank you for your donation to Grace Cares ({{reference}})",
        "body": (
            '<p style="font-size:13px;color:#4A4A4D;margin:0 0 16px">Thank you for your donation</p>'
            f'<p style="{_P}">Dear {{{{name}}}},</p>'
            f'<p style="{_P}">Thank you so much for your {{{{kind}}}} of <strong>{{{{amount}}}}</strong> to '
            'Grace Cares. Your support helps us give pre-loved care equipment a second life and reach more '
            'people who need it.</p>'
            '{{receipt_box}}{{recur_html}}{{ded_html}}'
            f'<p style="{_P}">Please keep this email as your receipt. Grace Cares CIC is a not-for-profit '
            'Community Interest Company.</p>'
        ),
        "sample": {"name": "Jane Smith", "reference": "GD-12345678", "amount": "£25.00", "kind": "gift",
                   "receipt_box": '<p style="color:#888">[receipt box]</p>', "recur_html": "", "ded_html": ""},
    },
    "vat_receipt": {
        "label": "VAT relief receipt",
        "description": "Sent from the VAT Declarations page — links the customer to their downloadable receipt.",
        "variables": ["name", "reference", "relieved", "receipt_box", "download_button", "download_url"],
        "subject": "Your Grace Cares VAT relief receipt — order {{reference}}",
        "body": (
            '<p style="font-size:13px;color:#4A4A4D;margin:0 0 16px">Your VAT relief declaration receipt</p>'
            f'<p style="{_P}">Hello {{{{name}}}},</p>'
            f'<p style="{_P}">Thank you for your order <strong>{{{{reference}}}}</strong>. Below is a secure link '
            'to your VAT relief declaration receipt, which you can download, print and keep for your records.</p>'
            '{{receipt_box}}{{download_button}}'
            '<p style="font-size:13px;color:#4A4A4D;line-height:20px">If the button does not work, copy and paste '
            'this link into your browser:<br>{{download_url}}</p>'
        ),
        "sample": {"name": "Jane Smith", "reference": "GC-12345678", "relieved": "£12.00",
                   "receipt_box": '<p style="color:#888">[receipt summary]</p>',
                   "download_button": "", "download_url": "https://grace-cares.com/api/..."},
    },
    "booking_confirmation": {
        "label": "Event booking confirmation",
        "description": "Sent to an attendee when their event booking is confirmed (free events immediately, paid events after payment).",
        "variables": ["name", "reference", "event_name", "attendees", "extra_note"],
        "subject": "Your booking for {{event_name}} is confirmed ({{reference}})",
        "body": (
            '<p style="font-size:13px;color:#4A4A4D;margin:0 0 16px">Your booking is confirmed</p>'
            f'<p style="{_P}">Hello {{{{name}}}}, thank you — your place is booked and we look forward to seeing you.</p>'
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            'style="background:#F3F7F4;border-radius:10px;margin:14px 0"><tr><td style="padding:16px 18px">'
            '<p style="margin:0 0 6px;font-size:14px"><strong>Event:</strong> {{event_name}}</p>'
            '<p style="margin:0 0 6px;font-size:14px"><strong>Booking reference:</strong> {{reference}}</p>'
            '<p style="margin:0;font-size:14px"><strong>Places booked:</strong> {{attendees}}</p>'
            '</td></tr></table>{{extra_note}}'
        ),
        "sample": {"name": "Jane Smith", "reference": "EB-12345678", "event_name": "Manual Handling Workshop",
                   "attendees": 2, "extra_note": ""},
    },
    "enquiry_auto_reply": {
        "label": "Enquiry auto-reply",
        "description": "A friendly acknowledgement sent automatically when someone submits an enquiry via the website.",
        "variables": ["name", "reference", "enquiry_type"],
        "subject": "We've received your enquiry — Grace Cares ({{reference}})",
        "body": (
            '<p style="font-size:13px;color:#4A4A4D;margin:0 0 16px">Thanks for getting in touch</p>'
            f'<p style="{_P}">Hello {{{{name}}}}, thank you for contacting Grace Cares about {{{{enquiry_type}}}}. '
            'We\'ve received your message (reference <strong>{{reference}}</strong>) and a member of our team '
            'will be in touch as soon as we can.</p>'
            f'<p style="{_P}">If your enquiry is urgent, please call us on 01543 730189.</p>'
        ),
        "sample": {"name": "Jane Smith", "reference": "EN-12345678", "enquiry_type": "equipment"},
    },
}


def _apply(text: str, ctx: dict) -> str:
    for k, v in (ctx or {}).items():
        text = text.replace("{{" + k + "}}", "" if v is None else str(v))
    return text


async def get_template(key: str) -> dict:
    base = TEMPLATE_DEFAULTS[key]
    d = await db.email_templates.find_one({"key": key})
    return {"subject": (d or {}).get("subject") or base["subject"],
            "body": (d or {}).get("body") or base["body"]}


async def render_and_send(key: str, to: str, ctx: dict) -> str | None:
    tpl = await get_template(key)
    subject = _apply(tpl["subject"], ctx)
    body = _apply(tpl["body"], ctx)
    return await send_email(to=to, subject=subject, html=_shell(body))


async def send_order_confirmation(order: dict) -> str | None:
    to = (order or {}).get("customer", {}).get("email", "").strip()
    if not to:
        return None
    tot = order.get("totals", {})
    rows = ""
    for it in order.get("items", []):
        rows += (f'<tr><td style="padding:6px 8px;border-bottom:1px solid #E4EAE6">{escape(str(it.get("name","")))}'
                 f'{" (VAT relief applied)" if it.get("vat_relief_applied") else ""}</td>'
                 f'<td style="padding:6px 8px;border-bottom:1px solid #E4EAE6;text-align:center">{it.get("quantity",1)}</td>'
                 f'<td style="padding:6px 8px;border-bottom:1px solid #E4EAE6;text-align:right">{_gbp(it.get("line_total"))}</td></tr>')
    items_table = (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:14px 0">'
        '<tr style="background:#F3F7F4"><th style="padding:8px;text-align:left;font-size:13px">Item</th>'
        '<th style="padding:8px;text-align:center;font-size:13px">Qty</th>'
        '<th style="padding:8px;text-align:right;font-size:13px">Total</th></tr>'
        f'{rows}'
        f'<tr><td style="padding:8px;font-weight:bold">Total paid</td><td></td>'
        f'<td style="padding:8px;text-align:right;font-weight:bold;color:{BRAND}">{_gbp(tot.get("total_payable"))}</td></tr>'
        '</table>')
    shop_button = (f'<p style="margin:18px 0"><a href="{SITE}/shop" style="background:{BRAND};color:#ffffff;'
                   'text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:bold;font-size:14px;'
                   'display:inline-block">Browse more at Grace Cares</a></p>')
    ctx = {"name": escape(order.get("customer", {}).get("name") or "there"),
           "reference": escape(order.get("reference", "")), "items_table": items_table,
           "fulfilment_note": escape(_FULFIL.get(order.get("fulfilment", ""), "")), "shop_button": shop_button}
    return await render_and_send("order_confirmation", to, ctx)


async def send_order_status_update(order: dict, status: str, note: str = "") -> str | None:
    to = (order or {}).get("customer", {}).get("email", "").strip()
    if not to:
        return None
    msg = _STATUS_MSG.get(status, f"Your order status has been updated to {status.replace('_',' ')}.")
    ctx = {"name": escape(order.get("customer", {}).get("name") or "there"),
           "reference": escape(order.get("reference", "")), "status_message": escape(msg),
           "note_html": (f'<p style="font-size:14px;color:#4A4A4D">{escape(note)}</p>' if note else "")}
    return await render_and_send("order_status_update", to, ctx)


async def send_donation_thank_you(donation: dict) -> str | None:
    to = (donation or {}).get("email", "").strip()
    if not to:
        return None
    amount = _gbp(donation.get("amount"))
    recurring = donation.get("recurring")
    dedication = donation.get("dedication")
    receipt_box = (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#F3F7F4;border-radius:10px;margin:14px 0"><tr><td style="padding:16px 18px">'
        f'<p style="margin:0 0 6px;font-size:14px"><strong>Receipt reference:</strong> {escape(donation.get("reference",""))}</p>'
        f'<p style="margin:0 0 6px;font-size:14px"><strong>Amount:</strong> {amount}{" per month" if recurring else ""}</p>'
        '</td></tr></table>')
    ctx = {"name": escape(donation.get("name") or "there"), "reference": escape(donation.get("reference", "")),
           "amount": amount, "kind": "monthly gift" if recurring else "gift", "receipt_box": receipt_box,
           "recur_html": ('<p style="font-size:14px;color:#4A4A4D">This is a recurring monthly donation. You can '
                          'change or cancel it any time by contacting us.</p>' if recurring else ""),
           "ded_html": (f'<p style="font-size:14px;color:#4A4A4D">Dedication: {escape(dedication)}</p>' if dedication else "")}
    return await render_and_send("donation_thank_you", to, ctx)


async def send_booking_confirmation(booking: dict, event: dict = None) -> str | None:
    to = (booking or {}).get("email", "").strip()
    if not to:
        return None
    online = (event or {}).get("online_link")
    extra = (f'<p style="{_P}">This is an online event. Join here: {escape(online)}</p>' if online else "")
    ctx = {"name": escape(booking.get("name") or "there"), "reference": escape(booking.get("reference", "")),
           "event_name": escape(booking.get("event_name") or "the event"),
           "attendees": booking.get("num_attendees", 1), "extra_note": extra}
    return await render_and_send("booking_confirmation", to, ctx)


async def send_enquiry_ack(enquiry: dict) -> str | None:
    to = (enquiry or {}).get("email", "").strip()
    if not to:
        return None
    ctx = {"name": escape(enquiry.get("name") or "there"), "reference": escape(enquiry.get("reference", "")),
           "enquiry_type": escape((enquiry.get("enquiry_type") or "your enquiry").replace("_", " "))}
    return await render_and_send("enquiry_auto_reply", to, ctx)

