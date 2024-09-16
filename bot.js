const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const qrcode = require('qrcode-terminal');  // Asegúrate de tener instalado qrcode-terminal

function normalizarTexto(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const dialogosPath = './dialogos.json';
let dialogos = {};
if (fs.existsSync(dialogosPath)) {
    dialogos = JSON.parse(fs.readFileSync(dialogosPath, 'utf8'));
} else {
    console.error('No se encontró el archivo de diálogos.');
    process.exit(1);
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']  // Mejora la estabilidad en diferentes sistemas
    },
    debug: true  // Habilita la depuración para ver detalles sobre la ejecución
});

client.on('qr', qr => {
    console.log('Por favor escanea el QR siguiente:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Cliente está listo!');
});

client.on('message', async message => {
    const chatId = message.from;
    const texto = normalizarTexto(message.body);

    if (!sessionStorage[chatId]) {
        sessionStorage[chatId] = { lastProcessedMessageId: null, contextoActual: null, subOpciones: null };
    }

    if (message.id === sessionStorage[chatId].lastProcessedMessageId) {
        console.log('Mensaje duplicado detectado, ignorando...');
        return;
    }
    sessionStorage[chatId].lastProcessedMessageId = message.id;

    if (texto === '!start') {
        client.sendMessage(chatId, "Hola! Por favor, escribe 'asistente' o 'gap' para comenzar.");
        sessionStorage[chatId] = { contextoActual: null, subOpciones: null };
    } else {
        let contextoEncontrado = false;
        if (sessionStorage[chatId].contextoActual && sessionStorage[chatId].subOpciones) {
            const numOption = parseInt(texto) - 1;
            const subOpcionesKeys = Object.keys(sessionStorage[chatId].subOpciones);
            if (!isNaN(numOption) && numOption >= 0 && numOption < subOpcionesKeys.length) {
                client.sendMessage(chatId, sessionStorage[chatId].subOpciones[subOpcionesKeys[numOption]]);
                contextoEncontrado = true;
            }
        }

        if (!contextoEncontrado) {
            Object.keys(dialogos).forEach(contexto => {
                if (texto === contexto) {
                    sessionStorage[chatId] = { contextoActual: contexto, subOpciones: null };
                    const opcionesList = Object.keys(dialogos[contexto].opciones)
                        .map(opcion => opcion)
                        .join(', ');
                    client.sendMessage(chatId, `¿Qué información necesitas acerca del ${contexto}? Puedes preguntar por: ${opcionesList}`);
                    contextoEncontrado = true;
                } else if (sessionStorage[chatId].contextoActual && texto in dialogos[sessionStorage[chatId].contextoActual].opciones) {
                    const detallesOpcion = dialogos[sessionStorage[chatId].contextoActual].opciones[texto];
                    client.sendMessage(chatId, detallesOpcion.respuesta);
                    if ('subopciones' in detallesOpcion) {
                        sessionStorage[chatId].subOpciones = detallesOpcion.subopciones;
                        const subopciones = Object.keys(detallesOpcion.subopciones)
                            .map((sub, idx) => `${idx + 1}. ${sub}`)
                            .join('\n');
                        client.sendMessage(chatId, "Puedes preguntar sobre:\n" + subopciones);
                    } else {
                        sessionStorage[chatId].subOpciones = null;
                    }
                    contextoEncontrado = true;
                }
            });
        }

        if (!contextoEncontrado) {
            client.sendMessage(chatId, "Lo siento, no entiendo esa opción. Por favor, intenta nuevamente.");
        }
    }
});

const sessionStorage = {};

client.initialize();
