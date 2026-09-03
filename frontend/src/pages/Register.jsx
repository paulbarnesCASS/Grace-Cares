import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { await register(f); toast.success("Account created!"); nav("/account"); }
    catch (e2) { setErr(formatApiErrorDetail(e2.response?.data?.detail) || "Registration failed"); }
    setBusy(false);
  };
  const input = "w-full rounded-lg border border-[#8C8C8C] px-4 py-3 text-lg";
  return (
    <div className="gc-container py-16 max-w-md">
      <h1 className="font-heading text-4xl font-extrabold text-brand-green mb-6">Create an account</h1>
      <form onSubmit={submit} className="bg-white rounded-2xl border border-brand-border p-7 space-y-4">
        {err && <div className="bg-[#FDECEA] text-[#B71C1C] rounded-lg px-4 py-3" data-testid="register-error">{err}</div>}
        <div><label className="block font-semibold mb-1">Full name</label><input required className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="register-name" /></div>
        <div><label className="block font-semibold mb-1">Email</label><input required type="email" className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="register-email" /></div>
        <div><label className="block font-semibold mb-1">Password</label><input required type="password" minLength={6} className={input} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} data-testid="register-password" /></div>
        <button disabled={busy} className="w-full bg-brand-green text-white rounded-full px-6 py-3.5 font-semibold text-lg disabled:opacity-60" data-testid="register-submit">{busy ? "Creating…" : "Create account"}</button>
        <p className="text-base text-center">Already have an account? <Link to="/login" className="text-brand-terracotta hover:underline">Sign in</Link></p>
      </form>
    </div>
  );
}
