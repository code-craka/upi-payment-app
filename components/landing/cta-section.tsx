import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

export function CTASection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 py-16 lg:py-24">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-indigo-600/20 backdrop-blur-3xl" />

      {/* Floating elements */}
      <div className="absolute top-10 left-10 h-20 w-20 rounded-full bg-white/10 blur-xl" />
      <div className="absolute top-32 right-20 h-32 w-32 rounded-full bg-white/10 blur-xl" />
      <div className="absolute bottom-20 left-32 h-24 w-24 rounded-full bg-white/10 blur-xl" />

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <div className="mb-8 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
          <Sparkles className="h-8 w-8 text-white" />
        </div>

        <h2 className="mb-6 text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
          Ready to transform your
          <span className="block text-yellow-300">payment experience?</span>
        </h2>

        <p className="mx-auto mb-8 max-w-2xl text-xl leading-relaxed text-blue-100">
          Join thousands of businesses already using our platform. Start your free trial today and
          experience the difference our UPI payment solution can make.
        </p>

        <div className="space-y-4 sm:flex sm:justify-center sm:space-y-0 sm:space-x-4">
          <Button
            asChild
            size="lg"
            className="w-full bg-white px-8 py-4 text-lg font-semibold text-blue-600 shadow-xl transition-all duration-300 hover:bg-gray-50 hover:shadow-2xl sm:w-auto"
          >
            <Link href="/sign-up" className="flex items-center justify-center">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full border-white/30 px-8 py-4 text-lg font-semibold text-white backdrop-blur-sm hover:bg-white/10 sm:w-auto"
          >
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>

        <div className="mt-8 flex items-center justify-center space-x-8 text-blue-100">
          <div className="flex items-center text-sm">
            <div className="mr-2 h-2 w-2 rounded-full bg-green-400"></div>
            <span>No setup fees</span>
          </div>
          <div className="flex items-center text-sm">
            <div className="mr-2 h-2 w-2 rounded-full bg-green-400"></div>
            <span>30-day free trial</span>
          </div>
          <div className="flex items-center text-sm">
            <div className="mr-2 h-2 w-2 rounded-full bg-green-400"></div>
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>
    </section>
  );
}
