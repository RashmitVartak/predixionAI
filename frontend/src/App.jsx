import React, { useState, useEffect } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import Borrower from "./components/Borrower";
import CallButton from "./components/CallButton";
import './index.css';


const socket = io('http://localhost:5000', {
  transports: ['websocket'],
  withCredentials: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  extraHeaders: {
    "Access-Control-Allow-Origin": "http://localhost:3000"
  }
});

const App = () => {
  const [file, setFile] = useState(null);
  const [borrowers, setBorrowers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
      console.log("Socket connected");
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onConnectError = (err) => {
      console.error("Socket error:", err);
      setUploadError("Connection to server failed");
    };

    const onBorrowersUpdate = (data) => {
      setBorrowers(data.borrowers);
      setUploadError(null);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("borrowers_update", onBorrowersUpdate);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("borrowers_update", onBorrowersUpdate);
    };
  }, []);

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${"http://localhost:5000"}/upload-csv`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        // Improved error message formatting
        if (errorData.message && errorData.missing_columns) {
          throw new Error(`Missing columns: ${errorData.missing_columns.join(', ')}`);
        }
        throw new Error(errorData.error || "Upload failed");
      }
      
      const data = await response.json();
      setBorrowers(data.borrowers);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err.message.includes("Missing columns") ? 
        `Your CSV is missing: ${err.message.split(': ')[1]}` : 
        "Failed to process CSV. Please check the format.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="bg-white p-6 rounded-lg shadow-sm border-b-4 border-blue-500 mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Conversational AI Portal</h1>
          <p className="text-gray-600 mt-1">Efficient Borrower Communication</p>
        </header>

        {/* Upload Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Upload Borrowers</h2>
          <div className="flex items-center gap-4">
            <label className="flex-1">
              <span className="sr-only">Choose CSV file</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
            </label>
            {file && (
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-md">
                <span className="text-sm text-gray-700">{file.name}</span>
                <button 
                  onClick={() => setFile(null)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Upload Status */}
          {isUploading && (
            <div className="mt-3 text-blue-600 text-sm flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Uploading...
            </div>
          )}

          {/* Error Message */}
          {uploadError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700 font-medium">Upload Error</p>
              <p className="text-red-600 text-sm mt-1">{uploadError}</p>
              <p className="text-gray-600 text-xs mt-2">
                Required columns: Mobile_No, F_Name, L_Name, balance_to_pay, installment, last_date
              </p>
            </div>
          )}
        </div>

        {/* Borrowers Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Borrowers</h2>
            {borrowers.length > 0 && (
              <span className="text-sm text-gray-500">
                {borrowers.length} {borrowers.length === 1 ? 'borrower' : 'borrowers'}
              </span>
            )}
          </div>

          {borrowers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No borrowers loaded yet</p>
              <p className="text-gray-400 text-sm mt-1">Upload a CSV file to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {borrowers.map((borrower) => (
                    <tr key={borrower.Mobile_No} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/borrower/${borrower.Mobile_No}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {borrower.F_Name} {borrower.L_Name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {borrower.Mobile_No}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {borrower.Channel_Preference || 'Not specified'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <CallButton phone={borrower.Mobile_No} borrower={borrower} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;