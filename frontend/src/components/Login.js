"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import "../styles/Login.css"

const Login = () => {
  const [userType, setUserType] = useState("")
  const navigate = useNavigate()

  const handleLogin = (type) => {
    setUserType(type)
    navigate(`/${type.toLowerCase()}`)
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Package Delivery Tracker</h1>
        <p>Select your role to continue</p>
        <div className="button-group">
          <button className="login-button driver-button" onClick={() => handleLogin("driver")}>
            Login as Driver
          </button>
          <button className="login-button customer-button" onClick={() => handleLogin("customer")}>
            Login as Customer
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login

