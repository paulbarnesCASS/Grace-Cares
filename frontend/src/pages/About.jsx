import React from "react";
import { Link } from "react-router-dom";
import { Award, Heart, Recycle } from "lucide-react";

const COMMUNITY = "https://images.unsplash.com/photo-1773227059228-6ed1a6349aa9?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function About() {
  return (
    <div>
      <section className="gc-container py-14 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <span className="inline-flex items-center gap-2 bg-[#E8F5E9] text-[#1B5E20] font-bold px-4 py-1.5 rounded-full text-sm mb-4"><Award size={16} /> Award-winning CIC</span>
          <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-brand-green mb-4">About Grace Cares</h1>
          <p className="text-xl text-[#2D2D30] mb-4">Grace Cares is a Lichfield-based, not-for-profit Community Interest Company on a mission to make care sustainable.</p>
          <p className="text-lg text-[#4A4A4D]">We save, rejuvenate and sell pre-loved care equipment — offering it to the public, NHS and care sector at less than half its original price. The profits fund hardship grants and support for unpaid caregivers and older people nationwide, and pay for sustainable community activities and events. Care is at the heart of everything we do.</p>
        </div>
        <img src={COMMUNITY} alt="Older people talking and connecting at a Grace Cares activity" className="rounded-2xl aspect-[4/3] object-cover" />
      </section>
      <section className="bg-brand-green text-white py-16">
        <div className="gc-container grid md:grid-cols-3 gap-6">
          {[{ i: Recycle, t: "Sustainable", d: "Keeping usable equipment out of landfill and lowering carbon." },
            { i: Heart, t: "Caring", d: "Human and community-led — supporting people in care." },
            { i: Award, t: "Trusted", d: "Working with the NHS, councils and leading care organisations." }].map((c) => (
            <div key={c.t} className="bg-white/10 rounded-2xl p-7 border border-white/15">
              <c.i size={30} className="mb-3" />
              <h3 className="font-heading text-xl font-bold mb-1">{c.t}</h3>
              <p className="text-white/80">{c.d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="gc-container py-16 text-center">
        <h2 className="font-heading text-3xl font-bold text-brand-green mb-4">Be part of it</h2>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/shop" className="bg-brand-green text-white rounded-full px-6 py-3 font-semibold">Shop equipment</Link>
          <Link to="/get-involved" className="border-2 border-brand-green text-brand-green rounded-full px-6 py-3 font-semibold">Get involved</Link>
          <Link to="/donate-funds" className="bg-brand-terracotta text-white rounded-full px-6 py-3 font-semibold">Donate</Link>
        </div>
      </section>
    </div>
  );
}
