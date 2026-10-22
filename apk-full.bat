@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo    Threadbook APK 打包
echo ============================================
echo.

:: 检查 Node.js
where node >nul 2>nul || ( echo [X] 未找到 Node.js & pause & exit /b 1 )

:: 检查 Git
where git >nul 2>nul || ( echo [X] 未找到 Git & pause & exit /b 1 )

:: Git 保存
echo [1/5] Git 保存...
for /f "tokens=2 delims==" %%x in ('wmic os get localdatetime /value ^| findstr "="') do set DT=%%x
set GIT_TAG=%DT:~0,8%-%DT:~8,4%
git add -A
git commit -m "APK build %GIT_TAG%"
if %errorlevel% neq 0 (
    echo     (无变更或 git 提交警告，继续...)
)

:: 写入构建信息（供设置页显示）
for /f "tokens=*" %%h in ('git rev-parse --short HEAD') do set GIT_HASH=%%h
for /f "tokens=*" %%d in ('git log -1 --format^=%%cd --date^=format:"%%Y-%%m-%%d %%H:%%M"') do set GIT_DATE=%%d
for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD') do set GIT_BRANCH=%%b
(
echo {
echo   "commit": "%GIT_HASH%",
echo   "date": "%GIT_DATE%",
echo   "branch": "%GIT_BRANCH%"
echo }
) > public\build-info.json
echo     提交: %GIT_HASH% (%GIT_DATE%)
echo.

:: 依赖
if not exist "node_modules" (
    echo [2/5] 安装依赖...
    call npm install
)
echo [2/5] npm 就绪

:: 构建 Web
echo [3/5] 构建网页...
call npm run build
if %errorlevel% neq 0 ( pause & exit /b 1 )

:: 同步到安卓
echo [4/5] 同步到安卓...
call npx cap sync android
if %errorlevel% neq 0 ( pause & exit /b 1 )

:: 检测 Java (Android Studio 自带 JBR)
set JAVA_FOUND=0
if exist "D:\Android Studio\jbr\bin\java.exe" (
    set JAVA_HOME=D:\Android Studio\jbr
    set JAVA_FOUND=1
)
if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
    set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
    set JAVA_FOUND=1
)
if %JAVA_FOUND%==0 (
    echo [X] 未找到 Java，请安装 Android Studio
    echo    或手动设置 JAVA_HOME 环境变量
    pause & exit /b 1
)
echo        Java: %JAVA_HOME%

:: 检测 Android SDK (从 local.properties 读取)
set SDK_FOUND=0
if exist "android\local.properties" (
    for /f "tokens=2 delims==" %%a in ('findstr "sdk.dir" android\local.properties') do (
        set ANDROID_HOME=%%a
        set SDK_FOUND=1
    )
)
if %SDK_FOUND%==0 (
    if exist "D:\AndroidSDK" (
        set ANDROID_HOME=D:\AndroidSDK
        set SDK_FOUND=1
    )
)
if %SDK_FOUND%==0 (
    echo [X] 未找到 Android SDK
    echo    请安装 Android Studio 或设置 ANDROID_HOME
    pause & exit /b 1
)
echo        SDK:  %ANDROID_HOME%

:: 打包 APK
echo [5/5] 打包 APK...
if not exist "android\gradlew.bat" (
    echo [X] android\gradlew.bat 不存在
    echo 请先运行: npx cap add android
    pause & exit /b 1
)
call .\android\gradlew.bat -p android assembleDebug
if %errorlevel% neq 0 (
    echo.
    echo [X] APK 打包失败
    echo 常见原因：未安装 Android Studio 或 SDK 版本不对
    pause & exit /b 1
)

echo.
echo ============================================
echo   APK 生成成功！
echo   android\app\build\outputs\apk\debug\app-debug.apk
echo ============================================
explorer android\app\build\outputs\apk\debug
pause
