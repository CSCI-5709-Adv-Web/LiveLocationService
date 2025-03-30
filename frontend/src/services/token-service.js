import axios from "axios"

// Configuration for services that need authentication
const SERVICE_CONFIGS = {
  order: {
    clientId: "microservice_order_client",
    clientSecret: "7f5aa1e2e4cce1e41cf9b93db36f87c82a790cedb958bcd7f711c305d21e8db2",
    scopes: ["order.read", "order.write", "event.order.created", "event.order.updated", "event.order.cancelled"],
  },
}

class TokenService {
  constructor() {
    this.tokenCache = {}
    this.tokenRequests = {}
    // Use environment variable or default to a placeholder URL
    this.identityServerUrl = process.env.REACT_APP_IDENTITY_SERVER_URL || "http://localhost:5001/api/token"
  }

  async getServiceToken(serviceName) {
    const cachedToken = this.tokenCache[serviceName]
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
      console.log(`Using cached token for ${serviceName} service`)
      return cachedToken.token
    }

    if (this.tokenRequests[serviceName]) {
      console.log(`Waiting for existing token request for ${serviceName} service`)
      return await this.tokenRequests[serviceName]
    }

    const tokenPromise = this.fetchNewToken(serviceName)
    this.tokenRequests[serviceName] = tokenPromise

    try {
      const token = await tokenPromise
      return token
    } finally {
      if (this.tokenRequests[serviceName] === tokenPromise) {
        delete this.tokenRequests[serviceName]
      }
    }
  }

  async fetchNewToken(serviceName) {
    const config = SERVICE_CONFIGS[serviceName]
    if (!config) {
      throw new Error(`No configuration found for service: ${serviceName}`)
    }

    try {
      console.log(`Fetching new token for ${serviceName} service`)
      const params = new URLSearchParams()
      params.append("grant_type", "client_credentials")
      params.append("client_id", config.clientId)
      params.append("client_secret", config.clientSecret)
      params.append("scope", config.scopes.join(" "))

      console.log(`Token request URL: ${this.identityServerUrl}`)
      console.log(`Token request params: ${params.toString()}`)

      const response = await axios.post(this.identityServerUrl, params.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })

      const { access_token, expires_in } = response.data
      const expiresAt = Date.now() + expires_in * 1000

      this.tokenCache[serviceName] = {
        token: access_token,
        expiresAt,
      }

      console.log(`Successfully obtained token for ${serviceName} service`)
      return access_token
    } catch (error) {
      console.error(`Error fetching token for ${serviceName}:`, error)
      if (axios.isAxiosError(error)) {
        console.error(`Status: ${error.response?.status}, Data:`, error.response?.data)
      }
      throw error
    }
  }

  clearServiceToken(serviceName) {
    delete this.tokenCache[serviceName]
  }

  clearAllTokens() {
    this.tokenCache = {}
  }
}

export const tokenService = new TokenService()

