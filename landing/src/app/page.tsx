import Image from "next/image";
import { Card } from "@/components/ui/card";
import { SignupForm } from "@/components/signup-form";
import { 
  DollarSign, 
  Calendar, 
  Users, 
  FileText, 
  Calculator, 
  Smartphone,
  Check,
  X
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F6F8FA]">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-[#02667F] to-[#0090B7] text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-8">
            <Image 
              src="/kokoro-logo.png" 
              alt="Kokoro Software" 
              width={80} 
              height={80}
              className="mx-auto mb-4"
            />
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Strata management software that doesn&apos;t cost the earth
            </h1>
          </div>
          <p className="text-xl md:text-2xl mb-8 text-white/90">
            Built for small operators. Starting free, from $0.75/lot/month. No minimums. No sales calls.
          </p>
          <SignupForm buttonText="Get early access" dark={true} />
          <div className="mt-12">
            <Image 
              src="/dashboard.png" 
              alt="LevyLite Dashboard" 
              width={1200} 
              height={675}
              className="rounded-lg shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 text-[#3A3A3A]">
            92% of strata schemes have fewer than 20 lots.<br />
            Enterprise software ignores them.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 border-l-4 border-[#02667F]">
              <h3 className="text-2xl font-bold mb-2 text-[#3A3A3A]">$5K–$20K/year</h3>
              <p className="text-[#3A3A3A]/80">Enterprise software costs more than you make from small schemes</p>
            </Card>
            <Card className="p-6 border-l-4 border-[#02667F]">
              <h3 className="text-2xl font-bold mb-2 text-[#3A3A3A]">600+ lots minimum</h3>
              <p className="text-[#3A3A3A]/80">Intellistrata and others don&apos;t even want your business</p>
            </Card>
            <Card className="p-6 border-l-4 border-[#02667F]">
              <h3 className="text-2xl font-bold mb-2 text-[#3A3A3A]">10+ hours/week</h3>
              <p className="text-[#3A3A3A]/80">Wasted on spreadsheets, manual emails, and chasing payments</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 text-[#3A3A3A]">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <DollarSign className="w-12 h-12 text-[#02667F] mb-4" />
              <h3 className="text-xl font-bold mb-2 text-[#3A3A3A]">Stop chasing levy payments</h3>
              <p className="text-[#3A3A3A]/80">
                Automated reminders, payment tracking, and owner statements
              </p>
            </Card>
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <Calendar className="w-12 h-12 text-[#02667F] mb-4" />
              <h3 className="text-xl font-bold mb-2 text-[#3A3A3A]">Never miss an AGM deadline</h3>
              <p className="text-[#3A3A3A]/80">
                Meeting scheduler, notice templates, and minute recording
              </p>
            </Card>
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <Users className="w-12 h-12 text-[#02667F] mb-4" />
              <h3 className="text-xl font-bold mb-2 text-[#3A3A3A]">Owners help themselves</h3>
              <p className="text-[#3A3A3A]/80">
                Self-service portal for documents, levies, and maintenance requests
              </p>
            </Card>
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <FileText className="w-12 h-12 text-[#02667F] mb-4" />
              <h3 className="text-xl font-bold mb-2 text-[#3A3A3A]">Find any document in seconds</h3>
              <p className="text-[#3A3A3A]/80">
                Organised storage with full-text search and version control
              </p>
            </Card>
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <Calculator className="w-12 h-12 text-[#02667F] mb-4" />
              <h3 className="text-xl font-bold mb-2 text-[#3A3A3A]">Trust accounting that&apos;s trustworthy</h3>
              <p className="text-[#3A3A3A]/80">
                Compliant ledgers, GST handling, and audit-ready reports
              </p>
            </Card>
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <Smartphone className="w-12 h-12 text-[#02667F] mb-4" />
              <h3 className="text-xl font-bold mb-2 text-[#3A3A3A]">Works on your phone</h3>
              <p className="text-[#3A3A3A]/80">
                Fully responsive design — approve invoices from the cafe
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 text-[#3A3A3A]">
            How does LevyLite compare?
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-lg shadow-lg">
              <thead className="bg-[#02667F] text-white">
                <tr>
                  <th className="p-4 text-left">Feature</th>
                  <th className="p-4 text-center">Spreadsheets</th>
                  <th className="p-4 text-center">Enterprise Software</th>
                  <th className="p-4 text-center bg-[#0090B7]">LevyLite</th>
                </tr>
              </thead>
              <tbody className="text-[#3A3A3A]">
                <tr className="border-b">
                  <td className="p-4 font-medium">Cost (50 lots)</td>
                  <td className="p-4 text-center">$0</td>
                  <td className="p-4 text-center">$10K+/year</td>
                  <td className="p-4 text-center font-bold text-[#02667F]">$100/month</td>
                </tr>
                <tr className="border-b bg-[#F6F8FA]">
                  <td className="p-4 font-medium">Setup time</td>
                  <td className="p-4 text-center">Hours</td>
                  <td className="p-4 text-center">Weeks</td>
                  <td className="p-4 text-center font-bold text-[#02667F]">Minutes</td>
                </tr>
                <tr className="border-b">
                  <td className="p-4 font-medium">Compliance built-in</td>
                  <td className="p-4 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                </tr>
                <tr className="border-b bg-[#F6F8FA]">
                  <td className="p-4 font-medium">Owner portal</td>
                  <td className="p-4 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                </tr>
                <tr className="border-b">
                  <td className="p-4 font-medium">Mobile friendly</td>
                  <td className="p-4 text-center"><X className="w-5 h-5 text-red-500 mx-auto" /></td>
                  <td className="p-4 text-center text-sm">Sometimes</td>
                  <td className="p-4 text-center"><Check className="w-5 h-5 text-green-500 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4 text-[#3A3A3A]">
            Simple, honest pricing
          </h2>
          <p className="text-center text-xl text-[#3A3A3A]/80 mb-12">
            Graduated pricing — the more you manage, the less you pay per lot. No cliffs, no surprises.
          </p>
          
          {/* Pricing tiers */}
          <div className="max-w-3xl mx-auto mb-12">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-[#02667F]/10">
              <div className="grid grid-cols-3 bg-[#02667F] text-white text-center font-bold">
                <div className="p-4">Lots</div>
                <div className="p-4">Rate <span className="text-xs font-normal opacity-80">(ex GST)</span></div>
                <div className="p-4">Example</div>
              </div>
              <div className="grid grid-cols-3 text-center border-b border-gray-100">
                <div className="p-4 font-medium text-[#3A3A3A]">First 10 lots</div>
                <div className="p-4 text-[#02667F] font-bold text-xl">Free</div>
                <div className="p-4 text-[#3A3A3A]/70">$0/mo</div>
              </div>
              <div className="grid grid-cols-3 text-center border-b border-gray-100 bg-[#F6F8FA]">
                <div className="p-4 font-medium text-[#3A3A3A]">Lots 11–100</div>
                <div className="p-4 text-[#02667F] font-bold text-xl">$2.50<span className="text-sm font-normal">/lot/mo</span></div>
                <div className="p-4 text-[#3A3A3A]/70">50 lots = $100/mo</div>
              </div>
              <div className="grid grid-cols-3 text-center border-b border-gray-100">
                <div className="p-4 font-medium text-[#3A3A3A]">Lots 101–500</div>
                <div className="p-4 text-[#02667F] font-bold text-xl">$1.50<span className="text-sm font-normal">/lot/mo</span></div>
                <div className="p-4 text-[#3A3A3A]/70">300 lots = $525/mo</div>
              </div>
              <div className="grid grid-cols-3 text-center border-b border-gray-100 bg-[#F6F8FA]">
                <div className="p-4 font-medium text-[#3A3A3A]">Lots 501–2,000</div>
                <div className="p-4 text-[#02667F] font-bold text-xl">$1<span className="text-sm font-normal">/lot/mo</span></div>
                <div className="p-4 text-[#3A3A3A]/70">1,000 lots = $975/mo</div>
              </div>
              <div className="grid grid-cols-3 text-center">
                <div className="p-4 font-medium text-[#3A3A3A]">Lots 2,001+</div>
                <div className="p-4 text-[#02667F] font-bold text-xl">$0.75<span className="text-sm font-normal">/lot/mo</span></div>
                <div className="p-4 text-[#3A3A3A]/70">—</div>
              </div>
            </div>
            <p className="text-center text-sm text-[#3A3A3A]/60 mt-4">
              Graduated pricing — example bills: 50 lots = $100/mo · 100 lots = $225/mo · 300 lots = $525/mo · 1,000 lots = $975/mo
            </p>
          </div>

          {/* What's included */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="p-6 border-2 border-[#02667F]/20">
              <h3 className="text-xl font-bold mb-4 text-[#3A3A3A]">Free tier (up to 10 lots)</h3>
              <ul className="text-sm text-[#3A3A3A]/70 space-y-2">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> 14-day trial of all features</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Scheme &amp; lot register</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Levy management</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Owner portal</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Document storage</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Meeting admin</li>
                <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-400 flex-shrink-0" /> Trust accounting</li>
                <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-400 flex-shrink-0" /> Bulk levy notices</li>
                <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-400 flex-shrink-0" /> Financial reporting</li>
              </ul>
            </Card>
            <Card className="p-6 border-2 border-[#0090B7] shadow-lg">
              <h3 className="text-xl font-bold mb-4 text-[#3A3A3A]">Paid (11+ lots) — everything included</h3>
              <ul className="text-sm text-[#3A3A3A]/70 space-y-2">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> All free tier features</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Trust accounting &amp; audit trails</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Bulk levy notices &amp; reminders</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Financial reporting &amp; budgets</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> CSV import/export</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Unlimited users &amp; schemes</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Unlimited document storage</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /> Email support</li>
              </ul>
            </Card>
          </div>
          <p className="text-center text-sm text-[#3A3A3A]/60 mt-8">
            Save 2 months with annual billing. All prices in AUD, ex GST.
          </p>
        </div>
      </section>

      {/* Early Access CTA */}
      <section className="py-20 px-4 bg-gradient-to-b from-[#02667F] to-[#0090B7] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">
            We&apos;re building this for you — and we want your input
          </h2>
          <p className="text-xl mb-8 text-white/90">
            Join 10 founding customers. Free for 6 months. Help shape the product.
          </p>
          <SignupForm buttonText="Join the beta" dark={true} />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#3A3A3A] text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <Image 
                src="/kokoro-logo.png" 
                alt="Kokoro Software" 
                width={60} 
                height={60}
                className="mx-auto md:mx-0 mb-2"
              />
              <p className="text-white/80">A Kokoro Software product</p>
              <p className="text-white/60 text-sm">The Heart of Things</p>
            </div>
            <div className="flex gap-6 text-sm">
              <a href="#" className="text-white/80 hover:text-white">Privacy</a>
              <a href="#" className="text-white/80 hover:text-white">Terms</a>
              <a href="mailto:chris@kokorosoftware.com" className="text-white/80 hover:text-white">Contact</a>
            </div>
          </div>
          <div className="text-center mt-6 text-white/60 text-sm">
            levylite.com.au
          </div>
        </div>
      </footer>
    </div>
  );
}
