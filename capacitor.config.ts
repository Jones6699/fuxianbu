import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fuxianbu.app",
  appName: "伏线簿",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // 开发时可选开启热重载（需要手机和电脑在同一网络）
    // url: "http://192.168.x.x:3000",
    // cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
    },
    Keyboard: {
      resize: "none",
    },
  },
};

export default config;
