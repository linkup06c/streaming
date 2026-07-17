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


app.get("/", (req,res)=>{
    res.send("Servidor de transmissão online!");
});


io.on("connection", (socket)=>{

    console.log("Dispositivo conectado:", socket.id);


    socket.on("disconnect", ()=>{

        console.log("Dispositivo saiu:", socket.id);

    });

});


const PORT = process.env.PORT || 3000;


server.listen(PORT, ()=>{

    console.log(
        "Servidor rodando na porta:",
        PORT
    );

});