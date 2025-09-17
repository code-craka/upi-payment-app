import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  Shield,
  BarChart3,
  Users,
  Zap,
  Globe,
  Lock,
  Smartphone,
  TrendingUp,
  Clock,
  CheckCircle,
  Headphones,
} from 'lucide-react';

const features = [
  {
    icon: CreditCard,
    title: 'Instant Payment Links',
    description:
      'Generate secure UPI payment links with QR codes in seconds. Support for all major UPI apps.',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    icon: Shield,
    title: 'Bank-Grade Security',
    description:
      'Enterprise-level security with encryption, fraud detection, and compliance with banking standards.',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description:
      'Comprehensive dashboards with real-time insights, transaction trends, and performance metrics.',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    icon: Users,
    title: 'Team Management',
    description:
      'Role-based access control with admin, merchant, and viewer permissions for your organization.',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description:
      'Optimized performance with instant QR generation and real-time payment status updates.',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
  {
    icon: Globe,
    title: 'API Integration',
    description:
      'RESTful APIs and webhooks for seamless integration with your existing business systems.',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    icon: Lock,
    title: 'Audit Trail',
    description:
      'Complete transaction history with detailed logs for compliance and financial reconciliation.',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  {
    icon: Smartphone,
    title: 'Mobile Optimized',
    description:
      'Responsive design that works perfectly on all devices - desktop, tablet, and mobile.',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
  },
  {
    icon: TrendingUp,
    title: 'Growth Analytics',
    description:
      'Track your payment performance, success rates, and identify growth opportunities.',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
  },
  {
    icon: Clock,
    title: '24/7 Monitoring',
    description:
      'Round-the-clock system monitoring with 99.9% uptime guarantee and instant alerts.',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
  },
  {
    icon: CheckCircle,
    title: 'Auto-Verification',
    description:
      'Automatic UTR verification and payment confirmation with minimal manual intervention.',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
  },
  {
    icon: Headphones,
    title: 'Premium Support',
    description: 'Dedicated support team with priority assistance and comprehensive documentation.',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
  },
];

export function FeaturesSection() {
  return (
    <section className="bg-white py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-16 text-center">
          <Badge className="mb-4 bg-blue-100 text-blue-800">Features</Badge>
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl">
            Everything you need to manage
            <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              UPI payments efficiently
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-xl text-gray-600">
            Our comprehensive platform provides all the tools you need to handle UPI payments, from
            creation to completion, with enterprise-grade security and analytics.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="group border-0 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <CardHeader className="pb-6 text-center">
                <div
                  className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${feature.bgColor} mb-4 transition-transform duration-300 group-hover:scale-110`}
                >
                  <feature.icon className={`h-7 w-7 ${feature.color}`} />
                </div>
                <CardTitle className="text-lg font-semibold text-gray-900 transition-colors group-hover:text-blue-600">
                  {feature.title}
                </CardTitle>
                <CardDescription className="leading-relaxed text-gray-600">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center space-x-6 text-sm text-gray-500">
            <div className="flex items-center">
              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
              <span>No setup fees</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
              <span>Free 30-day trial</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
