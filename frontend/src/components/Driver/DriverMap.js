"use client"

import React, { useState, useEffect, useRef } from "react"
import { GoogleMap, LoadScript, DirectionsService, DirectionsRenderer, InfoWindow } from "@react-google-maps/api"
import { useAdvancedMarker } from "../Customer/useAdvancedMarker"

const mapContainerStyle = {
  width: "100%",
  height: "100%",
}

// Logger for Google Maps API usage
const logApiUsage = (action) => {
  console.log(`[MAPS API] ${action} - ${new Date().toISOString()}`)
}

const DriverMap = ({ currentLocation, pickupLocation, dropoffLocation, tripStatus }) => {
  const [directions, setDirections] = useState(null)
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const [directionsRequested, setDirectionsRequested] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [mapBounds, setMapBounds] = useState(null)
  const mapRef = useRef(null)
  const lastTripStatus = useRef(tripStatus)
  const lastOrigin = useRef(null)
  const lastDestination = useRef(null)
  const directionsRequestTimeout = useRef(null)
  const { renderAdvancedMarker } = useAdvancedMarker()

  // Determine which locations to show directions for based on trip status
  const origin = currentLocation
  const destination = tripStatus === "pickup" ? pickupLocation : dropoffLocation

  // Default to Halifax if no current location
  const center = currentLocation || { lat: 44.6476, lng: -63.5728 }

  // Add this at the top of the component
  useEffect(() => {
    console.log(
      "DriverMap received currentLocation:",
      currentLocation ? `lat: ${currentLocation.lat.toFixed(7)}, lng: ${currentLocation.lng.toFixed(7)}` : "undefined",
    )
  }, [currentLocation])

  // Handle maps loading
  const handleMapsLoaded = () => {
    setMapsLoaded(true)
    logApiUsage("Maps API loaded - Driver")
  }

  const directionsCallback = React.useCallback((response) => {
    if (response !== null && response.status === "OK") {
      logApiUsage("Directions received - Driver")
      setDirections(response)
      setDirectionsRequested(false)
    } else {
      logApiUsage(`Directions error: ${response?.status || "unknown"} - Driver`)
      setDirectionsRequested(false)
    }
  }, [])

  // Only request directions when necessary with debouncing
  useEffect(() => {
    if (!mapsLoaded || !origin || !destination) return

    // Check if we need to request new directions
    const tripStatusChanged = tripStatus !== lastTripStatus.current
    const originChanged =
      !lastOrigin.current ||
      Math.abs(origin.lat - lastOrigin.current.lat) > 0.0005 ||
      Math.abs(origin.lng - lastOrigin.current.lng) > 0.0005
    const destinationChanged =
      !lastDestination.current ||
      lastDestination.current.lat !== destination.lat ||
      lastDestination.current.lng !== destination.lng

    // Only request new directions if something significant changed
    if ((tripStatusChanged || originChanged || destinationChanged) && !directionsRequested) {
      // Clear any existing timeout
      if (directionsRequestTimeout.current) {
        clearTimeout(directionsRequestTimeout.current)
      }

      // Set a timeout to debounce the request
      directionsRequestTimeout.current = setTimeout(() => {
        logApiUsage(`Requesting directions - Driver (Status: ${tripStatus}, Origin changed: ${originChanged})`)
        lastTripStatus.current = tripStatus
        lastOrigin.current = { ...origin }
        lastDestination.current = { ...destination }
        setDirectionsRequested(true)
      }, 1000) // 1 second debounce
    }

    return () => {
      if (directionsRequestTimeout.current) {
        clearTimeout(directionsRequestTimeout.current)
      }
    }
  }, [mapsLoaded, origin, destination, tripStatus, directionsRequested])

  // Fit map to show all markers
  useEffect(() => {
    if (!mapRef.current || !mapsLoaded || !window.google) return

    const bounds = new window.google.maps.LatLngBounds()

    if (pickupLocation) {
      bounds.extend(new window.google.maps.LatLng(pickupLocation.lat, pickupLocation.lng))
    }

    if (dropoffLocation) {
      bounds.extend(new window.google.maps.LatLng(dropoffLocation.lat, dropoffLocation.lng))
    }

    if (currentLocation) {
      bounds.extend(new window.google.maps.LatLng(currentLocation.lat, currentLocation.lng))
    }

    // Only update bounds if they've changed significantly
    if (!mapBounds || !boundsEqual(bounds, mapBounds)) {
      setMapBounds(bounds)

      // Add padding to the bounds
      const map = mapRef.current
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 })

      // Set a stable zoom level
      const zoomChangeBoundsListener = window.google.maps.event.addListenerOnce(map, "bounds_changed", () => {
        if (map.getZoom() > 15) {
          map.setZoom(15)
        }
      })

      return () => {
        window.google.maps.event.removeListener(zoomChangeBoundsListener)
      }
    }
  }, [mapsLoaded, currentLocation, pickupLocation, dropoffLocation, mapBounds])

  // Helper function to compare bounds
  const boundsEqual = (bounds1, bounds2) => {
    if (!bounds1 || !bounds2) return false

    const ne1 = bounds1.getNorthEast()
    const sw1 = bounds1.getSouthWest()
    const ne2 = bounds2.getNorthEast()
    const sw2 = bounds2.getSouthWest()

    return (
      Math.abs(ne1.lat() - ne2.lat()) < 0.0001 &&
      Math.abs(ne1.lng() - ne2.lng()) < 0.0001 &&
      Math.abs(sw1.lat() - sw2.lat()) < 0.0001 &&
      Math.abs(sw1.lng() - sw2.lng()) < 0.0001
    )
  }

  // Handle map load
  const handleMapLoad = (map) => {
    mapRef.current = map
    logApiUsage("Map rendered - Driver")
  }

  console.log("Driver Map Rendering with:", {
    currentLocation: currentLocation
      ? `lat: ${currentLocation.lat.toFixed(7)}, lng: ${currentLocation.lng.toFixed(7)}`
      : "undefined",
    pickupLocation: pickupLocation
      ? `lat: ${pickupLocation.lat.toFixed(7)}, lng: ${pickupLocation.lng.toFixed(7)}`
      : "undefined",
    dropoffLocation: dropoffLocation
      ? `lat: ${dropoffLocation.lat.toFixed(7)}, lng: ${dropoffLocation.lng.toFixed(7)}`
      : "undefined",
    tripStatus,
  })

  return (
    <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY} onLoad={handleMapsLoaded}>
      <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={14} onLoad={handleMapLoad}>
        {mapsLoaded && (
          <>
            {/* Current location */}
            {currentLocation &&
              renderAdvancedMarker({
                position: currentLocation,
                title: "YOU",
                color: "blue",
                size: 50,
                onClick: () => setSelectedMarker("current"),
              })}

            {/* Pickup location - Always show */}
            {pickupLocation &&
              renderAdvancedMarker({
                position: pickupLocation,
                title: "PICKUP",
                color: "green",
                size: 40,
                onClick: () => setSelectedMarker("pickup"),
              })}

            {/* Dropoff location - Always show */}
            {dropoffLocation &&
              renderAdvancedMarker({
                position: dropoffLocation,
                title: "DROPOFF",
                color: "red",
                size: 40,
                onClick: () => setSelectedMarker("dropoff"),
              })}

            {/* Info windows for markers */}
            {selectedMarker === "current" && currentLocation && (
              <InfoWindow position={currentLocation} onCloseClick={() => setSelectedMarker(null)}>
                <div>
                  <h3>Your Location</h3>
                  <p>Current position</p>
                </div>
              </InfoWindow>
            )}

            {selectedMarker === "pickup" && (
              <InfoWindow position={pickupLocation} onCloseClick={() => setSelectedMarker(null)}>
                <div>
                  <h3>Pickup Location</h3>
                  <p>{pickupLocation.address}</p>
                </div>
              </InfoWindow>
            )}

            {selectedMarker === "dropoff" && (
              <InfoWindow position={dropoffLocation} onCloseClick={() => setSelectedMarker(null)}>
                <div>
                  <h3>Dropoff Location</h3>
                  <p>{dropoffLocation.address}</p>
                </div>
              </InfoWindow>
            )}

            {/* Directions */}
            {origin && destination && tripStatus !== "waiting" && tripStatus !== "completed" && directionsRequested && (
              <DirectionsService
                options={{
                  origin: origin,
                  destination: destination,
                  travelMode: "DRIVING",
                }}
                callback={directionsCallback}
              />
            )}

            {directions && (
              <DirectionsRenderer
                options={{
                  directions: directions,
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor: "#4285F4",
                    strokeWeight: 5,
                    strokeOpacity: 0.8,
                  },
                }}
              />
            )}
          </>
        )}
      </GoogleMap>
    </LoadScript>
  )
}

export default DriverMap

