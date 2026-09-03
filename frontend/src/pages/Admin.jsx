import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, gbp, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import {
  LayoutDashboard, Package, ShoppingCart, ShieldCheck, HandHeart, Calendar,
  RefreshCw, Users, MessageSquare, FileText, LogOut, Plus, Leaf, AlertTriangle, Download,
  Link2, ClipboardList, CheckCircle2,
} from "lucide-react";

const SECTIONS = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["products", "Products", Package],
  ["orders", "Orders", ShoppingCart],
  ["vat", "VAT Declarations", ShieldCheck],
  ["equipment", "Equipment Donations", HandHeart],
  ["events", "Events & Bookings", Calendar],
  ["guided", "Guided Listing", ClipboardList],
  ["xero", "Xero Sync", RefreshCw],
  ["enquiries", "Enquiries", MessageSquare],
  ["donations", "Financial Donations", HandHeart],
  ["users", "Users & Roles", Users],
  ["redirects", "Redirects & SEO", Link2],
];

const ROLES = ["customer", "super_admin", "shop_admin", "finance_admin", "content_admin", "events_admin", "support_admin", "readonly", "product_contributor", "product_approver"];

export default function Admin() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [section, setSection] = useState("dashboard");

  useEffect(() => {
    if (user === false) nav("/login");
    else if (user && user.role === "customer") nav("/account");
  }, [user, nav]);

  if (!user || user.role === "customer") return <div className="gc-container py-20 text-center text-xl">Loading…</div>;

  return (
    <div className="min-h-screen flex bg-brand-bone">
      <aside className="w-64 bg-brand-green text-white flex flex-col shrink-0 min-h-screen sticky top-0" data-testid="admin-sidebar">
        <div className="p-5 font-heading font-extrabold text-2xl border-b border-white/15">Grace Cares</div>
        <nav className="flex-1 p-3 space-y-1 overflow-auto">
          {SECTIONS.map(([k, label, I]) => (
            <button key={k} onClick={() => setSection(k)} className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left font-semibold min-h-[44px] ${section === k ? "bg-white/20" : "hover:bg-white/10"}`} data-testid={`admin-nav-${k}`}>
              <I size={20} /> {label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/15">
          <div className="text-sm text-white/70 px-2 mb-2">{user.email}<br />({user.role})</div>
          <button onClick={async () => { await logout(); nav("/"); }} className="w-full flex items-center gap-2 rounded-lg px-4 py-2.5 hover:bg-white/10 font-semibold" data-testid="admin-logout"><LogOut size={18} /> Sign out</button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        {section === "dashboard" && <Dashboard />}
        {section === "products" && <Products />}
        {section === "orders" && <Orders />}
        {section === "vat" && <VatDeclarations />}
        {section === "equipment" && <EquipmentDonations />}
        {section === "events" && <EventsAdmin />}
        {section === "xero" && <Xero />}
        {section === "enquiries" && <Enquiries />}
        {section === "donations" && <Donations />}
        {section === "guided" && <GuidedListing />}
        {section === "redirects" && <Redirects />}
        {section === "users" && <UsersAdmin />}
      </main>
    </div>
  );
}

const H = ({ children }) => <h1 className="font-heading text-3xl font-bold text-brand-green mb-6">{children}</h1>;
const Card = ({ children, className = "" }) => <div className={`bg-white rounded-xl border border-brand-border p-6 ${className}`}>{children}</div>;

function Dashboard() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/admin/reports/summary").then((r) => setS(r.data)).catch(() => {}); }, []);
  if (!s) return <div>Loading…</div>;
  const stats = [
    ["Total sales (inc VAT)", gbp(s.total_sales_inc_vat)], ["Sales ex VAT", gbp(s.total_sales_ex_vat)],
    ["VAT collected", gbp(s.total_vat)], ["Zero-rated sales", gbp(s.zero_rated_sales)],
    ["Donations", gbp(s.donations_total)], ["Refunds", gbp(s.refunds_total)],
    ["Average order value", gbp(s.average_order_value)], ["Orders", s.orders_count],
    ["Items reused", s.equipment_saved], ["Event bookings", s.event_bookings],
    ["Resource downloads", s.resource_downloads], ["Email signups", s.email_signups],
  ];
  return (
    <div data-testid="admin-dashboard">
      <div className="flex justify-between items-center mb-6">
        <H>Dashboard</H>
        <a href={`${api.defaults.baseURL}/admin/reports/orders.csv`} className="inline-flex items-center gap-2 bg-brand-green text-white rounded-full px-5 py-2.5 font-semibold"><Download size={18} /> Export orders CSV</a>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map(([l, v]) => (
          <Card key={l}><div className="text-3xl font-bold text-brand-terracotta font-heading">{v}</div><div className="text-[#4A4A4D] mt-1">{l}</div></Card>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card><div className="flex items-center gap-2 font-bold text-brand-green mb-2"><Leaf size={20} /> Estimated carbon saved</div><div className="text-3xl font-bold">{s.estimated_carbon_saving_kg} kg CO₂e</div></Card>
        <Card>
          <div className="flex items-center gap-2 font-bold text-[#E65100] mb-2"><AlertTriangle size={20} /> Low stock ({s.low_stock_count})</div>
          <ul className="text-[#4A4A4D]">{s.low_stock_products.slice(0, 6).map((p) => <li key={p.id}>{p.name} ({Math.max(0, (p.quantity_available || 0) - (p.quantity_reserved || 0))} left)</li>)}</ul>
        </Card>
      </div>
    </div>
  );
}

const EMPTY_PRODUCT = {
  name: "", sku: "", description: "", condition: "Good", price_ex_vat: 0, vat_rate: 0.2,
  vat_relief_eligible: false, quantity_available: 1, images: [], category_id: "",
  dimensions: "", max_user_weight: "", carbon_saving_kg: 0, delivery_charge: 25,
  fulfilment_options: ["collection", "delivery"], listing_type: "sale", status: "available",
  safety_info: "", admin_notes: "", featured: false, seo_title: "", seo_description: "",
  specifications: {}, related_ids: [], subcategory_id: null,
};

function Products() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = async () => {
    const [pub, draft] = await Promise.all([
      api.get("/products?limit=200"),
      api.get("/admin/products-review").catch(() => ({ data: [] })),
    ]);
    const map = {};
    [...pub.data.items, ...draft.data].forEach((p) => { map[p.id] = p; });
    setItems(Object.values(map));
  };
  const approve = async (id) => { await api.post(`/products/${id}/approve`); toast.success("Published — now live in the shop"); load(); };
  useEffect(() => { load(); api.get("/categories?include_hidden=true").then((r) => setCats(r.data)); }, []);

  const save = async () => {
    const body = { ...edit, price_ex_vat: Number(edit.price_ex_vat), quantity_available: Number(edit.quantity_available), carbon_saving_kg: Number(edit.carbon_saving_kg) || 0, delivery_charge: Number(edit.delivery_charge) || 0, vat_rate: Number(edit.vat_rate) || 0.2, images: typeof edit.images === "string" ? edit.images.split(",").map((s) => s.trim()).filter(Boolean) : edit.images };
    try {
      if (edit.id) await api.put(`/products/${edit.id}`, body); else await api.post("/products", body);
      toast.success("Product saved"); setEdit(null); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const del = async (id) => { if (!window.confirm("Delete this product?")) return; await api.delete(`/products/${id}`); toast.success("Deleted"); load(); };

  const input = "w-full rounded-lg border border-[#8C8C8C] px-3 py-2";
  return (
    <div data-testid="admin-products">
      <div className="flex justify-between items-center mb-6"><H>Products</H><button onClick={() => setEdit({ ...EMPTY_PRODUCT })} className="inline-flex items-center gap-2 bg-brand-terracotta text-white rounded-full px-5 py-2.5 font-semibold" data-testid="add-product-btn"><Plus size={18} /> Add product</button></div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left"><thead className="bg-brand-bone"><tr><th className="p-3">Name</th><th className="p-3">SKU</th><th className="p-3">Price ex VAT</th><th className="p-3">VAT relief</th><th className="p-3">Stock</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead>
          <tbody>{items.map((p, i) => (
            <tr key={p.id} className={i % 2 ? "bg-brand-bone" : ""} data-testid={`product-row-${p.sku}`}>
              <td className="p-3 font-semibold">{p.name}</td><td className="p-3">{p.sku}</td><td className="p-3">{gbp(p.price_ex_vat)}</td>
              <td className="p-3">{p.vat_relief_eligible ? "Yes" : "No"}</td><td className="p-3">{p.available_qty}</td><td className="p-3">{p.status}</td>
              <td className="p-3 whitespace-nowrap">
                {(p.status === "draft" || p.status === "awaiting_approval") && <button onClick={() => approve(p.id)} className="text-[#1B5E20] font-bold mr-3" data-testid={`approve-${p.sku}`}>Publish</button>}
                <button onClick={() => setEdit({ ...p, images: (p.images || []).join(", ") })} className="text-brand-green font-semibold mr-3" data-testid={`edit-${p.sku}`}>Edit</button><button onClick={() => del(p.id)} className="text-brand-terracotta font-semibold">Delete</button></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>

      {edit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-auto" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl p-7 max-w-2xl w-full my-8 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()} data-testid="product-modal">
            <h2 className="font-heading text-2xl font-bold text-brand-green mb-4">{edit.id ? "Edit" : "New"} product</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className="font-semibold">Name</label><input className={input} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} data-testid="pm-name" /></div>
              <div><label className="font-semibold">SKU</label><input className={input} value={edit.sku} onChange={(e) => setEdit({ ...edit, sku: e.target.value })} data-testid="pm-sku" /></div>
              <div><label className="font-semibold">Category</label><select className={`${input} bg-white`} value={edit.category_id || ""} onChange={(e) => setEdit({ ...edit, category_id: e.target.value })} data-testid="pm-category"><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className="font-semibold">Price ex VAT (£)</label><input type="number" step="0.01" className={input} value={edit.price_ex_vat} onChange={(e) => setEdit({ ...edit, price_ex_vat: e.target.value })} data-testid="pm-price" /></div>
              <div><label className="font-semibold">Quantity</label><input type="number" className={input} value={edit.quantity_available} onChange={(e) => setEdit({ ...edit, quantity_available: e.target.value })} data-testid="pm-qty" /></div>
              <div><label className="font-semibold">Condition</label><select className={`${input} bg-white`} value={edit.condition} onChange={(e) => setEdit({ ...edit, condition: e.target.value })}><option>Very Good</option><option>Good</option><option>Fair</option></select></div>
              <div><label className="font-semibold">Status</label><select className={`${input} bg-white`} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}><option>available</option><option>reserved</option><option>sold</option><option>hidden</option></select></div>
              <div><label className="font-semibold">Delivery charge (£)</label><input type="number" step="0.01" className={input} value={edit.delivery_charge} onChange={(e) => setEdit({ ...edit, delivery_charge: e.target.value })} /></div>
              <div><label className="font-semibold">Carbon saving (kg)</label><input type="number" step="0.1" className={input} value={edit.carbon_saving_kg} onChange={(e) => setEdit({ ...edit, carbon_saving_kg: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="font-semibold">Image URLs (comma separated)</label><input className={input} value={edit.images} onChange={(e) => setEdit({ ...edit, images: e.target.value })} data-testid="pm-images" /></div>
              <div className="sm:col-span-2"><label className="font-semibold">Description</label><textarea rows={3} className={input} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div><label className="font-semibold">Dimensions</label><input className={input} value={edit.dimensions} onChange={(e) => setEdit({ ...edit, dimensions: e.target.value })} /></div>
              <div><label className="font-semibold">Max user weight</label><input className={input} value={edit.max_user_weight} onChange={(e) => setEdit({ ...edit, max_user_weight: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="font-semibold">Safety info</label><input className={input} value={edit.safety_info} onChange={(e) => setEdit({ ...edit, safety_info: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="font-semibold">Internal admin notes (not shown to customers)</label><input className={input} value={edit.admin_notes} onChange={(e) => setEdit({ ...edit, admin_notes: e.target.value })} /></div>
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={edit.vat_relief_eligible} onChange={(e) => setEdit({ ...edit, vat_relief_eligible: e.target.checked })} className="h-5 w-5" data-testid="pm-vat-relief" /> Eligible for VAT relief</label>
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={edit.featured} onChange={(e) => setEdit({ ...edit, featured: e.target.checked })} className="h-5 w-5" /> Featured</label>
            </div>
            <div className="flex gap-3 mt-5"><button onClick={save} className="bg-brand-green text-white rounded-full px-6 py-3 font-semibold" data-testid="pm-save">Save product</button><button onClick={() => setEdit(null)} className="border-2 border-brand-green text-brand-green rounded-full px-6 py-3 font-semibold">Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Orders() {
  const [orders, setOrders] = useState([]);
  const load = () => api.get("/admin/orders").then((r) => setOrders(r.data));
  useEffect(() => { load(); }, []);
  const refund = async (o) => {
    const amtStr = window.prompt(`Refund amount for ${o.reference} (leave blank for full refund of ${o.totals.total_payable}):`);
    if (amtStr === null) return;
    const body = { amount: amtStr ? Number(amtStr) : null, return_stock: true };
    try { await api.post(`/admin/orders/${o.id}/refund`, body); toast.success("Refund processed"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  return (
    <div data-testid="admin-orders">
      <H>Orders</H>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left"><thead className="bg-brand-bone"><tr><th className="p-3">Ref</th><th className="p-3">Customer</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">Xero</th><th className="p-3"></th></tr></thead>
          <tbody>{orders.map((o, i) => (
            <tr key={o.id} className={i % 2 ? "bg-brand-bone" : ""} data-testid={`order-row-${o.reference}`}>
              <td className="p-3 font-semibold">{o.reference}</td><td className="p-3">{o.customer?.name}</td><td className="p-3">{gbp(o.totals?.total_payable)}</td>
              <td className="p-3">{o.status}</td><td className="p-3">{o.xero_sync_status}</td>
              <td className="p-3">{o.payment_status === "paid" && o.status !== "refunded" && <button onClick={() => refund(o)} className="text-brand-terracotta font-semibold" data-testid={`refund-${o.reference}`}>Refund</button>}</td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}

function VatDeclarations() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  useEffect(() => { api.get("/admin/vat-declarations").then((r) => setItems(r.data)).catch((e) => setErr(formatApiErrorDetail(e.response?.data?.detail))); }, []);
  return (
    <div data-testid="admin-vat">
      <H>VAT relief declarations</H>
      {err && <Card className="text-[#B71C1C]">{err}</Card>}
      <div className="space-y-3">{items.map((d) => (
        <Card key={d.id}>
          <div className="font-bold text-brand-green">{d.eligible_person_name} — order {d.order_reference}</div>
          <div className="text-[#4A4A4D] mt-1">Condition: {d.condition_description}</div>
          <div className="text-[#4A4A4D]">Address: {d.eligible_person_address}</div>
          {d.completed_by_name && <div className="text-[#4A4A4D]">Completed by: {d.completed_by_name} ({d.relationship})</div>}
          <div className="text-sm text-[#4A4A4D] mt-1">Signed: {d.signature} · {new Date(d.created_at).toLocaleString("en-GB")}</div>
        </Card>
      ))}{items.length === 0 && !err && <p className="text-[#4A4A4D]">No declarations yet.</p>}</div>
    </div>
  );
}

const ED_STATUSES = ["new", "under_review", "more_info", "accepted", "collection_arranged", "dropoff_arranged", "received", "declined", "closed"];
function EquipmentDonations() {
  const [items, setItems] = useState([]);
  const load = () => api.get("/admin/equipment-donations").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);
  const setStatus = async (id, status) => { await api.put(`/admin/equipment-donations/${id}`, { status }); toast.success("Updated"); load(); };
  return (
    <div data-testid="admin-equipment">
      <H>Equipment donation submissions</H>
      <div className="space-y-3">{items.map((d) => (
        <Card key={d.id}>
          <div className="flex justify-between flex-wrap gap-2">
            <div><strong>{d.equipment_type}</strong> from {d.donor_name} · {d.postcode} · Ref {d.reference}<div className="text-[#4A4A4D]">{d.email} · {d.phone} · Condition: {d.condition} · {d.working ? "Working" : "Not working"}</div></div>
            <select value={d.status} onChange={(e) => setStatus(d.id, e.target.value)} className="rounded-lg border border-[#8C8C8C] px-3 py-2 bg-white" data-testid={`ed-status-${d.reference}`}>{ED_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </div>
          {d.notes && <div className="text-[#4A4A4D] mt-2">Notes: {d.notes}</div>}
        </Card>
      ))}{items.length === 0 && <p className="text-[#4A4A4D]">No submissions yet.</p>}</div>
    </div>
  );
}

const EMPTY_EVENT = { name: "", slug: "", description: "", image: "", start_at: "", venue: "", online_link: "", accessibility_info: "", capacity: 20, is_paid: false, price: 0, published: true, cancelled: false };
function EventsAdmin() {
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/events").then((r) => setEvents(r.data));
  useEffect(() => { load(); api.get("/admin/bookings").then((r) => setBookings(r.data)); }, []);
  const save = async () => {
    const body = { ...edit, capacity: Number(edit.capacity), price: Number(edit.price) };
    try { if (edit.id) await api.put(`/events/${edit.id}`, body); else await api.post("/events", body); toast.success("Saved"); setEdit(null); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const input = "w-full rounded-lg border border-[#8C8C8C] px-3 py-2";
  return (
    <div data-testid="admin-events">
      <div className="flex justify-between items-center mb-6"><H>Events & bookings</H><button onClick={() => setEdit({ ...EMPTY_EVENT })} className="inline-flex items-center gap-2 bg-brand-terracotta text-white rounded-full px-5 py-2.5 font-semibold" data-testid="add-event-btn"><Plus size={18} /> Add event</button></div>
      <div className="grid md:grid-cols-2 gap-3 mb-8">{events.map((e) => (
        <Card key={e.id}><div className="flex justify-between"><div><strong>{e.name}</strong><div className="text-[#4A4A4D]">{new Date(e.start_at).toLocaleString("en-GB")} · {e.booked_count}/{e.capacity} booked</div></div><button onClick={() => setEdit({ ...e })} className="text-brand-green font-semibold">Edit</button></div></Card>
      ))}</div>
      <h2 className="font-heading text-2xl font-bold text-brand-green mb-3">Bookings</h2>
      <Card className="overflow-x-auto p-0"><table className="w-full text-left"><thead className="bg-brand-bone"><tr><th className="p-3">Event</th><th className="p-3">Name</th><th className="p-3">Attendees</th><th className="p-3">Status</th></tr></thead>
        <tbody>{bookings.map((b, i) => <tr key={b.id} className={i % 2 ? "bg-brand-bone" : ""}><td className="p-3">{b.event_name}</td><td className="p-3">{b.name}</td><td className="p-3">{b.num_attendees}</td><td className="p-3">{b.status}</td></tr>)}</tbody></table></Card>
      {edit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-auto" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl p-7 max-w-xl w-full my-8" onClick={(e) => e.stopPropagation()} data-testid="event-modal">
            <h2 className="font-heading text-2xl font-bold text-brand-green mb-4">{edit.id ? "Edit" : "New"} event</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className="font-semibold">Name</label><input className={input} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} data-testid="em-name" /></div>
              <div><label className="font-semibold">Slug</label><input className={input} value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} data-testid="em-slug" /></div>
              <div><label className="font-semibold">Start (ISO)</label><input className={input} placeholder="2026-09-01T14:30" value={edit.start_at} onChange={(e) => setEdit({ ...edit, start_at: e.target.value })} data-testid="em-start" /></div>
              <div><label className="font-semibold">Venue</label><input className={input} value={edit.venue} onChange={(e) => setEdit({ ...edit, venue: e.target.value })} /></div>
              <div><label className="font-semibold">Capacity</label><input type="number" className={input} value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: e.target.value })} /></div>
              <div><label className="font-semibold">Price (£)</label><input type="number" step="0.01" className={input} value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></div>
              <div><label className="font-semibold">Image URL</label><input className={input} value={edit.image} onChange={(e) => setEdit({ ...edit, image: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="font-semibold">Description</label><textarea rows={3} className={input} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="font-semibold">Private online link (not shown publicly)</label><input className={input} value={edit.online_link} onChange={(e) => setEdit({ ...edit, online_link: e.target.value })} /></div>
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={edit.is_paid} onChange={(e) => setEdit({ ...edit, is_paid: e.target.checked })} className="h-5 w-5" /> Paid event</label>
            </div>
            <div className="flex gap-3 mt-5"><button onClick={save} className="bg-brand-green text-white rounded-full px-6 py-3 font-semibold" data-testid="em-save">Save</button><button onClick={() => setEdit(null)} className="border-2 border-brand-green text-brand-green rounded-full px-6 py-3 font-semibold">Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Xero() {
  const [data, setData] = useState(null);
  const [recon, setRecon] = useState(null);
  const load = () => { api.get("/admin/xero/queue").then((r) => setData(r.data)); api.get("/admin/xero/reconciliation").then((r) => setRecon(r.data)); };
  useEffect(() => { load(); }, []);
  const sync = async (id) => { const r = await api.post(`/admin/xero/sync/${id}`); if (r.data.synced) toast.success("Synced to Xero"); else toast.error(r.data.error || "Sync failed — retry available"); load(); };
  const syncAll = async () => { const r = await api.post("/admin/xero/sync-all"); toast.success(`Synced ${r.data.synced}, failed ${r.data.failed}`); load(); };
  if (!data) return <div>Loading…</div>;
  const Row = ({ i, showSync }) => (
    <tr className="border-b border-brand-border"><td className="p-3">{i.order_ref}</td><td className="p-3">{i.type}</td><td className="p-3">{gbp(i.amount)}</td><td className="p-3">{i.status}{i.error && <span className="text-[#B71C1C] text-sm"> · {i.error}</span>}</td><td className="p-3">{showSync && <button onClick={() => sync(i.id)} className="text-brand-green font-semibold" data-testid={`xero-sync-${i.order_ref}`}>Sync</button>}</td></tr>
  );
  return (
    <div data-testid="admin-xero">
      <div className="flex justify-between items-center mb-6"><H>Xero sync status</H><button onClick={syncAll} className="inline-flex items-center gap-2 bg-brand-green text-white rounded-full px-5 py-2.5 font-semibold" data-testid="xero-sync-all"><RefreshCw size={18} /> Sync all</button></div>
      <div className="bg-[#FFF3E0] border border-[#FFCC80] rounded-xl p-4 mb-6 text-[#5a4a30]"><strong>Note:</strong> Xero integration is <strong>MOCKED</strong> in this build. The full accounting flow (OAuth, invoices, credit notes, account-code mappings) will be connected once mappings are approved and Xero credentials are supplied.</div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><div className="text-3xl font-bold text-brand-terracotta">{data.counts.queued}</div><div>Awaiting sync</div></Card>
        <Card><div className="text-3xl font-bold text-[#1B5E20]">{data.counts.synced}</div><div>Synced</div></Card>
        <Card><div className="text-3xl font-bold text-[#B71C1C]">{data.counts.failed}</div><div>Failed</div></Card>
      </div>
      {recon && <Card className="mb-6"><div className="font-bold text-brand-green mb-2">Reconciliation</div><div className="grid grid-cols-3 gap-4"><div>Website: <strong>{gbp(recon.website_total)}</strong></div><div>Xero: <strong>{gbp(recon.xero_total)}</strong></div><div>Difference: <strong className={recon.difference !== 0 ? "text-[#B71C1C]" : ""}>{gbp(recon.difference)}</strong></div></div></Card>}
      <Card className="overflow-x-auto p-0"><table className="w-full text-left"><thead className="bg-brand-bone"><tr><th className="p-3">Ref</th><th className="p-3">Type</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead>
        <tbody>{[...data.queued, ...data.failed].map((i) => <Row key={i.id} i={i} showSync />)}{data.synced.map((i) => <Row key={i.id} i={i} showSync={false} />)}</tbody></table></Card>
    </div>
  );
}

function Enquiries() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/admin/enquiries").then((r) => setItems(r.data)).catch(() => {}); }, []);
  return (
    <div data-testid="admin-enquiries">
      <H>Enquiries</H>
      <div className="space-y-3">{items.map((e) => (
        <Card key={e.id}><div className="flex justify-between flex-wrap gap-2"><div><strong>{e.enquiry_type}</strong> {e.sensitive && <span className="ml-2 text-xs bg-[#FDECEA] text-[#B71C1C] px-2 py-0.5 rounded-full font-bold">Sensitive</span>}<div className="text-[#4A4A4D]">{e.name} · {e.email} → routed to {e.routed_to}</div></div><span className="text-sm text-[#4A4A4D]">{e.reference}</span></div><p className="mt-2 text-[#2D2D30]">{e.message}</p></Card>
      ))}{items.length === 0 && <p className="text-[#4A4A4D]">No enquiries yet.</p>}</div>
    </div>
  );
}

function Donations() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/admin/donations").then((r) => setItems(r.data)).catch(() => {}); }, []);
  return (
    <div data-testid="admin-donations">
      <H>Financial donations</H>
      <Card className="overflow-x-auto p-0"><table className="w-full text-left"><thead className="bg-brand-bone"><tr><th className="p-3">Ref</th><th className="p-3">Donor</th><th className="p-3">Amount</th><th className="p-3">Recurring</th><th className="p-3">Status</th></tr></thead>
        <tbody>{items.map((d, i) => <tr key={d.id} className={i % 2 ? "bg-brand-bone" : ""}><td className="p-3">{d.reference}</td><td className="p-3">{d.name}</td><td className="p-3">{gbp(d.amount)}</td><td className="p-3">{d.recurring ? "Monthly" : "One-off"}</td><td className="p-3">{d.payment_status}</td></tr>)}</tbody></table></Card>
    </div>
  );
}

function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const load = () => api.get("/admin/users").then((r) => setUsers(r.data));
  useEffect(() => { load(); }, []);
  const setRole = async (id, role) => { await api.put(`/admin/users/${id}/role`, { role }); toast.success("Role updated"); load(); };
  return (
    <div data-testid="admin-users">
      <H>Users & roles</H>
      <Card className="overflow-x-auto p-0"><table className="w-full text-left"><thead className="bg-brand-bone"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th></tr></thead>
        <tbody>{users.map((u, i) => (
          <tr key={u.id} className={i % 2 ? "bg-brand-bone" : ""}><td className="p-3">{u.name}</td><td className="p-3">{u.email}</td>
            <td className="p-3"><select value={u.role} onChange={(e) => setRole(u.id, e.target.value)} className="rounded-lg border border-[#8C8C8C] px-3 py-2 bg-white" data-testid={`role-${u.email}`}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></td></tr>
        ))}</tbody></table></Card>
    </div>
  );
}

const GRADES = [
  "Excellent, minimal signs of previous use.",
  "Very good, light cosmetic signs of previous use.",
  "Good, visible signs of previous use but fully functional.",
  "Functional, noticeable cosmetic wear reflected in the price.",
];
const GUIDE_KEY = "gc_guided_draft";

function GuidedListing() {
  const [cats, setCats] = useState([]);
  const [step, setStep] = useState(0);
  const [data, setData] = useState(() => { try { return JSON.parse(localStorage.getItem(GUIDE_KEY)) || {}; } catch { return {}; } });
  const [done, setDone] = useState(null);
  useEffect(() => { api.get("/categories?include_hidden=true").then((r) => setCats(r.data)); }, []);
  useEffect(() => { localStorage.setItem(GUIDE_KEY, JSON.stringify(data)); }, [data]);

  const STEPS = [
    { key: "name", q: "What is the item called?", hint: "Everyday name — e.g. Folding wheelchair", type: "text" },
    { key: "sku", q: "Give it a short reference (SKU).", hint: "e.g. MOB-050", type: "text" },
    { key: "category_id", q: "Which category does it belong to?", type: "category" },
    { key: "condition", q: "What condition is it in?", type: "grade" },
    { key: "price_ex_vat", q: "What price, before VAT? (£)", hint: "Roughly half the original price or less", type: "number" },
    { key: "fulfilment_route", q: "How will people get it?", type: "route" },
    { key: "description", q: "Describe it in a sentence or two.", type: "textarea" },
  ];
  const s = STEPS[step];
  const val = data[s.key] ?? "";
  const set = (v) => setData({ ...data, [s.key]: v });
  const input = "w-full rounded-lg border border-[#8C8C8C] px-4 py-3 text-lg";
  const canNext = s.key === "description" ? true : String(val).trim() !== "";

  const finish = async () => {
    try {
      await api.post("/products", {
        name: data.name, sku: data.sku, category_id: data.category_id || null,
        description: data.description || "", condition: data.condition || GRADES[2],
        price_ex_vat: Number(data.price_ex_vat) || 0, quantity_available: 1,
        fulfilment_route: data.fulfilment_route || "hub_collection", status: "draft",
      });
      localStorage.removeItem(GUIDE_KEY); setDone(data.name); setData({}); setStep(0);
      toast.success("Saved as a draft for approval");
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  if (done) return (
    <div data-testid="guided-done"><H>Guided listing</H>
      <Card><div className="flex items-center gap-2 text-[#1B5E20] font-bold text-xl mb-2"><CheckCircle2 /> "{done}" saved</div>
      <p className="text-[#4A4A4D]">It's saved as a <strong>draft awaiting approval</strong>. An approver can publish it from the Products list. Thank you!</p>
      <button onClick={() => setDone(null)} className="mt-4 bg-brand-green text-white rounded-full px-6 py-3 font-semibold">Add another item</button></Card>
    </div>
  );

  return (
    <div data-testid="guided-listing">
      <H>Guided listing — one question at a time</H>
      <Card className="max-w-xl">
        <div className="h-2 bg-brand-bone rounded-full mb-6"><div className="h-2 bg-brand-lime rounded-full transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
        <p className="text-sm text-[#4A4A4D] mb-1">Question {step + 1} of {STEPS.length} · saved automatically</p>
        <h2 className="font-heading text-2xl font-bold text-brand-green mb-1">{s.q}</h2>
        {s.hint && <p className="text-[#4A4A4D] mb-3">{s.hint}</p>}
        <div className="mb-6">
          {s.type === "text" && <input autoFocus className={input} value={val} onChange={(e) => set(e.target.value)} data-testid="guided-input" />}
          {s.type === "number" && <input autoFocus type="number" step="0.01" className={input} value={val} onChange={(e) => set(e.target.value)} data-testid="guided-input" />}
          {s.type === "textarea" && <textarea autoFocus rows={4} className={input} value={val} onChange={(e) => set(e.target.value)} data-testid="guided-input" />}
          {s.type === "category" && <select className={`${input} bg-white`} value={val} onChange={(e) => set(e.target.value)} data-testid="guided-input"><option value="">Choose…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
          {s.type === "grade" && <div className="space-y-2">{GRADES.map((g) => <label key={g} className={`block rounded-xl border-2 p-3 cursor-pointer ${val === g ? "border-brand-green bg-brand-bone" : "border-brand-border"}`}><input type="radio" className="mr-2 h-4 w-4" checked={val === g} onChange={() => set(g)} />{g}</label>)}</div>}
          {s.type === "route" && <div className="space-y-2">{[["postable", "Postable (small, sent by courier)"], ["hub_collection", "Collection from Lichfield hub"], ["bulky_delivery", "Bulky delivery (we quote)"]].map(([k, lbl]) => <label key={k} className={`block rounded-xl border-2 p-3 cursor-pointer ${val === k ? "border-brand-green bg-brand-bone" : "border-brand-border"}`}><input type="radio" className="mr-2 h-4 w-4" checked={val === k} onChange={() => set(k)} />{lbl}</label>)}</div>}
        </div>
        <div className="flex justify-between">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="border-2 border-brand-green text-brand-green rounded-full px-6 py-3 font-semibold disabled:opacity-40" data-testid="guided-back">Back</button>
          {step < STEPS.length - 1
            ? <button onClick={() => setStep(step + 1)} disabled={!canNext} className="bg-brand-green text-white rounded-full px-6 py-3 font-semibold disabled:opacity-40" data-testid="guided-next">Next</button>
            : <button onClick={finish} disabled={!data.name || !data.sku} className="bg-brand-lime text-[#003d20] rounded-full px-6 py-3 font-bold disabled:opacity-40" data-testid="guided-finish">Save for approval</button>}
        </div>
      </Card>
    </div>
  );
}

function Redirects() {
  const [items, setItems] = useState([]);
  const [f, setF] = useState({ from_path: "", to_path: "", status_code: 301 });
  const load = () => api.get("/admin/redirects").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);
  const add = async (e) => { e.preventDefault(); await api.post("/admin/redirects", f); toast.success("Redirect saved"); setF({ from_path: "", to_path: "", status_code: 301 }); load(); };
  const del = async (id) => { await api.delete(`/admin/redirects/${id}`); load(); };
  const base = api.defaults.baseURL;
  const input = "w-full rounded-lg border border-[#8C8C8C] px-3 py-2";
  return (
    <div data-testid="admin-redirects">
      <H>Redirects & SEO</H>
      <Card className="mb-6">
        <div className="flex flex-wrap gap-4">
          <a href={`${base}/sitemap.xml`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-brand-green text-white rounded-full px-5 py-2.5 font-semibold" data-testid="view-sitemap"><FileText size={18} /> View sitemap.xml</a>
          <a href={`${base}/robots.txt`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border-2 border-brand-green text-brand-green rounded-full px-5 py-2.5 font-semibold">View robots.txt</a>
        </div>
        <p className="text-[#4A4A4D] mt-3">Add 301 redirects from old WordPress URLs to new pages so search rankings carry over. Old paths that aren't found are checked against this list automatically.</p>
      </Card>
      <Card className="mb-6">
        <form onSubmit={add} className="grid sm:grid-cols-3 gap-3 items-end">
          <div><label className="font-semibold">Old path</label><input required className={input} placeholder="/old-shop/wheelchairs" value={f.from_path} onChange={(e) => setF({ ...f, from_path: e.target.value })} data-testid="redirect-from" /></div>
          <div><label className="font-semibold">New path</label><input required className={input} placeholder="/shop?category_id=..." value={f.to_path} onChange={(e) => setF({ ...f, to_path: e.target.value })} data-testid="redirect-to" /></div>
          <button className="bg-brand-green text-white rounded-full px-6 py-2.5 font-semibold" data-testid="redirect-add">Add redirect</button>
        </form>
      </Card>
      <Card className="overflow-x-auto p-0"><table className="w-full text-left"><thead className="bg-brand-bone"><tr><th className="p-3">From</th><th className="p-3">To</th><th className="p-3">Code</th><th className="p-3"></th></tr></thead>
        <tbody>{items.map((r, i) => <tr key={r.id} className={i % 2 ? "bg-brand-bone" : ""}><td className="p-3">{r.from_path}</td><td className="p-3">{r.to_path}</td><td className="p-3">{r.status_code}</td><td className="p-3"><button onClick={() => del(r.id)} className="text-brand-terracotta font-semibold">Delete</button></td></tr>)}
        {items.length === 0 && <tr><td className="p-3 text-[#4A4A4D]" colSpan={4}>No redirects yet.</td></tr>}</tbody></table></Card>
    </div>
  );
}

