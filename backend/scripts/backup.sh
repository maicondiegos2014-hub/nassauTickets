#!/usr/bin/env bash
# RNF-12: backup diário consistente do banco (agende no cron às 17h30, após o expediente):
#   30 17 * * * /opt/nassauTickets/backend/scripts/backup.sh >> /var/log/nassau-backup.log 2>&1
# Junto com os logs binários do MySQL (--log-bin), permite restaurar até o ponto da falha:
#   1) mysql nassau_tickets < backup-AAAAMMDD.sql
#   2) mysqlbinlog --start-datetime="AAAA-MM-DD 17:30:00" mysql-bin.* | mysql nassau_tickets
set -euo pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-nassau}"
DB_NAME="${DB_NAME:-nassau_tickets}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nassautickets}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M).sql.gz"

MYSQL_PWD="${DB_PASSWORD:-}" mysqldump \
  --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
  --single-transaction --routines --triggers --source-data=2 \
  "$DB_NAME" | gzip > "$FILE"

find "$BACKUP_DIR" -name 'backup-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup gerado: $FILE"
