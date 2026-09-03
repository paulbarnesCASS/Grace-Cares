import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { FileText, Download, Lock, Search } from "lucide-react";

export default function Resources() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ email: "", name: "", marketing_consent: false });

  const load = () => api.get(`/resources${q ? `?q=${encodeURIComponent(q)}` : ""}`).then((r) => setItems(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  const download = async (r, gatedForm) => {
    try {
      const body = gatedForm ? form : {};
      const { data } = await api.post(`/resources/${r.id}/download`, body);
      if (data.file_url) { toast.success(`Opening ${data.title}`); window.open(data.file_url, "_blank"); }
      setModal(null); setForm({ email: "", name: "", marketing_consent: false });
    } catch (e) { toast.error("Please enter your email to access this resource."); }
  };

  return (
    <div className="gc-container py-12">
      <FileText size={44} className="text-brand-green mb-3" />
      <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-brand-green mb-2">Care provider resources</h1>
      <p className="text-xl text-[#4A4A4D] mb-8 max-w-2xl">Sustainability guides, ESG checklists, templates and webinar recordings to support your service.</p>
      <div className="relative max-w-md mb-8">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-green" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search resources…" className="w-full rounded-full border border-[#8C8C8C] pl-11 pr-4 py-3" data-testid="resource-search" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-brand-border overflow-hidden flex flex-col" data-testid={`resource-${r.slug}`}>
            {r.image && <img src={r.image} alt={r.title} className="w-full aspect-video object-cover" />}
            <div className="p-6 flex flex-col flex-grow">
              <span className="text-xs font-bold text-brand-terracotta uppercase mb-1">{r.category}</span>
              <h3 className="font-heading text-lg font-bold text-brand-green mb-1">{r.title}</h3>
              <p className="text-[#4A4A4D] text-base flex-grow">{r.description}</p>
              <button onClick={() => r.gated ? setModal(r) : download(r, false)} className="mt-4 inline-flex items-center justify-center gap-2 bg-brand-green text-white rounded-full px-5 py-2.5 font-semibold hover:bg-brand-greenhover transition-colors" data-testid={`download-${r.slug}`}>
                {r.gated ? <><Lock size={16} /> Get this resource</> : <><Download size={16} /> Download</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl p-7 max-w-md w-full" onClick={(e) => e.stopPropagation()} data-testid="gated-modal">
            <h3 className="font-heading text-xl font-bold text-brand-green mb-1">{modal.title}</h3>
            <p className="text-[#4A4A4D] mb-4">Please enter your details to access this resource.</p>
            <div className="space-y-3">
              <input placeholder="Name" className="w-full rounded-lg border border-[#8C8C8C] px-4 py-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="gated-name" />
              <input required type="email" placeholder="Email *" className="w-full rounded-lg border border-[#8C8C8C] px-4 py-3" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="gated-email" />
              <label className="flex items-start gap-2 cursor-pointer text-base"><input type="checkbox" checked={form.marketing_consent} onChange={(e) => setForm({ ...form, marketing_consent: e.target.checked })} className="h-5 w-5 mt-1" data-testid="gated-marketing" /><span>Send me sustainability updates by email. (Optional — we won't add you otherwise.)</span></label>
              <button onClick={() => download(modal, true)} className="w-full bg-brand-terracotta text-white rounded-full px-5 py-3 font-semibold" data-testid="gated-submit">Access resource</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
