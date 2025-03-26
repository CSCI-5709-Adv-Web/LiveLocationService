import LocationUpdate from "../models/LocationUpdate.js"

// Process location updates from Kafka and store in database
export const processLocationUpdate = async (tripId, location, timestamp) => {
  try {
    // Create a new location update record
    const locationUpdate = new LocationUpdate({
      tripId,
      location,
      timestamp: new Date(timestamp),
    })

    // Save to database
    await locationUpdate.save()
    console.log(`Location update for trip ${tripId} saved to database`)

    return true
  } catch (error) {
    console.error("Error saving location update to database:", error)
    return false
  }
}

