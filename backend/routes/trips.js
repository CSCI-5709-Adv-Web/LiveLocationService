import express from "express"
import Trip from "../models/Trip.js"

const router = express.Router()

// Get all trips
router.get("/", async (req, res) => {
  try {
    const trips = await Trip.find()
    res.json(trips)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Get a specific trip
router.get("/:id", getTrip, (req, res) => {
  res.json(res.trip)
})

// Create a new trip
router.post("/", async (req, res) => {
  const trip = new Trip({
    driverId: req.body.driverId,
    customerId: req.body.customerId,
    pickupLocation: req.body.pickupLocation,
    dropoffLocation: req.body.dropoffLocation,
    packageDetails: req.body.packageDetails,
  })

  try {
    const newTrip = await trip.save()
    res.status(201).json(newTrip)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// Update a trip
router.patch("/:id", getTrip, async (req, res) => {
  if (req.body.status) res.trip.status = req.body.status
  if (req.body.currentLocation) res.trip.currentLocation = req.body.currentLocation

  try {
    const updatedTrip = await res.trip.save()
    res.json(updatedTrip)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// Middleware to get trip by ID
async function getTrip(req, res, next) {
  let trip
  try {
    trip = await Trip.findById(req.params.id)
    if (trip == null) {
      return res.status(404).json({ message: "Trip not found" })
    }
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }

  res.trip = trip
  next()
}

export default router

