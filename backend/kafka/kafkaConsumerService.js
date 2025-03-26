import { setupKafkaConsumer } from "./kafkaSetup.js"
import { processLocationUpdate } from "./locationConsumer.js"
import Trip from "../models/Trip.js"

// Start a dedicated Kafka consumer service
const startKafkaConsumerService = async () => {
  const io = null // No Socket.io in this service
  const consumer = setupKafkaConsumer(io)

  // Override the message handler to store in database instead of emitting to Socket.io
  consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const messageValue = JSON.parse(message.value.toString())

        if (topic === "driver-location-updates") {
          const { tripId, location, timestamp } = messageValue
          console.log(`Consumer service: Received location update for trip ${tripId}`)

          // Process and store the location update
          await processLocationUpdate(tripId, location, timestamp)

          // Update the trip's current location
          await Trip.findOneAndUpdate({ id: tripId }, { currentLocation: location, updatedAt: new Date() })
        } else if (topic === "trip-status-updates") {
          const { tripId, status, timestamp } = messageValue
          console.log(`Consumer service: Received status update for trip ${tripId}`)

          // Update the trip status
          await Trip.findOneAndUpdate({ id: tripId }, { status, updatedAt: new Date() })
        }
      } catch (error) {
        console.error("Error processing Kafka message in consumer service:", error)
      }
    },
  })

  console.log("Kafka consumer service started")
}

// This can be run as a separate process
if (require.main === module) {
  startKafkaConsumerService().catch(console.error)
}

export default startKafkaConsumerService

