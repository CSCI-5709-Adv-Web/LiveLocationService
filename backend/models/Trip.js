import mongoose from "mongoose"

const locationSchema = new mongoose.Schema({
  lat: {
    type: Number,
    required: true,
  },
  lng: {
    type: Number,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
})

const tripSchema = new mongoose.Schema({
  driverId: {
    type: String,
    required: true,
  },
  customerId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["assigned", "pickup", "delivering", "completed"],
    default: "assigned",
  },
  pickupLocation: {
    type: locationSchema,
    required: true,
  },
  dropoffLocation: {
    type: locationSchema,
    required: true,
  },
  currentLocation: {
    type: locationSchema,
  },
  packageDetails: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

// Update the updatedAt timestamp before saving
tripSchema.pre("save", function (next) {
  this.updatedAt = Date.now()
  next()
})

const Trip = mongoose.model("Trip", tripSchema)

export default Trip

