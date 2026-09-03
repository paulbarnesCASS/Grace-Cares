import React from "react";
import { Link } from "react-router-dom";
import EnquiryForm from "@/components/EnquiryForm";
import { Users, Heart, Building2, HandCoins } from "lucide-react";

const CARDS = [
  { icon: Users, t: "Volunteer or work experience", d: "Join our tribe and help make care sustainable." },
  { icon: HandCoins, t: "Fundraise", d: "Run an event or campaign to support our work." },
  { icon: Building2, t: "Corporate partnership", d: "Partner with us on social value and ESG." },
  { icon: Heart, t: "Donate funds", d: "Support hardship grants and community activities." },
];

export default function GetInvolved() {
  return (
    <div className="gc-container py-12">
      <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-brand-green mb-2">Get involved</h1>
      <p className="text-xl text-[#4A4A4D] mb-10 max-w-2xl">There are many ways to be part of Grace Cares — donate equipment, funds or your time.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {CARDS.map((c) => (
          <div key={c.t} className="bg-white rounded-2xl border border-brand-border p-7">
            <c.icon size={30} className="text-brand-green mb-3" />
            <h3 className="font-heading text-xl font-bold text-brand-green mb-1">{c.t}</h3>
            <p className="text-[#4A4A4D]">{c.d}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mb-12">
        <Link to="/donate-equipment" className="bg-brand-green text-white rounded-full px-6 py-3 font-semibold">Donate equipment</Link>
        <Link to="/donate-funds" className="bg-brand-terracotta text-white rounded-full px-6 py-3 font-semibold">Donate funds</Link>
      </div>
      <div className="max-w-2xl">
        <EnquiryForm title="Register your interest" allowed={["volunteering", "fundraising", "corporate", "other"]} presetType="volunteering" />
      </div>
    </div>
  );
}
