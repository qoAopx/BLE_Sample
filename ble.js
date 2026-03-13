const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
const CHARACTERISTIC_UUID = "abcdefab-1234-5678-1234-abcdefabcdef";

let device = null;
let characteristic = null;

async function connectBLE(){

 try{

  document.getElementById("status").innerText="select device";

  device = await navigator.bluetooth.requestDevice({
   filters:[{services:[SERVICE_UUID]}]
  });

  device.addEventListener(
   'gattserverdisconnected',
   onDisconnected
  );

  document.getElementById("status").innerText="connecting";

  const server = await device.gatt.connect();

  const service = await server.getPrimaryService(SERVICE_UUID);

  characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

  await characteristic.startNotifications();

  characteristic.addEventListener(
   'characteristicvaluechanged',
   handleNotify
  );

  document.getElementById("status").innerText="connected";

 }
 catch(e){

  document.getElementById("status").innerText="error "+e;

 }

}

function disconnectBLE(){

 if(device && device.gatt.connected){

  device.gatt.disconnect();

 }

}

function onDisconnected(){

 document.getElementById("status").innerText="disconnected";
 document.getElementById("count").innerText="-";

}

function handleNotify(event){

 const decoder = new TextDecoder();

 const value = decoder.decode(event.target.value);

 document.getElementById("count").innerText=value;

}
