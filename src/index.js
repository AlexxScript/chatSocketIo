import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from "socket.io";
import dotenv from "dotenv/config";
import morgan from "morgan";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

//adding cluster to run multiple instances of nodejs 
import { availableParallelism } from "node:os";
import cluster from "node:cluster";
import { createAdapter, setupPrimary } from "@socket.io/cluster-adapter";

if (cluster.isPrimary) {
    const numCPUs = availableParallelism();
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork({
            PORT: 3000 + i
        });
    }
    setupPrimary();
} else {
    const db = await open({
        filename: 'chat.db',
        driver: sqlite3.Database
    });

    await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_offset TEXT UNIQUE,
        content TEXT
    );
`);

    const app = express();
    const server = createServer(app);
    const io = new Server(server, {
        connectionStateRecovery: {},
        adapter: createAdapter()
    });
    const port = process.env.PORT ?? 3000;
    const __dirname = dirname(fileURLToPath(import.meta.url));

    app.use(morgan("tiny"))

    app.get('/', (req, res) => {
        res.sendFile(join(__dirname, 'index.html'));
    });


    var romo = 1;
    io.on("connection", async (socket) => {

        let connectedUsersCount = Object.keys(io.sockets.sockets).length;
        console.log(connectedUsersCount)
        socket.join("room1"+romo)
        io.to("room1"+romo).emit("hola",romo)

        socket.on("clientChatMessage", async (msg, clientOffset, callback) => {
            let result;
            try {
                result = await db.run("INSERT INTO messages (content,client_offset) VALUES (?,?)", msg, clientOffset)
            } catch (error) {
                console.log(error)
                if (error.errno === 19 /* SQLITE_CONSTRAINT */) {
                    // the message was already inserted, so we notify the client
                    callback();
                } else {
                    // nothing to do, just let the client retry
                }
                return;
            }
            io.emit("serverChatMessage", msg, result.lastID);
            //acknowledge the event
            callback();
        });

        if (!socket.recovered) {
            try {
                await db.each("SELECT id, content FROM messages WHERE id > ?", [socket.handshake.auth.serverOffset || 0],
                    (_err, row) => {
                        socket.emit("serverChatMessage", row.content, row.id)
                    }
                )
            } catch (error) {
                console.log(error);
            }
        }

        // socket.on("disconnect", () => {
        //     console.log("user disconnected");
        // })
    });


    server.listen(port, () => {
        console.log(`running on server: ${port}`);
    });


}