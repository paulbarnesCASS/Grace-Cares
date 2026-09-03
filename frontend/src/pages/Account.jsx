import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, gbp } from "@/lib/api";
import { toast } from "sonner";
import { LogOut, Package, Calendar, Settings, ShieldQuestion } from "lucide-react";

export default function Account() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (user === false) { nav("/login"); return; }
    if (user) {
      setMarketing(!!user.marketing_consent);
      api.get("/orders/mine").then((r) => setOrders(r.data)).catch(() => {});
      api.get("/account/bookings").then((r) => setBookings(r.data)).catch(() => {});
    }
  }, [user, nav]);

  if (!user) return <div className="gc-container py-20 text-center text-xl">Loading…</div>;

  const savePrefs = async () => { await api.put("/account/preferences", { marketing_consent: marketing }); toast.success("Preferences updated"); };
  const requestDeletion = async () => { await api.post("/account/request-deletion"); toast.success("Deletion request received"); };
  const doLogout = async () => { await logout(); nav("/"); };

  const TABS = [["orders", "My orders", Package], ["bookings", "My bookings", Calendar], ["prefs", "Preferences", Settings]];

  return (
    <div className="gc-container py-12">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-4xl font-extrabold text-brand-green">My account</h1>
          <p className="text-lg text-[#4A4A4D]">Hello, {user.name}</p>
        </div>
        <button onClick={doLogout} className="inline-flex items-center gap-2 border-2 border-brand-green text-brand-green rounded-full px-5 py-2.5 font-semibold" data-testid="logout-btn"><LogOut size={18} /> Sign out</button>
      </div>
      <div className="flex gap-2 mb-8 flex-wrap">
        {TABS.map(([k, label, I]) => (
          <button key={k} onClick={() => setTab(k)} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-semibold ${tab === k ? "bg-brand-green text-white" : "bg-white border border-brand-border text-brand-green"}`} data-testid={`account-tab-${k}`}><I size={18} /> {label}</button>
        ))}
      </div>

      {tab === "orders" && (
        <div className="space-y-4" data-testid="orders-list">
          {orders.length === 0 ? <p className="text-lg text-[#4A4A4D]">You have no orders yet.</p> : orders.map((o) => (
            <div key={o.id} className="bg-white rounded-2xl border border-brand-border p-5">
              <div className="flex justify-between flex-wrap gap-2">
                <div><strong>{o.reference}</strong> · {new Date(o.created_at).toLocaleDateString("en-GB")}</div>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${o.status === "paid" ? "bg-[#E8F5E9] text-[#1B5E20]" : "bg-[#FFF3E0] text-[#E65100]"}`}>{o.status}</span>
              </div>
              <div className="mt-2 text-[#4A4A4D]">{o.items?.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</div>
              <div className="mt-1 font-bold">{gbp(o.totals?.total_payable)} · {o.fulfilment}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "bookings" && (
        <div className="space-y-4" data-testid="bookings-list">
          {bookings.length === 0 ? <p className="text-lg text-[#4A4A4D]">You have no event bookings yet.</p> : bookings.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl border border-brand-border p-5 flex justify-between flex-wrap gap-2">
              <div><strong>{b.event_name}</strong><div className="text-[#4A4A4D]">Ref {b.reference} · {b.num_attendees} attendee(s)</div></div>
              <span className="px-3 py-1 rounded-full text-sm font-bold bg-[#E8F5E9] text-[#1B5E20]">{b.status}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "prefs" && (
        <div className="bg-white rounded-2xl border border-brand-border p-7 max-w-lg space-y-5">
          <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="h-5 w-5 mt-1" data-testid="pref-marketing" /><span>Send me Grace Cares news and offers by email.</span></label>
          <button onClick={savePrefs} className="bg-brand-green text-white rounded-full px-6 py-3 font-semibold" data-testid="save-prefs">Save preferences</button>
          <hr className="border-brand-border" />
          <div className="flex items-start gap-2 text-[#4A4A4D]"><ShieldQuestion size={20} className="shrink-0 mt-0.5" /><span>You can request that we delete your account and data. We'll process this in line with our retention policy.</span></div>
          <button onClick={requestDeletion} className="border-2 border-brand-terracotta text-brand-terracotta rounded-full px-6 py-3 font-semibold" data-testid="request-deletion">Request account deletion</button>
        </div>
      )}
    </div>
  );
}
