"use client"

import { useState, useEffect } from "react"
import { io } from "socket.io-client"
import CustomerMap from "./CustomerMap"
import DeliveryStatus from "./DeliveryStatus"
import "../../styles/Customer.css"

// Fixed locations that won't change
const FIXED_LOCATIONS = {
  pickup: {
    lat: 44.6430,
    lng: -63.5793,
    address: "5683 Spring Garden Rd, Halifax, NS B3J 1G9",
  },
  dropoff: {
    lat: 44.6418,
    lng: -63.5784,
    address: "1456 Brenton St, Halifax, NS B3J 2K7",
  },
}

// Use the port from environment variable or default to 5000
const PORT = process.env.PORT || 5000
// Use the socket URL from environment variable or default to localhost
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || `http://localhost:${PORT}`
// Create socket outside component to prevent recreation on re-renders
const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
})

const CustomerApp = () => {
  // Initialize with a default driver location in Halifax
  const [driverLocation, setDriverLocation] = useState({ lat: 44.647, lng: -63.5942 })
  const [tripStatus, setTripStatus] = useState("assigned") // assigned, pickup, delivering, completed
  const [trip, setTrip] = useState({
    id: "T7258", // Changed to match driver's trip ID
    // Use the fixed locations
    pickupLocation: FIXED_LOCATIONS.pickup,
    dropoffLocation: FIXED_LOCATIONS.dropoff,
    driverName: "Jane Smith",
    driverPhone: "(555) 123-4567",
    packageDetails: "Medium-sized package, fragile",
    estimatedDeliveryTime: "15 minutes",
  })
  const [socketConnected, setSocketConnected] = useState(false)
  const [kafkaEnabled, setKafkaEnabled] = useState(false)
  const [locationSource, setLocationSource] = useState("socket")

  // Connect to socket - only set up listeners once
  useEffect(() => {
    console.log("Setting up socket connection for customer...")

    // Set up socket event listeners
    const handleConnect = () => {
      console.log("Customer connected to server with socket ID:", socket.id)
      setSocketConnected(true)

      socket.emit("customerConnected", { customerId: "C001", tripId: trip.id })

      // Request the latest driver location
      console.log("Requesting initial driver location")
      socket.emit("requestDriverLocation", { tripId: trip.id })

      // Request server configuration
      socket.emit("getServerConfig")
    }

    const handleConnectError = (error) => {
      console.error("Socket connection error:", error)
      setSocketConnected(false)
    }

    const handleDisconnect = (reason) => {
      console.log("Socket disconnected:", reason)
      setSocketConnected(false)
    }

    const handleDriverLocationUpdate = (data) => {
      console.log("Customer received driver location update:", data)

      if (data && data.location && typeof data.location.lat === "number" && typeof data.location.lng === "number") {
        console.log(
          "Setting valid driver location:",
          `lat: ${data.location.lat.toFixed(7)}, lng: ${data.location.lng.toFixed(7)}`,
        )
        setDriverLocation(data.location)

        // Track the source of the location update
        if (data.source) {
          setLocationSource(data.source)
          if (data.source === "kafka") {
            setKafkaEnabled(true)
          }
        }
      } else {
        console.error("Received invalid driver location data:", data)
      }
    }

    const handleTripStatusUpdate = (data) => {
      console.log("Customer received trip status update:", data)
      if (data && data.status) {
        setTripStatus(data.status)
      }

      // Check if the update came from Kafka
      if (data && data.source === "kafka") {
        setKafkaEnabled(true)
      }
    }

    const handleServerConfig = (config) => {
      console.log("Received server configuration:", config)
      if (config && typeof config.kafkaEnabled === "boolean") {
        console.log("Setting Kafka enabled to:", config.kafkaEnabled)
        setKafkaEnabled(config.kafkaEnabled)
      }
    }

    // Add event listeners
    socket.on("connect", handleConnect)
    socket.on("connect_error", handleConnectError)
    socket.on("disconnect", handleDisconnect)
    socket.on("driverLocationUpdate", handleDriverLocationUpdate)
    socket.on("tripStatusUpdate", handleTripStatusUpdate)
    socket.on("serverConfig", handleServerConfig)

    // If socket is already connected, emit connection info
    if (socket.connected) {
      handleConnect()
    }

    // Cleanup on unmount - remove event listeners but don't disconnect
    return () => {
      console.log("Removing socket event listeners for customer")
      socket.off("connect", handleConnect)
      socket.off("connect_error", handleConnectError)
      socket.off("disconnect", handleDisconnect)
      socket.off("driverLocationUpdate", handleDriverLocationUpdate)
      socket.off("tripStatusUpdate", handleTripStatusUpdate)
      socket.off("serverConfig", handleServerConfig)
      // Don't disconnect the socket here
    }
  }, [trip.id])

  // Periodically request driver location updates when socket is connected
  useEffect(() => {
    if (!socketConnected) return

    console.log("Setting up periodic location requests")

    const intervalId = setInterval(() => {
      console.log("Requesting driver location update")
      socket.emit("requestDriverLocation", { tripId: trip.id })
    }, 3000) // Every 3 seconds

    return () => clearInterval(intervalId)
  }, [trip.id, socketConnected])

  return (
    <div className="customer-app">
      <header className="customer-header">
        <h1>Package Delivery Tracker</h1>
        <div className="trip-id">Trip #{trip.id}</div>
      </header>

      <div className="customer-content">
        <div className="map-container">
          <CustomerMap
            driverLocation={driverLocation}
            pickupLocation={FIXED_LOCATIONS.pickup}
            dropoffLocation={FIXED_LOCATIONS.dropoff}
            tripStatus={tripStatus}
          />

          {/* Debug info - only visible in development */}
          {process.env.NODE_ENV === "development" && (
            <div className="debug-panel">
              <div className="debug-info">
                <h4>Driver Location:</h4>
                <p>{`{"lat":${driverLocation.lat.toFixed(7)},"lng":${driverLocation.lng.toFixed(7)}}`}</p>
                <h4>Status: {tripStatus}</h4>
                <h4>Socket Connected: {socketConnected ? "Yes" : "No"}</h4>
                <h4>Socket ID: {socket.id || "Not connected"}</h4>
                <h4>Kafka Enabled: {kafkaEnabled ? "Yes" : "No"}</h4>
                <h4>Location Source: {locationSource}</h4>
              </div>
            </div>
          )}
        </div>

        <div className="status-container">
          <DeliveryStatus
            trip={{
              ...trip,
              // Ensure we always use the fixed locations
              pickupLocation: FIXED_LOCATIONS.pickup,
              dropoffLocation: FIXED_LOCATIONS.dropoff,
            }}
            tripStatus={tripStatus}
            driverLocation={driverLocation}
          />
        </div>
      </div>
    </div>
  )
}

export default CustomerApp

