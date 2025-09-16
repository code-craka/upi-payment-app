import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Header } from "@/components/landing/header"
import { HeroSection } from "@/components/landing/hero-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { PricingSection } from "@/components/landing/pricing-section"
import { TestimonialsSection } from "@/components/landing/testimonials-section"
import { CTASection } from "@/components/landing/cta-section"
import { Footer } from "@/components/landing/footer"

export default async function HomePage() {
  const user = await currentUser()

  // Redirect authenticated users to their appropriate dashboard
  if (user) {
    const userRole = user.publicMetadata?.role as string
    if (userRole === "admin") {
      redirect("/admin")
    } else {
      redirect("/dashboard")
    }
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
  )
}
