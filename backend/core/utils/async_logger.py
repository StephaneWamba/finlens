"""
Async Logging Utility - Non-blocking logging for performance optimization.

Uses a background thread with a queue to handle log writes asynchronously,
preventing I/O operations from blocking the main workflow.
"""

import logging
import queue
import threading
from logging.handlers import QueueHandler, QueueListener


class AsyncLogger:
    """
    Async logger that queues log records and processes them in a background thread.

    This prevents blocking I/O operations from slowing down the main workflow.
    """

    def __init__(self, name: str, level: int = logging.INFO):
        """
        Initialize async logger.

        Args:
            name: Logger name
            level: Logging level
        """
        self.name = name
        self.level = level

        # Create queue for log records
        self.log_queue = queue.Queue(-1)  # Unlimited queue size

        # Create standard logger
        self.logger = logging.getLogger(name)
        self.logger.setLevel(level)

        # Remove existing handlers to avoid duplicates
        self.logger.handlers.clear()

        # Create queue handler (adds records to queue)
        queue_handler = QueueHandler(self.log_queue)
        queue_handler.setLevel(level)
        self.logger.addHandler(queue_handler)

        # Create standard handlers for actual output
        # Use StreamHandler for console output
        console_handler = logging.StreamHandler()
        console_handler.setLevel(level)
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        console_handler.setFormatter(formatter)

        # QueueListener processes queued records in background thread
        self.listener = QueueListener(
            self.log_queue,
            console_handler,
            respect_handler_level=True
        )

        # Start listener in background
        self.listener.start()
        self._stopped = False

    def get_logger(self) -> logging.Logger:
        """Get the underlying logger instance."""
        return self.logger

    def stop(self):
        """
        Stop the async listener (call on shutdown).
        """
        if self._stopped or not self.listener:
            return

        try:
            self._stopped = True
            # Stop the listener (this will finish processing queued records)
            # QueueListener.stop() sets a flag and waits for the thread to finish
            self.listener.stop()
        except Exception:
            # Ignore errors during shutdown (listener may already be stopped)
            # AttributeError: listener may be None
            # RuntimeError: thread may already be stopped
            pass


# Global async logger instances (singleton pattern)
_async_loggers: dict[str, AsyncLogger] = {}
_logger_lock = threading.Lock()


def get_async_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """
    Get or create an async logger instance.

    Args:
        name: Logger name
        level: Logging level

    Returns:
        Logger instance that logs asynchronously
    """
    with _logger_lock:
        if name not in _async_loggers:
            _async_loggers[name] = AsyncLogger(name, level)
        return _async_loggers[name].get_logger()


def stop_all_async_loggers():
    """Stop all async loggers (call on application shutdown)."""
    with _logger_lock:
        for logger in _async_loggers.values():
            logger.stop()
        _async_loggers.clear()
