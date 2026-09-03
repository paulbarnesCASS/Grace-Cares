import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { SlidersHorizontal } from "lucide-react";

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [cats, setCats] = useState([]);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const q = params.get("q") || "";
  const category_id = params.get("category_id") || "";
  const condition = params.get("condition") || "";
  const fulfilment = params.get("fulfilment") || "";
  const vat_relief = params.get("vat_relief") || "";
  const sort = params.get("sort") || "recent";
  const in_stock = params.get("in_stock") || "";

  useEffect(() => { api.get("/categories").then((r) => setCats(r.data)); }, []);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category_id) p.set("category_id", category_id);
    if (condition) p.set("condition", condition);
    if (fulfilment) p.set("fulfilment", fulfilment);
    if (vat_relief) p.set("vat_relief", vat_relief);
    if (in_stock) p.set("in_stock", "true");
    p.set("sort", sort);
    api.get(`/products?${p.toString()}`).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [q, category_id, condition, fulfilment, vat_relief, sort, in_stock]);

  useEffect(() => { load(); }, [load]);

  const update = (key, val) => {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val); else next.delete(key);
    setParams(next);
  };

  return (
    <div className="gc-container py-10">
      <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-brand-green mb-2">Shop Care Equipment</h1>
      <p className="text-xl text-[#4A4A4D] mb-8">Quality pre-loved equipment, cleaned, safety-checked and priced fairly.</p>

      <div className="grid lg:grid-cols-[280px_1fr] gap-8">
        <aside className="bg-white rounded-2xl border border-brand-border p-6 h-fit" data-testid="shop-filters">
          <div className="flex items-center gap-2 mb-4 font-heading font-bold text-lg text-brand-green"><SlidersHorizontal size={20} /> Filters</div>
          <label className="block font-semibold mb-1">Search</label>
          <input value={q} onChange={(e) => update("q", e.target.value)} placeholder="Keyword…" className="w-full rounded-lg border border-[#8C8C8C] px-3 py-2.5 mb-4" data-testid="filter-search" />

          <label className="block font-semibold mb-1">Category</label>
          <select value={category_id} onChange={(e) => update("category_id", e.target.value)} className="w-full rounded-lg border border-[#8C8C8C] px-3 py-2.5 mb-4 bg-white" data-testid="filter-category">
            <option value="">All categories</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <label className="block font-semibold mb-1">Condition</label>
          <select value={condition} onChange={(e) => update("condition", e.target.value)} className="w-full rounded-lg border border-[#8C8C8C] px-3 py-2.5 mb-4 bg-white" data-testid="filter-condition">
            <option value="">Any condition</option>
            <option>Very Good</option><option>Good</option><option>Fair</option>
          </select>

          <label className="block font-semibold mb-1">Delivery / Collection</label>
          <select value={fulfilment} onChange={(e) => update("fulfilment", e.target.value)} className="w-full rounded-lg border border-[#8C8C8C] px-3 py-2.5 mb-4 bg-white" data-testid="filter-fulfilment">
            <option value="">Any</option>
            <option value="collection">Collection</option>
            <option value="delivery">Delivery available</option>
          </select>

          <label className="flex items-center gap-2 mb-3 font-semibold cursor-pointer">
            <input type="checkbox" checked={vat_relief === "true"} onChange={(e) => update("vat_relief", e.target.checked ? "true" : "")} className="h-5 w-5" data-testid="filter-vat" /> VAT relief available
          </label>
          <label className="flex items-center gap-2 font-semibold cursor-pointer">
            <input type="checkbox" checked={in_stock === "true"} onChange={(e) => update("in_stock", e.target.checked ? "true" : "")} className="h-5 w-5" data-testid="filter-instock" /> In stock only
          </label>
        </aside>

        <div>
          <div className="flex items-center justify-between mb-6">
            <span className="text-[#4A4A4D] font-semibold" data-testid="results-count">{data.total} products</span>
            <select value={sort} onChange={(e) => update("sort", e.target.value)} className="rounded-lg border border-[#8C8C8C] px-3 py-2 bg-white" data-testid="sort-select">
              <option value="recent">Most recent</option>
              <option value="price_low">Price: low to high</option>
              <option value="price_high">Price: high to low</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
          {loading ? <p className="text-lg">Loading…</p> : data.items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-brand-border p-10 text-center">
              <p className="text-xl text-[#4A4A4D]">No products match your search. Try different filters, or <a href="/wishlist" className="text-brand-terracotta font-semibold underline">request an item</a>.</p>
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
