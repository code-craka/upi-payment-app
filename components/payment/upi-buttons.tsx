"use client"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"

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
      color: "bg-white hover:bg-gray-50 border border-gray-200",
      logo: "/gpay-logo.png",
    },
    {
      name: "PhonePe",
      scheme: "phonepe://pay",
      fallback: "https://www.phonepe.com/",
      color: "bg-white hover:bg-gray-50 border border-gray-200",
      logo: "/phonepe-logo.webp",
    },
    {
      name: "Paytm",
      scheme: "paytmmp://pay",
      fallback: "https://paytm.com/",
      color: "bg-white hover:bg-gray-50 border border-gray-200",
      logo: "/Paytm_logo.png",
    },
    {
      name: "UPI",
      scheme: "upi://pay",
      fallback: "https://www.npci.org.in/what-we-do/upi",
      color: "bg-white hover:bg-gray-50 border border-gray-200",
      logo: "/UPI_logo.svg.png",
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
          className={`${app.color} flex flex-col items-center gap-2 h-16`}
          variant="outline"
        >
          <div className="w-8 h-8 relative">
            <Image
              src={app.logo}
              alt={app.name}
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <span className="text-sm font-medium text-gray-700">{app.name}</span>
        </Button>
      ))}
    </div>
  )
}
