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
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      video.srcObject = stream;
      // iOSでの自動再生対策
      video.play();
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

// 自動撮影・保存・履歴表示
function takePhoto(lapNum) {
  if (!stream) return;

  // フラッシュ演出
  flash.style.opacity = 1;
  setTimeout(() => flash.style.opacity = 0, 100);

  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  // タイムスタンプ描画
  context.font = "bold 40px monospace";
  context.fillStyle = "yellow";
  const currentTimeStr = document.getElementById("current-time").innerText;
  context.fillText(`LAP ${lapNum}: ${currentTimeStr}`, 30, canvas.height - 30);

  const dataUrl = canvas.toDataURL("image/png");

  // --- 写真履歴への追加 ---
  const historyContainer = document.getElementById('photo-history');
  const img = document.createElement('img');
  img.src = dataUrl;
  img.className = 'captured-img';
  // 新しい写真を上に追加する
  historyContainer.insertBefore(img, historyContainer.firstChild);

  // --- Mac用自動ダウンロード（既存ロジック維持） ---
  const link = document.createElement('a');
  link.download = `lap_${lapNum}_${new Date().getTime()}.png`;
  link.href = dataUrl;
  link.click();
}

// --- データ受信・解析 ---
function handleNotify(event) {
  const val = new TextDecoder().decode(event.target.value);
  const match = val.match(/Lap:\s*([\d.]+)/);
  if (match) {
    const lapTime = parseFloat(match[1]);
    addLap(lapTime);
  }
}

// --- アプリケーションロジック ---
function addLap(time) {
  lapTimes.unshift(time);
  document.getElementById("current-time").innerText = formatTime(time);

  if (lapTimes.length > 1) {
    if (time < bestLap) {
      bestLap = time;
      document.getElementById("best-time").innerText = formatTime(bestLap);
    }
    // No.2以降（実ラップ）の時に自動撮影を実行
    takePhoto(lapTimes.length - 1);
  }
  updateStats();
  updateTable();
}

function updateStats() {
  const dataCount = lapTimes.length;
  const lapCountElem = document.getElementById("lap-count");
  const avgTimeElem = document.getElementById("avg-time");
  const displayLaps = Math.max(0, dataCount - 1);
  if (lapCountElem) lapCountElem.innerText = displayLaps;
  if (avgTimeElem) {
    if (dataCount > 1) {
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
    row.insertCell(0).innerText = lapTimes.length - index;
    row.insertCell(1).innerText = formatTime(time);
  });
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec * 100) % 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

function copyLaps() {
  if (lapTimes.length === 0) { alert("データがありません"); return; }
  const text = lapTimes.slice().reverse().map((t, i) => `Lap ${i + 1}: ${formatTime(t)}`).join("\n");
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => alert("コピーしました")).catch(err => fallbackCopyTextToClipboard(text));
  } else { fallbackCopyTextToClipboard(text); }
}

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
  alert("コピーしました");
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

    // 写真履歴も消去（追加）
    document.getElementById('photo-history').innerHTML = "";
  }
}