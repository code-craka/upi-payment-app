"use client"

import { SignIn } from "@clerk/nextjs"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SignInPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && user) {
      const role = user.publicMetadata?.role as string

      switch (role) {
        case 'admin':
          router.push('/admin')
          break
        case 'merchant':
        case 'viewer':
          router.push('/dashboard')
          break
        default:
          router.push('/unauthorized')
      }
    }
  }, [user, isLoaded, router])

  // Show loading state while checking authentication
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If user is already signed in, don't show the sign-in form
  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    )
  }

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

      <div className="flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">UP</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome Back</h1>
            <p className="text-gray-600 mt-2">Sign in to your UPI Dashboard account</p>
          </div>

          {/* Sign In Form */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <SignIn
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
              Don't have an account?{" "}
              <Link href="/sign-up" className="font-medium text-blue-600 hover:text-blue-700">
                Sign up for free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
