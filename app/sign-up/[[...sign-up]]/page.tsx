import { SignUp } from "@clerk/nextjs"
import Link from "next/link"
import { ArrowLeft, CheckCircle, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      
      {/* Back to home link */}
      <div className="absolute top-6 left-6">
        <Button variant="ghost" asChild className="text-gray-600 hover:text-gray-900">
          <Link href="/" className="flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>

      <div className="flex min-h-screen">
        {/* Left side - Sign Up Form */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-md">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">UP</span>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800 mb-4">
                <Star className="mr-1 h-3 w-3 fill-current" />
                30-day free trial
              </Badge>
              <h1 className="text-3xl font-bold text-gray-900">Create Your Account</h1>
              <p className="text-gray-600 mt-2">Join thousands of businesses streamlining their UPI payments</p>
            </div>

            {/* Sign Up Form */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <SignUp
                appearance={{
                  elements: {
                    formButtonPrimary: "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-sm normal-case shadow-lg",
                    card: "shadow-none border-none p-0",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    socialButtonsBlockButton: "border-2 border-gray-200 hover:border-gray-300",
                    formFieldInput: "border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500",
                    footerActionLink: "text-blue-600 hover:text-blue-700",
                  },
                }}
              />
            </div>

            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link href="/sign-in" className="font-medium text-blue-600 hover:text-blue-700">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Right side - Benefits */}
        <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center lg:px-8">
          <div className="max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Why businesses choose UPI Dashboard
            </h2>
            <div className="space-y-4">
              {[
                "Generate payment links in seconds",
                "Real-time payment tracking",
                "Advanced analytics & reporting", 
                "Bank-grade security",
                "24/7 customer support",
                "No setup fees or hidden costs"
              ].map((benefit, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-gray-700">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-xl">
              <div className="flex items-center space-x-2 mb-2">
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-900">4.9/5 rating</span>
              </div>
              <p className="text-sm text-gray-600">
                "The best UPI payment management platform we've used. 
                Highly recommended!" - Priya S., CEO
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
