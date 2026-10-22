@echo off
chcp 65001 >nul
cd /d "%~dp0"

set HAS_LOCAL=0
if exist "public\prompts-local.json" set HAS_LOCAL=1

echo ============================================
echo   InkFlow APK 打包（干净版 / 公开分发）
echo   构建期间自动隐藏本地扩展文件，产物不含
echo ============================================
echo.

:: 检查 Node.js
where node >nul 2>nul || ( echo [X] 未找到 Node.js & pause & exit /b 1 )

:: 检查 Git
where git >nul 2>nul || ( echo [X] 未找到 Git & pause & exit /b 1 )

:: 上次异常中断残留的 .bak 先还原
if exist "public\prompts-local.json.bak" (
    echo [恢复] 发现上次残留的 prompts-local.json.bak，先还原...
    ren "public\prompts-local.json.bak" "prompts-local.json"
    set HAS_LOCAL=1
)

:: Git 保存
echo [1/6] Git 保存...
for /f "tokens=2 delims==" %%x in ('wmic os get localdatetime /value ^| findstr "="') do set DT=%%x
set GIT_TAG=%DT:~0,8%-%DT:~8,4%
git add -A
git commit -m "APK clean build %GIT_TAG%"
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
echo   "branch": "%GIT_BRANCH%",
echo   "flavor": "clean"
echo }
) > public\build-info.json
echo     提交: %GIT_HASH% (%GIT_DATE%)
echo.

:: 移走本地扩展文件（干净版核心：public 会原样拷入 dist/APK）
if %HAS_LOCAL%==1 (
    echo [2/6] 隐藏本地扩展文件 prompts-local.json ...
    ren "public\prompts-local.json" "prompts-local.json.bak"
    if errorlevel 1 (
        echo     [X] 移动失败，中止打包
        pause & exit /b 1
    )
) else (
    echo [2/6] 未发现 prompts-local.json（本次即干净版）
)

:: 依赖
if not exist "node_modules" (
    echo [3/6] 安装依赖...
    call npm install
)
echo [3/6] npm 就绪

:: 构建 Web
echo [4/6] 构建网页...
call npm run build
if %errorlevel% neq 0 (
    echo     [X] 网页构建失败
    goto :fail
)

:: 同步到安卓
echo     同步到安卓...
call npx cap sync android
if %errorlevel% neq 0 (
    echo     [X] 同步失败
    goto :fail
)

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
    goto :fail
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
    goto :fail
)
echo        SDK:  %ANDROID_HOME%

:: 打包 APK
echo [5/6] 打包 APK (assembleDebug)...
if not exist "android\gradlew.bat" (
    echo [X] android\gradlew.bat 不存在
    echo 请先运行: npx cap add android
    goto :fail
)
call .\android\gradlew.bat -p android -PbuildAppId=com.inkflow.app.public -PbuildAppName=InkFlow assembleDebug
if %errorlevel% neq 0 (
    echo.
    echo [X] APK 打包失败
    echo 常见原因：未安装 Android Studio 或 SDK 版本不对
    goto :fail
)

:: 生成干净版产物
echo [6/6] 生成干净版 APK...
if not exist "apk-dist" mkdir "apk-dist"
copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "apk-dist\InkFlow-public.apk" >nul
if %errorlevel% neq 0 (
    echo     [X] 复制 APK 失败
    goto :fail
)

:: 校验 dist 与 APK 均不含敏感文件
echo     校验产物...
if exist "dist\prompts-local.json" (
    echo     [X] dist\prompts-local.json 仍存在，产物不干净！
    goto :fail
)
powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead('apk-dist\InkFlow-public.apk'); try { $h=@($z.Entries | Where-Object { ($_.FullName -replace '\\','/') -like '*public/prompts-local.json' }); if($h.Count -gt 0){ 'FOUND: ' + $h[0].FullName; exit 1 } else { '     OK: APK 内未发现 prompts-local.json' } } finally { $z.Dispose() }"
if %errorlevel% neq 0 goto :fail

:: 还原本地扩展文件
call :restore

echo.
echo ============================================
echo   干净版 APK 生成成功！
echo   apk-dist\InkFlow-public.apk
echo   （不含本地扩展内容，可公开分发）
echo ============================================
echo.
echo   提示：如需完整版，请运行 apk-full.bat
explorer apk-dist
pause
exit /b 0

:fail
call :restore
echo.
echo [X] 打包失败，已还原本地扩展文件
pause
exit /b 1

:restore
if %HAS_LOCAL%==1 (
    if exist "public\prompts-local.json.bak" (
        echo     还原 prompts-local.json ...
        ren "public\prompts-local.json.bak" "prompts-local.json"
        if errorlevel 1 echo     [警告] 还原失败，请手动把 public\prompts-local.json.bak 改回
    )
)
goto :eof
