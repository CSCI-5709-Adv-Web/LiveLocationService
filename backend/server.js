import dotenv from 'dotenv';
dotenv.config();
import express from "express"
import http from "http"
import { Server } from "socket.io"
import cors from "cors"
import { fileURLToPath } from "url"
import { dirname } from "path"
import mongoose from "mongoose"
import tripRoutes from "./routes/trips.js"
import { handleSocketConnections } from "./socket/socketHandler.js"
import { setupKafkaProducer, setupKafkaConsumer } from "./kafka/kafkaSetup.js"

// ES module fix for __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Initialize express app
const app = express()
const server = http.createServer(app)

// Get port from environment variable or use default
const PORT = process.env.PORT

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use("/api/trips", tripRoutes)

// Socket.io setup with CORS configuration
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || "*", // Use environment variable or allow all origins
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000, // Increase ping timeout
  pingInterval: 25000, // Increase ping interval
})

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err))

// Setup Kafka producer and consumer
let kafkaProducer
try {
  const useKafka = process.env.USE_KAFKA === "true"

  if (useKafka) {
    kafkaProducer = setupKafkaProducer()
    const kafkaConsumer = setupKafkaConsumer(io)
    console.log("Kafka integration initialized")
  } else {
    console.log("Kafka integration disabled")
    kafkaProducer = null
  }
} catch (error) {
  console.error("Error initializing Kafka:", error)
  kafkaProducer = null
}

// Handle socket connections
handleSocketConnections(io, kafkaProducer)

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app

