import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Star, Quote } from "lucide-react"

const testimonials = [
  {
    name: "Priya Sharma",
    title: "CEO, TechStart Solutions",
    company: "TechStart",
    image: "/placeholder-user.jpg",
    content: "This platform transformed our payment collection process. We've seen a 300% increase in successful payments and our customers love the seamless UPI experience.",
    rating: 5,
    verified: true
  },
  {
    name: "Rajesh Kumar",
    title: "Finance Director, GreenEarth Retail",
    company: "GreenEarth",
    image: "/placeholder-user.jpg",
    content: "The analytics dashboard gives us insights we never had before. Real-time tracking and automated reconciliation saves us hours every day.",
    rating: 5,
    verified: true
  },
  {
    name: "Anita Patel",
    title: "Operations Manager, QuickServe",
    company: "QuickServe",
    image: "/placeholder-user.jpg",
    content: "Implementation was incredibly smooth. The team management features and role-based access make it perfect for our growing business.",
    rating: 5,
    verified: true
  },
  {
    name: "Vikram Singh",
    title: "Founder, LocalMart",
    company: "LocalMart",
    image: "/placeholder-user.jpg",
    content: "Customer support is outstanding. 24/7 availability and quick response times. The API integration was seamless with our existing systems.",
    rating: 5,
    verified: true
  },
  {
    name: "Meera Gupta",
    title: "CFO, DigitalFirst",
    company: "DigitalFirst",
    image: "/placeholder-user.jpg",
    content: "Security features are top-notch. The audit trails and compliance reporting give us complete confidence in our payment processes.",
    rating: 5,
    verified: true
  },
  {
    name: "Arjun Reddy",
    title: "CTO, InnovateLab",
    company: "InnovateLab",
    image: "/placeholder-user.jpg",
    content: "The API documentation is excellent and the webhook system works flawlessly. Integration took less than a day to complete.",
    rating: 5,
    verified: true
  }
]

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex space-x-1">
      {[...Array(rating)].map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      ))}
    </div>
  )
}

export function TestimonialsSection() {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge className="bg-green-100 text-green-800 mb-4">Testimonials</Badge>
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl">
            Trusted by businesses
            <span className="block bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              across India
            </span>
          </h2>
          <p className="mt-6 max-w-3xl mx-auto text-xl text-gray-600">
            Join thousands of satisfied customers who have transformed their payment processes 
            with our platform. Here's what they have to say.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">10,000+</div>
            <div className="text-gray-600">Active Merchants</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">₹50M+</div>
            <div className="text-gray-600">Processed Monthly</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">99.9%</div>
            <div className="text-gray-600">Success Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">4.9/5</div>
            <div className="text-gray-600">Customer Rating</div>
          </div>
        </div>

        {/* Testimonials Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="p-6 hover:shadow-lg transition-shadow duration-300 border-0 shadow-md">
              <div className="flex items-start space-x-4 mb-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={testimonial.image} alt={testimonial.name} />
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    {testimonial.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">
                      {testimonial.name}
                    </h4>
                    {testimonial.verified && (
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        Verified
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate">{testimonial.title}</p>
                  <p className="text-xs text-gray-500">{testimonial.company}</p>
                </div>
              </div>

              <div className="mb-4">
                <StarRating rating={testimonial.rating} />
              </div>

              <div className="relative">
                <Quote className="absolute top-0 left-0 h-6 w-6 text-blue-200 -translate-x-1 -translate-y-1" />
                <blockquote className="text-gray-700 leading-relaxed pl-4">
                  "{testimonial.content}"
                </blockquote>
              </div>
            </Card>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Join our community of successful merchants
            </h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Start your free trial today and see why businesses trust us with their payment processing needs.
            </p>
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
              <span>✅ No setup fees</span>
              <span>✅ 30-day free trial</span>
              <span>✅ Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}