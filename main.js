
var lastnotifieddata = null;
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
function handleCharacteristicValueChanged(event) {
    const value = event.target.value;
    const s = dataViewToString(value)
    console.log('Received ',value,s);
    lastnotifieddata = value;
    if(s.indexOf(":")!=-1){
        const p = s.split(":");
        k = p[0];
        v = Number(p[1]);
        console.log(s,p,k,v);
        if(k in devmap){
            devmap[k].style.background = v?"green":"black";
        }
    }
  }
var writeChar = null;
var readChar = null;
function stringToByte(s){
    return (new TextEncoder('utf-8')).encode(s);
}

function writeChunks(command){
    let lastChunk = false;
    let endIndex = 17;
    let lastIndex = command.length;
    let startIndex = 0;
    const loop=()=>{
        if(!lastChunk){
            let chunk = null;
            if(endIndex < lastIndex){
                chunk = command.substring(startIndex,17);
                chunk += "@";
            }
            else
            {
                chunk = command.substring(startIndex);
                lastChunk = true;
            }
            console.log("write",chunk)
            writeChar.writeValueWithResponse(stringToByte(chunk)).then(res=>{
                console.log(res)
            }).catch((err) => {
                console.error(err);
              });


            startIndex = endIndex;
            endIndex = startIndex + 17;
            if(endIndex > lastIndex){
                endIndex = lastIndex;
            }
            setTimeout(loop,200);
        }
    }
    loop();
}
function sendData(data){
    if(data.length > 20){
        writeChunks(data)
    }
    else
    {
        writeChar.writeValueWithResponse(stringToByte(data)).then(res=>{
            console.log(res)
        }).catch((err) => {
            console.error(err);
          });
    }
}
async function startScan() {
    try {
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['c7841029-fe7c-4894-8532-f97908ef1ae4']
        });
        
        const server = await device.gatt.connect();
        console.log(server);
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
                if(characteristic.properties.write){
                    writeChar = characteristic;
                    setTimeout(()=>{
                        //public static string MagicConnectStringDataSchalt = "net-BT_ID-c0:ee:fb:90:b0:a7";
                        //writeChunks("net-BT_ID-de:00:11:60:62:48");
                        writeChunks("net-BT_ID-c0:ee:fb:90:b0:a7");
                    },500);
                }
                if(characteristic.properties.notify){
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
    } catch (error) {
        console.error('Error: ' + error);
    }
}
window.onload=()=>{
    let btns = document.getElementById("btns");
    function addButton(text,fun){
        let btn = document.createElement("div");
        btn.className = "btn";
        btn.innerText= text;
        btn.onclick = fun;
        btns.appendChild(btn);
        return btn;
    }
    const lightnames =  [
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
        "LIGHT_DIM0",
        "LIGHT_DIM1",
        "LIGHT_DIM2",
        "LIGHT_DIM3",
        "LIGHT_DIM4",
        "LIGHT_DIM5",
        "LIGHT_DIM6",
        "LIGHT_DIM7"
      ];
    lightnames.forEach(e=>{
        devmap[e]=addButton(e.substring(6),()=>{
            sendData("cmd-tgl:"+e);
        })
        
    })
    
    
}