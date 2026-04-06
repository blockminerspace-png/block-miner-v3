#!/bin/sh
set -e

echo "Starting support-block-miner (admin panel)..."

# Gera o Prisma client — leitura de esquema apenas, NUNCA manipula o DB
npx prisma generate --schema=server/prisma/schema.prisma || true

echo "Prisma client gerado. Iniciando servidor..."
exec "$@"
