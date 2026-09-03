import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

const CartContext = createContext(null);
const KEY = "gc_cart";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);

  const add = (product, qty = 1) => {
    setItems((prev) => {
      const found = prev.find((i) => i.product_id === product.id);
      const max = product.available_qty ?? 1;
      if (found) {
        const nextQty = Math.min(found.quantity + qty, max);
        return prev.map((i) => (i.product_id === product.id ? { ...i, quantity: nextQty } : i));
      }
      return [...prev, {
        product_id: product.id, name: product.name, sku: product.sku,
        price_ex_vat: product.price_ex_vat, vat_rate: product.vat_rate,
        vat_relief_eligible: product.vat_relief_eligible, image: (product.images || [])[0],
        quantity: Math.min(qty, max), max,
      }];
    });
    toast.success(`${product.name} added to basket`);
  };
  const setQty = (pid, qty) => setItems((prev) => prev.map((i) => i.product_id === pid ? { ...i, quantity: Math.max(1, Math.min(qty, i.max)) } : i));
  const remove = (pid) => setItems((prev) => prev.filter((i) => i.product_id !== pid));
  const clear = () => setItems([]);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const hasVatEligible = items.some((i) => i.vat_relief_eligible);

  return (
    <CartContext.Provider value={{ items, add, setQty, remove, clear, count, hasVatEligible }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
