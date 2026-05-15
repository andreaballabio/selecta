import logging
import sys
from typing import Optional

def setup_logging(level: int = logging.INFO) -> logging.Logger:
    """Setup structured logging."""
    
    logger = logging.getLogger("selecta_worker")
    logger.setLevel(level)
    
    # Remove existing handlers
    logger.handlers = []
    
    # Console handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    
    # Format
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    handler.setFormatter(formatter)
    
    logger.addHandler(handler)
    
    return logger

logger = setup_logging()
