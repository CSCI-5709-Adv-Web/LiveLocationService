"use client"

const TripDetails = ({ trip, tripStatus, onUpdateStatus }) => {
  const renderActionButton = () => {
    switch (tripStatus) {
      case "waiting":
        return null
      case "pickup":
        return (
          <button className="action-button pickup-button" onClick={() => onUpdateStatus("delivering")}>
            Confirm Pickup
          </button>
        )
      case "delivering":
        return (
          <button className="action-button delivery-button" onClick={() => onUpdateStatus("completed")}>
            Confirm Delivery
          </button>
        )
      case "completed":
        return (
          <button className="action-button completed-button" disabled>
            Delivery Completed
          </button>
        )
      default:
        return null
    }
  }

  // Remove the waiting condition to always show trip details
  return (
    <div className="trip-details">
      <h2>Trip #{trip.id}</h2>

      <div className="detail-section">
        <h3>Customer</h3>
        <p>{trip.customerName}</p>
      </div>

      <div className="detail-section">
        <h3>Package</h3>
        <p>{trip.packageDetails}</p>
      </div>

      <div className="detail-section">
        <h3>Pickup Location</h3>
        <p>{trip.pickupLocation.address}</p>
      </div>

      <div className="detail-section">
        <h3>Dropoff Location</h3>
        <p>{trip.dropoffLocation.address}</p>
      </div>

      <div className="action-section">{renderActionButton()}</div>
    </div>
  )
}

export default TripDetails

