#!/bin/bash
set -e
pnpm install --frozen-lockfile
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f lib/db/migrations/0001_reading_conversation.sql \
  -f lib/db/migrations/0002_book_mission_link.sql \
  -f lib/db/migrations/0003_weekly_missions.sql
