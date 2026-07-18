const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");


const app = express();


app.use(cors());

app.use(express.json());



const server = http.createServer(app);



const io = new Server(server,{

    cors:{
        origin:"*"
    }

});





/*
========================
ESTADO GLOBAL
========================
*/


let transmission = {

    video:null,

    startedAt:null,

    pausedAt:0,

    playing:false

};





let playlist = [];


let currentIndex = -1;





let players = 0;


let controls = 0;







app.get("/",(req,res)=>{


    res.send(
        "X-Stream Sync Server Online"
    );


});









/*
========================
CONEXÕES
========================
*/


io.on("connection",(socket)=>{


console.log(
"Conectado:",
socket.id
);









/*
========================
REGISTRO
========================
*/


socket.on("register",(data)=>{


socket.deviceType =
data.type;





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



socket.emit(

"playlist-updated",

{

playlist,

currentIndex

}

);



}






if(data.type==="control"){


controls++;



socket.emit(

"server-status",

{

players,

controls,

transmission

}

);



socket.emit(

"playlist-updated",

{

playlist,

currentIndex

}

);



}



});









/*
========================
ADICIONAR VÍDEO
========================
*/


socket.on("add-video",(data)=>{


if(socket.deviceType!=="control")
return;



if(!data.url)
return;



const item = {


id:

Date.now().toString(),


url:data.url


};




playlist.push(item);





if(currentIndex===-1){

currentIndex=0;

}






io.emit(

"playlist-updated",

{

playlist,

currentIndex

}

);



});









/*
========================
REMOVER VÍDEO
========================
*/


socket.on("remove-video",(data)=>{


if(socket.deviceType!=="control")
return;



playlist =

playlist.filter(

item=>item.id !== data.id

);





if(
currentIndex >= playlist.length
){

currentIndex =
playlist.length-1;


}






io.emit(

"playlist-updated",

{

playlist,

currentIndex

}

);



});

/*
========================
LIMPAR PLAYLIST
========================
*/


socket.on("clear-playlist",()=>{


if(socket.deviceType!=="control")
return;



playlist=[];


currentIndex=-1;



transmission={

video:null,

startedAt:null,

pausedAt:0,

playing:false

};





io.emit(

"playlist-updated",

{

playlist,

currentIndex

}

);





io.emit(

"stop-video"

);



});









/*
========================
SELECIONAR VÍDEO
========================
*/


socket.on("select-video",(data)=>{


if(socket.deviceType!=="control")
return;



let index =

playlist.findIndex(

item=>item.id===data.id

);



if(index===-1)
return;



currentIndex=index;




let item =
playlist[currentIndex];






transmission={


video:item.url,


startedAt:Date.now(),


pausedAt:0,


playing:true


};







io.emit(

"play-video",

transmission

);






io.emit(

"playlist-updated",

{

playlist,

currentIndex

}

);



});









/*
========================
PRÓXIMO VÍDEO
========================
*/


socket.on("next-video",()=>{


if(socket.deviceType!=="control")
return;



if(
playlist.length===0
)
return;





currentIndex++;



if(
currentIndex >= playlist.length
){

currentIndex=0;

}





playCurrent();



});









/*
========================
VÍDEO ANTERIOR
========================
*/


socket.on("previous-video",()=>{


if(socket.deviceType!=="control")
return;



if(
playlist.length===0
)
return;





currentIndex--;



if(
currentIndex < 0
){

currentIndex =
playlist.length-1;

}





playCurrent();



});









/*
========================
FUNÇÃO TOCAR ATUAL
========================
*/


function playCurrent(){



let item =

playlist[currentIndex];



if(!item)
return;





transmission={


video:item.url,


startedAt:Date.now(),


pausedAt:0,


playing:true


};







io.emit(

"play-video",

transmission

);







io.emit(

"playlist-updated",

{

playlist,

currentIndex

}

);



}









/*
========================
PAUSAR
========================
*/


socket.on("pause-video",()=>{


if(socket.deviceType!=="control")
return;





if(transmission.playing){



transmission.pausedAt =

(Date.now()-transmission.startedAt)/1000;



}






transmission.playing=false;






io.emit(

"pause-video"

);



});









/*
========================
RETOMAR
========================
*/


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









/*
========================
PARAR / STANDBY
========================
*/


socket.on("stop-video",()=>{


if(socket.deviceType!=="control")
return;




transmission={


video:null,


startedAt:null,


pausedAt:0,


playing:false


};





io.emit(

"stop-video"

);



});

/*
========================
VÍDEO TERMINOU
========================
*/


socket.on("video-ended",()=>{


if(socket.deviceType!=="player")
return;



// tenta próximo automaticamente


if(
playlist.length > 0
){

currentIndex++;



if(
currentIndex >= playlist.length
){

currentIndex=0;

}



playCurrent();



}

else{


transmission={


video:null,


startedAt:null,


pausedAt:0,


playing:false


};



io.emit(

"stop-video"

);



}



});









/*
========================
ERRO NO VÍDEO
========================
*/


socket.on("video-error",()=>{


if(socket.deviceType!=="player")
return;



console.log(
"Erro recebido do player:",
socket.id
);





if(
playlist.length > 0
){

currentIndex++;



if(
currentIndex >= playlist.length
){

currentIndex=0;

}




playCurrent();



}

else{


io.emit(

"stop-video"

);



}



});









/*
========================
SINCRONIZAÇÃO
========================
*/


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





transmission.pausedAt =
tempo;





io.emit(

"seek-video",

{

time:tempo

}

);



});








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









/*
========================
DESCONECTAR
========================
*/


socket.on("disconnect",()=>{


if(socket.deviceType==="player"){


players--;


}


if(socket.deviceType==="control"){


controls--;


}




console.log(

"Saiu:",

socket.id

);



});





});









/*
========================
START SERVER
========================
*/


const PORT =

process.env.PORT || 3000;





server.listen(PORT,()=>{


console.log(

"Servidor rodando na porta",

PORT

);



});