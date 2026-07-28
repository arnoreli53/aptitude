#!/usr/bin/env sh
cd backend || exit 1
pip install -r requirements.txt
exec uvicorn server:app --host 0.0.0.0 --port "$PORT"
