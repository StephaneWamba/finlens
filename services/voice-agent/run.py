#!/usr/bin/env python3
"""
Convenience script to run the voice agent service
Supports running API server, agent server, or both
"""

import sys
import os
from pathlib import Path

# Add src directory to Python path
src_dir = Path(__file__).parent / "src"
sys.path.insert(0, str(src_dir))

# Import and run main
from main import *

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Syntera Voice Agent Service")
    parser.add_argument(
        "--mode",
        choices=["api", "agent", "both"],
        default="both",
        help="Run mode: 'api' (API server only), 'agent' (agent server only), or 'both' (default)"
    )
    args = parser.parse_args()
    
    # Validate configuration
    if not validate_config():
        logger.warning("Some configuration is missing. Service may not work correctly.")
        logger.warning("Please check your .env file and ensure all required variables are set.")
        if args.mode == "agent":
            logger.error("Cannot run agent server without proper configuration.")
            sys.exit(1)
        logger.warning("Continuing anyway for testing purposes...")
    
    if args.mode == "api":
        # Run only API server
        logger.info("Starting API server only...")
        run_api_server()
    elif args.mode == "agent":
        # Run only agent server
        logger.info("Starting agent server only...")
        run_agent_server()
    else:
        # Run both servers in separate threads
        logger.info("Starting both API server and agent server...")
        
        import threading
        
        # Start agent server in a separate thread
        agent_thread = threading.Thread(target=run_agent_server, daemon=True, name="AgentServer")
        agent_thread.start()
        logger.info("Agent server thread started")
        
        # Run API server in main thread
        try:
            run_api_server()
        except KeyboardInterrupt:
            logger.info("Shutting down...")
            sys.exit(0)




