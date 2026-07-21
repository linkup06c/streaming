const express = require('http');
const { Server } = require('ws');
const bodyParser = require('body-parser');

const app = require('express')();
app.use(bodyParser.json());

// Cria o servidor HTTP combinado com WebSocket
const server = express.createServer(app);
const wss = new Server({ server });

// Variáveis de estado global para guardar a última mídia e o último comando
let ultimaMidia = { url: "" };
let ultimoComando = { acao: "" };

// --- 1. ROTAS HTTP ANTIGAS (Mantidas para compatibilidade) ---

app.post('/enviar', (req, res) => {
    const { url } = req.body;
    if (url) {
        ultimaMidia.url = url;
        console.log(`[HTTP] Mídia recebida: ${url}`);
        
        // Repassa também para todos conectados via WebSocket
        broadcast({ tipo: 'midia', url: url });
    }
    res.status(200).json({ status: 'ok' });
});

app.post('/controle', (req, res) => {
    const { acao } = req.body;
    if (acao) {
        ultimoComando.acao = acao;
        console.log(`[HTTP] Comando recebido: ${acao}`);
        
        // Repassa também para todos conectados via WebSocket
        broadcast({ tipo: 'comando', acao: acao });
    }
    res.status(200).json({ status: 'ok' });
});

// Rotas de leitura para a TV/Player buscar o estado atual se precisar
app.get('/obter-midia', (req, res) => {
    res.json(ultimaMidia);
});

app.get('/obter-comando', (req, res) => {
    res.json(ultimoComando);
});


// --- 2. GERENCIAMENTO DE WEBSOCKET (Tempo Real) ---

wss.on('connection', (ws) => {
    console.log('[WS] Novo cliente conectado!');

    // Envia o estado atual assim que o cliente conecta
    ws.send(JSON.stringify({ tipo: 'midia', url: ultimaMidia.url }));

    // Ouve mensagens vindas do App ou do Player
    ws.on('message', (message) => {
        try {
            const dados = JSON.parse(message);
            console.log('[WS] Mensagem recebida:', dados);

            if (dados.tipo === 'midia') {
                ultimaMidia.url = dados.url;
            } else if (dados.tipo === 'comando') {
                ultimoComando.acao = dados.acao;
            }

            // Reenvia (broadcasting) para TODOS os conectados (App, TV, etc.)
            broadcast(dados);
        } catch (e) {
            console.error('[WS] Erro ao processar mensagem JSON:', e);
        }
    });

    ws.on('close', () => {
        console.log('[WS] Cliente desconectado.');
    });
});

// Função Auxiliar para enviar dados a todos conectados no WebSocket
function broadcast(data) {
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(payload);
        }
    });
}

// Inicia o servidor na porta que o Render definir (ou 3000 localmente)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
