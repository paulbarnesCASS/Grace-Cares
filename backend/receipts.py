"""VAT declaration PDF receipts + emailing them to the customer (Emergent-managed Resend)."""
import os
import io
import secrets
import logging
from html import escape

from fastapi import APIRouter, HTTPException, Depends, Response, Query
from bson import ObjectId
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle)

from core import db, now_utc
from auth import require_admin
from shop import get_vat_statement, STANDARD_VAT
from emails import send_email

logger = logging.getLogger("grace_cares")
receipts_router = APIRouter(prefix="/api")

SITE = os.environ.get("FRONTEND_URL", "https://grace-cares.com").rstrip("/")
BRAND = "#006738"


# ---------------- PDF generation ----------------
def _gbp(v):
    return f"£{float(v or 0):,.2f}"


async def _gather(did: str):
    dec = await db.vat_declarations.find_one({"_id": ObjectId(did)})
    if not dec:
        raise HTTPException(404, "Declaration not found")
    order = await db.orders.find_one({"reference": dec.get("order_reference")})
    stmt = await get_vat_statement()
    return dec, order, stmt


def _relief_lines(order):
    """Return (relieved_line_items, total_relieved_vat)."""
    rows, relieved = [], 0.0
    for it in (order or {}).get("items", []):
        if it.get("vat_relief_applied"):
            saved = round((it.get("line_ex_vat", 0) or 0) * STANDARD_VAT, 2)
            relieved += saved
            rows.append((it.get("name", ""), it.get("sku", ""), it.get("quantity", 1),
                         _gbp(it.get("line_ex_vat")), _gbp(saved)))
    return rows, round(relieved, 2)


def build_declaration_pdf(dec: dict, order: dict, stmt: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm,
                            leftMargin=18 * mm, rightMargin=18 * mm,
                            title=f"VAT relief declaration {dec.get('order_reference','')}")
    ss = getSampleStyleSheet()
    green = colors.HexColor(BRAND)
    h1 = ParagraphStyle("h1", parent=ss["Title"], textColor=green, fontSize=20, spaceAfter=2)
    sub = ParagraphStyle("sub", parent=ss["Normal"], fontSize=9, textColor=colors.HexColor("#4A4A4D"))
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], textColor=green, fontSize=12, spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("body", parent=ss["Normal"], fontSize=10, leading=14)
    small = ParagraphStyle("small", parent=ss["Normal"], fontSize=8, textColor=colors.HexColor("#6b6b6b"), leading=11)

    els = []
    els.append(Paragraph("Grace Cares", h1))
    els.append(Paragraph("VAT relief declaration &amp; receipt · Grace Cares CIC, Lichfield · hello@grace-cares.com · 01543 730189", sub))
    els.append(Spacer(1, 8))

    created = dec.get("created_at")
    created_str = created.strftime("%d %B %Y, %H:%M") if hasattr(created, "strftime") else str(created or "")
    meta = [
        ["Order reference", dec.get("order_reference", "—")],
        ["Declaration date", created_str],
        ["Customer email", dec.get("customer_email", "—")],
    ]
    if order:
        meta.append(["Order status", order.get("status", "—")])
    t = Table(meta, colWidths=[45 * mm, 120 * mm])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), green),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#E0E0E0")),
    ]))
    els.append(t)

    els.append(Paragraph("Eligible person &amp; declaration", h2))
    for lbl, val in [
        ("Full name of eligible person", dec.get("eligible_person_name")),
        ("Address", dec.get("eligible_person_address")),
        ("Disability / long-term illness", dec.get("condition_description")),
    ]:
        els.append(Paragraph(f"<b>{escape(lbl)}:</b> {escape(str(val or '—'))}", body))
    if dec.get("completed_by_name"):
        els.append(Paragraph(f"<b>Completed by:</b> {escape(dec.get('completed_by_name'))} "
                             f"({escape(dec.get('relationship') or 'not stated')})", body))
    els.append(Paragraph(f"<b>For personal/domestic use:</b> {'Yes' if dec.get('for_personal_domestic_use') else 'No'}", body))
    els.append(Paragraph(f"<b>Information declared accurate:</b> {'Yes' if dec.get('info_accurate') else 'No'}", body))
    els.append(Paragraph(f"<b>Electronic signature:</b> {escape(str(dec.get('signature') or '—'))}", body))

    if order:
        rows, relieved = _relief_lines(order)
        els.append(Paragraph("Items with VAT relief applied", h2))
        data = [["Item", "SKU", "Qty", "Price (ex VAT)", "VAT relieved"]] + (rows or [["—", "", "", "", ""]])
        it = Table(data, colWidths=[62 * mm, 28 * mm, 14 * mm, 30 * mm, 31 * mm])
        it.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), green),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F7F4")]),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#D9E4DD")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        els.append(it)
        tot = order.get("totals", {})
        summ = [
            ["Subtotal (ex VAT)", _gbp(tot.get("subtotal_ex_vat"))],
            ["VAT charged", _gbp(tot.get("vat_total"))],
            ["Total VAT relieved on eligible items", _gbp(relieved)],
            ["Total paid", _gbp(tot.get("total_payable"))],
        ]
        st = Table(summ, colWidths=[110 * mm, 55 * mm])
        st.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, -1), (-1, -1), green),
            ("LINEABOVE", (0, -1), (-1, -1), 0.6, green),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        els.append(Spacer(1, 6))
        els.append(st)

    els.append(Paragraph("Declaration wording (as accepted at checkout)", h2))
    els.append(Paragraph(escape(stmt.get("intro", "")), small))
    els.append(Paragraph("• " + escape(stmt.get("confirm_domestic", "")), small))
    els.append(Paragraph("• " + escape(stmt.get("confirm_accurate", "")), small))
    els.append(Spacer(1, 10))
    els.append(Paragraph("Keep this receipt for your records. HMRC may ask to see the VAT-relief declaration. "
                         "Grace Cares CIC is a not-for-profit Community Interest Company.", small))

    doc.build(els)
    return buf.getvalue()


# ---------------- Routes ----------------
@receipts_router.get("/admin/vat-declarations/{did}/receipt.pdf")
async def admin_receipt_pdf(did: str, user=Depends(require_admin("finance_admin"))):
    dec, order, stmt = await _gather(did)
    pdf = build_declaration_pdf(dec, order, stmt)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename=vat-declaration-{dec.get("order_reference","")}.pdf'})


@receipts_router.get("/vat-declarations/{did}/receipt.pdf")
async def public_receipt_pdf(did: str, token: str = Query(...)):
    dec, order, stmt = await _gather(did)
    if not dec.get("receipt_token") or not secrets.compare_digest(token, dec["receipt_token"]):
        raise HTTPException(403, "Invalid or expired link")
    pdf = build_declaration_pdf(dec, order, stmt)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename=vat-declaration-{dec.get("order_reference","")}.pdf'})


@receipts_router.post("/admin/vat-declarations/{did}/email-receipt")
async def email_receipt(did: str, user=Depends(require_admin("finance_admin"))):
    dec, order, stmt = await _gather(did)
    to = (dec.get("customer_email") or "").strip()
    if not to:
        raise HTTPException(400, "No customer email is stored on this declaration")

    token = dec.get("receipt_token") or secrets.token_urlsafe(24)
    await db.vat_declarations.update_one({"_id": ObjectId(did)},
                                         {"$set": {"receipt_token": token}})
    link = f"{SITE}/api/vat-declarations/{did}/receipt.pdf?token={token}"

    _, relieved = _relief_lines(order)
    ref = escape(dec.get("order_reference", ""))
    name = escape(dec.get("eligible_person_name") or "there")
    html = (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="font-family:Arial,Helvetica,sans-serif;color:#1A1A1D"><tr><td style="padding:24px">'
        f'<h1 style="color:{BRAND};font-size:22px;margin:0 0 4px">Grace Cares</h1>'
        '<p style="font-size:13px;color:#4A4A4D;margin:0 0 16px">Your VAT relief declaration receipt</p>'
        f'<p style="font-size:15px">Hello {name},</p>'
        f'<p style="font-size:15px;line-height:22px">Thank you for your order <strong>{ref}</strong>. '
        'Attached to this email as a secure link is your VAT relief declaration receipt, which you can '
        'download, print and keep for your records.</p>'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="background:#F3F7F4;border-radius:10px;margin:14px 0"><tr><td style="padding:16px 18px">'
        f'<p style="margin:0 0 6px;font-size:14px"><strong>Order:</strong> {ref}</p>'
        f'<p style="margin:0 0 6px;font-size:14px"><strong>Total VAT relieved on eligible items:</strong> {_gbp(relieved)}</p>'
        '</td></tr></table>'
        f'<p style="margin:20px 0"><a href="{link}" '
        f'style="background:{BRAND};color:#ffffff;text-decoration:none;padding:12px 22px;'
        'border-radius:999px;font-weight:bold;font-size:15px;display:inline-block">Download your receipt (PDF)</a></p>'
        '<p style="font-size:13px;color:#4A4A4D;line-height:20px">If the button does not work, copy and paste this '
        'link into your browser:<br>'+escape(link)+'</p>'
        '<p style="font-size:12px;color:#888;margin-top:22px;line-height:18px">Sent by Grace Cares CIC, Lichfield. '
        'We never ask for your password or card details by email. If you have questions, call 01543 730189 or '
        'email hello@grace-cares.com.</p>'
        '</td></tr></table>'
    )
    subject = f"Your Grace Cares VAT relief receipt — order {dec.get('order_reference','')}"
    email_id = await send_email(to=to, subject=subject, html=html)
    await db.vat_declarations.update_one({"_id": ObjectId(did)},
        {"$set": {"receipt_emailed_at": now_utc(), "receipt_email_to": to}})
    return {"ok": True, "sent_to": to, "email_id": email_id}
