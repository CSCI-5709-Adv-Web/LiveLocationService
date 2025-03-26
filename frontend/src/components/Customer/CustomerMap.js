"use client"

import React, { useState, useEffect, useRef } from "react"
import { GoogleMap, LoadScript, DirectionsService, DirectionsRenderer, InfoWindow } from "@react-google-maps/api"
import { useAdvancedMarker } from "./useAdvancedMarker"

const mapContainerStyle = {
  width: "100%",
  height: "100%",
}

// Logger for Google Maps API usage
const logApiUsage = (action) => {
  console.log(`[MAPS API] ${action} - ${new Date().toISOString()}`)
}

const CustomerMap = ({ driverLocation, pickupLocation, dropoffLocation, tripStatus }) => {
  const [directions, setDirections] = useState(null)
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const [directionsRequested, setDirectionsRequested] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [mapBounds, setMapBounds] = useState(null)
  const mapRef = useRef(null)
  const lastTripStatus = useRef(tripStatus)
  const lastDriverLocation = useRef(null)
  const lastDestination = useRef(null)
  const directionsRequestTimeout = useRef(null)
  const { renderAdvancedMarker } = useAdvancedMarker()

  // Determine which locations to show directions for based on trip status
  const origin = driverLocation
  const destination = tripStatus === "pickup" || tripStatus === "assigned" ? pickupLocation : dropoffLocation

  // Handle maps loading
  const handleMapsLoaded = () => {
    setMapsLoaded(true)
    logApiUsage("Maps API loaded - Customer")
  }

  const directionsCallback = React.useCallback((response) => {
    if (response !== null && response.status === "OK") {
      logApiUsage("Directions received - Customer")
      setDirections(response)
      setDirectionsRequested(false)
    } else {
      logApiUsage(`Directions error: ${response?.status || "unknown"} - Customer`)
      setDirectionsRequested(false)
    }
  }, [])

  // Only request directions when necessary with debouncing
  useEffect(() => {
    if (!mapsLoaded || !origin || !destination) return

    // Check if we need to request new directions
    const tripStatusChanged = tripStatus !== lastTripStatus.current
    const driverMoved =
      !lastDriverLocation.current ||
      Math.abs(origin.lat - lastDriverLocation.current.lat) > 0.001 ||
      Math.abs(origin.lng - lastDriverLocation.current.lng) > 0.001
    const destinationChanged =
      !lastDestination.current ||
      lastDestination.current.lat !== destination.lat ||
      lastDestination.current.lng !== destination.lng

    // Only request new directions if something significant changed
    if ((tripStatusChanged || driverMoved || destinationChanged) && !directionsRequested) {
      // Clear any existing timeout
      if (directionsRequestTimeout.current) {
        clearTimeout(directionsRequestTimeout.current)
      }

      // Set a timeout to debounce the request
      directionsRequestTimeout.current = setTimeout(() => {
        logApiUsage(`Requesting directions - Customer (Status: ${tripStatus}, Driver moved: ${driverMoved})`)
        lastTripStatus.current = tripStatus
        lastDriverLocation.current = { ...origin }
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

    if (driverLocation) {
      bounds.extend(new window.google.maps.LatLng(driverLocation.lat, driverLocation.lng))
    }

    if (pickupLocation) {
      bounds.extend(new window.google.maps.LatLng(pickupLocation.lat, pickupLocation.lng))
    }

    if (dropoffLocation) {
      bounds.extend(new window.google.maps.LatLng(dropoffLocation.lat, dropoffLocation.lng))
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
  }, [mapsLoaded, driverLocation, pickupLocation, dropoffLocation, mapBounds])

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
    logApiUsage("Map rendered - Customer")
  }

  console.log("Customer Map Rendering with:", {
    driverLocation: driverLocation
      ? `lat: ${driverLocation.lat.toFixed(7)}, lng: ${driverLocation.lng.toFixed(7)}`
      : "undefined",
    pickupLocation: pickupLocation
      ? `lat: ${pickupLocation.lat.toFixed(7)}, lng: ${pickupLocation.lng.toFixed(7)}`
      : "undefined",
    dropoffLocation: dropoffLocation
      ? `lat: ${dropoffLocation.lat.toFixed(7)}, lng: ${dropoffLocation.lng.toFixed(7)}`
      : "undefined",
    tripStatus,
  })

  useEffect(() => {
    console.log(
      "CustomerMap received driverLocation:",
      driverLocation ? `lat: ${driverLocation.lat.toFixed(7)}, lng: ${driverLocation.lng.toFixed(7)}` : "undefined",
    )
  }, [driverLocation])

  return (
    <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY} onLoad={handleMapsLoaded}>
      <GoogleMap mapContainerStyle={mapContainerStyle} center={driverLocation} zoom={14} onLoad={handleMapLoad}>
        {mapsLoaded && (
          <>
            {/* Driver's current location - Always show */}
            {driverLocation &&
              renderAdvancedMarker({
                position: driverLocation,
                title: "DRIVER",
                color: "blue",
                size: 50,
                animation: window.google.maps.Animation.BOUNCE,
                onClick: () => setSelectedMarker("driver"),
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
            {selectedMarker === "driver" && driverLocation && (
              <InfoWindow position={driverLocation} onCloseClick={() => setSelectedMarker(null)}>
                <div>
                  <h3>Driver Location</h3>
                  <p>Current driver position</p>
                  <p>Lat: {driverLocation.lat.toFixed(6)}</p>
                  <p>Lng: {driverLocation.lng.toFixed(6)}</p>
                </div>
              </InfoWindow>
            )}

            {selectedMarker === "pickup" && pickupLocation && (
              <InfoWindow position={pickupLocation} onCloseClick={() => setSelectedMarker(null)}>
                <div>
                  <h3>Pickup Location</h3>
                  <p>{pickupLocation.address}</p>
                </div>
              </InfoWindow>
            )}

            {selectedMarker === "dropoff" && dropoffLocation && (
              <InfoWindow position={dropoffLocation} onCloseClick={() => setSelectedMarker(null)}>
                <div>
                  <h3>Dropoff Location</h3>
                  <p>{dropoffLocation.address}</p>
                </div>
              </InfoWindow>
            )}

            {/* Directions */}
            {origin && destination && tripStatus !== "completed" && directionsRequested && (
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

export default CustomerMap

