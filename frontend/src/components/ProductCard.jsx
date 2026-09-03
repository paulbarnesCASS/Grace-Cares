import React from "react";
import { Link } from "react-router-dom";
import { Leaf, ShieldCheck } from "lucide-react";
import { gbp } from "@/lib/api";

export function VatReliefBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#E8F5E9] text-[#1B5E20] text-sm font-bold border border-[#A5D6A7]" data-testid="vat-relief-badge">
      <ShieldCheck size={16} /> VAT relief available
    </span>
  );
}

export function ConditionBadge({ condition }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#FFF3E0] text-[#E65100] text-sm font-bold border border-[#FFCC80]" data-testid="condition-badge">
      {condition}
    </span>
  );
}

export default function ProductCard({ p }) {
  const soldOut = (p.available_qty ?? 0) <= 0 || p.status === "sold";
  return (
    <div className="bg-white rounded-xl border border-brand-border overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow" data-testid={`product-card-${p.sku}`}>
      <Link to={`/product/${p.id}`} className="block aspect-square w-full bg-brand-bone relative border-b border-brand-border">
        {p.images?.[0] ? (
          <img src={p.images[0]} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
        ) : <div className="w-full h-full flex flex-col items-center justify-center text-center p-3 border-2 border-dashed border-brand-green/30"><span className="font-heading text-sm font-bold text-brand-green">REAL PHOTO<br/>TO REPLACE</span></div>}
        {soldOut && <span className="absolute top-3 left-3 bg-brand-green text-white text-sm font-bold px-3 py-1 rounded-full">Sold</span>}
      </Link>
      <div className="p-5 flex flex-col flex-grow">
        <div className="flex flex-wrap gap-2 mb-2">
          <ConditionBadge condition={p.condition} />
          {p.vat_relief_eligible && <VatReliefBadge />}
        </div>
        <Link to={`/product/${p.id}`}><h3 className="font-heading text-xl font-bold text-brand-green mb-1 line-clamp-2 hover:underline">{p.name}</h3></Link>
        {p.carbon_saving_kg ? (
          <p className="text-sm text-[#1B5E20] flex items-center gap-1 mb-2"><Leaf size={15} /> Saves ~{p.carbon_saving_kg}kg CO₂e</p>
        ) : null}
        <div className="mt-auto pt-3">
          <div className="text-2xl font-bold text-[#1A1A1D]">{gbp(p.price_inc_vat)}</div>
          {p.vat_relief_eligible && (
            <div className="text-sm text-brand-terracotta font-semibold">{gbp(p.price_ex_vat)} with VAT relief</div>
          )}
          <Link to={`/product/${p.id}`} className="mt-3 block w-full text-center bg-brand-green text-white rounded-full px-5 py-2.5 font-semibold hover:bg-brand-greenhover transition-colors" data-testid={`view-product-${p.sku}`}>View details</Link>
        </div>
      </div>
    </div>
  );
}
