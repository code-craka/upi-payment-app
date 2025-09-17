import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Zap, Users, Building2 } from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    name: 'Starter',
    description: 'Perfect for small businesses and individual merchants',
    price: '₹999',
    period: '/month',
    features: [
      'Up to 100 payment links/month',
      'Basic analytics dashboard',
      'QR code generation',
      'Email support',
      'UTR verification',
      'Mobile responsive design',
    ],
    icon: Zap,
    popular: false,
    cta: 'Start Free Trial',
  },
  {
    name: 'Professional',
    description: 'Ideal for growing businesses with advanced needs',
    price: '₹2,999',
    period: '/month',
    features: [
      'Up to 1,000 payment links/month',
      'Advanced analytics & reporting',
      'API access & webhooks',
      'Priority email support',
      'Team management (5 users)',
      'Custom branding',
      'Bulk operations',
      'Export data',
    ],
    icon: Users,
    popular: true,
    cta: 'Start Free Trial',
  },
  {
    name: 'Enterprise',
    description: 'For large organizations requiring maximum flexibility',
    price: 'Custom',
    period: '/month',
    features: [
      'Unlimited payment links',
      'White-label solution',
      'Dedicated account manager',
      '24/7 phone support',
      'Unlimited team members',
      'Advanced security features',
      'SLA guarantees',
      'On-premise deployment',
      'Custom integrations',
    ],
    icon: Building2,
    popular: false,
    cta: 'Contact Sales',
  },
];

export function PricingSection() {
  return (
    <section className="bg-gradient-to-br from-slate-50 to-blue-50/30 py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-16 text-center">
          <Badge className="mb-4 bg-purple-100 text-purple-800">Pricing</Badge>
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl">
            Choose the perfect plan
            <span className="block bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              for your business
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-xl text-gray-600">
            Start with our free trial, then choose a plan that scales with your business. All plans
            include our core features with no hidden fees.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-6">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                plan.popular
                  ? 'scale-105 shadow-lg ring-2 ring-purple-600 lg:scale-110'
                  : 'shadow-md hover:shadow-lg'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 left-0">
                  <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-center text-white">
                    <div className="flex items-center justify-center space-x-1">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="text-sm font-medium">Most Popular</span>
                      <Star className="h-4 w-4 fill-current" />
                    </div>
                  </div>
                </div>
              )}

              <CardHeader className={`pb-8 text-center ${plan.popular ? 'pt-12' : 'pt-8'}`}>
                <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  <plan.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">{plan.name}</CardTitle>
                <p className="mt-2 text-gray-600">{plan.description}</p>
                <div className="mt-6">
                  <div className="flex items-center justify-center">
                    <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                    {plan.period && <span className="ml-1 text-gray-500">{plan.period}</span>}
                  </div>
                  {plan.name !== 'Enterprise' && (
                    <p className="mt-1 text-sm text-gray-500">30-day free trial</p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pb-8">
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <Check className="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-green-500" />
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
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    <Link href={plan.name === 'Enterprise' ? '/contact' : '/sign-up'}>
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
          <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-lg">
            <h3 className="mb-4 text-2xl font-bold text-gray-900">Need a custom solution?</h3>
            <p className="mb-6 text-gray-600">
              We offer tailored solutions for enterprises with specific requirements. Contact our
              sales team to discuss your needs.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild variant="outline" size="lg">
                <Link href="/contact">Contact Sales</Link>
              </Button>
              <div className="flex items-center text-sm text-gray-500">
                <span>✨ Custom pricing available</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
