FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set working directory
WORKDIR /workspace

# Copy dependency configs
COPY pyproject.toml uv.lock ./

# Install project dependencies.
# Uses PyTorch CPU wheel extra index URL to install CPU-only PyTorch, saving ~1.5GB of image size
RUN uv pip install --system --no-cache --index-strategy unsafe-best-match -r pyproject.toml --extra-index-url https://download.pytorch.org/whl/cpu

# Copy application source code
COPY app ./app
COPY models ./models

# Expose FastAPI port
EXPOSE 8000

# Run in unbuffered mode to ensure log output is visible in production console
ENV PYTHONUNBUFFERED=1

# Start Uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
