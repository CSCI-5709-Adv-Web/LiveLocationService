import { Kafka } from "kafkajs"
import { processLocationUpdate } from "./locationConsumer.js"
import dotenv from "dotenv"

// Load environment variables
dotenv.config()

// Kafka configuration from environment variables
const KAFKA_BROKERS = process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(",") : ["localhost:9092"]
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || "location-tracking-service"

// Kafka topics
const LOCATION_UPDATES_TOPIC = "driver-location-updates"
const TRIP_STATUS_TOPIC = "trip-status-updates"

// Create Kafka instance
const kafka = new Kafka({
  clientId: KAFKA_CLIENT_ID,
  brokers: KAFKA_BROKERS,
  connectionTimeout: 10000, // Increase connection timeout
  retry: {
    initialRetryTime: 300,
    retries: 10, // Increase number of retries
  },
})

// Setup Kafka producer
export const setupKafkaProducer = () => {
  const producer = kafka.producer()

  const connect = async () => {
    try {
      await producer.connect()
      console.log("Kafka producer connected successfully")

      // Create topics if they don't exist
      const admin = kafka.admin()
      await admin.connect()

      const existingTopics = await admin.listTopics()
      const topicsToCreate = []

      if (!existingTopics.includes(LOCATION_UPDATES_TOPIC)) {
        topicsToCreate.push({
          topic: LOCATION_UPDATES_TOPIC,
          numPartitions: 3,
          replicationFactor: 1,
        })
      }

      if (!existingTopics.includes(TRIP_STATUS_TOPIC)) {
        topicsToCreate.push({
          topic: TRIP_STATUS_TOPIC,
          numPartitions: 3,
          replicationFactor: 1,
        })
      }

      if (topicsToCreate.length > 0) {
        await admin.createTopics({
          topics: topicsToCreate,
          waitForLeaders: true,
        })
        console.log("Kafka topics created successfully")
      }

      await admin.disconnect()
    } catch (error) {
      console.error("Failed to connect Kafka producer:", error)
      // Retry connection after delay
      setTimeout(connect, 5000)
    }
  }

  // Connect immediately
  connect()

  // Function to send location updates to Kafka
  const sendLocationUpdate = async (tripId, location) => {
    try {
      if (!producer || !producer.isConnected) {
        console.warn("Kafka producer not connected, reconnecting...")
        await connect()
      }

      await producer.send({
        topic: LOCATION_UPDATES_TOPIC,
        messages: [
          {
            key: tripId,
            value: JSON.stringify({
              tripId,
              location,
              timestamp: Date.now(),
            }),
          },
        ],
      })
      console.log(`Location update for trip ${tripId} sent to Kafka`)
      return true
    } catch (error) {
      console.error("Error sending location update to Kafka:", error)
      return false
    }
  }

  // Function to send trip status updates to Kafka
  const sendTripStatusUpdate = async (tripId, status) => {
    try {
      if (!producer || !producer.isConnected) {
        console.warn("Kafka producer not connected, reconnecting...")
        await connect()
      }

      await producer.send({
        topic: TRIP_STATUS_TOPIC,
        messages: [
          {
            key: tripId,
            value: JSON.stringify({
              tripId,
              status,
              timestamp: Date.now(),
            }),
          },
        ],
      })
      console.log(`Status update for trip ${tripId} sent to Kafka`)
      return true
    } catch (error) {
      console.error("Error sending status update to Kafka:", error)
      return false
    }
  }

  return {
    sendLocationUpdate,
    sendTripStatusUpdate,
    isConnected: () => producer && producer.isConnected,
  }
}

// Setup Kafka consumer
export const setupKafkaConsumer = (io) => {
  const consumer = kafka.consumer({ groupId: "location-tracking-group" })

  const connect = async () => {
    try {
      await consumer.connect()
      console.log("Kafka consumer connected successfully")

      // Subscribe to topics
      await consumer.subscribe({ topics: [LOCATION_UPDATES_TOPIC, TRIP_STATUS_TOPIC], fromBeginning: false })

      // Start consuming messages
      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const messageValue = JSON.parse(message.value.toString())

            if (topic === LOCATION_UPDATES_TOPIC) {
              const { tripId, location, timestamp } = messageValue
              console.log(`Received location update for trip ${tripId} from Kafka:`, location)

              // Store the location update in the database
              await processLocationUpdate(tripId, location, timestamp)

              // Forward to all clients subscribed to this trip via Socket.io
              if (io) {
                io.to(`trip:${tripId}`).emit("driverLocationUpdate", {
                  tripId,
                  location,
                  timestamp,
                  source: "kafka", // Add source for debugging
                })
              }
            } else if (topic === TRIP_STATUS_TOPIC) {
              const { tripId, status, timestamp } = messageValue
              console.log(`Received status update for trip ${tripId} from Kafka:`, status)

              // Forward to all clients subscribed to this trip via Socket.io
              if (io) {
                io.to(`trip:${tripId}`).emit("tripStatusUpdate", {
                  tripId,
                  status,
                  timestamp,
                  source: "kafka", // Add source for debugging
                })
              }
            }
          } catch (error) {
            console.error("Error processing Kafka message:", error)
          }
        },
      })
    } catch (error) {
      console.error("Failed to connect Kafka consumer:", error)
      // Retry connection after delay
      setTimeout(connect, 5000)
    }
  }

  // Connect immediately
  connect()

  return consumer
}

