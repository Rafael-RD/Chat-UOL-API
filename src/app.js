import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
import Joi from 'joi';

const app = express();
dotenv.config();
app.use(express.json());

const mongoClient = new MongoClient(process.env.DATABASE_URL);

let db;
mongoClient.connect()
    .then(() => {
        db = mongoClient.db()
        db.collection('participants').deleteMany()
            .then(resp => console.log('limpeza de participantes ' + resp.deletedCount))
            .catch(err => console.log(err));
    })
    .catch(err => console.log(err));



const joiSchemes = {
    postParticipant: Joi.object({
        name: Joi.string()
            .min(3)
            .max(30)
            .required()
    }),
    getMessages: Joi.object()

};


// db.collection('participants').drop()
//     .then(resp=>console.log('limpeza de participantes '+resp))
//     .catch(err=>console.log(err));



app.get('/participants', async (req, res) => {
    db.collection('participants').find().toArray()
        .then((participants) => res.send(participants))
        .catch(err => res.status(500).send(err));
});

app.post('/participants', async (req, res) => {
    const { name } = req.body;
    if (!name || typeof (name) !== 'string') return res.sendStatus(422);
    db.collection('participants').findOne({ name })
        .then(search => {
            if (search) return res.sendStatus(409);
            else {
                db.collection('participants').insertOne({ name, lastStatus: Date.now() })
                    .then(() => {
                        db.collection('messages').insertOne({ from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format('HH:mm:ss') })
                            .then(() => res.sendStatus(201))
                            .catch(err => res.status(500).send(err));
                    })
                    .catch(err => res.status(500).send(err));
            }
        })
    // db.collection('participants').insertOne({name, lastStatus: Date.now()})
    //     .then(()=>{
    //         db.collection('messages').insertOne({from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format('HH:mm:ss')})
    //             .then(()=>res.sendStatus(201))
    //             .catch(err=>res.status(500).send(err));
    //     })
    //     .catch(err=>res.status(500).send(err));
});

app.get('/messages', async (req, res) => {
    const user = req.headers.user;
    const { limit } = req.query;
    if (limit !== undefined && (limit <= 0 || Number(limit) === NaN)) return res.status(422).send('query invalida');
    db.collection('messages').find({ $or: [{ type: 'message' }, { to: 'Todos' }, { from: user }, { to: user }] }).toArray()
        .then((messages) => res.send(messages))
        .catch(err => res.status(500).send(err));
});

app.post('/messages', async (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.user;
    db.collection('participants').findOne({ name: from })
        .then(search => {
            if (!search) return res.status(422).send('Remetente deve ser valido');
            else {
                if (!to || typeof (to) !== 'string') return res.status(422).send('Destinatario deve ser valido');
                if (!text || typeof (text) !== 'string') return res.status(422).send('Mensagem deve ser valida');
                if (!(type === 'message' || type === 'private_message')) return res.status(422).send('Tipo deve ser valido');
                db.collection('messages').insertOne({ from, to, text, type, time: dayjs().format('HH:mm:ss') })
                    .then(() => res.sendStatus(201))
                    .catch(err => res.status(500).send(err));
            }
        })
        .catch(err => res.status(500).send(err));
    // if(!to || typeof(to)!=='string') return res.status(422).send('Destinatario deve ser valido');
    // if(!text || typeof(text)!=='string') return res.status(422).send('Mensagem deve ser valida');
    // if(!from || typeof(from)!=='string' || ) return res.status(422).send('Remetente deve ser valido');

});

app.post('/status', async (req, res) => {
    const { user } = req.headers.user;
    if (!user) return res.sendStatus(404);
    db.collection('participants').findOne({ name: user })
        .then(search => {
            if (!search) return res.sendStatus(404);
            //atualizar lastseen
        })
        .catch(err => res.status(500).send(err));
});

app.delete('/messages/:id', async (req, res) => {
    const { id } = req.params;
    const { user } = req.headers;
    db.collection('messages').findOne({ _id: new ObjectId(id) })
        .then(search => {
            if (!search) return res.sendStatus(404);
            if (search.from !== user) return res.sendStatus(401);
            db.collection('messages').deleteOne(search)
                .then(resp => res.send(resp))
                .catch(err => res.status(500).send(err));
        })
        .catch(err => res.status(500).send(err));

});

app.put('/messages/:id', async (req, res) => {
    const { id } = req.params;
    const { user } = req.headers;
    const { to, text, type } = req.body;
    const updMessage = {};
    if (to) updMessage.to = to;
    if (text) updMessage.text = text;
    if (type) updMessage.type = type;

    try{
        const search = await db.collection('messages').findOne({_id: new ObjectId(id)});
        if(!search) return res.sendStatus(404);
        if(search.from !== user) return res.sendStatus(403);
        const updLog= await db.collection('messages').updateOne({_id: new ObjectId(id)}, {$set: updMessage});
        console.log(updLog);
        return res.sendStatus(200);
    }catch(err){
        res.sendStatus(500);
        console.log(err);
        return err;
    }

});



app.listen(process.env.PORT, () => console.log(`Server on ${process.env.PORT}`));