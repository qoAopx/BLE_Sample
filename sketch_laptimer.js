// --- BLE設定 ---
const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
const CHARACTERISTIC_UUID = "abcdefab-1234-5678-1234-abcdefabcdef";

let device = null;
let characteristic = null;
let lapTimes = [];
let bestLap = Infinity;

// --- カメラ用変数 ---
let stream = null;
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const flash = document.getElementById('shutter-flash');

// --- BLE通信ロジック ---
async function connectBLE() {
  const status = document.getElementById("status");
  try {
    status.innerText = "SELECTING...";
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
    });

    device.addEventListener("gattserverdisconnected", onDisconnected);
    status.innerText = "CONNECTING...";

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

    await characteristic.startNotifications();
    characteristic.addEventListener("characteristicvaluechanged", handleNotify);

    status.innerText = "CONNECTED";
  } catch (e) {
    status.innerText = "ERROR: " + e.message;
  }
}

function onDisconnected() {
  document.getElementById("status").innerText = "DISCONNECTED";
}

function disconnectBLE() {
  if (device) device.gatt.disconnect();
}

// --- カメラ制御ロジック ---
async function toggleCamera() {
  const btn = document.getElementById('camera-btn');
  if (!stream) {
    try {
      // 背面カメラを優先的に起動
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      video.srcObject = stream;
      btn.innerText = "STOP CAMERA";
      btn.style.background = "#555";
    } catch (err) {
      alert("カメラの起動に失敗しました: " + err);
    }
  } else {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
    btn.innerText = "START CAMERA";
    btn.style.background = "#f39c12";
  }
}

// 自動撮影と保存
function takePhoto(lapNum) {
  if (!stream) return;

  // フラッシュ演出
  flash.style.opacity = 1;
  setTimeout(() => flash.style.opacity = 0, 100);

  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  // タイムスタンプを画像に描画（任意）
  context.font = "bold 40px monospace";
  context.fillStyle = "yellow";
  context.fillText(`LAP ${lapNum}: ${document.getElementById("current-time").innerText}`, 30, canvas.height - 30);

  // 画像としてダウンロード
  const link = document.createElement('a');
  link.download = `lap_${lapNum}_${new Date().getTime()}.png`;
  link.href = canvas.toDataURL();
  link.click();
}

// --- データ受信・解析 ---
function handleNotify(event) {
  const val = new TextDecoder().decode(event.target.value);

  // "Lap: 12.34" 形式を解析
  const match = val.match(/Lap:\s*([\d.]+)/);
  if (match) {
    const lapTime = parseFloat(match[1]);
    addLap(lapTime);
  }
}

// --- アプリケーションロジック ---

function addLap(time) {
  lapTimes.unshift(time);

  // 最新のラップタイムを表示
  document.getElementById("current-time").innerText = formatTime(time);

  // 初回計測(No.1)以外の場合のみベストタイム判定
  if (lapTimes.length > 1) {
    if (time < bestLap) {
      bestLap = time;
      document.getElementById("best-time").innerText = formatTime(bestLap);
    }
        // No.2以降（実ラップ）の時に自動撮影を実行
    takePhoto(lapTimes.length-1);
  }

  // 統計情報（LAPS/AVERAGE）を更新
  updateStats();
  // テーブル履歴を更新
  updateTable();
}

// 統計情報の計算と表示更新
function updateStats() {
  const dataCount = lapTimes.length;
  const lapCountElem = document.getElementById("lap-count");
  const avgTimeElem = document.getElementById("avg-time");

  // ラップ数はデータ数 - 1 (スタートのみの時は0)
  const displayLaps = Math.max(0, dataCount - 1);
  if (lapCountElem) {
    lapCountElem.innerText = displayLaps;
  }

  if (avgTimeElem) {
    // 2つ以上のデータがある場合（No.2以降がある場合）のみ平均を計算
    if (dataCount > 1) {
      // 一番古い(最後の)データ(No.1)を除外して計算
      const lapsToAverage = lapTimes.slice(0, -1);
      const sum = lapsToAverage.reduce((a, b) => a + b, 0);
      const avg = sum / lapsToAverage.length;
      avgTimeElem.innerText = formatTime(avg);
    } else {
      avgTimeElem.innerText = "--:--.--";
    }
  }
}

function updateTable() {
  const tbody = document.getElementById("lap-list");
  tbody.innerHTML = "";

  lapTimes.forEach((time, index) => {
    const row = tbody.insertRow();
    const noCell = row.insertCell(0);
    const timeCell = row.insertCell(1);

    noCell.innerText = lapTimes.length - index;
    timeCell.innerText = formatTime(time);
  });
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec * 100) % 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

// --- コピー機能（エラー対策版） ---

function copyLaps() {
  if (lapTimes.length === 0) {
    alert("データがありません");
    return;
  }

  // テキスト整形
  const text = lapTimes
    .slice()
    .reverse()
    .map((t, i) => `Lap ${i + 1}: ${formatTime(t)}`)
    .join("\n");

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      alert("コピーしました (Clipboard API)");
    }).catch(err => {
      console.warn("API blocked, trying fallback...");
      fallbackCopyTextToClipboard(text);
    });
  } else {
    fallbackCopyTextToClipboard(text);
  }
}

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand("copy");
    if (successful) {
      alert("コピーしました (Fallback)");
    } else {
      alert("コピーに失敗しました");
    }
  } catch (err) {
    console.error("Fallback failed", err);
  }
  document.body.removeChild(textArea);
}

// データのクリア
function clearData() {
  if (confirm("データをすべて消去しますか？")) {
    lapTimes = [];
    bestLap = Infinity;

    document.getElementById("best-time").innerText = "--:--.--";
    document.getElementById("current-time").innerText = "--:--.--";

    const lapCountElem = document.getElementById("lap-count");
    const avgTimeElem = document.getElementById("avg-time");
    if (lapCountElem) lapCountElem.innerText = "0";
    if (avgTimeElem) avgTimeElem.innerText = "--:--.--";

    document.getElementById("lap-list").innerHTML = "";
  }
}