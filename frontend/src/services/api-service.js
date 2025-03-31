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
  // General method to update order status and send notifications
  updateOrderStatus: async (orderId, status, driverId, customerId, additionalData = {}) => {
    try {
      // Prepare the status update payload
      const statusUpdatePayload = {
        orderId,
        status,
        driverId,
      }

      // Send the status update to the backend
      const response = await apiClient.put("/order/updateStatus", statusUpdatePayload)

      // Prepare notification payload for Kafka
      const notificationPayload = {
        orderId,
        status,
        ...additionalData,
      }

      // If this is a driver-initiated update, include driver info
      if (driverId && status !== "CANCELLED") {
        // Get driver info from localStorage or a separate API call if needed
        const driverName = localStorage.getItem("driverName") || "Driver"

        notificationPayload.driver = {
          id: driverId,
        }

        // Add status-specific messages and estimated arrival
        switch (status) {
          case "AWAITING PICKUP":
            notificationPayload.message = "Driver has accepted your order"
            notificationPayload.estimatedArrival = additionalData.estimatedArrival || "15 minutes"
            break
          case "OUT FOR DELIVERY":
            notificationPayload.message = "Driver has picked up your order"
            notificationPayload.estimatedArrival = additionalData.estimatedArrival || "10 minutes"
            break
          case "DELIVERED":
            notificationPayload.message = "Your order has been delivered"
            break
          default:
            notificationPayload.message = `Order status updated to ${status}`
        }
      } else if (status === "CANCELLED") {
        // Handle cancellation
        notificationPayload.message = additionalData.message || "Your order has been cancelled"
      }

      // Send notification to Kafka
      if (customerId) {
        await apiClient.post("/notifications/send", {
          topic: `user-updates-${customerId}`,
          type: status === "CANCELLED" ? "error" : "info",
          event: "OrderStatusUpdated",
          payload: notificationPayload,
        })
      }

      return response.data
    } catch (error) {
      console.error("Error updating order status:", error)
      throw error
    }
  },
}

export default apiClient

