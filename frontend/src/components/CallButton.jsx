import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const CallButton = ({ phone, borrower }) => {
  const [isCalling, setIsCalling] = useState(false);
  const [callStatus, setCallStatus] = useState(null);
  const [callProgress, setCallProgress] = useState('');
  const [socket, setSocket] = useState(null);

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io('http://localhost:5000', {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      pingTimeout: 60000,
      pingInterval: 25000,
      withCredentials: true,
    });

    setSocket(socketInstance);

    return () => {
      if (socketInstance) socketInstance.disconnect();
    };
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const onCallStatus = (update) => {
      setCallProgress(update.message);
      if (update.status === 'completed' || update.status === 'failed') {
        setIsCalling(false);
        setCallStatus(update.status === 'completed' ? 'success' : 'error');
      }
    };

    socket.on('call_status', onCallStatus);

    return () => {
      socket.off('call_status', onCallStatus);
    };
  }, [socket]);

  const handleCall = async () => {
    setIsCalling(true);
    setCallStatus(null);
    setCallProgress('Initializing call...');

    try {
      // Validate and format phone number
      let phoneNumber = phone.toString().trim();
      if (phoneNumber.startsWith('+91')) {
        phoneNumber = phoneNumber.substring(3);
      } else if (phoneNumber.startsWith('91')) {
        phoneNumber = phoneNumber.substring(2);
      }

      if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
        throw new Error('Please enter a valid 10-digit Indian phone number');
      }

      setCallProgress('Preparing call request...');
      const response = await fetch('http://localhost:5000/dispatch-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          phone: phoneNumber,
          user_info: {
            F_Name: borrower.F_Name,
            L_Name: borrower.L_Name,
            Current_balance: borrower.Current_balance,
            Date_of_last_payment: borrower.Date_of_last_payment,
            Installment_Amount: borrower.Installment_Amount,
            Channel_Preference: borrower.Channel_Preference || 'voice'
          }
        }),
      });

      setCallProgress('Processing response...');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Call initiation failed');
      }

      const data = await response.json();
      setCallProgress('Call initiated - waiting for connection...');
      
      // The socket.io listener will handle further updates
      return data;

    } catch (error) {
      console.error('Call error:', error);
      setCallStatus('error');
      setCallProgress(`Error: ${error.message}`);
      setIsCalling(false);
      throw error;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleCall}
        disabled={isCalling}
        className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
          isCalling ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
        } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
      >
        {isCalling ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Calling...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="-ml-0.5 mr-2 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
            Call Now
          </>
        )}
      </button>
      
      {callProgress && (
        <div className="status-message">
          {callProgress}
        </div>
      )}
      
      {callStatus === 'success' && (
        <div className="status-success">
          Call connected successfully!
        </div>
      )}
      
      {callStatus === 'error' && (
        <div className="status-error">
          Call failed - please try again
        </div>
      )}
    </div>
  );
};

export default CallButton;