// --- BLE設定 ---
const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
const CHARACTERISTIC_UUID = "abcdefab-1234-5678-1234-abcdefabcdef";

let device = null,
  characteristic = null;
let accelX = 0,
  accelY = 0,
  accelZ = 1.0,
  rollVal = 0,
  pitchVal = 0;

let historyZ = [];
const MAX_HISTORY = 60;

let carModel;

function preload() {
  // 変換したobjファイルを読み込む
  carModel = loadModel("buggy.obj", true);
}

async function connectBLE() {
  const status = document.getElementById("status");
  try {
    status.innerText = "SELECTING...";
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
    });

    // 切断イベントのハンドラを登録
    device.addEventListener("gattserverdisconnected", onDisconnected);

    status.innerText = "CONNECTING...";

    // 重要：接続が完了するのを待つ
    const server = await device.gatt.connect();
    // 500msほど待機してみる
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 接続状態を二重チェック（GATT Serverが存在するか）
    if (!server || !server.connected) {
      throw new Error("GATT Server connection failed.");
    }

    status.innerText = "GETTING SERVICE...";
    const service = await server.getPrimaryService(SERVICE_UUID);

    status.innerText = "GETTING CHARACTERISTIC...";
    characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

    await characteristic.startNotifications();
    characteristic.addEventListener("characteristicvaluechanged", handleNotify);

    status.innerText = "CONNECTED";
  } catch (e) {
    status.innerText = "ERROR: " + e.message;
    console.error(e);
  }
}

// 切断時の処理を関数として独立させる
function onDisconnected(event) {
  const status = document.getElementById("status");
  status.innerText = "DISCONNECTED";
  // 必要に応じて変数をクリア
  characteristic = null;

  console.log("onDisconnected", event);
}

function disconnectBLE() {
  if (device) device.gatt.disconnect();
}

function handleNotify(event) {
  const val = new TextDecoder().decode(event.target.value);
  document.getElementById("count").innerText = val;

  const mX = val.match(/X:\s*(-?[\d.]+)/);
  const mY = val.match(/Y:\s*(-?[\d.]+)/);
  const mZ = val.match(/Z:\s*(-?[\d.]+)/);
  const mR = val.match(/Roll:\s*(-?[\d.]+)/);
  const mP = val.match(/Pitch:\s*(-?[\d.]+)/);

  if (mX) accelX = parseFloat(mX[1]) / 1000;
  if (mY) accelY = parseFloat(mY[1]) / 1000;
  if (mZ) accelZ = parseFloat(mZ[1]) / 1000;
  if (mR) rollVal = parseFloat(mR[1]);
  if (mP) pitchVal = parseFloat(mP[1]);

  historyZ.push(accelZ);
  if (historyZ.length > MAX_HISTORY) historyZ.shift();
}

// --- 描画レイアウト (3Dのみを中央に配置) ---
function setup() {
  let container = document.getElementById("canvas-container");
  createCanvas(windowWidth, windowHeight - 120, WEBGL).parent(container);
}

function draw() {
  background(64, 128, 200);

  let h = height / 2;

  // --- 1. 3D姿勢 (上段) ---
  push();
  translate(0, -h + h / 1, 0);
  draw3DPosture();
  pop();

  // 3. 下段 (振動グラフ)
  push();
  translate(0, h - h / 1, 0);
  // 枠のサイズを定義
  let graphW = width - 60;
  let graphH = h * 0.6;
  drawGraph(graphW, graphH);
  pop();
}

function draw3DPosture() {
  // 1. ライトの設定（これが無いと立体感が出ません）
  ambientLight(100); // 全体を照らす弱い光
  directionalLight(255, 255, 255, 0.5, 1, -1); // 斜め上からの強い白光

  // WEBGLの座標中心(0,0,0)に配置
  push();
  // iPhoneの縦長画面に合わせてモデルサイズを調整
  let scaleFactor = min(width, height) / 300;
  scale(scaleFactor);

  // 姿勢回転
  rotateX(radians(pitchVal) + Math.PI - Math.PI / 6);
  rotateZ(-radians(rollVal));

  // 2. 材質の設定
  noStroke(); // 網目（ワイヤーフレーム）を消す
  fill(180); // 基本の色（0=黒, 255=白。180は明るいグレー）
  specularMaterial(255); // 光の反射（ツヤ）を白に設定
  shininess(50); // 輝き具合（数値を大きくすると金属っぽくなります）

  // 3. 描画
  model(carModel);

  pop();
}

function drawGraph(gw, gh) {
  // グラフの外枠
  noFill();
  stroke(60);

  // 1.0Gの中心線
  stroke(100, 100, 150, 100);
  //strokeWeight(5);
  //line(-gw / 2, 30, gw / 2, 30);

  // データの描画
  if (historyZ.length > 1) {
    stroke(50, 255, 100);
    strokeWeight(2);
    noFill();
    beginShape();
    for (let i = 0; i < historyZ.length; i++) {
      // X軸：履歴のインデックスを枠幅にマッピング
      let x = map(i, 0, MAX_HISTORY - 1, -gw / 2, gw / 2);
      // Y軸：加速度Z(0.5G〜1.5G)を枠高さ(-gh/2〜gh/2)にマッピング
      // map(値, 入力最小, 入力最大, 出力最小, 出力最大)
      //let y = map(historyZ[i] * 1000, 0, 4096, 0, 200);
      let y = (historyZ[i] * 1000 - 2300) / 2;
      // 描画値が枠を超えないように制限(constrain)
      vertex(x, y);
      //console.log(historyZ[i], y);
    }
    endShape();
  }
}

function windowResized() {
  let container = document.getElementById("canvas-container");
  resizeCanvas(container.offsetWidth, container.offsetHeight);
}