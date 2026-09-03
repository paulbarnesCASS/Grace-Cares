import React, { useState, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X, ShoppingBasket, User, Search, Heart, Phone, Megaphone } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

const NAV = [
  { to: "/shop", label: "Shop Care Equipment" },
  { to: "/donate-equipment", label: "Donate Equipment" },
  { to: "/get-help", label: "Get Help & Support" },
  { to: "/nhs", label: "NHS & Care Providers" },
  { to: "/events", label: "Events & Activities" },
  { to: "/impact", label: "Our Impact" },
  { to: "/get-involved", label: "Get Involved" },
  { to: "/about", label: "About" },
  { to: "/news", label: "News" },
  { to: "/contact", label: "Contact" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { count } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [announce, setAnnounce] = useState(null);
  useEffect(() => { api.get("/homepage").then((r) => { const s = r.data.settings || {}; if (s.announcement_active && s.announcement_text) setAnnounce(s); }).catch(() => {}); }, []);
  const isAdmin = user && user.role && user.role !== "customer";

  const submitSearch = (e) => { e.preventDefault(); nav(`/shop?q=${encodeURIComponent(q)}`); setOpen(false); };

  return (
    <header className="bg-white border-b border-brand-border sticky top-0 z-50" data-testid="site-header">
      {announce && (
        <Link to={announce.announcement_link || "/shop"} className="block bg-brand-lime text-[#003d20] text-center text-sm font-bold py-2 px-4 hover:underline" data-testid="announcement-bar">
          <Megaphone size={16} className="inline mr-2" />{announce.announcement_text}
        </Link>
      )}
      <div className="bg-brand-green text-white text-sm">
        <div className="gc-container flex items-center justify-between py-1.5">
          <a href="tel:01543730189" className="flex items-center gap-2 hover:underline" data-testid="header-phone">
            <Phone size={16} /> 01543 730189
          </a>
          <span className="hidden sm:inline">Mon–Fri, 9am–5pm · Lichfield</span>
        </div>
      </div>
      <div className="gc-container flex items-center justify-between py-4 gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0" data-testid="logo-link">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-green text-white font-heading font-bold text-xl">GC</span>
          <span className="font-heading font-extrabold text-2xl text-brand-green leading-none">Grace&nbsp;Cares</span>
        </Link>

        <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-md" data-testid="header-search-form">
          <div className="relative w-full">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-green" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search care equipment…"
              aria-label="Search care equipment"
              data-testid="header-search-input"
              className="w-full rounded-full border border-[#8C8C8C] bg-white pl-11 pr-4 py-2.5 text-base focus:border-brand-green"
            />
          </div>
        </form>

        <div className="flex items-center gap-1 sm:gap-3">
          <Link to="/wishlist" className="hidden sm:inline-flex p-2 text-brand-green hover:text-brand-terracotta" aria-label="Wishlist" data-testid="wishlist-link"><Heart size={24} /></Link>
          <Link to={user ? (isAdmin ? "/admin" : "/account") : "/login"} className="inline-flex items-center gap-1.5 p-2 text-brand-green hover:text-brand-terracotta font-semibold" data-testid="account-link">
            <User size={24} /><span className="hidden lg:inline">{user ? "My Account" : "Sign in"}</span>
          </Link>
          <Link to="/cart" className="relative inline-flex items-center gap-1.5 p-2 text-brand-green hover:text-brand-terracotta font-semibold" data-testid="cart-link">
            <ShoppingBasket size={24} />
            {count > 0 && <span className="absolute -top-1 -right-1 bg-brand-terracotta text-white text-xs font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center" data-testid="cart-count">{count}</span>}
            <span className="hidden lg:inline">Basket</span>
          </Link>
          <Link to="/donate-funds" className="hidden sm:inline-flex bg-brand-lime text-[#003d20] rounded-full px-5 py-2.5 font-bold hover:brightness-95 transition-all" data-testid="donate-funds-btn">Donate</Link>
          <button onClick={() => setOpen(!open)} className="lg:hidden p-2 text-brand-green" aria-label="Menu" data-testid="mobile-menu-btn">{open ? <X size={28} /> : <Menu size={28} />}</button>
        </div>
      </div>

      <nav className="hidden lg:block border-t border-brand-border bg-white" data-testid="desktop-nav">
        <div className="gc-container flex flex-wrap gap-x-6 gap-y-1 py-2">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} data-testid={`nav-${n.to.replace('/', '')}`}
              className={({ isActive }) => `py-1 font-semibold text-[15px] hover:text-brand-terracotta hover:underline underline-offset-4 ${isActive ? "text-brand-terracotta underline" : "text-brand-green"}`}>
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {open && (
        <div className="lg:hidden border-t border-brand-border bg-white" data-testid="mobile-menu">
          <form onSubmit={submitSearch} className="p-4">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search care equipment…" aria-label="Search" className="w-full rounded-full border border-[#8C8C8C] px-4 py-3" data-testid="mobile-search-input" />
          </form>
          <div className="flex flex-col px-4 pb-4">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="py-3 border-b border-brand-border font-semibold text-brand-green text-lg" data-testid={`mnav-${n.to.replace('/', '')}`}>{n.label}</Link>
            ))}
            <Link to="/donate-funds" onClick={() => setOpen(false)} className="mt-4 bg-brand-terracotta text-white rounded-full px-5 py-3 font-semibold text-center">Donate Funds</Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="bg-brand-green text-white mt-20" data-testid="site-footer">
      <div className="gc-container py-14 grid gap-10 md:grid-cols-4">
        <div>
          <div className="font-heading font-extrabold text-2xl mb-3">Grace Cares</div>
          <p className="text-white/80 text-base">An award-winning not-for-profit CIC in Lichfield, on a mission to make care sustainable.</p>
        </div>
        <div>
          <h4 className="font-heading font-bold text-lg mb-3">Explore</h4>
          <ul className="space-y-2 text-white/80">
            <li><Link to="/shop" className="hover:underline">Shop Equipment</Link></li>
            <li><Link to="/donate-equipment" className="hover:underline">Donate Equipment</Link></li>
            <li><Link to="/events" className="hover:underline">Events</Link></li>
            <li><Link to="/resources" className="hover:underline">Care Provider Resources</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-bold text-lg mb-3">Support</h4>
          <ul className="space-y-2 text-white/80">
            <li><Link to="/get-help" className="hover:underline">Get Help & Support</Link></li>
            <li><Link to="/nhs" className="hover:underline">NHS & Care Providers</Link></li>
            <li><Link to="/get-involved" className="hover:underline">Volunteer</Link></li>
            <li><Link to="/privacy" className="hover:underline">Privacy & Cookies</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-heading font-bold text-lg mb-3">Contact</h4>
          <ul className="space-y-2 text-white/80">
            <li><a href="tel:01543730189" className="hover:underline">01543 730189</a></li>
            <li><a href="mailto:hello@grace-cares.com" className="hover:underline">hello@grace-cares.com</a></li>
            <li>Lichfield, Staffordshire</li>
            <li>Mon–Fri, 9am–5pm</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15 py-5 text-center text-white/70 text-sm">
        © {new Date().getFullYear()} Grace Cares CIC · Making care sustainable
      </div>
    </footer>
  );
}

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-brand-bone">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
