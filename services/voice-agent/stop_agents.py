#!/usr/bin/env python3
"""
Script to stop all deployed agents

This script:
1. Stops all Python agent server processes
2. Optionally disconnects agents from LiveKit rooms via API
"""

import sys
import os
from pathlib import Path

# Add src directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "src"))

def stop_agent_processes():
    """Stop all Python agent server processes"""
    import subprocess
    import platform
    
    print("Stopping agent server processes...")
    
    if platform.system() == "Windows":
        # Windows: Find and kill Python processes running agent server
        try:
            result = subprocess.run(
                ["powershell", "-Command", 
                 "Get-Process python -ErrorAction SilentlyContinue | "
                 "Where-Object { $_.Path -like '*Python*' } | "
                 "Stop-Process -Force"],
                capture_output=True,
                text=True
            )
            print("[OK] Stopped Python agent processes")
        except Exception as e:
            print(f"[WARN] Could not stop processes: {e}")
    else:
        # Unix/Linux/Mac
        try:
            subprocess.run(["pkill", "-f", "agent_server.py"], check=False)
            subprocess.run(["pkill", "-f", "main.py.*mode.*agent"], check=False)
            print("[OK] Stopped Python agent processes")
        except Exception as e:
            print(f"[WARN] Could not stop processes: {e}")

async def disconnect_agents_from_rooms():
    """Disconnect all agents from LiveKit rooms using API"""
    try:
        from config import settings
        from livekit import api
        
        print("Disconnecting agents from LiveKit rooms...")
        
        # Initialize LiveKit API client
        lk_api = api.LiveKitAPI(
            url=settings.livekit_url,
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret,
        )
        
        # List all rooms
        rooms = await lk_api.room.list_rooms()
        
        agent_count = 0
        for room in rooms.rooms:
            # List participants in each room
            participants = await lk_api.room.list_participants(room.name)
            
            for participant in participants.participants:
                # Check if participant is an agent (identity starts with "agent:")
                if participant.identity.startswith("agent:"):
                    try:
                        # Remove participant from room
                        await lk_api.room.remove_participant(
                            api.RoomParticipantIdentity(
                                room=room.name,
                                identity=participant.identity,
                            )
                        )
                        print(f"[OK] Disconnected agent {participant.identity} from room {room.name}")
                        agent_count += 1
                    except Exception as e:
                        print(f"[WARN] Could not disconnect {participant.identity}: {e}")
        
        print(f"[OK] Disconnected {agent_count} agents from rooms")
        
    except Exception as e:
        print(f"[WARN] Could not disconnect agents via API: {e}")
        print("This is OK - agents will disconnect when processes stop")

def main():
    """Main function"""
    print("=" * 60)
    print("Stopping All Deployed Agents")
    print("=" * 60)
    print()
    
    # Stop agent processes
    stop_agent_processes()
    
    # Try to disconnect agents from rooms (optional)
    try:
        import asyncio
        asyncio.run(disconnect_agents_from_rooms())
    except Exception as e:
        print(f"[INFO] Skipping API disconnection: {e}")
    
    print()
    print("=" * 60)
    print("[SUCCESS] All agents stopped")
    print("=" * 60)

if __name__ == "__main__":
    main()

