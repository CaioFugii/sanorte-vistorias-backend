#!/bin/bash
# Script de release para Heroku
# Executa migrations após o deploy

echo "Running migrations..."
npm run migration:run

echo "Release completed!"
