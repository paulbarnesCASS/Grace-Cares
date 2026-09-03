import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, gbp } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { VatReliefBadge, ConditionBadge } from "@/components/ProductCard";
import ProductCard from "@/components/ProductCard";
import { Leaf, Truck, Package, AlertTriangle, Info, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

export default function ProductDetail() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [req, setReq] = useState({ name: "", email: "" });
  const { add } = useCart();

  useEffect(() => { window.scrollTo(0, 0); api.get(`/products/${id}`).then((r) => { setP(r.data); setImg(0); setQty(1); }); }, [id]);

  useEffect(() => {
    if (!p) return;
    const ld = { "@context": "https://schema.org", "@type": "Product", name: p.name, sku: p.sku,
      description: p.description, category: p.category_id,
      itemCondition: "https://schema.org/UsedCondition",
      offers: { "@type": "Offer", price: p.price_inc_vat, priceCurrency: "GBP",
        availability: (p.available_qty > 0) ? "https://schema.org/InStock" : "https://schema.org/SoldOut" } };
    const el = document.createElement("script");
    el.type = "application/ld+json"; el.id = "product-jsonld"; el.text = JSON.stringify(ld);
    document.getElementById("product-jsonld")?.remove();
    document.head.appendChild(el);
    return () => document.getElementById("product-jsonld")?.remove();
  }, [p]);

  if (!p) return <div className="gc-container py-20 text-center text-xl">Loading…</div>;
  const soldOut = (p.available_qty ?? 0) <= 0;

  const submitRequest = async (e) => {
    e.preventDefault();
    await api.post("/wishlist", { product_id: p.id, name: req.name, email: req.email, item_description: p.name });
    toast.success("Thanks — we'll let you know if this becomes available.");
    setReq({ name: "", email: "" });
  };

  return (
    <div className="gc-container py-10">
      <nav className="text-sm text-[#4A4A4D] mb-6" data-testid="breadcrumb"><Link to="/shop" className="hover:underline">Shop</Link> / <span className="text-brand-green font-semibold">{p.name}</span></nav>
      <div className="grid lg:grid-cols-2 gap-10">
        <div>
          <div className="aspect-square bg-white rounded-2xl border border-brand-border overflow-hidden">
            {p.images?.[img] ? <img src={p.images[img]} alt={p.name} className="w-full h-full object-cover" data-testid="product-main-image" /> : <div className="flex flex-col items-center justify-center h-full text-center p-6 border-2 border-dashed border-brand-green/30"><span className="font-heading text-lg font-bold text-brand-green">REAL PHOTO TO REPLACE</span><span className="text-sm text-[#4A4A4D] mt-1">{p.stock_model === "repeat" ? "Representative photo of this type of item." : "Actual photo of this specific item."}</span></div>}
          </div>
          {p.images?.length > 1 && (
            <div className="flex gap-3 mt-3">
              {p.images.map((im, i) => <button key={i} onClick={() => setImg(i)} className={`h-20 w-20 rounded-xl overflow-hidden border-2 ${i === img ? "border-brand-terracotta" : "border-brand-border"}`}><img src={im} alt="" className="w-full h-full object-cover" /></button>)}
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <ConditionBadge condition={p.condition} />
            {p.vat_relief_eligible && <VatReliefBadge />}
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-bone border border-brand-border text-sm font-semibold">SKU {p.sku}</span>
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-brand-green">{p.name}</h1>

          <div className="mt-5 bg-white rounded-2xl border border-brand-border p-6">
            <div className="text-3xl font-bold text-[#1A1A1D]" data-testid="price-inc-vat">{gbp(p.price_inc_vat)} <span className="text-base font-normal text-[#4A4A4D]">incl. VAT</span></div>
            {p.vat_relief_eligible && (
              <div className="mt-1 text-xl font-bold text-brand-terracotta" data-testid="price-relief">{gbp(p.price_ex_vat)} if you qualify for VAT relief</div>
            )}
            <p className="mt-3 text-base text-[#4A4A4D]" data-testid="stock-status">{soldOut ? "Currently sold out" : `${p.available_qty} available`}</p>

            {!soldOut ? (
              <div className="mt-5 flex items-center gap-4">
                <div className="flex items-center border border-brand-border rounded-full">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3" aria-label="Decrease"><Minus size={18} /></button>
                  <span className="w-10 text-center font-bold text-lg" data-testid="qty-value">{qty}</span>
                  <button onClick={() => setQty(Math.min(p.available_qty, qty + 1))} className="p-3" aria-label="Increase"><Plus size={18} /></button>
                </div>
                <button onClick={() => add(p, qty)} className="flex-1 bg-brand-green text-white rounded-full px-6 py-3.5 font-semibold text-lg hover:bg-brand-greenhover transition-colors" data-testid="add-to-basket-btn">Add to basket</button>
              </div>
            ) : (
              <form onSubmit={submitRequest} className="mt-5 space-y-3 border-t border-brand-border pt-4" data-testid="item-request-form">
                <div className="bg-[#E8F5E9] text-[#1B5E20] rounded-xl p-4 font-semibold" data-testid="found-new-home">This item has found a new home. Here's how we can still help:</div>
                <p className="font-semibold">Tell us you're after one and we'll notify you if a similar item comes in:</p>
                <input required placeholder="Your name" value={req.name} onChange={(e) => setReq({ ...req, name: e.target.value })} className="w-full rounded-lg border border-[#8C8C8C] px-4 py-2.5" data-testid="request-name" />
                <input required type="email" placeholder="Your email" value={req.email} onChange={(e) => setReq({ ...req, email: e.target.value })} className="w-full rounded-lg border border-[#8C8C8C] px-4 py-2.5" data-testid="request-email" />
                <button className="bg-brand-terracotta text-white rounded-full px-6 py-3 font-semibold" data-testid="request-submit">Notify me</button>
              </form>
            )}

            <div className="mt-5 flex flex-wrap gap-4 text-base text-[#4A4A4D]">
              {p.fulfilment_options?.includes("collection") && <span className="flex items-center gap-2"><Package size={18} className="text-brand-green" /> Collection available</span>}
              {p.fulfilment_options?.includes("delivery") && <span className="flex items-center gap-2"><Truck size={18} className="text-brand-green" /> Delivery from {gbp(p.delivery_charge)}</span>}
              {p.carbon_saving_kg ? <span className="flex items-center gap-2 text-[#1B5E20] font-semibold"><Leaf size={18} /> Saves ~{p.carbon_saving_kg}kg CO₂e</span> : null}
            </div>
          </div>

          <div className="mt-6 prose max-w-none">
            <h2 className="font-heading text-xl font-bold text-brand-green mb-2">Description</h2>
            <p className="text-lg whitespace-pre-line">{p.description}</p>
          </div>

          {(p.dimensions || p.max_user_weight) && (
            <div className="mt-6">
              <h2 className="font-heading text-xl font-bold text-brand-green mb-2">Specifications</h2>
              <ul className="text-lg space-y-1">
                {p.dimensions && <li><strong>Dimensions:</strong> {p.dimensions}</li>}
                {p.max_user_weight && <li><strong>Maximum user weight:</strong> {p.max_user_weight}</li>}
                <li><strong>Type:</strong> {p.listing_type === "hire" ? "For hire" : "For sale"}</li>
              </ul>
            </div>
          )}

          {p.safety_info && (
            <div className="mt-6 bg-[#FFF3E0] border border-[#FFCC80] rounded-2xl p-5 flex gap-3" data-testid="safety-info">
              <AlertTriangle size={22} className="text-[#E65100] shrink-0" />
              <div><strong className="text-[#E65100]">Safety & suitability:</strong> <span className="text-[#5a4a30]">{p.safety_info}</span></div>
            </div>
          )}

          {p.vat_relief_eligible && (
            <div className="mt-4 bg-[#E8F5E9] border border-[#A5D6A7] rounded-2xl p-5 flex gap-3">
              <Info size={22} className="text-[#1B5E20] shrink-0" />
              <div className="text-[#1B5E20]"><strong>VAT relief:</strong> If you are disabled or have a long-term illness and are buying for your own personal or domestic use, you may not have to pay VAT on this item. You'll complete a short declaration at checkout. Being elderly on its own does not qualify.</div>
            </div>
          )}
        </div>
      </div>

      {p.related?.length > 0 && (
        <div className="mt-16">
          <h2 className="font-heading text-3xl font-bold text-brand-green mb-8">Related equipment</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{p.related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
        </div>
      )}
    </div>
  );
}
