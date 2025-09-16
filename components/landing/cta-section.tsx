import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles } from "lucide-react"

export function CTASection() {
  return (
    <section className="py-16 lg:py-24 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-indigo-600/20 backdrop-blur-3xl" />
      
      {/* Floating elements */}
      <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl" />
      <div className="absolute top-32 right-20 w-32 h-32 bg-white/10 rounded-full blur-xl" />
      <div className="absolute bottom-20 left-32 w-24 h-24 bg-white/10 rounded-full blur-xl" />
      
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-8">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        
        <h2 className="text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl mb-6">
          Ready to transform your
          <span className="block text-yellow-300">
            payment experience?
          </span>
        </h2>
        
        <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed">
          Join thousands of businesses already using our platform. Start your free trial today 
          and experience the difference our UPI payment solution can make.
        </p>

        <div className="space-y-4 sm:space-y-0 sm:flex sm:justify-center sm:space-x-4">
          <Button 
            asChild 
            size="lg" 
            className="w-full sm:w-auto bg-white text-blue-600 hover:bg-gray-50 font-semibold px-8 py-4 text-lg shadow-xl hover:shadow-2xl transition-all duration-300"
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
            className="w-full sm:w-auto border-white/30 text-white hover:bg-white/10 font-semibold px-8 py-4 text-lg backdrop-blur-sm"
          >
            <Link href="/sign-in">
              Sign In
            </Link>
          </Button>
        </div>

        <div className="mt-8 flex items-center justify-center space-x-8 text-blue-100">
          <div className="flex items-center text-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
            <span>No setup fees</span>
          </div>
          <div className="flex items-center text-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
            <span>30-day free trial</span>
          </div>
          <div className="flex items-center text-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>
    </section>
  )
}