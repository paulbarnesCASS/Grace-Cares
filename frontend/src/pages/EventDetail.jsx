import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, gbp, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import { Calendar, MapPin, Users, Accessibility, CheckCircle2, Clock } from "lucide-react";

export default function EventDetail() {
  const { slug } = useParams();
  const [e, setE] = useState(null);
  const [f, setF] = useState({ name: "", email: "", phone: "", num_attendees: 1 });
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); api.get(`/events/${slug}`).then((r) => setE(r.data)); }, [slug]);
  if (!e) return <div className="gc-container py-20 text-center text-xl">Loading…</div>;

  const book = async (ev) => {
    ev.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/bookings", { event_id: e.id, ...f, origin_url: window.location.origin });
      if (data.checkout_url) { window.location.href = data.checkout_url; return; }
      setDone(data); window.scrollTo(0, 0);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    setBusy(false);
  };
  const input = "w-full rounded-lg border border-[#8C8C8C] px-4 py-3 text-lg";
  const full = e.spots_left <= 0;

  return (
    <div className="gc-container py-10 max-w-4xl">
      {e.image && <img src={e.image} alt={e.name} className="w-full aspect-[21/9] object-cover rounded-2xl mb-8" />}
      <h1 className="font-heading text-4xl font-extrabold text-brand-green mb-4">{e.name}</h1>
      <div className="flex flex-wrap gap-4 text-[#4A4A4D] mb-6">
        <span className="flex items-center gap-2"><Calendar size={18} className="text-brand-green" /> {new Date(e.start_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        <span className="flex items-center gap-2"><MapPin size={18} className="text-brand-green" /> {e.venue}</span>
        <span className="flex items-center gap-2"><Users size={18} className="text-brand-green" /> {full ? "Full — waiting list open" : `${e.spots_left} spaces left`}</span>
        <span className="font-bold text-brand-green">{e.is_paid ? gbp(e.price) : "Free"}</span>
      </div>
      <p className="text-lg whitespace-pre-line mb-4">{e.description}</p>
      {e.accessibility_info && <div className="bg-brand-bone border border-brand-border rounded-xl p-4 mb-6 flex gap-2"><Accessibility size={20} className="text-brand-green shrink-0" /><span>{e.accessibility_info}</span></div>}

      <div className="bg-white rounded-2xl border border-brand-border p-7 max-w-xl" data-testid="booking-section">
        {done ? (
          <div className="text-center">
            <CheckCircle2 size={56} className="mx-auto text-[#1B5E20] mb-3" />
            <h2 className="font-heading text-2xl font-bold text-brand-green">{done.waiting_list ? "You're on the waiting list" : "Booking confirmed!"}</h2>
            <p className="text-lg text-[#4A4A4D] mt-2">Reference <strong>{done.reference}</strong>. {done.waiting_list ? "We'll contact you if a space opens up." : "A confirmation email is on its way."} {done.online_link_sent && "Your private joining link has been sent securely to your email."}</p>
          </div>
        ) : (
          <form onSubmit={book} className="space-y-4">
            <h2 className="font-heading text-2xl font-bold text-brand-green flex items-center gap-2">{full ? <><Clock size={22} /> Join the waiting list</> : "Book your place"}</h2>
            <div><label className="block font-semibold mb-1">Name *</label><input required className={input} value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} data-testid="book-name" /></div>
            <div><label className="block font-semibold mb-1">Email *</label><input required type="email" className={input} value={f.email} onChange={(x) => setF({ ...f, email: x.target.value })} data-testid="book-email" /></div>
            <div><label className="block font-semibold mb-1">Phone</label><input className={input} value={f.phone} onChange={(x) => setF({ ...f, phone: x.target.value })} /></div>
            <div><label className="block font-semibold mb-1">Number of attendees</label><input type="number" min="1" max={Math.max(1, e.spots_left || 1)} className={input} value={f.num_attendees} onChange={(x) => setF({ ...f, num_attendees: Number(x.target.value) })} data-testid="book-attendees" /></div>
            <button disabled={busy} className="w-full bg-brand-terracotta text-white rounded-full px-7 py-3.5 font-semibold text-lg hover:bg-brand-terracottahover transition-colors disabled:opacity-60" data-testid="book-submit">{busy ? "Please wait…" : full ? "Join waiting list" : e.is_paid ? `Book & pay ${gbp(e.price)}` : "Confirm free booking"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
