import React, { useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { HandHeart, CheckCircle2 } from "lucide-react";

const TYPES = ["Wheelchair", "Bed", "Bathing aid", "Mobility aid", "Hoist", "Furniture", "Toilet aid", "Other"];

export default function DonateEquipment() {
  const [f, setF] = useState({
    donor_name: "", email: "", phone: "", location: "", postcode: "", equipment_type: "Wheelchair",
    manufacturer: "", model: "", approx_age: "", condition: "Good", working: true, fire_labels: "",
    dimensions: "", collection_preference: "collection", accessibility_info: "", notes: "", privacy_consent: false,
  });
  const [done, setDone] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    if (!f.privacy_consent) return toast.error("Please give privacy consent to continue.");
    try { const { data } = await api.post("/equipment-donations", f); setDone(data.reference); window.scrollTo(0, 0); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const input = "w-full rounded-lg border border-[#8C8C8C] px-4 py-3 text-lg";
  const label = "block font-semibold mb-1";

  if (done) return (
    <div className="gc-container py-20 max-w-xl text-center">
      <CheckCircle2 size={64} className="mx-auto text-[#1B5E20] mb-4" />
      <h1 className="font-heading text-3xl font-bold text-brand-green">Thank you for your donation offer</h1>
      <p className="text-lg text-[#4A4A4D] mt-3">Your reference is <strong>{done}</strong>. Our team will review it and be in touch. Submitting this form does not guarantee acceptance or collection.</p>
    </div>
  );

  return (
    <div className="gc-container py-12 max-w-3xl">
      <HandHeart size={44} className="text-brand-terracotta mb-3" />
      <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-brand-green mb-2">Donate care equipment</h1>
      <p className="text-xl text-[#4A4A4D] mb-4">Give your pre-loved equipment a second life. Please tell us about your item below.</p>
      <div className="bg-[#FFF3E0] border border-[#FFCC80] rounded-2xl p-5 mb-6 text-[#5a4a30]">
        <strong>Please note:</strong> we can accept larger clean, safe and working equipment. We cannot normally collect small items, and equipment must meet our safety and condition requirements. Submitting this form doesn't guarantee acceptance or collection.
      </div>
      <form onSubmit={submit} className="bg-white rounded-2xl border border-brand-border p-7 grid sm:grid-cols-2 gap-4">
        <div><label className={label}>Your name *</label><input required className={input} value={f.donor_name} onChange={(e) => setF({ ...f, donor_name: e.target.value })} data-testid="ed-name" /></div>
        <div><label className={label}>Email *</label><input required type="email" className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="ed-email" /></div>
        <div><label className={label}>Phone *</label><input required className={input} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} data-testid="ed-phone" /></div>
        <div><label className={label}>Postcode *</label><input required className={input} value={f.postcode} onChange={(e) => setF({ ...f, postcode: e.target.value })} data-testid="ed-postcode" /></div>
        <div className="sm:col-span-2"><label className={label}>Location / town *</label><input required className={input} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} data-testid="ed-location" /></div>
        <div><label className={label}>Equipment type *</label><select className={`${input} bg-white`} value={f.equipment_type} onChange={(e) => setF({ ...f, equipment_type: e.target.value })} data-testid="ed-type">{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className={label}>Condition *</label><select className={`${input} bg-white`} value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })} data-testid="ed-condition"><option>Very Good</option><option>Good</option><option>Fair</option></select></div>
        <div><label className={label}>Manufacturer</label><input className={input} value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} /></div>
        <div><label className={label}>Model</label><input className={input} value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></div>
        <div><label className={label}>Approximate age</label><input className={input} value={f.approx_age} onChange={(e) => setF({ ...f, approx_age: e.target.value })} /></div>
        <div><label className={label}>Fire labels attached? (if applicable)</label><input className={input} value={f.fire_labels} onChange={(e) => setF({ ...f, fire_labels: e.target.value })} placeholder="Yes / No / N/A" /></div>
        <label className="flex items-center gap-3 font-semibold cursor-pointer sm:col-span-2"><input type="checkbox" checked={f.working} onChange={(e) => setF({ ...f, working: e.target.checked })} className="h-5 w-5" data-testid="ed-working" /> This item is in working order</label>
        <div><label className={label}>Collection or drop-off?</label><select className={`${input} bg-white`} value={f.collection_preference} onChange={(e) => setF({ ...f, collection_preference: e.target.value })} data-testid="ed-collection"><option value="collection">Please collect</option><option value="dropoff">I can drop off</option></select></div>
        <div><label className={label}>Dimensions / size</label><input className={input} value={f.dimensions} onChange={(e) => setF({ ...f, dimensions: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className={label}>Accessibility or collection info</label><input className={input} value={f.accessibility_info} onChange={(e) => setF({ ...f, accessibility_info: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className={label}>Additional notes</label><textarea rows={3} className={input} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        <label className="sm:col-span-2 flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={f.privacy_consent} onChange={(e) => setF({ ...f, privacy_consent: e.target.checked })} className="h-5 w-5 mt-1" data-testid="ed-consent" /><span>I consent to Grace Cares storing this information to process my donation offer, in line with the privacy notice. *</span></label>
        <button className="sm:col-span-2 bg-brand-green text-white rounded-full px-7 py-4 font-semibold text-lg hover:bg-brand-greenhover transition-colors" data-testid="ed-submit">Submit donation offer</button>
      </form>
    </div>
  );
}
