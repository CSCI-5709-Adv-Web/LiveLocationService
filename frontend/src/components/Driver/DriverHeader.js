"use client"

const DriverHeader = ({ title, tripStatus, mockMode, toggleMockMode }) => {
  return (
    <header className="driver-header">
      <h1>{title}</h1>
      <div className="header-actions">
        <button className={`mode-toggle ${mockMode ? "active" : ""}`} onClick={toggleMockMode}>
          Mock Mode
        </button>

        {tripStatus !== "waiting" && (
          <div className={`status-badge ${tripStatus}`}>{tripStatus.charAt(0).toUpperCase() + tripStatus.slice(1)}</div>
        )}

        {tripStatus === "waiting" && <div className="status-badge waiting">Waiting</div>}
      </div>
    </header>
  )
}

export default DriverHeader

