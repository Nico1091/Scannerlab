# ScannerLab - Analizador de Red Local

ScannerLab es una aplicación de escaneo de red local que se ejecuta en Windows y muestra en tiempo real información sobre tu conexión WiFi, dispositivos conectados, latencia, velocidad de internet y métricas de red. Todo el procesamiento se hace localmente mediante comandos del sistema operativo.

---

## Estructura del Proyecto

| Archivo | Propósito |
|---------|-----------|
| `index.html` | Interfaz de usuario (UI), CSS y JavaScript del frontend |
| `escaneo.js` | Backend: ejecuta comandos de red, parsea resultados, identifica dispositivos |
| `server.js` | Servidor HTTP: expone endpoints REST, sirve archivos estáticos |

---

## Descripción de Funcionamiento

### Información de Red WiFi

Como podemos ver, la aplicación muestra datos como los DNS, la velocidad de internet y demás. Es difícil seguir el dato de la latencia ya que este dato se suele caer porque no estoy como tal en modo monitor. Sin embargo, estoy escaneando estos datos en tiempo real ejecutando comandos locales como `netsh wlan show interfaces` para mostrar información detallada sobre la conexión WiFi.

El comando `netsh wlan show interfaces` devuelve datos como:
- **SSID**: Nombre de la red WiFi (en este caso "Laura Montoya")
- **BSSID**: MAC del router/punto de acceso
- **Tipo de radio**: Tecnología WiFi (802.11n, 802.11ac, etc.)
- **Canal**: Canal de frecuencia actual (en este caso canal 3, el cual por obvias razones no pudimos cambiar)
- **Señal**: Porcentaje aproximado de señal WiFi. Este parece ser un dato estático y no recomiendo fiarse completamente de este valor.
- **Velocidad de recepción/transmisión**: Velocidad negociada por el adaptador WiFi
- **Estado**: Estado de la conexión (conectado/desconectado)
- **Dirección física**: MAC del adaptador WiFi

Además, mediante PowerShell se obtienen datos adicionales:
- **IP Local**: Dirección IPv4 asignada (ej: `192.168.20.60`)
- **Gateway**: Puerta de enlace predeterminada (ej: `192.168.20.1`)
- **Máscara**: Se muestra en formato CIDR (ej: `/24`). Pese a esto, se sabe que `/24` trata de redes locales y que su equivalente es `255.255.255.0`.
- **DNS**: Servidores DNS configurados (ej: `190.157.8.101`, `190.157.8.109`)

Todo esto se procesa en el backend (`escaneo.js`) mediante expresiones regulares que parsean la salida de cada comando, y se sirve al frontend mediante el endpoint `GET /api/scan`.

---

### Métricas en Vivo (Live Strip)

En la parte superior de la interfaz hay cuatro tarjetas que se actualizan automáticamente:

| Métrica | Comando / Fuente | Frecuencia |
|---------|------------------|------------|
| **Señal WiFi** | `netsh wlan show interfaces` → parseo de `%` de señal | Cada 5 segundos |
| **Velocidad WiFi** | `netsh wlan show interfaces` → Rx / Tx Mbps | Cada 5 segundos |
| **Velocidad Internet** | Descarga de `speed.cloudflare.com/__down?bytes=200000` | Cada 20 segundos |
| **Latencia Gateway** | `ping -n 1 -w 1000 <gateway>` | Cada 5 segundos |

La velocidad de internet se calcula midiendo cuántos bytes llegan y en cuánto tiempo:
`Mbps = (bytes * 8 / segundos) / 1_000_000`

---

### Dispositivos Conectados

Mi aplicación además muestra los dispositivos conectados a la red. Estos me parecen bastante funcionales ya que encuentra los dispositivos conectados en tiempo real y muestra que claramente están activos.

El escaneo de dispositivos (`obtenerDispositivos`) realiza los siguientes pasos:

1. **Descubrimiento UPnP**: Envía un mensaje multicast SSDP a `239.255.255.250:1900` para detectar dispositivos compatibles (Smart TVs, routers, impresoras, etc.).
2. **Ping Sweep**: Ejecuta `ping -n 1` a todas las IPs del rango de la red local. Solo las que responden se consideran activas.
3. **Resolución de nombres**: Usa `nbtstat -A <ip>`, `Resolve-DnsName <ip>` y LLMNR para obtener hostnames.
4. **Escaneo de puertos**: Intenta conectar a puertos comunes (21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 3306, 3389, 5900, 8080, 8443, 8888) para identificar servicios activos.
5. **TTL Fingerprinting**: Obtiene el TTL de la respuesta ICMP para inferir el sistema operativo:
   - TTL 64 → Linux / Android / iOS / MacOS
   - TTL 128 → Windows
   - TTL 255 → Router / Switch / Solaris
6. **Tabla ARP**: Ejecuta `arp -a` para obtener la MAC de cada IP activa.
7. **Identificación de fabricante**: La MAC se consulta contra una base de datos local de OUI.
8. **Clasificación por tipo**: Router, PC, Móvil/Tablet, Smart TV, IoT, etc.

Como podemos ver, la aplicación muestra datos como el Gateway, un aproximado de porcentaje de señal (dato estático, no recomendado fiarse completamente), la IP local, el Gateway y la máscara (mostrada como `/24`).

**Endpoint:** `GET /api/devices`

---

### Información Detallada del Dispositivo (Modal)

Al hacer clic en un dispositivo, se abre un modal con información detallada:

| Dato | Fuente |
|------|--------|
| IP | Parámetro de la URL |
| MAC | `arp -a <ip>` (con reintentos si no aparece) |
| Fabricante | Base de datos OUI local (`lookupOUI`) |
| TTL / OS | TTL de la respuesta ICMP |
| Estado | Resultado del ping |
| Latencia (min/max/avg) | `ping -n 4` |
| Pérdida de paquetes | Parseo del output del ping |
| NetBIOS Name | `nbtstat -A <ip>` |
| Gateway / Máscara / DNS | Datos del escaneo principal |
| WiFi | SSID, señal, velocidad, banda (de tu conexión) |
| Traceroute | `tracert -d -h 15 <ip>` |
| Banners | Conexión TCP a puertos comunes |
| DHCP | `ipconfig /all` |

**Latencia en vivo en el modal:**
- Comando: `ping -n 1` al IP del dispositivo
- Frecuencia: cada 2.5 segundos
- Endpoint: `GET /api/ping/:ip`
- Se actualiza en tiempo real sin recargar

---

### Diseño de la Interfaz (Estilo Oficina)

La UI se construyó con CSS puro, sin frameworks externos.

**Paleta de colores:**
- Fondo: `#F2EEE9` (hueso / beige)
- Tarjetas: `#FFFFFF` con borde `#DCD6CE`
- Acento salvia: `#8A9E8E`
- Acento terracota: `#B89A82`
- Acento acero: `#A0B4C0`
- Texto principal: `#3D3833`
- Texto secundario: `#7A756F`

**Animaciones:**
- `fadeInUp` al cargar cada tarjeta
- `livePulse` en el punto verde de métricas en vivo
- Hover con elevación suave (`transform: translateY(-3px)`)

**Responsive:** Grid adaptable con `auto-fit` y media query a 540px.

---

## Flujo de Datos Completo

```
Usuario -> Navegador (index.html)
  -> fetch('/api/scan') -> server.js -> escaneo.js -> netsh + PowerShell
  <- JSON con datos de red <-

  -> fetch('/api/devices') -> server.js -> escaneo.js -> ping sweep + ARP + UPnP + nbtstat
  <- JSON con lista de dispositivos <-

  -> fetch('/api/wifi/live') -> cada 5s -> obtenerWiFiLive() -> netsh
  <- JSON con señal y velocidad WiFi <-

  -> fetch('/api/speed') -> cada 20s -> measureInternetSpeed() -> https.get(cloudflare)
  <- JSON con Mbps <-

  -> fetch('/api/ping/:ip') -> cada 5s (gateway) / 2.5s (modal) -> pingLive() -> ping
  <- JSON con ms <-
```

---

## Instalación y Ejecución

1. Requisito: Node.js instalado
2. Abrir terminal en la carpeta del proyecto
3. Ejecutar: `node server.js`
4. Abrir navegador en: `http://localhost:3001`

---

## Notas Técnicas

- **Solo funciona en Windows** porque usa `netsh`, `arp`, `nbtstat`, `ipconfig` y cmdlets de PowerShell.
- **No requiere privilegios de administrador** para la mayoría de funciones. Algunas características avanzadas (como captura de paquetes) sí los necesitan.
- **No se conecta a servidores externos** excepto:
  - `speed.cloudflare.com` (test de velocidad)
  - Posibles búsquedas web para identificación de dispositivos (si LM Studio no está disponible)
- **Todo el escaneo es local**: los pings, ARP y descubrimientos se hacen dentro de tu red LAN.
