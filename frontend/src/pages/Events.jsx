import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, gbp } from "@/lib/api";
import { Calendar, MapPin, Users } from "lucide-react";

export default function Events() {
  const [events, setEvents] = useState([]);
  useEffect(() => { api.get("/events").then((r) => setEvents(r.data)); }, []);
  return (
    <div className="gc-container py-12">
      <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-brand-green mb-2">Events & activities</h1>
      <p className="text-xl text-[#4A4A4D] mb-10 max-w-2xl">Free and paid community activities, tea parties, sustainability sessions and webinars for older people, caregivers and care providers.</p>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <Link to={`/events/${e.slug}`} key={e.id} className="bg-white rounded-2xl border border-brand-border overflow-hidden hover:shadow-md transition-shadow flex flex-col" data-testid={`event-card-${e.slug}`}>
            {e.image && <img src={e.image} alt={e.name} className="w-full aspect-video object-cover" />}
            <div className="p-6 flex flex-col flex-grow">
              <div className="flex items-center gap-2 text-brand-terracotta font-bold text-sm mb-2"><Calendar size={16} /> {new Date(e.start_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</div>
              <h3 className="font-heading text-xl font-bold text-brand-green mb-2">{e.name}</h3>
              <p className="text-[#4A4A4D] line-clamp-3 flex-grow">{e.description}</p>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-[#4A4A4D]"><MapPin size={15} /> {e.venue}</span>
                <span className="font-bold text-brand-green">{e.is_paid ? gbp(e.price) : "Free"}</span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-sm text-[#4A4A4D]"><Users size={15} /> {e.spots_left > 0 ? `${e.spots_left} spaces left` : "Waiting list"}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
