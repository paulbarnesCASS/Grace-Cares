import React, { useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

const OPTIONS = {
  caregiver_support: "Unpaid caregiver support",
  older_person_support: "Older-person support",
  hardship_grant: "Hardship or equipment grant",
  activities: "Monthly activities",
  general: "General help",
  nhs: "NHS enquiry",
  care_provider: "Care-provider enquiry",
  corporate: "Corporate partnership",
  volunteering: "Volunteering",
  fundraising: "Fundraising",
  other: "Other enquiry",
};

export default function EnquiryForm({ title, intro, presetType, allowed }) {
  const keys = allowed || Object.keys(OPTIONS);
  const [f, setF] = useState({ enquiry_type: presetType || keys[0], name: "", email: "", phone: "", message: "", consent: false });
  const [done, setDone] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    try { const { data } = await api.post("/enquiries", f); setDone(data.reference); window.scrollTo(0, 0); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const input = "w-full rounded-lg border border-[#8C8C8C] px-4 py-3 text-lg";
  const label = "block font-semibold mb-1";

  if (done) return (
    <div className="bg-white rounded-2xl border border-brand-border p-8 text-center">
      <CheckCircle2 size={56} className="mx-auto text-[#1B5E20] mb-3" />
      <h2 className="font-heading text-2xl font-bold text-brand-green">Thank you — your enquiry has been sent</h2>
      <p className="text-lg text-[#4A4A4D] mt-2">Reference <strong>{done}</strong>. The right team will be in touch soon.</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-brand-border p-7 space-y-4">
      {title && <h2 className="font-heading text-2xl font-bold text-brand-green">{title}</h2>}
      {intro && <p className="text-[#4A4A4D]">{intro}</p>}
      <div><label className={label}>What is your enquiry about? *</label>
        <select className={`${input} bg-white`} value={f.enquiry_type} onChange={(e) => setF({ ...f, enquiry_type: e.target.value })} data-testid="enq-type">
          {keys.map((k) => <option key={k} value={k}>{OPTIONS[k]}</option>)}
        </select>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className={label}>Name *</label><input required className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="enq-name" /></div>
        <div><label className={label}>Email *</label><input required type="email" className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="enq-email" /></div>
      </div>
      <div><label className={label}>Phone</label><input className={input} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      <div><label className={label}>How can we help? *</label><textarea required rows={4} className={input} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} data-testid="enq-message" /></div>
      <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} className="h-5 w-5 mt-1" data-testid="enq-consent" /><span>I consent to Grace Cares contacting me about this enquiry.</span></label>
      <button className="bg-brand-green text-white rounded-full px-7 py-3.5 font-semibold text-lg hover:bg-brand-greenhover transition-colors" data-testid="enq-submit">Send enquiry</button>
    </form>
  );
}
