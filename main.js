function log(s){
    console.log((new Date()).toLocaleString(),s)
    const logs = document.getElementById("log");
    const logentry = document.createElement("div");
    logentry.className="logentry"
    logentry.innerText = (new Date()).toLocaleString()+" "+s;
    logs.appendChild(logentry)
}
function setStatus(stat){
    document.getElementById("status").innerText=stat;
    log("status: "+stat)
}
var lastnotifieddata = null;
let currentdevice = null;
function dataViewToString(dataView) {
    // Create a TextDecoder with the appropriate encoding (e.g., 'utf-8')
    const decoder = new TextDecoder('utf-8');

    // Decode the DataView into a string
    const decodedString = decoder.decode(dataView);

    // Filter out non-printable characters using a regular expression
    const printableString = decodedString.replace(/[^ -~]/g, '');

    return printableString;
}

let devmap = {};
let laststringdata = "";
function parseData(s){
    if (s.indexOf(":") != -1) {
        const p = s.split(":");
        k = p[0];
        v = Number(p[1]);
        console.log(s, p, k, v);
        if (k in devmap) {
            devmap[k].style.background = v ? "green" : "black";
        }
        if (k in sensorMap){
            sensorMap[k].textContent = p[1];
        }
    }
}
function handleCharacteristicValueChanged(event) {
    const value = event.target.value;
    const s = dataViewToString(value)
    log(s)
    console.log('Received ', value, s);
    
    if(s.length>1){
        if(s[s.length-1]=="@"){
            laststringdata = s.substring(0,s.length-1);
        }else{
            if(laststringdata!=""){
                parseData(laststringdata+s)
                laststringdata= "";
            }else{
                parseData(s)
            }
        }
    }
    lastnotifieddata = value;
    
}
var writeChar = null;
var readChar = null;
function stringToByte(s) {
    return (new TextEncoder('utf-8')).encode(s);
}

function writeChunks(command) {
    let lastChunk = false;
    let endIndex = 17;
    let lastIndex = command.length;
    let startIndex = 0;
    const loop = () => {
        if (!lastChunk) {
            let chunk = null;
            if (endIndex < lastIndex) {
                chunk = command.substring(startIndex, 17);
                chunk += "@";
            }
            else {
                chunk = command.substring(startIndex);
                lastChunk = true;
            }
            console.log("write", chunk)
            writeChar.writeValueWithResponse(stringToByte(chunk)).then(res => {
                console.log(res)
            }).catch((err) => {
                console.error(err);
            });


            startIndex = endIndex;
            endIndex = startIndex + 17;
            if (endIndex > lastIndex) {
                endIndex = lastIndex;
            }
            setTimeout(loop, 200);
        }
    }
    loop();
}
function sendData(data) {
    if (data.length > 20) {
        writeChunks(data)
    }
    else {
        writeChar.writeValueWithResponse(stringToByte(data)).then(res => {
            console.log(res)
        }).catch((err) => {
            console.error(err);
        });
    }
}

function time(text) {
    log('[' + new Date().toJSON().substr(11, 8) + '] ' + text);
}
function exponentialBackoff(max, delay, toTry, success, fail) {
    toTry().then(result => success(result))
        .catch(_ => {
            if (max === 0) {
                return fail();
            }
            time('Retrying in ' + delay + 's... (' + max + ' tries left)');
            setTimeout(function () {
                exponentialBackoff(--max, delay * 2, toTry, success, fail);
            }, delay * 1000);
        });
}
function onDisconnected() {
    log('> Bluetooth Device disconnected');
    setStatus("disconnected");
    connect();
}

async function conn(device) {

    currentdevice = device;
    console.log(device);
    device.addEventListener('gattserverdisconnected', onDisconnected);
    
    setStatus("connecting");
    const server = await device.gatt.connect();
    console.log(server);
    
    setStatus("connected");
    const services = await server.getPrimaryServices();
    console.log(services);

    const deviceInfo = document.getElementById('devices');
    deviceInfo.innerHTML = '<h2>Found Services:</h2>';
    for (const service of services) {
        deviceInfo.innerHTML += `<h3>${service.uuid}</h3>`;

        const characteristics = await service.getCharacteristics();
        console.log(characteristics);
        for (const characteristic of characteristics) {
            deviceInfo.innerHTML += `<p>Characteristic UUID: ${characteristic.uuid}</p>`;
            console.log(characteristic)
            if (characteristic.properties.write) {
                writeChar = characteristic;
                setTimeout(() => {
                    //public static string MagicConnectStringDataSchalt = "net-BT_ID-c0:ee:fb:90:b0:a7";
                    //writeChunks("net-BT_ID-de:00:11:60:62:48");
                    writeChunks("net-BT_ID-c0:ee:fb:90:b0:a7");
                }, 500);
            }
            if (characteristic.properties.notify) {
                characteristic.startNotifications()
                    .then(characteristic => {
                        characteristic.addEventListener('characteristicvaluechanged',
                            handleCharacteristicValueChanged);
                        console.log('Notifications have been started.');
                    })
                readChar = characteristic;
            }
        }
    }
}
async function startScan() {
    try {
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['c7841029-fe7c-4894-8532-f97908ef1ae4']
        });
        conn(device);

    } catch (error) {
        console.error('Error: ' + error);
    }
}
const SENSOR_NAMES = [
    "TEMP_IN",
    "TEMP_OUT",
    "IBS0_IBAT",
    "IBS0_UBAT",
    "IBS0_SOC2",
    "IBS0_REMAINING_TIME",
    "HS_EN"
];
let sensorMap = {};
function addBtnDiv(text, fun,parent) {
    let btn = document.createElement("div");
    btn.className = "btn2";
    btn.innerText = text;
    btn.onclick = fun;
    parent.appendChild(btn);
    return btn;
}
window.onload = () => {
    let btns = document.getElementById("btns");

    SENSOR_NAMES.forEach(e=>{
        d = addBtnDiv(e,()=>{

        },document.getElementById("sensors"));
        d.style.background="#eee";
        d.style.color="#111";
        
        span = document.createElement("div")
        d.appendChild(span)
        span.innerText= "0.0";
        sensorMap[e]=span;
    })

    function addButton(text, fun) {
        let btn = document.createElement("div");
        btn.className = "btn";
        btn.innerText = text;
        btn.onclick = fun;
        btns.appendChild(btn);
        return btn;
    }
    const lightnames = [
        "LIGHT_DECKE",
        "LIGHT_WAND",
        "LIGHT_BETTR",
        "LIGHT_BETTL",
        "LIGHT_DUSCHE",
        "LIGHT_WASCH",
        "LIGHT_AMB1",
        "LIGHT_AMB2",
        "LIGHT_AMB3",
        "LIGHT_ZUSATZL",
        "LIGHT_ZUSATZM",
        "LIGHT_ZUSATZR",
        "LIGHT_KUECHE",
        "LIGHT_AUSSEN",
        "LIGHT_BETT2L",
        "LIGHT_BETT2R",
        "LIGHT_BETT1L",
        "LIGHT_BETT1R",
        "LIGHT_KUECHE2",
        "LIGHT_THERME"
    ];
    lightnames.forEach(e => {
        devmap[e] = addButton(e.substring(6), () => {
            sendData("cmd-tgl:" + e);
        })
    })
}

navigator.bluetooth.getDevices().then(e => {
    conn(e);
})