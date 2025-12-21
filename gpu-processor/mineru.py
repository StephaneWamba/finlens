"""MinerU PDF parsing operations."""
import os
import json
import logging
import subprocess
import time
from pathlib import Path
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


def parse_pdf(
    pdf_path: Path,
    output_dir: Path,
    backend: str,
    timeout: int
) -> List[Dict[str, Any]]:
    """Parse PDF using MinerU CLI with GPU backend."""
    logger.info(f"Running MinerU on {pdf_path.name} with backend {backend}")

    output_dir.mkdir(parents=True, exist_ok=True)

    # Build MinerU command
    cmd = ["mineru", "-p", str(pdf_path), "-o", str(output_dir)]
    if backend:
        cmd.extend(["--backend", backend])

    # Add model source if specified (for China vs global servers)
    model_source = os.getenv("MINERU_MODEL_SOURCE")
    if model_source:
        cmd.extend(["--source", model_source])

    try:
        logger.info(f"Executing: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=timeout,
            env=os.environ.copy()
        )

        # Log output
        if result.stdout:
            logger.info(f"MinerU output: {result.stdout[:1000]}")
        logger.info(f"MinerU return code: {result.returncode}")

        # According to MinerU docs: outputs are in {output_path}/{filename}/ subdirectory
        # File pattern: {filename}_content_list.json
        # Pipeline backend: {output_dir}/{filename}/auto/{filename}_content_list.json
        # VLM backend: {output_dir}/{filename}/vlm/{filename}_content_list.json or {output_dir}/{filename}/{filename}_content_list.json
        original_filename = pdf_path.stem  # filename without extension

        # Try multiple possible locations based on backend
        possible_locations = [
            # VLM backend locations
            output_dir / original_filename /
            f"{original_filename}_content_list.json",
            output_dir / original_filename / "vlm" /
            f"{original_filename}_content_list.json",
            # Pipeline backend location
            output_dir / original_filename / "auto" /
            f"{original_filename}_content_list.json",
            # Direct in output_dir (fallback)
            output_dir / f"{original_filename}_content_list.json",
        ]

        # Wait for files to be written (vLLM engine writes asynchronously after subprocess returns)
        # For larger files, wait longer. Base wait: 10s, add 1s per MB of PDF size
        pdf_size_mb = pdf_path.stat().st_size / (1024 * 1024)
        base_wait = 10
        max_wait = min(60, base_wait + int(pdf_size_mb))  # Cap at 60 seconds
        max_retries = 6  # Check 6 times
        retry_interval = max_wait / max_retries

        content_list_file = None
        for attempt in range(max_retries):
            # Check all possible locations
            for location in possible_locations:
                if location.exists():
                    content_list_file = location
                    break

            # If still not found, search recursively
            if not content_list_file:
                for pattern in [f"**/{original_filename}_content_list.json", "**/content_list.json"]:
                    matches = list(output_dir.rglob(pattern))
                    if matches:
                        content_list_file = matches[0]
                        break

            if content_list_file and content_list_file.exists():
                break

            # Wait before next attempt
            if attempt < max_retries - 1:
                logger.info(
                    f"Waiting for content_list.json (attempt {attempt + 1}/{max_retries}, PDF size: {pdf_size_mb:.1f}MB)...")
                time.sleep(retry_interval)

        if not content_list_file or not content_list_file.exists():
            # Log directory structure for debugging
            if output_dir.exists():
                logger.error(
                    f"Output directory structure: {list(output_dir.rglob('*'))}")
                filename_subdir = output_dir / original_filename
                if filename_subdir.exists():
                    logger.error(
                        f"Filename subdirectory contents: {list(filename_subdir.iterdir())}")
            else:
                logger.error(f"Output directory does not exist: {output_dir}")
            raise Exception(
                f"content_list.json not found. Expected at one of: {possible_locations}"
            )

        logger.info(f"Found content_list.json: {content_list_file}")

        # Load content list
        with open(content_list_file, 'r', encoding='utf-8') as f:
            content_list = json.load(f)

        logger.info(
            f"Loaded {len(content_list)} elements from content_list.json")
        return content_list

    except subprocess.TimeoutExpired:
        raise Exception(f"MinerU parsing timed out after {timeout} seconds")
    except Exception as e:
        logger.error(f"MinerU parsing failed: {e}", exc_info=True)
        raise
