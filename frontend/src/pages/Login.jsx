import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const u = await login(email, password); toast.success("Welcome back!"); nav(u.role !== "customer" ? "/admin" : "/account"); }
    catch (e2) { setErr(formatApiErrorDetail(e2.response?.data?.detail) || "Login failed"); }
    setBusy(false);
  };
  const input = "w-full rounded-lg border border-[#8C8C8C] px-4 py-3 text-lg";
  return (
    <div className="gc-container py-16 max-w-md">
      <h1 className="font-heading text-4xl font-extrabold text-brand-green mb-6">Sign in</h1>
      <form onSubmit={submit} className="bg-white rounded-2xl border border-brand-border p-7 space-y-4">
        {err && <div className="bg-[#FDECEA] text-[#B71C1C] rounded-lg px-4 py-3" data-testid="login-error">{err}</div>}
        <div><label className="block font-semibold mb-1">Email</label><input required type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email" /></div>
        <div><label className="block font-semibold mb-1">Password</label><input required type="password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} data-testid="login-password" /></div>
        <button disabled={busy} className="w-full bg-brand-green text-white rounded-full px-6 py-3.5 font-semibold text-lg disabled:opacity-60" data-testid="login-submit">{busy ? "Signing in…" : "Sign in"}</button>
        <div className="flex justify-between text-base">
          <Link to="/forgot-password" className="text-brand-terracotta hover:underline">Forgot password?</Link>
          <Link to="/register" className="text-brand-terracotta hover:underline">Create account</Link>
        </div>
      </form>
    </div>
  );
}
