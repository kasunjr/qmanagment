export default function PricingPage() {
  return (
    <div className="p-8 bg-white rounded-xl shadow-sm border border-slate-200">
      <h1 className="text-3xl font-bold mb-4 text-slate-900">Pricing Plans</h1>
      <p className="text-slate-600 mb-6">
        Choose a plan that fits your business needs.
      </p>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="border border-slate-200 p-6 rounded-lg">
          <h3 className="font-bold text-xl mb-2">Basic</h3>
          <p className="text-2xl font-extrabold text-indigo-600 mb-4">Free</p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>1 branch</li>
            <li>1 service</li>
            <li>1 queue</li>
            <li>1 staff member</li>
            <li>Up to 10 tickets per day</li>
          </ul>
        </div>
        <div className="border-2 border-indigo-600 p-6 rounded-lg relative">
          <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded absolute -top-3 right-4">
            Popular
          </span>
          <h3 className="font-bold text-xl mb-2">Pro</h3>
          <p className="text-2xl font-extrabold text-indigo-600 mb-4">$9/mo</p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>Up to 20 branches</li>
            <li>Up to 20 services</li>
            <li>Up to 20 queues</li>
            <li>Up to 20 staff members</li>
            <li>Up to 1,000 tickets per day</li>
          </ul>
        </div>
        <div className="border border-slate-200 p-6 rounded-lg">
          <h3 className="font-bold text-xl mb-2">Enterprise</h3>
          <p className="text-2xl font-extrabold text-indigo-600 mb-4">Custom</p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>Unlimited branches</li>
            <li>Unlimited services</li>
            <li>Unlimited queues</li>
            <li>Unlimited staff members</li>
            <li>Unlimited tickets</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
