import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, gbp } from "@/lib/api";
import { ShoppingBasket, HandHeart, LifeBuoy, Leaf, ArrowRight, Recycle, PoundSterling, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import { toast } from "sonner";

const HERO = "https://images.unsplash.com/photo-1784135727495-507b3d2044f9?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

const ROUTES = [
  { to: "/shop", icon: ShoppingBasket, title: "Buy pre-loved equipment", desc: "Quality care equipment at less than half the original price.", color: "bg-brand-green" },
  { to: "/donate-equipment", icon: HandHeart, title: "Donate equipment", desc: "Give your care equipment a second life and help a family.", color: "bg-brand-terracotta" },
  { to: "/get-help", icon: LifeBuoy, title: "Find help & support", desc: "Grants and support for caregivers and older people.", color: "bg-[#3E6B57]" },
  { to: "/nhs", icon: Leaf, title: "Sustainability for care", desc: "ESG guidance and resources for NHS and care providers.", color: "bg-[#8A6D3B]" },
];

export default function Home() {
  const [products, setProducts] = useState([]);
  const [home, setHome] = useState({ impact_stats: [], partners: [], testimonials: [], settings: {} });
  const [events, setEvents] = useState([]);
  const [articles, setArticles] = useState([]);
  const [q, setQ] = useState("");
  const [email, setEmail] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    api.get("/products?limit=6&sort=recent").then((r) => setProducts(r.data.items));
    api.get("/homepage").then((r) => setHome(r.data));
    api.get("/events").then((r) => setEvents(r.data.slice(0, 3)));
    api.get("/articles").then((r) => setArticles(r.data.slice(0, 2)));
  }, []);

  const subscribe = async (e) => {
    e.preventDefault();
    try { await api.post("/newsletter", { email, consent: true }); toast.success("Thanks for subscribing!"); setEmail(""); }
    catch (err) { toast.error("Could not subscribe. Please try again."); }
  };

  return (
    <div>
      {/* Hero */}
      <section className="bg-brand-bone">
        <div className="gc-container py-14 md:py-20 grid md:grid-cols-2 gap-10 items-center">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 bg-[#E8F5E9] text-[#1B5E20] font-bold px-4 py-1.5 rounded-full text-sm mb-5"><Recycle size={16} /> Award-winning not-for-profit CIC</span>
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-brand-green">{home.settings.headline || "Affordable care equipment. Meaningful social impact."}</h1>
            <p className="mt-3 font-heading text-2xl font-semibold text-brand-green/80">{home.settings.mission || "Let's Make Care Sustainable."}</p>
            <p className="mt-4 text-xl text-[#2D2D30] max-w-xl">{home.settings.subheadline || "We rescue, refurbish and resell used care and mobility equipment at half the RRP or less."}</p>
            <form onSubmit={(e) => { e.preventDefault(); nav(`/shop?q=${encodeURIComponent(q)}`); }} className="mt-7 flex gap-2 max-w-lg" data-testid="hero-search-form">
              <div className="relative flex-1">
                <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-green" />
                <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search equipment" placeholder="Search wheelchairs, beds, bathing…" className="w-full rounded-full border border-[#8C8C8C] bg-white pl-12 pr-4 py-3.5 text-lg" data-testid="hero-search-input" />
              </div>
              <button className="bg-brand-green text-white rounded-full px-6 py-3.5 font-semibold text-lg hover:bg-brand-greenhover transition-colors" data-testid="hero-search-btn">Search</button>
            </form>
          </div>
          <div className="relative">
            <div className="rounded-2xl w-full aspect-[4/3] bg-brand-bone border-2 border-dashed border-brand-green/40 flex flex-col items-center justify-center text-center p-6" data-testid="hero-photo-placeholder">
              <span className="font-heading text-xl font-bold text-brand-green">REAL PHOTO TO REPLACE</span>
              <span className="text-base text-[#4A4A4D] mt-2">Real Grace Cares photograph — the unit, van, volunteers or a customer (with recorded permission).</span>
            </div>
          </div>
        </div>
      </section>

      {/* Four routes */}
      <section className="gc-container py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ROUTES.map((r) => (
            <Link key={r.to} to={r.to} data-testid={`route-${r.to.replace('/', '')}`} className="group bg-white rounded-2xl border border-brand-border p-7 hover:shadow-md transition-shadow flex flex-col">
              <span className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${r.color} text-white mb-4`}><r.icon size={28} /></span>
              <h3 className="font-heading text-xl font-bold text-brand-green mb-1">{r.title}</h3>
              <p className="text-[#4A4A4D] flex-grow">{r.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-brand-terracotta font-semibold group-hover:gap-2 transition-all">Get started <ArrowRight size={18} /></span>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works / model */}
      <section className="bg-brand-green text-white py-16">
        <div className="gc-container">
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-3">How buying with us creates value</h2>
          <p className="text-white/80 text-xl max-w-3xl mb-10">Every purchase makes care more affordable, keeps usable equipment out of landfill, and funds grants and activities for people in care.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[{ i: Recycle, t: "We save & rejuvenate", d: "Pre-loved equipment is collected, cleaned, safety-checked and serviced." },
              { i: PoundSterling, t: "You save money", d: "Quality equipment offered to the public, NHS and care sector at under half price." },
              { i: HandHeart, t: "Profits do good", d: "Surpluses fund hardship grants and community activities nationwide." }].map((c, i) => (
              <div key={i} className="bg-white/10 rounded-2xl p-7 border border-white/15">
                <c.i size={30} className="mb-3" />
                <h3 className="font-heading text-xl font-bold mb-1">{c.t}</h3>
                <p className="text-white/80">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact stats */}
      <section className="gc-container py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {home.impact_stats.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-brand-border p-7" data-testid="impact-stat">
              <div className="font-heading text-4xl md:text-5xl font-extrabold text-brand-terracotta">{s.value}</div>
              <div className="mt-2 text-[#4A4A4D] font-semibold">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Recently added */}
      <section className="gc-container py-6">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-brand-green">Recently added equipment</h2>
          <Link to="/shop" className="hidden sm:inline-flex items-center gap-1 text-brand-terracotta font-semibold hover:gap-2 transition-all">Shop all <ArrowRight size={18} /></Link>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* Events */}
      {events.length > 0 && (
        <section className="gc-container py-16">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-brand-green mb-8">Upcoming events & activities</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {events.map((e) => (
              <Link to={`/events/${e.slug}`} key={e.id} className="bg-white rounded-2xl border border-brand-border overflow-hidden hover:shadow-md transition-shadow" data-testid="home-event-card">
                {e.image && <img src={e.image} alt={e.name} className="w-full aspect-video object-cover" />}
                <div className="p-6">
                  <div className="text-sm text-brand-terracotta font-bold mb-1">{new Date(e.start_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" })}</div>
                  <h3 className="font-heading text-xl font-bold text-brand-green">{e.name}</h3>
                  <p className="text-[#4A4A4D] mt-1">{e.is_paid ? gbp(e.price) : "Free"} · {e.venue}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* News + testimonial */}
      <section className="gc-container py-6 grid lg:grid-cols-2 gap-10">
        <div>
          <h2 className="font-heading text-3xl font-bold text-brand-green mb-6">Latest stories</h2>
          <div className="space-y-5">
            {articles.map((a) => (
              <Link to={`/news/${a.slug}`} key={a.id} className="flex gap-4 bg-white rounded-2xl border border-brand-border p-4 hover:shadow-md transition-shadow" data-testid="home-article-card">
                {a.featured_image && <img src={a.featured_image} alt={a.title} className="w-28 h-28 object-cover rounded-xl shrink-0" />}
                <div>
                  <span className="text-xs font-bold text-brand-terracotta uppercase">{a.category}</span>
                  <h3 className="font-heading text-lg font-bold text-brand-green">{a.title}</h3>
                  <p className="text-[#4A4A4D] text-base line-clamp-2">{a.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-heading text-3xl font-bold text-brand-green mb-6">From our tribe</h2>
          <div className="space-y-4">
            {home.testimonials.map((t) => (
              <blockquote key={t.id} className="bg-white rounded-2xl border border-brand-border p-6">
                <p className="text-lg text-[#2D2D30] italic">“{t.quote}”</p>
                <footer className="mt-3 font-bold text-brand-green">— {t.author}</footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="gc-container py-14">
        <h2 className="font-heading text-2xl font-bold text-brand-green mb-6 text-center">Working together with</h2>
        <div className="flex flex-wrap justify-center gap-4">
          {home.partners.map((p) => (
            <span key={p.id} className="bg-white border border-brand-border rounded-xl px-5 py-3 font-semibold text-[#4A4A4D]">{p.name}</span>
          ))}
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-brand-terracotta text-white py-16">
        <div className="gc-container text-center max-w-2xl">
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-3">News, offers & impact — straight to your inbox</h2>
          <p className="text-white/90 text-lg mb-6">Join our community. We’ll only email you what matters, and you can unsubscribe any time.</p>
          <form onSubmit={subscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto" data-testid="newsletter-form">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address" aria-label="Email" className="flex-1 rounded-full px-5 py-3.5 text-[#1A1A1D] text-lg" data-testid="newsletter-email" />
            <button className="bg-brand-green text-white rounded-full px-7 py-3.5 font-semibold text-lg hover:bg-brand-greenhover transition-colors" data-testid="newsletter-submit">Subscribe</button>
          </form>
        </div>
      </section>
    </div>
  );
}
