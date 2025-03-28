"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { io } from "socket.io-client"
import DriverMap from "./DriverMap"
import DriverHeader from "./DriverHeader"
import DriverStatus from "./DriverStatus"
import TripDetails from "./TripDetails"
import NewOrderCard from "./NewOrderCard"
import "../../styles/Driver.css"
import { ArrowLeft, AlertCircle } from "lucide-react"
import { Link } from "react-router-dom"

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

const DriverApp = () => {
  const [currentLocation, setCurrentLocation] = useState(null)
  const [driverStatus, setDriverStatus] = useState("offline") // offline, online
  const [tripStatus, setTripStatus] = useState("waiting") // waiting, pickup, delivering, completed
  const [trip, setTrip] = useState(null)
  const [newOrder, setNewOrder] = useState(null)
  const [socketConnected, setSocketConnected] = useState(false)
  const [kafkaEnabled, setKafkaEnabled] = useState(false)
  const [mockMode, setMockMode] = useState(true)
  const [issues, setIssues] = useState([])
  const swipeRef = useRef(null)

  // Mock data for testing
  const mockTrip = {
    id: "T7258",
    customerName: "Alex Johnson",
    packageDetails: "Medium-sized package, fragile",
    pickupLocation: {
      address: "5683 Spring Garden Rd, Halifax, NS B3J 1G9",
      lat: 44.6430,
      lng: -63.5793,
    },
    dropoffLocation: {
      address: "1456 Brenton St, Halifax, NS B3J 2K7",
      lat: 44.6418,
      lng: -63.5784,
    },
    price: 12.5,
    estimatedTime: "15 min",
  }

  // Handle position updates - defined as useCallback to prevent recreation
  const handlePositionUpdate = useCallback(
    (position) => {
      const newLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }

      console.log(
        "Driver geolocation update:",
        `lat: ${newLocation.lat.toFixed(7)}, lng: ${newLocation.lng.toFixed(7)}`,
      )

      // Update local state
      setCurrentLocation(newLocation)

      // Emit location update to server if socket is connected and driver is on a trip
      if (tripStatus !== "waiting" && tripStatus !== "completed" && socketConnected && driverStatus === "online") {
        console.log(
          "Emitting driver location update:",
          `lat: ${newLocation.lat.toFixed(7)}, lng: ${newLocation.lng.toFixed(7)}`,
        )
        socket.emit("driverLocationUpdate", {
          tripId: trip?.id || "T7258",
          location: newLocation,
        })
      }
    },
    [tripStatus, trip?.id, socketConnected, driverStatus],
  )

  // Error handling function - defined as useCallback to prevent recreation
  const handleError = useCallback(
    (error) => {
      console.error("Error getting location:", error)
      setIssues((prev) => [...prev, "Geolocation error: " + error.message])

      // Use coordinates from the screenshots as fallback
      const halifaxLocation = {
        lat: 44.6470226,
        lng: -63.5942508,
      }

      console.log(
        "Using fallback location:",
        `lat: ${halifaxLocation.lat.toFixed(7)}, lng: ${halifaxLocation.lng.toFixed(7)}`,
      )

      setCurrentLocation(halifaxLocation)

      // Emit the fallback location if socket is connected
      if (tripStatus !== "waiting" && tripStatus !== "completed" && socketConnected && driverStatus === "online") {
        console.log(
          "Emitting fallback location:",
          `lat: ${halifaxLocation.lat.toFixed(7)}, lng: ${halifaxLocation.lng.toFixed(7)}`,
        )
        socket.emit("driverLocationUpdate", {
          tripId: trip?.id || "T7258",
          location: halifaxLocation,
        })
      }
    },
    [tripStatus, trip?.id, socketConnected, driverStatus],
  )

  // Watch driver's location with geolocation API
  useEffect(() => {
    console.log("Setting up geolocation for driver...")

    let watchId

    // Try to get the current position first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(handlePositionUpdate, handleError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      })

      // Then set up continuous watching with high accuracy
      watchId = navigator.geolocation.watchPosition(handlePositionUpdate, handleError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      })
    } else {
      console.error("Geolocation is not supported by this browser")
      setIssues((prev) => [...prev, "Geolocation not supported by this browser"])
      handleError(new Error("Geolocation not supported"))
    }

    // Cleanup on unmount
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [handlePositionUpdate, handleError])

  // Connect to socket - only set up listeners once
  useEffect(() => {
    console.log("Setting up socket connection for driver...")

    // Set up socket event listeners
    const handleConnect = () => {
      console.log("Driver connected to server with socket ID:", socket.id)
      setSocketConnected(true)

      socket.emit("driverConnected", { driverId: "D001", tripId: trip?.id })

      // Send initial location if available
      if (currentLocation && driverStatus === "online") {
        console.log(
          "Sending initial location on connect:",
          `lat: ${currentLocation.lat.toFixed(7)}, lng: ${currentLocation.lng.toFixed(7)}`,
        )
        socket.emit("driverLocationUpdate", {
          tripId: trip?.id || "T7258",
          location: currentLocation,
        })
      }

      // Request server configuration
      socket.emit("getServerConfig")
    }

    const handleConnectError = (error) => {
      console.error("Socket connection error:", error)
      setSocketConnected(false)
      setIssues((prev) => [...prev, "Socket connection error: " + error.message])
    }

    const handleDisconnect = (reason) => {
      console.log("Socket disconnected:", reason)
      setSocketConnected(false)
      setIssues((prev) => [...prev, "Socket disconnected: " + reason])
    }

    const handleNewOrder = (order) => {
      console.log("New order received:", order)
      if (driverStatus === "online" && tripStatus === "waiting") {
        setNewOrder(order)
      }
    }

    const handleTripAssigned = (newTrip) => {
      console.log("Driver received trip assignment:", newTrip)
      setTrip(newTrip)
      setTripStatus("pickup")
    }

    const handleTripStatusUpdate = (data) => {
      console.log("Driver received trip status update:", data)
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
    socket.on("newOrder", handleNewOrder)
    socket.on("tripAssigned", handleTripAssigned)
    socket.on("tripStatusUpdate", handleTripStatusUpdate)
    socket.on("serverConfig", handleServerConfig)

    // If socket is already connected, emit connection info
    if (socket.connected) {
      handleConnect()
    }

    // Cleanup on unmount - remove event listeners but don't disconnect
    return () => {
      console.log("Removing socket event listeners for driver")
      socket.off("connect", handleConnect)
      socket.off("connect_error", handleConnectError)
      socket.off("disconnect", handleDisconnect)
      socket.off("newOrder", handleNewOrder)
      socket.off("tripAssigned", handleTripAssigned)
      socket.off("tripStatusUpdate", handleTripStatusUpdate)
      socket.off("serverConfig", handleServerConfig)
      // Don't disconnect the socket here
    }
  }, [trip?.id, currentLocation, driverStatus])

  // Send location updates periodically as a backup when socket is connected
  useEffect(() => {
    if (
      !currentLocation ||
      !socketConnected ||
      driverStatus !== "online" ||
      tripStatus === "waiting" ||
      tripStatus === "completed"
    )
      return

    console.log("Setting up periodic location updates")

    const intervalId = setInterval(() => {
      console.log(
        "Sending periodic location update:",
        `lat: ${currentLocation.lat.toFixed(7)}, lng: ${currentLocation.lng.toFixed(7)}`,
      )
      socket.emit("driverLocationUpdate", {
        tripId: trip?.id || "T7258",
        location: currentLocation,
      })
    }, 3000) // Every 3 seconds

    return () => clearInterval(intervalId)
  }, [currentLocation, trip?.id, socketConnected, driverStatus, tripStatus])

  // Mock mode - simulate new orders and trips for testing
  useEffect(() => {
    if (!mockMode) return

    // If driver is online and waiting, simulate a new order after a delay
    if (driverStatus === "online" && tripStatus === "waiting" && !newOrder) {
      const timer = setTimeout(() => {
        setNewOrder(mockTrip)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [driverStatus, tripStatus, newOrder, mockMode])

  const toggleDriverStatus = () => {
    const newStatus = driverStatus === "offline" ? "online" : "offline"
    setDriverStatus(newStatus)

    // If going offline, clear any active trips or orders
    if (newStatus === "offline") {
      if (tripStatus !== "waiting" && tripStatus !== "completed") {
        setIssues((prev) => [...prev, "Trip canceled due to going offline"])
      }
      setTripStatus("waiting")
      setNewOrder(null)
    }

    // Emit status change to server
    socket.emit("driverStatusUpdate", {
      driverId: "D001",
      status: newStatus,
    })
  }

  const acceptOrder = () => {
    if (!newOrder) return

    setTrip(newOrder)
    setTripStatus("pickup")
    setNewOrder(null)

    // Emit trip acceptance to server
    socket.emit("tripAccepted", {
      tripId: newOrder.id,
      driverId: "D001",
    })
  }

  const rejectOrder = () => {
    if (!newOrder) return

    setNewOrder(null)

    // Emit trip rejection to server
    socket.emit("tripRejected", {
      tripId: newOrder.id,
      driverId: "D001",
    })
  }

  const updateTripStatus = (newStatus) => {
    console.log("Driver updating trip status to:", newStatus)
    setTripStatus(newStatus)

    // Emit status update to server
    socket.emit("tripStatusUpdate", {
      tripId: trip?.id || "T7258",
      status: newStatus,
    })

    if (newStatus === "completed") {
      // Reset after a delay
      setTimeout(() => {
        setTripStatus("waiting")
        setTrip(null)
      }, 5000)
    }
  }

  const toggleMockMode = () => {
    setMockMode(!mockMode)
  }

  const clearIssues = () => {
    setIssues([])
  }

  // Handle swipe to accept
  // useEffect(() => {
  //   if (!swipeRef.current || !newOrder) return
  //
  //   let startX = 0
  //   let isDragging = false
  //
  //   const handleTouchStart = (e) => {
  //     startX = e.touches[0].clientX
  //     isDragging = true
  //     swipeRef.current.style.transition = "none"
  //   }
  //
  //   const handleTouchMove = (e) => {
  //     if (!isDragging) return
  //
  //     const currentX = e.touches[0].clientX
  //     const diff = currentX - startX
  //
  //     if (diff > 0) {
  //       const translateX = Math.min(diff, 250) // Max swipe distance
  //       swipeRef.current.style.transform = `translateX(${translateX}px)`
  //
  //       // Change background color based on progress
  //       const progress = Math.min(diff / 250, 1)
  //       const bgColor = `rgba(74, 144, 226, ${progress})`
  //       swipeRef.current.style.backgroundColor = bgColor
  //     }
  //   }
  //
  //   const handleTouchEnd = (e) => {
  //     isDragging = false
  //     swipeRef.current.style.transition = "transform 0.3s ease, background-color 0.3s ease"
  //
  //     const currentX = e.changedTouches[0].clientX
  //     const diff = currentX - startX
  //
  //     if (diff > 150) {
  //       // Threshold to accept
  //       acceptOrder()
  //     } else {
  //       // Reset position
  //       swipeRef.current.style.transform = "translateX(0)"
  //       swipeRef.current.style.backgroundColor = "#f0f0f0"
  //     }
  //   }
  //
  //   const element = swipeRef.current
  //   element.addEventListener("touchstart", handleTouchStart)
  //   element.addEventListener("touchmove", handleTouchMove)
  //   element.addEventListener("touchend", handleTouchEnd)
  //
  //   return () => {
  //     if (element) {
  //       element.removeEventListener("touchstart", handleTouchStart)
  //       element.removeEventListener("touchmove", handleTouchMove)
  //       element.removeEventListener("touchend", handleTouchEnd)
  //     }
  //   }
  // }, [newOrder, swipeRef])

  return (
    <div className="driver-app">
      <DriverHeader
        title="Driver Dashboard"
        tripStatus={tripStatus}
        mockMode={mockMode}
        toggleMockMode={toggleMockMode}
      />

      <div className="driver-content">
        <div className="driver-sidebar">
          <Link to="/" className="back-button">
            <ArrowLeft size={20} />
            <span>Back</span>
          </Link>

          <DriverStatus status={driverStatus} toggleStatus={toggleDriverStatus} />

          {tripStatus === "waiting" && !newOrder && driverStatus === "online" && (
            <div className="waiting-message">
              <h2>No active trip</h2>
              <p>Waiting for new orders...</p>
            </div>
          )}

          {tripStatus === "waiting" && !newOrder && driverStatus === "offline" && (
            <div className="waiting-message">
              <h2>No active trip</h2>
              <p>Go online to receive orders</p>
            </div>
          )}

          {newOrder && (
            <NewOrderCard order={newOrder} onAccept={acceptOrder} onReject={rejectOrder} swipeRef={swipeRef} />
          )}

          {trip && tripStatus !== "waiting" && (
            <TripDetails trip={trip} tripStatus={tripStatus} onUpdateStatus={updateTripStatus} />
          )}
        </div>

        <div className="map-container">
          <DriverMap
            currentLocation={currentLocation}
            pickupLocation={trip?.pickupLocation}
            dropoffLocation={trip?.dropoffLocation}
            tripStatus={tripStatus}
            mockMode={mockMode}
          />

          {mockMode && (
            <div className="mock-mode-banner">
              <AlertCircle size={16} />
              <span>Mock Mode Active</span>
              <p>
                Using mock socket for development. Location updates and status changes will be logged but not sent to a
                server.
              </p>
            </div>
          )}

          {issues.length > 0 && (
            <div className="issues-panel">
              <div className="issues-header">
                <span>
                  {issues.length} {issues.length === 1 ? "issue" : "issues"}
                </span>
                <button onClick={clearIssues}>×</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DriverApp

