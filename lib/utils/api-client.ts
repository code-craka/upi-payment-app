class APIClient {
  private csrfToken: string | null = null
  private csrfExpires = 0

  async getCSRFToken(): Promise<string> {
    if (this.csrfToken && Date.now() < this.csrfExpires) {
      return this.csrfToken
    }

    try {
      const response = await fetch("/api/csrf-token")
      const data = await response.json()

      this.csrfToken = data.csrfToken
      this.csrfExpires = data.expires

      return this.csrfToken!
    } catch (error) {
      console.error("Failed to get CSRF token:", error)
      throw new Error("Failed to get CSRF token")
    }
  }

  async request(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers)

    // Add CSRF token for state-changing requests
    if (!["GET", "HEAD", "OPTIONS"].includes(options.method || "GET")) {
      const csrfToken = await this.getCSRFToken()
      headers.set("X-CSRF-Token", csrfToken)
    }

    // Add content type if not set
    if (!headers.has("Content-Type") && options.body) {
      headers.set("Content-Type", "application/json")
    }

    return fetch(url, {
      ...options,
      headers,
    })
  }

  async get(url: string, options: RequestInit = {}): Promise<Response> {
    return this.request(url, { ...options, method: "GET" })
  }

  async post(url: string, data?: any, options: RequestInit = {}): Promise<Response> {
    return this.request(url, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put(url: string, data?: any, options: RequestInit = {}): Promise<Response> {
    return this.request(url, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete(url: string, options: RequestInit = {}): Promise<Response> {
    return this.request(url, { ...options, method: "DELETE" })
  }
}

export const apiClient = new APIClient()
