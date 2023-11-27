const express = require("express");

const app = express();
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT
const base64 = require('base-64');
const request = require("request");
const mongoose = require('mongoose');
const Payment = require("./Models/PaymentsModel");

app.listen(port, ()=>{
    console.log(`app is running at ${port}`);
});
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cors());

app.get("/", (req, res)=>{
    res.send("<h1>Mpesa Intergrations</h1>")
})
const url = process.env.mongo_url;
mongoose.connect(url,{ writeConcern: { w: 'majority' }}).then(() => {
    console.log("connected successfully");
}).catch((error) => {
    console.log(error.message);
});

// app.get("/token",(req, res)=>{
//     res.json(200).access_token;
// })

app.get("/stkPush", generateToken,(req, res)=>{
    res.status(200).json({access_token: req.access_token});
})

//generate the token
function generateToken(req, res, next){
    const consumer = process.env.MPESA_CONSUMER_KEY;
    const secret = process.env.MPESA_CONSUMER_SECRET;
    const url = process.env.oauth_token_url;
    const auth = base64.encode(`${consumer}:${secret}`);
    request(
        {
            url:url,
            headers :{
                "Authorization":"Basic " + auth,
            },
        },
        (error, response, body)=>{
            if(error){
                console.log(error);
            }
            else{
                req.access_token = JSON.parse(body).access_token;
                next();
            }
        }
    )
}

app.post("/stkPush", generateToken, (req, res)=>{
    const phone = req.body.phone.substring(1);
    const amount = req.body.amount;
    const url =  process.env.PUSH_URL;
    const callback = process.env.CALLBACK;
    const auth = "Bearer " + req.access_token;
    const date = new Date();
     const shortCode = process.env.MPESA_PAYBILL;
     const passKey = process.env.MPESA_PASS_KEY;

     const year = date.getFullYear();
     const month = ('0' + (date.getMonth() + 1)).slice(-2);
     const day = ('0' + date.getDate()).slice(-2);
     const hours = ('0' + date.getHours()).slice(-2);
     const minutes = ('0' + date.getMinutes()).slice(-2);
     const seconds = ('0' + date.getSeconds()).slice(-2);

     const timestamp = year + month + day + hours + minutes + seconds;
     const password = new Buffer.from(shortCode + passKey + timestamp).toString('base64')
     request(
        {
            url: url,
            method: "POST",
            headers:{
                "Authorization": auth
            },
            json:{
                "BusinessShortCode": shortCode,
                "Password": password,
                "Timestamp": timestamp,
                "TransactionType": "CustomerPayBillOnline",
                "Amount": amount,
                "PartyA": `254${phone}`,
                "PartyB": shortCode,
                "PhoneNumber": `254${phone}`,
                "CallBackURL": callback,
                "AccountReference": "Gtech",
                "TransactionDesc": "Payment of service" 
            }
        },
        function(error, response, body){
            if(error){
                console.log(error);
            }
            res.status(200).json(body);
        }
    )
})

app.post("/callback", (req, res)=>{
    const callbackData = req.body;
    if(!callbackData.Body.stkCallback.CallbackMetadata){
        return res.json("ok");
    }
    const amount = callbackData.Body.stkCallback.CallbackMetadata.Item[0].Value;
    const trnxid = callbackData.Body.stkCallback.CallbackMetadata.Item[1].Value;
    const phone = callbackData.Body.stkCallback.CallbackMetadata.Item[3].Value;

    const payment = new Payment();
    payment.number = phone;
    payment.amount = amount;
    payment.trnsId = trnxid;

    payment.save().then((data)=>{
        console.log("saved correctly");
    }).catch((err)=>{
        console.log(err);
    });
})

app.get('/fetchTransactions', (req, res) => {
    Payment.find({})
      .then(transactions => {
        console.log('Transactions:', transactions);
        res.json(transactions);
      })
      .catch(err => {
        console.error('Error fetching transactions:', err);
        res.status(500).json({ error: 'Internal Server Error has occured' });
      });
  });