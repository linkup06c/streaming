const express = require('express');
const http = require('http');
const { Server } = require('ws');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const server = http.createServer(app);
const wss = new Server({ server });

// Estado global de transmissão contínua na nuvem (Cloud Live State)
let estadoTransmissao = {
    url: "",
    playing: false,
    startedAt: 0,
    ultimoComando: ""
};

// --- ROTAS HTTP ---
app.post('/enviar', (req, res) => {
    const { url } = req.body;
    if (url) {
        estadoTransmissao.url = url;
        estadoTransmissao.playing = true;
        estadoTransmissao.startedAt = Date.now();
        console.log(`[HTTP] Nova mídia na nuvem: ${url}`);
        
        broadcast({
            tipo: 'midia',
            url: url,
            startedAt: estadoTransmissao.startedAt,
            playing: true
        });
    }
    res.status(200).json({ status: 'ok' });
});

app.post('/controle', (req, res) => {
    const { acao } = req.body;
    if (acao) {
        estadoTransmissao.ultimoComando = acao;
        console.log(`[HTTP] Comando remoto recebido: ${acao}`);

        if (acao === 'pause') estadoTransmissao.playing = false;
        if (acao === 'play' || acao === 'resume') estadoTransmissao.playing = true;

        broadcast({
            tipo: 'comando',
            acao: acao,
            playing: estadoTransmissao.playing
        });
    }
    res.status(200).json({ status: 'ok' });
});

app.get('/estado', (req, res) => {
    res.json(estadoTransmissao);
});

// --- WEBSOCKET (Tempo Real / Sincronia Total) ---
wss.on('connection', (ws) => {
    console.log('[WS] Novo cliente conectado (Player ou App)');

    // Envia o estado atual da nuvem imediatamente para sincronizar qualquer novo dispositivo
    if (estadoTransmissao.url) {
        ws.send(JSON.stringify({
            tipo: 'sync-transmission',
            url: estadoTransmissao.url,
            startedAt: estadoTransmissao.startedAt,
            playing: estadoTransmissao.playing
        }));
    }

    ws.on('message', (message) => {
        try {
            const dados = JSON.parse(message);
            console.log('[WS] Mensagem recebida:', dados);

            if (dados.tipo === 'midia' && dados.url) {
                estadoTransmissao.url = dados.url;
                estadoTransmissao.playing = true;
                estadoTransmissao.startedAt = dados.startedAt || Date.now();
            } else if (dados.tipo === 'comando' && dados.acao) {
                estadoTransmissao.ultimoComando = dados.acao;
            }

            broadcast(dados);
        } catch (e) {
            console.error('[WS] Erro ao parsear mensagem:', e);
        }
    });

    ws.on('close', () => {
        console.log('[WS] Cliente desconectado.');
    });
});

function broadcast(data) {
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(payload);
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de Cloud Streaming rodando na porta ${PORT}`);
});
