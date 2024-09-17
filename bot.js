const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

function normalizarTexto(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const dialogosPath = './dialogos.json';
let dialogos = {};
if (fs.existsSync(dialogosPath)) {
    dialogos = JSON.parse(fs.readFileSync(dialogosPath, 'utf8'))['gap'];
} else {
    console.error('No se encontró el archivo de diálogos.');
    process.exit(1);
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

client.on('qr', qr => {
    console.log('Por favor escanea el QR siguiente:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Cliente está listo!');
});

const sessionStorage = {};

client.on('message', async message => {
    const chatId = message.from;
    const texto = normalizarTexto(message.body);

    if (!sessionStorage[chatId]) {
        sessionStorage[chatId] = { subOpciones: null };
    }

    if (texto === 'hola') {
        const opcionesList = Object.keys(dialogos.opciones)
            .map((opcion, idx) => `${String.fromCharCode(97 + idx)}. ${opcion}`)
            .join('\n');
        client.sendMessage(chatId, `Hola! ¿Qué información necesitas sobre GAP? Puedes preguntar por:\n${opcionesList}\n\nDigita la letra de la pregunta para obtener una respuesta.`);
    } else {
        // Manejo de subopciones numéricas
        if (!isNaN(texto) && sessionStorage[chatId].subOpciones) {
            const numeroElegido = parseInt(texto) - 1;
            const subOpcionesKeys = Object.keys(sessionStorage[chatId].subOpciones);
            if (numeroElegido >= 0 && numeroElegido < subOpcionesKeys.length) {
                client.sendMessage(chatId, sessionStorage[chatId].subOpciones[subOpcionesKeys[numeroElegido]]);
                return;
            }
        }

        const index = texto.charCodeAt(0) - 97;
        if (index >= 0 && index < Object.keys(dialogos.opciones).length) {
            const opcionElegida = Object.keys(dialogos.opciones)[index];
            const respuesta = dialogos.opciones[opcionElegida].respuesta;
            client.sendMessage(chatId, respuesta);
            if ('subopciones' in dialogos.opciones[opcionElegida]) {
                sessionStorage[chatId].subOpciones = dialogos.opciones[opcionElegida].subopciones;
                const subopciones = Object.keys(dialogos.opciones[opcionElegida].subopciones)
                    .map((sub, idx) => `${idx + 1}. ${sub}`)
                    .join('\n');
                client.sendMessage(chatId, "También puedes preguntar sobre:\n" + subopciones + "\n\nDigita el número de la subopción para obtener más detalles.");
            } else {
                sessionStorage[chatId].subOpciones = null;
            }
        } else {
            client.sendMessage(chatId, "Lo siento, no entiendo esa opción. Por favor, intenta nuevamente.");
        }
    }
});

client.initialize();
