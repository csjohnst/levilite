import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
            Built for small operators. $6/lot/month. No minimums. No sales calls.
          </p>
          <div className="max-w-md mx-auto flex gap-2">
            <Input 
              type="email" 
              placeholder="Enter your email" 
              className="bg-white text-[#3A3A3A]"
            />
            <Button className="bg-white text-[#02667F] hover:bg-white/90">
              Get early access
            </Button>
          </div>
          <div className="mt-12">
            <Image 
              src="/dashboard.png" 
              alt="LeviLite Dashboard" 
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
            How does LeviLite compare?
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-lg shadow-lg">
              <thead className="bg-[#02667F] text-white">
                <tr>
                  <th className="p-4 text-left">Feature</th>
                  <th className="p-4 text-center">Spreadsheets</th>
                  <th className="p-4 text-center">Enterprise Software</th>
                  <th className="p-4 text-center bg-[#0090B7]">LeviLite</th>
                </tr>
              </thead>
              <tbody className="text-[#3A3A3A]">
                <tr className="border-b">
                  <td className="p-4 font-medium">Cost (50 lots)</td>
                  <td className="p-4 text-center">$0</td>
                  <td className="p-4 text-center">$10K+/year</td>
                  <td className="p-4 text-center font-bold text-[#02667F]">$400/month</td>
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
            All plans include unlimited users, unlimited storage, all features
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 border-2 border-[#02667F]/20">
              <h3 className="text-2xl font-bold mb-2 text-[#3A3A3A]">Free</h3>
              <p className="text-[#3A3A3A]/80 mb-4">≤10 lots</p>
              <p className="text-4xl font-bold text-[#02667F] mb-4">$0</p>
              <p className="text-sm text-[#3A3A3A]/60">Perfect for starting out</p>
            </Card>
            <Card className="p-6 border-2 border-[#02667F]/20">
              <h3 className="text-2xl font-bold mb-2 text-[#3A3A3A]">Starter</h3>
              <p className="text-[#3A3A3A]/80 mb-4">11-50 lots</p>
              <p className="text-4xl font-bold text-[#02667F] mb-4">$8<span className="text-lg">/lot/month</span></p>
              <p className="text-sm text-[#3A3A3A]/60">Most small operators</p>
            </Card>
            <Card className="p-6 border-2 border-[#0090B7] shadow-lg">
              <div className="bg-[#0090B7] text-white text-xs font-bold px-2 py-1 rounded inline-block mb-2">
                MOST POPULAR
              </div>
              <h3 className="text-2xl font-bold mb-2 text-[#3A3A3A]">Professional</h3>
              <p className="text-[#3A3A3A]/80 mb-4">51-200 lots</p>
              <p className="text-4xl font-bold text-[#02667F] mb-4">$6<span className="text-lg">/lot/month</span></p>
              <p className="text-sm text-[#3A3A3A]/60">Growing portfolios</p>
            </Card>
            <Card className="p-6 border-2 border-[#02667F]/20">
              <h3 className="text-2xl font-bold mb-2 text-[#3A3A3A]">Growth</h3>
              <p className="text-[#3A3A3A]/80 mb-4">201-500 lots</p>
              <p className="text-4xl font-bold text-[#02667F] mb-4">$5<span className="text-lg">/lot/month</span></p>
              <p className="text-sm text-[#3A3A3A]/60">Established operators</p>
            </Card>
          </div>
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
          <div className="max-w-md mx-auto flex gap-2">
            <Input 
              type="email" 
              placeholder="Enter your email" 
              className="bg-white text-[#3A3A3A]"
            />
            <Button className="bg-white text-[#02667F] hover:bg-white/90">
              Join the beta
            </Button>
          </div>
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
            levilite.com.au
          </div>
        </div>
      </footer>
    </div>
  );
}
