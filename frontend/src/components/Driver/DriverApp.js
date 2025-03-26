"use client"

import { useState, useEffect, useCallback } from "react"
import { io } from "socket.io-client"
import DriverMap from "./DriverMap"
import TripDetails from "./TripDetails"
import "../../styles/Driver.css"

// Fixed locations that won't change
const FIXED_LOCATIONS = {
  pickup: {
    lat: 44.6488,
    lng: -63.5752,
    address: "1333 South Park St, Halifax, NS B3J 2K9",
  },
  dropoff: {
    lat: 44.6426,
    lng: -63.5773,
    address: "5410 Spring Garden Rd, Halifax, NS B3J 1E9",
  },
}

// Use the port from environment variable
const PORT = process.env.PORT
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
  const [tripStatus, setTripStatus] = useState("pickup")
  const [trip, setTrip] = useState({
    id: "T12345",
    // Use the fixed locations
    pickupLocation: FIXED_LOCATIONS.pickup,
    dropoffLocation: FIXED_LOCATIONS.dropoff,
    customerName: "John Doe",
    packageDetails: "Small package, handle with care",
  })
  const [socketConnected, setSocketConnected] = useState(false)

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

      // Emit location update to server if socket is connected
      if (tripStatus !== "waiting" && tripStatus !== "completed" && socketConnected) {
        console.log(
          "Emitting driver location update:",
          `lat: ${newLocation.lat.toFixed(7)}, lng: ${newLocation.lng.toFixed(7)}`,
        )
        socket.emit("driverLocationUpdate", {
          tripId: trip.id,
          location: newLocation,
        })
      }
    },
    [tripStatus, trip.id, socketConnected],
  )

  // Error handling function - defined as useCallback to prevent recreation
  const handleError = useCallback(
    (error) => {
      console.error("Error getting location:", error)

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
      if (tripStatus !== "waiting" && tripStatus !== "completed" && socketConnected) {
        console.log(
          "Emitting fallback location:",
          `lat: ${halifaxLocation.lat.toFixed(7)}, lng: ${halifaxLocation.lng.toFixed(7)}`,
        )
        socket.emit("driverLocationUpdate", {
          tripId: trip.id,
          location: halifaxLocation,
        })
      }
    },
    [tripStatus, trip.id, socketConnected],
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

      socket.emit("driverConnected", { driverId: "D001", tripId: trip.id })

      // Send initial location if available
      if (currentLocation) {
        console.log(
          "Sending initial location on connect:",
          `lat: ${currentLocation.lat.toFixed(7)}, lng: ${currentLocation.lng.toFixed(7)}`,
        )
        socket.emit("driverLocationUpdate", {
          tripId: trip.id,
          location: currentLocation,
        })
      }
    }

    const handleConnectError = (error) => {
      console.error("Socket connection error:", error)
      setSocketConnected(false)
    }

    const handleDisconnect = (reason) => {
      console.log("Socket disconnected:", reason)
      setSocketConnected(false)
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
    }

    // Add event listeners
    socket.on("connect", handleConnect)
    socket.on("connect_error", handleConnectError)
    socket.on("disconnect", handleDisconnect)
    socket.on("tripAssigned", handleTripAssigned)
    socket.on("tripStatusUpdate", handleTripStatusUpdate)

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
      socket.off("tripAssigned", handleTripAssigned)
      socket.off("tripStatusUpdate", handleTripStatusUpdate)
      // Don't disconnect the socket here
    }
  }, [trip.id, currentLocation])

  // Send location updates periodically as a backup when socket is connected
  useEffect(() => {
    if (!currentLocation || !socketConnected) return

    console.log("Setting up periodic location updates")

    const intervalId = setInterval(() => {
      console.log(
        "Sending periodic location update:",
        `lat: ${currentLocation.lat.toFixed(7)}, lng: ${currentLocation.lng.toFixed(7)}`,
      )
      socket.emit("driverLocationUpdate", {
        tripId: trip.id,
        location: currentLocation,
      })
    }, 3000) // Every 3 seconds

    return () => clearInterval(intervalId)
  }, [currentLocation, trip.id, socketConnected])

  const updateTripStatus = (newStatus) => {
    console.log("Driver updating trip status to:", newStatus)
    setTripStatus(newStatus)
    socket.emit("tripStatusUpdate", {
      tripId: trip.id,
      status: newStatus,
    })

    if (newStatus === "completed") {
      // Reset after a delay
      setTimeout(() => {
        setTripStatus("waiting")
      }, 5000)
    }
  }

  const getDistance = (point1, point2) => {
    const R = 6371 // Earth's radius in km
    const dLat = deg2rad(point2.lat - point1.lat)
    const dLng = deg2rad(point2.lng - point1.lng)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(point1.lat)) * Math.cos(deg2rad(point2.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c // Distance in km
    return distance
  }

  const deg2rad = (deg) => {
    return deg * (Math.PI / 180)
  }

  return (
    <div className="driver-app">
      <header className="driver-header">
        <h1>Driver Dashboard</h1>
        <div className="status-indicator">
          Status: <span className={`status-${tripStatus}`}>{tripStatus.toUpperCase()}</span>
        </div>
      </header>

      <div className="driver-content">
        <div className="map-container">
          <DriverMap
            currentLocation={currentLocation}
            pickupLocation={FIXED_LOCATIONS.pickup}
            dropoffLocation={FIXED_LOCATIONS.dropoff}
            tripStatus={tripStatus}
          />

          {/* Debug info - only visible in development */}
          {process.env.NODE_ENV === "development" && currentLocation && (
            <div className="debug-panel">
              <div className="debug-info">
                <h4>Current Location:</h4>
                <p>{`{"lat":${currentLocation.lat.toFixed(7)},"lng":${currentLocation.lng.toFixed(7)}}`}</p>
                <h4>Status: {tripStatus}</h4>
                <h4>Socket Connected: {socketConnected ? "Yes" : "No"}</h4>
                <h4>Socket ID: {socket.id || "Not connected"}</h4>
              </div>
            </div>
          )}
        </div>

        <div className="trip-details-container">
          <TripDetails
            trip={{
              ...trip,
              // Ensure we always use the fixed locations
              pickupLocation: FIXED_LOCATIONS.pickup,
              dropoffLocation: FIXED_LOCATIONS.dropoff,
            }}
            tripStatus={tripStatus}
            onUpdateStatus={updateTripStatus}
          />
        </div>
      </div>
    </div>
  )
}

export default DriverApp

