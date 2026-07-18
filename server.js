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



// Estado central da transmissão

let transmission = {

    video:null,

    startedAt:null,

    pausedAt:0,

    playing:false

};



// teste

app.get("/",(req,res)=>{

    res.send("X-Stream Server Online");

});




// lista de players conectados

let players = 0;



io.on("connection",(socket)=>{


console.log(
"Conectado:",
socket.id
);



// registro

socket.on("register",(data)=>{


socket.deviceType=data.type;



console.log(
"Tipo:",
data.type
);



// player recebe estado atual

if(data.type==="player"){


players++;


socket.emit(
"sync-transmission",
transmission
);


}



// controle recebe confirmação


if(data.type==="control"){


socket.emit(
"server-status",
{

players:players,
transmission:transmission

}

);


}



});





// ===============================
// NOVO VÍDEO
// ===============================


socket.on("play-video",(data)=>{


if(socket.deviceType!=="control")
return;



console.log(
"Novo vídeo:",
data.url
);



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






// ===============================
// PAUSAR GLOBAL
// ===============================


socket.on("pause-video",()=>{


if(socket.deviceType!=="control")
return;



if(
transmission.playing
){



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






// ===============================
// RETOMAR GLOBAL
// ===============================


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







// ===============================
// ALTERAR TEMPO
// ===============================


socket.on("seek-video",(data)=>{


if(socket.deviceType!=="control")
return;



let tempo =
Number(data.time);



if(isNaN(tempo))
return;




transmission.startedAt =
Date.now()-(tempo*1000);



transmission.pausedAt =
tempo;



io.emit(
"seek-video",
{

time:tempo

}

);



});







// sincronização periódica

setInterval(()=>{


if(
transmission.video &&
transmission.playing
){


io.emit(
"sync-time",
{

time:
(Date.now()-transmission.startedAt)/1000

}

);


}



},5000);







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
"Servidor rodando:",
PORT
);



});