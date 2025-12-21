"""
Logging configuration
"""

import logging
import sys
from pathlib import Path
from typing import Optional
from backend.config.settings import settings


def setup_logging(
    log_level: Optional[str] = None,
    log_file: Optional[Path] = None
) -> None:
    """
    Set up logging configuration
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR). Defaults to settings.LOG_LEVEL
        log_file: Optional log file path. Defaults to settings.LOG_FILE
    """
    level = log_level or settings.LOG_LEVEL
    log_file_path = log_file or settings.LOG_FILE
    
    # Create formatter
    formatter = logging.Formatter(
        fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, level.upper()))
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # File handler (if specified)
    if log_file_path:
        log_file_path = Path(log_file_path)
        log_file_path.parent.mkdir(parents=True, exist_ok=True)
        
        file_handler = logging.FileHandler(log_file_path)
        file_handler.setLevel(logging.DEBUG)  # Always log everything to file
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    
    # Set levels for third-party libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)
    logging.getLogger("qdrant_client").setLevel(logging.WARNING)


# Initialize logging on import
setup_logging()

