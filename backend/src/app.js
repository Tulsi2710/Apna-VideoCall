import express from "express";
import { createServer } from "node:http";

import connectToSocket from "./controllers/socket.manager.js";

import mongoose from "mongoose";

import cors from "cors";
import userRoutes from "./routes/user.routes.js";

const app = express();
const server = createServer(app);
const io = connectToSocket(server);

app.set("port", (process.env.PORT || 8000));
app.use(cors());
app.use(express.json({limit: "40kb"}));
app.use(express.urlencoded({limit: "40kb", extended: "true"}));
app.use("/api/v1/users",userRoutes);

const start = async() => {
    app.set("mongo_user")
    const connectiondb = await mongoose.connect("mongodb+srv://tulsikaushik1003_db_user:FrLMZJw9RmSyvlrY@cluster0.b8qzvjn.mongodb.net/?appName=Cluster0");
    
    console.log(`MONGO connected at DB Host: ${connectiondb.connection.host}`)
    server.listen(app.get("port"), () => {
        console.log("LISTING ON PORT 8000");
    });


}

start();