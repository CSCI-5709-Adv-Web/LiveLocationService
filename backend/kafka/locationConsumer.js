import LocationUpdate from "../models/LocationUpdate.js"
import Trip from "../models/Trip.js"

// Process location updates from Kafka and store in database
export const processLocationUpdate = async (tripId, location, timestamp) => {
  try {
    console.log(`Processing location update for trip ${tripId}:`, location)

    // Create a new location update record
    const locationUpdate = new LocationUpdate({
      tripId,
      location,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    })

    // Save to database
    try {
      await locationUpdate.save()
      console.log(`Location update for trip ${tripId} saved to database`)
    } catch (error) {
      console.error("Error saving location update to database:", error)
      // Continue execution even if saving to LocationUpdate fails
      // This allows us to still update the trip's current location
    }

    // Also update the current location in the trip document
    try {
      // Use findOneAndUpdate with a query that doesn't rely on the _id
      const updatedTrip = await Trip.findOneAndUpdate(
        { id: tripId }, // Query by the trip ID field, not MongoDB's _id
        {
          currentLocation: location,
          updatedAt: new Date(),
        },
        {
          new: true,
          upsert: false, // Don't create if it doesn't exist
        },
      )

      if (updatedTrip) {
        console.log(`Updated current location for trip ${tripId}`)
      } else {
        console.log(`Trip ${tripId} not found, couldn't update location`)
      }
    } catch (tripError) {
      console.error("Error updating trip with current location:", tripError)
    }

    return true
  } catch (error) {
    console.error("Error in processLocationUpdate:", error)
    return false
  }
}

