const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const EventEmitter = require('events');
const bus = new EventEmitter();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')
const cors = require('cors');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.static("public"))
app.use(express.json())

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status(401).send({ error: true, message: 'Unauthorize Access' })
    }
    const token = authorization.split(' ')[1];
  
    jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
      if (error) {
        console.log(error)
        return res.send({ error: true, message: 'Unauthorize Access' })
      }
      req.decoded = decoded;
      next()
    })
  }




const uri =`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hrxywfz.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
       
        await client.db("admin").command({ ping: 1 });

        
        const classCollection = client.db('Rainbow').collection('allClasses')
        const selectedClassCollection = client.db('Rainbow').collection('selectedClasses')
        const enrolledClassCollection = client.db('Rainbow').collection('enrolledClasses')
        const userCollection = client.db('Rainbow').collection('users')
        const paymentCollection = client.db('Rainbow').collection('payment')
       

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '10h' })
            res.send({ token })
          })

       
       
        app.post('/all-classes', async (req, res) => {
            const classes = req.body
            const result = await classCollection.insertOne(classes)
            res.send(result)
        })
        app.post('/selected-class', async (req, res) => {
            const selectedClass = req.body;
            const result = await selectedClassCollection.insertOne(selectedClass)
            res.send(result)
        })
        app.get('/selected-classes',verifyJWT,async (req, res) => {
            const email = req.query.email;
            const query = { studentEmail: email }
            const result = await selectedClassCollection.find(query).toArray()
            res.send(result)
        })
        app.get('/selected-class/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await selectedClassCollection.findOne(query)
            res.send(result)
        })
        app.delete('/selected-classes/:id',verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await selectedClassCollection.deleteOne(query)
            res.send(result)
        })
        app.get('/approved-all-classes', async (req, res) => {
            const query = {status : 'Approved'} //only shows the approved classes
            const result = await classCollection.find(query).toArray()
            res.send(result)
        })
        app.get('/all-classes',verifyJWT, async (req, res) => {
            const result = await classCollection.find().toArray()
            res.send(result)
        })
        

        app.get('/all-classes/:email',verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { instructorEmail: email }
            const result = await classCollection.find(query).toArray()
            res.send(result)
        })
        app.put('/all-classes/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.query.status;
            const feedback = req.query.feedback;
            if (status === 'approved') {
                const query = { _id: new ObjectId(id) }
                const updatedDoc = {
                    $set: {
                        status: 'Approved'
                    }
                }
                const result = await classCollection.updateOne(query, updatedDoc)
                res.send(result)
            }
            if (status === 'denied') {
                const query = { _id: new ObjectId(id) }
                const updatedDoc = {
                    $set: {
                        status: 'Denied'
                    }
                }
                const result = await classCollection.updateOne(query, updatedDoc)
                res.send(result)
            }
            if (feedback) {
                const query = { _id: new ObjectId(id) }
                const updatedDoc = {
                    $set: {
                        feedback: feedback
                    }
                }
                const result = await classCollection.updateOne(query, updatedDoc)
                res.send(result)
            }
        })
        app.get('/popular-classes',async(req, res)=>{
            const query = {status : 'Approved'}
            const result = await classCollection.find(query).sort({enrolledStudents : -1}).toArray()
            res.send(result)
        })
        app.get('/enrolled-classes',verifyJWT, async(req, res)=>{
            const result = await enrolledClassCollection.find().toArray()
            res.send(result)
        })

        //users api
        app.post('/all-users', async (req, res) => {
            const user = req.body;
            const query = { email: user?.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({})
            }
            const result = await userCollection.insertOne(user)
            res.send(result)
        })
        app.get('/user/admin/:email',verifyJWT, async(req, res)=>{
            const email = req.params.email;
            const query = {email : email, role : 'admin'}
            const admin = await userCollection.findOne(query)
            res.send(admin)
        })
        app.get('/user/instructor/:email',verifyJWT, async(req, res)=>{
            const email = req.params.email;
            const query = {email : email, role : 'instructor'}
            const instructor = await userCollection.findOne(query)
            res.send(instructor)
        })
        app.get('/user/student/:email',verifyJWT, async(req, res)=>{
            const email = req.params.email;
            const query = {email : email, role : 'student'}
            const student = await userCollection.findOne(query)
            res.send(student)
        })
        app.get('/current-user', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await userCollection.findOne(query)
            res.send(result)
        })
        app.get('/all-users',verifyJWT, async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })
        app.get('/all-instructors', async(req, res)=>{
            const query = {role: 'instructor'}
            const result = await userCollection.find(query).toArray()
            res.send(result)
        })
        app.put('/all-users/:id',verifyJWT, async (req, res) => {
            const id = req.params.id;
            const role = req.query.role;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: role
                }
            }
            const result = await userCollection.updateOne(query, updatedDoc)
            res.send(result)
        })
        app.get('/popular-instructors', async(req, res)=>{
            const query = {role : 'instructor'}
            const result = await userCollection.find(query).toArray()
            res.send(result)
        })
       
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = Math.round(price * 100);
            const stripeClient = stripe(process.env.STRIPE_KEY);
            try {
                // Create a PaymentIntent with the order amount and currency
                const paymentIntent = await stripeClient.paymentIntents.create({
                    amount: amount,
                    currency: "usd",
                    automatic_payment_methods: {
                        enabled: true,
                    },
                });

                res.send({
                    clientSecret: paymentIntent.client_secret,
                });
            } catch (error) {
                console.log(error);
                res.status(500).send({ error: "An error occurred while creating the PaymentIntent." });
            }
        });
        app.post('/payment',verifyJWT,async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);

            const enrolledQuery = { studentEmail: payment.email, classId: payment.classId }
            const enrolledClass =  await selectedClassCollection.findOne(enrolledQuery)
            const enrolledInsertResult = await enrolledClassCollection.insertOne(enrolledClass)

            const enrolledDeleteResult = await selectedClassCollection.deleteOne(enrolledQuery)

            const classQuery = { _id: new ObjectId(payment.classId) };
            const classDocument = await classCollection.findOne(classQuery); 

            if (classDocument && classDocument.seats > 0) {
                const updatedSeats = classDocument.seats - 1;
                const updateEnrolledStudents = classDocument.enrolledStudents + 1;
                const updateResult = await classCollection.updateOne(
                    classQuery,
                    { $set: { seats: updatedSeats, enrolledStudents : updateEnrolledStudents } }
                );

                res.send({ insertResult, updateResult, enrolledDeleteResult, enrolledInsertResult });
            }
        });
        app.get('/payment-history',verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = {email : email}
            const result = await paymentCollection.find(query).sort({date : -1}).toArray()
            res.send(result)
        })





        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
            // Ensures that the client will close when you finish/error
            // await client.close();
          }
}

run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Rainbow drawing school is running')
})

app.listen(port, (req, res) => {
    console.log(`server is running port ${port}`)
})








