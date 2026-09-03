import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

export default function News() {
  const [articles, setArticles] = useState([]);
  useEffect(() => { api.get("/articles").then((r) => setArticles(r.data)); }, []);
  return (
    <div className="gc-container py-12">
      <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-brand-green mb-2">News & stories</h1>
      <p className="text-xl text-[#4A4A4D] mb-10">The latest from Grace Cares.</p>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <Link to={`/news/${a.slug}`} key={a.id} className="bg-white rounded-2xl border border-brand-border overflow-hidden hover:shadow-md transition-shadow flex flex-col" data-testid={`news-${a.slug}`}>
            {a.featured_image && <img src={a.featured_image} alt={a.title} className="w-full aspect-video object-cover" />}
            <div className="p-6 flex flex-col flex-grow">
              <span className="text-xs font-bold text-brand-terracotta uppercase mb-1">{a.category}</span>
              <h3 className="font-heading text-xl font-bold text-brand-green mb-2">{a.title}</h3>
              <p className="text-[#4A4A4D] flex-grow">{a.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
