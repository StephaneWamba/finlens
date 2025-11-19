#!/usr/bin/env python3
"""
Agent server entry point
Uses the AgentServer instance from agent.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from agent import server
from livekit.agents import cli

if __name__ == "__main__":
    cli.run_app(server)
