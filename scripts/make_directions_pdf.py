"""Generate a simple PDF presenting three homepage visual directions for Grace Cares."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

OUT = "/app/frontend/public/grace-cares-visual-directions.pdf"
GREEN = HexColor("#006738"); LIME = HexColor("#85E845"); BONE = HexColor("#F7F6F2")
INK = HexColor("#1A1A1D"); GREY = HexColor("#4A4A4D")

DIRECTIONS = [
    ("Direction 1 — Warm & Human (BUILT)",
     "The direction we've built. Calm bone background, forest-green headings, lime used only for the Donate action. Big 18px+ type, real-photo placeholders, MPB-style clear search in the hero. Two routes (Buy / Donate) weighted to buying.",
     ["Bone #F7F6F2 canvas, generous whitespace", "Forest green #006738 headings & primary buttons",
      "Lime #85E845 reserved for one action (Donate)", "Photo-led category tiles, no icons"]),
    ("Direction 2 — Editorial & Bold",
     "A more editorial feel: a full-width green masthead band, oversized headline, and a horizontal 'just added this week' stock strip. Confident and magazine-like while staying calm and legible.",
     ["Green masthead band with reversed white type", "Oversized 48px display headline",
      "Freshness line: 'X items listed this week'", "Quiet Google rating strip under the hero"]),
    ("Direction 3 — Soft & Reassuring",
     "The gentlest option: rounded cards, extra spacing, softer neutrals, and a single centred search with two large side-by-side route cards. Designed to feel effortless for less confident visitors.",
     ["Extra-soft neutrals and larger radii", "Single prominent search, two big route cards",
      "Impact figures as calm number blocks", "Minimal chrome, one action per section"]),
]


def swatch(c, x, y, colour, label):
    c.setFillColor(colour); c.roundRect(x, y, 22*mm, 12*mm, 3, fill=1, stroke=0)
    c.setFillColor(GREY); c.setFont("Helvetica", 7); c.drawString(x, y - 4*mm, label)


def page(c, title, blurb, bullets):
    c.setFillColor(BONE); c.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    c.setFillColor(GREEN); c.rect(0, A4[1]-28*mm, A4[0], 28*mm, fill=1, stroke=0)
    c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 18)
    c.drawString(18*mm, A4[1]-18*mm, "Grace Cares — Homepage Visual Directions")
    y = A4[1]-45*mm
    c.setFillColor(GREEN); c.setFont("Helvetica-Bold", 15); c.drawString(18*mm, y, title)
    y -= 9*mm
    c.setFillColor(INK); c.setFont("Helvetica", 10)
    for line in _wrap(blurb, 95):
        c.drawString(18*mm, y, line); y -= 5.5*mm
    y -= 4*mm
    for b in bullets:
        c.setFillColor(LIME); c.circle(20*mm, y+1.2*mm, 1.5*mm, fill=1, stroke=0)
        c.setFillColor(INK); c.setFont("Helvetica", 10); c.drawString(24*mm, y, b); y -= 7*mm
    y -= 6*mm
    swatch(c, 18*mm, y-12*mm, GREEN, "Primary #006738")
    swatch(c, 46*mm, y-12*mm, LIME, "Accent #85E845")
    swatch(c, 74*mm, y-12*mm, BONE, "Canvas #F7F6F2")
    # simple wireframe box
    c.setStrokeColor(GREEN); c.setLineWidth(1); c.setFillColor(HexColor("#FFFFFF"))
    c.roundRect(18*mm, 20*mm, A4[0]-36*mm, 55*mm, 4, fill=1, stroke=1)
    c.setFillColor(GREY); c.setFont("Helvetica-Oblique", 9)
    c.drawString(24*mm, 68*mm, "[ header: logo · search · Donate ]  — indicative wireframe")
    c.setFillColor(BONE); c.rect(24*mm, 30*mm, 80*mm, 30*mm, fill=1, stroke=0)
    c.setFillColor(GREY); c.drawString(28*mm, 44*mm, "REAL PHOTO / stock strip")
    c.setFillColor(GREEN); c.setFont("Helvetica-Bold", 12); c.drawString(112*mm, 55*mm, "Headline")
    c.setFillColor(LIME); c.roundRect(112*mm, 34*mm, 30*mm, 9*mm, 4, fill=1, stroke=0)
    c.setFillColor(GREEN); c.roundRect(146*mm, 34*mm, 28*mm, 9*mm, 4, fill=1, stroke=0)
    c.showPage()


def _wrap(text, n):
    words = text.split(); lines = []; cur = ""
    for w in words:
        if len(cur)+len(w)+1 <= n: cur = (cur+" "+w).strip()
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines


c = canvas.Canvas(OUT, pagesize=A4)
for t, b, bl in DIRECTIONS:
    page(c, t, b, bl)
c.save()
print("WROTE", OUT)
