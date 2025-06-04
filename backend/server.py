from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from dotenv import load_dotenv
import os
import asyncio
import json
from livekit import api
from livekit.api import CreateRoomRequest
from typing import List, Dict
import uvicorn
import httpx
from pydantic import BaseModel
import sys
sys.path.append("..")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
load_dotenv()

LIVEKIT_URL = os.getenv('LIVEKIT_URL')
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

# In-memory storage for borrowers
borrowers_data: List[Dict] = []

# WebSocket connections
connected_websockets: List[WebSocket] = []

@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        return {"error": "Invalid file format"}, 400
    global borrowers_data
    df = pd.read_csv(file.file)
    borrowers_data = df.to_dict(orient="records")
    # Broadcast to all connected WebSocket clients
    for ws in connected_websockets:
        await ws.send_json({"event": "borrowers_update", "data": {"borrowers": borrowers_data}})
    print("CSV uploaded, broadcasting borrowers:", len(borrowers_data))  # Debug
    return {"borrowers": borrowers_data}

async def create_explicit_dispatch(phone: str, metadata: Dict):
    print(f"Creating dispatch for phone: {phone}")  # Debug
    lkapi = api.LiveKitAPI(
        url=LIVEKIT_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET
    )
    room_name = f"room-{phone}"
    try:
        room = await lkapi.room.create_room(CreateRoomRequest(
            name=room_name,
            empty_timeout=10 * 60,
            max_participants=20,
        ))
        print(f"Room created: {room_name}")  # Debug
        dispatch = await lkapi.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name='Voice_Agent_Riya',
                room=room_name,
                metadata=json.dumps(metadata)
            )
        )
        print(f"Dispatch created: {dispatch}")  # Debug
        # Broadcast call status
        for ws in connected_websockets:
            await ws.send_json({"event": "call_status", "data": {"phone": str(phone), "status": "Initiated"}})
            await ws.send_json({"event": "campaign_status", "data": {"phone": str(phone), "status": "Running"}})
    except Exception as e:
        print(f"Dispatch failed: {str(e)}")  # Debug
        for ws in connected_websockets:
            await ws.send_json({"event": "call_status", "data": {"phone": str(phone), "status": f"Failed: {str(e)}"}})
            await ws.send_json({"event": "campaign_status", "data": {"phone": str(phone), "status": "Failed"}})
    finally:
        await lkapi.aclose()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_websockets.append(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            print(f"Received WebSocket message: {data}")  # Debug
            event = data.get("event")
            if event == "start_campaign":
                borrower = data.get("data", {}).get("borrowers", [{}])[0]
                phone = str(borrower.get("Mobile_No"))
                channel_preference = borrower.get("Channel_Preference")
                print(f"Phone: {phone}, Channel: {channel_preference}")  # Debug

                if not phone or not channel_preference:
                    await websocket.send_json({"event": "campaign_status", "data": {"phone": phone, "status": "Failed: Missing data"}})
                    continue

                if channel_preference.lower() == "voice":
                    metadata = {
                        'phone': f"+91{phone}",
                        'first_name': borrower.get("F_Name", ""),
                        'last_name': borrower.get("L_Name", ""),
                        'balance_to_pay': borrower.get("Current_balance", 0),
                        'start_date': borrower.get("Disbursal_Date", ""),
                        'last_date': borrower.get("Date_of_last_payment", ""),
                        'installment': borrower.get("Installment_Amount", 0)
                    }
                    print(f"Dispatching call with metadata: {metadata}")  # Debug
                    await create_explicit_dispatch(phone, metadata)
                else:
                    await websocket.send_json({"event": "campaign_status", "data": {"phone": phone, "status": "Failed: Channel not voice"}})
            elif event in ["call_status", "conversation_update"]:
                # Broadcast to all connected clients
                for ws in connected_websockets:
                    await ws.send_json(data)
    except WebSocketDisconnect:
        connected_websockets.remove(websocket)
    except Exception as e:
        print(f"WebSocket error: {str(e)}")
        connected_websockets.remove(websocket)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)

