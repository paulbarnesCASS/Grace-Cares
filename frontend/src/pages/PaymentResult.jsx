import React, { useEffect, useState } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function PaymentResult() {
  const [params] = useSearchParams();
  const loc = useLocation();
  const isCancel = loc.pathname.includes("cancel");
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState(isCancel ? "cancel" : "checking");
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (isCancel || !sessionId) return;
    let tries = 0;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        setInfo(data);
        if (data.payment_status === "paid") { setStatus("paid"); return; }
        if (data.payment_status === "failed" || data.payment_status === "expired") { setStatus("failed"); return; }
      } catch {}
      if (tries++ < 10) setTimeout(poll, 2000); else setStatus("timeout");
    };
    poll();
  }, [sessionId, isCancel]);

  return (
    <div className="gc-container py-24 max-w-xl text-center" data-testid="payment-result">
      {status === "checking" && <><Loader2 size={56} className="mx-auto animate-spin text-brand-green mb-4" /><h1 className="font-heading text-3xl font-bold text-brand-green">Confirming your payment…</h1><p className="text-lg text-[#4A4A4D] mt-2">Please wait, this only takes a moment.</p></>}
      {status === "paid" && <><CheckCircle2 size={64} className="mx-auto text-[#1B5E20] mb-4" /><h1 className="font-heading text-3xl font-bold text-brand-green">Thank you! Your payment was successful</h1><p className="text-lg text-[#4A4A4D] mt-2">{info?.order_ref && <>Reference <strong>{info.order_ref}</strong>. </>}A confirmation email and receipt are on their way. We'll be in touch about collection or delivery.</p><div className="mt-6 flex gap-3 justify-center"><Link to="/account" className="bg-brand-green text-white rounded-full px-6 py-3 font-semibold">View my account</Link><Link to="/shop" className="border-2 border-brand-green text-brand-green rounded-full px-6 py-3 font-semibold">Continue shopping</Link></div></>}
      {(status === "cancel" || status === "failed" || status === "timeout") && <><XCircle size={64} className="mx-auto text-brand-terracotta mb-4" /><h1 className="font-heading text-3xl font-bold text-brand-green">{status === "cancel" ? "Payment cancelled" : "We couldn't confirm your payment"}</h1><p className="text-lg text-[#4A4A4D] mt-2">Your basket has been kept. You can try again, or contact us on 01543 730189 if you need help.</p><Link to="/cart" className="mt-6 inline-block bg-brand-terracotta text-white rounded-full px-6 py-3 font-semibold">Return to basket</Link></>}
    </div>
  );
}
