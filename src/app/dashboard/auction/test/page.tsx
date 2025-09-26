'use client'

import { useState } from 'react'

export default function TestPage() {
  const [showModal, setShowModal] = useState(false)
  
  console.log('TestPage rendered - showModal:', showModal)
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-8">Simple Test Page</h1>
      
      <button
        onClick={() => {
          console.log('Button clicked!')
          setShowModal(true)
        }}
        className="bg-blue-500 text-white px-6 py-3 rounded-lg"
      >
        Test Button
      </button>
      
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Test Modal Works!</h2>
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 bg-gray-500 text-white rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
