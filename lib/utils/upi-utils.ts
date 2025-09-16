import QRCode from 'qrcode'

export interface UPIPaymentData {
  payeeAddress: string
  payeeName: string
  amount: number
  transactionNote: string
  transactionRef?: string
}

/**
 * Generate UPI payment string according to UPI linking specification
 * Format: upi://pay?pa=<payee_address>&pn=<payee_name>&am=<amount>&tn=<transaction_note>&tr=<transaction_ref>
 */
export function generateUPIString(data: UPIPaymentData): string {
  const params = new URLSearchParams()
  
  params.set('pa', data.payeeAddress) // Payee Address (UPI ID)
  params.set('pn', data.payeeName) // Payee Name
  params.set('am', data.amount.toString()) // Amount
  params.set('tn', data.transactionNote) // Transaction Note
  
  if (data.transactionRef) {
    params.set('tr', data.transactionRef) // Transaction Reference
  }
  
  return `upi://pay?${params.toString()}`
}

/**
 * Generate QR code for UPI payment
 */
export async function generateQRCode(upiString: string): Promise<string> {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(upiString, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 300,
    })
    
    return qrCodeDataUrl
  } catch (error) {
    console.error('Error generating QR code:', error)
    throw new Error('Failed to generate QR code')
  }
}

/**
 * Generate deep links for popular UPI apps
 */
export function generateUPIDeepLinks(upiString: string) {
  const encodedUPI = encodeURIComponent(upiString)
  
  return {
    gpay: `tez://upi/pay?${upiString.replace('upi://pay?', '')}`,
    phonepe: `phonepe://pay?${upiString.replace('upi://pay?', '')}`,
    paytm: `paytmmp://pay?${upiString.replace('upi://pay?', '')}`,
    bhim: `bhim://pay?${upiString.replace('upi://pay?', '')}`,
    generic: upiString,
  }
}

/**
 * Validate UTR (Unique Transaction Reference) format
 * UTR format: 12-digit alphanumeric string
 */
export function validateUTR(utr: string): boolean {
  const utrPattern = /^[A-Z0-9]{12}$/
  return utrPattern.test(utr.toUpperCase())
}

/**
 * Generate order ID with timestamp and random suffix
 */
export function generateOrderId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `ord_${timestamp}_${random}`
}

/**
 * Calculate expiration time based on minutes from now
 */
export function calculateExpirationTime(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000)
}

/**
 * Check if order is expired
 */
export function isOrderExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt
}

/**
 * Get payment timeout from environment or default
 */
export function getPaymentTimeout(): number {
  const timeout = process.env.DEFAULT_PAYMENT_TIMEOUT
  return timeout ? parseInt(timeout, 10) : 540000 // 9 minutes default
}

/**
 * Get UPI configuration from environment
 */
export function getUPIConfig() {
  return {
    upiId: process.env.UPI_ID || 'merchant@paytm',
    merchantName: process.env.MERCHANT_NAME || 'UPI Payment System',
    merchantCode: process.env.MERCHANT_CODE || 'UPI001',
    enabledApps: {
      gpay: process.env.ENABLE_GPAY === 'true',
      phonepe: process.env.ENABLE_PHONEPE === 'true',
      paytm: process.env.ENABLE_PAYTM === 'true',
      bhim: process.env.ENABLE_BHIM === 'true',
    },
  }
}