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

const DriverMap = ({ currentLocation, pickupLocation, dropoffLocation, tripStatus, mockMode }) => {
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

  // Use the exact coordinates from the screenshots for Halifax locations
  const fixedPickupLocation = pickupLocation
    ? {
        ...pickupLocation,
        lat: 44.6430,
        lng: -63.5793,
      }
    : null

  const fixedDropoffLocation = dropoffLocation
    ? {
        ...dropoffLocation,
        lat: 44.6418,
        lng: -63.5784,
      }
    : null

  // Determine which locations to show directions for based on trip status
  const origin = currentLocation
  const destination = tripStatus === "pickup" ? fixedPickupLocation : fixedDropoffLocation

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

    if (fixedPickupLocation) {
      bounds.extend(new window.google.maps.LatLng(fixedPickupLocation.lat, fixedPickupLocation.lng))
    }

    if (fixedDropoffLocation) {
      bounds.extend(new window.google.maps.LatLng(fixedDropoffLocation.lat, fixedDropoffLocation.lng))
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
  }, [mapsLoaded, currentLocation, fixedPickupLocation, fixedDropoffLocation, mapBounds])

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
    pickupLocation: fixedPickupLocation
      ? `lat: ${fixedPickupLocation.lat.toFixed(7)}, lng: ${fixedPickupLocation.lng.toFixed(7)}`
      : "undefined",
    dropoffLocation: fixedDropoffLocation
      ? `lat: ${fixedDropoffLocation.lat.toFixed(7)}, lng: ${fixedDropoffLocation.lng.toFixed(7)}`
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
            {fixedPickupLocation &&
              renderAdvancedMarker({
                position: fixedPickupLocation,
                title: "PICKUP",
                color: "green",
                size: 40,
                onClick: () => setSelectedMarker("pickup"),
              })}

            {/* Dropoff location - Always show */}
            {fixedDropoffLocation &&
              renderAdvancedMarker({
                position: fixedDropoffLocation,
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

            {selectedMarker === "pickup" && fixedPickupLocation && (
              <InfoWindow position={fixedPickupLocation} onCloseClick={() => setSelectedMarker(null)}>
                <div>
                  <h3>Pickup Location</h3>
                  <p>{fixedPickupLocation.address}</p>
                </div>
              </InfoWindow>
            )}

            {selectedMarker === "dropoff" && fixedDropoffLocation && (
              <InfoWindow position={fixedDropoffLocation} onCloseClick={() => setSelectedMarker(null)}>
                <div>
                  <h3>Dropoff Location</h3>
                  <p>{fixedDropoffLocation.address}</p>
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
                  optimizeWaypoints: true,
                  provideRouteAlternatives: false,
                  avoidHighways: false,
                  avoidTolls: false,
                  // Request the shortest path instead of fastest
                  drivingOptions: {
                    departureTime: new Date(),
                    trafficModel: "bestguess",
                  },
                  // This is the key setting for shortest path
                  optimizeWaypoints: true,
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
                  // Show the shortest route if multiple routes are returned
                  routeIndex: 0,
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

