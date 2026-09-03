import React from "react";
import { Link } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { gbp } from "@/lib/api";
import { Trash2, Minus, Plus, ShoppingBasket } from "lucide-react";

export default function Cart() {
  const { items, setQty, remove } = useCart();
  const subtotalEx = items.reduce((s, i) => s + i.price_ex_vat * i.quantity, 0);

  if (items.length === 0) return (
    <div className="gc-container py-20 text-center" data-testid="empty-cart">
      <ShoppingBasket size={56} className="mx-auto text-brand-green/40 mb-4" />
      <h1 className="font-heading text-3xl font-bold text-brand-green mb-3">Your basket is empty</h1>
      <p className="text-lg text-[#4A4A4D] mb-6">Browse our pre-loved care equipment to get started.</p>
      <Link to="/shop" className="inline-block bg-brand-green text-white rounded-full px-7 py-3.5 font-semibold text-lg">Shop equipment</Link>
    </div>
  );

  return (
    <div className="gc-container py-10">
      <h1 className="font-heading text-4xl font-extrabold text-brand-green mb-8">Your basket</h1>
      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        <div className="space-y-4">
          {items.map((i) => (
            <div key={i.product_id} className="bg-white rounded-2xl border border-brand-border p-4 flex gap-4" data-testid={`cart-item-${i.sku}`}>
              {i.image && <img src={i.image} alt={i.name} className="w-24 h-24 object-cover rounded-xl" />}
              <div className="flex-1">
                <h3 className="font-heading text-lg font-bold text-brand-green">{i.name}</h3>
                <p className="text-sm text-[#4A4A4D]">{gbp(i.price_ex_vat)} + VAT {i.vat_relief_eligible ? "· VAT relief available" : ""}</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center border border-brand-border rounded-full">
                    <button onClick={() => setQty(i.product_id, i.quantity - 1)} className="p-2" aria-label="Decrease"><Minus size={16} /></button>
                    <span className="w-8 text-center font-bold">{i.quantity}</span>
                    <button onClick={() => setQty(i.product_id, i.quantity + 1)} className="p-2" aria-label="Increase"><Plus size={16} /></button>
                  </div>
                  <button onClick={() => remove(i.product_id)} className="text-brand-terracotta flex items-center gap-1 font-semibold" data-testid={`remove-${i.sku}`}><Trash2 size={16} /> Remove</button>
                </div>
              </div>
              <div className="font-bold text-lg">{gbp(i.price_ex_vat * i.quantity)}</div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-brand-border p-6 h-fit">
          <h2 className="font-heading text-xl font-bold text-brand-green mb-4">Summary</h2>
          <div className="flex justify-between mb-2 text-lg"><span>Subtotal (excl. VAT)</span><span className="font-bold">{gbp(subtotalEx)}</span></div>
          <p className="text-sm text-[#4A4A4D] mb-4">VAT and delivery are calculated at checkout, based on your VAT-relief eligibility.</p>
          <Link to="/checkout" className="block text-center bg-brand-green text-white rounded-full px-6 py-3.5 font-semibold text-lg hover:bg-brand-greenhover transition-colors" data-testid="checkout-btn">Go to checkout</Link>
          <Link to="/shop" className="block text-center mt-3 text-brand-green font-semibold hover:underline">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
