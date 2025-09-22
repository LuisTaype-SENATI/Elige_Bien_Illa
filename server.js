import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;

import qrcode from "qrcode-terminal";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ========================
// 🔹 Definir __dirname en ES Modules
// ========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ========================
// 🔹 Configuración CORS
// ========================
const corsOptions = {
    origin: ["https://eligebien.psicoilla.com"], // frontend en Hostgator
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: true
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ========================
// 🔹 Middleware
// ========================
app.use(bodyParser.json());

// ========================
// 🔹 Inicializar WhatsApp
// ========================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

let whatsappReady = false;
let qrActual = null;

client.on("qr", qr => {
    qrActual = qr;
    console.log("📲 Escanea este QR con tu WhatsApp:");
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    whatsappReady = true;
    qrActual = null; // limpiar el QR porque ya está conectado
    console.log("✅ WhatsApp Web conectado correctamente!");
});

client.on("auth_failure", msg => {
    whatsappReady = false;
    console.error("❌ Error de autenticación:", msg);
});

client.initialize();

// ========================
// 🔹 Preparar imagen para los mensajes
// ========================
const rutaImagen = path.join(__dirname, "./mindi_wsp.png"); 
let media = null;

try {
    const imagenBase64 = fs.readFileSync(rutaImagen, { encoding: "base64" });
    media = new MessageMedia("image/png", imagenBase64, "mindi_wsp.png");
    console.log("✅ Imagen cargada correctamente:", rutaImagen);
} catch (error) {
    console.error("❌ Error al cargar la imagen:", error);
    media = null;
}

// ========================
// 🔹 Endpoint: Estado de WhatsApp
// ========================
app.get("/whatsapp-status", (req, res) => {
    res.json({ connected: whatsappReady });
});

// ========================
// 🔹 Endpoint: Obtener QR
// ========================
app.get("/whatsapp-qr", (req, res) => {
    if (qrActual) {
        res.json({ qr: qrActual });
    } else {
        res.json({ qr: null, message: "No se necesita QR, WhatsApp ya está conectado" });
    }
});

// ========================
// 🔹 Endpoint para enviar mensajes
// ========================
app.post("/send-messages", async (req, res) => {
    const estudiantes = req.body;

    if (!Array.isArray(estudiantes) || estudiantes.length === 0) {
        return res.status(400).json({ success: false, message: "Lista de estudiantes vacía o inválida" });
    }

    if (!whatsappReady) {
        return res.status(503).json({ success: false, message: "WhatsApp no está conectado. Escanea el QR primero." });
    }

    try {
        for (let est of estudiantes) {
            if (!est.telefono_apoderado) continue;

            // 📞 Formato internacional (ej. Perú: 51)
            let numero = est.telefono_apoderado.replace(/\D/g, "");
            if (!numero.startsWith("51")) {
                numero = "51" + numero;
            }
            const chatId = numero + "@c.us";

            // 📩 Mensaje personalizado
            const mensaje = `
👋 Hola estimado ${est.apoderado},

Nos complace informarle que su hijo(a) ${est.nombre} ${est.apellido} ha sido registrado en el ✨ Sistema Vocacional ✨.

🔑 Credenciales de acceso:
👤 Usuario: ${est.nombre_usuario}
🔒 Contraseña: ${est.contrasena}

🌐 Ingrese a: https://eligebien.psicoilla.com/

📅 Le recomendamos que su hijo(a) inicie sesión lo antes posible y cambie su contraseña por motivos de seguridad 🔐.

Si tiene alguna consulta, no dude en contactarnos.  
Gracias por su confianza 🙏 y esperamos acompañar el desarrollo académico de su hijo(a) 📚.
            `;

            // 📎 Enviar mensaje con imagen (si está cargada)
            if (media) {
                await client.sendMessage(chatId, media, { caption: mensaje });
            } else {
                await client.sendMessage(chatId, mensaje);
            }

            console.log(`✅ Mensaje enviado a ${est.apoderado} (${numero})`);
        }

        res.json({ success: true, message: "Mensajes enviados correctamente" });
    } catch (error) {
        console.error("❌ Error al enviar mensajes:", error);
        res.status(500).json({ success: false, message: "Error al enviar mensajes" });
    }
});

// ========================
// 🔹 Servidor Express
// ========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});
