import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import dayjs from 'dayjs';

const app=express();
dotenv.config();
app.use(express.json());

const mongoClient=new MongoClient(process.env.DATABASE_URL);

let db;
mongoClient.connect()
    .then(()=>db=mongoClient.db())
    .catch(err=>console.log(err));



app.get('/participants', (req, res)=>{
    db.collection('participants').find().toArray()
        .then((participants)=>res.send(participants))
        .catch(err=>res.status(500).send(err));
});

app.post('/participants', (req, res)=>{
    const {name}=req.body;
    if(!name) return res.sendStatus(422);
    db.collection('participants').findOne({name})
        .then(search=>{
            if(search) return res.sendStatus(409);
            else{
                db.collection('participants').insertOne({name, lastStatus: Date.now()})
                    .then(()=>{
                        db.collection('messages').insertOne({from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format('HH:mm:ss')})
                            .then(()=>res.sendStatus(201))
                            .catch(err=>res.status(500).send(err));
                    })
                    .catch(err=>res.status(500).send(err));
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

app.get('/messages', (req, res)=>{
    const user=req.headers.user;
    const {limit}=req.params;
    if(limit!==undefined && (limit<=0 || Number(limit)===NaN)) return res.status(422).send('query invalida');
    db.collection('messages').find({$or: [{type: 'message'}, {to: 'Todos'}, {from: user}, {to: user}]}).toArray()
        .then((messages)=>res.send(messages))
        .catch(err=>res.status(500).send(err));
});

app.post('/messages', (req, res)=>{
    const {to, text, type}=req.body;
    const from=req.headers.user;
    db.collection('participants').findOne({name: from})
        .then(search=>{
            if(!search) return res.status(422).send('Remetente deve ser valido');
            else{
                if(!to || typeof(to)!=='string') return res.status(422).send('Destinatario deve ser valido');
                if(!text || typeof(text)!=='string') return res.status(422).send('Mensagem deve ser valida');
                if(!(type==='message' || type==='private_message')) return res.status(422).send('Tipo deve ser valido');
                db.collection('messages').insertOne({from, to, text, type, time: dayjs().format('HH:mm:ss')})
                    .then(()=>res.sendStatus(201))
                    .catch(err=>res.status(500).send(err));
            }
        })
        .catch(err=>res.status(500).send(err));
    // if(!to || typeof(to)!=='string') return res.status(422).send('Destinatario deve ser valido');
    // if(!text || typeof(text)!=='string') return res.status(422).send('Mensagem deve ser valida');
    // if(!from || typeof(from)!=='string' || ) return res.status(422).send('Remetente deve ser valido');

});

app.get('/status', (req, res)=>{

});

app.delete('/messages/:id', (req, res)=>{
    const {id}=req.params;

});

app.put('/messages/:id', (req, res)=>{
    const {id}=req.params;

});



app.listen(process.env.PORT, ()=>console.log(`Server on ${process.env.PORT}`));