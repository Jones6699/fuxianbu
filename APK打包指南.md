# 📦 APK 封装指南

每次改完代码后，按以下步骤封装 APK。

## 前置条件（首次使用）

1. **Node.js 18+** 已安装
2. **Android Studio** 已安装（下载地址：https://developer.android.com/studio）
3. Android Studio 里装好 **Android SDK Platform 34** 和 **Android SDK Build-Tools**

## 一键封装（3 步）

### 第 1 步：构建 Web 资源

```powershell
npm run build
```

这会在 `dist/` 目录生成 html/css/js。

### 第 2 步：同步到 Android 项目

```powershell
npx cap sync android
```

这会把 `dist/` 复制到 `android/app/src/main/assets/public/`。

### 第 3 步：用 Android Studio 打开并打包

```powershell
npx cap open android
```

打开后：菜单栏 → **Build → Build Bundle(s) / APK(s) → Build APK(s)**

完成后弹出提示，点 **locate** → 文件在 `android/app/build/outputs/apk/debug/app-debug.apk`

## 快速参考

| 场景 | 命令 |
|------|------|
| 日常开发 | `npm run dev`（浏览器打开 localhost:3000）|
| 打包 APK | `npm run build && npx cap sync android && npx cap open android` |
| 换了新电脑/删了 android 目录 | `npx cap add android` 重新创建 |

## 为什么以前每次像第一次封装

`.gitignore` 之前把整个 `android/` 目录忽略了，切换分支或 clean 就被删。

现在已修复：只忽略构建产物（`android/*/build/`），保留源码（`android/app/src/`）。
