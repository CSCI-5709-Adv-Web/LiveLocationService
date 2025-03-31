import axios from "axios"
import { tokenService } from "./token-service.js"

// Base API URL from environment variable or default
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000"

// Create an axios instance for API calls
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
})

// Add request interceptor to add authentication token
apiClient.interceptors.request.use(
  async (config) => {
    // Determine which service we're calling based on the URL
    // This is a simple implementation - you might need a more sophisticated approach
    let serviceName = "order"

    if (config.url?.includes("/order")) {
      serviceName = "order"
    }

    try {
      // Get token for the service
      const token = await tokenService.getServiceToken(serviceName)

      // Add token to request headers
      config.headers.Authorization = `Bearer ${token}`

      return config
    } catch (error) {
      console.error("Error getting service token:", error)
      return config
    }
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Order service API functions
export const orderService = {
  updateOrderStatus: async (orderId, status) => {
    try {
      const response = await apiClient.put("/order/updateStatus", {
        orderId,
        status,
      })
      return response.data
    } catch (error) {
      console.error("Error updating order status:", error)
      throw error
    }
  },
}

export default apiClient

