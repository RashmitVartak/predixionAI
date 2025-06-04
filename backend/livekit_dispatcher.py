import os
import json
import logging
import datetime
from typing import Optional, Dict, Any
from dotenv import load_dotenv
load_dotenv()

from livekit import api
from livekit.api import CreateRoomRequest
from flask_socketio import SocketIO

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LiveKitDispatcher:
    def __init__(self, socketio: SocketIO = None):
        self.LIVEKIT_URL = os.getenv("LIVEKIT_URL")
        self.LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
        self.LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
        self.socketio = socketio
        
        if not all([self.LIVEKIT_URL, self.LIVEKIT_API_KEY, self.LIVEKIT_API_SECRET]):
            raise ValueError("Missing LiveKit environment variables")

    async def dispatch_call(self, phone_no: str, user_info: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Dispatch a call to the specified phone number with user info"""
        lkapi = None
        try:
            # Validate phone number
            if not isinstance(phone_no, str) or not phone_no.isdigit() or len(phone_no) != 10:
                raise ValueError("Invalid phone number format - must be 10 digits")

            room_name = f"room-{phone_no}"
            formatted_phone = f"+91{phone_no}"

            # Prepare metadata (compatible with both field naming conventions)
            metadata = {
                'phone': formatted_phone,
                'first_name': user_info.get('F_Name', user_info.get('first_name', '')),
                'last_name': user_info.get('L_Name', user_info.get('last_name', '')),
                'balance_to_pay': user_info.get('Current_balance', user_info.get('balance_to_pay', 0)),
                'installment': user_info.get('Installment_Amount', user_info.get('installment', 0)),
                'start_date': user_info.get('start_date', ''),
                'last_date': user_info.get('Date_of_last_payment', user_info.get('last_date', '')),
                'channel_preference': user_info.get('Channel_Preference', 'voice')
            }

            self._emit_status('connecting', 'Connecting to SIP trunk', phone_no)

            # Initialize LiveKit API
            lkapi = api.LiveKitAPI(
                url=self.LIVEKIT_URL,
                api_key=self.LIVEKIT_API_KEY,
                api_secret=self.LIVEKIT_API_SECRET
            )

            # Create room
            self._emit_status('creating_room', 'Creating conversation room', phone_no)
            await lkapi.room.create_room(CreateRoomRequest(
                name=room_name,
                empty_timeout=600,
                max_participants=20,
            ))

            # Create dispatch
            self._emit_status('creating_dispatch', 'Connecting to agent', phone_no)
            dispatch = await lkapi.agent_dispatch.create_dispatch(
                api.CreateAgentDispatchRequest(
                    agent_name='Voice_Agent_Riya',
                    room=room_name,
                    metadata=json.dumps(metadata)
                )
            )

            self._emit_status('ringing', 'Call is ringing', phone_no, room_name)
            return {
                'status': 'success',
                'room_name': room_name,
                'dispatch_id': dispatch.id,
                'phone': formatted_phone,
                'metadata': metadata
            }

        except Exception as e:
            error_msg = f"Call failed: {str(e)}"
            logger.error(f"Dispatch error for {phone_no}: {error_msg}")
            self._emit_status('failed', error_msg, phone_no)
            raise
        finally:
            if lkapi:
                await lkapi.aclose()

    def _emit_status(self, status: str, message: str, phone: str, room: str = None):
        """Helper to emit status updates"""
        if self.socketio:
            self.socketio.emit('call_status', {
                'status': status,
                'message': message,
                'phone': phone,
                'room': room,
                'timestamp': datetime.datetime.now().isoformat()
            })

# Module-level instance
dispatcher = None

def init_dispatcher(socketio: SocketIO):
    global dispatcher
    dispatcher = LiveKitDispatcher(socketio)

async def dispatch_call(phone_no: str, user_info: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not dispatcher:
        raise RuntimeError("Dispatcher not initialized. Call init_dispatcher() first.")
    return await dispatcher.dispatch_call(phone_no, user_info)