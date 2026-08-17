@echo off
title Push Sewing Readiness Tracker to GitHub
echo ===================================================
echo Pushing all project code to https://github.com/Lahi070/Sewing-Plan-Visualizer-0.01
echo ===================================================

set "PATH=%LOCALAPPDATA%\git\cmd;%LOCALAPPDATA%\nodejs;%PATH%"
cd /d "c:\Users\LahiruDIss\OneDrive - MAS Holdings (Pvt) Ltd\Documents\project data 0.1"

echo Uploading project files...
git push -u origin main --force

echo.
echo ===================================================
echo All files uploaded successfully!
echo Check your GitHub repository in your browser:
echo https://github.com/Lahi070/Sewing-Plan-Visualizer-0.01
echo ===================================================
pause
