import { Capacitor, CapacitorHttp } from "@capacitor/core";

export function lanAddress(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("电脑地址格式不正确，例如 http://192.168.0.93:4173"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("请填写电脑首页地址，不要包含配对码或其他路径");
  }
  return url.origin;
}

// APK 使用原生请求，避免 WebView 对 HTTPS 页面访问局域网 HTTP 的限制。
export async function lanRequest(base: string, path: string, body?: unknown): Promise<any> {
  const url = `${lanAddress(base)}${path}`;
  let status: number;
  let data: any;
  try {
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.request({
        url, method: body === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json" }, data: body,
        connectTimeout: 10000, readTimeout: 15000, responseType: "json", disableRedirects: true,
      });
      status = response.status;
      data = response.data;
    } else {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url, {
          method: body === undefined ? "GET" : "POST", signal: controller.signal,
          ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
        });
        status = response.status;
        data = await response.text();
      } finally { clearTimeout(timer); }
    }
  } catch {
    throw new Error(`无法连接电脑 ${lanAddress(base)}。请用手机浏览器打开该地址：若也打不开，检查同一 Wi-Fi、局域网启动和电脑防火墙；若浏览器能打开，请更新安装修复版 Threadbook APK。`);
  }
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { throw new Error(`电脑返回了非 JSON 内容（HTTP ${status}），请确认地址指向墨脉创作台`); }
  }
  if (status < 200 || status >= 300) throw new Error(data?.error || `电脑拒绝请求（HTTP ${status}），请重新生成配对码`);
  return data;
}
