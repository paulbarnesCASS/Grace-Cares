import React from "react";
import { Link } from "react-router-dom";
import EnquiryForm from "@/components/EnquiryForm";
import { Leaf, ClipboardCheck, Recycle, ArrowRight } from "lucide-react";

const SUSTAIN = "https://images.unsplash.com/photo-1707129900844-484443dd3534?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function NHS() {
  return (
    <div>
      <section className="bg-brand-green text-white py-16">
        <div className="gc-container grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-2 bg-white/15 px-4 py-1.5 rounded-full text-sm font-bold mb-4"><Leaf size={16} /> Sustainability & ESG</span>
            <h1 className="font-heading text-4xl md:text-5xl font-extrabold">NHS & care providers</h1>
            <p className="mt-4 text-xl text-white/85">Buy quality pre-loved equipment at under half price, reduce your carbon footprint, and evidence your commitment to environmental sustainability to the regulator.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/shop" className="bg-white text-brand-green rounded-full px-6 py-3 font-semibold">Shop for your service</Link>
              <Link to="/resources" className="border-2 border-white text-white rounded-full px-6 py-3 font-semibold">View resources</Link>
            </div>
          </div>
          <img src={SUSTAIN} alt="Hands holding a young plant, representing sustainability" className="rounded-2xl aspect-[4/3] object-cover" />
        </div>
      </section>

      <section className="gc-container py-16 grid md:grid-cols-3 gap-6">
        {[{ i: Recycle, t: "Lower cost, lower carbon", d: "Serviced, safety-checked equipment for the public, NHS and care sector at less than half price." },
          { i: ClipboardCheck, t: "Evidence being well-led", d: "Demonstrate your ESG and environmental commitment with our guidance and resources." },
          { i: Leaf, t: "Measurable impact", d: "Track estimated carbon savings from every item you reuse through Grace Cares." }].map((c) => (
          <div key={c.t} className="bg-white rounded-2xl border border-brand-border p-7">
            <c.i size={30} className="text-brand-green mb-3" />
            <h3 className="font-heading text-xl font-bold text-brand-green mb-1">{c.t}</h3>
            <p className="text-[#4A4A4D]">{c.d}</p>
          </div>
        ))}
      </section>

      <section className="gc-container pb-16 grid lg:grid-cols-2 gap-10 items-start">
        <div>
          <h2 className="font-heading text-3xl font-bold text-brand-green mb-3">Care provider resource library</h2>
          <p className="text-lg text-[#4A4A4D] mb-4">Sustainability guides, ESG checklists, templates and webinar recordings to help your service.</p>
          <Link to="/resources" className="inline-flex items-center gap-1 text-brand-terracotta font-semibold hover:gap-2 transition-all">Browse resources <ArrowRight size={18} /></Link>
        </div>
        <EnquiryForm title="Talk to our team" intro="For NHS, care-provider and sustainability enquiries." allowed={["nhs", "care_provider", "corporate"]} presetType="care_provider" />
      </section>
    </div>
  );
}
