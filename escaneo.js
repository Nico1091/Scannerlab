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

module.exports = { obtenerDatos, guardarTxt };
