"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface UtrFormProps {
  onSubmit: (utr: string) => void
  isSubmitted?: boolean
  submittedUtr?: string
}

export function UtrForm({ onSubmit, isSubmitted = false, submittedUtr }: UtrFormProps) {
  const [utr, setUtr] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!utr.trim()) {
      toast({
        title: "UTR required",
        description: "Please enter the UTR number from your payment app.",
        variant: "destructive",
      })
      return
    }

    if (utr.length !== 12) {
      toast({
        title: "Invalid UTR",
        description: "UTR number should be exactly 12 characters long.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      await onSubmit(utr)
      toast({
        title: "UTR submitted successfully",
        description: "Your payment is being verified. You'll be notified once confirmed.",
      })
    } catch (error) {
      toast({
        title: "Error submitting UTR",
        description: "There was a problem submitting your UTR. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-2">
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
          <CardTitle className="text-yellow-800 text-lg">Payment Under Verification</CardTitle>
          <CardDescription className="text-yellow-700">
            We're verifying your payment. This usually takes a few minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-2">
          <div>
            <p className="text-sm text-yellow-700">Submitted UTR:</p>
            <p className="font-mono text-sm font-medium text-yellow-800">{submittedUtr}</p>
          </div>
          <p className="text-xs text-yellow-600">
            You can close this page. We'll notify you once the payment is confirmed.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Submit Payment Proof</CardTitle>
        <CardDescription>
          After completing the payment, enter the UTR (Transaction Reference Number) from your UPI app
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="utr">UTR Number</Label>
            <Input
              id="utr"
              placeholder="Enter 12-digit UTR number"
              value={utr}
              onChange={(e) => setUtr(e.target.value.toUpperCase())}
              maxLength={12}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Find this in your UPI app under transaction details</p>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Submitting..." : "Submit UTR"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
