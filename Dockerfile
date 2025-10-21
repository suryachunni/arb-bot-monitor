FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY weth_price_monitor.py .
COPY .env .

# Run the monitor
CMD ["python3", "-u", "weth_price_monitor.py"]
