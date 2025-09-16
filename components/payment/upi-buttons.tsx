"use client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

interface UpiButtonsProps {
  upiDeepLink: string
  onPaymentInitiated?: () => void
}

export function UpiButtons({ upiDeepLink, onPaymentInitiated }: UpiButtonsProps) {
  const { toast } = useToast()

  const upiApps = [
    {
      name: "Google Pay",
      scheme: "gpay://upi/pay",
      fallback: "https://pay.google.com/about/",
      color: "bg-blue-600 hover:bg-blue-700",
      icon: "🔵",
    },
    {
      name: "PhonePe",
      scheme: "phonepe://pay",
      fallback: "https://www.phonepe.com/",
      color: "bg-purple-600 hover:bg-purple-700",
      icon: "🟣",
    },
    {
      name: "Paytm",
      scheme: "paytmmp://pay",
      fallback: "https://paytm.com/",
      color: "bg-blue-500 hover:bg-blue-600",
      icon: "💙",
    },
    {
      name: "BHIM",
      scheme: "bhim://pay",
      fallback: "https://www.npci.org.in/what-we-do/bhim",
      color: "bg-orange-600 hover:bg-orange-700",
      icon: "🟠",
    },
  ]

  const handleUpiAppClick = (app: (typeof upiApps)[0]) => {
    try {
      // Try to open the UPI app
      const appUrl = upiDeepLink.replace("upi://", `${app.scheme.replace("://pay", "")}://`)
      window.location.href = appUrl

      // Call the callback after a short delay
      setTimeout(() => {
        onPaymentInitiated?.()
        toast({
          title: "Payment initiated",
          description: `Opened ${app.name}. Please complete the payment and submit the UTR number.`,
        })
      }, 1000)
    } catch (error) {
      // Fallback to app store or website
      window.open(app.fallback, "_blank")
      toast({
        title: "App not found",
        description: `${app.name} is not installed. Please install it first.`,
        variant: "destructive",
      })
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {upiApps.map((app) => (
        <Button
          key={app.name}
          onClick={() => handleUpiAppClick(app)}
          className={`${app.color} text-white flex items-center gap-2 h-12`}
          variant="default"
        >
          <span className="text-lg">{app.icon}</span>
          <span className="text-sm font-medium">{app.name}</span>
        </Button>
      ))}
    </div>
  )
}
