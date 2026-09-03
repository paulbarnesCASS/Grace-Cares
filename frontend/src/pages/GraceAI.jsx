import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Bot, Send, Phone, User } from "lucide-react";

const CHIPS = [
  "Do I qualify for VAT relief?",
  "Which wheelchair is suitable for my mum?",
  "How does delivery work?",
  "How do I donate equipment?",
];

export default function GraceAI() {
  const [msgs, setMsgs] = useState([
    { role: "ai", text: "Hello, I'm Grace — Grace Cares' assistant. I can help with general questions about buying, donating, delivery and events. I won't give medical or suitability advice, and I can't decide if you personally qualify for VAT relief — for those I'll always point you to a real person. How can I help?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setMsgs((m) => [...m, { role: "user", text: message }]);
    setInput(""); setBusy(true);
    try {
      const { data } = await api.post("/grace-ai", { message });
      setMsgs((m) => [...m, { role: "ai", text: data.reply, handoff: data.handoff }]);
    } catch {
      setMsgs((m) => [...m, { role: "ai", text: "Sorry, I'm having trouble right now. Please call us on 01543 730189." }]);
    }
    setBusy(false);
  };

  return (
    <div className="gc-container py-10 max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <span className="h-12 w-12 rounded-full bg-brand-green text-white flex items-center justify-center"><Bot size={26} /></span>
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-brand-green">Ask Grace</h1>
          <p className="text-[#4A4A4D]">An automated assistant · not a person · won't give clinical or VAT-eligibility advice</p>
        </div>
      </div>
      <div className="bg-[#FFF8E1] border border-[#FFE082] rounded-xl p-3 text-sm text-[#5a4a30] mb-4" data-testid="grace-ai-disclaimer">
        Grace is a stub assistant for this build (no live AI connected). For anything about a person's health, whether equipment is suitable, or whether you qualify for VAT relief, please call <a href="tel:01543730189" className="font-bold underline">01543 730189</a>.
      </div>

      <div className="bg-white rounded-2xl border border-brand-border p-4 min-h-[340px] flex flex-col gap-3" data-testid="grace-ai-chat">
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "ai" && <span className="h-8 w-8 shrink-0 rounded-full bg-brand-green text-white flex items-center justify-center"><Bot size={18} /></span>}
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.role === "user" ? "bg-brand-green text-white" : "bg-brand-bone text-[#1A1A1D]"}`} data-testid={`msg-${m.role}`}>
              {m.text}
              {m.handoff && <div className="mt-2"><a href="tel:01543730189" className="inline-flex items-center gap-1 bg-brand-lime text-[#003d20] rounded-full px-3 py-1.5 font-bold text-sm"><Phone size={14} /> Call a person</a></div>}
            </div>
            {m.role === "user" && <span className="h-8 w-8 shrink-0 rounded-full bg-brand-bone flex items-center justify-center"><User size={18} /></span>}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {CHIPS.map((c) => <button key={c} onClick={() => send(c)} className="rounded-full border border-brand-border bg-white px-3 py-1.5 text-sm font-semibold text-brand-green hover:bg-brand-bone" data-testid="grace-ai-chip">{c}</button>)}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your question…" aria-label="Message" className="flex-1 rounded-full border border-[#8C8C8C] px-4 py-3 text-lg" data-testid="grace-ai-input" />
        <button disabled={busy} className="bg-brand-green text-white rounded-full px-5 py-3 font-semibold disabled:opacity-60 flex items-center gap-2" data-testid="grace-ai-send"><Send size={18} /> Send</button>
      </form>
      <p className="text-sm text-[#4A4A4D] mt-3">Prefer a human? <Link to="/contact" className="text-brand-green font-semibold underline">Contact us</Link> or call 01543 730189.</p>
    </div>
  );
}
