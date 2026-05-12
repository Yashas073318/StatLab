const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI || process.env.MONGO_DB_URI || 'mongodb://localhost:27017/statlab';
let isConnection = false;

const connectDB = async () => {
    if(isConnection){
        return;
    }

    try{
        if(!uri){
            throw new Error('MONGO_URI is not defined');
        }
        const connection = await mongoose.connect(uri);
        isConnection = true;
        console.log('✓ Connected to DB successfully', connection.connection.host);
        return connection;
    } catch(error){
        console.error('✗ Error connecting to DB', error);
        throw error;
    }
};

module.exports = { connectDB };
