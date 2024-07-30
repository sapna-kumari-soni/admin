import dotenv from "dotenv";
import mongoose from "mongoose";
import { DB_NAME } from "./constant.js";
import connectDB from "./db/index.js";

dotenv.config({
    path:'./env'
})

connectDB()