import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from "socket.io";
import dotenv from "dotenv/config";
import morgan from "morgan";

const app = express();
const server = createServer(app);
const io = new Server(server, {
    connectionStateRecovery: {}
});
const port = process.env.PORT ?? 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(morgan("tiny"))

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

io.on("connection", (socket) => {
    console.log("user connected");

    socket.on("clientChatMessage", (msg) => {
        io.emit("serverChatMessage", msg);
    });

    socket.on("disconnect",()=>{
        console.log("user disconnected");
    })
});


server.listen(port, () => {
    console.log(`running on server: ${port}`);
});


