"use client"

import { useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface QRCodeDisplayProps {
  upiString: string
  amount: number
  merchantName: string
}

export function QRCodeDisplay({ upiString, amount, merchantName }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    // Generate QR code using a simple pattern (in production, use a proper QR code library)
    generateQRCode(upiString)
  }, [upiString])

  const generateQRCode = (text: string) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Simple QR code placeholder (use qrcode.js or similar library in production)
    const size = 200
    canvas.width = size
    canvas.height = size

    // Create a simple pattern as placeholder
    ctx.fillStyle = "#000000"
    ctx.fillRect(0, 0, size, size)

    ctx.fillStyle = "#ffffff"
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 20; j++) {
        if ((i + j) % 3 === 0) {
          ctx.fillRect(i * 10, j * 10, 8, 8)
        }
      }
    }

    // Add corner markers
    ctx.fillStyle = "#000000"
    ctx.fillRect(0, 0, 60, 60)
    ctx.fillRect(140, 0, 60, 60)
    ctx.fillRect(0, 140, 60, 60)

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(10, 10, 40, 40)
    ctx.fillRect(150, 10, 40, 40)
    ctx.fillRect(10, 150, 40, 40)
  }

  const copyUpiString = () => {
    navigator.clipboard.writeText(upiString)
    toast({
      title: "UPI string copied",
      description: "The UPI payment string has been copied to your clipboard.",
    })
  }

  const downloadQR = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement("a")
    link.download = `payment-qr-${Date.now()}.png`
    link.href = canvas.toDataURL()
    link.click()

    toast({
      title: "QR code downloaded",
      description: "The QR code has been saved to your downloads.",
    })
  }

  return (
    <Card className="w-full max-w-xs mx-auto">
      <CardContent className="p-4 text-center space-y-4">
        <canvas ref={canvasRef} className="border rounded-lg mx-auto max-w-[200px] h-auto" />

        <div className="space-y-2">
          <p className="text-sm font-medium">Scan with any UPI app</p>
          <p className="text-xs text-muted-foreground">
            Amount: ₹{amount} • To: {merchantName}
          </p>
        </div>

        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={copyUpiString}>
            <Copy className="w-3 h-3 mr-1" />
            Copy UPI
          </Button>
          <Button variant="outline" size="sm" onClick={downloadQR}>
            <Download className="w-3 h-3 mr-1" />
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
