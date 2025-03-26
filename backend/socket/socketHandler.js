// Map to store active connections
const activeDrivers = new Map()
const activeCustomers = new Map()
const tripSubscriptions = new Map()
// Store the latest driver locations
const driverLocations = new Map()

export const handleSocketConnections = (io, kafkaProducer) => {
  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id)

    // Driver connected
    socket.on("driverConnected", (data) => {
      console.log("Driver connected:", data.driverId, "with socket ID:", socket.id)
      activeDrivers.set(data.driverId, socket.id)

      // If driver has an active trip, join that trip's room
      if (data.tripId) {
        socket.join(`trip:${data.tripId}`)
        console.log(`Driver joined room: trip:${data.tripId}`)
      }
    })

    // Customer connected
    socket.on("customerConnected", (data) => {
      console.log("Customer connected:", data.customerId, "for trip:", data.tripId, "with socket ID:", socket.id)
      activeCustomers.set(data.customerId, socket.id)

      // Subscribe to trip updates by joining the trip's room
      if (data.tripId) {
        socket.join(`trip:${data.tripId}`)
        console.log(`Customer joined room: trip:${data.tripId}`)

        // Send the latest driver location if available
        const latestLocation = driverLocations.get(data.tripId)
        if (latestLocation) {
          console.log("Sending latest driver location to new customer:", latestLocation)
          socket.emit("driverLocationUpdate", {
            tripId: data.tripId,
            location: latestLocation,
          })
        } else {
          console.log("No driver location available for requested trip")
        }
      }
    })

    // Customer requests driver location
    socket.on("requestDriverLocation", (data) => {
      if (!data || !data.tripId) {
        console.error("Invalid request for driver location:", data)
        return
      }

      console.log("Customer requested driver location for trip:", data.tripId)

      // Send the latest stored location if available
      const latestLocation = driverLocations.get(data.tripId)
      if (latestLocation) {
        console.log("Sending requested driver location:", latestLocation)
        socket.emit("driverLocationUpdate", {
          tripId: data.tripId,
          location: latestLocation,
        })
      } else {
        console.log("No driver location available for requested trip")
      }
    })

    // Driver location update
    socket.on("driverLocationUpdate", async (data) => {
      // Validate location data
      if (!data || !data.tripId) {
        console.error("Invalid driver location update data (missing tripId):", data)
        return
      }

      if (!data.location || typeof data.location.lat !== "number" || typeof data.location.lng !== "number") {
        console.error("Invalid driver location coordinates:", data.location)
        return
      }

      console.log("Driver location update for trip:", data.tripId, data.location)

      // Store the latest location
      driverLocations.set(data.tripId, data.location)

      // Broadcast to all clients in this trip's room
      io.to(`trip:${data.tripId}`).emit("driverLocationUpdate", {
        tripId: data.tripId,
        location: data.location,
      })

      // Also send to Kafka if available
      if (kafkaProducer) {
        try {
          await kafkaProducer.sendLocationUpdate(data.tripId, data.location)
        } catch (error) {
          console.error("Error sending to Kafka:", error)
        }
      }
    })

    // Trip status update
    socket.on("tripStatusUpdate", async (data) => {
      console.log("Trip status update:", data.tripId, data.status)

      // Broadcast to all clients in this trip's room
      io.to(`trip:${data.tripId}`).emit("tripStatusUpdate", {
        tripId: data.tripId,
        status: data.status,
      })

      // Also send to Kafka if available
      if (kafkaProducer) {
        try {
          await kafkaProducer.sendTripStatusUpdate(data.tripId, data.status)
        } catch (error) {
          console.error("Error sending to Kafka:", error)
        }
      }
    })

    // Disconnect event
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id)

      // Remove from active connections
      for (const [driverId, socketId] of activeDrivers.entries()) {
        if (socketId === socket.id) {
          activeDrivers.delete(driverId)
          break
        }
      }

      for (const [customerId, socketId] of activeCustomers.entries()) {
        if (socketId === socket.id) {
          activeCustomers.delete(customerId)
          break
        }
      }
    })
  })
}

