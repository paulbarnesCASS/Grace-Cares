import React from "react";

export function Privacy() {
  return (
    <div className="gc-container py-12 max-w-3xl">
      <h1 className="font-heading text-4xl font-extrabold text-brand-green mb-6">Privacy & cookies</h1>
      <div className="space-y-4 text-lg text-[#2D2D30]">
        <p>Grace Cares CIC is committed to protecting your personal data in line with UK GDPR. We only collect what we need to provide our services and process your orders, donations and enquiries.</p>
        <p><strong>Marketing consent</strong> is always optional, specific and unticked by default. Transactional emails (order, booking and donation confirmations) do not depend on marketing consent.</p>
        <p><strong>Sensitive information</strong>, including medical-condition details provided for VAT relief, is treated as sensitive personal information with additional protection and restricted access. We do not include medical information in ordinary notification emails.</p>
        <p>You can request a copy of your data or ask us to delete your account at any time from your account area, or by contacting us on 01543 730189.</p>
        <p className="text-base text-[#4A4A4D]">The final privacy notice, retention periods and lawful bases will be approved by Grace Cares before launch.</p>
      </div>
    </div>
  );
}

export function Terms() {
  return (
    <div className="gc-container py-12 max-w-3xl">
      <h1 className="font-heading text-4xl font-extrabold text-brand-green mb-6">Terms & conditions</h1>
      <div className="space-y-4 text-lg text-[#2D2D30]">
        <p>These terms govern the sale of pre-loved care equipment through Grace Cares. Most items are unique or available in limited quantities, and are sold as described.</p>
        <p>VAT relief is only applied where a product is approved as eligible <strong>and</strong> a valid customer declaration is completed. Being elderly on its own does not qualify, and a temporary condition does not normally qualify.</p>
        <p>Payments are processed securely by Stripe. We never store your full card details. Orders are only confirmed once payment is successfully received.</p>
        <p className="text-base text-[#4A4A4D]">Final terms and VAT wording will be approved by Grace Cares' accountant or VAT adviser before launch.</p>
      </div>
    </div>
  );
}
