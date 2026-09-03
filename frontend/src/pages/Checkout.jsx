import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { api, gbp, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { ShieldCheck, Info, Loader2 } from "lucide-react";

export default function Checkout() {
  const { items, clear } = useCart();
  const nav = useNavigate();
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", address_line1: "", address_line2: "", city: "", postcode: "" });
  const [fulfilment, setFulfilment] = useState("collection");
  const [donation, setDonation] = useState(0);
  const [marketing, setMarketing] = useState(false);
  const [terms, setTerms] = useState(false);
  const [vatChoice, setVatChoice] = useState("none"); // none, personal, behalf, not_qualify
  const [decl, setDecl] = useState({ eligible_person_name: "", eligible_person_address: "", condition_description: "", for_personal_domestic_use: true, completed_by_name: "", relationship: "", info_accurate: false, signature: "" });
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);

  const hasEligible = items.some((i) => i.vat_relief_eligible);
  const claimingRelief = hasEligible && (vatChoice === "personal" || vatChoice === "behalf");

  const buildBody = () => ({
    items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
    customer, fulfilment,
    vat_relief_claim: claimingRelief,
    declaration: claimingRelief ? decl : null,
    donation_amount: Number(donation) || 0,
    marketing_consent: marketing, accept_terms: terms,
    origin_url: window.location.origin,
  });

  useEffect(() => {
    if (items.length === 0) return;
    const body = buildBody(); body.accept_terms = true;
    api.post("/checkout/quote", body).then((r) => setQuote(r.data.totals)).catch(() => {});
    // eslint-disable-next-line
  }, [items, fulfilment, donation, vatChoice, decl.for_personal_domestic_use, decl.info_accurate, decl.eligible_person_name, decl.condition_description]);

  if (items.length === 0) { return <div className="gc-container py-20 text-center text-xl">Your basket is empty. <a href="/shop" className="text-brand-terracotta underline">Shop equipment</a></div>; }

  const pay = async (e) => {
    e.preventDefault();
    if (!terms) return toast.error("Please accept the terms and conditions.");
    if (claimingRelief && (!decl.eligible_person_name || !decl.condition_description || !decl.info_accurate || !decl.signature)) {
      return toast.error("Please complete all required VAT-relief declaration fields.");
    }
    setBusy(true);
    try {
      const { data } = await api.post("/checkout", buildBody());
      clear();
      window.location.href = data.checkout_url;
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Checkout failed");
      setBusy(false);
    }
  };

  const input = "w-full rounded-lg border border-[#8C8C8C] bg-white px-4 py-3 text-lg focus:border-brand-green";
  const label = "block text-base font-semibold text-[#1A1A1D] mb-1";

  return (
    <div className="gc-container py-10">
      <h1 className="font-heading text-4xl font-extrabold text-brand-green mb-8">Secure checkout</h1>
      <form onSubmit={pay} className="grid lg:grid-cols-[1fr_380px] gap-8">
        <div className="space-y-6">
          {/* Billing */}
          <section className="bg-white rounded-2xl border border-brand-border p-6" data-testid="billing-section">
            <h2 className="font-heading text-2xl font-bold text-brand-green mb-4">Your details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className={label}>Full name *</label><input required className={input} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} data-testid="checkout-name" /></div>
              <div><label className={label}>Email *</label><input required type="email" className={input} value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} data-testid="checkout-email" /></div>
              <div><label className={label}>Phone</label><input className={input} value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} data-testid="checkout-phone" /></div>
              <div><label className={label}>Postcode *</label><input required className={input} value={customer.postcode} onChange={(e) => setCustomer({ ...customer, postcode: e.target.value })} data-testid="checkout-postcode" /></div>
              <div className="sm:col-span-2"><label className={label}>Address line 1 *</label><input required className={input} value={customer.address_line1} onChange={(e) => setCustomer({ ...customer, address_line1: e.target.value })} data-testid="checkout-address1" /></div>
              <div className="sm:col-span-2"><label className={label}>Town / City *</label><input required className={input} value={customer.city} onChange={(e) => setCustomer({ ...customer, city: e.target.value })} data-testid="checkout-city" /></div>
            </div>
          </section>

          {/* Fulfilment */}
          <section className="bg-white rounded-2xl border border-brand-border p-6">
            <h2 className="font-heading text-2xl font-bold text-brand-green mb-4">Collection or delivery</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {["collection", "delivery"].map((f) => (
                <label key={f} className={`flex items-center gap-3 rounded-xl border-2 p-4 cursor-pointer ${fulfilment === f ? "border-brand-green bg-brand-bone" : "border-brand-border"}`} data-testid={`fulfilment-${f}`}>
                  <input type="radio" name="fulfilment" checked={fulfilment === f} onChange={() => setFulfilment(f)} className="h-5 w-5" />
                  <span className="font-semibold capitalize">{f === "collection" ? "Collection from Lichfield" : "Delivery (charge applies)"}</span>
                </label>
              ))}
            </div>
          </section>

          {/* VAT relief */}
          {hasEligible && (
            <section className="bg-white rounded-2xl border-2 border-[#A5D6A7] p-6" data-testid="vat-relief-section">
              <div className="flex items-center gap-2 mb-3"><ShieldCheck className="text-[#1B5E20]" /><h2 className="font-heading text-2xl font-bold text-brand-green">VAT relief declaration</h2></div>
              <div className="bg-[#E8F5E9] rounded-xl p-4 text-[#1B5E20] mb-4 flex gap-2">
                <Info size={20} className="shrink-0 mt-0.5" />
                <div className="text-base">
                  <p className="mb-1">Your basket contains items that may qualify for VAT relief. To claim, both must be true: the product is approved as eligible, <strong>and</strong> you complete the declaration below.</p>
                  <ul className="list-disc ml-5 space-y-0.5">
                    <li>Being elderly on its own does not qualify.</li>
                    <li>A temporary injury or condition does not normally qualify.</li>
                    <li>If you don't qualify or don't complete the declaration, standard VAT applies to those items.</li>
                  </ul>
                </div>
              </div>
              <p className={label}>Is this purchase for…</p>
              <div className="space-y-2 mb-4">
                {[["personal", "My own personal or domestic use (I am disabled or have a long-term illness)"],
                  ["behalf", "An eligible person I am purchasing on behalf of"],
                  ["not_qualify", "Another purpose — I do not qualify / do not wish to claim (standard VAT applies)"]].map(([v, t]) => (
                  <label key={v} className="flex items-start gap-3 cursor-pointer" data-testid={`vat-choice-${v}`}>
                    <input type="radio" name="vat" checked={vatChoice === v} onChange={() => setVatChoice(v)} className="h-5 w-5 mt-1" />
                    <span>{t}</span>
                  </label>
                ))}
              </div>

              {claimingRelief && (
                <div className="grid sm:grid-cols-2 gap-4 border-t border-brand-border pt-4" data-testid="declaration-fields">
                  <div className="sm:col-span-2"><label className={label}>Full name of the eligible person *</label><input className={input} value={decl.eligible_person_name} onChange={(e) => setDecl({ ...decl, eligible_person_name: e.target.value })} data-testid="decl-name" /></div>
                  <div className="sm:col-span-2"><label className={label}>Address of the eligible person *</label><input className={input} value={decl.eligible_person_address} onChange={(e) => setDecl({ ...decl, eligible_person_address: e.target.value })} data-testid="decl-address" /></div>
                  <div className="sm:col-span-2"><label className={label}>Description of the disability or long-term illness *</label><textarea className={input} rows={2} value={decl.condition_description} onChange={(e) => setDecl({ ...decl, condition_description: e.target.value })} data-testid="decl-condition" /></div>
                  {vatChoice === "behalf" && (<>
                    <div><label className={label}>Your name (person completing)</label><input className={input} value={decl.completed_by_name} onChange={(e) => setDecl({ ...decl, completed_by_name: e.target.value })} data-testid="decl-completedby" /></div>
                    <div><label className={label}>Your relationship to them</label><input className={input} value={decl.relationship} onChange={(e) => setDecl({ ...decl, relationship: e.target.value })} data-testid="decl-relationship" /></div>
                  </>)}
                  <label className="sm:col-span-2 flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={decl.for_personal_domestic_use} onChange={(e) => setDecl({ ...decl, for_personal_domestic_use: e.target.checked })} className="h-5 w-5 mt-1" data-testid="decl-domestic" /><span>I confirm the goods are for the eligible person's personal or domestic use.</span></label>
                  <label className="sm:col-span-2 flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={decl.info_accurate} onChange={(e) => setDecl({ ...decl, info_accurate: e.target.checked })} className="h-5 w-5 mt-1" data-testid="decl-accurate" /><span>I declare that the information above is accurate and complete.</span></label>
                  <div className="sm:col-span-2"><label className={label}>Electronic signature (type your full name) *</label><input className={input} value={decl.signature} onChange={(e) => setDecl({ ...decl, signature: e.target.value })} data-testid="decl-signature" /></div>
                </div>
              )}
            </section>
          )}

          {/* Donation */}
          <section className="bg-white rounded-2xl border border-brand-border p-6">
            <h2 className="font-heading text-2xl font-bold text-brand-green mb-2">Add a donation (optional)</h2>
            <p className="text-[#4A4A4D] mb-3">If you'd like, you can add a donation to help fund hardship grants. There's no obligation.</p>
            <div className="flex gap-2 flex-wrap">
              {[0, 5, 10, 20].map((a) => <button type="button" key={a} onClick={() => setDonation(a)} className={`rounded-full px-5 py-2.5 font-semibold border-2 ${Number(donation) === a ? "border-brand-terracotta bg-brand-terracotta text-white" : "border-brand-border"}`} data-testid={`donation-${a}`}>{a === 0 ? "No thanks" : gbp(a)}</button>)}
              <input type="number" min="0" placeholder="Other £" value={donation || ""} onChange={(e) => setDonation(e.target.value)} className="w-32 rounded-full border border-[#8C8C8C] px-4 py-2.5" data-testid="donation-custom" />
            </div>
          </section>

          {/* Consent */}
          <section className="bg-white rounded-2xl border border-brand-border p-6 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="h-5 w-5 mt-1" data-testid="marketing-consent" /><span>Keep me updated with Grace Cares news and offers by email. (Optional)</span></label>
            <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="h-5 w-5 mt-1" data-testid="terms-consent" /><span>I accept the <a href="/terms" className="text-brand-terracotta underline">terms and conditions</a> and <a href="/privacy" className="text-brand-terracotta underline">privacy notice</a>. *</span></label>
          </section>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-2xl border border-brand-border p-6 h-fit lg:sticky lg:top-40" data-testid="order-summary">
          <h2 className="font-heading text-xl font-bold text-brand-green mb-4">Order summary</h2>
          <div className="space-y-2 mb-3 max-h-48 overflow-auto">
            {items.map((i) => <div key={i.product_id} className="flex justify-between text-base"><span>{i.quantity}× {i.name}</span><span>{gbp(i.price_ex_vat * i.quantity)}</span></div>)}
          </div>
          {quote && (
            <div className="border-t border-brand-border pt-3 space-y-1.5 text-base" data-testid="totals-breakdown">
              <div className="flex justify-between"><span>Subtotal (excl. VAT)</span><span>{gbp(quote.subtotal_ex_vat)}</span></div>
              {Object.entries(quote.vat_breakdown || {}).map(([rate, v]) => (
                <div key={rate} className="flex justify-between text-[#4A4A4D]"><span>VAT at {rate}</span><span>{gbp(v.vat)}</span></div>
              ))}
              {quote.delivery_total > 0 && <div className="flex justify-between"><span>Delivery</span><span>{gbp(quote.delivery_total)}</span></div>}
              {quote.donation > 0 && <div className="flex justify-between"><span>Donation</span><span>{gbp(quote.donation)}</span></div>}
              {claimingRelief && quote.declaration_valid && <div className="text-[#1B5E20] font-semibold text-sm">✓ VAT relief applied to eligible items</div>}
              <div className="flex justify-between text-xl font-bold text-brand-green border-t border-brand-border pt-2 mt-2"><span>Total to pay</span><span data-testid="total-payable">{gbp(quote.total_payable)}</span></div>
            </div>
          )}
          <button disabled={busy} className="mt-5 w-full bg-brand-terracotta text-white rounded-full px-6 py-4 font-semibold text-lg hover:bg-brand-terracottahover transition-colors disabled:opacity-60 flex items-center justify-center gap-2" data-testid="pay-now-btn">
            {busy ? <><Loader2 className="animate-spin" size={20} /> Redirecting…</> : "Pay securely with Stripe"}
          </button>
          <p className="text-xs text-[#4A4A4D] mt-3 text-center">Payments are processed securely by Stripe. We never store your card details.</p>
        </div>
      </form>
    </div>
  );
}
