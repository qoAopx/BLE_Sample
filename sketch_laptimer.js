// --- BLE設定 ---
const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
const CHARACTERISTIC_UUID = "abcdefab-1234-5678-1234-abcdefabcdef";

let device = null;
let characteristic = null;
let lapTimes = [];
let bestLap = Infinity;

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

  if (time < bestLap) {
    bestLap = time;
    document.getElementById("best-time").innerText = formatTime(bestLap);
  }
  updateTable();
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
  const cs = Math.floor((sec % 1) * 100);
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

  // 1. まずは通常のAPIを試す
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      alert("コピーしました (Clipboard API)");
    }).catch(err => {
      // 権限エラー時はフォールバックへ
      console.warn("API blocked, trying fallback...");
      fallbackCopyTextToClipboard(text);
    });
  } else {
    // 2. APIが使えない環境なら直接フォールバック
    fallbackCopyTextToClipboard(text);
  }
}

/**
 * 参考コードから移植したフォールバック処理
 * 画面外にテキストエリアを作って強引にコピーコマンドを発行します。
 */
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
    document.getElementById("lap-list").innerHTML = "";
  }
}