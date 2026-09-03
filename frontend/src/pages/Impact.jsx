import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Leaf, ArrowRight } from "lucide-react";

export default function Impact() {
  const [stories, setStories] = useState([]);
  const [stats, setStats] = useState([]);
  useEffect(() => {
    api.get("/articles?is_impact=true").then((r) => setStories(r.data));
    api.get("/homepage").then((r) => setStats(r.data.impact_stats));
  }, []);
  return (
    <div>
      <section className="bg-brand-green text-white py-16">
        <div className="gc-container">
          <h1 className="font-heading text-4xl md:text-5xl font-extrabold mb-3">Our impact</h1>
          <p className="text-xl text-white/85 max-w-2xl">Real change for people and planet. Here's what your support helps us achieve.</p>
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.id} className="bg-white/10 rounded-2xl p-6 border border-white/15 text-center">
                <div className="font-heading text-4xl font-extrabold">{s.value}</div>
                <div className="mt-1 text-white/80">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="gc-container py-16">
        <h2 className="font-heading text-3xl font-bold text-brand-green mb-8">Impact stories</h2>
        <div className="grid gap-8 md:grid-cols-2">
          {stories.map((a) => (
            <Link to={`/news/${a.slug}`} key={a.id} className="bg-white rounded-2xl border border-brand-border overflow-hidden hover:shadow-md transition-shadow" data-testid={`impact-${a.slug}`}>
              {a.featured_image && <img src={a.featured_image} alt={a.title} className="w-full aspect-video object-cover" />}
              <div className="p-7">
                <h3 className="font-heading text-2xl font-bold text-brand-green mb-2">{a.title}</h3>
                <p className="text-[#4A4A4D] mb-4">{a.excerpt}</p>
                {a.impact_environmental && <p className="text-[#1B5E20] font-semibold flex items-center gap-2"><Leaf size={18} /> {a.impact_environmental}</p>}
                <span className="mt-4 inline-flex items-center gap-1 text-brand-terracotta font-semibold">Read the story <ArrowRight size={18} /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
