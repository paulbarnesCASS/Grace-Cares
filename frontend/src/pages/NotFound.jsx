import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

export default function NotFound() {
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    const path = window.location.pathname;
    api.get(`/redirects/resolve?path=${encodeURIComponent(path)}`)
      .then((r) => { if (r.data.found) { window.location.replace(r.data.to); } else { setChecking(false); } })
      .catch(() => setChecking(false));
  }, []);
  if (checking) return <div className="gc-container py-24 text-center text-xl">One moment…</div>;
  return (
    <div className="gc-container py-24 text-center max-w-xl">
      <h1 className="font-heading text-5xl font-extrabold text-brand-green mb-3">Page not found</h1>
      <p className="text-xl text-[#4A4A4D] mb-6">Sorry, we couldn't find that page. It may have moved.</p>
      <div className="flex gap-3 justify-center">
        <Link to="/" className="bg-brand-green text-white rounded-full px-6 py-3 font-semibold">Home</Link>
        <Link to="/shop" className="border-2 border-brand-green text-brand-green rounded-full px-6 py-3 font-semibold">Shop equipment</Link>
      </div>
    </div>
  );
}
