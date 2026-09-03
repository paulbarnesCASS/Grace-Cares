import React, { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    await api.post("/auth/forgot-password", { email });
    setSent(true);
  };
  const input = "w-full rounded-lg border border-[#8C8C8C] px-4 py-3 text-lg";
  return (
    <div className="gc-container py-16 max-w-md">
      <h1 className="font-heading text-4xl font-extrabold text-brand-green mb-6">Reset your password</h1>
      {sent ? (
        <div className="bg-white rounded-2xl border border-brand-border p-7">
          <p className="text-lg">If an account exists for <strong>{email}</strong>, we've sent a reset link. Please check your inbox.</p>
          <Link to="/login" className="mt-4 inline-block text-brand-terracotta hover:underline">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-brand-border p-7 space-y-4">
          <div><label className="block font-semibold mb-1">Email</label><input required type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} data-testid="forgot-email" /></div>
          <button className="w-full bg-brand-green text-white rounded-full px-6 py-3.5 font-semibold text-lg" data-testid="forgot-submit">Send reset link</button>
        </form>
      )}
    </div>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try { await api.post("/auth/reset-password", { token, password }); setDone(true); toast.success("Password updated"); }
    catch (e2) { setErr(formatApiErrorDetail(e2.response?.data?.detail)); }
  };
  const input = "w-full rounded-lg border border-[#8C8C8C] px-4 py-3 text-lg";
  return (
    <div className="gc-container py-16 max-w-md">
      <h1 className="font-heading text-4xl font-extrabold text-brand-green mb-6">Choose a new password</h1>
      {done ? (
        <div className="bg-white rounded-2xl border border-brand-border p-7">
          <p className="text-lg">Your password has been updated. <Link to="/login" className="text-brand-terracotta hover:underline">Sign in</Link></p>
        </div>
      ) : (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-brand-border p-7 space-y-4">
          {err && <div className="bg-[#FDECEA] text-[#B71C1C] rounded-lg px-4 py-3" data-testid="reset-error">{err}</div>}
          {!token && <div className="bg-[#FFF3E0] text-[#5a4a30] rounded-lg px-4 py-3">This reset link is missing or invalid.</div>}
          <div><label className="block font-semibold mb-1">New password</label><input required type="password" minLength={6} className={input} value={password} onChange={(e) => setPassword(e.target.value)} data-testid="reset-password" /></div>
          <button disabled={!token} className="w-full bg-brand-green text-white rounded-full px-6 py-3.5 font-semibold text-lg disabled:opacity-60" data-testid="reset-submit">Update password</button>
        </form>
      )}
    </div>
  );
}
