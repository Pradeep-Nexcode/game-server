#!/bin/bash

# Configuration
DB_CONTAINER="nakama-postgres"
DB_USER="nakama"
DB_NAME="nakama"
BACKUP_DIR="./backups"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="$BACKUP_DIR/nakama_backup_$DATE.sql"

# Ensure backup directory exists
mkdir -p $BACKUP_DIR

# Perform Dump
echo "Starting backup of $DB_NAME..."
docker exec -t $DB_CONTAINER pg_dump -U $DB_USER $DB_NAME > $FILENAME

if [ $? -eq 0 ]; then
  echo "✅ Backup successful: $FILENAME"
  # Keep only last 7 days (optional)
  # find $BACKUP_DIR -name "nakama_backup_*.sql" -mtime +7 -exec rm {} \;
else
  echo "❌ Backup failed!"
  exit 1
fi
