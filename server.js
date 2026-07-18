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

/*
====================================
ESTADO GLOBAL DO SERVIDOR
====================================
*/

let players = 0;
let controls = 0;

/*
====================================
PLAYLIST
====================================
*/

let playlist = [];

let currentIndex = -1;

/*
====================================
TRANSMISSÃO
====================================
*/

let transmission = {
    video: null,
    startedAt: null,
    pausedAt: 0,
    playing: false,
    standby: true
};

/*
====================================
FUNÇÕES AUXILIARES
====================================
*/

function currentVideo() {

    if (
        currentIndex < 0 ||
        currentIndex >= playlist.length
    ) {
        return null;
    }

    return playlist[currentIndex];

}

function playlistState() {

    return {
        playlist,
        currentIndex
    };

}

function sendPlaylist() {

    io.emit(
        "playlist-updated",
        playlistState()
    );

}

function sendServerStatus() {

    io.emit(
        "server-status",
        {
            players,
            controls,
            transmission,
            playlist,
            currentIndex
        }
    );

}

function standbyMode() {

    transmission = {
        video: null,
        startedAt: null,
        pausedAt: 0,
        playing: false,
        standby: true
    };

    io.emit("stop-video");

    sendServerStatus();

}

function startTransmission(item) {

    transmission = {
        video: item.url,
        startedAt: Date.now(),
        pausedAt: 0,
        playing: true,
        standby: false
    };

    io.emit(
        "play-video",
        transmission
    );

    sendServerStatus();

}

app.get("/", (req, res) => {

    res.send("X-Stream Sync Server Online");

});
id="0z8q5h"
io.on("connection", (socket) => {


    console.log(
        "Conectado:",
        socket.id
    );


    /*
    ================================
    REGISTRO DE DISPOSITIVOS
    ================================
    */


    socket.on("register", (data) => {


        socket.deviceType = data.type;


        console.log(
            "Tipo conectado:",
            data.type
        );



        if(data.type === "player"){


            players++;


            /*
            Envia o estado atual
            para o novo player
            */


            socket.emit(
                "sync-transmission",
                transmission
            );


            socket.emit(
                "playlist-updated",
                playlistState()
            );



        }





        if(data.type === "control"){


            controls++;


            /*
            Envia informações
            para a central
            */


            socket.emit(
                "server-status",
                {

                    players,
                    controls,
                    transmission,
                    playlist,
                    currentIndex

                }
            );


            socket.emit(
                "playlist-updated",
                playlistState()
            );


        }



    });





    /*
    ================================
    DESCONECTAR
    ================================
    */


    socket.on("disconnect", () => {



        if(socket.deviceType === "player"){


            players--;


            if(players < 0)
                players = 0;


        }




        if(socket.deviceType === "control"){


            controls--;


            if(controls < 0)
                controls = 0;


        }



        console.log(
            "Saiu:",
            socket.id
        );



        sendServerStatus();



    });



});


/*
================================
ADICIONAR VÍDEO NA PLAYLIST
================================
*/

socket.on("add-video", (data) => {


    if(socket.deviceType !== "control")
        return;


    if(!data.url)
        return;



    const item = {

        id: Date.now().toString(),

        url: data.url,

        addedAt: Date.now()

    };



    playlist.push(item);



    /*
    Se não existe vídeo tocando,
    seleciona automaticamente o primeiro
    */


    if(
        currentIndex === -1 &&
        playlist.length === 1
    ){

        currentIndex = 0;

    }



    sendPlaylist();



});







/*
================================
REMOVER VÍDEO DA PLAYLIST
================================
*/


socket.on("remove-video", (data)=>{


    if(socket.deviceType !== "control")
        return;



    const index = playlist.findIndex(
        item => item.id === data.id
    );



    if(index === -1)
        return;



    playlist.splice(
        index,
        1
    );




    /*
    Ajusta o índice atual
    */


    if(currentIndex >= playlist.length){

        currentIndex = playlist.length - 1;

    }



    if(playlist.length === 0){

        currentIndex = -1;

        standbyMode();

    }



    sendPlaylist();



});








/*
================================
LIMPAR TODA PLAYLIST
================================
*/


socket.on("clear-playlist", ()=>{


    if(socket.deviceType !== "control")
        return;



    playlist = [];

    currentIndex = -1;



    standbyMode();



    sendPlaylist();



});








/*
================================
SELECIONAR VÍDEO DA LISTA
================================
*/


socket.on("select-video", (data)=>{


    if(socket.deviceType !== "control")
        return;



    const index = playlist.findIndex(

        item => item.id === data.id

    );



    if(index === -1)
        return;



    currentIndex = index;



    startTransmission(
        playlist[currentIndex]
    );



});


/*
================================
PAUSAR TRANSMISSÃO
================================
*/

socket.on("pause-video", ()=>{


    if(socket.deviceType !== "control")
        return;



    if(transmission.playing){


        transmission.pausedAt =
            (Date.now() - transmission.startedAt) / 1000;


    }



    transmission.playing = false;



    io.emit(
        "pause-video",
        {
            time: transmission.pausedAt
        }
    );



});








/*
================================
CONTINUAR TRANSMISSÃO
================================
*/


socket.on("resume-video", ()=>{


    if(socket.deviceType !== "control")
        return;



    transmission.startedAt =
        Date.now() -
        (transmission.pausedAt * 1000);



    transmission.playing = true;

    transmission.standby = false;



    io.emit(
        "resume-video",
        transmission
    );



});








/*
================================
SEEK (MUDAR TEMPO)
================================
*/


socket.on("seek-video", (data)=>{


    if(socket.deviceType !== "control")
        return;



    let tempo =
        Number(data.time);



    if(isNaN(tempo))
        return;



    transmission.startedAt =
        Date.now() -
        (tempo * 1000);



    transmission.pausedAt = tempo;



    io.emit(
        "seek-video",
        {
            time: tempo
        }
    );



});








/*
================================
PRÓXIMO VÍDEO
================================
*/


socket.on("next-video", ()=>{


    if(socket.deviceType !== "control")
        return;



    if(
        playlist.length === 0
    ){

        standbyMode();

        return;

    }




    if(
        currentIndex < playlist.length - 1
    ){

        currentIndex++;


        startTransmission(
            playlist[currentIndex]
        );


    }

    else{


        /*
        Chegou no fim da lista
        */

        standbyMode();


    }



});








/*
================================
VÍDEO ANTERIOR
================================
*/


socket.on("previous-video", ()=>{


    if(socket.deviceType !== "control")
        return;



    if(
        playlist.length === 0
    ){

        standbyMode();

        return;

    }




    if(currentIndex > 0){


        currentIndex--;


        startTransmission(
            playlist[currentIndex]
        );


    }



});








/*
================================
PARAR TRANSMISSÃO MANUALMENTE
================================
*/


socket.on("stop-video", ()=>{


    if(socket.deviceType !== "control")
        return;



    standbyMode();



});

/*
================================
PLAYER AVISA QUE TERMINOU
================================
*/

socket.on("video-ended", ()=>{


    if(socket.deviceType !== "player")
        return;



    console.log(
        "Vídeo terminou"
    );



    /*
    Verifica se existe próximo vídeo
    */


    if(
        currentIndex < playlist.length - 1
    ){


        currentIndex++;



        startTransmission(
            playlist[currentIndex]
        );



    }

    else{


        /*
        Não tem mais vídeos
        Volta para standby
        */


        standbyMode();


    }



});








/*
================================
PLAYER AVISA ERRO NO VÍDEO
================================
*/


socket.on("video-error", ()=>{


    if(socket.deviceType !== "player")
        return;



    console.log(
        "Erro no vídeo"
    );



    /*
    Tenta pular para o próximo
    */


    if(
        currentIndex < playlist.length - 1
    ){



        currentIndex++;



        startTransmission(
            playlist[currentIndex]
        );



    }

    else{


        standbyMode();


    }



});








/*
================================
VALIDAR SE EXISTE TRANSMISSÃO
================================
*/


socket.on("request-status", ()=>{


    socket.emit(
        "server-status",
        {

            players,

            controls,

            transmission,

            playlist,

            currentIndex

        }
    );


});

/*
================================
SINCRONIZAÇÃO GLOBAL
================================
*/

setInterval(()=>{


    if(
        transmission.video &&
        transmission.playing
    ){


        io.emit(
            "sync-time",
            {

                time:
                (Date.now() - transmission.startedAt) / 1000,


                serverTime:
                Date.now()


            }
        );


    }



},10000);








/*
================================
INICIALIZAÇÃO DO SERVIDOR
================================
*/


const PORT =
process.env.PORT || 3000;



server.listen(PORT, ()=>{


    console.log(
        "Servidor X-Stream rodando na porta",
        PORT
    );


});