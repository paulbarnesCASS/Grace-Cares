import React, { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Heart } from "lucide-react";

export default function Wishlist() {
  const [f, setF] = useState({ name: "", email: "", item_description: "" });
  const submit = async (e) => {
    e.preventDefault();
    await api.post("/wishlist", f);
    toast.success("Thanks — we'll be in touch if we find a match.");
    setF({ name: "", email: "", item_description: "" });
  };
  const input = "w-full rounded-lg border border-[#8C8C8C] px-4 py-3 text-lg";
  return (
    <div className="gc-container py-12 max-w-xl">
      <Heart size={40} className="text-brand-terracotta mb-3" />
      <h1 className="font-heading text-4xl font-extrabold text-brand-green mb-2">Request an item</h1>
      <p className="text-lg text-[#4A4A4D] mb-6">Can't find what you need? Many items are being processed. Tell us what you're looking for and we'll let you know when it's available.</p>
      <form onSubmit={submit} className="bg-white rounded-2xl border border-brand-border p-6 space-y-4">
        <div><label className="block font-semibold mb-1">Your name</label><input required className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="wl-name" /></div>
        <div><label className="block font-semibold mb-1">Your email</label><input required type="email" className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="wl-email" /></div>
        <div><label className="block font-semibold mb-1">What are you looking for?</label><textarea required rows={3} className={input} value={f.item_description} onChange={(e) => setF({ ...f, item_description: e.target.value })} data-testid="wl-desc" /></div>
        <button className="bg-brand-green text-white rounded-full px-7 py-3.5 font-semibold text-lg" data-testid="wl-submit">Send request</button>
      </form>
    </div>
  );
}
