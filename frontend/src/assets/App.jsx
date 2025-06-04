import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

const BACKEND_URL = "http://localhost:5000";
const WEBSOCKET_URL = "wss://3bs69l0z-5000.inc1.devtunnels.ms/ws";

const Borrower = ({ borrowers }) => {
  const { phone } = useParams();
  const navigate = useNavigate();
  const borrower = borrowers.find((b) => Int(b.Mobile_No) === phone) || {};
  const [campaignStatus, setCampaignStatus] = useState("Not Started");
  const [callStatus, setCallStatus] = useState("Not Initiated");
  const [voiceMessages, setVoiceMessages] = useState([]);
  const [debugInfo, setDebugInfo] = useState("");
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const websocket = new WebSocket(WEBSOCKET_URL);
    setWs(websocket);

    websocket.onopen = () => {
      console.log("WebSocket connected");
      setDebugInfo("WebSocket connected");
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("WebSocket message received:", data);
      const { event: eventType, data: eventData } = data;

      if (eventType === "call_status" && eventData.phone === phone) {
        setCallStatus(eventData.status);
        setDebugInfo(`Call status: ${eventData.status}`);
      }

      if (eventType === "conversation_update" && eventData.phone === phone && eventData.sender && eventData.text) {
        console.log(`Adding voice message: sender=${eventData.sender}, text=${eventData.text}`);
        setVoiceMessages((prev) => [
          ...prev,
          {
            sender: eventData.sender,
            text: eventData.text,
            time: new Date().toLocaleTimeString(),
          },
        ]);
      }

      if (eventType === "campaign_status" && eventData.phone === phone) {
        setCampaignStatus(eventData.status);
        setDebugInfo(`Campaign status: ${eventData.status}`);
      }
    };

    websocket.onerror = (err) => {
      console.error("WebSocket error:", err);
      setDebugInfo(`WebSocket error: ${err}`);
    };

    websocket.onclose = () => {
      console.log("WebSocket closed");
      setDebugInfo("WebSocket closed");
    };

    return () => {
      websocket.close();
    };
  }, [phone]);

  const startCampaign = () => {
    if (!borrower.Mobile_No || !ws) return;
    setCampaignStatus("Running");
    ws.send(JSON.stringify({ event: "start_campaign", data: { borrowers: [borrower] } }));
    setDebugInfo("Campaign started");
  };

  if (!borrower.Mobile_No) {
    return (
      <div className="min-h-screen p-6 bg-gray-100 font-sans">
        <header className="bg-white p-6 rounded-lg shadow-md mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-600">Borrower Not Found</h1>
          <button
            onClick={() => navigate("/")}
            className="text-blue-500 hover:underline text-lg"
          >
            Back to List
          </button>
        </header>
        <p className="text-gray-500 text-center">No borrower found for phone: {phone}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gray-100 font-sans">
      <header className="bg-white p-6 rounded-lg shadow-md mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-blue-600">
            {borrower.F_Name} {borrower.L_Name}
          </h1>
          <p className="text-sm text-gray-500">Borrower Details & Communication</p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="text-blue-500 hover:underline text-lg"
        >
          Back to List
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h3 className="text-lg font-semibold text-blue-600 mb-4">Details</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Phone:</strong> {borrower.Mobile_No}</p>
              <p><strong>Channel:</strong> {borrower.Channel_Preference || "N/A"}</p>
              <p><strong>Balance:</strong> Rs. {borrower.Current_balance || "N/A"}</p>
              <p><strong>Due Date:</strong> {borrower.Date_of_last_payment || "N/A"}</p>
            </div>
            <button
              onClick={startCampaign}
              className="mt-4 w-full py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              disabled={callStatus === "In Progress" || callStatus === "Initiated"}
            >
              Start Campaign
            </button>
            <p className="mt-2 text-sm text-gray-500">Campaign Status: {campaignStatus}</p>
            <p className="mt-2 text-sm text-gray-500">Call Status: {callStatus}</p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h3 className="text-lg font-semibold text-blue-600 mb-4">Voice Conversation</h3>
            <div className="max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg">
              {voiceMessages.length > 0 ? (
                voiceMessages.map((msg, index) => (
                  <div
                    key={`voice-${index}`}
                    className={`mb-4 flex ${
                      msg.sender === "User" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs p-3 rounded-lg shadow-sm ${
                        msg.sender === "User"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      <p className="text-sm font-semibold">{msg.sender}</p>
                      <p>{msg.text}</p>
                      <p className="text-xs mt-1 opacity-70">{msg.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No voice messages yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-blue-600 mb-2">Debug Info</h3>
        <p className="text-sm text-gray-500">{debugInfo}</p>
      </div>
    </div>
  );
};

export default Borrower;
// This code is a React component for displaying borrower details and managing communication with them.