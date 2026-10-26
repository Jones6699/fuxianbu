import React, { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { useProjectStore } from "../../store/projectStore";
import type { ChatSession } from "../../types/chat";
import { candidateFromMessage, parseWorkbenchContext } from "../../types/handoff";
import { BrowserQRCodeReader } from "@zxing/browser";
import { lanRequest } from "../../services/lan";

interface Props { session?: ChatSession; onClose: () => void }

export function WorkbenchSheet({ session, onClose }: Props) {
  const projectStore = useProjectStore();
  const project = projectStore.currentProject();
  const context = project?.workbenchContext;
  const replies = (session?.messages || []).filter(message => message.role === "assistant" &&
    Boolean(typeof message.content === "string" ? message.content.trim() : message.versions?.length));
  const [messageId, setMessageId] = useState("");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [lanUrl, setLanUrl] = useState("");
  const [lanToken, setLanToken] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    const message = replies.find(item => item.id === messageId) || replies[replies.length - 1];
    if (!message) return;
    if (message.id !== messageId) setMessageId(message.id);
    setDraft(message.versions?.[message.active_version ?? 0]?.content ||
      (typeof message.content === "string" ? message.content : ""));
  }, [messageId, session?.id]);

  async function importContext(file?: File) {
    if (!file || !project) return;
    try {
      if (file.size > 250_000) throw new Error("章节资料不能超过 250KB");
      const parsed = parseWorkbenchContext(JSON.parse(await file.text()));
      if (context && (context.project !== parsed.project || context.chapter !== parsed.chapter) &&
        !window.confirm(`当前绑定 ${context.project} / ${context.chapter}。确定替换为 ${parsed.project} / ${parsed.chapter}？`)) return;
      projectStore.bindWorkbenchContext(project.id, parsed);
      setNotice(`已绑定 ${parsed.project} / ${parsed.chapter}，后续生成与重试会携带这份设定。`);
    } catch (error) { setNotice((error as Error).message); }
  }

  async function exportCandidate() {
    if (!context || !session) { setNotice("请先导入章节资料并打开写作对话"); return; }
    const message = replies.find(item => item.id === messageId);
    if (!message) { setNotice("请先选择一条 AI 回复"); return; }
    try {
      const candidate = candidateFromMessage(context, session, message, draft);
      const filename = `${context.project}-${context.chapter}-候选稿-${Date.now()}.json`.replace(/[\\/:*?"<>|]/g, "_");
      const data = JSON.stringify(candidate, null, 2);
      if (Capacitor.isNativePlatform()) {
        const result = await Filesystem.writeFile({ path: filename, data, directory: Directory.Documents, encoding: Encoding.UTF8 });
        setNotice(`已保存到文档目录：${result.uri}。将此 JSON 文件导入桌面工作台。`);
      } else {
        const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNotice("候选稿已下载。请在桌面工作台的「文脉协作」中导入。");
      }
    } catch (error) { setNotice((error as Error).message); }
  }

  async function connectLan() {
    try {
      const base = lanUrl.trim().replace(/\/$/, "");
      if (!base || !lanToken.trim()) throw new Error("请输入电脑显示的局域网地址和配对码");
      const data = await lanRequest(base, `/api/lan/context?token=${encodeURIComponent(lanToken.trim())}`);
      if (!project) throw new Error("当前项目不存在");
      const parsed = parseWorkbenchContext(data);
      projectStore.bindWorkbenchContext(project.id, parsed);
      setNotice(`已通过局域网连接 ${parsed.project} / ${parsed.chapter}`);
    } catch (error) { setNotice((error as Error).message); }
  }

  async function scanLanQr() {
    setScannerOpen(true);
    try {
      const reader = new BrowserQRCodeReader();
      const result = await reader.decodeOnceFromConstraints({ video: { facingMode: { ideal: "environment" } } }, "threadbook-qr-video");
      const payload = JSON.parse(result.getText()) as { version?: number; url?: string; token?: string; expiresAt?: number };
      if (payload.version !== 1 || !payload.url || !payload.token) throw new Error("二维码不是有效的 Threadbook 配对码");
      if (payload.expiresAt && payload.expiresAt < Date.now()) throw new Error("二维码已过期，请在电脑端重新生成");
      setLanUrl(payload.url);
      setLanToken(payload.token.toUpperCase());
      setScannerOpen(false);
      setNotice("扫码成功，正在连接电脑…");
      const data = await lanRequest(payload.url, `/api/lan/context?token=${encodeURIComponent(payload.token)}`);
      if (!project) throw new Error("当前项目不存在");
      const parsed = parseWorkbenchContext(data);
      projectStore.bindWorkbenchContext(project.id, parsed);
      setNotice(`已扫码连接 ${parsed.project} / ${parsed.chapter}`);
    } catch (error) {
      setScannerOpen(false);
      setNotice((error as Error).message || "扫码失败，请重试或手动输入");
    }
  }

  async function sendLan() {
    if (!context || !session) { setNotice("请先连接章节资料"); return; }
    try {
      const message = replies.find(item => item.id === messageId);
      if (!message) throw new Error("请先选择一条 AI 回复");
      if (!lanUrl.trim() || !lanToken.trim()) throw new Error("请先填写电脑地址和配对码");
      const candidate = candidateFromMessage(context, session, message, draft);
      const data = await lanRequest(lanUrl, "/api/lan/candidate", { token: lanToken.trim(), package: candidate });
      setNotice(`候选稿已直接回传电脑：${data.id.slice(0, 8)}`);
    } catch (error) { setNotice((error as Error).message); }
  }

  return <div className="workbench-overlay" role="dialog" aria-modal="true" aria-label="协作桥">
    <div className="workbench-sheet">
      <div className="workbench-head"><strong>协作桥</strong><button onClick={onClose} aria-label="关闭">×</button></div>
      <p>从桌面工作台导入章节设定，在当前项目写作；再导出一份可编辑的候选稿。导出不会直接修改桌面正文或信息账本。</p>
      <label className="workbench-import">导入章节资料 JSON<input type="file" accept=".json,application/json" onChange={event => { void importContext(event.target.files?.[0]); event.target.value = ""; }} /></label>
      <div className="workbench-lan"><strong>局域网直连</strong><p>电脑端生成二维码后，手机与电脑连接同一 Wi-Fi，推荐直接扫码：</p><div className="workbench-lan-actions"><button onClick={() => void scanLanQr()}>扫码连接</button><button onClick={() => void connectLan()}>手动连接</button></div><input value={lanUrl} onChange={event => setLanUrl(event.target.value)} placeholder="电脑地址，例如 http://192.168.1.8:4173" /><input value={lanToken} onChange={event => setLanToken(event.target.value.toUpperCase())} placeholder="12 位配对码" autoCapitalize="characters" /><div className="workbench-lan-actions"><button onClick={() => void sendLan()}>直接回传候选稿</button></div></div>
      {scannerOpen && <div className="workbench-scanner"><video id="threadbook-qr-video" autoPlay muted playsInline /><button onClick={() => setScannerOpen(false)}>取消扫码</button><small>请将电脑端二维码放入取景框</small></div>}
      {context && <div className="workbench-context"><strong>已导入电脑资料：{context.project} / {context.chapter}</strong><small>设定版本 {context.revision.slice(0, 12)} · {context.assets.length} 份资料</small>{context.assets.map(asset => <details key={asset.path}><summary>{asset.path}</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: "30vh", overflow: "auto" }}>{asset.content}</pre></details>)}</div>}
      <label>选择当前对话的 AI 回复<select value={messageId} onChange={event => setMessageId(event.target.value)}>
        {replies.length ? replies.map((message, index) => <option key={message.id} value={message.id}>第 {index + 1} 条 · {message.date}</option>) : <option value="">暂无 AI 回复</option>}
      </select></label>
      <label>导出前编辑候选正文<textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder="选择 AI 回复后可继续编辑" /></label>
      <button className="workbench-export" onClick={() => void exportCandidate()}>导出候选稿 JSON</button>
      {notice && <p role="status" className="workbench-notice">{notice}</p>}
    </div>
  </div>;
}
