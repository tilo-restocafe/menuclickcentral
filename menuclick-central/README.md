# 📊 MenuClick Central

Este repositorio contiene la aplicación **Central** de MenuClick. Es un concentrador universal diseñado para recibir los cierres de caja (arqueos Z) de todas tus sucursales y registrarlos directamente en el repositorio de GitHub de cada cliente en forma de almanaque diario (`cierres/AÑO/MES/dia-DIA-TURNO.json`). 

También procesa automáticamente los **vales de personal** incluidos en el cierre, descargando `empleados.json` de GitHub, descontando los importes directamente del sueldo base de cada empleado y registrándolo en su historial de cobros de forma automática.

---

## ⚙️ Configuración Rápida

1. Cloná o descargá esta carpeta.
2. Copiá el archivo `.env.example` y renombralo a `.env`:
   ```bash
   cp .env.example .env
   ```
3. Completá las variables con las credenciales de tu cliente:
   * `GITHUB_TOKEN`: Tu token de acceso de GitHub (con permisos de lectura/escritura en el repositorio).
   * `GITHUB_USER`: El dueño del repositorio de GitHub (ej: `tilo-restocafe`).
   * `GITHUB_REPO`: El repositorio donde se guardará la información (ej: `cartaaguero`).
   * `COMPROC_SUCURSAL_ID`: Un identificador para el local.
   * `PORT`: Puerto de escucha del servidor (por defecto `3000`).

---

## 🚀 Cómo Subirlo a GitHub

1. Desde la terminal dentro de esta carpeta (`menuclick-central`), inicializá tu repositorio git:
   ```bash
   git init
   ```
2. Añadí los archivos y haz tu primer commit:
   ```bash
   git add .
   git commit -m "feat: MenuClick Central Inicial"
   ```
3. Creá un repositorio vacío en tu cuenta de GitHub (ejemplo: `menuclick-central`).
4. Vinculá tu repositorio local con GitHub y subí la rama principal:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/menuclick-central.git
   git branch -M main
   git push -u origin main
   ```

---

## ☁️ Despliegue Gratuito en la Nube

Para tener esta API corriendo las 24 horas en internet sin costo, podés usar plataformas gratuitas vinculando tu repositorio de GitHub:

### Opción A: Render (Recomendado)
1. Registrate gratis en [Render.com](https://render.com) e inicia sesión con tu cuenta de GitHub.
2. Hacé clic en **New +** y seleccioná **Web Service**.
3. Seleccioná tu repositorio `menuclick-central` de la lista.
4. Configurá las siguientes opciones:
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `node server.js`
   * **Instance Type**: `Free`
5. En la sección **Environment Variables**, agregá las variables de tu archivo `.env` (`GITHUB_TOKEN`, `GITHUB_USER`, etc.).
6. Hacé clic en **Deploy Web Service**. Render te dará una URL pública (ejemplo: `https://menuclick-central.onrender.com`).

### Opción B: Railway
1. Inicia sesión en [Railway.app](https://railway.app) con tu GitHub.
2. Hacé clic en **New Project** y seleccioná **Deploy from GitHub repo**.
3. Elegí tu repositorio `menuclick-central`.
4. Añadí las variables de entorno en la pestaña **Variables**.
5. Railway compilará y desplegará tu servidor automáticamente y te generará una URL pública.

---

## 📡 Endpoint de Recepción
* **Ruta**: `POST /api/recepcion-cierres`
* **Cuerpo esperado (JSON)**:
```json
{
  "id": "cie-1782713577012",
  "fecha_jornada": "2026-07-04",
  "turno": "noche",
  "responsable_caja": "Sofía Cajera",
  "datos_sistema": {
    "ventas_totales": 121000,
    "efectivo_teorico": 100000,
    "tarjeta_debito": 11000,
    "tarjeta_credito": 10000,
    "qr_digital": 0,
    "gastos": 5000,
    "vales_deducidos": 5000,
    "caja_neta_teorica": 90000
  },
  "conteo_real": {
    "efectivo_fisico": 90000,
    "diferencia": 0,
    "notas": "Caja cuadrada."
  },
  "vales_detallados": [
    {
      "id": "val-test-999",
      "tipo": "vale",
      "detalle": "Adelanto almuerzo fin de semana",
      "monto": 5000,
      "fecha": "2026-07-04T22:30:00.000Z",
      "empleadoId": "emp-moz-tt-08",
      "empleadoNombre": "Sofia Sillas (TT)"
    }
  ]
}
```
