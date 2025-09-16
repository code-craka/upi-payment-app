import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, Star, Zap, Users, Building2 } from "lucide-react"
import Link from "next/link"

const plans = [
  {
    name: "Starter",
    description: "Perfect for small businesses and individual merchants",
    price: "₹999",
    period: "/month",
    features: [
      "Up to 100 payment links/month",
      "Basic analytics dashboard",
      "QR code generation",
      "Email support",
      "UTR verification",
      "Mobile responsive design"
    ],
    icon: Zap,
    popular: false,
    cta: "Start Free Trial"
  },
  {
    name: "Professional",
    description: "Ideal for growing businesses with advanced needs",
    price: "₹2,999",
    period: "/month",
    features: [
      "Up to 1,000 payment links/month",
      "Advanced analytics & reporting",
      "API access & webhooks",
      "Priority email support",
      "Team management (5 users)",
      "Custom branding",
      "Bulk operations",
      "Export data"
    ],
    icon: Users,
    popular: true,
    cta: "Start Free Trial"
  },
  {
    name: "Enterprise",
    description: "For large organizations requiring maximum flexibility",
    price: "Custom",
    period: "/month",
    features: [
      "Unlimited payment links",
      "White-label solution",
      "Dedicated account manager",
      "24/7 phone support",
      "Unlimited team members",
      "Advanced security features",
      "SLA guarantees",
      "On-premise deployment",
      "Custom integrations"
    ],
    icon: Building2,
    popular: false,
    cta: "Contact Sales"
  }
]

export function PricingSection() {
  return (
    <section className="py-16 lg:py-24 bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge className="bg-purple-100 text-purple-800 mb-4">Pricing</Badge>
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl">
            Choose the perfect plan
            <span className="block bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              for your business
            </span>
          </h2>
          <p className="mt-6 max-w-3xl mx-auto text-xl text-gray-600">
            Start with our free trial, then choose a plan that scales with your business. 
            All plans include our core features with no hidden fees.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-6">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                plan.popular 
                  ? 'ring-2 ring-purple-600 shadow-lg scale-105 lg:scale-110' 
                  : 'shadow-md hover:shadow-lg'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0">
                  <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-center py-2 px-4">
                    <div className="flex items-center justify-center space-x-1">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="text-sm font-medium">Most Popular</span>
                      <Star className="h-4 w-4 fill-current" />
                    </div>
                  </div>
                </div>
              )}

              <CardHeader className={`text-center pb-8 ${plan.popular ? 'pt-12' : 'pt-8'}`}>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white mb-4 mx-auto">
                  <plan.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">{plan.name}</CardTitle>
                <p className="text-gray-600 mt-2">{plan.description}</p>
                <div className="mt-6">
                  <div className="flex items-center justify-center">
                    <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                    {plan.period && (
                      <span className="text-gray-500 ml-1">{plan.period}</span>
                    )}
                  </div>
                  {plan.name !== "Enterprise" && (
                    <p className="text-sm text-gray-500 mt-1">30-day free trial</p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pb-8">
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-6">
                  <Button 
                    asChild 
                    className={`w-full ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700' 
                        : ''
                    }`}
                    size="lg"
                    variant={plan.popular ? "default" : "outline"}
                  >
                    <Link href={plan.name === "Enterprise" ? "/contact" : "/sign-up"}>
                      {plan.cta}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="mt-16 text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Need a custom solution?
            </h3>
            <p className="text-gray-600 mb-6">
              We offer tailored solutions for enterprises with specific requirements. 
              Contact our sales team to discuss your needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button asChild variant="outline" size="lg">
                <Link href="/contact">Contact Sales</Link>
              </Button>
              <div className="text-sm text-gray-500 flex items-center">
                <span>✨ Custom pricing available</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}