cd /app/backend
nohup python3 -m uvicorn main:app --host 127.0.0.1 --port 8001 > /tmp/uvicorn.log 2>&1 &
echo "started pid=$!"