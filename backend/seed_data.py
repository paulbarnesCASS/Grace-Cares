"""Idempotent v3 seed data for Grace Cares. Images are intentionally empty so the UI
shows a 'REAL PHOTO TO REPLACE' placeholder (no stock photos of people, per v3)."""
from core import db, now_utc

SEED_VERSION = "v3-3"

# v3 data-model category set (confirmed by client)
CATEGORIES = [
    {"name": "Bathing", "slug": "bathing", "order": 1, "description": "Shower seats, bath lifts and grab rails."},
    {"name": "Beds", "slug": "beds", "order": 2, "description": "Profiling beds and pressure-relieving mattresses."},
    {"name": "Fall Prevention", "slug": "fall-prevention", "order": 3, "description": "Sensors, rails and support aids."},
    {"name": "Furniture", "slug": "furniture", "order": 4, "description": "Adjustable and supportive furniture."},
    {"name": "Kitchen and Catering", "slug": "kitchen-catering", "order": 5, "description": "Kettle tippers, easy-grip and daily-living aids."},
    {"name": "Mobility", "slug": "mobility", "order": 6, "description": "Wheelchairs, rollators, walking frames and sticks."},
    {"name": "Moving and Handling", "slug": "moving-handling", "order": 7, "description": "Hoists, slings and transfer aids."},
    {"name": "Toilet Aids", "slug": "toilet-aids", "order": 8, "description": "Commodes, raised seats and frames."},
    {"name": "Special Offers", "slug": "special-offers", "order": 9, "description": "Reduced and clearance items."},
    {"name": "Seating", "slug": "seating", "order": 10, "description": "Riser recliners, perching stools and chair raisers."},
]

G_EXCELLENT = "Excellent, minimal signs of previous use."
G_VERY_GOOD = "Very good, light cosmetic signs of previous use."
G_GOOD = "Good, visible signs of previous use but fully functional."
G_FUNCTIONAL = "Functional, noticeable cosmetic wear reflected in the price."


def _p(name, sku, cat, desc, grade, price, relief, qty, model="unique", **extra):
    d = {"name": name, "sku": sku, "_cat": cat, "description": desc, "condition": grade,
         "price_ex_vat": price, "vat_rate": 0.20, "vat_relief_eligible": relief,
         "quantity_available": qty, "quantity_reserved": 0, "images": [],
         "stock_model": model, "listing_type": "sale", "status": "available",
         "fulfilment_options": ["collection", "delivery"], "delivery_charge": 25.0,
         "fulfilment_route": extra.pop("fulfilment_route", "hub_collection"),
         "specifications": {}, "featured": False}
    d.update(extra)
    return d


PRODUCTS = [
    _p("Self-Propel Folding Wheelchair", "MOB-001", "mobility", "Lightweight self-propel folding wheelchair, fully serviced and cleaned.", G_VERY_GOOD, 145.0, True, 1, "unique", max_user_weight="115 kg", dimensions="94 x 66 x 91 cm", carbon_saving_kg=42.0, featured=True, safety_info="Brakes tested and fully functional. Please check the user weight limit before use."),
    _p("Attendant Transit Wheelchair", "MOB-002", "mobility", "Compact attendant-controlled transit wheelchair — a repeat-stock item.", G_GOOD, 89.0, True, 4, "repeat", max_user_weight="100 kg", carbon_saving_kg=38.0),
    _p("Aluminium Walking Frame", "MOB-003", "mobility", "Lightweight walking frame, cleaned and checked, non-slip ferrules fitted.", G_GOOD, 22.0, True, 6, "repeat", carbon_saving_kg=6.0, fulfilment_route="postable"),
    _p("Four-Wheel Rollator with Seat", "MOB-004", "mobility", "Height-adjustable rollator with padded seat and bag.", G_VERY_GOOD, 55.0, True, 3, "repeat", max_user_weight="135 kg", carbon_saving_kg=12.0, featured=True),
    _p("Electric Profiling Care Bed", "BED-001", "beds", "Fully adjustable electric profiling bed with remote. PAT tested.", G_VERY_GOOD, 380.0, True, 1, "unique", dimensions="200 x 90 cm", max_user_weight="180 kg", carbon_saving_kg=120.0, delivery_charge=60.0, featured=True, fulfilment_route="bulky_delivery", safety_info="Electrically tested (PAT). Professional delivery and set-up recommended."),
    _p("Pressure-Relieving Mattress", "BED-002", "beds", "Cleaned pressure-relieving foam mattress in excellent condition.", G_EXCELLENT, 95.0, True, 1, "unique", dimensions="200 x 90 x 15 cm", carbon_saving_kg=30.0),
    _p("Wall-Mounted Shower Seat", "BATH-001", "bathing", "Sturdy fold-down shower seat, rejuvenated and deep cleaned.", G_GOOD, 35.0, True, 2, "repeat", max_user_weight="130 kg", carbon_saving_kg=8.0, safety_info="Requires secure fixing to a solid wall. Professional fitting advised."),
    _p("Bath Lift", "BATH-002", "bathing", "Battery bath lift, serviced with a fresh battery.", G_VERY_GOOD, 120.0, True, 1, "unique", max_user_weight="140 kg", carbon_saving_kg=22.0),
    _p("Patient Hoist with Sling", "MH-001", "moving-handling", "Mobile patient hoist supplied with a clean sling. Load tested.", G_GOOD, 295.0, True, 1, "unique", max_user_weight="150 kg", carbon_saving_kg=85.0, delivery_charge=60.0, safety_info="Load tested. Training in safe use strongly recommended."),
    _p("Riser Recliner Armchair", "SEAT-001", "seating", "Dual-motor riser recliner armchair, upholstery cleaned. Remote included.", G_VERY_GOOD, 210.0, False, 1, "unique", carbon_saving_kg=70.0, delivery_charge=60.0, fulfilment_route="bulky_delivery", safety_info="Standard VAT applies — this item is not currently approved for VAT relief."),
    _p("Perching Stool", "SEAT-002", "seating", "Height-adjustable perching stool, cleaned and checked.", G_GOOD, 18.0, True, 5, "repeat", carbon_saving_kg=4.0),
    _p("Bedside Commode", "TOIL-001", "toilet-aids", "Height-adjustable bedside commode with removable bucket. Sanitised.", G_GOOD, 28.0, True, 3, "repeat", carbon_saving_kg=7.0),
    _p("Raised Toilet Seat", "TOIL-002", "toilet-aids", "Clip-on raised toilet seat, thoroughly sanitised.", G_GOOD, 15.0, True, 4, "repeat", carbon_saving_kg=3.0),
    _p("Fall Detection Floor Sensor Mat", "FALL-001", "fall-prevention", "Pressure-sensitive floor mat that alerts carers to movement. Tested.", G_GOOD, 40.0, False, 2, "repeat", carbon_saving_kg=5.0, safety_info="Standard VAT applies to this item."),
    _p("Kettle Tipper", "KIT-001", "kitchen-catering", "Easy-pour kettle tipper aid, cleaned and checked.", G_GOOD, 12.0, True, 5, "repeat", carbon_saving_kg=2.0),
    _p("Adjustable Overbed Table", "FURN-001", "furniture", "Height-adjustable overbed table on castors.", G_VERY_GOOD, 32.0, False, 3, "repeat", carbon_saving_kg=9.0),
]

IMPACT_STATS = [
    {"label": "People helped", "value": "5,002", "order": 1},
    {"label": "Social value per £1 invested", "value": "£4–£7", "order": 2},
    {"label": "Items saved from landfill", "value": "4,200+", "order": 3},
    {"label": "Goal by end of 2028", "value": "10,000", "order": 4},
]
PARTNERS = [
    {"name": "Staffordshire County Council", "order": 1}, {"name": "Lichfield District Council", "order": 2},
    {"name": "NHS Partner Trusts", "order": 3}, {"name": "Care England", "order": 4},
    {"name": "IHSCM", "order": 5}, {"name": "National Care Forum", "order": 6},
    {"name": "Veolia", "order": 7}, {"name": "West Midlands Care Association", "order": 8},
]
TESTIMONIALS = [
    {"quote": "Grace Cares found us a serviced profiling bed at half the price. Kind, quick and genuinely caring.", "author": "Margaret, Lichfield", "order": 1},
    {"quote": "Their sustainability resources helped us evidence being well-led to the regulator.", "author": "David, Care Home Manager", "order": 2},
    {"quote": "The team collected mum's equipment with such compassion. It's now helping another family.", "author": "Sarah, Family Donor", "order": 3},
]


async def seed_all():
    marker = await db.site_settings.find_one({"key": "seed_version"})
    fresh = not marker or marker.get("value") != SEED_VERSION
    if fresh:
        for c in ["categories", "products", "impact_stats", "partners", "testimonials"]:
            await db[c].delete_many({})
        await db.site_settings.delete_many({"key": "homepage"})

    if await db.categories.count_documents({}) == 0:
        for c in CATEGORIES:
            await db.categories.insert_one({**c, "hidden": False, "parent_id": None, "created_at": now_utc()})
    cats = {c["slug"]: str(c["_id"]) for c in await db.categories.find().to_list(50)}
    if await db.products.count_documents({}) == 0:
        for p in PRODUCTS:
            p = dict(p); slug = p.pop("_cat"); p["category_id"] = cats.get(slug); p["created_at"] = now_utc()
            await db.products.insert_one(p)
    if await db.impact_stats.count_documents({}) == 0:
        await db.impact_stats.insert_many([dict(s) for s in IMPACT_STATS])
    if await db.partners.count_documents({}) == 0:
        await db.partners.insert_many([dict(p) for p in PARTNERS])
    if await db.testimonials.count_documents({}) == 0:
        await db.testimonials.insert_many([dict(t) for t in TESTIMONIALS])

    if await db.site_settings.find_one({"key": "homepage"}) is None:
        await db.site_settings.insert_one({
            "key": "homepage",
            "headline": "Affordable care equipment. Meaningful social impact.",
            "mission": "Let's Make Care Sustainable.",
            "subheadline": "We rescue, refurbish and resell used care and mobility equipment at half the RRP or less, and reinvest every penny into free community programmes.",
            "announcement_active": True,
            "announcement_text": "New stock added weekly — call 01543 730189 if you can't find what you need.",
            "announcement_link": "/shop",
            "phone": "01543 730189", "email": "hello@grace-cares.com",
            "address": "Grace Cares 11.11 CIC, Lichfield, Staffordshire",
            "opening_hours": "Mon–Fri, 9am–5pm; collection 10am–3pm",
        })

    # events / articles / resources seed once (unchanged, only if empty)
    if await db.events.count_documents({}) == 0:
        from datetime import timedelta
        base = now_utc()
        await db.events.insert_many([
            {"name": "Care Club: Brain Health & Dementia Prevention", "slug": "care-club-brain-health", "image": "", "description": "A friendly online session for older people, caregivers and care providers.", "start_at": (base + timedelta(days=7)).isoformat(), "venue": "Online", "online_link": "https://zoom.us/j/private", "accessibility_info": "Captions available on request.", "capacity": 40, "is_paid": False, "price": 0, "cancelled": False, "published": True, "contact": "events@grace-cares.com", "created_at": now_utc()},
            {"name": "Tea Party & Kindness Rock Painting", "slug": "tea-party-rock-painting", "image": "", "description": "A relaxed afternoon of tea, cake and rock painting in Lichfield.", "start_at": (base + timedelta(days=14)).isoformat(), "venue": "Grace Cares Hub, Lichfield", "accessibility_info": "Step-free access and accessible toilet on site.", "capacity": 25, "is_paid": True, "price": 5.0, "cancelled": False, "published": True, "contact": "events@grace-cares.com", "created_at": now_utc()},
            {"name": "Caring for Tomorrow: ESG Webinar", "slug": "caring-for-tomorrow-esg", "image": "", "description": "A practical webinar for care providers on embedding sustainability.", "start_at": (base + timedelta(days=21)).isoformat(), "venue": "Online", "online_link": "https://zoom.us/j/private-esg", "accessibility_info": "Recording available afterwards.", "capacity": 100, "is_paid": False, "price": 0, "cancelled": False, "published": True, "contact": "sustainability@grace-cares.com", "created_at": now_utc()},
        ])
    if await db.articles.count_documents({}) == 0:
        await db.articles.insert_many([
            {"title": "How buying pre-loved care equipment cuts costs and carbon", "slug": "preloved-cuts-costs-carbon", "author": "Grace Cares", "category": "News", "featured_image": "", "excerpt": "Every item we rescue keeps usable equipment out of landfill and makes care more affordable.", "content": "At Grace Cares we rescue, refurbish and resell used care equipment at half the RRP or less. Proceeds fund free community programmes for older people and unpaid caregivers.", "status": "published", "is_impact": False, "created_at": now_utc()},
            {"title": "Margaret's story: a profiling bed that changed everything", "slug": "margarets-story", "author": "Grace Cares", "category": "Impact", "featured_image": "", "excerpt": "When Margaret needed a profiling bed at short notice, the cost felt impossible.", "content": "Margaret's family were quoted over £900 for a new profiling bed. Through Grace Cares they found a serviced bed for under half that price.", "status": "published", "is_impact": True, "impact_problem": "A family faced an unaffordable cost for essential equipment.", "impact_action": "We supplied a serviced, safety-checked profiling bed at under half price with delivery.", "impact_beneficiaries": "Margaret and her family in Lichfield.", "impact_environmental": "An estimated 120 kg CO₂e saved and one bed diverted from landfill.", "impact_social": "Margaret stayed comfortable at home, supported by her family.", "impact_partners": "Supported by our NHS and local authority partners.", "impact_outcomes": "Estimated £520 saved; 1 item reused; care sustained at home.", "created_at": now_utc()},
        ])
    if await db.resources.count_documents({}) == 0:
        await db.resources.insert_many([
            {"title": "Sustainability in Adult Social Care — Starter Guide", "slug": "sustainability-starter-guide", "description": "A plain-English guide to getting started with sustainability and ESG in a care setting.", "category": "Sustainability guides", "file_url": "https://grace-cares.com/resources/starter-guide.pdf", "image": "", "is_paid": False, "price": 0, "gated": False, "published": True, "download_count": 0, "created_at": now_utc()},
            {"title": "ESG Evidence Checklist", "slug": "esg-evidence-checklist", "description": "A downloadable checklist to help evidence your commitment to environmental sustainability.", "category": "Checklists", "file_url": "https://grace-cares.com/resources/esg-checklist.pdf", "image": "", "is_paid": False, "price": 0, "gated": True, "published": True, "download_count": 0, "created_at": now_utc()},
        ])

    await db.site_settings.update_one({"key": "seed_version"}, {"$set": {"key": "seed_version", "value": SEED_VERSION}}, upsert=True)
