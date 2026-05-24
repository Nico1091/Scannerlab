const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { encoding: 'utf-8' }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout);
    });
  });
}

function extract(output, regex) {
  for (const line of output.split(/\r?\n/)) {
    const m = line.match(regex);
    if (m) return m[1].trim();
  }
  return null;
}

async function obtenerDatos() {
  const wifiOut = await run('netsh wlan show interfaces');

  const ssid        = extract(wifiOut, /SSID\s*:\s*(.+)/i);
  const bssid       = extract(wifiOut, /BSSID\s*:\s*(.+)/i);
  const radio       = extract(wifiOut, /Tipo de radio\s*:\s*(.+)/i);
  const channel     = extract(wifiOut, /Canal\s*:\s*(\d+)/i);
  const signal      = extract(wifiOut, /Señal\s*:\s*(.+)/i);
  const reception   = extract(wifiOut, /Velocidad de recepci[óo]n \(Mbps\)\s*:\s*(\d+)/i);
  const transmission= extract(wifiOut, /Velocidad de transmisi[óo]n \(Mbps\)\s*:\s*(\d+)/i);
  const state       = extract(wifiOut, /Estado\s*:\s*(.+)/i);
  const mac         = extract(wifiOut, /Direcci[óo]n f[ií]sica\s*:\s*(.+)/i);

  const ipv4 = (await run('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Wi-Fi).IPAddress"')).trim();
  const mask = (await run('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Wi-Fi).PrefixLength"')).trim();
  const gw   = (await run('powershell -NoProfile -Command "(Get-NetRoute -DestinationPrefix 0.0.0.0/0 -InterfaceAlias Wi-Fi).NextHop"')).trim();

  const isLocal = ipv4 && (
    ipv4.startsWith('192.168.') ||
    ipv4.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ipv4)
  );

  return {
    fecha: new Date().toLocaleString('es-ES'),
    red: {
      nombre: ssid || 'Desconocida',
      bssid: bssid || 'N/A',
      tecnologia: radio || 'N/A',
      canal: channel || 'N/A',
      senial: signal || 'N/A',
      recepcion: reception ? `${reception} Mbps` : 'N/A',
      transmision: transmission ? `${transmission} Mbps` : 'N/A',
      estado: state || 'N/A',
      mac: mac || 'N/A',
    },
    ip: {
      direccion: ipv4 || 'N/A',
      mascara: mask || 'N/A',
      gateway: gw || 'N/A',
      esRedLocal: isLocal ? 'Si' : 'No / Publica',
    }
  };
}

async function guardarTxt(reporte) {
  const txt = `Reporte de Red WiFi
Generado: ${reporte.fecha}
================================================

RED WiFi
------------------------------------------------
Nombre de red (SSID) : ${reporte.red.nombre}
BSSID               : ${reporte.red.bssid}
Tecnologia          : ${reporte.red.tecnologia}
Canal               : ${reporte.red.canal}
Senial              : ${reporte.red.senial}
Recepcion           : ${reporte.red.recepcion}
Transmision         : ${reporte.red.transmision}
Estado              : ${reporte.red.estado}
MAC interfaz        : ${reporte.red.mac}

CONFIGURACION IP
------------------------------------------------
Direccion IPv4      : ${reporte.ip.direccion}
Mascara de subred   : ${reporte.ip.mascara}
Gateway (puerta)    : ${reporte.ip.gateway}
Es red local?       : ${reporte.ip.esRedLocal}

================================================
`;
  fs.writeFileSync(path.join(__dirname, 'red_detectada.txt'), txt, 'utf-8');
}

// Si se ejecuta directamente
if (require.main === module) {
  (async () => {
    try {
      console.log('\n[WiFi Scan] Escaneando red...\n');
      const datos = await obtenerDatos();
      console.log('====================================');
      console.log('  RED WiFi DETECTADA');
      console.log('====================================');
      console.log(`  Nombre      : ${datos.red.nombre}`);
      console.log(`  Tecnologia  : ${datos.red.tecnologia}`);
      console.log(`  Canal       : ${datos.red.canal}`);
      console.log(`  Senial      : ${datos.red.senial}`);
      console.log(`  Estado      : ${datos.red.estado}`);
      console.log('------------------------------------');
      console.log('  CONFIGURACION IP');
      console.log('------------------------------------');
      console.log(`  IP Local    : ${datos.ip.direccion}`);
      console.log(`  Mascara     : ${datos.ip.mascara}`);
      console.log(`  Gateway     : ${datos.ip.gateway}`);
      console.log(`  Red Local   : ${datos.ip.esRedLocal}`);
      console.log('====================================\n');
      await guardarTxt(datos);
      console.log('[OK] Archivo guardado: red_detectada.txt');
    } catch (e) {
      console.error('[ERROR]', e);
      process.exit(1);
    }
  })();
}

const OUI_DB = {
  '00:1A:11': 'Apple', '00:1B:21': 'Apple', '00:1C:14': 'Apple', '00:1D:92': 'Apple',
  '00:1E:C2': 'Apple', '00:1F:3B': 'Apple', '00:21:5C': 'Apple', '00:22:41': 'Apple',
  '00:23:12': 'Apple', '00:24:36': 'Apple', '00:25:00': 'Apple', '00:26:B0': 'Apple',
  '00:50:56': 'VMware', '00:0C:29': 'VMware', '00:15:5D': 'Microsoft Hyper-V',
  '58:9B:F7': 'TP-Link', '50:D4:F7': 'TP-Link', 'C0:4A:00': 'TP-Link',
  'AC:DE:48': 'Apple', 'AC:88:FD': 'Apple', 'B0:BE:76': 'Apple',
  '18:34:AF': 'Samsung', '3C:5A:B4': 'Samsung', '6C:AD:94': 'Samsung',
  '84:11:9E': 'Samsung', 'A0:18:28': 'Samsung', 'BC:44:86': 'Samsung',
  '00:0C:E7': 'Samsung', '00:12:47': 'Samsung', '00:17:C9': 'Samsung',
  '00:1D:D4': 'Samsung', '00:21:19': 'Samsung', '00:24:54': 'Samsung',
  '00:26:5D': 'Samsung', '00:26:F2': 'Samsung', '00:37:6D': 'Samsung',
  '04:D6:AA': 'Samsung', '08:08:C2': 'Samsung', '08:D4:2C': 'Samsung',
  '0C:14:20': 'Samsung', '10:2F:6B': 'Samsung', '10:A5:D0': 'Samsung',
  '10:D5:4A': 'Samsung', '14:49:E0': 'Samsung', '14:9F:3C': 'Samsung',
  '14:A3:64': 'Samsung', '14:B9:73': 'Samsung', '18:3B:D4': 'Samsung',
  '18:74:E2': 'Samsung', '18:AF:61': 'Samsung', '1C:5A:6B': 'Samsung',
  '1C:62:B8': 'Samsung', '1C:AF:F9': 'Samsung', '1C:E1:92': 'Samsung',
  '20:13:E0': 'Samsung', '20:32:6C': 'Samsung', '20:36:76': 'Samsung',
  '20:47:ED': 'Samsung', '20:A6:0C': 'Samsung', '20:DA:22': 'Samsung',
  '24:09:16': 'Samsung', '24:4B:03': 'Samsung', '24:4C:E3': 'Samsung',
  '24:5E:BE': 'Samsung', '24:92:0E': 'Samsung', '24:A2:E1': 'Samsung',
  '24:DB:ED': 'Samsung', '28:25:E8': 'Samsung', '28:39:26': 'Samsung',
  '28:6C:07': 'Samsung', '28:6D:97': 'Samsung', '28:A2:82': 'Samsung',
  '28:BA:18': 'Samsung', '28:BC:18': 'Samsung', '28:CC:01': 'Samsung',
  '2C:32:7A': 'Samsung', '2C:44:01': 'Samsung', '2C:5A:DB': 'Samsung',
  '2C:8A:72': 'Samsung', '2C:B8:ED': 'Samsung', '30:12:FB': 'Samsung',
  '30:19:66': 'Samsung', '30:21:45': 'Samsung', '30:39:26': 'Samsung',
  '30:46:9A': 'Samsung', '30:57:14': 'Samsung', '30:59:26': 'Samsung',
  '30:78:19': 'Samsung', '30:96:6F': 'Samsung', '30:B4:9E': 'Samsung',
  '30:D5:DE': 'Samsung', '34:23:87': 'Samsung', '34:BE:EA': 'Samsung',
  '34:C7:31': 'Samsung', '34:FC:EF': 'Samsung', '38:01:97': 'Samsung',
  '38:16:D1': 'Samsung', '38:68:A4': 'Samsung', '38:78:62': 'Samsung',
  '38:80:DF': 'Samsung', '38:94:96': 'Samsung', '38:A4:ED': 'Samsung',
  '38:EC:0D': 'Samsung', '38:F2:3E': 'Samsung', '3C:5A:03': 'Samsung',
  '3C:5A:B4': 'Samsung', '3C:5C:5C': 'Samsung', '3C:6A:A7': 'Samsung',
  '3C:8B:FE': 'Samsung', '3C:99:F7': 'Samsung', '3C:AB:8E': 'Samsung',
  '3C:D9:2B': 'Samsung', '3C:F7:A4': 'Samsung', '40:0E:85': 'Samsung',
  '44:F4:59': 'Samsung', '48:24:57': 'Samsung', '48:27:EA': 'Samsung',
  '48:5A:B6': 'Samsung', '48:5B:39': 'Samsung', '48:6E:EF': 'Samsung',
  '48:88:CA': 'Samsung', '48:A4:72': 'Samsung', '4C:0F:6E': 'Samsung',
  '4C:66:41': 'Samsung', '4C:79:6E': 'Samsung', '4C:86:1B': 'Samsung',
  '4C:A0:27': 'Samsung', '50:01:BB': 'Samsung', '50:1D:93': 'Samsung',
  '50:32:75': 'Samsung', '50:3E:AA': 'Samsung', '50:84:9C': 'Samsung',
  '50:99:CA': 'Samsung', '50:C8:E5': 'Samsung', '50:EC:50': 'Samsung',
  '54:42:49': 'Samsung', '54:60:09': 'Samsung', '54:88:0E': 'Samsung',
  '54:9B:12': 'Samsung', '54:A9:D4': 'Samsung', '58:93:96': 'Samsung',
  '58:A2:B5': 'Samsung', '58:C3:8B': 'Samsung', '58:CB:52': 'Samsung',
  '58:D9:C3': 'Samsung', '5C:0A:5B': 'Samsung', '5C:17:D3': 'Samsung',
  '5C:23:8E': 'Samsung', '5C:3C:27': 'Samsung', '5C:5E:AB': 'Samsung',
  '5C:A8:6A': 'Samsung', '5C:AF:06': 'Samsung', '5C:E8:EB': 'Samsung',
  '5C:E2:8C': 'Samsung', '60:5F:F5': 'Samsung', '60:83:73': 'Samsung',
  '60:8D:17': 'Samsung', '60:A4:4C': 'Samsung', '60:AF:6D': 'Samsung',
  '60:AF:DA': 'Samsung', '60:D0:2C': 'Samsung', '60:E3:27': 'Samsung',
  '60:E3:AC': 'Samsung', '60:E7:01': 'Samsung', '64:1C:AE': 'Samsung',
  '64:1C:B0': 'Samsung', '64:B5:C6': 'Samsung', '64:CB:E9': 'Samsung',
  '64:D1:54': 'Samsung', '68:48:98': 'Samsung', '68:5B:36': 'Samsung',
  '68:9A:87': 'Samsung', '68:9C:70': 'Samsung', '68:B6:FC': 'Samsung',
  '6C:83:36': 'Samsung', '6C:AD:94': 'Samsung', '70:2C:1F': 'Samsung',
  '70:3A:0E': 'Samsung', '70:3C:69': 'Samsung', '70:D5:E7': 'Samsung',
  '70:F9:27': 'Samsung', '74:5E:1C': 'Samsung', '74:EB:80': 'Samsung',
  '78:1C:5A': 'Samsung', '78:47:1D': 'Samsung', '78:5E:E8': 'Samsung',
  '78:A6:C2': 'Samsung', '78:AB:BB': 'Samsung', '78:F7:D0': 'Samsung',
  '7C:0B:C6': 'Samsung', '7C:46:85': 'Samsung', '7C:61:66': 'Samsung',
  '7C:AB:A1': 'Samsung', '80:18:44': 'Samsung', '80:38:FD': 'Samsung',
  '80:5E:4F': 'Samsung', '80:6F:9D': 'Samsung', '84:11:9E': 'Samsung',
  '84:25:19': 'Samsung', '84:55:A5': 'Samsung', '84:5E:40': 'Samsung',
  '84:73:03': 'Samsung', '84:7A:88': 'Samsung', '84:90:3C': 'Samsung',
  '84:A4:66': 'Samsung', '84:A6:C8': 'Samsung', '84:B5:41': 'Samsung',
  '84:BA:20': 'Samsung', '84:BD:41': 'Samsung', '84:BE:52': 'Samsung',
  '84:C7:25': 'Samsung', '84:CF:53': 'Samsung', '84:D6:D0': 'Samsung',
  '84:DB:2F': 'Samsung', '84:E4:82': 'Samsung', '88:28:B8': 'Samsung',
  '88:3A:30': 'Samsung', '88:5A:BA': 'Samsung', '88:71:E5': 'Samsung',
  '88:9B:39': 'Samsung', '88:A5:BD': 'Samsung', '88:AD:D2': 'Samsung',
  '88:C9:E8': 'Samsung', '88:CE:03': 'Samsung', '8C:1A:BF': 'Samsung',
  '8C:73:6E': 'Samsung', '8C:8F:C4': 'Samsung', '8C:9F:3B': 'Samsung',
  '90:18:7C': 'Samsung', '90:63:3B': 'Samsung', '90:B6:86': 'Samsung',
  '90:BA:E4': 'Samsung', '90:CC:DF': 'Samsung', '90:E7:C4': 'Samsung',
  '94:11:DA': 'Samsung', '94:27:90': 'Samsung', '94:2A:3F': 'Samsung',
  '94:35:0A': 'Samsung', '94:63:D1': 'Samsung', '94:7B:6F': 'Samsung',
  '94:8B:C1': 'Samsung', '94:B8:6D': 'Samsung', '94:BF:2D': 'Samsung',
  '94:D0:0D': 'Samsung', '98:1D:FA': 'Samsung', '98:83:89': 'Samsung',
  '98:A5:3D': 'Samsung', '98:B8:BA': 'Samsung', '98:D3:31': 'Samsung',
  '9C:14:63': 'Samsung', '9C:20:EF': 'Samsung', '9C:4E:36': 'Samsung',
  '9C:5C:F9': 'Samsung', '9C:64:8B': 'Samsung', '9C:6E:71': 'Samsung',
  '9C:99:CD': 'Samsung', '9C:F6:DD': 'Samsung', 'A0:02:DC': 'Samsung',
  'A0:18:28': 'Samsung', 'A0:40:1E': 'Samsung', 'A0:4E:75': 'Samsung',
  'A0:6F:DF': 'Samsung', 'A0:82:1F': 'Samsung', 'A0:88:69': 'Samsung',
  'A0:91:69': 'Samsung', 'A0:99:9B': 'Samsung', 'A0:B4:A5': 'Samsung',
  'A0:B7:45': 'Samsung', 'A0:B8:6F': 'Samsung', 'A0:BB:3E': 'Samsung',
  'A0:CB:FD': 'Samsung', 'A0:CE:C8': 'Samsung', 'A0:D0:76': 'Samsung',
  'A0:DB:25': 'Samsung', 'A0:E4:53': 'Samsung', 'A4:67:06': 'Samsung',
  'A4:8C:39': 'Samsung', 'A4:9A:58': 'Samsung', 'A4:C4:61': 'Samsung',
  'A4:E0:6A': 'Samsung', 'A8:06:00': 'Samsung', 'A8:16:D0': 'Samsung',
  'A8:1E:84': 'Samsung', 'A8:51:AB': 'Samsung', 'A8:5C:2C': 'Samsung',
  'A8:5E:E4': 'Samsung', 'A8:6D:92': 'Samsung', 'A8:9F:BA': 'Samsung',
  'A8:A6:48': 'Samsung', 'A8:B5:7C': 'Samsung', 'A8:D0:E5': 'Samsung',
  'AC:5F:3E': 'Samsung', 'AC:6F:BB': 'Samsung', 'AC:DE:48': 'Samsung',
  'AC:E2:15': 'Samsung', 'B0:10:A0': 'Samsung', 'B0:1F:8B': 'Samsung',
  'B0:47:8F': 'Samsung', 'B0:55:08': 'Samsung', 'B0:68:35': 'Samsung',
  'B0:72:BF': 'Samsung', 'B0:79:94': 'Samsung', 'B0:7D:64': 'Samsung',
  'B0:89:91': 'Samsung', 'B0:8B:CF': 'Samsung', 'B0:98:2B': 'Samsung',
  'B0:9F:DA': 'Samsung', 'B0:C5:54': 'Samsung', 'B0:DF:3A': 'Samsung',
  'B0:E7:54': 'Samsung', 'B4:07:F9': 'Samsung', 'B4:0E:DC': 'Samsung',
  'B4:1D:AF': 'Samsung', 'B4:62:AD': 'Samsung', 'B4:79:C7': 'Samsung',
  'B4:7C:9C': 'Samsung', 'B4:7F:A9': 'Samsung', 'B4:86:56': 'Samsung',
  'B4:A5:EF': 'Samsung', 'B4:B6:FC': 'Samsung', 'B4:CD:27': 'Samsung',
  'B4:E1:C4': 'Samsung', 'B8:11:FC': 'Samsung', 'B8:1D:AA': 'Samsung',
  'B8:57:9E': 'Samsung', 'B8:82:CF': 'Samsung', 'B8:94:E5': 'Samsung',
  'B8:9B:CB': 'Samsung', 'B8:A3:8F': 'Samsung', 'B8:B4:2E': 'Samsung',
  'B8:BA:72': 'Samsung', 'B8:C6:8E': 'Samsung', 'B8:D5:E7': 'Samsung',
  'B8:E8:56': 'Samsung', 'B8:F4:30': 'Samsung', 'BC:20:A4': 'Samsung',
  'BC:44:86': 'Samsung', 'BC:47:60': 'Samsung', 'BC:5E:33': 'Samsung',
  'BC:72:B1': 'Samsung', 'BC:79:AD': 'Samsung', 'BC:81:71': 'Samsung',
  'BC:8A:E8': 'Samsung', 'BC:98:DB': 'Samsung', 'BC:9F:EF': 'Samsung',
  'BC:A4:E1': 'Samsung', 'BC:C3:C4': 'Samsung', 'BC:D1:D3': 'Samsung',
  'BC:F2:92': 'Samsung', 'C0:11:73': 'Samsung', 'C0:1A:DA': 'Samsung',
  'C0:48:E6': 'Samsung', 'C0:97:C3': 'Samsung', 'C0:9F:05': 'Samsung',
  'C0:BD:C8': 'Samsung', 'C0:D9:48': 'Samsung', 'C4:3A:BE': 'Samsung',
  'C4:42:68': 'Samsung', 'C4:57:6E': 'Samsung', 'C4:73:1E': 'Samsung',
  'C4:88:E5': 'Samsung', 'C4:9A:02': 'Samsung', 'C4:A5:59': 'Samsung',
  'C4:D7:6E': 'Samsung', 'C4:E9:84': 'Samsung', 'C4:EE:V5': 'Samsung',
  'C8:14:51': 'Samsung', 'C8:19:F7': 'Samsung', 'C8:1E:E7': 'Samsung',
  'C8:38:70': 'Samsung', 'C8:45:44': 'Samsung', 'C8:5B:76': 'Samsung',
  'C8:97:9C': 'Samsung', 'C8:9E:43': 'Samsung', 'C8:A8:98': 'Samsung',
  'C8:B1:52': 'Samsung', 'C8:BB:BE': 'Samsung', 'C8:C0:1B': 'Samsung',
  'C8:C4:22': 'Samsung', 'C8:CB:E5': 'Samsung', 'C8:CD:C8': 'Samsung',
  'C8:D1:0B': 'Samsung', 'C8:D7:B0': 'Samsung', 'C8:E0:EB': 'Samsung',
  'C8:F2:30': 'Samsung', 'C8:F5:0B': 'Samsung', 'CC:07:AB': 'Samsung',
  'CC:3A:61': 'Samsung', 'CC:3D:82': 'Samsung', 'CC:42:51': 'Samsung',
  'CC:44:63': 'Samsung', 'CC:4B:29': 'Samsung', 'CC:6D:A0': 'Samsung',
  'CC:77:F1': 'Samsung', 'CC:96:A0': 'Samsung', 'CC:9C:3C': 'Samsung',
  'CC:A2:23': 'Samsung', 'CC:B0:DA': 'Samsung', 'CC:FA:00': 'Samsung',
  'D0:22:BE': 'Samsung', 'D0:31:10': 'Samsung', 'D0:4A:CD': 'Samsung',
  'D0:56:BF': 'Samsung', 'D0:66:7B': 'Samsung', 'D0:87:E2': 'Samsung',
  'D0:C1:89': 'Samsung', 'D0:E4:CB': 'Samsung', 'D4:20:6D': 'Samsung',
  'D4:38:9C': 'Samsung', 'D4:61:37': 'Samsung', 'D4:6B:A6': 'Samsung',
  'D4:6E:5C': 'Samsung', 'D4:87:88': 'Samsung', 'D4:8F:AA': 'Samsung',
  'D4:94:E8': 'Samsung', 'D4:A9:28': 'Samsung', 'D4:AF:F1': 'Samsung',
  'D4:CB:DB': 'Samsung', 'D4:D1:71': 'Samsung', 'D4:E8:B2': 'Samsung',
  'D4:F0:57': 'Samsung', 'D8:6C:63': 'Samsung', 'D8:90:E8': 'Samsung',
  'D8:A2:5E': 'Samsung', 'D8:E3:47': 'Samsung', 'D8:F7:10': 'Samsung',
  'DC:09:16': 'Samsung', 'DC:0B:34': 'Samsung', 'DC:16:B2': 'Samsung',
  'DC:44:27': 'Samsung', 'DC:71:44': 'Samsung', 'DC:90:88': 'Samsung',
  'E0:3C:5D': 'Samsung', 'E0:5A:9F': 'Samsung', 'E0:63:E5': 'Samsung',
  'E0:89:7E': 'Samsung', 'E0:99:71': 'Samsung', 'E0:CB:1D': 'Samsung',
  'E0:D7:BA': 'Samsung', 'E4:3E:89': 'Samsung', 'E4:7C:F9': 'Samsung',
  'E4:7E:66': 'Samsung', 'E4:98:D1': 'Samsung', 'E4:B9:7A': 'Samsung',
  'E4:FA:ED': 'Samsung', 'E8:03:9A': 'Samsung', 'E8:08:8B': 'Samsung',
  'E8:11:32': 'Samsung', 'E8:1A:2B': 'Samsung', 'E8:50:8B': 'Samsung',
  'E8:92:A4': 'Samsung', 'E8:99:C4': 'Samsung', 'E8:B4:C8': 'Samsung',
  'E8:E5:D6': 'Samsung', 'EC:01:EE': 'Samsung', 'EC:0E:5C': 'Samsung',
  'EC:1F:72': 'Samsung', 'EC:5A:86': 'Samsung', 'EC:98:C1': 'Samsung',
  'EC:B5:09': 'Samsung', 'F0:27:65': 'Samsung', 'F0:45:2F': 'Samsung',
  'F0:5A:09': 'Samsung', 'F0:72:8C': 'Samsung', 'F0:C7:07': 'Samsung',
  'F0:D7:AF': 'Samsung', 'F0:E7:78': 'Samsung', 'F0:EB:0D': 'Samsung',
  'F0:EE:10': 'Samsung', 'F0:F7:86': 'Samsung', 'F4:09:D8': 'Samsung',
  'F4:3E:61': 'Samsung', 'F4:42:8F': 'Samsung', 'F4:60:E2': 'Samsung',
  'F4:7B:5E': 'Samsung', 'F4:84:8D': 'Samsung', 'F4:8C:FC': 'Samsung',
  'F4:8E:92': 'Samsung', 'F4:9F:54': 'Samsung', 'F4:A3:76': 'Samsung',
  'F4:AF:78': 'Samsung', 'F4:B6:88': 'Samsung', 'F4:BE:EC': 'Samsung',
  'F4:CA:E5': 'Samsung', 'F4:D9:FB': 'Samsung', 'F4:E6:E2': 'Samsung',
  'F8:04:2E': 'Samsung', 'F8:1D:78': 'Samsung', 'F8:3F:51': 'Samsung',
  'F8:4A:BF': 'Samsung', 'F8:5A:2A': 'Samsung', 'F8:95:C7': 'Samsung',
  'F8:CF:C5': 'Samsung', 'F8:D0:BD': 'Samsung', 'F8:E6:1A': 'Samsung',
  'FC:19:10': 'Samsung', 'FC:1F:19': 'Samsung', 'FC:3F:F5': 'Samsung',
  'FC:8F:90': 'Samsung', 'FC:A4:7A': 'Samsung', 'FC:F1:36': 'Samsung',
};

function lookupOUI(mac) {
  const oui = mac.toUpperCase().slice(0, 8);
  return OUI_DB[oui] || 'Desconocido';
}

function detectarTipo(fabricante, ip, gatewayIp) {
  if (ip === gatewayIp) return 'Router / Gateway';
  const f = fabricante.toLowerCase();
  if (f.includes('apple')) return 'Dispositivo Apple';
  if (f.includes('samsung')) return 'Dispositivo Samsung';
  if (f.includes('vmware') || f.includes('hyper-v') || f.includes('virtualbox')) return 'Máquina Virtual';
  if (f.includes('tp-link') || f.includes('huawei') || f.includes('xiaomi') || f.includes('d-link') || f.includes('netgear') || f.includes('asus') || f.includes('linksys')) return 'Router / AP';
  return 'Dispositivo Genérico';
}

function ping(ip, timeout = 500) {
  return new Promise((resolve) => {
    exec(`ping -n 1 -w ${timeout} ${ip}`, { encoding: 'utf-8' }, (err) => {
      resolve(!err); // true si respondió
    });
  });
}

async function pingSweep(subnet, onProgress) {
  const ips = [];
  for (let i = 1; i <= 254; i++) ips.push(`${subnet}.${i}`);

  const batchSize = 30;
  const activos = [];
  for (let i = 0; i < ips.length; i += batchSize) {
    const batch = ips.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(ip => ping(ip, 400)));
    results.forEach((ok, idx) => { if (ok) activos.push(batch[idx]); });
    if (onProgress) onProgress(Math.min(i + batchSize, 254), 254);
  }
  return activos;
}

async function obtenerDispositivos(gatewayIp) {
  const subnet = gatewayIp.split('.').slice(0, 3).join('.');
  console.log(`[Dispositivos] Haciendo ping sweep a ${subnet}.1 - ${subnet}.254...`);

  const activos = await pingSweep(subnet, (done, total) => {
    console.log(`[Dispositivos] Progreso: ${done}/${total} IPs`);
  });
  console.log(`[Dispositivos] ${activos.length} dispositivos respondieron al ping`);

  // Esperar un poco para que Windows actualice la tabla ARP
  await new Promise(r => setTimeout(r, 800));

  // Leer tabla ARP
  const arpOut = await run('arp -a');
  const dispositivos = [];
  const vistos = new Set();

  for (const line of arpOut.split(/\r?\n/)) {
    const m = line.trim().match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2})/i);
    if (!m) continue;
    const ip = m[1];
    const mac = m[2].replace(/-/g, ':').toUpperCase();
    if (vistos.has(ip)) continue;

    // Filtrar multicast, broadcast, localhost
    const firstOctet = parseInt(ip.split('.')[0]);
    if (firstOctet >= 224 && firstOctet <= 239) continue;
    if (ip === '255.255.255.255' || ip.startsWith('127.')) continue;

    // Solo incluir IPs que respondieron al ping (salvo gateway que siempre va)
    const esGateway = ip === gatewayIp;
    if (!esGateway && !activos.includes(ip)) continue;

    vistos.add(ip);
    const fabricante = lookupOUI(mac);
    const tipo = detectarTipo(fabricante, ip, gatewayIp);
    dispositivos.push({ ip, mac, fabricante, tipo, estado: 'Activo' });
  }

  // Agregar gateway si no aparece en ARP
  const tieneGateway = dispositivos.some(d => d.ip === gatewayIp);
  if (!tieneGateway && gatewayIp) {
    dispositivos.unshift({
      ip: gatewayIp,
      mac: 'N/A',
      fabricante: 'Desconocido',
      tipo: 'Router / Gateway',
      estado: 'Activo'
    });
  }

  return dispositivos.sort((a, b) => {
    if (a.tipo === 'Router / Gateway') return -1;
    if (b.tipo === 'Router / Gateway') return 1;
    return a.ip.localeCompare(b.ip, undefined, { numeric: true });
  });
}

module.exports = { obtenerDatos, guardarTxt, obtenerDispositivos };
