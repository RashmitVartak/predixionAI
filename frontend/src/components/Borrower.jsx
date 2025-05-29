import React from 'react';
import { useParams, Link } from 'react-router-dom';
import CallButton from './CallButton';

const Borrower = ({ borrowers }) => {
  const { phone } = useParams();
  const borrower = borrowers.find(b => b.Mobile_No === phone);

  if (!borrower) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Borrower not found</h1>
          <Link to="/" className="text-blue-600 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Link 
          to="/" 
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to list
        </Link>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Borrower Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-800">{borrower.F_Name} {borrower.L_Name}</h1>
            <p className="text-gray-600">{borrower.Mobile_No}</p>
          </div>

          {/* Details Section */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{borrower.Mobile_No}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Channel Preference</p>
                <p className="font-medium">{borrower.Channel_Preference || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Balance</p>
                <p className="font-medium">₹{borrower.balance_to_pay}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Due Date</p>
                <p className="font-medium">{borrower.last_date}</p>
              </div>
            </div>
          </div>

          {/* Campaign Section */}
          <div className="px-6 py-4 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Campaign</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium text-green-600">Running</p>
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Start Campaign
              </button>
            </div>
          </div>

          {/* Conversation Sections */}
          <div className="border-t border-gray-200">
            <div className="px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Voice Conversation</h2>
              <div className="flex items-center gap-4 mb-3">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium">No answer</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Attempts</p>
                  <p className="font-medium">2</p>
                </div>
              </div>
              <p className="text-gray-500 text-sm">No voice messages yet</p>
            </div>

            <div className="px-6 py-4 border-t border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">WhatsApp Conversation</h2>
              <div className="flex items-center gap-4 mb-3">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium">Sent</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Attempts</p>
                  <p className="font-medium">0</p>
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-800 font-medium">Hey there! I'm from Predixion AI. Is this {borrower.F_Name}?</p>
                <p className="text-xs text-gray-500 mt-1">01:38:25</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Borrower;
