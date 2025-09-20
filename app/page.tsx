import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/requireRole';
import { Header } from '@/components/landing/header';
import { HeroSection } from '@/components/landing/hero-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { PricingSection } from '@/components/landing/pricing-section';
import { TestimonialsSection } from '@/components/landing/testimonials-section';
import { CTASection } from '@/components/landing/cta-section';
import { Footer } from '@/components/landing/footer';

export default async function HomePage() {
  // Check if user is authenticated using our custom session
  try {
    const user = await getCurrentUser();

    // Redirect authenticated users to their appropriate dashboard
    if (user) {
      if (user.role === 'admin') {
        redirect('/admin');
      } else {
        redirect('/dashboard');
      }
    }
  } catch (_error) {
    // User not authenticated, continue to landing page
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <HeroSection />
        <section id="features">
          <FeaturesSection />
        </section>
        <section id="pricing">
          <PricingSection />
        </section>
        <section id="testimonials">
          <TestimonialsSection />
        </section>
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
