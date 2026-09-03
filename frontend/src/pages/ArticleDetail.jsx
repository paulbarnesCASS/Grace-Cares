import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Leaf, Users, HeartHandshake, Handshake, Target } from "lucide-react";

export default function ArticleDetail() {
  const { slug } = useParams();
  const [a, setA] = useState(null);
  useEffect(() => { window.scrollTo(0, 0); api.get(`/articles/${slug}`).then((r) => setA(r.data)); }, [slug]);
  if (!a) return <div className="gc-container py-20 text-center text-xl">Loading…</div>;

  const impact = [
    ["The problem", a.impact_problem, Target],
    ["What we did", a.impact_action, HeartHandshake],
    ["Who benefited", a.impact_beneficiaries, Users],
    ["Environmental impact", a.impact_environmental, Leaf],
    ["Social impact", a.impact_social, HeartHandshake],
    ["Partners", a.impact_partners, Handshake],
    ["Outcomes", a.impact_outcomes, Target],
  ].filter(([, v]) => v);

  return (
    <article className="gc-container py-10 max-w-3xl">
      <nav className="text-sm text-[#4A4A4D] mb-4"><Link to="/news" className="hover:underline">News</Link> / <span className="text-brand-green">{a.title}</span></nav>
      <span className="text-xs font-bold text-brand-terracotta uppercase">{a.category} · {a.author}</span>
      <h1 className="font-heading text-4xl font-extrabold text-brand-green mt-2 mb-6">{a.title}</h1>
      {a.featured_image && <img src={a.featured_image} alt={a.title} className="w-full aspect-video object-cover rounded-2xl mb-8" />}
      <div className="text-lg leading-relaxed whitespace-pre-line">{a.content}</div>
      {a.is_impact && impact.length > 0 && (
        <div className="mt-10 grid sm:grid-cols-2 gap-4">
          {impact.map(([t, v, I]) => (
            <div key={t} className="bg-white rounded-2xl border border-brand-border p-5">
              <div className="flex items-center gap-2 text-brand-green font-heading font-bold mb-1"><I size={20} /> {t}</div>
              <p className="text-[#4A4A4D]">{v}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
