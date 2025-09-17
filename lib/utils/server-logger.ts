/**
 * Server-side logging utility for middleware and API routes
 * This module provides safe logging that only runs on the server
 */

interface LogContext {
  [key: string]: unknown
}

class ServerLogger {
  private isServer = typeof window === 'undefined'

  info(message: string, context?: LogContext): void {
    if (!this.isServer) return
    
    if (context) {
      // eslint-disable-next-line no-console
      console.log(`[INFO] ${message}`, context)
    } else {
      // eslint-disable-next-line no-console
      console.log(`[INFO] ${message}`)
    }
  }

  warn(message: string, context?: LogContext): void {
    if (!this.isServer) return
    
    if (context) {
      // eslint-disable-next-line no-console
      console.warn(`[WARN] ${message}`, context)
    } else {
      // eslint-disable-next-line no-console
      console.warn(`[WARN] ${message}`)
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.isServer) return
    
    const logData: Record<string, unknown> = {}
    
    if (error) {
      if (error instanceof Error) {
        logData.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      } else {
        logData.error = error
      }
    }
    
    if (context) {
      logData.context = context
    }
    
    if (Object.keys(logData).length > 0) {
      // eslint-disable-next-line no-console
      console.error(`[ERROR] ${message}`, logData)
    } else {
      // eslint-disable-next-line no-console
      console.error(`[ERROR] ${message}`)
    }
  }

  middleware(message: string, context?: LogContext): void {
    if (!this.isServer) return
    
    if (context) {
      // eslint-disable-next-line no-console
      console.log(`[MIDDLEWARE] ${message}`, context)
    } else {
      // eslint-disable-next-line no-console
      console.log(`[MIDDLEWARE] ${message}`)
    }
  }

  audit(action: string, entityType: string, entityId: string, userId: string, context?: LogContext): void {
    if (!this.isServer) return

    const auditContext = {
      action,
      entityType,
      entityId,
      userId,
      timestamp: new Date().toISOString(),
      ...context
    }

    // eslint-disable-next-line no-console
    console.log(`[AUDIT] ${action} on ${entityType}:${entityId} by user:${userId}`, auditContext)
  }

  debug(message: string, context?: LogContext): void {
    if (!this.isServer || process.env.NODE_ENV !== 'development') return
    
    if (context) {
      // eslint-disable-next-line no-console
      console.debug(`[DEBUG] ${message}`, context)
    } else {
      // eslint-disable-next-line no-console
      console.debug(`[DEBUG] ${message}`)
    }
  }
}

export const serverLogger = new ServerLogger()