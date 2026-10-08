export default function PricingPage() {
  return (
    <div className="p-8 bg-white rounded-xl shadow-sm border border-slate-200">
      <h1 className="text-3xl font-bold mb-4 text-slate-900">Pricing Plans</h1>
      <p className="text-slate-600 mb-6">Choose a plan that fits your business needs.</p>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="border border-slate-200 p-6 rounded-lg">
          <h3 className="font-bold text-xl mb-2">Basic</h3>
          <p className="text-2xl font-extrabold text-indigo-600 mb-4">$29/mo</p>
          <p className="text-sm text-slate-500">Ideal for small teams and single locations.</p>
        </div>
        <div className="border-2 border-indigo-600 p-6 rounded-lg relative">
          <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded absolute -top-3 right-4">Popular</span>
          <h3 className="font-bold text-xl mb-2">Pro</h3>
          <p className="text-2xl font-extrabold text-indigo-600 mb-4">$79/mo</p>
          <p className="text-sm text-slate-500">For multi-branch operations needing advanced control.</p>
        </div>
        <div className="border border-slate-200 p-6 rounded-lg">
          <h3 className="font-bold text-xl mb-2">Enterprise</h3>
          <p className="text-2xl font-extrabold text-indigo-600 mb-4">Custom</p>
          <p className="text-sm text-slate-500">Dedicated setup, custom SLA, and full API access.</p>
        </div>
      </div>
    </div>
  );
}