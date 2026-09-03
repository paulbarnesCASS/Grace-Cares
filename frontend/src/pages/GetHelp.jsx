import React from "react";
import EnquiryForm from "@/components/EnquiryForm";
import { LifeBuoy, HandCoins, Users, HeartHandshake } from "lucide-react";

const CARDS = [
  { icon: HandCoins, t: "Hardship & equipment grants", d: "Support towards essential care equipment for those who need it most." },
  { icon: Users, t: "Unpaid caregiver support", d: "You're not alone. We're here to help caregivers with information and support." },
  { icon: HeartHandshake, t: "Older-person support", d: "Activities, companionship and practical help for older people." },
];

export default function GetHelp() {
  return (
    <div className="gc-container py-12">
      <LifeBuoy size={44} className="text-brand-terracotta mb-3" />
      <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-brand-green mb-2">Get help & support</h1>
      <p className="text-xl text-[#4A4A4D] max-w-2xl mb-10">Whether you're a caregiver, an older person, or a family member — we're here to help. Choose what you need below and we'll route your enquiry to the right team.</p>
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {CARDS.map((c) => (
          <div key={c.t} className="bg-white rounded-2xl border border-brand-border p-7">
            <c.icon size={30} className="text-brand-green mb-3" />
            <h3 className="font-heading text-xl font-bold text-brand-green mb-1">{c.t}</h3>
            <p className="text-[#4A4A4D]">{c.d}</p>
          </div>
        ))}
      </div>
      <div className="max-w-2xl">
        <EnquiryForm title="Request support" intro="Your enquiry is treated in confidence. Sensitive support requests are only seen by approved team members." allowed={["caregiver_support", "older_person_support", "hardship_grant", "activities", "general"]} />
      </div>
    </div>
  );
}
