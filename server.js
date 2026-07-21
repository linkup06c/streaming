const express = require('express');
const http = require('http');
const { Server } = require('ws');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const server = http.createServer(app);
const wss = new Server({ server });

// Estado global absoluto na nuvem
let estadoTransmissao = {
    url: "",
    playing: false,
    currentTime: 0,
    updatedAt: Date.now()
};

// Função auxiliar para calcular o tempo atual caso esteja tocando
function obterTempoAtual() {
    if (!estadoTransmissao.playing) {
        return estadoTransmissao.currentTime;
    }
    const segundosDecorridos = (Date.now() - estadoTransmissao.updatedAt) / 1000;
    return estadoTransmissao.currentTime + segundosDecorridos;
}

// --- ROTAS HTTP ---
app.post('/enviar', (req, res) => {
    const { url } = req.body;
    if (url) {
        estadoTransmissao.url = url;
        estadoTransmissao.playing = true;
        estadoTransmissao.currentTime = 0;
        estadoTransmissao.updatedAt = Date.now();
        
        console.log(`[HTTP] Nova mídia na nuvem: ${url}`);
        
        broadcast({
            tipo: 'midia',
            url: url,
            playing: true,
            currentTime: 0,
            updatedAt: estadoTransmissao.updatedAt
        });
    }
    res.status(200).json({ status: 'ok' });
});

app.post('/controle', (req, res) => {
    const { acao, time } = req.body;
    if (acao) {
        console.log(`[HTTP] Comando remoto recebido: ${acao}`);

        // Atualiza o tempo atual antes de mudar o estado
        if (acao === 'pause' || acao === 'play' || acao === 'resume') {
            estadoTransmissao.currentTime = time !== undefined ? time : obterTempoAtual();
            estadoTransmissao.updatedAt = Date.now();
        }

        if (acao === 'pause') {
            estadoTransmissao.playing = false;
        } else if (acao === 'play' || acao === 'resume') {
            estadoTransmissao.playing = true;
        }

        broadcast({
            tipo: 'comando',
            acao: acao,
            playing: estadoTransmissao.playing,
            currentTime: estadoTransmissao.currentTime,
            updatedAt: estadoTransmissao.updatedAt
        });
    }
    res.status(200).json({ status: 'ok' });
});

app.get('/estado', (req, res) => {
    res.json({
        ...estadoTransmissao,
        currentTimeCalculado: obterTempoAtual()
    });
});

// --- WEBSOCKET (Tempo Real / Sincronia Total) ---
wss.on('connection', (ws) => {
    console.log('[WS] Novo dispositivo conectado!');

    // Sincroniza o estado atual exato com o novo dispositivo que acabou de entrar
    if (estadoTransmissao.url) {
        ws.send(JSON.stringify({
            tipo: 'sync-transmission',
            url: estadoTransmissao.url,
            playing: estadoTransmissao.playing,
            currentTime: obterTempoAtual(),
            updatedAt: estadoTransmissao.updatedAt
        }));
    }

    ws.on('message', (message) => {
        try {
            const dados = JSON.parse(message);
            console.log('[WS] Mensagem recebida:', dados);

            if (dados.tipo === 'midia' && dados.url) {
                estadoTransmissao.url = dados.url;
                estadoTransmissao.playing = true;
                estadoTransmissao.currentTime = 0;
                estadoTransmissao.updatedAt = Date.now();
            } else if (dados.tipo === 'comando') {
                if (dados.acao === 'pause') {
                    estadoTransmissao.currentTime = dados.currentTime !== undefined ? dados.currentTime : obterTempoAtual();
                    estadoTransmissao.playing = false;
                } else if (dados.acao === 'play' || dados.acao === 'resume') {
                    estadoTransmissao.currentTime = dados.currentTime !== undefined ? dados.currentTime : obterTempoAtual();
                    estadoTransmissao.playing = true;
                    estadoTransmissao.updatedAt = Date.now();
                }
            }

            broadcast(dados);
        } catch (e) {
            console.error('[WS] Erro ao parsear mensagem:', e);
        }
    });

    ws.on('close', () => {
        console.log('[WS] Dispositivo desconectado.');
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
    console.log(`Servidor de Cloud Live rodando na porta ${PORT}`);
});
