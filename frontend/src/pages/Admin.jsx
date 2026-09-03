import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, gbp, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";
import {
  LayoutDashboard, Package, ShoppingCart, ShieldCheck, HandHeart, Calendar,
  RefreshCw, Users, MessageSquare, FileText, LogOut, Plus, Leaf, AlertTriangle, Download,
  Link2, ClipboardList, CheckCircle2, Truck, Bell, Edit3, Mail,
} from "lucide-react";

const SECTIONS = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["products", "Products", Package],
  ["orders", "Orders", ShoppingCart],
  ["vat", "VAT Declarations", ShieldCheck],
  ["equipment", "Equipment Donations", HandHeart],
  ["events", "Events & Bookings", Calendar],
  ["guided", "Guided Listing", ClipboardList],
  ["postage", "Postage & Shipping", Truck],
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
        {section === "postage" && <Postage />}
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
  const [notes, setNotes] = useState([]);
  useEffect(() => {
    api.get("/admin/reports/summary").then((r) => setS(r.data)).catch(() => {});
    api.get("/admin/notifications").then((r) => setNotes(r.data.filter((n) => !n.read))).catch(() => {});
  }, []);
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
      {notes.length > 0 && (
        <div className="bg-brand-lime/30 border border-brand-lime rounded-xl p-4 mb-6 flex items-start gap-2" data-testid="notifications-banner">
          <Bell size={20} className="text-brand-green shrink-0 mt-0.5" />
          <div><strong className="text-brand-green">{notes.length} notification{notes.length > 1 ? "s" : ""}:</strong> <span className="text-[#2D2D30]">{notes.slice(0, 3).map((n) => n.message).join(" · ")}</span></div>
        </div>
      )}
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
  weight_kg: 3, fulfilment_route: "hub_collection",
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
  const [showImport, setShowImport] = useState(false);
  const [csv, setCsv] = useState("");
  const importProducts = async () => {
    try {
      const r = await api.post("/admin/products/import", { csv });
      toast.success(`Imported: ${r.data.created} new, ${r.data.updated} updated`);
      if (r.data.errors?.length) toast.error(`${r.data.errors.length} row(s) skipped — see first: ${r.data.errors[0]}`);
      setCsv(""); setShowImport(false); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const base = api.defaults.baseURL;
  const [impFile, setImpFile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [expCat, setExpCat] = useState("");
  const [expStock, setExpStock] = useState("");
  const [expFrom, setExpFrom] = useState("");
  const [expTo, setExpTo] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const exportUrl = () => {
    const qs = new URLSearchParams();
    if (expCat) qs.set("category", expCat);
    if (expStock) qs.set("stock_status", expStock);
    if (expFrom) qs.set("date_from", expFrom);
    if (expTo) qs.set("date_to", expTo);
    const q = qs.toString();
    return `${base}/admin/products-export.csv${q ? `?${q}` : ""}`;
  };
  const uploadOneImage = async (fileObj) => {
    if (!fileObj) return;
    setUploadingImg(true);
    const fd = new FormData(); fd.append("file", fileObj);
    try {
      const r = await api.post("/admin/products/upload-image", fd);
      const current = typeof edit.images === "string" ? edit.images.split(",").map((s) => s.trim()).filter(Boolean) : (edit.images || []);
      setEdit({ ...edit, images: [...current, r.data.url].join(", ") });
      toast.success("Photo uploaded");
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setUploadingImg(false); }
  };
  const uploadFile = async (dry) => {
    if (!impFile) return toast.error("Choose a .xlsx or .csv file first");
    const fd = new FormData(); fd.append("file", impFile);
    try {
      const r = await api.post(`/admin/products/import-file?dry_run=${dry}`, fd);
      if (dry) { setPreview(r.data); }
      else { toast.success(`Imported ${r.data.created_count} new, ${r.data.updated_count} updated`); setPreview(null); setImpFile(null); load(); }
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const uploadPhotos = async () => {
    if (!photoFile) return toast.error("Choose a .zip of photos first");
    const fd = new FormData(); fd.append("file", photoFile);
    try {
      const r = await api.post("/admin/products/import-photos", fd);
      toast.success(`Matched ${r.data.matched_count} photo(s) by SKU`);
      if (r.data.unmatched?.length) toast.error(`${r.data.unmatched.length} photo(s) had no matching SKU`);
      setPhotoFile(null); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  useEffect(() => { load(); api.get("/categories?include_hidden=true").then((r) => setCats(r.data)); }, []);

  const save = async () => {
    const body = { ...edit, price_ex_vat: Number(edit.price_ex_vat), quantity_available: Number(edit.quantity_available), carbon_saving_kg: Number(edit.carbon_saving_kg) || 0, delivery_charge: Number(edit.delivery_charge) || 0, weight_kg: Number(edit.weight_kg) || 0, vat_rate: Number(edit.vat_rate) || 0.2, images: typeof edit.images === "string" ? edit.images.split(",").map((s) => s.trim()).filter(Boolean) : edit.images };
    try {
      if (edit.id) await api.put(`/products/${edit.id}`, body); else await api.post("/products", body);
      toast.success("Product saved"); setEdit(null); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const del = async (id) => { if (!window.confirm("Delete this product?")) return; await api.delete(`/products/${id}`); toast.success("Deleted"); load(); };

  const input = "w-full rounded-lg border border-[#8C8C8C] px-3 py-2";
  return (
    <div data-testid="admin-products">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <H>Products</H>
        <div className="flex gap-2 flex-wrap">
          <a href={`${base}/admin/product-template.csv`} className="inline-flex items-center gap-2 border-2 border-brand-green text-brand-green rounded-full px-4 py-2.5 font-semibold" data-testid="download-template"><Download size={18} /> Template</a>
          <button onClick={() => setShowExport(!showExport)} className="inline-flex items-center gap-2 border-2 border-brand-green text-brand-green rounded-full px-4 py-2.5 font-semibold" data-testid="toggle-export"><Download size={18} /> Export CSV</button>
          <button onClick={() => setShowImport(!showImport)} className="inline-flex items-center gap-2 border-2 border-brand-green text-brand-green rounded-full px-4 py-2.5 font-semibold" data-testid="toggle-import"><ClipboardList size={18} /> Import CSV</button>
          <button onClick={() => setEdit({ ...EMPTY_PRODUCT })} className="inline-flex items-center gap-2 bg-brand-terracotta text-white rounded-full px-5 py-2.5 font-semibold" data-testid="add-product-btn"><Plus size={18} /> Add product</button>
        </div>
      </div>
      {showExport && (
        <Card className="mb-6" >
          <label className="font-semibold block mb-2">Choose what to export — leave blank for everything</label>
          <div className="grid sm:grid-cols-4 gap-3">
            <div><label className="text-sm font-semibold block mb-1">Category</label><select className="w-full rounded-lg border border-[#8C8C8C] px-3 py-2 bg-white" value={expCat} onChange={(e) => setExpCat(e.target.value)} data-testid="export-category"><option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.slug || c.id}>{c.name}</option>)}</select></div>
            <div><label className="text-sm font-semibold block mb-1">Stock status</label><select className="w-full rounded-lg border border-[#8C8C8C] px-3 py-2 bg-white" value={expStock} onChange={(e) => setExpStock(e.target.value)} data-testid="export-stock"><option value="">All stock</option><option value="in_stock">In stock</option><option value="low_stock">Low stock (≤1)</option><option value="out_of_stock">Out of stock</option></select></div>
            <div><label className="text-sm font-semibold block mb-1">Created from</label><input type="date" className="w-full rounded-lg border border-[#8C8C8C] px-3 py-2" value={expFrom} onChange={(e) => setExpFrom(e.target.value)} data-testid="export-from" /></div>
            <div><label className="text-sm font-semibold block mb-1">Created to</label><input type="date" className="w-full rounded-lg border border-[#8C8C8C] px-3 py-2" value={expTo} onChange={(e) => setExpTo(e.target.value)} data-testid="export-to" /></div>
          </div>
          <div className="flex gap-3 mt-4 flex-wrap">
            <a href={exportUrl()} className="inline-flex items-center gap-2 bg-brand-green text-white rounded-full px-6 py-2.5 font-semibold" data-testid="export-download"><Download size={18} /> Download CSV</a>
            <button onClick={() => { setExpCat(""); setExpStock(""); setExpFrom(""); setExpTo(""); }} className="border-2 border-brand-green text-brand-green rounded-full px-5 py-2.5 font-semibold" data-testid="export-clear">Clear filters</button>
          </div>
        </Card>
      )}
      {showImport && (
        <Card className="mb-6" >
          <label className="font-semibold block mb-1">Paste product CSV (match the template columns; rows are matched/updated by SKU)</label>
          <textarea rows={5} className="w-full rounded-lg border border-[#8C8C8C] px-3 py-2 font-mono text-sm" placeholder="name,sku,category_slug,description,condition,price_ex_vat,..." value={csv} onChange={(e) => setCsv(e.target.value)} data-testid="products-csv" />
          <div className="flex gap-3 mt-3">
            <button onClick={importProducts} disabled={!csv.trim()} className="bg-brand-green text-white rounded-full px-6 py-2.5 font-semibold disabled:opacity-50" data-testid="import-products">Import products</button>
            <a href={`${base}/admin/product-template.csv`} className="text-brand-green font-semibold self-center underline">Download the template first</a>
          </div>
          <div className="mt-4 border-t border-brand-border pt-4">
            <label className="font-semibold block mb-1">Or upload a file (.xlsx or .csv) — with a preview before it commits</label>
            <input type="file" accept=".xlsx,.xlsm,.csv" onChange={(e) => { setImpFile(e.target.files[0]); setPreview(null); }} className="block mb-3" data-testid="products-file" />
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => uploadFile(true)} disabled={!impFile} className="border-2 border-brand-green text-brand-green rounded-full px-5 py-2.5 font-semibold disabled:opacity-50" data-testid="preview-import">Preview changes</button>
              <button onClick={() => uploadFile(false)} disabled={!impFile} className="bg-brand-green text-white rounded-full px-6 py-2.5 font-semibold disabled:opacity-50" data-testid="apply-import">Apply import</button>
            </div>
            {preview && (
              <div className="mt-3 bg-brand-bone rounded-xl p-4" data-testid="import-preview">
                <p className="font-semibold text-brand-green">Dry-run preview — nothing saved yet:</p>
                <p className="mt-1">{preview.created_count} new product(s){preview.created.length ? `: ${preview.created.join(", ")}` : ""}</p>
                <p>{preview.updated_count} existing updated by SKU{preview.updated.length ? `: ${preview.updated.join(", ")}` : ""}</p>
                {preview.errors?.length > 0 && <p className="text-[#B71C1C] mt-1">{preview.errors.length} row(s) skipped: {preview.errors[0]}</p>}
                <button onClick={() => uploadFile(false)} className="mt-2 bg-brand-green text-white rounded-full px-5 py-2 font-semibold" data-testid="confirm-import">Looks good — apply now</button>
              </div>
            )}
          </div>
          <div className="mt-4 border-t border-brand-border pt-4">
            <label className="font-semibold block mb-1">Bulk photo import — upload a .zip; files are matched to products by SKU (e.g. MOB-003.jpg or MOB-003_2.jpg)</label>
            <input type="file" accept=".zip" onChange={(e) => setPhotoFile(e.target.files[0])} className="block mb-3" data-testid="photos-file" />
            <button onClick={uploadPhotos} disabled={!photoFile} className="bg-brand-green text-white rounded-full px-6 py-2.5 font-semibold disabled:opacity-50" data-testid="upload-photos">Upload photos</button>
          </div>
        </Card>
      )}
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
              <div><label className="font-semibold">Weight (kg) — for postage</label><input type="number" step="0.1" className={input} value={edit.weight_kg} onChange={(e) => setEdit({ ...edit, weight_kg: e.target.value })} data-testid="pm-weight" /></div>
              <div><label className="font-semibold">Fulfilment route</label><select className={`${input} bg-white`} value={edit.fulfilment_route} onChange={(e) => setEdit({ ...edit, fulfilment_route: e.target.value })} data-testid="pm-route"><option value="postable">Postable</option><option value="hub_collection">Hub collection</option><option value="bulky_delivery">Bulky delivery</option></select></div>
              <div className="sm:col-span-2"><label className="font-semibold">Image URLs (comma separated)</label><input className={input} value={edit.images} onChange={(e) => setEdit({ ...edit, images: e.target.value })} data-testid="pm-images" />
                <div className="mt-2 flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 border-2 border-brand-green text-brand-green rounded-full px-4 py-2 font-semibold cursor-pointer text-sm" data-testid="pm-upload-image-label">
                    <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" data-testid="pm-upload-image" onChange={(e) => { uploadOneImage(e.target.files[0]); e.target.value = ""; }} />
                    {uploadingImg ? "Uploading…" : "Upload a photo"}
                  </label>
                  <span className="text-sm text-[#4A4A4D]">Uploads to storage and adds the link above.</span>
                </div>
              </div>
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

const ORDER_STATUSES = ["pending_payment", "paid", "processing", "ready_for_collection", "dispatched", "completed", "cancelled", "refunded", "partially_refunded", "expired"];

function Orders() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [declView, setDeclView] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const load = () => api.get("/admin/orders").then((r) => setOrders(r.data));
  useEffect(() => { load(); }, []);
  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (o.reference || "").toLowerCase().includes(q) ||
           (o.customer?.name || "").toLowerCase().includes(q) ||
           (o.customer?.email || "").toLowerCase().includes(q);
  });
  const buildTimeline = (o) => {
    const ev = [];
    if (o.created_at) ev.push(["Order placed", o.created_at, "#006738"]);
    if (o.paid_at) ev.push(["Payment received", o.paid_at, "#1B5E20"]);
    (o.status_history || []).forEach((h) => ev.push([`Marked "${(h.status || "").replace(/_/g, " ")}"${h.by ? ` · ${h.by}` : ""}`, h.at, "#006738"]));
    if (o.delivery_quote?.at) ev.push([`Delivery quote set (${gbp(o.delivery_quote.amount)})`, o.delivery_quote.at, "#006738"]);
    if (o.delivery_quote?.paid_at) ev.push(["Delivery paid", o.delivery_quote.paid_at, "#1B5E20"]);
    (o.refunds || []).forEach((r) => ev.push([`Refunded ${gbp(r.amount)}${r.by ? ` · ${r.by}` : ""}`, r.at, "#C85A40"]));
    return ev.filter(([, t]) => t).sort((a, b) => new Date(a[1]) - new Date(b[1]));
  };
  const openDecl = async (id) => {
    if (!id) return;
    try { const r = await api.get(`/admin/vat-declarations/${id}`); setDeclView(r.data); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const quote = async (o) => {
    const a = window.prompt(`Delivery quote (£) for bulky order ${o.reference}:`);
    if (!a) return;
    const r = await api.post(`/admin/orders/${o.id}/delivery-quote`, { amount: Number(a) });
    toast.success("Delivery quote created — share the payment link with the customer");
    window.open(r.data.checkout_url, "_blank");
    load();
  };
  const refund = async (o) => {
    const amtStr = window.prompt(`Refund amount for ${o.reference} (leave blank for full refund of ${o.totals.total_payable}):`);
    if (amtStr === null) return;
    const body = { amount: amtStr ? Number(amtStr) : null, return_stock: true };
    try { await api.post(`/admin/orders/${o.id}/refund`, body); toast.success("Refund processed"); load(); setSelected(null); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const setStatus = async (o, status) => {
    try {
      await api.put(`/admin/orders/${o.id}/status`, { status });
      toast.success(`Order marked ${status.replace(/_/g, " ")}`);
      setSelected({ ...o, status });
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const dt = (v) => v ? new Date(v).toLocaleString("en-GB") : "—";
  return (
    <div data-testid="admin-orders">
      <H>Orders</H>
      <div className="flex gap-3 flex-wrap mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference, name or email…" className="flex-1 min-w-[240px] rounded-full border border-[#8C8C8C] px-4 py-2.5" data-testid="order-search" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-full border border-[#8C8C8C] px-4 py-2.5 bg-white" data-testid="order-status-filter">
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      <p className="text-sm text-[#4A4A4D] mb-2" data-testid="order-count">{filtered.length} of {orders.length} orders</p>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left"><thead className="bg-brand-bone"><tr><th className="p-3">Ref</th><th className="p-3">Customer</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">Xero</th><th className="p-3"></th></tr></thead>
          <tbody>{filtered.map((o, i) => (
            <tr key={o.id} className={`${i % 2 ? "bg-brand-bone" : ""} cursor-pointer hover:bg-brand-lime/20`} onClick={() => setSelected(o)} data-testid={`order-row-${o.reference}`}>
              <td className="p-3 font-semibold text-brand-green underline">{o.reference}</td><td className="p-3">{o.customer?.name}</td><td className="p-3">{gbp(o.totals?.total_payable)}</td>
              <td className="p-3">{o.status}</td><td className="p-3">{o.xero_sync_status}</td>
              <td className="p-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setSelected(o)} className="text-brand-green font-semibold mr-3" data-testid={`view-${o.reference}`}>View</button>
                {o.payment_status === "paid" && o.status !== "refunded" && <button onClick={() => refund(o)} className="text-brand-terracotta font-semibold mr-3" data-testid={`refund-${o.reference}`}>Refund</button>}
                {o.fulfilment === "bulky_delivery" && (o.delivery_quote?.status === "paid"
                  ? <span className="text-[#1B5E20] font-semibold">Delivery paid</span>
                  : <button onClick={() => quote(o)} className="text-brand-green font-semibold" data-testid={`quote-${o.reference}`}>{o.delivery_quote ? "Re-quote delivery" : "Set delivery quote"}</button>)}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </Card>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-auto" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl p-7 max-w-3xl w-full my-8 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()} data-testid="order-detail-modal">
            <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
              <div>
                <h2 className="font-heading text-2xl font-bold text-brand-green">Order {selected.reference}</h2>
                <p className="text-[#4A4A4D] text-sm">Placed {dt(selected.created_at)}{selected.paid_at ? ` · Paid ${dt(selected.paid_at)}` : ""}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-2xl leading-none text-[#4A4A4D] px-2" data-testid="order-close">×</button>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 mb-5">
              {[["Status", selected.status], ["Payment", selected.payment_status], ["Xero", selected.xero_sync_status]].map(([l, v]) => (
                <div key={l} className="bg-brand-bone rounded-xl p-3"><div className="text-xs font-semibold text-[#4A4A4D] uppercase">{l}</div><div className="font-bold text-brand-green">{v || "—"}</div></div>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <label className="font-semibold text-sm">Update status:</label>
              <select className="rounded-lg border border-[#8C8C8C] px-3 py-2 bg-white" value={selected.status} onChange={(e) => setStatus(selected, e.target.value)} data-testid="order-status-select">
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-5 mb-6">
              <div>
                <h3 className="font-bold text-brand-green mb-1">Customer</h3>
                <p className="text-[#2D2D30]">{selected.customer?.name}</p>
                <p className="text-[#4A4A4D] text-sm">{selected.customer?.email}</p>
                <p className="text-[#4A4A4D] text-sm">{selected.customer?.phone || "No phone"}</p>
                <p className="text-[#4A4A4D] text-sm mt-1">{[selected.customer?.address_line1, selected.customer?.address_line2, selected.customer?.city, selected.customer?.postcode].filter(Boolean).join(", ") || "No address"}</p>
              </div>
              <div>
                <h3 className="font-bold text-brand-green mb-1">Fulfilment</h3>
                <p className="text-[#2D2D30] capitalize">{(selected.fulfilment || "—").replace(/_/g, " ")}</p>
                {selected.delivery_questionnaire && (
                  <div className="text-[#4A4A4D] text-sm mt-1">
                    {Object.entries(selected.delivery_questionnaire).map(([k, v]) => v ? <div key={k}><span className="capitalize">{k.replace(/_/g, " ")}</span>: {String(v)}</div> : null)}
                  </div>
                )}
                {selected.vat_relief_claim && (selected.declaration_id
                  ? <button onClick={() => openDecl(selected.declaration_id)} className="text-[#1B5E20] font-semibold text-sm mt-2 underline inline-flex items-center gap-1" data-testid="order-view-declaration"><ShieldCheck size={15} /> ✓ VAT relief claimed — view declaration</button>
                  : <p className="text-[#1B5E20] font-semibold text-sm mt-2">✓ VAT relief claimed</p>)}
                {selected.marketing_consent && <p className="text-[#4A4A4D] text-sm">Opted in to marketing</p>}
              </div>
            </div>

            <h3 className="font-bold text-brand-green mb-2">Items</h3>
            <div className="overflow-x-auto border border-brand-border rounded-xl mb-4">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-bone"><tr><th className="p-2">Item</th><th className="p-2">SKU</th><th className="p-2">Qty</th><th className="p-2">Ex VAT</th><th className="p-2">VAT</th><th className="p-2">Total</th></tr></thead>
                <tbody>{(selected.items || []).map((it, idx) => (
                  <tr key={idx} className={idx % 2 ? "bg-brand-bone" : ""}>
                    <td className="p-2">{it.name}{it.vat_relief_applied ? <span className="text-[#1B5E20] font-semibold"> · relief</span> : ""}</td>
                    <td className="p-2">{it.sku}</td><td className="p-2">{it.quantity}</td>
                    <td className="p-2">{gbp(it.line_ex_vat)}</td><td className="p-2">{gbp(it.line_vat)}</td><td className="p-2">{gbp(it.line_total)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>

            <div className="bg-brand-bone rounded-xl p-4 mb-4 max-w-sm ml-auto text-sm">
              {[["Subtotal (ex VAT)", selected.totals?.subtotal_ex_vat], ["VAT", selected.totals?.vat_total], ["Delivery", selected.totals?.delivery_total], ["Donation", selected.totals?.donation]].map(([l, v]) => (
                <div key={l} className="flex justify-between py-0.5"><span className="text-[#4A4A4D]">{l}</span><span>{gbp(v)}</span></div>
              ))}
              <div className="flex justify-between border-t border-brand-green mt-1 pt-1 font-bold text-brand-green"><span>Total paid</span><span>{gbp(selected.totals?.total_payable)}</span></div>
            </div>

            <div className="border border-brand-border rounded-xl p-4 mb-4" data-testid="order-timeline">
              <h3 className="font-bold text-brand-green mb-3">Activity timeline</h3>
              <ol className="space-y-3">
                {buildTimeline(selected).map(([label, at, color], idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
                    <div><div className="text-[#2D2D30] text-sm font-semibold">{label}</div><div className="text-[#4A4A4D] text-xs">{dt(at)}</div></div>
                  </li>
                ))}
                {buildTimeline(selected).length === 0 && <li className="text-[#4A4A4D] text-sm">No activity recorded yet.</li>}
              </ol>
            </div>

            {selected.delivery_quote && (
              <div className="border border-brand-border rounded-xl p-4 mb-4">
                <h3 className="font-bold text-brand-green mb-1">Delivery quote</h3>
                <p className="text-sm">{gbp(selected.delivery_quote.amount)} · {selected.delivery_quote.status} {selected.delivery_quote.note ? `· ${selected.delivery_quote.note}` : ""}</p>
              </div>
            )}
            {selected.refunds?.length > 0 && (
              <div className="border border-brand-border rounded-xl p-4 mb-4">
                <h3 className="font-bold text-brand-terracotta mb-1">Refunds</h3>
                {selected.refunds.map((r, idx) => <p key={idx} className="text-sm">{gbp(r.amount)} on {dt(r.at)} by {r.by}</p>)}
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              {selected.payment_status === "paid" && selected.status !== "refunded" && <button onClick={() => refund(selected)} className="border-2 border-brand-terracotta text-brand-terracotta rounded-full px-6 py-2.5 font-semibold" data-testid="order-refund-btn">Refund</button>}
              {selected.fulfilment === "bulky_delivery" && selected.delivery_quote?.status !== "paid" && <button onClick={() => quote(selected)} className="border-2 border-brand-green text-brand-green rounded-full px-6 py-2.5 font-semibold">Set delivery quote</button>}
              <button onClick={() => setSelected(null)} className="bg-brand-green text-white rounded-full px-6 py-2.5 font-semibold ml-auto">Close</button>
            </div>
          </div>
        </div>
      )}

      {declView && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] overflow-auto" onClick={() => setDeclView(null)}>
          <div className="bg-white rounded-2xl p-7 max-w-xl w-full my-8 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()} data-testid="declaration-popup">
            <div className="flex justify-between items-start mb-4">
              <h2 className="font-heading text-2xl font-bold text-brand-green flex items-center gap-2"><ShieldCheck size={22} /> VAT relief declaration</h2>
              <button onClick={() => setDeclView(null)} className="text-2xl leading-none text-[#4A4A4D] px-2" data-testid="declaration-close">×</button>
            </div>
            <div className="space-y-2 text-[#2D2D30]">
              {[["Order", declView.order_reference], ["Declared on", dt(declView.created_at)],
                ["Eligible person", declView.eligible_person_name], ["Address", declView.eligible_person_address],
                ["Disability / long-term illness", declView.condition_description],
                ["Completed by", declView.completed_by_name ? `${declView.completed_by_name}${declView.relationship ? ` (${declView.relationship})` : ""}` : "The eligible person"],
                ["For personal/domestic use", declView.for_personal_domestic_use ? "Yes" : "No"],
                ["Information declared accurate", declView.info_accurate ? "Yes" : "No"],
                ["Signature", declView.signature]].map(([l, v]) => (
                <div key={l} className="grid grid-cols-[180px_1fr] gap-2 border-b border-brand-border pb-1.5">
                  <span className="font-semibold text-brand-green text-sm">{l}</span><span className="text-sm">{v || "—"}</span>
                </div>
              ))}
            </div>
            {declView.relieved_items?.length > 0 && (
              <div className="mt-4">
                <h3 className="font-bold text-brand-green mb-2">Items with relief applied</h3>
                <div className="overflow-x-auto border border-brand-border rounded-xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-brand-bone"><tr><th className="p-2">Item</th><th className="p-2">Qty</th><th className="p-2">Ex VAT</th><th className="p-2">VAT relieved</th></tr></thead>
                    <tbody>{declView.relieved_items.map((it, idx) => (
                      <tr key={idx} className={idx % 2 ? "bg-brand-bone" : ""}><td className="p-2">{it.name}</td><td className="p-2">{it.quantity}</td><td className="p-2">{gbp(it.line_ex_vat)}</td><td className="p-2">{gbp(it.vat_relieved)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="bg-brand-bone rounded-xl p-4 mt-4 flex justify-between font-bold text-brand-green">
              <span>Total VAT relieved</span><span data-testid="declaration-relief-total">{gbp(declView.total_vat_relieved)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VatStatementEditor() {
  const [stmt, setStmt] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { api.get("/admin/vat-declaration-statement").then((r) => setStmt(r.data)).catch(() => {}); }, []);
  const save = async () => {
    try {
      const body = { ...stmt, bullets: typeof stmt.bullets === "string" ? stmt.bullets.split("\n").map((s) => s.trim()).filter(Boolean) : stmt.bullets };
      const r = await api.put("/admin/vat-declaration-statement", { statement: body });
      setStmt(r.data.statement);
      toast.success("Declaration wording saved — now live at checkout");
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const inp = "w-full rounded-lg border border-[#8C8C8C] px-3 py-2";
  if (!stmt) return null;
  const bulletsText = Array.isArray(stmt.bullets) ? stmt.bullets.join("\n") : stmt.bullets;
  return (
    <Card className="mb-6" data-testid="vat-statement-editor">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 font-bold text-brand-green text-lg" data-testid="toggle-statement-editor"><Edit3 size={18} /> Edit the VAT declaration wording {open ? "▲" : "▼"}</button>
      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[#4A4A4D]">This is the exact wording customers see when claiming VAT relief at checkout. Changes go live immediately.</p>
          <div><label className="font-semibold block mb-1">Section heading</label><input className={inp} value={stmt.heading} onChange={(e) => setStmt({ ...stmt, heading: e.target.value })} data-testid="stmt-heading" /></div>
          <div><label className="font-semibold block mb-1">Intro paragraph</label><textarea rows={3} className={inp} value={stmt.intro} onChange={(e) => setStmt({ ...stmt, intro: e.target.value })} data-testid="stmt-intro" /></div>
          <div><label className="font-semibold block mb-1">Guidance bullet points (one per line)</label><textarea rows={4} className={inp} value={bulletsText} onChange={(e) => setStmt({ ...stmt, bullets: e.target.value })} data-testid="stmt-bullets" /></div>
          <div><label className="font-semibold block mb-1">Choice — personal use</label><input className={inp} value={stmt.choice_personal} onChange={(e) => setStmt({ ...stmt, choice_personal: e.target.value })} data-testid="stmt-choice-personal" /></div>
          <div><label className="font-semibold block mb-1">Choice — on behalf of</label><input className={inp} value={stmt.choice_behalf} onChange={(e) => setStmt({ ...stmt, choice_behalf: e.target.value })} data-testid="stmt-choice-behalf" /></div>
          <div><label className="font-semibold block mb-1">Choice — does not qualify</label><input className={inp} value={stmt.choice_not_qualify} onChange={(e) => setStmt({ ...stmt, choice_not_qualify: e.target.value })} data-testid="stmt-choice-notqualify" /></div>
          <div><label className="font-semibold block mb-1">Confirmation — personal/domestic use</label><input className={inp} value={stmt.confirm_domestic} onChange={(e) => setStmt({ ...stmt, confirm_domestic: e.target.value })} data-testid="stmt-confirm-domestic" /></div>
          <div><label className="font-semibold block mb-1">Confirmation — information accurate</label><input className={inp} value={stmt.confirm_accurate} onChange={(e) => setStmt({ ...stmt, confirm_accurate: e.target.value })} data-testid="stmt-confirm-accurate" /></div>
          <button onClick={save} className="bg-brand-green text-white rounded-full px-6 py-2.5 font-semibold" data-testid="save-statement">Save wording</button>
        </div>
      )}
    </Card>
  );
}

function VatDeclarations() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [preset, setPreset] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const base = api.defaults.baseURL;

  const applyPreset = (p) => {
    setPreset(p);
    const now = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    if (p === "this_month") { setFrom(iso(new Date(now.getFullYear(), now.getMonth(), 1))); setTo(iso(new Date(now.getFullYear(), now.getMonth() + 1, 0))); }
    else if (p === "last_month") { setFrom(iso(new Date(now.getFullYear(), now.getMonth() - 1, 1))); setTo(iso(new Date(now.getFullYear(), now.getMonth(), 0))); }
    else if (p === "this_year") { setFrom(iso(new Date(now.getFullYear(), 0, 1))); setTo(iso(new Date(now.getFullYear(), 11, 31))); }
    else if (p === "last_year") { setFrom(iso(new Date(now.getFullYear() - 1, 0, 1))); setTo(iso(new Date(now.getFullYear() - 1, 11, 31))); }
    else if (p === "all") { setFrom(""); setTo(""); }
  };

  const qs = () => {
    const p = new URLSearchParams();
    if (from) p.set("date_from", from);
    if (to) p.set("date_to", to);
    return p.toString();
  };
  const load = () => {
    const q = qs();
    api.get(`/admin/vat-declarations${q ? `?${q}` : ""}`).then((r) => setItems(r.data)).catch((e) => setErr(formatApiErrorDetail(e.response?.data?.detail)));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to]);

  const PRESETS = [["all", "All time"], ["this_month", "This month"], ["last_month", "Last month"], ["this_year", "This calendar year"], ["last_year", "Last calendar year"], ["custom", "Custom dates"]];

  const emailReceipt = async (d) => {
    if (!d.customer_email) return toast.error("No customer email is stored on this declaration");
    if (!window.confirm(`Email the VAT receipt for order ${d.order_reference} to ${d.customer_email}?`)) return;
    try {
      const r = await api.post(`/admin/vat-declarations/${d.id}/email-receipt`);
      toast.success(`Receipt emailed to ${r.data.sent_to}`);
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <div data-testid="admin-vat">
      <H>VAT relief declarations</H>
      <VatStatementEditor />
      <Card className="mb-6" data-testid="vat-report-controls">
        <label className="font-semibold block mb-2">Download declarations report — choose a period</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map(([k, lbl]) => (
            <button key={k} onClick={() => applyPreset(k)} className={`rounded-full px-4 py-2 font-semibold border-2 ${preset === k ? "border-brand-green bg-brand-green text-white" : "border-brand-border text-brand-green"}`} data-testid={`vat-preset-${k}`}>{lbl}</button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="grid sm:grid-cols-2 gap-3 max-w-lg mb-3">
            <div><label className="text-sm font-semibold block mb-1">From</label><input type="date" className="w-full rounded-lg border border-[#8C8C8C] px-3 py-2" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="vat-from" /></div>
            <div><label className="text-sm font-semibold block mb-1">To</label><input type="date" className="w-full rounded-lg border border-[#8C8C8C] px-3 py-2" value={to} onChange={(e) => setTo(e.target.value)} data-testid="vat-to" /></div>
          </div>
        )}
        <div className="flex items-center gap-4 flex-wrap">
          <a href={`${base}/admin/vat-declarations-export.csv${qs() ? `?${qs()}` : ""}`} className="inline-flex items-center gap-2 bg-brand-green text-white rounded-full px-6 py-2.5 font-semibold" data-testid="vat-export-download"><Download size={18} /> Download CSV</a>
          <span className="text-[#4A4A4D]">{items.length} declaration{items.length === 1 ? "" : "s"}{(from || to) ? ` between ${from || "start"} and ${to || "now"}` : " in total"}</span>
        </div>
      </Card>
      {err && <Card className="text-[#B71C1C]">{err}</Card>}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm"><thead className="bg-brand-bone"><tr><th className="p-3">Date</th><th className="p-3">Order</th><th className="p-3">Eligible person</th><th className="p-3">Condition</th><th className="p-3">Completed by</th><th className="p-3">Signature</th><th className="p-3">Receipt</th></tr></thead>
          <tbody>{items.map((d, i) => (
            <tr key={d.id} className={i % 2 ? "bg-brand-bone" : ""} data-testid={`vat-row-${d.order_reference}`}>
              <td className="p-3 whitespace-nowrap">{new Date(d.created_at).toLocaleDateString("en-GB")}</td>
              <td className="p-3 font-semibold">{d.order_reference}</td>
              <td className="p-3">{d.eligible_person_name}<div className="text-[#4A4A4D]">{d.eligible_person_address}</div></td>
              <td className="p-3">{d.condition_description}</td>
              <td className="p-3">{d.completed_by_name || "—"}{d.relationship ? ` (${d.relationship})` : ""}</td>
              <td className="p-3">{d.signature}</td>
              <td className="p-3 whitespace-nowrap">
                <a href={`${base}/admin/vat-declarations/${d.id}/receipt.pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-green font-semibold mr-3" data-testid={`vat-pdf-${d.order_reference}`}><FileText size={15} /> PDF</a>
                <button onClick={() => emailReceipt(d)} className="inline-flex items-center gap-1 text-brand-terracotta font-semibold" data-testid={`vat-email-${d.order_reference}`}><Mail size={15} /> Email</button>
                {d.receipt_emailed_at && <div className="text-xs text-[#4A4A4D] mt-1">Sent {new Date(d.receipt_emailed_at).toLocaleDateString("en-GB")}</div>}
              </td>
            </tr>
          ))}</tbody>
        </table>
        {items.length === 0 && !err && <p className="text-[#4A4A4D] p-4">No declarations in this period.</p>}
      </Card>
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
  const [csv, setCsv] = useState("");
  const importCsv = async () => { const r = await api.post("/admin/redirects/import", { csv }); toast.success(`Imported ${r.data.imported} redirects`); setCsv(""); load(); };
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
      <Card className="mb-6">
        <label className="font-semibold block mb-1">Bulk import (CSV: old_path,new_path[,code] — one per line)</label>
        <textarea rows={4} className="w-full rounded-lg border border-[#8C8C8C] px-3 py-2 font-mono text-sm" placeholder="/old-shop/wheelchairs,/shop?category_id=...\n/news/2019/story,/news/story" value={csv} onChange={(e) => setCsv(e.target.value)} data-testid="redirect-csv" />
        <button onClick={importCsv} disabled={!csv.trim()} className="mt-3 bg-brand-green text-white rounded-full px-6 py-2.5 font-semibold disabled:opacity-50" data-testid="redirect-import">Import CSV</button>
      </Card>
      <Card className="overflow-x-auto p-0"><table className="w-full text-left"><thead className="bg-brand-bone"><tr><th className="p-3">From</th><th className="p-3">To</th><th className="p-3">Code</th><th className="p-3"></th></tr></thead>
        <tbody>{items.map((r, i) => <tr key={r.id} className={i % 2 ? "bg-brand-bone" : ""}><td className="p-3">{r.from_path}</td><td className="p-3">{r.to_path}</td><td className="p-3">{r.status_code}</td><td className="p-3"><button onClick={() => del(r.id)} className="text-brand-terracotta font-semibold">Delete</button></td></tr>)}
        {items.length === 0 && <tr><td className="p-3 text-[#4A4A4D]" colSpan={4}>No redirects yet.</td></tr>}</tbody></table></Card>
    </div>
  );
}

function Postage() {
  const [bands, setBands] = useState([]);
  useEffect(() => { api.get("/admin/postage-bands").then((r) => setBands(r.data.bands)); }, []);
  const upd = (i, k, v) => setBands(bands.map((b, j) => j === i ? { ...b, [k]: Number(v) } : b));
  const addB = () => setBands([...bands, { max_kg: 0, price: 0 }]);
  const rm = (i) => setBands(bands.filter((_, j) => j !== i));
  const save = async () => { await api.put("/admin/postage-bands", { bands }); toast.success("Postage bands saved"); };
  const inp = "w-28 rounded-lg border border-[#8C8C8C] px-3 py-2";
  return (
    <div data-testid="admin-postage">
      <H>Postage & shipping bands</H>
      <Card className="max-w-xl">
        <p className="text-[#4A4A4D] mb-4">Postable orders are charged by total item weight (set each product's weight on its edit form). VAT is added at 20%.</p>
        {bands.map((b, i) => (
          <div key={i} className="flex items-center gap-2 mb-2 flex-wrap">
            <span>Up to</span>
            <input type="number" className={inp} value={b.max_kg} onChange={(e) => upd(i, "max_kg", e.target.value)} data-testid={`band-kg-${i}`} /><span>kg →</span>
            <span>£</span><input type="number" step="0.01" className={inp} value={b.price} onChange={(e) => upd(i, "price", e.target.value)} data-testid={`band-price-${i}`} />
            <button onClick={() => rm(i)} className="text-brand-terracotta font-semibold">Remove</button>
          </div>
        ))}
        <div className="flex gap-3 mt-4">
          <button onClick={addB} className="border-2 border-brand-green text-brand-green rounded-full px-5 py-2.5 font-semibold">Add band</button>
          <button onClick={save} className="bg-brand-green text-white rounded-full px-6 py-2.5 font-semibold" data-testid="save-bands">Save bands</button>
        </div>
      </Card>
    </div>
  );
}

