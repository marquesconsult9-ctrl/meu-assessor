@echo off
title Meu Assessor - Sistema Financeiro
echo ===================================================
echo     INICIANDO MEU ASSESSOR - SISTEMA FINANCEIRO
echo ===================================================
echo.
echo Servidor rodando em: http://localhost:3000
echo Endpoint Webhook: http://localhost:3000/api/webhook/whatsapp
echo.
start http://localhost:3000
node server.js
pause
