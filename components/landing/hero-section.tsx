"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play, CheckCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50 pt-20 pb-16 lg:pt-32 lg:pb-24">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          <div className="sm:text-center md:mx-auto md:max-w-2xl lg:col-span-6 lg:text-left lg:flex lg:items-center">
            <div>
              {/* Badge */}
              <div className="flex items-center justify-center lg:justify-start mb-6">
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Trusted by 10,000+ merchants
                </Badge>
              </div>

              {/* Headline */}
              <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl">
                <span className="block">Streamline Your</span>
                <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  UPI Payments
                </span>
              </h1>

              {/* Subheadline */}
              <p className="mt-6 text-lg text-gray-600 sm:mt-8 sm:text-xl lg:text-lg xl:text-xl">
                Create, manage, and track UPI payment links with our enterprise-grade dashboard. 
                Real-time analytics, secure transactions, and seamless integrations.
              </p>

              {/* Feature list */}
              <div className="mt-6 space-y-2">
                {[
                  "Instant QR code generation",
                  "Real-time payment tracking",
                  "Advanced analytics & reporting",
                  "Role-based access control"
                ].map((feature, index) => (
                  <div key={index} className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span className="text-sm text-gray-600">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="mt-8 sm:mt-12 sm:flex sm:justify-center lg:justify-start">
                <div className="rounded-md shadow">
                  <Button asChild size="lg" className="w-full bg-blue-600 hover:bg-blue-700">
                    <Link href="/sign-up" className="flex items-center justify-center">
                      Get Started Free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className="mt-3 sm:mt-0 sm:ml-3">
                  <Button variant="outline" size="lg" className="w-full">
                    <Play className="mr-2 h-4 w-4" />
                    Watch Demo
                  </Button>
                </div>
              </div>

              {/* Social proof */}
              <div className="mt-8 flex items-center justify-center lg:justify-start space-x-6 text-sm text-gray-500">
                <div className="flex items-center">
                  <span className="font-semibold text-gray-900">99.9%</span>
                  <span className="ml-1">Uptime</span>
                </div>
                <div className="flex items-center">
                  <span className="font-semibold text-gray-900">₹10M+</span>
                  <span className="ml-1">Processed</span>
                </div>
                <div className="flex items-center">
                  <span className="font-semibold text-gray-900">24/7</span>
                  <span className="ml-1">Support</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Image/Dashboard Preview */}
          <div className="mt-12 sm:mt-16 lg:col-span-6 lg:mt-0">
            <div className="relative mx-auto max-w-lg">
              {/* Dashboard Preview */}
              <div className="relative rounded-2xl shadow-2xl ring-1 ring-gray-900/10 overflow-hidden bg-white">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-gray-900">Dashboard</h3>
                      <Badge className="bg-green-100 text-green-800">Live</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Revenue</p>
                        <p className="text-2xl font-bold text-blue-600">₹2.4M</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Orders Today</p>
                        <p className="text-2xl font-bold text-green-600">127</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <span className="text-sm font-medium">Recent Payment</span>
                        <Badge className="bg-green-100 text-green-800">Completed</Badge>
                      </div>
                      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <span className="text-sm font-medium">QR Generated</span>
                        <Badge className="bg-blue-100 text-blue-800">Active</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 bg-white rounded-lg shadow-lg p-3 border">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-gray-600">Real-time</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}