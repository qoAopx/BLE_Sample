// --- BLE設定 --- (既存のまま)
const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
const CHARACTERISTIC_UUID = "abcdefab-1234-5678-1234-abcdefabcdef";

let device = null;
let characteristic = null;
let lapTimes = [];
let bestLap = Infinity;

// --- BLE通信ロジック --- (既存のまま)
// ... (中略) ...

// --- データ受信・解析 --- (既存のまま)
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

  // 最新のラップタイムを表示
  document.getElementById("current-time").innerText = formatTime(time);

  if (time < bestLap) {
    bestLap = time;
    document.getElementById("best-time").innerText = formatTime(bestLap);
  }
  
  // ★追加：統計表示の更新
  updateStats();
  updateTable();
}

// ★追加：ラップ数とアベレージの計算
function updateStats() {
  const count = lapTimes.length;
  document.getElementById("lap-count").innerText = count;

  if (count > 0) {
    const sum = lapTimes.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    document.getElementById("avg-time").innerText = formatTime(avg);
  } else {
    document.getElementById("avg-time").innerText = "--:--.--";
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
  const cs = Math.floor((sec % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

// --- コピー機能（エラー対策版） --- (既存のまま)
// ... (中略) ...

// データのクリア
function clearData() {
  if (confirm("データをすべて消去しますか？")) {
    lapTimes = [];
    bestLap = Infinity;
    document.getElementById("best-time").innerText = "--:--.--";
    document.getElementById("current-time").innerText = "--:--.--";
    
    // ★追加：ラップ数とアベレージの表示をリセット
    document.getElementById("lap-count").innerText = "0";
    document.getElementById("avg-time").innerText = "--:--.--";
    
    document.getElementById("lap-list").innerHTML = "";
  }
}
