@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto node_missing

node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit((major === 20 && minor >= 19) || (major >= 22 && (major > 22 || minor >= 12)) ? 0 : 1)"
if errorlevel 1 goto node_version_unsupported

where npm >nul 2>nul
if errorlevel 1 goto npm_missing

if not exist "node_modules\vite\bin\vite.js" (
    echo 初回起動の準備をしています。依存関係をインストールします...
    call npm ci
    if errorlevel 1 goto install_failed
)

echo シミュレーターを起動しています。ブラウザーが開くまでお待ちください。
call npm run dev -- --host 127.0.0.1 --open
if errorlevel 1 (
    echo.
    echo 起動に失敗しました。上のエラーメッセージを確認してください。
    pause
)
exit /b

:node_missing
echo Node.js が見つかりません。対応バージョンをインストールしてから再実行してください。
echo https://nodejs.org/
pause
exit /b 1

:node_version_unsupported
echo Node.js のバージョンに対応していません。20.19 以降の20系、または22.12以降を使用してください。
pause
exit /b 1

:npm_missing
echo npm が見つかりません。Node.js をインストールし直してから再実行してください。
pause
exit /b 1

:install_failed
echo 依存関係のインストールに失敗しました。ネットワーク接続を確認してください。
pause
exit /b 1
