import React from "react";
import EnquiryForm from "@/components/EnquiryForm";
import { Phone, Mail, MapPin, Clock } from "lucide-react";

export default function Contact() {
  return (
    <div className="gc-container py-12 grid lg:grid-cols-2 gap-10">
      <div>
        <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-brand-green mb-4">Contact us</h1>
        <p className="text-xl text-[#4A4A4D] mb-8">We'd love to hear from you. Call us, email us, or send a message and we'll get back to you.</p>
        <div className="space-y-4 text-lg">
          <a href="tel:01543730189" className="flex items-center gap-3 hover:underline" data-testid="contact-phone"><span className="h-11 w-11 rounded-full bg-brand-green text-white flex items-center justify-center"><Phone size={20} /></span> 01543 730189</a>
          <a href="mailto:hello@grace-cares.com" className="flex items-center gap-3 hover:underline"><span className="h-11 w-11 rounded-full bg-brand-green text-white flex items-center justify-center"><Mail size={20} /></span> hello@grace-cares.com</a>
          <div className="flex items-center gap-3"><span className="h-11 w-11 rounded-full bg-brand-green text-white flex items-center justify-center"><MapPin size={20} /></span> Lichfield, Staffordshire</div>
          <div className="flex items-center gap-3"><span className="h-11 w-11 rounded-full bg-brand-green text-white flex items-center justify-center"><Clock size={20} /></span> Mon–Fri, 9am–5pm</div>
        </div>
      </div>
      <EnquiryForm title="Send us a message" intro="Choose your enquiry type and we'll route it to the right team." />
    </div>
  );
}
