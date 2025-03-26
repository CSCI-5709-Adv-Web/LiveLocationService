import mongoose from "mongoose"

const locationUpdateSchema = new mongoose.Schema({
  tripId: {
    type: String,
    required: true,
    index: true,
  },
  location: {
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
})

// Create index for efficient querying
locationUpdateSchema.index({ tripId: 1, timestamp: -1 })

// Add error handling for model creation
let LocationUpdate
try {
  // Check if model already exists to prevent model overwrite warnings
  LocationUpdate = mongoose.models.LocationUpdate || mongoose.model("LocationUpdate", locationUpdateSchema)
} catch (error) {
  console.error("Error creating LocationUpdate model:", error)
  // Fallback to creating the model anyway
  LocationUpdate = mongoose.model("LocationUpdate", locationUpdateSchema)
}

export default LocationUpdate

