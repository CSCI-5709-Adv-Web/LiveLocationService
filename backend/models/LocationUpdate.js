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

const LocationUpdate = mongoose.model("LocationUpdate", locationUpdateSchema)

export default LocationUpdate

