import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
import Joi from 'joi';
import { stripHtml } from "string-strip-html";

const app = express();
dotenv.config();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.DATABASE_URL);

function applyStripHtml(target){
    if(typeof(target)==='string') return stripHtml(target).result;
    else return target;
}


const joiSchemes = {
    postParticipant: Joi.object({
        name: Joi.string().min(3).max(30).required().trim()
    }),
    getMessages: Joi.object({
        user: Joi.string().min(3).max(30).required().trim(),
        limit: Joi.number().integer().min(1)
    }),
    postMessages: Joi.object({
        to: Joi.string().min(3).max(30).required().trim(),
        text: Joi.string().min(1).required().trim(),
        type: Joi.string().valid('message','private_message').required(),
        from: Joi.string().required().trim()
    }),
    putMessages: Joi.object({
        id: Joi.string().hex().required(),
        to: Joi.string().min(3).max(30).trim(),
        text: Joi.string().min(1).trim(),
        type: Joi.string().valid('message','private_message'),
        from: Joi.string().required().trim()
    }),
    postStatus: Joi.object({
        user: Joi.string().required().trim()
    })

};

try {
    await mongoClient.connect();
    console.log('MongoDB connected');
} catch (err) {
    console.log(err)
}

const db = mongoClient.db();


setInterval(async () => {
    try{
        const toRemove=await db.collection('participants').find({lastStatus: {$lt: Date.now()-10000 }}).toArray();
        if(toRemove.length===0) return;
        const {deletedCount}=await db.collection('participants').deleteMany({name: {$in: toRemove.map(e=>e.name)}});
        console.log("Inativos deletados: "+deletedCount);
        try{
            await db.collection('messages').insertMany(toRemove.map(e=>{
                return { 
                    from: e.name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: dayjs().format('HH:mm:ss')
                }
            }))
        }catch(err){
            console.log(err);
        }
    }catch (err) {
        console.log(err);
    }

}, 15000);


app.get('/participants', async (req, res) => {
    try {
        const participants = await db.collection('participants').find().toArray();
        return res.send(participants);
    } catch (err) {
        console.log(err);
        return res.sendStatus(500);
    }
});

app.post('/participants', async (req, res) => {
    const name = applyStripHtml(req.body.name);
    const validation=joiSchemes.postParticipant.validate({name});
    if(validation.error) return res.sendStatus(422);

    try {
        const search = await db.collection('participants').findOne({ name: validation.value.name });
        if (search) return res.sendStatus(409);
        await db.collection('participants').insertOne({ name: validation.value.name, lastStatus: Date.now() });
        await db.collection('messages').insertOne({
            from: validation.value.name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        });
        return res.sendStatus(201);
    } catch (err) {
        console.log(err);
        return res.sendStatus(500);
    }
});

app.get('/messages', async (req, res) => {
    const user = applyStripHtml(req.headers.user).trim();
    const limit = Number(req.query.limit);
    if (limit !== undefined && (limit <= 0 || isNaN(limit))) return res.status(422).send('query invalida');
    try{
        const messages=await db.collection('messages').find({ $or: [{ type: 'message' }, { to: 'Todos' }, { from: user }, { to: user }] }).toArray();
        if(limit) return res.send(messages.slice(-limit));
        else return res.send(messages);
    }catch (err) {
        console.log(err);
        return res.sendStatus(500);
    }
});


app.post('/messages', async (req, res) => {
    // const { to, text, type } = req.body;
    // const from = req.headers.user;
    const to=applyStripHtml(req.body.to);
    const text=applyStripHtml(req.body.text);
    const from=applyStripHtml(req.headers.user);
    const type=req.body.type;
    
    const validation=joiSchemes.postMessages.validate({to, text, type, from},{abortEarly: false});
    if(validation.error) return res.status(422).send(validation.error.details.map(det=>det.message));
    try{
        const search=await db.collection('participants').findOne({ name: validation.value.from });
        if (!search) return res.status(422).send('Remetente deve ser valido'); 
        await db.collection('messages').insertOne({ 
            from: validation.value.from, 
            to: validation.value.to, 
            text: validation.value.text, 
            type: validation.value.type, 
            time: dayjs().format('HH:mm:ss') 
        });
        return res.sendStatus(201);
    }catch (err) {
        console.log(err);
        return res.sendStatus(500);
    }
});

app.post('/status', async (req, res) => {
    const user= applyStripHtml(req.headers.user);
    const validation=joiSchemes.postStatus.validate({user});
    if(validation.error) return res.status(422).send(validation.error.map(det=>det.message));
    try{
        const search=await db.collection('participants').findOne({ name: validation.value.user });
        if(!search) return res.sendStatus(404);
        await db.collection('participants').updateOne(search, {$set: {lastStatus: Date.now() }});
        return res.sendStatus(200);
    }catch (err) {
        console.log(err);
        return res.sendStatus(500);
    }
});

app.delete('/messages/:id', async (req, res) => {
    const { id } = req.params;
    const user = applyStripHtml(req.headers.user);
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
    // const { user: from } = req.headers;
    // const { to, text, type } = req.body;

    const to=applyStripHtml(req.body.to);
    const text=applyStripHtml(req.body.text);
    const from=applyStripHtml(req.headers.user);
    const type=req.body.type;


    
    const validation=joiSchemes.putMessages.validate({id, to, text, type, from},{abortEarly: false});
    if(validation.error) return res.status(422).send(validation.error.details.map(det=>det.message));

    const updMessage = {};
    if (to) updMessage.to = validation.value.to;
    if (text) updMessage.text = validation.value.text;
    if (type) updMessage.type = validation.value.type;

    try {
        const search = await db.collection('messages').findOne({ _id: new ObjectId(id) });
        if (!search) return res.sendStatus(404);
        if (search.from !== validation.value.from) return res.sendStatus(401);
        const updLog = await db.collection('messages').updateOne({ _id: new ObjectId(id) }, { $set: updMessage });
        return res.sendStatus(200);
    } catch (err) {
        console.log(err);
        return res.sendStatus(500);
    }

});



app.listen(process.env.PORT, () => console.log(`Server on ${process.env.PORT}`));