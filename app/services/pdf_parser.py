"""
PDF Parser service — extracts and segments text clauses from PDF contracts
using PyMuPDF (fitz) for downstream batch classification.
"""
import re
import logging
from typing import List

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

def parse_pdf_clauses(pdf_bytes: bytes) -> List[str]:
    """
    Parse an uploaded PDF contract, segmenting it into a list of logical clauses/paragraphs.

    Parameters
    ----------
    pdf_bytes : bytes
        The raw bytes of the uploaded PDF contract.

    Returns
    -------
    List[str]
        A list of cleaned, segmented contract clauses ready for batch classification.
    """
    logger.info("Starting PDF clause extraction using PyMuPDF...")
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    raw_clauses = []
    
    for page_idx, page in enumerate(doc):
        # Extract plain text
        text = page.get_text("text")
        
        # Split page text by double newlines or paragraph breaks
        blocks = re.split(r'\n\s*\n', text)
        
        for block in blocks:
            cleaned = block.strip()
            # Basic validation: filter out short lines (like headers, footers, page numbers)
            # A valid contract clause is typically at least 15 characters and 3 words
            if len(cleaned) > 15 and len(cleaned.split()) >= 3:
                # Collapse internal newlines and excessive whitespaces
                cleaned = re.sub(r'[\r\n\t]+', ' ', cleaned)
                cleaned = re.sub(r'\s{2,}', ' ', cleaned)
                raw_clauses.append(cleaned.strip())
                
    doc.close()
    logger.info("Successfully extracted %d raw clauses from PDF.", len(raw_clauses))
    return raw_clauses
