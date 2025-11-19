"""Logging utilities for the voice agent service"""

import logging
import os
import sys
from typing import Optional

def setup_logger(name: str, level: Optional[str] = None) -> logging.Logger:
    """Set up a logger with consistent formatting"""
    logger = logging.getLogger(name)
    
    if level is None:
        level = os.getenv("LOG_LEVEL", "INFO")
    
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    
    # Create console handler if not already exists
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.DEBUG)
        
        # Create formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        
        logger.addHandler(handler)
    
    return logger

