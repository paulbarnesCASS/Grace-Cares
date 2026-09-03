import React, { useState } from "react";
import { api, gbp, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { HandHeart, Loader2 } from "lucide-react";

export default function DonateFunds() {
  const [amount, setAmount] = useState(20);
  const [recurring, setRecurring] = useState(false);
  const [f, setF] = useState({ name: "", email: "", message: "", dedication: "" });
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);

  const donate = async (e) => {
    e.preventDefault();
    if (!amount || amount <= 0) return toast.error("Please choose an amount.");
    setBusy(true);
    try {
      const { data } = await api.post("/donations", { amount: Number(amount), recurring, ...f, marketing_consent: marketing, origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); setBusy(false); }
  };
  const input = "w-full rounded-lg border border-[#8C8C8C] px-4 py-3 text-lg";
  return (
    <div className="gc-container py-12 max-w-2xl">
      <HandHeart size={44} className="text-brand-terracotta mb-3" />
      <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-brand-green mb-2">Support our work</h1>
      <p className="text-xl text-[#4A4A4D] mb-8">Your gift helps fund hardship grants and community activities for older people and unpaid caregivers.</p>
      <form onSubmit={donate} className="bg-white rounded-2xl border border-brand-border p-7 space-y-5">
        <div className="flex gap-2 flex-wrap">
          {[10, 20, 50, 100].map((a) => <button type="button" key={a} onClick={() => setAmount(a)} className={`rounded-full px-6 py-3 font-semibold border-2 text-lg ${Number(amount) === a ? "border-brand-terracotta bg-brand-terracotta text-white" : "border-brand-border"}`} data-testid={`donate-amt-${a}`}>{gbp(a)}</button>)}
          <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-32 rounded-full border border-[#8C8C8C] px-4 py-3 text-lg" data-testid="donate-custom-amt" />
        </div>
        <label className="flex items-center gap-3 cursor-pointer font-semibold"><input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="h-5 w-5" data-testid="donate-recurring" /> Make this a monthly gift</label>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="block font-semibold mb-1">Name *</label><input required className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="donate-name" /></div>
          <div><label className="block font-semibold mb-1">Email *</label><input required type="email" className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="donate-email" /></div>
        </div>
        <div><label className="block font-semibold mb-1">Dedication or message (optional)</label><input className={input} value={f.dedication} onChange={(e) => setF({ ...f, dedication: e.target.value })} data-testid="donate-dedication" /></div>
        <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="h-5 w-5 mt-1" data-testid="donate-marketing" /><span>Keep me updated with Grace Cares news by email. (Optional)</span></label>
        <button disabled={busy} className="w-full bg-brand-terracotta text-white rounded-full px-7 py-4 font-semibold text-lg hover:bg-brand-terracottahover transition-colors flex items-center justify-center gap-2 disabled:opacity-60" data-testid="donate-submit">{busy ? <><Loader2 className="animate-spin" size={20} /> Redirecting…</> : `Donate ${gbp(amount || 0)}${recurring ? " / month" : ""}`}</button>
      </form>
    </div>
  );
}
