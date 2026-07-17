const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");


const app = express();

app.use(cors());
app.use(express.json());


const server = http.createServer(app);


const io = new Server(server, {
    cors: {
        origin: "*"
    }
});


// Estado atual da transmissão
let transmission = {
    video: null,
    startedAt: null,
    playing: false
};


// Página de teste
app.get("/", (req, res) => {

    res.send("Servidor de transmissão online!");

});


// Conexões Socket.IO
io.on("connection", (socket) => {


    console.log("Conectado:", socket.id);



    // Identificação do dispositivo
    socket.on("register", (data) => {


        socket.deviceType = data.type;


        console.log(
            "Dispositivo:",
            data.type,
            socket.id
        );


        // Se for player, manda o estado atual
        if(data.type === "player") {


            socket.emit(
                "sync-transmission",
                transmission
            );


        }


    });



    // Controle envia vídeo
    socket.on("play-video", (data) => {


        console.log(
            "Novo vídeo:",
            data.url
        );


        transmission = {

            video: data.url,

            startedAt: Date.now(),

            playing: true

        };


        // Envia para todos os players

        io.emit(
            "play-video",
            transmission
        );


    });




    // Pausar
    socket.on("pause-video", () => {


        transmission.playing = false;


        io.emit(
            "pause-video"
        );


    });




    // Continuar

    socket.on("resume-video", () => {


        transmission.playing = true;


        io.emit(
            "resume-video",
            transmission
        );


    });




    socket.on("disconnect", () => {


        console.log(
            "Desconectado:",
            socket.id
        );


    });


});



const PORT = process.env.PORT || 3000;


server.listen(PORT, () => {


    console.log(
        "Servidor rodando na porta",
        PORT
    );


});