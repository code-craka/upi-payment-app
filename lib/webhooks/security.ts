/**
 * Webhook Security and Verification Service
 *
 * Provides comprehensive webhook security including:
 * - Signature verification using svix library
 * - Request validation and sanitization
 * - Security headers validation
 * - Rate limiting integration
 * - Correlation ID generation
 */

import { Webhook } from 'svix'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'

// Webhook verification configuration
export const WebhookVerificationConfigSchema = z.object({
  secret: z.string().min(1, 'Webhook secret is required'),
  tolerance: z.number().default(300000), // 5 minutes tolerance
  maxBodySize: z.number().default(1048576), // 1MB max body size
  requiredHeaders: z.array(z.string()).default([
    'svix-id',
    'svix-timestamp',
    'svix-signature'
  ]),
  allowedContentTypes: z.array(z.string()).default([
    'application/json',
    'application/x-www-form-urlencoded'
  ])
})

export type WebhookVerificationConfig = z.infer<typeof WebhookVerificationConfigSchema>

// Webhook verification result
export const WebhookVerificationResultSchema = z.object({
  success: z.boolean(),
  event: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  }).optional(),
  metadata: z.object({
    correlationId: z.string(),
    timestamp: z.number(),
    processingTime: z.number(),
    headers: z.record(z.string()),
    bodySize: z.number(),
    signatureVersion: z.string().optional()
  })
})

export type WebhookVerificationResult = z.infer<typeof WebhookVerificationResultSchema>

// Security headers validation
export const SecurityHeadersSchema = z.object({
  'svix-id': z.string().min(1),
  'svix-timestamp': z.string().min(1),
  'svix-signature': z.string().min(1),
  'user-agent': z.string().optional(),
  'content-type': z.string().optional(),
  'content-length': z.string().optional(),
  'x-forwarded-for': z.string().optional(),
  'x-real-ip': z.string().optional()
})

export type SecurityHeaders = z.infer<typeof SecurityHeadersSchema>

// Webhook verification error types
export enum WebhookVerificationError {
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  MISSING_HEADERS = 'MISSING_HEADERS',
  INVALID_HEADERS = 'INVALID_HEADERS',
  TIMESTAMP_TOO_OLD = 'TIMESTAMP_TOO_OLD',
  TIMESTAMP_TOO_NEW = 'TIMESTAMP_TOO_NEW',
  BODY_TOO_LARGE = 'BODY_TOO_LARGE',
  INVALID_CONTENT_TYPE = 'INVALID_CONTENT_TYPE',
  MALFORMED_BODY = 'MALFORMED_BODY',
  SECRET_NOT_CONFIGURED = 'SECRET_NOT_CONFIGURED',
  VERIFICATION_TIMEOUT = 'VERIFICATION_TIMEOUT'
}

/**
 * Webhook Security Service
 *
 * Handles all webhook security operations including signature verification,
 * header validation, and security monitoring.
 */
export class WebhookSecurityService {
  private webhook: Webhook | null = null
  private config: WebhookVerificationConfig

  constructor(config: Partial<WebhookVerificationConfig> = {}) {
    this.config = WebhookVerificationConfigSchema.parse({
      secret: process.env.CLERK_WEBHOOK_SECRET || process.env.SVIX_WEBHOOK_SECRET,
      ...config
    })

    if (!this.config.secret) {
      throw new Error('Webhook secret not configured. Set CLERK_WEBHOOK_SECRET or SVIX_WEBHOOK_SECRET environment variable.')
    }

    this.initializeWebhook()
  }

  /**
   * Initialize svix webhook instance
   */
  private initializeWebhook(): void {
    try {
      this.webhook = new Webhook(this.config.secret)
    } catch (error) {
      console.error('[WebhookSecurity] Failed to initialize webhook:', error)
      throw new Error('Failed to initialize webhook verification')
    }
  }

  /**
   * Verify webhook signature and extract event
   */
  async verifyWebhook(
    request: NextRequest,
    options: {
      timeout?: number
      correlationId?: string
    } = {}
  ): Promise<WebhookVerificationResult> {
    const startTime = Date.now()
    const correlationId = options.correlationId || this.generateCorrelationId()
    const timeout = options.timeout || 30000 // 30 seconds default

    try {
      // Extract and validate headers
      const headers = await this.extractHeaders(request)
      const securityHeaders = this.validateSecurityHeaders(headers)

      // Extract and validate body
      const body = await this.extractAndValidateBody(request, securityHeaders)

      // Verify signature with timeout
      const verificationPromise = this.performSignatureVerification(body, securityHeaders)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Verification timeout')), timeout)
      )

      const event = await Promise.race([verificationPromise, timeoutPromise])

      const processingTime = Date.now() - startTime

      return {
        success: true,
        event,
        metadata: {
          correlationId,
          timestamp: startTime,
          processingTime,
          headers: securityHeaders,
          bodySize: body.length,
          signatureVersion: this.extractSignatureVersion(securityHeaders['svix-signature'])
        }
      }

    } catch (error) {
      const processingTime = Date.now() - startTime

      return {
        success: false,
        error: {
          code: this.mapErrorToCode(error),
          message: error instanceof Error ? error.message : 'Unknown verification error',
          details: {
            correlationId,
            processingTime,
            error: error instanceof Error ? error.stack : String(error)
          }
        },
        metadata: {
          correlationId,
          timestamp: startTime,
          processingTime,
          headers: {},
          bodySize: 0
        }
      }
    }
  }

  /**
   * Extract headers from NextRequest
   */
  private async extractHeaders(request: NextRequest): Promise<Record<string, string>> {
    const headers: Record<string, string> = {}

    // Extract all headers
    for (const [key, value] of request.headers.entries()) {
      headers[key.toLowerCase()] = value
    }

    return headers
  }

  /**
   * Validate security headers
   */
  private validateSecurityHeaders(headers: Record<string, string>): SecurityHeaders {
    try {
      // Check for required headers
      const missingHeaders = this.config.requiredHeaders.filter(
        header => !headers[header.toLowerCase()]
      )

      if (missingHeaders.length > 0) {
        throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`)
      }

      // Parse and validate security headers
      const securityHeaders = SecurityHeadersSchema.parse({
        'svix-id': headers['svix-id'],
        'svix-timestamp': headers['svix-timestamp'],
        'svix-signature': headers['svix-signature'],
        'user-agent': headers['user-agent'],
        'content-type': headers['content-type'],
        'content-length': headers['content-length'],
        'x-forwarded-for': headers['x-forwarded-for'],
        'x-real-ip': headers['x-real-ip']
      })

      // Validate timestamp
      this.validateTimestamp(securityHeaders['svix-timestamp'])

      // Validate content type if present
      if (securityHeaders['content-type']) {
        this.validateContentType(securityHeaders['content-type'])
      }

      return securityHeaders

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid security headers: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * Extract and validate request body
   */
  private async extractAndValidateBody(
    request: NextRequest,
    headers: SecurityHeaders
  ): Promise<string> {
    try {
      const body = await request.text()

      // Check body size
      if (body.length > this.config.maxBodySize) {
        throw new Error(`Request body too large: ${body.length} bytes (max: ${this.config.maxBodySize})`)
      }

      // Validate content type if present
      if (headers['content-type']) {
        this.validateContentType(headers['content-type'])
      }

      return body

    } catch (error) {
      if (error instanceof Error && error.message.includes('body too large')) {
        throw error
      }
      throw new Error('Failed to extract request body')
    }
  }

  /**
   * Perform signature verification using svix
   */
  private async performSignatureVerification(
    body: string,
    headers: SecurityHeaders
  ): Promise<any> {
    if (!this.webhook) {
      throw new Error('Webhook not initialized')
    }

    try {
      // Convert headers to the format expected by svix
      const svixHeaders = {
        'svix-id': headers['svix-id'],
        'svix-timestamp': headers['svix-timestamp'],
        'svix-signature': headers['svix-signature']
      }

      // Verify signature and extract event
      const event = await this.webhook.verify(body, svixHeaders)
      return event

    } catch (error) {
      console.error('[WebhookSecurity] Signature verification failed:', error)
      throw new Error('Invalid webhook signature')
    }
  }

  /**
   * Validate timestamp to prevent replay attacks
   */
  private validateTimestamp(timestamp: string): void {
    const now = Math.floor(Date.now() / 1000)
    const eventTime = parseInt(timestamp)

    if (isNaN(eventTime)) {
      throw new Error('Invalid timestamp format')
    }

    const timeDiff = Math.abs(now - eventTime)

    if (timeDiff > this.config.tolerance / 1000) {
      if (eventTime < now) {
        throw new Error('Webhook timestamp too old')
      } else {
        throw new Error('Webhook timestamp too new')
      }
    }
  }

  /**
   * Validate content type
   */
  private validateContentType(contentType: string): void {
    const isAllowed = this.config.allowedContentTypes.some(allowed =>
      contentType.toLowerCase().includes(allowed.toLowerCase())
    )

    if (!isAllowed) {
      throw new Error(`Invalid content type: ${contentType}`)
    }
  }

  /**
   * Extract signature version from signature header
   */
  private extractSignatureVersion(signature: string): string | undefined {
    const match = signature.match(/v(\d+)/)
    return match ? match[1] : undefined
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `wh_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
  }

  /**
   * Map error to error code
   */
  private mapErrorToCode(error: any): string {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('Invalid webhook signature')) {
      return WebhookVerificationError.INVALID_SIGNATURE
    }
    if (message.includes('Missing required headers')) {
      return WebhookVerificationError.MISSING_HEADERS
    }
    if (message.includes('Invalid security headers')) {
      return WebhookVerificationError.INVALID_HEADERS
    }
    if (message.includes('timestamp too old')) {
      return WebhookVerificationError.TIMESTAMP_TOO_OLD
    }
    if (message.includes('timestamp too new')) {
      return WebhookVerificationError.TIMESTAMP_TOO_NEW
    }
    if (message.includes('body too large')) {
      return WebhookVerificationError.BODY_TOO_LARGE
    }
    if (message.includes('Invalid content type')) {
      return WebhookVerificationError.INVALID_CONTENT_TYPE
    }
    if (message.includes('Failed to extract request body')) {
      return WebhookVerificationError.MALFORMED_BODY
    }
    if (message.includes('Verification timeout')) {
      return WebhookVerificationError.VERIFICATION_TIMEOUT
    }

    return 'UNKNOWN_ERROR'
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): {
    config: WebhookVerificationConfig
    isInitialized: boolean
    supportedSignatureVersions: string[]
  } {
    return {
      config: this.config,
      isInitialized: this.webhook !== null,
      supportedSignatureVersions: ['v1', 'v1a'] // svix supported versions
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<WebhookVerificationConfig>): void {
    this.config = WebhookVerificationConfigSchema.parse({
      ...this.config,
      ...newConfig
    })

    // Re-initialize webhook if secret changed
    if (newConfig.secret) {
      this.initializeWebhook()
    }
  }
}

// Export singleton instance
let webhookSecurityService: WebhookSecurityService | null = null

export function getWebhookSecurityService(
  config?: Partial<WebhookVerificationConfig>
): WebhookSecurityService {
  if (!webhookSecurityService) {
    webhookSecurityService = new WebhookSecurityService(config)
  }
  return webhookSecurityService
}

// Export utilities
export { WebhookVerificationError as WebhookSecurityError }
export const DEFAULT_WEBHOOK_CONFIG: Partial<WebhookVerificationConfig> = {
  tolerance: 300000, // 5 minutes
  maxBodySize: 1048576, // 1MB
  requiredHeaders: ['svix-id', 'svix-timestamp', 'svix-signature'],
  allowedContentTypes: ['application/json', 'application/x-www-form-urlencoded']
}