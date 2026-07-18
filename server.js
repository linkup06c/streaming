const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");


const app = express();

app.use(cors());
app.use(express.json());


const server = http.createServer(app);


const io = new Server(server, {

    cors:{
        origin:"*"
    }

});



let transmission = {

    video:null,

    startedAt:null,

    pausedAt:0,

    playing:false

};



let players = 0;



app.get("/",(req,res)=>{

    res.send("X-Stream Sync Server Online");

});





io.on("connection",(socket)=>{


console.log(
"Conectado:",
socket.id
);





socket.on("register",(data)=>{


socket.deviceType=data.type;



console.log(
"Tipo:",
data.type
);



if(data.type==="player"){


players++;


socket.emit(
"sync-transmission",
transmission
);


}





if(data.type==="control"){


socket.emit(
"server-status",
{

players,

transmission

}

);


}



});









// RECEBE NOVO VÍDEO


socket.on("play-video",(data)=>{


if(socket.deviceType!=="control")
return;



transmission={


video:data.url,

startedAt:Date.now(),

pausedAt:0,

playing:true


};



io.emit(
"play-video",
transmission
);



});









// PAUSAR


socket.on("pause-video",()=>{


if(socket.deviceType!=="control")
return;



if(transmission.playing){


transmission.pausedAt =

(Date.now()-transmission.startedAt)/1000;


}



transmission.playing=false;



io.emit(
"pause-video",
{

time:transmission.pausedAt

}

);



});









// CONTINUAR


socket.on("resume-video",()=>{


if(socket.deviceType!=="control")
return;



transmission.startedAt =

Date.now() -

(transmission.pausedAt*1000);



transmission.playing=true;



io.emit(
"resume-video",
transmission
);



});









// SINCRONIZAR MANUALMENTE


socket.on("seek-video",(data)=>{


if(socket.deviceType!=="control")
return;



let tempo =
Number(data.time);



if(isNaN(tempo))
return;



transmission.startedAt =

Date.now() -

(tempo*1000);



transmission.pausedAt=tempo;



io.emit(
"seek-video",
{

time:tempo

}

);



});









// SINCRONIZAÇÃO LEVE

setInterval(()=>{


if(
transmission.video &&
transmission.playing
){



io.emit(
"sync-time",
{

time:
(Date.now()-transmission.startedAt)/1000,

serverTime:
Date.now()

}

);



}



},10000);









socket.on("disconnect",()=>{


if(socket.deviceType==="player"){

players--;

}



console.log(
"Saiu:",
socket.id
);



});



});





const PORT =
process.env.PORT || 3000;



server.listen(PORT,()=>{


console.log(
"Servidor rodando na porta",
PORT
);


});